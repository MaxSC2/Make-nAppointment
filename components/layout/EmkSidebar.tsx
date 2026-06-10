"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { User, Calendar, Pill } from "lucide-react";
import { useTranslations } from "next-intl";

const navItems = [
  { key: "patient.emk.visits", shortKey: "patient.emk.visitsShort", href: "/emk", icon: User },
  { key: "patient.emk.visitHistory", shortKey: "patient.emk.visitHistoryShort", href: "/emk/visits", icon: Calendar },
  { key: "patient.emk.prescriptions", shortKey: "patient.emk.prescriptionsShort", href: "/emk/prescriptions", icon: Pill },
];

export function EmkSidebar() {
  const pathname = usePathname();
  const t = useTranslations();

  return (
    <aside className="w-64 shrink-0 max-lg:hidden">
      <div className="mb-3 rounded-xl border border-border bg-card p-6 text-center shadow-sm">
        <div className="mx-auto mb-4 h-24 w-24 overflow-hidden rounded-full border border-border">
          <Image
            src="https://api.dicebear.com/7.x/notionists/svg?seed=Asel"
            alt=""
            width={96}
            height={96}
            className="h-full w-full object-cover"
          />
        </div>
        <div className="mb-1 text-body font-bold text-foreground">
          Асель Мухамеджанова
        </div>
        <div className="mb-3 text-label text-muted-foreground">
          ИИН 920512450123
        </div>
        <span className="inline-flex items-center gap-1 rounded-md border border-red-200 bg-red-50 px-2 py-0.5 text-label font-semibold text-red-700">
          {t("patient.emk.bloodType")}
        </span>
      </div>

      <nav className="flex flex-col gap-0.5">
        {navItems.map((link) => {
          const Icon = link.icon;
          const active = pathname === link.href;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`flex items-center gap-3 rounded-lg px-4 py-2.5 text-body font-medium transition-colors ${
                active
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="h-4 w-4" />
              {t(link.key)}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

export function EmkMobileTabs() {
  const pathname = usePathname();
  const t = useTranslations();

  return (
    <div className="mb-3 flex gap-2 overflow-x-auto pb-1 lg:hidden">
      {navItems.map((item) => {
        const active = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`shrink-0 rounded-full px-3.5 py-1.5 text-label font-medium transition-colors ${
              active
                ? "bg-primary text-white"
                : "border border-border bg-card text-muted-foreground"
            }`}
          >
            {t(item.shortKey)}
          </Link>
        );
      })}
    </div>
  );
}
