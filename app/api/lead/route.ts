import { NextRequest, NextResponse } from "next/server";
import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";

type LeadPayload = {
  email?: string;
  name?: string;
  phone?: string;
  property_name?: string;
  url?: string;
  score?: number;
  property_type?: string;
  primary_challenge?: string;
  property_size?: string;
  scan_date?: string;
  report_id?: string;
  hubspot_contact_id?: string;
  report_snapshot?: unknown;
  send_email_copy?: boolean;
  lead_intent?: string;
};

type UpsertResult = {
  provider: "hubspot" | "none";
  notified: boolean;
  hubspotContactId: string | null;
};

type EmailCopyResult = {
  attempted: boolean;
  sent: boolean;
};

type SupabaseStoreResult = {
  enabled: boolean;
  stored: boolean;
};

type ExistingAuditRow = {
  email?: string | null;
  report_snapshot?: unknown;
};

type SnapshotCheck = {
  id?: string;
  name?: string;
  status?: "pass" | "fail" | "unknown";
  pass?: boolean;
  effort?: "Low" | "Medium" | "High";
};

type SnapshotLike = {
  propertyName?: string;
  scanResult?: {
    checks?: SnapshotCheck[];
    topFails?: string[];
  };
};

const INTERNAL_TEST_DOMAIN = "buckysolutions.com";

type HubSpotSearchResponse = {
  results?: Array<{
    id: string;
    createdAt?: string;
    properties?: {
      audit_count?: string;
      report_id?: string;
      name?: string;
      domain?: string;
      website?: string;
    };
  }>;
};

type HubSpotContactSearchResponse = {
  results?: Array<{
    id: string;
    properties?: {
      email?: string;
      company?: string;
      website?: string;
      firstname?: string;
      lastname?: string;
    };
  }>;
};

const isValidEmail = (value: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

const hasEnabledQueryFlag = (value: string | null): boolean => {
  if (value === null) {
    return false;
  }

  return value === "" || value === "true" || value === "1";
};

const isBypassAuthorized = (request: NextRequest): boolean => {
  const bypassEnabled = hasEnabledQueryFlag(request.nextUrl.searchParams.get("bypass"));
  const providedKey = (request.nextUrl.searchParams.get("key") ?? "").trim();
  const expectedKey = (process.env.BYPASS_KEY ?? "").trim();
  return Boolean(bypassEnabled && expectedKey && providedKey && providedKey === expectedKey);
};

const isInternalTestDomain = (domain: string): boolean => domain.toLowerCase() === INTERNAL_TEST_DOMAIN;

const isInternalTestEmail = (email: string): boolean => email.toLowerCase().endsWith(`@${INTERNAL_TEST_DOMAIN}`);

// Normalize domain from URL (e.g., "https://www.example.com/path" -> "example.com")
const normalizeDomain = (url: string): string => {
  try {
    const parsed = new URL(url.startsWith("http") ? url : `https://${url}`);
    const hostname = parsed.hostname || "";
    return hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
};

const getHubSpotErrorMessage = async (response: Response, fallbackMessage: string): Promise<string> => {
  const body = await response.text();

  if (!body) {
    return fallbackMessage;
  }

  try {
    const payload = JSON.parse(body) as {
      message?: string;
      errors?: Array<{ message?: string }>;
      category?: string;
    };
    const nestedMessage = payload.errors?.map((error) => error.message).filter(Boolean).join(", ");
    return nestedMessage || payload.message || payload.category || fallbackMessage;
  } catch {
    return body;
  }
};

const extractMissingPropertyNames = (message: string): string[] => {
  const matches = message.matchAll(/Property "([^"]+)" does not exist/g);
  return Array.from(matches, (match) => match[1]);
};

const removeMissingProperties = (
  properties: Record<string, string | undefined>,
  missingPropertyNames: string[],
): Record<string, string | undefined> => {
  if (!missingPropertyNames.length) {
    return properties;
  }

  const next = { ...properties };
  for (const key of missingPropertyNames) {
    delete next[key];
  }
  return next;
};

const normalizeText = (value: string): string => value.trim().toLowerCase();

const toTitleCase = (value: string): string =>
  value
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

const inferCompanyNameFromDomain = (domain: string): string => {
  const root = domain
    .split(".")
    .filter(Boolean)
    .slice(0, -1)
    .join(" ")
    .replace(/[-_]+/g, " ")
    .trim();

  return toTitleCase(root || domain.replace(/\.[a-z]{2,}$/i, ""));
};

const toSnapshotLike = (value: unknown): SnapshotLike | null => {
  if (!value || typeof value !== "object") {
    return null;
  }
  return value as SnapshotLike;
};

const getWebhookCompanyName = (payload: Required<LeadPayload>): string => {
  if (payload.property_name.trim()) {
    return payload.property_name.trim();
  }

  const snapshot = toSnapshotLike(payload.report_snapshot);
  const snapshotName = snapshot?.propertyName?.trim() ?? "";
  if (snapshotName) {
    return snapshotName;
  }

  const domain = normalizeDomain(payload.url);
  if (domain) {
    return inferCompanyNameFromDomain(domain);
  }

  return "Unknown Company";
};

const getTopFixes = (payload: Required<LeadPayload>): { topFix1: string; topFix2: string } => {
  const snapshot = toSnapshotLike(payload.report_snapshot);
  const checks = snapshot?.scanResult?.checks ?? [];
  const topFails = snapshot?.scanResult?.topFails ?? [];

  const checkById = new Map(
    checks
      .filter((check) => check.id)
      .map((check) => [check.id as string, check]),
  );

  const labels: string[] = [];

  for (const failId of topFails) {
    const check = checkById.get(failId);
    const label = check?.name?.trim();
    if (!label || labels.includes(label)) continue;
    labels.push(label);
    if (labels.length >= 2) break;
  }

  if (labels.length < 2) {
    for (const check of checks) {
      const isFail = check.status === "fail" || check.pass === false;
      const label = check.name?.trim() ?? "";
      if (!isFail || !label || labels.includes(label)) continue;
      labels.push(label);
      if (labels.length >= 2) break;
    }
  }

  return {
    topFix1: labels[0] ?? "booking clarity",
    topFix2: labels[1] ?? "mobile speed",
  };
};

const sendLeadCaptureWebhook = async (
  payload: Required<LeadPayload>,
  hubspotContactId: string | null,
): Promise<boolean> => {
  const webhookUrl = process.env.LEAD_CAPTURE_WEBHOOK_URL?.trim() ?? "";
  if (!webhookUrl || !payload.email || !isValidEmail(payload.email) || isInternalTestEmail(payload.email)) {
    return false;
  }

  const domain = normalizeDomain(payload.url);
  if (domain && isInternalTestDomain(domain)) {
    return false;
  }

  const companyName = getWebhookCompanyName(payload);
  const appBaseUrl =
    process.env.APP_BASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_BASE_URL?.trim() ||
    "https://parkgrader.com";
  const parkgraderReportUrl = `${appBaseUrl.replace(/\/$/, "")}/r/${encodeURIComponent(payload.report_id)}`;
  const { topFix1, topFix2 } = getTopFixes(payload);

  const webhookBody = {
    email: payload.email,
    name: payload.name,
    phone: payload.phone,
    lead_intent: payload.lead_intent,
    url: payload.url,
    company_name: companyName,
    hubspot_contact_id: hubspotContactId,
    parkgrader_report_url: parkgraderReportUrl,
    top_fix_1: topFix1,
    top_fix_2: topFix2,
    report_id: payload.report_id,
    scan_date: payload.scan_date,
  };

  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(webhookBody),
  });

  if (!response.ok) {
    throw new Error(await getHubSpotErrorMessage(response, "Lead capture webhook failed."));
  }

  return true;
};

const escapeHtml = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const buildAuditEmailHtml = (details: {
  fullName: string;
  email: string;
  propertyName: string;
  reportLink: string;
  aiSummary: string;
}): string => {
  const email = escapeHtml(details.email);
  const propertyName = escapeHtml(details.propertyName || "your property");
  const reportLink = escapeHtml(details.reportLink);
  const aiSummary = escapeHtml(details.aiSummary);

  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8" />
  </head>
  <body>
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="-webkit-font-smoothing: antialiased; color: #444444; background-color: #e3e3e3; table-layout: fixed; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;" bgcolor="#e3e3e3">
      <tbody>
        <tr>
          <td align="center" style="-webkit-font-smoothing: antialiased; color: #444444; padding: 30px 0; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;">
            <table width="600" cellpadding="0" cellspacing="0" border="0" style="-webkit-font-smoothing: antialiased; color: #444444; background-color: #f2f4f7; border-top: 4px solid #2da4a9; border-collapse: separate; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;" bgcolor="#f2f4f7">
              <tbody>
                <tr>
                  <td style="-webkit-font-smoothing: antialiased; color: #444444; padding: 40px; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;">
                    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="-webkit-font-smoothing: antialiased; color: #444444; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;">
                      <tbody>
                        <tr>
                          <td align="left" style="-webkit-font-smoothing: antialiased; color: #444444; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;">
                            <img src="https://assets.buckysolutions.com/parkgrader_logo.svg" alt="ParkGrader Logo" width="170" style="display: block; border: 0;" />
                          </td>
                        </tr>
                      </tbody>
                    </table>
                    <div style="height: 40px;"><br /></div>
                    <p style="-webkit-font-smoothing: antialiased; line-height: 24px; margin: 0px; font-size: 16px;">Your ParkGrader audit is ready.</p>
                    <p style="-webkit-font-smoothing: antialiased; line-height: 24px; margin: 15px 0px 0px; font-size: 16px;">
                      We reviewed your website and identified a few areas that may be reducing guest confidence or making it harder for people to book.
                    </p>
                    <p style="-webkit-font-smoothing: antialiased; line-height: 24px; margin: 15px 0px 0px; font-size: 16px;">${aiSummary}</p>
                    <p style="-webkit-font-smoothing: antialiased; line-height: 24px; margin: 15px 0px 0px; font-size: 16px;">
                      If you have questions about your results, the best way to get feedback is to reply to this email.
                    </p>
                    <div style="height: 26px;"><br /></div>
                    <h2 style="color: #1a1a1a; font-weight: 600; font-size: 16px; margin: 0 0 10px 0;">View your report</h2>
                    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top: 6px;"><tbody><tr><td>
                      <a href="${reportLink}" style="display:inline-block; background:#2da4a9; color:#ffffff; text-decoration:none; font-size:14px; font-weight:700; padding:12px 18px;">Open report</a>
                    </td></tr></tbody></table>
                  </td>
                </tr>
                <tr>
                  <td style="background-color: #edeff2; padding: 40px;" bgcolor="#edeff2">
                    <img src="https://assets.buckysolutions.com/bucky%2Bicon%2B.png" alt="Icon" width="22" style="margin-bottom: 15px;" />
                    <p style="line-height: 16px; margin: 0px; font-size: 11px; color: rgb(153, 153, 153);">This message was sent automatically by ParkGrader.</p>
                    <p style="line-height: 16px; margin: 8px 0 0 0; font-size: 11px; color: rgb(153, 153, 153);">Registered location: Bucky Solutions LLC., 7901 4th St N STE 300, St. Petersburg FL 33702</p>
                  </td>
                </tr>
              </tbody>
            </table>
          </td>
        </tr>
      </tbody>
    </table>
  </body>
</html>`;
};

const buildFallbackAuditSummary = (payload: Required<LeadPayload>): string => {
  const snapshot = toSnapshotLike(payload.report_snapshot);
  const checks = snapshot?.scanResult?.checks ?? [];
  const topFailNames = checks
    .filter((check) => check.status === "fail" || check.pass === false)
    .map((check) => check.name?.trim())
    .filter(Boolean)
    .slice(0, 2) as string[];

  if (topFailNames.length >= 2) {
    return `Some parts of your site are already working well, but issues like ${topFailNames[0]} and ${topFailNames[1]} may still be causing guests to hesitate before booking.`;
  }

  if (topFailNames.length === 1) {
    return `Your site has solid foundations, but ${topFailNames[0]} appears to be a key issue that may be creating booking friction.`;
  }

  return "Your site has several strengths, and a few smaller improvements could make the booking process even more straightforward for guests.";
};

const generateAuditSummaryWithGemini = async (payload: Required<LeadPayload>): Promise<string> => {
  const geminiApiKey = process.env.GEMINI_API_KEY?.trim() ?? "";
  if (!geminiApiKey) {
    return buildFallbackAuditSummary(payload);
  }

  const snapshot = toSnapshotLike(payload.report_snapshot);
  const checks = snapshot?.scanResult?.checks ?? [];
  const topFailNames = checks
    .filter((check) => check.status === "fail" || check.pass === false)
    .map((check) => check.name?.trim())
    .filter(Boolean)
    .slice(0, 4);

  const geminiModel = process.env.GEMINI_MODEL || "gemini-2.0-flash-lite";
  const prompt = [
    "Write ONE short paragraph (2 sentences max) for an automated audit email.",
    "Tone: professional, helpful, plain-English, not salesy.",
    "Goal: explain what likely needs fixing and why it matters for bookings.",
    "Do NOT use bullet points, headings, emojis, or placeholders.",
    "Do NOT mention AI, model, or scoring formulas.",
    `Property: ${payload.property_name || normalizeDomain(payload.url) || "this property"}`,
    `Top observed issues: ${topFailNames.length ? topFailNames.join(", ") : "not specified"}`,
  ].join("\n");

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(geminiModel)}:generateContent?key=${encodeURIComponent(geminiApiKey)}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [{ text: prompt }],
            },
          ],
          generationConfig: {
            temperature: 0.5,
            maxOutputTokens: 140,
          },
        }),
      },
    );

    if (!response.ok) {
      return buildFallbackAuditSummary(payload);
    }

    const data = (await response.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const text = data.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join(" ").trim() ?? "";
    if (!text) {
      return buildFallbackAuditSummary(payload);
    }

    return text.replace(/\s+/g, " ").trim();
  } catch {
    return buildFallbackAuditSummary(payload);
  }
};

const sendAuditCopyEmail = async (payload: Required<LeadPayload>): Promise<EmailCopyResult> => {
  if (!payload.email || !isValidEmail(payload.email) || isInternalTestEmail(payload.email)) {
    return { attempted: false, sent: false };
  }

  const region = process.env.SES_AWS_REGION?.trim() || process.env.AWS_REGION?.trim() || "";
  const fromEmail = process.env.SES_FROM_EMAIL?.trim() || "";
  const fromName = process.env.SES_FROM_NAME?.trim() || "";
  const configurationSetName = process.env.SES_CONFIGURATION_SET?.trim() || "";
  const baseUrl = process.env.APP_BASE_URL?.trim() || process.env.NEXT_PUBLIC_APP_BASE_URL?.trim() || "";

  if (!region || !fromEmail || !baseUrl) {
    return { attempted: false, sent: false };
  }

  const reportLink = `${baseUrl.replace(/\/$/, "")}/r/${encodeURIComponent(payload.report_id)}`;
  const aiSummary = await generateAuditSummaryWithGemini(payload);
  const html = buildAuditEmailHtml({
    fullName: payload.name,
    email: payload.email,
    propertyName: payload.property_name,
    reportLink,
    aiSummary,
  });

  const ses = new SESv2Client({ region });
  const fromEmailAddress = fromName ? `${fromName} <${fromEmail}>` : fromEmail;
  const replyToAddress = "help@buckysolutions.com";

  const command = new SendEmailCommand({
    FromEmailAddress: fromEmailAddress,
    ...(configurationSetName ? { ConfigurationSetName: configurationSetName } : {}),
    Destination: { ToAddresses: [payload.email] },
    ReplyToAddresses: [replyToAddress],
    Content: {
      Simple: {
        Subject: { Data: "Your ParkGrader audit report", Charset: "UTF-8" },
        Body: {
          Html: { Data: html, Charset: "UTF-8" },
        },
      },
    },
  });

  await ses.send(command);
  return { attempted: true, sent: true };
};

const getSupabaseHeaders = (serviceRoleKey: string) => ({
  apikey: serviceRoleKey,
  Authorization: `Bearer ${serviceRoleKey}`,
  "Content-Type": "application/json",
  Prefer: "resolution=merge-duplicates,return=representation",
});

const getExistingAuditFromSupabase = async (
  supabaseUrl: string,
  serviceRoleKey: string,
  reportId: string,
): Promise<ExistingAuditRow | null> => {
  const response = await fetch(
    `${supabaseUrl}/rest/v1/parkgrader_audits?select=email,report_snapshot&report_id=eq.${encodeURIComponent(reportId)}&limit=1`,
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
    throw new Error(await getHubSpotErrorMessage(response, "Supabase audit lookup failed."));
  }

  const rows = (await response.json()) as ExistingAuditRow[];
  return rows[0] ?? null;
};

const hasExistingEmailInSupabase = async (
  supabaseUrl: string,
  serviceRoleKey: string,
  email: string,
): Promise<boolean> => {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail || !isValidEmail(normalizedEmail)) {
    return false;
  }

  const response = await fetch(
    `${supabaseUrl}/rest/v1/parkgrader_audits?select=report_id&email=eq.${encodeURIComponent(normalizedEmail)}&limit=1`,
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
    throw new Error(await getHubSpotErrorMessage(response, "Supabase email lookup failed."));
  }

  const rows = (await response.json()) as Array<{ report_id?: string }>;
  return rows.length > 0;
};

const storeAuditInSupabase = async (payload: Required<LeadPayload>): Promise<SupabaseStoreResult> => {
  const supabaseUrl = process.env.SUPABASE_URL?.trim() ?? "";
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";

  if (!supabaseUrl || !serviceRoleKey) {
    return {
      enabled: false,
      stored: false,
    };
  }

  const domain = normalizeDomain(payload.url);
  if (!domain) {
    return {
      enabled: true,
      stored: false,
    };
  }

  const isTestDomain = isInternalTestDomain(domain);
  const isTestEmail = payload.email ? isInternalTestEmail(payload.email) : false;
  const headers = getSupabaseHeaders(serviceRoleKey);
  const existingAudit = await getExistingAuditFromSupabase(supabaseUrl, serviceRoleKey, payload.report_id);
  const persistedEmail = existingAudit?.email?.trim() ?? "";
  const mergedSnapshot =
    payload.report_snapshot && typeof payload.report_snapshot === "object"
      ? { ...(payload.report_snapshot as Record<string, unknown>) }
      : {};

  if (!payload.email && persistedEmail) {
    mergedSnapshot.email = persistedEmail;
  }

  const auditResponse = await fetch(
    `${supabaseUrl}/rest/v1/parkgrader_audits?on_conflict=report_id`,
    {
      method: "POST",
      headers,
      body: JSON.stringify([
        {
          report_id: payload.report_id,
          domain,
          company_name: payload.property_name || domain,
          website_url: payload.url,
          email: payload.email || persistedEmail || null,
          contact_name: payload.name || null,
          phone: payload.phone || null,
          score: payload.score,
          property_type: payload.property_type,
          primary_challenge: payload.primary_challenge,
          property_size: payload.property_size,
          scan_date: payload.scan_date,
          report_snapshot: Object.keys(mergedSnapshot).length ? mergedSnapshot : payload.report_snapshot ?? null,
          is_test: isTestDomain || isTestEmail,
          created_at: new Date().toISOString(),
        },
      ]),
    },
  );

  if (!auditResponse.ok) {
    throw new Error(await getHubSpotErrorMessage(auditResponse, "Supabase audit insert failed."));
  }

  return {
    enabled: true,
    stored: true,
  };
};

const toHubSpotContactProperties = (payload: Required<LeadPayload>) => ({
  email: payload.email,
  firstname: payload.name,
  phone: payload.phone,
  company: payload.property_name,
  website: payload.url,
  parkgrader_score: String(payload.score),
  parkgrader_property_type: payload.property_type,
  parkgrader_primary_challenge: payload.primary_challenge,
  parkgrader_property_size: payload.property_size,
  parkgrader_scan_date: payload.scan_date,
  parkgrader_report_id: payload.report_id,
});

const toHubSpotCompanyProperties = (
  payload: Required<LeadPayload>,
  domain: string,
  currentAuditCount: number,
  previousReportId?: string,
) => ({
  name: payload.property_name || domain,
  domain,
  website: payload.url,
  audit_count: String(previousReportId === payload.report_id ? currentAuditCount : currentAuditCount + 1),
  audit_date: payload.scan_date,
  audit_score: String(payload.score),
  primary_challenge: payload.primary_challenge,
  property_type: payload.property_type,
  report_id: payload.report_id,
});

const pickOldestCompany = (results: NonNullable<HubSpotSearchResponse["results"]>) => {
  return results
    .slice()
    .sort((left, right) => {
      const leftTime = left.createdAt ? Date.parse(left.createdAt) : Number.MAX_SAFE_INTEGER;
      const rightTime = right.createdAt ? Date.parse(right.createdAt) : Number.MAX_SAFE_INTEGER;
      return leftTime - rightTime;
    })[0];
};

const findHubSpotCompanyByDomain = async (
  accessToken: string,
  domain: string,
  propertyName?: string,
): Promise<{ id: string; auditCount: number; reportId: string } | null> => {
  const companyProps = "audit_count,report_id,domain,website";

  // 1. Native HubSpot dedup: look up by the domain idProperty directly
  const idPropertyResponse = await fetch(
    `https://api.hubapi.com/crm/v3/objects/companies/${encodeURIComponent(domain)}?idProperty=domain&properties=${companyProps}`,
    {
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  );
  if (idPropertyResponse.ok) {
    const data = (await idPropertyResponse.json()) as { id: string; properties?: { audit_count?: string; report_id?: string } };
    return {
      id: data.id,
      auditCount: Number(data.properties?.audit_count ?? 0),
      reportId: data.properties?.report_id ?? "",
    };
  }

  // 2. Search API fallback strategies
  const searches = [
    {
      filterGroups: [{ filters: [{ propertyName: "domain", operator: "EQ", value: domain }] }],
    },
    {
      filterGroups: [
        {
          filters: [
            { propertyName: "website", operator: "EQ", value: `https://${domain}` },
          ],
        },
        {
          filters: [
            { propertyName: "website", operator: "EQ", value: `https://www.${domain}` },
          ],
        },
        {
          filters: [
            { propertyName: "website", operator: "EQ", value: `http://${domain}` },
          ],
        },
        {
          filters: [
            { propertyName: "website", operator: "EQ", value: `http://www.${domain}` },
          ],
        },
      ],
    },
    ...(propertyName
      ? [{ filterGroups: [{ filters: [{ propertyName: "name", operator: "EQ", value: propertyName }] }] }]
      : []),
  ];

  for (const search of searches) {
    const response = await fetch("https://api.hubapi.com/crm/v3/objects/companies/search", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ...search,
        properties: ["audit_count", "report_id", "domain", "website"],
        limit: 10,
      }),
    });

    if (!response.ok) {
      throw new Error(await getHubSpotErrorMessage(response, "HubSpot company lookup failed."));
    }

    const payload = (await response.json()) as HubSpotSearchResponse;
    const results = payload.results ?? [];
    const match = results.length ? pickOldestCompany(results) : undefined;

    if (match) {
      return {
        id: match.id,
        auditCount: Number(match.properties?.audit_count ?? 0),
        reportId: match.properties?.report_id ?? "",
      };
    }
  }

  return null;
};

const upsertHubSpotCompany = async (accessToken: string, domain: string, payload: Required<LeadPayload>) => {
  const company = await findHubSpotCompanyByDomain(accessToken, domain, payload.property_name);
  const wasNewAudit = !company || company.reportId !== payload.report_id;
  const companyProperties = toHubSpotCompanyProperties(payload, domain, company?.auditCount ?? 0, company?.reportId);
  const nextAuditCount = Number(companyProperties.audit_count || 0);

  if (company) {
    const response = await fetch(`https://api.hubapi.com/crm/v3/objects/companies/${encodeURIComponent(company.id)}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ properties: companyProperties }),
    });

    if (!response.ok) {
      throw new Error(await getHubSpotErrorMessage(response, "HubSpot company update failed."));
    }

    return { companyId: company.id, wasNewAudit, nextAuditCount };
  }

  const response = await fetch("https://api.hubapi.com/crm/v3/objects/companies", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ properties: companyProperties }),
  });

  if (!response.ok) {
    throw new Error(await getHubSpotErrorMessage(response, "HubSpot company creation failed."));
  }

  const data = (await response.json()) as { id: string };
  return { companyId: data.id, wasNewAudit, nextAuditCount };
};

const sendGoogleChatAuditNotification = async (
  webhookUrl: string,
  details: {
    domain: string;
    auditCount: number;
    auditDate: string;
    auditScore: number;
    primaryChallenge: string;
    propertyType: string;
    reportId: string;
    companyId: string;
    companyName: string;
  },
) => {
  const appBaseUrl =
    process.env.APP_BASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_BASE_URL?.trim() ||
    "https://parkgrader.com";
  const reportUrl = `${appBaseUrl.replace(/\/$/, "")}/r/${encodeURIComponent(details.reportId)}`;
  const portalId = process.env.HUBSPOT_PORTAL_ID?.trim() ?? "";
  const companyRecordUrl = portalId
    ? `https://app.hubspot.com/contacts/${encodeURIComponent(portalId)}/record/0-2/${encodeURIComponent(details.companyId)}`
    : "(set HUBSPOT_PORTAL_ID to include direct company links)";

  const cardPayload = {
    cardsV2: [
      {
        cardId: "parkgrader-audit",
        card: {
          header: {
            title: "New ParkGrader Audit Started",
            subtitle: `${details.companyName || details.domain} (${details.domain})`,
          },
          sections: [
            {
              header: "Audit Details",
              collapsible: false,
              widgets: [
                {
                  decoratedText: {
                    topLabel: "Audit Count",
                    text: String(details.auditCount),
                  },
                },
                {
                  decoratedText: {
                    topLabel: "Audit Date",
                    text: details.auditDate,
                  },
                },
                {
                  decoratedText: {
                    topLabel: "Audit Score",
                    text: String(details.auditScore),
                  },
                },
                {
                  decoratedText: {
                    topLabel: "Primary Challenge",
                    text: details.primaryChallenge,
                  },
                },
                {
                  decoratedText: {
                    topLabel: "Property Type",
                    text: details.propertyType,
                  },
                },
                {
                  decoratedText: {
                    topLabel: "Report ID",
                    text: details.reportId,
                  },
                },
                {
                  decoratedText: {
                    topLabel: "ParkGrader Report",
                    text: reportUrl,
                  },
                },
                {
                  buttonList: {
                    buttons: [
                      {
                        text: "Open ParkGrader Report",
                        onClick: {
                          openLink: {
                            url: reportUrl,
                          },
                        },
                      },
                      {
                        text: "Open HubSpot Company",
                        onClick: {
                          openLink: {
                            url: companyRecordUrl,
                          },
                        },
                      },
                    ],
                  },
                },
              ],
            },
          ],
        },
      },
    ],
  };

  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(cardPayload),
  });

  if (!response.ok) {
    throw new Error(await getHubSpotErrorMessage(response, "Google Chat notification failed."));
  }
};

const associateContactToCompany = async (
  accessToken: string,
  contactId: string,
  companyId: string
): Promise<void> => {
  const response = await fetch(
    `https://api.hubapi.com/crm/v3/objects/contacts/${encodeURIComponent(contactId)}/associations/companies/${encodeURIComponent(companyId)}/contact_to_company`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    },
  );

  if (!response.ok) {
    console.error(await getHubSpotErrorMessage(response, "Contact-company association failed."));
  }
};

const findHubSpotContactByCompanySignals = async (
  accessToken: string,
  payload: Required<LeadPayload>,
  domain: string,
): Promise<string | null> => {
  const searchRequests = [
    {
      filterGroups: [{ filters: [{ propertyName: "website", operator: "CONTAINS_TOKEN", value: domain }] }],
      properties: ["company", "website", "email", "firstname", "lastname"],
      limit: 10,
    },
    ...(payload.property_name
      ? [
          {
            filterGroups: [{ filters: [{ propertyName: "company", operator: "EQ", value: payload.property_name }] }],
            properties: ["company", "website", "email", "firstname", "lastname"],
            limit: 10,
          },
        ]
      : []),
  ];

  for (const requestBody of searchRequests) {
    const response = await fetch("https://api.hubapi.com/crm/v3/objects/contacts/search", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      continue;
    }

    const payloadResult = (await response.json()) as HubSpotContactSearchResponse;
    const contacts = payloadResult.results ?? [];
    if (!contacts.length) {
      continue;
    }

    const normalizedDomain = normalizeText(domain);
    const normalizedCompany = normalizeText(payload.property_name);

    const strongMatch = contacts.find((contact) => {
      const contactCompany = normalizeText(contact.properties?.company ?? "");
      const contactWebsite = normalizeText(contact.properties?.website ?? "");
      const companyMatches = normalizedCompany && contactCompany === normalizedCompany;
      const websiteMatches = normalizedDomain && contactWebsite.includes(normalizedDomain);
      return companyMatches || websiteMatches;
    });

    if (strongMatch) {
      return strongMatch.id;
    }

    return contacts[0]?.id ?? null;
  }

  return null;
};

const findHubSpotContactIdByEmail = async (accessToken: string, email: string): Promise<string | null> => {
  const response = await fetch("https://api.hubapi.com/crm/v3/objects/contacts/search", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      filterGroups: [{ filters: [{ propertyName: "email", operator: "EQ", value: email }] }],
      properties: ["email"],
      limit: 1,
    }),
  });

  if (!response.ok) {
    throw new Error(await getHubSpotErrorMessage(response, "HubSpot contact lookup failed."));
  }

  const result = (await response.json()) as { results?: Array<{ id: string }> };
  return result.results?.[0]?.id ?? null;
};

const updateHubSpotLead = async (accessToken: string, contactId: string, payload: Required<LeadPayload>) => {
  const url = `https://api.hubapi.com/crm/v3/objects/contacts/${encodeURIComponent(contactId)}`;
  const initialProperties = toHubSpotContactProperties(payload);

  const response = await fetch(url, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ properties: initialProperties }),
  });

  if (response.ok) {
    return;
  }

  const errorMessage = await getHubSpotErrorMessage(response, "HubSpot lead update failed.");
  const missingPropertyNames = extractMissingPropertyNames(errorMessage);

  if (!missingPropertyNames.length) {
    throw new Error(errorMessage);
  }

  const fallbackProperties = removeMissingProperties(initialProperties, missingPropertyNames);
  const fallbackResponse = await fetch(url, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ properties: fallbackProperties }),
  });

  if (!fallbackResponse.ok) {
    throw new Error(await getHubSpotErrorMessage(fallbackResponse, "HubSpot lead update failed."));
  }
};

const createHubSpotLead = async (accessToken: string, payload: Required<LeadPayload>) => {
  const url = "https://api.hubapi.com/crm/v3/objects/contacts";
  const initialProperties = {
    ...toHubSpotContactProperties(payload),
    parkgrader_sequence_status: "Replied",
  };

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ properties: initialProperties }),
  });

  if (response.ok) {
    const data = (await response.json()) as { id: string };
    return data.id;
  }

  const errorMessage = await getHubSpotErrorMessage(response, "HubSpot lead creation failed.");
  const missingPropertyNames = extractMissingPropertyNames(errorMessage);

  if (!missingPropertyNames.length) {
    throw new Error(errorMessage);
  }

  const fallbackProperties = removeMissingProperties(initialProperties, missingPropertyNames);
  const fallbackResponse = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ properties: fallbackProperties }),
  });

  if (!fallbackResponse.ok) {
    throw new Error(await getHubSpotErrorMessage(fallbackResponse, "HubSpot lead creation failed."));
  }

  const data = (await fallbackResponse.json()) as { id: string };
  return data.id;
};

const upsertHubSpotLead = async (payload: Required<LeadPayload>): Promise<UpsertResult> => {
  const accessToken = process.env.HUBSPOT_ACCESS_TOKEN;
  if (!accessToken) {
    return {
      provider: "none",
      notified: false,
      hubspotContactId: null,
    };
  }

  // Always upsert Company first (based on domain from URL)
  const domain = normalizeDomain(payload.url);
  if (!domain) {
    return {
      provider: "none",
      notified: false,
      hubspotContactId: null,
    };
  }

  const isTestDomain = isInternalTestDomain(domain);
  const isTestEmail = payload.email ? isInternalTestEmail(payload.email) : false;
  const companyResult = await upsertHubSpotCompany(accessToken, domain, payload);

  let upsertedContactId: string | null = null;

  // Only upsert Contact if email is valid
  if (payload.email && isValidEmail(payload.email) && !isTestEmail) {
    const directContactId = payload.hubspot_contact_id?.startsWith("company-") ? "" : payload.hubspot_contact_id;
    let contactId = directContactId || (await findHubSpotContactIdByEmail(accessToken, payload.email));

    if (!contactId) {
      contactId = await findHubSpotContactByCompanySignals(accessToken, payload, domain);
    }

    let newContactId = contactId;
    if (contactId) {
      await updateHubSpotLead(accessToken, contactId, payload);
      upsertedContactId = contactId;
    } else {
      newContactId = await createHubSpotLead(accessToken, payload);
      upsertedContactId = newContactId;
    }

    // Try to associate contact to company (non-blocking)
    if (newContactId) {
      const company = await findHubSpotCompanyByDomain(accessToken, domain);
      if (company) {
        await associateContactToCompany(accessToken, newContactId, company.id);
      }
    }
  }

  const webhookUrl = process.env.GOOGLE_CHAT_WEBHOOK_URL?.trim() ?? "";
  let notified = false;

  if (webhookUrl && companyResult.wasNewAudit && !isTestDomain && !isTestEmail) {
    try {
      await sendGoogleChatAuditNotification(webhookUrl, {
        domain,
        auditCount: companyResult.nextAuditCount,
        auditDate: payload.scan_date,
        auditScore: payload.score,
        primaryChallenge: payload.primary_challenge,
        propertyType: payload.property_type,
        reportId: payload.report_id,
        companyId: companyResult.companyId,
        companyName: payload.property_name,
      });
      notified = true;
    } catch (error) {
      console.error(error);
    }
  }

  return {
    provider: "hubspot",
    notified,
    hubspotContactId: upsertedContactId,
  };
};

export async function POST(request: NextRequest) {
  try {
    const bypassMode = isBypassAuthorized(request);
    const body = (await request.json()) as LeadPayload;
    const payload: Required<LeadPayload> = {
      email: body.email?.trim().toLowerCase() ?? "",
      name: body.name?.trim() ?? "",
      phone: body.phone?.trim() ?? "",
      property_name: body.property_name?.trim() ?? "",
      url: body.url?.trim() ?? "",
      score: Number(body.score ?? 0),
      property_type: body.property_type?.trim() ?? "campground",
      primary_challenge: body.primary_challenge?.trim() ?? "converting-visitors",
      property_size: body.property_size?.trim() ?? "25-75",
      scan_date: body.scan_date?.trim() ?? new Date().toISOString(),
      report_id: body.report_id?.trim() ?? `${Date.now()}`,
      hubspot_contact_id: body.hubspot_contact_id?.trim() ?? "",
      report_snapshot: body.report_snapshot,
      send_email_copy: Boolean(body.send_email_copy),
      lead_intent: body.lead_intent?.trim() ?? "",
    };

    if (!payload.url) {
      return NextResponse.json({ message: "Missing or invalid URL." }, { status: 400 });
    }

    if (payload.email && !isValidEmail(payload.email)) {
      return NextResponse.json({ message: "Invalid email format." }, { status: 400 });
    }

    if (bypassMode) {
      return NextResponse.json({
        stored: false,
        provider: "none",
        notified: false,
        database_enabled: false,
        database_stored: false,
        email_attempted: false,
        email_sent: false,
        webhook_sent: false,
        webhook_skipped_existing_email: false,
        bypass_mode: true,
      });
    }

    let emailAlreadyInDatabase = false;
    if (payload.email && isValidEmail(payload.email)) {
      const supabaseUrl = process.env.SUPABASE_URL?.trim() ?? "";
      const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";

      if (supabaseUrl && serviceRoleKey) {
        try {
          emailAlreadyInDatabase = await hasExistingEmailInSupabase(supabaseUrl, serviceRoleKey, payload.email);
        } catch (error) {
          console.error(error);
        }
      }
    }

    let supabase = {
      enabled: false,
      stored: false,
    } as SupabaseStoreResult;

    try {
      supabase = await storeAuditInSupabase(payload);
    } catch (error) {
      console.error(error);
    }

    let emailCopy: EmailCopyResult = {
      attempted: false,
      sent: false,
    };

    if (payload.send_email_copy) {
      try {
        emailCopy = await sendAuditCopyEmail(payload);
      } catch (error) {
        console.error(error);
      }
    }

    const result = await upsertHubSpotLead(payload);

    let webhookSent = false;
    if (!emailAlreadyInDatabase) {
      try {
        webhookSent = await sendLeadCaptureWebhook(payload, result.hubspotContactId);
      } catch (error) {
        console.error(error);
      }
    }

    return NextResponse.json({
      stored: result.provider === "hubspot",
      provider: result.provider,
      notified: result.notified,
      hubspot_contact_id: result.hubspotContactId,
      database_enabled: supabase.enabled,
      database_stored: supabase.stored,
      email_attempted: emailCopy.attempted,
      email_sent: emailCopy.sent,
      webhook_sent: webhookSent,
      webhook_skipped_existing_email: emailAlreadyInDatabase,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Lead capture failed.";
    return NextResponse.json({ message }, { status: 500 });
  }
}
