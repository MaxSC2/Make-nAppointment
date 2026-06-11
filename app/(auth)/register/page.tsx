/*
  ═══════════════════════════════════════════════════════════════════════════
  🔐 СТРАНИЦА РЕГИСТРАЦИИ — заглушка
  ═══════════════════════════════════════════════════════════════════════════
  Backend: замените handleRegister() на вызов реального API.
  ───────────────────────────────────────────────────────────────────────────
  Ожидаемая логика:
    POST /api/auth/register
    { surname, name, iin, phone, email, password }
    → 201 { token: string, user: User }
    → 422 { message: string, errors: { field: string, message: string }[] }
    - повторить валидацию на сервере (все правила из lib/validation.ts)
    - сохранить JWT, редирект на /dashboard
  ═══════════════════════════════════════════════════════════════════════════
*/

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Eye, EyeOff } from "lucide-react";
import { validateRegisterForm, type ValidationErrors } from "@/lib/validation";
import { FORM_FIELDS } from "@/lib/formConstants";

function setAuthCookie() {
  // TODO: заменить на установку реального JWT от сервера
  document.cookie = "auth_token=mock-token-123; path=/; max-age=86400; secure; samesite=strict";
  document.cookie = "role=patient; path=/; max-age=86400; secure; samesite=strict";
}

export default function RegisterPage() {
  const router = useRouter();
  const t = useTranslations("auth");
  const tc = useTranslations("common");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);

  async function handleRegister(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setServerError(null);
    const form = e.currentTarget;
    const data = new FormData(form);
    const values = {
      surname: (data.get(FORM_FIELDS.SURNAME) as string) || "",
      name: (data.get(FORM_FIELDS.NAME) as string) || "",
      iin: (data.get(FORM_FIELDS.IIN) as string) || "",
      phone: (data.get(FORM_FIELDS.PHONE) as string) || "",
      email: (data.get(FORM_FIELDS.EMAIL) as string) || "",
      password: (data.get(FORM_FIELDS.PASSWORD) as string) || "",
      accepted: (data.get(FORM_FIELDS.ACCEPTED) as string) === "on",
    };

    const validationErrors = validateRegisterForm(values);
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return;

    // TODO: заменить на реальный API-вызов:
    // const res = await fetch("/api/auth/register", {
    //   method: "POST",
    //   headers: { "Content-Type": "application/json" },
    //   body: JSON.stringify(values),
    // });
    // if (!res.ok) {
    //   const err = await res.json();
    //   setServerError(err.message || "Ошибка регистрации");
    //   if (err.errors) setErrors(Object.fromEntries(err.errors.map((e: any) => [e.field, e.message])));
    //   return;
    // }
    // const { token } = await res.json();
    // document.cookie = `auth_token=${token}; path=/; max-age=86400; secure; samesite=strict`;

    setAuthCookie();
    router.push("/dashboard");
  }

  function ErrorMsg({ field }: { field: string }) {
    return errors[field] ? (
      <span className="text-micro font-medium text-red-500">{errors[field]}</span>
    ) : null;
  }

  function inputClass(field: string) {
    return `w-full rounded-lg border ${errors[field] ? "border-red-400" : "border-border"} bg-background px-3.5 py-2.5 text-body text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none`;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-lg">
        <Link href="/" className="mb-8 flex items-center justify-center gap-2 text-lg font-bold text-primary">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
          MedPlatform
        </Link>

        <div className="rounded-xl border border-border bg-card p-5 md:p-8">
          <h1 className="mb-1 text-h2 font-extrabold text-foreground">{t("registerTitle")}</h1>
          <p className="mb-6 text-body text-muted-foreground">{t("registerSubtitle")}</p>

          <form className="flex flex-col gap-5" onSubmit={handleRegister} noValidate>
            {serverError && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-label font-medium text-red-700">
                {serverError}
              </div>
            )}

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="flex flex-col gap-1">
                <label className="text-label font-medium text-muted-foreground">{t("registerSurname")}</label>
                <input type="text" name={FORM_FIELDS.SURNAME} placeholder="Мухамеджанова" className={inputClass("surname")} />

                <label className="text-label font-medium text-muted-foreground">{t("registerName")}</label>
                <input type="text" name={FORM_FIELDS.NAME} placeholder="Асель" className={inputClass("name")} />
                <ErrorMsg field="name" />
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-label font-medium text-muted-foreground">{t("iin")}</label>
              <input type="text" name={FORM_FIELDS.IIN} placeholder="920512450123" maxLength={12} className={inputClass("iin")} />
              <ErrorMsg field="iin" />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-label font-medium text-muted-foreground">{t("registerPhone")}</label>
              <input type="tel" name={FORM_FIELDS.PHONE} placeholder="+7 701 234 56 78" className={inputClass("phone")} />
              <ErrorMsg field="phone" />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-label font-medium text-muted-foreground">{t("email")}</label>
              <input type="email" name={FORM_FIELDS.EMAIL} placeholder="example@mail.kz" className={inputClass("email")} />
              <ErrorMsg field="email" />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-label font-medium text-muted-foreground">{t("password")}</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  name={FORM_FIELDS.PASSWORD}
                  placeholder={t("registerPasswordPlaceholder")}
                  className={`${inputClass("password")} pr-10`}
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <ErrorMsg field="password" />
            </div>

            <div className="flex flex-col gap-1">
              <label className="flex items-start gap-2 text-label text-muted-foreground">
                <input type="checkbox" name={FORM_FIELDS.ACCEPTED} className={`mt-0.5 rounded border-border text-primary focus:ring-primary ${errors.accepted ? "border-red-400" : ""}`} />
                <span>
                  {t("iAccept")}{' '}
                  <span className="cursor-not-allowed font-medium text-muted-foreground">{t("termsOfUse")}</span>
                  {' '}{tc("and")}{' '}
                  <span className="cursor-not-allowed font-medium text-muted-foreground">{t("privacyPolicy")}</span>
                </span>
              </label>
              <ErrorMsg field="accepted" />
            </div>

            <button type="submit" className="w-full rounded-lg bg-primary py-2.5 text-body font-semibold text-white transition-opacity hover:opacity-90">
              {t("registerSubmit")}
            </button>
          </form>

          <p className="mt-6 text-center text-label text-muted-foreground">
            {t("hasAccount")}{' '}
            <Link href="/login" className="font-semibold text-primary hover:underline">{t("loginLinkText")}</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
