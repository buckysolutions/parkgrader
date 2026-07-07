"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";

const PARKGRADER_LOGO = "https://assets.buckysolutions.com/parkgrader_logo.svg";

function AdminNav() {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  const [openIncidents, setOpenIncidents] = useState(0);
  const [pendingNotifications, setPendingNotifications] = useState(0);

  useEffect(() => {
    async function fetchCounts() {
      try {
        const [incRes, notifRes] = await Promise.all([
          fetch("/api/admin/monitoring/incidents?status=open"),
          fetch("/api/admin/monitoring/notifications?status=pending"),
        ]);
        if (incRes.ok) {
          const data = await incRes.json();
          setOpenIncidents(data.incidents?.length ?? 0);
        }
        if (notifRes.ok) {
          const data = await notifRes.json();
          setPendingNotifications(data.notifications?.length ?? 0);
        }
      } catch { /* ignore */ }
    }
    void fetchCounts();
    const interval = setInterval(fetchCounts, 30000); // poll every 30s
    return () => clearInterval(interval);
  }, []);

  const navItems = [
    { href: "", label: "Overview" },
    { href: "/incidents", label: "Incidents", badge: openIncidents },
    { href: "/notifications", label: "Notifications", badge: pendingNotifications },
  ];

  async function signOut() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-40 border-b border-[#E6EBF0] bg-white">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        <Link href="/monitoring" className="flex items-center gap-2">
          <img src={PARKGRADER_LOGO} alt="ParkGrader" className="h-7 w-auto" />
          <span className="text-[11px] font-medium tracking-wide text-[#8C97A8]">Monitoring</span>
        </Link>

        <nav className="flex items-center gap-1">
          {navItems.map((item) => {
            const href = `/monitoring${item.href}`;
            const active = item.href === ""
              ? pathname === "/monitoring"
              : pathname === `/monitoring${item.href}`;

            return (
              <Link
                key={item.href}
                href={href}
                className={`relative rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                  active
                    ? "bg-[#2DA4A9]/10 text-[#2DA4A9]"
                    : "text-[#5B6776] hover:bg-gray-100 hover:text-[#0A1628]"
                }`}
              >
                {item.label}
                {item.badge != null && item.badge > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[#DC2626] px-1 text-[10px] font-bold text-white">
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
          <button
            onClick={signOut}
            className="btn-rounded ml-3 px-3 py-1.5 text-sm font-medium text-[#8C97A8] transition hover:bg-gray-100 hover:text-[#DC2626]"
          >
            Sign out
          </button>
        </nav>
      </div>
    </header>
  );
}

export default function MonitoringLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      className="min-h-screen bg-[#F8FAFC]"
      style={{ fontFamily: "var(--font-dm-sans), sans-serif" }}
    >
      <AdminNav />
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}
