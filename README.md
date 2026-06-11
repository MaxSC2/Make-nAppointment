# MedPlatform — RIS (Radiology Information System)

Медицинская информационная система для лучевой диагностики с интеграцией электронной очереди (SmartQ) и PACS (Orthanc + DWV).

## Архитектура

```
┌─────────────────────────────────────────────────────────────┐
│                      Внешние сервисы                         │
│  SmartQ (:3000)  Orthanc (:8042)  Yutkar/UI (:5174)         │
└──────────────────────┬──────────────────────────────────────┘
                       │ REST + Socket.IO
┌──────────────────────▼──────────────────────────────────────┐
│                Бэкенд — RIS (:8000)                          │
│  FastAPI + SQLAlchemy async + PostgreSQL 16                  │
│  ┌────────────┐  ┌──────────────┐  ┌───────────────────┐    │
│  │ Queue      │  │ Orders       │  │ Socket.IO         │    │
│  │ Integration│  │ + Protocol   │  │ Listener          │    │
│  │ (SmartQ    │  │ + RBAC       │  │ (ticket_called /  │    │
│  │  + Mock)   │  │ + Filter     │  │  status_update)   │    │
│  └────────────┘  └──────────────┘  └───────────────────┘    │
└──────────────────────┬──────────────────────────────────────┘
                       │ REST (fetch)
┌──────────────────────▼──────────────────────────────────────┐
│              Фронтенд — Vite (:5173)                         │
│  React 19 + TypeScript 6 + Tailwind v4                      │
│  Страницы: /login, /orders, /studies, /viewer, /protocol    │
└─────────────────────────────────────────────────────────────┘
```

## Стек

### Бэкенд (`backend/`)
- Python 3.14 + FastAPI + Uvicorn
- SQLAlchemy 2.0 (async) + Alembic
- PostgreSQL 16
- AsyncPG + Psycopg (binary)
- JWT (PyJWT) + bcrypt
- httpx (HTTP-клиент)
- python-socketio + aiohttp (Socket.IO listener)
- pytest + respx (тесты)

### Фронтенд (`frontend/`)
- React 19 + Vite 8 + TypeScript 6
- Tailwind CSS v4
- Fetch API (Context/Provider)
- DWV (DICOM Web Viewer)

### Внешние сервисы
- **SmartQ** (NikNebog/smartq_back) — NestJS 11 + Prisma + Socket.IO
- **Orthanc** — PACS-сервер (DICOM)
- **Yutkar/frontend** — сторонний UI для наглядной демонстрации очереди

## Запуск

### Требования
- Python 3.14+
- Node.js 22+
- PostgreSQL 16
- Orthanc (опционально)

### Бэкенд
```bash
cd backend
python -m venv .venv && .venv\Scripts\activate
pip install -r requirements.txt
alembic upgrade head
uvicorn ris.main:app --port 8000 --reload
```

### Фронтенд
```bash
cd frontend
npx next dev --port 3000
```

### SmartQ (опционально)
```bash
cd ../smartq-back
npm install && npx prisma migrate deploy && npm start
```
Порт :3000. В `backend/.env` установить `SMARTQ_ENABLED=true`.

## Роли и права (RBAC)

| Роль | Права |
|------|-------|
| `admin` | Всё: создание/вызов/завершение талонов, редактирование и отзыв протоколов, управление пользователями |
| `doctor` | Создание/вызов/завершение талонов, создание заказов, редактирование и подписание протоколов |
| `registrar` | Создание талонов и заказов, просмотр списка (НЕ call/complete/protocol) |
| `technician` | Вызов/завершение талонов, просмотр (НЕ может редактировать/подписывать протокол) |

Тестовые пользователи (seed): `admin_t`, `doctor_t`, `registrar_t`, `technician_t` / пароль `pass123` (см. `backend/db/seed_test_users.py`).

## API (основные эндпоинты)

### Queue Integration (`/api/queue/`)
| Метод | Путь | Доступ | Описание |
|-------|------|--------|----------|
| GET | `/service-types` | Любой | Список услуг SmartQ |
| GET | `/cabinets` | Любой | Список кабинетов |
| GET | `/tickets` | Любой | Список талонов (с фильтрацией) |
| POST | `/tickets` | registrar, doctor, admin | Создать талон |
| POST | `/tickets/{id}/call` | doctor, technician, admin | Вызвать пациента + создать Order |
| POST | `/tickets/{id}/complete` | doctor, technician, admin | Завершить приём |
| GET | `/tickets/next/{room}` | doctor, technician, admin | Следующий в очереди |

### Orders (`/api/orders`)
| Метод | Путь | Доступ | Описание |
|-------|------|--------|----------|
| GET | `/` | Любой | Список заказов (с фильтрами, пагинацией, сортировкой) |
| POST | `/` | registrar, doctor, admin | Создать заказ |
| GET | `/{id}` | Любой | Детали заказа |
| PATCH | `/{id}/status` | doctor, admin | Обновить статус |
| GET | `/{id}/protocol` | Любой | Протокол заказа |
| PUT | `/{id}/protocol` | doctor, admin | Обновить/создать протокол |
| POST | `/{id}/protocol/sign` | doctor, admin | Подписать протокол |
| DELETE | `/{id}/protocol/sign` | admin | Отозвать подпись |

### Аутентификация
| Метод | Путь | Описание |
|-------|------|----------|
| POST | `/api/auth/login` | Вход (username + password → JWT) |
| GET | `/api/auth/me` | Текущий пользователь |

## Оркестрация сервисов (локальная)

| Сервис | URL | Порт |
|--------|-----|------|
| RIS (наш бэкенд) | http://localhost:8000 | 8000 |
| Фронтенд (Vite) | http://localhost:5173 | 5173 |
| SmartQ (NestJS) | http://localhost:3000 | 3000 |
| Yutkar/UI (демо) | http://localhost:5174 | 5174 |
| Orthanc (PACS) | http://localhost:8042 | 8042 |
| elqueue (мок) | http://localhost:8005 | 8005 |

## Тестирование

```bash
cd backend
pytest -v                          # Все тесты
pytest tests/test_smartq_client.py  # SmartQ HTTP-клиент (17 тестов, моки)
pytest tests/test_smartq_listener.py # Socket.IO listener (7 тестов, моки)
pytest tests/test_rbac.py           # RBAC (10 тестов)
pytest tests/test_order_filters.py  # Фильтры/пагинация (13 тестов)
pytest tests/test_protocol_signing.py # Подписание протоколов (13 тестов)
```

Всего **105/107 тестов** проходят (2 pre-existing — старый формат `isinstance(list)`).

## Документация

- `docs/SMARTQ_LIVE_INTEGRATION.md` — интеграция с SmartQ
- `docs/INTEGRATION_CHECKLIST_2026-06-09.md` — чеклист проверки
- `PRACTICE_LOG.md` — дневник практики
- `TRACKER_SMARTQ.md` — трекер задач
