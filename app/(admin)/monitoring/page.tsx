"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import type { DashboardSummary } from "@/lib/services/monitoring/types";

const PARKGRADER_LOGO = "https://assets.buckysolutions.com/parkgrader_logo.svg";

interface WebsiteRow {
  id: string;
  businessName: string;
  domain: string;
  monitoringEnabled: boolean;
  lastCheck: { checkedAt: string; homepageStatus: number | null; responseTime: number | null } | null;
  openIncidents: number;
}

function OverviewPage() {
  const params = useSearchParams();
  const adminKey = params.get("admin_key") ?? "";

  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [websites, setWebsites] = useState<WebsiteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const [dashRes, sitesRes] = await Promise.all([
          fetch(`/api/admin/monitoring/dashboard?admin_key=${adminKey}`),
          fetch(`/api/admin/monitoring/websites?admin_key=${adminKey}`),
        ]);
        if (!dashRes.ok || !sitesRes.ok) {
          setError("Unable to load dashboard. Check your admin key.");
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
    load();
  }, [adminKey]);

  if (!adminKey) {
    return (
      <div className="flex h-96 flex-col items-center justify-center">
        <img src={PARKGRADER_LOGO} alt="ParkGrader" className="mb-6 h-8 w-auto opacity-50" />
        <p className="text-[#5B6776]">
          Add <code className="rounded bg-gray-100 px-1.5 py-0.5 text-sm text-[#0A1628]">?admin_key=...</code> to the URL
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-28 animate-pulse rounded-2xl bg-gray-100" />
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-2xl bg-gray-100" />
          ))}
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

  const keyParam = `?admin_key=${encodeURIComponent(adminKey)}`;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[#0A1628]">
            Monitoring
          </h1>
          <p className="mt-1 text-sm text-[#8C97A8]">
            Real-time website health across all monitored properties
          </p>
        </div>
        <span className="rounded-full bg-[#2DA4A9]/10 px-3 py-1 text-xs font-medium text-[#2DA4A9]">
          {summary?.totalCount ?? 0} websites
        </span>
      </div>

      {/* Stat cards */}
      {summary && (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <StatCard label="Healthy" value={summary.healthyCount} color="green" />
          <StatCard label="Warning" value={summary.warningCount} color="amber" />
          <StatCard label="Critical" value={summary.criticalCount} color="red" />
          <StatCard
            label="Avg Response"
            value={summary.avgResponseTime ? `${summary.avgResponseTime}ms` : "—"}
            color="teal"
          />
        </div>
      )}

      {/* Open incidents banner */}
      {summary && summary.openIncidents > 0 && (
        <Link
          href={`/monitoring/incidents${keyParam}`}
          className="flex items-center gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 transition hover:bg-red-100"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#DC2626] text-sm font-bold text-white">
            {summary.openIncidents}
          </span>
          <div>
            <p className="font-medium text-[#0A1628]">
              {summary.openIncidents} open incident{summary.openIncidents !== 1 ? "s" : ""}
            </p>
            <p className="text-sm text-[#5B6776]">Tap to review →</p>
          </div>
        </Link>
      )}

      {/* Website list */}
      <div>
        <h2 className="mb-4 text-lg font-semibold tracking-tight text-[#0A1628]">
          Websites
        </h2>
        {websites.length === 0 ? (
          <div className="glass-card rounded-2xl bg-white py-16 text-center">
            <p className="text-[#8C97A8]">No websites added yet.</p>
            <p className="mt-1 text-sm text-[#8C97A8]">
              Add a website to start monitoring.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {websites.map((site) => {
              const status: "healthy" | "warning" | "critical" | "unknown" =
                site.openIncidents > 0
                  ? "critical"
                  : site.lastCheck?.homepageStatus != null && site.lastCheck.homepageStatus >= 500
                    ? "critical"
                    : site.lastCheck?.responseTime != null && site.lastCheck.responseTime > 3000
                      ? "warning"
                      : site.lastCheck
                        ? "healthy"
                        : "unknown";

              return (
                <Link
                  key={site.id}
                  href={`/monitoring/websites/${site.id}${keyParam}`}
                  className="glass-card flex items-center gap-4 rounded-2xl bg-white p-4 transition hover:shadow-md"
                >
                  <StatusDot status={status} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-[#0A1628]">
                      {site.businessName}
                    </p>
                    <p className="truncate text-sm text-[#8C97A8]">{site.domain}</p>
                  </div>
                  <div className="hidden shrink-0 gap-6 text-right text-sm sm:flex">
                    <div>
                      <p className="text-[#8C97A8]">Response</p>
                      <p className="font-medium tabular-nums text-[#0A1628]">
                        {site.lastCheck?.responseTime
                          ? `${site.lastCheck.responseTime}ms`
                          : "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-[#8C97A8]">Incidents</p>
                      <p
                        className={`font-medium tabular-nums ${
                          site.openIncidents > 0 ? "text-[#DC2626]" : "text-[#16A34A]"
                        }`}
                      >
                        {site.openIncidents}
                      </p>
                    </div>
                    <div>
                      <p className="text-[#8C97A8]">Last Check</p>
                      <p className="font-medium text-[#0A1628]">
                        {site.lastCheck
                          ? new Date(site.lastCheck.checkedAt).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "Never"}
                      </p>
                    </div>
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

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: string | number;
  color: "green" | "amber" | "red" | "teal";
}) {
  const colors = {
    green: "text-[#16A34A]",
    amber: "text-[#D97706]",
    red: "text-[#DC2626]",
    teal: "text-[#2DA4A9]",
  };
  return (
    <div className="glass-card rounded-2xl bg-white p-5">
      <p className="text-sm text-[#5B6776]">{label}</p>
      <p className={`mt-1 text-3xl font-bold tracking-tight tabular-nums ${colors[color]}`}>
        {value}
      </p>
    </div>
  );
}

function StatusDot({ status }: { status: "healthy" | "warning" | "critical" | "unknown" }) {
  const colors = {
    healthy: "bg-[#16A34A]",
    warning: "bg-[#D97706]",
    critical: "bg-[#DC2626]",
    unknown: "bg-[#C4CCD4]",
  };
  return (
    <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${colors[status]}`} />
  );
}

export default function OverviewPageWrapper() {
  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          <div className="h-28 animate-pulse rounded-2xl bg-gray-100" />
          <div className="h-64 animate-pulse rounded-2xl bg-gray-100" />
        </div>
      }
    >
      <OverviewPage />
    </Suspense>
  );
}
