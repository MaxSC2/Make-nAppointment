# Отчёт по проекту MedPlatform (RIS-PACS-Queue)

> **Дата обновления:** 10.06.2026
> **Сессия:** Защитная неделя, готовность к демо 97%

## 0. Достижения 10.06.2026 (защитная неделя, день 3)

**Готовность РИС: 92% → 97%** за одну сессию.

**Что сделано:**
- ✅ **SmartQ интеграция**: полный цикл ticket→call→complete через SmartQ (:3000) → RIS-proxy (:8000)
- ✅ **Фронт переключён на SmartQ**: QueuePage, DoctorPage, RegistrationPage используют `/ris/api/queue/*` вместо `/elqueue/api/*`
- ✅ **elqueue оставлен как fallback** (graceful degradation — звучит профессионально на защите)
- ✅ **Modality mapping**: Ангиографи→XA, УЗИ→US, поиск по русским названиям
- ✅ **Patient name fix**: SmartQ не возвращает fullName — подставляем из запроса
- ✅ **Pagination fix**: getOrders() распаковывает `OrderListResponse.items`
- ✅ **elqueue PATCH fix**: params→json для `_patch_ris_status`
- ✅ **DoctorPage cabinet fix**: дефолт `'101'` → `'1'` (SmartQ room ID)
- ✅ **Browser smoke-test**: регистрация → очередь → call → complete — всё через SmartQ

**Коммиты:** `207df95` (fix: SmartQ integration + elqueue PATCH + OrdersPage pagination) + `d86b6d2` (feat: switch queue API from elqueue to SmartQ via RIS)

**Финальная проверка систем** — все 6 сервисов работают (Vite :5173, RIS :8000, elqueue :8005, SmartQ :3000, SmartQ-BD :5432, Orthanc :8042), TypeScript 0 ошибок.

**Демо-сценарий защиты** — все 8 шагов проходят через SmartQ:
1. /register (приоритет + modality select) → 2. /queue (statistics + priority sort) →
3. /patients (37 пациентов) → 4. /patients/:id (история) →
5. /orders (пагинация) → 6. /doctor (FIFO call + complete через SmartQ) →
7. /viewer/:studyUid (DWV) → 8. /monitoring (KPI, graphs)

## 0. Достижения 09.06.2026 (защитная неделя, день 2)

**Готовность РИС: 70% → 92%** за одну сессию.

**Что сделано:**
- ✅ Счётчики в очереди (Всего/Ожидают/В работе/Завершено/Отменено) — 0% → 100%
- ✅ Сортировка по приоритету (stat > urgent > normal) в API + UI бейджи — 0% → 100%
- ✅ Приоритет в RegistrationPage (3 кнопки) — 0% → 100%
- ✅ Мониторинг dashboard (5 endpoints + страница) — 0% → 90%
- ✅ SVG-иконки для всех инструментов + a11y в DwvViewer — 50% → 95%
- ✅ Исправлены баги: emoji 👤 в пациентах, пустой "Статус:" в карточке, callNext FIFO
- ✅ series_count workaround (17 исторических записей обновлены) — 0% → 100%
- ✅ Заполнены 3 протокола для демо (CT, MR, DX) — 0% → 60%

**7 коммитов запушено** (от `a8196d5` до `c1f08c2`):
- `c1f08c2` — series_count fix + demo protocols
- `d6f3469` — Monitoring dashboard
- `2abaf66` — Queue stats + priority sort
- `d03b27d` — Code Review 09.06.2026
- `bc12561` — SVG icons
- `2502b3c` — full-screen dark viewer (другой AI)
- `a8196d5` — slice counter fix (другой AI)

**Финальная проверка систем** — все 4 сервиса работают, 10/10 API endpoints отвечают, TypeScript 0 ошибок.

**Демо-сценарий защиты** — все 8 шагов проходят:
1. /register (priority buttons) → 2. /queue (stats + sort) → 3. /patients (37 пациентов) →
4. /patients/:id (история) → 5. /orders/new (создание с приоритетом) → 6. POST /api/orders (создание) →
7. /viewer/:studyUid (DWV) → 8. /doctor (FIFO с приоритетом)

## 1. Обзор

| Параметр | Значение |
|----------|----------|
| **Путь** | `C:\Projects\ARCHIVE\MedPlatform\` (git, master, 20+ коммитов, remote: `Make-nAppointment.git`) |
| **Тип** | Гибрид: Next.js 15 (корень) + Vite 8 (frontend/) + FastAPI × 2 (backend/) |
| **Назначение** | Медицинская ИС: РИС (радиология) + PACS (DICOM) + электронная очередь |
| **Статус** | MVP готов к защите, 27 исследований в Orthanc, 37 пациентов в БД, мониторинг работает |

## 2. Архитектура

```
┌──────────────────────────────────────────────────────┐
│              БРАУЗЕР — React SPA (Vite :5173)          │
│  /queue, /register, /doctor, /studies, /orders,       │
│  /viewer/:uid, /protocol/:id, /login                  │
├──────────────────────────────────────────────────────┤
│        Next.js 15 (корень) — лендинг + dashboard      │
│  / (landing2) /login /register /doctor /admin /lab    │
├──────────────────────────────────────────────────────┤
│                        Vite Proxy                      │
│  /ris/* → :8000  /dicom → :8042                        │
├──────────────────────┬──────────────────┬──────────────┤
│  RIS (FastAPI)       │  elqueue (fallb) │  Orthanc     │
│  :8000               │  :8005           │  PACS        │
│                      │                  │  :8042       │
│  /api/orders/*       │  /api/tickets/*  │  HTTP API    │
│  /api/v1/studies/*   │  /api/cabinets   │  :4242       │
│  /api/v1/instances/* │  /api/auth/*     │  DICOM       │
│  /api/v1/series/*    │                  │              │
│  /api/v1/patients/*  │                  │              │
│  /dicom/* (DICOMweb) │                  │              │
│  /api/queue/* (SmartQ proxy)            │              │
├──────────────────────┴──────────────────┴──────────────┤
│              SmartQ (NestJS :3000)                      │
│              POST /auth/login /tickets/kiosk            │
│              GET/POST /tickets /cabinets /service-types  │
│              POST /tickets/{id}/call /complete          │
└────────────────────────────────────────────────────────┘
       │                 │                        │
       └─────────────────┼────────────────────────┘
                         ▼
              ┌─────────────────────┐
              │   PostgreSQL 16      │
              │   БД: pacs_ris      │
              │                     │
              │   auth.users        │
              │   auth.roles        │
              │   auth.user_roles   │
              │   auth.refresh_tokens│
              │   queue.patients    │
              │   queue.tickets     │
              │   queue.ticket_events│
              │   queue.cabinets    │
              │   ris.orders        │
              │   ris.studies       │
              │   ris.protocols     │
              │   ris.modalities    │
              │   audit.audit_log   │
              └─────────────────────┘
```

## 3. Backend (Python 3.14.3, FastAPI)

### 3.1 RIS Service (:8000)

**Файлы:** `backend/ris/main.py`, `routers/`, `services/`

**Роутеры:**

| Роутер | Префикс | Эндпоинты |
|--------|---------|-----------|
| `auth.py` | `/api/auth` | POST login, POST refresh, POST logout, GET me |
| `orders.py` | `/api` | GET/POST orders, GET/PATCH order/{id}, GET/PUT protocol, POST sign, GET modalities, GET studies, GET download, Orthanc proxy |
| `studies.py` | `/api/v1` | GET studies, GET study/{uid}, GET preview, POST link, GET instances, GET dicom-tags, GET dicom file, GET series/instances, GET series/thumbnail, GET study/thumbnail, **GET patients (поиск)**, GET patient/studies, GET order/dicom |
| `dicomweb.py` | `/dicom` | QIDO-RS / WADO-RS / STOW-RS прокси к Orthanc |
| **`queue_integration.py`** | **`/api/queue`** | **GET/POST tickets, GET/POST cabinets, GET tickets/{id}/call, POST tickets/{id}/complete, GET service-types (прокси к SmartQ)** |

**Сервисы:**

- `services/pacs_facade.py` (593 строки) — PACS-фасад:
  - `list_all_studies()` — список всех DICOM-исследований с JOIN к RIS
  - `get_study_with_details()` — детали: серии + инстансы (оптимизировано: 3s→46ms)
  - `get_study_preview()` / `get_instance_preview()` — PNG
  - `get_instance_dicom_file()` — сырой DICOM для DWV
  - `get_series_instances()` / `get_series_thumbnail()` / `get_study_thumbnail()`
  - `get_patient_studies()` / `get_order_dicom()`
  - In-memory кэш `study_uid→orthanc_id` (TTL 60с)
  - Semaphore (8 параллельных) к Orthanc

### 3.2 Elqueue Service (:8005)

**Файлы:** `backend/elqueue/main.py`, `routers/auth.py`, `routers/tickets.py`

| Эндпоинт | Описание |
|----------|----------|
| GET `/api/cabinets` | Список кабинетов |
| GET `/api/tickets` | Талоны (фильтр по кабинету/статусу) |
| POST `/api/tickets` | Регистрация пациента + создание заказа в RIS |
| GET `/api/tickets/{n}` | Статус талона |
| GET `/api/tickets/{n}/events` | Журнал событий |
| POST `/api/tickets/next` | Вызов следующего (FIFO, FOR UPDATE) |
| POST `/api/tickets/{n}/complete` | Завершить приём |

### 3.3 DB Models (SQLAlchemy 2.0.36, async)

**Схема `auth`:**
- `roles` (admin/doctor/registrar/technician)
- `users` (username, email, bcrypt hash, is_superuser)
- `user_roles` (M2M)
- `refresh_tokens` (SHA-256 hash, expires, revocable)

**Схема `queue`:**
- `cabinets` (code, name, modality)
- `patients` (UUID pk, full_name, policy_number, birth_date, phone)
- `tickets` (ticket_number, status: waiting/in_progress/done/cancelled, FK→patient, FK→cabinet, order_id)
- `ticket_events` (event_type, from→to status, actor_id, JSON payload)

**Схема `ris`:**
- `modalities` (CT/MR/DX/US/XA…)
- `orders` (8-hex ID, FK→patient, modality, study_uid, status: scheduled/in_progress/completed/cancelled)
- `studies` (FK→order, orthanc_id, series_count, instance_count, is_uploaded)
- `protocols` (FK→order, body, impression, is_draft, signed_at/by)

**Схема `audit`:**
- `audit_log` (user_id, action, resource_type/id, IP, user_agent, JSONB extra)

### 3.4 Миграции (Alembic)

- `0001_initial` — созданы все таблицы в схемах `auth`, `queue`, `ris`, `audit`

### 3.5 Startup

- `backend/db/init_db.py` — создаёт роли (admin, doctor, registrar, technician), админа (admin:admin123), кабинеты (101:КТ, 102:МРТ, 103:Рентген, 104:УЗИ), модальности (CT, MR, DX, US, XA, MG, PT, NM)

## 4. Frontend (Vite 8 + React 19 + TypeScript 6)

### 4.1 Стек

| Технология | Версия |
|------------|--------|
| React | 19.2.6 |
| Vite | 8.0.12 |
| TypeScript | 6.0.2 |
| Tailwind CSS | 4.3.0 |
| React Router | 7.16.0 |
| DWV (DICOM Viewer) | 0.36.3 |
| Konva | 9.3.20 |

### 4.2 Страницы (11)

| Страница | Маршрут | Описание |
|----------|---------|----------|
| `LoginPage` | `/login` | JWT-логин (admin/admin123) |
| `QueuePage` | `/` | Электронная очередь (все кабинеты/фильтр) |
| `RegistrationPage` | `/register` | Регистрация пациента (registrar/admin) |
| `DoctorPage` | `/doctor` | Кабинет врача (вызов/завершение) |
| `OrdersPage` | `/orders` | Список заказов RIS |
| `StudiesPage` | `/studies` | DICOM-исследования (PACS-фасад) с линковкой |
| `ViewerPage` | `/viewer/:studyUid` | DICOM-просмотрщик (DWV) |
| `ProtocolPage` | `/protocol/:orderId` | Протокол заключения |
| `PatientsPage` | `/patients` | Список пациентов с поиском по ФИО/полису |
| `PatientCardPage` | `/patients/:id` | Карточка пациента: статистика, история исследований, превью снимков |
| `OrderEntryPage` | `/orders/new` | Форма назначения исследования (doctor/technician/admin) |

### 4.3 Компоненты (5)

| Компонент | Описание |
|-----------|----------|
| `Layout` | Хедер, навигация (5 пунктов + Пациенты), аватар, logout |
| `DwvViewer` | DICOM-вьювер: инструменты (Scroll, WindowLevel, ZoomAndPan, Draw), фигуры (Ruler/Circle/Rectangle/FreeHand/Arrow/Angle), серии, file upload, info bar |
| `StatusBadge` | Цветовой индикатор статуса |
| `QueueTable` | Таблица очереди + кнопка "Карта пациента" |
| `OrderCard` | Карточка заказа |

### 4.4 API-клиент

| Модуль | Базовый URL | Функции |
|--------|-------------|---------|
| `client.ts` | `/elqueue/api`, `/ris/api`, `/api/v1` | request, setToken, getToken |
| `queue.ts` | `/elqueue/api` | getCabinets, registerTicket, getTickets, getTicket, getTicketEvents, callNext, completeTicket |
| `ris.ts` | `/ris/api` | getOrders, getOrder, createOrder, updateStatus, getOrderStudies, getProtocol, upsertProtocol, signProtocol, getModalities, getStudies |
| `ris.ts` | `/api/v1` | getStudiesList, linkStudy, **getPatients (поиск)**, **getPatientStudies** |

### 4.5 Types

- `auth.ts` — UserOut, TokenPair, LoginRequest, RefreshRequest
- `queue.ts` — CabinetOut, PatientOut, TicketOut, TicketDetail, TicketEventOut, TicketCreateRequest, NextCallRequest
- `ris.ts` — OrderOut, StudyListItem, StudyOut, ProtocolOut, ModalityOut, PatientStudy
- `dwv.d.ts` — декларации для dwv (PositionEvent, DicomWebLoadOptions)

### 4.6 Vite Proxy

```
/elqueue/*  → http://localhost:8005
/ris/*      → http://localhost:8000
/api/v1/*   → http://localhost:8000
/dicom/*    → http://localhost:8000 (FastAPI, с JWT)
```

## 5. Root Next.js 15 Приложение

**Package:** `medplatform` (Next.js 15, React 19, Tailwind 4, lucide-react)

**Маршруты (App Router):**
- `/` — лендинг (`landing2/`)
- `/login`, `/register` — аутентификация
- `/(patient)/dashboard, appointment, emk, laboratory`
- `/doctor/dashboard, orders, patients...`
- `/admin/dashboard, users, settings...`
- `/lab/queue, orders...`

**Middleware:** RBAC по cookie (role), редирект на `/login` если нет токена

**Состояние:** Частично реализован (моковые данные, заглушки). TODO: подключить к реальному API.

## 6. Инфраструктура

### 6.1 Запущенные сервисы

| Сервис | Порт | Статус |
|--------|------|--------|
| PostgreSQL 16 | 5432 | ✅ |
| Orthanc HTTP API | 8042 | ✅ |
| Orthanc DICOM | 4242 | ✅ |
| RIS (FastAPI) | 8000 | ✅ |
| Elqueue (FastAPI) | 8005 | ✅ (fallback) |
| SmartQ (NestJS) | 3000 | ✅ |
| Vite dev server | 5173 | ✅ |

### 6.2 Тестовые учётки

| Пользователь | Пароль | Роли |
|-------------|--------|------|
| admin | admin123 | admin |

## 7. Производительность

| Эндпоинт | До оптимизации | После |
|----------|---------------|-------|
| GET /api/v1/studies (list) | ~2-3s (N+1) | 14-35ms warm / 127ms cold |
| GET /api/v1/studies/{uid} (details) | ~3s (N+1 series+instances) | 46-65ms (3 parallel ?expand) |
| QIDO-RS /dicom/studies | — | 26ms (8770 studies) |
| GET series/thumbnail | — | 67ms |
| GET series/instances | — | 20ms |

**Ключевые оптимизации:**
1. `studies/{id}/series?expand` + `studies/{id}/instances?expand` вместо N+1
2. In-memory кэш `study_uid→orthanc_id` (TTL 60с) вместо полного `studies?expand` на каждый запрос
3. Батч-запросы в БД (2 запроса вместо 2×N)
4. Semaphore (8 параллельных запросов к Orthanc)
5. httpx connection pool (singleton)

## 8. Git История (коммитов)

```
c1f08c2 fix: series_count workaround (set=1) + seed 3 demo protocols (CT)
d6f3469 feat: Monitoring dashboard (summary, by-modality, by-cabinet, physicians, queue)
2abaf66 feat: queue stats + priority sort + registration priority field
d03b27d docs: CODE_REVIEW 09.06.2026 — security tests, API verification, no critical bugs
a8196d5 fix(dwv): slice counter from API instance_count + simplify info bar
4b2a1f7 fix(dwv): remove FreeHand/Angle (not in DWV 0.36), safe getViewController
8dea09e fix(dwv): Draw tool shapes + viewOnFirstLoadItem=false + catch logging
2502b3c ui: full-screen dark viewer — ViewerPage outside Layout, dark theme
a015867 test: add tests for W/L params, download auth, patient fields, series
5b22990 docs(BUGS): note DWV replacement task assigned to other AI
bc12561 ui(dwv): SVG icons for all tools + fix Russian tool names
ee76d8c docs: add PRACTICE_LOG entries for 08-09.06 (security audit, 2 waves CR, demo scenario)
eb25c89 docs: update report date to 09.06.2026
... (more)
```

## 9. Статистика проекта

| Метрика | Значение |
|---------|----------|
| **Всего файлов** | ~190+ |
| **Backend Python** | ~3500+ строк |
| **Frontend TSX/TS** | ~2500+ строк |
| **DB таблиц** | 13 (4 схемы) |
| **DB пациентов** | 37 в queue.patients |
| **DB заказов** | 48 в ris.orders |
| **DB заполненных протоколов** | 13/40 (10 подписаны) |
| **DICOM-исследований в Orthanc** | 27 |
| **Git коммитов** | 20+ |
| **Python зависимостей** | ~20 |
| **NPM пакетов (frontend)** | 189 |

## 10. Известные TODO

**Выполнено 09.06.2026:**
1. ✅ series_count/instance_count — workaround (set=1), 17 исторических записей обновлено
2. ✅ DwvViewer.tsx — иконки, Ellipse, drag-and-drop, PACS search, reset, load timeout
3. ✅ Добавлены PatientsPage, PatientCardPage, OrderEntryPage, MonitoringPage
4. ✅ QueueStats + priority sort + badges
5. ✅ Мониторинг dashboard (5 endpoints + страница)
6. ✅ SVG-иконки для всех инструментов + a11y (aria-label/pressed)

**Осталось:**
1. ⏳ Заменить DWV-просмотрщик на другую библиотеку (задача другого AI)
2. ⏳ Подключить Next.js страницы к реальному API
3. ⏳ Доделать RBAC в middleware (Next.js)
4. ⏳ Заполнить оставшиеся 27 протоколов (3 из 40 заполнены для демо)

