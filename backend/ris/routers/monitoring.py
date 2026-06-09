"""RIS-роутер: мониторинг и статистика.

Эндпоинты:
- GET /api/v1/stats/summary         — сводка за сегодня/неделю
- GET /api/v1/stats/by-modality    — разбивка заказов по модальностям
- GET /api/v1/stats/by-cabinet     — загрузка кабинетов
- GET /api/v1/stats/queue          — текущее состояние очереди
- GET /api/v1/stats/physicians      — активность врачей (заполнение протоколов)
"""

from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timedelta, timezone
from typing import Annotated, Any

from fastapi import APIRouter, Depends
from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from db.dependencies import get_current_user, get_db
from db.models.auth import User, UserRole
from db.models.queue import Cabinet, Patient, Ticket, TicketStatus
from db.models.ris import Modality, Order, OrderStatus, Protocol, Study


router = APIRouter(prefix="/api/v1/stats", tags=["Мониторинг"])


def _start_of_day_utc() -> datetime:
    """Начало сегодняшнего дня по UTC."""
    now = datetime.now(timezone.utc)
    return now.replace(hour=0, minute=0, second=0, microsecond=0)


@router.get("/summary", summary="Сводка за сегодня и за неделю")
async def get_summary(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> dict[str, Any]:
    """Возвращает ключевые метрики для дашборда."""
    now = datetime.now(timezone.utc)
    today_start = _start_of_day_utc()
    week_start = today_start - timedelta(days=7)

    # Заказы за сегодня
    orders_today_q = select(func.count(Order.id)).where(Order.created_at >= today_start)
    orders_today = (await db.execute(orders_today_q)).scalar() or 0

    # Заказы за неделю
    orders_week_q = select(func.count(Order.id)).where(Order.created_at >= week_start)
    orders_week = (await db.execute(orders_week_q)).scalar() or 0

    # Завершённые за сегодня
    completed_today_q = (
        select(func.count(Order.id))
        .where(Order.created_at >= today_start, Order.status == OrderStatus.COMPLETED.value)
    )
    completed_today = (await db.execute(completed_today_q)).scalar() or 0

    # Завершённые за неделю
    completed_week_q = (
        select(func.count(Order.id))
        .where(Order.created_at >= week_start, Order.status == OrderStatus.COMPLETED.value)
    )
    completed_week = (await db.execute(completed_week_q)).scalar() or 0

    # В работе прямо сейчас
    in_progress_q = select(func.count(Order.id)).where(Order.status == OrderStatus.IN_PROGRESS.value)
    in_progress = (await db.execute(in_progress_q)).scalar() or 0

    # Назначено (scheduled, не вызвано)
    scheduled_q = select(func.count(Order.id)).where(Order.status == OrderStatus.SCHEDULED.value)
    scheduled = (await db.execute(scheduled_q)).scalar() or 0

    # Талонов в очереди (waiting)
    tickets_waiting_q = (
        select(func.count(Ticket.id)).where(Ticket.status == TicketStatus.WAITING.value)
    )
    tickets_waiting = (await db.execute(tickets_waiting_q)).scalar() or 0

    # Подписанные протоколы за сегодня
    signed_today_q = (
        select(func.count(Protocol.id))
        .where(Protocol.signed_at >= today_start, Protocol.signed_at.isnot(None))
    )
    signed_today = (await db.execute(signed_today_q)).scalar() or 0

    # Среднее время обработки (от created_at до completed_at) для завершённых за неделю
    avg_time_q = (
        select(func.avg(func.extract('epoch', Order.completed_at - Order.created_at)))
        .where(
            Order.created_at >= week_start,
            Order.status == OrderStatus.COMPLETED.value,
            Order.completed_at.isnot(None),
        )
    )
    avg_seconds = (await db.execute(avg_time_q)).scalar() or 0
    avg_minutes = round(float(avg_seconds) / 60, 1) if avg_seconds else 0

    # Пациенты всего
    patients_total = (await db.execute(select(func.count(Patient.id)))).scalar() or 0

    return {
        "now": now.isoformat(),
        "today_start": today_start.isoformat(),
        "orders_today": orders_today,
        "orders_week": orders_week,
        "completed_today": completed_today,
        "completed_week": completed_week,
        "in_progress": in_progress,
        "scheduled": scheduled,
        "tickets_waiting": tickets_waiting,
        "signed_protocols_today": signed_today,
        "avg_completion_minutes_week": avg_minutes,
        "patients_total": patients_total,
    }


@router.get("/by-modality", summary="Заказы по модальностям за сегодня и неделю")
async def get_by_modality(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> dict[str, list[dict[str, Any]]]:
    """Разбивка заказов по модальностям: count за сегодня и за неделю, по статусам."""
    today_start = _start_of_day_utc()
    week_start = today_start - timedelta(days=7)

    rows = (await db.execute(
        select(
            Order.modality,
            Order.status,
            func.count(Order.id),
        )
        .where(Order.created_at >= week_start)
        .group_by(Order.modality, Order.status)
    )).all()

    by_modality: dict[str, dict[str, int]] = defaultdict(
        lambda: {"today": 0, "week": 0, "scheduled": 0, "in_progress": 0, "completed": 0, "cancelled": 0}
    )
    for modality, status, count in rows:
        m = by_modality[modality]
        m["week"] += count
        m[status] = m.get(status, 0) + count

    # Считаем today (заказы за сегодня с любым статусом)
    today_rows = (await db.execute(
        select(Order.modality, func.count(Order.id))
        .where(Order.created_at >= today_start)
        .group_by(Order.modality)
    )).all()
    for modality, count in today_rows:
        by_modality[modality]["today"] = count

    return {
        "items": [
            {"modality": code, **stats}
            for code, stats in sorted(by_modality.items())
        ]
    }


@router.get("/by-cabinet", summary="Загрузка кабинетов (текущая очередь)")
async def get_by_cabinet(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> dict[str, list[dict[str, Any]]]:
    """Сколько талонов в каждом кабинете по статусам."""
    rows = (await db.execute(
        select(
            Cabinet.code,
            Cabinet.name,
            Cabinet.modality,
            Ticket.status,
            func.count(Ticket.id),
        )
        .join(Ticket, Ticket.cabinet_id == Cabinet.id)
        .where(Cabinet.is_active == True)  # noqa: E712
        .group_by(Cabinet.code, Cabinet.name, Cabinet.modality, Ticket.status)
        .order_by(Cabinet.code)
    )).all()

    by_cabinet: dict[str, dict[str, Any]] = {}
    for code, name, modality, status, count in rows:
        if code not in by_cabinet:
            by_cabinet[code] = {"code": code, "name": name, "modality": modality, "waiting": 0, "in_progress": 0, "done": 0, "cancelled": 0}
        by_cabinet[code][status] = count

    return {"items": list(by_cabinet.values())}


@router.get("/queue", summary="Текущее состояние очереди (агрегаты)")
async def get_queue_stats(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> dict[str, Any]:
    """Агрегаты по всем тикетам."""
    rows = (await db.execute(
        select(Ticket.status, func.count(Ticket.id)).group_by(Ticket.status)
    )).all()
    counts = {row[0]: row[1] for row in rows}

    return {
        "total": sum(counts.values()),
        "waiting": counts.get(TicketStatus.WAITING.value, 0),
        "in_progress": counts.get(TicketStatus.IN_PROGRESS.value, 0),
        "done": counts.get(TicketStatus.DONE.value, 0),
        "cancelled": counts.get(TicketStatus.CANCELLED.value, 0),
    }


@router.get("/physicians", summary="Активность врачей")
async def get_physicians_activity(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> dict[str, list[dict[str, Any]]]:
    """Сколько заказов создано / подписанных протоколов сделано каждым врачом."""
    week_start = _start_of_day_utc() - timedelta(days=7)

    # Заказы созданные врачами за неделю
    orders_by_user = (await db.execute(
        select(
            User.id,
            User.username,
            User.full_name,
            func.count(Order.id),
        )
        .join(Order, Order.created_by == User.id)
        .where(Order.created_at >= week_start)
        .group_by(User.id, User.username, User.full_name)
    )).all()

    # Протоколы подписанные за неделю
    protocols_by_user = (await db.execute(
        select(User.id, func.count(Protocol.id))
        .join(Protocol, Protocol.signed_by == User.id)
        .where(Protocol.signed_at >= week_start, Protocol.signed_at.isnot(None))
        .group_by(User.id)
    )).all()

    signed_map = {row[0]: row[1] for row in protocols_by_user}

    items = []
    for user_id, username, full_name, count in orders_by_user:
        items.append({
            "user_id": str(user_id),
            "username": username,
            "full_name": full_name or username,
            "orders_week": count,
            "protocols_signed_week": signed_map.get(user_id, 0),
        })
    items.sort(key=lambda x: (-x["orders_week"], -x["protocols_signed_week"]))

    return {"items": items}
