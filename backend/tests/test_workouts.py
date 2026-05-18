"""Integration tests for Workout endpoints (/api/workouts/*)."""
import uuid
from datetime import date, timedelta

import pytest


def _make_workout_payload(exercises, workout_date=None):
    """Helper to build a valid workout creation payload."""
    if workout_date is None:
        workout_date = str(date.today())
    return {
        "workout_date": workout_date,
        "duration_minutes": 45,
        "notes": "Test workout",
        "exercises": [
            {
                "exercise_id": str(exercises[0].id),
                "sets": 3,
                "reps": 10,
                "weight_kg": 60.0,
                "order_index": 0,
            },
            {
                "exercise_id": str(exercises[1].id),
                "sets": 4,
                "reps": 8,
                "weight_kg": 80.0,
                "order_index": 1,
            },
        ],
    }


class TestCreateWorkout:
    """POST /api/workouts"""

    def test_create_workout_success(self, client, db, auth_header, test_user, sample_exercises):
        payload = _make_workout_payload(sample_exercises)
        resp = client.post("/api/workouts", json=payload, headers=auth_header)
        assert resp.status_code == 201
        data = resp.json()
        assert data["workout_date"] == str(date.today())
        assert len(data["exercises"]) == 2
        assert data["total_volume"] > 0
        assert data["xp_gained"] > 0

    def test_create_workout_awards_xp(self, client, db, auth_header, test_user, sample_exercises):
        payload = _make_workout_payload(sample_exercises)
        resp = client.post("/api/workouts", json=payload, headers=auth_header)
        assert resp.status_code == 201
        data = resp.json()
        # BASE_XP_PER_WORKOUT=50 + XP_PER_EXERCISE=10*2 + volume XP
        assert data["xp_gained"] >= 70

    def test_create_workout_no_exercises(self, client, db, auth_header, test_user):
        resp = client.post("/api/workouts", json={
            "workout_date": str(date.today()),
            "exercises": [],
        }, headers=auth_header)
        assert resp.status_code == 422

    def test_create_workout_future_date(self, client, db, auth_header, test_user, sample_exercises):
        future_date = str(date.today() + timedelta(days=1))
        payload = _make_workout_payload(sample_exercises, workout_date=future_date)
        resp = client.post("/api/workouts", json=payload, headers=auth_header)
        assert resp.status_code == 422

    def test_create_workout_no_auth(self, client, db, sample_exercises):
        payload = _make_workout_payload(sample_exercises)
        resp = client.post("/api/workouts", json=payload)
        assert resp.status_code in (401, 403)

    def test_create_workout_triggers_achievement(
        self, client, db, auth_header, test_user, sample_exercises, sample_achievements
    ):
        payload = _make_workout_payload(sample_exercises)
        resp = client.post("/api/workouts", json=payload, headers=auth_header)
        assert resp.status_code == 201
        data = resp.json()
        # "First Workout" achievement should be earned (total_sessions >= 1)
        earned_names = [a["name"] for a in data.get("achievements", [])]
        assert "First Workout" in earned_names


class TestListWorkouts:
    """GET /api/workouts"""

    def test_list_empty(self, client, db, auth_header, test_user):
        resp = client.get("/api/workouts", headers=auth_header)
        assert resp.status_code == 200
        data = resp.json()
        assert data["items"] == []
        assert data["total"] == 0

    def test_list_with_workouts(self, client, db, auth_header, test_user, sample_exercises):
        # Create 2 workouts
        payload = _make_workout_payload(sample_exercises)
        client.post("/api/workouts", json=payload, headers=auth_header)

        payload2 = _make_workout_payload(sample_exercises, workout_date=str(date.today() - timedelta(days=1)))
        client.post("/api/workouts", json=payload2, headers=auth_header)

        resp = client.get("/api/workouts", headers=auth_header)
        assert resp.status_code == 200
        data = resp.json()
        assert data["total"] == 2
        assert len(data["items"]) == 2

    def test_list_pagination(self, client, db, auth_header, test_user, sample_exercises):
        for i in range(3):
            payload = _make_workout_payload(
                sample_exercises,
                workout_date=str(date.today() - timedelta(days=i)),
            )
            client.post("/api/workouts", json=payload, headers=auth_header)

        resp = client.get("/api/workouts", params={"limit": 2, "offset": 0}, headers=auth_header)
        data = resp.json()
        assert len(data["items"]) == 2
        assert data["total"] == 3


class TestGetWorkout:
    """GET /api/workouts/{workout_id}"""

    def test_get_workout(self, client, db, auth_header, test_user, sample_exercises):
        payload = _make_workout_payload(sample_exercises)
        create_resp = client.post("/api/workouts", json=payload, headers=auth_header)
        workout_id = create_resp.json()["id"]

        resp = client.get(f"/api/workouts/{workout_id}", headers=auth_header)
        assert resp.status_code == 200
        assert resp.json()["id"] == workout_id
        assert len(resp.json()["exercises"]) == 2

    def test_get_nonexistent_workout(self, client, db, auth_header, test_user):
        fake_id = str(uuid.uuid4())
        resp = client.get(f"/api/workouts/{fake_id}", headers=auth_header)
        assert resp.status_code == 404


class TestDeleteWorkout:
    """DELETE /api/workouts/{workout_id}"""

    def test_delete_workout(self, client, db, auth_header, test_user, sample_exercises):
        payload = _make_workout_payload(sample_exercises)
        create_resp = client.post("/api/workouts", json=payload, headers=auth_header)
        workout_id = create_resp.json()["id"]

        resp = client.delete(f"/api/workouts/{workout_id}", headers=auth_header)
        assert resp.status_code == 204

        # Verify deletion
        get_resp = client.get(f"/api/workouts/{workout_id}", headers=auth_header)
        assert get_resp.status_code == 404

    def test_delete_reverses_xp(self, client, db, auth_header, test_user, sample_exercises):
        # Get initial progress
        progress_before = client.get("/api/progress", headers=auth_header).json()
        initial_xp = progress_before["xp"]

        # Create and delete workout
        payload = _make_workout_payload(sample_exercises)
        create_resp = client.post("/api/workouts", json=payload, headers=auth_header)
        workout_id = create_resp.json()["id"]

        client.delete(f"/api/workouts/{workout_id}", headers=auth_header)

        # XP should be back to initial
        progress_after = client.get("/api/progress", headers=auth_header).json()
        assert progress_after["xp"] == initial_xp

    def test_delete_nonexistent(self, client, db, auth_header, test_user):
        fake_id = str(uuid.uuid4())
        resp = client.delete(f"/api/workouts/{fake_id}", headers=auth_header)
        assert resp.status_code == 404
