import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAllWebsites, createWebsite } from "@/lib/services/monitoring/MonitoringService";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
