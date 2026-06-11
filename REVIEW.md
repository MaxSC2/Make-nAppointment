# REVIEW.md — Ревью интеграции просмотрщика DICOM товарища

> **Дата:** 06.06.2026
> **Ревьювер:** Lead AI
> **Суть:** Товарищ подключил свой DICOM-вьюер (DWV библиотека) к нашему RIS.
> Он добавил: `DwvViewer.tsx`, `dicomweb.py`, `dwv.d.ts`, изменил `ViewerPage.tsx`, `vite.config.ts`, `ris/main.py`, `package.json`

---

## Статус: 🔴 НЕ ПРИНИМАТЬ — 2 критических, 4 значительных, 2 мелких

---

## 🔴 КРИТИЧЕСКИЕ

### 1. DICOMweb прокси БЕЗ авторизации
- **Файл:** `ris/routers/dicomweb.py:79-82`
- **Что:** Роутер `/dicom/{path}` принимает любые запросы и проксирует их в Orthanc без проверки JWT
- **Тест:** `curl http://localhost:8000/dicom/studies` → HTTP 200 (должен быть 401)
- **Риск:** Любой может скачать DICOM-снимки через Orthanc, зная URL
- **Надо:** Добавить `Depends(get_current_user)` на эндпоинт

### 2. DwvViewer грузит снимки через inst.uid, которого нет в ответе API
- **Файл:** `frontend/src/components/DwvViewer.tsx:135`
- **Код:** `inst.uid` в `loadSeries()`
- **Реальность:** PACS-фасад возвращает `sop_instance_uid`, а не `uid`. Поле `uid` не существует в ответе
- **Итог:** Вьюер формирует URL `/dicom/studies/{uid}/series/{suid}/instances/undefined`
- **Ничего не загрузится.** 🔴

---

## 🟡 ЗНАЧИТЕЛЬНЫЕ

### 3. Несоответствие типов StudyData реальному API
- **Файл:** `DwvViewer.tsx:22-27` (interface) + `DwvViewer.tsx:163-165` (использование)
- **Интерфейс ожидает:** `uid`, `patient_id`, `patient_name`
- **API возвращает:** `study_uid`, `patient_id_dicom`, `patient_name_dicom`
- **Итог:** Имя пациента и ID на панели вьюера будут показывать `—` вместо реальных данных
- **Дополнительно:** `s.description` должно быть `s.series_description` (строка 169)

### 4. Vite proxy `/dicom` идёт в Orthanc напрямую (минуя RIS)
- **Файл:** `vite.config.ts:30-34`
- **Код:** `/dicom` → `http://localhost:8042/dicom-web`
- **Проблема:** Все DICOMweb-запросы из вьюера идут напрямую в Orthanc, через порт 8042:
  - **Без авторизации** (обходит JWT)
  - **Без rate-limiting / аудита** (минует RIS логику)
  - **Минует PACS-фасад** — если в будущем PACS-фасад модифицирует данные, вьюер их не увидит
  - **Не работает в production** (Vite proxy — только для dev)
- **Альтернатива:** `/dicom` → `http://localhost:8000/dicom` (через RIS DICOMweb прокси с JWT), а Vite proxy для `/dicom` убрать — RIS уже имеет DICOMweb

### 5. RIS DICOMweb прокси недоступен через Vite (конфликт путей)
- **В RIS:** `/dicom/{path}` (порт 8000)
- **В Vite:** `/dicom` → `http://localhost:8042/dicom-web`
- **Итог:** RIS DICOMweb прокси никогда не вызывается через Vite dev-сервер. Весь трафик `/dicom/*` перехватывается Vite и уходит в Orthanc
- **В продакшне** (без Vite) RIS DICOMweb будет работать, но DWV-конфигурация захардкожена на `/dicom/...` что может не совпадать

### 6. `konva` в optimizeDeps, но НЕТ в package.json
- **Файл:** `vite.config.ts:8`
- **Код:** `include: ['dwv', 'konva']`
- **Проблема:** `konva` отсутствует в зависимостях. Vite может не найти модуль при сборке
- **Надо:** Либо удалить `konva` из optimizeDeps, либо добавить в package.json

---

## ⚪ МЕЛКИЕ

### 7. ViewerPage — чистая обёртка (43 строки)
- Весь функционал в `DwvViewer`, `ViewerPage` просто рендерит его
- Это ок, но `ViewerPage` можно было объединить с `DwvViewer` или хотя бы добавить fallback на случай когда `dwv` не загрузился

### 8. Нет обработки ошибок при инициализации DWV (частично)
- В `DwvViewer.tsx:71-76` есть try/catch при `initApp`, но ошибка просто пишется в `error` state
- Если DWV библиотека не загружена (CDN/Node_modules сбой), пользователь увидит только текст ошибки — нет кнопки «Повторить» или fallback

---

## ✅ ЧТО ХОРОШО

| Аспект | Оценка |
|---|---|
| **DICOMweb-стандарт** (QIDO-RS/WADO-RS) | ✅ Правильный архитектурный выбор |
| **Прокси на Orthanc** через httpx.AsyncClient | ✅ Асинхронно, без блокировок |
| **Инструменты рисования** (Ruler, Circle, Rectangle, Arrow, Angle) | ✅ Реально полезно врачу |
| **Загрузка локальных DICOM-файлов** | ✅ Удобно для демо без Orthanc |
| **Селектор серий** | ✅ Если несколько серий |
| **TypeScript типизация** `dwv.d.ts` (83 строки) | ✅ Покрывает все используемые API |
| **Автоочистка при размонтировании** (`app.reset()`) | ✅ Нет утечек памяти |
| **TypeScript компилируется** (`npx tsc --noEmit` → 0 ошибок) | ✅ |
| **DWV версия** `^0.36.3` | ✅ Актуальная |

---

## ИТОГО: ЧТО ПРАВИТЬ

| # | Приоритет | Что делать | Кто |
|---|---|---|---|
| 1 | 🔴 | Добавить `Depends(get_current_user)` в `dicomweb.py` | Товарищ / мы |
| 2 | 🔴 | Исправить `inst.uid` → `inst.sop_instance_uid` в `DwvViewer.tsx:135` | Товарищ |
| 3 | 🟡 | Исправить маппинг полей API в `DwvViewer.tsx:163-170` | Товарищ |
| 4 | 🟡 | Перенаправить `/dicom` в Vite через RIS (порт 8000) вместо Orthanc (8042) | Товарищ / мы |
| 5 | 🟡 | Убрать `konva` из optimizeDeps или добавить в package.json | Товарищ |
| 6 | ⚪ | Добавить fallback UI при ошибке загрузки DWV | Товарищ |

---

## КАК ТЕСТИРОВАТЬ ПОСЛЕ ИСПРАВЛЕНИЙ

```powershell
# 1. Без токена — 401
curl http://localhost:8000/dicom/studies
# → {"detail":"Требуется авторизация"}

# 2. С токеном — данные
$token = ((curl -s -X POST http://localhost:8005/api/auth/login `
  -H "Content-Type: application/json" `
  -d '{"username":"admin","password":"admin123"}') | ConvertFrom-Json).access_token
curl -s http://localhost:8000/dicom/studies -H "Authorization: Bearer $token"
# → DICOM JSON

# 3. Фронт: открыть /viewer/{studyUid} — вьюер загружает снимки
# 4. Имя пациента отображается корректно
# 5. Срез переключается (Scroll tool)
# 6. Draw инструменты работают
```
