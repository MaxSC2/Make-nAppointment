# MedPlatform — RIS/PACS с интеграцией SmartQ

**Дата:** 09.06.2026
**Статус:** ✅ Работает с **реальным** SmartQ (NikNebog)

---

## Запуск за 5 минут

```powershell
# 1. Запустить SmartQ (NikNebog)
cd C:\Projects\ARCHIVE\smartq-back
npm start

# 2. Запустить наш РИС
cd C:\Projects\ARCHIVE\MedPlatform\backend
$env:PYTHONPATH = "C:\Projects\ARCHIVE\MedPlatform\backend"
.\.venv\Scripts\python.exe -B -m uvicorn ris.main:app --port 8000 --log-level warning

# 3. Запустить elqueue (fallback)
.\.venv\Scripts\python.exe -B -m uvicorn elqueue.main:app --port 8005 --log-level warning

# 4. Запустить наш фронт
cd ..\frontend
npm run dev

# 5. Запустить Yutkar/frontend (наглядный UI)
cd C:\Projects\ARCHIVE\yutkar-frontend
npm run dev
```

**Порты:**
- `:5173` — наш фронт
- `:5174` — Yutkar/UI (наглядный SmartQ-интерфейс)
- `:3000` — SmartQ (NikNebog)
- `:8000` — наш РИС
- `:8005` — elqueue (fallback)
- `:8042` — Orthanc (PACS)

---

## Архитектура

```
Yutkar/frontend (:5174)  →  SmartQ (:3000)   [чужой UI, наглядно]
Наш Vite (:5173)         →  Наш РИС (:8000)  →  SmartQ (:3000)  ← основной
                                ↓ (если SMARTQ_ENABLED=false)
                              Mock (stateful, in-memory)
Наш elqueue (:8005)                            ← Fallback-симулятор
```

---

## Smoke-тест (11/11 passed)

```powershell
cd C:\Projects\ARCHIVE\MedPlatform\backend
$env:PYTHONPATH = "C:\Projects\ARCHIVE\MedPlatform\backend"
& ".\.venv\Scripts\python.exe" "C:\Users\Пользователь\AppData\Local\Temp\opencode\_smoke_queue.py"
```

Ожидаемый вывод: `=== ALL 11 SMOKE TESTS PASSED ===`

---

## Учётные данные

- **Наш РИС:** `admin` / `admin123`
- **SmartQ:** `admin@smartq.local` / `admin123`
- **Yutkar/UI:** те же, что и SmartQ
- **Orthanc:** `orthanc` / `orthanc`

---

## Документация

- [docs/SMARTQ_LIVE_INTEGRATION.md](docs/SMARTQ_LIVE_INTEGRATION.md) — как поднять и проверить
- [docs/INTEGRATION_CHECKLIST_2026-06-09.md](docs/INTEGRATION_CHECKLIST_2026-06-09.md) — чеклист
- [docs/yutkar-smartq-screenshot-2026-06-09.png](docs/yutkar-smartq-screenshot-2026-06-09.png) — скриншот Yutkar
- [OneDrive/Рабочий стол/QUEUE_INTEGRATION_REPORT_2026-06-09.md](QUEUE_INTEGRATION_REPORT_2026-06-09.md) — полный отчёт для стороннего ИИ
- [TRACKER_SMARTQ.md](TRACKER_SMARTQ.md) — статусы задач
- [PRACTICE_LOG.md](PRACTICE_LOG.md) — дневник практики

---

## Что работает СЕЙЧАС (09.06.2026 17:30)

- ✅ SmartQ поднят (NestJS + Prisma + PostgreSQL)
- ✅ Yutkar/UI поднят (React 19 + Vite 8)
- ✅ Наш РИС подключён к SmartQ (SMARTQ_ENABLED=true)
- ✅ 7 эндпоинтов `/api/queue/*` работают с реальным SmartQ
- ✅ Идемпотентность вызовов (Order создаётся/обновляется)
- ✅ State-машина (waiting → in_progress → done)
- ✅ 64/64 unit-теста + 11/11 live-тестов
- ✅ Yutkar/UI показывает реальную страницу авторизации SmartQ
- ✅ Данные сохраняются в `smartq_db` и `pacs_ris`

---

## Что осталось (TODO)

- ⏳ Webhook от SmartQ → наш РИС
- ⏳ Подключить наш фронт к SmartQ через наш РИС
- ⏳ Playwright E2E
- ⏳ Production-ready: HTTPS, JWT refresh, rate limiting
