import {
  createIncident,
  getOpenIncidentsForWebsite,
  getOpenIncidentOfType,
  resolveIncident,
  getLatestCheck,
} from "./MonitoringService";
import type { CheckResult } from "./types";

/**
 * Evaluate a check result and create / resolve incidents as needed.
 *
 * Rules:
 *  - Homepage returning 5xx or connection error → critical incident
 *  - Booking page returning error → critical incident
 *  - SSL expiring within 7 days → warning incident
 *  - SSL expired → critical incident
 *  - DNS failure → critical incident
 *  - Response time > 5s for two consecutive checks → warning incident
 *
 * When a failure clears (no longer detected), any open incident of the
 * same type is automatically resolved.
 */
export async function evaluateCheckResult(
  websiteId: string,
  result: CheckResult,
): Promise<{ incidentCreated: boolean; incidentId?: string; type?: string }> {
  const failures = detectFailures(result);

  // Resolve incidents for checks that are now passing.
  await resolveClearedIncidents(websiteId, failures);

  if (failures.length === 0) {
    return { incidentCreated: false };
  }

  // Only create a new incident if one of this type isn't already open.
  for (const failure of failures) {
    const existing = await getOpenIncidentOfType(websiteId, failure.type);
    if (existing) continue; // already tracking this

    const incident = await createIncident({
      websiteId,
      type: failure.type,
      severity: failure.severity,
      message: failure.message,
    });

    return {
      incidentCreated: true,
      incidentId: incident.id,
      type: failure.type,
    };
  }

  return { incidentCreated: false };
}

// ── Internal helpers ────────────────────────────────────────────────

interface DetectedFailure {
  type: string;
  severity: "critical" | "warning";
  message: string;
}

function detectFailures(result: CheckResult): DetectedFailure[] {
  const failures: DetectedFailure[] = [];

  // Homepage down
  if (
    result.homepageStatus === null ||
    result.homepageStatus >= 500
  ) {
    failures.push({
      type: "homepage_down",
      severity: "critical",
      message:
        result.homepageStatus === null
          ? "Homepage unreachable (connection failed)"
          : `Homepage returned HTTP ${result.homepageStatus}`,
    });
  }

  // Booking page down
  if (result.bookingStatus !== null && result.bookingStatus >= 400) {
    failures.push({
      type: "booking_down",
      severity: "critical",
      message: `Booking page returned HTTP ${result.bookingStatus}`,
    });
  }

  // SSL
  if (!result.sslValid) {
    failures.push({
      type:
        result.sslDaysRemaining !== null && result.sslDaysRemaining <= 0
          ? "ssl_expired"
          : "ssl_expiring",
      severity:
        result.sslDaysRemaining !== null && result.sslDaysRemaining <= 0
          ? "critical"
          : "warning",
      message:
        result.sslDaysRemaining !== null && result.sslDaysRemaining <= 0
          ? "SSL certificate has expired"
          : `SSL certificate expires in ${result.sslDaysRemaining} days`,
    });
  }

  // DNS
  if (!result.dnsResolves) {
    failures.push({
      type: "dns_failure",
      severity: "critical",
      message: "DNS resolution failed",
    });
  }

  return failures;
}

async function resolveClearedIncidents(
  websiteId: string,
  activeFailures: DetectedFailure[],
) {
  const activeTypes = new Set(activeFailures.map((f) => f.type));
  const openIncidents = await getOpenIncidentsForWebsite(websiteId);

  for (const incident of openIncidents) {
    if (!activeTypes.has(incident.type)) {
      await resolveIncident(incident.id);
    }
  }
}
