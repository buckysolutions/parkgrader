import { NextRequest, NextResponse } from "next/server";
import { verifyAdminKey } from "@/lib/auth/admin";
import {
  getNotifications,
  updateNotificationStatus,
} from "@/lib/services/monitoring/MonitoringService";
import { sendMonitoringAlert } from "@/lib/email/ses";

export const runtime = "nodejs";

/**
 * GET /api/admin/monitoring/notifications
 *
 * List notifications. Optional query param: ?status=pending|approved|sent|dismissed|snoozed
 */
export async function GET(request: NextRequest) {
  if (!verifyAdminKey(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const status = request.nextUrl.searchParams.get("status") ?? undefined;
  const notifications = await getNotifications(status);
  return NextResponse.json({ notifications });
}

/**
 * POST /api/admin/monitoring/notifications
 *
 * Update notification status:
 *   { id, action: "approve" | "dismiss" | "snooze" }
 *
 * "approve" also sends the email via SES.
 */
export async function POST(request: NextRequest) {
  if (!verifyAdminKey(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const body = await request.json();

  if (!body.id || !body.action) {
    return NextResponse.json(
      { error: "id and action are required" },
      { status: 400 },
    );
  }

  // Fetch the notification to get website/incident details.
  const existing = await getNotifications(undefined);
  const notification = existing.find((n) => n.id === body.id);

  if (!notification) {
    return NextResponse.json(
      { error: "Notification not found" },
      { status: 404 },
    );
  }

  switch (body.action) {
    case "approve": {
      // Send email if we have an address.
      if (notification.email) {
        // Look up the website for alert details.
        const { getWebsiteById } = await import(
          "@/lib/services/monitoring/MonitoringService"
        );
        const website = await getWebsiteById(notification.websiteId);

        if (website) {
          await sendMonitoringAlert({
            to: notification.email,
            websiteName: website.businessName,
            incidentType: notification.type,
            incidentMessage: `An issue was detected with ${website.domain}.`,
            incidentTime: notification.createdAt.toISOString(),
            websiteUrl: website.homepageUrl,
          });
        }
      }

      await updateNotificationStatus(body.id, "sent");
      break;
    }
    case "dismiss":
      await updateNotificationStatus(body.id, "dismissed");
      break;
    case "snooze":
      await updateNotificationStatus(body.id, "snoozed");
      break;
    default:
      return NextResponse.json(
        { error: `Unknown action: ${body.action}` },
        { status: 400 },
      );
  }

  return NextResponse.json({ success: true });
}
