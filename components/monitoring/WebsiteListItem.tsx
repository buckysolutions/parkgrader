"use client";

import Link from "next/link";
import { WebsiteStatusBadge } from "./WebsiteStatusBadge";
import { cn } from "@/lib/utils";

interface WebsiteListItemProps {
  id: string;
  businessName: string;
  domain: string;
  status: "healthy" | "warning" | "critical" | "unknown";
  lastCheck?: string | null;
  openIncidents: number;
  responseTime?: number | null;
  className?: string;
}

export function WebsiteListItem({
  id,
  businessName,
  domain,
  status,
  lastCheck,
  openIncidents,
  responseTime,
  className,
}: WebsiteListItemProps) {
  return (
    <Link
      href={`/monitoring/websites/${id}`}
      className={cn(
        "flex items-center gap-4 rounded-xl border border-[#E6EBF0] bg-white p-4 transition-shadow hover:shadow-md",
        className,
      )}
    >
      <WebsiteStatusBadge status={status} />
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold text-[#0A1628]">{businessName}</p>
        <p className="truncate text-sm text-[#8C97A8]">{domain}</p>
      </div>
      <div className="hidden shrink-0 gap-6 text-right text-sm sm:flex">
        <div>
          <p className="text-[#8C97A8]">Response</p>
          <p className="font-medium text-[#0A1628]">
            {responseTime ? `${responseTime}ms` : "—"}
          </p>
        </div>
        <div>
          <p className="text-[#8C97A8]">Incidents</p>
          <p
            className={cn("font-medium", {
              "text-[#DC2626]": openIncidents > 0,
              "text-[#16A34A]": openIncidents === 0,
            })}
          >
            {openIncidents}
          </p>
        </div>
        <div>
          <p className="text-[#8C97A8]">Last Check</p>
          <p className="font-medium text-[#0A1628]">
            {lastCheck
              ? new Date(lastCheck).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : "Never"}
          </p>
        </div>
      </div>
    </Link>
  );
}
