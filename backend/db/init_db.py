"""Инициализация БД: роли, модальности, кабинеты, начальный админ.

Запуск:
    python -m db.init_db

Делает:
1. Создаёт все таблицы (если ещё не созданы Alembic-миграцией — для разработки).
2. Заполняет справочники (роли, модальности, кабинеты).
3. Создаёт начального администратора, если его нет.
"""

from __future__ import annotations

import asyncio
import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from db.config import settings
from db.models.auth import Role, RoleCode, User, UserRole
from db.models.queue import Cabinet
from db.models.ris import Modality
from db.security import hash_password
from db.session import async_session_maker, engine
from db.base import Base
# Важно: импорт моделей нужен, чтобы SQLAlchemy их зарегистрировала
from db.models import auth, queue, ris, audit  # noqa: F401


ROLES: list[tuple[str, str, str]] = [
    (RoleCode.ADMIN.value, "Администратор", "Полный доступ ко всем разделам системы"),
    (RoleCode.DOCTOR.value, "Врач-рентгенолог", "Описание снимков, подписание протоколов"),
    (RoleCode.REGISTRAR.value, "Регистратор", "Регистрация пациентов, выдача талонов"),
    (RoleCode.TECHNICIAN.value, "Лаборант КТ/МРТ", "Проведение исследований, отметка о готовности"),
]


MODALITIES: list[tuple[str, str, str]] = [
    ("CT", "Компьютерная томография", "Computed Tomography"),
    ("MR", "Магнитно-резонансная томография", "Magnetic Resonance"),
    ("DX", "Рентгенография", "Digital Radiography"),
    ("US", "Ультразвуковое исследование", "Ultrasound"),
    ("XA", "Ангиография", "X-Ray Angiography"),
    ("PT", "Позитронно-эмиссионная томография", "Positron Emission Tomography"),
    ("MG", "Маммография", "Mammography"),
    ("NM", "Сцинтиграфия", "Nuclear Medicine"),
]


CABINETS: list[tuple[str, str, str]] = [
    ("101", "Кабинет КТ-1", "CT"),
    ("102", "Кабинет МРТ-1", "MR"),
    ("103", "Рентген-кабинет", "DX"),
    ("104", "Кабинет УЗИ", "US"),
    ("105", "Ангиографическая операционная", "XA"),
]


async def seed_roles(db: AsyncSession) -> None:
    for code, name, desc in ROLES:
        exists = await db.scalar(select(Role).where(Role.code == code))
        if exists is None:
            db.add(Role(code=code, name=name, description=desc))
    await db.commit()


async def seed_modalities(db: AsyncSession) -> None:
    for code, name, desc in MODALITIES:
        exists = await db.scalar(select(Modality).where(Modality.code == code))
        if exists is None:
            db.add(Modality(code=code, name=name, description=desc))
    await db.commit()


async def seed_cabinets(db: AsyncSession) -> None:
    for code, name, modality in CABINETS:
        exists = await db.scalar(select(Cabinet).where(Cabinet.code == code))
        if exists is None:
            db.add(Cabinet(code=code, name=name, modality=modality, is_active=True))
    await db.commit()


async def seed_admin(db: AsyncSession) -> None:
    admin = await db.scalar(select(User).where(User.username == settings.admin_username))
    if admin is not None:
        return

    admin = User(
        id=uuid.uuid4(),
        username=settings.admin_username,
        email=None,
        full_name=settings.admin_full_name,
        password_hash=hash_password(settings.admin_password),
        is_active=True,
        is_superuser=True,
    )
    db.add(admin)
    await db.flush()

    admin_role = await db.scalar(select(Role).where(Role.code == RoleCode.ADMIN.value))
    doctor_role = await db.scalar(select(Role).where(Role.code == RoleCode.DOCTOR.value))
    registrar_role = await db.scalar(select(Role).where(Role.code == RoleCode.REGISTRAR.value))
    tech_role = await db.scalar(select(Role).where(Role.code == RoleCode.TECHNICIAN.value))

    for role in (admin_role, doctor_role, registrar_role, tech_role):
        if role is not None:
            db.add(UserRole(user_id=admin.id, role_id=role.id))

    await db.commit()


async def main() -> None:
    print("=== init_db: начало ===")
    print(f"  DATABASE_URL = {settings.database_url.split('@')[-1]}")  # без пароля в лог

    # 1. Создаём таблицы (для разработки; в проде — через Alembic)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print("  ✓ таблицы созданы")

    # 2. Справочники и админ
    async with async_session_maker() as db:
        await seed_roles(db)
        print("  ✓ роли")
        await seed_modalities(db)
        print("  ✓ модальности")
        await seed_cabinets(db)
        print("  ✓ кабинеты")
        await seed_admin(db)
        print(f"  ✓ администратор: {settings.admin_username!r} / {settings.admin_password!r}")

    print("=== init_db: готово ===")


if __name__ == "__main__":
    asyncio.run(main())
