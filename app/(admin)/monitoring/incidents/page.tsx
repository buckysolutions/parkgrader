"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { IncidentTimeline } from "@/components/monitoring/IncidentTimeline";

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
  const adminKey = params.get("admin_key") ?? "";
  const filter = params.get("status") ?? "open";

  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(
          `/api/admin/monitoring/incidents?status=${filter}&admin_key=${adminKey}`,
        );
        if (res.ok) {
          const data = await res.json();
          setIncidents(data.incidents ?? []);
        }
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [adminKey, filter]);

  async function resolveIncident(id: string) {
    await fetch(`/api/admin/monitoring/incidents?admin_key=${adminKey}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, resolved: true }),
    });
    setIncidents((prev) =>
      prev.map((i) => (i.id === id ? { ...i, resolved: true } : i)),
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#0A1628]">Incidents</h1>
          <p className="mt-1 text-sm text-[#8C97A8]">
            Track and resolve website issues
          </p>
        </div>
        <div className="flex gap-2">
          {(["open", "resolved"] as const).map((f) => (
            <a
              key={f}
              href={`/monitoring/incidents?admin_key=${adminKey}&status=${f}`}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                filter === f
                  ? "bg-[#2DA4A9] text-white"
                  : "bg-gray-100 text-[#5B6776] hover:bg-gray-200"
              }`}
            >
              {f === "open" ? "Open" : "Resolved"}
            </a>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="h-64 animate-pulse rounded-xl bg-gray-100" />
      ) : (
        <div className="glass-card rounded-xl bg-white p-5">
          <IncidentTimeline
            incidents={incidents.map((i) => ({
              id: i.id,
              type: `${i.website.businessName} — ${i.type}`,
              severity: i.severity as "critical" | "warning",
              startedAt: i.startedAt,
              endedAt: i.endedAt,
              resolved: i.resolved,
              message: i.message,
            }))}
          />
        </div>
      )}
    </div>
  );
}

export default function IncidentsPageWrapper() {
  return (
    <Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-gray-100" />}>
      <IncidentsPage />
    </Suspense>
  );
}
