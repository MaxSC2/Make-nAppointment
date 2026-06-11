"""Async-движок и фабрика сессий SQLAlchemy.

Использование:
    from db.session import async_session_maker

    async with async_session_maker() as session:
        result = await session.execute(select(User))
"""

from __future__ import annotations

from collections.abc import AsyncIterator

from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from db.config import settings


def make_engine(url: str | None = None) -> AsyncEngine:
    """Создаёт AsyncEngine с пулом соединений.

    Параметры пула применяются ТОЛЬКО для PostgreSQL — у SQLite свой StaticPool,
    который не принимает pool_size/max_overflow.
    """
    actual_url = url or settings.database_url
    is_sqlite = actual_url.startswith("sqlite")

    kwargs: dict = dict(
        echo=settings.db_echo,
        future=True,
    )
    if not is_sqlite:
        kwargs.update(
            pool_size=settings.db_pool_size,
            max_overflow=settings.db_max_overflow,
            pool_pre_ping=True,
            pool_recycle=1800,
        )
    return create_async_engine(actual_url, **kwargs)


# Глобальный движок приложения (импортируется напрямую)
engine: AsyncEngine = make_engine()

# Фабрика сессий: каждая сессия — отдельная транзакция
async_session_maker: async_sessionmaker[AsyncSession] = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,   # объекты живут и после commit
    autoflush=False,          # flush контролируем вручную
)


async def get_session() -> AsyncIterator[AsyncSession]:
    """FastAPI Depends: открывает сессию на время запроса, гарантированно закрывает.

    Использование:
        @router.get("/items")
        async def list_items(session: AsyncSession = Depends(get_session)):
            ...
    """
    async with async_session_maker() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
