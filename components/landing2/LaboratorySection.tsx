"use client";

import { FlaskConical } from "lucide-react";
import { type LabTest, labTests } from "@/lib/landingData";

const statusStyles: Record<LabTest["status"], string> = {
  "Назначен": "bg-yellow-100 text-yellow-700",
  "В процессе": "bg-blue-100 text-blue-700",
  "Готов": "bg-green-100 text-green-700",
};

export function LaboratorySection() {
  return (
    <section className="bg-white py-16 md:py-24">
      <div className="mx-auto max-w-7xl px-4 md:px-8">
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <h2 className="mb-3 text-3xl font-bold text-gray-900 md:text-4xl">Лабораторные исследования</h2>
          <p className="text-base text-gray-500">Результаты анализов онлайн — сразу после готовности</p>
        </div>

        <div className="mx-auto max-w-3xl">
          <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
            <div className="grid grid-cols-12 gap-4 border-b border-gray-100 bg-gray-50 px-6 py-3 text-xs font-semibold uppercase tracking-wider text-gray-400">
              <div className="col-span-6">Название анализа</div>
              <div className="col-span-3">Статус</div>
              <div className="col-span-3 text-right">Дата</div>
            </div>

            {labTests.map((t, i) => (
              <div key={i} className="grid grid-cols-12 gap-4 border-b border-gray-50 px-6 py-4 last:border-b-0 transition-colors hover:bg-gray-50/50">
                <div className="col-span-6 flex items-center gap-3">
                  <FlaskConical className="h-4 w-4 shrink-0 text-cyan-600" />
                  <span className="text-sm font-medium text-gray-900">{t.name}</span>
                </div>
                <div className="col-span-3 flex items-center">
                  <span className={`inline-block rounded-full px-3 py-1 text-xs font-medium ${statusStyles[t.status]}`}>
                    {t.status}
                  </span>
                </div>
                <div className="col-span-3 flex items-center justify-end text-sm text-gray-400">
                  {t.date}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
