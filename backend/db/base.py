"""Декларативная база SQLAlchemy + общие миксины.

Импортируйте отсюда `Base` во все модули моделей:

    from db.base import Base

    class MyModel(Base):
        __tablename__ = "my_table"
        ...
"""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, MetaData, func
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


# Единый стиль именования ограничений — Alembic генерирует предсказуемые имена
NAMING_CONVENTION: dict[str, str] = {
    "ix": "ix_%(column_0_label)s",
    "uq": "uq_%(table_name)s_%(column_0_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}

# MetaData с явными схемами и шаблоном именования
metadata = MetaData(
    naming_convention=NAMING_CONVENTION,
    schema="public",  # конкретные схемы указываются в __table_args__ у моделей
)


class Base(DeclarativeBase):
    """Корневая декларативная база для всех моделей проекта."""

    metadata = metadata


class TimestampMixin:
    """Миксин с created_at / updated_at, обновляемыми PostgreSQL-триггерами.

    Поля NOT NULL; updated_at обновляется вручную в коде (onupdate)
    и через server-side default.
    """

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )
