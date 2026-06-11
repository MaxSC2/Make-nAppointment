"use client";

import { FlaskConical, AlertTriangle, CheckCircle } from "lucide-react";
import { useQueryArg } from "@/lib/api/hooks";
import { fetchPatientLabResults } from "@/lib/api";
import { useMemo } from "react";

function isOutOfRange(value: number | string, min: number, max: number): boolean {
  if (typeof value !== "number") return false;
  return value < min || value > max;
}

const DEMO_PATIENT_ID = "patient-1";

export default function EmkLabResults() {
  const { data: tests, loading, error } = useQueryArg(fetchPatientLabResults, DEMO_PATIENT_ID);

  const readyTests = useMemo(
    () => (tests ?? []).filter((t) => t.result),
    [tests],
  );

  if (loading) {
    return (
      <section className="rounded-xl border border-border bg-card p-5">
        <h2 className="mb-4 text-h3 font-bold text-foreground">Результаты анализов</h2>
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-10 animate-pulse rounded-lg bg-border/60" />
          ))}
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="rounded-xl border border-border bg-card p-5">
        <h2 className="mb-4 text-h3 font-bold text-foreground">Результаты анализов</h2>
        <p className="text-body text-red-500">{error}</p>
      </section>
    );
  }

  if (!readyTests.length) {
    return (
      <section className="rounded-xl border border-border bg-card p-5">
        <h2 className="mb-4 text-h3 font-bold text-foreground">Результаты анализов</h2>
        <div className="flex flex-col items-center gap-2 py-6">
          <FlaskConical className="h-6 w-6 text-muted-foreground/40" />
          <p className="text-body text-muted-foreground">Нет готовых результатов</p>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <h2 className="mb-4 text-h3 font-bold text-foreground">Результаты анализов</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-body">
          <thead>
            <tr className="border-b border-border text-label text-muted-foreground">
              <th className="pb-2 pr-3 font-medium">Название</th>
              <th className="pb-2 pr-3 font-medium">Значение</th>
              <th className="pb-2 pr-3 font-medium">Референс</th>
              <th className="pb-2 pr-3 font-medium">Врач</th>
              <th className="pb-2 font-medium">Дата</th>
            </tr>
          </thead>
          <tbody>
            {readyTests.map((test) => {
              const r = test.result!;
              const abnormal = isOutOfRange(r.value, r.referenceRange.min, r.referenceRange.max);

              return (
                <tr
                  key={test.id}
                  className={`border-b border-border last:border-0 ${abnormal ? "bg-red-50 text-red-700" : ""}`}
                >
                  <td className="py-2.5 pr-3 font-medium text-foreground">
                    <div className="flex items-center gap-1.5">
                      {abnormal && <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-red-500" />}
                      {!abnormal && typeof r.value === "number" && <CheckCircle className="h-3.5 w-3.5 shrink-0 text-green-500" />}
                      {test.name}
                    </div>
                  </td>
                  <td className={`py-2.5 pr-3 font-semibold ${abnormal ? "text-red-700" : "text-foreground"}`}>
                    {r.value}{r.unit ? ` ${r.unit}` : ""}
                  </td>
                  <td className="py-2.5 pr-3 text-muted-foreground">
                    {r.referenceRange.min}–{r.referenceRange.max}
                  </td>
                  <td className="py-2.5 pr-3 text-muted-foreground">{test.doctorName}</td>
                  <td className="py-2.5 text-muted-foreground">{test.dateReady}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
