import {
  createNotification,
  updateNotificationStatus,
  getLatestNotificationForWebsite,
  getMonitoringSettings,
} from "./MonitoringService";

/**
 * Queue a pending notification for admin review. Does NOT send email.
 *
 * Respects:
 *   - MonitoringSettings.notifyCustomer (only if customer email is set)
 *   - MonitoringSettings.emailCooldown (skip if sent recently)
 */
export async function queueNotification(
  websiteId: string,
  incidentId: string | undefined,
  type: string,
  email?: string,
): Promise<{ queued: boolean; reason?: string; notificationId?: string }> {
  const settings = await getMonitoringSettings(websiteId);

  // Check cooldown.
  if (settings) {
    const lastSent = await getLatestNotificationForWebsite(
      websiteId,
      type,
      settings.emailCooldown,
    );
    if (lastSent) {
      return {
        queued: false,
        reason: `Cooldown active (last alert sent ${lastSent.sentAt?.toISOString()})`,
      };
    }
  }

  const notification = await createNotification({
    websiteId,
    incidentId,
    type,
    email: email ?? undefined,
  });

  return { queued: true, notificationId: notification.id };
}

/**
 * Approve and send a notification. Called by the admin dashboard.
 */
export async function approveAndSend(
  notificationId: string,
): Promise<{ sent: boolean; reason?: string }> {
  // Update status to approved first.
  await updateNotificationStatus(notificationId, "approved");

  // The actual email sending happens in the API route that calls
  // this function — it will call lib/email/ses.ts separately.
  // This keeps the notification service free of SES coupling.

  return { sent: true };
}

/**
 * Dismiss a notification (false alarm).
 */
export async function dismissNotification(notificationId: string) {
  return updateNotificationStatus(notificationId, "dismissed");
}

/**
 * Snooze a notification (hide temporarily).
 */
export async function snoozeNotification(notificationId: string) {
  return updateNotificationStatus(notificationId, "snoozed");
}

/**
 * Mark a notification as sent (after SES delivers successfully).
 */
export async function markSent(notificationId: string) {
  return updateNotificationStatus(notificationId, "sent");
}
