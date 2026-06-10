"use client";

import { useLocale } from "next-intl";
import { usePathname, useRouter } from "next/navigation";
import { useTransition } from "react";

const locales = [
  { code: "ru", label: "RU" },
  { code: "en", label: "EN" },
  { code: "kk", label: "ҚАЗ" },
];

export function LanguageSwitcher({ light }: { light?: boolean }) {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  const switchLocale = (next: string) => {
    document.cookie = `NEXT_LOCALE=${next}; path=/; max-age=31536000; SameSite=Lax`;
    startTransition(() => {
      router.replace(pathname);
      router.refresh();
    });
  };

  const active = (c: string) =>
    light
      ? "bg-cyan-700 text-white"
      : "bg-white/20 text-white";
  const inactive = (c: string) =>
    light
      ? "text-gray-500 hover:text-cyan-700"
      : "text-white/60 hover:text-white";

  return (
    <div className="flex items-center gap-1">
      {locales.map((l, i) => (
        <span key={l.code} className="flex items-center gap-1">
          {i > 0 && (
            <span className={`text-xs ${light ? "text-gray-300" : "text-white/30"}`}>|</span>
          )}
          <button
            onClick={() => switchLocale(l.code)}
            disabled={locale === l.code || isPending}
            className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
              locale === l.code ? active(l.code) : inactive(l.code)
            } disabled:opacity-100`}
          >
            {l.label}
          </button>
        </span>
      ))}
    </div>
  );
}
