import { NextRequest, NextResponse } from "next/server";

type SupabaseAuditRow = {
  report_snapshot?: unknown;
  score?: number | null;
  email?: string | null;
};

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ reportId: string }> },
) {
  const supabaseUrl = process.env.SUPABASE_URL?.trim() ?? "";
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";

  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ message: "Report storage is not configured." }, { status: 503 });
  }

  const { reportId } = await context.params;
  const normalizedReportId = decodeURIComponent((reportId ?? "").trim());

  if (!normalizedReportId) {
    return NextResponse.json({ message: "Missing report ID." }, { status: 400 });
  }

  const response = await fetch(
    `${supabaseUrl}/rest/v1/parkgrader_audits?select=report_snapshot,score,email&report_id=eq.${encodeURIComponent(normalizedReportId)}&limit=1`,
    {
      method: "GET",
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        "Content-Type": "application/json",
      },
    },
  );

  if (!response.ok) {
    return NextResponse.json({ message: "Unable to load shared report." }, { status: 502 });
  }

  const rows = (await response.json()) as SupabaseAuditRow[];
  const row = rows?.[0];
  const snapshot = row?.report_snapshot;

  if (!snapshot || typeof snapshot !== "object") {
    return NextResponse.json({ message: "Report not found." }, { status: 404 });
  }

  if (typeof row?.score === "number") {
    const mutableSnapshot = snapshot as { scanResult?: { score?: number } };
    if (mutableSnapshot.scanResult && typeof mutableSnapshot.scanResult === "object") {
      mutableSnapshot.scanResult.score = row.score;
    }
  }

  return NextResponse.json({ snapshot, email: row?.email ?? null });
}
