import { NextRequest, NextResponse } from "next/server";
import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";

type LeadPayload = {
  email?: string;
  name?: string;
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
};

type UpsertResult = {
  provider: "hubspot" | "none";
  notified: boolean;
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
  score: number;
  propertyType: string;
  primaryChallenge: string;
}): string => {
  const fullName = escapeHtml(details.fullName || "Guest");
  const email = escapeHtml(details.email);
  const propertyName = escapeHtml(details.propertyName || "your property");
  const reportLink = escapeHtml(details.reportLink);
  const score = escapeHtml(String(details.score));
  const propertyType = escapeHtml(details.propertyType);
  const primaryChallenge = escapeHtml(details.primaryChallenge);

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
                            <img src="https://assets.buckysolutions.com/bucky_logo_parkgrader.svg" alt="ParkGrader Logo" width="170" style="display: block; border: 0;" />
                          </td>
                        </tr>
                      </tbody>
                    </table>
                    <div style="height: 40px;"><br /></div>
                    <p style="-webkit-font-smoothing: antialiased; line-height: 24px; margin: 0px; font-size: 16px;">Hey ${fullName},</p>
                    <p style="-webkit-font-smoothing: antialiased; line-height: 24px; margin: 15px 0px 0px; font-size: 16px;">Your ParkGrader audit copy is ready.</p>
                    <hr style="border: 0; border-top: 1px solid #dde1e6; margin: 30px 0;" />
                    <h2 style="color: #1a1a1a; font-weight: bold; font-size: 18px; margin-bottom: 20px;">Audit Details</h2>
                    <table width="100%" cellpadding="8" cellspacing="0" border="0" style="-webkit-font-smoothing: antialiased; color: #444444; font-size: 14px; border-collapse: collapse;">
                      <tbody>
                        <tr><td style="border-bottom: 1px solid #eaeaea; font-weight: bold; width: 170px;">Full Name</td><td style="border-bottom: 1px solid #eaeaea;">${fullName}</td></tr>
                        <tr><td style="border-bottom: 1px solid #eaeaea; font-weight: bold; width: 170px;">Email</td><td style="border-bottom: 1px solid #eaeaea;">${email}</td></tr>
                        <tr><td style="border-bottom: 1px solid #eaeaea; font-weight: bold; width: 170px;">Property</td><td style="border-bottom: 1px solid #eaeaea;">${propertyName}</td></tr>
                        <tr><td style="border-bottom: 1px solid #eaeaea; font-weight: bold; width: 170px;">Audit Score</td><td style="border-bottom: 1px solid #eaeaea;">${score}/100</td></tr>
                        <tr><td style="border-bottom: 1px solid #eaeaea; font-weight: bold; width: 170px;">Property Type</td><td style="border-bottom: 1px solid #eaeaea;">${propertyType}</td></tr>
                        <tr><td style="border-bottom: 1px solid #eaeaea; font-weight: bold; width: 170px;">Primary Challenge</td><td style="border-bottom: 1px solid #eaeaea;">${primaryChallenge}</td></tr>
                      </tbody>
                    </table>
                    <div style="height: 30px;"><br /></div>
                    <h2 style="color: #1a1a1a; font-weight: bold; font-size: 18px; margin-bottom: 15px;">View Your Report</h2>
                    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top: 6px;"><tbody><tr><td>
                      <a href="${reportLink}" style="display:inline-block; background:#2da4a9; color:#ffffff; text-decoration:none; font-size:14px; font-weight:600; padding:12px 18px; border-radius:4px;">Open your ParkGrader report</a>
                    </td></tr></tbody></table>
                  </td>
                </tr>
                <tr>
                  <td style="background-color: #edeff2; padding: 40px;" bgcolor="#edeff2">
                    <img src="https://assets.buckysolutions.com/bucky%2Bicon%2B.png" alt="Icon" width="22" style="margin-bottom: 15px;" />
                    <p style="line-height: 16px; margin: 0px; font-size: 11px; color: rgb(153, 153, 153);">Registered location: Bucky Solutions LLC., 7901 4th St N STE 300, St. Petersburg FL 33702</p>
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
  const html = buildAuditEmailHtml({
    fullName: payload.name,
    email: payload.email,
    propertyName: payload.property_name,
    reportLink,
    score: payload.score,
    propertyType: payload.property_type,
    primaryChallenge: payload.primary_challenge,
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
                  buttonList: {
                    buttons: [
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
  const initialProperties = toHubSpotContactProperties(payload);

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
    };
  }

  // Always upsert Company first (based on domain from URL)
  const domain = normalizeDomain(payload.url);
  if (!domain) {
    return {
      provider: "none",
      notified: false,
    };
  }

  const isTestDomain = isInternalTestDomain(domain);
  const isTestEmail = payload.email ? isInternalTestEmail(payload.email) : false;
  const companyResult = await upsertHubSpotCompany(accessToken, domain, payload);

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
    } else {
      newContactId = await createHubSpotLead(accessToken, payload);
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
  };
};

export async function POST(request: NextRequest) {
  try {
    const bypassMode = isBypassAuthorized(request);
    const body = (await request.json()) as LeadPayload;
    const payload: Required<LeadPayload> = {
      email: body.email?.trim().toLowerCase() ?? "",
      name: body.name?.trim() ?? "",
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
        bypass_mode: true,
      });
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

    return NextResponse.json({
      stored: result.provider === "hubspot",
      provider: result.provider,
      notified: result.notified,
      database_enabled: supabase.enabled,
      database_stored: supabase.stored,
      email_attempted: emailCopy.attempted,
      email_sent: emailCopy.sent,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Lead capture failed.";
    return NextResponse.json({ message }, { status: 500 });
  }
}
