"use client";

import { cn } from "@/lib/utils";

interface TimelineIncident {
  id: string;
  type: string;
  severity: "critical" | "warning";
  startedAt: string;
  endedAt?: string | null;
  resolved: boolean;
  message: string;
}

const typeLabels: Record<string, string> = {
  homepage_down: "Homepage Down",
  booking_down: "Booking Page Down",
  ssl_expiring: "SSL Expiring",
  ssl_expired: "SSL Expired",
  dns_failure: "DNS Failure",
  slow_response: "Slow Response",
  degraded_performance: "Degraded Performance",
  unexpected_redirect: "Unexpected Redirect",
};

export function IncidentTimeline({
  incidents,
  className,
}: {
  incidents: TimelineIncident[];
  className?: string;
}) {
  if (incidents.length === 0) {
    return (
      <div className={cn("py-8 text-center text-[#8C97A8]", className)}>
        No incidents
      </div>
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      {incidents.map((incident) => (
        <div key={incident.id} className="flex gap-3">
          {/* Timeline dot and line */}
          <div className="flex flex-col items-center">
            <span
              className={cn("mt-1.5 h-2.5 w-2.5 rounded-full", {
                "bg-[#DC2626]": incident.severity === "critical",
                "bg-[#D97706]": incident.severity === "warning",
                "bg-[#E6EBF0]": incident.resolved,
              })}
            />
            <div className="mt-1 h-full w-px bg-[#E6EBF0]" />
          </div>
          {/* Content */}
          <div className="flex-1 pb-4">
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "rounded px-1.5 py-0.5 text-[11px] font-semibold",
                  {
                    "bg-red-100 text-red-700":
                      incident.severity === "critical",
                    "bg-amber-100 text-amber-700":
                      incident.severity === "warning",
                  },
                )}
              >
                {typeLabels[incident.type] ?? incident.type}
              </span>
              {incident.resolved && (
                <span className="text-[11px] text-[#8C97A8]">Resolved</span>
              )}
            </div>
            <p className="mt-1 text-sm text-[#0A1628]">{incident.message}</p>
            <p className="mt-1 text-xs text-[#8C97A8]">
              {new Date(incident.startedAt).toLocaleString()}
              {incident.endedAt &&
                ` — ${new Date(incident.endedAt).toLocaleString()}`}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
