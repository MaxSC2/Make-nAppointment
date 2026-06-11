"use client";

import Link from "next/link";
import { FlaskConical, LogOut, ArrowRight, CheckCircle } from "lucide-react";
import { useQuery } from "@/lib/api/hooks";
import { fetchLabQueue, updateLabTestStatus, submitLabResult } from "@/lib/api";
import { useState } from "react";
import type { LabTest } from "@/types/laboratory";
import { useTranslations } from "next-intl";

const statusColor: Record<string, string> = {
  "Назначен": "text-amber-600 bg-amber-50",
  "Взят": "text-blue-600 bg-blue-50",
  "Готов": "text-green-600 bg-green-50",
};

function ResultModal({ test, onClose, onSubmit }: { test: LabTest; onClose: () => void; onSubmit: (id: string, value: number | string, unit: string, min: number, max: number) => Promise<void> }) {
  const t = useTranslations("patient");
  const tc = useTranslations("common");
  const [value, setValue] = useState("");
  const [unit, setUnit] = useState("");
  const [min, setMin] = useState("");
  const [max, setMax] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const numValue = parseFloat(value);
    await onSubmit(
      test.id,
      isNaN(numValue) ? value : numValue,
      unit,
      parseFloat(min) || 0,
      parseFloat(max) || 0,
    );
    setSaving(false);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-xl">
        <h2 className="mb-1 text-h3 font-bold text-foreground">{t("laboratory.result")}</h2>
        <p className="mb-5 text-body text-muted-foreground">{test.name}</p>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-label font-medium text-muted-foreground">Значение</label>
            <input value={value} onChange={(e) => setValue(e.target.value)} required className="w-full rounded-lg border border-border bg-background px-3.5 py-2 text-body text-foreground focus:border-primary focus:outline-none" placeholder="например 5.2" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-label font-medium text-muted-foreground">Единица измерения</label>
            <input value={unit} onChange={(e) => setUnit(e.target.value)} className="w-full rounded-lg border border-border bg-background px-3.5 py-2 text-body text-foreground focus:border-primary focus:outline-none" placeholder="например ммоль/л" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-label font-medium text-muted-foreground">Референс (мин)</label>
              <input value={min} onChange={(e) => setMin(e.target.value)} className="w-full rounded-lg border border-border bg-background px-3.5 py-2 text-body text-foreground focus:border-primary focus:outline-none" placeholder="0" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-label font-medium text-muted-foreground">Референс (макс)</label>
              <input value={max} onChange={(e) => setMax(e.target.value)} className="w-full rounded-lg border border-border bg-background px-3.5 py-2 text-body text-foreground focus:border-primary focus:outline-none" placeholder="10" />
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 rounded-lg border border-border bg-background py-2.5 text-body font-medium text-muted-foreground transition-colors hover:text-foreground">{tc("cancel")}</button>
            <button type="submit" disabled={saving} className="flex-1 rounded-lg bg-primary py-2.5 text-body font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60">
              {saving ? "Сохранение…" : tc("save")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function LabQueuePage() {
  const t = useTranslations("patient");
  const tc = useTranslations("common");
  const ta = useTranslations("auth");
  const { data: queue, loading, error, refetch } = useQuery(fetchLabQueue);
  const [resultModalTest, setResultModalTest] = useState<LabTest | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function handleTakeTest(id: string) {
    try {
      await updateLabTestStatus(id, "Взят");
      setMessage("Статус изменён на «Взят»");
      refetch();
    } catch {
      setMessage("Ошибка при обновлении статуса");
    }
  }

  async function handleSubmitResult(id: string, value: number | string, unit: string, min: number, max: number) {
    try {
      await submitLabResult(id, { value, unit, referenceRange: { min, max } });
      setMessage("Результат сохранён, статус — «Готов»");
      refetch();
    } catch {
      setMessage("Ошибка при сохранении результата");
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="flex h-16 items-center justify-between border-b border-border bg-card px-6">
        <div className="flex items-center gap-2">
          <FlaskConical className="h-5 w-5 text-primary" />
          <span className="text-lg font-bold text-foreground">MedPlatform <span className="text-primary">· {t("laboratory.title")}</span></span>
        </div>
        <Link href="/login" onClick={() => { document.cookie = "auth_token=; path=/; max-age=0"; }} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary">
          <LogOut className="h-4 w-4" /> {ta("logout")}
        </Link>
      </header>

      <div className="mx-auto max-w-4xl px-6 py-8">
        <h1 className="mb-6 text-h2 font-bold text-foreground">Очередь анализов</h1>

        {message && (
          <div className="mb-4 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-label font-medium text-primary">
            {message}
            <button onClick={() => setMessage(null)} className="ml-3 underline">×</button>
          </div>
        )}

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-20 animate-pulse rounded-xl border border-border bg-card" />
            ))}
          </div>
        ) : error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-8 text-center text-body text-red-700">
            {error}
          </div>
        ) : !queue?.length ? (
          <div className="rounded-xl border border-border bg-card px-5 py-12 text-center">
            <FlaskConical className="mx-auto mb-3 h-8 w-8 text-muted-foreground/40" />
            <p className="text-body text-muted-foreground">Нет назначенных анализов</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {queue.map((test) => (
              <div key={test.id} className="flex items-center gap-4 rounded-xl border border-border bg-card p-5 transition-colors hover:border-primary/20">
                <div className="shrink-0 rounded-lg bg-primary/10 p-2.5 text-primary">
                  <FlaskConical className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-body font-bold text-foreground">{test.name}</div>
                  <div className="text-label text-muted-foreground">
                    {test.doctorName} · {test.dateOrdered} · {test.category}
                  </div>
                </div>
                <span className={`shrink-0 rounded-full px-3 py-1 text-label font-medium ${statusColor[test.status] || "bg-gray-50 text-gray-600"}`}>
                  {test.status}
                </span>
                {test.status === "Назначен" && (
                  <button onClick={() => handleTakeTest(test.id)} className="shrink-0 flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-label font-semibold text-white transition-opacity hover:opacity-90">
                    <ArrowRight className="h-3.5 w-3.5" /> Взять
                  </button>
                )}
                {test.status === "Взят" && (
                  <button onClick={() => setResultModalTest(test)} className="shrink-0 flex items-center gap-1.5 rounded-lg border border-primary bg-primary/5 px-3.5 py-2 text-label font-semibold text-primary transition-colors hover:bg-primary/10">
                    <CheckCircle className="h-3.5 w-3.5" /> Результат
                  </button>
                )}
                {test.status === "Готов" && (
                  <span className="flex items-center gap-1.5 text-label text-green-600">
                    <CheckCircle className="h-3.5 w-3.5" /> Готов
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {resultModalTest && (
        <ResultModal
          test={resultModalTest}
          onClose={() => setResultModalTest(null)}
          onSubmit={handleSubmitResult}
        />
      )}
    </div>
  );
}
