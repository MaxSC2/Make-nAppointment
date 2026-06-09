# SmartQ → RIS — План подключения сторонней электронной очереди

**Дата:** 09.06.2026 (финальная версия)
**Статус:** 🟡 В планировании
**Цель:** Подключить **SmartQ-бэк** (NikNebog/smartq-back, NestJS :3000) к **нашему РИС** (FastAPI :8000) так, чтобы **наш единственный фронт** (Vite :5173) показывал врачу всю информацию из **нашего PACS + внешней очереди** в едином UI.

---

## 1. Что мы делаем (и что НЕ делаем)

### ✅ Делаем
- Подключаем **наш РИС** (FastAPI :8000) к **SmartQ API** (NikNebog/smartq-back, NestJS :3000)
- **Наш единственный фронт** (MedPlatform, Vite :5173) собирает данные **через наш бэк** и показывает врачу всё как единое целое
- JWT-аутентификация в SmartQ (используя их сервисный аккаунт)
- **Входящий webhook** от SmartQ → создание заказа в нашем РИС
- **Исходящие запросы** нашего РИС → получение списка талонов из SmartQ
- Маппинг SmartQ `Ticket.id` → наш `Order.source_ticket_id`

### 🔒 Что СОХРАНЯЕМ (не удаляем)
- ✅ **Наш elqueue (FastAPI :8005)** — локальный симулятор очереди, остаётся как fallback
- ✅ **Наш PACS-фасад** (RIS) — продолжает работать, обслуживает наш фронт
- ✅ **Наш Orthanc, PostgreSQL, тестовые данные** (12 исследований, 31 пациент) — не трогаем
- ✅ **Все 41 backend тестов** — продолжают работать
- ✅ **Наш фронт MedPlatform** (:5173) — продолжает работать как основной UI

### ❌ НЕ делаем
- ❌ Не трогаем чужой Yutkar-фронт (у них свой UI, нас не касается)
- ❌ Не клонируем Yutkar-фронт (это не наш продукт)
- ❌ Не запускаем SmartQ-бэк (пока не нужно — наш elqueue имитирует)
- ❌ Не переписываем наш фронт на чужой стек (axios/react-query)
- ❌ Не дублируем логику очереди в нашем РИС (SmartQ — внешний источник)

---

## 2. Архитектура

```
                    [ Врач-радиолог ]
                            │
                            │ (всё через наш UI)
                            ▼
                [ Наш фронт MedPlatform ]
                    [ Vite + React :5173 ]
                            │
                            │ JWT Authorization
                            ▼
                [ Наш бэк — РИС ]
                [ FastAPI :8000 ]
                            │
                ┌───────────┼───────────────┐
                │           │               │
                ▼           ▼               ▼
        [ Наш Orthanc  ]  [ Наш       ]  [ SmartQ-бэк        ]
        [ :8042       ]  [ PostgreSQL]  [ NikNebog/         ]
        [ 12 DICOM    ]  [ 31 пац.    ]  [ smartq-back :3000 ]
        [ исследований]  [ заказы    ]  [ электронная       ]
                                       [ очередь           ]
                                       [ (внешний API)     ]
```

**Ключевая идея:**
- Наш единственный фронт (MedPlatform) = **single source of truth для врача**
- Наш РИС = **интеграционный хаб** между нашим PACS и внешней SmartQ
- Врач не знает, что часть данных приходит из SmartQ — он просто видит талоны и снимки

---

## 3. Что должен уметь делать врач (через наш фронт)

| # | Действие | Источник | Эндпоинт нашего РИС |
|---|----------|----------|----------------------|
| 1 | Залогиниться | Наш РИС | `POST /api/auth/login` |
| 2 | Видеть список талонов | SmartQ | `GET /api/queue/tickets` (наш прокси в SmartQ) |
| 3 | Видеть список исследований | Наш PACS | `GET /api/v1/studies` |
| 4 | Открыть карточку пациента | Наша БД | `GET /api/v1/patients/{id}` + `/api/v1/patients/{id}/studies` |
| 5 | Открыть снимок (DICOM) | Наш Orthanc | `GET /api/v1/studies/{uid}/preview` + `/api/v1/instances/{id}/dicom` |
| 6 | Написать протокол | Наша БД | `PUT /api/orders/{id}/protocol` |
| 7 | Подписать протокол | Наша БД | `POST /api/orders/{id}/protocol/sign` |

**7 эндпоинтов нашего РИС** (а не 19 — врачу не нужен весь CRUD).

---

## 4. Что делает наш РИС (внутри)

| Операция | Что происходит |
|----------|---------------|
| `GET /api/queue/tickets` | Наш РИС вызывает `GET /tickets` SmartQ (с их JWT), маппит поля, возвращает нашему фронту |
| `POST /api/queue/tickets` | Наш РИС вызывает `POST /tickets/kiosk` SmartQ |
| `POST /api/queue/tickets/:id/call` | Наш РИС вызывает SmartQ + создаёт наш `Order` |
| `POST /api/queue/tickets/:id/complete` | Наш РИС вызывает SmartQ + обновляет наш `Order.status` |
| Webhook `/api/hooks/smartq/ticket-called` | SmartQ вызывает нас при вызове талона → создаём `Order` |
| Webhook `/api/hooks/smartq/ticket-completed` | SmartQ вызывает нас при завершении → обновляем `Order.status` |

---

## 5. SmartQ-готовность нашего бэка (что нужно)

### 5.1. Новые эндпоинты нашего RIS
```python
# backend/ris/routers/queue_integration.py  (новый файл)

@router.get("/api/queue/cabinets")
async def get_cabinets() -> list[Room]:
    """Прокси: GET /rooms SmartQ → наш формат"""

@router.get("/api/queue/tickets")
async def get_tickets(status: str | None = None) -> list[TicketOut]:
    """Прокси: GET /tickets SmartQ с фильтром"""

@router.post("/api/queue/tickets")
async def create_ticket(body: TicketCreateRequest) -> TicketOut:
    """Прокси: POST /tickets/kiosk SmartQ"""

@router.post("/api/queue/tickets/{ticket_id}/call")
async def call_ticket(ticket_id: str) -> OrderOut:
    """1. SmartQ: POST /tickets/:id/call
       2. Создаёт наш Order с source_ticket_id=ticket_id
       3. Возвращает наш OrderOut"""

@router.post("/api/queue/tickets/{ticket_id}/complete")
async def complete_ticket(ticket_id: str) -> OrderOut:
    """1. SmartQ: POST /tickets/:id/complete
       2. Обновляет наш Order.status='completed'
       3. Возвращает OrderOut"""

# Webhook endpoints (вызываются SmartQ)
@router.post("/api/hooks/smartq/event")
async def smartq_webhook(payload: SmartQEvent):
    """Обрабатывает события SmartQ: ticket_called, status_update и т.д.
    Создаёт/обновляет наши Order в зависимости от события."""
```

### 5.2. Новая модель данных
```python
# backend/db/models/ris.py — добавить поля:
class Order:
    # ... существующие поля ...
    source_ticket_id: Mapped[uuid.UUID | None]  # ID талона из SmartQ
    source_system: Mapped[str | None]            # "smartq" | None
    smartq_called_at: Mapped[datetime | None]
```

### 5.3. SmartQ-клиент
```python
# backend/ris/services/smartq_client.py  (новый файл)
class SmartQClient:
    def __init__(self, base_url, jwt_token):
        self.base_url = base_url
        self.jwt_token = jwt_token
    
    async def get_rooms(self) -> list[dict]: ...
    async def get_tickets(self, status: str | None = None) -> list[dict]: ...
    async def create_ticket(self, ...) -> dict: ...
    async def call_ticket(self, ticket_id: str) -> dict: ...
    async def complete_ticket(self, ticket_id: str) -> dict: ...
```

### 5.4. Авторизация в SmartQ
- Сервисный аккаунт SmartQ (например, `admin / admin123` — как в их дефолтном seed)
- Токен хранится в нашем `.env`: `SMARTQ_SERVICE_TOKEN=...`
- При старте RIS получает токен (login + cache refresh)
- Все запросы к SmartQ — с `Authorization: Bearer <SMARTQ_SERVICE_TOKEN>`

### 5.5. Webhook secret
- HMAC подпись для проверки webhook от SmartQ
- В `.env`: `SMARTQ_WEBHOOK_SECRET=...`
- В SmartQ настраивается webhook URL: `https://our-ris.com/api/hooks/smartq/event`

---

## 6. Шаги (пошагово, проверяем после каждого)

### Шаг 2: Клонировать SmartQ-бэк и подготовить локально (1 час)
- Склонировать `https://github.com/NikNebog/smartq-back` в `C:\Projects\ARCHIVE\smartq-back\`
- Создать БД `smartq_dev`
- Применить Prisma-миграции
- Заполнить тестовые данные (3 пациента, 2 кабинета, 3 типа услуг)
- Запустить SmartQ на :3000
- Проверить `/api/docs` (Swagger)
- **Гейт:** SmartQ работает, отдаёт данные через API

### Шаг 3: SmartQ-клиент в нашем RIS (1 час)
- Создать `backend/ris/services/smartq_client.py`
- Реализовать все методы (get_rooms, get_tickets, create_ticket, call_ticket, complete_ticket)
- Аутентификация: service token через `POST /auth/login`
- Кэширование токена в памяти (обновление при 401)
- **Гейт:** Клиент работает (можно тестировать через `python -c "..."`)

### Шаг 4: SmartQ-роутер в нашем RIS (1.5 часа)
- Создать `backend/ris/routers/queue_integration.py` с 5 эндпоинтами
- Маппинг данных SmartQ → наш формат
- Подключить в `ris/main.py`
- 5 автотестов
- **Гейт:** Все эндпоинты работают, наш фронт может вызывать

### Шаг 5: Webhook-эндпоинт (1 час)
- Создать `backend/ris/routers/webhooks.py`
- HMAC-проверка подписи
- Обработка событий: `ticket_called`, `ticket_completed`, `status_update`
- Создание/обновление наших `Order` записей
- 3 автотеста (успех, неверная подпись, неизвестный талон)
- **Гейт:** Webhook принимает события и обновляет нашу БД

### Шаг 6: Миграция БД (30 мин)
- Добавить поля `source_ticket_id`, `source_system`, `smartq_called_at` в `db/models/ris.py`
- Создать Alembic-миграцию: `alembic revision --autogenerate -m "smartq integration"`
- Применить: `alembic upgrade head`
- **Гейт:** Миграция прошла, поля в БД

### Шаг 7: Обновить наш фронт (1.5 часа)
- `frontend/src/api/queue.ts` — обновить endpoints (наш `/api/queue/*` вместо `/api/*` с elqueue)
- `frontend/src/hooks/useQueue.ts` — обновить (если API изменился)
- `frontend/src/types/queue.ts` — обновить типы
- **Гейт:** Наш фронт показывает данные из SmartQ через наш РИС

### Шаг 8: Наш elqueue как fallback (30 мин)
- Сейчас наш elqueue на :8005
- Нужно: переключатель в `start-all-services.bat` (если SmartQ недоступен — использовать elqueue)
- В `api/queue.ts` фронта: автоматический fallback
- **Гейт:** Если SmartQ упал, очередь продолжает работать через elqueue

### Шаг 9: E2E-тесты (2 часа)
- Сценарий: врач открывает наш фронт → видит талоны из SmartQ
- Сценарий: вызов талона → наш РИС создаёт заказ
- Сценарий: webhook от SmartQ → наш РИС обновляет статус
- **Гейт:** Полный цикл работает

### Шаг 10: Документация (1 час)
- Обновить `docs/SMARTQ_INTEGRATION_PLAN.md` (отметить ✅ выполненное)
- Обновить `docs/ARCHITECTURE.md` — добавить SmartQ
- Обновить `start-all-services.bat` — добавить SmartQ
- `PRACTICE_LOG.md` — записи о каждом шаге
- `TRACKER.md` — отметить закрытые задачи

**ИТОГО: 11-14 часов** (2-3 рабочих дня)

---

## 7. Что получится в итоге

**Врач-радиолог работает в нашем UI (MedPlatform :5173):**
1. Залогинится → попадает на Dashboard
2. Видит список **таб**лонов (из SmartQ через наш РИС)
3. Видит список **исследований** (из нашего Orthanc)
4. Кликает на исследование → **просмотр DICOM** (через наш PACS-фасад)
5. Пишет **протокол** → сохраняет (в нашей БД)
6. Подписывает → **webhook в SmartQ** «талон завершён»
7. SmartQ обновляет статус своего талона на `completed`

**Регистратор работает в SmartQ (это не наш UI):**
1. Создаёт талон в SmartQ
2. SmartQ присылает webhook в наш РИС → создаётся `Order` в нашей БД
3. Врач видит этот `Order` в нашем UI

---

## 8. Чеклист готовности

Перед стартом Шага 2:
- [x] Yutkar откатили (склонированный репозиторий удалён) ✅
- [x] Лишний анализ-документ удалён ✅
- [x] План пересмотрен под правильный scope ✅
- [x] Наш фронт работает на :5173 ✅
- [x] Наш РИС работает на :8000 ✅
- [x] Наш elqueue работает на :8005 (как симулятор) ✅
- [x] Наш Orthanc работает на :8042 ✅
- [ ] Доступ к SmartQ-репо (URL, .env с сервисным токеном)

---

*План полностью пересмотрен 09.06.2026. Задача: наш РИС подключаем к SmartQ, наш единственный фронт показывает всё как единое целое.*
