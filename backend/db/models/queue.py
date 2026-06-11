"""Модели электронной очереди (схема `queue`).

Таблицы:
- cabinets       — кабинеты (КТ, МРТ, рентген, …)
- patients       — карточки пациентов (одна запись на пациента, чтобы не дублировать ФИО)
- tickets        — талоны электронной очереди
- ticket_events  — журнал переходов талона (waiting → in_progress → done/cancelled)
"""

from __future__ import annotations

import uuid
from datetime import datetime
from enum import Enum

from sqlalchemy import (
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


class TicketStatus(str, Enum):
    WAITING = "waiting"
    IN_PROGRESS = "in_progress"
    DONE = "done"
    CANCELLED = "cancelled"


class TicketEventType(str, Enum):
    CREATED = "created"
    CALLED = "called"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    STATUS_CHANGED = "status_changed"


class Cabinet(Base):
    """Кабинет исследования. Связывает код кабинета с модальностью."""

    __tablename__ = "cabinets"
    __table_args__ = ({"schema": "queue"},)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    code: Mapped[str] = mapped_column(String(8), unique=True, nullable=False)  # "101"
    name: Mapped[str] = mapped_column(String(128), nullable=False)             # "КТ-кабинет"
    modality: Mapped[str] = mapped_column(String(8), nullable=False)           # "CT" / "MR" / "DX" / "US"
    is_active: Mapped[bool] = mapped_column(default=True, nullable=False)

    tickets: Mapped[list["Ticket"]] = relationship(back_populates="cabinet")


class Patient(Base):
    """Карточка пациента.

    Выделена в отдельную сущность, чтобы:
    - не дублировать ФИО/полис в каждом талоне;
    - хранить историю визитов;
    - в будущем — интегрироваться с МИС.
    """

    __tablename__ = "patients"
    __table_args__ = ({"schema": "queue"},)

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    full_name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    iin: Mapped[str | None] = mapped_column(String(12), unique=True, index=True, comment="ИИН (12 цифр)")
    # Полис ОМС / СНИЛС / иной идентификатор
    policy_number: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    birth_date: Mapped[datetime | None] = mapped_column(DateTime)
    phone: Mapped[str | None] = mapped_column(String(32))
    notes: Mapped[str | None] = mapped_column(Text)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    tickets: Mapped[list["Ticket"]] = relationship(back_populates="patient")


class Ticket(Base):
    """Талон электронной очереди."""

    __tablename__ = "tickets"
    __table_args__ = (
        UniqueConstraint("ticket_number", name="uq_ticket_number"),
        CheckConstraint(
            "status IN ('waiting','in_progress','done','cancelled')",
            name="ck_ticket_status",
        ),
        Index("ix_ticket_cabinet_status", "cabinet_id", "status"),
        Index("ix_ticket_created_at", "created_at"),
        {"schema": "queue"},
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    ticket_number: Mapped[str] = mapped_column(String(16), nullable=False)
    status: Mapped[str] = mapped_column(
        String(16), nullable=False, default=TicketStatus.WAITING.value
    )

    patient_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("queue.patients.id", ondelete="RESTRICT"),
        nullable=False,
    )
    cabinet_id: Mapped[int] = mapped_column(
        ForeignKey("queue.cabinets.id", ondelete="RESTRICT"),
        nullable=False,
    )
    # Ссылка на заказ в RIS (создаётся при регистрации, может быть NULL если RIS недоступен)
    order_id: Mapped[str | None] = mapped_column(String(64), index=True)
    study_uid: Mapped[str | None] = mapped_column(String(128))

    called_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    patient: Mapped[Patient] = relationship(back_populates="tickets")
    cabinet: Mapped[Cabinet] = relationship(back_populates="tickets")
    events: Mapped[list["TicketEvent"]] = relationship(
        back_populates="ticket",
        cascade="all, delete-orphan",
        order_by="TicketEvent.created_at",
    )


class TicketEvent(Base):
    """Запись в журнале переходов талона. Append-only."""

    __tablename__ = "ticket_events"
    __table_args__ = (
        Index("ix_event_ticket", "ticket_id", "created_at"),
        {"schema": "queue"},
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    ticket_id: Mapped[int] = mapped_column(
        ForeignKey("queue.tickets.id", ondelete="CASCADE"),
        nullable=False,
    )
    event_type: Mapped[str] = mapped_column(String(32), nullable=False)
    from_status: Mapped[str | None] = mapped_column(String(16))
    to_status: Mapped[str | None] = mapped_column(String(16))
    actor_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("auth.users.id", ondelete="SET NULL"),
    )
    payload: Mapped[str | None] = mapped_column(Text)  # JSON-строка с доп. данными
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    ticket: Mapped[Ticket] = relationship(back_populates="events")
