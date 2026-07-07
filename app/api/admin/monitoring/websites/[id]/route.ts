import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
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

async function requireAuth() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await requireAuth())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
      contactEmail: website.contactEmail,
      monitoringEnabled: website.monitoringEnabled,
      monitoringFrequency: website.monitoringFrequency,
      monthlyReportsEnabled: website.monthlyReportsEnabled,
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

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await requireAuth())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  await updateWebsite(id, body);
  const website = await getWebsiteById(id);
  return NextResponse.json({ website: website ? {
    id: website.id,
    businessName: website.businessName,
    domain: website.domain,
    homepageUrl: website.homepageUrl,
    bookingUrl: website.bookingUrl,
    contactUrl: website.contactUrl,
    contactEmail: website.contactEmail,
    monitoringEnabled: website.monitoringEnabled,
    monitoringFrequency: website.monitoringFrequency,
    monthlyReportsEnabled: website.monthlyReportsEnabled,
    createdAt: website.createdAt,
    updatedAt: website.updatedAt,
  } : null });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await requireAuth())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  await updateWebsite(id, { monitoringEnabled: false });
  return NextResponse.json({ success: true });
}
