import { NextRequest, NextResponse } from "next/server";
import { verifyAdminKey } from "@/lib/auth/admin";
import {
  getAllWebsites,
  createWebsite,
} from "@/lib/services/monitoring/MonitoringService";

export const runtime = "nodejs";

/**
 * GET /api/admin/monitoring/websites
 *
 * List all monitored websites. Optional query params:
 *   ?search=   filter by business name or domain
 */
export async function GET(request: NextRequest) {
  if (!verifyAdminKey(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const search = request.nextUrl.searchParams.get("search") ?? undefined;
  const websites = await getAllWebsites(search);

  return NextResponse.json({
    websites: websites.map((w) => ({
      id: w.id,
      businessName: w.businessName,
      domain: w.domain,
      homepageUrl: w.homepageUrl,
      bookingUrl: w.bookingUrl,
      monitoringEnabled: w.monitoringEnabled,
      monitoringFrequency: w.monitoringFrequency,
      lastCheck: w.checks[0] ?? null,
      openIncidents: w.incidents.length,
    })),
  });
}

/**
 * POST /api/admin/monitoring/websites
 *
 * Add a new website to monitoring. Auto-creates default settings.
 *
 * Body: { businessName, domain, homepageUrl, bookingUrl?, contactUrl?, monitoringFrequency? }
 */
export async function POST(request: NextRequest) {
  if (!verifyAdminKey(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const body = await request.json();

  if (!body.businessName || !body.domain || !body.homepageUrl) {
    return NextResponse.json(
      { error: "businessName, domain, and homepageUrl are required" },
      { status: 400 },
    );
  }

  const website = await createWebsite({
    businessName: body.businessName,
    domain: body.domain,
    homepageUrl: body.homepageUrl,
    bookingUrl: body.bookingUrl,
    contactUrl: body.contactUrl,
    monitoringFrequency: body.monitoringFrequency,
  });

  return NextResponse.json({ website }, { status: 201 });
}
