"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import type { HealthScore } from "@/lib/services/monitoring/types";

interface WebsiteDetailData {
  website: { id: string; businessName: string; domain: string; homepageUrl: string; bookingUrl: string | null; monitoringEnabled: boolean; monitoringFrequency: number; contactEmail: string | null; monthlyReportsEnabled: boolean };
  latestCheck: { id: string; checkedAt: string; homepageStatus: number | null; bookingStatus: number | null; responseTime: number | null; sslDaysRemaining: number | null; dnsStatus: string | null } | null;
  healthScore: HealthScore;
  openIncidents: Array<{ id: string; type: string; severity: string; startedAt: string; message: string }>;
  recentIncidents: Array<{ id: string; type: string; severity: string; startedAt: string; endedAt: string | null; resolved: boolean; message: string }>;
  recentChecks: Array<{ id: string; checkedAt: string; homepageStatus: number | null; bookingStatus: number | null; responseTime: number | null; sslDaysRemaining: number | null; dnsStatus: string | null }>;
}

export default function WebsiteDetailPage() {
  const params = useParams();
  const id = params.id as string;

  const [data, setData] = useState<WebsiteDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Settings form
  const [editingSettings, setEditingSettings] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsForm, setSettingsForm] = useState({ contactEmail: "", monitoringFrequency: 60, monitoringEnabled: true });
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/admin/monitoring/websites/${id}`);
        if (!res.ok) { setError("Website not found."); return; }
        const d = await res.json();
        setData(d);
        setSettingsForm({
          contactEmail: d.website.contactEmail || "",
          monitoringFrequency: d.website.monitoringFrequency,
          monitoringEnabled: d.website.monitoringEnabled,
        });
      } catch { setError("Network error."); }
      finally { setLoading(false); }
    }
    load();
  }, [id]);

  async function saveSettings() {
    setSavingSettings(true);
    const res = await fetch(`/api/admin/monitoring/websites/${website.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settingsForm),
    });
    if (res.ok) {
      const json = await res.json();
      setData((prev) => prev ? { ...prev, website: json.website } : prev);
      setEditingSettings(false);
    }
    setSavingSettings(false);
  }

  async function deleteWebsite() {
    await fetch(`/api/admin/monitoring/websites/${website.id}`, { method: "DELETE" });
    window.location.href = "/monitoring";
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 animate-pulse rounded bg-gray-100" />
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">{[...Array(4)].map((_, i) => <div key={i} className="h-28 animate-pulse rounded-2xl bg-gray-100" />)}</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="glass-card rounded-2xl bg-white p-8 text-center">
        <p className="text-[#DC2626]">{error}</p>
        <Link href="/monitoring" className="mt-3 inline-block text-sm text-[#2DA4A9] hover:underline">← Back to overview</Link>
      </div>
    );
  }

  const { website, latestCheck, healthScore, recentIncidents, recentChecks } = data;
  const statusColor = healthScore.status === "healthy" ? "#16A34A" : healthScore.status === "warning" ? "#D97706" : "#DC2626";
  const STATUS_LABELS: Record<string, string> = { healthy: "Healthy", warning: "Needs Attention", critical: "At Risk", unknown: "No Data" };

  async function toggleMonthlyReports() {
    const res = await fetch(`/api/admin/monitoring/websites/${website.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ monthlyReportsEnabled: !website.monthlyReportsEnabled }),
    });
    if (res.ok) {
      const json = await res.json();
      setData((prev) => prev ? { ...prev, website: json.website } : prev);
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-2 text-sm">
        <Link href="/monitoring" className="text-[#8C97A8] hover:text-[#2DA4A9]">Monitoring</Link>
        <span className="text-[#C4CCD4]">/</span>
        <span className="font-medium text-[#0A1628]">{website.businessName}</span>
      </div>

      <div className="glass-card rounded-2xl bg-white p-8">
        <div className="flex flex-col items-start gap-6 sm:flex-row sm:items-center">
          <div className="relative flex h-28 w-28 shrink-0 items-center justify-center">
            <svg width="112" height="112" viewBox="0 0 112 112" className="-rotate-90">
              <circle cx="56" cy="56" r="48" fill="none" stroke="#E6EBF0" strokeWidth="8" />
              <circle cx="56" cy="56" r="48" fill="none" stroke={statusColor} strokeWidth="8" strokeLinecap="round" strokeDasharray={`${(healthScore.total / 100) * 301.6} 301.6`} style={{ transition: "stroke-dasharray 0.8s ease" }} />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-bold tracking-tight text-[#0A1628]">{healthScore.status === "unknown" ? "—" : healthScore.total}</span>
            </div>
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-[#0A1628]">{website.businessName}</h1>
            <p className="text-[#8C97A8]">{website.domain}</p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium" style={{ backgroundColor: statusColor + "15", color: statusColor }}>
                <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: statusColor }} />{STATUS_LABELS[healthScore.status]}
              </span>
              {latestCheck && <span className="text-xs text-[#8C97A8]">Last checked: {new Date(latestCheck.checkedAt).toLocaleString()}</span>}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <MetricCard label="Response Time" value={latestCheck?.responseTime ? `${latestCheck.responseTime}ms` : "—"} ok={latestCheck?.responseTime != null && latestCheck.responseTime < 2000} />
        <MetricCard label="SSL" value={latestCheck?.sslDaysRemaining != null ? `${latestCheck.sslDaysRemaining}d` : "—"} ok={latestCheck?.sslDaysRemaining != null && latestCheck.sslDaysRemaining > 30} />
        <MetricCard label="DNS" value={latestCheck?.dnsStatus === "ok" ? "OK" : latestCheck?.dnsStatus ?? "—"} ok={latestCheck?.dnsStatus === "ok"} />
        <MetricCard label="Booking Page" value={latestCheck?.bookingStatus != null ? `HTTP ${latestCheck.bookingStatus}` : "—"} ok={latestCheck?.bookingStatus != null && latestCheck.bookingStatus >= 200 && latestCheck.bookingStatus < 300} />
      </div>

      {/* Settings panel */}
      <div className="glass-card rounded-2xl bg-white p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold tracking-tight text-[#0A1628]">Settings</h2>
          <button onClick={() => setEditingSettings(!editingSettings)} className="btn-rounded px-4 py-1.5 text-sm font-medium text-[#2DA4A9] hover:bg-[#2DA4A9]/10">
            {editingSettings ? "Cancel" : "Edit"}
          </button>
        </div>

        {editingSettings ? (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-[#8C97A8]">Contact Email</label>
                <input type="email" value={settingsForm.contactEmail} onChange={(e) => setSettingsForm({ ...settingsForm, contactEmail: e.target.value })} placeholder="email@example.com" style={{ borderRadius: "12px" }} className="h-10 w-full border border-[#C4CCD4] bg-white px-3 text-sm text-[#0A1628] focus:border-[#2DA4A9] focus:outline-none focus:ring-2 focus:ring-[#2DA4A9]/20" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-[#8C97A8]">Check Frequency</label>
                <select value={settingsForm.monitoringFrequency} onChange={(e) => setSettingsForm({ ...settingsForm, monitoringFrequency: parseInt(e.target.value) })} style={{ borderRadius: "12px" }} className="h-10 w-full border border-[#C4CCD4] bg-white px-3 text-sm text-[#0A1628] focus:border-[#2DA4A9] focus:outline-none">
                  <option value={5}>Every 5 minutes</option>
                  <option value={15}>Every 15 minutes</option>
                  <option value={30}>Every 30 minutes</option>
                  <option value={60}>Every hour</option>
                  <option value={360}>Every 6 hours</option>
                  <option value={1440}>Daily</option>
                </select>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={settingsForm.monitoringEnabled} onChange={(e) => setSettingsForm({ ...settingsForm, monitoringEnabled: e.target.checked })} className="h-4 w-4 rounded border-[#C4CCD4] text-[#2DA4A9]" />
                <span className="text-sm text-[#0A1628]">Monitoring enabled</span>
              </label>
            </div>
            <div className="flex gap-2">
              <button onClick={saveSettings} disabled={savingSettings} className="btn-rounded bg-[#2DA4A9] px-4 py-2 text-sm font-medium text-white hover:bg-[#24858A] disabled:opacity-50">{savingSettings ? "Saving..." : "Save"}</button>
              <button onClick={() => setConfirmDelete(true)} className="btn-rounded bg-[#DC2626] px-4 py-2 text-sm font-medium text-white hover:bg-red-700">Delete</button>
            </div>
          </div>
        ) : (
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-[#8C97A8]">Email</span><span className="text-[#0A1628]">{website.contactEmail || "—"}</span></div>
            <div className="flex justify-between"><span className="text-[#8C97A8]">Frequency</span><span className="text-[#0A1628]">{freqLabel(website.monitoringFrequency)}</span></div>
            <div className="flex justify-between"><span className="text-[#8C97A8]">Status</span><span className={website.monitoringEnabled ? "text-[#16A34A]" : "text-[#DC2626]"}>{website.monitoringEnabled ? "Active" : "Paused"}</span></div>
          </div>
        )}
      </div>

      {/* Monthly reports toggle */}
      <div className="glass-card rounded-2xl bg-white p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium text-[#0A1628]">Monthly Reports</p>
            <p className="text-sm text-[#8C97A8]">
              {website.contactEmail
                ? website.monthlyReportsEnabled
                  ? `Monthly reports will be sent to ${website.contactEmail}`
                  : `Monthly reports are off`
                : "Add a contact email to enable monthly reports"}
            </p>
          </div>
          <button
            onClick={toggleMonthlyReports}
            disabled={!website.contactEmail}
            className={`btn-rounded px-4 py-2 text-sm font-medium transition ${
              website.monthlyReportsEnabled
                ? "bg-[#16A34A] text-white hover:bg-green-700"
                : "bg-gray-200 text-[#5B6776] hover:bg-gray-300"
            } disabled:opacity-40`}
          >
            {website.monthlyReportsEnabled ? "On" : "Off"}
          </button>
        </div>
      </div>

      {/* Confirm delete modal */}
      {confirmDelete && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, width: "100vw", height: "100vh" }}>
          <div className="absolute inset-0 bg-black/50" onClick={() => setConfirmDelete(false)} />
          <div className="relative z-10 w-full max-w-sm rounded-xl bg-white p-6 shadow-2xl text-center">
            <p className="font-semibold text-[#0A1628]">Delete {website.businessName}?</p>
            <p className="mt-2 text-sm text-[#8C97A8]">Monitoring and check history will be permanently removed.</p>
            <div className="mt-4 flex gap-2">
              <button onClick={() => setConfirmDelete(false)} className="btn-rounded flex-1 border border-[#E6EBF0] bg-white px-4 py-2 text-sm font-medium text-[#5B6776]">Cancel</button>
              <button onClick={deleteWebsite} className="btn-rounded flex-1 bg-[#DC2626] px-4 py-2 text-sm font-medium text-white hover:bg-red-700">Delete</button>
            </div>
          </div>
        </div>
      )}

      <div className="glass-card rounded-2xl bg-white p-6">
        <h2 className="mb-4 text-lg font-semibold tracking-tight text-[#0A1628]">Health Score</h2>
        <div className="space-y-3">
          <ScoreRow label="Website Online" points={healthScore.breakdown.websiteOnline} max={30} />
          <ScoreRow label="Booking Online" points={healthScore.breakdown.bookingOnline} max={20} />
          <ScoreRow label="SSL Valid" points={healthScore.breakdown.sslValid} max={20} />
          <ScoreRow label="DNS OK" points={healthScore.breakdown.dnsOk} max={15} />
          <ScoreRow label="Performance" points={healthScore.breakdown.performance} max={15} />
          {healthScore.breakdown.incidentPenalty > 0 && <ScoreRow label="Incident Penalty" points={-healthScore.breakdown.incidentPenalty} max={0} negative />}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="glass-card rounded-2xl bg-white p-6">
          <h2 className="mb-4 text-lg font-semibold tracking-tight text-[#0A1628]">Incidents</h2>
          {recentIncidents.length === 0 ? <p className="py-8 text-center text-sm text-[#8C97A8]">No incidents</p> : (
            <div className="space-y-3">
              {recentIncidents.map((i) => (
                <div key={i.id} className="rounded-xl border border-[#E6EBF0] p-3">
                  <div className="flex items-center gap-2">
                    <span className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${i.severity === "critical" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>{i.type.replace(/_/g, " ")}</span>
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
          {recentChecks.length === 0 ? <p className="py-8 text-center text-sm text-[#8C97A8]">No checks yet</p> : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead><tr className="border-b border-[#E6EBF0] text-[#8C97A8]"><th className="py-2 pr-3 font-medium">Time</th><th className="py-2 pr-3 font-medium">Home</th><th className="py-2 pr-3 font-medium">Book</th><th className="py-2 pr-3 font-medium">ms</th><th className="py-2 font-medium">SSL</th></tr></thead>
                <tbody>
                  {recentChecks.slice(0, 20).map((c) => (
                    <tr key={c.id} className="border-b border-[#E6EBF0] text-[#5B6776]">
                      <td className="py-2 pr-3 whitespace-nowrap">{new Date(c.checkedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</td>
                      <td className="py-2 pr-3">{c.homepageStatus != null ? <span className={c.homepageStatus >= 200 && c.homepageStatus < 300 ? "text-[#16A34A]" : "text-[#DC2626]"}>{c.homepageStatus}</span> : <span className="text-[#DC2626]">Err</span>}</td>
                      <td className="py-2 pr-3">{c.bookingStatus != null ? <span className={c.bookingStatus >= 200 && c.bookingStatus < 300 ? "text-[#16A34A]" : "text-[#DC2626]"}>{c.bookingStatus}</span> : "—"}</td>
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

function freqLabel(min: number): string {
  if (min === 5) return "Every 5 minutes";
  if (min === 15) return "Every 15 minutes";
  if (min === 30) return "Every 30 minutes";
  if (min === 60) return "Every hour";
  if (min === 360) return "Every 6 hours";
  if (min === 1440) return "Daily";
  return `Every ${min} min`;
}

function MetricCard({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return <div className="glass-card rounded-2xl bg-white p-5"><p className="text-sm text-[#5B6776]">{label}</p><p className={`mt-1 text-2xl font-bold tracking-tight ${ok ? "text-[#16A34A]" : "text-[#DC2626]"}`}>{value}</p></div>;
}

function ScoreRow({ label, points, max, negative }: { label: string; points: number; max: number; negative?: boolean }) {
  const pct = max > 0 ? Math.round((Math.abs(points) / max) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="w-32 text-sm text-[#5B6776]">{label}</span>
      <div className="flex-1"><div className="h-2 overflow-hidden rounded-full bg-[#E6EBF0]"><div className={`h-full rounded-full transition-all ${negative ? "bg-[#DC2626]" : "bg-[#2DA4A9]"}`} style={{ width: `${pct}%` }} /></div></div>
      <span className={`w-10 text-right text-sm font-medium tabular-nums ${negative ? "text-[#DC2626]" : "text-[#0A1628]"}`}>{negative ? `-${points}` : `${points}/${max}`}</span>
    </div>
  );
}
