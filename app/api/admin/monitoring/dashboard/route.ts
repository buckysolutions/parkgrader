import { NextRequest, NextResponse } from "next/server";
import { verifyAdminKey } from "@/lib/auth/admin";
import { getDashboardSummary } from "@/lib/services/monitoring/MonitoringService";

export const runtime = "nodejs";

/**
 * GET /api/admin/monitoring/dashboard
 *
 * Returns overview stats: healthy/warning/critical counts, avg response
 * time, open incidents count.
 */
export async function GET(request: NextRequest) {
  if (!verifyAdminKey(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const summary = await getDashboardSummary();
  return NextResponse.json(summary);
}
