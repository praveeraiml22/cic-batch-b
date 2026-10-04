import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { HardDrive } from "lucide-react";
import { getStorageUsage } from "@/lib/storage.functions";
import { formatBytes } from "@/lib/upload";

export function StorageBar() {
  const fetchUsage = useServerFn(getStorageUsage);
  const { data } = useQuery({ queryKey: ["storage-usage"], queryFn: () => fetchUsage() });
  if (!data) return null;
  const pct = Math.min(100, (data.used / data.total) * 100);
  const remaining = Math.max(0, data.total - data.used);
  return (
    <div className="rounded-lg border border-border bg-card/60 px-3 py-2">
      <div className="flex items-center gap-2 text-[11px] leading-none">
        <HardDrive size={12} className="shrink-0 text-gold" />
        <span className="font-semibold text-foreground">Storage</span>
        <span className="text-muted-foreground truncate">
          {formatBytes(remaining)} free · {formatBytes(data.used)} used of {formatBytes(data.total)}
        </span>
        <span className="ml-auto shrink-0 text-muted-foreground tabular-nums">{Math.round(pct)}%</span>
      </div>
      <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-muted">
        <div className={`h-full rounded-full ${pct > 90 ? "bg-destructive" : "bg-gold"}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
