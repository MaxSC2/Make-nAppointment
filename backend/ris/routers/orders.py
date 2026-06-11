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
import logging
import uuid
from datetime import datetime, timezone
from typing import Annotated

import httpx

logger = logging.getLogger("ris.orders")
import pydicom
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import Response
from pydicom.dataset import Dataset
from sqlalchemy import func, or_, select
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
    OrderListResponse,
    OrderOut,
    OrderStatusUpdate,
    ProtocolOut,
    ProtocolUpdate,
    StudyOut,
)


router = APIRouter(prefix="/api", tags=["ris"])

_http_client: httpx.AsyncClient | None = None


def _get_client() -> httpx.AsyncClient:
    global _http_client
    if _http_client is None:
        _http_client = httpx.AsyncClient(
            timeout=httpx.Timeout(60.0),
            limits=httpx.Limits(max_connections=10, max_keepalive_connections=5),
        )
    return _http_client


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

@router.get("/orders", response_model=OrderListResponse)
async def list_orders(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
    status_filter: str | None = None,
    modality: str | None = None,
    priority: str | None = None,
    patient_id: uuid.UUID | None = None,
    search: str | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    sort_by: str = "created_at",
    sort_dir: str = "desc",
    limit: int = 50,
    offset: int = 0,
) -> OrderListResponse:
    """Список заказов с фильтрацией, сортировкой и пагинацией.

    Фильтры:
    - status_filter: scheduled | in_progress | completed | cancelled
    - modality: CT | MR | DX | US
    - priority: normal | urgent | stat
    - patient_id: UUID пациента
    - search: подстрочное совпадение по ФИО пациента или study_description
    - date_from / date_to: диапазон дат по created_at (ISO 8601)

    Сортировка: sort_by = created_at | scheduled_for | completed_at, sort_dir = asc | desc

    Пагинация: limit (макс 500), offset
    """
    limit = min(max(limit, 1), 500)
    offset = max(offset, 0)

    # Базовый запрос с join для поиска по ФИО
    stmt = select(Order)

    if status_filter:
        if status_filter not in {s.value for s in OrderStatus}:
            raise HTTPException(status_code=400, detail=f"Invalid status: {status_filter}")
        stmt = stmt.where(Order.status == status_filter)
    if modality:
        stmt = stmt.where(Order.modality == modality)
    if priority:
        stmt = stmt.where(Order.priority == priority)
    if patient_id:
        stmt = stmt.where(Order.patient_id == patient_id)
    if date_from:
        stmt = stmt.where(Order.created_at >= date_from)
    if date_to:
        stmt = stmt.where(Order.created_at <= date_to)
    if search:
        # ILIKE по study_description + ФИО пациента через join
        from db.models.queue import Patient
        stmt = stmt.join(Patient, Patient.id == Order.patient_id, isouter=True)
        search_pattern = f"%{search}%"
        stmt = stmt.where(
            or_(
                Order.study_description.ilike(search_pattern),
                Patient.full_name.ilike(search_pattern),
                Patient.policy_number.ilike(search_pattern),
            )
        )

    # Сортировка (с вторичным ключом для детерминированности)
    sort_columns = {
        "created_at": Order.created_at,
        "scheduled_for": Order.scheduled_for,
        "completed_at": Order.completed_at,
        "priority": Order.priority,
    }
    sort_col = sort_columns.get(sort_by, Order.created_at)
    direction = sort_col.desc() if sort_dir == "desc" else sort_col.asc()
    stmt = stmt.order_by(direction, Order.id.asc())  # secondary key для стабильности

    # Total count (для пагинации)
    count_stmt = select(func.count()).select_from(stmt.subquery())
    total = (await db.execute(count_stmt)).scalar_one()

    # Paginate
    stmt = stmt.limit(limit).offset(offset)
    items = list((await db.execute(stmt)).scalars().unique().all())

    return OrderListResponse(
        items=items,
        total=total,
        limit=limit,
        offset=offset,
        has_more=(offset + len(items)) < total,
    )


@router.post(
    "/orders",
    response_model=OrderOut,
    status_code=status.HTTP_201_CREATED,
)
async def create_order(
    body: OrderCreateRequest,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(require_role(RoleCode.REGISTRAR, RoleCode.DOCTOR, RoleCode.TECHNICIAN, RoleCode.ADMIN))],
) -> Order:
    """Создаёт заказ на исследование + отправляет минимальный DICOM в Orthanc.

    Доступ: registrar (создаёт направления), doctor, technician, admin.
    """
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

    # 5. Отправляем метаданные в Orthanc (best-effort) и сохраняем связь
    orthanc_id = None
    try:
        orthanc_id = await _send_metadata_to_orthanc(patient, order, study_uid)
        if orthanc_id:
            db.add(Study(
                order_id=order.id,
                orthanc_id=orthanc_id,
                is_uploaded=True,
                uploaded_at=now,
            ))
    except Exception as e:
        logger.warning("Orthanc недоступен: %s", e)

    try:
        await db.commit()
    except Exception:
        await db.rollback()
        logger.warning("Failed to link Orthanc study, order created without link")
        await db.commit()

    await db.refresh(order)
    await _audit(request, db, action=AuditAction.ORDER_CREATED.value,
                 resource_type="order", resource_id=order.id)
    return order


@router.get("/orders/{order_id}", response_model=OrderOut)
async def get_order(
    order_id: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> Order:
    order = (await db.execute(select(Order).where(Order.id == order_id))).scalar_one_or_none()
    if order is None:
        raise HTTPException(status_code=404, detail="Order not found")
    return order


@router.patch("/orders/{order_id}/status")
async def update_status(
    order_id: str,
    request: Request,
    body: dict,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(require_role(RoleCode.DOCTOR, RoleCode.TECHNICIAN, RoleCode.ADMIN))],
) -> dict:
    """Меняет статус заказа (scheduled → in_progress → completed).

    Body: {"status": "in_progress"}
    """
    new_status = body.get("status")
    if not new_status or new_status not in {s.value for s in OrderStatus}:
        raise HTTPException(status_code=400, detail=f"Invalid status: {new_status}")

    order = (await db.execute(select(Order).where(Order.id == order_id))).scalar_one_or_none()
    if order is None:
        raise HTTPException(status_code=404, detail="Order not found")

    old_status = order.status
    order.status = new_status
    now = datetime.now(timezone.utc)
    if new_status == OrderStatus.IN_PROGRESS.value and order.started_at is None:
        order.started_at = now
    elif new_status == OrderStatus.COMPLETED.value:
        order.completed_at = now

    await db.commit()
    await _audit(request, db, action=AuditAction.ORDER_STATUS_CHANGED.value,
                 resource_type="order", resource_id=order.id,
                 extra={"from": old_status, "to": new_status})
    return {"ok": True, "status": new_status}


# ======================== ИССЛЕДОВАНИЯ ========================

@router.get("/orders/{order_id}/studies", response_model=list[StudyOut])
async def list_order_studies(
    order_id: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> list[Study]:
    stmt = select(Study).where(Study.order_id == order_id).order_by(Study.id)
    return list((await db.execute(stmt)).scalars().all())


@router.get("/studies", response_model=list[OrderOut])
async def list_studies(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
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
    user: Annotated[User, Depends(get_current_user)],
) -> Protocol:
    """Получить протокол заказа. Доступ: все авторизованные (doctor, technician, admin, registrar)."""
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
    """Создаёт или обновляет протокол. Подписание — отдельный эндпоинт.

    Нельзя редактировать подписанный протокол. Для изменения нужно:
    - либо admin может отозвать подпись через DELETE /protocol/sign
    - либо нельзя редактировать вообще (конфликт 409)
    """
    order = (await db.execute(select(Order).where(Order.id == order_id))).scalar_one_or_none()
    if order is None:
        raise HTTPException(status_code=404, detail="Order not found")

    proto = (await db.execute(
        select(Protocol).where(Protocol.order_id == order_id)
    )).scalar_one_or_none()

    if proto is None:
        # Создание нового
        proto = Protocol(order_id=order_id, body=body.body, impression=body.impression)
        db.add(proto)
    else:
        # Обновление существующего — запрещено, если подписан
        if not proto.is_draft and proto.signed_at is not None:
            raise HTTPException(
                status_code=409,
                detail=(
                    f"Protocol is signed at {proto.signed_at.isoformat()} and cannot be edited. "
                    "Ask admin to revoke the signature first."
                ),
            )
        proto.body = body.body
        proto.impression = body.impression

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
    """Подписать протокол (финализирует заключение).

    - Нельзя подписать пустой протокол (400)
    - Нельзя подписать уже подписанный (409)
    - При подписании автоматически завершает Order
    """
    proto = (await db.execute(
        select(Protocol).where(Protocol.order_id == order_id)
    )).scalar_one_or_none()
    if proto is None:
        raise HTTPException(status_code=404, detail="Protocol not found")
    if not proto.body.strip():
        raise HTTPException(status_code=400, detail="Empty protocol body")
    if not proto.is_draft and proto.signed_at is not None:
        raise HTTPException(
            status_code=409,
            detail=f"Protocol already signed at {proto.signed_at.isoformat()}",
        )

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


@router.delete("/orders/{order_id}/protocol/sign", response_model=ProtocolOut)
async def revoke_protocol_signature(
    order_id: str,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(require_role(RoleCode.ADMIN))],
) -> Protocol:
    """Отозвать подпись протокола (только admin).

    Возвращает протокол в статус draft. После этого можно редактировать.
    Записывается в audit_log как отдельное событие PROTOCOL_REVOKED.
    """
    proto = (await db.execute(
        select(Protocol).where(Protocol.order_id == order_id)
    )).scalar_one_or_none()
    if proto is None:
        raise HTTPException(status_code=404, detail="Protocol not found")
    if proto.is_draft or proto.signed_at is None:
        raise HTTPException(status_code=409, detail="Protocol is not signed")

    old_signer = proto.signed_by
    old_signed_at = proto.signed_at
    proto.is_draft = True
    proto.signed_at = None
    proto.signed_by = None

    # НЕ откатываем статус Order — это бизнес-решение, оставляем completed

    await db.commit()
    await db.refresh(proto)
    await _audit(
        request, db,
        action=AuditAction.PROTOCOL_REVOKED.value,
        resource_type="protocol",
        resource_id=str(proto.id),
        extra={
            "revoked_from_user": str(old_signer) if old_signer else None,
            "revoked_signed_at": old_signed_at.isoformat() if old_signed_at else None,
            "revoked_by": str(user.id),
        },
    )
    return proto


# ======================== СКАЧИВАНИЕ ========================

@router.get("/studies/download/{study_uid}")
async def download_study(
    study_uid: str,
    user: Annotated[User, Depends(get_current_user)],
) -> Response:
    """Скачать исследование как ZIP с DICOM-файлами через Orthanc archive."""
    client = _get_client()
    find_resp = await client.post(
        f"{settings.orthanc_url}/tools/find",
        json={"Level": "Study", "Query": {"StudyInstanceUID": study_uid}},
        timeout=60,
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
    client = _get_client()
    resp = await client.request(
        method=request.method,
        url=url,
        content=body if body else None,
        timeout=30,
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
) -> str | None:
    """Создаёт минимальный DICOM (только метаданные) и загружает в Orthanc.

    Возвращает orthanc_id загруженного инстанса или None при ошибке.
    """
    ds = Dataset()
    ds.SpecificCharacterSet = "ISO_IR 192"  # UTF-8 для кириллицы
    ds.PatientName = patient.full_name
    ds.PatientID = patient.iin or str(patient.id)  # ИИН как PatientID, фолбэк на UUID
    ds.StudyDescription = order.study_description or "Routine"
    ds.Modality = order.modality
    ds.StudyInstanceUID = study_uid
    ds.SeriesInstanceUID = _generate_dicom_uid()
    ds.SOPInstanceUID = _generate_dicom_uid()
    ds.SOPClassUID = "1.2.840.10008.5.1.4.1.1.2"  # CT Image Storage (по умолчанию)
    ds.AccessionNumber = order.id  # для матчинга в PACS-фасаде (фолбэк)

    ds.file_meta = pydicom.Dataset()
    ds.file_meta.MediaStorageSOPClassUID = ds.SOPClassUID
    ds.file_meta.MediaStorageSOPInstanceUID = ds.SOPInstanceUID
    ds.file_meta.ImplementationClassUID = _generate_dicom_uid()
    ds.is_implicit_VR = True
    ds.is_little_endian = True

    buf = io.BytesIO()
    ds.save_as(buf)
    client = _get_client()
    resp = await client.post(
        f"{settings.orthanc_url}/instances",
        content=buf.getvalue(),
        headers={"Content-Type": "application/dicom"},
        timeout=5,
    )
    if resp.status_code == 200:
        orthanc_id = resp.json().get("ID", "")
        logger.info("Orthanc study %s создан для order %s", orthanc_id, order.id)
        return orthanc_id
    else:
        logger.error("Orthanc error %s: %s", resp.status_code, resp.text)
        return None


async def _audit(
    request: Request,
    db: AsyncSession,
    action: str,
    resource_type: str | None = None,
    resource_id: str | None = None,
    extra: dict | None = None,
) -> None:
    user_obj = getattr(request.state, "user", None)
    user_id = getattr(request.state, "user_id", None) or (
        user_obj.id if user_obj else None
    )
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
        logger.warning("audit log rollback", exc_info=True)
        await db.rollback()
