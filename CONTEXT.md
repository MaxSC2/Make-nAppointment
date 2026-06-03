# CONTEXT.md — База знаний для AI-воркеров

> **Назначение:** Быстрый онбординг AI-воркера в проект.
> Читать перед выполнением любой задачи.

---

## Проект: PACS-RIS-Queue (интеграция с МИС «Надежда»)

- **Стек:** React 19 + Vite 8 + TypeScript 6 + Tailwind v4 + React Router v6
- **Бэкенд:** FastAPI + PostgreSQL 16 + SQLAlchemy 2.0 + Alembic + Docker
- **PACS:** Orthanc 1.12+ (через RIS-прокси)
- **Режим:** Frontend-only (mockData) в разработке, реальный бэкенд финально

## Структура проекта

```
C:\Projects\
├── MedPlatform\          # Основная папка (фронт + копия бэка)
│   ├── frontend\         # React + Vite (твоя зона)
│   │   ├── src\
│   │   │   ├── api\        # HTTP-клиенты (client.ts, queue.ts, ris.ts)
│   │   │   ├── components\ # UI-компоненты (StatusBadge, QueueTable, OrderCard)
│   │   │   ├── hooks\      # React-хуки (useQueue, useOrders)
│   │   │   ├── pages\      # Страницы (Registration, Queue, Doctor, Orders)
│   │   │   ├── types\      # TypeScript типы (queue.ts, ris.ts, auth.ts)
│   │   │   └── vite-env.d.ts
│   │   ├── index.html
│   │   └── vite.config.ts
│   ├── backend\         # Копия бэка (синхронизируется с pacs-ris-queue)
│   ├── ORCHESTRATION.md # Координация задач
│   ├── CONTEXT.md       # Этот файл
│   ├── BUGS.md          # Баги для другого AI
│   ├── TRACKER.md       # Трекер прогресса
│   └── PRACTICE_LOG.md  # Дневник практики
├── pacs-ris-queue\     # Оригинал бэка (работает другой AI)
│   ├── elqueue\        # Сервис очереди (FastAPI, порт 8005)
│   ├── ris\            # Сервис RIS (FastAPI, порт 8000)
│   ├── db\             # Модели, схемы, миграции
│   └── orthanc\        # Локальный Orthanc
├── lead-mcp\           # MCP-сервер координации
```

## Конвенции кода

### Фронтенд
- **No `any`** — использовать `unknown` + Type Guards
- **React 19** — никаких классов, только функциональные компоненты
- **'use client'** — только если есть хуки/состояние/эффекты
- **Tailwind v4** — utility-first, без CSS-модулей
- **import** — абсолютные с `@/` (алиас на `src/`)
- **Имена файлов** — PascalCase для компонентов, camelCase для остальных
- **Все функции и типы** — без JSDoc, без лишних комментариев

### Бэкенд (ориентир)
- FastAPI + Pydantic v2 + SQLAlchemy 2.0 async
- Схемы: `db/schemas/`, модели: `db/models/`
- Эндпоинты: `elqueue/routers/`, `ris/routers/`

## API-контракты

### Сервис очереди (elqueue, порт 8005)

| Эндпоинт | Метод | Тело / Параметры | Ответ |
|---|---|---|---|
| `/api/auth/login` | POST | `{username, password}` | `{access_token, token_type}` |
| `/api/cabinets` | GET | — | `[{id, code, name, modality, is_active}]` |
| `/api/tickets` | POST | `{full_name, policy_number, cabinet_code}` | TicketDetail (201) |
| `/api/tickets` | GET | `?cabinet=X&status_filter=Y` | `[TicketDetail]` |
| `/api/tickets/{tn}` | GET | — | TicketDetail |
| `/api/tickets/next` | POST | `{cabinet_code}` | TicketDetail |
| `/api/tickets/{tn}/complete` | POST | `{}` | TicketDetail |
| `/api/tickets/{tn}/events` | GET | — | `[TicketEvent]` |

### Сервис RIS (порт 8000)

| Эндпоинт | Метод | Описание |
|---|---|---|
| `/api/orders` | GET/POST | Список/создание заказов |
| `/api/orders/{id}` | GET | Детали заказа |
| `/api/orders/{id}/status` | PATCH | Обновить статус |
| `/api/modalities` | GET | Справочник модальностей |
| `/api/studies` | GET | Список исследований |
| `/api/orthanc/*` | GET/POST | Прокси к Orthanc |

### JWT
- Токен: `Authorization: Bearer <token>`
- Admin: `admin / admin123`
- Роли: `admin`, `registrar`, `doctor`, `technician`, `viewer`

## Текущее состояние
- Все страницы фронта написаны ✅
- Бэкенд работает (8005, 8000)
- Сценарий A + B пройдены ✅
- **Проблема:** AI добавил RBAC на регистрацию — фронт падает с 401
- **BUGS.md** — полный список найденных проблем

## Решения
- Vite proxy: `/elqueue/*` → localhost:8005, `/ris/*` → localhost:8000
- Проект сменился с Next.js на Vite + React 28.05.2026
- Бэкенд хранится в двух местах: `MedPlatform/backend/` (копия) и `pacs-ris-queue/` (оригинал AI)

---

*Last updated: 05.06.2026*
