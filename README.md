# MedPlatform — RIS (Radiology Information System)

Медицинская информационная система для лучевой диагностики с интеграцией электронной очереди (SmartQ) и PACS (Orthanc + DWV).

> **Важно для группы**: используйте ветку `main` и команду `git pull --rebase` после клонирования. Локальная версия может быть впереди `origin/main` — после наших пушей делайте `git pull` чтобы получить последние изменения фронта (Sidebar, IIN, DICOM cleanup, auto-refresh).

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
│  Страницы: /login, /doctor, /orders, /studies, /patients,   │
│  /monitoring, /register, /protocol, /viewer                  │
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
- i18next (ru / en / kk)
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

### Быстрый старт (всё сразу)
Из корня проекта:
```bash
start-all.bat
```
Скрипт проверит что уже запущено, поднимет недостающие сервисы (PostgreSQL, SmartQ, RIS, Vite, Yutkar UI, Orthanc) и откроет в Chrome все страницы UI:
- http://localhost:5173/ — Главная (Очередь)
- http://localhost:5173/doctor — Кабинет врача
- http://localhost:5173/studies — Исследования (+ кнопка "Очистка")
- http://localhost:5173/orders — Заказы
- http://localhost:5173/patients — Пациенты
- http://localhost:5173/monitoring — Мониторинг
- http://localhost:5173/register — Регистрация
- http://localhost:5174 — SmartQ UI (Kiosk)
- http://localhost:8000/docs — RIS API Swagger
- http://localhost:8042 — Orthanc

### Бэкенд вручную
```bash
cd backend
python -m venv .venv && .venv\Scripts\activate
pip install -r requirements.txt
alembic upgrade head
uvicorn ris.main:app --port 8000 --reload
```

**Примечание**: если порт :8000 занят ghost-сокетами (типичная проблема Windows), запустите на 8001:
```bash
uvicorn ris.main:app --port 8001 --host 0.0.0.0
```
Vite-конфиг автоматически определит работающий порт (сначала 8000, потом фолбэк 26.150.162.207:8000, потом 8001).

### Фронтенд вручную
```bash
cd frontend
npm install
npm run dev
```

### SmartQ (опционально)
```bash
cd ../smartq-back
npm install && npx prisma migrate deploy && npm run start:dev
```
Порт :3000. В `backend/.env` установить:
```env
SMARTQ_ENABLED=true
SMARTQ_URL=http://localhost:3000
SMARTQ_USERNAME=admin
SMARTQ_PASSWORD=admin123
```

**Без `SMARTQ_ENABLED=true`** RIS использует встроенный mock (2 талона M001, M002) — это для разработки без SmartQ.

**С `SMARTQ_ENABLED=true`** RIS подтягивает все талоны из SmartQ (включая статус, очередь, вызов, завершение).

### Тестовые аккаунты (seed)
| Логин | Пароль | Роль | Доступ |
|-------|--------|------|--------|
| `admin` | `admin123` | admin, doctor | Всё, включая "Очистка PACS" |
| `doctor_t` | `doctor123` | doctor | Кабинет врача, Исследования, Протоколы |
| `registrar_t` | `registrar123` | registrar | Регистрация, Очередь |

## Роли и права (RBAC)

| Роль | Права |
|------|-------|
| `admin` | Всё: создание/вызов/завершение талонов, редактирование и отзыв протоколов, управление пользователями |
| `doctor` | Создание/вызов/завершение талонов, создание заказов, редактирование и подписание протоколов |
| `registrar` | Создание талонов и заказов, просмотр списка (НЕ call/complete/protocol) |
| `technician` | Вызов/завершение талонов, просмотр (НЕ может редактировать/подписывать протокол) |

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

### PACS-фасад (`/api/v1/`)
| Метод | Путь | Доступ | Описание |
|-------|------|--------|----------|
| GET | `/studies` | Любой | Список DICOM-исследований (Orthanc + JOIN) |
| GET | `/studies/{uid}` | Любой | Детали исследования |
| GET | `/studies/{uid}/preview` | Любой | Превью первого среза (PNG) |
| POST | `/studies/{orthanc_id}/link` | registrar, doctor, admin | Связать unlinked-снимок с RIS-заказом |
| GET | `/studies/cleanup/single-slice` | admin | Список 1-срезных исследований (для очистки) |
| DELETE | `/studies/by-orthanc/{id}` | admin | Удалить исследование из Orthanc + БД |

### Аутентификация
| Метод | Путь | Описание |
|-------|------|----------|
| POST | `/api/auth/login` | Вход (username + password → JWT) |
| POST | `/api/auth/refresh` | Обновить access_token через refresh_token |
| GET | `/api/auth/me` | Текущий пользователь |

## Оркестрация сервисов (локальная)

| Сервис | URL | Порт |
|--------|-----|------|
| RIS (наш бэкенд) | http://localhost:8000 | 8000 |
| RIS fallback | http://localhost:8001 | 8001 |
| Фронтенд (Vite) | http://localhost:5173 | 5173 |
| SmartQ (NestJS) | http://localhost:3000 | 3000 |
| Yutkar/UI (демо) | http://localhost:5174 | 5174 |
| Orthanc (PACS) | http://localhost:8042 | 8042 |
| elqueue (мок) | http://localhost:8005 | 8005 |

## Тестирование

```bash
cd backend
pytest -v   # 115 тестов
```

Всего **115/115 тестов** проходят. Покрытие:
- RBAC (10)
- SmartQ HTTP-клиент (17, моки)
- Socket.IO listener (7, моки)
- Фильтры/пагинация Orders (13)
- Подписание протоколов (13)
- ИИН (8)
- Smoke / OpenAPI (1)

## Что нового (changelog)

- **Sidebar**: pin-кнопка на десктопе (Скрыть/Закрепить панель), click-outside, overlay с плавной анимацией
- **ИИН-колонка**: реальный IIN, для пустых — `—` (italic grey)
- **Таблица**: `w-full + table-fixed` — растягивается на всю ширину
- **Backend**: `patient_id` в TicketOut + fallback-lookup по имени/полису/ИИН
- **DICOM Cleanup**: кнопка "🧹 Очистка" на /studies, модалка с чекбоксами, admin-only
- **Auto-refresh JWT**: при 401 client.ts автоматически обновляет access_token через refresh_token
- **StatusBadge**: добавлены переводы `scheduled` и `in_progress` для всех локалей
- **start-all.bat**: автодетект RIS-порта, фолбэк на 8001, открывает 10 страниц в Chrome

## Документация

- `docs/SMARTQ_LIVE_INTEGRATION.md` — интеграция с SmartQ
- `docs/INTEGRATION_CHECKLIST_2026-06-09.md` — чеклист проверки
- `PRACTICE_LOG.md` — дневник практики
- `TRACKER_SMARTQ.md` — трекер задач
- `BUGS.md` — известные баги (36 записей)
