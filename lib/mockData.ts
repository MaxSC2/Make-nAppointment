/*
  ═══════════════════════════════════════════════════════════════════════════
  📦 МОК-ДАННЫЕ — заменить на реальные данные из БД/API
  ═══════════════════════════════════════════════════════════════════════════
  Backend: этот файл будет полностью удалён при подключении реального API.
  Сейчас он используется lib/api/index.ts как временный источник данных.
  ───────────────────────────────────────────────────────────────────────────
  Ожидаемые API-эндпоинты:
    GET  /api/doctors             → список врачей (Doctor[])
    GET  /api/appointments        → список записей текущего пациента
    POST /api/appointments        → создать запись
    DELETE /api/appointments/:id  → отменить запись
    GET  /api/doctor/dashboard    → статистика для дашборда врача
    GET  /api/doctor/patients     → список пациентов врача
    GET  /api/doctor/schedule     → расписание врача
    GET  /api/doctor/appointments → записи к врачу
    GET  /api/admin/dashboard     → статистика для дашборда админа
    GET  /api/admin/users         → список пользователей
    GET  /api/admin/doctors       → список врачей
    GET  /api/admin/clinics       → список клиник
    GET  /api/admin/audit         → журнал аудита
  ═══════════════════════════════════════════════════════════════════════════
*/

import { Doctor, Appointment } from "@/types/appointment";

export const doctors: Doctor[] = [
  {
    id: "1",
    name: "Нурланов А.С.",
    specialty: "Терапевт",
    clinic: "Городская поликлиника №4",
    experience: "12 лет",
    rating: 4.8,
    price: "Бесплатно (ОМС)",
    imageUrl:
      "https://images.unsplash.com/photo-1612349317150-e410f624c427?auto=format&fit=crop&w=96&q=80",
    available: true,
    slots: [
      { time: "09:00", available: true },
      { time: "09:30", available: true },
      { time: "10:00", available: true },
      { time: "10:30", available: false },
      { time: "11:00", available: true },
      { time: "11:30", available: true },
      { time: "12:00", available: true },
      { time: "14:00", available: true },
      { time: "14:30", available: false },
      { time: "15:00", available: true },
      { time: "15:30", available: true },
      { time: "16:00", available: true },
    ],
  },
  {
    id: "2",
    name: "Смагулова Г.К.",
    specialty: "Кардиолог",
    clinic: "Диагностический центр",
    experience: "20 лет",
    rating: 4.9,
    price: "5000 ₸",
    imageUrl:
      "https://images.unsplash.com/photo-1594824436998-f2b38fb9a896?auto=format&fit=crop&w=96&q=80",
    available: true,
    slots: [
      { time: "09:00", available: true },
      { time: "09:30", available: false },
      { time: "10:00", available: true },
      { time: "10:30", available: false },
      { time: "11:00", available: true },
      { time: "11:30", available: true },
      { time: "12:00", available: true },
      { time: "14:00", available: false },
      { time: "14:30", available: true },
      { time: "15:00", available: true },
      { time: "15:30", available: false },
      { time: "16:00", available: true },
    ],
  },
  {
    id: "3",
    name: "Ермеков Б.Т.",
    specialty: "Невролог",
    clinic: "Областная больница",
    experience: "8 лет",
    rating: 4.5,
    price: "3500 ₸",
    imageUrl:
      "https://images.unsplash.com/photo-1537368910025-700350fe46c7?auto=format&fit=crop&w=96&q=80",
    available: true,
    slots: [
      { time: "10:00", available: true },
      { time: "10:30", available: true },
      { time: "11:00", available: true },
      { time: "11:30", available: false },
      { time: "14:00", available: true },
      { time: "14:30", available: true },
      { time: "15:00", available: false },
      { time: "15:30", available: true },
    ],
  },
  {
    id: "4",
    name: "Иванова Л.В.",
    specialty: "Дерматолог",
    clinic: "Кожвен-диспансер",
    experience: "15 лет",
    rating: 4.7,
    price: "4000 ₸",
    imageUrl:
      "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&w=96&q=80",
    available: false,
    slots: [
      { time: "09:00", available: false },
      { time: "09:30", available: false },
      { time: "10:00", available: false },
      { time: "10:30", available: false },
    ],
  },
  {
    id: "5",
    name: "Ахметов Р.Н.",
    specialty: "Педиатр",
    clinic: "Детская поликлиника №2",
    experience: "10 лет",
    rating: 4.6,
    price: "Бесплатно (ОМС)",
    imageUrl:
      "https://images.unsplash.com/photo-1618498082410-b4aa4a2f7a2c?auto=format&fit=crop&w=96&q=80",
    available: true,
    slots: [
      { time: "08:00", available: true },
      { time: "08:30", available: true },
      { time: "09:00", available: true },
      { time: "09:30", available: true },
      { time: "10:00", available: true },
      { time: "10:30", available: false },
      { time: "11:00", available: true },
      { time: "11:30", available: true },
    ],
  },
  {
    id: "6",
    name: "Ким С.В.",
    specialty: "Хирург",
    clinic: "Городская больница №1",
    experience: "22 года",
    rating: 4.9,
    price: "6000 ₸",
    imageUrl:
      "https://images.unsplash.com/photo-1622253692010-333f2da2031d?auto=format&fit=crop&w=96&q=80",
    available: true,
    slots: [
      { time: "13:00", available: true },
      { time: "13:30", available: false },
      { time: "14:00", available: true },
      { time: "14:30", available: true },
      { time: "15:00", available: true },
      { time: "15:30", available: false },
      { time: "16:00", available: true },
    ],
  },
];

export const TIME_SLOTS: string[] = [
  "08:00", "08:30", "09:00", "09:30", "10:00", "10:30",
  "11:00", "11:30", "12:00", "12:30",
  "13:00", "13:30", "14:00", "14:30", "15:00", "15:30",
  "16:00", "16:30", "17:00", "17:30",
];

export const RU_MONTHS_GEN: string[] = [
  "января", "февраля", "марта", "апреля", "мая", "июня",
  "июля", "августа", "сентября", "октября", "ноября", "декабря",
];

// ── Doctor Dashboard ──

export interface DoctorStat {
  icon: string;
  label: string;
  value: string;
}

export const doctorDashboardStats: DoctorStat[] = [
  { icon: "Calendar", label: "Приёмов сегодня", value: "8" },
  { icon: "Users", label: "Пациентов", value: "1 247" },
  { icon: "Clock", label: "Ожидают", value: "3" },
  { icon: "FileText", label: "Назначений", value: "12" },
];

export interface DoctorPatient {
  name: string;
  iin: string;
  age: number;
  lastVisit: string;
}

export const doctorPatients: DoctorPatient[] = [
  { name: "Асель Мухамеджанова", iin: "920512450123", age: 34, lastVisit: "12.10.2024" },
  { name: "Серикбаев Арман", iin: "880101350234", age: 41, lastVisit: "10.10.2024" },
  { name: "Иванова Марина", iin: "900515451012", age: 36, lastVisit: "08.10.2024" },
];

export const weekDays = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

export const timeSlots = [
  "08:00", "09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00",
];

export const doctorSchedule: Record<string, string[]> = {
  "Пн": ["08:00", "09:00", "10:00", "11:00"],
  "Ср": ["09:00", "10:00", "14:00", "15:00"],
  "Пт": ["08:00", "09:00", "10:00", "11:00", "12:00"],
};

export interface DoctorAppointment {
  patient: string;
  time: string;
  type: string;
  status: "Ожидает" | "В процессе" | "Завершён";
}

export const doctorAppointments: DoctorAppointment[] = [
  { patient: "Асель Мухамеджанова", time: "09:00", type: "Первичный приём", status: "Ожидает" },
  { patient: "Серикбаев Арман", time: "10:00", type: "Повторный", status: "В процессе" },
  { patient: "Иванова Марина", time: "11:30", type: "Профилактика", status: "Завершён" },
  { patient: "Ким Светлана", time: "14:00", type: "Первичный приём", status: "Ожидает" },
];

// ── Admin Dashboard ──

export interface AdminStat {
  icon: string;
  label: string;
  value: string;
}

export const adminDashboardStats: AdminStat[] = [
  { icon: "Users", label: "Пациентов", value: "12 453" },
  { icon: "Stethoscope", label: "Врачей", value: "156" },
  { icon: "Building2", label: "Клиник", value: "8" },
  { icon: "CalendarCheck", label: "Записей", value: "3 289" },
];

export interface AdminUser {
  name: string;
  iin: string;
  role: "Пациент" | "Врач" | "Админ";
}

export const adminUsers: AdminUser[] = [
  { name: "Иванова Марина", iin: "900515451012", role: "Пациент" },
  { name: "Нурланов А.С.", iin: "780101350567", role: "Врач" },
  { name: "Администратор", iin: "700101450789", role: "Админ" },
];

export interface AdminDoctor {
  name: string;
  specialty: string;
  clinic: string;
  patients: number;
}

export const adminDoctors: AdminDoctor[] = [
  { name: "Нурланов А.С.", specialty: "Терапевт", clinic: "Городская поликлиника №1", patients: 342 },
  { name: "Ким С.В.", specialty: "Кардиолог", clinic: "Кардиоцентр", patients: 198 },
  { name: "Ахметов Р.М.", specialty: "Хирург", clinic: "Городская больница", patients: 156 },
];

export interface AdminClinic {
  name: string;
  address: string;
  phone: string;
  doctors: number;
}

export const adminClinics: AdminClinic[] = [
  { name: "Городская поликлиника №1", address: "ул. Абая, 45", phone: "+7 (7152) 50-00-01", doctors: 45 },
  { name: "Городская поликлиника №2", address: "ул. Мира, 78", phone: "+7 (7152) 50-00-02", doctors: 32 },
  { name: "Кардиологический центр", address: "ул. Интернациональная, 120", phone: "+7 (7152) 50-01-00", doctors: 28 },
  { name: "Городская больница", address: "ул. Кремлёвская, 21", phone: "+7 (7152) 50-02-00", doctors: 67 },
  { name: "Детская поликлиника", address: "ул. Жамбыла, 15", phone: "+7 (7152) 50-03-00", doctors: 38 },
  { name: "Женская консультация", address: "ул. Абая, 50", phone: "+7 (7152) 50-04-00", doctors: 22 },
  { name: "Стоматологическая клиника", address: "ул. Победы, 10", phone: "+7 (7152) 50-05-00", doctors: 18 },
  { name: "Кожно-венерологический диспансер", address: "ул. Советская, 33", phone: "+7 (7152) 50-06-00", doctors: 14 },
];

export interface AdminAuditLog {
  action: string;
  user: string;
  time: string;
  details: string;
}

export const adminAuditLogs: AdminAuditLog[] = [
  { action: "Вход в систему", user: "Иванова М. (пациент)", time: "27.05.2026 10:30", details: "IP: 192.168.1.1" },
  { action: "Запись на приём", user: "Иванова М. (пациент)", time: "27.05.2026 10:32", details: "Терапевт, 28.05 09:00" },
  { action: "Просмотр карты", user: "Нурланов А. (врач)", time: "27.05.2026 10:35", details: "Пациент: Иванова М." },
  { action: "Выдача направления", user: "Нурланов А. (врач)", time: "27.05.2026 10:40", details: "Анализ крови" },
  { action: "Отмена записи", user: "Иванова М. (пациент)", time: "27.05.2026 11:15", details: "Причина: не указана" },
];

export const initialAppointments: Appointment[] = [
  {
    id: "1",
    doctor: {
      id: "1",
      name: "Нурланов А.С.",
      specialty: "Терапевт",
      clinic: "Городская поликлиника №4",
      experience: "12 лет",
      rating: 4.8,
      price: "Бесплатно (ОМС)",
      imageUrl:
        "https://images.unsplash.com/photo-1612349317150-e410f624c427?auto=format&fit=crop&w=96&q=80",
      available: true,
      slots: [],
    },
    date: "16 октября 2024",
    time: "10:00",
    status: "confirmed",
  },
  {
    id: "2",
    doctor: {
      id: "2",
      name: "Смагулова Г.К.",
      specialty: "Кардиолог",
      clinic: "Диагностический центр",
      experience: "20 лет",
      rating: 4.9,
      price: "5000 ₸",
      imageUrl:
        "https://images.unsplash.com/photo-1594824436998-f2b38fb9a896?auto=format&fit=crop&w=96&q=80",
      available: true,
      slots: [],
    },
    date: "28 октября 2024",
    time: "14:30",
    status: "pending",
  },
];
