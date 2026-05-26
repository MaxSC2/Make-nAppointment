"use client";

import { useState, useMemo } from "react";
import { Search, ChevronLeft, ChevronRight, Calendar, Check } from "lucide-react";
import { Header, MobileHeader } from "@/components/layout/Header";
import { MobileNav } from "@/components/layout/MobileNav";
import {
  doctors as mockDoctors,
  TIME_SLOTS,
  RU_MONTHS_GEN,
  RU_DAYS_SHORT,
  initialAppointments,
} from "@/lib/mockData";
import { Badge } from "@/components/ui/Badge";
import { DoctorCard } from "@/components/appointment/DoctorCard";
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

function getNextDays(count: number): Date[] {
  const today = getToday();
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    return d;
  });
}

export default function AppointmentPage() {
  const [activeTab, setActiveTab] = useState<"doctors" | "my">("doctors");
  const [searchQuery, setSearchQuery] = useState("");
  const [specFilter, setSpecFilter] = useState("");
  const [availFilter, setAvailFilter] = useState("");
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [appointments, setAppointments] =
    useState<Appointment[]>(initialAppointments);
  const [showModal, setShowModal] = useState(false);
  const [bookingDoctor, setBookingDoctor] = useState<Doctor | null>(null);
  const [bookingDate, setBookingDate] = useState<Date | null>(null);
  const [bookingSlot, setBookingSlot] = useState<string | null>(null);

  const filteredDoctors = useMemo(() => {
    return mockDoctors.filter((doc) => {
      const q = searchQuery.toLowerCase();
      const matchQ =
        !q ||
        doc.name.toLowerCase().includes(q) ||
        doc.specialty.toLowerCase().includes(q);
      const matchSpec = !specFilter || doc.specialty === specFilter;
      const matchAvail = availFilter !== "available" || doc.available;
      return matchQ && matchSpec && matchAvail;
    });
  }, [searchQuery, specFilter, availFilter]);

  const days = useMemo(() => getNextDays(14), []);

  const busySlots = useMemo(() => {
    const set = new Set<string>();
    if (selectedDoctor) {
      selectedDoctor.slots.forEach((s) => {
        if (!s.available) set.add(s.time);
      });
    }
    return set;
  }, [selectedDoctor]);

  function handleSelectDoctor(doctor: Doctor) {
    setSelectedDoctor(doctor);
    setSelectedDate(null);
    setSelectedSlot(null);
    setBookingDoctor(null);
    setBookingDate(null);
    setBookingSlot(null);
  }

  function handleSelectDate(date: Date) {
    setSelectedDate(date);
    setSelectedSlot(null);
  }

  function handleSelectSlot(time: string) {
    setSelectedSlot(time);
  }

  function handleConfirmBooking() {
    if (!selectedDoctor || !selectedDate || !selectedSlot) return;
    setBookingDoctor(selectedDoctor);
    setBookingDate(selectedDate);
    setBookingSlot(selectedSlot);
    setShowModal(true);

    setAppointments((prev) => [
      {
        id: Date.now(),
        doctor: selectedDoctor,
        date: formatDate(selectedDate),
        time: selectedSlot,
        status: "pending",
      },
      ...prev,
    ]);
  }

  function handleCloseModal() {
    setShowModal(false);
    setSelectedDoctor(null);
    setSelectedDate(null);
    setSelectedSlot(null);
    setActiveTab("my");
  }

  function handleCancelAppt(id: number) {
    setAppointments((prev) => prev.filter((a) => a.id !== id));
  }

  return (
    <div className="min-h-screen bg-background font-sans">
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
              <div className="relative min-w-[200px] flex-1 md:max-w-[360px]">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Поиск по имени или специализации..."
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
                <option value="available">Есть свободные слоты</option>
              </select>
            </div>

            {/* Doctor Cards Grid */}
            <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filteredDoctors.length > 0 ? (
                filteredDoctors.map((doctor) => (
                  <DoctorCard
                    key={doctor.id}
                    doctor={doctor}
                    selected={selectedDoctor?.id === doctor.id}
                    onSelect={handleSelectDoctor}
                  />
                ))
              ) : (
                <div className="col-span-full py-16 text-center">
                  <div className="mb-4 text-4xl">🔍</div>
                  <div className="text-h3 font-semibold text-foreground">
                    Врачи не найдены
                  </div>
                  <p className="mt-1 text-body text-muted-foreground">
                    Попробуйте изменить фильтры
                  </p>
                </div>
              )}
            </div>

            {/* Slot Picker */}
            {selectedDoctor && (
              <div className="mb-6 rounded-xl border border-border bg-card p-6">
                <div className="mb-4 text-h3 font-bold text-foreground">
                  Запись к {selectedDoctor.name} — выберите дату
                </div>

                {/* Calendar Nav */}
                <div className="mb-4 flex items-center gap-4">
                  <button
                    onClick={() => {}}
                    className="rounded-md border border-border p-1.5 text-muted-foreground hover:border-primary hover:text-primary"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <span className="text-body font-semibold text-foreground">
                    {days.length > 0
                      ? days[0].toLocaleDateString("ru-RU", {
                          month: "long",
                          year: "numeric",
                        })
                      : ""}
                  </span>
                  <button
                    onClick={() => {}}
                    className="rounded-md border border-border p-1.5 text-muted-foreground hover:border-primary hover:text-primary"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>

                {/* Date Pills */}
                <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
                  {days.map((d) => {
                    const today = getToday();
                    const isPast = d < today;
                    const isSelected =
                      selectedDate?.toDateString() === d.toDateString();
                    return (
                      <button
                        key={d.toISOString()}
                        disabled={isPast}
                        onClick={() => handleSelectDate(d)}
                        className={`flex w-[60px] shrink-0 flex-col items-center rounded-xl px-2 py-2.5 text-center transition-all ${
                          isSelected
                            ? "bg-primary text-white"
                            : isPast
                              ? "cursor-not-allowed opacity-40"
                              : "border border-border bg-background hover:border-primary hover:bg-primary/10"
                        }`}
                      >
                        <span className="text-lg font-bold leading-tight">
                          {d.getDate()}
                        </span>
                        <span className="text-micro uppercase opacity-75">
                          {RU_DAYS_SHORT[d.getDay()]}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Time Slots */}
                <div className="mb-2 text-label font-semibold text-muted-foreground">
                  Доступное время
                </div>
                <div className="flex flex-wrap gap-2">
                  {selectedDate ? (
                    TIME_SLOTS.map((time) => {
                      const busy = busySlots.has(time);
                      const isSelected = selectedSlot === time;
                      return (
                        <button
                          key={time}
                          disabled={busy}
                          onClick={() => !busy && handleSelectSlot(time)}
                          className={`rounded-lg border px-4 py-2 text-label font-medium transition-all ${
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
                    })
                  ) : (
                    <span className="text-label text-muted-foreground">
                      Выберите дату
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Booking Form */}
            {selectedDoctor && selectedDate && selectedSlot && (
              <div className="rounded-xl border border-border bg-card p-6">
                <div className="mb-5 text-h3 font-bold text-foreground">
                  Подтверждение записи
                </div>

                {/* Summary */}
                <div className="mb-5 rounded-lg border border-teal-200 bg-teal-50 p-4">
                  <div className="mb-2 text-label font-semibold text-primary">
                    Детали записи
                  </div>
                  <div className="space-y-1 text-label">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Врач:</span>
                      <span className="font-semibold text-foreground">
                        {selectedDoctor.name}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">
                        Специализация:
                      </span>
                      <span className="font-semibold text-foreground">
                        {selectedDoctor.specialty}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Дата:</span>
                      <span className="font-semibold text-foreground">
                        {selectedDate
                          ? formatDate(selectedDate)
                          : ""}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Время:</span>
                      <span className="font-semibold text-foreground">
                        {selectedSlot}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Form Fields */}
                <div className="mb-5 grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-label font-medium text-muted-foreground">
                      ФИО пациента
                    </label>
                    <input
                      type="text"
                      value="Асель Мухамеджанова"
                      readOnly
                      className="rounded-lg border border-border bg-background px-3.5 py-2.5 text-body text-foreground"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-label font-medium text-muted-foreground">
                      Телефон
                    </label>
                    <input
                      type="tel"
                      defaultValue="+7 701 234 56 78"
                      className="rounded-lg border border-border bg-card px-3.5 py-2.5 text-body text-foreground focus:border-primary focus:outline-none"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-label font-medium text-muted-foreground">
                      Тип приёма
                    </label>
                    <select className="rounded-lg border border-border bg-card px-3.5 py-2.5 text-body text-foreground focus:border-primary focus:outline-none">
                      <option>Первичный приём</option>
                      <option>Повторный приём</option>
                      <option>Консультация</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-label font-medium text-muted-foreground">
                      Полис ОМС
                    </label>
                    <input
                      type="text"
                      defaultValue="010-2024-KZ-4521897"
                      className="rounded-lg border border-border bg-card px-3.5 py-2.5 text-body text-foreground focus:border-primary focus:outline-none"
                    />
                  </div>
                </div>
                <div className="mb-5 flex flex-col gap-1.5">
                  <label className="text-label font-medium text-muted-foreground">
                    Жалобы / причина визита
                  </label>
                  <textarea
                    placeholder="Опишите симптомы или причину обращения..."
                    className="min-h-[80px] rounded-lg border border-border bg-card px-3.5 py-2.5 text-body text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                  />
                </div>

                {/* Actions */}
                <div className="flex flex-col-reverse justify-end gap-3 md:flex-row">
                  <button
                    onClick={() => {
                      setSelectedSlot(null);
                    }}
                    className="rounded-lg border border-border bg-card px-6 py-2.5 text-body font-medium text-foreground transition-all hover:border-primary hover:text-primary"
                  >
                    Отмена
                  </button>
                  <button
                    onClick={handleConfirmBooking}
                    className="rounded-lg bg-primary px-7 py-2.5 text-body font-semibold text-white transition-all hover:opacity-90"
                  >
                    Подтвердить запись
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ===== TAB: MY APPOINTMENTS ===== */}
        {activeTab === "my" && (
          <div>
            {appointments.length === 0 ? (
              <div className="py-16 text-center">
                <div className="mb-4 text-4xl">📅</div>
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
                    className="flex flex-wrap items-center gap-4 rounded-xl border border-border bg-card p-5"
                  >
                    <div className="h-12 w-12 shrink-0 overflow-hidden rounded-full border border-border">
                      <img
                        src={appt.doctor.imageUrl}
                        alt={appt.doctor.name}
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
                      <button className="rounded-lg border border-teal-200 bg-card px-3.5 py-1.5 text-label font-medium text-primary transition-all hover:bg-teal-50">
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

      {/* ===== SUCCESS MODAL ===== */}
      {showModal && (
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
                  {bookingDoctor?.name}, {bookingDoctor?.specialty}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Дата:</span>
                <span className="font-semibold text-foreground">
                  {bookingDate ? formatDate(bookingDate) : ""}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Время:</span>
                <span className="font-semibold text-foreground">
                  {bookingSlot}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Статус:</span>
                <Badge variant="amber">Ожидание подтверждения</Badge>
              </div>
            </div>
            <button
              onClick={handleCloseModal}
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
