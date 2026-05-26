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
  id: number;
  doctor: Doctor;
  date: string;
  time: string;
  status: AppointmentStatus;
}
