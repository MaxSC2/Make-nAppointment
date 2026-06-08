export interface Feature {
  icon: string;
  title: string;
  description: string;
}

export interface Patient {
  name: string;
  age: number;
  id: string;
  bloodType: string;
  visits: { date: string; doctor: string; diagnosis: string }[];
  prescriptions: { medication: string; dosage: string; period: string }[];
}

export interface LabTest {
  name: string;
  status: "Назначен" | "В процессе" | "Готов";
  date: string;
}

export const features: Feature[] = [
  {
    icon: "CalendarCheck",
    title: "Онлайн запись",
    description: "Выбирайте удобное время и записывайтесь к врачу без звонков и очередей.",
  },
  {
    icon: "Files",
    title: "Электронная медкарта",
    description: "Вся история болезни, диагнозы и назначения в одном месте — доступно 24/7.",
  },
  {
    icon: "FlaskConical",
    title: "Лабораторные результаты",
    description: "Получайте результаты анализов онлайн сразу после готовности.",
  },
  {
    icon: "Shield",
    title: "Безопасность данных",
    description: "Ваши медицинские данные защищены шифрованием и строгими протоколами доступа.",
  },
];

export const patientData: Patient = {
  name: "Асель Мухамеджанова",
  age: 34,
  id: "P-2024-00842",
  bloodType: "B Rh+ (III положительная)",
  visits: [
    { date: "12.10.2024", doctor: "Нурланов А.С. — Терапевт", diagnosis: "ОРВИ, назначено лечение" },
    { date: "28.09.2024", doctor: "Смагулова Г.К. — Кардиолог", diagnosis: "Профилактический осмотр" },
    { date: "15.08.2024", doctor: "Нурланов А.С. — Терапевт", diagnosis: "Ежегодная диспансеризация" },
  ],
  prescriptions: [
    { medication: "Амоксициллин 500 мг", dosage: "3 раза в день", period: "7 дней" },
    { medication: "Парацетамол 500 мг", dosage: "При температуре", period: "По необходимости" },
  ],
};

export const labTests: LabTest[] = [
  { name: "Общий анализ крови", status: "Готов", date: "14.10.2024" },
  { name: "Биохимический анализ", status: "В процессе", date: "15.10.2024" },
  { name: "Анализ на гормоны щитовидной железы", status: "Назначен", date: "20.10.2024" },
];
