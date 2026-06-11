"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";

export function Hero() {
  const t = useTranslations("landing");
  return (
    <section id="hero" className="relative overflow-hidden bg-gradient-to-br from-cyan-50 via-white to-blue-50 pt-28 pb-16 md:pt-36 md:pb-24">
      <div className="mx-auto max-w-7xl px-4 md:px-8">
        <div className="grid items-center gap-12 md:grid-cols-2">
          <div className="max-w-xl">
            <div className="mb-4 inline-block rounded-full bg-cyan-100 px-4 py-1.5 text-xs font-semibold text-cyan-700">
              {t("hero.badge")}
            </div>
            <h1 className="mb-4 text-4xl font-extrabold tracking-tight text-gray-900 md:text-5xl">
              {t("hero.title")}
            </h1>
            <p className="mb-8 text-base leading-relaxed text-gray-500 md:text-lg">
              {t("hero.subtitle")}
            </p>
            <div className="flex flex-wrap gap-4">
              <Link href="/register" className="rounded-lg bg-cyan-700 px-6 py-3 text-sm font-semibold text-white shadow-md transition-all hover:bg-cyan-800 hover:shadow-lg">
                {t("hero.ctaBook")}
              </Link>
              <a href="#features" className="rounded-lg border border-gray-200 bg-white px-6 py-3 text-sm font-semibold text-gray-700 transition-all hover:border-cyan-200 hover:text-cyan-700 hover:shadow-md">
                {t("hero.ctaLearnMore")}
              </a>
            </div>
          </div>

          <div className="relative hidden md:block">
            <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-xl">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-cyan-100 text-sm font-bold text-cyan-700">
                  АМ
                </div>
                <div>
                  <div className="text-sm font-semibold text-gray-900">Асель Мухамеджанова</div>
                  <div className="text-xs text-gray-400">ИИН 920512450123</div>
                </div>
                <div className="ml-auto">
                  <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700">
                    {t("hero.online")}
                  </span>
                </div>
              </div>

              <div className="mb-4 grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-gray-50 bg-gray-50/50 p-3">
                  <div className="text-xs text-gray-400">{t("hero.statsAppointments")}</div>
                  <div className="text-lg font-bold text-gray-900">3</div>
                </div>
                <div className="rounded-xl border border-gray-50 bg-gray-50/50 p-3">
                  <div className="text-xs text-gray-400">{t("hero.statsLabTests")}</div>
                  <div className="text-lg font-bold text-gray-900">2</div>
                </div>
              </div>

              <div className="rounded-xl border border-gray-100 bg-gray-50/30 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-semibold text-gray-700">{t("hero.nextAppointment")}</span>
                  <span className="text-xs text-cyan-600 font-medium">{t("hero.nextAppointmentDate")}</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-cyan-100 flex items-center justify-center text-xs font-bold text-cyan-700">
                    Н
                  </div>
                  <div>
                    <div className="text-sm font-medium text-gray-900">Нурланов А.С.</div>
                    <div className="text-xs text-gray-400">Терапевт</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="absolute -bottom-4 -right-4 -z-10 h-72 w-72 rounded-full bg-cyan-100/40 blur-3xl" />
            <div className="absolute -top-4 -left-4 -z-10 h-48 w-48 rounded-full bg-blue-100/30 blur-3xl" />
          </div>

          <div className="block md:hidden">
            <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-md">
              <div className="mb-3 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-cyan-100 text-sm font-bold text-cyan-700">
                  АМ
                </div>
                <div>
                  <div className="text-sm font-semibold text-gray-900">Асель Мухамеджанова</div>
                  <div className="text-xs text-gray-400">Пациент</div>
                </div>
              </div>
              <div className="rounded-lg bg-cyan-50 p-3 text-center text-sm font-medium text-cyan-700">
                {t("hero.mobileNextAppointment")}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
