"""
Pydantic schemas для Auth.
Schemas — это контракт между клиентом и сервером:
- Request schemas: что принимаем от клиента (валидация)
- Response schemas: что отдаём клиенту (сериализация)
"""
from pydantic import BaseModel, EmailStr, field_validator, ConfigDict
from typing import Literal
import uuid


# ─── Register ─────────────────────────────────────────────────────

class RegisterRequest(BaseModel):
    email:            EmailStr
    password:         str
    name:             str
    avatar_theme_id:  int = 0
    experience_level: Literal["beginner", "intermediate", "advanced"] = "beginner"
    primary_goal:     Literal["strength", "hypertrophy", "endurance"] = "strength"

    @field_validator("password")
    @classmethod
    def password_min_length(cls, v: str) -> str:
        if len(v) < 6:
            raise ValueError("Password must be at least 6 characters")
        return v

    @field_validator("name")
    @classmethod
    def name_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Name cannot be empty")
        return v.strip()

    @field_validator("avatar_theme_id")
    @classmethod
    def avatar_range(cls, v: int) -> int:
        if v not in (0, 1, 2, 3):
            raise ValueError("avatar_theme_id must be 0–3")
        return v


# ─── Login ────────────────────────────────────────────────────────

class LoginRequest(BaseModel):
    email:    EmailStr
    password: str


# ─── Responses ────────────────────────────────────────────────────

class UserResponse(BaseModel):
    id: uuid.UUID
    email:            str
    name:             str
    avatar_theme_id:  int
    experience_level: str
    primary_goal:     str
    onboarding_done:  bool

    model_config = {"from_attributes": True}


class TokenResponse(BaseModel):
    access_token:  str
    refresh_token: str
    token_type:    str = "bearer"
    user:          UserResponse


class RefreshRequest(BaseModel):
    refresh_token: str


class AccessTokenResponse(BaseModel):
    """
    Returned by /api/auth/refresh.
    Includes a freshly-rotated refresh_token: the previous one is invalidated
    on the server. This way an active user stays signed in indefinitely.
    """
    access_token:  str
    refresh_token: str
    token_type:    str = "bearer"


class MessageResponse(BaseModel):
    message: str


class UpdateMeRequest(BaseModel):
    onboarding_done:  bool | None = None
    name:             str | None = None
    primary_goal:     Literal["strength", "hypertrophy", "endurance"] | None = None
    experience_level: Literal["beginner", "intermediate", "advanced"] | None = None
    avatar_theme_id:  int | None = None


class ChangePasswordRequest(BaseModel):
    old_password: str
    new_password: str

    @field_validator("new_password")
    @classmethod
    def new_password_min(cls, v: str) -> str:
        if len(v) < 6:
            raise ValueError("Password must be at least 6 characters")
        return v


class DeleteMeRequest(BaseModel):
    password: str