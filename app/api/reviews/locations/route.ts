import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export const runtime = "nodejs";

type Account = {
  name?: string;
  accountName?: string;
};

type Location = {
  name?: string;
  title?: string;
  storefrontAddress?: {
    addressLines?: string[];
    locality?: string;
    administrativeArea?: string;
  };
};

type AccountsPayload = {
  accounts?: Account[];
  error?: { message?: string; status?: string };
};

type LocationsPayload = {
  locations?: Location[];
  error?: { message?: string };
};

const toReviewLocationName = (accountName: string, rawLocationName: string): string => {
  if (!rawLocationName) {
    return "";
  }

  if (rawLocationName.startsWith("accounts/")) {
    return rawLocationName;
  }

  if (rawLocationName.startsWith("locations/")) {
    return `${accountName}/${rawLocationName}`;
  }

  return `${accountName}/locations/${rawLocationName}`;
};

export async function GET() {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get("gbp_access_token")?.value ?? "";

  if (!accessToken) {
    return NextResponse.json(
      { message: "Not connected to Google Business Profile." },
      { status: 401 },
    );
  }

  const accountsRes = await fetch(
    "https://mybusinessaccountmanagement.googleapis.com/v1/accounts",
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );

  if (!accountsRes.ok) {
    const status = accountsRes.status === 401 ? 401 : 502;
    const payload = (await accountsRes.json().catch(() => ({}))) as AccountsPayload;
    return NextResponse.json(
      {
        message:
          status === 401
            ? "Google session expired. Please reconnect."
            : (payload.error?.message ?? "Failed to fetch Google accounts."),
      },
      { status },
    );
  }

  const accountsPayload = (await accountsRes.json()) as AccountsPayload;
  const accounts = accountsPayload.accounts ?? [];

  if (!accounts.length) {
    return NextResponse.json({ locations: [] });
  }

  const allLocations: Array<{ name: string; title: string; address: string }> = [];
  const fetchErrors: string[] = [];

  for (const account of accounts) {
    const accountName = account.name ?? "";
    if (!accountName) {
      continue;
    }

    const locationsRes = await fetch(
      `https://mybusinessbusinessinformation.googleapis.com/v1/${accountName}/locations?readMask=name,title,storefrontAddress`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );

    if (!locationsRes.ok) {
      const payload = (await locationsRes.json().catch(() => ({}))) as LocationsPayload;
      fetchErrors.push(payload.error?.message ?? `Failed to fetch locations for ${accountName}.`);
      continue;
    }

    const locationsPayload = (await locationsRes.json()) as LocationsPayload;
    const locations = (locationsPayload.locations ?? []).map((loc) => {
      const parts = [
        ...(loc.storefrontAddress?.addressLines ?? []),
        loc.storefrontAddress?.locality,
        loc.storefrontAddress?.administrativeArea,
      ].filter(Boolean);

      const locationName = toReviewLocationName(accountName, loc.name ?? "");

      return {
        name: locationName,
        title: loc.title ?? loc.name ?? "",
        address: parts.join(", "),
      };
    });

    allLocations.push(...locations.filter((loc) => Boolean(loc.name)));
  }

  if (!allLocations.length && fetchErrors.length) {
    return NextResponse.json(
      { message: fetchErrors[0] ?? "Failed to fetch locations." },
      { status: 502 },
    );
  }

  return NextResponse.json({ locations: allLocations });
}
