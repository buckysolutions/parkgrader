"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

interface Incident {
  id: string;
  website: { businessName: string; domain: string };
  type: string;
  severity: string;
  startedAt: string;
  endedAt: string | null;
  resolved: boolean;
  message: string;
}

function IncidentsPage() {
  const params = useSearchParams();
  const filter = params.get("status") ?? "open";

  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/admin/monitoring/incidents?status=${filter}`);
        if (res.ok) setIncidents((await res.json()).incidents ?? []);
      } finally { setLoading(false); }
    }
    load();
  }, [filter]);

  async function resolveIncident(id: string) {
    await fetch("/api/admin/monitoring/incidents", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, resolved: true }),
    });
    setIncidents((prev) => prev.map((i) => (i.id === id ? { ...i, resolved: true, endedAt: new Date().toISOString() } : i)));
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm">
            <Link href="/monitoring" className="text-[#8C97A8] hover:text-[#2DA4A9]">Monitoring</Link>
            <span className="text-[#C4CCD4]">/</span>
            <span className="font-medium text-[#0A1628]">Incidents</span>
          </div>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-[#0A1628]">Incidents</h1>
        </div>
        <div className="flex gap-1 rounded-xl bg-gray-100 p-1">
          {(["open", "resolved"] as const).map((f) => (
            <Link key={f} href={`/monitoring/incidents?status=${f}`}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium capitalize transition ${filter === f ? "bg-white text-[#0A1628] shadow-sm" : "text-[#5B6776] hover:text-[#0A1628]"}`}>
              {f}
            </Link>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => <div key={i} className="h-24 animate-pulse rounded-2xl bg-gray-100" />)}
        </div>
      ) : incidents.length === 0 ? (
        <div className="glass-card rounded-2xl bg-white py-16 text-center"><p className="text-[#8C97A8]">No {filter} incidents</p></div>
      ) : (
        <div className="space-y-3">
          {incidents.map((i) => (
            <div key={i.id} className="glass-card rounded-2xl bg-white p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-[#0A1628]">{i.website.businessName} <span className="text-sm font-normal text-[#8C97A8]">{i.website.domain}</span></p>
                  <div className="mt-1 flex items-center gap-2">
                    <span className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${i.severity === "critical" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>
                      {i.type.replace(/_/g, " ")}
                    </span>
                    {!i.resolved && <span className="h-1.5 w-1.5 rounded-full bg-[#DC2626]" />}
                  </div>
                  <p className="mt-2 text-sm text-[#0A1628]">{i.message}</p>
                  <p className="mt-1 text-xs text-[#8C97A8]">
                    Started {new Date(i.startedAt).toLocaleString()}
                    {i.endedAt && ` — Ended ${new Date(i.endedAt).toLocaleString()}`}
                  </p>
                </div>
                {!i.resolved && (
                  <button onClick={() => resolveIncident(i.id)} style={{ borderRadius: "12px" }} className="bg-[#0A1628] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#0A1628]/80">
                    Resolve
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function IncidentsPageWrapper() {
  return (
    <Suspense fallback={<div className="h-64 animate-pulse rounded-2xl bg-gray-100" />}>
      <IncidentsPage />
    </Suspense>
  );
}
