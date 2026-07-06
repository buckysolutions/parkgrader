"use client";

import { cn } from "@/lib/utils";

interface HealthScoreGaugeProps {
  score: number;
  status: "healthy" | "warning" | "critical" | "unknown";
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizePresets = {
  sm: { w: 120, h: 70, font: "text-xl", label: "text-[10px]" },
  md: { w: 180, h: 100, font: "text-3xl", label: "text-xs" },
  lg: { w: 240, h: 140, font: "text-4xl", label: "text-sm" },
};

const thresholds: Record<string, { dashArray: string; color: string }> = {
  healthy: { dashArray: "283", color: "#16A34A" },
  warning: { dashArray: "180", color: "#D97706" },
  critical: { dashArray: "80", color: "#DC2626" },
  unknown: { dashArray: "0", color: "#8C97A8" },
};

export function HealthScoreGauge({
  score,
  status,
  size = "md",
  className,
}: HealthScoreGaugeProps) {
  const preset = sizePresets[size];
  const t = thresholds[status];
  const r = 45;
  const circumference = 2 * Math.PI * r;

  const statusLabels: Record<string, string> = {
    healthy: "Healthy",
    warning: "Needs Attention",
    critical: "At Risk",
    unknown: "No Data",
  };

  return (
    <div
      className={cn("flex flex-col items-center", className)}
      style={{ width: preset.w }}
    >
      <svg
        width={preset.w}
        height={preset.h}
        viewBox="0 0 120 70"
        className="overflow-visible"
      >
        {/* Background track */}
        <path
          d="M 15 65 A 45 45 0 0 1 105 65"
          fill="none"
          stroke="#E6EBF0"
          strokeWidth="10"
          strokeLinecap="round"
        />
        {/* Score arc */}
        <path
          d="M 15 65 A 45 45 0 0 1 105 65"
          fill="none"
          stroke={t.color}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={`${(score / 100) * circumference} ${circumference}`}
          style={{ transition: "stroke-dasharray 0.6s ease" }}
        />
        {/* Score text */}
        <text
          x="60"
          y="52"
          textAnchor="middle"
          className={cn("font-bold", preset.font)}
          fill="#0A1628"
        >
          {status === "unknown" ? "—" : score}
        </text>
        {/* Status label */}
        <text
          x="60"
          y="68"
          textAnchor="middle"
          className={preset.label}
          fill={t.color}
        >
          {statusLabels[status]}
        </text>
      </svg>
    </div>
  );
}
