"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { OverviewCards } from "@/components/monitoring/OverviewCards";
import { WebsiteListItem } from "@/components/monitoring/WebsiteListItem";
import type { DashboardSummary } from "@/lib/services/monitoring/types";

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
          setError("Failed to load dashboard. Check your admin key.");
          return;
        }

        const dashData = await dashRes.json();
        const sitesData = await sitesRes.json();

        setSummary(dashData);
        setWebsites(sitesData.websites ?? []);
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
      <div className="flex h-96 items-center justify-center">
        <p className="text-[#8C97A8]">
          Add <code className="rounded bg-gray-100 px-1">?admin_key=...</code> to the URL
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-24 animate-pulse rounded-xl bg-gray-100" />
        <div className="h-64 animate-pulse rounded-xl bg-gray-100" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-[#DC2626]">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#0A1628]">Monitoring Overview</h1>
        <p className="mt-1 text-sm text-[#8C97A8]">
          Real-time website health across all monitored properties
        </p>
      </div>

      {summary && (
        <OverviewCards
          cards={[
            { label: "Healthy", value: summary.healthyCount, accent: "green" },
            { label: "Warning", value: summary.warningCount, accent: "amber" },
            {
              label: "Critical",
              value: summary.criticalCount,
              accent: "red",
            },
            {
              label: "Total Websites",
              value: summary.totalCount,
              accent: "teal",
            },
            {
              label: "Avg Response",
              value: summary.avgResponseTime
                ? `${summary.avgResponseTime}ms`
                : "—",
              accent: "gray",
            },
            {
              label: "Open Incidents",
              value: summary.openIncidents,
              accent: summary.openIncidents > 0 ? "red" : "green",
            },
          ]}
        />
      )}

      {/* Website list */}
      <div className="glass-card rounded-xl bg-white p-6">
        <h2 className="mb-4 text-lg font-semibold text-[#0A1628]">
          Websites
        </h2>
        {websites.length === 0 ? (
          <p className="py-8 text-center text-[#8C97A8]">
            No websites added yet. Add one to start monitoring.
          </p>
        ) : (
          <div className="space-y-3">
            {websites.map((site) => {
              const status =
                site.openIncidents > 0
                  ? "critical"
                  : site.lastCheck?.homepageStatus != null &&
                      site.lastCheck.homepageStatus >= 500
                    ? "critical"
                    : site.lastCheck?.responseTime != null &&
                        site.lastCheck.responseTime > 3000
                      ? "warning"
                      : site.lastCheck
                        ? "healthy"
                        : "unknown";

              return (
                <WebsiteListItem
                  key={site.id}
                  id={site.id}
                  businessName={site.businessName}
                  domain={site.domain}
                  status={status}
                  lastCheck={site.lastCheck?.checkedAt ?? null}
                  openIncidents={site.openIncidents}
                  responseTime={site.lastCheck?.responseTime ?? null}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default function OverviewPageWrapper() {
  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          <div className="h-24 animate-pulse rounded-xl bg-gray-100" />
          <div className="h-64 animate-pulse rounded-xl bg-gray-100" />
        </div>
      }
    >
      <OverviewPage />
    </Suspense>
  );
}
