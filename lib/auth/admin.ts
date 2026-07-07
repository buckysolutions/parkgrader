/**
 * Verify a key matches the configured monitoring secret.
 * Used by the monitoring worker endpoint to authenticate cron calls.
 */
export function verifyMonitoringKey(key: string | null): boolean {
  if (!key) return false;
  const secret = process.env.MONITORING_SECRET;
  if (!secret) return false;
  return key === secret;
}
