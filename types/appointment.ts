/*
  ═══════════════════════════════════════════════════════════════════════════
  📋 ТИПЫ — Модуль записи к врачу
  ═══════════════════════════════════════════════════════════════════════════
  Backend: эти типы должны соответствовать ответам вашего API.
  ───────────────────────────────────────────────────────────────────────────
  GET /api/doctors → Doctor[]
  GET /api/appointments → Appointment[]
  POST /api/appointments → Appointment (body: { doctorId, date, time, phone, complaints })
  DELETE /api/appointments/:id → void
  ═══════════════════════════════════════════════════════════════════════════
*/

export interface TimeSlot {
  time: string;
  available: boolean;
}

export interface Doctor {
  id: string;
  name: string;
  specialty: string;
  clinic: string;
  experience: string;
  rating: number;
  price: string;
  imageUrl: string;
  available: boolean;
  slots: TimeSlot[];
}

export type AppointmentStatus = "confirmed" | "pending";

export interface Appointment {
  id: string;
  doctor: Doctor;
  date: string;
  time: string;
  status: AppointmentStatus;
}
