"""
Auth endpoints:
  POST /api/auth/register  — создать аккаунт
  POST /api/auth/login     — получить токены
  POST /api/auth/refresh   — обновить access token
  POST /api/auth/logout    — удалить сессию
  GET  /api/auth/me        — данные текущего юзера
"""
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.models import User, UserProgress, UserSession
from app.schemas.auth import (
    AccessTokenResponse,
    LoginRequest,
    MessageResponse,
    RefreshRequest,
    RegisterRequest,
    TokenResponse,
    UserResponse,
)
from app.services.auth_utils import (
    create_access_token,
    generate_refresh_token,
    hash_password,
    hash_refresh_token,
    verify_password,
)
from app.services.dependencies import get_current_user
from app.config import settings

router = APIRouter()


# ─── Register ─────────────────────────────────────────────────────

@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def register(body: RegisterRequest, db: Session = Depends(get_db)):
    """
    Создаёт нового юзера.
    Сразу создаёт user_progress (game state) и выдаёт токены.
    """
    # Проверяем что email не занят
    existing = db.query(User).filter(User.email == body.email).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered",
        )

    # Создаём юзера
    user = User(
        email            = body.email,
        password_hash    = hash_password(body.password),
        name             = body.name,
        avatar_theme_id  = body.avatar_theme_id,
        experience_level = body.experience_level,
        primary_goal     = body.primary_goal,
        onboarding_done  = False,
    )
    db.add(user)
    db.flush()  # получаем user.id без коммита

    # Создаём начальный game state
    progress = UserProgress(user_id=user.id)
    db.add(progress)

    # Выдаём токены
    access_token  = create_access_token(str(user.id))
    refresh_token = generate_refresh_token()

    session = UserSession(
        user_id            = user.id,
        refresh_token_hash = hash_refresh_token(refresh_token),
        expires_at         = datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
    )
    db.add(session)
    db.commit()
    db.refresh(user)

    return TokenResponse(
        access_token  = access_token,
        refresh_token = refresh_token,
        user          = UserResponse.model_validate(user),
    )


# ─── Login ────────────────────────────────────────────────────────

@router.post("/login", response_model=TokenResponse)
def login(body: LoginRequest, db: Session = Depends(get_db)):
    """Проверяет email + пароль, возвращает токены."""
    user = db.query(User).filter(User.email == body.email).first()

    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )

    access_token  = create_access_token(str(user.id))
    refresh_token = generate_refresh_token()

    session = UserSession(
        user_id            = user.id,
        refresh_token_hash = hash_refresh_token(refresh_token),
        expires_at         = datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
    )
    db.add(session)
    db.commit()

    return TokenResponse(
        access_token  = access_token,
        refresh_token = refresh_token,
        user          = UserResponse.model_validate(user),
    )


# ─── Refresh ──────────────────────────────────────────────────────

@router.post("/refresh", response_model=AccessTokenResponse)
def refresh_token(body: RefreshRequest, db: Session = Depends(get_db)):
    """
    Принимает refresh_token, возвращает новый access_token.
    Refresh token при этом НЕ меняется (rotation не реализован для простоты MVP).
    """
    token_hash = hash_refresh_token(body.refresh_token)
    session = db.query(UserSession).filter(
        UserSession.refresh_token_hash == token_hash
    ).first()

    if not session:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token",
        )

    if session.expires_at < datetime.now(timezone.utc):
        db.delete(session)
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token expired",
        )

    new_access_token = create_access_token(str(session.user_id))
    return AccessTokenResponse(access_token=new_access_token)


# ─── Logout ───────────────────────────────────────────────────────

@router.post("/logout", response_model=MessageResponse)
def logout(
    body: RefreshRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Удаляет сессию (invalidates refresh token)."""
    token_hash = hash_refresh_token(body.refresh_token)
    session = db.query(UserSession).filter(
        UserSession.refresh_token_hash == token_hash,
        UserSession.user_id == current_user.id,
    ).first()

    if session:
        db.delete(session)
        db.commit()

    return MessageResponse(message="Logged out successfully")


# ─── Me ───────────────────────────────────────────────────────────

@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    """Возвращает данные текущего аутентифицированного юзера."""
    return UserResponse.model_validate(current_user)