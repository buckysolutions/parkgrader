"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

interface QueueNotification {
  id: string;
  website: { businessName: string; domain: string };
  type: string;
  email: string | null;
  status: string;
  createdAt: string;
}

export function NotificationQueue({
  notifications: initial,
  adminKey,
  className,
}: {
  notifications: QueueNotification[];
  adminKey: string;
  className?: string;
}) {
  const [items, setItems] = useState(initial);
  const [acting, setActing] = useState<string | null>(null);

  async function handleAction(id: string, action: string) {
    setActing(id);
    try {
      await fetch(`/api/admin/monitoring/notifications?admin_key=${adminKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action }),
      });
      setItems((prev) => prev.filter((n) => n.id !== id));
    } catch {
      // keep item visible on error
    } finally {
      setActing(null);
    }
  }

  if (items.length === 0) {
    return (
      <div className={cn("py-8 text-center text-[#8C97A8]", className)}>
        No pending notifications
      </div>
    );
  }

  return (
    <div className={cn("space-y-3", className)}>
      {items.map((n) => (
        <div
          key={n.id}
          className="glass-card rounded-xl bg-white p-4"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-semibold text-[#0A1628]">
                {n.website.businessName}
              </p>
              <p className="text-sm text-[#8C97A8]">{n.website.domain}</p>
              <p className="mt-1 text-sm capitalize text-[#5B6776]">
                {n.type.replace(/_/g, " ")}
                {n.email && <span> — {n.email}</span>}
              </p>
              <p className="text-xs text-[#8C97A8]">
                {new Date(n.createdAt).toLocaleString()}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handleAction(n.id, "approve")}
                disabled={acting === n.id}
                className="rounded-lg bg-[#16A34A] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-green-700 disabled:opacity-50"
              >
                Approve &amp; Send
              </button>
              <button
                onClick={() => handleAction(n.id, "snooze")}
                disabled={acting === n.id}
                className="rounded-lg bg-[#D97706] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-amber-700 disabled:opacity-50"
              >
                Snooze
              </button>
              <button
                onClick={() => handleAction(n.id, "dismiss")}
                disabled={acting === n.id}
                className="rounded-lg bg-gray-200 px-3 py-1.5 text-xs font-semibold text-[#5B6776] transition hover:bg-gray-300 disabled:opacity-50"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
