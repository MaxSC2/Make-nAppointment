"""Тесты SmartQ-клиента (с respx-моками, без реального SmartQ).

Покрывает:
- POST /auth/login (получение токена)
- GET /tickets, /tickets/:id, /tickets с фильтром
- POST /tickets/kiosk (создание талона)
- POST /tickets/:id/call, /complete
- Обработка ошибок (401, 404, 500)
- Кэширование токена (повторный вызов не логинится)
"""

from __future__ import annotations

import time
from unittest.mock import patch

import httpx
import pytest
import respx

from ris.services import smartq_client
from ris.services.smartq_client import SmartQError, _get_auth_token, _TOKEN_CACHE


pytestmark = pytest.mark.asyncio


@pytest.fixture(autouse=True)
def reset_token_cache():
    """Сбрасываем кэш токена перед каждым тестом."""
    _TOKEN_CACHE["token"] = None
    _TOKEN_CACHE["expires_at"] = 0.0
    yield
    _TOKEN_CACHE["token"] = None
    _TOKEN_CACHE["expires_at"] = 0.0


# ======================== AUTH ========================


@respx.mock
async def test_login_success_stores_token() -> None:
    """POST /auth/login → кэшируется токен."""
    respx.post("http://localhost:3000/auth/login").mock(
        return_value=httpx.Response(201, json={
            "access_token": "test-jwt-token",
            "refresh_token": "refresh-jwt",
            "token_type": "Bearer",
            "expires_in": 900,
        })
    )

    token = await _get_auth_token()
    assert token == "test-jwt-token"
    assert _TOKEN_CACHE["token"] == "test-jwt-token"
    assert _TOKEN_CACHE["expires_at"] > time.time()


@respx.mock
async def test_token_cached_on_repeat_calls() -> None:
    """Повторный вызов НЕ логинится (использует кэш)."""
    login_route = respx.post("http://localhost:3000/auth/login").mock(
        return_value=httpx.Response(201, json={
            "access_token": "cached-token",
            "refresh_token": "refresh",
            "token_type": "Bearer",
            "expires_in": 900,
        })
    )

    await _get_auth_token()
    await _get_auth_token()
    await _get_auth_token()
    assert login_route.call_count == 1  # login вызван только один раз


@respx.mock
async def test_token_refresh_on_401() -> None:
    """При 401 — сбрасываем кэш, логинимся заново, повторяем запрос."""
    respx.post("http://localhost:3000/auth/login").mock(
        side_effect=[
            httpx.Response(201, json={"access_token": "first-token", "expires_in": 900}),
            httpx.Response(201, json={"access_token": "second-token", "expires_in": 900}),
        ]
    )
    respx.get("http://localhost:3000/tickets").mock(
        side_effect=[
            httpx.Response(401, json={"detail": "expired"}),
            httpx.Response(200, json=[{"id": "1", "number": "A001"}]),
        ]
    )

    tickets = await smartq_client.smartq_client.get_tickets()
    assert tickets == [{"id": "1", "number": "A001"}]
    assert _TOKEN_CACHE["token"] == "second-token"


# ======================== TICKETS ========================


@respx.mock
async def test_get_tickets_with_status_filter() -> None:
    """GET /tickets?status=waiting → список талонов."""
    respx.post("http://localhost:3000/auth/login").mock(
        return_value=httpx.Response(201, json={"access_token": "t", "expires_in": 900})
    )
    respx.get("http://localhost:3000/tickets", params={"status": "waiting"}).mock(
        return_value=httpx.Response(200, json=[
            {"id": "1", "number": "A001", "status": "waiting"},
            {"id": "2", "number": "A002", "status": "waiting"},
        ])
    )

    tickets = await smartq_client.smartq_client.get_tickets(status="waiting")
    assert len(tickets) == 2
    assert tickets[0]["number"] == "A001"


@respx.mock
async def test_get_ticket_by_id() -> None:
    """GET /tickets/:id → детали."""
    respx.post("http://localhost:3000/auth/login").mock(
        return_value=httpx.Response(201, json={"access_token": "t", "expires_in": 900})
    )
    respx.get("http://localhost:3000/tickets/ticket-uuid-123").mock(
        return_value=httpx.Response(200, json={
            "id": "ticket-uuid-123",
            "number": "A001",
            "status": "called",
            "priority": 3,
        })
    )

    ticket = await smartq_client.smartq_client.get_ticket("ticket-uuid-123")
    assert ticket["number"] == "A001"
    assert ticket["status"] == "called"


@respx.mock
async def test_create_ticket_kiosk() -> None:
    """POST /tickets/kiosk — создание талона без авторизации."""
    respx.post("http://localhost:3000/tickets/kiosk").mock(
        return_value=httpx.Response(201, json={
            "id": "new-ticket-uuid",
            "number": "A005",
            "status": "waiting",
            "priority": 3,
        })
    )

    ticket = await smartq_client.smartq_client.create_ticket(
        full_name="Иванов Иван",
        policy_number="P-123456",
        service_type_id=1,
        priority=3,
    )
    assert ticket["number"] == "A005"
    assert ticket["status"] == "waiting"


@respx.mock
async def test_call_ticket() -> None:
    """POST /tickets/:id/call → статус changed to 'called'."""
    respx.post("http://localhost:3000/auth/login").mock(
        return_value=httpx.Response(201, json={"access_token": "t", "expires_in": 900})
    )
    respx.post("http://localhost:3000/tickets/ticket-uuid-123/call", json={}).mock(
        return_value=httpx.Response(200, json={
            "id": "ticket-uuid-123",
            "status": "called",
            "calledAt": "2026-06-09T14:30:00Z",
        })
    )

    result = await smartq_client.smartq_client.call_ticket("ticket-uuid-123")
    assert result["status"] == "called"


@respx.mock
async def test_complete_ticket() -> None:
    """POST /tickets/:id/complete."""
    respx.post("http://localhost:3000/auth/login").mock(
        return_value=httpx.Response(201, json={"access_token": "t", "expires_in": 900})
    )
    respx.post("http://localhost:3000/tickets/ticket-uuid-123/complete", json={}).mock(
        return_value=httpx.Response(200, json={
            "id": "ticket-uuid-123",
            "status": "completed",
        })
    )

    result = await smartq_client.smartq_client.complete_ticket("ticket-uuid-123")
    assert result["status"] == "completed"


# ======================== ROOMS & SERVICE TYPES ========================


@respx.mock
async def test_get_rooms() -> None:
    """GET /rooms → кабинеты."""
    respx.post("http://localhost:3000/auth/login").mock(
        return_value=httpx.Response(201, json={"access_token": "t", "expires_in": 900})
    )
    respx.get("http://localhost:3000/rooms").mock(
        return_value=httpx.Response(200, json=[
            {"id": 1, "name": "Кабинет КТ", "isActive": True},
            {"id": 2, "name": "Кабинет МРТ", "isActive": True},
        ])
    )

    rooms = await smartq_client.smartq_client.get_rooms()
    assert len(rooms) == 2
    assert rooms[0]["name"] == "Кабинет КТ"


@respx.mock
async def test_get_service_types() -> None:
    """GET /service-types → типы услуг."""
    respx.post("http://localhost:3000/auth/login").mock(
        return_value=httpx.Response(201, json={"access_token": "t", "expires_in": 900})
    )
    respx.get("http://localhost:3000/service-types").mock(
        return_value=httpx.Response(200, json=[
            {"id": 1, "name": "КТ", "averageDurationMinutes": 30, "priorityWeight": 1},
            {"id": 2, "name": "МРТ", "averageDurationMinutes": 45, "priorityWeight": 2},
        ])
    )

    types = await smartq_client.smartq_client.get_service_types()
    assert len(types) == 2


# ======================== ERROR HANDLING ========================


@respx.mock
async def test_404_returns_not_found_error() -> None:
    """404 → SmartQError со status_code=404."""
    respx.post("http://localhost:3000/auth/login").mock(
        return_value=httpx.Response(201, json={"access_token": "t", "expires_in": 900})
    )
    respx.get("http://localhost:3000/tickets/nonexistent").mock(
        return_value=httpx.Response(404, json={"detail": "Not found"})
    )

    with pytest.raises(SmartQError) as exc_info:
        await smartq_client.smartq_client.get_ticket("nonexistent")
    assert exc_info.value.status_code == 404
    assert "не найден" in exc_info.value.message


@respx.mock
async def test_500_returns_bad_gateway_error() -> None:
    """500 от SmartQ → SmartQError со status_code=502 (Bad Gateway)."""
    respx.post("http://localhost:3000/auth/login").mock(
        return_value=httpx.Response(201, json={"access_token": "t", "expires_in": 900})
    )
    respx.get("http://localhost:3000/tickets").mock(
        return_value=httpx.Response(500, text="Internal Server Error")
    )

    with pytest.raises(SmartQError) as exc_info:
        await smartq_client.smartq_client.get_tickets()
    assert exc_info.value.status_code == 502


@respx.mock
async def test_403_access_denied() -> None:
    """403 → SmartQError (нет прав у service account)."""
    respx.post("http://localhost:3000/auth/login").mock(
        return_value=httpx.Response(201, json={"access_token": "t", "expires_in": 900})
    )
    respx.get("http://localhost:3000/tickets").mock(
        return_value=httpx.Response(403, json={"detail": "Forbidden"})
    )

    with pytest.raises(SmartQError) as exc_info:
        await smartq_client.smartq_client.get_tickets()
    assert exc_info.value.status_code == 502
    assert "прав" in exc_info.value.message


@respx.mock
async def test_login_failure_raises() -> None:
    """401 на login → SmartQError."""
    respx.post("http://localhost:3000/auth/login").mock(
        return_value=httpx.Response(401, json={"detail": "Invalid credentials"})
    )

    with pytest.raises(SmartQError) as exc_info:
        await _get_auth_token()
    assert "login" in exc_info.value.message.lower() or "service" in exc_info.value.message.lower()


@respx.mock
async def test_get_next_ticket_returns_none_on_404() -> None:
    """GET /queue/room/:id/next → 404 → None (не ошибка)."""
    respx.post("http://localhost:3000/auth/login").mock(
        return_value=httpx.Response(201, json={"access_token": "t", "expires_in": 900})
    )
    respx.get("http://localhost:3000/queue/room/1/next").mock(
        return_value=httpx.Response(404, json={"detail": "No tickets"})
    )

    result = await smartq_client.smartq_client.get_next_ticket(room_id=1)
    assert result is None


# ======================== CONNECTIVITY ========================


@respx.mock
async def test_connection_error_raises_service_unavailable() -> None:
    """SmartQ недоступен → SmartQError(503)."""
    respx.post("http://localhost:3000/auth/login").mock(
        side_effect=httpx.ConnectError("Connection refused")
    )

    with pytest.raises(SmartQError) as exc_info:
        await _get_auth_token()
    assert exc_info.value.status_code == 503
    assert "недоступен" in exc_info.value.message


# ======================== KIOSK AUTHENTICATION ========================


@respx.mock
async def test_kiosk_creation_does_not_use_token() -> None:
    """POST /tickets/kiosk — НЕ требует токена (auth=False)."""
    login_route = respx.post("http://localhost:3000/auth/login").mock(
        return_value=httpx.Response(201, json={"access_token": "t", "expires_in": 900})
    )
    respx.post("http://localhost:3000/tickets/kiosk").mock(
        return_value=httpx.Response(201, json={"id": "kiosk-1", "number": "A001"})
    )

    # Если бы мы логинились здесь — был бы call_count > 0
    await smartq_client.smartq_client.create_ticket(
        full_name="Test", policy_number="P-001", service_type_id=1
    )
    assert login_route.call_count == 0
