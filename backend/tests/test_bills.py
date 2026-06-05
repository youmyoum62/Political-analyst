"""
衆院法案コネクタ（bills_shugiin）の単体テスト。

- 純粋関数: 和暦変換 / status写像 / 氏名正規化 / 提出者パース / 行→Bill
- DB: 一時SQLiteに対する upsert・議員突合・冪等性・crossparty 連動
"""

import csv
import io
from datetime import date

from app.ingest import bills_shugiin as bs

# ── 純粋関数 ───────────────────────────────────────────────────────────────

def test_wareki_to_iso():
    assert bs.wareki_to_iso("令和 8年 3月12日") == "2026-03-12"
    assert bs.wareki_to_iso("平成10年 3月 4日") == "1998-03-04"
    assert bs.wareki_to_iso("令和元年5月1日") == "2019-05-01"
    assert bs.wareki_to_iso("令和 8年 3月20日／法律第3号") == "2026-03-20"
    assert bs.wareki_to_iso("公布年月日／法律番号") is None
    assert bs.wareki_to_iso("") is None
    assert bs.wareki_to_iso(None) is None


def test_map_status():
    assert bs.map_status("成立") == "passed"
    assert bs.map_status("撤回") == "withdrawn"
    assert bs.map_status("承諾なし") == "rejected"
    assert bs.map_status("本院可決") == "in_committee"
    assert bs.map_status("謎の状態") == "submitted"
    assert bs.map_status("") == "submitted"


def test_normalize_and_sponsors():
    assert bs.normalize_name("重徳和彦君") == "重徳和彦"
    assert bs.normalize_name("熊代　昭彦君") == "熊代昭彦"
    assert bs.parse_sponsors("重徳和彦君; 伊佐進一君") == ["重徳和彦", "伊佐進一"]
    assert bs.parse_sponsors("") == []
    assert bs.parse_sponsors(None) == []


def test_row_to_bill():
    row = {
        "議案種類": "衆法",
        "提出回次": "211",
        "番号": "5",
        "議案件名": "テスト法案",
        "審議状況": "成立",
        "衆議院議案受理年月日": "令和 8年 3月12日",
        "公布年月日／法律番号": "令和 8年 3月20日／法律第3号",
        "経過情報URL": "https://example/keika/1.htm",
        "議案提出者一覧": "甲野一郎君",
        "議案提出の賛成者": "乙野二郎君; 丙野三郎君",
    }
    br = bs.row_to_bill(row)
    assert br is not None
    assert br.bill_code == "hr-衆法-211-5"
    assert br.status == "passed"
    assert br.submitted_date == "2026-03-12"
    assert br.passed_date == "2026-03-20"
    assert br.primary_sponsors == ["甲野一郎"]
    assert br.co_sponsors == ["乙野二郎", "丙野三郎"]


def test_row_to_bill_missing_returns_none():
    assert bs.row_to_bill({"議案件名": "", "番号": "", "提出回次": ""}) is None


# ── DB upsert / 突合 / crossparty ──────────────────────────────────────────

def _csv_text():
    headers = [
        "議案種類", "提出回次", "番号", "議案件名", "審議状況",
        "衆議院議案受理年月日", "公布年月日／法律番号", "経過情報URL",
        "議案提出者一覧", "議案提出の賛成者",
    ]
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(headers)
    w.writerow([
        "衆法", "211", "5", "テスト法案", "成立",
        "令和 8年 3月12日", "令和 8年 3月20日／法律第3号", "https://example/k/1.htm",
        "甲野一郎君", "乙野二郎君; 丙野三郎君",
    ])
    # 閣法（提出者=内閣で個人sponsor無し）
    w.writerow([
        "閣法", "211", "8", "内閣提出テスト法案", "衆議院で審議中",
        "令和 8年 2月 1日", "", "https://example/k/2.htm", "", "",
    ])
    return buf.getvalue()


def test_ingest_shugiin_bills_db(tmp_path):
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker

    from app import models  # noqa: F401  # テーブル登録
    from app.database import Base
    from app.models import Bill, Party, Politician
    from app.scoring.snapshot import _count_crossparty_passed

    db_file = tmp_path / "bills_test.db"
    engine = create_engine(
        f"sqlite:///{db_file}", connect_args={"check_same_thread": False}
    )
    Base.metadata.create_all(bind=engine)
    db = sessionmaker(bind=engine)()
    try:
        parties = [Party(name_ja=f"党{i}", abbreviation=f"P{i}") for i in range(3)]
        db.add_all(parties)
        db.flush()
        names = ["甲野一郎", "乙野二郎", "丙野三郎"]
        pols = [
            Politician(
                name_ja=names[i],
                party_id=parties[i].id,
                house="representatives",
                role_profile="ruling",
            )
            for i in range(3)
        ]
        db.add_all(pols)
        db.commit()

        csv_text = _csv_text()
        res = bs.ingest_shugiin_bills(db, csv_text=csv_text)
        assert res["bills_inserted"] == 2  # 衆法 + 閣法
        assert res["sponsor_links"] == 3   # 甲(primary) + 乙,丙(co)
        assert res["unmatched_sponsors"] == 0

        bill = db.query(Bill).filter(Bill.bill_code == "hr-衆法-211-5").first()
        assert bill is not None
        assert bill.status == "passed"
        assert bill.submitted_date == date(2026, 3, 12)
        assert bill.passed_date == date(2026, 3, 20)

        kakuho = db.query(Bill).filter(Bill.bill_code == "hr-閣法-211-8").first()
        assert kakuho is not None and kakuho.status == "in_committee"

        # 3党にまたがる成立法案 → crossparty=1
        assert _count_crossparty_passed(db, [bill.id]) == 1

        # 冪等性: 再実行で sponsor を重複作成しない・bill は update 扱い
        res2 = bs.ingest_shugiin_bills(db, csv_text=csv_text)
        assert res2["sponsor_links"] == 0
        assert res2["bills_updated"] == 2
    finally:
        db.close()
        engine.dispose()


def _csv_text_with_duplicate_bill():
    """同一 bill_code(hr-衆法-211-5) の行を2回含む CSV。

    本番 gian.csv に同一議案が複数行で現れるケースの再現。autoflush=False では
    sponsor の exists 照会が未コミット行を見られず、修正前は flush 時に
    bill_sponsors_pkey の UniqueViolation で落ちていた。
    """
    headers = [
        "議案種類", "提出回次", "番号", "議案件名", "審議状況",
        "衆議院議案受理年月日", "公布年月日／法律番号", "経過情報URL",
        "議案提出者一覧", "議案提出の賛成者",
    ]
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(headers)
    dup_row = [
        "衆法", "211", "5", "テスト法案", "成立",
        "令和 8年 3月12日", "令和 8年 3月20日／法律第3号", "https://example/k/1.htm",
        "甲野一郎君", "乙野二郎君; 丙野三郎君",
    ]
    w.writerow(dup_row)
    w.writerow(list(dup_row))  # 同一 bill_code の重複行
    return buf.getvalue()


def test_ingest_shugiin_bills_duplicate_billcode_in_one_run(tmp_path):
    """同一実行内に同じ bill_code が複数回現れても flush が落ちず冪等であること。"""
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker

    from app import models  # noqa: F401
    from app.database import Base
    from app.models import BillSponsor, Party, Politician

    db_file = tmp_path / "bills_dup_test.db"
    engine = create_engine(
        f"sqlite:///{db_file}", connect_args={"check_same_thread": False}
    )
    Base.metadata.create_all(bind=engine)
    # 本番 SessionLocal と同じ autoflush=False を再現する。autoflush=True（既定）だと
    # exists 照会の度に pending 行が自動 flush され、重複が偶然回避されてしまうため
    # このバグを再現できない（既存テストが見逃していた原因）。
    db = sessionmaker(bind=engine, autoflush=False)()
    try:
        parties = [Party(name_ja=f"党{i}", abbreviation=f"P{i}") for i in range(3)]
        db.add_all(parties)
        db.flush()
        names = ["甲野一郎", "乙野二郎", "丙野三郎"]
        pols = [
            Politician(
                name_ja=names[i],
                party_id=parties[i].id,
                house="representatives",
                role_profile="ruling",
            )
            for i in range(3)
        ]
        db.add_all(pols)
        db.commit()

        # 修正前はここで IntegrityError(UniqueViolation) を送出していた
        res = bs.ingest_shugiin_bills(db, csv_text=_csv_text_with_duplicate_bill())
        assert res["bills_inserted"] == 1
        assert res["sponsor_links"] == 3  # 甲(primary)+乙,丙(co) を一度だけ
        # DB 上も sponsor は3行のみ（重複が永続化されていない）
        assert db.query(BillSponsor).count() == 3
    finally:
        db.close()
        engine.dispose()
