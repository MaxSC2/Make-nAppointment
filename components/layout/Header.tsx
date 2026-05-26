import { Bell } from "lucide-react";
import Link from "next/link";

const navItems = [
  { label: "Запись к врачу", href: "/appointment", active: false },
  { label: "Лаборатория", href: "#", active: false },
  { label: "Моя карта", href: "/emk", active: false },
];

export function Header() {
  return (
    <header className="flex h-16 items-center justify-between bg-primary px-6 text-white max-md:hidden">
      <div className="flex items-center gap-8">
        <Link href="/dashboard" className="flex items-center gap-2 text-lg font-bold">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
          MedPlatform
        </Link>
        <nav className="flex items-center gap-6">
          {navItems.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className="text-sm text-white/75 transition-colors hover:text-white"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
      <div className="flex items-center gap-3">
        <button className="rounded-lg p-2 text-white/70 hover:text-white">
          <Bell className="h-[18px] w-[18px]" />
        </button>
        <div className="h-9 w-9 overflow-hidden rounded-full border-2 border-white/30">
          <img
            src="https://api.dicebear.com/7.x/notionists/svg?seed=Asel"
            alt=""
            className="h-full w-full object-cover"
          />
        </div>
      </div>
    </header>
  );
}

export function MobileHeader() {
  return (
    <header className="flex h-14 items-center justify-between bg-primary px-4 text-white md:hidden">
      <Link href="/dashboard" className="flex items-center gap-2 text-[17px] font-bold">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
        MedPlatform
      </Link>
      <div className="flex items-center gap-2">
        <button className="p-1.5 text-white">
          <Bell className="h-[18px] w-[18px]" />
        </button>
        <div className="h-8 w-8 overflow-hidden rounded-full border-2 border-white/40">
          <img
            src="https://api.dicebear.com/7.x/notionists/svg?seed=Asel"
            alt=""
            className="h-full w-full object-cover"
          />
        </div>
      </div>
    </header>
  );
}
