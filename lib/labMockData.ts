/*
  ═══════════════════════════════════════════════════════════════════════════
  📦 МОК-ДАННЫЕ ЛАБОРАТОРИИ — заменить на реальные данные из БД/API
  ═══════════════════════════════════════════════════════════════════════════
  Backend: этот файл будет полностью удалён при подключении реального API.
  Сейчас он используется lib/api/index.ts как временный источник данных.
  ───────────────────────────────────────────────────────────────────────────
  Ожидаемые API-эндпоинты:
    GET  /api/lab/tests          → список анализов пациента
    GET  /api/lab/tests/:id      → детали анализа + файл
    GET  /api/lab/tests/:id/file → скачать результат
    GET  /api/lab/referrals      → список направлений
    GET  /api/lab/queue          → очередь анализов (для лаборанта)
    PATCH /api/lab/tests/:id/status → сменить статус
    POST /api/lab/tests/:id/result → отправить результат
  ───────────────────────────────────────────────────────────────────────────
  LabTest:
    id, name, category, dateOrdered, dateReady?,
    status: "Назначен"|"Взят"|"Готов",
    doctorName, resultSummary?, result: { value, unit, referenceRange }, hasFile?
  LabReferral:
    id, testName, doctorName, clinic, date, used: boolean
  ═══════════════════════════════════════════════════════════════════════════
  ⚠️ Мутации (updateLabTestStatus, submitLabResult) изменяют массив в памяти.
     При F5 данные сбрасываются. Для продакшена — заменить на вызовы API.
  ═══════════════════════════════════════════════════════════════════════════
*/

import type { LabTest, LabReferral } from "@/types/laboratory";

export const labTests: LabTest[] = [
  {
    id: "lab-1",
    patientId: "patient-1",
    name: "Общий анализ крови",
    category: "Гематология",
    dateOrdered: "12 окт 2024",
    dateReady: "14 окт 2024",
    status: "Готов",
    doctorName: "Нурланов А.С.",
    resultSummary: "Все показатели в норме",
    result: {
      value: 5.2,
      unit: "10^12/л",
      referenceRange: { min: 4.0, max: 5.5 },
    },
    hasFile: true,
  },
  {
    id: "lab-2",
    patientId: "patient-1",
    name: "Биохимия крови (расширенная)",
    category: "Биохимия",
    dateOrdered: "05 мар 2024",
    dateReady: "07 мар 2024",
    status: "Готов",
    doctorName: "Смагулова Г.К.",
    resultSummary:
      "Глюкоза: 5.2 ммоль/л (норма), Холестерин: 5.1 ммоль/л (повышен), АЛТ: 28 Ед/л (норма)",
    result: {
      value: 5.1,
      unit: "ммоль/л",
      referenceRange: { min: 3.0, max: 5.0 },
    },
    hasFile: true,
  },
  {
    id: "lab-3",
    patientId: "patient-1",
    name: "Гормоны щитовидной железы",
    category: "Эндокринология",
    dateOrdered: "10 окт 2024",
    dateReady: "13 окт 2024",
    status: "Готов",
    doctorName: "Ермеков Б.Т.",
    resultSummary: "ТТГ, Т3, Т4 в пределах референсных значений",
    result: {
      value: 2.5,
      unit: "мМЕ/л",
      referenceRange: { min: 0.4, max: 4.0 },
    },
    hasFile: true,
  },
  {
    id: "lab-4",
    patientId: "patient-1",
    name: "ПЦР на COVID-19",
    category: "Инфекции",
    dateOrdered: "15 окт 2024",
    dateReady: "16 окт 2024",
    status: "Готов",
    doctorName: "Нурланов А.С.",
    resultSummary: "Отрицательно",
    result: {
      value: "Отрицательно",
      unit: "",
      referenceRange: { min: 0, max: 0 },
    },
    hasFile: true,
  },
  {
    id: "lab-5",
    patientId: "patient-1",
    name: "Липидный профиль",
    category: "Биохимия",
    dateOrdered: "18 окт 2024",
    status: "Взят",
    doctorName: "Смагулова Г.К.",
    hasFile: false,
  },
  {
    id: "lab-6",
    patientId: "patient-1",
    name: "Анализ мочи общий",
    category: "Гематология",
    dateOrdered: "20 окт 2024",
    status: "Назначен",
    doctorName: "Нурланов А.С.",
    hasFile: false,
  },
  {
    id: "lab-7",
    patientId: "patient-1",
    name: "Коагулограмма",
    category: "Гемостаз",
    dateOrdered: "22 окт 2024",
    status: "Назначен",
    doctorName: "Смагулова Г.К.",
    hasFile: false,
  },
];

export const labReferrals: LabReferral[] = [
  {
    id: 1,
    testName: "Коагулограмма",
    doctorName: "Смагулова Г.К.",
    clinic: "Диагностический центр",
    date: "28 окт 2024",
    used: false,
  },
  {
    id: 2,
    testName: "Витамин D, 25-OH",
    doctorName: "Ермеков Б.Т.",
    clinic: "Областная больница",
    date: "15 окт 2024",
    used: true,
  },
  {
    id: 3,
    testName: "Анализ на аллергены (панель пищевая)",
    doctorName: "Иванова Л.В.",
    clinic: "Кожвен-диспансер",
    date: "10 окт 2024",
    used: true,
  },
];
