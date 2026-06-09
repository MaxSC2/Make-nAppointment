# SmartQ Live Integration — как поднять и проверить

**Дата:** 09.06.2026
**Цель:** наш РИС (:8000) → **реальный** SmartQ (NikNebog/smartq_back, :3000) + Yutkar/frontend (:5174) для наглядности.

---

## 1. Архитектура

```
Yutkar/frontend (:5174)  →  SmartQ (:3000)   [чужой UI, только для наглядности]
Наш Vite (:5173)         →  Наш РИС (:8000)  →  SmartQ (:3000)  ← основной
                                ↓ (если SMARTQ_ENABLED=false)
                              Mock (stateful, in-memory)
Наш elqueue (:8005)                            ← Fallback-симулятор (НЕ наш UI-маршрут)
```

---

## 2. Предусловия

- **Node.js** >= 18 + npm
- **PostgreSQL 16** (наша основная БД `pacs_ris` уже есть)
- **Права:** роль `pacs` (или `postgres`) с `ALL` на схемы `ris`, `queue`, `auth`, `audit`, `public`

---

## 3. Установка SmartQ (NikNebog/smartq_back)

### 3.1 Клонировать
```bash
git clone --depth 1 https://github.com/NikNebog/smartq_back.git C:\Projects\ARCHIVE\smartq-back
```

### 3.2 Создать БД
```sql
CREATE DATABASE smartq_db OWNER pacs;
GRANT ALL ON SCHEMA public TO pacs;
```

### 3.3 Создать `.env` (smartq-back/)
```bash
DATABASE_URL=postgresql://pacs:pacs@localhost:5432/smartq_db?schema=public
PORT=3000
JWT_SECRET=dev-smartq-secret-change-me-in-prod
JWT_EXPIRES_IN=24h
```

### 3.4 Установить и поднять
```bash
cd C:\Projects\ARCHIVE\smartq-back
npm install
npx prisma migrate deploy
npm run seed            # создаёт 5 service-types, 2 rooms, 1 terminal
npm start               # стартует на :3000
```

### 3.5 Создать admin-пользователя
```bash
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Admin","email":"admin@smartq.local","password":"admin123","role":"admin"}'
```

⚠️ **SmartQ использует `email` для логина, не `username`.**

---

## 4. Настройка нашего РИС

### 4.1 Редактировать `backend/.env`
```bash
SMARTQ_URL=http://localhost:3000
SMARTQ_USERNAME=admin@smartq.local   # ← email, не username!
SMARTQ_PASSWORD=admin123
SMARTQ_WEBHOOK_SECRET=change-me-smartq-webhook-secret-in-production
SMARTQ_ENABLED=true                  # ← включить
```

### 4.2 Уже сделано в коде
- `backend/ris/services/smartq_client.py` — клиент использует `email` (а не `username`) в POST /auth/login
- `backend/ris/routers/queue_integration.py:141` `_smartq_ticket_to_ours` — поддерживает **вложенные** объекты `serviceType` и `room` (не id-строки)

### 4.3 Перезапустить РИС
```powershell
Stop-Process -Id <old-ris-pid> -Force
cd C:\Projects\ARCHIVE\MedPlatform\backend
$env:PYTHONPATH = "C:\Projects\ARCHIVE\MedPlatform\backend"
Start-Process -FilePath ".\.venv\Scripts\python.exe" `
  -ArgumentList @("-B", "-m", "uvicorn", "ris.main:app", "--port", "8000", "--log-level", "warning") `
  -WorkingDirectory "C:\Projects\ARCHIVE\MedPlatform\backend" `
  -RedirectStandardOutput "C:\Users\Пользователь\AppData\Local\Temp\ris-out.log" `
  -RedirectStandardError "C:\Users\Пользователь\AppData\Local\Temp\ris-err.log" `
  -WindowStyle Hidden -PassThru
```

---

## 5. Установка Yutkar/frontend (наглядный UI)

### 5.1 Клонировать
```bash
git clone --depth 1 https://github.com/Yutkar/frontend.git C:\Projects\ARCHIVE\yutkar-frontend
```

### 5.2 Создать `.env` (yutkar-frontend/)
```bash
VITE_API_MODE=backend              # ← backend, не mock
VITE_SMARTQ_API_URL=http://localhost:3000
```

### 5.3 Установить и поднять
```bash
cd C:\Projects\ARCHIVE\yutkar-frontend
npm install
npm run dev                        # стартует на :5174 (если 5173 занят)
```

### 5.4 Открыть в браузере
```
http://localhost:5174/
```

Увидим **страницу авторизации SmartQ** с формой "Логин/Пароль" и переключателем языков (Каз/Рус/Eng).

---

## 6. Проверка работоспособности

### 6.1 Live smoke-тест нашего РИС → SmartQ

Файл: `C:\Users\Пользователь\AppData\Local\Temp\opencode\_smoke_queue.py`

```python
import sys
import httpx

BASE = "http://localhost:8000"


def main() -> int:
    with httpx.Client(base_url=BASE, timeout=10) as c:
        # 1. Login
        r = c.post("/api/auth/login", json={"username": "admin", "password": "admin123"})
        r.raise_for_status()
        token = r.json()["access_token"]
        h = {"Authorization": f"Bearer {token}"}
        print(f"[1] Login OK (token {token[:24]}...)")

        # 2. /api/queue/cabinets
        r = c.get("/api/queue/cabinets", headers=h)
        r.raise_for_status()
        rooms = r.json()
        print(f"[2] /cabinets OK — {len(rooms)} rooms, first={rooms[0]['name']}")

        # 3. /api/queue/service-types
        r = c.get("/api/queue/service-types", headers=h)
        r.raise_for_status()
        services = r.json()
        print(f"[3] /service-types OK — {len(services)} types: {[s['name'] for s in services]}")

        # 4-6. tickets
        r = c.get("/api/queue/tickets", headers=h); r.raise_for_status()
        tickets = r.json()
        print(f"[4] /tickets OK — {len(tickets)} tickets")

        r = c.get("/api/queue/tickets?status=waiting", headers=h); r.raise_for_status()
        waiting = r.json()
        print(f"[5] /tickets?status=waiting OK — {len(waiting)} waiting")

        r = c.get("/api/queue/room/1/next", headers=h); r.raise_for_status()
        nxt = r.json()
        print(f"[6] /room/1/next OK — {nxt.get('ticket_number') if nxt else 'null'}")

        # 7. POST /tickets (kiosk)
        r = c.post("/api/queue/tickets", headers=h, json={
            "full_name": "Test Patient",
            "policy_number": "P-TEST-001",
            "modality": "CT",
            "priority": "routine",
        })
        r.raise_for_status()
        new_ticket = r.json()
        new_id = new_ticket["id"]
        print(f"[7] POST /tickets OK — id={new_id} num={new_ticket['ticket_number']}")

        # 8. POST /call
        r = c.post(f"/api/queue/tickets/{new_id}/call", headers=h); r.raise_for_status()
        call = r.json()
        assert call["status"] == "in_progress", call
        print(f"[8] POST /call OK — order_id={call['order_id']} status={call['status']}")

        # 9. Idempotency
        r = c.post(f"/api/queue/tickets/{new_id}/call", headers=h); r.raise_for_status()
        call2 = r.json()
        assert call2["order_id"] == call["order_id"]
        print(f"[9] POST /call (idempotent) OK — same order_id")

        # 10. POST /complete
        r = c.post(f"/api/queue/tickets/{new_id}/complete", headers=h); r.raise_for_status()
        done = r.json()
        assert done["status"] == "done"
        print(f"[10] POST /complete OK — status={done['status']}")

        # 11. No-auth
        r = httpx.get(f"{BASE}/api/queue/cabinets")
        assert r.status_code in (401, 403)
        print(f"[11] No-auth correctly rejected ({r.status_code})")

        print("\n=== ALL 11 SMOKE TESTS PASSED ===")
        return 0


if __name__ == "__main__":
    sys.exit(main())
```

**Ожидаемый вывод с реальным SmartQ:**
```
[1] Login OK
[2] /cabinets OK — 2 rooms, first=Кабинет 1
[3] /service-types OK — 5 types: ['consultation', 'payment', 'xray', 'analysis', 'other']
[4] /tickets OK — 1 tickets
[5] /tickets?status=waiting OK — 1 waiting
[6] /room/1/next OK — C001
[7] POST /tickets OK — id=2 num=C002
[8] POST /call OK — order_id=... status=in_progress
[9] POST /call (idempotent) OK — same order_id
[10] POST /complete OK — status=done
[11] No-auth correctly rejected (401)

=== ALL 11 SMOKE TESTS PASSED ===
```

### 6.2 Проверка Yutkar/frontend
1. Открыть `http://localhost:5174/`
2. Должна быть страница "SmartQ — Система управления медицинской очередью"
3. Войти: `admin@smartq.local` / `admin123`
4. Увидеть доску талонов с C001 (waiting) или C002 (completed)

### 6.3 Проверка в реальной БД
```sql
SELECT id, number, status, priority, "serviceTypeId", "roomId", "createdAt"
FROM tickets ORDER BY id;
-- Ожидаем: 1 строка или больше (наши талоны из smoke-теста)
```

---

## 7. Известные расхождения SmartQ ↔ Наш код

| Что | SmartQ (реальный) | Наш клиент ожидал | Как починили |
|-----|-------------------|-------------------|--------------|
| Login | `{email, password}` | `{username, password}` | `smartq_client.py:98` → `email` |
| Ticket.serviceType | вложенный `{id, name, ...}` | id-строка `serviceTypeId` | `queue_integration.py:148` — оба варианта |
| Ticket.room | вложенный `{id, name, ...}` | id-строка `roomId` | `queue_integration.py:161` — оба варианта |
| ServiceType поля | `name`, `priorityWeight`, `active` | `name`, `priority`, `averageDurationMinutes` | работает (читаем `name` напрямую) |
| Status enum | `created/waiting/called/in_service/completed/cancelled/no_show/redirected` | маппинг `_STATUS_MAP` | совпадает, проверено |
| Priority | `1..5`, 5 = highest (desc sort) | маппинг `_PRIORITY_MAP` | совпадает (4-5 → routine) |

---

## 8. Файлы репозитория

| Файл | Что делает |
|------|------------|
| `backend/ris/services/smartq_client.py` | HTTP-клиент к SmartQ (10 методов) |
| `backend/ris/routers/queue_integration.py` | 7 эндпоинтов `/api/queue/*` с маппингом |
| `backend/db/models/ris.py` | Поля `source_ticket_id`, `source_system`, `smartq_called_at` в Order |
| `backend/alembic/versions/0002_smartq_fields.py` | Миграция для 3 полей + index |
| `backend/.env` | `SMARTQ_ENABLED=true`, `SMARTQ_USERNAME=admin@smartq.local` |
| `backend/tests/test_smartq_client.py` | 17 unit-тестов (respx-моки) |

---

## 9. Что делать, если что-то сломалось

1. **SmartQ не поднимается** → `Get-Content C:\Users\Пользователь\AppData\Local\Temp\smartq-err.log -Tail 20`
2. **Наш РИС не поднимается** → `Get-Content C:\Users\Пользователь\AppData\Local\Temp\ris-err.log -Tail 20`
3. **401 на любой запрос** → перепроверить `SMARTQ_ENABLED=true` и правильный email/password
4. **502 Bad Gateway от нашего РИС** → SmartQ не отвечает. Проверить `netstat` на :3000
5. **Yutkar показывает mock-данные** → в `.env` Yutkar должно быть `VITE_API_MODE=backend` (не `mock`)
6. **Данные в SmartQ не появляются** → проверить, что РИС ходит на правильный URL: `curl http://localhost:3000/tickets -H "Authorization: Bearer $(curl -X POST http://localhost:3000/auth/login -H 'Content-Type: application/json' -d '{"email":"admin@smartq.local","password":"admin123"}' | jq -r .access_token)"`
