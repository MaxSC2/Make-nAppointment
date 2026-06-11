"""FastAPI-зависимости (Depends).

Здесь собраны типовые зависимости:
- get_db        — открыть сессию
- get_current_user — достать пользователя по JWT
- require_role  — фабрика зависимостей для проверки ролей
- audit         — записать событие в audit_log
"""

from __future__ import annotations

import uuid
from collections.abc import AsyncIterator, Callable
from typing import Annotated

import jwt
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from db.models.auth import Role, RoleCode, User, UserRole
from db.schemas.auth import UserOut
from db.security import JWT_TYPE_ACCESS, decode_token
from db.session import async_session_maker


# Авто-применение схемы Bearer (Swagger UI показывает кнопку "Authorize")
bearer_scheme = HTTPBearer(auto_error=False, description="JWT access-токен")


async def get_db() -> AsyncIterator[AsyncSession]:
    """Alias для get_session (для семантической ясности в Depends)."""
    async with async_session_maker() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


def _credentials_error(detail: str) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=detail,
        headers={"WWW-Authenticate": "Bearer"},
    )


async def get_current_user(
    request: Request,
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> User:
    """Достаёт текущего пользователя по access-токену.

    Загружает пользователя вместе с ролями (selectinload) одним запросом.
    Кладёт объект в request.state.user для удобства middleware/логирования.
    """
    if credentials is None:
        raise _credentials_error("Missing Authorization header")

    try:
        payload = decode_token(credentials.credentials, expected_type=JWT_TYPE_ACCESS)
        user_id_str: str = payload["sub"]
    except jwt.ExpiredSignatureError:
        raise _credentials_error("Token expired")
    except jwt.InvalidTokenError as e:
        raise _credentials_error(f"Invalid token: {e}")

    try:
        user_uuid = uuid.UUID(user_id_str)
    except ValueError:
        raise _credentials_error("Invalid subject in token")

    stmt = (
        select(User)
        .where(User.id == user_uuid)
        .options(selectinload(User.roles).selectinload(UserRole.role))
    )
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    if user is None or not user.is_active:
        raise _credentials_error("User not found or disabled")

    request.state.user = user
    return user


def require_role(*required: RoleCode) -> Callable[[User], User]:
    """Фабрика Depends: проверяет, что у пользователя есть хотя бы одна из ролей.

    Использование:
        @router.post(..., dependencies=[Depends(require_role(RoleCode.ADMIN))])
    """

    async def _checker(user: Annotated[User, Depends(get_current_user)]) -> User:
        # superuser проходит любые проверки
        if user.is_superuser:
            return user
        user_role_codes = {ur.role.code for ur in user.roles}
        if not user_role_codes.intersection({r.value for r in required}):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Requires one of roles: {[r.value for r in required]}",
            )
        return user

    return _checker


def user_to_dto(user: User) -> UserOut:
    """ORM → DTO с заполнением role_codes (без lazy-запросов)."""
    return UserOut(
        id=user.id,
        username=user.username,
        email=user.email,
        full_name=user.full_name,
        is_active=user.is_active,
        is_superuser=user.is_superuser,
        last_login_at=user.last_login_at,
        created_at=user.created_at,
        role_codes=sorted({ur.role.code for ur in user.roles}),
    )
