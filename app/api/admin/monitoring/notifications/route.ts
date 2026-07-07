import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  getNotifications,
  updateNotificationStatus,
} from "@/lib/services/monitoring/MonitoringService";
import { sendMonitoringAlert } from "@/lib/email/ses";

export const runtime = "nodejs";

async function requireAuth() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function GET(request: NextRequest) {
  if (!(await requireAuth())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const status = request.nextUrl.searchParams.get("status") ?? undefined;
  const notifications = await getNotifications(status);
  return NextResponse.json({ notifications });
}

export async function POST(request: NextRequest) {
  if (!(await requireAuth())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();

  if (!body.id || !body.action) {
    return NextResponse.json(
      { error: "id and action are required" },
      { status: 400 },
    );
  }

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
      if (notification.email) {
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
