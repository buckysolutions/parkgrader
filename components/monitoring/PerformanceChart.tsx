"use client";

import { cn } from "@/lib/utils";

interface DataPoint {
  time: string;
  value: number;
}

export function PerformanceChart({
  data,
  label,
  className,
}: {
  data: DataPoint[];
  label: string;
  className?: string;
}) {
  if (data.length === 0) {
    return (
      <div className={cn("py-8 text-center text-[#8C97A8]", className)}>
        No data yet
      </div>
    );
  }

  const max = Math.max(...data.map((d) => d.value), 1);
  const min = Math.min(...data.map((d) => d.value), 0);
  const range = max - min || 1;
  const h = 80;
  const w = data.length > 1 ? 100 / (data.length - 1) : 0;

  const points = data
    .map(
      (d, i) =>
        `${i * w},${h - ((d.value - min) / range) * (h - 10) - 5}`,
    )
    .join(" ");

  return (
    <div className={cn("", className)}>
      <p className="mb-2 text-sm font-medium text-[#5B6776]">{label}</p>
      <svg
        width="100%"
        height={h + 20}
        viewBox={`0 0 100 ${h + 20}`}
        preserveAspectRatio="none"
        className="overflow-visible"
      >
        {/* Grid line at 50% */}
        <line
          x1="0" y1={h / 2} x2="100" y2={h / 2}
          stroke="#E6EBF0" strokeWidth="0.5" strokeDasharray="2 2"
        />
        {/* Data line */}
        <polyline
          points={points}
          fill="none"
          stroke="#2DA4A9"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Data dots */}
        {data.map((d, i) => (
          <circle
            key={i}
            cx={i * w}
            cy={h - ((d.value - min) / range) * (h - 10) - 5}
            r="2"
            fill="#2DA4A9"
          />
        ))}
      </svg>
      <div className="mt-1 flex justify-between text-[10px] text-[#8C97A8]">
        <span>{data[0].time}</span>
        <span>{data[data.length - 1].time}</span>
      </div>
    </div>
  );
}
