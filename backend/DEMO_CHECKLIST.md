# ДЕМО-ЧЕКЛИСТ MVP — PACS-RIS-Queue

> Цель: за 5–7 минут проверить весь функционал MVP по ТЗ v3.0 (раздел 10 «Критерии приёмки MVP»).

---

## 0. ПОДГОТОВКА (однократно)

### 0.1. Кодировка PowerShell

Русские строки в выводе Python в PowerShell отображаются иероглифами. **Обязательно** перед каждым запуском:

```powershell
$env:PYTHONIOENCODING="utf-8"
$env:PYTHONUTF8="1"
chcp 65001 | Out-Null   # UTF-8 в консоли
```

Без этого сервисы стартуют, но `print("Привет")` выведет кракозябры.

### 0.2. Проверка, что всё запущено

| Сервис | Порт | Проверка |
|---|---|---|
| PostgreSQL 16 | 5432 | `Get-Service postgresql-x64-16` → Running |
| Orthanc 26.6.0 | 8042 / 4242 | `Invoke-RestMethod http://localhost:8042/system` → Version 1.12.x |
| RIS (FastAPI) | 8000 | `Invoke-RestMethod http://localhost:8000/health` → `{"status":"ok","service":"ris"}` |
| elqueue (FastAPI) | 8005 | `Invoke-RestMethod http://localhost:8005/health` → `{"status":"ok","service":"elqueue"}` |

Если что-то не отвечает — запуск ниже.

### 0.3. Запуск (если не запущено)

```powershell
Set-Location "C:\Projects\pacs-ris-queue"

# 1. Orthanc (если не работает)
$orthanc = "C:\Program Files\Orthanc Server\Orthanc.exe"
if (-not (Get-Process Orthanc -ErrorAction SilentlyContinue)) {
    Start-Process -FilePath $orthanc -WindowStyle Hidden
    Start-Sleep 4
}

# 2. RIS
if (-not (Get-NetTCPConnection -LocalPort 8000 -ErrorAction SilentlyContinue)) {
    $env:PYTHONIOENCODING="utf-8"
    Start-Process -FilePath "python" -ArgumentList "-m","uvicorn","ris.main:app","--port","8000","--host","0.0.0.0" `
        -RedirectStandardOutput "ris.log" -RedirectStandardError "ris.err.log" -WindowStyle Hidden
}

# 3. elqueue
if (-not (Get-NetTCPConnection -LocalPort 8005 -ErrorAction SilentlyContinue)) {
    $env:PYTHONIOENCODING="utf-8"
    Start-Process -FilePath "python" -ArgumentList "-m","uvicorn","elqueue.main:app","--port","8005","--host","0.0.0.0" `
        -RedirectStandardOutput "elqueue.log" -RedirectStandardError "elqueue.err.log" -WindowStyle Hidden
}

Start-Sleep 4
```

Проверить: `Invoke-RestMethod http://localhost:8000/health; Invoke-RestMethod http://localhost:8005/health`

---

## 1. БРАУЗЕР — открыть 4 вкладки

| Вкладка | URL | Назначение |
|---|---|---|
| A. Регистратура | `http://localhost:8005/` | Вход пациентов |
| B. Панель врача | `http://localhost:8005/admin` | Вызов / завершение |
| C. Исследования RIS | `http://localhost:8000/studies` | Список заказов + DICOM |
| D. Orthanc Explorer | `http://localhost:8042/app/explorer.html` | PACS напрямую |

---

## 2. ЛОГИН (F0.1)

### Из PowerShell

```powershell
$tok = (Invoke-RestMethod -Uri "http://localhost:8005/api/auth/login" `
    -Method POST -ContentType "application/json" `
    -Body '{"username":"admin","password":"admin123"}').access_token
Write-Host "Token: $tok"   # Скопировать для следующих шагов
```

**Ожидаемо:** длинная строка JWT (eyJhbGciOi...).

**Ошибка 401?** Проверить, что `db/init_db.py` запускался. Перезасеять:
```powershell
Set-Location "C:\Projects\pacs-ris-queue"
python -m db.init_db
```

### Из браузера (вкладка A)

1. Открыть `http://localhost:8005/login`
2. Логин: `admin` / Пароль: `admin123`
3. Должен редиректнуть на `/`

**Ожидаемо:** в правом верхнем углу появится «admin (выйти)».

---

## 3. РЕГИСТРАЦИЯ ПАЦИЕНТА (F1.1, F1.2, F1.9)

### Из PowerShell (с токеном из шага 2)

```powershell
$h = @{ Authorization = "Bearer $tok" }
$t = Invoke-RestMethod -Uri "http://localhost:8005/api/tickets" `
    -Method POST -ContentType "application/json" -Headers $h `
    -Body '{"full_name":"Тестов Пациент","policy_number":"TEST-001","cabinet_code":"101"}'

Write-Host "Талон: $($t.ticket_number)"
Write-Host "Order ID: $($t.order_id)"
Write-Host "Study UID: $($t.study_uid)"
```

**Ожидаемо:**
- `Талон: ABC123` (6 hex-символов, заглавные)
- `Order ID: a1b2c3d4` (8 hex, не пустой)
- `Study UID: 1.2.840.<random>` (DICOM-формат)

**Если `order_id` пустой** — RIS не получил запрос. Проверить:
```powershell
Get-Content "C:\Projects\pacs-ris-queue\elqueue.log" -Tail 10
```
Должно быть `[elqueue] RIS вернул 201: {...}`.

### Из браузера (вкладка A)

1. Форма «Регистрация пациента»
2. ФИО: `Демо Пациент`
3. Номер полиса: `DEMO-2026`
4. Кабинет: `101 (КТ)`
5. Кнопка «Зарегистрировать»

**Ожидаемо:** появится талон с номером, ФИО и кнопкой «Скачать/распечатать».

---

## 4. СПИСОК ТАЛОНОВ (F1.4)

### Из PowerShell

```powershell
Invoke-RestMethod -Uri "http://localhost:8005/api/tickets?cabinet=101" -Headers $h | `
    Select-Object ticket_number, status, patient, cabinet | Format-Table -AutoSize
```

**Ожидаемо:** массив с талонами, у каждого `status: "waiting"`, `cabinet.code: "101"`, `patient.full_name: "Тестов Пациент"`.

### Из браузера (вкладка B)

1. Панель врача → выпадающий список «Кабинет» → 101
2. Должен появиться талон из шага 3

---

## 5. ВЫЗОВ СЛЕДУЮЩЕГО ПАЦИЕНТА (F1.7)

### Из PowerShell

```powershell
Invoke-RestMethod -Uri "http://localhost:8005/api/tickets/next?cabinet=101" `
    -Method POST -Headers $h | Select-Object ticket_number, status, called_at
```

**Ожидаемо:**
- `ticket_number: <тот же, что в шаге 3>`
- `status: "in_progress"`
- `called_at: 2026-06-02T...` (заполнено)

### Из браузера (вкладка B)

1. Кнопка «▶ Вызвать следующего»
2. Статус талона изменится на `in_progress` (жёлтый/оранжевый)

---

## 6. ЗАВЕРШЕНИЕ ПРИЁМА (F1.8)

### Из PowerShell

```powershell
$ticket = "<номер из шага 3>"
Invoke-RestMethod -Uri "http://localhost:8005/api/tickets/$ticket/complete" `
    -Method POST -ContentType "application/json" -Headers $h `
    -Body '{"protocol_text":"КТ ОГК без патологии. R-грамма в норме."}' | `
    Select-Object ticket_number, status, completed_at
```

**Ожидаемо:**
- `status: "done"`
- `completed_at: 2026-06-02T...`

---

## 7. ПРОВЕРКА ЗАКАЗА В RIS (F2.1–F2.5)

### Из PowerShell

```powershell
$tok2 = (Invoke-RestMethod -Uri "http://localhost:8000/api/auth/login" `
    -Method POST -ContentType "application/json" `
    -Body '{"username":"admin","password":"admin123"}').access_token
$h2 = @{ Authorization = "Bearer $tok2" }

# Список всех заказов
Invoke-RestMethod -Uri "http://localhost:8000/api/orders" -Headers $h2 | `
    Select-Object id, modality, status, study_uid | Format-Table -AutoSize
```

**Ожидаемо:** заказ из шага 3 со `status: "scheduled"`, `modality: "CT"`, `study_uid` совпадает с шагом 3.

### Из браузера (вкладка C)

1. `http://localhost:8000/studies` — список всех исследований
2. Должен быть заказ с ФИО `Тестов Пациент`
3. Кликнуть → откроется детали

---

## 8. ПРОСМОТР DICOM (F3.x, F4.x)

### Из PowerShell (проверка, что снимки в PACS есть)

```powershell
# Список всех instance-IDs в Orthanc
$instances = Invoke-RestMethod -Uri "http://localhost:8000/api/orthanc/instances?expand=false"
Write-Host "Всего DICOM-файлов в Orthanc: $($instances.Count)"

# Скачать preview первого (PNG)
$firstId = $instances[0]
$png = Invoke-WebRequest -Uri "http://localhost:8000/api/orthanc/instances/$firstId/preview" `
    -UseBasicParsing -OutFile "C:\Users\Public\preview.png"
Write-Host "PNG: $((Get-Item 'C:\Users\Public\preview.png').Length) байт"
```

**Ожидаемо:** ~20 instances, preview ~30–40 КБ PNG.

### Из браузера (вкладка C)

1. На странице `/studies` нажать «🖼 Просмотр» у любого исследования
2. **Ctrl+Shift+R** (сброс кэша — иначе может показать старый 404)
3. Должен загрузиться Canvas с снимком

### Из браузера (вкладка D — Orthanc Explorer)

1. `http://localhost:8042/app/explorer.html`
2. Вкладка «All local Studies» → 4 исследования
3. Кликнуть на любое → серия срезов (10/8/1/1)
4. Кликнуть на срез → встроенный viewer OHIF (полноценный)

---

## 9. RBAC — ПРОВЕРКА ЗАЩИТЫ (S3, F0.5)

### Из PowerShell

```powershell
# Создать обычного пользователя через прямой INSERT в БД
$env:PGPASSWORD="pacs_secret"
& "C:\Program Files\PostgreSQL\16\bin\psql.exe" -U pacs -d pacs_ris -h localhost -c @"
INSERT INTO auth.users (id, username, password_hash, is_active, is_superuser, created_at)
VALUES (gen_random_uuid(), 'registrar', '\$2b\$12\$<bcrypt-hash>', true, false, now())
ON CONFLICT (username) DO NOTHING;
INSERT INTO auth.user_roles (user_id, role_id)
SELECT u.id, r.id FROM auth.users u, auth.roles r
WHERE u.username='registrar' AND r.code='registrar'
ON CONFLICT DO NOTHING;
"@
```

Проще — зайти под `admin` и через UI создать пользователя (после реализации admin-страницы, v1.0). Для MVP достаточно убедиться, что:

1. `POST /api/tickets` без токена → **401 Unauthorized**
2. `POST /api/tickets` с токеном `viewer` → **403 Forbidden**
3. `POST /api/tickets` с токеном `registrar` → **201 Created**

Проверить #1:
```powershell
try {
    Invoke-RestMethod -Uri "http://localhost:8005/api/tickets" `
        -Method POST -ContentType "application/json" `
        -Body '{"full_name":"X","policy_number":"Y","cabinet_code":"101"}' `
        -ErrorAction Stop
} catch {
    Write-Host "Ожидаемо: 401 — $($_.Exception.Message)"
}
```

---

## 10. AUDIT LOG (F4.x)

```powershell
$env:PGPASSWORD="pacs_secret"
& "C:\Program Files\PostgreSQL\16\bin\psql.exe" -U pacs -d pacs_ris -h localhost -c @"
SELECT created_at, action, entity_type, entity_id, user_id
FROM audit.audit_log
ORDER BY created_at DESC
LIMIT 10;
"@
```

**Ожидаемо:** ≥ 5 строк с действиями из шагов 3–7 (LOGIN, TICKET_CREATED, ORDER_CREATED, ...).

---

## 11. CHECKLIST — что должно работать

| # | Требование | Команда / URL | Ожидаемо | ✅ |
|---|---|---|---|---|
| 1 | PostgreSQL 16 | `psql ... -c "SELECT version()"` | `PostgreSQL 16.x` | ☐ |
| 2 | Orthanc | `GET /system` | `Version: 1.12.x` | ☐ |
| 3 | RIS health | `GET :8000/health` | `{"status":"ok"}` | ☐ |
| 4 | elqueue health | `GET :8005/health` | `{"status":"ok"}` | ☐ |
| 5 | Логин | `POST :8005/api/auth/login` | JWT pair | ☐ |
| 6 | Регистрация пациента | `POST :8005/api/tickets` | ticket с order_id | ☐ |
| 7 | Создание заказа в RIS | (side-effect #6) | order в `ris.orders` | ☐ |
| 8 | Список талонов | `GET :8005/api/tickets?cabinet=101` | массив | ☐ |
| 9 | FIFO-вызов | `POST :8005/api/tickets/next?cabinet=101` | in_progress | ☐ |
| 10 | Завершение | `POST .../complete` | done | ☐ |
| 11 | DICOM в Orthanc | `GET :8042/instances` | 20 inst | ☐ |
| 12 | DWV preview | `GET :8000/api/orthanc/instances/{id}/preview` | 200, image/png | ☐ |
| 13 | Просмотр в браузере | `http://localhost:8000/studies` | снимок виден | ☐ |
| 14 | Audit log | `SELECT * FROM audit.audit_log` | ≥ 5 строк | ☐ |
| 15 | RBAC (анонимный POST /tickets) | без токена | 401 | ☐ |

**Если все 15 — MVP по ТЗ v3.0 принят.**

---

## 12. ИЗВЕСТНЫЕ НЮАНСЫ ДЕМО

| Что | Почему | Решение |
|---|---|---|
| Иероглифы в консоли | PowerShell + UTF-8 | `$env:PYTHONIOENCODING="utf-8"` |
| Иероглифы в DICOM-тегах | DICOM = Latin-1, мы пишем UTF-8 | Тестовые имена, на работу не влияет |
| DWV пустой квадрат | Кэш браузера | Ctrl+Shift+R |
| `bcrypt 5.x` вместо 4.2.1 | pip обновил major | Работает, не критично |
| `httpx 0.27` вместо 0.28 | конфликт | Работает, не критично |
| `psycopg2 2.9.12` в pip list | подтянул pydicom 3.x | Не используется |

---

## 13. ЧТО НЕ ВХОДИТ В MVP (по ТЗ v3.0, раздел 1.3)

- DICOM MWL/MPPS (только в v1.0)
- HL7-шлюз (только в v1.0)
- Расписание, биллинг (только в v1.0)
- React-фронтенд (только в v1.0)
- 2FA, HTTPS, rate limiting (только в v1.0)

Это **сознательное ограничение** MVP. См. TZ.md, раздел 9 «Календарный план».

---

# ЭТАП 3. PACS v1.0 — DICOM MWL + MPPS

> **Цель:** показать, что аппарат КТ/МРТ может получить расписание от RIS (MWL) и сообщить о прогрессе (MPPS).
> **Срок:** 3-4 дня.
> **Стек:** `pynetdicom` 2.x + Orthanc (уже есть).
> **Обоснование:** см. TZ.md, ADR-002.

---

## 3.1. Подготовка

### 3.1.1. Установить pynetdicom

```powershell
cd C:\Projects\pacs-ris-queue
python -m pip install pynetdicom==2.0.2
```

### 3.1.2. Применить миграцию БД (добавить поля для MWL/MPPS)

```powershell
alembic upgrade head
```

Новые поля в `ris.orders`:
- `scheduled_at TIMESTAMPTZ` — дата/время слота
- `mpps_status VARCHAR(20)` — `NONE | IN_PROGRESS | COMPLETED | DISCONTINUED`
- `accession_number VARCHAR(20)` — DICOM-идентификатор заказа
- `requested_procedure_id VARCHAR(20)` — DICOM-идентификатор процедуры

### 3.1.3. Проверить порты (не заняты ли)

| Порт | Сервис | Проверка |
|---|---|---|
| 11112 | MWL SCP | `Test-NetConnection localhost -Port 11112` → TcpTestSucceeded: False (до запуска) |
| 11113 | MPPS SCP | `Test-NetConnection localhost -Port 11113` → TcpTestSucceeded: False (до запуска) |

---

## 3.2. Запуск dicom_gw

В **новом** PowerShell (с `$env:PYTHONIOENCODING="utf-8"`):

```powershell
cd C:\Projects\pacs-ris-queue
python -m dicom_gw
```

Ожидаемый вывод:
```
DICOM Gateway v1.0
- MWL Provider (C-FIND SCP) on port 11112  (AE: MEDPLATFORM_MWL)
- MPPS Receiver (N-CREATE/N-SET SCP) on port 11113  (AE: MEDPLATFORM_MPPS)
- Storage SCU (C-STORE SCU) → Orthanc:4242  (AE: MEDPLATFORM_SCU)
- Ready.
```

---

## 3.3. Демо-сценарий

### Шаг 1. Назначить слот заказу в RIS

```powershell
# Логин
$tok = (Invoke-RestMethod "http://localhost:8005/api/auth/login" `
    -Method POST -ContentType "application/json" `
    -Body '{"username":"admin","password":"admin123"}').access_token

# Назначить слот (нужен существующий order_id)
$orderId = "759552c8"   # из предыдущего демо
$headers = @{ Authorization = "Bearer $tok" }
Invoke-RestMethod "http://localhost:8000/api/v1/orders/$orderId/schedule" `
    -Method POST -Headers $headers -ContentType "application/json" `
    -Body '{"scheduled_at":"2026-06-02T14:30:00+03:00","modality":"CT","station_ae":"CT_SCANNER_01"}'
```

Ожидаемый ответ: `200 OK`, `{order_id, scheduled_at, accession_number, ...}`.

### Шаг 2. C-FIND MWL — аппарат запрашивает расписание

```powershell
# Используем findscu (входит в DCMTK или pynetdicom CLI)
python -m pynetdicom.samples.findscu `
    -aet CT_SCANNER_01 -aec MEDPLATFORM_MWL `
    localhost 11112 -k "PatientName=" -k "ScheduledProcedureStepStartDate=20260602"
```

Ожидаемый вывод: 1+ записей с `PatientName`, `AccessionNumber`, `ScheduledProcedureStepStartTime`, `Modality=CT`.

### Шаг 3. N-CREATE MPPS — аппарат начал исследование

```powershell
python -m pynetdicom.samples.movescu ...   # или скрипт-эмулятор
```

Альтернативно — PowerShell-эмулятор MPPS (см. `tools/mpps_emu.py` после реализации).

### Шаг 4. Проверить статус в БД

```powershell
psql -U pacs -d pacs_ris -h localhost -c "SELECT id, mpps_status, scheduled_at FROM ris.orders WHERE id='759552c8';"
```

Ожидаемо: `mpps_status = IN_PROGRESS` (после N-CREATE) или `COMPLETED` (после N-SET).

### Шаг 5. Проверить audit

```powershell
psql -U pacs -d pacs_ris -h localhost -c "SELECT actor, action, target, created_at FROM audit.audit_log ORDER BY created_at DESC LIMIT 5;"
```

Ожидаемо: записи `MWL_CFIND`, `MPPS_NCREATE`, `MPPS_NSET`.

---

## 3.4. Чек-лист Этапа 3

| # | Шаг | Команда / Проверка | Ожидаемо | ☑ |
|---|---|---|---|---|
| 1 | Установка pynetdicom | `pip show pynetdicom` | Version: 2.0.2 | ☐ |
| 2 | Миграция БД | `alembic upgrade head` | OK | ☐ |
| 3 | Запуск dicom_gw | `python -m dicom_gw` | "Ready" в логе | ☐ |
| 4 | Порт 11112 слушает | `Test-NetConnection localhost -Port 11112` | TcpTestSucceeded: True | ☐ |
| 5 | Порт 11113 слушает | `Test-NetConnection localhost -Port 11113` | TcpTestSucceeded: True | ☐ |
| 6 | C-ECHO к MWL | `echoscu -aec MEDPLATFORM_MWL localhost 11112` | Success | ☐ |
| 7 | Назначить слот | `POST /orders/{id}/schedule` | 200, accession_number | ☐ |
| 8 | C-FIND MWL | `findscu ...` | ≥ 1 запись с PatientName | ☐ |
| 9 | N-CREATE MPPS | эмулятор | `mpps_status=IN_PROGRESS` в БД | ☐ |
| 10 | N-SET MPPS | эмулятор | `mpps_status=COMPLETED` в БД | ☐ |
| 11 | Audit MWL+MPPS | `SELECT * FROM audit.audit_log` | 3+ записи (CFIND, NCREATE, NSET) | ☐ |
| 12 | RBAC на /schedule | без токена | 401 | ☐ |

**Если все 12 — Этап 3 (PACS v1.0) принят.**

---

## 3.5. Что появится в коде

```
dicom_gw/
├── __init__.py
├── __main__.py            # точка входа python -m dicom_gw
├── mwl_provider.py        # C-FIND SCP, читает ris.orders WHERE status='scheduled'
├── mpps_receiver.py       # N-CREATE/N-SET SCP, апдейтит mpps_status
├── storage_scu.py         # C-STORE SCU (опционально, для пересылки на другие PACS)
├── ae_titles.py           # конфигурация AE Title
└── config.py              # порты, AET из .env

alembic/versions/
└── xxxx_add_mwl_mpps_fields.py  # миграция

ris/routers/
├── orders.py              # + endpoint /orders/{id}/schedule
└── audit.py               # + MWL_CFIND, MPPS_NCREATE, MPPS_NSET events
```

---

## 3.6. Команды для остановки

```powershell
Get-NetTCPConnection -LocalPort 11112,11113 -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }
```

