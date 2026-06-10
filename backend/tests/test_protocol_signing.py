"""Тесты подписания протокола + защита от редактирования.

Сценарии:
1. Создать протокол (draft)
2. Сохранить текст
3. Подписать — is_draft=False, signed_at != null
4. Попытаться редактировать → 409
5. Попытаться подписать ещё раз → 409
6. Admin может отозвать подпись (DELETE /sign) → снова draft
7. После отзыва — можно редактировать
8. Нельзя подписать пустой протокол
9. Нельзя подписать несуществующий протокол
10. RBAC: doctor может, registrar/technician не могут
11. Аудит: записи о подписании/отзыве
"""
import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker, AsyncSession

from db import session as session_module
from db.models.auth import Role, RoleCode, User, UserRole
from db.models.audit import AuditAction, AuditLog
from db.models.queue import Patient
from db.models.ris import Modality, Order, OrderStatus, Protocol
from db.security import create_access_token, hash_password


@pytest_asyncio.fixture
async def seed_full(db_session):
    """Создаёт 4 роли + 4 юзера + модальность + пациент + order + пустой протокол."""
    # 4 роли
    roles = {
        RoleCode.ADMIN.value: Role(code=RoleCode.ADMIN.value, name="A"),
        RoleCode.DOCTOR.value: Role(code=RoleCode.DOCTOR.value, name="D"),
        RoleCode.REGISTRAR.value: Role(code=RoleCode.REGISTRAR.value, name="R"),
        RoleCode.TECHNICIAN.value: Role(code=RoleCode.TECHNICIAN.value, name="T"),
    }
    db_session.add_all(roles.values())
    await db_session.flush()

    # 4 юзера
    users = {}
    for username, role_code in [
        ("admin_p", RoleCode.ADMIN.value),
        ("doctor_p", RoleCode.DOCTOR.value),
        ("registrar_p", RoleCode.REGISTRAR.value),
        ("technician_p", RoleCode.TECHNICIAN.value),
    ]:
        u = User(
            username=username, email=f"{username}@x", full_name=username,
            password_hash=hash_password("p123"), is_active=True,
            is_superuser=(role_code == RoleCode.ADMIN.value),
        )
        db_session.add(u)
        await db_session.flush()
        db_session.add(UserRole(user_id=u.id, role_id=roles[role_code].id))
        users[username] = u
    await db_session.commit()

    # Модальность + пациент + order
    db_session.add(Modality(code="CT", name="CT"))
    await db_session.flush()
    p = Patient(full_name="Test Patient", policy_number="P-SIGN-001")
    db_session.add(p)
    await db_session.flush()
    o = Order(
        id="osign1", patient_id=p.id, modality="CT", study_uid="1.2.840.osign1",
        study_description="Sign test", status=OrderStatus.SCHEDULED.value,
    )
    db_session.add(o)
    await db_session.flush()
    proto = Protocol(order_id=o.id, body="", is_draft=True)
    db_session.add(proto)
    await db_session.commit()
    return {"users": users, "patient": p, "order": o, "protocol": proto}


@pytest_asyncio.fixture
async def make_token(db_session):
    async def _make(username: str) -> str:
        result = await db_session.execute(
            select(User).where(User.username == username)
        )
        u = result.scalar_one()
        result_roles = await db_session.execute(
            select(Role).join(UserRole, UserRole.role_id == Role.id).where(UserRole.user_id == u.id)
        )
        codes = [r.code for r in result_roles.scalars().all()]
        token, _ = create_access_token(user_id=u.id, role_codes=codes)
        return token
    return _make


@pytest_asyncio.fixture
async def client(db_engine, db_session, seed_full, make_token):
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


# ============ ТЕСТЫ ============


@pytest.mark.asyncio
async def test_save_protocol_as_doctor(client, seed_full, make_token):
    c, mk = client
    h = {"Authorization": f"Bearer {await mk('doctor_p')}"}
    r = await c.put("/api/orders/osign1/protocol", headers=h, json={
        "body": "Заключение: норма", "impression": "Норма",
    })
    assert r.status_code == 200, r.text
    assert r.json()["body"] == "Заключение: норма"
    assert r.json()["is_draft"] is True
    assert r.json()["signed_at"] is None


@pytest.mark.asyncio
async def test_sign_protocol_sets_signed_at_and_completes_order(client, seed_full, make_token):
    c, mk = client
    doc_h = {"Authorization": f"Bearer {await mk('doctor_p')}"}
    # 1) save
    await c.put("/api/orders/osign1/protocol", headers=doc_h, json={"body": "Test", "impression": ""})
    # 2) sign
    r = await c.post("/api/orders/osign1/protocol/sign", headers=doc_h)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["is_draft"] is False
    assert data["signed_at"] is not None
    assert data["signed_by"] is not None
    # Order должен быть completed
    r = await c.get("/api/orders/osign1", headers=doc_h)
    assert r.json()["status"] == "completed"


@pytest.mark.asyncio
async def test_cannot_sign_empty_protocol(client, seed_full, make_token):
    c, mk = client
    h = {"Authorization": f"Bearer {await mk('doctor_p')}"}
    # Не сохраняем текст, пытаемся подписать пустой
    r = await c.post("/api/orders/osign1/protocol/sign", headers=h)
    assert r.status_code == 400, r.text
    assert "empty" in r.text.lower()


@pytest.mark.asyncio
async def test_cannot_sign_already_signed(client, seed_full, make_token):
    c, mk = client
    h = {"Authorization": f"Bearer {await mk('doctor_p')}"}
    # save + sign
    await c.put("/api/orders/osign1/protocol", headers=h, json={"body": "Test", "impression": ""})
    r1 = await c.post("/api/orders/osign1/protocol/sign", headers=h)
    assert r1.status_code == 200
    # повторный sign → 409
    r2 = await c.post("/api/orders/osign1/protocol/sign", headers=h)
    assert r2.status_code == 409, f"Expected 409, got {r2.status_code}"


@pytest.mark.asyncio
async def test_cannot_edit_signed_protocol(client, seed_full, make_token):
    c, mk = client
    h = {"Authorization": f"Bearer {await mk('doctor_p')}"}
    # save + sign
    await c.put("/api/orders/osign1/protocol", headers=h, json={"body": "Original", "impression": ""})
    await c.post("/api/orders/osign1/protocol/sign", headers=h)
    # Попытка редактировать
    r = await c.put("/api/orders/osign1/protocol", headers=h, json={"body": "Modified", "impression": ""})
    assert r.status_code == 409, f"Expected 409, got {r.status_code}: {r.text}"
    assert "signed" in r.text.lower()


@pytest.mark.asyncio
async def test_admin_can_revoke_signature(client, seed_full, make_token):
    c, mk = client
    doc_h = {"Authorization": f"Bearer {await mk('doctor_p')}"}
    admin_h = {"Authorization": f"Bearer {await mk('admin_p')}"}
    # save + sign
    await c.put("/api/orders/osign1/protocol", headers=doc_h, json={"body": "Test", "impression": ""})
    await c.post("/api/orders/osign1/protocol/sign", headers=doc_h)
    # admin отзывает
    r = await c.delete("/api/orders/osign1/protocol/sign", headers=admin_h)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["is_draft"] is True
    assert data["signed_at"] is None
    assert data["signed_by"] is None


@pytest.mark.asyncio
async def test_doctor_cannot_revoke_signature(client, seed_full, make_token):
    c, mk = client
    doc_h = {"Authorization": f"Bearer {await mk('doctor_p')}"}
    # save + sign
    await c.put("/api/orders/osign1/protocol", headers=doc_h, json={"body": "Test", "impression": ""})
    await c.post("/api/orders/osign1/protocol/sign", headers=doc_h)
    # doctor пытается отозвать → 403
    r = await c.delete("/api/orders/osign1/protocol/sign", headers=doc_h)
    assert r.status_code == 403, f"Expected 403, got {r.status_code}"


@pytest.mark.asyncio
async def test_revoke_unauthorized_when_draft(client, seed_full, make_token):
    c, mk = client
    admin_h = {"Authorization": f"Bearer {await mk('admin_p')}"}
    # Не подписан → отзыв = 409
    r = await c.delete("/api/orders/osign1/protocol/sign", headers=admin_h)
    assert r.status_code == 409


@pytest.mark.asyncio
async def test_after_revoke_can_edit(client, seed_full, make_token):
    c, mk = client
    doc_h = {"Authorization": f"Bearer {await mk('doctor_p')}"}
    admin_h = {"Authorization": f"Bearer {await mk('admin_p')}"}
    # save + sign
    await c.put("/api/orders/osign1/protocol", headers=doc_h, json={"body": "Original", "impression": ""})
    await c.post("/api/orders/osign1/protocol/sign", headers=doc_h)
    # revoke
    await c.delete("/api/orders/osign1/protocol/sign", headers=admin_h)
    # Теперь можно редактировать
    r = await c.put("/api/orders/osign1/protocol", headers=doc_h, json={"body": "Modified after revoke", "impression": ""})
    assert r.status_code == 200, r.text
    assert r.json()["body"] == "Modified after revoke"
    assert r.json()["is_draft"] is True  # снова draft


@pytest.mark.asyncio
async def test_sign_creates_audit_log(client, seed_full, make_token, db_session):
    c, mk = client
    h = {"Authorization": f"Bearer {await mk('doctor_p')}"}
    await c.put("/api/orders/osign1/protocol", headers=h, json={"body": "Test", "impression": ""})
    await c.post("/api/orders/osign1/protocol/sign", headers=h)
    # Проверяем audit log
    from db.models.auth import User as U
    result = await db_session.execute(
        select(AuditLog).where(AuditLog.action == AuditAction.PROTOCOL_SIGNED.value)
    )
    log = result.scalar_one()
    assert log.resource_type == "protocol"
    assert log.user_id is not None


@pytest.mark.asyncio
async def test_revoke_creates_audit_log(client, seed_full, make_token, db_session):
    c, mk = client
    doc_h = {"Authorization": f"Bearer {await mk('doctor_p')}"}
    admin_h = {"Authorization": f"Bearer {await mk('admin_p')}"}
    await c.put("/api/orders/osign1/protocol", headers=doc_h, json={"body": "Test", "impression": ""})
    await c.post("/api/orders/osign1/protocol/sign", headers=doc_h)
    await c.delete("/api/orders/osign1/protocol/sign", headers=admin_h)
    result = await db_session.execute(
        select(AuditLog).where(AuditLog.action == AuditAction.PROTOCOL_REVOKED.value)
    )
    log = result.scalar_one()
    assert log.resource_type == "protocol"
    assert "revoked_from_user" in (log.extra or {})


@pytest.mark.asyncio
async def test_registrar_cannot_sign(client, seed_full, make_token):
    c, mk = client
    h = {"Authorization": f"Bearer {await mk('registrar_p')}"}
    # Сначала admin сохраняет
    admin_h = {"Authorization": f"Bearer {await mk('admin_p')}"}
    await c.put("/api/orders/osign1/protocol", headers=admin_h, json={"body": "Test", "impression": ""})
    # registrar пытается подписать → 403
    r = await c.post("/api/orders/osign1/protocol/sign", headers=h)
    assert r.status_code == 403


@pytest.mark.asyncio
async def test_technician_cannot_sign(client, seed_full, make_token):
    c, mk = client
    h = {"Authorization": f"Bearer {await mk('technician_p')}"}
    admin_h = {"Authorization": f"Bearer {await mk('admin_p')}"}
    await c.put("/api/orders/osign1/protocol", headers=admin_h, json={"body": "Test", "impression": ""})
    r = await c.post("/api/orders/osign1/protocol/sign", headers=h)
    assert r.status_code == 403
