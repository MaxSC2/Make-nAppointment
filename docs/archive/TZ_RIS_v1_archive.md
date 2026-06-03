# ТЕХНИЧЕСКОЕ ЗАДАНИЕ

## Интеграция PACS-RIS с модулем электронной очереди

---

## 1. ОБЩИЕ СВЕДЕНИЯ

### 1.1. Полное наименование системы

Программный комплекс интеграции радиологической информационной системы (RIS)
с системой архивации и передачи медицинских изображений (PACS)
и модулем электронной очереди пациентов.

### 1.2. Основание для разработки

Учебное задание по производственной практике.

### 1.3. Используемые сокращения

| Сокращение | Расшифровка |
|---|---|
| PACS | Picture Archiving and Communication System |
| RIS | Radiology Information System |
| DWV | DICOM Web Viewer |
| DICOM | Digital Imaging and Communications in Medicine |
| API | Application Programming Interface |
| REST | Representational State Transfer |
| БД | База данных |

---

## 2. НАЗНАЧЕНИЕ И ЦЕЛИ

### 2.1. Назначение системы

Автоматизация процесса организации и проведения лучевых исследований:
- Регистрация пациентов и управление электронной очередью
- Формирование и учёт заказов на исследования (RIS)
- Хранение и передача DICOM-изображений (PACS / Orthanc)
- Просмотр снимков через браузер (DWV)

### 2.2. Цели

1. Замена бумажных журналов электронной очередью
2. Сокращение времени ожидания через автораспределение по кабинетам
3. Централизованное хранение DICOM в PACS-архиве
4. Удалённый просмотр снимков без установки ПО
5. Отслеживание статуса на всех этапах: записан → ожидает → на приёме → готово

---

## 3. АРХИТЕКТУРА СИСТЕМЫ

```
Браузер (React SPA):
  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────┐
  │  Эл. очередь    │  │  Панель врача   │  │  DWV Viewer  │
  │  (React)        │  │  (React)        │  │  (React)     │
  └────────┬────────┘  └────────┬────────┘  └──────┬───────┘
           │ REST API            │ REST API          │ WADO-URI
           ▼                     ▼                   ▼
  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────────┐
  │  СЕРВИС ОЧЕРЕДИ │  │  СЕРВИС RIS     │  │  PACS (ORTHANC)  │
  │  FastAPI + PG   │  │  FastAPI + PG   │  │  DICOM-сервер    │
  │  Порт 8001      │  │  Порт 8000      │  │  Порт 8042       │
  └─────────────────┘  └─────────────────┘  └──────────────────┘
```

### Компоненты

| Компонент | Технология | Порт |
|---|---|---|
| Frontend SPA | React 18 + Vite + TypeScript | 5173 |
| Сервис RIS | FastAPI + PostgreSQL | 8000 |
| Сервис очереди | FastAPI + PostgreSQL | 8001 |
| PACS | Orthanc 1.12+ | 8042 |
| DICOM Viewer | DWV (CDN) встроен в React | — |

---

## 4. ФУНКЦИОНАЛЬНЫЕ ТРЕБОВАНИЯ

### 4.1. Модуль электронной очереди

| ID | Требование | Описание |
|---|---|---|
| F1.1 | Регистрация пациента | Форма: ФИО, ID (полис), кабинет. Присваивается талон |
| F1.2 | Генерация талона | Уникальный 6-символьный номер |
| F1.3 | Отображение очереди | Список: талон, ФИО, кабинет, статус, время |
| F1.4 | Проверка статуса | GET /status/{ticket} → waiting / in_progress / done |
| F1.5 | Вызов следующего | Врач вызывает пациента (POST /next) |
| F1.6 | Завершение приёма | Врач отмечает как обслуженного (POST /complete) |
| F1.7 | Выбор кабинета | 101 (КТ), 102 (МРТ), 103 (Рентген) |
| F1.8 | Автообновление | Каждые 10 секунд |
| F1.9 | Интеграция с RIS | При регистрации создаётся заказ в RIS |

### 4.2. Модуль RIS

| ID | Требование | Описание |
|---|---|---|
| F2.1 | Создание заказа | POST /orders, генерация ID и StudyInstanceUID |
| F2.2 | Хранение заказов | PostgreSQL: id, patient_name, patient_id, study_uid, modality, status |
| F2.3 | Статусы заказов | scheduled → in_progress → completed |
| F2.4 | Список заказов | GET /orders (JSON) |
| F2.5 | Детали заказа | GET /orders/{id} |
| F2.6 | Обновление статуса | PATCH /orders/{id}/status |
| F2.7 | Интеграция с PACS | Отправка DICOM-файла в Orthanc |
| F2.8 | Страница просмотра | Маршрут /viewer/:studyUid с встроенным DWV |

### 4.3. Модуль PACS (Orthanc)

| ID | Требование | Описание |
|---|---|---|
| F3.1 | Приём DICOM | POST /instances от RIS |
| F3.2 | Хранение | Patient / Study / Series / Instance |
| F3.3 | Поиск | REST API + Orthanc Explorer |
| F3.4 | WADO-URI | Выдача изображений для DWV |
| F3.5 | DICOMweb | WADO-RS, QIDO-RS |
| F3.6 | Веб-интерфейс | Orthanc Explorer на порту 8042 |

### 4.4. Модуль DWV (DICOM Viewer)

| ID | Требование | Описание |
|---|---|---|
| F4.1 | Загрузка по URL | DWV загружает DICOM из Orthanc по WADO-URI |
| F4.2 | Прокрутка срезов | Колесо мыши |
| F4.3 | Контраст | Инструмент WindowLevel |
| F4.4 | Масштаб | Zoom |
| F4.5 | Панорама | Pan |
| F4.6 | Сброс | Кнопка сброса настроек |
| F4.7 | Ввод StudyUID | Поле ввода идентификатора |
| F4.8 | Автозагрузка | Если StudyUID в URL — загружается автоматически |

---

## 5. ТЕХНОЛОГИЧЕСКИЙ СТЕК

### Frontend

| Компонент | Технология | Версия |
|---|---|---|
| Фреймворк | React | 18 |
| Сборщик | Vite | 5+ |
| Язык | TypeScript | 5.x |
| Стилизация | Tailwind CSS | — |
| Роутинг | React Router | v6 |
| HTTP-клиент | fetch | — |
| DICOM Viewer | DWV | 0.33+ |

### Backend

| Компонент | Технология | Версия |
|---|---|---|
| Язык | Python | 3.10+ |
| Веб-фреймворк | FastAPI | 0.110+ |
| ASGI-сервер | Uvicorn | 0.29+ |
| HTTP-клиент | httpx | 0.27+ |
| DICOM | pydicom | 2.4+ |
| СУБД | PostgreSQL | 17+ |
| ORM | SQLAlchemy | 2.x |
| Миграции | Alembic | — |
| PACS | Orthanc | 1.12+ |

### Инфраструктура

| Компонент | Технология |
|---|---|
| Контейнеризация | Docker + docker-compose |
| Документация API | Swagger (встроен в FastAPI) |
| Версионирование | Git + GitHub |

---

## 6. СТРУКТУРА ПРОЕКТА

```
ris/
├── backend/
│   ├── queue_service/          # Сервис очереди (порт 8001)
│   │   ├── main.py
│   │   ├── models.py
│   │   ├── schemas.py
│   │   ├── database.py
│   │   └── requirements.txt
│   └── ris_service/            # Сервис RIS (порт 8000)
│       ├── main.py
│       ├── models.py
│       ├── schemas.py
│       ├── database.py
│       ├── orthanc_client.py   # Интеграция с Orthanc
│       └── requirements.txt
│
├── frontend/                   # React SPA (порт 5173)
│   ├── src/
│   │   ├── components/         # Переиспользуемые компоненты
│   │   │   ├── QueueTable/     # Таблица очереди
│   │   │   ├── OrderCard/      # Карточка заказа
│   │   │   ├── StatusBadge/    # Бейдж статуса
│   │   │   └── DicomViewer/    # Обёртка над DWV
│   │   ├── pages/
│   │   │   ├── RegistrationPage/   # Регистрация пациента
│   │   │   ├── QueuePage/          # Очередь (публичная)
│   │   │   ├── DoctorPage/         # Панель врача
│   │   │   ├── OrdersPage/         # Список заказов RIS
│   │   │   └── ViewerPage/         # DWV просмотр снимков
│   │   ├── api/                # REST-клиент
│   │   │   ├── queue.ts        # Запросы к сервису очереди
│   │   │   └── ris.ts          # Запросы к RIS
│   │   ├── types/              # TypeScript интерфейсы
│   │   │   ├── queue.ts
│   │   │   └── ris.ts
│   │   ├── hooks/              # Кастомные хуки
│   │   │   ├── useQueue.ts
│   │   │   └── useOrders.ts
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── index.html
│   ├── vite.config.ts
│   ├── tsconfig.json
│   └── package.json
│
├── orthanc/
│   └── orthanc.json            # Конфигурация Orthanc
│
├── docker-compose.yml
└── README.md
```

---

## 7. СТРУКТУРА БАЗЫ ДАННЫХ

### Таблица orders (RIS сервис)

| Поле | Тип | Описание |
|---|---|---|
| id | TEXT PK | ID заказа (8 символов) |
| patient_name | TEXT | ФИО пациента |
| patient_id | TEXT | ID пациента (номер полиса) |
| study_uid | TEXT | StudyInstanceUID |
| modality | TEXT | CT / MR / DX |
| status | TEXT | scheduled / in_progress / completed |
| protocol | TEXT | Протокол исследования |
| created_at | TIMESTAMP | Дата создания |
| updated_at | TIMESTAMP | Дата обновления |

### Таблица queue (Сервис очереди)

| Поле | Тип | Описание |
|---|---|---|
| id | SERIAL PK | Автоинкрементный ID |
| patient_name | TEXT | ФИО пациента |
| patient_id | TEXT | Номер полиса |
| order_id | TEXT | ID заказа в RIS |
| ticket_number | TEXT UNIQUE | Номер талона (6 символов) |
| status | TEXT | waiting / in_progress / done |
| cabinet | TEXT | Номер кабинета |
| created_at | TIMESTAMP | Дата регистрации |

---

## 8. API ИНТЕРФЕЙСЫ

### Сервис очереди (порт 8001)

| Метод | Путь | Описание |
|---|---|---|
| GET | / | Список всей очереди (JSON) |
| POST | /register | Регистрация пациента |
| GET | /status/{ticket} | Статус по талону |
| POST | /next | Вызов следующего пациента |
| POST | /complete | Завершить приём |

### Сервис RIS (порт 8000)

| Метод | Путь | Описание |
|---|---|---|
| GET | /orders | Список заказов |
| POST | /orders | Создать заказ |
| GET | /orders/{id} | Детали заказа |
| PATCH | /orders/{id}/status | Обновить статус |
| GET | /docs | Swagger документация |

### PACS Orthanc (порт 8042)

| Метод | Путь | Описание |
|---|---|---|
| GET | /system | Информация о сервере |
| GET | /patients | Список пациентов |
| GET | /studies | Список исследований |
| POST | /instances | Загрузить DICOM-файл |
| GET | /wado?requestType=WADO | WADO-URI для DWV |

---

## 9. TypeScript ТИПЫ (Frontend)

```typescript
// types/queue.ts
export type QueueStatus = 'waiting' | 'in_progress' | 'done'

export interface QueueEntry {
  id: number
  patient_name: string
  patient_id: string
  order_id: string
  ticket_number: string
  status: QueueStatus
  cabinet: string
  created_at: string
}

export interface RegisterPayload {
  patient_name: string
  patient_id: string
  cabinet: string
  modality: string
}

// types/ris.ts
export type OrderStatus = 'scheduled' | 'in_progress' | 'completed'
export type Modality = 'CT' | 'MR' | 'DX'

export interface Order {
  id: string
  patient_name: string
  patient_id: string
  study_uid: string
  modality: Modality
  status: OrderStatus
  protocol: string
  created_at: string
  updated_at: string
}
```

---

## 10. РАСПРЕДЕЛЕНИЕ РОЛЕЙ (6 человек)

| № | Роль | Обязанности |
|---|---|---|
| 1 | Backend Lead | Архитектура, Auth, БД, docker-compose, Orthanc |
| 2 | Backend RIS | Сервис RIS: заказы, статусы, интеграция с Orthanc |
| 3 | Backend Queue | Сервис очереди: талоны, статусы, интеграция с RIS |
| 4 | Frontend Lead | Vite+React setup, роутинг, layout, shared-компоненты |
| **5 (Макс)** | **Frontend RIS** | **Страницы очереди, панель врача, список заказов** |
| 6 | Frontend PACS | Страница просмотра, DicomViewer компонент (DWV) |

### Зона ответственности Студента 5 (Макс)

```
pages/
  RegistrationPage/   — форма регистрации пациента + выдача талона
  QueuePage/          — публичный экран очереди (автообновление 10с)
  DoctorPage/         — панель врача: вызов / завершение приёма
  OrdersPage/         — список заказов RIS с фильтрами и статусами

components/
  QueueTable/         — таблица с талонами, статусами, кабинетами
  StatusBadge/        — бейдж статуса (waiting/in_progress/done)
  OrderCard/          — карточка заказа

api/
  queue.ts            — все fetch-функции к сервису очереди (порт 8001)
  ris.ts              — все fetch-функции к сервису RIS (порт 8000)

hooks/
  useQueue.ts         — хук с автообновлением каждые 10 сек
  useOrders.ts        — хук для списка заказов
```

---

## 11. СЦЕНАРИИ ТЕСТИРОВАНИЯ

### Сценарий A — Полный цикл

1. Открыть `/register` → ввести данные → получить талон
2. Проверить что заказ появился на `/orders`
3. На `/doctor` вызвать пациента → статус меняется на `in_progress`
4. Открыть `/viewer/:studyUid` → снимок загружается в DWV
5. Завершить приём → статус `done` / `completed`

### Сценарий B — Несколько кабинетов

1. Зарегистрировать пациентов на разные кабинеты (101, 102, 103)
2. Вызывать в каждом кабинете независимо
3. Убедиться что нет пересечений между кабинетами

### Сценарий C — Отказоустойчивость

1. Остановить RIS сервис
2. Зарегистрировать пациента в очереди
3. Запустить RIS — интеграция восстановилась

---

## 12. ТРЕБОВАНИЯ К ПРОИЗВОДИТЕЛЬНОСТИ

| Параметр | Значение |
|---|---|
| Время ответа API (90% запросов) | ≤ 500 мс |
| Загрузка страницы очереди | ≤ 3 с |
| Открытие DICOM через DWV | ≤ 5 с |
| Пациентов в очереди одновременно | ≥ 50 |
| Интервал автообновления | 10 с |

---

## 13. КАЛЕНДАРНЫЙ ПЛАН (12 дней)

| Дни | Задачи | Кто |
|---|---|---|
| 1–2 | Настройка окружения, Orthanc, структура проекта, Vite+React init | Все |
| 3–4 | Backend: БД, модели, API очереди и RIS | Бэкенд |
| 3–4 | Frontend: роутинг, layout, типы, api-клиенты | Фронтенд |
| 5–6 | Frontend: RegistrationPage, QueuePage, DoctorPage | Студент 5 |
| 5–6 | Frontend: OrdersPage, DicomViewer компонент | Студент 5, 6 |
| 7 | Интеграция Frontend ↔ Backend | Все |
| 8–9 | Тестирование сценариев A/B/C, исправление багов | Все |
| 10–11 | Документация, отчёт, руководство пользователя | Все |
| 12 | Репетиция защиты, демо, сдача | Все |

---

## 14. КРИТЕРИИ ПРИЁМКИ

| Этап | Срок | Критерий |
|---|---|---|
| Прототип | День 3 | Orthanc запущен, работает RIS API, Vite dev server |
| Альфа | День 6 | Работает очередь + RIS, React страницы с моками |
| Бета | День 9 | DWV работает, пройдены сценарии A и B |
| Релиз | День 12 | Все требования выполнены, документация готова |

---

## 15. СОСТАВ ДОКУМЕНТАЦИИ К СДАЧЕ

1. Техническое задание (данный документ)
2. Отчёт по практике (30–40 стр.) с дневником
3. Руководство разработчика — архитектура, запуск
4. Руководство пользователя — сценарии работы
5. Отчёт о тестировании
6. Презентация (слайды для защиты)
