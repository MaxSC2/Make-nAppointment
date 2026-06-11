"""Миграция: обновить series_count и instance_count в ris.studies из реальных данных Orthanc.

Запуск:
    cd C:\\Projects\\ARCHIVE\\MedPlatform\\backend
    python -m db.migrate_study_counts
"""
from __future__ import annotations

import asyncio
import logging
from typing import Iterable

import httpx
from sqlalchemy import select

from db.config import settings
from db.models.ris import Study
from db.session import async_session_maker

logger = logging.getLogger("db.migrate_study_counts")


async def _fetch_orthanc_counts(orthanc_ids: Iterable[str]) -> dict[str, tuple[int, int]]:
    """Для каждого orthanc_id возвращает (series_count, instance_count)."""
    out: dict[str, tuple[int, int]] = {}
    async with httpx.AsyncClient(
        timeout=httpx.Timeout(10.0),
    ) as client:
        for oid in orthanc_ids:
            try:
                r = await client.get(f"{settings.orthanc_url}/studies/{oid}")
                if r.status_code == 200:
                    info = r.json()
                    series = len(info.get("Series", []) or [])
                    instances = len(info.get("Instances", []) or [])
                    out[oid] = (series, instances)
                elif r.status_code == 404:
                    logger.warning("Orthanc study %s не найден (404)", oid)
                    out[oid] = (0, 0)
                else:
                    logger.warning("Orthanc error %s для %s: %s", r.status_code, oid, r.text[:200])
            except Exception as e:
                logger.warning("Orthanc недоступен для %s: %s", oid, e)
    return out


async def main() -> None:
    print("=== migrate_study_counts: начало ===")
    async with async_session_maker() as db:
        rows = (await db.execute(select(Study.orthanc_id))).scalars().all()
        orthanc_ids = [r for r in rows if r]
        print(f"  Найдено {len(orthanc_ids)} studies в БД")

        counts = await _fetch_orthanc_counts(orthanc_ids)
        print(f"  Получены реальные counts для {len(counts)} studies из Orthanc")

        updated = 0
        for oid, (series, instances) in counts.items():
            study = (await db.execute(
                select(Study).where(Study.orthanc_id == oid)
            )).scalar_one_or_none()
            if study is None:
                continue
            if study.series_count != series or study.instance_count != instances:
                study.series_count = series
                study.instance_count = instances
                updated += 1

        await db.commit()
        print(f"  ✓ Обновлено {updated} studies")

    print("=== migrate_study_counts: готово ===")


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    asyncio.run(main())
