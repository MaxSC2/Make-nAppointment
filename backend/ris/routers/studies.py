"""RIS-роутер: PACS-фасад (исследования, инстансы, превью).

PACS-фасад скрывает Orthanc от frontend. Frontend работает только с этими
эндпоинтами, не зная про /orthanc/*.

Эндпоинты:
- GET /api/v1/studies                       — список DICOM-исследований (Orthanc + JOIN)
- GET /api/v1/studies/{study_uid}           — детали + серии + инстансы + RIS order
- GET /api/v1/studies/{study_uid}/preview   — превью первого среза (PNG)
- GET /api/v1/instances/{instance_id}/preview       — превью среза
- GET /api/v1/instances/{instance_id}/dicom-tags    — DICOM-теги
- GET /api/v1/patients/{patient_id}/studies         — все снимки пациента
- GET /api/v1/orders/{order_id}/dicom               — DICOM-данные по заказу

Все ошибки — на русском (PACS-фасад скрывает детали Orthanc).
"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession

from db.dependencies import get_current_user, get_db
from ris.services import pacs_facade


router = APIRouter(prefix="/api/v1", tags=["PACS-фасад (исследования)"])


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
