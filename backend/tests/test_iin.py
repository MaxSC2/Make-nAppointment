"""Тесты ИИН: создание, поиск, DICOM-линковка.

Покрывает:
- POST /api/queue/tickets с ИИН
- GET /api/v1/patients — список + поле iin
- GET /api/v1/patients/{id} — детали + iin
- GET /api/v1/patients?search=ИИН — поиск по ИИН
- POST /api/orders — DICOM PatientID = ИИН
"""

from __future__ import annotations

import pytest


pytestmark = pytest.mark.asyncio


async def test_create_patient_with_iin(client, admin_auth_headers, seed_modalities) -> None:
    """Создание пациента с ИИН через queue/tickets."""
    payload = {
        "full_name": "Тестов ИИН Тестович",
        "policy_number": "IIN-999",
        "iin": "999888777666",
        "modality": "CT",
        "priority": "normal",
    }
    resp = await client.post("/api/queue/tickets", json=payload, headers=admin_auth_headers)
    assert resp.status_code == 201, resp.text
    data = resp.json()
    assert data["iin"] == "999888777666"
    assert data["full_name"] == "Тестов ИИН Тестович"


async def test_list_patients_returns_iin(client, admin_auth_headers, seed_patient_with_iin) -> None:
    """Список пациентов содержит поле iin."""
    resp = await client.get("/api/v1/patients", headers=admin_auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 1
    assert data[0]["iin"] == "123456789012"


async def test_get_patient_by_id_has_iin(client, admin_auth_headers, seed_patient_with_iin) -> None:
    """Детальная карточка пациента содержит iin."""
    patient = seed_patient_with_iin
    resp = await client.get(f"/api/v1/patients/{patient.id}", headers=admin_auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["iin"] == "123456789012"
    assert data["full_name"] == "Петров Пётр Петрович"
    assert data["policy_number"] == "IIN-TEST-001"


async def test_search_patient_by_iin(client, admin_auth_headers, seed_patient_with_iin) -> None:
    """Поиск по ИИН находит пациента."""
    resp = await client.get(
        "/api/v1/patients",
        params={"search": "123456789012"},
        headers=admin_auth_headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 1
    assert data[0]["iin"] == "123456789012"


async def test_search_patient_by_iin_no_match(client, admin_auth_headers, seed_patient_with_iin) -> None:
    """Поиск по несуществующему ИИН — пустой результат."""
    resp = await client.get(
        "/api/v1/patients",
        params={"search": "000000000000"},
        headers=admin_auth_headers,
    )
    assert resp.status_code == 200
    assert resp.json() == []


async def test_order_dicom_patient_id_is_iin(client, admin_auth_headers, seed_patient_with_iin, seed_modalities) -> None:
    """При создании заказа DICOM PatientID = ИИН (не UUID)."""
    patient = seed_patient_with_iin
    payload = {
        "patient_id": str(patient.id),
        "modality": "CT",
        "study_description": "IIN Test Study",
    }
    resp = await client.post("/api/orders", json=payload, headers=admin_auth_headers)
    assert resp.status_code in (200, 201), resp.text
    data = resp.json()
    assert "id" in data
    assert data["modality"] == "CT"

    # Проверяем, что Orthanc получил DICOM с PatientID = ИИН
    if "study_uid" not in data:
        pytest.skip("Нет study_uid — Orthanc не доступен")

    study_uid = data["study_uid"]
    orthanc_resp = await client.get(
        f"/api/orthanc/studies/{study_uid}",
        headers=admin_auth_headers,
    )
    if orthanc_resp.status_code == 200:
        orth_data = orthanc_resp.json()
        if "PatientMainDicomTags" in orth_data:
            assert orth_data["PatientMainDicomTags"].get("PatientID") == "123456789012"
        elif "PatientID" in orth_data:
            assert orth_data["PatientID"] == "123456789012"


async def test_update_patient_iin(client, admin_auth_headers, seed_patient, seed_modalities) -> None:
    """Обновление ИИН у существующего пациента."""
    patient = seed_patient
    payload = {
        "full_name": patient.full_name,
        "policy_number": patient.policy_number,
        "iin": "555444333222",
    }
    resp = await client.patch(
        "/api/queue/tickets/00000000-0000-0000-0000-000000000001/patient",
        json=payload,
        headers=admin_auth_headers,
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["iin"] == "555444333222"


async def test_patient_iin_nullable(client, admin_auth_headers, seed_patient) -> None:
    """Пациент без ИИН не падает — возвращается null в поле iin."""
    patient = seed_patient
    resp = await client.get(f"/api/v1/patients/{patient.id}", headers=admin_auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "iin" in data
    assert data["iin"] is None
