# TASK_COLLECT_INFO — Результаты сбора

## Step 1: Структура проекта
- **root**: Next.js 15 (package.json, tsconfig.json, middleware.ts, next.config.ts, app/, components/, lib/, types/)
- **backend/ris**: FastAPI (main.py, routers/studies.py, routers/orders.py, routers/dicomweb.py, routers/auth.py, services/pacs_facade.py)
- **backend/elqueue**: FastAPI (main.py, routers/auth.py, routers/tickets.py)
- **backend/db**: SQLAlchemy models (auth, queue, ris, audit), Alembic migrations, session, dependencies, security
- **frontend/**: Vite 8 + React 19 (pages/, components/, api/, hooks/, context/, types/)

## Step 2: Ключевые файлы (28 frontend files)
- Pages (8): LoginPage, QueuePage(Root), RegistrationPage, DoctorPage, OrdersPage, StudiosPage, ViewerPage, ProtocolPage
- Components (5): ProtectedRoute, DwvViewer, PatientSelection, TicketList, Layout
- API (3): auth, orders, studies
- Types (4): auth, orders, queue, studies
- Context (1): AuthContext
- Hooks (3): useAuth, useQueue, useRouter

## Step 3: Данные БД (PostgreSQL 16, pacs_ris)

### queue.patients (29)
- id (uuid), full_name, policy_number, birth_date, phone, notes, created_at
- Sample: "Иванов Иван Иванович", "Петров Пётр", "Тестов Тест"

### ris.orders (31)
- Статусы: completed=12, in_progress=10, scheduled=9
- Модальности: CT, MR, DX
- Все созданы: 2026-06-02, пользователем 975f6add-9107-46b0-949d-d3737e14a2d8 (admin)
- StudyUID генерированы (1.2.840.*)

### ris.studies (12)
- Столбцы: id, order_id, orthanc_id, series_count, instance_count, is_uploaded, uploaded_at
- Все загружены, но series_count=0, instance_count=0 (не обновляются после линковки)
- Даты загрузки: 2026-06-04

### ris.protocols (31)
- Все пустые (body=''), черновики (is_draft=true)
- Подписанных нет

### queue.tickets (29)
- Статусы: done=14, in_progress=8, waiting=7
- 5 кабинетов (CT-101, MRT-102, Xray-103, US-104, Angio-105)
- 8 модальностей (CT, MR, DX, US, XA, PT, MG, NM)

## Step 4: API-ответы (реальные)
- **GET /api/v1/studies/**: 10 studies, Orthanc + RIS JOIN, ~127ms cold / 14-35ms warm
- **GET /api/v1/studies/{uid}**: DICOM-детали + серии + инстансы + RIS-заказ, ~65ms
- **GET /api/v1/orders/**: список RIS-заказов
- **GET /api/tickets/**: список очереди (elqueue, без JWT!)
- **GET /health**: {status: "ok", service: "ris"|"elqueue"}

## Step 5: OpenAPI (документировано ранее)
- RIS: 41 эндпоинтов (GET=27, POST=7, PUT=2, PATCH=2, DELETE=2)
- elqueue: 15 эндпоинтов (GET=9, POST=5)

## Step 6: Git status
- Branch: master (11 коммитов)
- Modified (6): studies.py, pacs_facade.py, ARCHITECTURE.md, package-lock.json, DwvViewer.tsx, ViewerPage.tsx
- Untracked (30+): docs/* (14), app/, components/, lib/, types/, middleware.ts, etc.
- Remote: origin/MaxSC2/Make-nAppointment.git
