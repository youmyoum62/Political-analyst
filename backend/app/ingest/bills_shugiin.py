"""
衆議院 法案(議案)インジェスト。

データ源: SmartNews Media Research Institute「国会議案データベース：衆議院」
  リポジトリ: https://github.com/smartnews-smri/house-of-representatives （MIT）
  CSV(raw): https://raw.githubusercontent.com/smartnews-smri/house-of-representatives/main/data/gian.csv
  一次情報は衆議院公式『議案情報』。出典表記「スマートニュース メディア研究所」が必要（MIT）。

設計:
  - 純粋関数（wareki_to_iso / normalize_name / parse_sponsors / map_status / row_to_bill）は
    ネットワーク・DB に依存せず単体テスト可能。
  - 取得(_download) と DB upsert(ingest_shugiin_bills) は分離。
  - 閣法（提出者=内閣）は個人 sponsor が無いため自然に空リストになる。
  - 議員突合は氏名正規化（君・全半角空白除去）＋ house=representatives。同名衝突は
    曖昧として紐付けをスキップ（誤った人物への帰属を避ける）。bills から議員は新規作成しない。
"""

from __future__ import annotations

import csv
import io
import logging
import re
from dataclasses import dataclass, field
from datetime import date
from typing import Optional

import requests
from sqlalchemy.orm import Session

from app.ingest.hashing import stable_hash
from app.models import Bill, BillSponsor, Politician

log = logging.getLogger(__name__)

GIAN_CSV_URL = (
    "https://raw.githubusercontent.com/smartnews-smri/"
    "house-of-representatives/main/data/gian.csv"
)

# 元号 → 西暦換算の基準（元年=基準+1）
_ERA_BASE = {"令和": 2018, "平成": 1988, "昭和": 1925}
_WAREKI_RE = re.compile(
    r"(令和|平成|昭和)\s*(元|[0-9０-９]+)\s*年\s*([0-9０-９]+)\s*月\s*([0-9０-９]+)\s*日"
)

# 審議状況(Value文字列) → 本プロジェクトの status enum
# （否決コードは衆院データに存在せず、承諾なし/不同意を rejected に寄せる）
_STATUS_MAP: dict[str, str] = {
    "成立": "passed",
    "両院議決": "passed",
    "両院承認": "passed",
    "両院承諾": "passed",
    "承認": "passed",
    "承諾": "passed",
    "撤回": "withdrawn",
    "撤回承諾": "withdrawn",
    "承諾なし": "rejected",
    "参議院回付案（不同意）": "rejected",
    "本院可決": "in_committee",
    "本院議了": "in_committee",
    "本院修正議決": "in_committee",
    "衆議院議決案（可決）": "in_committee",
    "衆議院で閉会中審査": "in_committee",
    "参議院で閉会中審査": "in_committee",
    "閉会中審査": "in_committee",
    "未了": "in_committee",
    "中間報告": "in_committee",
    "参議院議了": "in_committee",
    "衆議院で審議中": "in_committee",
    "参議院で審議中": "in_committee",
    "衆議院で併合修正": "in_committee",
    "衆議院回付案（同意）": "in_committee",
    "参議院回付案（同意）": "in_committee",
    "両院の意見が一致しない旨報告": "in_committee",
    "修正承諾": "in_committee",
    "議決不要": "submitted",
}


@dataclass
class BillRow:
    bill_code: str
    title: str
    status: str
    submitted_date: Optional[str]   # ISO or None
    passed_date: Optional[str]      # ISO or None
    source_url: str
    primary_sponsors: list[str] = field(default_factory=list)
    co_sponsors: list[str] = field(default_factory=list)


def _z2h(s: str) -> str:
    return s.translate(str.maketrans("０１２３４５６７８９", "0123456789"))


def wareki_to_iso(text: str | None) -> Optional[str]:
    """和暦文字列（例『令和 8年 3月12日』）から ISO 日付を返す。無ければ None。"""
    if not text:
        return None
    m = _WAREKI_RE.search(text)
    if not m:
        return None
    era, y, mo, d = m.groups()
    year = _ERA_BASE[era] + (1 if y == "元" else int(_z2h(y)))
    try:
        return date(year, int(_z2h(mo)), int(_z2h(d))).isoformat()
    except ValueError:
        return None


def map_status(value: str | None) -> str:
    return _STATUS_MAP.get((value or "").strip(), "submitted")


def match_key(name: str | None) -> str:
    """議員突合用キー: 『君』と全半角空白を除去する。"""
    s = (name or "").strip()
    if s.endswith("君"):
        s = s[:-1]
    return s.replace("　", "").replace(" ", "").strip()


def normalize_name(name: str | None) -> str:
    """提出者氏名の表示用正規化（match_key と同じ規則）。"""
    return match_key(name)


def parse_sponsors(cell: str | None) -> list[str]:
    """『氏名君; 氏名君; ...』を正規化済み氏名リストにする。"""
    if not cell:
        return []
    return [nm for nm in (normalize_name(p) for p in cell.split(";")) if nm]


def row_to_bill(row: dict) -> Optional[BillRow]:
    """gian.csv の1行を BillRow に変換する。必須項目が無ければ None。"""
    title = (row.get("議案件名") or "").strip()
    bangou = (row.get("番号") or "").strip()
    teishutsu = (row.get("提出回次") or "").strip()
    gtype = (row.get("議案種類") or "").strip()
    if not title or not bangou or not teishutsu:
        return None

    status = map_status(row.get("審議状況"))
    submitted = wareki_to_iso(row.get("衆議院議案受理年月日")) or wareki_to_iso(
        row.get("衆議院予備審査議案受理年月日")
    )
    passed = wareki_to_iso(row.get("公布年月日／法律番号")) if status == "passed" else None

    bill_code = f"hr-{gtype}-{teishutsu}-{bangou}"
    return BillRow(
        bill_code=bill_code,
        title=title[:500],
        status=status,
        submitted_date=submitted,
        passed_date=passed,
        source_url=(row.get("経過情報URL") or "").strip(),
        primary_sponsors=parse_sponsors(row.get("議案提出者一覧")),
        co_sponsors=parse_sponsors(row.get("議案提出の賛成者")),
    )


def parse_csv(csv_text: str) -> list[dict]:
    return list(csv.DictReader(io.StringIO(csv_text)))


def _download(url: str) -> str:
    resp = requests.get(url, timeout=120)
    resp.raise_for_status()
    resp.encoding = "utf-8"
    return resp.text


def _build_politician_index(db: Session) -> dict[str, Optional[int]]:
    """衆院議員の {突合キー: politician_id} 索引。同名衝突は None（曖昧）にする。"""
    index: dict[str, Optional[int]] = {}
    rows = db.query(Politician.id, Politician.name_ja).filter(
        Politician.house == "representatives"
    ).all()
    for pid, name in rows:
        key = match_key(name)
        if not key:
            continue
        index[key] = None if key in index else pid
    return index


def _iso_to_date(s: Optional[str]) -> Optional[date]:
    return date.fromisoformat(s) if s else None


def ingest_shugiin_bills(
    db: Session,
    csv_text: Optional[str] = None,
    url: str = GIAN_CSV_URL,
    since_kaiji: Optional[int] = None,
    limit: Optional[int] = None,
) -> dict:
    """
    衆院 gian.csv から bills / bill_sponsors を upsert する。

    csv_text を渡せばネットワーク取得をスキップ（テスト用）。
    since_kaiji: 提出回次がこの値以上の議案のみ対象。
    limit: 処理する議案数の上限。
    """
    if csv_text is None:
        csv_text = _download(url)
    rows = parse_csv(csv_text)
    pol_index = _build_politician_index(db)

    inserted = updated = sponsor_links = unmatched = processed = 0
    # 同一実行内で追加済みの sponsor 複合キー (bill_id, politician_id, sponsor_role)。
    # autoflush=False のため DB の exists 照会では未コミットの pending 行が見えず、
    # CSV に同一 bill_code が複数回現れると同じ複合PKを二重 add して flush 時に
    # UniqueViolation で落ちる。実行内の重複はこの集合で捕捉する。
    seen_sponsors: set[tuple[int, int, str]] = set()

    for raw in rows:
        if since_kaiji is not None:
            try:
                if int((raw.get("提出回次") or "0").strip()) < since_kaiji:
                    continue
            except ValueError:
                continue

        br = row_to_bill(raw)
        if br is None:
            continue

        bill = db.query(Bill).filter(Bill.bill_code == br.bill_code).first()
        if bill is None:
            bill = Bill(
                bill_code=br.bill_code,
                title=br.title,
                status=br.status,
                submitted_date=_iso_to_date(br.submitted_date),
                passed_date=_iso_to_date(br.passed_date),
                source_url=br.source_url or None,
                source_hash=stable_hash(br.bill_code),
            )
            db.add(bill)
            db.flush()
            inserted += 1
        else:
            bill.status = br.status
            bill.submitted_date = _iso_to_date(br.submitted_date)
            bill.passed_date = _iso_to_date(br.passed_date)
            if br.source_url:
                bill.source_url = br.source_url
            updated += 1

        for role, names in (("primary", br.primary_sponsors), ("co", br.co_sponsors)):
            for nm in names:
                pid = pol_index.get(match_key(nm))
                if not pid:
                    unmatched += 1
                    continue
                key = (bill.id, pid, role)
                if key in seen_sponsors:
                    continue
                exists = (
                    db.query(BillSponsor)
                    .filter_by(bill_id=bill.id, politician_id=pid, sponsor_role=role)
                    .first()
                )
                if not exists:
                    db.add(
                        BillSponsor(
                            bill_id=bill.id, politician_id=pid, sponsor_role=role
                        )
                    )
                    sponsor_links += 1
                seen_sponsors.add(key)

        processed += 1
        if limit is not None and processed >= limit:
            break

    db.commit()
    result = {
        "processed": processed,
        "bills_inserted": inserted,
        "bills_updated": updated,
        "sponsor_links": sponsor_links,
        "unmatched_sponsors": unmatched,
    }
    log.info("衆院法案インジェスト完了: %s", result)
    return result
