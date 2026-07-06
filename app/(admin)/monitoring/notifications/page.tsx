"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { NotificationQueue } from "@/components/monitoring/NotificationQueue";

interface NotificationItem {
  id: string;
  website: { businessName: string; domain: string };
  type: string;
  email: string | null;
  status: string;
  createdAt: string;
}

function NotificationsPage() {
  const params = useSearchParams();
  const adminKey = params.get("admin_key") ?? "";

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(
          `/api/admin/monitoring/notifications?status=pending&admin_key=${adminKey}`,
        );
        if (res.ok) {
          const data = await res.json();
          setNotifications(data.notifications ?? []);
        }
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [adminKey]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#0A1628]">Notifications</h1>
        <p className="mt-1 text-sm text-[#8C97A8]">
          Review and approve alerts before they are sent to customers
        </p>
      </div>

      {loading ? (
        <div className="h-64 animate-pulse rounded-xl bg-gray-100" />
      ) : (
        <NotificationQueue
          notifications={notifications}
          adminKey={adminKey}
        />
      )}
    </div>
  );
}

export default function NotificationsPageWrapper() {
  return (
    <Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-gray-100" />}>
      <NotificationsPage />
    </Suspense>
  );
}
