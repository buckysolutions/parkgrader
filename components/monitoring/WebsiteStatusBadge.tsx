import { cn } from "@/lib/utils";

type Status = "healthy" | "warning" | "critical" | "unknown";

const styles: Record<Status, string> = {
  healthy: "bg-green-100 text-green-800",
  warning: "bg-amber-100 text-amber-800",
  critical: "bg-red-100 text-red-800",
  unknown: "bg-gray-100 text-gray-500",
};

const labels: Record<Status, string> = {
  healthy: "Healthy",
  warning: "Warning",
  critical: "Critical",
  unknown: "Unknown",
};

export function WebsiteStatusBadge({
  status,
  className,
}: {
  status: Status;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
        styles[status],
        className,
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", {
        "bg-green-500": status === "healthy",
        "bg-amber-500": status === "warning",
        "bg-red-500": status === "critical",
        "bg-gray-400": status === "unknown",
      })} />
      {labels[status]}
    </span>
  );
}
