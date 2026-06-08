"use client";

import { CalendarCheck, Files, FlaskConical, Shield } from "lucide-react";
import { type Feature, features } from "@/lib/landingData";

const iconMap: Record<string, React.ReactNode> = {
  CalendarCheck: <CalendarCheck className="h-6 w-6" />,
  Files: <Files className="h-6 w-6" />,
  FlaskConical: <FlaskConical className="h-6 w-6" />,
  Shield: <Shield className="h-6 w-6" />,
};

export function FeaturesSection() {
  return (
    <section id="features" className="bg-white py-16 md:py-24">
      <div className="mx-auto max-w-7xl px-4 md:px-8">
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <h2 className="mb-3 text-3xl font-bold text-gray-900 md:text-4xl">Возможности платформы</h2>
          <p className="text-base text-gray-500">Всё необходимое для заботы о вашем здоровье в одном приложении</p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((f: Feature) => (
            <div
              key={f.title}
              className="group rounded-2xl border border-gray-100 bg-white p-6 transition-all duration-300 hover:-translate-y-1 hover:border-cyan-200 hover:shadow-lg"
            >
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-cyan-50 text-cyan-700 transition-colors group-hover:bg-cyan-100">
                {iconMap[f.icon]}
              </div>
              <h3 className="mb-2 text-lg font-bold text-gray-900">{f.title}</h3>
              <p className="text-sm leading-relaxed text-gray-500">{f.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
