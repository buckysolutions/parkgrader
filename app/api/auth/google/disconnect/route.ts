import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  const baseUrl = (process.env.APP_BASE_URL ?? "http://localhost:3000").trim().replace(/\/$/, "");
  const response = NextResponse.redirect(`${baseUrl}/review-coach?auth=disconnected`);
  response.cookies.delete("gbp_access_token");
  response.cookies.delete("gbp_refresh_token");
  return response;
}
