"""
議員詳細API拡張（top_speeches / bills / roles）＋法案API新設のテスト。

conftest.py が用意した共有テスト用SQLite（seed_if_empty 投入済み）に対し、
本ファイルの module スコープ autouse フィクスチャで Activity/LlmEvaluation・
Bill/BillSponsor・InfluenceRole の実データ行を追加してから検証する。
"""

from datetime import date

import pytest
from fastapi.testclient import TestClient

from app.database import SessionLocal
from app.main import app
from app.models import Activity, Bill, BillSponsor, InfluenceRole, LlmEvaluation

client = TestClient(app)

_BILL_CODE = "test-bill-001"


@pytest.fixture(scope="module", autouse=True)
def _seed_extra_data():
    """既存シード議員 id=1（山田 太郎）に発言・法案・役職の実データを追加する。
    id=2（田中 恵子）には評価データを追加せず、空配列ケースの検証に使う。"""
    with SessionLocal() as db:
        activity = Activity(
            politician_id=1,
            activity_type="speech",
            session_date=date(2026, 3, 1),
            source_url="https://kokkai.ndl.go.jp/example/top-speech-1",
            source_hash="test-hash-top-speech-1",
            content_text="これはテスト用の発言内容。" + "あ" * 250,
        )
        db.add(activity)
        db.flush()
        db.add(
            LlmEvaluation(
                activity_id=activity.id,
                model_name="test-model",
                prompt_version="v1",
                quality_score=88.5,
                confidence=0.9,
                rationale_summary="具体性が高く評価できる発言。",
                status="succeeded",
            )
        )

        bill = Bill(
            bill_code=_BILL_CODE,
            title="テスト特別措置法案",
            status="passed",
            submitted_date=date(2026, 1, 15),
            passed_date=date(2026, 3, 20),
            source_url="https://example/bill/1",
        )
        db.add(bill)
        db.flush()
        db.add(BillSponsor(bill_id=bill.id, politician_id=1, sponsor_role="primary"))

        db.add(
            InfluenceRole(
                politician_id=1,
                role_scope="committee",
                role_name="委員長",
                level_weight=5.0,
                start_date=date(2026, 1, 1),
            )
        )
        db.commit()
    yield


# ── 議員詳細: top_speeches ───────────────────────────────────────────────

def test_politician_detail_includes_top_speeches():
    response = client.get("/v1/politicians/1")
    assert response.status_code == 200
    payload = response.json()
    assert "top_speeches" in payload
    assert len(payload["top_speeches"]) >= 1
    top = payload["top_speeches"][0]
    assert top["score"] == 88.5
    assert top["confidence"] == 0.9
    assert top["rationale"] == "具体性が高く評価できる発言。"
    assert len(top["excerpt"]) <= 200
    assert top["source_url"] == "https://kokkai.ndl.go.jp/example/top-speech-1"


def test_politician_detail_no_evaluation_returns_empty_top_speeches():
    response = client.get("/v1/politicians/2")
    assert response.status_code == 200
    payload = response.json()
    assert payload["top_speeches"] == []


# ── 議員詳細: bills ──────────────────────────────────────────────────────

def test_politician_detail_includes_bills():
    response = client.get("/v1/politicians/1")
    payload = response.json()
    codes = [b["bill_code"] for b in payload["bills"]]
    assert _BILL_CODE in codes
    matched = next(b for b in payload["bills"] if b["bill_code"] == _BILL_CODE)
    assert matched["role"] == "primary"
    assert matched["status"] == "passed"
    assert matched["submitted_date"] == "2026-01-15"


def test_politician_detail_no_bills_returns_empty_list():
    response = client.get("/v1/politicians/2")
    payload = response.json()
    assert payload["bills"] == []


# ── 議員詳細: roles ──────────────────────────────────────────────────────

def test_politician_detail_includes_roles():
    response = client.get("/v1/politicians/1")
    payload = response.json()
    role_names = [r["role_name"] for r in payload["roles"]]
    assert "委員長" in role_names
    matched = next(r for r in payload["roles"] if r["role_name"] == "委員長")
    assert matched["role_scope"] == "committee"
    assert matched["start_date"] == "2026-01-01"


# ── /v1/bills 一覧 ───────────────────────────────────────────────────────

def test_v1_bills_list():
    response = client.get("/v1/bills")
    assert response.status_code == 200
    payload = response.json()
    assert "items" in payload and "total" in payload
    codes = [b["bill_code"] for b in payload["items"]]
    assert _BILL_CODE in codes
    matched = next(b for b in payload["items"] if b["bill_code"] == _BILL_CODE)
    assert matched["sponsor_count"] == 1


def test_v1_bills_list_status_filter():
    response = client.get("/v1/bills?status=passed")
    assert response.status_code == 200
    payload = response.json()
    assert len(payload["items"]) >= 1
    for item in payload["items"]:
        assert item["status"] == "passed"


def test_v1_bills_list_status_filter_no_match():
    response = client.get("/v1/bills?status=withdrawn")
    assert response.status_code == 200
    payload = response.json()
    assert payload["items"] == []
    assert payload["total"] == 0


# ── /v1/bills/{bill_code} 詳細 ──────────────────────────────────────────

def test_v1_bill_detail():
    response = client.get(f"/v1/bills/{_BILL_CODE}")
    assert response.status_code == 200
    payload = response.json()
    assert payload["title"] == "テスト特別措置法案"
    assert payload["status"] == "passed"
    assert len(payload["sponsors"]) == 1
    assert payload["sponsors"][0]["role"] == "primary"
    assert payload["sponsors"][0]["politician_id"] == 1
    assert payload["sponsors"][0]["name"] == "山田 太郎"


def test_v1_bill_detail_not_found():
    response = client.get("/v1/bills/does-not-exist")
    assert response.status_code == 404
