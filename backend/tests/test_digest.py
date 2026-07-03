from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_digest_returns_structure() -> None:
    response = client.get("/v1/digest")
    assert response.status_code == 200
    data = response.json()
    assert set(
        ["generated_at", "latest_activity_date", "in_session", "minutes", "bills"]
    ).issubset(data.keys())
    assert isinstance(data["minutes"], list)
    assert isinstance(data["bills"], list)
    assert isinstance(data["in_session"], bool)


def test_digest_minutes_shape() -> None:
    data = client.get("/v1/digest").json()
    for day in data["minutes"]:
        assert set(["date", "speaker_count", "speakers"]).issubset(day.keys())
        assert day["speaker_count"] == len(day["speakers"])
        for sp in day["speakers"]:
            assert set(
                ["politician_id", "name", "activity_type", "source_url"]
            ).issubset(sp.keys())


def test_digest_respects_day_limit() -> None:
    data = client.get("/v1/digest?day_limit=2").json()
    assert len(data["minutes"]) <= 2
