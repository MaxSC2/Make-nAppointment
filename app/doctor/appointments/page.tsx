"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, Clock, CheckCircle, XCircle, FlaskConical, Stethoscope, FileText, Loader } from "lucide-react";
import { useQuery } from "@/lib/api/hooks";
import { fetchDoctorAppointments, createLabTest } from "@/lib/api";
import type { DoctorAppointment } from "@/lib/mockData";

const DEMO_PATIENT_ID = "patient-1";
const DEMO_DOCTOR_NAME = "Нурланов А.С.";

const statusColor: Record<string, string> = {
  "Ожидает": "text-amber-600 bg-amber-50",
  "В процессе": "text-blue-600 bg-blue-50",
  "Завершён": "text-green-600 bg-green-50",
};

const statusIcon: Record<string, React.ComponentType<{ className?: string }>> = {
  "Ожидает": Clock,
  "В процессе": Clock,
  "Завершён": CheckCircle,
};

const LAB_TEMPLATES = [
  { name: "Общий анализ крови", category: "Гематология" },
  { name: "Биохимия крови", category: "Биохимия" },
  { name: "Анализ мочи общий", category: "Гематология" },
  { name: "Гормоны щитовидной железы", category: "Эндокринология" },
  { name: "Липидный профиль", category: "Биохимия" },
  { name: "Коагулограмма", category: "Гемостаз" },
];

function Toast({ message, type, onClose }: { message: string; type: "success" | "error"; onClose: () => void }) {
  return (
    <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-lg px-5 py-3 text-body font-medium shadow-xl ${
      type === "success" ? "bg-green-600 text-white" : "bg-red-600 text-white"
    }`}>
      {message}
      <button onClick={onClose} className="ml-2 text-white/70 hover:text-white">×</button>
    </div>
  );
}

function LabDialog({ onClose, onCreate }: { onClose: () => void; onCreate: (name: string, category: string) => Promise<void> }) {
  const [loading, setLoading] = useState<string | null>(null);

  async function handleClick(name: string, category: string) {
    setLoading(name);
    await onCreate(name, category);
    setLoading(null);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-sm rounded-xl border border-border bg-card p-6 shadow-xl">
        <h2 className="mb-1 text-h3 font-bold text-foreground">Назначить анализ</h2>
        <p className="mb-5 text-body text-muted-foreground">Выберите тип анализа</p>
        <div className="flex flex-col gap-2">
          {LAB_TEMPLATES.map((t) => (
            <button
              key={t.name}
              onClick={() => handleClick(t.name, t.category)}
              disabled={loading !== null}
              className="flex items-center gap-3 rounded-lg border border-border px-4 py-3 text-left text-body text-foreground transition-colors hover:border-primary/30 hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading === t.name ? (
                <Loader className="h-4 w-4 animate-spin text-primary" />
              ) : (
                <FlaskConical className="h-4 w-4 text-primary" />
              )}
              <div>
                <div className="font-medium">{t.name}</div>
                <div className="text-label text-muted-foreground">{t.category}</div>
              </div>
            </button>
          ))}
        </div>
        <button onClick={onClose} className="mt-4 w-full rounded-lg border border-border bg-background py-2.5 text-body font-medium text-muted-foreground transition-colors hover:text-foreground">
          Отмена
        </button>
      </div>
    </div>
  );
}

export default function DoctorAppointmentsPage() {
  const { data: appointments, loading, refetch } = useQuery(fetchDoctorAppointments);
  const [selectedPatient, setSelectedPatient] = useState<string | null>(null);
  const [showLabDialog, setShowLabDialog] = useState(false);
  const [savingVisit, setSavingVisit] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const [complaints, setComplaints] = useState("");
  const [diagnosis, setDiagnosis] = useState("");
  const [prescriptions, setPrescriptions] = useState("");

  const selectedAppointment = (appointments ?? []).find((a) => a.patient === selectedPatient);

  function showToast(message: string, type: "success" | "error") {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  }

  async function handleCreateLab(name: string, category: string) {
    try {
      await createLabTest(DEMO_PATIENT_ID, {
        name,
        category,
        doctorName: DEMO_DOCTOR_NAME,
      });
      setShowLabDialog(false);
      showToast("Анализ назначен", "success");
    } catch {
      showToast("Ошибка при назначении анализа", "error");
    }
  }

  async function handleCompleteVisit() {
    if (!selectedAppointment) return;
    setSavingVisit(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 300));
      selectedAppointment.status = "Завершён";
      refetch();
      showToast("Приём сохранён", "success");
      setComplaints("");
      setDiagnosis("");
      setPrescriptions("");
    } catch {
      showToast("Ошибка при сохранении", "error");
    } finally {
      setSavingVisit(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="flex h-16 items-center border-b border-border bg-card px-6">
        <Link href="/doctor/dashboard" className="mr-4 text-muted-foreground hover:text-primary">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <span className="text-lg font-bold text-foreground">Записи на приём</span>
      </header>

      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-8 lg:flex-row">
        {/* List */}
        <div className="min-w-0 flex-1">
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-14 animate-pulse rounded-xl border border-border bg-card" />
              ))}
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-border">
              <div className="grid grid-cols-12 gap-4 border-b border-border bg-muted/30 px-5 py-3 text-label font-semibold text-muted-foreground">
                <div className="col-span-4">Пациент</div>
                <div className="col-span-2">Время</div>
                <div className="col-span-3">Тип</div>
                <div className="col-span-3">Статус</div>
              </div>
              {(appointments ?? []).map((a) => {
                const Icon = statusIcon[a.status] || XCircle;
                return (
                  <button
                    key={a.patient}
                    onClick={() => {
                      setSelectedPatient(a.patient);
                      setComplaints("");
                      setDiagnosis("");
                      setPrescriptions("");
                    }}
                    className={`w-full grid grid-cols-12 gap-4 border-b border-border px-5 py-4 text-left last:border-b-0 transition-colors hover:bg-muted/20 ${
                      selectedPatient === a.patient ? "bg-primary/5" : ""
                    }`}
                  >
                    <div className="col-span-4 text-body font-medium text-foreground">{a.patient}</div>
                    <div className="col-span-2 flex items-center gap-1.5 text-body text-muted-foreground">
                      <Clock className="h-3.5 w-3.5" /> {a.time}
                    </div>
                    <div className="col-span-3 text-body text-muted-foreground">{a.type}</div>
                    <div className="col-span-3">
                      <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-label font-medium ${statusColor[a.status]}`}>
                        <Icon className="h-3 w-3" /> {a.status}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Patient panel */}
        {selectedAppointment && (
          <div className="w-full shrink-0 lg:w-96">
            <div className="rounded-xl border border-border bg-card p-5">
              <h2 className="mb-1 text-h3 font-bold text-foreground">{selectedAppointment.patient}</h2>
              <p className="mb-5 text-label text-muted-foreground">
                {selectedAppointment.time} · {selectedAppointment.type}
              </p>

              {/* Lab referral */}
              <div className="mb-6">
                <button
                  onClick={() => setShowLabDialog(true)}
                  disabled={selectedAppointment.status === "Завершён"}
                  className="flex w-full items-center justify-center gap-2 rounded-lg border border-primary bg-primary/5 px-4 py-2.5 text-body font-semibold text-primary transition-colors hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <FlaskConical className="h-4 w-4" />
                  Назначить анализ
                </button>
              </div>

              {/* Visit completion */}
              <div>
                <h3 className="mb-3 flex items-center gap-1.5 text-body font-bold text-foreground">
                  <Stethoscope className="h-4 w-4 text-primary" />
                  Завершение приёма
                </h3>
                <div className="flex flex-col gap-3">
                  <div>
                    <label className="mb-1 block text-label font-medium text-muted-foreground">Жалобы</label>
                    <textarea
                      value={complaints}
                      onChange={(e) => setComplaints(e.target.value)}
                      rows={2}
                      disabled={selectedAppointment.status === "Завершён"}
                      className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-body text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none disabled:opacity-40"
                      placeholder="Головная боль, слабость..."
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-label font-medium text-muted-foreground">Диагноз</label>
                    <textarea
                      value={diagnosis}
                      onChange={(e) => setDiagnosis(e.target.value)}
                      rows={2}
                      disabled={selectedAppointment.status === "Завершён"}
                      className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-body text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none disabled:opacity-40"
                      placeholder="J06.9 — Острая инфекция верхних дыхательных путей"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-label font-medium text-muted-foreground">Назначения</label>
                    <textarea
                      value={prescriptions}
                      onChange={(e) => setPrescriptions(e.target.value)}
                      rows={2}
                      disabled={selectedAppointment.status === "Завершён"}
                      className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-body text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none disabled:opacity-40"
                      placeholder="Парацетамол 500 мг 3 раза в день..."
                    />
                  </div>
                  <button
                    onClick={handleCompleteVisit}
                    disabled={savingVisit || selectedAppointment.status === "Завершён"}
                    className="mt-1 flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-2.5 text-body font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {savingVisit ? (
                      <><Loader className="h-4 w-4 animate-spin" /> Сохранение…</>
                    ) : selectedAppointment.status === "Завершён" ? (
                      <><CheckCircle className="h-4 w-4" /> Приём завершён</>
                    ) : (
                      <><FileText className="h-4 w-4" /> Завершить приём</>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {showLabDialog && (
        <LabDialog
          onClose={() => setShowLabDialog(false)}
          onCreate={handleCreateLab}
        />
      )}

      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}
    </div>
  );
}
