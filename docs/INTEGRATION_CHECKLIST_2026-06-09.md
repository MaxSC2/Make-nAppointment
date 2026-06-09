# Чеклист проверки интеграции РИС ↔ SmartQ

**Версия:** 09.06.2026
**Что проверяем:** end-to-end работа: Yutkar/frontend → SmartQ → наш РИС → наша БД

---

## 1. Предусловия

| # | Проверка | Команда / URL | Ожидаемый результат |
|---|----------|---------------|---------------------|
| 1.1 | PostgreSQL 16 запущен | `Get-Service postgresql-x64-16` | Running |
| 1.2 | БД `pacs_ris` существует | `psql -U postgres -l` | есть `pacs_ris` |
| 1.3 | БД `smartq_db` существует | `psql -U postgres -l` | есть `smartq_db` |
| 1.4 | Orthanc запущен | `curl http://localhost:8042/system` | 200 OK |
| 1.5 | Node.js установлен | `node --version` | v18+ |
| 1.6 | Python venv | `.\.venv\Scripts\python.exe --version` | 3.14+ |

---

## 2. Запуск сервисов

| # | Сервис | Порт | Команда | Ожидание |
|---|--------|------|---------|----------|
| 2.1 | SmartQ | 3000 | `cd smartq-back && npm start` | "Nest application successfully started" |
| 2.2 | Наш РИС | 8000 | `python -m uvicorn ris.main:app --port 8000` | "Uvicorn running on :8000" |
| 2.3 | Наш elqueue (fallback) | 8005 | `python -m uvicorn elqueue.main:app --port 8005` | "Uvicorn running on :8005" |
| 2.4 | Наш Vite | 5173 | `cd frontend && npm run dev` | "Local: http://localhost:5173" |
| 2.5 | Yutkar/frontend | 5174 | `cd yutkar-frontend && npm run dev` | "Local: http://localhost:5174" |

**Проверка:** `Get-NetTCPConnection -State Listen | Where-Object {$_.LocalPort -in 3000, 5173, 5174, 8000, 8005, 8042}` — все 6 портов в `Listen`.

---

## 3. Проверка SmartQ (напрямую)

| # | Действие | Команда | Ожидаемый ответ |
|---|----------|---------|-----------------|
| 3.1 | Login | `POST http://localhost:3000/auth/login {"email":"admin@smartq.local","password":"admin123"}` | 201, `access_token` |
| 3.2 | Rooms | `GET http://localhost:3000/rooms` (с Bearer) | 200, массив ≥1 |
| 3.3 | Service Types | `GET http://localhost:3000/service-types` | 200, ≥5 типов |
| 3.4 | Tickets | `GET http://localhost:3000/tickets` | 200, массив |
| 3.5 | Kiosk | `POST http://localhost:3000/tickets/kiosk {"serviceTypeId":1,"priorityWeight":3}` | 201, ticket с `number` |
| 3.6 | Swagger docs | `GET http://localhost:3000/api/docs` | 200, HTML |

---

## 4. Проверка нашего РИС

| # | Действие | Команда | Ожидаемый ответ |
|---|----------|---------|-----------------|
| 4.1 | Login | `POST http://localhost:8000/api/auth/login {"username":"admin","password":"admin123"}` | 200, JWT |
| 4.2 | /cabinets | `GET http://localhost:8000/api/queue/cabinets` | 200, **реальные** кабинеты из SmartQ |
| 4.3 | /service-types | `GET http://localhost:8000/api/queue/service-types` | 200, **реальные** типы |
| 4.4 | /tickets | `GET http://localhost:8000/api/queue/tickets` | 200, реальные |
| 4.5 | POST /tickets | `POST http://localhost:8000/api/queue/tickets {"full_name":"Test","policy_number":"P-1","modality":"CT","priority":"routine"}` | 201, талон |
| 4.6 | POST /call | `POST /api/queue/tickets/{id}/call` | 200, `order_id`, `in_progress` |
| 4.7 | Idempotency | Повторить 4.6 | тот же `order_id` |
| 4.8 | POST /complete | `POST /api/queue/tickets/{id}/complete` | 200, `done` |
| 4.9 | 401 без токена | `GET /api/queue/cabinets` без Authorization | 401 |

---

## 5. Проверка Yutkar/frontend (наглядно)

| # | Действие | Ожидание |
|---|----------|----------|
| 5.1 | Открыть http://localhost:5174/ | Страница "SmartQ — Авторизация" |
| 5.2 | Ввести `admin@smartq.local` / `admin123`, "Войти" | Переход на дашборд |
| 5.3 | Меню: Талоны/Очередь | Список реальных талонов (C001, C002...) |
| 5.4 | Киоск: создать талон | Новый талон в SmartQ |
| 5.5 | Доска (TV): вызвать талон | SmartQ.call → WebSocket событие |

---

## 6. Проверка БД

```sql
-- Наша БД: должно быть ≥1 Order со smartq-* полями
SELECT id, "sourceTicketId", "sourceSystem", "smartqCalledAt"
FROM ris.orders
WHERE "sourceSystem" = 'smartq';

-- БД SmartQ: должны быть талоны
SELECT id, number, status, priority FROM tickets ORDER BY id;
```

---

## 7. Чеклист smoke-теста (запускается автоматически)

Файл: `C:\Users\Пользователь\AppData\Local\Temp\opencode\_smoke_queue.py`

Команда:
```powershell
cd C:\Projects\ARCHIVE\MedPlatform\backend
$env:PYTHONPATH = "C:\Projects\ARCHIVE\MedPlatform\backend"
& ".\.venv\Scripts\python.exe" "C:\Users\Пользователь\AppData\Local\Temp\opencode\_smoke_queue.py"
```

**Ожидаемый вывод:** `=== ALL 11 SMOKE TESTS PASSED ===`

---

## 8. Известные отличия (UI ↔ API)

| UI (Yutkar) | API SmartQ (реальный) |
|-------------|----------------------|
| Логин: `email` (label "Логин") | `POST /auth/login {email, password}` |
| Auth: Bearer | `Authorization: Bearer <jwt>` |
| WebSocket для realtime | `socket.io` на `/` |
| Языки: Каз/Рус/Eng | `language` поле в ticket |

---

## 9. Скриншот Yutkar/frontend

Файл: `docs\yutkar-smartq-screenshot-2026-06-09.png` (157 КБ, 1280×800)

Что на нём:
- Заголовок: "SmartQ — Система управления медицинской очередью"
- Форма: Логин / Пароль / Войти
- Переключатель языков: Каз / Рус / Eng

Подтверждает: Yutkar/frontend успешно загрузился в backend mode и подключён к SmartQ (:3000).
