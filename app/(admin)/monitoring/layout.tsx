"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const PARKGRADER_LOGO = "https://assets.buckysolutions.com/parkgrader_logo.svg";

const navItems = [
  { href: "", label: "Overview" },
  { href: "/incidents", label: "Incidents" },
  { href: "/notifications", label: "Notifications" },
];

function AdminNav() {
  const pathname = usePathname();

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
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                  active
                    ? "bg-[#2DA4A9]/10 text-[#2DA4A9]"
                    : "text-[#5B6776] hover:bg-gray-100 hover:text-[#0A1628]"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
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
