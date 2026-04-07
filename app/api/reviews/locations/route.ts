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

  const accountName = accounts[0].name ?? "";

  const locationsRes = await fetch(
    `https://mybusinessbusinessinformation.googleapis.com/v1/${accountName}/locations?readMask=name,title,storefrontAddress`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );

  if (!locationsRes.ok) {
    const payload = (await locationsRes.json().catch(() => ({}))) as LocationsPayload;
    return NextResponse.json(
      { message: payload.error?.message ?? "Failed to fetch locations." },
      { status: 502 },
    );
  }

  const locationsPayload = (await locationsRes.json()) as LocationsPayload;
  const locations = (locationsPayload.locations ?? []).map((loc) => {
    const parts = [
      ...(loc.storefrontAddress?.addressLines ?? []),
      loc.storefrontAddress?.locality,
      loc.storefrontAddress?.administrativeArea,
    ].filter(Boolean);

    return {
      name: loc.name ?? "",
      title: loc.title ?? loc.name ?? "",
      address: parts.join(", "),
    };
  });

  return NextResponse.json({ locations });
}
