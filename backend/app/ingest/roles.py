"""
役職（委員会名簿・院役員）インジェスト → influence_roles。

データ源（公式・実HTMLで構造検証済）:
  衆議院 委員会名簿: .../itdb_iinkai.nsf/html/iinkai/list.htm → iin_j*.htm / iin_t*.htm
    Shift_JIS。<td headers="IIN.YAKUSHOKU|IIN.SHIMEI|IIN.KANA|IIN.KAIHA"> で機械可読。
    例: 委員長 / 山下　貴司君 / 自民。
  参議院 委員会名簿: .../konkokkai/current/list/l*.htm （UTF-8）
    <table> 行 = [役職, 氏名, 会派名（略称）]。例: 委員長 / 北村　　経夫 / （自民）。

設計:
  - パーサ（parse_shugiin_committee / parse_sangiin_committee）は HTML 文字列を受け取る純粋関数。
  - role_name は calculator.ROLE_LEVEL_WEIGHTS のキー（委員長/理事/委員/特別委員長）に揃える。
  - 基準日『令和x年x月x日現在』を start_date（観測日）とする。
  - 再取得時は source_url（委員会ページURL）単位で既存を置換し、名簿を最新化する。
  - 議員突合は氏名正規化＋house。未突合はスキップ（ゴミを作らない）。
"""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass
from datetime import date
from typing import Optional
from urllib.parse import urljoin

from bs4 import BeautifulSoup
from sqlalchemy.orm import Session

from app.ingest.bills_shugiin import match_key, wareki_to_iso
from app.ingest.hashing import stable_hash
from app.models import InfluenceRole, Politician
from app.scoring.calculator import ROLE_LEVEL_WEIGHTS

log = logging.getLogger(__name__)

_KIJUNBI_RE = re.compile(
    r"(?:令和|平成|昭和)\s*(?:元|[0-9０-９]+)\s*年\s*[0-9０-９]+\s*月\s*[0-9０-９]+\s*日現在"
)


@dataclass
class RoleRecord:
    name: str           # 氏名（生・君や全角空白を含みうる）
    house: str          # representatives | councillors
    role_name: str      # 委員長 / 理事 / 委員 / 特別委員長 ...
    role_scope: str     # committee | parliament
    start_date: Optional[str]   # ISO（観測日）or None
    source_url: str


def _kijunbi_iso(html: str) -> Optional[str]:
    m = _KIJUNBI_RE.search(html or "")
    return wareki_to_iso(m.group(0)) if m else None


def _committee_role_name(committee: str, yakushoku: str) -> str:
    y = (yakushoku or "").strip() or "委員"
    if y == "委員長" and "特別委員" in (committee or ""):
        return "特別委員長"
    return y


def _headers_key(cell) -> str:
    h = cell.get("headers")
    return " ".join(h) if isinstance(h, list) else (h or "")


def parse_shugiin_committee(html: str, source_url: str) -> list[RoleRecord]:
    """衆議院 委員会名簿HTML（Shift_JISデコード済文字列）を役職レコードに変換。"""
    soup = BeautifulSoup(html, "html.parser")
    title = soup.title.get_text(strip=True) if soup.title else ""
    committee = title.replace("委員名簿", "").strip()
    start = _kijunbi_iso(html)

    yakushoku, shimei = [], []
    for c in soup.find_all("td", attrs={"headers": True}):
        key = _headers_key(c)
        val = c.get_text(strip=True)
        if "IIN.YAKUSHOKU" in key:
            yakushoku.append(val)
        elif "IIN.SHIMEI" in key:
            shimei.append(val)

    out = []
    for y, s in zip(yakushoku, shimei):
        if not s:
            continue
        out.append(
            RoleRecord(
                name=s,
                house="representatives",
                role_name=_committee_role_name(committee, y),
                role_scope="committee",
                start_date=start,
                source_url=source_url,
            )
        )
    return out


# 参議院 今国会の委員会一覧（各委員会名簿 list/l*.htm へのリンク集）。
SANGIIN_COMMITTEE_INDEX = (
    "https://www.sangiin.go.jp/japanese/kon_kokkaijyoho/iinkai/tiinkai.html"
)
# 委員名簿ページ（写真版 plist/p*.htm は除外する）。
_SAN_ROSTER_RE = re.compile(r"/konkokkai/current/list/l\d+\.htm$")


def sangiin_roster_urls(
    index_html: str, base_url: str = SANGIIN_COMMITTEE_INDEX
) -> list[str]:
    """参委員会インデックスHTMLから委員名簿(list/l*.htm)の絶対URLを重複なく返す。

    href は相対表記でも urljoin で絶対化する。写真版(plist/p*.htm)は対象外。
    """
    soup = BeautifulSoup(index_html, "html.parser")
    seen: set[str] = set()
    out: list[str] = []
    for a in soup.find_all("a", href=True):
        full = urljoin(base_url, a["href"])
        if _SAN_ROSTER_RE.search(full) and full not in seen:
            seen.add(full)
            out.append(full)
    return out


def parse_sangiin_committee(html: str, source_url: str) -> list[RoleRecord]:
    """参議院 委員会名簿HTML（UTF-8）を役職レコードに変換。"""
    soup = BeautifulSoup(html, "html.parser")
    title = soup.title.get_text(strip=True) if soup.title else ""
    committee = title.split("：")[0].replace("委員名簿", "").strip()
    start = _kijunbi_iso(html)

    tables = soup.find_all("table")
    if not tables:
        return []
    big = max(tables, key=lambda t: len(t.find_all("tr")))

    out = []
    for tr in big.find_all("tr"):
        cells = [td.get_text(strip=True) for td in tr.find_all(["td", "th"])]
        if len(cells) < 2:
            continue
        yakushoku, shimei = cells[0], cells[1]
        if not shimei or shimei == "氏名" or yakushoku == "役職":
            continue
        out.append(
            RoleRecord(
                name=shimei,
                house="councillors",
                role_name=_committee_role_name(committee, yakushoku),
                role_scope="committee",
                start_date=start,
                source_url=source_url,
            )
        )
    return out


def _politician_index(db: Session, house: str) -> dict[str, Optional[int]]:
    idx: dict[str, Optional[int]] = {}
    for pid, name in (
        db.query(Politician.id, Politician.name_ja)
        .filter(Politician.house == house)
        .all()
    ):
        key = match_key(name)
        if not key:
            continue
        idx[key] = None if key in idx else pid
    return idx


def ingest_roles(db: Session, records: list[RoleRecord]) -> dict:
    """役職レコードを influence_roles へ投入する（source_url 単位で置換）。"""
    urls = {r.source_url for r in records if r.source_url}
    for url in urls:
        db.query(InfluenceRole).filter(InfluenceRole.source_url == url).delete(
            synchronize_session=False
        )

    idx_cache: dict[str, dict[str, Optional[int]]] = {}
    inserted = unmatched = 0
    seen: set[str] = set()

    for r in records:
        idx = idx_cache.setdefault(r.house, _politician_index(db, r.house))
        pid = idx.get(match_key(r.name))
        if not pid:
            unmatched += 1
            continue
        h = stable_hash(f"{r.role_scope}:{r.source_url}:{pid}:{r.role_name}")
        if h in seen:
            continue
        seen.add(h)
        db.add(
            InfluenceRole(
                politician_id=pid,
                role_scope=r.role_scope,
                role_name=r.role_name,
                level_weight=float(ROLE_LEVEL_WEIGHTS.get(r.role_name, 1.0)),
                start_date=date.fromisoformat(r.start_date) if r.start_date else None,
                source_url=r.source_url,
                source_hash=h,
            )
        )
        inserted += 1

    db.commit()
    result = {"inserted": inserted, "unmatched": unmatched, "committees": len(urls)}
    log.info("役職インジェスト完了: %s", result)
    return result
