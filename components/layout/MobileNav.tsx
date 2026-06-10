"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";

const links = [
  { key: "header.home", href: "/dashboard", icon: "home" },
  { key: "header.appointment", href: "/appointment", icon: "calendar" },
  { key: "header.myCard", href: "/emk", icon: "file" },
  { key: "header.laboratory", href: "/laboratory", icon: "flask" },
];

function NavIcon({ name, active }: { name: string; active: boolean }) {
  const cls = active ? "text-primary" : "text-muted-foreground";
  switch (name) {
    case "home":
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={cls}>
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" />
        </svg>
      );
    case "calendar":
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={cls}>
          <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
        </svg>
      );
    case "file":
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={cls}>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
        </svg>
      );
    case "flask":
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={cls}>
          <path d="M10 2v6.1a2 2 0 0 1-.46 1.28L3.2 17.2A2 2 0 0 0 4.73 20h14.54a2 2 0 0 0 1.53-2.8l-6.34-7.82A2 2 0 0 1 14 8.1V2" /><path d="M8 2h8" /><line x1="7" y1="14" x2="17" y2="14" />
        </svg>
      );
    default:
      return null;
  }
}

export function MobileNav() {
  const pathname = usePathname();
  const t = useTranslations();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 flex h-16 items-center justify-around border-t border-border bg-card px-2 md:hidden">
      {links.map((link) => {
        const active = pathname.startsWith(link.href);
        return (
          <Link
            key={link.key}
            href={link.href}
            className={`flex flex-col items-center gap-0.5 border-none bg-transparent text-micro font-medium ${
              active ? "text-primary" : "text-muted-foreground"
            }`}
          >
            <NavIcon name={link.icon} active={active} />
            {t(link.key)}
          </Link>
        );
      })}
    </nav>
  );
}
