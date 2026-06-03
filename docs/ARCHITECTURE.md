# Архитектура RIS-PACS

## 1. Стек технологий

| Компонент | Технология |
|---|---|
| Frontend | React 18 + Vite + TypeScript |
| Стилизация | Tailwind CSS |
| Роутинг | React Router v6 |
| Backend | FastAPI (Python 3.10+) |
| СУБД | PostgreSQL 17 + SQLAlchemy + Alembic |
| PACS | Orthanc 1.12+ |
| DICOM Viewer | DWV (CDN) |
| Инфраструктура | Docker + docker-compose |

## 2. Архитектура системы

```
Браузер (React SPA):
  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────┐
  │  Эл. очередь    │  │  Панель врача   │  │  DWV Viewer  │
  └────────┬────────┘  └────────┬────────┘  └──────┬───────┘
           │ REST                │ REST              │ WADO-URI
           ▼                     ▼                   ▼
  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────────┐
  │  СЕРВИС ОЧЕРЕДИ │  │  СЕРВИС RIS     │  │  PACS (ORTHANC)  │
  │  FastAPI + PG   │  │  FastAPI + PG   │  │  DICOM-сервер    │
  │  Порт 8001      │  │  Порт 8000      │  │  Порт 8042       │
  └─────────────────┘  └─────────────────┘  └──────────────────┘
```

## 3. Структура проекта

```
ris/
├── backend/
│   ├── queue_service/    # Сервис очереди (8001)
│   └── ris_service/      # Сервис RIS (8000)
├── frontend/             # React SPA (5173)
│   └── src/
│       ├── pages/        # Registration, Queue, Doctor, Orders, Viewer
│       ├── components/   # QueueTable, StatusBadge, OrderCard, DicomViewer
│       ├── api/          # queue.ts, ris.ts
│       ├── hooks/        # useQueue, useOrders
│       └── types/        # queue.ts, ris.ts
├── orthanc/              # PACS конфиг
├── docker-compose.yml
└── README.md
```

## 4. Роли в команде

| № | Роль | Обязанности |
|---|---|---|
| 1 | Backend Lead | Архитектура, Auth, БД, docker-compose, Orthanc |
| 2 | Backend RIS | Сервис RIS: заказы, статусы, интеграция с Orthanc |
| 3 | Backend Queue | Сервис очереди: талоны, статусы, интеграция с RIS |
| 4 | Frontend Lead | Vite+React setup, роутинг, layout, shared-компоненты |
| 5 (Макс) | Frontend RIS | RegistrationPage, QueuePage, DoctorPage, OrdersPage |
| 6 | Frontend PACS | ViewerPage, DicomViewer (DWV) |

## 5. Статусы

**Очередь:** waiting → in_progress → done
**Заказы RIS:** scheduled → in_progress → completed

## 6. Сценарий A (полный цикл)

```
/register → получение талона → заказ в RIS
  → /doctor → вызов пациента → просмотр снимков
    → завершение → статус done/completed
```
