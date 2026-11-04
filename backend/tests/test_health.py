from fastapi.testclient import TestClient


def test_health_endpoint_healthy(client: TestClient):
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert "WindScope" in data["project"]
    assert data["version"] == "1.0.0"
    assert data["database"]["connected"] is True
    assert data["database"]["tables_initialized"] is True
    assert "actual_generation_30min" in data["database"]["record_counts"]


def test_root_health_endpoint(client: TestClient):
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"


def test_health_endpoint_degraded_when_db_fails(client: TestClient):
    from app.database import get_db

    def failing_get_db():
        raise RuntimeError("Simulated DB connection failure")

    from app.main import app
    app.dependency_overrides[get_db] = failing_get_db

    try:
        response = client.get("/api/health")
        # FastAPI handles dependency exception with 500
        assert response.status_code == 500
    finally:
        app.dependency_overrides.clear()
