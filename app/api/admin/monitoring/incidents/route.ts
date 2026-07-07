import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAllIncidents, resolveIncident } from "@/lib/services/monitoring/MonitoringService";

export const runtime = "nodejs";

async function requireAuth() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function GET(request: NextRequest) {
  if (!(await requireAuth())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const status = request.nextUrl.searchParams.get("status") as
    | "open"
    | "resolved"
    | undefined;

  const incidents = await getAllIncidents(status ?? undefined);
  return NextResponse.json({ incidents });
}

export async function PATCH(request: NextRequest) {
  if (!(await requireAuth())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
