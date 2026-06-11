"use client";

import { Calendar, Pill } from "lucide-react";
import { useTranslations } from "next-intl";
import { patientData } from "@/lib/landingData";

export function EhrSection() {
  const t = useTranslations("landing");
  const { name, age, id, bloodType, visits, prescriptions } = patientData;

  return (
    <section id="ehr" className="bg-gray-50 py-16 md:py-24">
      <div className="mx-auto max-w-7xl px-4 md:px-8">
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <h2 className="mb-3 text-3xl font-bold text-gray-900 md:text-4xl">{t("ehr.title")}</h2>
          <p className="text-base text-gray-500">{t("ehr.subtitle")}</p>
        </div>

        <div className="grid gap-8 lg:grid-cols-3">
          <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm lg:col-span-1">
            <div className="mb-5 flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-cyan-100 text-lg font-bold text-cyan-700">
                {name.split(" ").map((n) => n[0]).join("")}
              </div>
              <div>
                <div className="text-lg font-bold text-gray-900">{name}</div>
                <div className="text-sm text-gray-400">{age} года · {id}</div>
              </div>
            </div>

            <div className="rounded-xl bg-gray-50 p-4">
              <div className="text-xs text-gray-400 mb-1">{t("ehr.bloodType")}</div>
              <div className="text-sm font-semibold text-gray-900">{bloodType}</div>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm lg:col-span-2">
            <div className="mb-4 flex items-center gap-2">
              <Calendar className="h-5 w-5 text-cyan-600" />
              <h3 className="text-lg font-bold text-gray-900">{t("ehr.visitHistory")}</h3>
            </div>

            <div className="space-y-3">
              {visits.map((v, i) => (
                <div key={i} className="flex items-start gap-3 rounded-xl border border-gray-50 bg-gray-50/50 p-4 transition-colors hover:bg-gray-100">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-cyan-50 text-xs font-bold text-cyan-700">
                    {v.doctor.replace(/[^a-zA-Zа-яА-Я]/g, "").charAt(0) || "В"}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-gray-900">{v.doctor}</div>
                    <div className="text-xs text-gray-500">{v.diagnosis}</div>
                  </div>
                  <span className="shrink-0 text-xs text-gray-400">{v.date}</span>
                </div>
              ))}
            </div>

            <div className="mt-6">
              <div className="mb-3 flex items-center gap-2">
                <Pill className="h-5 w-5 text-cyan-600" />
                <h3 className="text-lg font-bold text-gray-900">{t("ehr.prescriptions")}</h3>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {prescriptions.map((p, i) => (
                  <div key={i} className="rounded-xl border border-gray-50 bg-gray-50/50 p-4">
                    <div className="mb-1 text-sm font-semibold text-gray-900">{p.medication}</div>
                    <div className="text-xs text-gray-500">{p.dosage} · {p.period}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
