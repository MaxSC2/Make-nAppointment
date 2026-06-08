"use client";

import Link from "next/link";
import { ArrowLeft, Phone, MapPin } from "lucide-react";
import { useQuery } from "@/lib/api/hooks";
import { fetchAdminClinics } from "@/lib/api";

export default function AdminClinicsPage() {
  const { data: clinics, loading } = useQuery(fetchAdminClinics);

  return (
    <div className="min-h-screen bg-background">
      <header className="flex h-16 items-center border-b border-border bg-card px-6">
        <Link href="/admin/dashboard" className="mr-4 text-muted-foreground hover:text-primary">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <span className="text-lg font-bold text-foreground">Клиники</span>
      </header>

      <div className="mx-auto max-w-4xl px-6 py-8">
        {loading ? (
          <div className="grid gap-4 md:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-32 animate-pulse rounded-xl border border-border bg-card" />
            ))}
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {clinics?.map((c) => (
              <div key={c.name} className="rounded-xl border border-border bg-card p-5">
                <h3 className="mb-2 text-h3 font-bold text-foreground">{c.name}</h3>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 text-body text-muted-foreground">
                    <MapPin className="h-4 w-4 shrink-0" /> {c.address}
                  </div>
                  <div className="flex items-center gap-2 text-body text-muted-foreground">
                    <Phone className="h-4 w-4 shrink-0" /> {c.phone}
                  </div>
                  <div className="pt-1 text-label text-muted-foreground">Врачей: {c.doctors}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
