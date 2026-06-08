"use client";

import { useState } from "react";
import Link from "next/link";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { Badge } from "@/components/ui/Badge";

const visits = [
  {
    id: 1,
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
    id: 2,
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
    id: 3,
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
    id: 4,
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
    id: 5,
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
  const [searchQuery, setSearchQuery] = useState("");
  const [yearFilter, setYearFilter] = useState("");
  const [specialtyFilter, setSpecialtyFilter] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  const filtered = visits.filter((v) => {
    if (filter === "active" && !v.active) return false;
    if (filter === "completed" && v.active) return false;

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!v.diagnosis.toLowerCase().includes(q) && !v.doctor.toLowerCase().includes(q)) return false;
    }

    if (yearFilter && v.year !== yearFilter) return false;
    if (specialtyFilter && v.spec !== specialtyFilter) return false;

    return true;
  });

  return (
    <div>
      <h1 className="mb-5 text-h2 font-extrabold text-foreground">История визитов</h1>

      {/* Filters */}
      <div className="mb-5 rounded-xl border border-border bg-card p-3 md:p-4">
        <div className="flex items-center gap-2 md:gap-3">
          <div className="relative min-w-0 flex-1">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Поиск по врачу или диагнозу..."
              className="w-full rounded-lg border border-border bg-background py-2 pl-8 pr-3 text-label text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
            />
          </div>
          <button
            onClick={() => setShowFilters((v) => !v)}
            className={`shrink-0 rounded-lg border p-2 transition-colors ${
              showFilters || yearFilter || specialtyFilter
                ? "border-primary bg-primary/10 text-primary"
                : "border-border bg-background text-muted-foreground hover:text-foreground"
            }`}
          >
            {showFilters || yearFilter || specialtyFilter ? (
              <X className="h-4 w-4" />
            ) : (
              <SlidersHorizontal className="h-4 w-4" />
            )}
          </button>
        </div>

        {showFilters && (
          <div className="mt-3 flex flex-wrap gap-2 border-t border-border pt-3">
            <select
              value={yearFilter}
              onChange={(e) => setYearFilter(e.target.value)}
              className="rounded-lg border border-border bg-background px-3 py-2 text-label text-foreground focus:border-primary focus:outline-none"
            >
              <option value="">Все года</option>
              <option value="2024">2024</option>
              <option value="2023">2023</option>
            </select>
            <select
              value={specialtyFilter}
              onChange={(e) => setSpecialtyFilter(e.target.value)}
              className="rounded-lg border border-border bg-background px-3 py-2 text-label text-foreground focus:border-primary focus:outline-none"
            >
              <option value="">Все специальности</option>
              <option value="Терапевт">Терапевт</option>
              <option value="Кардиолог">Кардиолог</option>
            </select>
          </div>
        )}
      </div>

      {/* Filter tabs */}
      <div className="mb-6 flex flex-wrap gap-2 md:gap-1 md:border-b md:border-border">
        {[
          { key: "all", label: "Все" },
          { key: "active", label: "Активные" },
          { key: "completed", label: "Завершённые" },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={`shrink-0 text-body font-medium transition-colors md:px-6 md:py-3 ${
              filter === tab.key
                ? "md:border-b-2 md:border-primary md:text-primary max-md:rounded-full max-md:bg-primary max-md:px-4 max-md:py-2 max-md:text-white"
                : "md:text-muted-foreground md:hover:text-foreground max-md:rounded-full max-md:border max-md:border-border max-md:bg-card max-md:px-4 max-md:py-2 max-md:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Timeline */}
      {filtered.length === 0 ? (
        <div className="py-16 text-center">
          <div className="text-h3 font-semibold text-foreground">Визиты не найдены</div>
          <p className="mt-1 text-body text-muted-foreground">Попробуйте изменить фильтры</p>
        </div>
      ) : (
        <div className="relative md:pl-[104px]">
          <div className="absolute left-[104px] top-6 bottom-6 w-px bg-border max-md:hidden" />

          {filtered.map((v) => (
            <div key={v.id} className="relative mb-5 md:mb-7 md:flex md:gap-6">
              {/* Date pill */}
              <div className="relative shrink-0 max-md:static max-md:mb-2.5 md:w-24 md:pt-3.5 md:text-right">
                <div className="max-md:inline-flex max-md:items-center max-md:gap-1.5 max-md:rounded-full max-md:border max-md:border-border max-md:bg-card max-md:px-3 max-md:py-1 max-md:shadow-sm">
                  <span className="text-body font-bold text-foreground md:block">{v.date} {v.month}</span>
                  <span className="text-micro text-muted-foreground md:block">{v.year}</span>
                </div>
                <div className="absolute right-[-16px] top-[22px] h-3 w-3 rounded-full border-2 border-border bg-background max-md:hidden" />
              </div>

              {/* Card */}
              <div className="min-w-0 flex-1 rounded-xl border border-border bg-card p-4 md:p-5">
                <div className="mb-2 flex items-start justify-between gap-3">
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <div className="break-words text-body font-bold text-foreground">{v.diagnosis}</div>
                    <Badge variant={v.variant}>{v.status}</Badge>
                  </div>
                </div>
                <div className="mb-1.5 break-words text-label font-semibold text-foreground md:mb-2">
                  {v.doctor}&nbsp;<span className="font-normal text-muted-foreground">{v.spec} · {v.clinic}</span>
                </div>
                <div className="mb-2 break-words text-label text-muted-foreground md:mb-2.5">{v.notes}</div>
                <div className="flex gap-3 text-label">
                  <button type="button" className="whitespace-nowrap font-medium text-primary hover:underline">Подробнее</button>
                  {v.prescriptions > 0 && (
                    <>
                      <span className="text-border">·</span>
                      <Link href="/emk/prescriptions" className="whitespace-nowrap font-medium text-primary hover:underline">
                        Назначения ({v.prescriptions})
                      </Link>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
