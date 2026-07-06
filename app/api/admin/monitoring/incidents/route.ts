import { NextRequest, NextResponse } from "next/server";
import { verifyAdminKey } from "@/lib/auth/admin";
import { getAllIncidents, resolveIncident } from "@/lib/services/monitoring/MonitoringService";

export const runtime = "nodejs";

/**
 * GET /api/admin/monitoring/incidents
 *
 * List incidents. Optional query param: ?status=open|resolved
 */
export async function GET(request: NextRequest) {
  if (!verifyAdminKey(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const status = request.nextUrl.searchParams.get("status") as
    | "open"
    | "resolved"
    | undefined;

  const incidents = await getAllIncidents(status ?? undefined);
  return NextResponse.json({ incidents });
}

/**
 * PATCH /api/admin/monitoring/incidents
 *
 * Resolve an incident: { id, resolved: true }
 */
export async function PATCH(request: NextRequest) {
  if (!verifyAdminKey(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const body = await request.json();

  if (!body.id) {
    return NextResponse.json(
      { error: "incident id is required" },
      { status: 400 },
    );
  }

  if (body.resolved) {
    await resolveIncident(body.id);
  }

  return NextResponse.json({ success: true });
}
