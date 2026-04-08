import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "node:crypto";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim() ?? "";
  const baseUrl = (process.env.APP_BASE_URL ?? "http://localhost:3000").trim().replace(/\/$/, "");
  const popupMode = request.nextUrl.searchParams.get("popup") === "1";

  if (!clientId) {
    return NextResponse.redirect(`${baseUrl}/review-coach?auth=not-configured`);
  }

  const state = randomBytes(16).toString("hex");
  const redirectUri = `${baseUrl}/api/auth/google/callback`;

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "https://www.googleapis.com/auth/business.manage",
    access_type: "offline",
    prompt: "consent",
    state,
  });

  const response = NextResponse.redirect(
    `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
  );

  response.cookies.set("gbp_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });

  response.cookies.set("gbp_oauth_popup", popupMode ? "1" : "0", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });

  return response;
}
