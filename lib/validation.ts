/*
  ═══════════════════════════════════════════════════════════════════════════
  ✅ ФРОНТЕНД-ВАЛИДАЦИЯ
  ═══════════════════════════════════════════════════════════════════════════
  Backend: повторите те же правила на сервере перед записью в БД.
  Никогда не полагайтесь только на фронтенд-валидацию.
  ───────────────────────────────────────────────────────────────────────────
  Правила (синхронизировать с бэкендом):
  ─ Фамилия/Имя: обязательны, 2-50 символов
  ─ ИИН: ровно 12 цифр
  ─ Телефон: +7XXXXXXXXXX (10 цифр после +7)
  ─ Email: опционально, но если указан — валидный формат
  ─ Пароль: минимум 8 символов
  ─ Чекбокс согласия: обязателен
  ═══════════════════════════════════════════════════════════════════════════
*/

import { FORM_FIELDS } from "./formConstants";

export type ValidationErrors = Record<string, string>;

export function validateRequired(value: string, label: string): string | null {
  if (!value.trim()) return `${label} is required`;
  return null;
}

export function validateIIN(value: string): string | null {
  const cleaned = value.replace(/\D/g, "");
  if (cleaned.length !== 12) return "IIN must contain 12 digits";
  return null;
}

export function validatePhone(value: string): string | null {
  const cleaned = value.replace(/[\s\-()]/g, "");
  if (!/^\+?7\d{10}$/.test(cleaned))
    return "Enter phone in format +7 XXX XXX XX XX";
  return null;
}

export function validateEmail(value: string): string | null {
  if (!value.trim()) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))
    return "Enter a valid email";
  return null;
}

export function validatePassword(value: string): string | null {
  if (value.length < 8) return "Password must be at least 8 characters";
  return null;
}

export function validateLoginForm(values: {
  login: string;
  password: string;
}): ValidationErrors {
  const errors: ValidationErrors = {};
  const loginErr = validateRequired(values.login, "IIN or Email");
  if (loginErr) errors[FORM_FIELDS.LOGIN] = loginErr;
  const passErr = validateRequired(values.password, "Password");
  if (passErr) errors[FORM_FIELDS.PASSWORD] = passErr;
  return errors;
}

export function validateRegisterForm(values: {
  surname: string;
  name: string;
  iin: string;
  phone: string;
  email: string;
  password: string;
  accepted: boolean;
}): ValidationErrors {
  const errors: ValidationErrors = {};

  const surnameErr = validateRequired(values.surname, "Surname");
  if (surnameErr) errors[FORM_FIELDS.SURNAME] = surnameErr;

  const nameErr = validateRequired(values.name, "Name");
  if (nameErr) errors[FORM_FIELDS.NAME] = nameErr;

  const iinErr = validateIIN(values.iin);
  if (iinErr) errors[FORM_FIELDS.IIN] = iinErr;

  const phoneErr = validatePhone(values.phone);
  if (phoneErr) errors[FORM_FIELDS.PHONE] = phoneErr;

  const emailErr = validateEmail(values.email);
  if (emailErr) errors[FORM_FIELDS.EMAIL] = emailErr;

  const passErr = validatePassword(values.password);
  if (passErr) errors[FORM_FIELDS.PASSWORD] = passErr;

  if (!values.accepted) errors[FORM_FIELDS.ACCEPTED] = "Accept the terms of use";

  return errors;
}

export function validateAppointmentForm(values: {
  phone: string;
  complaints: string;
}): ValidationErrors {
  const errors: ValidationErrors = {};

  const phoneErr = validatePhone(values.phone);
  if (phoneErr) errors[FORM_FIELDS.PHONE] = phoneErr;

  const compErr = validateRequired(values.complaints, "Complaint description");
  if (compErr) errors[FORM_FIELDS.COMPLAINTS] = compErr;

  return errors;
}
