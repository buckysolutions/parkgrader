import { NextRequest, NextResponse } from "next/server";
import {
  getWebsiteById,
  getLatestCheck,
  getRecentIncidentsForWebsite,
  getOpenIncidentsForWebsite,
} from "@/lib/services/monitoring/MonitoringService";
import { calculateHealthScore } from "@/lib/services/monitoring/HealthScoreService";

export const runtime = "nodejs";

/**
 * GET /api/customer/monitoring/[websiteId]
 *
 * Public endpoint — returns a sanitized subset of monitoring data
 * for the customer-facing status page. No admin auth required.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ websiteId: string }> },
) {
  const { websiteId } = await params;

  const [website, latestCheck, openIncidents, recentIncidents] =
    await Promise.all([
      getWebsiteById(websiteId),
      getLatestCheck(websiteId),
      getOpenIncidentsForWebsite(websiteId),
      getRecentIncidentsForWebsite(websiteId, 10),
    ]);

  if (!website) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const healthScore = calculateHealthScore(latestCheck, openIncidents.length);

  // Sanitized — no internal notes, no email addresses, no settings.
  return NextResponse.json({
    website: {
      businessName: website.businessName,
      domain: website.domain,
      monitoringEnabled: website.monitoringEnabled,
    },
    healthScore,
    latestCheck: latestCheck
      ? {
          checkedAt: latestCheck.checkedAt,
          homepageStatus: latestCheck.homepageStatus,
          responseTime: latestCheck.responseTime,
          sslDaysRemaining: latestCheck.sslDaysRemaining,
          dnsStatus: latestCheck.dnsStatus,
        }
      : null,
    openIncidents: openIncidents.map((i) => ({
      type: i.type,
      severity: i.severity,
      startedAt: i.startedAt,
      message: i.message,
    })),
    recentIncidents: recentIncidents.map((i) => ({
      type: i.type,
      severity: i.severity,
      startedAt: i.startedAt,
      endedAt: i.endedAt,
      resolved: i.resolved,
      message: i.message,
    })),
  });
}
