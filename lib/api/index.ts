/*
  ═══════════════════════════════════════════════════════════════════════════
  🔌 API-СЛОЙ — временно использует мок-данные
  ═══════════════════════════════════════════════════════════════════════════
  Backend: замените тело каждой функции на реальный fetch() к вашему API.
  Формат ответа: фунции возвращают Promise<T>.
  Ошибки: бросайте Error с человеко-читаемым сообщением — useQuery()
  в hooks.ts поймает его и выставит в state.error.
  ───────────────────────────────────────────────────────────────────────────
  Пример замены для fetchDoctors:
    export async function fetchDoctors(): Promise<Doctor[]> {
      const res = await fetch("/api/doctors");
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Ошибка загрузки врачей");
      }
      return res.json();
    }
  ═══════════════════════════════════════════════════════════════════════════
*/

import {
  doctors, TIME_SLOTS, initialAppointments,
  doctorDashboardStats, type DoctorStat,
  doctorPatients, type DoctorPatient,
  doctorSchedule, weekDays, timeSlots,
  doctorAppointments, type DoctorAppointment,
  adminDashboardStats, type AdminStat,
  adminUsers, type AdminUser,
  adminDoctors, type AdminDoctor,
  adminClinics, type AdminClinic,
  adminAuditLogs, type AdminAuditLog,
} from "@/lib/mockData";
import { labTests, labReferrals } from "@/lib/labMockData";
import type { Doctor, Appointment } from "@/types/appointment";
import type { LabTest, LabReferral } from "@/types/laboratory";

function delay(ms: number = 300, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(timer);
      reject(new DOMException("Aborted", "AbortError"));
    }, { once: true });
  });
}

// ── Appointments ──

// GET /api/doctors — список всех врачей с доступными слотами
export async function fetchDoctors(signal?: AbortSignal): Promise<Doctor[]> {
  await delay(300, signal);
  return doctors;
}

// GET /api/slots — список временных слотов (опционально по doctorId)
export async function fetchTimeSlots(signal?: AbortSignal): Promise<string[]> {
  await delay(300, signal);
  return TIME_SLOTS;
}

// GET /api/appointments — список записей текущего авторизованного пациента
export async function fetchAppointments(signal?: AbortSignal): Promise<Appointment[]> {
  await delay(300, signal);
  return initialAppointments;
}

// ── Laboratory ──

const LS_KEY = "lab_tests";

function initLocalStorage(): void {
  if (typeof window === "undefined") return;
  const stored = localStorage.getItem(LS_KEY);
  if (!stored) {
    localStorage.setItem(LS_KEY, JSON.stringify(labTests));
  }
}

function getLabTestsFromStorage(): LabTest[] {
  initLocalStorage();
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) || "[]") as LabTest[];
  } catch {
    return [];
  }
}

function saveLabTestsToStorage(tests: LabTest[]): void {
  localStorage.setItem(LS_KEY, JSON.stringify(tests));
}

// GET /api/lab/tests — все анализы (для пациента — фильтр на клиенте)
export async function fetchLabTests(signal?: AbortSignal): Promise<LabTest[]> {
  await delay(300, signal);
  return getLabTestsFromStorage();
}

// GET /api/lab/queue — очередь анализов (для лаборанта: статусы "Назначен" и "Взят")
export async function fetchLabQueue(signal?: AbortSignal): Promise<LabTest[]> {
  await delay(300, signal);
  const all = getLabTestsFromStorage();
  return all.filter((t) => t.status === "Назначен" || t.status === "Взят");
}

// GET /api/lab/patient/:patientId — готовые результаты по пациенту
export async function fetchPatientLabResults(
  patientId: string,
  signal?: AbortSignal
): Promise<LabTest[]> {
  await delay(300, signal);
  const all = getLabTestsFromStorage();
  return all.filter((t) => t.patientId === patientId && t.status === "Готов");
}

// PATCH /api/lab/tests/:id/status — сменить статус
export async function updateLabTestStatus(
  id: string,
  status: LabTest["status"],
  signal?: AbortSignal
): Promise<void> {
  await delay(300, signal);
  const all = getLabTestsFromStorage();
  const idx = all.findIndex((t) => t.id === id);
  if (idx === -1) throw new Error("Анализ не найден");
  all[idx].status = status;
  saveLabTestsToStorage(all);
}

// POST /api/lab/tests/:id/result — отправить результат (статус → "Готов")
export async function submitLabResult(
  id: string,
  resultData: { value: number | string; unit: string; referenceRange: { min: number; max: number } },
  signal?: AbortSignal
): Promise<void> {
  await delay(300, signal);
  const all = getLabTestsFromStorage();
  const idx = all.findIndex((t) => t.id === id);
  if (idx === -1) throw new Error("Анализ не найден");
  all[idx].result = resultData;
  all[idx].status = "Готов";
  all[idx].dateReady = new Date().toLocaleDateString("ru-RU", {
    day: "numeric", month: "short", year: "numeric",
  });
  saveLabTestsToStorage(all);
}

// POST /api/lab/tests — создать новый анализ (для врача)
export async function createLabTest(
  patientId: string,
  params: {
    name: string;
    category: string;
    doctorName: string;
  },
  signal?: AbortSignal
): Promise<LabTest> {
  await delay(300, signal);
  const all = getLabTestsFromStorage();
  const newTest: LabTest = {
    id: crypto.randomUUID(),
    patientId,
    name: params.name,
    category: params.category,
    dateOrdered: new Date().toLocaleDateString("ru-RU", {
      day: "numeric", month: "short", year: "numeric",
    }),
    status: "Назначен",
    doctorName: params.doctorName,
    hasFile: false,
  };
  all.push(newTest);
  saveLabTestsToStorage(all);
  return newTest;
}

// GET /api/lab/referrals — список направлений текущего пациента
export async function fetchLabReferrals(signal?: AbortSignal): Promise<LabReferral[]> {
  await delay(300, signal);
  return labReferrals;
}

// ── Doctor Dashboard ──

// GET /api/doctor/dashboard — статистика дашборда врача
export async function fetchDoctorDashboardStats(signal?: AbortSignal): Promise<DoctorStat[]> {
  await delay(300, signal);
  return doctorDashboardStats;
}

// GET /api/doctor/patients — список пациентов врача
export async function fetchDoctorPatients(signal?: AbortSignal): Promise<DoctorPatient[]> {
  await delay(300, signal);
  return doctorPatients;
}

// GET /api/doctor/schedule — расписание (дни, слоты, занятость)
export async function fetchDoctorSchedule(signal?: AbortSignal): Promise<{ weekDays: string[]; timeSlots: string[]; schedule: Record<string, string[]> }> {
  await delay(300, signal);
  return { weekDays, timeSlots, schedule: doctorSchedule };
}

// GET /api/doctor/appointments — записи к врачу
export async function fetchDoctorAppointments(signal?: AbortSignal): Promise<DoctorAppointment[]> {
  await delay(300, signal);
  return doctorAppointments;
}

// ── Admin Dashboard ──

// GET /api/admin/dashboard — статистика дашборда админа
export async function fetchAdminDashboardStats(signal?: AbortSignal): Promise<AdminStat[]> {
  await delay(300, signal);
  return adminDashboardStats;
}

// GET /api/admin/users — список пользователей
export async function fetchAdminUsers(signal?: AbortSignal): Promise<AdminUser[]> {
  await delay(300, signal);
  return adminUsers;
}

// GET /api/admin/doctors — список врачей
export async function fetchAdminDoctors(signal?: AbortSignal): Promise<AdminDoctor[]> {
  await delay(300, signal);
  return adminDoctors;
}

// GET /api/admin/clinics — список клиник
export async function fetchAdminClinics(signal?: AbortSignal): Promise<AdminClinic[]> {
  await delay(300, signal);
  return adminClinics;
}

// GET /api/admin/audit — журнал аудита
export async function fetchAdminAuditLogs(signal?: AbortSignal): Promise<AdminAuditLog[]> {
  await delay(300, signal);
  return adminAuditLogs;
}
