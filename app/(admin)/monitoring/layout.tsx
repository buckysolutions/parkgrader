"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

const navItems = [
  { href: "overview", label: "Overview", icon: "◉" },
  { href: "incidents", label: "Incidents", icon: "⚠" },
  { href: "notifications", label: "Notifications", icon: "✉" },
];

function AdminNav() {
  const params = useSearchParams();
  const key = params.get("admin_key") ?? "";
  const keyParam = key ? `?admin_key=${encodeURIComponent(key)}` : "";

  return (
    <aside className="fixed left-0 top-0 z-40 flex h-full w-56 flex-col border-r border-[#E6EBF0] bg-[#0A1628] text-white">
      {/* Brand */}
      <div className="border-b border-white/10 px-5 py-5">
        <Link href={`/monitoring${keyParam}`} className="text-lg font-bold tracking-tight">
          <span className="text-[#2DA4A9]">Park</span>Grader
        </Link>
        <p className="mt-0.5 text-[11px] text-white/50">Monitoring</p>
      </div>

      {/* Nav links */}
      <nav className="flex-1 px-3 py-4">
        <ul className="space-y-1">
          {navItems.map((item) => (
            <li key={item.href}>
              <Link
                href={`/monitoring/${item.href}${keyParam}`}
                className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-white/70 transition hover:bg-white/10 hover:text-white"
              >
                <span className="text-xs">{item.icon}</span>
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {/* Footer */}
      <div className="border-t border-white/10 px-5 py-4">
        <p className="text-[10px] text-white/30">ParkGrader v1.0</p>
      </div>
    </aside>
  );
}

export default function MonitoringLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <Suspense fallback={null}>
        <AdminNav />
      </Suspense>
      <main className="ml-56 p-6">{children}</main>
    </div>
  );
}
