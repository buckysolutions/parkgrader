import { NextRequest, NextResponse } from "next/server";
import { verifyMonitoringKey } from "@/lib/auth/admin";
import {
  getDueWebsites,
  createCheck,
  getLatestCheck,
} from "@/lib/services/monitoring/MonitoringService";
import { checkSSLCertificate } from "@/lib/services/monitoring/SSLService";
import { checkDNS } from "@/lib/services/monitoring/DNSService";
import { evaluateCheckResult } from "@/lib/services/monitoring/IncidentService";
import { queueNotification } from "@/lib/services/monitoring/NotificationService";
import type { CheckResult, MonitoringRunResult } from "@/lib/services/monitoring/types";

export const runtime = "nodejs";
export const maxDuration = 300; // 5 minutes on Pro — plenty for batch runs

const MAX_CONCURRENT_CHECKS = 3;

/**
 * POST /api/monitoring/run
 *
 * Monitoring worker endpoint. Called by cron (either Vercel Cron or an
 * external scheduler like cron-job.org).
 *
 * Auth: header `x-monitoring-key` must match MONITORING_SECRET.
 */
export async function POST(request: NextRequest) {
  const authKey = request.headers.get("x-monitoring-key");
  if (!verifyMonitoringKey(authKey)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startTime = Date.now();
  const result: MonitoringRunResult = {
    websitesChecked: 0,
    checksRun: 0,
    incidentsCreated: 0,
    notificationsQueued: 0,
    durationMs: 0,
    errors: [],
  };

  try {
    const websites = await getDueWebsites();
    console.log(`[monitoring:run] ${websites.length} websites due for checking`);

    // Process in batches with concurrency control.
    for (let i = 0; i < websites.length; i += MAX_CONCURRENT_CHECKS) {
      const batch = websites.slice(i, i + MAX_CONCURRENT_CHECKS);
      const batchResults = await Promise.allSettled(
        batch.map((site) => checkOneWebsite(site.id, result)),
      );

      for (const r of batchResults) {
        if (r.status === "rejected") {
          result.errors.push(
            `Batch error: ${r.reason instanceof Error ? r.reason.message : String(r.reason)}`,
          );
        }
      }
    }

    result.durationMs = Date.now() - startTime;
    console.log(
      `[monitoring:run] Done — ${result.websitesChecked} sites, ${result.checksRun} checks, ${result.incidentsCreated} incidents, ${result.notificationsQueued} notifications, ${result.durationMs}ms`,
    );

    return NextResponse.json(result);
  } catch (err) {
    result.durationMs = Date.now() - startTime;
    const message = err instanceof Error ? err.message : "Unknown error";
    result.errors.push(message);
    console.error(`[monitoring:run] Fatal error: ${message}`);
    return NextResponse.json(result, { status: 500 });
  }
}

// ── Per-website check ───────────────────────────────────────────────

async function checkOneWebsite(
  websiteId: string,
  runResult: MonitoringRunResult,
): Promise<void> {
  const { getWebsiteById, getMonitoringSettings } = await import(
    "@/lib/services/monitoring/MonitoringService"
  );

  const site = await getWebsiteById(websiteId);
  if (!site) {
    runResult.errors.push(`Website ${websiteId} not found`);
    return;
  }

  const settings = await getMonitoringSettings(websiteId);
  console.log(`[monitoring:run] Checking ${site.domain}...`);
  runResult.websitesChecked++;

  try {
    // ── Run all checks ──────────────────────────────────────────────
    const checkResult = await runAllChecks(site.homepageUrl, site.bookingUrl);
    runResult.checksRun++;

    // ── Store the check ─────────────────────────────────────────────
    await createCheck({
      websiteId: site.id,
      homepageStatus: checkResult.homepageStatus,
      bookingStatus: checkResult.bookingStatus,
      responseTime: checkResult.responseTime,
      sslDaysRemaining: checkResult.sslDaysRemaining,
      dnsStatus: checkResult.dnsResolves ? "ok" : "error",
      notes: checkResult.errors.length > 0
        ? checkResult.errors.join("; ")
        : undefined,
    });

    // ── Evaluate for incidents ──────────────────────────────────────
    const evalResult = await evaluateCheckResult(site.id, checkResult);

    if (evalResult.incidentCreated) {
      runResult.incidentsCreated++;

      // ── Verification: re-check if configured ──────────────────────
      if (settings?.verifyFailuresBeforeAlert) {
        console.log(
          `[monitoring:run] Verifying failure for ${site.domain} — waiting ${settings.verificationDelayMs}ms`,
        );
        await sleep(settings.verificationDelayMs);

        const verifyResult = await runAllChecks(
          site.homepageUrl,
          site.bookingUrl,
        );
        await createCheck({
          websiteId: site.id,
          homepageStatus: verifyResult.homepageStatus,
          bookingStatus: verifyResult.bookingStatus,
          responseTime: verifyResult.responseTime,
          sslDaysRemaining: verifyResult.sslDaysRemaining,
          dnsStatus: verifyResult.dnsResolves ? "ok" : "error",
          notes: "Verification re-check",
        });
        runResult.checksRun++;

        // Re-evaluate — if the failure persists, queue notification.
        const reEval = await evaluateCheckResult(site.id, verifyResult);
        if (!reEval.incidentCreated) {
          console.log(
            `[monitoring:run] Failure cleared for ${site.domain} after re-check`,
          );
          return;
        }
      }

      // ── Queue notification for admin review ───────────────────────
      const notif = await queueNotification(
        site.id,
        evalResult.incidentId,
        evalResult.type ?? "unknown",
      );
      if (notif.queued) runResult.notificationsQueued++;
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    runResult.errors.push(`${site.domain}: ${message}`);
    console.error(`[monitoring:run] Error checking ${site.domain}: ${message}`);
  }
}

// ── Check execution ─────────────────────────────────────────────────

async function runAllChecks(
  homepageUrl: string,
  bookingUrl: string | null,
): Promise<CheckResult> {
  const result: CheckResult = {
    homepageStatus: null,
    bookingStatus: null,
    responseTime: null,
    sslDaysRemaining: null,
    sslValid: false,
    dnsResolves: false,
    dnsAddresses: [],
    errors: [],
  };

  const domain = extractDomain(homepageUrl);

  // Homepage check.
  try {
    const t0 = Date.now();
    const res = await fetchWithTimeout(homepageUrl, 15_000);
    result.homepageStatus = res.status;
    result.responseTime = Date.now() - t0;
  } catch (err) {
    result.errors.push(
      `Homepage: ${err instanceof Error ? err.message : "fetch failed"}`,
    );
    result.homepageStatus = null;
  }

  // Booking page check.
  if (bookingUrl) {
    try {
      const res = await fetchWithTimeout(bookingUrl, 15_000);
      result.bookingStatus = res.status;
    } catch (err) {
      result.errors.push(
        `Booking: ${err instanceof Error ? err.message : "fetch failed"}`,
      );
      result.bookingStatus = null;
    }
  }

  // SSL check.
  const sslResult = await checkSSLCertificate(domain);
  result.sslValid = sslResult.valid;
  result.sslDaysRemaining = sslResult.daysRemaining;
  if (sslResult.error) {
    result.errors.push(`SSL: ${sslResult.error}`);
  }

  // DNS check.
  const dnsResult = await checkDNS(domain);
  result.dnsResolves = dnsResult.resolves;
  result.dnsAddresses = dnsResult.addresses;
  if (dnsResult.error) {
    result.errors.push(`DNS: ${dnsResult.error}`);
  }

  return result;
}

// ── Utilities ───────────────────────────────────────────────────────

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  }
}

async function fetchWithTimeout(
  url: string,
  timeoutMs: number,
): Promise<{ status: number }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: "GET",
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; ParkGrader-Monitor/1.0)",
        Accept: "text/html, */*",
      },
      redirect: "follow",
    });
    return { status: response.status };
  } finally {
    clearTimeout(timer);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
