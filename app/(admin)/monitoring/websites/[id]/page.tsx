"use client";

import { useEffect, useState, Suspense } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import type { HealthScore } from "@/lib/services/monitoring/types";

interface WebsiteDetailData {
  website: {
    id: string;
    businessName: string;
    domain: string;
    homepageUrl: string;
    bookingUrl: string | null;
    monitoringEnabled: boolean;
    monitoringFrequency: number;
  };
  latestCheck: {
    id: string;
    checkedAt: string;
    homepageStatus: number | null;
    bookingStatus: number | null;
    responseTime: number | null;
    sslDaysRemaining: number | null;
    dnsStatus: string | null;
  } | null;
  healthScore: HealthScore;
  openIncidents: Array<{ id: string; type: string; severity: string; startedAt: string; message: string }>;
  recentIncidents: Array<{ id: string; type: string; severity: string; startedAt: string; endedAt: string | null; resolved: boolean; message: string }>;
  recentChecks: Array<{ id: string; checkedAt: string; homepageStatus: number | null; bookingStatus: number | null; responseTime: number | null; sslDaysRemaining: number | null; dnsStatus: string | null }>;
}

const STATUS_LABELS: Record<string, string> = {
  healthy: "Healthy", warning: "Needs Attention", critical: "At Risk", unknown: "No Data",
};

function WebsiteDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const adminKey = searchParams.get("admin_key") ?? "";
  const id = params.id as string;

  const [data, setData] = useState<WebsiteDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/admin/monitoring/websites/${id}?admin_key=${adminKey}`);
        if (!res.ok) { setError("Website not found."); return; }
        setData(await res.json());
      } catch { setError("Network error."); }
      finally { setLoading(false); }
    }
    load();
  }, [id, adminKey]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 animate-pulse rounded bg-gray-100" />
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {[...Array(4)].map((_, i) => <div key={i} className="h-28 animate-pulse rounded-2xl bg-gray-100" />)}
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="glass-card rounded-2xl bg-white p-8 text-center">
        <p className="text-[#DC2626]">{error}</p>
        <Link href={`/monitoring/overview?admin_key=${adminKey}`} className="mt-3 inline-block text-sm text-[#2DA4A9] hover:underline">
          ← Back to overview
        </Link>
      </div>
    );
  }

  const { website, latestCheck, healthScore, recentIncidents, recentChecks } = data;
  const keyParam = `?admin_key=${encodeURIComponent(adminKey)}`;
  const statusColor = healthScore.status === "healthy" ? "#16A34A" : healthScore.status === "warning" ? "#D97706" : "#DC2626";

  return (
    <div className="space-y-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm">
        <Link href={`/monitoring/overview${keyParam}`} className="text-[#8C97A8] hover:text-[#2DA4A9]">
          Monitoring
        </Link>
        <span className="text-[#C4CCD4]">/</span>
        <span className="font-medium text-[#0A1628]">{website.businessName}</span>
      </div>

      {/* Hero */}
      <div className="glass-card rounded-2xl bg-white p-8">
        <div className="flex flex-col items-start gap-6 sm:flex-row sm:items-center">
          {/* Health gauge — simple ring */}
          <div className="relative flex h-28 w-28 shrink-0 items-center justify-center">
            <svg width="112" height="112" viewBox="0 0 112 112" className="-rotate-90">
              <circle cx="56" cy="56" r="48" fill="none" stroke="#E6EBF0" strokeWidth="8" />
              <circle
                cx="56" cy="56" r="48"
                fill="none"
                stroke={statusColor}
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={`${(healthScore.total / 100) * 301.6} 301.6`}
                style={{ transition: "stroke-dasharray 0.8s ease" }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-bold tracking-tight text-[#0A1628]">
                {healthScore.status === "unknown" ? "—" : healthScore.total}
              </span>
            </div>
          </div>

          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-[#0A1628]">
              {website.businessName}
            </h1>
            <p className="text-[#8C97A8]">{website.domain}</p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <span
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium"
                style={{ backgroundColor: statusColor + "15", color: statusColor }}
              >
                <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: statusColor }} />
                {STATUS_LABELS[healthScore.status]}
              </span>
              {latestCheck && (
                <span className="text-xs text-[#8C97A8]">
                  Last checked: {new Date(latestCheck.checkedAt).toLocaleString()}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <MetricCard label="Response Time" value={latestCheck?.responseTime ? `${latestCheck.responseTime}ms` : "—"} ok={latestCheck?.responseTime != null && latestCheck.responseTime < 2000} />
        <MetricCard label="SSL" value={latestCheck?.sslDaysRemaining != null ? `${latestCheck.sslDaysRemaining}d` : "—"} ok={latestCheck?.sslDaysRemaining != null && latestCheck.sslDaysRemaining > 30} />
        <MetricCard label="DNS" value={latestCheck?.dnsStatus === "ok" ? "OK" : latestCheck?.dnsStatus ?? "—"} ok={latestCheck?.dnsStatus === "ok"} />
        <MetricCard label="Booking Page" value={latestCheck?.bookingStatus != null ? `HTTP ${latestCheck.bookingStatus}` : "—"} ok={latestCheck?.bookingStatus != null && latestCheck.bookingStatus >= 200 && latestCheck.bookingStatus < 300} />
      </div>

      {/* Score breakdown */}
      <div className="glass-card rounded-2xl bg-white p-6">
        <h2 className="mb-4 text-lg font-semibold tracking-tight text-[#0A1628]">Health Score</h2>
        <div className="space-y-3">
          <ScoreRow label="Website Online" points={healthScore.breakdown.websiteOnline} max={30} />
          <ScoreRow label="Booking Online" points={healthScore.breakdown.bookingOnline} max={20} />
          <ScoreRow label="SSL Valid" points={healthScore.breakdown.sslValid} max={20} />
          <ScoreRow label="DNS OK" points={healthScore.breakdown.dnsOk} max={15} />
          <ScoreRow label="Performance" points={healthScore.breakdown.performance} max={15} />
          {healthScore.breakdown.incidentPenalty > 0 && (
            <ScoreRow label="Incident Penalty" points={-healthScore.breakdown.incidentPenalty} max={0} negative />
          )}
        </div>
      </div>

      {/* Incidents + Checks */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="glass-card rounded-2xl bg-white p-6">
          <h2 className="mb-4 text-lg font-semibold tracking-tight text-[#0A1628]">Incidents</h2>
          {recentIncidents.length === 0 ? (
            <p className="py-8 text-center text-sm text-[#8C97A8]">No incidents</p>
          ) : (
            <div className="space-y-3">
              {recentIncidents.map((i) => (
                <div key={i.id} className="rounded-xl border border-[#E6EBF0] p-3">
                  <div className="flex items-center gap-2">
                    <span className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${
                      i.severity === "critical" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"
                    }`}>
                      {i.type.replace(/_/g, " ")}
                    </span>
                    {i.resolved && <span className="text-[11px] text-[#8C97A8]">Resolved</span>}
                  </div>
                  <p className="mt-1 text-sm text-[#0A1628]">{i.message}</p>
                  <p className="mt-1 text-xs text-[#8C97A8]">{new Date(i.startedAt).toLocaleString()}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="glass-card rounded-2xl bg-white p-6">
          <h2 className="mb-4 text-lg font-semibold tracking-tight text-[#0A1628]">Check History</h2>
          {recentChecks.length === 0 ? (
            <p className="py-8 text-center text-sm text-[#8C97A8]">No checks yet</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-[#E6EBF0] text-[#8C97A8]">
                    <th className="py-2 pr-3 font-medium">Time</th>
                    <th className="py-2 pr-3 font-medium">Home</th>
                    <th className="py-2 pr-3 font-medium">Book</th>
                    <th className="py-2 pr-3 font-medium">ms</th>
                    <th className="py-2 font-medium">SSL</th>
                  </tr>
                </thead>
                <tbody>
                  {recentChecks.slice(0, 20).map((c) => (
                    <tr key={c.id} className="border-b border-[#E6EBF0] text-[#5B6776]">
                      <td className="py-2 pr-3 whitespace-nowrap">{new Date(c.checkedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</td>
                      <td className="py-2 pr-3"><StatusCode c={c.homepageStatus} /></td>
                      <td className="py-2 pr-3"><StatusCode c={c.bookingStatus} /></td>
                      <td className="py-2 pr-3 font-mono text-xs">{c.responseTime ?? "—"}</td>
                      <td className="py-2">{c.sslDaysRemaining != null ? `${c.sslDaysRemaining}d` : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MetricCard({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return (
    <div className="glass-card rounded-2xl bg-white p-5">
      <p className="text-sm text-[#5B6776]">{label}</p>
      <p className={`mt-1 text-2xl font-bold tracking-tight ${ok ? "text-[#16A34A]" : "text-[#DC2626]"}`}>
        {value}
      </p>
    </div>
  );
}

function ScoreRow({ label, points, max, negative }: { label: string; points: number; max: number; negative?: boolean }) {
  const pct = max > 0 ? Math.round((Math.abs(points) / max) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="w-32 text-sm text-[#5B6776]">{label}</span>
      <div className="flex-1">
        <div className="h-2 overflow-hidden rounded-full bg-[#E6EBF0]">
          <div
            className={`h-full rounded-full transition-all ${negative ? "bg-[#DC2626]" : "bg-[#2DA4A9]"}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
      <span className={`w-10 text-right text-sm font-medium tabular-nums ${negative ? "text-[#DC2626]" : "text-[#0A1628]"}`}>
        {negative ? `-${points}` : `${points}/${max}`}
      </span>
    </div>
  );
}

function StatusCode({ c }: { c: number | null }) {
  if (c === null) return <span className="text-[#DC2626]">Err</span>;
  const ok = c >= 200 && c < 300;
  return <span className={ok ? "text-[#16A34A]" : "text-[#DC2626]"}>{c}</span>;
}

export default function WebsiteDetailPageWrapper() {
  return (
    <Suspense fallback={<div className="h-64 animate-pulse rounded-2xl bg-gray-100" />}>
      <WebsiteDetailPage />
    </Suspense>
  );
}
