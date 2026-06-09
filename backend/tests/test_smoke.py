"""Smoke-тесты: базовая работоспособность всех сервисов.

Эти тесты — первая линия защиты. Если они падают, что-то критично сломано.
"""

from __future__ import annotations

import pytest


pytestmark = pytest.mark.asyncio


async def test_app_starts(client) -> None:
    """FastAPI app загружается без ошибок (импортируется и создаётся)."""
    assert client is not None
    assert not client.is_closed


async def test_ris_health(client) -> None:
    """Health-check эндпоинт RIS работает."""
    resp = await client.get("/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "ok"
    assert data["service"] == "ris"


async def test_swagger_docs_available(client) -> None:
    """Swagger UI доступен (проверяем что FastAPI правильно настроен)."""
    resp = await client.get("/docs")
    assert resp.status_code == 200
    assert "swagger" in resp.text.lower()


async def test_openapi_schema(client) -> None:
    """OpenAPI schema генерируется (есть все эндпоинты)."""
    resp = await client.get("/openapi.json")
    assert resp.status_code == 200
    schema = resp.json()
    assert "paths" in schema
    paths = schema["paths"]
    assert "/api/auth/login" in paths
    assert "/api/orders" in paths
    assert "/api/v1/studies" in paths
    assert "/api/v1/patients" in paths
    assert "/api/v1/patients/{patient_id}" in paths
    assert "/api/v1/patients/{patient_id}/studies" in paths


async def test_unauthorized_without_token(client) -> None:
    """Защищённые эндпоинты возвращают 401 без токена."""
    resp = await client.get("/api/orders")
    assert resp.status_code == 401
    data = resp.json()
    detail = data.get("detail", "").lower()
    # Сообщение может быть на русском или английском
    assert any(word in detail for word in ["авториз", "auth", "token", "authorization", "войдите"])


async def test_unauthorized_with_bad_token(client) -> None:
    """Невалидный токен → 401."""
    resp = await client.get(
        "/api/orders",
        headers={"Authorization": "Bearer not-a-real-jwt-token"},
    )
    assert resp.status_code == 401
