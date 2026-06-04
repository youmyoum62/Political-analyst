"""
参院法案コネクタ（bills_sangiin）の単体テスト。

- 純粋関数: 日付(ISO/和暦) / 筆頭発議者抽出 / status導出 / 行→Bill(参法のみ)
- DB: 参法のみ upsert・筆頭発議者(primary)突合・co欠落・冪等性
"""

import csv
import io
from datetime import date

from app.ingest import bills_sangiin as bs


def test_parse_date():
    assert bs.parse_date("2001-09-27") == "2001-09-27"
    assert bs.parse_date("令和 8年 3月12日") == "2026-03-12"
    assert bs.parse_date("") is None
    assert bs.parse_date(None) is None
    assert bs.parse_date("不正な値") is None


def test_lead_sponsor():
    assert bs.lead_sponsor("今井　　　澄君   外5名") == "今井澄"
    assert bs.lead_sponsor("千葉　景子君") == "千葉景子"
    assert bs.lead_sponsor("") is None
    assert bs.lead_sponsor(None) is None


def test_map_status():
    assert bs.map_status({"その他の情報 - 公布年月日": "2002-07-01"}) == "passed"
    assert bs.map_status({"成立法律": "○○法"}) == "passed"
    assert bs.map_status({"参議院本会議経過情報 - 議決": "否決"}) == "rejected"
    assert bs.map_status({"参議院委員会等経過情報 - 議決・継続結果": "継続審査"}) == "in_committee"
    assert bs.map_status({"参議院本会議経過情報 - 議決": "可決"}) == "in_committee"
    assert bs.map_status({}) == "submitted"


def test_row_to_bill_sanpo():
    row = {
        "種類": "法律案（参法）",
        "提出回次": "153",
        "提出番号": "1",
        "件名": "テスト参法案",
        "議案URL": "https://www.sangiin.go.jp/.../m1.htm",
        "議案審議情報一覧 - 提出日": "2001-09-27",
        "議案審議情報一覧 - 発議者": "今井　　　澄君   外5名",
        "その他の情報 - 公布年月日": "2002-07-01",
        "成立法律": "テスト法",
    }
    br = bs.row_to_bill(row)
    assert br is not None
    assert br.bill_code == "hc-参法-153-1"
    assert br.status == "passed"
    assert br.submitted_date == "2001-09-27"
    assert br.passed_date == "2002-07-01"
    assert br.primary_sponsors == ["今井澄"]
    assert br.co_sponsors == []


def test_row_to_bill_skips_non_sanpo():
    assert bs.row_to_bill({"種類": "法律案（内閣提出）", "提出回次": "1", "提出番号": "1", "件名": "x"}) is None


def _csv_text():
    headers = [
        "種類", "提出回次", "提出番号", "件名", "議案URL",
        "議案審議情報一覧 - 提出日", "議案審議情報一覧 - 発議者",
        "参議院本会議経過情報 - 議決", "参議院委員会等経過情報 - 議決・継続結果",
        "その他の情報 - 公布年月日", "成立法律",
    ]
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(headers)
    # 参法（成立）
    w.writerow([
        "法律案（参法）", "153", "1", "テスト参法案", "https://s/m1.htm",
        "2001-09-27", "今井　　　澄君   外5名", "可決", "可決", "2002-07-01", "テスト法",
    ])
    # 閣法（対象外 → スキップ）
    w.writerow([
        "法律案（内閣提出）", "153", "2", "内閣提出案", "https://s/m2.htm",
        "2001-10-01", "", "可決", "可決", "2001-12-01", "別法",
    ])
    return buf.getvalue()


def test_ingest_sangiin_bills_db(tmp_path):
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker

    from app import models  # noqa: F401
    from app.database import Base
    from app.models import Bill, BillSponsor, Party, Politician

    engine = create_engine(
        f"sqlite:///{tmp_path / 'san_bills.db'}", connect_args={"check_same_thread": False}
    )
    Base.metadata.create_all(bind=engine)
    db = sessionmaker(bind=engine)()
    try:
        party = Party(name_ja="無所属の会", abbreviation="無")
        db.add(party)
        db.flush()
        # 筆頭発議者の今井澄は councillors として存在
        db.add(Politician(name_ja="今井澄", party_id=party.id, house="councillors", role_profile="opposition"))
        db.commit()

        res = bs.ingest_sangiin_bills(db, csv_text=_csv_text())
        assert res["bills_inserted"] == 1   # 参法のみ（閣法はスキップ）
        assert res["sponsor_links"] == 1    # 筆頭発議者のみ
        assert res["unmatched_sponsors"] == 0

        bill = db.query(Bill).filter(Bill.bill_code == "hc-参法-153-1").first()
        assert bill is not None and bill.status == "passed"
        assert bill.submitted_date == date(2001, 9, 27)
        assert bill.passed_date == date(2002, 7, 1)
        # co は欠落（primary のみ）
        roles = {s.sponsor_role for s in db.query(BillSponsor).filter_by(bill_id=bill.id)}
        assert roles == {"primary"}

        # 閣法は bills に作られない
        assert db.query(Bill).filter(Bill.bill_code.like("hc-%")).count() == 1

        # 冪等性
        res2 = bs.ingest_sangiin_bills(db, csv_text=_csv_text())
        assert res2["sponsor_links"] == 0
        assert res2["bills_updated"] == 1
    finally:
        db.close()
        engine.dispose()
