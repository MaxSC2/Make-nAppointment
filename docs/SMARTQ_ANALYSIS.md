# SmartQ Backend — анализ интеграции с RIS

**Репозиторий:** https://github.com/NikNebog/smartq_back

---

## Стек

- **NestJS 11** + TypeScript 5.7, Prisma ORM (PostgreSQL)
- JWT (Passport), Socket.IO (WebSocket), Swagger (`/api/docs`)
- Порт: **3000**

---

## Модели данных (Prisma)

| Модель | Поля |
|---|---|
| **User** | id, name, email, password, role (`admin/specialist/manager`), roomId |
| **Room** | id, name, isActive |
| **ServiceType** | id, name, averageDurationMinutes, priorityWeight |
| **Ticket** | id, number (`A001`), priority (1-5), status (`created→waiting→called→in_service→completed/cancelled/no_show/redirected`), etaMinutes, serviceTypeId, roomId |
| **QueueEvent** | история изменений статуса талона |
| **QueueRecommendation** | рекомендации при перегрузке |
| **BoardScreen** | настройки табло |

---

## API эндпоинты

### Auth (`/auth`)
| Метод | Путь | Доступ |
|---|---|---|
| POST | `/auth/register` | - |
| POST | `/auth/login` | - |
| GET | `/auth/me` | JWT |
| GET | `/auth/users` | - |
| PATCH | `/auth/users/:id` | - |

### Tickets (`/tickets`)
| Метод | Путь | Доступ |
|---|---|---|
| POST | `/tickets/kiosk` | без авторизации |
| POST | `/tickets` | admin/manager |
| PATCH | `/tickets/:id` | admin/manager/specialist |
| POST | `/tickets/:id/arrive` | admin/manager/specialist |
| POST | `/tickets/:id/no-show` | admin/specialist |
| POST | `/tickets/:id/return` | admin/specialist |
| GET | `/tickets` | admin/specialist/manager (фильтр status, roomId) |
| GET | `/tickets/:id` | admin/specialist/manager |
| POST | `/tickets/:id/call` | admin/specialist |
| POST | `/tickets/:id/start` | admin/specialist |
| POST | `/tickets/:id/complete` | admin/specialist |
| POST | `/tickets/:id/cancel` | admin/manager/specialist |
| POST | `/tickets/:id/redirect` | admin/manager/specialist |

### Queue (`/queue`)
| Метод | Путь | Доступ |
|---|---|---|
| GET | `/queue/board` | без авторизации |
| GET | `/queue/board/:roomId` | без авторизации |
| GET | `/queue/room/:roomId` | admin/manager/specialist |
| GET | `/queue/room/:roomId/next` | admin/specialist |
| POST | `/queue/room/:roomId/recalculate` | admin |
| GET | `/queue/stats` | admin/manager/specialist |
| GET | `/queue/analytics/service-time` | admin/manager |
| GET | `/queue/analytics/period` | admin/manager |
| GET | `/queue/overload` | admin/manager/specialist |
| GET | `/queue/high-priority` | admin/manager/specialist |

### WebSocket (Socket.IO)
- `ticket_called` — вызов талона
- `status_update` — смена статуса

---

## Сравнение: наш elqueue vs SmartQ

| Возможность | Наш elqueue (FastAPI) | SmartQ (NestJS) |
|---|---|---|
| Стек | Python FastAPI | NestJS + Prisma |
| JWT auth | ✅ | ✅ |
| Tickets CRUD | ✅ | ✅ (расширенный) |
| Статусная машина | базовая | полная (+arrive, no-show, return, redirect) |
| Приоритеты талонов | ❌ | ✅ (1-5) |
| ServiceType / услуги | ❌ | ✅ |
| ETA (время ожидания) | ❌ | ✅ |
| WebSocket realtime | ❌ | ✅ (Socket.IO) |
| Аналитика | ❌ | ✅ (периоды, среднее время, перегрузка) |
| Табло (board) | ❌ | ✅ (без авторизации) |
| Аудит | ✅ (audit_log) | ✅ (QueueEvent) |
| Swagger docs | ❌ | ✅ (`/api/docs`) |

---

## Варианты интеграции с RIS

### A. Заменить elqueue на SmartQ
SmartQ запускается вместо elqueue. Наш фронт переключается на `localhost:3000`.
- Нужно: при создании талона в SmartQ вызывать `POST /api/orders` нашего RIS
- Плюс: сразу получаем WebSocket, приоритеты, ETA, аналитику, табло
- Минус: другой стек (Node.js вместо Python)

### B. Оставить elqueue, добавить WebSocket + приоритеты вручную
Доработать существующий elqueue (FastAPI), добавив:
- Socket.IO или Server-Sent Events
- Приоритеты талонов
- ETA
- Минус: больше ручной работы

### C. SmartQ как отдельный сервис + мост
SmartQ работает параллельно. При создании талона через SmartQ → он вызывает RIS через REST.
Наш elqueue убирается.
