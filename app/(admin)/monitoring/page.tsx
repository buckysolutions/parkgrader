"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { DashboardSummary } from "@/lib/services/monitoring/types";

interface WebsiteRow {
  id: string;
  businessName: string;
  domain: string;
  monitoringEnabled: boolean;
  contactEmail: string | null;
  monthlyReportsEnabled: boolean;
  isUnsubscribed: boolean;
  lastCheck: { checkedAt: string; homepageStatus: number | null; responseTime: number | null } | null;
  openIncidents: number;
}

export default function OverviewPage() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [websites, setWebsites] = useState<WebsiteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showAddForm, setShowAddForm] = useState(false);
  const [form, setForm] = useState({ businessName: "", domain: "", homepageUrl: "", bookingUrl: "", contactEmail: "", monitoringFrequency: "60", monthlyReportsEnabled: false });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  // Bulk actions modal
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkFilter, setBulkFilter] = useState("all");
  const [bulkAction, setBulkAction] = useState("");
  const [bulkConfirm, setBulkConfirm] = useState(false);
  const [bulkProcessing, setBulkProcessing] = useState(false);

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

  async function toggleMonthlyReports(site: WebsiteRow) {
    await fetch(`/api/admin/monitoring/websites/${site.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ monthlyReportsEnabled: !site.monthlyReportsEnabled }),
    });
    setWebsites((prev) => prev.map((w) =>
      w.id === site.id ? { ...w, monthlyReportsEnabled: !site.monthlyReportsEnabled } : w
    ));
  }

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
          contactEmail: form.contactEmail || undefined,
          monitoringFrequency: parseInt(form.monitoringFrequency),
          monthlyReportsEnabled: form.monthlyReportsEnabled,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        setFormError(err.error ?? "Failed to add website");
        return;
      }
      setShowAddForm(false);
      setForm({ businessName: "", domain: "", homepageUrl: "", bookingUrl: "", contactEmail: "", monitoringFrequency: "60", monthlyReportsEnabled: false });
      await loadData();
    } catch { setFormError("Network error"); }
    finally { setSaving(false); }
  }

  async function runBulkAction() {
    setBulkProcessing(true);
    const targets = getFilteredSites();
    const ids = targets.map((w) => w.id);

    if (bulkAction === "delete") {
      await Promise.all(ids.map((id) => fetch(`/api/admin/monitoring/websites/${id}`, { method: "DELETE" })));
    } else {
      const body: Record<string, unknown> = {};
      if (bulkAction.startsWith("freq_")) body.monitoringFrequency = parseInt(bulkAction.replace("freq_", ""));
      if (bulkAction === "disable") body.monitoringEnabled = false;
      if (bulkAction === "enable") body.monitoringEnabled = true;
      if (bulkAction === "reports_on") body.monthlyReportsEnabled = true;
      if (bulkAction === "reports_off") body.monthlyReportsEnabled = false;
      await Promise.all(ids.map((id) => fetch(`/api/admin/monitoring/websites/${id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      })));
    }

    setBulkProcessing(false);
    setBulkConfirm(false);
    setBulkAction("");
    await loadData();
  }

  function getFilteredSites(): WebsiteRow[] {
    if (bulkFilter === "all") return websites;
    if (bulkFilter === "email") return websites.filter((w) => w.contactEmail);
    if (bulkFilter === "no_email") return websites.filter((w) => !w.contactEmail);
    if (bulkFilter === "disabled") return websites.filter((w) => !w.monitoringEnabled);
    return websites;
  }

  const filteredCount = getFilteredSites().length;

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
          <button onClick={() => setShowBulkModal(true)} className="btn-rounded border border-[#E6EBF0] bg-white px-4 py-2 text-sm font-medium text-[#5B6776] hover:bg-gray-50">
            Bulk Actions
          </button>
          <button onClick={() => setShowAddForm(true)} className="btn-rounded inline-flex items-center gap-1.5 bg-[#0A1628] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#0A1628]/85">
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
                <label className="mb-1 block text-sm font-medium text-[#0A1628]">Contact Email</label>
                <input type="email" value={form.contactEmail} onChange={(e) => setForm({ ...form, contactEmail: e.target.value })} placeholder="email@example.com (optional)" style={{ borderRadius: "12px" }} className="h-11 w-full border border-[#C4CCD4] bg-white px-4 text-sm text-[#0A1628] placeholder-[#8C97A8] transition focus:border-[#2DA4A9] focus:outline-none focus:ring-2 focus:ring-[#2DA4A9]/20" />
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
            <label className="mt-4 flex items-center gap-3 cursor-pointer">
              <input type="checkbox" checked={form.monthlyReportsEnabled} onChange={(e) => setForm({ ...form, monthlyReportsEnabled: e.target.checked })} className="h-4 w-4 rounded border-[#C4CCD4] text-[#2DA4A9] focus:ring-[#2DA4A9]" />
              <span className="text-sm text-[#0A1628]">Send monthly monitoring reports</span>
            </label>
            <div className="mt-5 flex gap-3">
              <button onClick={() => setShowAddForm(false)} className="btn-rounded flex-1 border border-[#E6EBF0] bg-white px-5 py-2.5 text-sm font-medium text-[#5B6776] transition hover:bg-gray-50">Cancel</button>
              <button onClick={addWebsite} disabled={saving || !form.businessName || !form.domain || !form.homepageUrl} className="btn-rounded flex-1 bg-[#2DA4A9] px-5 py-2.5 text-sm font-medium text-white transition hover:bg-[#24858A] disabled:cursor-not-allowed disabled:opacity-50">{saving ? "Adding..." : "Add Website"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk actions modal */}
      {showBulkModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, width: "100vw", height: "100vh" }}>
          <div className="absolute inset-0 bg-black/50" onClick={() => { setShowBulkModal(false); setBulkConfirm(false); }} />
          <div className="relative z-10 w-full max-w-md rounded-xl bg-white p-6 shadow-2xl">
            <h2 className="text-lg font-semibold tracking-tight text-[#0A1628] mb-4">Bulk Actions</h2>

            {!bulkConfirm ? (
              <>
                <div className="space-y-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-[#8C97A8]">Filter</label>
                    <select value={bulkFilter} onChange={(e) => setBulkFilter(e.target.value)} style={{ borderRadius: "12px" }} className="h-10 w-full border border-[#C4CCD4] bg-white px-3 text-sm text-[#0A1628]">
                      <option value="all">All websites ({websites.length})</option>
                      <option value="email">Has email ({websites.filter(w => w.contactEmail).length})</option>
                      <option value="no_email">No email ({websites.filter(w => !w.contactEmail).length})</option>
                      <option value="disabled">Disabled ({websites.filter(w => !w.monitoringEnabled).length})</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-[#8C97A8]">Action</label>
                    <select value={bulkAction} onChange={(e) => setBulkAction(e.target.value)} style={{ borderRadius: "12px" }} className="h-10 w-full border border-[#C4CCD4] bg-white px-3 text-sm text-[#0A1628]">
                      <option value="">Choose action...</option>
                      <option value="freq_5">Set check frequency → 5 min</option>
                      <option value="freq_15">Set check frequency → 15 min</option>
                      <option value="freq_30">Set check frequency → 30 min</option>
                      <option value="freq_60">Set check frequency → 1 hour</option>
                      <option value="freq_360">Set check frequency → 6 hours</option>
                      <option value="freq_1440">Set check frequency → Daily</option>
                      <option value="enable">Enable monitoring</option>
                      <option value="disable">Disable monitoring</option>
                      <option value="reports_on">Turn monthly reports ON</option>
                      <option value="reports_off">Turn monthly reports OFF</option>
                      <option value="delete">Delete permanently</option>
                    </select>
                  </div>
                </div>
                <p className="mt-3 text-xs text-[#8C97A8]">{filteredCount} website{filteredCount !== 1 ? "s" : ""} will be affected</p>
                <div className="mt-4 flex gap-2">
                  <button onClick={() => setShowBulkModal(false)} className="btn-rounded flex-1 border border-[#E6EBF0] bg-white px-4 py-2 text-sm font-medium text-[#5B6776]">Cancel</button>
                  <button onClick={() => setBulkConfirm(true)} disabled={!bulkAction || filteredCount === 0} className="btn-rounded flex-1 bg-[#0A1628] px-4 py-2 text-sm font-medium text-white disabled:opacity-30">
                    Review
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="rounded-xl bg-gray-50 p-4 text-center">
                  <p className="font-semibold text-[#0A1628]">
                    {bulkAction === "delete" ? `Delete ${filteredCount} websites?` : `Update ${filteredCount} websites?`}
                  </p>
                  <p className="mt-1 text-xs text-[#8C97A8]">
                    {bulkAction === "delete" ? "This cannot be undone." : `Filter: ${bulkFilter} · Action: ${bulkAction.replace(/_/g, " ")}`}
                  </p>
                </div>
                <div className="mt-4 flex gap-2">
                  <button onClick={() => setBulkConfirm(false)} className="btn-rounded flex-1 border border-[#E6EBF0] bg-white px-4 py-2 text-sm font-medium text-[#5B6776]">Back</button>
                  <button onClick={runBulkAction} disabled={bulkProcessing} className={`btn-rounded flex-1 px-4 py-2 text-sm font-medium text-white ${bulkAction === "delete" ? "bg-[#DC2626] hover:bg-red-700" : "bg-[#2DA4A9] hover:bg-[#24858A]"} disabled:opacity-50`}>
                    {bulkProcessing ? "Processing..." : bulkAction === "delete" ? "Delete all" : "Apply"}
                  </button>
                </div>
              </>
            )}
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
                <Link key={site.id} href={`/monitoring/websites/${site.id}`} className={`glass-card flex items-center gap-4 rounded-2xl bg-white p-4 transition hover:shadow-md ${site.isUnsubscribed ? "opacity-50" : ""}`}>
                  <StatusDot status={status} />
                  <div className="min-w-0 flex-1">
                    <p className={`truncate font-medium text-[#0A1628] ${site.isUnsubscribed ? "line-through" : ""}`}>{site.businessName}</p>
                    <p className="truncate text-sm text-[#8C97A8]">{site.domain}</p>
                    {site.isUnsubscribed && <span className="mt-0.5 inline-block rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-[#8C97A8]">Unsubscribed</span>}
                  </div>
                  {/* Monthly reports toggle */}
                  <button
                    onClick={(e) => { e.preventDefault(); toggleMonthlyReports(site); }}
                    className={`btn-rounded hidden shrink-0 px-3 py-1 text-[11px] font-medium transition sm:inline-block ${
                      site.monthlyReportsEnabled
                        ? "bg-[#16A34A]/10 text-[#16A34A] hover:bg-[#16A34A]/20"
                        : "bg-gray-100 text-[#8C97A8] hover:bg-gray-200"
                    }`}
                    title={site.monthlyReportsEnabled ? "Monthly reports ON" : "Monthly reports OFF"}
                  >
                    {site.monthlyReportsEnabled ? "Reports ON" : "Reports OFF"}
                  </button>
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
