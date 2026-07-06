"use client";

import { useEffect, useState, Suspense } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { HealthScoreGauge } from "@/components/monitoring/HealthScoreGauge";
import { WebsiteStatusBadge } from "@/components/monitoring/WebsiteStatusBadge";
import { IncidentTimeline } from "@/components/monitoring/IncidentTimeline";
import { CheckHistoryTable } from "@/components/monitoring/CheckHistoryTable";
import { PerformanceChart } from "@/components/monitoring/PerformanceChart";
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
  openIncidents: Array<{
    id: string;
    type: string;
    severity: string;
    startedAt: string;
    message: string;
  }>;
  recentIncidents: Array<{
    id: string;
    type: string;
    severity: string;
    startedAt: string;
    endedAt: string | null;
    resolved: boolean;
    message: string;
  }>;
  recentChecks: Array<{
    id: string;
    checkedAt: string;
    homepageStatus: number | null;
    bookingStatus: number | null;
    responseTime: number | null;
    sslDaysRemaining: number | null;
    dnsStatus: string | null;
  }>;
}

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
        const res = await fetch(
          `/api/admin/monitoring/websites/${id}?admin_key=${adminKey}`,
        );
        if (!res.ok) {
          setError("Failed to load website details.");
          return;
        }
        setData(await res.json());
      } catch {
        setError("Network error.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id, adminKey]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 animate-pulse rounded bg-gray-100" />
        <div className="h-40 animate-pulse rounded-xl bg-gray-100" />
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

  if (!data) return null;

  const { website, latestCheck, healthScore, openIncidents, recentIncidents, recentChecks } = data;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[#0A1628]">
          {website.businessName}
        </h1>
        <p className="text-sm text-[#8C97A8]">{website.domain}</p>
      </div>

      {/* Health score + status cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="glass-card flex flex-col items-center rounded-xl bg-white p-5">
          <HealthScoreGauge
            score={healthScore.total}
            status={healthScore.status}
            size="sm"
          />
        </div>

        <div className="glass-card rounded-xl bg-white p-5">
          <p className="text-sm text-[#5B6776]">Status</p>
          <div className="mt-2">
            <WebsiteStatusBadge status={healthScore.status} />
          </div>
          <p className="mt-2 text-xs text-[#8C97A8]">
            {latestCheck
              ? `Last checked: ${new Date(latestCheck.checkedAt).toLocaleString()}`
              : "Never checked"}
          </p>
        </div>

        <div className="glass-card rounded-xl bg-white p-5">
          <p className="text-sm text-[#5B6776]">Response Time</p>
          <p className="mt-1 text-2xl font-bold text-[#0A1628]">
            {latestCheck?.responseTime
              ? `${latestCheck.responseTime}ms`
              : "—"}
          </p>
        </div>

        <div className="glass-card rounded-xl bg-white p-5">
          <p className="text-sm text-[#5B6776]">SSL Certificate</p>
          <p className="mt-1 text-2xl font-bold text-[#0A1628]">
            {latestCheck?.sslDaysRemaining != null
              ? `${latestCheck.sslDaysRemaining}d`
              : "—"}
          </p>
          <p className="text-xs text-[#8C97A8]">
            {latestCheck?.dnsStatus === "ok" ? "DNS: OK" : "DNS: Error"}
          </p>
        </div>
      </div>

      {/* Performance chart */}
      {recentChecks.length > 0 && (
        <div className="glass-card rounded-xl bg-white p-5">
          <PerformanceChart
            label="Response Time (ms)"
            data={recentChecks
              .filter((c) => c.responseTime != null)
              .map((c) => ({
                time: new Date(c.checkedAt).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                }),
                value: c.responseTime!,
              }))
              .reverse()}
          />
        </div>
      )}

      {/* Incidents + Check history */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="glass-card rounded-xl bg-white p-5">
          <h2 className="mb-3 text-lg font-semibold text-[#0A1628]">
            Incidents
          </h2>
          <IncidentTimeline
            incidents={[...openIncidents.map(i => ({ ...i, resolved: false, endedAt: null })), ...recentIncidents].map((i) => ({
              ...i,
              severity: i.severity as "critical" | "warning",
            }))}
          />
        </div>

        <div className="glass-card rounded-xl bg-white p-5">
          <h2 className="mb-3 text-lg font-semibold text-[#0A1628]">
            Check History
          </h2>
          <CheckHistoryTable checks={recentChecks} />
        </div>
      </div>
    </div>
  );
}

export default function WebsiteDetailPageWrapper() {
  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          <div className="h-8 w-48 animate-pulse rounded bg-gray-100" />
          <div className="h-40 animate-pulse rounded-xl bg-gray-100" />
        </div>
      }
    >
      <WebsiteDetailPage />
    </Suspense>
  );
}
