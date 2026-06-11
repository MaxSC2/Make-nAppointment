"""Pytest configuration and fixtures for MedPlatform backend tests.

Запуск:
    cd backend
    pytest -v
    pytest -v tests/test_patients.py
    pytest -v -k 'test_login'
    pytest -v --cov=. --cov-report=term-missing

Использует отдельную PostgreSQL БД `pacs_ris_test` (не рабочую!).
Каждый тест начинается с чистого состояния — DDL не нужен (применили alembic).
"""

from __future__ import annotations

import os
import subprocess
import sys
import uuid
from pathlib import Path
from typing import AsyncIterator

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

# Перед импортом db.* переключаем settings на .env.test
TEST_ENV_FILE = Path(__file__).resolve().parent.parent / ".env.test"
os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://pacs:pacs_secret@localhost:5432/pacs_ris_test")
os.environ.setdefault("DATABASE_MIGRATION_URL", "postgresql+asyncpg://pacs:pacs_secret@localhost:5432/pacs_ris_test")
os.environ.setdefault("DATABASE_SYNC_URL", "postgresql+psycopg://pacs:pacs_secret@localhost:5432/pacs_ris_test")
os.environ.setdefault("JWT_SECRET", "test-secret-for-pytest-only-32-chars-minimum")
os.environ.setdefault("ORTHANC_URL", "http://localhost:8042")
os.environ.setdefault("RIS_URL", "http://localhost:8000")
os.environ.setdefault("ELQUEUE_URL", "http://localhost:8005")
os.environ.setdefault("ADMIN_USERNAME", "admin")
os.environ.setdefault("ADMIN_PASSWORD", "admin123")

# Загружаем модели
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from db import base, session as session_module  # noqa: E402
from db.config import get_settings, settings  # noqa: E402,F401
from db.models.auth import Role, RoleCode, User, UserRole  # noqa: E402
from db.models.queue import Cabinet, Patient  # noqa: E402
from db.security import create_access_token, hash_password  # noqa: E402


# ==================== EVENT LOOP ====================


@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio = __import__("asyncio").new_event_loop()
    yield loop
    loop.close()


# ==================== DB FIXTURE ====================


@pytest_asyncio.fixture
async def db_engine():
    """Engine привязанный к тестовой БД pacs_ris_test."""
    # Очищаем все таблицы перед каждым тестом
    db_url = os.environ["DATABASE_URL"]
    engine = create_async_engine(db_url, echo=False, future=True)
    yield engine
    await engine.dispose()


@pytest_asyncio.fixture
async def db_session(db_engine) -> AsyncIterator[AsyncSession]:
    """Сессия с авто-очисткой таблиц перед каждым тестом."""
    async with db_engine.begin() as conn:
        # Удаляем все данные из всех таблиц (в правильном порядке — FK)
        await conn.execute(text("TRUNCATE TABLE audit.audit_log, ris.studies, ris.protocols, ris.orders, ris.modalities, queue.ticket_events, queue.tickets, queue.patients, queue.cabinets, auth.refresh_tokens, auth.user_roles, auth.users, auth.roles RESTART IDENTITY CASCADE"))
    async with async_sessionmaker(bind=db_engine, class_=AsyncSession, expire_on_commit=False)() as session:
        yield session


# ==================== APP CLIENT ====================


@pytest_asyncio.fixture
async def client(db_engine) -> AsyncIterator[AsyncClient]:
    """Async HTTP-клиент с FastAPI приложением RIS (использует тестовую БД)."""
    # Подменяем engine в db.session, чтобы app использовал нашу БД
    test_maker = async_sessionmaker(
        bind=db_engine, class_=AsyncSession, expire_on_commit=False, autoflush=False
    )
    original_maker = session_module.async_session_maker
    session_module.async_session_maker = test_maker
    try:
        from ris.main import app
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as c:
            yield c
    finally:
        session_module.async_session_maker = original_maker


# ==================== AUTH FIXTURE ====================


@pytest_asyncio.fixture
async def seed_admin(db_session: AsyncSession):
    """Создаёт admin-юзера с полным набором ролей."""
    admin_role = Role(code=RoleCode.ADMIN.value, name="Администратор")
    doctor_role = Role(code=RoleCode.DOCTOR.value, name="Врач")
    registrar_role = Role(code=RoleCode.REGISTRAR.value, name="Регистратор")
    technician_role = Role(code=RoleCode.TECHNICIAN.value, name="Лаборант")
    db_session.add_all([admin_role, doctor_role, registrar_role, technician_role])
    await db_session.flush()

    admin = User(
        username="admin",
        email="admin@test.local",
        full_name="Test Admin",
        password_hash=hash_password("admin123"),
        is_active=True,
        is_superuser=True,
    )
    db_session.add(admin)
    await db_session.flush()

    for role in [admin_role, doctor_role, registrar_role, technician_role]:
        db_session.add(UserRole(user_id=admin.id, role_id=role.id))

    await db_session.commit()
    return admin


@pytest_asyncio.fixture
async def admin_token(seed_admin) -> str:
    token, _ = create_access_token(
        user_id=seed_admin.id,
        role_codes=[r.value for r in RoleCode],
    )
    return token


@pytest_asyncio.fixture
async def admin_auth_headers(admin_token: str) -> dict:
    return {"Authorization": f"Bearer {admin_token}"}


# ==================== DATA FIXTURES ====================


@pytest_asyncio.fixture
async def seed_patient(db_session: AsyncSession):
    patient = Patient(
        full_name="Иванов Иван Иванович",
        policy_number="TEST-001",
        birth_date=None,
        phone="+7 701 123 45 67",
    )
    db_session.add(patient)
    await db_session.commit()
    await db_session.refresh(patient)
    return patient


@pytest_asyncio.fixture
async def seed_cabinet(db_session: AsyncSession):
    cabinet = Cabinet(
        code="101",
        name="Тестовый КТ-кабинет",
        modality="CT",
        is_active=True,
    )
    db_session.add(cabinet)
    await db_session.commit()
    await db_session.refresh(cabinet)
    return cabinet


@pytest_asyncio.fixture
async def seed_modalities(db_session: AsyncSession):
    """Создаёт справочник модальностей (CT, MR, US, DX)."""
    from db.models.ris import Modality
    mods = [
        Modality(code="CT", name="Компьютерная томография"),
        Modality(code="MR", name="Магнитно-резонансная томография"),
        Modality(code="US", name="Ультразвуковое исследование"),
        Modality(code="DX", name="Рентгенография"),
    ]
    db_session.add_all(mods)
    await db_session.commit()
    return mods
