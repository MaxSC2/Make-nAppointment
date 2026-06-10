"use client";

import Link from "next/link";
import { ArrowLeft, Search } from "lucide-react";
import { useQuery } from "@/lib/api/hooks";
import { fetchAdminAuditLogs } from "@/lib/api";
import { useTranslations } from "next-intl";

export default function AdminAuditPage() {
  const t = useTranslations("admin");
  const tc = useTranslations("common");
  const { data: logs, loading } = useQuery(fetchAdminAuditLogs);

  return (
    <div className="min-h-screen bg-background">
      <header className="flex h-16 items-center border-b border-border bg-card px-6">
        <Link href="/admin/dashboard" className="mr-4 text-muted-foreground hover:text-primary">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <span className="text-lg font-bold text-foreground">{t("audit")}</span>
      </header>

      <div className="mx-auto max-w-5xl px-6 py-8">
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input className="w-full rounded-lg border border-border bg-card py-2.5 pl-10 pr-4 text-body text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none" placeholder="Поиск по действию или пользователю..." />
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
              <div className="col-span-3">Действие</div>
              <div className="col-span-3">Пользователь</div>
              <div className="col-span-3">Время</div>
              <div className="col-span-3">Детали</div>
            </div>
            {logs?.map((l, i) => (
              <div key={i} className="grid grid-cols-12 gap-4 border-b border-border px-5 py-4 last:border-b-0 transition-colors hover:bg-muted/20">
                <div className="col-span-3 text-body font-medium text-foreground">{l.action}</div>
                <div className="col-span-3 text-body text-muted-foreground">{l.user}</div>
                <div className="col-span-3 text-body text-muted-foreground">{l.time}</div>
                <div className="col-span-3 text-body text-muted-foreground">{l.details}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
