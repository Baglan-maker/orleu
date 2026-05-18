"""Integration tests for Auth endpoints (/api/auth/*)."""
import uuid

import pytest
from app.models import User, UserSession
from app.services.auth_utils import hash_password, hash_refresh_token


class TestRegister:
    """POST /api/auth/register"""

    def test_register_success(self, client, db):
        resp = client.post("/api/auth/register", json={
            "email": "new@example.com",
            "password": "secret123",
            "name": "New User",
        })
        assert resp.status_code == 201
        data = resp.json()
        assert data["access_token"]
        assert data["refresh_token"]
        assert data["user"]["email"] == "new@example.com"
        assert data["user"]["name"] == "New User"
        assert data["user"]["experience_level"] == "beginner"

    def test_register_duplicate_email(self, client, db, test_user):
        resp = client.post("/api/auth/register", json={
            "email": "test@example.com",
            "password": "secret123",
            "name": "Duplicate",
        })
        assert resp.status_code == 409
        assert "already registered" in resp.json()["detail"]

    def test_register_short_password(self, client, db):
        resp = client.post("/api/auth/register", json={
            "email": "short@example.com",
            "password": "123",
            "name": "Short",
        })
        assert resp.status_code == 422

    def test_register_missing_fields(self, client, db):
        resp = client.post("/api/auth/register", json={"email": "a@b.com"})
        assert resp.status_code == 422

    def test_register_invalid_email(self, client, db):
        resp = client.post("/api/auth/register", json={
            "email": "not-an-email",
            "password": "secret123",
            "name": "Bad Email",
        })
        assert resp.status_code == 422

    def test_register_with_optional_fields(self, client, db):
        resp = client.post("/api/auth/register", json={
            "email": "opt@example.com",
            "password": "secret123",
            "name": "Opt User",
            "avatar_theme_id": 2,
            "experience_level": "intermediate",
            "primary_goal": "hypertrophy",
        })
        assert resp.status_code == 201
        user = resp.json()["user"]
        assert user["avatar_theme_id"] == 2
        assert user["experience_level"] == "intermediate"
        assert user["primary_goal"] == "hypertrophy"


class TestLogin:
    """POST /api/auth/login"""

    def test_login_success(self, client, db, test_user):
        resp = client.post("/api/auth/login", json={
            "email": "test@example.com",
            "password": "password123",
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["access_token"]
        assert data["refresh_token"]
        assert data["user"]["email"] == "test@example.com"

    def test_login_wrong_password(self, client, db, test_user):
        resp = client.post("/api/auth/login", json={
            "email": "test@example.com",
            "password": "wrongpassword",
        })
        assert resp.status_code == 401

    def test_login_nonexistent_user(self, client, db):
        resp = client.post("/api/auth/login", json={
            "email": "nobody@example.com",
            "password": "password123",
        })
        assert resp.status_code == 401


class TestRefreshToken:
    """POST /api/auth/refresh"""

    def test_refresh_success(self, client, db, test_user):
        # Login to get a refresh token
        login_resp = client.post("/api/auth/login", json={
            "email": "test@example.com",
            "password": "password123",
        })
        refresh_token = login_resp.json()["refresh_token"]

        resp = client.post("/api/auth/refresh", json={
            "refresh_token": refresh_token,
        })
        assert resp.status_code == 200
        assert resp.json()["access_token"]

    def test_refresh_invalid_token(self, client, db):
        resp = client.post("/api/auth/refresh", json={
            "refresh_token": "invalid-token-value",
        })
        assert resp.status_code == 401


class TestLogout:
    """POST /api/auth/logout"""

    def test_logout_success(self, client, db, test_user, auth_header):
        # Login to get refresh token
        login_resp = client.post("/api/auth/login", json={
            "email": "test@example.com",
            "password": "password123",
        })
        refresh_token = login_resp.json()["refresh_token"]

        resp = client.post(
            "/api/auth/logout",
            json={"refresh_token": refresh_token},
            headers=auth_header,
        )
        assert resp.status_code == 200
        assert resp.json()["message"] == "Logged out successfully"

        # Refresh should now fail
        resp2 = client.post("/api/auth/refresh", json={
            "refresh_token": refresh_token,
        })
        assert resp2.status_code == 401

    def test_logout_without_auth(self, client, db):
        resp = client.post("/api/auth/logout", json={"refresh_token": "x"})
        assert resp.status_code in (401, 403)


class TestMe:
    """GET/PATCH /api/auth/me"""

    def test_get_me(self, client, db, test_user, auth_header):
        resp = client.get("/api/auth/me", headers=auth_header)
        assert resp.status_code == 200
        assert resp.json()["email"] == "test@example.com"
        assert resp.json()["name"] == "Test User"

    def test_get_me_no_token(self, client, db):
        resp = client.get("/api/auth/me")
        assert resp.status_code in (401, 403)

    def test_update_me(self, client, db, test_user, auth_header):
        resp = client.patch(
            "/api/auth/me",
            json={"onboarding_done": True},
            headers=auth_header,
        )
        assert resp.status_code == 200
        assert resp.json()["onboarding_done"] is True
