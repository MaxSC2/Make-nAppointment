"""Модели RIS (схема `ris`).

Таблицы:
- orders      — заказы на исследования (соответствует исходной SQLite `orders`)
- studies     — исследования (DICOM-серии, фактически загруженные в Orthanc)
- protocols   — текстовые заключения врача, привязанные к заказу
- modalities  — справочник модальностей (CT, MR, DX, US, XA, …)
"""

from __future__ import annotations

import uuid
from datetime import datetime
from enum import Enum

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from db.base import Base, TimestampMixin


class OrderStatus(str, Enum):
    SCHEDULED = "scheduled"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class Modality(Base):
    """Справочник модальностей (КТ, МРТ, рентген, …)."""

    __tablename__ = "modalities"
    __table_args__ = ({"schema": "ris"},)

    code: Mapped[str] = mapped_column(String(8), primary_key=True)  # "CT", "MR", …
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)


class Order(Base):
    """Заказ на исследование.

    Связи:
    - patient — карточка пациента из схемы queue
    - studies — загруженные DICOM-серии
    - protocol — заключение врача (одно заключение на заказ)
    """

    __tablename__ = "orders"
    __table_args__ = (
        CheckConstraint(
            "status IN ('scheduled','in_progress','completed','cancelled')",
            name="ck_order_status",
        ),
        Index("ix_order_status", "status"),
        Index("ix_order_patient", "patient_id"),
        Index("ix_order_study_uid", "study_uid"),
        Index("ix_order_source_ticket", "source_ticket_id"),
        UniqueConstraint("study_uid", name="uq_order_study_uid"),
        {"schema": "ris"},
    )

    id: Mapped[str] = mapped_column(String(64), primary_key=True)  # короткий ID (8 символов)

    # Пациент (из queue.patients) — НЕ дублируем ФИО, только ссылка
    patient_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("queue.patients.id", ondelete="RESTRICT"),
        nullable=False,
    )
    modality: Mapped[str] = mapped_column(
        String(8),
        ForeignKey("ris.modalities.code", ondelete="RESTRICT"),
        nullable=False,
    )
    study_uid: Mapped[str] = mapped_column(String(128), nullable=False)
    study_description: Mapped[str | None] = mapped_column(Text)
    referring_physician: Mapped[str | None] = mapped_column(String(255))

    status: Mapped[str] = mapped_column(
        String(16), nullable=False, default=OrderStatus.SCHEDULED.value
    )
    priority: Mapped[str] = mapped_column(String(8), nullable=False, default="normal")
    scheduled_for: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    source_ticket_id: Mapped[str | None] = mapped_column(
        String(64), nullable=True
    )
    source_ticket_number: Mapped[str | None] = mapped_column(
        String(32), nullable=True
    )
    source_system: Mapped[str | None] = mapped_column(
        String(32), nullable=True
    )
    smartq_called_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    created_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("auth.users.id", ondelete="SET NULL"),
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(),
        onupdate=func.now(),
    )

    studies: Mapped[list["Study"]] = relationship(
        back_populates="order", cascade="all, delete-orphan"
    )
    protocol: Mapped["Protocol | None"] = relationship(
        back_populates="order", uselist=False, cascade="all, delete-orphan"
    )


class Study(Base):
    """Исследование, фактически загруженное в Orthanc (DICOM-серия).

    Может быть несколько Study на один Order (например, при дозагрузке
    дополнительных серий).
    """

    __tablename__ = "studies"
    __table_args__ = (
        Index("ix_study_order", "order_id"),
        UniqueConstraint("orthanc_id", name="uq_study_orthanc_id"),
        {"schema": "ris"},
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    order_id: Mapped[str] = mapped_column(
        String(64),
        ForeignKey("ris.orders.id", ondelete="CASCADE"),
        nullable=False,
    )
    # Внутренний ID исследования в Orthanc
    orthanc_id: Mapped[str] = mapped_column(String(64), nullable=False)
    series_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    instance_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    is_uploaded: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    uploaded_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    order: Mapped[Order] = relationship(back_populates="studies")


class Protocol(Base):
    """Заключение врача-рентгенолога (текстовое)."""

    __tablename__ = "protocols"
    __table_args__ = (
        UniqueConstraint("order_id", name="uq_protocol_order"),
        {"schema": "ris"},
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    order_id: Mapped[str] = mapped_column(
        String(64),
        ForeignKey("ris.orders.id", ondelete="CASCADE"),
        nullable=False,
    )
    # Заключение и рекомендации (Markdown допустим)
    body: Mapped[str] = mapped_column(Text, nullable=False, default="")
    impression: Mapped[str | None] = mapped_column(Text)  # краткий вывод
    # Состояние черновика
    is_draft: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    signed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    signed_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("auth.users.id", ondelete="SET NULL"),
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(),
        onupdate=func.now(),
    )

    order: Mapped[Order] = relationship(back_populates="protocol")
