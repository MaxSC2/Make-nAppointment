"use client";

import { useState, useMemo } from "react";
import {
  Search,
  FlaskConical,
  FileText,
  ChevronRight,
  Download,
  Eye,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import { Header, MobileHeader } from "@/components/layout/Header";
import { MobileNav } from "@/components/layout/MobileNav";
import { Badge } from "@/components/ui/Badge";
import { useQuery } from "@/lib/api/hooks";
import { fetchLabTests, fetchLabReferrals } from "@/lib/api";

const DEMO_PATIENT_ID = "patient-1";

const statusLabels: Record<string, { label: string; variant: "green" | "amber" | "blue" }> = {
  Готов: { label: "Готов", variant: "green" },
  Взят: { label: "Взят", variant: "amber" },
  Назначен: { label: "Назначен", variant: "blue" },
};

const tabs = [
  { key: "all", label: "Все анализы" },
  { key: "referrals", label: "Направления" },
];

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-border/60 ${className ?? ""}`} />;
}

export default function LaboratoryPage() {
  const [activeTab, setActiveTab] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const testsQuery = useQuery(fetchLabTests, []);
  const referralsQuery = useQuery(fetchLabReferrals, []);

  const filteredTests = useMemo(
    () =>
      (testsQuery.data ?? []).filter(
        (t) =>
          t.patientId === DEMO_PATIENT_ID &&
          t.name.toLowerCase().includes(searchQuery.toLowerCase())
      ),
    [testsQuery.data, searchQuery]
  );

  const filteredReferrals = useMemo(
    () =>
      (referralsQuery.data ?? []).filter((r) =>
        r.testName.toLowerCase().includes(searchQuery.toLowerCase())
      ),
    [referralsQuery.data, searchQuery]
  );

  function ErrorBlock({ message, onRetry }: { message: string; onRetry: () => void }) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <AlertCircle className="h-8 w-8 text-red-400" />
        <div className="text-body font-medium text-foreground">{message}</div>
        <button
          onClick={onRetry}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-4 py-2 text-label font-medium text-foreground transition-colors hover:border-primary hover:text-primary"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Повторить
        </button>
      </div>
    );
  }

  function TestSkeleton() {
    return (
      <div className="rounded-xl border border-border bg-card p-4 md:p-5">
        <div className="flex items-start gap-3 md:gap-4">
          <Skeleton className="h-8 w-8 md:h-10 md:w-10" />
          <div className="min-w-0 flex-1">
            <Skeleton className="mb-2 h-4 w-48" />
            <Skeleton className="mb-2 h-3 w-64" />
            <Skeleton className="h-3 w-36" />
          </div>
          <Skeleton className="h-6 w-20 shrink-0" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pt-14 md:pt-0">
      <Header />
      <MobileHeader />

      <main className="mx-auto max-w-[1280px] px-4 pb-20 pt-7 md:px-6 md:pb-12">
        <div className="mb-6">
          <h1 className="text-h2 font-extrabold text-foreground">Лаборатория</h1>
          <p className="mt-0.5 text-body text-muted-foreground">
            Результаты анализов и направления
          </p>
        </div>

        {/* Tabs */}
        <div className="mb-6 flex w-fit gap-1 rounded-xl border border-border bg-card p-1">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`rounded-lg px-5 py-2 text-body font-medium transition-all ${
                activeTab === tab.key
                  ? "bg-primary font-semibold text-white"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative mb-6 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Поиск по названию анализа..."
            className="w-full rounded-lg border border-border bg-card py-2.5 pl-9 pr-3 text-body text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
          />
        </div>

        {/* ===== ALL TESTS ===== */}
        {activeTab === "all" && (
          <div className="flex flex-col gap-3">
            {testsQuery.loading ? (
              <>
                <TestSkeleton />
                <TestSkeleton />
                <TestSkeleton />
              </>
            ) : testsQuery.error ? (
              <ErrorBlock message={testsQuery.error} onRetry={testsQuery.refetch} />
            ) : filteredTests.length > 0 ? (
              filteredTests.map((test) => {
                const statusInfo = statusLabels[test.status];
                return (
                  <div
                    key={test.id}
                    className="rounded-xl border border-border bg-card p-4 md:p-5 transition-shadow hover:shadow-sm"
                  >
                    <div className="flex flex-wrap items-start gap-3 md:gap-4">
                      <div className="rounded-lg bg-primary/10 p-2 md:p-2.5 text-primary">
                        <FlaskConical className="h-4 w-4 md:h-5 md:w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="mb-0.5 text-body font-bold text-foreground">
                          {test.name}
                        </div>
                        <div className="mb-1 md:mb-2 text-label text-muted-foreground">
                          {test.category} · Назначил: {test.doctorName}
                        </div>
                        <div className="flex flex-wrap items-center gap-2 md:gap-3 text-label">
                          <span className="text-muted-foreground">
                            Заказан: {test.dateOrdered}
                          </span>
                          {test.dateReady && (
                            <span className="text-muted-foreground">
                              Готов: {test.dateReady}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <Badge variant={statusInfo.variant}>
                          {statusInfo.label}
                        </Badge>
                        {test.hasFile && (
                          <>
                            <button
                              onClick={() => alert("Функция в разработке")}
                              className="rounded-lg border border-border p-1.5 md:p-2 text-muted-foreground transition-colors hover:border-primary hover:text-primary"
                            >
                              <Eye className="h-3.5 w-3.5 md:h-4 md:w-4" />
                            </button>
                            <button
                              onClick={() => alert("Функция в разработке")}
                              className="rounded-lg border border-border p-1.5 md:p-2 text-muted-foreground transition-colors hover:border-primary hover:text-primary"
                            >
                              <Download className="h-3.5 w-3.5 md:h-4 md:w-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                    {test.resultSummary && (
                      <div className="mt-2 md:mt-3 rounded-lg bg-background px-3.5 py-2 text-label text-foreground">
                        {test.resultSummary}
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="py-16 text-center">
                <FlaskConical className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
                <div className="text-h3 font-semibold text-foreground">
                  Анализы не найдены
                </div>
                <p className="mt-1 text-body text-muted-foreground">
                  Попробуйте изменить поисковый запрос
                </p>
              </div>
            )}
          </div>
        )}

        {/* ===== REFERRALS ===== */}
        {activeTab === "referrals" && (
          <div className="flex flex-col gap-3">
            {referralsQuery.loading ? (
              <>
                <TestSkeleton />
                <TestSkeleton />
              </>
            ) : referralsQuery.error ? (
              <ErrorBlock message={referralsQuery.error} onRetry={referralsQuery.refetch} />
            ) : filteredReferrals.length > 0 ? (
              filteredReferrals.map((ref) => (
                <div
                  key={ref.id}
                  className="rounded-xl border border-border bg-card p-4 md:p-5 transition-shadow hover:shadow-sm"
                >
                  <div className="flex flex-wrap items-start gap-3 md:gap-4">
                    <div className="rounded-lg bg-amber-50 p-2 md:p-2.5 text-amber-700">
                      <FileText className="h-4 w-4 md:h-5 md:w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="mb-0.5 text-body font-bold text-foreground">
                        {ref.testName}
                      </div>
                      <div className="mb-1 md:mb-2 text-label text-muted-foreground">
                        Назначил: {ref.doctorName} · {ref.clinic}
                      </div>
                      <span className="text-label text-muted-foreground">
                        {ref.date}
                      </span>
                    </div>
                    <Badge variant={ref.used ? "green" : "amber"}>
                      {ref.used ? "Использовано" : "Ожидает сдачи"}
                    </Badge>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-16 text-center">
                <FileText className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
                <div className="text-h3 font-semibold text-foreground">
                  Направлений нет
                </div>
                <p className="mt-1 text-body text-muted-foreground">
                  Врач ещё не назначил анализы
                </p>
              </div>
            )}
          </div>
        )}
      </main>

      <MobileNav />
    </div>
  );
}
