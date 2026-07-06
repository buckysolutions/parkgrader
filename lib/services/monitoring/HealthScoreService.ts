import type { HealthScore, HealthScoreBreakdown, WebsiteStatus } from "./types";

// MonitoringCheck shape — matches the Prisma-generated type without importing
// from the generated client (avoids bundling issues in edge/server components).
interface MonitoringCheckLike {
  homepageStatus: number | null;
  bookingStatus: number | null;
  responseTime: number | null;
  sslDaysRemaining: number | null;
  dnsStatus: string | null;
}

/**
 * Calculate a health score from the latest check and open incident count.
 *
 * Scoring:
 *   Website Online   (HTTP 200-299)  → 30 points
 *   Booking Online   (HTTP 200-299)  → 20 points
 *   SSL Valid        (30+ days)      → 20 points
 *   DNS OK                           → 15 points
 *   Performance      (< 2s response) → 15 points
 *   Open Incidents                   → -10 points each
 *
 * Status thresholds: >= 80 healthy, >= 50 warning, < 50 critical
 */
export function calculateHealthScore(
  check: MonitoringCheckLike | null,
  openIncidentsCount: number,
): HealthScore {
  if (!check) {
    return {
      total: 0,
      breakdown: {
        websiteOnline: 0,
        bookingOnline: 0,
        sslValid: 0,
        dnsOk: 0,
        performance: 0,
        incidentPenalty: 0,
      },
      status: "unknown",
    };
  }

  const breakdown: HealthScoreBreakdown = {
    websiteOnline:
      check.homepageStatus !== null &&
      check.homepageStatus >= 200 &&
      check.homepageStatus < 300
        ? 30
        : 0,

    bookingOnline:
      check.bookingStatus !== null &&
      check.bookingStatus >= 200 &&
      check.bookingStatus < 300
        ? 20
        : 0,

    sslValid:
      check.sslDaysRemaining !== null && check.sslDaysRemaining > 30
        ? 20
        : check.sslDaysRemaining !== null && check.sslDaysRemaining > 0
          ? 10
          : 0,

    dnsOk: check.dnsStatus === "ok" ? 15 : 0,

    performance:
      check.responseTime !== null && check.responseTime < 2000
        ? 15
        : check.responseTime !== null && check.responseTime < 5000
          ? 7
          : 0,

    incidentPenalty: Math.min(openIncidentsCount * 10, 50), // cap at -50
  };

  const total = Math.max(
    0,
    breakdown.websiteOnline +
      breakdown.bookingOnline +
      breakdown.sslValid +
      breakdown.dnsOk +
      breakdown.performance -
      breakdown.incidentPenalty,
  );

  const status: WebsiteStatus =
    total >= 80 ? "healthy" : total >= 50 ? "warning" : "critical";

  return { total, breakdown, status };
}
