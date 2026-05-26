from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)

RANKING_REQUIRED_KEYS = {
    'politician_id', 'rank', 'name', 'party', 'house', 'role_profile',
    'final_score', 'trend',
    'participation_score', 'quality_score', 'legislative_score',
    'policy_impact_score', 'influence_score',
}


def test_health() -> None:
    response = client.get('/health')
    assert response.status_code == 200
    data = response.json()
    assert data['status'] in ('ok', 'degraded')
    assert data['db'] in ('connected', 'error')
    assert isinstance(data['politicians_count'], int)


def test_v1_ranking_returns_items() -> None:
    response = client.get('/v1/ranking')
    assert response.status_code == 200
    payload = response.json()
    assert isinstance(payload, list)
    assert len(payload) > 0
    assert RANKING_REQUIRED_KEYS.issubset(payload[0].keys())


def test_v1_ranking_trend_is_integer() -> None:
    response = client.get('/v1/ranking')
    payload = response.json()
    for item in payload:
        assert isinstance(item['trend'], int), f"trend は int であるべき: {item['trend']}"


def test_v1_ranking_no_circular_dependency() -> None:
    """policy_impact_score が他スコアの線形結合でないことを確認（循環依存の回帰テスト）。"""
    response = client.get('/v1/ranking')
    payload = response.json()
    for item in payload:
        derived = (
            item['quality_score'] * 0.35
            + item['legislative_score'] * 0.40
            + item['influence_score'] * 0.25
        )
        # 旧式の循環計算と一致していてはいけない
        assert abs(item['policy_impact_score'] - derived) > 0.01 or item['policy_impact_score'] == 0, (
            f"{item['name']}: policy_impact_score が循環依存の値と一致している"
        )


def test_v1_ranking_role_profile_valid() -> None:
    valid_profiles = {'opposition', 'ruling', 'cabinet', 'parliamentary'}
    response = client.get('/v1/ranking')
    payload = response.json()
    for item in payload:
        assert item['role_profile'] in valid_profiles, (
            f"{item['name']}: 不正な role_profile = {item['role_profile']}"
        )


def test_v1_politicians_paginated() -> None:
    response = client.get('/v1/politicians?limit=5&offset=0')
    assert response.status_code == 200
    payload = response.json()
    assert 'items' in payload
    assert 'total' in payload
    assert 'has_next' in payload
    assert len(payload['items']) <= 5


def test_v1_politician_detail() -> None:
    response = client.get('/v1/politicians/1')
    assert response.status_code == 200
    payload = response.json()
    assert payload['id'] == 1
    assert 'role_profile' in payload
    assert 'participation_score' in payload


def test_v1_politician_not_found() -> None:
    response = client.get('/v1/politicians/99999')
    assert response.status_code == 404


def test_v1_analysis_includes_weights() -> None:
    response = client.get('/v1/analysis/1')
    assert response.status_code == 200
    payload = response.json()
    assert 'weights' in payload
    total = sum(payload['weights'].values())
    assert abs(total - 1.0) < 0.001, f"重みの合計が1.0でない: {total}"


def test_v1_analysis_not_found() -> None:
    response = client.get('/v1/analysis/99999')
    assert response.status_code == 404


def test_backward_compat_ranking() -> None:
    response = client.get('/ranking')
    assert response.status_code == 200
    payload = response.json()
    assert isinstance(payload, list)
    assert len(payload) > 0
