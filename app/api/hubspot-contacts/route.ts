import { NextRequest, NextResponse } from "next/server";

type HubSpotSearchResponse = {
  results?: Array<{
    id: string;
    properties?: {
      email?: string;
      firstname?: string;
      lastname?: string;
      company?: string;
      website?: string;
    };
  }>;
};

type HubSpotCompanySearchResponse = {
  results?: Array<{ id: string }>;
};

const mapContacts = (payload: HubSpotSearchResponse) => {
  return (payload.results ?? [])
    .map((contact) => {
      const email = contact.properties?.email?.trim() ?? "";
      if (!email) return null;
      const first = contact.properties?.firstname?.trim() ?? "";
      const last = contact.properties?.lastname?.trim() ?? "";
      const company = contact.properties?.company?.trim() ?? "";
      const website = contact.properties?.website?.trim() ?? "";
      return {
        id: contact.id,
        email,
        name: `${first} ${last}`.trim(),
        company,
        website,
      };
    })
    .filter(Boolean);
};

export async function GET(request: NextRequest) {
  const accessToken = process.env.HUBSPOT_ACCESS_TOKEN;
  if (!accessToken) {
    return NextResponse.json({ message: "HubSpot is not configured." }, { status: 503 });
  }

  const q = (request.nextUrl.searchParams.get("q") ?? "").trim();
  const limitRaw = Number(request.nextUrl.searchParams.get("limit") ?? "25");
  const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(50, limitRaw)) : 25;

  const body: {
    query?: string;
    filterGroups?: Array<{ filters: Array<{ propertyName: string; operator: string; value: string }> }>;
    properties: string[];
    limit: number;
    sorts: string[];
  } = {
    properties: ["email", "firstname", "lastname", "company", "website"],
    limit,
    sorts: ["-hs_lastmodifieddate"],
  };

  if (q) {
    // Full-text search covers email, name, and company-like text fields on contacts.
    body.query = q;
  }

  const response = await fetch("https://api.hubapi.com/crm/v3/objects/contacts/search", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const payload = (await response.json()) as HubSpotSearchResponse | { message?: string };

  if (!response.ok) {
    return NextResponse.json({ message: "Unable to load HubSpot contacts." }, { status: 502 });
  }

  let contacts = mapContacts(payload as HubSpotSearchResponse);

  // Fallback: if no contact match, try company search and traverse associated contacts.
  // This path requires `crm.objects.companies.read` scope.
  if (q && contacts.length === 0) {
    const companySearchRes = await fetch("https://api.hubapi.com/crm/v3/objects/companies/search", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: q,
        properties: ["name"],
        limit: 10,
      }),
    });

    if (companySearchRes.ok) {
      const companiesPayload = (await companySearchRes.json()) as HubSpotCompanySearchResponse;
      const companyIds = (companiesPayload.results ?? []).map((company) => company.id).filter(Boolean);

      if (companyIds.length > 0) {
        const assocRes = await fetch("https://api.hubapi.com/crm/v4/associations/companies/contacts/batch/read", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            inputs: companyIds.map((id) => ({ id })),
          }),
        });

        if (assocRes.ok) {
          const assocPayload = (await assocRes.json()) as {
            results?: Array<{ to?: Array<{ toObjectId: number }> }>;
          };

          const contactIdSet = new Set<string>();
          for (const association of assocPayload.results ?? []) {
            for (const target of association.to ?? []) {
              if (target.toObjectId) {
                contactIdSet.add(String(target.toObjectId));
              }
            }
          }

          const contactIds = Array.from(contactIdSet);
          if (contactIds.length > 0) {
            const contactsBatchRes = await fetch("https://api.hubapi.com/crm/v3/objects/contacts/batch/read", {
              method: "POST",
              headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                properties: ["email", "firstname", "lastname", "company", "website"],
                inputs: contactIds.map((id) => ({ id })),
              }),
            });

            if (contactsBatchRes.ok) {
              const batchPayload = (await contactsBatchRes.json()) as HubSpotSearchResponse;
              contacts = mapContacts(batchPayload);
            }
          }
        }
      }
    }
  }

  return NextResponse.json({ contacts: contacts ?? [] });
}
