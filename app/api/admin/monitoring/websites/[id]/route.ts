import { NextRequest, NextResponse } from "next/server";
import { verifyAdminKey } from "@/lib/auth/admin";
import {
  getWebsiteById,
  updateWebsite,
  getLatestCheck,
  getRecentIncidentsForWebsite,
  getOpenIncidentsForWebsite,
  getChecksForWebsite,
} from "@/lib/services/monitoring/MonitoringService";
import { calculateHealthScore } from "@/lib/services/monitoring/HealthScoreService";

export const runtime = "nodejs";

/**
 * GET /api/admin/monitoring/websites/[id]
 *
 * Returns full website detail: info, latest check, health score,
 * settings, recent incidents, recent checks.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!verifyAdminKey(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { id } = await params;
  const [website, latestCheck, openIncidents, recentIncidents, recentChecks] =
    await Promise.all([
      getWebsiteById(id),
      getLatestCheck(id),
      getOpenIncidentsForWebsite(id),
      getRecentIncidentsForWebsite(id, 20),
      getChecksForWebsite(id, 50),
    ]);

  if (!website) {
    return NextResponse.json({ error: "Website not found" }, { status: 404 });
  }

  const healthScore = calculateHealthScore(latestCheck, openIncidents.length);

  return NextResponse.json({
    website: {
      id: website.id,
      businessName: website.businessName,
      domain: website.domain,
      homepageUrl: website.homepageUrl,
      bookingUrl: website.bookingUrl,
      contactUrl: website.contactUrl,
      monitoringEnabled: website.monitoringEnabled,
      monitoringFrequency: website.monitoringFrequency,
      createdAt: website.createdAt,
      updatedAt: website.updatedAt,
    },
    latestCheck,
    healthScore,
    openIncidents,
    recentIncidents,
    recentChecks,
    settings: website.settings,
  });
}

/**
 * PATCH /api/admin/monitoring/websites/[id]
 *
 * Update website fields.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!verifyAdminKey(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();

  const website = await updateWebsite(id, body);
  return NextResponse.json({ website });
}

/**
 * DELETE /api/admin/monitoring/websites/[id]
 *
 * Soft-delete (disables monitoring). History is preserved.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!verifyAdminKey(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { id } = await params;
  await updateWebsite(id, { monitoringEnabled: false });
  return NextResponse.json({ success: true });
}
