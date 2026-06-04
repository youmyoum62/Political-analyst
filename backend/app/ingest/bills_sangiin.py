"""
参議院 法案(議案)インジェスト → bills。

データ源: SmartNews Media Research Institute「国会議案データベース：参議院」
  リポジトリ: https://github.com/smartnews-smri/house-of-councillors （MIT）
  CSV(raw): https://raw.githubusercontent.com/smartnews-smri/house-of-councillors/main/data/gian.csv
  一次情報は参議院公式『議案情報』。出典表記「スマートニュース メディア研究所」が必要（MIT）。

衆院データセット（bills_shugiin）との重複を避けるため、ここでは
**法律案（参法）= 参議院に議員発議された法案のみ** を対象とし、bill_code を `hc-` 名前空間にする。
（閣法・衆法は衆院コネクタが担当）。

重要な制約（検証済）:
  - 参の日付は ISO（例 2001-09-27）。公布年月日も同様。和暦混在に備えフォールバックあり。
  - 発議者は「氏名君   外N名」形式で筆頭発議者1名のみ取得可能。共同発議者(co)の全氏名・
    会派は公式・CSVに存在しない → bill_sponsors の co 行は構造的に欠落する。
  - 議員突合は氏名正規化＋house=councillors。未突合・同名衝突はスキップ。
"""

from __future__ import annotations

import csv
import io
import logging
import re
from datetime import date
from typing import Optional

import requests
from sqlalchemy.orm import Session

from app.ingest.bills_shugiin import BillRow, match_key, wareki_to_iso
from app.ingest.hashing import stable_hash
from app.models import Bill, BillSponsor, Politician

log = logging.getLogger(__name__)

GIAN_CSV_URL = (
    "https://raw.githubusercontent.com/smartnews-smri/"
    "house-of-councillors/main/data/gian.csv"
)

_SANPO = "法律案（参法）"
_ISO_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def parse_date(text: str | None) -> Optional[str]:
    """ISO（2001-09-27）優先、無ければ和暦から ISO を返す。"""
    s = (text or "").strip()
    if not s:
        return None
    if _ISO_RE.match(s):
        try:
            return date.fromisoformat(s).isoformat()
        except ValueError:
            return None
    return wareki_to_iso(s)


def lead_sponsor(hatsugisha: str | None) -> Optional[str]:
    """『今井　　　澄君   外5名』→ 筆頭発議者の正規化氏名『今井澄』。無ければ None。"""
    if not hatsugisha:
        return None
    head = re.split("外", hatsugisha, maxsplit=1)[0]
    nm = match_key(head)
    return nm or None


def map_status(row: dict) -> str:
    """参議院の経過情報から本プロジェクトの status を導出する。"""
    koufu = (row.get("その他の情報 - 公布年月日") or "").strip()
    seiritsu = (row.get("成立法律") or "").strip()
    if koufu or seiritsu:
        return "passed"
    giketsu = (row.get("参議院本会議経過情報 - 議決") or "").strip()
    kekka = (row.get("参議院委員会等経過情報 - 議決・継続結果") or "").strip()
    combined = f"{giketsu}{kekka}"
    if "否決" in combined:
        return "rejected"
    if "撤回" in combined:
        return "withdrawn"
    if "継続" in combined or "未了" in combined:
        return "in_committee"
    if giketsu in ("可決", "同意", "承認"):
        return "in_committee"  # いずれかの院で可決済だが未成立
    return "submitted"


def row_to_bill(row: dict) -> Optional[BillRow]:
    """参 gian.csv の1行（参法のみ）を BillRow に変換する。対象外/欠損は None。"""
    if (row.get("種類") or "").strip() != _SANPO:
        return None
    title = (row.get("件名") or "").strip()
    bangou = (row.get("提出番号") or "").strip()
    teishutsu = (row.get("提出回次") or "").strip()
    if not title or not bangou or not teishutsu:
        return None

    status = map_status(row)
    passed = parse_date(row.get("その他の情報 - 公布年月日")) if status == "passed" else None
    lead = lead_sponsor(row.get("議案審議情報一覧 - 発議者"))

    return BillRow(
        bill_code=f"hc-参法-{teishutsu}-{bangou}",
        title=title[:500],
        status=status,
        submitted_date=parse_date(row.get("議案審議情報一覧 - 提出日")),
        passed_date=passed,
        source_url=(row.get("議案URL") or "").strip(),
        primary_sponsors=[lead] if lead else [],
        co_sponsors=[],  # 参は共同発議者の全氏名・会派が取得不可（構造的欠落）
    )


def parse_csv(csv_text: str) -> list[dict]:
    return list(csv.DictReader(io.StringIO(csv_text)))


def _download(url: str) -> str:
    resp = requests.get(url, timeout=120)
    resp.raise_for_status()
    resp.encoding = "utf-8"
    return resp.text


def _councillor_index(db: Session) -> dict[str, Optional[int]]:
    idx: dict[str, Optional[int]] = {}
    for pid, name in (
        db.query(Politician.id, Politician.name_ja)
        .filter(Politician.house == "councillors")
        .all()
    ):
        key = match_key(name)
        if not key:
            continue
        idx[key] = None if key in idx else pid
    return idx


def _iso_to_date(s: Optional[str]) -> Optional[date]:
    return date.fromisoformat(s) if s else None


def ingest_sangiin_bills(
    db: Session,
    csv_text: Optional[str] = None,
    url: str = GIAN_CSV_URL,
    since_kaiji: Optional[int] = None,
    limit: Optional[int] = None,
) -> dict:
    """参 gian.csv の参法を bills / bill_sponsors(primary のみ) へ upsert する。"""
    if csv_text is None:
        csv_text = _download(url)
    rows = parse_csv(csv_text)
    idx = _councillor_index(db)

    inserted = updated = sponsor_links = unmatched = processed = 0

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

        for nm in br.primary_sponsors:
            pid = idx.get(match_key(nm))
            if not pid:
                unmatched += 1
                continue
            exists = (
                db.query(BillSponsor)
                .filter_by(bill_id=bill.id, politician_id=pid, sponsor_role="primary")
                .first()
            )
            if not exists:
                db.add(
                    BillSponsor(
                        bill_id=bill.id, politician_id=pid, sponsor_role="primary"
                    )
                )
                sponsor_links += 1

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
    log.info("参院法案インジェスト完了: %s", result)
    return result
