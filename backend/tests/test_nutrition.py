"""Integration tests for Nutrition endpoints (/api/nutrition/*)."""
import uuid
from datetime import date, timedelta

import pytest


class TestFoodSearch:
    """GET /api/nutrition/foods"""

    def test_search_foods(self, client, db, auth_header, test_user, sample_foods):
        resp = client.get("/api/nutrition/foods", params={"q": "chicken"}, headers=auth_header)
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) >= 1
        assert any("Chicken" in f["name"] for f in data)

    def test_search_no_results(self, client, db, auth_header, test_user, sample_foods):
        resp = client.get("/api/nutrition/foods", params={"q": "xyz_nonexistent"}, headers=auth_header)
        assert resp.status_code == 200
        assert resp.json() == []


class TestCustomFood:
    """POST /api/nutrition/foods"""

    def test_create_custom_food(self, client, db, auth_header, test_user):
        resp = client.post("/api/nutrition/foods", json={
            "name": "My Protein Shake",
            "calories_per100g": 120,
            "protein_per100g": 25,
            "carbs_per100g": 5,
            "fat_per100g": 2,
        }, headers=auth_header)
        assert resp.status_code == 201
        data = resp.json()
        assert data["name"] == "My Protein Shake"
        assert data["is_custom"] is True

    def test_create_food_no_auth(self, client, db):
        resp = client.post("/api/nutrition/foods", json={
            "name": "Unauthorized",
            "calories_per100g": 100,
            "protein_per100g": 10,
            "carbs_per100g": 10,
            "fat_per100g": 5,
        })
        assert resp.status_code in (401, 403)


class TestNutritionLog:
    """POST/DELETE /api/nutrition/log"""

    def test_log_food(self, client, db, auth_header, test_user, sample_foods):
        food_id = str(sample_foods[0].id)  # Chicken Breast
        resp = client.post("/api/nutrition/log", json={
            "date": str(date.today()),
            "meal_type": "lunch",
            "food_item_id": food_id,
            "quantity_g": 200,
        }, headers=auth_header)
        assert resp.status_code == 201
        data = resp.json()
        assert data["food_name"] == "Chicken Breast"
        assert data["meal_type"] == "lunch"
        # 200g of chicken: 165*2=330 cal, 31*2=62g protein
        assert abs(data["calories"] - 330) < 1
        assert abs(data["protein_g"] - 62) < 1

    def test_log_food_invalid_meal_type(self, client, db, auth_header, test_user, sample_foods):
        food_id = str(sample_foods[0].id)
        resp = client.post("/api/nutrition/log", json={
            "date": str(date.today()),
            "meal_type": "midnight_snack",
            "food_item_id": food_id,
            "quantity_g": 100,
        }, headers=auth_header)
        assert resp.status_code == 422

    def test_delete_log(self, client, db, auth_header, test_user, sample_foods):
        food_id = str(sample_foods[0].id)
        create_resp = client.post("/api/nutrition/log", json={
            "date": str(date.today()),
            "meal_type": "lunch",
            "food_item_id": food_id,
            "quantity_g": 100,
        }, headers=auth_header)
        log_id = create_resp.json()["id"]

        resp = client.delete(f"/api/nutrition/log/{log_id}", headers=auth_header)
        assert resp.status_code == 204


class TestDailyNutrition:
    """GET /api/nutrition/daily"""

    def test_daily_empty(self, client, db, auth_header, test_user):
        resp = client.get("/api/nutrition/daily", params={"date": str(date.today())}, headers=auth_header)
        assert resp.status_code == 200
        data = resp.json()
        assert data["totals"]["calories"] == 0

    def test_daily_with_logs(self, client, db, auth_header, test_user, sample_foods):
        food_id = str(sample_foods[0].id)
        client.post("/api/nutrition/log", json={
            "date": str(date.today()),
            "meal_type": "lunch",
            "food_item_id": food_id,
            "quantity_g": 200,
        }, headers=auth_header)
        client.post("/api/nutrition/log", json={
            "date": str(date.today()),
            "meal_type": "dinner",
            "food_item_id": str(sample_foods[1].id),
            "quantity_g": 300,
        }, headers=auth_header)

        resp = client.get("/api/nutrition/daily", params={"date": str(date.today())}, headers=auth_header)
        assert resp.status_code == 200
        data = resp.json()
        assert data["totals"]["calories"] > 0
        assert "lunch" in data["meals"]
        assert "dinner" in data["meals"]


class TestWeeklyNutrition:
    """GET /api/nutrition/weekly"""

    def test_weekly_range(self, client, db, auth_header, test_user, sample_foods):
        food_id = str(sample_foods[0].id)
        today = date.today()
        client.post("/api/nutrition/log", json={
            "date": str(today),
            "meal_type": "lunch",
            "food_item_id": food_id,
            "quantity_g": 200,
        }, headers=auth_header)

        from_date = str(today - timedelta(days=6))
        resp = client.get("/api/nutrition/weekly", params={
            "from": from_date,
            "to": str(today),
        }, headers=auth_header)
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)


class TestNutritionGoals:
    """GET/PATCH /api/nutrition/goals"""

    def test_get_default_goals(self, client, db, auth_header, test_user):
        resp = client.get("/api/nutrition/goals", headers=auth_header)
        assert resp.status_code == 200
        data = resp.json()
        assert data["calories_goal"] == 2500
        assert data["protein_goal_g"] == 160

    def test_update_goals(self, client, db, auth_header, test_user):
        resp = client.patch("/api/nutrition/goals", json={
            "calories_goal": 2000,
            "protein_goal_g": 180,
        }, headers=auth_header)
        assert resp.status_code == 200
        data = resp.json()
        assert data["calories_goal"] == 2000
        assert data["protein_goal_g"] == 180

        # Verify persistence
        resp2 = client.get("/api/nutrition/goals", headers=auth_header)
        assert resp2.json()["calories_goal"] == 2000
