import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, CheckCheck, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { PageHeader } from "@/components/page-header";
import { formatDistanceToNow } from "date-fns";

export const Route = createFileRoute("/_authenticated/notifications")({
  component: NotificationsPage,
});

function NotificationsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["notifications", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications").select("*").eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  async function markAllRead() {
    await supabase.from("notifications").update({ is_read: true }).eq("user_id", user!.id).eq("is_read", false);
    qc.invalidateQueries({ queryKey: ["notifications"] });
  }

  return (
    <div className="p-4 sm:p-6 lg:p-10 max-w-4xl mx-auto">
      <PageHeader
        title="Notifications"
        subtitle="Stay up to date with assignment, feedback, and announcement activity."
        action={
          <button onClick={markAllRead} className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm hover:bg-muted transition">
            <CheckCheck size={14} /> Mark all read
          </button>
        }
      />
      {isLoading ? (
        <div className="grid place-items-center py-20"><Loader2 className="animate-spin" /></div>
      ) : !data?.length ? (
        <div className="rounded-2xl border-2 border-dashed border-border p-8 sm:p-14 text-center">
          <Bell className="mx-auto text-muted-foreground" size={32} />
          <p className="mt-4 font-semibold">You're all caught up</p>
        </div>
      ) : (
        <div className="space-y-2">
          {data.map((n) => (
            <div key={n.id} className={`rounded-xl border p-4 sm:p-5 flex gap-3 sm:gap-4 ${n.is_read ? "bg-card border-border" : "bg-gold/5 border-gold/30"}`}>
              <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-full bg-navy/5 text-navy grid place-items-center shrink-0">
                <Bell size={16} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
                  <p className="font-semibold text-foreground break-words min-w-0 flex-1">{n.title}</p>
                  <span className="text-[11px] sm:text-xs text-muted-foreground shrink-0">{formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}</span>
                </div>
                {n.message && <p className="text-sm text-muted-foreground mt-1 break-words">{n.message}</p>}
              </div>
            </div>

          ))}
        </div>
      )}
    </div>
  );
}
