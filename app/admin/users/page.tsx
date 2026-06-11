"use client";

import Link from "next/link";
import { ArrowLeft, Search, Shield, User, Stethoscope } from "lucide-react";
import { useQuery } from "@/lib/api/hooks";
import { fetchAdminUsers } from "@/lib/api";
import type { AdminUser } from "@/lib/mockData";
import { useTranslations } from "next-intl";

const roleIcon: Record<AdminUser["role"], typeof Shield> = { Пациент: User, Врач: Stethoscope, Админ: Shield };
const roleColor: Record<AdminUser["role"], string> = {
  Пациент: "bg-blue-50 text-blue-600",
  Врач: "bg-green-50 text-green-600",
  Админ: "bg-amber-50 text-amber-600",
};

export default function AdminUsersPage() {
  const t = useTranslations("admin");
  const tc = useTranslations("common");
  const ta = useTranslations("auth");
  const roleLabel: Record<string, string> = {
    Пациент: ta("rolePatient"),
    Врач: ta("roleDoctor"),
    Админ: ta("roleAdmin"),
  };
  const { data: users, loading } = useQuery(fetchAdminUsers);

  return (
    <div className="min-h-screen bg-background">
      <header className="flex h-16 items-center border-b border-border bg-card px-6">
        <Link href="/admin/dashboard" className="mr-4 text-muted-foreground hover:text-primary">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <span className="text-lg font-bold text-foreground">{t("users")}</span>
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
              <div className="col-span-5">Имя</div>
              <div className="col-span-4">ИИН</div>
              <div className="col-span-3">Роль</div>
            </div>
            {users?.map((u) => {
              const Icon = roleIcon[u.role];
              return (
                <div key={u.iin} className="grid grid-cols-12 gap-4 border-b border-border px-5 py-4 last:border-b-0 transition-colors hover:bg-muted/20">
                  <div className="col-span-5 text-body font-medium text-foreground">{u.name}</div>
                  <div className="col-span-4 text-body text-muted-foreground">{u.iin}</div>
                  <div className="col-span-3">
                    <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-label font-medium ${roleColor[u.role]}`}>
                      <Icon className="h-3 w-3" /> {roleLabel[u.role] || u.role}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
