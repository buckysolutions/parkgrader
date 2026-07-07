"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { DashboardSummary } from "@/lib/services/monitoring/types";

interface WebsiteRow {
  id: string;
  businessName: string;
  domain: string;
  monitoringEnabled: boolean;
  lastCheck: { checkedAt: string; homepageStatus: number | null; responseTime: number | null } | null;
  openIncidents: number;
}

export default function OverviewPage() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [websites, setWebsites] = useState<WebsiteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showAddForm, setShowAddForm] = useState(false);
  const [form, setForm] = useState({ businessName: "", domain: "", homepageUrl: "", bookingUrl: "", monitoringFrequency: "60" });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  async function loadData() {
    try {
      const [dashRes, sitesRes] = await Promise.all([
        fetch("/api/admin/monitoring/dashboard"),
        fetch("/api/admin/monitoring/websites"),
      ]);
      if (!dashRes.ok || !sitesRes.ok) {
        setError("Unable to load dashboard.");
        return;
      }
      setSummary(await dashRes.json());
      setWebsites((await sitesRes.json()).websites ?? []);
    } catch {
      setError("Network error loading dashboard.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadData(); }, []);

  async function addWebsite() {
    setSaving(true);
    setFormError("");
    try {
      const res = await fetch("/api/admin/monitoring/websites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessName: form.businessName,
          domain: form.domain,
          homepageUrl: form.homepageUrl,
          bookingUrl: form.bookingUrl || undefined,
          monitoringFrequency: parseInt(form.monitoringFrequency),
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        setFormError(err.error ?? "Failed to add website");
        return;
      }
      setShowAddForm(false);
      setForm({ businessName: "", domain: "", homepageUrl: "", bookingUrl: "", monitoringFrequency: "60" });
      await loadData();
    } catch {
      setFormError("Network error");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-28 animate-pulse rounded-2xl bg-gray-100" />
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {[...Array(4)].map((_, i) => <div key={i} className="h-28 animate-pulse rounded-2xl bg-gray-100" />)}
        </div>
        <div className="h-64 animate-pulse rounded-2xl bg-gray-100" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="glass-card rounded-2xl bg-white p-8 text-center">
        <p className="text-[#DC2626]">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[#0A1628]">Monitoring</h1>
          <p className="mt-1 text-sm text-[#8C97A8]">Real-time website health across all monitored properties</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="rounded-full bg-[#2DA4A9]/10 px-3 py-1 text-xs font-medium text-[#2DA4A9]">
            {summary?.totalCount ?? 0} websites
          </span>
          <button
            onClick={() => setShowAddForm(true)}
            className="btn-rounded inline-flex items-center gap-1.5 bg-[#0A1628] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#0A1628]/85"
          >
            + Add Website
          </button>
        </div>
      </div>

      {/* Add website modal */}
      {showAddForm && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, width: "100vw", height: "100vh" }}>
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowAddForm(false)} />
          <div className="relative z-10 w-full max-w-lg rounded-xl bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold tracking-tight text-[#0A1628]">Add Website</h2>
              <button onClick={() => setShowAddForm(false)} style={{ borderRadius: "8px" }} className="p-1 text-[#8C97A8] transition hover:bg-gray-100 hover:text-[#0A1628]">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 5l10 10M15 5L5 15"/></svg>
              </button>
            </div>
            {formError && <p className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-[#DC2626]">{formError}</p>}
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-[#0A1628]">Business Name *</label>
                <input type="text" value={form.businessName} onChange={(e) => setForm({ ...form, businessName: e.target.value })} placeholder="Acme Campground" style={{ borderRadius: "12px" }} className="h-11 w-full border border-[#C4CCD4] bg-white px-4 text-sm text-[#0A1628] placeholder-[#8C97A8] transition focus:border-[#2DA4A9] focus:outline-none focus:ring-2 focus:ring-[#2DA4A9]/20" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-[#0A1628]">Domain *</label>
                <input type="text" value={form.domain} onChange={(e) => setForm({ ...form, domain: e.target.value })} placeholder="example.com" style={{ borderRadius: "12px" }} className="h-11 w-full border border-[#C4CCD4] bg-white px-4 text-sm text-[#0A1628] placeholder-[#8C97A8] transition focus:border-[#2DA4A9] focus:outline-none focus:ring-2 focus:ring-[#2DA4A9]/20" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-[#0A1628]">Homepage URL *</label>
                <input type="text" value={form.homepageUrl} onChange={(e) => setForm({ ...form, homepageUrl: e.target.value })} placeholder="https://example.com" style={{ borderRadius: "12px" }} className="h-11 w-full border border-[#C4CCD4] bg-white px-4 text-sm text-[#0A1628] placeholder-[#8C97A8] transition focus:border-[#2DA4A9] focus:outline-none focus:ring-2 focus:ring-[#2DA4A9]/20" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-[#0A1628]">Booking URL</label>
                <input type="text" value={form.bookingUrl} onChange={(e) => setForm({ ...form, bookingUrl: e.target.value })} placeholder="https://example.com/book (optional)" style={{ borderRadius: "12px" }} className="h-11 w-full border border-[#C4CCD4] bg-white px-4 text-sm text-[#0A1628] placeholder-[#8C97A8] transition focus:border-[#2DA4A9] focus:outline-none focus:ring-2 focus:ring-[#2DA4A9]/20" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-[#0A1628]">Check Frequency</label>
                <select value={form.monitoringFrequency} onChange={(e) => setForm({ ...form, monitoringFrequency: e.target.value })} style={{ borderRadius: "12px" }} className="h-11 w-full border border-[#C4CCD4] bg-white px-4 text-sm text-[#0A1628] transition focus:border-[#2DA4A9] focus:outline-none focus:ring-2 focus:ring-[#2DA4A9]/20">
                  <option value="5">Every 5 minutes</option>
                  <option value="15">Every 15 minutes</option>
                  <option value="30">Every 30 minutes</option>
                  <option value="60">Every hour (default)</option>
                </select>
              </div>
            </div>
            <div className="mt-5 flex gap-3">
              <button onClick={() => setShowAddForm(false)} className="btn-rounded flex-1 border border-[#E6EBF0] bg-white px-5 py-2.5 text-sm font-medium text-[#5B6776] transition hover:bg-gray-50">Cancel</button>
              <button onClick={addWebsite} disabled={saving || !form.businessName || !form.domain || !form.homepageUrl} className="btn-rounded flex-1 bg-[#2DA4A9] px-5 py-2.5 text-sm font-medium text-white transition hover:bg-[#24858A] disabled:cursor-not-allowed disabled:opacity-50">{saving ? "Adding..." : "Add Website"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Stat cards */}
      {summary && (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <StatCard label="Healthy" value={summary.healthyCount} color="green" />
          <StatCard label="Warning" value={summary.warningCount} color="amber" />
          <StatCard label="Critical" value={summary.criticalCount} color="red" />
          <StatCard label="Avg Response" value={summary.avgResponseTime ? `${summary.avgResponseTime}ms` : "—"} color="teal" />
        </div>
      )}

      {/* Open incidents banner */}
      {summary && summary.openIncidents > 0 && (
        <Link href="/monitoring/incidents" className="flex items-center gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 transition hover:bg-red-100">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#DC2626] text-sm font-bold text-white">{summary.openIncidents}</span>
          <div>
            <p className="font-medium text-[#0A1628]">{summary.openIncidents} open incident{summary.openIncidents !== 1 ? "s" : ""}</p>
            <p className="text-sm text-[#5B6776]">Tap to review →</p>
          </div>
        </Link>
      )}

      {/* Website list */}
      <div>
        <h2 className="mb-4 text-lg font-semibold tracking-tight text-[#0A1628]">Websites</h2>
        {websites.length === 0 ? (
          <div className="glass-card rounded-2xl bg-white py-16 text-center">
            <p className="text-[#8C97A8]">No websites added yet.</p>
            <p className="mt-1 text-sm text-[#8C97A8]">Add a website to start monitoring.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {websites.map((site) => {
              const status: "healthy" | "warning" | "critical" | "unknown" =
                site.openIncidents > 0 ? "critical"
                : site.lastCheck?.homepageStatus != null && site.lastCheck.homepageStatus >= 500 ? "critical"
                : site.lastCheck?.responseTime != null && site.lastCheck.responseTime > 3000 ? "warning"
                : site.lastCheck ? "healthy"
                : "unknown";

              return (
                <Link key={site.id} href={`/monitoring/websites/${site.id}`} className="glass-card flex items-center gap-4 rounded-2xl bg-white p-4 transition hover:shadow-md">
                  <StatusDot status={status} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-[#0A1628]">{site.businessName}</p>
                    <p className="truncate text-sm text-[#8C97A8]">{site.domain}</p>
                  </div>
                  <div className="hidden shrink-0 gap-6 text-right text-sm sm:flex">
                    <div><p className="text-[#8C97A8]">Response</p><p className="font-medium tabular-nums text-[#0A1628]">{site.lastCheck?.responseTime ? `${site.lastCheck.responseTime}ms` : "—"}</p></div>
                    <div><p className="text-[#8C97A8]">Incidents</p><p className={`font-medium tabular-nums ${site.openIncidents > 0 ? "text-[#DC2626]" : "text-[#16A34A]"}`}>{site.openIncidents}</p></div>
                    <div><p className="text-[#8C97A8]">Last Check</p><p className="font-medium text-[#0A1628]">{site.lastCheck ? new Date(site.lastCheck.checkedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "Never"}</p></div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: string | number; color: "green" | "amber" | "red" | "teal" }) {
  const colors = { green: "text-[#16A34A]", amber: "text-[#D97706]", red: "text-[#DC2626]", teal: "text-[#2DA4A9]" };
  return (
    <div className="glass-card rounded-2xl bg-white p-5">
      <p className="text-sm text-[#5B6776]">{label}</p>
      <p className={`mt-1 text-3xl font-bold tracking-tight tabular-nums ${colors[color]}`}>{value}</p>
    </div>
  );
}

function StatusDot({ status }: { status: "healthy" | "warning" | "critical" | "unknown" }) {
  const colors = { healthy: "bg-[#16A34A]", warning: "bg-[#D97706]", critical: "bg-[#DC2626]", unknown: "bg-[#C4CCD4]" };
  return <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${colors[status]}`} />;
}
