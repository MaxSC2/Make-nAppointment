"use client";

import { useState } from "react";
import { FlaskConical } from "lucide-react";
import { Badge } from "@/components/ui/Badge";

const medications = [
  {
    name: "Амоксициллин 500 мг",
    category: "Антибиотик",
    dosage: "1 таблетка 3 раза в день",
    duration: "7 дней — до 21 октября 2024",
    doctor: "Нурланов А.С.",
    date: "14 окт 2024",
    progress: 28,
    day: "День 2 из 7",
    status: "Активно" as const,
    active: true,
  },
  {
    name: "Ибупрофен 400 мг",
    category: "Обезболивающее",
    dosage: "1 таблетка при болях",
    duration: "По необходимости",
    doctor: "Нурланов А.С.",
    date: "14 окт 2024",
    progress: 100,
    day: "По требованию",
    status: "Активно" as const,
    active: true,
  },
  {
    name: "Витамин D3 2000 ME",
    category: "Витамин",
    dosage: "1 капсула утром",
    duration: "30 дней — до 14 ноя 2024",
    doctor: "Нурланов А.С.",
    date: "14 окт 2024",
    progress: 6,
    day: "День 0 из 30",
    status: "Активно" as const,
    active: true,
  },
  {
    name: "Лозартан 50 мг",
    category: "Антигипертензивное",
    dosage: "1/2 таблетки на ночь",
    duration: "Постоянно",
    doctor: "Смагулова Г.К.",
    date: "05 мар 2024",
    progress: 100,
    day: "День 7 из ∞",
    status: "Активно" as const,
    active: true,
  },
];

const referrals = [
  {
    name: "Общий анализ крови (ОАК)",
    date: "14 окт 2024",
    doctor: "Нурланов А.С.",
    status: "Назначен" as const,
    variant: "amber" as const,
  },
  {
    name: "Биохимический анализ крови",
    date: "05 мар 2024",
    doctor: "Смагулова Г.К.",
    status: "Готов" as const,
    variant: "green" as const,
  },
];

export default function PrescriptionsPage() {
  const [tab, setTab] = useState("active");

  const filtered = medications.filter((m) => {
    if (tab === "active") return m.active;
    if (tab === "completed") return !m.active;
    return true;
  });

  return (
    <div>
      <h1 className="mb-5 text-[22px] font-extrabold text-foreground">Назначения и рецепты</h1>

      {/* Tabs */}
      <div className="mb-5 flex gap-1 border-b-2 border-border">
        {[
          { key: "active", label: "Активные" },
          { key: "completed", label: "Завершённые" },
          { key: "all", label: "Все" },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-6 py-3 text-body font-medium transition-colors ${
              tab === t.key
                ? "border-b-2 border-primary text-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Medications */}
      <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-2">
        {filtered.map((m) => (
          <div key={m.name} className="rounded-xl border border-border bg-card p-5">
            <div className="mb-3 flex items-start justify-between gap-2">
              <div>
                <div className="text-body font-bold text-foreground">{m.name}</div>
                <Badge variant="gray">{m.category}</Badge>
              </div>
              <Badge variant="green">{m.status}</Badge>
            </div>

            <div className="mb-3 grid grid-cols-[110px_1fr] gap-x-4 gap-y-1.5 text-label">
              <span className="text-muted-foreground">Дозировка:</span>
              <span className="font-medium text-foreground">{m.dosage}</span>
              <span className="text-muted-foreground">Длительность:</span>
              <span className="font-medium text-foreground">{m.duration}</span>
              <span className="text-muted-foreground">Назначил:</span>
              <span className="font-medium text-foreground">{m.doctor} ({m.date})</span>
            </div>

            <div className="mb-1 flex justify-between text-micro">
              <span className="text-muted-foreground">Прогресс курса</span>
              <span className="font-semibold text-foreground">{m.day}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-primary/10">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${m.progress}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Referrals */}
      <h2 className="mb-4 text-h3 font-bold text-foreground">Направления на анализы</h2>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {referrals.map((r) => (
          <div
            key={r.name}
            className="flex items-center justify-between rounded-xl border border-border bg-card p-4"
          >
            <div className="flex items-start gap-3">
              <div className="rounded-lg bg-primary/10 p-2 text-primary">
                <FlaskConical className="h-4 w-4" />
              </div>
              <div>
                <div className="text-body font-semibold text-foreground">{r.name}</div>
                <div className="text-label text-muted-foreground">
                  Назначен: {r.date} · {r.doctor}
                </div>
              </div>
            </div>
            <Badge variant={r.variant}>{r.status}</Badge>
          </div>
        ))}
      </div>
    </div>
  );
}
