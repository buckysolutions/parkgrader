import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const providedKey = (searchParams.get("key") ?? "").trim();
  const expectedKey = (process.env.BYPASS_KEY ?? "").trim();

  const enabled = Boolean(expectedKey && providedKey && providedKey === expectedKey);

  if (!enabled) {
    return NextResponse.json({ enabled: false }, { status: 403 });
  }

  return NextResponse.json({ enabled: true });
}
