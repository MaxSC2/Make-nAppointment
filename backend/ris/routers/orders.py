"""RIS-эндпоинты: заказы, исследования, протоколы, прокси Orthanc.

GET   /api/orders                     — список заказов
POST  /api/orders                     — создать заказ
GET   /api/orders/{id}                — детали заказа
PATCH /api/orders/{id}/status         — обновить статус
GET   /api/orders/{id}/studies        — исследования заказа
GET   /api/orders/{id}/protocol       — протокол заказа
PUT   /api/orders/{id}/protocol       — обновить/создать протокол
POST  /api/orders/{id}/protocol/sign  — подписать протокол
GET   /api/modalities                 — справочник модальностей
GET   /api/studies?modality=CT        — список исследований (агрегация)
GET   /studies                        — HTML-страница списка
GET   /viewer/{study_uid}             — HTML-страница просмотра
GET   /studies/download/{study_uid}   — скачать ZIP
*     /orthanc/{path:path}            — прокси к Orthanc
"""

from __future__ import annotations

import io
import uuid
from datetime import datetime, timezone
from typing import Annotated

import httpx
import pydicom
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import Response
from pydicom.dataset import Dataset
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from db.config import settings
from db.dependencies import get_current_user, get_db, require_role
from db.models.audit import AuditAction, AuditLog
from db.models.auth import RoleCode, User
from db.models.queue import Patient
from db.models.ris import Modality, Order, OrderStatus, Protocol, Study
from db.schemas.ris import (
    ModalityOut,
    OrderCreateRequest,
    OrderOut,
    OrderStatusUpdate,
    ProtocolOut,
    ProtocolUpdate,
    StudyOut,
)


router = APIRouter(prefix="/api", tags=["ris"])


def _generate_dicom_uid() -> str:
    """DICOM-совместимый UID: 1.2.840.<до 15 цифр без дефисов>."""
    return f"1.2.840.{str(uuid.uuid4().int)[:15]}"


# ======================== СПРАВОЧНИКИ ========================

@router.get("/modalities", response_model=list[ModalityOut])
async def list_modalities(
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[Modality]:
    result = await db.execute(select(Modality).order_by(Modality.code))
    return list(result.scalars().all())


# ======================== ЗАКАЗЫ ========================

@router.get("/orders", response_model=list[OrderOut])
async def list_orders(
    db: Annotated[AsyncSession, Depends(get_db)],
    status_filter: str | None = None,
    patient_id: uuid.UUID | None = None,
    limit: int = 100,
) -> list[Order]:
    stmt = select(Order).order_by(Order.created_at.desc()).limit(min(limit, 500))
    if status_filter:
        stmt = stmt.where(Order.status == status_filter)
    if patient_id:
        stmt = stmt.where(Order.patient_id == patient_id)
    return list((await db.execute(stmt)).scalars().all())


@router.post(
    "/orders",
    response_model=OrderOut,
    status_code=status.HTTP_201_CREATED,
)
async def create_order(
    body: OrderCreateRequest,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> Order:
    """Создаёт заказ на исследование + отправляет минимальный DICOM в Orthanc."""
    # 1. Пациент должен существовать
    patient = (await db.execute(
        select(Patient).where(Patient.id == body.patient_id)
    )).scalar_one_or_none()
    if patient is None:
        raise HTTPException(status_code=404, detail="Patient not found")

    # 2. Модальность
    modality = (await db.execute(
        select(Modality).where(Modality.code == body.modality)
    )).scalar_one_or_none()
    if modality is None:
        raise HTTPException(status_code=400, detail=f"Unknown modality: {body.modality}")

    # 3. Создаём заказ
    order_id = uuid.uuid4().hex[:8]
    study_uid = _generate_dicom_uid()
    now = datetime.now(timezone.utc)

    order = Order(
        id=order_id,
        patient_id=patient.id,
        modality=modality.code,
        study_uid=study_uid,
        study_description=body.study_description,
        referring_physician=body.referring_physician,
        status=OrderStatus.SCHEDULED.value,
        priority=body.priority,
        scheduled_for=body.scheduled_for,
        created_by=user.id,
    )
    db.add(order)
    await db.flush()

    # 4. Пустой протокол
    db.add(Protocol(order_id=order.id, body="", is_draft=True))

    # 5. Отправляем метаданные в Orthanc (best-effort)
    try:
        await _send_metadata_to_orthanc(patient, order, study_uid)
    except Exception as e:
        print(f"[ris] Orthanc недоступен: {e}")

    await db.commit()
    await db.refresh(order)
    await _audit(request, db, action=AuditAction.ORDER_CREATED.value,
                 resource_type="order", resource_id=order.id)
    return order


@router.get("/orders/{order_id}", response_model=OrderOut)
async def get_order(
    order_id: str,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> Order:
    order = (await db.execute(select(Order).where(Order.id == order_id))).scalar_one_or_none()
    if order is None:
        raise HTTPException(status_code=404, detail="Order not found")
    return order


@router.patch("/orders/{order_id}/status")
async def update_status(
    order_id: str,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(require_role(RoleCode.DOCTOR, RoleCode.TECHNICIAN, RoleCode.ADMIN))],
    status: str = "scheduled",
) -> dict:
    """Меняет статус заказа (scheduled → in_progress → completed)."""
    if status not in {s.value for s in OrderStatus}:
        raise HTTPException(status_code=400, detail=f"Invalid status: {status}")

    order = (await db.execute(select(Order).where(Order.id == order_id))).scalar_one_or_none()
    if order is None:
        raise HTTPException(status_code=404, detail="Order not found")

    old_status = order.status
    order.status = status
    now = datetime.now(timezone.utc)
    if status == OrderStatus.IN_PROGRESS.value and order.started_at is None:
        order.started_at = now
    elif status == OrderStatus.COMPLETED.value:
        order.completed_at = now

    await db.commit()
    await _audit(request, db, action=AuditAction.ORDER_STATUS_CHANGED.value,
                 resource_type="order", resource_id=order.id,
                 extra={"from": old_status, "to": status})
    return {"ok": True, "status": status}


# ======================== ИССЛЕДОВАНИЯ ========================

@router.get("/orders/{order_id}/studies", response_model=list[StudyOut])
async def list_order_studies(
    order_id: str,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[Study]:
    stmt = select(Study).where(Study.order_id == order_id).order_by(Study.id)
    return list((await db.execute(stmt)).scalars().all())


@router.get("/studies", response_model=list[OrderOut])
async def list_studies(
    db: Annotated[AsyncSession, Depends(get_db)],
    modality: str | None = None,
    limit: int = 100,
) -> list[Order]:
    """Все исследования (заказы со снимками) — для главной страницы."""
    stmt = (
        select(Order)
        .where(Order.status != OrderStatus.SCHEDULED.value)
        .order_by(Order.created_at.desc())
        .limit(min(limit, 500))
    )
    if modality:
        stmt = stmt.where(Order.modality == modality)
    return list((await db.execute(stmt)).scalars().all())


# ======================== ПРОТОКОЛЫ ========================

@router.get("/orders/{order_id}/protocol", response_model=ProtocolOut)
async def get_protocol(
    order_id: str,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> Protocol:
    proto = (await db.execute(
        select(Protocol).where(Protocol.order_id == order_id)
    )).scalar_one_or_none()
    if proto is None:
        raise HTTPException(status_code=404, detail="Protocol not found")
    return proto


@router.put("/orders/{order_id}/protocol", response_model=ProtocolOut)
async def upsert_protocol(
    order_id: str,
    body: ProtocolUpdate,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(require_role(RoleCode.DOCTOR, RoleCode.ADMIN))],
) -> Protocol:
    """Создаёт или обновляет протокол. Подписание — отдельный эндпоинт."""
    order = (await db.execute(select(Order).where(Order.id == order_id))).scalar_one_or_none()
    if order is None:
        raise HTTPException(status_code=404, detail="Order not found")

    proto = (await db.execute(
        select(Protocol).where(Protocol.order_id == order_id)
    )).scalar_one_or_none()
    if proto is None:
        proto = Protocol(order_id=order_id, body=body.body, impression=body.impression)
        db.add(proto)
    else:
        proto.body = body.body
        proto.impression = body.impression
        # Снимаем подпись при редактировании
        proto.is_draft = True
        proto.signed_at = None
        proto.signed_by = None

    await db.commit()
    await db.refresh(proto)
    await _audit(request, db, action=AuditAction.PROTOCOL_UPDATED.value,
                 resource_type="protocol", resource_id=str(proto.id))
    return proto


@router.post("/orders/{order_id}/protocol/sign", response_model=ProtocolOut)
async def sign_protocol(
    order_id: str,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(require_role(RoleCode.DOCTOR, RoleCode.ADMIN))],
) -> Protocol:
    """Подписать протокол (финализирует заключение)."""
    proto = (await db.execute(
        select(Protocol).where(Protocol.order_id == order_id)
    )).scalar_one_or_none()
    if proto is None:
        raise HTTPException(status_code=404, detail="Protocol not found")
    if not proto.body.strip():
        raise HTTPException(status_code=400, detail="Empty protocol body")

    proto.is_draft = False
    proto.signed_at = datetime.now(timezone.utc)
    proto.signed_by = user.id

    # Подписание = завершение заказа
    order = (await db.execute(select(Order).where(Order.id == order_id))).scalar_one_or_none()
    if order is not None and order.status != OrderStatus.COMPLETED.value:
        order.status = OrderStatus.COMPLETED.value
        order.completed_at = datetime.now(timezone.utc)

    await db.commit()
    await db.refresh(proto)
    await _audit(request, db, action=AuditAction.PROTOCOL_SIGNED.value,
                 resource_type="protocol", resource_id=str(proto.id))
    return proto


# ======================== СКАЧИВАНИЕ ========================

@router.get("/studies/download/{study_uid}")
async def download_study(study_uid: str) -> Response:
    """Скачать исследование как ZIP с DICOM-файлами через Orthanc archive."""
    async with httpx.AsyncClient(timeout=60) as client:
        find_resp = await client.post(
            f"{settings.orthanc_url}/tools/find",
            json={"Level": "Study", "Query": {"StudyInstanceUID": study_uid}},
        )
        if find_resp.status_code != 200 or not find_resp.json():
            raise HTTPException(status_code=404, detail="Study not found in Orthanc")

        study_id = find_resp.json()[0]
        archive_resp = await client.get(
            f"{settings.orthanc_url}/studies/{study_id}/archive",
            timeout=120,
        )
        if archive_resp.status_code != 200:
            raise HTTPException(status_code=502, detail="Failed to create archive")

    return Response(
        content=archive_resp.content,
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="study_{study_uid}.zip"'},
    )


# ======================== ПРОКСИ ORTHANC (обход CORS) ========================

@router.api_route(
    "/orthanc/{path:path}",
    methods=["POST", "PUT", "DELETE", "PATCH"],
)
async def orthanc_proxy_write(
    path: str,
    request: Request,
    user: Annotated[User, Depends(require_role(RoleCode.DOCTOR, RoleCode.TECHNICIAN, RoleCode.ADMIN))],
) -> Response:
    """Запись в Orthanc (upload/delete) — только для авторизованных с ролью."""
    return await _orthanc_forward(path, request)


@router.api_route("/orthanc/{path:path}", methods=["GET"])
async def orthanc_proxy_read(
    path: str,
    request: Request,
    current_user: Annotated[User, Depends(get_current_user)],
) -> Response:
    """Чтение DICOM (tags/preview/archive)."""
    return await _orthanc_forward(path, request)


async def _orthanc_forward(path: str, request: Request) -> Response:
    url = f"{settings.orthanc_url}/{path}"
    body = await request.body()
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.request(
            method=request.method,
            url=url,
            content=body if body else None,
        )
    content_type = resp.headers.get("content-type", "application/octet-stream")
    return Response(
        content=resp.content,
        status_code=resp.status_code,
        media_type=content_type,
    )


# ======================== СЛУЖЕБНОЕ ========================

async def _send_metadata_to_orthanc(
    patient: Patient,
    order: Order,
    study_uid: str,
) -> None:
    """Создаёт минимальный DICOM (только метаданные) и загружает в Orthanc."""
    ds = Dataset()
    ds.PatientName = patient.full_name
    ds.PatientID = str(patient.id)
    ds.StudyDescription = order.study_description or "Routine"
    ds.Modality = order.modality
    ds.StudyInstanceUID = study_uid
    ds.SeriesInstanceUID = _generate_dicom_uid()
    ds.SOPInstanceUID = _generate_dicom_uid()
    ds.SOPClassUID = "1.2.840.10008.5.1.4.1.1.2"  # CT Image Storage (по умолчанию)

    ds.file_meta = pydicom.Dataset()
    ds.file_meta.MediaStorageSOPClassUID = ds.SOPClassUID
    ds.file_meta.MediaStorageSOPInstanceUID = ds.SOPInstanceUID
    ds.file_meta.ImplementationClassUID = _generate_dicom_uid()
    ds.is_implicit_VR = True
    ds.is_little_endian = True

    buf = io.BytesIO()
    ds.save_as(buf)
    async with httpx.AsyncClient(timeout=5) as client:
        resp = await client.post(
            f"{settings.orthanc_url}/instances",
            content=buf.getvalue(),
            headers={"Content-Type": "application/dicom"},
        )
        if resp.status_code == 200:
            orthanc_id = resp.json().get("ID", "")
            print(f"[ris] Orthanc study {orthanc_id} создан для order {order.id}")
        else:
            print(f"[ris] Orthanc error {resp.status_code}: {resp.text}")


async def _audit(
    request: Request,
    db: AsyncSession,
    action: str,
    resource_type: str | None = None,
    resource_id: str | None = None,
    extra: dict | None = None,
) -> None:
    user_id = getattr(request.state, "user_id", None)
    db.add(AuditLog(
        user_id=user_id,
        action=action,
        resource_type=resource_type,
        resource_id=resource_id,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
        extra=extra,
    ))
    try:
        await db.commit()
    except Exception:
        await db.rollback()
