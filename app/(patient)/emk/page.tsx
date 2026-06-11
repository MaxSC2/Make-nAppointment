import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { getTranslations } from "next-intl/server";
import EmkLabResults from "@/components/emk/EmkLabResults";

export default async function EmkPatientCardPage() {
  const t = await getTranslations("patient");
  const tc = await getTranslations("common");

  const infoFields = [
    { label: t("emk.basicInfo.fullName"), value: "Асель Мухамеджанова" },
    { label: t("emk.basicInfo.iin"), value: "920512450123" },
    { label: t("emk.basicInfo.dateOfBirth"), value: "12 мая 1992" },
    { label: t("emk.basicInfo.gender"), value: "Женский" },
    { label: t("emk.basicInfo.phone"), value: "+7 701 234 56 78" },
    { label: t("emk.basicInfo.insurance"), value: "010-2024-KZ-4521897" },
  ];

  const tags = [
    { label: t("emk.conditions.noChronic"), variant: "teal" as const },
    { label: t("emk.conditions.allergyPenicillin"), variant: "red" as const },
    { label: t("emk.conditions.allergyPollen"), variant: "amber" as const },
  ];

  const visits = [
    { diagnosis: "ОРВИ", doctor: "Нурланов А.С.", spec: "Терапевт", date: "14 октября 2024", status: tc("status.active"), variant: "blue" as const },
    { diagnosis: "Плановый осмотр", doctor: "Смагулова Г.К.", spec: "Кардиолог", date: "12 июля 2024", status: tc("status.completed"), variant: "green" as const },
    { diagnosis: "Гипертония 1 ст.", doctor: "Смагулова Г.К.", spec: "Кардиолог", date: "05 марта 2024", status: tc("status.completed"), variant: "green" as const },
  ];

  const docs = [
    { name: "Результаты ЭКГ.pdf", size: "1.2 MB", date: "12 июля 2024" },
    { name: "Справка 075/у.pdf", size: "0.8 MB", date: "10 марта 2024" },
  ];

  return (
    <div>
      <h1 className="mb-5 text-h2 font-extrabold text-foreground">{t("emk.title")}</h1>

      {/* Main Info */}
      <section className="mb-4 rounded-xl border border-border bg-card p-5">
        <h2 className="mb-4 text-h3 font-bold text-foreground">{t("emk.basicInfo.title")}</h2>
        <div className="grid grid-cols-1 gap-4 md:gap-5 md:grid-cols-2 lg:grid-cols-3">
          {infoFields.map((f) => (
            <div key={f.label}>
              <div className="mb-1 text-label text-muted-foreground">{f.label}</div>
              <div className="break-words text-body font-medium text-foreground">{f.value}</div>
            </div>
          ))}
          <div className="md:col-span-2 lg:col-span-3">
            <div className="mb-1 text-label text-muted-foreground">{t("emk.basicInfo.address")}</div>
            <div className="break-words text-body font-medium text-foreground">
              г. Петропавловск, ул. Конституции 15, кв. 32
            </div>
          </div>
        </div>
      </section>

      {/* Chronic / Allergies */}
      <section className="mb-4 rounded-xl border border-border bg-card p-5">
        <h2 className="mb-3 text-h3 font-bold text-foreground">{t("emk.conditions.title")}</h2>
        <div className="flex flex-wrap gap-2">
          {tags.map((t) => (
            <Badge key={t.label} variant={t.variant}>{t.label}</Badge>
          ))}
        </div>
      </section>

      {/* Recent Visits */}
      <section className="mb-4 rounded-xl border border-border bg-card p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-h3 font-bold text-foreground">{t("emk.visits.title")}</h2>
          <Link href="/emk/visits" className="text-label font-medium text-primary hover:underline">{t("emk.visits.viewAll")}</Link>
        </div>
          <div className="flex flex-col gap-2">
            {visits.map((v) => (
              <div key={v.diagnosis + v.date} className="flex items-center gap-3 rounded-lg border border-border p-3.5">
                <div className="shrink-0 rounded-lg bg-primary/10 p-2 text-primary">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-body font-semibold text-foreground">{v.diagnosis}</div>
                  <div className="truncate text-label text-muted-foreground">{v.doctor} ({v.spec}) · {v.date}</div>
                </div>
                <Badge variant={v.variant}>{v.status}</Badge>
              </div>
            ))}
        </div>
      </section>

      {/* Lab Results */}
      <div className="mb-4">
        <EmkLabResults />
      </div>

      {/* Documents */}
      <section className="rounded-xl border border-border bg-card p-5">
        <h2 className="mb-4 text-h3 font-bold text-foreground">{t("emk.documents.title")}</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {docs.map((d) => (
            <div key={d.name} className="flex items-center gap-2.5 rounded-lg border border-border p-3">
              <div className="flex min-w-0 items-center gap-2.5">
                <div className="shrink-0 text-primary">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
                </div>
                <div className="min-w-0">
                  <div className="truncate text-label font-medium text-foreground">{d.name}</div>
                  <div className="truncate text-micro text-muted-foreground">{d.date} · {d.size}</div>
                </div>
              </div>
              <button className="ml-auto shrink-0 p-1.5 text-muted-foreground hover:text-foreground">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
