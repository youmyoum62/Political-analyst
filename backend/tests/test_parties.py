import urllib.parse

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)

SUMMARY_KEYS = {
    "name", "member_count", "avg_score", "median_score",
    "representatives", "councillors",
}


def test_parties_list() -> None:
    res = client.get("/v1/parties")
    assert res.status_code == 200
    data = res.json()
    assert isinstance(data, list)
    assert len(data) > 0
    for item in data:
        assert SUMMARY_KEYS.issubset(item.keys())
        assert item["member_count"] == item["representatives"] + item["councillors"]
    # 人数の多い順
    counts = [d["member_count"] for d in data]
    assert counts == sorted(counts, reverse=True)


def test_party_detail_and_404() -> None:
    parties = client.get("/v1/parties").json()
    name = parties[0]["name"]
    res = client.get(f"/v1/parties/{urllib.parse.quote(name)}")
    assert res.status_code == 200
    detail = res.json()
    assert detail["name"] == name
    assert detail["member_count"] == len(detail["members"])
    # メンバーはスコア降順
    scores = [m["final_score"] for m in detail["members"]]
    assert scores == sorted(scores, reverse=True)

    missing = client.get("/v1/parties/" + urllib.parse.quote("存在しない政党XYZ"))
    assert missing.status_code == 404


def test_party_normalize_merges_truncations() -> None:
    from app.party_normalize import normalize_party

    assert normalize_party("みら") == "みらい"
    assert normalize_party("無") == "無所属"
    assert normalize_party(None) == "無所属"
    assert normalize_party("自由民主党") == "自由民主党"  # 未知はそのまま
