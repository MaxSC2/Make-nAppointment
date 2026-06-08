"use client";

import Image from "next/image";
import { useState, useRef, useEffect, useCallback } from "react";
import { Bell, Settings, User, LogOut } from "lucide-react";
import Link from "next/link";

const navItems = [
  { label: "Запись к врачу", href: "/appointment" },
  { label: "Лаборатория", href: "/laboratory" },
  { label: "Моя карта", href: "/emk" },
];

const notifications = [
  { id: 1, text: "Напоминание: приём у терапевта завтра в 10:00", time: "2 ч назад", unread: true },
  { id: 2, text: "Результат анализа готов: Общий анализ крови", time: "5 ч назад", unread: true },
  { id: 3, text: "Запись подтверждена: Смагулова Г.К. 28 окт 14:30", time: "1 день назад", unread: false },
];

function useClickOutside(ref: React.RefObject<HTMLElement | null>, handler: () => void) {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) handlerRef.current();
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [ref]);
}

function HeaderNotifications({ onClose }: { onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useClickOutside(ref, onClose);

  return (
    <div
      ref={ref}
      className="absolute right-0 top-full mt-2 w-80 rounded-xl border border-border bg-card shadow-xl"
    >
      <div className="border-b border-border px-4 py-3 text-body font-bold text-foreground">
        Уведомления
      </div>
      <div className="max-h-64 overflow-y-auto">
        {notifications.map((n) => (
          <div
            key={n.id}
            className={`flex gap-3 border-b border-border px-4 py-3 last:border-b-0 ${n.unread ? "bg-primary/5" : ""}`}
          >
            <div className={`mt-1 h-2 w-2 shrink-0 rounded-full ${n.unread ? "bg-primary" : "bg-transparent"}`} />
            <div className="min-w-0 flex-1">
              <div className="text-label text-foreground">{n.text}</div>
              <div className="text-micro text-muted-foreground">{n.time}</div>
            </div>
          </div>
        ))}
      </div>
      <button className="w-full rounded-b-xl border-t border-border px-4 py-2.5 text-label font-medium text-primary transition-colors hover:bg-background">
        Все уведомления
      </button>
    </div>
  );
}

function clearAuth() {
  document.cookie = "auth_token=; path=/; max-age=0";
}

function HeaderUserMenu({ onClose }: { onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useClickOutside(ref, onClose);

  const items = [
    { icon: User, label: "Профиль", href: "/emk" },
    { icon: Settings, label: "Настройки", href: null as string | null },
    { icon: LogOut, label: "Выйти", href: "/login" },
  ];

  return (
    <div
      ref={ref}
      className="absolute right-0 top-full mt-2 w-52 rounded-xl border border-border bg-card shadow-xl"
    >
      <div className="border-b border-border px-4 py-3">
        <div className="text-body font-semibold text-foreground">Асель Мухамеджанова</div>
        <div className="text-micro text-muted-foreground">920512450123</div>
      </div>
      {items.map((item) => {
        const Icon = item.icon;
        if (!item.href) {
          return (
            <button
              key={item.label}
              type="button"
              disabled
              className="flex w-full items-center gap-3 rounded-lg px-4 py-2.5 text-body font-medium text-muted-foreground/50 transition-colors"
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </button>
          );
        }
        return (
          <Link
            key={item.label}
            href={item.href}
            onClick={(e) => {
              if (item.label === "Выйти") {
                e.preventDefault();
                clearAuth();
                window.location.href = "/login";
              }
            }}
            className="flex items-center gap-3 rounded-lg px-4 py-2.5 text-body font-medium text-muted-foreground transition-colors hover:bg-primary/5 hover:text-primary"
          >
            <Icon className="h-4 w-4" />
            {item.label}
          </Link>
        );
      })}
    </div>
  );
}

export function Header() {
  const [showNotif, setShowNotif] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

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
      <div className="relative flex items-center gap-3">
        <button
          onClick={() => { setShowNotif((v) => !v); setShowMenu(false); }}
          className="relative rounded-lg p-2 text-white/70 hover:text-white"
        >
          <Bell className="h-[18px] w-[18px]" />
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-500" />
        </button>
        {showNotif && (
          <div className="absolute right-12 top-full mt-2 z-50">
            <HeaderNotifications onClose={() => setShowNotif(false)} />
          </div>
        )}

        <button
          onClick={() => { setShowMenu((v) => !v); setShowNotif(false); }}
          className="h-9 w-9 overflow-hidden rounded-full border-2 border-white/30"
        >
          <Image
            src="https://api.dicebear.com/7.x/notionists/svg?seed=Asel"
            alt=""
            width={36}
            height={36}
            className="h-full w-full object-cover"
          />
        </button>
        {showMenu && (
          <div className="absolute right-0 top-full mt-2 z-50">
            <HeaderUserMenu onClose={() => setShowMenu(false)} />
          </div>
        )}
      </div>
    </header>
  );
}

function throttle<T extends (...args: unknown[]) => void>(fn: T, ms: number): T {
  let last = 0;
  return ((...args: unknown[]) => {
    const now = Date.now();
    if (now - last >= ms) {
      last = now;
      fn(...args);
    }
  }) as T;
}

export function MobileHeader() {
  const [showNotif, setShowNotif] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [hidden, setHidden] = useState(false);
  const lastScroll = useRef(0);

  useEffect(() => {
    const handleScroll = throttle(() => {
      const y = window.scrollY;
      if (y > 56 && y > lastScroll.current) {
        setHidden(true);
      } else if (y < lastScroll.current) {
        setHidden(false);
      }
      lastScroll.current = y;
    }, 100);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 flex h-14 items-center justify-between bg-primary px-4 text-white transition-transform duration-300 md:hidden ${
        hidden ? "-translate-y-full" : "translate-y-0"
      }`}
    >
      <Link href="/dashboard" className="flex items-center gap-2 text-lg font-bold">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
        MedPlatform
      </Link>
      <div className="relative flex items-center gap-2">
        <button
          onClick={() => { setShowNotif((v) => !v); setShowMenu(false); }}
          className="relative p-1.5 text-white"
        >
          <Bell className="h-[18px] w-[18px]" />
          <span className="absolute right-0.5 top-0.5 h-2 w-2 rounded-full bg-red-500" />
        </button>
        {showNotif && (
          <div className="absolute right-0 top-full mt-2 w-72 rounded-xl border border-border bg-card shadow-xl z-50">
            <HeaderNotifications onClose={() => setShowNotif(false)} />
          </div>
        )}
        <button
          onClick={() => { setShowMenu((v) => !v); setShowNotif(false); }}
          className="h-8 w-8 overflow-hidden rounded-full border-2 border-white/40"
        >
          <Image
            src="https://api.dicebear.com/7.x/notionists/svg?seed=Asel"
            alt=""
            width={32}
            height={32}
            className="h-full w-full object-cover"
          />
        </button>
        {showMenu && (
          <div className="absolute right-0 top-full mt-2 w-52 rounded-xl border border-border bg-card shadow-xl z-50">
            <HeaderUserMenu onClose={() => setShowMenu(false)} />
          </div>
        )}
      </div>
    </header>
  );
}
