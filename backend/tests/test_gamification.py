"""Integration tests for Gamification: Progress, Campaigns, Missions, Achievements."""
import uuid
from datetime import date, timedelta

import pytest

from app.models import UserProgress


# ---------------------------------------------------------------------------
# Progress
# ---------------------------------------------------------------------------

class TestProgress:
    """GET/PATCH /api/progress"""

    def test_get_progress(self, client, db, auth_header, test_user):
        resp = client.get("/api/progress", headers=auth_header)
        assert resp.status_code == 200
        data = resp.json()
        assert data["xp"] == 0
        assert data["level"] == 1
        assert data["current_streak"] == 0
        assert data["avatar_stage"] == 0
        assert data["avatar_stage_name"] == "Rookie"

    def test_progress_updates_after_workouts(
        self, client, db, auth_header, test_user, sample_exercises
    ):
        # Create a workout
        client.post("/api/workouts", json={
            "workout_date": str(date.today()),
            "exercises": [{
                "exercise_id": str(sample_exercises[0].id),
                "sets": 3, "reps": 10, "weight_kg": 50,
            }],
        }, headers=auth_header)

        resp = client.get("/api/progress", headers=auth_header)
        data = resp.json()
        assert data["xp"] > 0
        assert data["total_workouts"] == 1
        assert data["total_sessions"] >= 1

    def test_patch_progress_campaign_path(
        self, client, db, auth_header, test_user, sample_campaign
    ):
        # First assign the campaign to user
        progress = db.query(UserProgress).filter(
            UserProgress.user_id == test_user.id
        ).first()
        progress.current_campaign_id = sample_campaign.id
        db.flush()

        resp = client.patch("/api/progress", json={
            "campaign_path": "A",
        }, headers=auth_header)
        assert resp.status_code == 200
        assert resp.json()["campaign_path"] == "A"

    def test_progress_no_auth(self, client, db):
        resp = client.get("/api/progress")
        assert resp.status_code in (401, 403)


# ---------------------------------------------------------------------------
# Campaigns
# ---------------------------------------------------------------------------

class TestCampaigns:
    """GET /api/campaigns/*"""

    def test_list_campaigns(self, client, db, auth_header, test_user, sample_campaign):
        resp = client.get("/api/campaigns", headers=auth_header)
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) >= 1
        assert data[0]["name"] == "Beginner Journey"

    def test_get_campaign_chapters(self, client, db, auth_header, test_user, sample_campaign):
        resp = client.get(
            f"/api/campaigns/{sample_campaign.id}/chapters",
            headers=auth_header,
        )
        assert resp.status_code == 200
        chapters = resp.json()
        assert len(chapters) == 5
        assert chapters[0]["title"] == "First Steps"
        assert chapters[2]["has_branch"] is True

    def test_get_current_campaign(self, client, db, auth_header, test_user, sample_campaign):
        from app.models import CampaignChapter
        # Assign campaign to user
        progress = db.query(UserProgress).filter(
            UserProgress.user_id == test_user.id
        ).first()
        progress.current_campaign_id = sample_campaign.id
        ch1 = db.query(CampaignChapter).filter(
            CampaignChapter.campaign_id == sample_campaign.id,
            CampaignChapter.chapter_number == 1,
        ).first()
        progress.current_chapter_id = ch1.id
        db.flush()

        resp = client.get("/api/campaigns/current", headers=auth_header)
        assert resp.status_code == 200
        data = resp.json()
        assert data["campaign"]["name"] == "Beginner Journey"
        assert len(data["chapters"]) == 5


# ---------------------------------------------------------------------------
# Missions
# ---------------------------------------------------------------------------

class TestMissions:
    """GET /api/missions, POST /api/missions/{id}/accept"""

    def test_list_missions(self, client, db, auth_header, test_user, sample_missions):
        resp = client.get("/api/missions", headers=auth_header)
        assert resp.status_code == 200
        data = resp.json()
        assert len(data["available"]) >= 3
        assert data["active"] == []

    def test_accept_mission(self, client, db, auth_header, test_user, sample_missions):
        template_id = str(sample_missions[0].id)
        resp = client.post(f"/api/missions/{template_id}/accept", headers=auth_header)
        assert resp.status_code == 201
        data = resp.json()
        assert data["status"] == "active"
        assert data["adjusted_target"] >= sample_missions[0].base_target

    def test_accept_mission_max_two(self, client, db, auth_header, test_user, sample_missions):
        # Accept 2 missions
        client.post(f"/api/missions/{sample_missions[0].id}/accept", headers=auth_header)
        client.post(f"/api/missions/{sample_missions[1].id}/accept", headers=auth_header)

        # Third should fail (max 2 active)
        resp = client.post(f"/api/missions/{sample_missions[2].id}/accept", headers=auth_header)
        assert resp.status_code == 400

    def test_accept_same_mission_twice(self, client, db, auth_header, test_user, sample_missions):
        template_id = str(sample_missions[0].id)
        client.post(f"/api/missions/{template_id}/accept", headers=auth_header)
        resp = client.post(f"/api/missions/{template_id}/accept", headers=auth_header)
        assert resp.status_code == 409

    def test_accept_nonexistent_mission(self, client, db, auth_header, test_user):
        fake_id = str(uuid.uuid4())
        resp = client.post(f"/api/missions/{fake_id}/accept", headers=auth_header)
        assert resp.status_code == 404

    def test_mission_scales_with_level(self, client, db, auth_header, test_user, sample_missions):
        # Set user level to 5
        progress = db.query(UserProgress).filter(
            UserProgress.user_id == test_user.id
        ).first()
        progress.level = 5
        db.flush()

        template = sample_missions[0]  # difficulty_scale=1.1
        resp = client.post(f"/api/missions/{template.id}/accept", headers=auth_header)
        assert resp.status_code == 201
        # adjusted_target = 100 * 1.1^4 ≈ 146.41
        assert resp.json()["adjusted_target"] > template.base_target


# ---------------------------------------------------------------------------
# Achievements
# ---------------------------------------------------------------------------

class TestAchievements:
    """GET /api/achievements"""

    def test_list_achievements(self, client, db, auth_header, test_user, sample_achievements):
        resp = client.get("/api/achievements", headers=auth_header)
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) >= 4
        # None should be earned yet
        assert all(a["earned"] is False for a in data)

    def test_achievement_earned_after_workout(
        self, client, db, auth_header, test_user, sample_exercises, sample_achievements
    ):
        # Create a workout to trigger "First Workout" achievement
        client.post("/api/workouts", json={
            "workout_date": str(date.today()),
            "exercises": [{
                "exercise_id": str(sample_exercises[0].id),
                "sets": 3, "reps": 10, "weight_kg": 50,
            }],
        }, headers=auth_header)

        resp = client.get("/api/achievements", headers=auth_header)
        data = resp.json()
        earned = [a for a in data if a["earned"]]
        earned_names = [a["name"] for a in earned]
        assert "First Workout" in earned_names


# ---------------------------------------------------------------------------
# Full gamification flow
# ---------------------------------------------------------------------------

class TestGamificationFlow:
    """End-to-end: workout -> XP -> achievement -> mission progress."""

    def test_full_flow(
        self, client, db, auth_header, test_user,
        sample_exercises, sample_achievements, sample_missions, sample_campaign
    ):
        # 1. Accept a mission (workout_count type)
        wc_mission = sample_missions[2]  # "Consistent Worker", 3 workouts
        resp = client.post(f"/api/missions/{wc_mission.id}/accept", headers=auth_header)
        assert resp.status_code == 201

        # 2. Create a workout
        resp = client.post("/api/workouts", json={
            "workout_date": str(date.today()),
            "exercises": [{
                "exercise_id": str(sample_exercises[0].id),
                "sets": 4, "reps": 12, "weight_kg": 60,
            }],
        }, headers=auth_header)
        assert resp.status_code == 201
        assert resp.json()["xp_gained"] > 0

        # 3. Check progress updated
        progress = client.get("/api/progress", headers=auth_header).json()
        assert progress["xp"] > 0
        assert progress["total_workouts"] >= 1

        # 4. Check missions — the workout_count mission should have progress
        missions = client.get("/api/missions", headers=auth_header).json()
        active = missions["active"]
        assert len(active) >= 1
        wc_active = [m for m in active if m["mission_template_id"] == str(wc_mission.id)]
        assert len(wc_active) == 1
        assert wc_active[0]["current_progress"] >= 1

        # 5. Achievements should include "First Workout"
        achievements = client.get("/api/achievements", headers=auth_header).json()
        earned_names = [a["name"] for a in achievements if a["earned"]]
        assert "First Workout" in earned_names
