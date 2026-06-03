"""DTO RIS: заказы, исследования, протоколы."""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class OrderCreateRequest(BaseModel):
    patient_id: uuid.UUID
    modality: str = Field(min_length=2, max_length=8, description="CT / MR / DX / US / …")
    study_description: str | None = None
    referring_physician: str | None = None
    priority: str = Field(default="normal", pattern=r"^(normal|urgent|stat)$")
    scheduled_for: datetime | None = None


class OrderOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    patient_id: uuid.UUID
    modality: str
    study_uid: str
    study_description: str | None
    referring_physician: str | None
    status: str
    priority: str
    scheduled_for: datetime | None
    started_at: datetime | None
    completed_at: datetime | None
    created_at: datetime
    updated_at: datetime


class OrderStatusUpdate(BaseModel):
    status: str = Field(pattern=r"^(scheduled|in_progress|completed|cancelled)$")
    note: str | None = None


class StudyOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    order_id: str
    orthanc_id: str
    series_count: int
    instance_count: int
    is_uploaded: bool
    uploaded_at: datetime | None


class ProtocolUpdate(BaseModel):
    body: str = Field(default="", max_length=65536)
    impression: str | None = Field(default=None, max_length=4096)


class ProtocolOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    order_id: str
    body: str
    impression: str | None
    is_draft: bool
    signed_at: datetime | None
    signed_by: uuid.UUID | None
    created_at: datetime
    updated_at: datetime


class ModalityOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    code: str
    name: str
    description: str | None
