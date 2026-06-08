"use client";

import { useState, useEffect } from "react";

export default function DebugPanel() {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<{ lab_tests: string; role: string }>({ lab_tests: "", role: "" });

  function refresh() {
    setData({
      lab_tests: localStorage.getItem("lab_tests") || "(пусто)",
      role: document.cookie.replace(/(?:(?:^|.*;\s*)role\s*=\s*([^;]*).*$)|^.*$/, "$1") || "(нет)",
    });
  }

  useEffect(() => {
    if (open) refresh();
  }, [open]);

  function handleClear() {
    localStorage.clear();
    window.location.reload();
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-4 left-4 z-50 cursor-pointer rounded-full bg-card px-3 py-1.5 text-label font-mono text-muted-foreground shadow-lg opacity-50 transition-opacity hover:opacity-100"
      >
        🛠 Debug
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-xl rounded-xl border border-border bg-card p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-h3 font-bold text-foreground">Debug Panel</h2>
              <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground">×</button>
            </div>

            <div className="mb-4">
              <div className="mb-1 text-label font-semibold text-muted-foreground">Cookie: role</div>
              <div className="rounded-lg border border-border bg-background px-3 py-2 font-mono text-body text-foreground">
                {data.role}
              </div>
            </div>

            <div className="mb-4">
              <div className="mb-1 text-label font-semibold text-muted-foreground">localStorage: lab_tests</div>
              <pre className="max-h-60 overflow-auto rounded-lg border border-border bg-background px-3 py-2 font-mono text-micro text-foreground">
                {data.lab_tests}
              </pre>
            </div>

            <button
              onClick={handleClear}
              className="w-full rounded-lg bg-red-600 py-2.5 text-body font-semibold text-white transition-opacity hover:opacity-90"
            >
              Сброс (Clear Storage)
            </button>
          </div>
        </div>
      )}
    </>
  );
}
