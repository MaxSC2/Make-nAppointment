"use client";

import Link from "next/link";
import { ArrowLeft, Search } from "lucide-react";
import { useQuery } from "@/lib/api/hooks";
import { fetchDoctorPatients } from "@/lib/api";
import { useTranslations } from "next-intl";

export default function DoctorPatientsPage() {
  const t = useTranslations("doctor");
  const { data: patients, loading } = useQuery(fetchDoctorPatients);

  return (
    <div className="min-h-screen bg-background">
      <header className="flex h-16 items-center border-b border-border bg-card px-6">
        <Link href="/doctor/dashboard" className="mr-4 text-muted-foreground hover:text-primary">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <span className="text-lg font-bold text-foreground">{t("patients")}</span>
      </header>
      <div className="mx-auto max-w-4xl px-6 py-8">
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input className="w-full rounded-lg border border-border bg-card py-2.5 pl-10 pr-4 text-body text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none" placeholder="Поиск по имени или ИИН..." />
        </div>

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-14 animate-pulse rounded-xl border border-border bg-card" />
            ))}
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-border">
            <div className="grid grid-cols-12 gap-4 border-b border-border bg-muted/30 px-5 py-3 text-label font-semibold text-muted-foreground">
              <div className="col-span-4">Пациент</div>
              <div className="col-span-3">ИИН</div>
              <div className="col-span-2">Возраст</div>
              <div className="col-span-3">Последний визит</div>
            </div>
            {patients?.map((p) => (
              <div key={p.iin} className="grid grid-cols-12 gap-4 border-b border-border px-5 py-4 last:border-b-0 transition-colors hover:bg-muted/20">
                <div className="col-span-4 text-body font-medium text-foreground">{p.name}</div>
                <div className="col-span-3 text-body text-muted-foreground">{p.iin}</div>
                <div className="col-span-2 text-body text-muted-foreground">{p.age}</div>
                <div className="col-span-3 text-body text-muted-foreground">{p.lastVisit}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
