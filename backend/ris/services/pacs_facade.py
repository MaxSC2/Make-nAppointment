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

import asyncio
import time
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
_ORTHANC_CONCURRENCY = 8  # ограничиваем параллельные запросы к Orthanc


class PACSError(Exception):
    """Ошибка PACS-фасада (обёртка над ошибками Orthanc и БД)."""

    def __init__(self, message: str, status_code: int = 502) -> None:
        self.message = message
        self.status_code = status_code
        super().__init__(message)


_orthanc_semaphore = asyncio.Semaphore(_ORTHANC_CONCURRENCY)
_orthanc_client: httpx.AsyncClient | None = None


def _get_orthanc_client() -> httpx.AsyncClient:
    """Singleton httpx-клиент (connection pool)."""
    global _orthanc_client
    if _orthanc_client is None:
        _orthanc_client = httpx.AsyncClient(
            timeout=ORTHANC_TIMEOUT,
            limits=httpx.Limits(
                max_connections=_ORTHANC_CONCURRENCY * 2,
                max_keepalive_connections=_ORTHANC_CONCURRENCY,
            ),
        )
    return _orthanc_client


async def _orthanc_get_json(path: str) -> Any:
    """GET к Orthanc, ожидаем JSON-ответ."""
    async with _orthanc_semaphore:
        client = _get_orthanc_client()
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
    async with _orthanc_semaphore:
        client = _get_orthanc_client()
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


# ======================== КЭШ МАППИНГА study_uid → orthanc_id ========================

# In-memory cache: StudyInstanceUID → orthanc_id
# TTL 60s, обновляется при первом запросе или при инвалидации (link/upload).
_study_uid_cache: dict[str, str] = {}
_study_uid_cache_built_at: float = 0.0
_STUDY_UID_CACHE_TTL = 60.0  # секунд


def invalidate_study_uid_cache() -> None:
    """Сбросить кэш маппинга. Вызывается после link/upload/delete."""
    global _study_uid_cache_built_at
    _study_uid_cache_built_at = 0.0
    _study_uid_cache.clear()


async def _build_study_uid_cache() -> None:
    """Построить кэш StudyInstanceUID → orthanc_id из Orthanc (один запрос)."""
    global _study_uid_cache_built_at
    studies = await _orthanc_get_json("studies?expand")
    new_cache: dict[str, str] = {}
    for s in studies:
        tags = s.get("MainDicomTags", {}) or {}
        uid = tags.get("StudyInstanceUID")
        if uid and s.get("ID"):
            new_cache[uid] = s["ID"]
    _study_uid_cache.clear()
    _study_uid_cache.update(new_cache)
    _study_uid_cache_built_at = time.monotonic()


async def _resolve_orthanc_id(study_uid: str) -> str | None:
    """Быстро найти orthanc_id по StudyInstanceUID (с кэшем)."""
    age = time.monotonic() - _study_uid_cache_built_at
    if age > _STUDY_UID_CACHE_TTL or study_uid not in _study_uid_cache:
        await _build_study_uid_cache()
    return _study_uid_cache.get(study_uid)


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
    """Legacy-обёртка. Использовать _resolve_orthanc_id() (с кэшем)."""
    return await _resolve_orthanc_id(study_uid)


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

    # Шаг 1: собрать сводки + подтянуть modality из первой серии (параллельно)
    modality_tasks = []
    for s in orthanc_studies:
        if not (s.get("MainDicomTags") or {}).get("Modality") and s.get("Series"):
            series_id = s["Series"][0]
            modality_tasks.append(_orthanc_get_json(f"series/{series_id}"))
        else:
            modality_tasks.append(asyncio.sleep(0, result=None))

    series_results = await asyncio.gather(*modality_tasks, return_exceptions=True)

    summaries: list[dict] = []
    for s, series_data in zip(orthanc_studies, series_results):
        summary = _build_study_summary(s)
        if not summary.get("modality") and isinstance(series_data, dict):
            summary["modality"] = (series_data.get("MainDicomTags") or {}).get("Modality")
        if modality and summary.get("modality") != modality:
            continue
        summaries.append(summary)

    # Шаг 2: батч-запросы в БД (2 запроса вместо 2×N)
    patient_uuids = {
        pid for s in summaries
        if (pid := _try_patient_id(s.get("patient_id_dicom"))) is not None
    }
    orthanc_ids = {s["orthanc_id"] for s in summaries if s.get("orthanc_id")}
    accession_numbers = {
        s["accession_number"] for s in summaries
        if s.get("accession_number")
    }

    patients_by_id: dict[uuid.UUID, Patient] = {}
    if patient_uuids:
        rows = (await db.execute(
            select(Patient).where(Patient.id.in_(patient_uuids))
        )).scalars().all()
        patients_by_id = {p.id: p for p in rows}

    orders_by_orthanc: dict[str, Order] = {}
    orders_by_id_cache: dict[str, Order] = {}
    if orthanc_ids:
        # Сначала забираем ris.studies (orthanc_id → order_id)
        study_rows = (await db.execute(
            select(Study.orthanc_id, Study.order_id)
            .where(Study.orthanc_id.in_(orthanc_ids))
        )).all()
        needed_order_ids = {row.order_id for row in study_rows}
        if needed_order_ids:
            order_rows = (await db.execute(
                select(Order).where(Order.id.in_(needed_order_ids))
            )).scalars().all()
            orders_by_id_cache = {o.id: o for o in order_rows}
        for row in study_rows:
            if row.order_id in orders_by_id_cache:
                orders_by_orthanc[row.orthanc_id] = orders_by_id_cache[row.order_id]

    orders_by_accession: dict[str, Order] = {}
    if accession_numbers:
        rows = (await db.execute(
            select(Order).where(Order.id.in_(accession_numbers))
        )).scalars().all()
        orders_by_accession = {o.id: o for o in rows}

    # Шаг 3: склеить всё в Python (без доп. запросов в БД)
    result: list[dict] = []
    for summary in summaries:
        s = dict(summary)
        s["unlinked"] = True
        s["ris_order_id"] = None
        s["ris_order_status"] = None
        s["patient"] = None

        # Patient
        pid = _try_patient_id(s.get("patient_id_dicom"))
        if pid and pid in patients_by_id:
            p = patients_by_id[pid]
            s["unlinked"] = False
            s["patient"] = {
                "id": str(p.id),
                "full_name": p.full_name,
                "birth_date": str(p.birth_date) if p.birth_date else None,
            }

        # Order: сначала через ris.studies, фолбэк через accession_number
        order = orders_by_orthanc.get(s.get("orthanc_id", ""))
        if order is None and s.get("accession_number"):
            order = orders_by_accession.get(s["accession_number"])
        if order is not None:
            s["unlinked"] = False
            s["ris_order_id"] = order.id
            s["ris_order_status"] = (
                order.status.value if isinstance(order.status, OrderStatus) else order.status
            )
            s["ris_study_description"] = order.study_description
        result.append(s)

    result.sort(key=lambda x: x.get("study_date") or "", reverse=True)
    return result


async def get_study_with_details(db: AsyncSession, study_uid: str) -> dict:
    """Детальная информация по study: серии, инстансы, RIS order.

    Оптимизация (3s → ~30ms):
    - /studies/{id}/series?expand даёт ВСЕ серии + инстансы за 1 запрос
    - раньше было 1 + N + N запросов (без expand каждый = 268ms)
    """
    orthanc_id = await _resolve_orthanc_id(study_uid)
    if not orthanc_id:
        raise PACSError(f"Исследование {study_uid} не найдено в PACS", status_code=404)

    # Параллельно: метаданные study (для DICOM-тегов) + серии с инстансами
    orthanc_study_task = _orthanc_get_json(f"studies/{orthanc_id}")
    series_task = _orthanc_get_json(f"studies/{orthanc_id}/series?expand")
    orthanc_study, series = await asyncio.gather(orthanc_study_task, series_task)

    summary = _build_study_summary(orthanc_study)
    joined = await _join_with_ris(db, summary)

    joined["series"] = [
        {
            "orthanc_id": s["ID"],
            "series_uid": (s.get("MainDicomTags") or {}).get("SeriesInstanceUID"),
            "series_number": (s.get("MainDicomTags") or {}).get("SeriesNumber"),
            "series_description": (s.get("MainDicomTags") or {}).get("SeriesDescription"),
            "modality": (s.get("MainDicomTags") or {}).get("Modality"),
            "instance_count": len(s.get("Instances") or []),
            "instances": [
                {
                    "orthanc_id": inst["ID"],
                    "sop_instance_uid": (inst.get("MainDicomTags") or {}).get("SOPInstanceUID"),
                    "instance_number": (inst.get("MainDicomTags") or {}).get("InstanceNumber"),
                }
                for inst in (s.get("Instances") or [])
            ],
        }
        for s in series
    ]
    return joined


async def get_study_preview(study_uid: str) -> tuple[bytes, str]:
    """Превью первого среза исследования (PNG).

    Оптимизация: один запрос series?expand вместо двух (series + instances).
    """
    orthanc_id = await _resolve_orthanc_id(study_uid)
    if not orthanc_id:
        raise PACSError(f"Исследование {study_uid} не найдено в PACS", status_code=404)

    series = await _orthanc_get_json(f"studies/{orthanc_id}/series?expand")
    if not series:
        raise PACSError(f"В исследовании {study_uid} нет серий", status_code=404)

    first_series = series[0]
    instances = first_series.get("Instances") or []
    if not instances:
        # fallback: без expand
        instances = await _orthanc_get_json(f"series/{first_series['ID']}/instances")
        if not instances:
            raise PACSError(f"В серии {first_series['ID']} нет инстансов", status_code=404)

    png_bytes = await _orthanc_get_bytes(f"instances/{instances[0]['ID']}/preview")
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
    """DICOM-данные, связанные с RIS-заказом.

    Оптимизация: один запрос studies?expand и фильтрация в Python
    вместо N+1 запросов /studies/{orthanc_id}.
    """
    order = (
        await db.execute(select(Order).where(Order.id == order_id))
    ).scalar_one_or_none()
    if order is None:
        raise PACSError(f"Заказ {order_id} не найден в RIS", status_code=404)

    studies = (
        await db.execute(select(Study).where(Study.order_id == order_id))
    ).scalars().all()

    # Все нужные orthanc_id → ищем в одном studies?expand запросе
    needed = {s.orthanc_id for s in studies if s.orthanc_id}
    orthanc_by_id: dict[str, dict] = {}
    if needed:
        try:
            all_studies = await _orthanc_get_json("studies?expand")
            for o in all_studies:
                if o.get("ID") in needed:
                    orthanc_by_id[o["ID"]] = o
        except PACSError:
            pass

    # Параллельно: пациент
    patient_task = (
        db.execute(select(Patient).where(Patient.id == order.patient_id))
        if order.patient_id else None
    )

    orthanc_studies = []
    for s in studies:
        orth = orthanc_by_id.get(s.orthanc_id)
        if orth is None:
            continue
        tags = orth.get("MainDicomTags") or {}
        orthanc_studies.append({
            "orthanc_id": s.orthanc_id,
            "study_uid": tags.get("StudyInstanceUID"),
            "study_date": _dicom_date_to_iso(tags.get("StudyDate")),
            "study_description": tags.get("StudyDescription"),
            "is_uploaded": s.is_uploaded,
            "uploaded_at": s.uploaded_at.isoformat() if s.uploaded_at else None,
            "instance_count": s.instance_count,
        })

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
