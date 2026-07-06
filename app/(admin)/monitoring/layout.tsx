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
    <header className="sticky top-0 z-40 border-b border-[#E6EBF0] bg-white/80 backdrop-blur-lg">
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
    <div className="min-h-screen bg-[#F8FAFC]" style={{ fontFamily: "var(--font-dm-sans), sans-serif" }}>
      <Suspense fallback={null}>
        <AdminNav />
      </Suspense>
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}
