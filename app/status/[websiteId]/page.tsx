"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { HealthScoreGauge } from "@/components/monitoring/HealthScoreGauge";
import { WebsiteStatusBadge } from "@/components/monitoring/WebsiteStatusBadge";
import { IncidentTimeline } from "@/components/monitoring/IncidentTimeline";
import type { HealthScore } from "@/lib/services/monitoring/types";

interface CustomerData {
  website: {
    businessName: string;
    domain: string;
    monitoringEnabled: boolean;
  };
  healthScore: HealthScore;
  latestCheck: {
    checkedAt: string;
    homepageStatus: number | null;
    responseTime: number | null;
    sslDaysRemaining: number | null;
    dnsStatus: string | null;
  } | null;
  openIncidents: Array<{
    type: string;
    severity: string;
    startedAt: string;
    message: string;
  }>;
  recentIncidents: Array<{
    type: string;
    severity: string;
    startedAt: string;
    endedAt: string | null;
    resolved: boolean;
    message: string;
  }>;
}

export default function CustomerPortalPage() {
  const { websiteId } = useParams<{ websiteId: string }>();
  const [data, setData] = useState<CustomerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/customer/monitoring/${websiteId}`);
        if (!res.ok) {
          setError("Website not found or monitoring is not enabled.");
          return;
        }
        setData(await res.json());
      } catch {
        setError("Unable to load monitoring data.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [websiteId]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F8FAFC]">
        <div className="h-64 w-80 animate-pulse rounded-xl bg-gray-100" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F8FAFC]">
        <div className="glass-card rounded-xl bg-white p-8 text-center">
          <p className="text-lg text-[#DC2626]">{error}</p>
          <p className="mt-2 text-sm text-[#8C97A8]">
            Please contact support if you believe this is an error.
          </p>
        </div>
      </div>
    );
  }

  const { website, healthScore, latestCheck, openIncidents, recentIncidents } =
    data;

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <div className="mx-auto max-w-3xl px-4 py-10">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-[#0A1628]">
            {website.businessName}
          </h1>
          <p className="mt-1 text-[#8C97A8]">{website.domain}</p>
          <p className="mt-2 text-xs text-[#8C97A8]">Website Status</p>
        </div>

        {/* Health Score */}
        <div className="mb-8 flex justify-center">
          <HealthScoreGauge
            score={healthScore.total}
            status={healthScore.status}
            size="lg"
          />
        </div>

        {/* Status cards */}
        <div className="mb-8 grid gap-4 sm:grid-cols-3">
          <div className="glass-card rounded-xl bg-white p-4 text-center">
            <p className="text-sm text-[#5B6776]">Status</p>
            <div className="mt-2 flex justify-center">
              <WebsiteStatusBadge status={healthScore.status} />
            </div>
          </div>
          <div className="glass-card rounded-xl bg-white p-4 text-center">
            <p className="text-sm text-[#5B6776]">Response Time</p>
            <p className="mt-1 text-2xl font-bold text-[#0A1628]">
              {latestCheck?.responseTime
                ? `${latestCheck.responseTime}ms`
                : "—"}
            </p>
          </div>
          <div className="glass-card rounded-xl bg-white p-4 text-center">
            <p className="text-sm text-[#5B6776]">SSL</p>
            <p className="mt-1 text-2xl font-bold text-[#0A1628]">
              {latestCheck?.sslDaysRemaining != null
                ? `${latestCheck.sslDaysRemaining}d`
                : "—"}
            </p>
            <p className="text-xs text-[#8C97A8]">
              {latestCheck?.dnsStatus === "ok" ? "DNS OK" : "DNS Issue"}
            </p>
          </div>
        </div>

        {/* Last checked */}
        <p className="mb-6 text-center text-xs text-[#8C97A8]">
          {latestCheck
            ? `Last checked: ${new Date(latestCheck.checkedAt).toLocaleString()}`
            : "No checks recorded yet"}
        </p>

        {/* Incidents */}
        <div className="glass-card rounded-xl bg-white p-6">
          <h2 className="mb-4 text-lg font-semibold text-[#0A1628]">
            Recent Incidents
          </h2>
          <IncidentTimeline
            incidents={[
              ...openIncidents.map((i) => ({
                id: i.startedAt,
                ...i,
                resolved: false,
                endedAt: null,
                severity: i.severity as "critical" | "warning",
              })),
              ...recentIncidents.map((i) => ({
                id: i.startedAt,
                ...i,
                severity: i.severity as "critical" | "warning",
              })),
            ]}
          />
        </div>

        {/* Footer */}
        <div className="mt-10 text-center">
          <p className="text-xs text-[#8C97A8]">
            Powered by{" "}
            <span className="font-semibold text-[#2DA4A9]">ParkGrader</span>{" "}
            Monitoring
          </p>
        </div>
      </div>
    </div>
  );
}
