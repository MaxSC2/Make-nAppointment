"""SmartQ Integration Router — обёртка для нашего фронта.

Наш единственный фронт (MedPlatform, Vite :5173) вызывает ЭТИ эндпоинты
(на нашем РИС, :8000). Наш РИС в свою очередь:
1. Если SMARTQ_ENABLED=True — ходит в SmartQ (NikNebog/smartq-back, :3000)
2. Если SMARTQ_ENABLED=False — отдаёт мок-данные (имитация для разработки)

Эндпоинты:
- GET  /api/queue/cabinets               → список кабинетов SmartQ
- GET  /api/queue/service-types         → типы услуг (CT, MR, DX)
- GET  /api/queue/tickets               → список талонов (с фильтром)
- GET  /api/queue/tickets/{id}          → детали талона
- POST /api/queue/tickets               → создать талон (kiosk)
- POST /api/queue/tickets/{id}/call      → вызвать пациента (вызывает наш РИС)
- POST /api/queue/tickets/{id}/complete  → завершить приём (обновляет наш РИС)
- GET  /api/queue/room/{room_id}/next   → следующий в очереди

Маппинг SmartQ → наш формат TicketOut:
- SmartQ: id, number ("A001"), status, priority, serviceTypeId, roomId, createdAt
- Наш:   id, ticket_number, status, priority, modality, cabinet_id, created_at

Важно: наш РИС скрывает SmartQ от фронта — фронт знает только TicketOut.
"""

from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from db.config import settings
from db.dependencies import get_current_user, get_db, require_role
from db.models.auth import RoleCode, User
from db.models.queue import Patient
from db.models.ris import Modality, Order, OrderStatus

logger = logging.getLogger("queue_integration")

from ris.services import smartq_client


router = APIRouter(prefix="/api/queue", tags=["SmartQ Integration (очередь)"])


# ======================== МАППИНГ ========================

_STATUS_MAP = {
    "created": "waiting",
    "waiting": "waiting",
    "called": "in_progress",
    "in_service": "in_progress",
    "completed": "done",
    "cancelled": "cancelled",
    "no_show": "cancelled",
    "redirected": "cancelled",
}

_REVERSE_STATUS_MAP = {
    "waiting": "waiting",
    "in_progress": "called",
    "done": "completed",
    "completed": "completed",
    "cancelled": "cancelled",
}

_PRIORITY_MAP = {1: "stat", 2: "stat", 3: "urgent", 4: "routine", 5: "routine"}
_REVERSE_PRIORITY_MAP = {"stat": 1, "urgent": 3, "routine": 5}


def _map_priority(smartq_priority: int) -> str:
    """Маппинг 1-5 (SmartQ) → routine/urgent/stat (наш Order.priority)."""
    return _PRIORITY_MAP.get(smartq_priority, "routine")


def _map_status_to_ours(smartq_status: str) -> str:
    """SmartQ status → наш TicketOut.status."""
    return _STATUS_MAP.get(smartq_status, "waiting")


# ======================== SCHEMAS ========================


class TicketOut(BaseModel):
    """Наш формат талона (скрывает SmartQ от фронта)."""
    id: str = Field(..., description="UUID талона (из SmartQ)")
    ticket_number: str = Field(..., description="Человекочитаемый номер (A001)")
    status: str = Field(..., description="waiting | in_progress | done | cancelled")
    priority: str = Field(..., description="routine | urgent | stat")
    modality: str = Field(default="", description="CT, MR, DX, US")
    cabinet_id: int = Field(default=0)
    cabinet_name: str = Field(default="")
    full_name: str = Field(default="", description="ФИО пациента")
    policy_number: str = Field(default="")
    created_at: str = Field(default="")
    called_at: str | None = Field(default=None)
    completed_at: str | None = Field(default=None)


class RoomOut(BaseModel):
    """Кабинет (комната в SmartQ)."""
    id: int
    name: str
    is_active: bool = True
    modality: str = Field(default="")


class ServiceTypeOut(BaseModel):
    """Тип услуги (КТ, МРТ и т.д.)."""
    id: int
    name: str
    modality_code: str = Field(default="")
    average_duration_minutes: int = Field(default=30)


class CreateTicketRequest(BaseModel):
    """Запрос на создание талона (от нашего фронта к нашему РИС)."""
    full_name: str = Field(..., min_length=1, max_length=255)
    policy_number: str = Field(..., min_length=1, max_length=64)
    modality: str = Field(..., description="CT, MR, DX, US")
    priority: str = Field(default="routine", description="routine | urgent | stat")
    cabinet_id: int | None = Field(default=None)


class CallResponse(BaseModel):
    """Результат вызова талона: SmartQ-вызов + наш Order."""
    ticket_id: str
    ticket_number: str
    status: str
    order_id: str | None = Field(default=None, description="ID созданного Order в нашей БД")
    called_at: str | None = None


# ======================== МАППЕРЫ ========================


async def _smartq_ticket_to_ours(smartq_t: dict, services_cache: dict | None = None) -> TicketOut:
    """Маппинг SmartQ ticket → наш TicketOut.

    SmartQ возвращает:
    - serviceType: {id, name, averageDurationMinutes, ...} (вложенный объект)
    - room: {id, name, ...} (вложенный объект)
    - priority: 1..N (int)
    - status: "waiting"|"called"|"in_service"|"completed"|...

    Старая структура (serviceTypeId как строка) тоже поддерживается для обратной совместимости.
    """
    # serviceType: вложенный объект или id (fallback)
    service_type = smartq_t.get("serviceType")
    if isinstance(service_type, dict):
        modality_name = service_type.get("name", "")
    else:
        # fallback на старую структуру (id) — берём из кэша
        service_type_id = smartq_t.get("serviceTypeId")
        modality_name = ""
        if service_type_id and services_cache and service_type_id in services_cache:
            modality_name = services_cache[service_type_id]

    # room: вложенный объект или id
    room = smartq_t.get("room")
    if isinstance(room, dict):
        cabinet_id = room.get("id", 0) or 0
        cabinet_name = room.get("name", "")
    else:
        cabinet_id = smartq_t.get("roomId", 0) or 0
        cabinet_name = ""

    return TicketOut(
        id=str(smartq_t.get("id", "")),
        ticket_number=smartq_t.get("number", ""),
        status=_map_status_to_ours(smartq_t.get("status", "waiting")),
        priority=_map_priority(smartq_t.get("priority", 3)),
        modality=modality_name,
        cabinet_id=cabinet_id,
        cabinet_name=cabinet_name,
        full_name=smartq_t.get("fullName", "") or smartq_t.get("patientName", ""),
        policy_number=smartq_t.get("policyNumber", ""),
        created_at=smartq_t.get("createdAt", ""),
        called_at=smartq_t.get("calledAt"),
        completed_at=smartq_t.get("completedAt"),
    )


# ======================== FALLBACK (если SmartQ недоступен) ========================


_MOCK_ROOMS = [
    {"id": 1, "name": "Кабинет КТ", "isActive": True},
    {"id": 2, "name": "Кабинет МРТ", "isActive": True},
    {"id": 3, "name": "Кабинет Рентген", "isActive": True},
]

_MOCK_SERVICES = [
    {"id": 1, "name": "КТ грудной клетки", "averageDurationMinutes": 30},
    {"id": 2, "name": "МРТ головного мозга", "averageDurationMinutes": 45},
    {"id": 3, "name": "Рентгенография", "averageDurationMinutes": 10},
]

_MOCK_TICKETS = [
    {"id": "00000000-0000-0000-0000-000000000001", "number": "M001", "status": "waiting",
     "priority": 3, "roomId": 1, "fullName": "Mock Patient 1", "policyNumber": "P-001",
     "serviceTypeId": 1, "createdAt": "2026-06-09T10:00:00Z"},
    {"id": "00000000-0000-0000-0000-000000000002", "number": "M002", "status": "waiting",
     "priority": 3, "roomId": 2, "fullName": "Mock Patient 2", "policyNumber": "P-002",
     "serviceTypeId": 2, "createdAt": "2026-06-09T10:30:00Z"},
]

# Внутренний стейт мока (изменяется при call/complete — имитирует SmartQ state machine)
_MOCK_TICKET_STATE: dict[str, str] = {
    t["id"]: t["status"] for t in _MOCK_TICKETS
}


async def _safe_smartq_call(method_name: str, *args, **kwargs):
    """Безопасный вызов SmartQ: если ошибка или disabled — возвращаем мок-данные."""
    if not settings.smartq_enabled:
        return _MOCK_RESPONSE.get(method_name, lambda: [])()

    try:
        method = getattr(smartq_client.smartq_client, method_name)
        return await method(*args, **kwargs)
    except smartq_client.SmartQError as e:
        logger.warning("SmartQ %s failed: %s — falling back to mock", method_name, e.message)
        return _MOCK_RESPONSE.get(method_name, lambda: [])()


_MOCK_RESPONSE = {
    "get_rooms": lambda: _MOCK_ROOMS,
    "get_service_types": lambda: _MOCK_SERVICES,
    "get_tickets": lambda: _MOCK_TICKETS,
    "get_ticket": lambda ticket_id=None: _find_mock_ticket(ticket_id or _MOCK_TICKETS[0]["id"]),
    "call_ticket": lambda ticket_id=None: _mock_call(ticket_id or _MOCK_TICKETS[0]["id"]),
    "start_ticket": lambda ticket_id=None: _mock_start(ticket_id or _MOCK_TICKETS[0]["id"]),
    "complete_ticket": lambda ticket_id=None: _mock_complete(ticket_id or _MOCK_TICKETS[0]["id"]),
    "get_next_ticket": lambda room_id=None: _find_mock_ticket(_MOCK_TICKETS[0]["id"]),
    "create_ticket": lambda **kwargs: {
        "id": str(uuid.uuid4()),
        "number": "M999",
        "status": "waiting",
        "priority": 3,
        "roomId": 1,
        "fullName": kwargs.get("full_name", "Mock New Patient"),
        "policyNumber": kwargs.get("policy_number", "P-NEW"),
        "serviceTypeId": kwargs.get("service_type_id", 1),
        "createdAt": datetime.now(timezone.utc).isoformat(),
    },
}


def _find_mock_ticket(ticket_id: str) -> dict:
    ticket = next((t for t in _MOCK_TICKETS if t["id"] == ticket_id), None)
    if not ticket:
        return _MOCK_TICKETS[0].copy()
    result = ticket.copy()
    result["status"] = _MOCK_TICKET_STATE.get(ticket_id, "waiting")
    return result


def _mock_call(ticket_id: str) -> dict:
    _MOCK_TICKET_STATE[ticket_id] = "called"
    return {
        "id": ticket_id,
        "number": next((t["number"] for t in _MOCK_TICKETS if t["id"] == ticket_id), "M001"),
        "status": "called",
        "calledAt": datetime.now(timezone.utc).isoformat(),
    }


def _mock_start(ticket_id: str) -> dict:
    _MOCK_TICKET_STATE[ticket_id] = "in_service"
    return {
        "id": ticket_id,
        "number": next((t["number"] for t in _MOCK_TICKETS if t["id"] == ticket_id), "M001"),
        "status": "in_service",
    }


def _mock_complete(ticket_id: str) -> dict:
    _MOCK_TICKET_STATE[ticket_id] = "completed"
    return {
        "id": ticket_id,
        "number": next((t["number"] for t in _MOCK_TICKETS if t["id"] == ticket_id), "M001"),
        "status": "completed",
        "completedAt": datetime.now(timezone.utc).isoformat(),
    }


# ======================== ENDPOINTS ========================


@router.get("/cabinets", response_model=list[RoomOut], summary="Список кабинетов (из SmartQ)")
async def get_cabinets(
    user: User = Depends(get_current_user),
) -> list[RoomOut]:
    """GET /api/queue/cabinets — кабинеты для нашего фронта.

    В SmartQ это GET /rooms. Маппим isActive → is_active, добавляем modality.
    """
    rooms = await _safe_smartq_call("get_rooms")

    result = []
    for r in rooms:
        # Маппим по названию: "Кабинет КТ" → "CT"
        name = r.get("name", "")
        modality = ""
        if "КТ" in name or "CT" in name:
            modality = "CT"
        elif "МРТ" in name or "MR" in name:
            modality = "MR"
        elif "Рентген" in name or "DX" in name:
            modality = "DX"
        elif "УЗИ" in name or "US" in name:
            modality = "US"
        elif "Ангиографи" in name or "XA" in name:
            modality = "XA"
        result.append(RoomOut(
            id=r.get("id", 0),
            name=name,
            is_active=r.get("isActive", True),
            modality=modality,
        ))
    return result


@router.get("/service-types", response_model=list[ServiceTypeOut], summary="Типы услуг (из SmartQ)")
async def get_service_types(
    user: User = Depends(get_current_user),
) -> list[ServiceTypeOut]:
    """GET /api/queue/service-types — типы услуг для нашего фронта.

    В SmartQ: GET /service-types. Маппим averageDurationMinutes + name → modality_code.
    """
    services = await _safe_smartq_call("get_service_types")
    result = []
    for s in services:
        name = s.get("name", "").lower()
        if "кт" in name or "ct" in name:
            modality = "CT"
        elif "мрт" in name or "mr" in name:
            modality = "MR"
        elif "рентген" in name:
            modality = "DX"
        elif "уз" in name or "us" in name:
            modality = "US"
        elif "ангио" in name or "xa" in name:
            modality = "XA"
        else:
            modality = ""
        result.append(ServiceTypeOut(
            id=s.get("id", 0),
            name=s.get("name", ""),
            modality_code=modality,
            average_duration_minutes=s.get("averageDurationMinutes", 30),
        ))
    return result


@router.get("/tickets", response_model=list[TicketOut], summary="Список талонов (из SmartQ)")
async def list_tickets(
    status: str | None = Query(default=None, description="waiting | in_progress | done | cancelled"),
    cabinet_id: int | None = Query(default=None),
    user: User = Depends(get_current_user),
) -> list[TicketOut]:
    """GET /api/queue/tickets — список талонов.

    Если указан status — конвертируем наш формат в SmartQ формат для фильтра,
    потом обратно маппим.
    """
    smartq_status = _REVERSE_STATUS_MAP.get(status, status) if status else None
    smartq_tickets = await _safe_smartq_call(
        "get_tickets",
        status=smartq_status,
        room_id=cabinet_id,
    )

    # Получаем кэш service types для маппинга modality
    services = await _safe_smartq_call("get_service_types")
    services_cache = {s.get("id"): s.get("name", "") for s in services}

    return [
        await _smartq_ticket_to_ours(t, services_cache)
        for t in smartq_tickets
    ]


@router.get("/tickets/{ticket_id}", response_model=TicketOut, summary="Детали талона")
async def get_ticket(
    ticket_id: str,
    user: User = Depends(get_current_user),
) -> TicketOut:
    """GET /api/queue/tickets/{id}."""
    smartq_ticket = await _safe_smartq_call("get_ticket", ticket_id)
    services = await _safe_smartq_call("get_service_types")
    services_cache = {s.get("id"): s.get("name", "") for s in services}
    return await _smartq_ticket_to_ours(smartq_ticket, services_cache)


@router.post("/tickets", response_model=TicketOut, status_code=201, summary="Создать талон (kiosk)")
async def create_ticket(
    body: CreateTicketRequest,
    user: User = Depends(require_role(RoleCode.REGISTRAR, RoleCode.DOCTOR, RoleCode.ADMIN)),
) -> TicketOut:
    """POST /api/queue/tickets — регистрация пациента в очереди.

    В SmartQ: POST /tickets/kiosk (без авторизации).
    Доступ: registrar (регистратура), doctor, admin.
    """
    # Находим serviceTypeId по modality
    services = await _safe_smartq_call("get_service_types")
    service_type_id = None
    modality_search = body.modality.upper()
    for s in services:
        name = s.get("name", "").upper()
        if name.startswith(modality_search) or "КТ" in name and modality_search == "CT":
            service_type_id = s.get("id")
            break
        if "МРТ" in name and modality_search == "MR":
            service_type_id = s.get("id")
            break
        if "РЕНТГЕН" in name and modality_search == "DX":
            service_type_id = s.get("id")
            break
        if ("УЗИ" in name or "УЗ" in name) and modality_search == "US":
            service_type_id = s.get("id")
            break
        if "АНГИО" in name and modality_search == "XA":
            service_type_id = s.get("id")
            break
    if service_type_id is None:
        # Берём первый попавшийся
        service_type_id = services[0].get("id") if services else 1

    priority = _REVERSE_PRIORITY_MAP.get(body.priority, 3)

    smartq_ticket = await _safe_smartq_call(
        "create_ticket",
        full_name=body.full_name,
        policy_number=body.policy_number,
        service_type_id=service_type_id,
        priority=priority,
    )

    services_cache = {s.get("id"): s.get("name", "") for s in services}
    result = await _smartq_ticket_to_ours(smartq_ticket, services_cache)
    # SmartQ не возвращает fullName/policyNumber — подставляем из запроса
    if not result.full_name:
        result.full_name = body.full_name
    if not result.policy_number:
        result.policy_number = body.policy_number
    return result


@router.post(
    "/tickets/{ticket_id}/call",
    response_model=CallResponse,
    summary="Вызвать пациента (SmartQ + создание Order в нашем РИС)",
)
async def call_ticket(
    ticket_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role(RoleCode.DOCTOR, RoleCode.TECHNICIAN, RoleCode.ADMIN)),
) -> CallResponse:
    """POST /api/queue/tickets/{id}/call — вызов пациента.

    Доступ: doctor, technician, admin.
    1. Вызывает SmartQ POST /tickets/:id/call (меняет статус талона)
    2. Создаёт Order в нашей БД (PACS-заказ для врача)
    3. Возвращает оба ID

    Идемпотентность: если Order уже создан для этого ticket_id, вернёт существующий.
    """
    # 1. SmartQ: вызвать талон
    smartq_result = await _safe_smartq_call("call_ticket", ticket_id)
    if not smartq_result:
        raise HTTPException(status_code=502, detail="SmartQ недоступен или не ответил")

    # 2. Наш РИС: создать или найти Order
    stmt = select(Order).where(Order.source_ticket_id == ticket_id)
    existing_order = (await db.execute(stmt)).scalar_one_or_none()

    if existing_order:
        # Идемпотентность: Order уже создан, обновим статус
        existing_order.status = OrderStatus.IN_PROGRESS.value
        if not existing_order.started_at:
            existing_order.started_at = datetime.now(timezone.utc)
        await db.commit()
        return CallResponse(
            ticket_id=ticket_id,
            ticket_number=smartq_result.get("number", ""),
            status=_map_status_to_ours(smartq_result.get("status", "called")),
            order_id=str(existing_order.id),
            called_at=smartq_result.get("calledAt"),
        )

    # Создаём новый Order
    smartq_ticket = await _safe_smartq_call("get_ticket", ticket_id)
    if not smartq_ticket:
        raise HTTPException(status_code=502, detail="SmartQ: ticket не найден после call")
    # Если get_ticket вернул waiting (например, мок), берём статус из call (он актуальнее)
    if smartq_ticket.get("status") in ("waiting", None) and smartq_result.get("status"):
        smartq_ticket = {**smartq_ticket, "status": smartq_result["status"]}

    # Ищем пациента по fullName+policyNumber
    patient: Patient | None = None
    full_name = smartq_ticket.get("fullName", "")
    policy = smartq_ticket.get("policyNumber", "")
    if full_name and policy:
        pstmt = select(Patient).where(
            Patient.full_name == full_name,
            Patient.policy_number == policy,
        )
        patient = (await db.execute(pstmt)).scalar_one_or_none()

    # Если пациент не найден — создаём
    if patient is None:
        patient = Patient(
            full_name=full_name or f"Пациент {smartq_ticket.get('number', 'unknown')}",
            policy_number=policy or f"UNK-{ticket_id[:8]}",
        )
        db.add(patient)
        await db.flush()

    # Находим modality по serviceTypeId
    services = await _safe_smartq_call("get_service_types")
    modality_code = "CT"
    for s in services:
        if s.get("id") == smartq_ticket.get("serviceTypeId"):
            name = s.get("name", "").lower()
            if "мрт" in name or "mr" in name:
                modality_code = "MR"
            elif "рентген" in name:
                modality_code = "DX"
            elif "уз" in name:
                modality_code = "US"
            elif "ангио" in name:
                modality_code = "XA"
            break

    modality = (await db.execute(
        select(Modality).where(Modality.code == modality_code)
    )).scalar_one_or_none()

    order_id = uuid.uuid4().hex[:8]
    now = datetime.now(timezone.utc)
    order = Order(
        id=order_id,
        patient_id=patient.id,
        modality=modality_code,
        study_uid=f"1.2.840.smartq.{order_id}",
        study_description=f"Создано через SmartQ (такон {smartq_ticket.get('number', '')})",
        status=OrderStatus.IN_PROGRESS.value,
        started_at=now,
        source_ticket_id=ticket_id,
        source_ticket_number=smartq_ticket.get("number"),
        source_system="smartq",
        smartq_called_at=now,
    )
    db.add(order)
    await db.commit()

    logger.info(
        "Created Order %s for SmartQ ticket %s (%s) by user %s",
        order_id, ticket_id, smartq_ticket.get("number"), user.username,
    )

    return CallResponse(
        ticket_id=ticket_id,
        ticket_number=smartq_ticket.get("number", ""),
        status=_map_status_to_ours(smartq_ticket.get("status", "called")),
        order_id=order_id,
        called_at=smartq_ticket.get("calledAt"),
    )


@router.post(
    "/tickets/{ticket_id}/complete",
    response_model=TicketOut,
    summary="Завершить приём (SmartQ + обновить Order)",
)
async def complete_ticket(
    ticket_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role(RoleCode.DOCTOR, RoleCode.TECHNICIAN, RoleCode.ADMIN)),
) -> TicketOut:
    """POST /api/queue/tickets/{id}/complete — завершение.

    Доступ: doctor, technician, admin.
    1. SmartQ: POST /tickets/:id/complete
    2. Наш Order (по source_ticket_id): status='completed'
    """
    # 1. SmartQ
    smartq_result = await _safe_smartq_call("complete_ticket", ticket_id)
    if not smartq_result:
        raise HTTPException(status_code=502, detail="SmartQ недоступен")

    # 2. Наш Order — обновить статус
    stmt = select(Order).where(Order.source_ticket_id == ticket_id)
    order = (await db.execute(stmt)).scalar_one_or_none()
    if order is None:
        # Если талон вызывали не через нас (без Order), создаём
        # Но это редкий случай — обычно вызов уже создал Order
        smartq_ticket = await _safe_smartq_call("get_ticket", ticket_id)
        if smartq_ticket:
            # Создаём «отложенный» Order
            order = Order(
                id=uuid.uuid4().hex[:8],
                patient_id=(await _find_or_create_patient(db, smartq_ticket)).id,
                modality="CT",
                study_uid=f"1.2.840.smartq.{ticket_id[:8]}",
                study_description=f"Завершено через SmartQ (такон {smartq_ticket.get('number', '')})",
                status=OrderStatus.COMPLETED.value,
                started_at=datetime.now(timezone.utc),
                completed_at=datetime.now(timezone.utc),
                source_ticket_id=ticket_id,
                source_ticket_number=smartq_ticket.get("number"),
                source_system="smartq",
            )
            db.add(order)
        else:
            raise HTTPException(status_code=502, detail="SmartQ: ticket не найден")
    else:
        order.status = OrderStatus.COMPLETED.value
        order.completed_at = datetime.now(timezone.utc)

    await db.commit()
    return await get_ticket(ticket_id, user)


async def _find_or_create_patient(db: AsyncSession, smartq_t: dict) -> Patient:
    """Ищет пациента по fullName+policy, иначе создаёт."""
    full_name = smartq_t.get("fullName", "")
    policy = smartq_t.get("policyNumber", "")
    if full_name and policy:
        pstmt = select(Patient).where(
            Patient.full_name == full_name,
            Patient.policy_number == policy,
        )
        patient = (await db.execute(pstmt)).scalar_one_or_none()
        if patient:
            return patient

    patient = Patient(
        full_name=full_name or f"Пациент {smartq_t.get('number', 'unknown')}",
        policy_number=policy or f"UNK-{smartq_t.get('id', '')[:8]}",
    )
    db.add(patient)
    await db.flush()
    return patient


@router.get(
    "/room/{room_id}/next",
    response_model=TicketOut | None,
    summary="Следующий талон в очереди (если есть)",
)
async def next_in_queue(
    room_id: int,
    user: User = Depends(require_role(RoleCode.DOCTOR, RoleCode.TECHNICIAN, RoleCode.ADMIN)),
) -> TicketOut | None:
    """GET /api/queue/room/{roomId}/next — следующий талон в очереди.

    Доступ: doctor, technician, admin.
    Если в очереди пусто — возвращает None (200 OK с null).
    """
    smartq_ticket = await _safe_smartq_call("get_next_ticket", room_id)
    if smartq_ticket is None:
        return None
    services = await _safe_smartq_call("get_service_types")
    services_cache = {s.get("id"): s.get("name", "") for s in services}
    return await _smartq_ticket_to_ours(smartq_ticket, services_cache)
