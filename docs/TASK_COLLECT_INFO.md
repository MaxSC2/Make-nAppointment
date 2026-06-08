# ЗАДАНИЕ: Собери полный срез проекта

> Выполни все команды по порядку и скинь результаты Максу в чат.
> Ничего не меняй — только читай и собирай информацию.

---

## 1. Структура проекта

```bash
# Дерево папок frontend (без node_modules)
find C:\Projects\ARCHIVE\MedPlatform\frontend\src -type f | sort

# Дерево папок backend
find C:\Projects\ARCHIVE\MedPlatform\backend -type f -name "*.py" | sort
```

---

## 2. Содержимое ключевых файлов

```bash
# Роутер studies.py — там PACS-фасад эндпоинты
cat C:\Projects\ARCHIVE\MedPlatform\backend\ris\routers\studies.py

# Роутер orders.py
cat C:\Projects\ARCHIVE\MedPlatform\backend\ris\routers\orders.py

# Роутер tickets.py (очередь)
cat C:\Projects\ARCHIVE\MedPlatform\backend\elqueue\routers\tickets.py

# Модели БД
cat C:\Projects\ARCHIVE\MedPlatform\backend\db\models\queue.py
cat C:\Projects\ARCHIVE\MedPlatform\backend\db\models\ris.py

# PACS-фасад (первые 100 строк — публичные методы)
head -100 C:\Projects\ARCHIVE\MedPlatform\backend\ris\services\pacs_facade.py

# Фронт — App.tsx (роутинг)
cat C:\Projects\ARCHIVE\MedPlatform\frontend\src\App.tsx

# Фронт — api/ris.ts
cat C:\Projects\ARCHIVE\MedPlatform\frontend\src\api\ris.ts

# Фронт — api/queue.ts
cat C:\Projects\ARCHIVE\MedPlatform\frontend\src\api\queue.ts

# Фронт — types/queue.ts
cat C:\Projects\ARCHIVE\MedPlatform\frontend\src\types\queue.ts

# Фронт — types/ris.ts
cat C:\Projects\ARCHIVE\MedPlatform\frontend\src\types\ris.ts

# Layout.tsx — навигация
cat C:\Projects\ARCHIVE\MedPlatform\frontend\src\components\Layout.tsx

# vite.config.ts — proxy
cat C:\Projects\ARCHIVE\MedPlatform\frontend\vite.config.ts
```

---

## 3. Реальные данные из БД

```bash
# Подключись к PostgreSQL и выполни:
psql -U postgres -d pacs_ris -c "
SELECT
  (SELECT COUNT(*) FROM queue.patients) as patients,
  (SELECT COUNT(*) FROM queue.tickets) as tickets,
  (SELECT COUNT(*) FROM ris.orders) as orders,
  (SELECT COUNT(*) FROM ris.studies) as studies,
  (SELECT COUNT(*) FROM auth.users) as users;
"

# Пример одного пациента
psql -U postgres -d pacs_ris -c "
SELECT * FROM queue.patients LIMIT 1;
"

# Пример одного тикета с пациентом
psql -U postgres -d pacs_ris -c "
SELECT
  t.ticket_number,
  t.status,
  t.order_id,
  p.id as patient_uuid,
  p.full_name,
  p.policy_number
FROM queue.tickets t
JOIN queue.patients p ON t.patient_id = p.id
LIMIT 1;
"

# Пример одного заказа
psql -U postgres -d pacs_ris -c "
SELECT
  o.id as order_id,
  o.study_uid,
  o.status,
  p.id as patient_uuid,
  p.full_name
FROM ris.orders o
JOIN queue.patients p ON o.patient_id = p.id
LIMIT 1;
"

# Пример одного study
psql -U postgres -d pacs_ris -c "
SELECT * FROM ris.studies LIMIT 1;
"

# Проверка полной цепочки patient→ticket→order→study
psql -U postgres -d pacs_ris -c "
SELECT
  p.id as patient_id,
  p.full_name,
  t.ticket_number,
  t.order_id,
  o.study_uid,
  s.orthanc_id,
  s.is_uploaded
FROM queue.patients p
LEFT JOIN queue.tickets t ON t.patient_id = p.id
LEFT JOIN ris.orders o ON o.id = t.order_id
LEFT JOIN ris.studies s ON s.order_id = o.id
LIMIT 3;
"
```

---

## 4. Реальные API ответы

```bash
# Сначала получи токен
TOKEN=$(curl -s -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"admin\",\"password\":\"admin123\"}" \
  | python -c "import sys,json; print(json.load(sys.stdin)['access_token'])")

echo "Token получен: ${TOKEN:0:20}..."

# Один тикет из очереди (полная структура)
curl -s http://localhost:8005/api/tickets?limit=1 \
  -H "Authorization: Bearer $TOKEN" | python -m json.tool

# Один заказ из RIS (полная структура)
curl -s "http://localhost:8000/api/orders?limit=1" \
  -H "Authorization: Bearer $TOKEN" | python -m json.tool

# Одно исследование из PACS-фасада (полная структура)
curl -s "http://localhost:8000/api/v1/studies?limit=1" \
  -H "Authorization: Bearer $TOKEN" | python -m json.tool

# Проверка эндпоинта пациентов
curl -s -o /dev/null -w "%{http_code}" \
  http://localhost:8000/api/v1/patients \
  -H "Authorization: Bearer $TOKEN"
echo " ← статус /api/v1/patients"

# Проверка эндпоинта исследований пациента
curl -s -o /dev/null -w "%{http_code}" \
  "http://localhost:8000/api/v1/patients/test/studies" \
  -H "Authorization: Bearer $TOKEN"
echo " ← статус /api/v1/patients/{id}/studies"
```

---

## 5. Список всех эндпоинтов

```bash
# Все маршруты RIS
curl -s http://localhost:8000/openapi.json | \
  python -c "
import sys, json
api = json.load(sys.stdin)
for path, methods in api['paths'].items():
    for method in methods:
        print(f'{method.upper():8} {path}')
" | sort

# Все маршруты Elqueue
curl -s http://localhost:8005/openapi.json | \
  python -c "
import sys, json
api = json.load(sys.stdin)
for path, methods in api['paths'].items():
    for method in methods:
        print(f'{method.upper():8} {path}')
" | sort
```

---

## 6. Git статус

```bash
cd C:\Projects\ARCHIVE\MedPlatform

# Последние коммиты
git log --oneline -15

# Что изменено (не закоммичено)
git status
git diff --stat
```

---

## Формат ответа

Скинь всё что получилось одним сообщением Максу.
Если что-то не выполнилось — напиши какая ошибка.
Ничего не исправляй — только собери данные.
