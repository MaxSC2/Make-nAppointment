"use client";

import { usePathname } from "next/navigation";

const links = [
  { label: "Главная", href: "/dashboard", icon: "home" },
  { label: "Запись", href: "/appointment", icon: "calendar" },
  { label: "Карта", href: "/emk", icon: "file" },
  { label: "Профиль", href: "#", icon: "user" },
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
    case "user":
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={cls}>
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
        </svg>
      );
    default:
      return null;
  }
}

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 flex h-16 items-center justify-around border-t border-border bg-card px-2 md:hidden">
      {links.map((link) => {
        const active = pathname.startsWith(link.href);
        return (
          <a
            key={link.label}
            href={link.href}
            className={`flex flex-col items-center gap-0.5 border-none bg-transparent text-micro font-medium ${
              active ? "text-primary" : "text-muted-foreground"
            }`}
          >
            <NavIcon name={link.icon} active={active} />
            {link.label}
          </a>
        );
      })}
    </nav>
  );
}
