# API RIS для просмотрщика DICOM-снимков

> Наш RIS-сервис на http://localhost:8000 (или IP в сети)
> Все запросы требуют JWT-токен (кроме `/health`)

---

## 1. Авторизация

```http
POST http://localhost:8005/api/auth/login
Content-Type: application/json

{"username": "admin", "password": "admin123"}
```

**Ответ:**
```json
{
  "access_token": "eyJ...",
  "refresh_token": "eyJ...",
  "token_type": "Bearer",
  "expires_in": 3600
}
```

**Использование:** все запросы ниже — с заголовком:
```
Authorization: Bearer eyJ...
```

---

## 2. Список исследований (PACS-фасад)

```http
GET /api/v1/studies?modality=CT
```

**Параметры:** `modality` — опционально (CT, MR, DX, US, XA, MG, PT, NM)

**Ответ:**
```json
[
  {
    "orthanc_id": "071d0259-...",
    "study_uid": "1.2.840.138647082911948",
    "study_date": "2026-06-02",
    "study_time": "2026-06-02T12:49:17",
    "study_description": "Исследование брюшной полости",
    "modality": "US",
    "patient_id_dicom": "004",
    "patient_name_dicom": "ИВАНОВ^ИВАН^ИВАНОВИЧ",
    "patient_birth_date": "20010830",
    "accession_number": "67A718AB",
    "is_stable": true,
    "unlinked": false,
    "ris_order_id": null,
    "ris_order_status": null,
    "patient": null
  }
]
```

> `unlinked: true` — если DICOM-пациент не привязан к БД RIS (тестовые данные)

---

## 3. Детали исследования (серии + инстансы)

```http
GET /api/v1/studies/{study_uid}
```

**Ответ:** всё то же самое + массив `series[]` с `instances[]`:
```json
{
  "orthanc_id": "071d0259-...",
  "study_uid": "1.2.840.138647082911948",
  "series": [
    {
      "orthanc_id": "e1b94526-...",
      "series_uid": "1.2.840.330074930201521",
      "series_number": "1",
      "series_description": "Серия 1",
      "modality": "US",
      "instance_count": 1,
      "instances": [
        {
          "orthanc_id": "46a8c5a0-...",
          "sop_instance_uid": "1.2.840.334938699941829",
          "instance_number": "1"
        }
      ]
    }
  ]
}
```

---

## 4. Превью снимка (PNG)

```http
GET /api/v1/studies/{study_uid}/preview
```

**Ответ:** `image/png` (первый срез исследования)

```http
GET /api/v1/instances/{instance_id}/preview
```

**Ответ:** `image/png` (конкретный срез по Orthanc ID инстанса)

> Для просмотрщика: можно получить превью для быстрого отображения,
> а для полноценного просмотра — DICOM-теги + данные через Orthanc proxy

---

## 5. DICOM-теги инстанса

```http
GET /api/v1/instances/{instance_id}/dicom-tags
```

**Ответ:**
```json
{
  "PatientName": "ИВАНОВ^ИВАН^ИВАНОВИЧ",
  "PatientID": "004",
  "Modality": "US",
  "StudyDescription": "Исследование брюшной полости",
  "Rows": 480,
  "Columns": 640,
  "BitsStored": 8,
  "WindowCenter": "128",
  "WindowWidth": "256",
  "PixelSpacing": "0.5\\0.5"
}
```

---

## 6. Все снимки пациента

```http
GET /api/v1/patients/{patient_id}/studies
```

`patient_id` — DICOM PatientID (строка)

---

## 7. DICOM-данные по заказу RIS

```http
GET /api/v1/orders/{order_id}/dicom
```

`order_id` — 8-символьный hex ID заказа RIS (например `2b02cef8`)

---

## 8. Orthanc прямой прокси

Если нужно больше — есть прямой прокси в Orthanc:
```http
GET /api/orthanc/instances/{orthanc_id}/file
GET /api/orthanc/instances/{orthanc_id}/tags?short=true
GET /api/orthanc/series/{series_id}/instances
GET /api/orthanc/studies/{study_uid}/series
GET /api/orthanc/tools/find
```

> Все прокси-запросы тоже требуют JWT-токен RIS

---

## 9. Заказы RIS (если нужно)

```http
GET /api/orders?status_filter=completed&patient_id=
GET /api/orders/{id}
POST /api/orders (создать)
PATCH /api/orders/{id}/status?status=completed
```

---

## 10. Быстрый тест (PowerShell)

```powershell
# Шаг 1: логинимся
$token = ((curl -s -X POST http://localhost:8005/api/auth/login `
  -H "Content-Type: application/json" `
  -d '{"username":"admin","password":"admin123"}') | ConvertFrom-Json).access_token

# Шаг 2: список исследований
curl -s http://localhost:8000/api/v1/studies `
  -H "Authorization: Bearer $token"

# Шаг 3: превью (сохранить в PNG)
curl -s -o preview.png `
  "http://localhost:8000/api/v1/studies/1.2.840.138647082911948/preview" `
  -H "Authorization: Bearer $token"
```

---

**Наш стек:** FastAPI (RIS:8000) + PostgreSQL + Orthanc (8042)
**Твой просмотрщик подключается к:** `http://<наш-IP>:8000/api/v1/studies/*`
**CORS:** если будешь стучаться с другого домена/порта — скажи, добавим CORSMiddleware
