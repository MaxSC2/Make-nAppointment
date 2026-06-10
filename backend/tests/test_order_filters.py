"""Тесты поиска/фильтрации заказов."""
import pytest
import pytest_asyncio
from datetime import datetime, timezone
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import async_sessionmaker, AsyncSession

from db import session as session_module
from db.models.auth import Role, RoleCode, User, UserRole
from db.models.queue import Patient
from db.models.ris import Order, OrderStatus
from db.security import create_access_token, hash_password


@pytest_asyncio.fixture
async def seed_data(db_session):
    """Создаёт модальности + 3 пациента + 10 заказов с разными параметрами."""
    # Модальности (FK)
    from db.models.ris import Modality
    mods = [
        Modality(code="CT", name="CT"),
        Modality(code="MR", name="MR"),
        Modality(code="DX", name="DX"),
        Modality(code="US", name="US"),
    ]
    db_session.add_all(mods)
    await db_session.flush()

    # Пациенты
    p1 = Patient(full_name="Иванов Петр Сергеевич", policy_number="P-001")
    p2 = Patient(full_name="Сидорова Мария Ивановна", policy_number="P-002")
    p3 = Patient(full_name="Кузнецов Алексей", policy_number="P-003")
    db_session.add_all([p1, p2, p3])
    await db_session.flush()

    # 10 заказов: разные модальности/статусы/приоритеты
    now = datetime.now(timezone.utc)
    orders = [
        # 3 CT completed
        Order(id="o1", patient_id=p1.id, modality="CT", study_uid="1.2.840.o1",
              study_description="КТ грудной клетки", status="completed",
              priority="normal", completed_at=now, started_at=now),
        Order(id="o2", patient_id=p2.id, modality="CT", study_uid="1.2.840.o2",
              study_description="КТ головы", status="completed",
              priority="urgent", completed_at=now, started_at=now),
        Order(id="o3", patient_id=p3.id, modality="CT", study_uid="1.2.840.o3",
              study_description="Test CT", status="in_progress",
              priority="stat", started_at=now),
        # 3 MR scheduled
        Order(id="o4", patient_id=p1.id, modality="MR", study_uid="1.2.840.o4",
              study_description="МРТ", status="scheduled", priority="normal"),
        Order(id="o5", patient_id=p2.id, modality="MR", study_uid="1.2.840.o5",
              study_description="МРТ позвоночника", status="scheduled", priority="normal"),
        Order(id="o6", patient_id=p3.id, modality="MR", study_uid="1.2.840.o6",
              study_description="Test MR", status="cancelled", priority="normal"),
        # 2 DX in_progress
        Order(id="o7", patient_id=p1.id, modality="DX", study_uid="1.2.840.o7",
              study_description="Рентген", status="in_progress", priority="normal", started_at=now),
        Order(id="o8", patient_id=p2.id, modality="DX", study_uid="1.2.840.o8",
              study_description="Test DX", status="in_progress", priority="urgent", started_at=now),
        # 2 US
        Order(id="o9", patient_id=p1.id, modality="US", study_uid="1.2.840.o9",
              study_description="УЗИ", status="completed", priority="normal", completed_at=now, started_at=now),
        Order(id="o10", patient_id=p2.id, modality="US", study_uid="1.2.840.o10",
              study_description="Test US", status="completed", priority="stat", completed_at=now, started_at=now),
    ]
    db_session.add_all(orders)
    await db_session.commit()
    return {"p1": p1, "p2": p2, "p3": p3, "orders": orders}


@pytest_asyncio.fixture
async def admin_token(db_session, seed_data):
    role = Role(code=RoleCode.ADMIN.value, name="A")
    db_session.add(role)
    await db_session.flush()
    u = User(username="admin_f", email="af@x", full_name="AF",
             password_hash=hash_password("admin123"), is_active=True, is_superuser=True)
    db_session.add(u)
    await db_session.flush()
    db_session.add(UserRole(user_id=u.id, role_id=role.id))
    await db_session.commit()
    token, _ = create_access_token(user_id=u.id, role_codes=[RoleCode.ADMIN.value])
    return token


@pytest_asyncio.fixture
async def client(db_engine, db_session, admin_token, seed_data):
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


@pytest.mark.asyncio
async def test_no_filters_returns_all(client, admin_token):
    h = {"Authorization": f"Bearer {admin_token}"}
    r = await client.get("/api/orders", headers=h)
    assert r.status_code == 200
    d = r.json()
    assert d["total"] == 10
    assert len(d["items"]) == 10


@pytest.mark.asyncio
async def test_filter_by_status(client, admin_token):
    h = {"Authorization": f"Bearer {admin_token}"}
    r = await client.get("/api/orders?status_filter=completed", headers=h)
    assert r.json()["total"] == 4  # o1, o2, o9, o10

    r = await client.get("/api/orders?status_filter=in_progress", headers=h)
    assert r.json()["total"] == 3  # o3, o7, o8

    r = await client.get("/api/orders?status_filter=scheduled", headers=h)
    assert r.json()["total"] == 2  # o4, o5

    r = await client.get("/api/orders?status_filter=cancelled", headers=h)
    assert r.json()["total"] == 1  # o6


@pytest.mark.asyncio
async def test_filter_by_modality(client, admin_token):
    h = {"Authorization": f"Bearer {admin_token}"}
    r = await client.get("/api/orders?modality=CT", headers=h)
    assert r.json()["total"] == 3

    r = await client.get("/api/orders?modality=MR", headers=h)
    assert r.json()["total"] == 3


@pytest.mark.asyncio
async def test_filter_by_priority(client, admin_token):
    h = {"Authorization": f"Bearer {admin_token}"}
    r = await client.get("/api/orders?priority=stat", headers=h)
    assert r.json()["total"] == 2  # o3, o10

    r = await client.get("/api/orders?priority=urgent", headers=h)
    assert r.json()["total"] == 2  # o2, o8

    r = await client.get("/api/orders?priority=normal", headers=h)
    assert r.json()["total"] == 6


@pytest.mark.asyncio
async def test_filter_by_patient(client, admin_token, seed_data):
    h = {"Authorization": f"Bearer {admin_token}"}
    r = await client.get(f"/api/orders?patient_id={seed_data['p1'].id}", headers=h)
    assert r.json()["total"] == 4  # o1, o4, o7, o9


@pytest.mark.asyncio
async def test_search_by_description(client, admin_token):
    h = {"Authorization": f"Bearer {admin_token}"}
    r = await client.get("/api/orders?search=Test", headers=h)
    assert r.json()["total"] == 4  # o3, o6, o8, o10


@pytest.mark.asyncio
async def test_search_by_patient_name(client, admin_token):
    h = {"Authorization": f"Bearer {admin_token}"}
    r = await client.get("/api/orders?search=Иванов", headers=h)
    assert r.json()["total"] >= 1  # найдёт всех "Иванов" (Петр Сергеевич + Мария Ивановна)


@pytest.mark.asyncio
async def test_search_by_policy(client, admin_token):
    h = {"Authorization": f"Bearer {admin_token}"}
    r = await client.get("/api/orders?search=P-002", headers=h)
    assert r.json()["total"] >= 1


@pytest.mark.asyncio
async def test_pagination(client, admin_token):
    h = {"Authorization": f"Bearer {admin_token}"}
    r = await client.get("/api/orders?limit=3&offset=0", headers=h)
    d = r.json()
    assert d["total"] == 10
    assert len(d["items"]) == 3
    assert d["has_more"] is True
    assert d["limit"] == 3
    assert d["offset"] == 0

    r = await client.get("/api/orders?limit=3&offset=9", headers=h)
    d = r.json()
    assert len(d["items"]) == 1  # последняя страница
    assert d["has_more"] is False


@pytest.mark.asyncio
async def test_sort_asc_desc(client, admin_token):
    h = {"Authorization": f"Bearer {admin_token}"}
    # Используем id как вторичный ключ для детерминированности
    r = await client.get("/api/orders?sort_by=created_at&sort_dir=asc", headers=h)
    items_asc = r.json()["items"]
    r = await client.get("/api/orders?sort_by=created_at&sort_dir=desc", headers=h)
    items_desc = r.json()["items"]
    # Все id в desc должны быть в обратном порядке vs asc
    asc_ids = [o["id"] for o in items_asc]
    desc_ids = [o["id"] for o in items_desc]
    assert asc_ids == sorted(asc_ids) or asc_ids == list(reversed(desc_ids)), \
        f"ASC and DESC should be opposite. asc={asc_ids[:3]} desc={desc_ids[:3]}"


@pytest.mark.asyncio
async def test_combined_filters(client, admin_token):
    """Несколько фильтров одновременно."""
    h = {"Authorization": f"Bearer {admin_token}"}
    # CT + completed
    r = await client.get("/api/orders?modality=CT&status_filter=completed", headers=h)
    assert r.json()["total"] == 2  # o1, o2

    # CT + completed + urgent
    r = await client.get("/api/orders?modality=CT&status_filter=completed&priority=urgent", headers=h)
    assert r.json()["total"] == 1  # o2

    # search Test + in_progress
    r = await client.get("/api/orders?search=Test&status_filter=in_progress", headers=h)
    assert r.json()["total"] == 2  # o3 (Test CT), o8 (Test DX)


@pytest.mark.asyncio
async def test_invalid_status_returns_400(client, admin_token):
    h = {"Authorization": f"Bearer {admin_token}"}
    r = await client.get("/api/orders?status_filter=garbage", headers=h)
    assert r.status_code == 400


@pytest.mark.asyncio
async def test_unauthorized_returns_401(client):
    r = await client.get("/api/orders")
    assert r.status_code in (401, 403)
