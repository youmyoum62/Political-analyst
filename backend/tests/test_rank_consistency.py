from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_list_and_detail_rank_match() -> None:
    """一覧(/v1/ranking)の rank と詳細(/v1/politicians/{id})の rank が一致すること。"""
    ranking = client.get("/v1/ranking").json()
    assert len(ranking) > 0
    # 上位数名で突合（全件は重いので先頭と末尾付近を確認）
    sample = ranking[:5] + ranking[-3:]
    for item in sample:
        detail = client.get(f"/v1/politicians/{item['politician_id']}").json()
        assert detail["rank"] == item["rank"], (
            f"rank mismatch id={item['politician_id']}: "
            f"list={item['rank']} detail={detail['rank']}"
        )


def test_ranking_is_competition_ranked_by_score() -> None:
    """スコア降順で、順位=自分より高スコアの人数+1（同点同順位）になっていること。"""
    ranking = client.get("/v1/ranking").json()
    ordered = sorted(ranking, key=lambda x: -x["final_score"])
    for item in ordered:
        expected = 1 + sum(1 for o in ordered if o["final_score"] > item["final_score"])
        assert item["rank"] == expected
