import { NextRequest, NextResponse } from "next/server";

type LeadPayload = {
  email?: string;
  name?: string;
  property_name?: string;
  url?: string;
  score?: number;
  property_type?: string;
  primary_challenge?: string;
  property_size?: string;
  top_fails?: string[];
  estimated_lost_revenue?: number;
  benchmark_percentile?: number;
  scan_date?: string;
  report_id?: string;
};

const isValidEmail = (value: string): boolean => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
};

const createAirtableLead = async (payload: Required<LeadPayload>) => {
  const apiKey = process.env.AIRTABLE_API_KEY;
  const baseId = process.env.AIRTABLE_BASE_ID;
  const tableName = process.env.AIRTABLE_TABLE_NAME;

  if (!apiKey || !baseId || !tableName) {
    return null;
  }

  const response = await fetch(`https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tableName)}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      fields: {
        Name: payload.name,
        "Property Name": payload.property_name,
        Email: payload.email,
        URL: payload.url,
        Score: payload.score,
        "Property Type": payload.property_type,
        "Primary Challenge": payload.primary_challenge,
        "Property Size": payload.property_size,
        "Top Fails": payload.top_fails.join(", "),
        "Estimated Lost Revenue": payload.estimated_lost_revenue,
        Percentile: payload.benchmark_percentile,
        "Scan Date": payload.scan_date,
        "Report ID": payload.report_id,
      },
    }),
  });

  if (!response.ok) {
    throw new Error("Airtable lead capture failed.");
  }

  return "airtable";
};

const createHubSpotLead = async (payload: Required<LeadPayload>) => {
  const accessToken = process.env.HUBSPOT_ACCESS_TOKEN;
  if (!accessToken) {
    return null;
  }

  const response = await fetch("https://api.hubapi.com/crm/v3/objects/contacts", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      properties: {
        email: payload.email,
        firstname: payload.name,
        company: payload.property_name,
        website: payload.url,
        parkgrader_score: String(payload.score),
        parkgrader_property_type: payload.property_type,
        parkgrader_primary_challenge: payload.primary_challenge,
        parkgrader_property_size: payload.property_size,
        parkgrader_top_fails: payload.top_fails.join(", "),
        parkgrader_estimated_lost_revenue: String(payload.estimated_lost_revenue),
        parkgrader_benchmark_percentile: String(payload.benchmark_percentile),
        parkgrader_scan_date: payload.scan_date,
        parkgrader_report_id: payload.report_id,
      },
    }),
  });

  if (!response.ok && response.status !== 409) {
    throw new Error("HubSpot lead capture failed.");
  }

  return "hubspot";
};

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as LeadPayload;
    const payload: Required<LeadPayload> = {
      email: body.email?.trim() ?? "",
      name: body.name?.trim() ?? "",
      property_name: body.property_name?.trim() ?? "",
      url: body.url?.trim() ?? "",
      score: Number(body.score ?? 0),
      property_type: body.property_type?.trim() ?? "campground",
      primary_challenge: body.primary_challenge?.trim() ?? "converting-visitors",
      property_size: body.property_size?.trim() ?? "25-75",
      top_fails: Array.isArray(body.top_fails) ? body.top_fails : [],
      estimated_lost_revenue: Number(body.estimated_lost_revenue ?? 0),
      benchmark_percentile: Number(body.benchmark_percentile ?? 0),
      scan_date: body.scan_date?.trim() ?? new Date().toISOString(),
      report_id: body.report_id?.trim() ?? `${Date.now()}`,
    };

    if (!payload.email || !payload.url || !isValidEmail(payload.email)) {
      return NextResponse.json({ message: "Missing or invalid lead details." }, { status: 400 });
    }

    const provider = (await createAirtableLead(payload)) ?? (await createHubSpotLead(payload));

    return NextResponse.json({
      stored: Boolean(provider),
      provider: provider ?? "none",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Lead capture failed.";
    return NextResponse.json({ message }, { status: 500 });
  }
}
