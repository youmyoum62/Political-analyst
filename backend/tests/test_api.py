from fastapi.testclient import TestClient

from app.main import app


client = TestClient(app)


def test_health() -> None:
    response = client.get('/health')
    assert response.status_code == 200
    assert response.json() == {'status': 'ok'}


def test_ranking_returns_items() -> None:
    response = client.get('/ranking')
    assert response.status_code == 200
    payload = response.json()
    assert isinstance(payload, list)
    assert len(payload) > 0
    assert {'politician_id', 'rank', 'name', 'party', 'final_score', 'trend'}.issubset(payload[0].keys())


def test_politician_not_found() -> None:
    response = client.get('/politicians/99999')
    assert response.status_code == 404


def test_analysis_not_found() -> None:
    response = client.get('/analysis/99999')
    assert response.status_code == 404
