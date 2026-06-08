"use client";

import Image from "next/image";
import { Star } from "lucide-react";
import { type Doctor } from "@/types/appointment";
import { Badge } from "@/components/ui/Badge";

interface DoctorCardProps {
  doctor: Doctor;
  selected: boolean;
  onSelect: (doctor: Doctor) => void;
}

export function DoctorCard({ doctor, selected, onSelect }: DoctorCardProps) {
  return (
    <div
      onClick={() => doctor.available && onSelect(doctor)}
      onKeyDown={(e) => {
        if (doctor.available && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onSelect(doctor);
        }
      }}
      role="button"
      tabIndex={doctor.available ? 0 : -1}
      aria-disabled={!doctor.available}
      className={`rounded-xl border bg-card p-5 transition-all ${
        selected
          ? "border-primary shadow-[0_0_0_3px_rgba(23,135,135,0.12)]"
          : "border-border hover:border-teal-300 hover:shadow-md"
      } ${doctor.available ? "cursor-pointer" : "cursor-default"}`}
    >
      <div className="mb-4 flex gap-3.5">
        <div className="h-14 w-14 shrink-0 overflow-hidden rounded-full border border-border">
          <Image
            src={doctor.imageUrl}
            alt={doctor.name}
            width={56}
            height={56}
            className="h-full w-full object-cover"
          />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-h3 font-bold text-foreground">
            {doctor.name}
          </div>
          <div className="text-label text-muted-foreground">
            {doctor.specialty} · {doctor.clinic}
          </div>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            <Badge variant="teal">Стаж {doctor.experience}</Badge>
            {doctor.available ? (
              <Badge variant="green">Можно записаться</Badge>
            ) : (
              <Badge variant="red">Нет записи</Badge>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-border pt-3 text-label">
        <div className="flex items-center gap-1 font-semibold text-foreground">
          <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
          {doctor.rating}
        </div>
        <div className="font-semibold text-foreground">{doctor.price}</div>
        <button
          disabled={!doctor.available}
          onClick={(e) => {
            e.stopPropagation();
            if (doctor.available) onSelect(doctor);
          }}
          className={`rounded-lg px-4 py-2 text-label font-semibold transition-all ${
            doctor.available
              ? "bg-primary text-white hover:opacity-90"
              : "cursor-not-allowed bg-gray-100 text-muted-foreground"
          }`}
        >
          Записаться
        </button>
      </div>
    </div>
  );
}
