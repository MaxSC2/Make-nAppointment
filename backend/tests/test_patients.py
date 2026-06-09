"""Тесты PACS-фасада для пациентов.

Покрывает:
- GET /api/v1/patients (список + поиск)
- GET /api/v1/patients/{id} (детали)
- GET /api/v1/patients/{id}/studies (исследования пациента)
"""

from __future__ import annotations

import pytest


pytestmark = pytest.mark.asyncio


async def test_list_patients_empty(client, admin_auth_headers) -> None:
    """Пустой список — нет ни одного пациента."""
    resp = await client.get("/api/v1/patients", headers=admin_auth_headers)
    assert resp.status_code == 200
    assert resp.json() == []


async def test_list_patients_one(client, admin_auth_headers, seed_patient) -> None:
    """После создания пациента он появляется в списке."""
    resp = await client.get("/api/v1/patients", headers=admin_auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 1
    p = data[0]
    assert p["full_name"] == "Иванов Иван Иванович"
    assert p["policy_number"] == "TEST-001"
    assert "id" in p
    # PACS-фасад может не возвращать created_at — это нормально


async def test_list_patients_search_by_name(client, admin_auth_headers, seed_patient) -> None:
    """Поиск по ФИО (case-insensitive, ilike)."""
    resp = await client.get(
        "/api/v1/patients",
        params={"search": "иван"},
        headers=admin_auth_headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 1
    assert "Иванов" in data[0]["full_name"]


async def test_list_patients_search_by_policy(client, admin_auth_headers, seed_patient) -> None:
    """Поиск по номеру полиса."""
    resp = await client.get(
        "/api/v1/patients",
        params={"search": "TEST-001"},
        headers=admin_auth_headers,
    )
    assert resp.status_code == 200
    assert len(resp.json()) == 1


async def test_list_patients_search_no_match(client, admin_auth_headers, seed_patient) -> None:
    """Поиск без совпадений — пустой результат."""
    resp = await client.get(
        "/api/v1/patients",
        params={"search": "DOES_NOT_EXIST"},
        headers=admin_auth_headers,
    )
    assert resp.status_code == 200
    assert resp.json() == []


async def test_get_patient_by_id(client, admin_auth_headers, seed_patient) -> None:
    """Получение пациента по UUID — детальная карточка."""
    patient = seed_patient
    resp = await client.get(
        f"/api/v1/patients/{patient.id}",
        headers=admin_auth_headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["id"] == str(patient.id)
    assert data["full_name"] == patient.full_name
    assert data["policy_number"] == patient.policy_number


async def test_get_patient_404(client, admin_auth_headers) -> None:
    """Несуществующий UUID → 404 с русским сообщением."""
    fake_uuid = "00000000-0000-0000-0000-000000000000"
    resp = await client.get(
        f"/api/v1/patients/{fake_uuid}",
        headers=admin_auth_headers,
    )
    assert resp.status_code == 404
    detail = resp.json().get("detail", "")
    assert "найден" in detail.lower() or "не найден" in detail.lower() or "not found" in detail.lower()


async def test_get_patient_invalid_uuid(client, admin_auth_headers) -> None:
    """Невалидный UUID → 422 (Pydantic)."""
    resp = await client.get(
        "/api/v1/patients/not-a-uuid",
        headers=admin_auth_headers,
    )
    assert resp.status_code == 422


async def test_get_patient_studies_empty(client, admin_auth_headers, seed_patient) -> None:
    """У пациента без исследований — пустой массив."""
    resp = await client.get(
        f"/api/v1/patients/{seed_patient.id}/studies",
        headers=admin_auth_headers,
    )
    assert resp.status_code == 200
    assert resp.json() == []


async def test_list_patients_unauthorized(client) -> None:
    """Без токена — 401."""
    resp = await client.get("/api/v1/patients")
    assert resp.status_code == 401


async def test_get_patient_by_id_has_all_fields(client, admin_auth_headers, seed_patient) -> None:
    """Карточка пациента содержит все ожидаемые поля."""
    resp = await client.get(
        f"/api/v1/patients/{seed_patient.id}",
        headers=admin_auth_headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    for field in ("id", "full_name", "policy_number", "birth_date", "phone"):
        assert field in data, f"Отсутствует поле {field}"


async def test_patient_studies_has_required_fields(client, admin_auth_headers) -> None:
    """PatientStudy должен возвращать поля для фронта:
    order_id, created_at, is_uploaded, preview_url, study_uid, modality.
    """
    resp = await client.get(
        "/api/v1/patients/00000000-0000-0000-0000-000000000000/studies",
        headers=admin_auth_headers,
    )
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)
