import { NextRequest, NextResponse } from "next/server";
import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";

type LeadPayload = {
  email?: string;
  name?: string;
  phone?: string;
  property_name?: string;
  url?: string;
  score?: number;
  booking_platform?: string;
  primary_challenge?: string;
  scan_date?: string;
  report_id?: string;
  hubspot_contact_id?: string;
  report_snapshot?: unknown;
  send_email_copy?: boolean;
  lead_intent?: string;
  loom_requested?: boolean;
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

const getLeadIntentBucket = (leadIntent: string): "help" | "engaged" | "unknown" => {
  const intent = leadIntent.trim().toLowerCase();

  if (!intent) {
    return "unknown";
  }

  if (intent === "callback-request" || intent.startsWith("check-help:")) {
    return "help";
  }

  if (intent === "engagement-email" || intent === "share-report") {
    return "engaged";
  }

  return "unknown";
};

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

const scoreToLetterGrade = (score: number): string => {
  if (score >= 90) return "A";
  if (score >= 75) return "B";
  if (score >= 55) return "C";
  if (score >= 35) return "D";
  return "F";
};

const getTopFailingCheckName = (payload: Required<LeadPayload>): string => {
  const snapshot = toSnapshotLike(payload.report_snapshot);
  const checks = snapshot?.scanResult?.checks ?? [];
  for (const check of checks) {
    if (check.status === "fail" || check.pass === false) {
      return check.name?.trim() || "Unknown issue";
    }
  }
  return "No failing checks";
};

const getTopFailingCheckNamesFromSnapshot = (snapshot: unknown, limit: number): string[] => {
  const snap = toSnapshotLike(snapshot);
  const checks = snap?.scanResult?.checks ?? [];
  const names: string[] = [];
  for (const check of checks) {
    if (check.status === "fail" || check.pass === false) {
      const name = check.name?.trim();
      if (name && !names.includes(name)) {
        names.push(name);
        if (names.length >= limit) break;
      }
    }
  }
  return names;
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
    intent_bucket: getLeadIntentBucket(payload.lead_intent),
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

const getTopIssueFromSnapshot = (payload: Required<LeadPayload>): { name: string; explanation: string } => {
  const snapshot = toSnapshotLike(payload.report_snapshot);
  const checks = snapshot?.scanResult?.checks ?? [];

  // Categories in priority order for finding top issue
  const categoryOrder = [
    "Would a Guest Book Here?",
    "Can a Guest Find Basic Info?",
    "Will Google Send Guests?",
  ];

  for (const category of categoryOrder) {
    const failingChecks = checks
      .filter((check) => (check.status === "fail" || check.pass === false) && (check as Record<string, unknown>).category === category)
      .sort((a, b) => ((b as Record<string, unknown>).weight as number ?? 0) - ((a as Record<string, unknown>).weight as number ?? 0));

    if (failingChecks.length > 0) {
      const top = failingChecks[0];
      return {
        name: (top.name?.trim() || top.id?.trim() || "Unknown issue"),
        explanation: ((top as Record<string, unknown>).finding as string)?.trim() || ((top as Record<string, unknown>).details as string)?.trim() || "This issue may be turning guests away.",
      };
    }
  }

  return {
    name: "Website improvements needed",
    explanation: "Several issues were found that may be affecting your bookings.",
  };
};

const buildAuditEmailText = (details: {
  url: string;
  grade: string;
  reportLink: string;
  topIssueName: string;
  topIssueExplanation: string;
}): string => {
  return `Hi there,

You just ran a free audit on ${details.url} and I wanted to personally follow up.

Your site scored ${details.grade} and the biggest issue we found was:

${details.topIssueName}: ${details.topIssueExplanation}

Your full report with all the fixes is here:
${details.reportLink}

I also put together a quick personal video walking through your specific site  -  reply YES to this email and I'll send it over. Takes me 5 minutes and costs you nothing.

Brian
Founder, ParkGrader.com
parkgrader.com

---
You ran a free audit at parkgrader.com. Reply to unsubscribe.`;
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
  const domain = normalizeDomain(payload.url) || payload.url || "your website";
  const grade = scoreToLetterGrade(payload.score);
  const topIssue = getTopIssueFromSnapshot(payload);
  const textBody = buildAuditEmailText({
    url: `https://${domain}`,
    grade,
    reportLink,
    topIssueName: topIssue.name,
    topIssueExplanation: topIssue.explanation,
  });

  const ses = new SESv2Client({ region });
  const fromEmailAddress = fromName ? `${fromName} <${fromEmail}>` : fromEmail;

  const command = new SendEmailCommand({
    FromEmailAddress: fromEmailAddress,
    ...(configurationSetName ? { ConfigurationSetName: configurationSetName } : {}),
    Destination: { ToAddresses: [payload.email] },
    ReplyToAddresses: [fromEmail],
    Content: {
      Simple: {
        Subject: { Data: (() => { const c = payload.primary_challenge; if (c === "not-enough-bookings") return `Why ${domain} might be losing bookings`; if (c === "too-many-calls") return `How to stop answering the same questions all day`; if (c === "bad-reviews") return `Your Google rating is costing you guests`; if (c === "wrong-expectations") return `Why guests arrive and feel misled`; if (c === "website-outdated") return `What guests see when they land on ${domain}`; return `Your ParkGrader report for ${domain}`; })(), Charset: "UTF-8" },
        Body: {
          Text: { Data: textBody, Charset: "UTF-8" },
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
          website_url: payload.url,
          email: payload.email || persistedEmail || null,
          contact_name: payload.name || null,
          phone: payload.phone || null,
          score: payload.score,
          grade: scoreToLetterGrade(payload.score),
          top_issue: getTopFailingCheckName(payload),
          lead_intent: payload.lead_intent || null,
          loom_requested: payload.loom_requested || false,
          hubspot_contact_id: payload.hubspot_contact_id || null,
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

const toHubSpotContactProperties = (payload: Required<LeadPayload>) => {
  const appBaseUrl =
    process.env.APP_BASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_BASE_URL?.trim() ||
    "https://parkgrader.com";
  const reportLink = `${appBaseUrl.replace(/\/$/, "")}/r/${encodeURIComponent(payload.report_id)}`;

  return {
    email: payload.email,
    firstname: payload.name,
    phone: payload.phone,
    company: payload.property_name,
    website: payload.url,
    parkgrader_score: String(payload.score),
    parkgrader_grade: scoreToLetterGrade(payload.score),
    parkgrader_url: payload.url,
    parkgrader_top_issue: getTopFailingCheckName(payload),
    parkgrader_booking_platform: payload.booking_platform,
    parkgrader_primary_challenge: payload.primary_challenge,
    parkgrader_scan_date: payload.scan_date,
    parkgrader_audit_date: payload.scan_date,
    parkgrader_report_id: payload.report_id,
    report_link: reportLink,
    lead_intent: payload.lead_intent || "email_gate",
    loom_requested: payload.loom_requested ? "true" : "false",
  };
};

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
    bookingPlatform: string;
    reportId: string;
    companyId: string;
    companyName: string;
    leadIntent: string;
    intentBucket: "help" | "engaged" | "unknown";
    reportSnapshot: unknown;
    auditedUrl: string;
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

  const snapshot = toSnapshotLike(details.reportSnapshot);
  const parkName = details.companyName || snapshot?.propertyName?.trim() || details.domain || "(not available)";
  const grade = scoreToLetterGrade(details.auditScore);
  const topFailingChecks = getTopFailingCheckNamesFromSnapshot(details.reportSnapshot, 3);

  const auditDetailsWidgets: unknown[] = [
    {
      decoratedText: {
        topLabel: "Park Name",
        text: parkName,
      },
    },
    {
      decoratedText: {
        topLabel: "Audited URL",
        text: details.auditedUrl || "(not available)",
      },
    },
    {
      decoratedText: {
        topLabel: "Score & Grade",
        text: `${details.auditScore}/100 (${grade})`,
      },
    },
  ];

  if (details.leadIntent) {
    auditDetailsWidgets.push({
      decoratedText: {
        topLabel: "Lead Intent",
        text: details.leadIntent,
      },
    });
  }

  if (details.bookingPlatform) {
    auditDetailsWidgets.push({
      decoratedText: {
        topLabel: "Booking Platform",
        text: details.bookingPlatform,
      },
    });
  }

  if (details.primaryChallenge) {
    auditDetailsWidgets.push({
      decoratedText: {
        topLabel: "Their Challenge",
        text: details.primaryChallenge,
      },
    });
  }

  auditDetailsWidgets.push({
    decoratedText: {
      topLabel: "Audit Date",
      text: details.auditDate || "(not available)",
    },
  });

  const sections: unknown[] = [
    {
      header: "Audit Details",
      collapsible: false,
      widgets: auditDetailsWidgets,
    },
  ];

  if (topFailingChecks.length > 0) {
    sections.push({
      header: "Top Failing Checks",
      collapsible: false,
      widgets: topFailingChecks.map((name) => ({
        decoratedText: {
          text: name,
        },
      })),
    });
  }

  sections.push({
    header: "Quick Links",
    collapsible: false,
    widgets: [
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
            ...(portalId
              ? [
                  {
                    text: "Open HubSpot Company",
                    onClick: {
                      openLink: {
                        url: companyRecordUrl,
                      },
                    },
                  },
                ]
              : []),
          ],
        },
      },
    ],
  });

  const cardPayload = {
    cardsV2: [
      {
        cardId: "parkgrader-audit",
        card: {
          header: {
            title: `ParkGrader Audit: ${parkName}`,
            subtitle: `${details.auditedUrl}  -  Score: ${details.auditScore}/100 (${grade})`,
          },
          sections,
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
      const intentBucket = getLeadIntentBucket(payload.lead_intent);
      await sendGoogleChatAuditNotification(webhookUrl, {
        domain,
        auditCount: companyResult.nextAuditCount,
        auditDate: payload.scan_date,
        auditScore: payload.score,
        primaryChallenge: payload.primary_challenge,
        bookingPlatform: payload.booking_platform,
        reportId: payload.report_id,
        companyId: companyResult.companyId,
        companyName: payload.property_name,
        leadIntent: payload.lead_intent,
        intentBucket,
        reportSnapshot: payload.report_snapshot,
        auditedUrl: payload.url,
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
      booking_platform: body.booking_platform?.trim() ?? "",
      primary_challenge: body.primary_challenge?.trim() ?? "",
      scan_date: body.scan_date?.trim() ?? new Date().toISOString(),
      report_id: body.report_id?.trim() ?? `${Date.now()}`,
      hubspot_contact_id: body.hubspot_contact_id?.trim() ?? "",
      report_snapshot: body.report_snapshot,
      send_email_copy: Boolean(body.send_email_copy),
      lead_intent: body.lead_intent?.trim() ?? "",
      loom_requested: Boolean(body.loom_requested),
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

    // 1. Save to Supabase FIRST  -  fail hard if it doesn't work
    let supabaseStoreResult: SupabaseStoreResult;
    try {
      supabaseStoreResult = await storeAuditInSupabase(payload);
    } catch (error) {
      console.error("Supabase store failed:", error);
      const detail = error instanceof Error ? error.message : "Unknown database error";
      return NextResponse.json(
        {
          message: `Save failed  -  ${detail}`,
          supabase_error: detail,
        },
        { status: 500 },
      );
    }

    // 2. SES email copy after Supabase  -  soft fail if it doesn't work
    let emailCopy: EmailCopyResult = {
      attempted: false,
      sent: false,
    };
    let emailError: string | null = null;

    if (payload.send_email_copy) {
      try {
        emailCopy = await sendAuditCopyEmail(payload);
      } catch (error) {
        console.error("SES email copy failed:", error);
        emailError = error instanceof Error ? error.message : "Unknown email error";
      }
    }

    // 3. HubSpot fires AFTER response  -  fire-and-forget, never surface to user
    const fireHubSpotInBackground = () => {
      upsertHubSpotLead(payload)
        .then(async (result) => {
          // Google Chat notification (also fire-and-forget within HubSpot flow)
          const webhookUrl = process.env.GOOGLE_CHAT_WEBHOOK_URL?.trim() ?? "";
          if (webhookUrl && !isInternalTestDomain(normalizeDomain(payload.url))) {
            // Check Supabase for existing email to decide webhook
            let emailAlreadyInDatabase = false;
            const supabaseUrl = process.env.SUPABASE_URL?.trim() ?? "";
            const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
            if (payload.email && isValidEmail(payload.email) && supabaseUrl && serviceRoleKey) {
              try {
                emailAlreadyInDatabase = await hasExistingEmailInSupabase(supabaseUrl, serviceRoleKey, payload.email);
              } catch {
                // Non-blocking
              }
            }
            if (!emailAlreadyInDatabase) {
              try {
                await sendLeadCaptureWebhook(payload, result.hubspotContactId);
              } catch (webhookError) {
                console.error("Lead capture webhook failed:", webhookError);
              }
            }
          }
        })
        .catch((error) => {
          console.error("HubSpot upsert failed (background):", error);
        });
    };

    // Fire HubSpot in the background  -  don't await
    fireHubSpotInBackground();

    // Build the response
    const responseBody: Record<string, unknown> = {
      stored: supabaseStoreResult.stored,
      provider: "hubspot",
      database_enabled: supabaseStoreResult.enabled,
      database_stored: supabaseStoreResult.stored,
      email_attempted: emailCopy.attempted,
      email_sent: emailCopy.sent,
    };

    if (emailError) {
      responseBody.email_error = emailError;
      responseBody.message = "Saved. Email may take a few minutes.";
    }

    if (!emailCopy.sent) {
      responseBody.message = responseBody.message || "Saved. Email may take a few minutes.";
    }

    return NextResponse.json(responseBody, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Lead capture failed.";
    return NextResponse.json({ message }, { status: 500 });
  }
}
