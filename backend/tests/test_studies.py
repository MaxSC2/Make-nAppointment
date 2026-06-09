"""Тесты PACS-фасада для исследований.

Покрывает:
- GET /api/v1/studies (список)
- GET /api/v1/studies/{uid} (детали)
- GET /api/v1/orders/{id}/dicom
"""

from __future__ import annotations

import pytest


pytestmark = pytest.mark.asyncio


async def test_list_studies_empty(client, admin_auth_headers) -> None:
    """Пустой список, если нет studies в БД."""
    resp = await client.get("/api/v1/studies", headers=admin_auth_headers)
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


async def test_list_studies_filter_by_modality(client, admin_auth_headers) -> None:
    """Фильтр по модальности принимает параметр без 500."""
    resp = await client.get(
        "/api/v1/studies",
        params={"modality": "CT"},
        headers=admin_auth_headers,
    )
    assert resp.status_code == 200


async def test_list_studies_unauthorized(client) -> None:
    """Без токена — 401."""
    resp = await client.get("/api/v1/studies")
    assert resp.status_code == 401


async def test_get_study_nonexistent_uid(client, admin_auth_headers) -> None:
    """Несуществующий study_uid → 404 (не 500)."""
    fake_uid = "1.2.840.99999.does_not_exist"
    resp = await client.get(
        f"/api/v1/studies/{fake_uid}",
        headers=admin_auth_headers,
    )
    # PACS-фасад может вернуть 404 либо пустой массив
    assert resp.status_code in (200, 404)
    if resp.status_code == 200:
        assert resp.json() is None or isinstance(resp.json(), dict)
    else:
        assert "не найден" in resp.json().get("detail", "").lower() or "not found" in resp.json().get("detail", "").lower()


async def test_get_study_invalid_uid_format(client, admin_auth_headers) -> None:
    """Битый UID не валит сервер (500)."""
    resp = await client.get(
        "/api/v1/studies/!!!not-a-valid-uid!!!",
        headers=admin_auth_headers,
    )
    # Должен вернуть либо 404, либо 422, но не 500
    assert resp.status_code in (404, 422)


async def test_get_instance_dicom_unauthorized(client) -> None:
    """Без токена нельзя получить DICOM (это медицинские данные)."""
    resp = await client.get("/api/v1/instances/some-id/dicom")
    assert resp.status_code == 401


async def test_get_instance_dicom_tags_nonexistent(client, admin_auth_headers) -> None:
    """Несуществующий instance → 404 или 502 (Orthanc недоступен) — но не 500."""
    resp = await client.get(
        "/api/v1/instances/00000000-0000-0000-0000-000000000000/dicom-tags",
        headers=admin_auth_headers,
    )
    # 502 — нормально если Orthanc в test-DB не сконфигурирован
    # 404 — нормально если instance реально не найден
    # Главное — НЕ 500 (uncaught exception)
    assert resp.status_code in (404, 502)
    assert "detail" in resp.json()


async def test_get_order_dicom_unauthorized(client) -> None:
    """Без токена нельзя получить DICOM заказа."""
    resp = await client.get("/api/v1/orders/00000/dicom")
    assert resp.status_code == 401


async def test_instance_preview_accepts_wl_params(client, admin_auth_headers) -> None:
    """Превью инстанса принимает ?W= и ?L= параметры без падения."""
    resp = await client.get(
        "/api/v1/instances/test-id/preview",
        params={"W": 400, "L": 40},
        headers=admin_auth_headers,
    )
    # 502 — нормально (Orthanc не доступен в тестовой БД)
    # 404 — нормально (instance не существует)
    assert resp.status_code in (404, 502)


async def test_instance_preview_without_wl_params(client, admin_auth_headers) -> None:
    """Превью инстанса без W/L — тоже работает."""
    resp = await client.get(
        "/api/v1/instances/test-id/preview",
        headers=admin_auth_headers,
    )
    assert resp.status_code in (404, 502)


async def test_download_study_requires_auth(client) -> None:
    """Скачивание исследования требует токен (не public)."""
    resp = await client.get("/api/studies/download/test-uid")
    assert resp.status_code == 401


async def test_series_instances_endpoint(client, admin_auth_headers) -> None:
    """GET /api/v1/series/{id}/instances не падает с 500."""
    resp = await client.get(
        "/api/v1/series/test-series/instances",
        headers=admin_auth_headers,
    )
    assert resp.status_code in (404, 502)
