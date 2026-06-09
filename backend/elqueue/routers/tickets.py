"""Эндпоинты электронной очереди.

Эндпоинты:
GET  /api/cabinets                    — список кабинетов
GET  /api/tickets?cabinet=101         — талоны в кабинете (фильтр по статусу)
POST /api/tickets                     — регистрация пациента (создаёт заказ в RIS)
GET  /api/tickets/{ticket_number}     — статус по талону
GET  /api/tickets/{ticket_number}/events — журнал событий
POST /api/tickets/next                — вызвать следующего (для кабинета)
POST /api/tickets/{ticket_number}/complete — завершить приём
"""

from __future__ import annotations

import logging
import secrets
import uuid
from datetime import datetime, timezone
from typing import Annotated

import httpx

logger = logging.getLogger("elqueue.tickets")
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from db.config import settings
from db.dependencies import get_current_user, get_db, require_role
from db.models.audit import AuditAction, AuditLog
from db.models.auth import RoleCode, User
from db.models.queue import Cabinet, Patient, Ticket, TicketEvent, TicketStatus
from db.models.ris import Order, OrderStatus
from db.schemas.queue import (
    CabinetOut,
    NextCallRequest,
    PatientOut,
    TicketCreateRequest,
    TicketDetail,
    TicketEventOut,
    TicketOut,
)


router = APIRouter(prefix="/api", tags=["queue"])

_ris_client: httpx.AsyncClient | None = None


def _get_ris_client() -> httpx.AsyncClient:
    global _ris_client
    if _ris_client is None:
        _ris_client = httpx.AsyncClient(
            timeout=httpx.Timeout(10.0),
            limits=httpx.Limits(max_connections=5, max_keepalive_connections=2),
        )
    return _ris_client


# ======================== СПРАВОЧНИКИ ========================

@router.get("/cabinets", response_model=list[CabinetOut])
async def list_cabinets(
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[Cabinet]:
    result = await db.execute(select(Cabinet).where(Cabinet.is_active == True).order_by(Cabinet.code))  # noqa: E712
    return list(result.scalars().all())


# ======================== ТАЛОНЫ ========================

@router.get("/tickets", response_model=list[TicketDetail])
async def list_tickets(
    db: Annotated[AsyncSession, Depends(get_db)],
    cabinet: str | None = None,
    status_filter: str | None = None,
    limit: int = 50,
) -> list[TicketDetail]:
    """Список талонов с предзагрузкой пациента и кабинета (N+1-safe)."""
    stmt = (
        select(Ticket)
        .options(
            selectinload(Ticket.patient),
            selectinload(Ticket.cabinet),
        )
        .order_by(Ticket.created_at.desc())
        .limit(min(limit, 200))
    )
    if cabinet:
        stmt = stmt.join(Cabinet, Ticket.cabinet_id == Cabinet.id).where(Cabinet.code == cabinet)
    if status_filter:
        stmt = stmt.where(Ticket.status == status_filter)
    rows = (await db.execute(stmt)).scalars().all()
    return [TicketDetail.model_validate(r) for r in rows]


@router.get("/tickets/{ticket_number}", response_model=TicketDetail)
async def get_ticket(
    ticket_number: str,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> TicketDetail:
    stmt = (
        select(Ticket)
        .where(Ticket.ticket_number == ticket_number)
        .options(
            selectinload(Ticket.patient),
            selectinload(Ticket.cabinet),
        )
    )
    ticket = (await db.execute(stmt)).scalar_one_or_none()
    if ticket is None:
        raise HTTPException(status_code=404, detail="Ticket not found")
    return TicketDetail.model_validate(ticket)


@router.get("/tickets/{ticket_number}/events", response_model=list[TicketEventOut])
async def get_ticket_events(
    ticket_number: str,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[TicketEvent]:
    stmt = (
        select(TicketEvent)
        .join(Ticket, TicketEvent.ticket_id == Ticket.id)
        .where(Ticket.ticket_number == ticket_number)
        .order_by(TicketEvent.created_at)
    )
    return list((await db.execute(stmt)).scalars().all())


@router.post(
    "/tickets",
    response_model=TicketDetail,
    status_code=status.HTTP_201_CREATED,
)
async def register_ticket(
    body: TicketCreateRequest,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> TicketDetail:
    """Регистрация пациента: создаёт patient + ticket, запрашивает заказ в RIS."""
    # 1. Кабинет
    cabinet = (await db.execute(
        select(Cabinet).where(Cabinet.code == body.cabinet_code, Cabinet.is_active == True)  # noqa: E712
    )).scalar_one_or_none()
    if cabinet is None:
        raise HTTPException(status_code=400, detail=f"Unknown cabinet: {body.cabinet_code}")

    # 2. Пациент (ищем по полису, чтобы не дублировать)
    patient = (await db.execute(
        select(Patient).where(Patient.policy_number == body.policy_number)
    )).scalar_one_or_none()
    if patient is None:
        patient = Patient(
            full_name=body.full_name,
            policy_number=body.policy_number,
            birth_date=body.birth_date,
            phone=body.phone,
        )
        db.add(patient)
        await db.flush()
    elif patient.full_name != body.full_name:
        # Актуализируем ФИО, если изменилось
        patient.full_name = body.full_name

    # 3. Талон
    ticket = Ticket(
        ticket_number=secrets.token_hex(3).upper(),  # 6 hex-символов
        status=TicketStatus.WAITING.value,
        patient_id=patient.id,
        cabinet_id=cabinet.id,
    )
    db.add(ticket)
    await db.flush()

    db.add(TicketEvent(
        ticket_id=ticket.id,
        event_type="created",
        to_status=TicketStatus.WAITING.value,
    ))

    # ВАЖНО: коммитим ДО вызова RIS, иначе RIS не увидит пациента в своей транзакции.
    await db.commit()
    await db.refresh(ticket)

    # 4. Заказ в RIS (через REST). Если RIS недоступен — запись всё равно сохранится.
    # Пробрасываем токен пользователя, чтобы RIS не возвращал 401.
    auth_header = request.headers.get("authorization")
    order_id, study_uid = await _create_ris_order(
        body.full_name, patient.id, cabinet.modality, auth_header,
    )

    if order_id:
        ticket.order_id = order_id
        ticket.study_uid = study_uid
        await db.commit()
        await db.refresh(ticket)

    await _audit(request, db, action=AuditAction.TICKET_CREATED.value,
                 resource_type="ticket", resource_id=ticket.ticket_number)

    # 5. Перезагружаем со связями
    await db.refresh(ticket, attribute_names=["patient", "cabinet"])
    return TicketDetail.model_validate(ticket)


@router.post("/tickets/next", response_model=TicketDetail)
async def call_next(
    body: NextCallRequest,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(require_role(RoleCode.DOCTOR, RoleCode.TECHNICIAN, RoleCode.ADMIN))],
) -> TicketDetail:
    """Врач/лаборант вызывает следующего пациента в кабинет."""
    cabinet = (await db.execute(
        select(Cabinet).where(Cabinet.code == body.cabinet_code, Cabinet.is_active == True)  # noqa: E712
    )).scalar_one_or_none()
    if cabinet is None:
        raise HTTPException(status_code=400, detail=f"Unknown cabinet: {body.cabinet_code}")

    # Берём самого раннего в очереди (FIFO)
    stmt = (
        select(Ticket)
        .where(Ticket.cabinet_id == cabinet.id, Ticket.status == TicketStatus.WAITING.value)
        .order_by(Ticket.created_at.asc())
        .limit(1)
        .with_for_update(skip_locked=True)  # защита от гонок
        .options(selectinload(Ticket.patient), selectinload(Ticket.cabinet))
    )
    ticket = (await db.execute(stmt)).scalar_one_or_none()
    if ticket is None:
        raise HTTPException(status_code=404, detail="No waiting patients")

    ticket.status = TicketStatus.IN_PROGRESS.value
    ticket.called_at = datetime.now(timezone.utc)
    db.add(TicketEvent(
        ticket_id=ticket.id,
        event_type="called",
        from_status=TicketStatus.WAITING.value,
        to_status=TicketStatus.IN_PROGRESS.value,
        actor_id=user.id,
    ))

    # Статус заказа в RIS
    if ticket.order_id:
        await _patch_ris_status(
            ticket.order_id,
            OrderStatus.IN_PROGRESS.value,
            request.headers.get("authorization"),
        )

    await db.commit()
    await db.refresh(ticket, attribute_names=["patient", "cabinet"])
    await _audit(request, db, action=AuditAction.TICKET_CALLED.value,
                 resource_type="ticket", resource_id=ticket.ticket_number)
    return TicketDetail.model_validate(ticket)


@router.post("/tickets/{ticket_number}/complete", response_model=TicketDetail)
async def complete_ticket(
    ticket_number: str,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(require_role(RoleCode.DOCTOR, RoleCode.TECHNICIAN, RoleCode.ADMIN))],
) -> TicketDetail:
    """Завершить приём пациента."""
    stmt = (
        select(Ticket)
        .where(Ticket.ticket_number == ticket_number)
        .options(selectinload(Ticket.patient), selectinload(Ticket.cabinet))
        .with_for_update()
    )
    ticket = (await db.execute(stmt)).scalar_one_or_none()
    if ticket is None:
        raise HTTPException(status_code=404, detail="Ticket not found")
    if ticket.status == TicketStatus.DONE.value:
        raise HTTPException(status_code=409, detail="Already completed")

    ticket.status = TicketStatus.DONE.value
    ticket.completed_at = datetime.now(timezone.utc)
    db.add(TicketEvent(
        ticket_id=ticket.id,
        event_type="completed",
        from_status=TicketStatus.IN_PROGRESS.value,
        to_status=TicketStatus.DONE.value,
        actor_id=user.id,
    ))

    if ticket.order_id:
        await _patch_ris_status(
            ticket.order_id,
            OrderStatus.COMPLETED.value,
            request.headers.get("authorization"),
        )

    await db.commit()
    await db.refresh(ticket, attribute_names=["patient", "cabinet"])
    await _audit(request, db, action=AuditAction.TICKET_COMPLETED.value,
                 resource_type="ticket", resource_id=ticket.ticket_number)
    return TicketDetail.model_validate(ticket)


# ======================== СЛУЖЕБНОЕ ========================

async def _create_ris_order(
    patient_name: str,
    patient_db_id: uuid.UUID,
    modality: str,
    auth_header: str | None = None,
) -> tuple[str | None, str | None]:
    """Создаёт заказ в RIS через HTTP. Возвращает (order_id, study_uid) или (None, None)."""
    headers = {"X-Internal-Service": "elqueue"}
    if auth_header:
        headers["Authorization"] = auth_header
    try:
        client = _get_ris_client()
        resp = await client.post(
            f"{settings.ris_url}/api/orders",
            json={
                "patient_id": str(patient_db_id),
                "modality": modality,
                "study_description": f"Исследование, модальность {modality}",
            },
            headers=headers,
            timeout=5,
        )
        if resp.status_code == 201:
            data = resp.json()
            return data["id"], data.get("study_uid")
        else:
            logger.warning("RIS вернул %s: %s", resp.status_code, resp.text[:200])
    except Exception as e:
        logger.warning("RIS недоступен: %s", e)
    return None, None


async def _patch_ris_status(
    order_id: str, status: str, auth_header: str | None = None,
) -> None:
    headers = {"X-Internal-Service": "elqueue"}
    if auth_header:
        headers["Authorization"] = auth_header
    try:
        client = _get_ris_client()
        await client.patch(
            f"{settings.ris_url}/api/orders/{order_id}/status",
            params={"status": status},
            headers=headers,
            timeout=3,
        )
    except Exception:
        logger.warning("RIS недоступен (PATCH status)", exc_info=True)


async def _audit(
    request: Request,
    db: AsyncSession,
    action: str,
    resource_type: str | None = None,
    resource_id: str | None = None,
) -> None:
    user_id = getattr(request.state, "user_id", None)
    db.add(AuditLog(
        user_id=user_id,
        action=action,
        resource_type=resource_type,
        resource_id=resource_id,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    ))
    try:
        await db.commit()
    except Exception:
        logger.warning("audit log rollback", exc_info=True)
        await db.rollback()
