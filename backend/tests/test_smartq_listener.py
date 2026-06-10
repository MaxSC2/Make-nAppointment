"""Тесты Socket.IO listener для SmartQ (с моками БД).

Проверяет логику обработчиков _handle_ticket_called / _handle_status_update
без подключения к реальному Socket.IO и без открытия реальной сессии БД.
"""
from __future__ import annotations

from datetime import datetime, timezone
from unittest.mock import AsyncMock, patch

import pytest

from db.models.ris import Order, OrderStatus


def _make_order(
    status: str = OrderStatus.SCHEDULED.value,
    smartq_called_at=None,
    completed_at=None,
) -> Order:
    """Создаёт Order-заглушку для тестов."""
    o = Order(
        id="olisten1",
        modality="CT",
        study_uid="1.2.840.olisten1",
        study_description="Listener test",
        status=status,
        source_ticket_number="C001",
    )
    o.smartq_called_at = smartq_called_at
    o.completed_at = completed_at
    return o


@pytest.mark.asyncio
async def test_ticket_called_sets_in_progress():
    """ticket_called → smartq_called_at + статус in_progress."""
    order = _make_order()
    mock_db = AsyncMock()
    mock_db.__aenter__.return_value = mock_db

    with patch(
        "ris.services.smartq_listener._sessionmaker",
        return_value=mock_db,
    ), patch(
        "ris.services.smartq_listener._find_order_by_ticket_number",
        new=AsyncMock(return_value=order),
    ):
        from ris.services.smartq_listener import _handle_ticket_called
        await _handle_ticket_called({"ticketNumber": "C001"})

    assert order.smartq_called_at is not None
    assert order.status == OrderStatus.IN_PROGRESS.value
    mock_db.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_ticket_called_skipped_if_already_called():
    """Если уже был called, не меняем статус второй раз."""
    order = _make_order(
        status=OrderStatus.IN_PROGRESS.value,
        smartq_called_at=datetime.now(timezone.utc),
    )
    mock_db = AsyncMock()
    mock_db.__aenter__.return_value = mock_db

    with patch(
        "ris.services.smartq_listener._sessionmaker",
        return_value=mock_db,
    ), patch(
        "ris.services.smartq_listener._find_order_by_ticket_number",
        new=AsyncMock(return_value=order),
    ):
        from ris.services.smartq_listener import _handle_ticket_called
        await _handle_ticket_called({"ticketNumber": "C001"})

    # Статус не должен измениться, но call уже был — не коммитим
    assert order.status == OrderStatus.IN_PROGRESS.value


@pytest.mark.asyncio
async def test_status_update_completed():
    """status_update=completed → Order completed."""
    order = _make_order(status=OrderStatus.IN_PROGRESS.value)
    mock_db = AsyncMock()
    mock_db.__aenter__.return_value = mock_db

    with patch(
        "ris.services.smartq_listener._sessionmaker",
        return_value=mock_db,
    ), patch(
        "ris.services.smartq_listener._find_order_by_ticket_number",
        new=AsyncMock(return_value=order),
    ):
        from ris.services.smartq_listener import _handle_status_update
        await _handle_status_update({
            "ticketNumber": "C001", "status": "completed",
        })

    assert order.status == OrderStatus.COMPLETED.value
    assert order.completed_at is not None
    mock_db.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_status_update_cancelled():
    """status_update=cancelled → Order cancelled."""
    order = _make_order(status=OrderStatus.SCHEDULED.value)
    mock_db = AsyncMock()
    mock_db.__aenter__.return_value = mock_db

    with patch(
        "ris.services.smartq_listener._sessionmaker",
        return_value=mock_db,
    ), patch(
        "ris.services.smartq_listener._find_order_by_ticket_number",
        new=AsyncMock(return_value=order),
    ):
        from ris.services.smartq_listener import _handle_status_update
        await _handle_status_update({
            "ticketNumber": "C001", "status": "cancelled",
        })

    assert order.status == OrderStatus.CANCELLED.value
    mock_db.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_status_update_called_when_not_called_yet():
    """status_update=called при отсутствии smartq_called_at → зовёт _handle_ticket_called."""
    order = _make_order(status=OrderStatus.SCHEDULED.value)
    mock_db = AsyncMock()
    mock_db.__aenter__.return_value = mock_db

    with patch(
        "ris.services.smartq_listener._sessionmaker",
        return_value=mock_db,
    ), patch(
        "ris.services.smartq_listener._find_order_by_ticket_number",
        new=AsyncMock(return_value=order),
    ):
        from ris.services.smartq_listener import _handle_status_update
        await _handle_status_update({
            "ticketNumber": "C001", "status": "called",
        })

    assert order.smartq_called_at is not None
    assert order.status == OrderStatus.IN_PROGRESS.value


@pytest.mark.asyncio
async def test_handle_unknown_ticket():
    """Неизвестный ticket_number — no error."""
    with patch(
        "ris.services.smartq_listener._find_order_by_ticket_number",
        new=AsyncMock(return_value=None),
    ), patch("ris.services.smartq_listener._sessionmaker"):
        from ris.services.smartq_listener import _handle_ticket_called, _handle_status_update
        await _handle_ticket_called({"ticketNumber": "UNKNOWN"})
        await _handle_status_update({"ticketNumber": "UNKNOWN", "status": "completed"})


@pytest.mark.asyncio
async def test_handle_empty_data():
    """Пустые данные — no error."""
    from ris.services.smartq_listener import _handle_ticket_called, _handle_status_update
    await _handle_ticket_called({})
    await _handle_ticket_called({"ticketNumber": ""})
    await _handle_status_update({})
    await _handle_status_update({"ticketNumber": "X", "status": ""})
