# TRACKER — Интеграция со SmartQ (NikNebog)

**Дата старта:** 09.06.2026
**Цель:** наш РИС → реальный SmartQ + Yutkar/frontend для наглядности

---

## Шаги

| # | Шаг | Статус | Дата |
|---|-----|--------|------|
| 1 | Анализ SmartQ API | ✅ | 09.06 утро |
| 2 | SmartQ-клиент (httpx + JWT + respx-тесты) | ✅ | 09.06 утро |
| 3 | Роутер `queue_integration` (7 эндпоинтов) | ✅ | 09.06 |
| 4 | Webhook от SmartQ → наш РИС | ⏳ | — |
| 5 | Миграция БД (3 поля + index в `Order`) | ✅ | 09.06 |
| 6 | Frontend UI (queue.ts + компонент) | ⏳ | — |
| 7 | Playwright E2E | ⏳ | — |
| 8 | **Реальный SmartQ + Yutkar/frontend** | ✅ | 09.06 вечер |

---

## Статус на 09.06.2026 17:30

| Что | Результат |
|-----|-----------|
| Mock stateful | работает |
| 11/11 smoke-тестов с mock | passed |
| **11/11 smoke-тестов с РЕАЛЬНЫМ SmartQ** | **passed** |
| 64/64 unit-теста pytest | passed |
| Yutkar/frontend на :5174 | работает (страница авторизации) |
| Скриншот Yutkar/UI | `docs/yutkar-smartq-screenshot-2026-06-09.png` |

---

## Архитектура (подтверждена)

```
Yutkar/frontend (:5174)  →  SmartQ (:3000)   [чужой UI, наглядно]
Наш Vite (:5173)         →  Наш РИС (:8000)  →  SmartQ (:3000)  ← основной
                                ↓ (если SMARTQ_ENABLED=false)
                              Mock (stateful, in-memory)
Наш elqueue (:8005)                            ← Fallback-симулятор
```

---

## Найденные баги в реальном SmartQ

| # | Баг | Где починили |
|---|-----|--------------|
| 1 | SmartQ ждёт `email`, а не `username` в login | `smartq_client.py:98` |
| 2 | SmartQ возвращает `serviceType`/`room` как **вложенные** объекты, а не id-строки | `queue_integration.py:148` |

---

## Файлы

- `backend/ris/services/smartq_client.py` (240 строк) — клиент
- `backend/ris/routers/queue_integration.py` (619 строк) — роутер
- `backend/alembic/versions/0002_smartq_fields.py` — миграция
- `backend/tests/test_smartq_client.py` (260 строк, 17 тестов) — respx-моки
- `docs/SMARTQ_LIVE_INTEGRATION.md` (9 разделов)
- `docs/INTEGRATION_CHECKLIST_2026-06-09.md` (9 разделов)
- `docs/yutkar-smartq-screenshot-2026-06-09.png` (157 КБ)

---

## Что осталось

| # | Задача | Приоритет |
|---|--------|-----------|
| 1 | Webhook от SmartQ (HMAC + обработка ticket_called/completed) | Высокий |
| 2 | Подключить наш фронт к SmartQ через наш РИС | Высокий |
| 3 | Playwright E2E (наш фронт + наш РИС + SmartQ) | Средний |
| 4 | Production-ready: HTTPS, JWT refresh, rate limiting | Низкий |
| 5 | Документация в `ARCHITECTURE.md` (дополнить SmartQ-схемой) | Низкий |
