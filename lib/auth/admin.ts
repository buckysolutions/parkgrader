import { NextRequest } from "next/server";

const HEADER_KEY = "x-admin-key";
const QUERY_KEY = "admin_key";

/**
 * Verify the request has a valid admin key. Matches the existing BYPASS_KEY
 * pattern used for tradeshow mode in `app/api/tradeshow-access/route.ts`.
 *
 * Checks in order:
 * 1. Header `x-admin-key`
 * 2. Query parameter `?admin_key=...`
 */
export function verifyAdminKey(request: NextRequest): boolean {
  const adminKey = process.env.BYPASS_KEY;
  if (!adminKey) return false;

  const fromHeader = request.headers.get(HEADER_KEY);
  if (fromHeader && fromHeader === adminKey) return true;

  const fromQuery = request.nextUrl.searchParams.get(QUERY_KEY);
  if (fromQuery && fromQuery === adminKey) return true;

  return false;
}

/**
 * Check a key against the configured admin key regardless of source.
 * Used by internal callers (e.g., the monitoring worker curl command)
 * that pass a dedicated MONITORING_SECRET instead of the admin dashboard key.
 */
export function verifyMonitoringKey(key: string | null): boolean {
  if (!key) return false;
  const secret = process.env.MONITORING_SECRET ?? process.env.BYPASS_KEY;
  if (!secret) return false;
  return key === secret;
}
