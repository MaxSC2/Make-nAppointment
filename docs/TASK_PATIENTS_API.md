# ЗАДАНИЕ: Проверка API и логика привязки снимков к пациенту

> Выполни по порядку. Не пиши код пока не пройдёшь все шаги проверки.

---

## ШАГ 1 — Запусти сервисы если не запущены

```bash
# Терминал 1
cd C:\Projects\ARCHIVE\MedPlatform\backend\ris
uvicorn main:app --reload --port 8000

# Терминал 2
cd C:\Projects\ARCHIVE\MedPlatform\backend\elqueue
uvicorn main:app --reload --port 8005

# Терминал 3
cd C:\Projects\ARCHIVE\MedPlatform\frontend
npm run dev
```

---

## ШАГ 2 — Получи токен для запросов

```bash
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"username\": \"admin\", \"password\": \"admin123\"}"
```

Сохрани `access_token` из ответа — он нужен для следующих запросов.

---

## ШАГ 3 — Проверь все нужные эндпоинты

Выполни каждый запрос и запомни реальную структуру ответа.

### 3.1 Пациенты из очереди
```bash
curl http://localhost:8005/api/tickets \
  -H "Authorization: Bearer {TOKEN}"
```
**Нужно понять:**
- Есть ли поле `patient.id` (UUID)?
- Какие поля у объекта `patient`?

### 3.2 Список исследований PACS
```bash
curl http://localhost:8000/api/v1/studies \
  -H "Authorization: Bearer {TOKEN}"
```
**Нужно понять:**
- Есть ли `order_id` в каждом исследовании?
- Есть ли `patient_id_dicom` или аналог?
- Какое поле связывает исследование с пациентом?

### 3.3 Список заказов RIS
```bash
curl http://localhost:8000/api/orders \
  -H "Authorization: Bearer {TOKEN}"
```
**Нужно понять:**
- Есть ли `patient` объект с UUID?
- Есть ли `study_uid`?

### 3.4 Проверь эндпоинт пациентов (может не существовать)
```bash
curl http://localhost:8000/api/v1/patients \
  -H "Authorization: Bearer {TOKEN}"
```
**Результат:** либо список пациентов, либо 404.

### 3.5 Если пациенты есть — проверь их исследования
```bash
# Возьми любой patient_id из предыдущего запроса
curl http://localhost:8000/api/v1/patients/{patient_id}/studies \
  -H "Authorization: Bearer {TOKEN}"
```

---

## ШАГ 4 — Составь отчёт о результатах

После проверки напиши чёткий отчёт в таком формате:

```
## Результаты проверки API

### Эндпоинт /api/v1/patients
Статус: [существует / 404 / ошибка]
Пример ответа: { ... }

### Эндпоинт /api/v1/patients/{id}/studies  
Статус: [существует / 404 / ошибка]
Пример ответа: { ... }

### Структура ticket из /api/tickets
patient.id: [есть UUID / нет]
Поля patient: { ... }

### Структура study из /api/v1/studies
order_id: [есть / нет]
Поле привязки к пациенту: [название поля или "отсутствует"]

### Структура order из /api/orders
patient UUID: [есть / нет]
study_uid: [есть / нет]

### Цепочка связи — работает ли?
patient.id → ticket.order_id → order.study_uid → study.orthanc_id
[ДА — все поля есть / НЕТ — не хватает: ...]
```

---

## ШАГ 5 — На основе отчёта реши одно из двух

### Сценарий A: эндпоинт /api/v1/patients/{id}/studies существует и возвращает данные

Тогда просто используй его в PatientCardPage:
```typescript
const studies = await risV1Get<StudyListItem[]>(`/patients/${id}/studies`)
```
Переходи сразу к реализации PatientCardPage.

---

### Сценарий B: эндпоинт НЕ существует (404)

Нужно добавить в `backend/ris/routers/studies.py`.

Сначала посмотри как устроен `pacs_facade.py` — там уже есть функция
`get_patient_studies()`. Если она есть — просто добавь роутер:

```python
@router.get("/patients")
async def list_patients(
    search: str | None = None,
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(get_current_user)
):
    """Список пациентов с поиском по ФИО или номеру полиса"""
    from sqlalchemy import select, or_
    # импортируй модель Patient из правильного места
    # посмотри как импортируются другие модели в этом файле
    
    stmt = select(Patient)
    if search:
        stmt = stmt.where(
            or_(
                Patient.full_name.ilike(f"%{search}%"),
                Patient.policy_number.ilike(f"%{search}%")
            )
        )
    result = await db.execute(stmt)
    patients = result.scalars().all()
    return patients


@router.get("/patients/{patient_id}/studies")
async def get_patient_studies(
    patient_id: str,
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(get_current_user),
    facade: PacsFacade = Depends(get_pacs_facade)
):
    """Все исследования пациента"""
    # если в pacs_facade.py уже есть get_patient_studies — используй её
    # иначе собери через JOIN: patient → orders → studies
    studies = await facade.get_patient_studies(patient_id)
    return studies
```

**Важно:** перед добавлением посмотри как в файле уже объявлены:
- зависимости (Depends)
- импорты моделей
- возвращаемые типы (response_model)

Следуй тому же стилю что уже есть в файле.

---

### Сценарий C: эндпоинт есть но возвращает пустой список

Значит в БД нет данных. Проверь:
```bash
# Подключись к PostgreSQL и проверь
psql -U postgres -d pacs_ris -c "SELECT COUNT(*) FROM queue.patients;"
psql -U postgres -d pacs_ris -c "SELECT COUNT(*) FROM ris.orders;"
psql -U postgres -d pacs_ris -c "SELECT COUNT(*) FROM ris.studies;"
```

Если таблицы пустые — данные не связаны. Тогда нужно проверить
заполняет ли `POST /api/tickets` таблицу `queue.patients` при регистрации.

---

## ШАГ 6 — После решения проблемы с API

Только когда `/api/v1/patients` и `/api/v1/patients/{id}/studies` работают —
реализуй фронт.

### PatientsPage.tsx
```typescript
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

// Добавь в api/ris.ts:
// export const getPatients = (search?: string) =>
//   risV1Get<PatientOut[]>(`/patients${search ? '?search=' + encodeURIComponent(search) : ''}`)

export default function PatientsPage() {
  const navigate = useNavigate()
  const [patients, setPatients] = useState<PatientOut[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  useEffect(() => {
    let cancelled = false
    const timer = setTimeout(() => {
      setLoading(true)
      getPatients(search || undefined)
        .then(data => { if (!cancelled) { setPatients(data); setLoading(false) } })
        .catch(err => { if (!cancelled) { setError(err.message); setLoading(false) } })
    }, 300)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [search])

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Пациенты</h1>

      {/* Поиск */}
      <div className="relative mb-6">
        <input
          type="text"
          placeholder="Поиск по ФИО или номеру полиса..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg
                     text-sm focus:outline-none focus:border-teal-500"
        />
        <svg className="absolute left-3 top-3 w-4 h-4 text-gray-400"
             fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
        </svg>
      </div>

      {/* Состояния */}
      {loading && (
        <div className="space-y-3">
          {[1,2,3].map(i => (
            <div key={i} className="h-20 bg-gray-100 rounded-lg animate-pulse"/>
          ))}
        </div>
      )}

      {error && (
        <div className="text-center py-12">
          <p className="text-red-600 mb-3">{error}</p>
          <button onClick={() => setSearch(s => s + ' ')}
                  className="text-teal-600 underline text-sm">
            Повторить
          </button>
        </div>
      )}

      {!loading && !error && patients.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <p className="text-lg font-medium mb-2">Пациентов не найдено</p>
          <p className="text-sm">Зарегистрируйте пациента на странице Регистрации</p>
        </div>
      )}

      {!loading && !error && patients.length > 0 && (
        <div className="space-y-3">
          {patients.map(p => (
            <div key={p.id}
                 onClick={() => navigate('/patients/' + p.id)}
                 className="bg-white border border-gray-200 rounded-lg p-4
                            hover:border-teal-400 hover:shadow-sm cursor-pointer
                            transition-all flex items-center justify-between">
              <div>
                <div className="font-semibold text-gray-900">{p.full_name}</div>
                <div className="text-sm text-gray-500 mt-1">
                  Полис: {p.policy_number}
                  {p.birth_date && ` · ${new Date(p.birth_date).toLocaleDateString('ru-RU')}`}
                  {p.phone && ` · ${p.phone}`}
                </div>
              </div>
              <svg className="w-5 h-5 text-gray-400" fill="none"
                   stroke="currentColor" viewBox="0 0 24 24">
                <path d="m9 18 6-6-6-6"/>
              </svg>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

### PatientCardPage.tsx
```typescript
import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'

export default function PatientCardPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [patient, setPatient] = useState<PatientOut | null>(null)
  const [studies, setStudies] = useState<StudyListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    let cancelled = false
    setLoading(true)

    // Загружаем пациента и его исследования параллельно
    Promise.all([
      getPatient(id),
      getPatientStudies(id)
    ])
      .then(([pat, stud]) => {
        if (!cancelled) {
          setPatient(pat)
          setStudies(stud)
          setLoading(false)
        }
      })
      .catch(err => {
        if (!cancelled) { setError(err.message); setLoading(false) }
      })

    return () => { cancelled = true }
  }, [id])

  if (loading) return <div className="p-8 text-center text-gray-500">Загрузка...</div>
  if (error) return <div className="p-8 text-center text-red-600">{error}</div>
  if (!patient) return null

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Назад */}
      <button onClick={() => navigate('/patients')}
              className="flex items-center gap-1 text-sm text-teal-600 mb-6 hover:underline">
        ← Назад к пациентам
      </button>

      {/* Данные пациента */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-teal-100 rounded-full flex items-center
                          justify-center text-teal-700 text-xl font-bold">
            {patient.full_name[0]}
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">{patient.full_name}</h1>
            <div className="text-sm text-gray-500 mt-1 space-x-3">
              <span>Полис: {patient.policy_number}</span>
              {patient.birth_date &&
                <span>· {new Date(patient.birth_date).toLocaleDateString('ru-RU')}</span>}
              {patient.phone && <span>· {patient.phone}</span>}
            </div>
          </div>
        </div>
      </div>

      {/* Исследования */}
      <h2 className="text-lg font-semibold text-gray-900 mb-4">
        История исследований ({studies.length})
      </h2>

      {studies.length === 0 ? (
        <div className="text-center py-12 text-gray-500 bg-white
                        border border-gray-200 rounded-lg">
          У этого пациента ещё нет исследований
        </div>
      ) : (
        <div className="space-y-3">
          {studies.map(s => (
            <div key={s.study_uid}
                 className="bg-white border border-gray-200 rounded-lg p-4
                            flex items-center gap-4">
              {/* Превью снимка */}
              <div className="w-20 h-20 flex-shrink-0 bg-gray-900 rounded overflow-hidden">
                <img
                  src={`/api/v1/studies/${s.study_uid}/preview`}
                  alt="превью"
                  className="w-full h-full object-cover"
                  onError={e => {
                    (e.target as HTMLImageElement).style.display = 'none'
                  }}
                />
              </div>

              {/* Инфо */}
              <div className="flex-1 min-w-0">
                <div className="font-medium text-gray-900">
                  {s.modality} · {s.series_count} серий · {s.instance_count} снимков
                </div>
                <div className="text-sm text-gray-500 mt-1">
                  {s.study_date
                    ? new Date(s.study_date).toLocaleDateString('ru-RU')
                    : 'Дата неизвестна'}
                </div>
                {s.order_status && (
                  <div className="mt-1">
                    <StatusBadge status={s.order_status} />
                  </div>
                )}
              </div>

              {/* Действие */}
              <button
                onClick={() => navigate('/viewer/' + s.study_uid)}
                className="flex-shrink-0 px-4 py-2 bg-teal-600 text-white
                           rounded-lg text-sm font-medium hover:bg-teal-700
                           transition-colors">
                Открыть
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

---

## ШАГ 7 — Добавь маршруты и навигацию

### App.tsx — добавь маршруты:
```typescript
import PatientsPage from './pages/PatientsPage'
import PatientCardPage from './pages/PatientCardPage'

// В Routes:
<Route path="/patients" element={<PatientsPage />} />
<Route path="/patients/:id" element={<PatientCardPage />} />
```

### Layout.tsx — добавь в навигацию:
```typescript
<NavLink to="/patients">Пациенты</NavLink>
```

---

## ШАГ 8 — Добавь API-функции в ris.ts

```typescript
// Добавь в frontend/src/api/ris.ts:
export const getPatients = (search?: string): Promise<PatientOut[]> =>
  risV1Get(`/patients${search ? '?search=' + encodeURIComponent(search) : ''}`)

export const getPatient = (id: string): Promise<PatientOut> =>
  risV1Get(`/patients/${id}`)

export const getPatientStudies = (id: string): Promise<StudyListItem[]> =>
  risV1Get(`/patients/${id}/studies`)
```

---

## ИТОГ — что должно работать после выполнения

```
/patients           → список пациентов с поиском
/patients/:id       → карточка с историей снимков
Клик на снимок      → /viewer/:studyUid (DWV открывает снимок)
```

---

## ОБЯЗАТЕЛЬНО — запись в лог

```markdown
### 08.06.2026 — Привязка снимков к пациентам, PatientsPage, PatientCardPage

**Что сделано:**
Проверил цепочку связи patient → ticket → order → study → orthanc.
[Описать сценарий A/B/C который сработал]
Создал PatientsPage (список с поиском debounce 300ms) и PatientCardPage
(карточка пациента с превью DICOM-снимков и переходом в вьювер).

**Файлы:**
frontend/src/pages/PatientsPage.tsx (создан)
frontend/src/pages/PatientCardPage.tsx (создан)
frontend/src/api/ris.ts (добавлены getPatients, getPatient, getPatientStudies)
frontend/src/App.tsx (маршруты /patients, /patients/:id)
frontend/src/components/Layout.tsx (навигация)
[если добавлял бэкенд]: backend/ris/routers/studies.py (эндпоинты /patients/*)

**Технологии:** React 19, TypeScript, useParams, useNavigate,
Promise.all для параллельной загрузки, debounce через setTimeout

**Решение:** Цепочка patient.id → order.study_uid → Orthanc orthanc_id
уже заложена в схеме БД. [описать что пришлось добавить если что-то отсутствовало]

**Связь с отчётом:** П.3 (роль врача — видит полную историю пациента),
П.6 (жизненный цикл — от регистрации до просмотра снимка),
П.7 (итерационная разработка)
```
