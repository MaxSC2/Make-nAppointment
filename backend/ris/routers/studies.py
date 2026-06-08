"""RIS-роутер: PACS-фасад (исследования, инстансы, превью).

PACS-фасад скрывает Orthanc от frontend. Frontend работает только с этими
эндпоинтами, не зная про /orthanc/*.

Эндпоинты:
- GET    /api/v1/studies                       — список DICOM-исследований (Orthanc + JOIN)
- GET    /api/v1/studies/{study_uid}           — детали + серии + инстансы + RIS order
- GET    /api/v1/studies/{study_uid}/preview   — превью первого среза (PNG)
- POST   /api/v1/studies/{orthanc_id}/link     — связать unlinked-снимок с RIS-заказом
- GET    /api/v1/instances/{instance_id}/preview       — превью среза
- GET    /api/v1/instances/{instance_id}/dicom-tags    — DICOM-теги
- GET    /api/v1/instances/{instance_id}/dicom         — сырой DICOM-файл (для DWV)
- GET    /api/v1/patients/{patient_id}/studies         — все снимки пациента
- GET    /api/v1/orders/{order_id}/dicom               — DICOM-данные по заказу

Все ошибки — на русском (PACS-фасад скрывает детали Orthanc).
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from db.dependencies import get_current_user, get_db
from db.models.auth import RoleCode, User
from db.models.queue import Patient
from db.models.ris import Modality, Order, OrderStatus, Protocol, Study
from db.schemas.ris import OrderOut
from ris.services import pacs_facade


router = APIRouter(prefix="/api/v1", tags=["PACS-фасад (исследования)"])


class LinkStudyRequest(BaseModel):
    modality_code: str
    study_description: str | None = None
    referring_physician: str | None = None


class LinkStudyResponse(BaseModel):
    order_id: str
    patient_id: str
    patient_name: str


# ======================== STUDIES ========================


@router.get("/studies", summary="Список DICOM-исследований (PACS-фасад)")
async def list_studies(
    modality: str | None = Query(
        None, description="Фильтр по модальности (CT, MR, DX, US, XA, MG, PT, NM)"
    ),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Список всех DICOM-исследований с JOIN к RIS (order) и Patient.

    Frontend вызывает только этот эндпоинт, не зная про Orthanc.
    """
    try:
        return await pacs_facade.list_all_studies(db, modality=modality)
    except pacs_facade.PACSError as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)


@router.get("/studies/{study_uid}", summary="Детали DICOM-исследования")
async def get_study(
    study_uid: str,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Полная информация: серии, инстансы, RIS-заказ, пациент."""
    try:
        return await pacs_facade.get_study_with_details(db, study_uid)
    except pacs_facade.PACSError as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)


@router.get(
    "/studies/{study_uid}/preview",
    summary="Превью первого среза исследования (PNG)",
    response_class=Response,
)
async def get_study_preview(
    study_uid: str,
    current_user=Depends(get_current_user),
):
    """Возвращает PNG-превью первого среза исследования."""
    try:
        png_bytes, content_type = await pacs_facade.get_study_preview(study_uid)
        return Response(content=png_bytes, media_type=content_type)
    except pacs_facade.PACSError as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)


@router.post(
    "/studies/{orthanc_id}/link",
    summary="Связать unlinked-снимок с RIS-заказом",
    response_model=LinkStudyResponse,
)
async def link_study_to_order(
    orthanc_id: str,
    body: LinkStudyRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Создаёт Patient (если надо) + Order + Study(ris.studies) для unlinked-снимка.

    Нужно для тестовых/загруженных напрямую в Orthanc снимков, у которых
    PatientID не UUID. После линковки study появляется в PACS-фасаде с ris_order_id,
    и для него работает ProtocolPage.
    """
    try:
        orthanc_study = await pacs_facade._orthanc_get_json(f"studies/{orthanc_id}")
    except pacs_facade.PACSError as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)

    summary = pacs_facade._build_study_summary(orthanc_study)
    patient_name = summary.get("patient_name_dicom") or f"Пациент снимка {orthanc_id[:8]}"
    patient_id_dicom = summary.get("patient_id_dicom")

    # 1. Пациент — если есть UUID-совместимый ID, ищем, иначе создаём
    patient: Patient | None = None
    if patient_id_dicom:
        try:
            pid = uuid.UUID(patient_id_dicom)
            patient = (await db.execute(
                select(Patient).where(Patient.id == pid)
            )).scalar_one_or_none()
        except (ValueError, TypeError):
            pass
    if patient is None:
        patient = Patient(
            full_name=patient_name.replace("^", " ").strip() or "Неизвестный пациент",
            policy_number=f"UNK-{orthanc_id[:8].upper()}",
        )
        db.add(patient)
        await db.flush()

    # 2. Модальность
    modality = (await db.execute(
        select(Modality).where(Modality.code == body.modality_code)
    )).scalar_one_or_none()
    if modality is None:
        raise HTTPException(
            status_code=400,
            detail=f"Неизвестная модальность: {body.modality_code}",
        )

    # 3. Заказ
    order_id = uuid.uuid4().hex[:8]
    study_uid = summary.get("study_uid") or f"1.2.840.{uuid.uuid4().int % 10**15}"
    now = datetime.now(timezone.utc)
    order = Order(
        id=order_id,
        patient_id=patient.id,
        modality=modality.code,
        study_uid=study_uid,
        study_description=body.study_description or summary.get("study_description") or "Связано вручную",
        referring_physician=body.referring_physician,
        status=OrderStatus.IN_PROGRESS.value,
        created_by=current_user.id,
    )
    db.add(order)
    db.add(Protocol(order_id=order.id, body="", is_draft=True))

    # 4. Связь в ris.studies
    db.add(Study(
        order_id=order.id,
        orthanc_id=orthanc_id,
        is_uploaded=True,
        uploaded_at=now,
    ))

    await db.commit()
    # Инвалидируем кэш маппинга study_uid → orthanc_id (новый order/patient в БД
    # не меняет кэш, но если в будущем будем линковать новые studies в Orthanc —
    # обязательно сбросить).
    pacs_facade.invalidate_study_uid_cache()
    return LinkStudyResponse(
        order_id=order.id,
        patient_id=str(patient.id),
        patient_name=patient.full_name,
    )


# ======================== INSTANCES ========================


@router.get(
    "/instances/{instance_id}/preview",
    summary="Превью конкретного среза (PNG)",
    response_class=Response,
)
async def get_instance_preview(
    instance_id: str,
    current_user=Depends(get_current_user),
):
    """Возвращает PNG-превью одного инстанса (для листания в viewer)."""
    try:
        png_bytes, content_type = await pacs_facade.get_instance_preview(instance_id)
        return Response(content=png_bytes, media_type=content_type)
    except pacs_facade.PACSError as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)


@router.get(
    "/instances/{instance_id}/dicom-tags",
    summary="DICOM-теги инстанса",
)
async def get_instance_dicom_tags(
    instance_id: str,
    current_user=Depends(get_current_user),
):
    """Упрощённый набор DICOM-тегов (MainDicomTags) для отображения в viewer."""
    try:
        return await pacs_facade.get_instance_dicom_tags(instance_id)
    except pacs_facade.PACSError as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)


@router.get(
    "/instances/{instance_id}/dicom",
    summary="Сырой DICOM-файл инстанса (для DWV)",
    response_class=Response,
)
async def get_instance_dicom(
    instance_id: str,
    current_user=Depends(get_current_user),
):
    """Возвращает сырой DICOM-файл (application/dicom) для DWV-просмотрщика.

    Все запросы идут через PACS-фасад, что гарантирует JWT-аутентификацию
    (в отличие от прямого доступа к Orthanc).
    """
    try:
        dicom_bytes, content_type = await pacs_facade.get_instance_dicom_file(instance_id)
        return Response(content=dicom_bytes, media_type=content_type)
    except pacs_facade.PACSError as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)


@router.get(
    "/series/{series_id}/instances",
    summary="Список инстансов серии (DICOM-теги)",
)
async def get_series_instances(
    series_id: str,
    current_user=Depends(get_current_user),
):
    """Список DICOM-инстансов серии с MainDicomTags (1 запрос ?expand)."""
    try:
        return await pacs_facade.get_series_instances(series_id)
    except pacs_facade.PACSError as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)


@router.get(
    "/series/{series_id}/thumbnail",
    summary="Thumbnail серии (PNG)",
    response_class=Response,
)
async def get_series_thumbnail(
    series_id: str,
    current_user=Depends(get_current_user),
):
    """Маленький PNG для отображения в списке серий."""
    try:
        png_bytes, content_type = await pacs_facade.get_series_thumbnail(series_id)
        return Response(content=png_bytes, media_type=content_type)
    except pacs_facade.PACSError as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)


@router.get(
    "/studies/{study_id}/thumbnail",
    summary="Thumbnail исследования (PNG)",
    response_class=Response,
)
async def get_study_thumbnail(
    study_id: str,
    current_user=Depends(get_current_user),
):
    """Thumbnail первого среза исследования (для списка в UI)."""
    try:
        png_bytes, content_type = await pacs_facade.get_study_thumbnail(study_id)
        return Response(content=png_bytes, media_type=content_type)
    except pacs_facade.PACSError as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)


# ======================== PATIENT / ORDER ========================


@router.get(
    "/patients/{patient_id}/studies",
    summary="Снимки пациента по внутреннему ID",
)
async def get_patient_studies(
    patient_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Все DICOM-исследования, связанные с пациентом (по PatientID в DICOM)."""
    try:
        return await pacs_facade.get_patient_studies(db, patient_id)
    except pacs_facade.PACSError as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)


@router.get(
    "/orders/{order_id}/dicom",
    summary="DICOM-данные по RIS-заказу",
)
async def get_order_dicom(
    order_id: str,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Список DICOM-исследований, связанных с RIS-заказом (через ris.studies)."""
    try:
        return await pacs_facade.get_order_dicom(db, order_id)
    except pacs_facade.PACSError as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)
