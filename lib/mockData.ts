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
      { time: "14:00", available: false },
      { time: "15:00", available: true },
    ],
  },
  {
    id: "2",
    name: "Смагулова Г.К.",
    specialty: "Кардиолог",
    clinic: "Кардиологический центр",
    experience: "18 лет",
    rating: 4.9,
    price: "3 500 ₸",
    imageUrl:
      "https://images.unsplash.com/photo-1594824436998-f2b38fb9a896?auto=format&fit=crop&w=96&q=80",
    available: true,
    slots: [
      { time: "09:30", available: true },
      { time: "10:00", available: false },
      { time: "10:30", available: true },
      { time: "11:00", available: true },
      { time: "14:30", available: true },
      { time: "15:00", available: true },
    ],
  },
  {
    id: "3",
    name: "Ахметов Д.Б.",
    specialty: "Невролог",
    clinic: "Городская поликлиника №4",
    experience: "9 лет",
    rating: 4.7,
    price: "2 000 ₸",
    imageUrl:
      "https://images.unsplash.com/photo-1537368910025-700350fe46c7?auto=format&fit=crop&w=96&q=80",
    available: true,
    slots: [
      { time: "10:00", available: true },
      { time: "11:00", available: true },
      { time: "15:00", available: true },
      { time: "15:30", available: true },
    ],
  },
  {
    id: "4",
    name: "Касымова М.Т.",
    specialty: "Дерматолог",
    clinic: "Областная больница",
    experience: "7 лет",
    rating: 4.6,
    price: "4 000 ₸",
    imageUrl:
      "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&w=96&q=80",
    available: false,
    slots: [],
  },
  {
    id: "5",
    name: "Бекова А.Н.",
    specialty: "Педиатр",
    clinic: "Детская поликлиника №1",
    experience: "15 лет",
    rating: 4.9,
    price: "Бесплатно (ОМС)",
    imageUrl:
      "https://images.unsplash.com/photo-1551601651-2a8555f1a136?auto=format&fit=crop&w=96&q=80",
    available: true,
    slots: [
      { time: "08:00", available: true },
      { time: "08:30", available: true },
      { time: "09:00", available: true },
      { time: "09:30", available: true },
      { time: "10:00", available: false },
    ],
  },
  {
    id: "6",
    name: "Жумабаев Р.С.",
    specialty: "Хирург",
    clinic: "Областная больница",
    experience: "20 лет",
    rating: 4.8,
    price: "5 000 ₸",
    imageUrl:
      "https://images.unsplash.com/photo-1622253692010-333f2da6031d?auto=format&fit=crop&w=96&q=80",
    available: true,
    slots: [
      { time: "14:00", available: true },
      { time: "14:30", available: true },
      { time: "15:00", available: true },
      { time: "16:00", available: false },
    ],
  },
];

export const TIME_SLOTS = [
  "08:00", "08:30", "09:00", "09:30",
  "10:00", "10:30", "11:00", "11:30",
  "12:00", "14:00", "14:30", "15:00",
  "15:30", "16:00", "16:30",
];

export const RU_MONTHS_GEN = [
  "января", "февраля", "марта", "апреля", "мая", "июня",
  "июля", "августа", "сентября", "октября", "ноября", "декабря",
];

export const RU_DAYS_SHORT = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];

export const initialAppointments: Appointment[] = [
  {
    id: 1,
    doctor: doctors[0],
    date: "16 октября 2024",
    time: "10:00",
    status: "confirmed",
  },
  {
    id: 2,
    doctor: doctors[1],
    date: "28 октября 2024",
    time: "14:30",
    status: "pending",
  },
];
