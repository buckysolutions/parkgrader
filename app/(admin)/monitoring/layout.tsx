"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense } from "react";

const PARKGRADER_LOGO = "https://assets.buckysolutions.com/parkgrader_logo.svg";

const navItems = [
  { href: "overview", label: "Overview" },
  { href: "incidents", label: "Incidents" },
  { href: "notifications", label: "Notifications" },
];

function AdminNav() {
  const pathname = usePathname();
  const params = useSearchParams();
  const key = params.get("admin_key") ?? "";
  const keyParam = key ? `?admin_key=${encodeURIComponent(key)}` : "";

  function isActive(href: string) {
    if (href === "overview" && (pathname === "/monitoring" || pathname === "/monitoring/overview")) return true;
    return pathname === `/monitoring/${href}`;
  }

  return (
    <header className="sticky top-0 z-40 border-b border-white/20 bg-white/40 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        {/* Logo */}
        <Link
          href={`/monitoring/overview${keyParam}`}
          className="flex items-center gap-2"
        >
          <img
            src={PARKGRADER_LOGO}
            alt="ParkGrader"
            className="h-7 w-auto"
          />
          <span className="text-[11px] font-medium tracking-wide text-[#8C97A8]">
            Monitoring
          </span>
        </Link>

        {/* Nav */}
        <nav className="flex items-center gap-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={`/monitoring/${item.href}${keyParam}`}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                isActive(item.href)
                  ? "bg-[#2DA4A9]/10 text-[#2DA4A9]"
                  : "text-[#5B6776] hover:bg-gray-100 hover:text-[#0A1628]"
              }`}
            >
              {item.label}
            </Link>
          ))}
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
      className="relative min-h-screen"
      style={{ fontFamily: "var(--font-dm-sans), sans-serif" }}
    >
      {/* ── Background gradient (matches landing page) ── */}
      <div className="fixed inset-0 -z-10 overflow-hidden">
        {/* Base gradient */}
        <div className="absolute inset-0 bg-[linear-gradient(135deg,#f0f9f8_0%,#e9fdfe_25%,#e6f4f1_50%,#f5f0e8_75%,#fef8f0_100%)]" />
        {/* Colored blur orbs */}
        <div className="absolute -left-32 top-16 h-[360px] w-[360px] rounded-full bg-[#54a2a7]/20 blur-[115px]" />
        <div className="absolute right-[-180px] top-[20%] h-[460px] w-[460px] rounded-full bg-[#00a9ba]/22 blur-[125px]" />
        <div className="absolute bottom-[-180px] left-1/2 h-[460px] w-[680px] -translate-x-1/2 rounded-full bg-[#5abf7e]/20 blur-[135px]" />
        <div className="absolute -right-20 top-[8%] h-[260px] w-[260px] rounded-full bg-[#ff8a44]/14 blur-[110px]" />
        <div className="absolute -left-16 bottom-[12%] h-[240px] w-[240px] rounded-full bg-[#7cc7ff]/12 blur-[105px]" />
        {/* Radial overlay */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.08)_0%,rgba(255,255,255,0.18)_42%,rgba(255,255,255,0.34)_100%)]" />
      </div>

      <Suspense fallback={null}>
        <AdminNav />
      </Suspense>
      <main className="relative z-10 mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}
