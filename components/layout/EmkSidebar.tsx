"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { User, Calendar, Pill, Beaker } from "lucide-react";

const links = [
  { label: "Карточка пациента", href: "/emk", icon: User },
  { label: "История визитов", href: "/emk/visits", icon: Calendar },
  { label: "Назначения", href: "/emk/prescriptions", icon: Pill },
  { label: "Анализы", href: "#", icon: Beaker },
];

export function EmkSidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 shrink-0 max-lg:hidden">
      <div className="mb-3 rounded-xl border border-border bg-card p-6 text-center shadow-sm">
        <div className="mx-auto mb-4 h-24 w-24 overflow-hidden rounded-full border border-border">
          <img
            src="https://api.dicebear.com/7.x/notionists/svg?seed=Asel"
            alt=""
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
          B (III) Rh+
        </span>
      </div>

      <nav className="flex flex-col gap-0.5">
        {links.map((link) => {
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
              {link.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

export function EmkMobileTabs() {
  const pathname = usePathname();

  const tabs = [
    { label: "Карточка", href: "/emk" },
    { label: "Визиты", href: "/emk/visits" },
    { label: "Назначения", href: "/emk/prescriptions" },
    { label: "Анализы", href: "#" },
  ];

  return (
    <div className="mb-3 flex gap-2 overflow-x-auto pb-1 lg:hidden">
      {tabs.map((tab) => {
        const active = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`shrink-0 rounded-full px-3.5 py-1.5 text-label font-medium transition-colors ${
              active
                ? "bg-primary text-white"
                : "border border-border bg-card text-muted-foreground"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
