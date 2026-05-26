"use client";

import { useState } from "react";
import { Search, SlidersHorizontal } from "lucide-react";
import { Badge } from "@/components/ui/Badge";

const visits = [
  {
    diagnosis: "ОРВИ, лёгкая форма",
    status: "Активен",
    variant: "blue" as const,
    doctor: "Нурланов А.С.",
    spec: "Терапевт",
    clinic: "Городская поликлиника №4",
    notes: "Жалобы на температуру 37.5, кашель, общую слабость. Назначено симптоматическое лечение.",
    date: "14",
    month: "Окт",
    year: "2024",
    prescriptions: 2,
    active: true,
  },
  {
    diagnosis: "Плановый осмотр",
    status: "Завершён",
    variant: "green" as const,
    doctor: "Смагулова Г.К.",
    spec: "Кардиолог",
    clinic: "Кардиологический центр",
    notes: "ЭКГ в норме. Давление 120/80. Рекомендовано продолжить приём поддерживающих препаратов.",
    date: "12",
    month: "Июл",
    year: "2024",
    prescriptions: 0,
    active: false,
  },
  {
    diagnosis: "Гипертония 1 степени",
    status: "Завершён",
    variant: "green" as const,
    doctor: "Смагулова Г.К.",
    spec: "Кардиолог",
    clinic: "Кардиологический центр",
    notes: "Жалобы на периодические головные боли. Давление 140/90. Назначен холтер-мониторинг.",
    date: "05",
    month: "Мар",
    year: "2024",
    prescriptions: 1,
    active: false,
  },
  {
    diagnosis: "Грипп",
    status: "Завершён",
    variant: "green" as const,
    doctor: "Нурланов А.С.",
    spec: "Терапевт",
    clinic: "Городская поликлиника №4",
    notes: "Высокая температура, ломота в суставах. Открыт больничный лист на 7 дней.",
    date: "20",
    month: "Ноя",
    year: "2023",
    prescriptions: 3,
    active: false,
  },
  {
    diagnosis: "Бронхит",
    status: "Завершён",
    variant: "green" as const,
    doctor: "Нурланов А.С.",
    spec: "Терапевт",
    clinic: "Городская поликлиника №4",
    notes: "Жалобы на сильный кашель. Назначен курс антибиотиков.",
    date: "15",
    month: "Янв",
    year: "2023",
    prescriptions: 0,
    active: false,
  },
];

export default function VisitHistoryPage() {
  const [filter, setFilter] = useState("all");

  const filtered = visits.filter((v) => {
    if (filter === "active") return v.active;
    if (filter === "completed") return !v.active;
    return true;
  });

  return (
    <div>
      <h1 className="mb-5 text-[22px] font-extrabold text-foreground">История визитов</h1>

      {/* Filters */}
      <div className="mb-5 flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-4">
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Поиск по врачу или диагнозу..."
            className="w-full rounded-lg border border-border bg-background py-2 pl-8 pr-3 text-label text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
          />
        </div>
        <select className="rounded-lg border border-border bg-background px-3 py-2 text-label text-foreground focus:border-primary focus:outline-none">
          <option>Все года</option>
          <option>2024</option>
          <option>2023</option>
        </select>
        <select className="rounded-lg border border-border bg-background px-3 py-2 text-label text-foreground focus:border-primary focus:outline-none">
          <option>Все специальности</option>
          <option>Терапевт</option>
          <option>Кардиолог</option>
        </select>
        <button className="rounded-lg border border-border bg-background p-2 text-muted-foreground hover:text-foreground">
          <SlidersHorizontal className="h-4 w-4" />
        </button>
      </div>

      {/* Filter tabs */}
      <div className="mb-6 flex gap-1 border-b-2 border-border">
        {[
          { key: "all", label: "Все" },
          { key: "active", label: "Активные" },
          { key: "completed", label: "Завершённые" },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={`px-6 py-3 text-body font-medium transition-colors ${
              filter === tab.key
                ? "border-b-2 border-primary text-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Timeline */}
      <div className="relative pl-[104px] max-md:pl-0">
        {/* Timeline line */}
        <div className="absolute left-[104px] top-6 bottom-6 w-px bg-border max-md:hidden" />

        {filtered.map((v, idx) => (
          <div key={idx} className="relative mb-7 flex gap-6 max-md:flex-col max-md:gap-2">
            {/* Date */}
            <div className="relative w-24 shrink-0 pt-3.5 text-right max-md:w-auto max-md:text-left">
              <div className="absolute right-[-16px] top-[22px] h-3 w-3 rounded-full border-2 border-border bg-background max-md:hidden" />
              <div className="text-body font-bold text-foreground">{v.date} {v.month}</div>
              <div className="text-micro text-muted-foreground">{v.year}</div>
            </div>

            {/* Card */}
            <div className="min-w-0 flex-1 rounded-xl border border-border bg-card p-5">
              <div className="mb-2 flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="text-base font-bold text-foreground">{v.diagnosis}</div>
                  <Badge variant={v.variant}>{v.status}</Badge>
                </div>
              </div>
              <div className="mb-2 text-label font-semibold text-foreground">
                {v.doctor} <span className="font-normal text-muted-foreground">{v.spec} · {v.clinic}</span>
              </div>
              <div className="mb-2.5 text-label text-muted-foreground">{v.notes}</div>
              <div className="flex gap-3 text-label">
                <a href="#" className="font-medium text-primary hover:underline">Подробнее</a>
                {v.prescriptions > 0 && (
                  <>
                    <span className="text-border">·</span>
                    <a href="/emk/prescriptions" className="font-medium text-primary hover:underline">
                      Назначения ({v.prescriptions})
                    </a>
                  </>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
