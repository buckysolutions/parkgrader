import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export const runtime = "nodejs";

type TokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
};

export async function GET(request: NextRequest) {
  const baseUrl = (process.env.APP_BASE_URL ?? "http://localhost:3000").trim().replace(/\/$/, "");
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim() ?? "";
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim() ?? "";
  const redirectUri = `${baseUrl}/api/auth/google/callback`;

  const errorRedirect = NextResponse.redirect(`${baseUrl}/review-coach?auth=error`);

  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code") ?? "";
  const state = searchParams.get("state") ?? "";
  const errorParam = searchParams.get("error");

  const cookieStore = await cookies();
  const storedState = cookieStore.get("gbp_oauth_state")?.value ?? "";
  const popupMode = cookieStore.get("gbp_oauth_popup")?.value === "1";

  errorRedirect.cookies.delete("gbp_oauth_state");

  if (errorParam || !code || !state || state !== storedState || !clientId || !clientSecret) {
    return errorRedirect;
  }

  let tokens: TokenResponse;

  try {
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }).toString(),
    });

    tokens = (await tokenRes.json()) as TokenResponse;
    if (!tokenRes.ok || !tokens.access_token) {
      return errorRedirect;
    }
  } catch {
    return errorRedirect;
  }

  const response = popupMode
    ? new NextResponse(
      `<!doctype html><html><body><script>
        try {
          if (window.opener) {
            window.opener.postMessage({ type: "GBP_AUTH_SUCCESS" }, window.location.origin);
          }
        } catch (_) {}
        window.close();
      </script></body></html>`,
      { headers: { "content-type": "text/html; charset=utf-8" } },
    )
    : NextResponse.redirect(`${baseUrl}/review-coach?auth=success`);
  response.cookies.delete("gbp_oauth_state");
  response.cookies.delete("gbp_oauth_popup");

  response.cookies.set("gbp_access_token", tokens.access_token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: tokens.expires_in ?? 3600,
    path: "/",
  });

  if (tokens.refresh_token) {
    response.cookies.set("gbp_refresh_token", tokens.refresh_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30,
      path: "/",
    });
  }

  return response;
}
