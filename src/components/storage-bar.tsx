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
    <div className="mb-5 rounded-2xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <span className="inline-flex items-center gap-2 font-semibold"><HardDrive size={16} className="text-gold" /> Storage</span>
        <span className="text-muted-foreground">
          {formatBytes(remaining)} free of {formatBytes(data.total)} · {formatBytes(data.used)} used
        </span>
      </div>
      <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-muted">
        <div className={`h-full rounded-full ${pct > 90 ? "bg-destructive" : "bg-gold"}`} style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-2 text-xs text-muted-foreground">Max file size: 5 MB per file.</p>
    </div>
  );
}
