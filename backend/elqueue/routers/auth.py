"""Эндпоинты аутентификации (общие для elqueue и RIS — одна БД `auth`).

POST /api/auth/login    — получить пару токенов
POST /api/auth/refresh  — обновить access по refresh
POST /api/auth/logout   — отозвать refresh
GET  /api/auth/me       — текущий пользователь
"""

from __future__ import annotations

import logging
import uuid
from datetime import datetime, timedelta, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, status

logger = logging.getLogger("elqueue.auth")
from jwt import ExpiredSignatureError, InvalidTokenError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from db.config import settings
from db.dependencies import get_current_user, get_db, user_to_dto
from db.models.audit import AuditAction, AuditLog
from db.models.auth import RefreshToken, User, UserRole
from db.schemas.auth import LoginRequest, RefreshRequest, TokenPair, UserOut
from db.security import (
    JWT_TYPE_REFRESH,
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_refresh_token,
    verify_password,
)


router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/login", response_model=TokenPair)
async def login(
    body: LoginRequest,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> TokenPair:
    """Логин по username/password. Возвращает access+refresh токены."""
    stmt = (
        select(User)
        .where(User.username == body.username)
        .options(selectinload(User.roles).selectinload(UserRole.role))
    )
    user = (await db.execute(stmt)).scalar_one_or_none()

    if user is None or not verify_password(body.password, user.password_hash):
        await _audit(db, request, user, AuditAction.LOGIN_FAILED.value, ok=False)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
        )
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User disabled")

    role_codes = sorted({ur.role.code for ur in user.roles})
    access, ttl = create_access_token(user.id, role_codes)
    refresh = create_refresh_token(user.id)

    db.add(RefreshToken(
        user_id=user.id,
        token_hash=hash_refresh_token(refresh),
        expires_at=datetime.now(timezone.utc)
        + timedelta(days=settings.jwt_refresh_ttl_days),
    ))
    user.last_login_at = datetime.now(timezone.utc)
    await db.commit()
    await _audit(db, request, user, AuditAction.LOGIN.value, ok=True)

    return TokenPair(access_token=access, refresh_token=refresh, expires_in=ttl)


@router.post("/refresh", response_model=TokenPair)
async def refresh(
    body: RefreshRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> TokenPair:
    """Обновление access-токена по refresh."""
    try:
        payload = decode_token(body.refresh_token, expected_type=JWT_TYPE_REFRESH)
        user_id = uuid.UUID(payload["sub"])
    except ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Refresh token expired")
    except InvalidTokenError as e:
        raise HTTPException(status_code=401, detail=f"Invalid refresh: {e}")

    token_hash = hash_refresh_token(body.refresh_token)
    db_token = (await db.execute(
        select(RefreshToken).where(
            RefreshToken.token_hash == token_hash,
            RefreshToken.user_id == user_id,
            RefreshToken.revoked == False,  # noqa: E712
        )
    )).scalar_one_or_none()
    if db_token is None or db_token.expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=401, detail="Refresh token revoked or expired")

    user_stmt = (
        select(User)
        .where(User.id == user_id, User.is_active == True)  # noqa: E712
        .options(selectinload(User.roles).selectinload(UserRole.role))
    )
    user = (await db.execute(user_stmt)).scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=401, detail="User not found")

    role_codes = sorted({ur.role.code for ur in user.roles})
    access, ttl = create_access_token(user.id, role_codes)
    return TokenPair(access_token=access, refresh_token=body.refresh_token, expires_in=ttl)


@router.post("/logout")
async def logout(
    body: RefreshRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    """Отзыв refresh-токена."""
    token_hash = hash_refresh_token(body.refresh_token)
    db_token = (await db.execute(
        select(RefreshToken).where(RefreshToken.token_hash == token_hash)
    )).scalar_one_or_none()
    if db_token is not None:
        db_token.revoked = True
        await db.commit()
    return {"ok": True}


@router.get("/me", response_model=UserOut)
async def me(
    user: Annotated[User, Depends(get_current_user)],
) -> UserOut:
    return user_to_dto(user)


async def _audit(
    db: AsyncSession,
    request: Request,
    user: User | None,
    action: str,
    ok: bool,
) -> None:
    db.add(AuditLog(
        user_id=user.id if user else None,
        action=action,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
        ok=ok,
    ))
    try:
        await db.commit()
    except Exception:
        logger.warning("audit log rollback", exc_info=True)
        await db.rollback()
