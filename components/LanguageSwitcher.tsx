"use client";

import { useLocale } from "next-intl";
import { usePathname, useRouter } from "next/navigation";
import { useTransition } from "react";

export function LanguageSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  const switchLocale = (next: string) => {
    document.cookie = `NEXT_LOCALE=${next}; path=/; max-age=31536000; SameSite=Lax`;
    startTransition(() => {
      router.refresh();
    });
  };

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={() => switchLocale("ru")}
        disabled={locale === "ru" || isPending}
        className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
          locale === "ru"
            ? "bg-white/20 text-white"
            : "text-white/60 hover:text-white"
        } disabled:opacity-100`}
      >
        RU
      </button>
      <span className="text-white/30 text-xs">|</span>
      <button
        onClick={() => switchLocale("kk")}
        disabled={locale === "kk" || isPending}
        className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
          locale === "kk"
            ? "bg-white/20 text-white"
            : "text-white/60 hover:text-white"
        } disabled:opacity-100`}
      >
        ҚАЗ
      </button>
    </div>
  );
}
