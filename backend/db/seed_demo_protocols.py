"""Заполнить протоколы для демо: реалистичные заключения для 3-5 последних заказов."""
import asyncio
from datetime import datetime, timezone

from sqlalchemy import select

from db.models.auth import User
from db.models.queue import Patient  # noqa: F401  нужно для FK
from db.models.ris import Order, OrderStatus, Protocol
from db.session import async_session_maker

SAMPLES = {
    "CT": (
        "ПРОТОКОЛ КТ-исследования\n\n"
        "Органы: грудная клетка\n"
        "Контрастирование: да, Омнипак 350 мг — 100 мл в/в\n"
        "Толщина среза: 1 мм\n\n"
        "ОПИСАНИЕ:\n"
        "На серии компьютерных томограмм органов грудной клетки в стандартных проекциях "
        "с толщиной среза 1 мм, выполненных с внутривенным болюсным контрастированием, "
        "определяется: легочные поля прозрачные, без очаговых и инфильтративных изменений. "
        "Корни легких структурные, не расширены. Средостение не смещено, не расширено. "
        "Трахея и бронхи проходимы. Свободной жидкости в плевральных полостях не выявлено.\n"
        "Сердце в размерах не увеличено, перикард без особенностей.\n\n"
        "ЗАКЛЮЧЕНИЕ:\n"
        "КТ-картина без очаговых изменений в легких и средостении. "
        "Рекомендовано: динамическое наблюдение.\n"
    ),
    "MR": (
        "ПРОТОКОЛ МРТ-исследования\n\n"
        "Режимы: T1, T2, FLAIR, DWI\n"
        "Контрастирование: да, Гадовист 7.5 мл в/в\n\n"
        "ОПИСАНИЕ:\n"
        "На серии МР-томограмм головного мозга в стандартных проекциях, выполненных "
        "в режимах T1, T2, FLAIR, DWI, с внутривенным контрастированием, очаговых "
        "изменений в веществе головного мозга не выявлено. Срединные структуры "
        "не смещены. Желудочковая система не расширена. Цистерны основания мозга "
        "не деформированы. Субарахноидальные пространства не расширены.\n\n"
        "ЗАКЛЮЧЕНИЕ:\n"
        "МР-картина без очаговых изменений головного мозга. "
        "Возрастная норма.\n"
    ),
    "DX": (
        "ПРОТОКОЛ рентгенографии\n\n"
        "Укладка: стандартная\n"
        "Проекция: прямая и боковая\n\n"
        "ОПИСАНИЕ:\n"
        "На рентгенограммах органов грудной клетки в прямой и боковой проекциях: "
        "легочные поля прозрачные, очаговых теней не определяется. "
        "Корни легких структурные, не расширены. Синусы свободные. "
        "Сердце в размерах не увеличено.\n\n"
        "ЗАКЛЮЧЕНИЕ:\n"
        "Рентген-картина органов грудной клетки без патологии. "
        "Норма.\n"
    ),
}

IMPRESSIONS = {
    "CT": "Без патологии. Рекомендовано наблюдение.",
    "MR": "Без очаговых изменений. Возрастная норма.",
    "DX": "Без патологии. Норма.",
}


async def main():
    print("=== seed_demo_protocols ===")
    async with async_session_maker() as db:
        # Берём 3 последних заказа с пустым протоколом
        orders = (await db.execute(
            select(Order, Protocol)
            .join(Protocol, Protocol.order_id == Order.id)
            .where(Protocol.body == "")
            .order_by(Order.created_at.desc())
            .limit(3)
        )).all()

        admin = (await db.execute(
            select(User).where(User.username == "admin")
        )).scalar_one_or_none()

        signed_count = 0
        for order, proto in orders:
            template = SAMPLES.get(order.modality, SAMPLES["CT"])
            proto.body = template
            proto.impression = IMPRESSIONS.get(order.modality, "Норма")
            if admin is not None:
                proto.is_draft = False
                proto.signed_at = datetime.now(timezone.utc)
                proto.signed_by = admin.id
                signed_count += 1
            # Также обновляем статус заказа
            order.status = OrderStatus.COMPLETED.value
            order.completed_at = datetime.now(timezone.utc)
            print(f"  [+] Заполнен + подписан протокол для order {order.id} ({order.modality})")

        await db.commit()
        print(f"  [OK] Заполнено и подписано {signed_count} протоколов")
    print("=== готово ===")


if __name__ == "__main__":
    asyncio.run(main())
