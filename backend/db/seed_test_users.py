"""Сид тестовых пользователей для рабочей БД pacs_ris.

Создаёт по одной учётке на каждую роль, чтобы можно было проверить RBAC вживую.

Использование:
    cd C:\\Projects\\ARCHIVE\\MedPlatform\\backend
    python -m db.seed_test_users

Учётные данные:
    admin_t      / admin123  (admin, superuser)
    doctor_t     / doctor123 (рентгенолог)
    registrar_t  / reg123    (регистратор)
    technician_t / tech123   (лаборант)
"""
from __future__ import annotations

import asyncio
import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from db.base import Base  # noqa: F401
from db.config import settings
from db.models import auth, queue, ris, audit  # noqa: F401
from db.models.auth import Role, RoleCode, User, UserRole
from db.security import hash_password
from db.session import async_session_maker


USERS: list[tuple[str, str, str, str, str]] = [
    # (username, password, full_name, email, role_code)
    ("admin_t",      "admin123",  "Test Admin",         "admin_t@medplatform.local",      RoleCode.ADMIN.value),
    ("doctor_t",     "doctor123", "Test Doctor",        "doctor_t@medplatform.local",     RoleCode.DOCTOR.value),
    ("registrar_t",  "reg123",    "Test Registrar",     "registrar_t@medplatform.local",  RoleCode.REGISTRAR.value),
    ("technician_t", "tech123",   "Test Technician",    "technician_t@medplatform.local", RoleCode.TECHNICIAN.value),
]


async def seed_user(db: AsyncSession, username: str, password: str, full_name: str, email: str, role_code: str) -> None:
    existing = await db.scalar(select(User).where(User.username == username))
    if existing is not None:
        print(f"  [SKIP] {username:14} — already exists")
        return

    user = User(
        id=uuid.uuid4(),
        username=username,
        email=email,
        full_name=full_name,
        password_hash=hash_password(password),
        is_active=True,
        is_superuser=(role_code == RoleCode.ADMIN.value),
    )
    db.add(user)
    await db.flush()

    role = await db.scalar(select(Role).where(Role.code == role_code))
    if role is None:
        print(f"  [ERR ] {username:14} — role {role_code!r} not found (run init_db first)")
        return
    db.add(UserRole(user_id=user.id, role_id=role.id))
    print(f"  [OK  ] {username:14} / {password:10}  (role={role_code})")


async def main() -> None:
    print("Seeding test users in", settings.database_url.split("@")[-1])
    print("-" * 60)
    async with async_session_maker() as db:
        for username, password, full_name, email, role_code in USERS:
            await seed_user(db, username, password, full_name, email, role_code)
        await db.commit()
    print("-" * 60)
    print("Done. Test users for RBAC verification created.")
    print("Login:  POST /api/auth/login {username, password}")


if __name__ == "__main__":
    asyncio.run(main())
