"""Безопасность: хеширование паролей + JWT.

Используем:
- passlib[bcrypt] для хешей паролей
- PyJWT для access/refresh токенов
"""

from __future__ import annotations

import hashlib
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

import bcrypt
import jwt

from db.config import settings


# Bcrypt имеет лимит 72 байта на пароль — обрезаем без warning.
# Это безопасно: 72 байта ≈ 72 ASCII-символа, больше не нужно.
_BCRYPT_MAX_BYTES = 72
_BCRYPT_ROUNDS = 12  # 12 раундов ≈ 250 мс на 1 хеш (баланс CPU/безопасность)


def _truncate(plain: str) -> bytes:
    return plain.encode("utf-8")[:_BCRYPT_MAX_BYTES]


# ==================== ПАРОЛИ ====================

def hash_password(plain: str) -> str:
    """Хеширует пароль. Возвращает строку в формате bcrypt ($2b$...)."""
    salt = bcrypt.gensalt(rounds=_BCRYPT_ROUNDS)
    return bcrypt.hashpw(_truncate(plain), salt).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    """Проверяет пароль. Constant-time внутри bcrypt."""
    try:
        return bcrypt.checkpw(_truncate(plain), hashed.encode("utf-8"))
    except (ValueError, TypeError):
        return False


# ==================== JWT ====================

JWT_TYPE_ACCESS = "access"
JWT_TYPE_REFRESH = "refresh"


def create_access_token(
    user_id: uuid.UUID,
    role_codes: list[str],
    extra: dict[str, Any] | None = None,
) -> tuple[str, int]:
    """Создаёт access-токен. Возвращает (token, ttl_seconds)."""
    now = datetime.now(timezone.utc)
    ttl = settings.jwt_access_ttl_minutes * 60
    payload: dict[str, Any] = {
        "sub": str(user_id),
        "type": JWT_TYPE_ACCESS,
        "roles": role_codes,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(seconds=ttl)).timestamp()),
        "jti": secrets.token_urlsafe(16),
    }
    if extra:
        payload.update(extra)
    token = jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)
    return token, ttl


def create_refresh_token(user_id: uuid.UUID) -> str:
    """Создаёт refresh-токен (используется только для обновления access)."""
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user_id),
        "type": JWT_TYPE_REFRESH,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(days=settings.jwt_refresh_ttl_days)).timestamp()),
        "jti": secrets.token_urlsafe(32),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_token(token: str, expected_type: str | None = None) -> dict[str, Any]:
    """Декодирует и валидирует JWT. Бросает jwt.PyJWTError при ошибке."""
    payload = jwt.decode(
        token,
        settings.jwt_secret,
        algorithms=[settings.jwt_algorithm],
    )
    if expected_type and payload.get("type") != expected_type:
        raise jwt.InvalidTokenError(f"Expected token type {expected_type}")
    return payload


def hash_refresh_token(token: str) -> str:
    """SHA-256 от refresh-токена — хранится в БД (сам токен не сохраняем)."""
    return hashlib.sha256(token.encode("utf-8")).hexdigest()
