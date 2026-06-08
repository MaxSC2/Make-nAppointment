"use client";

import Link from "next/link";
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import { useQuery } from "@/lib/api/hooks";
import { fetchDoctorSchedule } from "@/lib/api";

export default function DoctorSchedulePage() {
  const { data, loading } = useQuery(fetchDoctorSchedule);

  return (
    <div className="min-h-screen bg-background">
      <header className="flex h-16 items-center border-b border-border bg-card px-6">
        <Link href="/doctor/dashboard" className="mr-4 text-muted-foreground hover:text-primary">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <span className="text-lg font-bold text-foreground">Расписание</span>
      </header>
      <div className="mx-auto max-w-5xl px-6 py-8">
        <div className="mb-6 flex items-center justify-between">
          <button className="flex items-center gap-1 text-body text-muted-foreground hover:text-primary">
            <ChevronLeft className="h-4 w-4" /> Пред.
          </button>
          <span className="text-h3 font-bold text-foreground">27 мая — 2 июня 2026</span>
          <button className="flex items-center gap-1 text-body text-muted-foreground hover:text-primary">
            След. <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        {loading ? (
          <div className="h-96 animate-pulse rounded-xl border border-border bg-card" />
        ) : (
          <div className="overflow-hidden rounded-xl border border-border">
            <div className="grid grid-cols-8 border-b border-border bg-muted/30">
              <div className="border-r border-border px-3 py-3 text-label font-semibold text-muted-foreground">Время</div>
              {data?.weekDays.map((d) => (
                <div key={d} className={`border-r border-border px-3 py-3 text-center text-label font-semibold last:border-r-0 ${data.schedule[d] ? "text-primary" : "text-muted-foreground"}`}>{d}</div>
              ))}
            </div>
            {data?.timeSlots.map((time) => (
              <div key={time} className="grid grid-cols-8 border-b border-border last:border-b-0">
                <div className="border-r border-border px-3 py-3 text-label text-muted-foreground">{time}</div>
                {data.weekDays.map((d) => {
                  const booked = data.schedule[d]?.includes(time);
                  return (
                    <div key={d} className={`border-r border-border px-3 py-3 text-center text-label last:border-r-0 ${booked ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground/30"}`}>
                      {booked ? "Приём" : "—"}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
