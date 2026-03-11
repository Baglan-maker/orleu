"""
JWT utilities.
- access token:  короткий (15 мин), stateless, не хранится в БД
- refresh token: длинный (7 дней), хэш хранится в user_sessions
"""
import hashlib
import secrets
from datetime import datetime, timedelta, timezone

from jose import JWTError, jwt
from passlib.context import CryptContext

from app.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


# ─── Password ─────────────────────────────────────────────────────

def hash_password(plain: str) -> str:
    return pwd_context.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


# ─── Access Token (JWT) ───────────────────────────────────────────

def create_access_token(user_id: str) -> str:
    """Создаёт короткоживущий JWT access token."""
    expire = datetime.now(timezone.utc) + timedelta(
        minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
    )
    payload = {"sub": str(user_id), "exp": expire, "type": "access"}
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_access_token(token: str) -> str | None:
    """
    Декодирует JWT, возвращает user_id (str) или None если токен невалидный.
    """
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        if payload.get("type") != "access":
            return None
        return payload.get("sub")
    except JWTError:
        return None


# ─── Refresh Token ────────────────────────────────────────────────

def generate_refresh_token() -> str:
    """Генерирует случайный refresh token (не JWT)."""
    return secrets.token_urlsafe(64)


def hash_refresh_token(token: str) -> str:
    """Хэшируем перед сохранением в БД (не храним сам токен)."""
    return hashlib.sha256(token.encode()).hexdigest()