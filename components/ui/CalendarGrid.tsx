"use client";

import { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface CalendarGridProps {
  selectedDate: Date | null;
  onSelectDate: (date: Date) => void;
  minDate?: Date;
  busyDates?: Date[];
}

const RU_DAYS_SHORT = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];

function getMonthDays(year: number, month: number): Date[] {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startPad = firstDay.getDay();
  const days: Date[] = [];

  for (let i = 0; i < startPad; i++) {
    days.push(new Date(year, month, -startPad + i + 1));
  }
  for (let i = 1; i <= lastDay.getDate(); i++) {
    days.push(new Date(year, month, i));
  }

  const remaining = 42 - days.length;
  for (let i = 1; i <= remaining; i++) {
    days.push(new Date(year, month + 1, i));
  }

  return days;
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function getToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export function CalendarGrid({
  selectedDate,
  onSelectDate,
  minDate,
  busyDates,
}: CalendarGridProps) {
  const today = useMemo(() => getToday(), []);
  const effectiveMin = minDate || today;

  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());

  const days = useMemo(
    () => getMonthDays(viewYear, viewMonth),
    [viewYear, viewMonth]
  );

  const monthLabel = new Date(viewYear, viewMonth).toLocaleDateString("ru-RU", {
    month: "long",
    year: "numeric",
  });

  function prevMonth() {
    if (viewMonth === 0) {
      setViewYear((y) => y - 1);
      setViewMonth(11);
    } else {
      setViewMonth((m) => m - 1);
    }
  }

  function nextMonth() {
    if (viewMonth === 11) {
      setViewYear((y) => y + 1);
      setViewMonth(0);
    } else {
      setViewMonth((m) => m + 1);
    }
  }

  const isFutureAllowed = useMemo(() => {
    const lastVisible = days[days.length - 1];
    return lastVisible >= effectiveMin;
  }, [days, effectiveMin]);

  return (
    <div className="w-full">
      {/* Month Nav */}
      <div className="mb-4 flex items-center justify-between">
        <button
          onClick={prevMonth}
          className="rounded-md border border-border p-1.5 text-muted-foreground hover:border-primary hover:text-primary"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-body font-semibold capitalize text-foreground">
          {monthLabel}
        </span>
        <button
          onClick={nextMonth}
          className="rounded-md border border-border p-1.5 text-muted-foreground hover:border-primary hover:text-primary"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Day-of-week headers */}
      <div className="mb-1 grid grid-cols-7">
        {RU_DAYS_SHORT.map((d) => (
          <div
            key={d}
            className="py-1.5 text-center text-micro font-semibold uppercase text-muted-foreground"
          >
            {d}
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7">
        {days.map((d, idx) => {
          const isCurrentMonth = d.getMonth() === viewMonth;
          const isToday = isSameDay(d, today);
          const isPast = d < effectiveMin;
          const isSelected = selectedDate ? isSameDay(d, selectedDate) : false;
          const isWeekend = d.getDay() === 0 || d.getDay() === 6;

          return (
            <button
              key={d.getTime()}
              disabled={!isCurrentMonth || isPast}
              onClick={() => onSelectDate(d)}
              className={`relative flex items-center justify-center py-2 text-body transition-all ${
                !isCurrentMonth
                  ? "cursor-default text-border"
                  : isPast
                    ? "cursor-not-allowed text-muted-foreground/30"
                    : isSelected
                      ? "z-10 rounded-full bg-primary font-bold text-white"
                      : isToday
                        ? "rounded-full border border-primary font-semibold text-primary"
                        : "rounded-full hover:bg-primary/10 hover:text-primary"
              } ${isWeekend && !isSelected && isCurrentMonth && !isPast ? "text-muted-foreground/50" : ""}`}
            >
              {d.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}
