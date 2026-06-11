"""Socket.IO-клиент к SmartQ.

Подключается к RealtimeGateway SmartQ, слушает события
ticket_called / status_update и обновляет статус Order'ов в нашей БД.

Использование:
    await start_listener()
    ...
    await stop_listener()
"""
from __future__ import annotations

import asyncio
import logging
import os
from typing import Any

import socketio
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from db.models.ris import Order, OrderStatus

logger = logging.getLogger("smartq_listener")

SMARTQ_URL = os.getenv("SMARTQ_URL", "http://localhost:3000")
SMARTQ_ENABLED = os.getenv("SMARTQ_ENABLED", "false").lower() == "true"

sio = socketio.AsyncClient()
_sessionmaker: async_sessionmaker | None = None
_listener_task: asyncio.Task | None = None


async def _find_order_by_ticket_number(
    db: AsyncSession, ticket_number: str
) -> Order | None:
    stmt = select(Order).where(Order.source_ticket_number == ticket_number)
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


async def _handle_ticket_called(data: dict[str, Any]) -> None:
    """Обработка события ticket_called: ставим smartq_called_at."""
    ticket_number = data.get("ticketNumber", "")
    if not ticket_number:
        logger.warning("ticket_called без ticketNumber")
        return
    if _sessionmaker is None:
        return
    async with _sessionmaker() as db:
        order = await _find_order_by_ticket_number(db, ticket_number)
        if order is None:
            logger.debug("ticket_called: Order %s не найден в нашей БД", ticket_number)
            return
        from datetime import datetime, timezone
        order.smartq_called_at = datetime.now(timezone.utc)
        if order.status == OrderStatus.SCHEDULED.value:
            order.status = OrderStatus.IN_PROGRESS.value
        await db.commit()
        logger.info("ticket_called → Order %s (%s) → in_progress", order.id, ticket_number)


async def _handle_status_update(data: dict[str, Any]) -> None:
    """Обработка status_update:
    - completed → Order.completed
    - cancelled → Order.cancelled
    """
    ticket_number = data.get("ticketNumber", "")
    status = data.get("status", "")
    logger.info("status_update: ticket=%s status=%s", ticket_number, status)
    if not ticket_number or not status:
        return
    if _sessionmaker is None:
        return
    async with _sessionmaker() as db:
        order = await _find_order_by_ticket_number(db, ticket_number)
        if order is None:
            logger.info("status_update: Order not found for ticket=%s", ticket_number)
            return
        from datetime import datetime, timezone
        if status == "completed" and order.status != OrderStatus.COMPLETED.value:
            order.status = OrderStatus.COMPLETED.value
            order.completed_at = datetime.now(timezone.utc)
            await db.commit()
            logger.info("status_update=completed → Order %s (%s) completed", order.id, ticket_number)
        elif status == "cancelled" and order.status != OrderStatus.CANCELLED.value:
            order.status = OrderStatus.CANCELLED.value
            await db.commit()
            logger.info("status_update=cancelled → Order %s (%s) cancelled", order.id, ticket_number)
        elif status == "called" and order.smartq_called_at is None:
            await _handle_ticket_called(data)


@sio.on("ticket_called")
async def on_ticket_called(data: dict[str, Any]) -> None:
    logger.debug("SocketIO ticket_called: %s", data)
    await _handle_ticket_called(data.get("data", data))


@sio.on("status_update")
async def on_status_update(data: dict[str, Any]) -> None:
    logger.debug("SocketIO status_update: %s", data)
    await _handle_status_update(data.get("data", data))


@sio.on("connect")
async def on_connect() -> None:
    logger.info("SocketIO connected to SmartQ at %s", SMARTQ_URL)


@sio.on("disconnect")
async def on_disconnect() -> None:
    logger.info("SocketIO disconnected from SmartQ")


async def _run_listener() -> None:
    while True:
        try:
            await sio.connect(
                SMARTQ_URL,
                socketio_path="/socket.io",
                wait_timeout=10,
            )
            await sio.wait()
        except asyncio.CancelledError:
            break
        except Exception as exc:
            logger.warning("SocketIO connection failed: %s. Retry in 10s...", exc)
            await asyncio.sleep(10)


async def start_listener(sessionmaker: async_sessionmaker) -> None:
    global _sessionmaker, _listener_task
    if not SMARTQ_ENABLED:
        logger.info("SmartQ listener disabled (SMARTQ_ENABLED=false)")
        return
    _sessionmaker = sessionmaker
    _listener_task = asyncio.create_task(_run_listener())
    logger.info("SmartQ SocketIO listener started")


async def stop_listener() -> None:
    global _listener_task
    if _listener_task is not None:
        _listener_task.cancel()
        try:
            await _listener_task
        except asyncio.CancelledError:
            pass
        _listener_task = None
    if sio.connected:
        await sio.disconnect()
    logger.info("SmartQ SocketIO listener stopped")
