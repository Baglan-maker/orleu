"""Integration tests for Exercise endpoints (/api/exercises/*)."""
import pytest


class TestExerciseCache:
    """GET /api/exercises/cache"""

    def test_cache_returns_exercises(self, client, db, auth_header, test_user, sample_exercises):
        resp = client.get("/api/exercises/cache", headers=auth_header)
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) >= 5
        names = {e["name"] for e in data}
        assert "Bench Press" in names
        assert "Squat" in names

    def test_cache_no_auth(self, client, db):
        resp = client.get("/api/exercises/cache")
        assert resp.status_code in (401, 403)


class TestExerciseSearch:
    """GET /api/exercises"""

    def test_search_by_name(self, client, db, auth_header, test_user, sample_exercises):
        resp = client.get("/api/exercises", params={"q": "bench"}, headers=auth_header)
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) >= 1
        assert any("Bench" in e["name"] for e in data)

    def test_search_short_query(self, client, db, auth_header, test_user, sample_exercises):
        resp = client.get("/api/exercises", params={"q": "ab"}, headers=auth_header)
        # API requires min 3 chars for server-side search
        assert resp.status_code == 400

    def test_search_with_limit(self, client, db, auth_header, test_user, sample_exercises):
        resp = client.get("/api/exercises", params={"q": "press", "limit": 1}, headers=auth_header)
        assert resp.status_code == 200
        assert len(resp.json()) <= 1


class TestCustomExercise:
    """POST /api/exercises"""

    def test_create_custom_exercise(self, client, db, auth_header, test_user):
        resp = client.post("/api/exercises", json={
            "name": "My Custom Lift",
            "muscle_group": "chest",
            "category": "compound",
        }, headers=auth_header)
        assert resp.status_code == 201
        data = resp.json()
        assert data["name"] == "My Custom Lift"
        assert data["is_custom"] is True
        assert data["muscle_group"] == "chest"

    def test_create_duplicate_custom_exercise(self, client, db, auth_header, test_user):
        # Create a custom exercise first
        client.post("/api/exercises", json={
            "name": "My Lift",
            "muscle_group": "chest",
            "category": "compound",
        }, headers=auth_header)
        # Creating the same name again should conflict
        resp = client.post("/api/exercises", json={
            "name": "My Lift",
            "muscle_group": "chest",
            "category": "compound",
        }, headers=auth_header)
        assert resp.status_code == 409

    def test_create_exercise_no_auth(self, client, db):
        resp = client.post("/api/exercises", json={
            "name": "Unauthorized Lift",
            "muscle_group": "chest",
        })
        assert resp.status_code in (401, 403)
