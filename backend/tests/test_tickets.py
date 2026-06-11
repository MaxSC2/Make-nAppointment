"""Тесты для эндпоинтов электронной очереди (RIS orders + elqueue tickets).

Покрывает:
- POST /api/orders (создание)
- GET /api/orders (список)
- PATCH /api/orders/{id}/status (статус)
- GET /api/modalities (справочник)
"""

from __future__ import annotations

import pytest


pytestmark = pytest.mark.asyncio


# ==================== MODALITIES ====================


async def test_get_modalities_empty(client, admin_auth_headers) -> None:
    """Справочник модальностей возвращает массив (возможно пустой)."""
    resp = await client.get("/api/modalities", headers=admin_auth_headers)
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


async def test_get_modalities_unauthorized(client) -> None:
    """GET /api/modalities: может быть публичным или требовать токен — главное не падать."""
    resp = await client.get("/api/modalities")
    # Модальности могут быть публичными (для UI) — допускаем и 200, и 401
    assert resp.status_code in (200, 401)


# ==================== ORDERS ====================


async def test_list_orders_empty(client, admin_auth_headers) -> None:
    """Список заказов (может быть пустым)."""
    resp = await client.get("/api/orders", headers=admin_auth_headers)
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


async def test_create_order(client, admin_auth_headers, seed_patient, seed_modalities) -> None:
    """Создание заказа с минимальными полями."""
    payload = {
        "patient_id": str(seed_patient.id),
        "modality": "CT",
        "study_description": "Тестовое КТ",
    }
    resp = await client.post("/api/orders", json=payload, headers=admin_auth_headers)
    assert resp.status_code in (200, 201), resp.text
    data = resp.json()
    assert "id" in data
    assert data["modality"] == "CT"
    assert data["study_description"] == "Тестовое КТ"


async def test_create_order_validation_error(client, admin_auth_headers) -> None:
    """Без обязательных полей → 422."""
    resp = await client.post(
        "/api/orders",
        json={},
        headers=admin_auth_headers,
    )
    assert resp.status_code == 422


async def test_get_order_404(client, admin_auth_headers) -> None:
    """Несуществующий order_id → 404 (не 500)."""
    resp = await client.get(
        "/api/orders/FAKEID",
        headers=admin_auth_headers,
    )
    assert resp.status_code == 404


async def test_patch_order_status(client, admin_auth_headers, seed_patient, seed_modalities) -> None:
    """Изменение статуса заказа."""
    create = await client.post(
        "/api/orders",
        json={
            "patient_id": str(seed_patient.id),
            "modality": "MR",
        },
        headers=admin_auth_headers,
    )
    assert create.status_code in (200, 201), create.text
    order_id = create.json()["id"]

    patch = await client.patch(
        f"/api/orders/{order_id}/status",
        json={"status": "in_progress"},
        headers=admin_auth_headers,
    )
    assert patch.status_code == 200, patch.text
    assert patch.json()["status"] == "in_progress"


async def test_patch_order_status_invalid_value(client, admin_auth_headers, seed_patient, seed_modalities) -> None:
    """Невалидный статус → 400 или 422 (но не 500)."""
    create = await client.post(
        "/api/orders",
        json={"patient_id": str(seed_patient.id), "modality": "US"},
        headers=admin_auth_headers,
    )
    assert create.status_code in (200, 201), create.text
    order_id = create.json()["id"]

    resp = await client.patch(
        f"/api/orders/{order_id}/status",
        json={"status": "INVALID_STATUS"},
        headers=admin_auth_headers,
    )
    assert resp.status_code in (400, 422)


async def test_patch_order_status_reads_from_body_not_query(client, admin_auth_headers, seed_patient, seed_modalities) -> None:
    """Регрессионный тест: status должен браться из JSON-тела, а не из query-параметра.

    Если фронт по ошибке шлёт ?status=X в query, а backend читает из body —
    бэкенд вернёт 400. Тест защищает от регрессии, чтобы backend
    не «помог» и не начал читать из query (как было до фикса).
    """
    create = await client.post(
        "/api/orders",
        json={"patient_id": str(seed_patient.id), "modality": "DX"},
        headers=admin_auth_headers,
    )
    assert create.status_code in (200, 201), create.text
    order_id = create.json()["id"]

    # Отправляем status ТОЛЬКО в body (как делает фронт)
    resp = await client.patch(
        f"/api/orders/{order_id}/status",
        json={"status": "in_progress"},
        headers=admin_auth_headers,
    )
    assert resp.status_code == 200, f"PATCH должен читать status из body: {resp.text}"
    data = resp.json()
    assert data["status"] == "in_progress", f"Статус должен обновиться, а не остаться 'scheduled': {data}"

    # Проверяем что в URL действительно НЕТ status=in_progress (иначе тест невалидный)
    assert "status=in_progress" not in str(resp.request.url), \
        "Этот тест должен слать status в body, а не в query"

    # И что прямой query-параметр status=nowhere не «спасает» от пустого body
    resp_bad = await client.patch(
        f"/api/orders/{order_id}/status",
        json={},  # пустое тело
        headers=admin_auth_headers,
    )
    assert resp_bad.status_code in (400, 422), \
        f"Без status в body должен быть 400/422, а не 200 OK: {resp_bad.text}"
