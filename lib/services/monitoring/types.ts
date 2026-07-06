// ── Website Status ──────────────────────────────────────────────────

export type WebsiteStatus = "healthy" | "warning" | "critical" | "unknown";

// ── Incident Types ──────────────────────────────────────────────────

export const INCIDENT_TYPES = [
  "homepage_down",
  "booking_down",
  "ssl_expiring",
  "ssl_expired",
  "dns_failure",
  "slow_response",
  "degraded_performance",
  "unexpected_redirect",
] as const;

export type IncidentType = (typeof INCIDENT_TYPES)[number];

export type IncidentSeverity = "critical" | "warning";

// ── Notification Types ──────────────────────────────────────────────

export type NotificationStatus =
  | "pending"
  | "approved"
  | "dismissed"
  | "snoozed"
  | "sent";

// ── Check Result ────────────────────────────────────────────────────

export interface CheckResult {
  homepageStatus: number | null;
  bookingStatus: number | null;
  responseTime: number | null;
  sslDaysRemaining: number | null;
  sslValid: boolean;
  dnsResolves: boolean;
  dnsAddresses: string[];
  errors: string[];
}

// ── Health Score ────────────────────────────────────────────────────

export interface HealthScoreBreakdown {
  websiteOnline: number;
  bookingOnline: number;
  sslValid: number;
  dnsOk: number;
  performance: number;
  incidentPenalty: number;
}

export interface HealthScore {
  total: number;
  breakdown: HealthScoreBreakdown;
  status: WebsiteStatus;
}

// ── Dashboard ───────────────────────────────────────────────────────

export interface DashboardSummary {
  healthyCount: number;
  warningCount: number;
  criticalCount: number;
  unknownCount: number;
  totalCount: number;
  avgResponseTime: number | null;
  openIncidents: number;
}

// ── Monitoring Run ──────────────────────────────────────────────────

export interface MonitoringRunResult {
  websitesChecked: number;
  checksRun: number;
  incidentsCreated: number;
  notificationsQueued: number;
  durationMs: number;
  errors: string[];
}

// ── SSL ─────────────────────────────────────────────────────────────

export interface SSLCheckResult {
  valid: boolean;
  daysRemaining: number;
  issuer?: string;
  error?: string;
}

// ── DNS ─────────────────────────────────────────────────────────────

export interface DNSCheckResult {
  resolves: boolean;
  addresses: string[];
  error?: string;
}

// ── Screenshot ──────────────────────────────────────────────────────

export interface ScreenshotResult {
  path?: string;
  error?: string;
}
