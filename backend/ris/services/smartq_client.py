"""SmartQ Client — обёртка над внешним API электронной очереди.

SmartQ (NikNebog/smartq-back, NestJS :3000) — внешний микросервис
управления электронной очередью. Наш РИС подключается к нему через
этот клиент, чтобы врач видел талоны из SmartQ в нашем UI.

Контракт SmartQ (из SMARTQ_ANALYSIS.md):
- POST   /auth/login                          → { access_token, refresh_token }
- GET    /auth/me                             → User
- GET    /rooms                               → Room[]
- GET    /service-types                       → ServiceType[]
- POST   /tickets/kiosk                       → Ticket (без авторизации)
- POST   /tickets                             → Ticket (admin/manager)
- GET    /tickets?status=&roomId=             → Ticket[]
- GET    /tickets/:id                         → Ticket
- POST   /tickets/:id/call                    → Ticket (admin/specialist)
- POST   /tickets/:id/complete                → Ticket (admin/specialist)
- GET    /queue/board/:roomId                 → Board (без авторизации)
- GET    /queue/room/:roomId/next             → Ticket (следующий в очереди)

Аутентификация: сервисный аккаунт SmartQ (например, admin / admin123).
Токен хранится в нашем .env: SMARTQ_SERVICE_USERNAME, SMARTQ_SERVICE_PASSWORD.
При старте RIS получает токен (login + cache) и переиспользует.

Использование:
    from ris.services.smartq_client import smartq_client
    tickets = await smartq_client.get_tickets(status='waiting')
    ticket = await smartq_client.create_ticket(cabinet_code='101', full_name='...')
"""

from __future__ import annotations

import asyncio
import logging
from typing import Any

import httpx

logger = logging.getLogger("smartq_client")


# ======================== КОНФИГ ========================

SMARTQ_TIMEOUT = 10.0
SMARTQ_CONCURRENCY = 4
_TOKEN_CACHE: dict[str, Any] = {"token": None, "expires_at": 0.0}


class SmartQError(Exception):
    """Ошибка SmartQ-клиента (обёртка над ошибками SmartQ)."""

    def __init__(self, message: str, status_code: int = 502) -> None:
        self.message = message
        self.status_code = status_code
        super().__init__(message)


# ======================== СИНГЛТОН HTTPX ========================

_smartq_semaphore = asyncio.Semaphore(SMARTQ_CONCURRENCY)
_smartq_client: httpx.AsyncClient | None = None


def _get_smartq_client() -> httpx.AsyncClient:
    """Singleton httpx-клиент к SmartQ."""
    global _smartq_client
    if _smartq_client is None:
        from db.config import settings

        _smartq_client = httpx.AsyncClient(
            base_url=settings.smartq_url,
            timeout=SMARTQ_TIMEOUT,
            limits=httpx.Limits(
                max_connections=SMARTQ_CONCURRENCY * 2,
                max_keepalive_connections=SMARTQ_CONCURRENCY,
            ),
        )
    return _smartq_client


# ======================== АУТЕНТИФИКАЦИЯ ========================


async def _get_auth_token() -> str:
    """Получить/обновить JWT-токен SmartQ (service account)."""
    import time

    if _TOKEN_CACHE["token"] and _TOKEN_CACHE["expires_at"] > time.time():
        return _TOKEN_CACHE["token"]

    from db.config import settings

    client = _get_smartq_client()
    try:
        r = await client.post(
            "/auth/login",
            json={
                "email": settings.smartq_username,
                "password": settings.smartq_password,
            },
        )
    except httpx.RequestError as e:
        raise SmartQError(f"SmartQ недоступен для login: {e}", status_code=503) from e

    if r.status_code != 201 and r.status_code != 200:
        raise SmartQError(
            f"SmartQ login вернул {r.status_code}: {r.text[:200]}",
            status_code=502,
        )

    data = r.json()
    _TOKEN_CACHE["token"] = data["access_token"]
    # Токен обычно живёт 15-60 мин, обновляем за 5 мин до конца
    expires_in = data.get("expires_in", 900)
    _TOKEN_CACHE["expires_at"] = time.time() + expires_in - 300
    return _TOKEN_CACHE["token"]


def _auth_headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


# ======================== НИЗКОУРОВНЕВЫЕ МЕТОДЫ ========================


async def _request(
    method: str,
    path: str,
    *,
    json: dict | None = None,
    params: dict | None = None,
    auth: bool = True,
) -> Any:
    """Универсальный запрос к SmartQ с автоматической аутентификацией."""
    async with _smartq_semaphore:
        client = _get_smartq_client()
        url = path.lstrip("/")

        headers = {}
        if auth:
            token = await _get_auth_token()
            headers = _auth_headers(token)

        try:
            r = await client.request(method, url, json=json, params=params, headers=headers)
        except httpx.RequestError as e:
            raise SmartQError(f"SmartQ недоступен: {e}", status_code=503) from e

        # Если 401 — сбрасываем кэш токена и пробуем ещё раз
        if r.status_code == 401 and auth:
            _TOKEN_CACHE["token"] = None
            _TOKEN_CACHE["expires_at"] = 0.0
            token = await _get_auth_token()
            try:
                r = await client.request(method, url, json=json, params=params, headers=_auth_headers(token))
            except httpx.RequestError as e:
                raise SmartQError(f"SmartQ недоступен: {e}", status_code=503) from e

        if r.status_code == 204:
            return None

        if r.status_code == 401:
            raise SmartQError("SmartQ: неверный логин/пароль service account", status_code=502)
        if r.status_code == 403:
            raise SmartQError("SmartQ: нет прав (проверьте роль service account)", status_code=502)
        if r.status_code == 404:
            raise SmartQError(f"SmartQ: ресурс не найден ({method} {path})", status_code=404)
        if r.status_code >= 500:
            raise SmartQError(
                f"SmartQ: внутренняя ошибка {r.status_code}: {r.text[:200]}",
                status_code=502,
            )
        if r.status_code >= 400:
            raise SmartQError(
                f"SmartQ: ошибка запроса {r.status_code}: {r.text[:200]}",
                status_code=400,
            )

        try:
            return r.json()
        except ValueError:
            return r.text


# ======================== ВЫСОКОУРОВНЕВЫЙ API ========================


class SmartQClient:
    """Singleton-клиент для SmartQ API.

    Использование:
        from ris.services.smartq_client import smartq_client
        tickets = await smartq_client.get_tickets(status='waiting')
    """

    async def get_rooms(self) -> list[dict]:
        """GET /rooms — список кабинетов SmartQ.

        Возвращает:
            [{"id": 1, "name": "Кабинет КТ", "isActive": True}, ...]
        """
        return await _request("GET", "/rooms")

    async def get_service_types(self) -> list[dict]:
        """GET /service-types — список типов услуг (CT, MR, DX и т.д.)."""
        return await _request("GET", "/service-types")

    async def get_tickets(
        self,
        status: str | None = None,
        room_id: int | None = None,
    ) -> list[dict]:
        """GET /tickets — список талонов с фильтром.

        Args:
            status: 'created' | 'waiting' | 'called' | 'in_service' |
                    'completed' | 'cancelled' | 'no_show' | 'redirected'
            room_id: ID кабинета SmartQ

        Возвращает:
            [{"id": "uuid", "number": "A001", "status": "waiting",
              "priority": 3, "roomId": 1, ...}, ...]
        """
        params = {}
        if status:
            params["status"] = status
        if room_id:
            params["roomId"] = room_id
        return await _request("GET", "/tickets", params=params or None)

    async def get_ticket(self, ticket_id: str) -> dict:
        """GET /tickets/:id — детали талона."""
        return await _request("GET", f"/tickets/{ticket_id}")

    async def create_ticket(
        self,
        full_name: str,
        policy_number: str,
        service_type_id: int,
        priority: int = 3,
    ) -> dict:
        """POST /tickets/kiosk — создать талон (без авторизации).

        Returns:
            {"id": "uuid", "number": "A001", "status": "waiting", ...}
        """
        return await _request(
            "POST",
            "/tickets/kiosk",
            json={
                "fullName": full_name,
                "policyNumber": policy_number,
                "serviceTypeId": service_type_id,
                "priority": priority,
            },
            auth=False,
        )

    async def call_ticket(self, ticket_id: str) -> dict:
        """POST /tickets/:id/call — вызвать талона в кабинет.

        Returns:
            {"id": "uuid", "status": "called", "calledAt": "2026-06-09T14:30:00Z", ...}
        """
        return await _request("POST", f"/tickets/{ticket_id}/call", json={})

    async def start_ticket(self, ticket_id: str) -> dict:
        """POST /tickets/:id/start — начать обслуживание."""
        return await _request("POST", f"/tickets/{ticket_id}/start", json={})

    async def complete_ticket(self, ticket_id: str) -> dict:
        """POST /tickets/:id/complete — завершить обслуживание."""
        return await _request("POST", f"/tickets/{ticket_id}/complete", json={})

    async def get_next_ticket(self, room_id: int) -> dict | None:
        """GET /queue/room/:roomId/next — следующий талон в очереди (если есть)."""
        try:
            return await _request("GET", f"/queue/room/{room_id}/next")
        except SmartQError as e:
            if e.status_code == 404:
                return None
            raise


# Singleton — глобальный экземпляр
smartq_client = SmartQClient()
