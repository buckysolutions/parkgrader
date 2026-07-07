"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface NotificationItem {
  id: string;
  website: { businessName: string; domain: string };
  type: string;
  email: string | null;
  status: string;
  createdAt: string;
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/admin/monitoring/notifications?status=pending");
        if (res.ok) setNotifications((await res.json()).notifications ?? []);
      } finally { setLoading(false); }
    }
    load();
  }, []);

  async function handleAction(id: string, action: string) {
    setActing(id);
    try {
      await fetch("/api/admin/monitoring/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action }),
      });
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    } finally { setActing(null); }
  }

  return (
    <div className="space-y-8">
      <div>
        <div className="flex items-center gap-2 text-sm">
          <Link href="/monitoring" className="text-[#8C97A8] hover:text-[#2DA4A9]">Monitoring</Link>
          <span className="text-[#C4CCD4]">/</span>
          <span className="font-medium text-[#0A1628]">Notifications</span>
        </div>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-[#0A1628]">Notifications</h1>
        <p className="mt-1 text-sm text-[#8C97A8]">Review and approve alerts before they are sent</p>
      </div>

      {loading ? (
        <div className="space-y-3">{[...Array(2)].map((_, i) => <div key={i} className="h-28 animate-pulse rounded-2xl bg-gray-100" />)}</div>
      ) : notifications.length === 0 ? (
        <div className="glass-card rounded-2xl bg-white py-16 text-center">
          <p className="text-[#8C97A8]">No pending notifications</p>
          <p className="mt-1 text-sm text-[#8C97A8]">Alerts appear here when issues are detected</p>
        </div>
      ) : (
        <div className="space-y-3">
          {notifications.map((n) => (
            <div key={n.id} className="glass-card rounded-2xl bg-white p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="font-medium text-[#0A1628]">{n.website.businessName}</p>
                  <p className="text-sm text-[#8C97A8]">{n.website.domain}</p>
                  <p className="mt-1 text-sm capitalize text-[#5B6776]">{n.type.replace(/_/g, " ")}{n.email && <span className="text-[#8C97A8]"> — {n.email}</span>}</p>
                  <p className="text-xs text-[#8C97A8]">{new Date(n.createdAt).toLocaleString()}</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => handleAction(n.id, "approve")} disabled={acting === n.id} style={{ borderRadius: "12px" }} className="bg-[#16A34A] px-4 py-2 text-sm font-medium text-white transition hover:bg-green-700 disabled:opacity-50">Approve &amp; Send</button>
                  <button onClick={() => handleAction(n.id, "snooze")} disabled={acting === n.id} style={{ borderRadius: "12px" }} className="bg-[#D97706] px-4 py-2 text-sm font-medium text-white transition hover:bg-amber-700 disabled:opacity-50">Snooze</button>
                  <button onClick={() => handleAction(n.id, "dismiss")} disabled={acting === n.id} style={{ borderRadius: "12px" }} className="bg-gray-200 px-4 py-2 text-sm font-medium text-[#5B6776] transition hover:bg-gray-300 disabled:opacity-50">Dismiss</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
