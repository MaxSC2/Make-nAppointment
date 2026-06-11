/*
  ═══════════════════════════════════════════════════════════════════════════
  📋 ТИПЫ — Модуль лаборатории
  ═══════════════════════════════════════════════════════════════════════════
  Backend: эти типы должны соответствовать ответам вашего API.
  ───────────────────────────────────────────────────────────────────────────
  GET /api/lab/tests → LabTest[]
  GET /api/lab/tests/:id → LabTest (с полем fileUrl для скачивания)
  GET /api/lab/tests/:id/file → blob (скачивание файла)
  GET /api/lab/referrals → LabReferral[]
  ═══════════════════════════════════════════════════════════════════════════
*/

export type LabTestStatus = "Назначен" | "Взят" | "Готов";

export interface LabTestResult {
  value: number | string;
  unit: string;
  referenceRange: {
    min: number;
    max: number;
  };
}

export interface LabTest {
  id: string;
  patientId: string;
  name: string;
  category: string;
  dateOrdered: string;
  dateReady?: string;
  status: LabTestStatus;
  doctorName: string;
  resultSummary?: string;
  result?: LabTestResult;
  hasFile?: boolean;
}

export interface LabReferral {
  id: number;
  testName: string;
  doctorName: string;
  date: string;
  clinic: string;
  used: boolean;
}
