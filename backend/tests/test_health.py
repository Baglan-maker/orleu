"""Integration tests for system endpoints."""


class TestHealth:
    """GET /health"""

    def test_health_endpoint(self, client, db):
        resp = client.get("/health")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "ok"
        assert data["app"] == "Orleu"
