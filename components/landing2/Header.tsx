"use client";

import { useState } from "react";
import Link from "next/link";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { Menu, X } from "lucide-react";
import { useTranslations } from "next-intl";

export function LandingHeader() {
  const t = useTranslations("landing");
  const [open, setOpen] = useState(false);

  const navLinks = [
    { label: t("nav.home"), href: "#hero" },
    { label: t("nav.services"), href: "#features" },
    { label: t("nav.doctors"), href: "#ehr" },
    { label: t("nav.contacts"), href: "#footer" },
  ];

  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-gray-100 bg-white/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 md:px-8">
        <Link href="/landing2" className="flex items-center gap-2 text-lg font-bold text-cyan-700">
          <svg width="22" height="22" viewBox="0 0 64 64" fill="none">
            <rect x="26" y="10" width="12" height="44" rx="3" fill="#0E7490" />
            <rect x="10" y="26" width="44" height="12" rx="3" fill="#0E7490" />
          </svg>
          MedPlatform
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          {navLinks.map((l) => (
            <a key={l.label} href={l.href} className="text-sm font-medium text-gray-600 transition-colors hover:text-cyan-700">
              {l.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          <LanguageSwitcher light />
          <Link href="/login" className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:border-cyan-200 hover:text-cyan-700">
            {t("header.login")}
          </Link>
          <Link href="/register" className="rounded-lg bg-cyan-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-cyan-800">
            {t("header.register")}
          </Link>
        </div>

        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="flex items-center justify-center rounded-lg p-2 text-gray-600 hover:bg-gray-100 md:hidden"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {open && (
        <div className="border-t border-gray-100 bg-white px-4 pb-4 pt-2 md:hidden">
          <nav className="flex flex-col gap-2">
            {navLinks.map((l) => (
              <a key={l.label} href={l.href} onClick={() => setOpen(false)} className="rounded-lg px-3 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50 hover:text-cyan-700">
                {l.label}
              </a>
            ))}
            <hr className="my-2 border-gray-100" />
            <Link href="/login" onClick={() => setOpen(false)} className="rounded-lg px-3 py-2 text-sm font-medium text-gray-700 hover:text-cyan-700">
              {t("header.login")}
            </Link>
            <Link href="/register" onClick={() => setOpen(false)} className="rounded-lg bg-cyan-700 px-3 py-2 text-sm font-medium text-white text-center hover:bg-cyan-800">
              {t("header.register")}
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}
