"""
スナップショット集計（フェーズ3 是正）の単体テスト。

- 審議中法案の二重カウント排他化（committee 役のみ計上）
- policy_impact 用 contribution_p95 が NormContext に算出される
- 院別正規化（衆参で母集団が分かれる）
"""

from datetime import date

import pytest


@pytest.fixture()
def db(tmp_path):
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker

    from app import models  # noqa: F401
    from app.database import Base

    engine = create_engine(
        f"sqlite:///{tmp_path / 'snap.db'}", connect_args={"check_same_thread": False}
    )
    Base.metadata.create_all(bind=engine)
    session = sessionmaker(bind=engine)()
    try:
        yield session
    finally:
        session.close()
        engine.dispose()


_P0 = date(2026, 1, 1)
_P1 = date(2026, 6, 30)


def _politician(db, name, house="representatives"):
    from app.models import Politician

    p = Politician(name_ja=name, house=house, role_profile="ruling")
    db.add(p)
    db.flush()
    return p


def _bill(db, code, status, sponsor_pid, role):
    from app.models import Bill, BillSponsor

    b = Bill(bill_code=code, title=code, status=status, submitted_date=date(2026, 3, 1))
    db.add(b)
    db.flush()
    db.add(BillSponsor(bill_id=b.id, politician_id=sponsor_pid, sponsor_role=role))
    db.flush()
    return b


def test_committee_not_double_counted(db):
    from app.scoring.snapshot import _build_raw_metrics

    p = _politician(db, "甲")
    # primary かつ審議中 → bills_primary に入るが bills_in_committee には入らない
    _bill(db, "B-primary-ic", "in_committee", p.id, "primary")
    db.commit()

    m = _build_raw_metrics(p.id, db, _P0, _P1)
    assert m.bills_primary == 1
    assert m.bills_in_committee == 0  # 二重計上されない


def test_committee_role_counted(db):
    from app.scoring.snapshot import _build_raw_metrics

    p = _politician(db, "乙")
    _bill(db, "B-committee-ic", "in_committee", p.id, "committee")
    db.commit()

    m = _build_raw_metrics(p.id, db, _P0, _P1)
    assert m.bills_primary == 0
    assert m.bills_in_committee == 1


def test_contribution_p95_computed(db):
    from app.scoring.snapshot import _build_norm_context

    p = _politician(db, "丙")
    # 成立(primary) 1件 → contribution = 1*2 = 2
    _bill(db, "B-passed", "passed", p.id, "primary")
    db.commit()

    ctx = _build_norm_context([p.id], db, _P0, _P1)
    assert ctx.contribution_p95 >= 2.0  # passed_primary*2 を反映（下限1.0より大）


def test_per_house_normalization(db):
    from app.models import Activity, Score, WeightSet
    from app.scoring.snapshot import recompute_snapshot

    # FK 用に WeightSet を1つ用意（スコア計算は calculator.ROLE_WEIGHTS を使うため値は任意）
    wfields = {
        f"{p}_{a}": 0.2
        for p in ("opp", "rul", "cab", "par")
        for a in ("participation", "quality", "legislative", "policy_impact", "influence")
    }
    db.add(WeightSet(version="test", is_active=True, **wfields))
    db.flush()

    # 衆: 発言多い議員 / 参: 発言少ない議員。院別正規化なら参の少数発言でも相対評価される
    shu = _politician(db, "衆議員", house="representatives")
    san = _politician(db, "参議員", house="councillors")
    # 衆に大量発言、参に少量発言
    for i in range(10):
        db.add(Activity(politician_id=shu.id, activity_type="speech",
                        session_date=date(2026, 3, 1), source_url="x",
                        source_hash=f"shu-{i}", content_text="x"))
    db.add(Activity(politician_id=san.id, activity_type="speech",
                    session_date=date(2026, 3, 1), source_url="y",
                    source_hash="san-0", content_text="y"))
    db.commit()

    recompute_snapshot(db, _P0, _P1)
    scores = {s.politician_id: s.final_score for s in db.query(Score).all()}
    # 院別正規化により、参議員も自院母集団(1名)基準で発言量が満点正規化され0点ではない
    assert scores[san.id] > 0
