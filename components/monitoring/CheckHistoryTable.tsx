"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

interface CheckRecord {
  id: string;
  checkedAt: string;
  homepageStatus: number | null;
  bookingStatus: number | null;
  responseTime: number | null;
  sslDaysRemaining: number | null;
  dnsStatus: string | null;
}

function StatusCode({ code }: { code: number | null }) {
  if (code === null) return <span className="text-[#DC2626]">Error</span>;
  const ok = code >= 200 && code < 300;
  return (
    <span className={ok ? "text-[#16A34A]" : "text-[#DC2626]"}>
      {code}
    </span>
  );
}

export function CheckHistoryTable({
  checks,
  className,
}: {
  checks: CheckRecord[];
  className?: string;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);

  if (checks.length === 0) {
    return (
      <div className={cn("py-8 text-center text-[#8C97A8]", className)}>
        No checks recorded yet
      </div>
    );
  }

  return (
    <div className={cn("overflow-x-auto", className)}>
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-[#E6EBF0] text-[#8C97A8]">
            <th className="py-2 pr-4 font-medium">Date</th>
            <th className="py-2 pr-4 font-medium">Homepage</th>
            <th className="py-2 pr-4 font-medium">Booking</th>
            <th className="py-2 pr-4 font-medium">Response</th>
            <th className="py-2 pr-4 font-medium">SSL</th>
            <th className="py-2 pr-4 font-medium">DNS</th>
          </tr>
        </thead>
        <tbody>
          {checks.slice(0, 50).map((check) => (
            <tr
              key={check.id}
              onClick={() =>
                setExpanded(expanded === check.id ? null : check.id)
              }
              className="cursor-pointer border-b border-[#E6EBF0] transition hover:bg-gray-50"
            >
              <td className="py-2 pr-4 text-[#5B6776]">
                {new Date(check.checkedAt).toLocaleString()}
              </td>
              <td className="py-2 pr-4">
                <StatusCode code={check.homepageStatus} />
              </td>
              <td className="py-2 pr-4">
                <StatusCode code={check.bookingStatus} />
              </td>
              <td className="py-2 pr-4 font-mono text-[#0A1628]">
                {check.responseTime ? `${check.responseTime}ms` : "—"}
              </td>
              <td className="py-2 pr-4">
                {check.sslDaysRemaining != null ? (
                  <span
                    className={cn({
                      "text-[#16A34A]": check.sslDaysRemaining > 30,
                      "text-[#D97706]":
                        check.sslDaysRemaining > 0 &&
                        check.sslDaysRemaining <= 30,
                      "text-[#DC2626]": check.sslDaysRemaining <= 0,
                    })}
                  >
                    {check.sslDaysRemaining}d
                  </span>
                ) : (
                  <span className="text-[#8C97A8]">—</span>
                )}
              </td>
              <td className="py-2 pr-4">
                <span
                  className={
                    check.dnsStatus === "ok"
                      ? "text-[#16A34A]"
                      : "text-[#DC2626]"
                  }
                >
                  {check.dnsStatus ?? "—"}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {expanded && (
        <div className="mt-2 rounded-lg bg-gray-50 p-3 text-xs text-[#5B6776]">
          Check ID: {expanded}
        </div>
      )}
    </div>
  );
}
