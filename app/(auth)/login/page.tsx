/*
  ═══════════════════════════════════════════════════════════════════════════
  🔐 СТРАНИЦА ВХОДА — заглушка
  ═══════════════════════════════════════════════════════════════════════════
  Backend: замените handleLogin() на вызов реального API.
  ───────────────────────────────────────────────────────────────────────────
  Сейчас:
    - читает поля login + password из формы
    - фронтенд-валидация (validateLoginForm)
    - устанавливает куку auth_token=mock-token-123
    - редирект на /dashboard
  ───────────────────────────────────────────────────────────────────────────
  Ожидаемая логика:
    POST /api/auth/login  { login: string, password: string }
    → 200 { token: string, user: User }
    → 401 { message: "Неверный логин или пароль" }
    - сохранить JWT в httpOnly cookie (или localStorage + Authorization header)
    - редирект на /dashboard (или redirect из query-параметра)
  ═══════════════════════════════════════════════════════════════════════════
*/

"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, Suspense } from "react";
import { Eye, EyeOff } from "lucide-react";
import { validateLoginForm, type ValidationErrors } from "@/lib/validation";
import { FORM_FIELDS } from "@/lib/formConstants";

type LoginRole = "patient" | "doctor" | "admin" | "labtech";

const roleLabels: Record<LoginRole, string> = {
  patient: "Пациент",
  doctor: "Врач",
  admin: "Администратор",
  labtech: "Лаборант",
};

const defaultRedirect: Record<LoginRole, string> = {
  patient: "/dashboard",
  doctor: "/doctor/dashboard",
  admin: "/admin/dashboard",
  labtech: "/lab/queue",
};

function setAuthCookie(role: LoginRole = "patient") {
  // TODO: заменить на установку реального JWT от сервера
  // ⚠️ HttpOnly может установить только сервер (Set-Cookie header).
  // На клиенте — только Secure + SameSite=Strict
  document.cookie = "auth_token=mock-token-123; path=/; max-age=86400; secure; samesite=strict";
  document.cookie = `role=${role}; path=/; max-age=86400; secure; samesite=strict`;
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [selectedRole, setSelectedRole] = useState<LoginRole>("patient");
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setServerError(null);
    const form = e.currentTarget;
    const data = new FormData(form);
    const values = {
      login: (data.get(FORM_FIELDS.LOGIN) as string) || "",
      password: (data.get(FORM_FIELDS.PASSWORD) as string) || "",
      rememberMe,
    };

    const validationErrors = validateLoginForm(values);
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return;

    setIsLoading(true);

    try {
      // TODO: заменить на реальный API-вызов:
      // const res = await fetch("/api/auth/login", {
      //   method: "POST",
      //   headers: { "Content-Type": "application/json" },
      //   body: JSON.stringify(values),
      // });
      // if (!res.ok) {
      //   const err = await res.json();
      //   setServerError(err.message || "Ошибка входа");
      //   return;
      // }
      // const { token } = await res.json();
      // document.cookie = `auth_token=${token}; path=/; max-age=86400; secure; samesite=strict`;

      setAuthCookie(selectedRole);
      form.reset();
      alert("Успешный вход");
      const redirect = searchParams.get("redirect") || defaultRedirect[selectedRole];
      router.push(redirect);
    } catch {
      setServerError("Произошла ошибка при входе");
    } finally {
      setIsLoading(false);
    }
  }

  function ErrorMsg({ field }: { field: string }) {
    return errors[field] ? (
      <span className="text-micro font-medium text-red-500">{errors[field]}</span>
    ) : null;
  }

  function inputClass(field: string) {
    return `w-full rounded-lg border ${errors[field] ? "border-red-400" : "border-border"} bg-background px-3.5 py-2.5 text-body text-foreground focus:border-primary focus:outline-none`;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-md">
        <Link href="/" className="mb-8 flex items-center justify-center gap-2 text-lg font-bold text-primary">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
          MedPlatform
        </Link>

        <div className="rounded-xl border border-border bg-card p-5 md:p-8">
          <h1 className="mb-1 text-h2 font-extrabold text-foreground">Войти</h1>
          <p className="mb-6 text-body text-muted-foreground">Войдите в свой аккаунт MedPlatform</p>

          <form className="flex flex-col gap-5" onSubmit={handleLogin} noValidate>
            {serverError && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-label font-medium text-red-700">
                {serverError}
              </div>
            )}

            <div className="flex flex-col gap-1">
              <label className="text-label font-medium text-muted-foreground">ИИН или Email</label>
              <input type="text" name={FORM_FIELDS.LOGIN} className={inputClass("login")} placeholder="Введите ИИН или email" />
              <ErrorMsg field="login" />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-label font-medium text-muted-foreground">Пароль</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  name={FORM_FIELDS.PASSWORD}
                  className={`${inputClass("password")} pr-10`}
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <ErrorMsg field="password" />
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-label text-muted-foreground">
                <input type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} className="rounded border-border text-primary focus:ring-primary" />
                Запомнить меня
              </label>
              <button
                type="button"
                onClick={() => alert("Восстановление пароля временно недоступно")}
                className="text-label font-medium text-primary hover:underline"
              >
                Забыли пароль?
              </button>
            </div>

            <div className="flex flex-wrap gap-2">
              {(Object.keys(roleLabels) as LoginRole[]).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setSelectedRole(r)}
                  className={`rounded-full px-3.5 py-1.5 text-label font-medium transition-colors ${
                    selectedRole === r
                      ? "bg-primary text-white"
                      : "border border-border bg-background text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {roleLabels[r]}
                </button>
              ))}
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className={`w-full rounded-lg py-2.5 text-body font-semibold text-white transition-opacity ${
                isLoading
                  ? "cursor-not-allowed bg-primary/60"
                  : "bg-primary hover:opacity-90"
              }`}
            >
              {isLoading ? "Вход…" : "Войти"}
            </button>
          </form>

          <p className="mt-6 text-center text-label text-muted-foreground">
            Нет аккаунта?{' '}
            <Link href="/register" className="font-semibold text-primary hover:underline">Зарегистрироваться</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
