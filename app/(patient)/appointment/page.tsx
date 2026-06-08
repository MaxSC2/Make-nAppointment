"use client";

import Image from "next/image";
import { useState, useMemo, useRef, useEffect } from "react";
import { Search, SearchX, Calendar as CalendarIcon, Check, AlertCircle, RefreshCw } from "lucide-react";
import { CalendarGrid } from "@/components/ui/CalendarGrid";
import { Header, MobileHeader } from "@/components/layout/Header";
import { MobileNav } from "@/components/layout/MobileNav";
import {
  TIME_SLOTS,
  RU_MONTHS_GEN,
} from "@/lib/mockData";
import { Badge } from "@/components/ui/Badge";
import { DoctorCard } from "@/components/appointment/DoctorCard";
import { useQuery } from "@/lib/api/hooks";
import { fetchDoctors, fetchAppointments } from "@/lib/api";
import { validateAppointmentForm, type ValidationErrors } from "@/lib/validation";
import { FORM_FIELDS } from "@/lib/formConstants";
import type { Doctor, Appointment } from "@/types/appointment";

const specialties = [
  "",
  "Терапевт",
  "Кардиолог",
  "Невролог",
  "Дерматолог",
  "Педиатр",
  "Хирург",
];

function getToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatDate(d: Date): string {
  return `${d.getDate()} ${RU_MONTHS_GEN[d.getMonth()]} ${d.getFullYear()}`;
}

export default function AppointmentPage() {
  const [activeTab, setActiveTab] = useState<"doctors" | "my">("doctors");
  const [searchQuery, setSearchQuery] = useState("");
  const [specFilter, setSpecFilter] = useState("");
  const [availFilter, setAvailFilter] = useState("");
  const [appointments, setAppointments] =
    useState<Appointment[]>([]);
  const [detailAppt, setDetailAppt] = useState<Appointment | null>(null);

  const doctorsQuery = useQuery(fetchDoctors, []);
  const apptsQuery = useQuery(fetchAppointments, []);

  useEffect(() => {
    if (apptsQuery.data) {
      setAppointments(apptsQuery.data);
    }
  }, [apptsQuery.data]);

  // Booking modal state
  const [bookingDoctor, setBookingDoctor] = useState<Doctor | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [confirmedBooking, setConfirmedBooking] = useState<{
    doctor: Doctor;
    date: string;
    time: string;
  } | null>(null);
  const [formErrors, setFormErrors] = useState<ValidationErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const filteredDoctors = useMemo(() => {
    return (doctorsQuery.data ?? []).filter((doc) => {
      const q = searchQuery.toLowerCase();
      const matchQ =
        !q ||
        doc.name.toLowerCase().includes(q) ||
        doc.specialty.toLowerCase().includes(q);
      const matchSpec = !specFilter || doc.specialty === specFilter;
      const matchAvail = availFilter !== "available" || doc.available;
      return matchQ && matchSpec && matchAvail;
    });
  }, [searchQuery, specFilter, availFilter, doctorsQuery.data]);

  const busySlots = useMemo(() => {
    const set = new Set<string>();
    if (bookingDoctor) {
      bookingDoctor.slots.forEach((s) => {
        if (!s.available) set.add(s.time);
      });
    }
    return set;
  }, [bookingDoctor]);

  function openBookingModal(doctor: Doctor) {
    setBookingDoctor(doctor);
    setSelectedDate(null);
    setSelectedSlot(null);
    setFormErrors({});
  }

  function closeBookingModal() {
    setBookingDoctor(null);
    setSelectedDate(null);
    setSelectedSlot(null);
    setFormErrors({});
  }

  function handleSelectDate(date: Date) {
    setSelectedDate(date);
    setSelectedSlot(null);
  }

  function handleSelectSlot(time: string) {
    setSelectedSlot(time);
  }

  function handleConfirmBooking() {
    if (!bookingDoctor || !selectedDate || !selectedSlot) return;

    if (!formRef.current) return;
    const data = new FormData(formRef.current);
    const values = {
      phone: (data.get(FORM_FIELDS.PHONE) as string) || "",
      complaints: (data.get(FORM_FIELDS.COMPLAINTS) as string) || "",
    };
    const errors = validateAppointmentForm(values);
    setFormErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setIsSubmitting(true);

    // TODO: заменить на реальный API-вызов:
    // POST /api/appointments
    // body: { doctorId: bookingDoctor.id, date: selectedDate, time: selectedSlot, phone, complaints }
    // → 201 { id, ...appointment }

    setTimeout(() => {
      setConfirmedBooking({
        doctor: bookingDoctor,
        date: formatDate(selectedDate),
        time: selectedSlot,
      });
      setShowSuccessModal(true);
      setIsSubmitting(false);

      setAppointments((prev) => [
        {
          id: crypto.randomUUID(),
          doctor: bookingDoctor,
          date: formatDate(selectedDate),
          time: selectedSlot,
          status: "pending",
        },
        ...prev,
      ]);
    }, 300);
  }

  function handleCloseSuccess() {
    setShowSuccessModal(false);
    setConfirmedBooking(null);
    closeBookingModal();
    setActiveTab("my");
  }

  function handleCancelAppt(id: string) {
    // TODO: заменить на реальный API-вызов:
    // DELETE /api/appointments/:id
    // → 200 { success: true }
    setAppointments((prev) => prev.filter((a) => a.id !== id));
  }

  function Skeleton({ className }: { className?: string }) {
    return <div className={`animate-pulse rounded-lg bg-border/60 ${className ?? ""}`} />;
  }

  function ErrorBlock({ message, onRetry }: { message: string; onRetry: () => void }) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <AlertCircle className="h-8 w-8 text-red-400" />
        <div className="text-body font-medium text-foreground">{message}</div>
        <button
          onClick={onRetry}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-4 py-2 text-label font-medium text-foreground transition-colors hover:border-primary hover:text-primary"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Повторить
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pt-14 md:pt-0">
      <Header />
      <MobileHeader />

      {/* ===== PAGE CONTENT ===== */}
      <main className="mx-auto max-w-[1280px] px-4 pb-20 pt-7 md:px-6 md:pb-12">
        {/* Title */}
        <div className="mb-6">
          <h1 className="text-h2 font-extrabold text-foreground">
            Запись к врачу
          </h1>
          <p className="mt-0.5 text-body text-muted-foreground">
            Выберите специалиста и удобное время
          </p>
        </div>

        {/* Tabs */}
        <div className="mb-6 flex w-fit gap-1 rounded-xl border border-border bg-card p-1">
          <button
            onClick={() => setActiveTab("doctors")}
            className={`rounded-lg px-5 py-2 text-body font-medium transition-all ${
              activeTab === "doctors"
                ? "bg-primary font-semibold text-white"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Врачи
          </button>
          <button
            onClick={() => setActiveTab("my")}
            className={`rounded-lg px-5 py-2 text-body font-medium transition-all ${
              activeTab === "my"
                ? "bg-primary font-semibold text-white"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Мои записи
          </button>
        </div>

        {/* ===== TAB: DOCTORS ===== */}
        {activeTab === "doctors" && (
          <div>
            {/* Filters */}
            <div className="mb-6 flex flex-wrap gap-3">
              <div className="relative min-w-0 flex-1 md:min-w-[200px] md:max-w-[360px]">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Поиск"
                  className="w-full rounded-lg border border-border bg-card py-2.5 pl-9 pr-3 text-body text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                />
              </div>
              <select
                value={specFilter}
                onChange={(e) => setSpecFilter(e.target.value)}
                className="rounded-lg border border-border bg-card px-3.5 py-2.5 text-body text-foreground focus:border-primary focus:outline-none"
              >
                <option value="">Все специализации</option>
                {specialties
                  .filter(Boolean)
                  .map((s) => (
                    <option key={s}>{s}</option>
                  ))}
              </select>
              <select
                value={availFilter}
                onChange={(e) => setAvailFilter(e.target.value)}
                className="rounded-lg border border-border bg-card px-3.5 py-2.5 text-body text-foreground focus:border-primary focus:outline-none"
              >
                <option value="">Любой статус</option>
                <option value="available">Можно записаться</option>
              </select>
            </div>

            {/* Doctor Cards Grid */}
            <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {doctorsQuery.loading ? (
                <>
                  <Skeleton className="h-[180px]" />
                  <Skeleton className="h-[180px]" />
                  <Skeleton className="h-[180px]" />
                </>
              ) : doctorsQuery.error ? (
                <div className="col-span-full">
                  <ErrorBlock message={doctorsQuery.error} onRetry={doctorsQuery.refetch} />
                </div>
              ) : filteredDoctors.length > 0 ? (
                filteredDoctors.map((doctor) => (
                  <DoctorCard
                    key={doctor.id}
                    doctor={doctor}
                    selected={bookingDoctor?.id === doctor.id}
                    onSelect={openBookingModal}
                  />
                ))
              ) : (
                <div className="col-span-full py-16 text-center">
                  <SearchX className="mx-auto mb-4 h-8 w-8 text-muted-foreground" />
                  <div className="text-h3 font-semibold text-foreground">
                    Врачи не найдены
                  </div>
                  <p className="mt-1 text-body text-muted-foreground">
                    Попробуйте изменить фильтры
                  </p>
                </div>
              )}
            </div>

          </div>
        )}

        {/* ===== TAB: MY APPOINTMENTS ===== */}
        {activeTab === "my" && (
          <div>
            {apptsQuery.loading ? (
              <div className="flex flex-col gap-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center gap-4 rounded-xl border border-border bg-card p-4 md:p-5">
                    <Skeleton className="h-12 w-12 shrink-0 rounded-full" />
                    <div className="min-w-0 flex-1">
                      <Skeleton className="mb-2 h-4 w-40" />
                      <Skeleton className="mb-2 h-3 w-56" />
                      <Skeleton className="h-5 w-24" />
                    </div>
                  </div>
                ))}
              </div>
            ) : appointments.length === 0 ? (
              <div className="py-16 text-center">
                <CalendarIcon className="mx-auto mb-4 h-8 w-8 text-muted-foreground" />
                <div className="text-h3 font-semibold text-foreground">
                  Записей пока нет
                </div>
                <p className="mt-1 mb-5 text-body text-muted-foreground">
                  Запишитесь к врачу на вкладке «Врачи»
                </p>
                <button
                  onClick={() => setActiveTab("doctors")}
                  className="rounded-lg bg-primary px-6 py-2.5 text-body font-semibold text-white"
                >
                  Найти врача
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {appointments.map((appt) => (
                  <div
                    key={appt.id}
                    className="flex flex-wrap items-center gap-3 md:gap-4 rounded-xl border border-border bg-card p-4 md:p-5"
                  >
                    <div className="h-12 w-12 shrink-0 overflow-hidden rounded-full border border-border">
                      <Image
                        src={appt.doctor.imageUrl}
                        alt={appt.doctor.name}
                        width={48}
                        height={48}
                        className="h-full w-full object-cover"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-body font-bold text-foreground">
                        {appt.doctor.name}
                      </div>
                      <div className="text-label text-muted-foreground">
                        {appt.doctor.specialty} · {appt.date}, {appt.time}
                      </div>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        {appt.status === "confirmed" ? (
                          <Badge variant="green">Подтверждено</Badge>
                        ) : (
                          <Badge variant="amber">Ожидание</Badge>
                        )}
                        <Badge variant="teal">{appt.doctor.clinic}</Badge>
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <button
                        onClick={() => setDetailAppt(appt)}
                        className="rounded-lg border border-teal-200 bg-card px-3.5 py-1.5 text-label font-medium text-primary transition-all hover:bg-teal-50"
                      >
                        Подробнее
                      </button>
                      <button
                        onClick={() => handleCancelAppt(appt.id)}
                        className="rounded-lg border border-red-200 bg-card px-3.5 py-1.5 text-label font-medium text-red-600 transition-all hover:bg-red-50"
                      >
                        Отменить
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      <MobileNav />

      {/* ===== DETAIL MODAL ===== */}
      {detailAppt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md animate-[fadeUp_0.3s_ease] rounded-xl bg-card p-6 shadow-xl">
            <div className="mb-4 flex items-center gap-3">
              <div className="h-12 w-12 shrink-0 overflow-hidden rounded-full border border-border">
                <Image src={detailAppt.doctor.imageUrl} alt="" width={48} height={48} className="h-full w-full object-cover" />
              </div>
              <div>
                <div className="text-body font-bold text-foreground">{detailAppt.doctor.name}</div>
                <div className="text-label text-muted-foreground">{detailAppt.doctor.specialty}</div>
              </div>
            </div>
            <div className="mb-4 space-y-2 rounded-lg bg-background p-4 text-label">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Клиника:</span>
                <span className="font-semibold text-foreground">{detailAppt.doctor.clinic}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Дата:</span>
                <span className="font-semibold text-foreground">{detailAppt.date}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Время:</span>
                <span className="font-semibold text-foreground">{detailAppt.time}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Статус:</span>
                <Badge variant={detailAppt.status === "confirmed" ? "green" : "amber"}>
                  {detailAppt.status === "confirmed" ? "Подтверждено" : "Ожидание"}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Стоимость:</span>
                <span className="font-semibold text-foreground">{detailAppt.doctor.price}</span>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handleCancelAppt(detailAppt.id)}
                className="flex-1 rounded-lg border border-red-200 bg-card px-4 py-2.5 text-label font-medium text-red-600 transition-all hover:bg-red-50"
              >
                Отменить запись
              </button>
              <button
                onClick={() => setDetailAppt(null)}
                className="flex-1 rounded-lg bg-primary px-4 py-2.5 text-label font-semibold text-white transition-all hover:opacity-90"
              >
                Закрыть
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== BOOKING MODAL ===== */}
      {bookingDoctor && !showSuccessModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 pt-8 md:items-center md:pt-4">
          <div className="w-full max-w-lg animate-[fadeUp_0.3s_ease] rounded-xl bg-card shadow-xl">
            {/* Header */}
            <div className="flex items-center gap-3 border-b border-border px-5 py-4">
              <div className="h-11 w-11 shrink-0 overflow-hidden rounded-full border border-border">
                <Image src={bookingDoctor.imageUrl} alt="" width={44} height={44} className="h-full w-full object-cover" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-body font-bold text-foreground">{bookingDoctor.name}</div>
                <div className="text-label text-muted-foreground">{bookingDoctor.specialty} · {bookingDoctor.clinic} · {bookingDoctor.price}</div>
              </div>
              <button
                onClick={closeBookingModal}
                className="rounded-lg border border-border p-1.5 text-muted-foreground hover:text-foreground"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>

            <div className="px-5 py-4">
              {/* Step 1: Calendar */}
              {!selectedDate && (
                <div>
                  <div className="mb-3 text-body font-bold text-foreground">Выберите дату</div>
                  <CalendarGrid
                    selectedDate={selectedDate}
                    onSelectDate={handleSelectDate}
                  />
                </div>
              )}

              {/* Step 2: Time Slots */}
              {selectedDate && !selectedSlot && (
                <div>
                  <div className="mb-3 text-body font-bold text-foreground">
                    Выберите время — {formatDate(selectedDate)}
                  </div>
                  <div className="mb-2 text-label font-semibold text-muted-foreground">
                    Доступное время
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {TIME_SLOTS.map((time) => {
                      const busy = busySlots.has(time);
                      const isSelected = selectedSlot === time;
                      return (
                        <button
                          key={time}
                          disabled={busy}
                          onClick={() => !busy && handleSelectSlot(time)}
                          className={`rounded-lg border px-3 md:px-4 py-2 text-label font-medium transition-all ${
                            isSelected
                              ? "border-primary bg-primary text-white"
                              : busy
                                ? "cursor-not-allowed border-border bg-background opacity-40 line-through"
                                : "border-border bg-background text-foreground hover:border-primary hover:bg-primary/10 hover:text-primary"
                          }`}
                        >
                          {time}
                        </button>
                      );
                    })}
                  </div>
                  <button
                    onClick={() => setSelectedDate(null)}
                    className="mt-4 text-label font-medium text-muted-foreground hover:text-foreground"
                  >
                    ← Назад к выбору даты
                  </button>
                </div>
              )}

              {/* Step 3: Booking Form */}
              {selectedDate && selectedSlot && (
                <div>
                  <div className="mb-4 text-body font-bold text-foreground">Подтверждение записи</div>

                  <div className="mb-4 rounded-lg border border-teal-200 bg-teal-50 p-3 md:p-4">
                    <div className="space-y-1.5 text-label">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Врач:</span>
                        <span className="font-semibold text-foreground">{bookingDoctor.name}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Специализация:</span>
                        <span className="font-semibold text-foreground">{bookingDoctor.specialty}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Дата:</span>
                        <span className="font-semibold text-foreground">{formatDate(selectedDate)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Время:</span>
                        <span className="font-semibold text-foreground">{selectedSlot}</span>
                      </div>
                      <div className="flex justify-between border-t border-teal-200 pt-1.5">
                        <span className="text-muted-foreground">Стоимость:</span>
                        <span className="font-semibold text-foreground">{bookingDoctor.price}</span>
                      </div>
                    </div>
                  </div>

                  <form ref={formRef} onSubmit={(e) => e.preventDefault()} noValidate>
                    <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                      <div className="flex flex-col gap-1">
                        <label className="text-label font-medium text-muted-foreground">ФИО пациента</label>
                        <input type="text" value="Асель Мухамеджанова" readOnly className="rounded-lg border border-border bg-background px-3 py-2.5 text-body text-foreground" />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-label font-medium text-muted-foreground">Телефон</label>
                        <input
                          type="tel"
                          name={FORM_FIELDS.PHONE}
                          defaultValue="+7 701 234 56 78"
                          className={`rounded-lg border px-3 py-2.5 text-body text-foreground focus:outline-none focus:border-primary ${formErrors.phone ? "border-red-400 bg-card" : "border-border bg-card"}`}
                        />
                        {formErrors.phone && <span className="text-micro font-medium text-red-500">{formErrors.phone}</span>}
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-label font-medium text-muted-foreground">Тип приёма</label>
                        <select className="rounded-lg border border-border bg-card px-3 py-2.5 text-body text-foreground focus:border-primary focus:outline-none">
                          <option>Первичный приём</option>
                          <option>Повторный приём</option>
                          <option>Консультация</option>
                        </select>
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-label font-medium text-muted-foreground">Полис ОМС</label>
                        <input type="text" defaultValue="010-2024-KZ-4521897" className="rounded-lg border border-border bg-card px-3 py-2.5 text-body text-foreground focus:border-primary focus:outline-none" />
                      </div>
                    </div>
                    <div className="mb-4 flex flex-col gap-1">
                      <label className="text-label font-medium text-muted-foreground">Жалобы / причина визита</label>
                      <textarea
                        name={FORM_FIELDS.COMPLAINTS}
                        placeholder="Опишите симптомы..."
                        className={`min-h-[72px] rounded-lg border px-3 py-2.5 text-body text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary ${formErrors.complaints ? "border-red-400 bg-card" : "border-border bg-card"}`}
                      />
                      {formErrors.complaints && <span className="text-micro font-medium text-red-500">{formErrors.complaints}</span>}
                    </div>
                  </form>

                  {/* Actions */}
                  <div className="flex flex-col-reverse gap-2 md:flex-row md:gap-3">
                    <button
                      onClick={() => setSelectedSlot(null)}
                      className="rounded-lg border border-border bg-card px-5 md:px-6 py-2.5 text-body font-medium text-foreground transition-all hover:border-primary hover:text-primary"
                    >
                      Назад
                    </button>
                    <button
                      onClick={handleConfirmBooking}
                      disabled={isSubmitting}
                      className="rounded-lg bg-primary px-6 md:px-7 py-2.5 text-body font-semibold text-white transition-all hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isSubmitting ? "Загрузка..." : "Подтвердить запись"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ===== SUCCESS MODAL ===== */}
      {showSuccessModal && confirmedBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md animate-[fadeUp_0.3s_ease] rounded-xl bg-card p-9 text-center shadow-xl">
            <div className="mx-auto mb-5 flex h-[72px] w-[72px] items-center justify-center rounded-full border border-green-200 bg-green-50">
              <Check className="h-8 w-8 stroke-green-700 stroke-[2.5]" />
            </div>
            <div className="mb-2 text-h3 font-extrabold text-foreground">
              Запись подтверждена!
            </div>
            <p className="mb-6 text-body text-muted-foreground">
              Вы записаны на приём. Мы пришлём напоминание за день до визита.
            </p>
            <div className="mb-6 space-y-1.5 rounded-lg bg-background p-4 text-left text-label">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Врач:</span>
                <span className="font-semibold text-foreground">
                  {confirmedBooking.doctor.name}, {confirmedBooking.doctor.specialty}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Дата:</span>
                <span className="font-semibold text-foreground">{confirmedBooking.date}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Время:</span>
                <span className="font-semibold text-foreground">{confirmedBooking.time}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Статус:</span>
                <Badge variant="amber">Ожидание подтверждения</Badge>
              </div>
            </div>
            <button
              onClick={handleCloseSuccess}
              className="w-full rounded-lg bg-primary px-6 py-3 text-body font-semibold text-white"
            >
              Перейти к моим записям
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
