"use client";

import Link from "next/link";
import { Calendar, Users, Clock, FileText, LogOut } from "lucide-react";
import { useQuery } from "@/lib/api/hooks";
import { fetchDoctorDashboardStats } from "@/lib/api";
import { useTranslations } from "next-intl";

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Calendar, Users, Clock, FileText,
};

export default function DoctorDashboardPage() {
  const t = useTranslations("doctor");
  const tc = useTranslations("common");
  const ta = useTranslations("auth");
  const { data: stats, loading } = useQuery(fetchDoctorDashboardStats);

  return (
    <div className="min-h-screen bg-background">
      <header className="flex h-16 items-center justify-between border-b border-border bg-card px-6">
        <div className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-primary" />
          <span className="text-lg font-bold text-foreground">MedPlatform <span className="text-primary">· {ta("roleDoctor")}</span></span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-muted-foreground">Нурланов А.С. · Терапевт</span>
          <Link href="/login" onClick={() => { document.cookie = "auth_token=; path=/; max-age=0"; }} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary">
            <LogOut className="h-4 w-4" /> {ta("logout")}
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-6 py-8">
        <h1 className="mb-8 text-h2 font-bold text-foreground">{t("dashboard.title")}</h1>

        <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-4">
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="animate-pulse rounded-xl border border-border bg-card p-5">
                <div className="mb-3 h-5 w-5 rounded bg-muted" />
                <div className="mb-1 h-8 w-16 rounded bg-muted" />
                <div className="h-4 w-24 rounded bg-muted" />
              </div>
            ))
          ) : stats?.map((s) => {
            const Icon = iconMap[s.icon];
            return (
              <div key={s.label} className="rounded-xl border border-border bg-card p-5">
                {Icon && <Icon className="mb-3 h-5 w-5 text-primary" />}
                <div className="text-h2 font-bold text-foreground">{s.value}</div>
                <div className="text-label text-muted-foreground">{s.label}</div>
              </div>
            );
          })}
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          <Link href="/doctor/schedule" className="rounded-xl border border-border bg-card p-6 transition-all hover:border-primary/30 hover:shadow-md">
            <Calendar className="mb-3 h-6 w-6 text-primary" />
            <h3 className="mb-1 text-h3 font-bold text-foreground">{t("schedule")}</h3>
            <p className="text-body text-muted-foreground">Управление графиком приёма</p>
          </Link>
          <Link href="/doctor/patients" className="rounded-xl border border-border bg-card p-6 transition-all hover:border-primary/30 hover:shadow-md">
            <Users className="mb-3 h-6 w-6 text-primary" />
            <h3 className="mb-1 text-h3 font-bold text-foreground">{t("patients")}</h3>
            <p className="text-body text-muted-foreground">Список и карточки пациентов</p>
          </Link>
          <Link href="/doctor/appointments" className="rounded-xl border border-border bg-card p-6 transition-all hover:border-primary/30 hover:shadow-md">
            <Clock className="mb-3 h-6 w-6 text-primary" />
            <h3 className="mb-1 text-h3 font-bold text-foreground">{t("appointments")}</h3>
            <p className="text-body text-muted-foreground">Все записи и ожидания</p>
          </Link>
        </div>
      </div>
    </div>
  );
}
