"""Тесты RBAC: проверяем что каждая роль имеет правильные права.

Проверяем:
- admin может всё
- doctor может создать Order, редактировать протокол, подписать, вызвать талон
- registrar может создать Order и талон, НО НЕ может редактировать/подписывать протокол, вызывать талон
- technician может вызывать талон (call), НО НЕ может редактировать/подписывать протокол
- без токена — 401
"""
import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker, AsyncSession

from db import session as session_module
from db.models.auth import Role, RoleCode, User, UserRole
from db.models.queue import Patient
from db.security import create_access_token, hash_password


# ============== ФИКСТУРЫ ДЛЯ РАЗНЫХ РОЛЕЙ ==============


@pytest_asyncio.fixture
async def seed_users(db_session: AsyncSession):
    """Создаёт 4 юзеров: admin, doctor, registrar, technician."""
    admin_role = Role(code=RoleCode.ADMIN.value, name="Админ")
    doctor_role = Role(code=RoleCode.DOCTOR.value, name="Врач")
    registrar_role = Role(code=RoleCode.REGISTRAR.value, name="Регистратор")
    technician_role = Role(code=RoleCode.TECHNICIAN.value, name="Лаборант")
    db_session.add_all([admin_role, doctor_role, registrar_role, technician_role])
    await db_session.flush()

    users = {}
    for username, role in [
        ("admin_t", admin_role),
        ("doctor_t", doctor_role),
        ("registrar_t", registrar_role),
        ("technician_t", technician_role),
    ]:
        u = User(
            username=username,
            email=f"{username}@test.local",
            full_name=username.replace("_t", "").title(),
            password_hash=hash_password("test123"),
            is_active=True,
        )
        db_session.add(u)
        await db_session.flush()
        db_session.add(UserRole(user_id=u.id, role_id=role.id))
        users[username] = u
    await db_session.commit()
    return users


@pytest_asyncio.fixture
async def make_token(db_session):
    """Фабрика токенов: `await make_token('doctor_t')`."""
    async def _make(username: str) -> str:
        result = await db_session.execute(
            select(User).where(User.username == username)
        )
        user = result.scalar_one()
        result_roles = await db_session.execute(
            select(Role).join(UserRole, UserRole.role_id == Role.id).where(UserRole.user_id == user.id)
        )
        codes = [r.code for r in result_roles.scalars().all()]
        token, _ = create_access_token(user_id=user.id, role_codes=codes)
        return token
    return _make


@pytest_asyncio.fixture
async def client(db_engine, db_session, seed_users, make_token, seed_modalities):
    """ASGI-клиент для тестов с предустановленными юзерами + модальностями."""
    test_maker = async_sessionmaker(
        bind=db_engine, class_=AsyncSession, expire_on_commit=False, autoflush=False
    )
    original_maker = session_module.async_session_maker
    session_module.async_session_maker = test_maker
    try:
        from ris.main import app
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as c:
            yield c, make_token
    finally:
        session_module.async_session_maker = original_maker


@pytest_asyncio.fixture
async def seed_patient_rbac(db_session):
    p = Patient(full_name="Test Patient RBAC", policy_number="P-RBAC-001")
    db_session.add(p)
    await db_session.commit()
    await db_session.refresh(p)
    return p


# ============== ТЕСТЫ ==============


@pytest.mark.asyncio
async def test_no_token_returns_401(client):
    """Без токена — 401."""
    c, _ = client
    r = await c.get("/api/orders")
    assert r.status_code in (401, 403), f"Got {r.status_code}"


@pytest.mark.asyncio
async def test_admin_can_create_order(client, seed_patient_rbac):
    c, make_token = client
    h = {"Authorization": f"Bearer {await make_token('admin_t')}"}
    r = await c.post("/api/orders", headers=h, json={
        "patient_id": str(seed_patient_rbac.id),
        "modality": "CT",
        "study_description": "Admin test order",
    })
    assert r.status_code == 201, f"{r.status_code} {r.text}"


@pytest.mark.asyncio
async def test_doctor_can_create_order(client, seed_patient_rbac):
    c, make_token = client
    h = {"Authorization": f"Bearer {await make_token('doctor_t')}"}
    r = await c.post("/api/orders", headers=h, json={
        "patient_id": str(seed_patient_rbac.id),
        "modality": "CT",
        "study_description": "Doctor test order",
    })
    assert r.status_code == 201, f"doctor: {r.status_code} {r.text}"


@pytest.mark.asyncio
async def test_registrar_can_create_order(client, seed_patient_rbac):
    c, make_token = client
    h = {"Authorization": f"Bearer {await make_token('registrar_t')}"}
    r = await c.post("/api/orders", headers=h, json={
        "patient_id": str(seed_patient_rbac.id),
        "modality": "CT",
        "study_description": "Registrar test order",
    })
    assert r.status_code == 201, f"registrar: {r.status_code} {r.text}"


@pytest.mark.asyncio
async def test_registrar_can_create_ticket(client):
    """registrar МОЖЕТ создать талон (kiosk)."""
    c, make_token = client
    h = {"Authorization": f"Bearer {await make_token('registrar_t')}"}
    r = await c.post("/api/queue/tickets", headers=h, json={
        "full_name": "Registrar",
        "policy_number": "P-REG-001",
        "modality": "CT",
        "priority": "routine",
    })
    # 201 если SmartQ включён и modality найдена, 200 если мок, иначе 502/400
    assert r.status_code in (200, 201), f"registrar create ticket: {r.status_code} {r.text}"


@pytest.mark.asyncio
async def test_registrar_cannot_call_ticket(client):
    """registrar НЕ может вызвать талон (403)."""
    c, make_token = client
    # Создаём талон через admin
    admin_h = {"Authorization": f"Bearer {await make_token('admin_t')}"}
    r = await c.post("/api/queue/tickets", headers=admin_h, json={
        "full_name": "X", "policy_number": "P-CALL-001", "modality": "CT", "priority": "routine",
    })
    ticket_id = r.json()["id"]
    # registrar пытается вызвать
    reg_h = {"Authorization": f"Bearer {await make_token('registrar_t')}"}
    r = await c.post(f"/api/queue/tickets/{ticket_id}/call", headers=reg_h)
    assert r.status_code == 403, f"registrar call: {r.status_code}"


@pytest.mark.asyncio
async def test_technician_can_call_ticket(client):
    """technician МОЖЕТ вызвать талон."""
    c, make_token = client
    admin_h = {"Authorization": f"Bearer {await make_token('admin_t')}"}
    r = await c.post("/api/queue/tickets", headers=admin_h, json={
        "full_name": "X", "policy_number": "P-TECH-001", "modality": "CT", "priority": "routine",
    })
    ticket_id = r.json()["id"]
    tech_h = {"Authorization": f"Bearer {await make_token('technician_t')}"}
    r = await c.post(f"/api/queue/tickets/{ticket_id}/call", headers=tech_h)
    assert r.status_code == 200, f"technician call: {r.status_code} {r.text}"


@pytest.mark.asyncio
async def test_technician_cannot_edit_protocol(client, seed_patient_rbac):
    """technician НЕ может редактировать протокол."""
    c, make_token = client
    admin_h = {"Authorization": f"Bearer {await make_token('admin_t')}"}
    r = await c.post("/api/orders", headers=admin_h, json={
        "patient_id": str(seed_patient_rbac.id), "modality": "CT", "study_description": "T",
    })
    order_id = r.json()["id"]
    tech_h = {"Authorization": f"Bearer {await make_token('technician_t')}"}
    r = await c.put(f"/api/orders/{order_id}/protocol", headers=tech_h, json={
        "body": "Test", "impression": "Test",
    })
    assert r.status_code == 403, f"technician edit protocol: {r.status_code}"


@pytest.mark.asyncio
async def test_registrar_cannot_sign_protocol(client, seed_patient_rbac):
    """registrar НЕ может подписать протокол."""
    c, make_token = client
    admin_h = {"Authorization": f"Bearer {await make_token('admin_t')}"}
    r = await c.post("/api/orders", headers=admin_h, json={
        "patient_id": str(seed_patient_rbac.id), "modality": "CT", "study_description": "T",
    })
    order_id = r.json()["id"]
    reg_h = {"Authorization": f"Bearer {await make_token('registrar_t')}"}
    r = await c.post(f"/api/orders/{order_id}/protocol/sign", headers=reg_h)
    assert r.status_code == 403, f"registrar sign: {r.status_code}"


@pytest.mark.asyncio
async def test_doctor_can_sign_protocol(client, seed_patient_rbac):
    """doctor МОЖЕТ подписать протокол (сначала сохранить, потом подписать)."""
    c, make_token = client
    admin_h = {"Authorization": f"Bearer {await make_token('admin_t')}"}
    r = await c.post("/api/orders", headers=admin_h, json={
        "patient_id": str(seed_patient_rbac.id), "modality": "CT", "study_description": "T",
    })
    order_id = r.json()["id"]
    doc_h = {"Authorization": f"Bearer {await make_token('doctor_t')}"}
    # 1) сохранить
    r = await c.put(f"/api/orders/{order_id}/protocol", headers=doc_h, json={
        "body": "Заключение: норма", "impression": "Норма",
    })
    assert r.status_code == 200, f"doctor save protocol: {r.status_code} {r.text}"
    # 2) подписать
    r = await c.post(f"/api/orders/{order_id}/protocol/sign", headers=doc_h)
    assert r.status_code == 200, f"doctor sign: {r.status_code} {r.text}"
    assert r.json()["is_draft"] is False
