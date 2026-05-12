"""
Auth endpoints:
  POST /api/auth/register  — создать аккаунт
  POST /api/auth/login     — получить токены
  POST /api/auth/refresh   — обновить access token
  POST /api/auth/logout    — удалить сессию
  GET  /api/auth/me        — данные текущего юзера
"""
import logging
import uuid
from datetime import datetime, timedelta, timezone

logger = logging.getLogger(__name__)

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.models import User, UserProgress, UserSession
from app.schemas.auth import (
    AccessTokenResponse,
    ChangePasswordRequest,
    DeleteMeRequest,
    LoginRequest,
    MessageResponse,
    RefreshRequest,
    RegisterRequest,
    TokenResponse,
    UpdateMeRequest,
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
from app.services.gamification_service import try_advance_chapter
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

    # Assign first campaign + chapter 1 so the campaign screen is not empty
    try:
        try_advance_chapter(user.id, db)
    except Exception as exc:
        logger.warning("Failed to assign initial campaign for user %s: %s", user.id, exc)

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
    Refresh token rotation (OAuth 2.0 best practice):
    - Validates the supplied refresh_token against the stored hash
    - Issues a NEW access_token AND a NEW refresh_token
    - Replaces the session's hash and resets expires_at to now + 7 days
    - As long as the user opens the app at least once per refresh window,
      they stay signed in indefinitely.
    - Bonus security: if the refresh_token leaks and is used by an attacker,
      the legitimate user's next refresh will fail (because the hash changed),
      surfacing the compromise.
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

    # Rotate: issue new tokens and update the session row
    new_access_token  = create_access_token(str(session.user_id))
    new_refresh_token = generate_refresh_token()
    session.refresh_token_hash = hash_refresh_token(new_refresh_token)
    session.expires_at = datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    db.commit()

    return AccessTokenResponse(
        access_token  = new_access_token,
        refresh_token = new_refresh_token,
    )


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


@router.patch("/me", response_model=UserResponse)
def update_me(
    body: UpdateMeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Обновляет профиль текущего юзера."""
    if body.onboarding_done is not None:
        current_user.onboarding_done = body.onboarding_done
    if body.name is not None:
        name = body.name.strip()
        if not name:
            raise HTTPException(status_code=422, detail="Name cannot be empty")
        current_user.name = name
    if body.primary_goal is not None:
        current_user.primary_goal = body.primary_goal
    if body.experience_level is not None:
        current_user.experience_level = body.experience_level
    if body.avatar_theme_id is not None:
        if body.avatar_theme_id not in (0, 1, 2, 3):
            raise HTTPException(status_code=422, detail="avatar_theme_id must be 0-3")
        current_user.avatar_theme_id = body.avatar_theme_id
    db.commit()
    db.refresh(current_user)
    return UserResponse.model_validate(current_user)


@router.post("/change-password", response_model=MessageResponse)
def change_password(
    body: ChangePasswordRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Change the current user's password after verifying the old one."""
    if not verify_password(body.old_password, current_user.password_hash):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    current_user.password_hash = hash_password(body.new_password)
    db.commit()
    return MessageResponse(message="Password changed successfully")


@router.delete("/me", response_model=MessageResponse)
def delete_me(
    body: DeleteMeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Permanently delete the current user's account."""
    if not verify_password(body.password, current_user.password_hash):
        raise HTTPException(status_code=400, detail="Incorrect password")
    db.delete(current_user)
    db.commit()
    return MessageResponse(message="Account deleted")


@router.get("/export")
def export_data(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return all user data as a JSON export."""
    from app.models import UserProgress, Workout, NutritionLog, UserMission, UserAchievement

    progress = db.query(UserProgress).filter(UserProgress.user_id == current_user.id).first()
    workouts = db.query(Workout).filter(Workout.user_id == current_user.id).all()
    logs = db.query(NutritionLog).filter(NutritionLog.user_id == current_user.id).all()
    missions = db.query(UserMission).filter(UserMission.user_id == current_user.id).all()
    achievements = db.query(UserAchievement).filter(UserAchievement.user_id == current_user.id).all()

    return {
        "exported_at": datetime.now(timezone.utc).isoformat(),
        "user": {
            "id": str(current_user.id),
            "email": current_user.email,
            "name": current_user.name,
            "experience_level": current_user.experience_level,
            "primary_goal": current_user.primary_goal,
            "created_at": current_user.created_at.isoformat() if current_user.created_at else None,
        },
        "progress": {
            "xp": progress.xp if progress else 0,
            "level": progress.level if progress else 1,
            "coins": progress.coins if progress else 0,
            "current_streak": progress.current_streak if progress else 0,
            "longest_streak": progress.longest_streak if progress else 0,
            "total_workouts": progress.total_workouts if progress else 0,
        } if progress else None,
        "workouts": [
            {
                "id": str(w.id),
                "workout_date": w.workout_date.isoformat() if w.workout_date else None,
                "duration_minutes": w.duration_minutes,
                "notes": w.notes,
                "created_at": w.created_at.isoformat() if w.created_at else None,
            }
            for w in workouts
        ],
        "nutrition_logs": [
            {
                "id": str(l.id),
                "date": l.date.isoformat() if l.date else None,
                "meal_type": l.meal_type,
                "quantity_g": float(l.quantity_g),
            }
            for l in logs
        ],
        "missions": [
            {
                "id": str(m.id),
                "mission_template_id": str(m.mission_template_id),
                "type": m.template.type if m.template else None,
                "status": m.status,
                "adjusted_target": float(m.adjusted_target),
                "current_progress": float(m.current_progress),
                "completed_at": m.completed_at.isoformat() if m.completed_at else None,
            }
            for m in missions
        ],
        "achievements": [
            {"achievement_id": str(a.achievement_id), "earned_at": a.earned_at.isoformat() if a.earned_at else None}
            for a in achievements
        ],
    }