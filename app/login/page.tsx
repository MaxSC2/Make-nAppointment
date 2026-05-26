"use client";

import Link from "next/link";
import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-md">
        {/* Logo */}
        <Link href="/" className="mb-8 flex items-center justify-center gap-2 text-lg font-bold text-primary">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
          MedPlatform
        </Link>

        <div className="rounded-xl border border-border bg-card p-8">
          <h1 className="mb-1 text-h2 font-extrabold text-foreground">Войти</h1>
          <p className="mb-6 text-body text-muted-foreground">Войдите в свой аккаунт MedPlatform</p>

          <form className="flex flex-col gap-5" onSubmit={(e) => e.preventDefault()}>
            <div className="flex flex-col gap-1.5">
              <label className="text-label font-medium text-muted-foreground">ИИН или Email</label>
              <input
                type="text"
                defaultValue="920512450123"
                className="rounded-lg border border-border bg-background px-3.5 py-2.5 text-body text-foreground focus:border-primary focus:outline-none"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-label font-medium text-muted-foreground">Пароль</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  defaultValue="password"
                  className="w-full rounded-lg border border-border bg-background px-3.5 py-2.5 pr-10 text-body text-foreground focus:border-primary focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-label text-muted-foreground">
                <input type="checkbox" defaultChecked className="rounded border-border text-primary focus:ring-primary" />
                Запомнить меня
              </label>
              <a href="#" className="text-label font-medium text-primary hover:underline">Забыли пароль?</a>
            </div>

            <Link
              href="/dashboard"
              className="w-full rounded-lg bg-primary py-2.5 text-center text-body font-semibold text-white transition-opacity hover:opacity-90"
            >
              Войти
            </Link>
          </form>

          <p className="mt-6 text-center text-label text-muted-foreground">
            Нет аккаунта?{' '}
            <Link href="/register" className="font-semibold text-primary hover:underline">
              Зарегистрироваться
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
