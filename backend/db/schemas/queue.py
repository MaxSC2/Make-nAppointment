"""DTO электронной очереди."""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class CabinetOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    code: str
    name: str
    modality: str
    is_active: bool


class PatientCreate(BaseModel):
    full_name: str = Field(min_length=1, max_length=255)
    policy_number: str = Field(min_length=1, max_length=64)
    birth_date: datetime | None = None
    phone: str | None = Field(default=None, max_length=32)
    notes: str | None = None


class PatientOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    full_name: str
    policy_number: str
    birth_date: datetime | None
    phone: str | None
    created_at: datetime


class TicketCreateRequest(BaseModel):
    """Запрос на регистрацию пациента в очереди."""

    full_name: str = Field(min_length=1, max_length=255)
    policy_number: str = Field(min_length=1, max_length=64)
    cabinet_code: str = Field(default="101", description="Код кабинета (101, 102, …)")
    phone: str | None = None
    birth_date: datetime | None = None
    priority: str = Field(default="normal", pattern=r"^(normal|urgent|stat)$",
                          description="Приоритет: normal / urgent / stat")


class TicketOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    ticket_number: str
    status: str
    cabinet_id: int
    patient_id: uuid.UUID
    order_id: str | None
    study_uid: str | None
    called_at: datetime | None
    completed_at: datetime | None
    created_at: datetime


class TicketDetail(TicketOut):
    """Талон + сведения о пациенте и кабинете (для UI)."""

    patient: PatientOut
    cabinet: CabinetOut
    priority: str | None = None  # из связанного Order (scheduled, urgent, stat)


class TicketEventOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    ticket_id: int
    event_type: str
    from_status: str | None
    to_status: str | None
    created_at: datetime


class NextCallRequest(BaseModel):
    cabinet_code: str = Field(default="101")


class CompleteRequest(BaseModel):
    ticket_number: str
    protocol: str | None = Field(default=None, max_length=8192)
