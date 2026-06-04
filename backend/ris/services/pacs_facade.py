"""PACS-фасад: объединение данных Orthanc + RIS (PostgreSQL).

Контракт:
- list_all_studies()         — список DICOM-исследований + JOIN (RIS order + patient)
- get_study_with_details()   — детали study (Orthanc) + связанный RIS order
- get_study_preview()        — превью первого среза (PNG)
- get_instance_preview()     — превью конкретного среза (PNG)
- get_instance_dicom_tags()  — DICOM-теги инстанса
- get_patient_studies()      — все снимки пациента
- get_order_dicom()          — DICOM-данные по заказу RIS

Связь Orthanc ↔ RIS:
- Orthanc.DICOM.PatientID     → queue.patients.id (int, через str)
- Orthanc.DICOM.AccessionNumber → ris.orders.id (8 hex)
- Orthanc StudyInstanceUID   → может быть сохранён в ris.studies.orthanc_id
- Если PatientID не int (тестовые данные "001".."004") — study помечается как
  «несвязанный» (unlinked=true), но всё равно возвращается.
"""

from __future__ import annotations

import uuid
from typing import Any

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from db.config import settings
from db.models.queue import Patient
from db.models.ris import Order, OrderStatus, Study


# ======================== НИЗКОУРОВНЕВЫЙ КЛИЕНТ ========================

ORTHANC_TIMEOUT = 10.0


class PACSError(Exception):
    """Ошибка PACS-фасада (обёртка над ошибками Orthanc и БД)."""

    def __init__(self, message: str, status_code: int = 502) -> None:
        self.message = message
        self.status_code = status_code
        super().__init__(message)


async def _orthanc_get_json(path: str) -> Any:
    """GET к Orthanc, ожидаем JSON-ответ."""
    async with httpx.AsyncClient(timeout=ORTHANC_TIMEOUT) as client:
        url = f"{settings.orthanc_url}/{path.lstrip('/')}"
        try:
            r = await client.get(url)
        except httpx.RequestError as e:
            raise PACSError(f"Orthanc недоступен: {e}", status_code=503) from e
        if r.status_code != 200:
            raise PACSError(
                f"Orthanc вернул {r.status_code} для {path}: {r.text[:200]}",
                status_code=502,
            )
        return r.json()


async def _orthanc_get_bytes(path: str) -> bytes:
    """GET к Orthanc, ожидаем бинарный ответ (PNG/ZIP)."""
    async with httpx.AsyncClient(timeout=ORTHANC_TIMEOUT) as client:
        url = f"{settings.orthanc_url}/{path.lstrip('/')}"
        try:
            r = await client.get(url)
        except httpx.RequestError as e:
            raise PACSError(f"Orthanc недоступен: {e}", status_code=503) from e
        if r.status_code != 200:
            raise PACSError(
                f"Orthanc вернул {r.status_code} для {path}",
                status_code=502,
            )
        return r.content


# ======================== УТИЛИТЫ ========================


def _try_patient_id(value: Any) -> uuid.UUID | None:
    """Попытаться привести к UUID пациента; None если не получилось.

    Patient.id в БД — это uuid.UUID. DICOM-тег PatientID может быть:
    - str(patient.id) — UUID в строковом виде (для RIS-загруженных снимков)
    - "001".."004" — тестовые данные, не связаны с БД
    """
    if value is None:
        return None
    try:
        return uuid.UUID(str(value))
    except (ValueError, TypeError):
        return None


def _dicom_date_to_iso(dicom_date: str | None) -> str | None:
    """DICOM-дата (YYYYMMDD) → ISO (YYYY-MM-DD)."""
    if not dicom_date or len(dicom_date) < 8:
        return None
    return f"{dicom_date[:4]}-{dicom_date[4:6]}-{dicom_date[6:8]}"


def _dicom_time_to_iso(dicom_date: str | None, dicom_time: str | None) -> str | None:
    """DICOM дата+время → ISO 8601."""
    date = _dicom_date_to_iso(dicom_date)
    if not date:
        return None
    if not dicom_time or len(dicom_time) < 6:
        return f"{date}T00:00:00"
    hh = dicom_time[0:2]
    mm = dicom_time[2:4]
    ss = dicom_time[4:6] if len(dicom_time) >= 6 else "00"
    return f"{date}T{hh}:{mm}:{ss}"


def _build_study_summary(orthanc_study: dict) -> dict:
    """Сводка по study из Orthanc (без JOIN с БД)."""
    tags = orthanc_study.get("MainDicomTags", {}) or {}
    patient_tags = orthanc_study.get("PatientMainDicomTags", {}) or {}
    return {
        "orthanc_id": orthanc_study.get("ID"),
        "study_uid": tags.get("StudyInstanceUID"),
        "study_date": _dicom_date_to_iso(tags.get("StudyDate")),
        "study_time": _dicom_time_to_iso(tags.get("StudyDate"), tags.get("StudyTime")),
        "study_description": tags.get("StudyDescription"),
        "modality": tags.get("Modality"),
        "patient_id_dicom": tags.get("PatientID") or patient_tags.get("PatientID"),
        "patient_name_dicom": patient_tags.get("PatientName") or tags.get("PatientName"),
        "patient_birth_date": patient_tags.get("PatientBirthDate"),
        "accession_number": tags.get("AccessionNumber"),
        "is_stable": orthanc_study.get("IsStable", False),
    }


# ======================== ФАСАДНЫЕ МЕТОДЫ ========================


async def _join_with_ris(
    db: AsyncSession,
    orthanc_summary: dict,
) -> dict:
    """Объединить Orthanc-сводку с данными RIS (order, patient)."""
    summary = dict(orthanc_summary)
    summary["unlinked"] = True
    summary["ris_order_id"] = None
    summary["ris_order_status"] = None
    summary["patient"] = None

    # 1. Попытка найти patient по внутреннему ID (UUID)
    internal_patient_id = _try_patient_id(summary.get("patient_id_dicom"))
    patient: Patient | None = None
    if internal_patient_id is not None:
        patient = (
            await db.execute(
                select(Patient).where(Patient.id == internal_patient_id)
            )
        ).scalar_one_or_none()

    # 2. Попытка найти order через ris.studies по orthanc_id
    order: Order | None = None
    if summary.get("orthanc_id"):
        order = (
            await db.execute(
                select(Order)
                .join(Study, Study.order_id == Order.id)
                .where(Study.orthanc_id == summary["orthanc_id"])
            )
        ).scalar_one_or_none()

    if order is None and summary.get("accession_number"):
        order = (
            await db.execute(
                select(Order).where(Order.id == summary["accession_number"])
            )
        ).scalar_one_or_none()

    if patient is not None:
        summary["unlinked"] = False
        summary["patient"] = {
            "id": str(patient.id),
            "full_name": patient.full_name,
            "birth_date": str(patient.birth_date) if patient.birth_date else None,
        }
    if order is not None:
        summary["unlinked"] = False
        summary["ris_order_id"] = order.id
        summary["ris_order_status"] = (
            order.status.value if isinstance(order.status, OrderStatus) else order.status
        )
        summary["ris_study_description"] = order.study_description
    return summary


async def _find_orthanc_study_id(study_uid: str) -> str | None:
    """Найти orthanc_id по StudyInstanceUID."""
    try:
        studies = await _orthanc_get_json("studies?expand")
    except PACSError:
        return None
    for s in studies:
        tags = s.get("MainDicomTags", {}) or {}
        if tags.get("StudyInstanceUID") == study_uid:
            return s.get("ID")
    return None


async def list_all_studies(
    db: AsyncSession,
    modality: str | None = None,
) -> list[dict]:
    """Список всех DICOM-исследований с JOIN (Orthanc + RIS + Patient).

    Args:
        db: сессия БД
        modality: фильтр по модальности (CT, MR, DX, US)
    """
    orthanc_studies = await _orthanc_get_json("studies?expand")
    result: list[dict] = []
    for s in orthanc_studies:
        summary = _build_study_summary(s)
        # Модальность Orthanc кладёт в серию, а не в study — добираем из первой серии
        if not summary.get("modality") and s.get("Series"):
            try:
                first_series = await _orthanc_get_json(f"series/{s['Series'][0]}")
                summary["modality"] = (first_series.get("MainDicomTags") or {}).get("Modality")
            except PACSError:
                pass
        if modality and summary.get("modality") != modality:
            continue
        joined = await _join_with_ris(db, summary)
        result.append(joined)
    result.sort(key=lambda x: x.get("study_date") or "", reverse=True)
    return result


async def get_study_with_details(db: AsyncSession, study_uid: str) -> dict:
    """Детальная информация по study: серии, инстансы, RIS order."""
    orthanc_id = await _find_orthanc_study_id(study_uid)
    if not orthanc_id:
        raise PACSError(f"Исследование {study_uid} не найдено в PACS", status_code=404)

    orthanc_study = await _orthanc_get_json(f"studies/{orthanc_id}")
    summary = _build_study_summary(orthanc_study)
    joined = await _join_with_ris(db, summary)

    series = await _orthanc_get_json(f"studies/{orthanc_id}/series")
    joined["series"] = []
    for s in series:
        s_tags = s.get("MainDicomTags", {}) or {}
        s_instances = await _orthanc_get_json(f"series/{s['ID']}/instances")
        joined["series"].append({
            "orthanc_id": s["ID"],
            "series_uid": s_tags.get("SeriesInstanceUID"),
            "series_number": s_tags.get("SeriesNumber"),
            "series_description": s_tags.get("SeriesDescription"),
            "modality": s_tags.get("Modality"),
            "instance_count": len(s_instances),
            "instances": [
                {
                    "orthanc_id": inst["ID"],
                    "sop_instance_uid": (inst.get("MainDicomTags") or {}).get("SOPInstanceUID"),
                    "instance_number": (inst.get("MainDicomTags") or {}).get("InstanceNumber"),
                }
                for inst in s_instances
            ],
        })
    return joined


async def get_study_preview(study_uid: str) -> tuple[bytes, str]:
    """Превью первого среза исследования (PNG)."""
    orthanc_id = await _find_orthanc_study_id(study_uid)
    if not orthanc_id:
        raise PACSError(f"Исследование {study_uid} не найдено в PACS", status_code=404)

    series = await _orthanc_get_json(f"studies/{orthanc_id}/series")
    if not series:
        raise PACSError(f"В исследовании {study_uid} нет серий", status_code=404)
    instances = await _orthanc_get_json(f"series/{series[0]['ID']}/instances")
    if not instances:
        raise PACSError(f"В серии {series[0]['ID']} нет инстансов", status_code=404)

    first_instance_id = instances[0]["ID"]
    png_bytes = await _orthanc_get_bytes(f"instances/{first_instance_id}/preview")
    return png_bytes, "image/png"


async def get_instance_preview(instance_id: str) -> tuple[bytes, str]:
    """Превью конкретного среза (PNG)."""
    png_bytes = await _orthanc_get_bytes(f"instances/{instance_id}/preview")
    return png_bytes, "image/png"


async def get_instance_dicom_file(instance_id: str) -> tuple[bytes, str]:
    """Сырой DICOM-файл инстанса (для DWV-просмотрщика).

    Возвращает (bytes, content_type). Требует JWT — иначе был бы обход через
    прямой запрос в Orthanc.
    """
    dicom_bytes = await _orthanc_get_bytes(f"instances/{instance_id}/file")
    return dicom_bytes, "application/dicom"


async def get_instance_dicom_tags(instance_id: str) -> dict:
    """DICOM-теги инстанса (MainDicomTags)."""
    inst = await _orthanc_get_json(f"instances/{instance_id}")
    return inst.get("MainDicomTags", {}) or {}


async def get_patient_studies(db: AsyncSession, patient_id: uuid.UUID) -> list[dict]:
    """Все снимки пациента по внутреннему ID (UUID)."""
    all_studies = await list_all_studies(db)
    return [s for s in all_studies if (s.get("patient") or {}).get("id") == str(patient_id)]


async def get_order_dicom(db: AsyncSession, order_id: str) -> dict:
    """DICOM-данные, связанные с RIS-заказом."""
    order = (
        await db.execute(select(Order).where(Order.id == order_id))
    ).scalar_one_or_none()
    if order is None:
        raise PACSError(f"Заказ {order_id} не найден в RIS", status_code=404)

    studies = (
        await db.execute(select(Study).where(Study.order_id == order_id))
    ).scalars().all()

    orthanc_studies = []
    for s in studies:
        try:
            orth = await _orthanc_get_json(f"studies/{s.orthanc_id}")
            orthanc_studies.append({
                "orthanc_id": s.orthanc_id,
                "study_uid": (orth.get("MainDicomTags") or {}).get("StudyInstanceUID"),
                "study_date": _dicom_date_to_iso((orth.get("MainDicomTags") or {}).get("StudyDate")),
                "study_description": (orth.get("MainDicomTags") or {}).get("StudyDescription"),
                "is_uploaded": s.is_uploaded,
                "uploaded_at": s.uploaded_at.isoformat() if s.uploaded_at else None,
                "instance_count": s.instance_count,
            })
        except PACSError:
            continue

    patient_name = None
    if order.patient_id:
        p = (
            await db.execute(select(Patient).where(Patient.id == order.patient_id))
        ).scalar_one_or_none()
        if p:
            patient_name = p.full_name

    return {
        "order_id": order.id,
        "order_status": order.status.value if isinstance(order.status, OrderStatus) else order.status,
        "study_description": order.study_description,
        "modality": order.modality,
        "patient": {
            "id": str(order.patient_id) if order.patient_id else None,
            "full_name": patient_name,
        },
        "dicom_studies": orthanc_studies,
    }
