"use client";

import Image from "next/image";
import Link from "next/link";
import { Calendar, FlaskConical, FileText, Pill, ChevronRight } from "lucide-react";
import { Header, MobileHeader } from "@/components/layout/Header";
import { MobileNav } from "@/components/layout/MobileNav";
import { Badge } from "@/components/ui/Badge";
import { useTranslations } from "next-intl";

const upcomingAppts = [
  {
    id: 1,
    name: "Нурланов А.С.",
    spec: "Терапевт",
    date: "16 окт 2024, 10:00",
    status: "confirmed" as const,
    img: "https://images.unsplash.com/photo-1612349317150-e410f624c427?auto=format&fit=crop&w=80&q=80",
  },
  {
    id: 2,
    name: "Смагулова Г.К.",
    spec: "Кардиолог",
    date: "28 окт 2024, 14:30",
    status: "pending" as const,
    img: "https://images.unsplash.com/photo-1594824436998-f2b38fb9a896?auto=format&fit=crop&w=80&q=80",
  },
];

const labResults = [
  { name: "Общий анализ крови", date: "14 окт 2024", status: "Готов" as const },
  { name: "Биохимия крови", date: "05 мар 2024", status: "Готов" as const },
  { name: "Гормоны щитовидной", date: "10 окт 2024", status: "Готов" as const },
];

export default function DashboardPage() {
  const t = useTranslations("patient");
  const tc = useTranslations("common");
  const quickActions = [
    { icon: Calendar, label: t("dashboard.bookAppointment"), desc: "16 окт, 10:00", href: "/appointment", color: "text-primary" },
    { icon: FlaskConical, label: t("laboratory.title"), desc: "Анализ готов", href: "/laboratory", color: "text-green-600" },
    { icon: FileText, label: t("dashboard.myCard"), desc: "Обновлено 14 окт", href: "/emk", color: "text-blue-600" },
    { icon: Pill, label: t("dashboard.prescriptions"), desc: "3 активных", href: "/emk/prescriptions", color: "text-amber-600" },
  ];
  return (
    <div className="min-h-screen bg-background pb-20 pt-14 md:pb-0 md:pt-0">
      <Header />
      <MobileHeader />

      <div className="mx-auto max-w-[1280px] px-4 py-8 md:px-6">
        {/* Hero Banner */}
        <div className="relative mb-6 overflow-hidden rounded-2xl bg-primary px-6 py-9 text-white md:px-10 md:py-9">
          <div className="mb-2 text-h2 font-extrabold">
            {t("dashboard.greeting", {name: "Асель"})}
          </div>
          <p className="mb-6 text-body text-white/85">
            {t("dashboard.reminder")}
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/appointment"
              className="inline-flex items-center gap-1.5 rounded-lg bg-white px-5 py-2.5 text-body font-semibold text-primary transition-opacity hover:opacity-90"
            >
              <Calendar className="h-4 w-4" />
              {t("dashboard.bookAppointment")}
            </Link>
            <Link
              href="/emk"
              className="inline-flex items-center rounded-lg border border-white/30 bg-white/15 px-5 py-2.5 text-body font-medium text-white transition-colors hover:bg-white/25"
            >
              {t("dashboard.myCard")}
            </Link>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
          {quickActions.map((action) => (
            <Link
              key={action.label}
              href={action.href}
              className="rounded-xl border border-border bg-card p-4 transition-shadow hover:shadow-md"
            >
              <action.icon className={`mb-2.5 h-[22px] w-[22px] ${action.color}`} />
              <div className="mb-1 text-body font-semibold text-foreground">{action.label}</div>
              <div className={`text-label font-medium ${action.color}`}>{action.desc}</div>
            </Link>
          ))}
        </div>

        {/* Two-column section */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Upcoming Appointments */}
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="mb-4 flex items-center justify-between">
              <div className="text-h3 font-bold text-foreground">{t("dashboard.upcomingAppointments")}</div>
              <Link href="/appointment" className="text-label font-medium text-primary hover:underline">
                {t("dashboard.allAppointments")}
              </Link>
            </div>
            <div className="flex flex-col gap-4">
              {upcomingAppts.map((appt) => (
                <div key={appt.id} className="flex gap-3">
                  <div className="h-11 w-11 shrink-0 overflow-hidden rounded-full">
                    <Image src={appt.img} alt="" width={44} height={44} className="h-full w-full object-cover" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-body font-semibold text-foreground">{appt.name}</div>
                    <div className="mb-2 text-label text-muted-foreground">
                      {appt.spec} · {appt.date}
                    </div>
                    <Badge variant={appt.status === "confirmed" ? "green" : "amber"}>
                      {appt.status === "confirmed" ? tc("status.confirmed") : tc("status.pending")}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Lab Results */}
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="mb-4 flex items-center justify-between">
              <div className="text-h3 font-bold text-foreground">{t("dashboard.labResults")}</div>
              <Link href="/laboratory" className="text-label font-medium text-primary hover:underline">
                {tc("all")}
              </Link>
            </div>
            <div className="flex flex-col gap-3">
              {labResults.map((result) => (
                <div key={result.name} className="flex items-center gap-3">
                  <div className="rounded-lg bg-primary/10 p-2 text-primary">
                    <FlaskConical className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-body font-medium text-foreground">{result.name}</div>
                    <div className="text-label text-muted-foreground">{result.date}</div>
                  </div>
                  <Badge variant="green">{result.status}</Badge>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <MobileNav />
    </div>
  );
}
