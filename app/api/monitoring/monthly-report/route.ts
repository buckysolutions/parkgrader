import { NextRequest, NextResponse } from "next/server";
import { verifyMonitoringKey } from "@/lib/auth/admin";
import { prisma } from "@/lib/db/prisma";
import { sendMonthlyReport } from "@/lib/email/ses";
import type { MonthlyReportParams } from "@/lib/email/ses";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * POST /api/monitoring/monthly-report
 *
 * Sends monthly monitoring reports to all enrolled websites.
 * Called by cron on the 1st of each month.
 *
 * Auth: header `x-monitoring-key`
 */
export async function POST(request: NextRequest) {
  const key = request.headers.get("x-monitoring-key");
  if (!verifyMonitoringKey(key)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const month = now.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  // Find all websites with monthly reports enabled and a contact email.
  const websites = await prisma.monitoringWebsite.findMany({
    where: {
      monthlyReportsEnabled: true,
      contactEmail: { not: null },
    },
    include: { settings: true },
  });

  const results: { domain: string; sent: boolean; error?: string }[] = [];

  for (const site of websites) {
    if (!site.contactEmail) continue;

    // Check not unsubscribed.
    const unsub = await prisma.unsubscribedEmail.findUnique({
      where: { email: site.contactEmail },
    });
    if (unsub) {
      results.push({ domain: site.domain, sent: false, error: "Unsubscribed" });
      continue;
    }

    // Aggregate stats for this month.
    const [checks, incidents] = await Promise.all([
      prisma.monitoringCheck.findMany({
        where: { websiteId: site.id, checkedAt: { gte: monthStart, lt: monthEnd } },
        orderBy: { checkedAt: "desc" },
      }),
      prisma.monitoringIncident.findMany({
        where: { websiteId: site.id, startedAt: { gte: monthStart, lt: monthEnd } },
      }),
    ]);

    const totalChecks = checks.length;
    const goodChecks = checks.filter(
      (c) => c.homepageStatus != null && c.homepageStatus >= 200 && c.homepageStatus < 300,
    ).length;
    const uptime = totalChecks > 0 ? (goodChecks / totalChecks) * 100 : 100;
    const avgResponseTime =
      checks.length > 0
        ? Math.round(
            checks.reduce((sum, c) => sum + (c.responseTime ?? 0), 0) / checks.length,
          )
        : 0;
    const totalIncidents = incidents.length;
    const resolvedIncidents = incidents.filter((i) => i.resolved).length;

    // Get latest check for health score.
    const latestCheck = checks[0] ?? null;
    const openIncidents = await prisma.monitoringIncident.count({
      where: { websiteId: site.id, resolved: false },
    });

    // Simple health score inline.
    let healthScore = 100;
    if (latestCheck) {
      if (latestCheck.homepageStatus == null || latestCheck.homepageStatus >= 500) healthScore -= 30;
      if (latestCheck.bookingStatus != null && (latestCheck.bookingStatus < 200 || latestCheck.bookingStatus >= 300)) healthScore -= 20;
      if (latestCheck.sslDaysRemaining != null && latestCheck.sslDaysRemaining <= 30) healthScore -= 20;
      if (latestCheck.dnsStatus !== "ok") healthScore -= 15;
      if (latestCheck.responseTime != null && latestCheck.responseTime >= 2000) healthScore -= 15;
      healthScore -= Math.min(openIncidents * 10, 50);
    }

    try {
      await sendMonthlyReport({
        to: site.contactEmail,
        websiteName: site.businessName,
        domain: site.domain,
        month,
        uptime,
        avgResponseTime,
        totalIncidents,
        resolvedIncidents,
        healthScore: Math.max(0, healthScore),
        websiteUrl: site.homepageUrl,
      });
      results.push({ domain: site.domain, sent: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown";
      results.push({ domain: site.domain, sent: false, error: msg });
    }
  }

  return NextResponse.json({
    month,
    websitesProcessed: websites.length,
    sent: results.filter((r) => r.sent).length,
    skipped: results.filter((r) => !r.sent).length,
    results,
  });
}
