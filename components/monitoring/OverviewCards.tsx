"use client";

import { cn } from "@/lib/utils";

interface StatCard {
  label: string;
  value: string | number;
  subtitle?: string;
  accent: "teal" | "green" | "amber" | "red" | "gray";
}

const accentStyles: Record<StatCard["accent"], string> = {
  teal: "border-l-[#2DA4A9]",
  green: "border-l-[#16A34A]",
  amber: "border-l-[#D97706]",
  red: "border-l-[#DC2626]",
  gray: "border-l-[#8C97A8]",
};

export function OverviewCards({
  cards,
  className,
}: {
  cards: StatCard[];
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
        className,
      )}
    >
      {cards.map((card) => (
        <div
          key={card.label}
          className={cn(
            "glass-card rounded-xl border-l-4 bg-white p-5",
            accentStyles[card.accent],
          )}
        >
          <p className="text-sm text-[#5B6776]">{card.label}</p>
          <p className="mt-1 text-3xl font-bold text-[#0A1628]">{card.value}</p>
          {card.subtitle && (
            <p className="mt-1 text-xs text-[#8C97A8]">{card.subtitle}</p>
          )}
        </div>
      ))}
    </div>
  );
}
