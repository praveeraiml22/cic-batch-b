import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { motion } from "motion/react";
import { FileText, CheckCircle2, Clock, MessageSquare, ArrowRight, Megaphone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useProfile } from "@/hooks/use-profile";
import { PageHeader } from "@/components/page-header";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: DashboardPage,
});

function DashboardPage() {
  const { user } = useAuth();
  const { data: profile } = useProfile(user?.id);

  const { data: stats } = useQuery({
    queryKey: ["dashboard-stats", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data: assignments } = await supabase
        .from("assignments")
        .select("id,status,grade")
        .eq("submitted_by", user!.id);
      const total = assignments?.length ?? 0;
      const submitted = assignments?.filter((a) => a.status === "submitted").length ?? 0;
      const approved = assignments?.filter((a) => a.status === "approved").length ?? 0;
      const pending = assignments?.filter((a) =>
        ["submitted", "under_review", "resubmission_required"].includes(a.status),
      ).length ?? 0;
      const feedback = assignments?.filter((a) => !!a.grade).length ?? 0;
      return { total, submitted, approved, pending, feedback };
    },
  });

  const { data: announcements } = useQuery({
    queryKey: ["recent-announcements"],
    queryFn: async () => {
      const { data } = await supabase
        .from("announcements")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(3);
      return data ?? [];
    },
  });

  const cards = [
    { label: "Total Assignments", value: stats?.total ?? 0, icon: FileText, color: "bg-navy/10 text-navy" },
    { label: "Submitted", value: stats?.submitted ?? 0, icon: CheckCircle2, color: "bg-emerald-500/10 text-emerald-600" },
    { label: "Pending Review", value: stats?.pending ?? 0, icon: Clock, color: "bg-amber-500/10 text-amber-600" },
    { label: "Feedback Received", value: stats?.feedback ?? 0, icon: MessageSquare, color: "bg-gold/15 text-[oklch(0.55_0.13_75)]" },
  ];

  return (
    <div className="p-4 sm:p-6 lg:p-10 max-w-7xl mx-auto">
      <PageHeader
        title={`Welcome, ${profile?.full_name?.split(" ")[0] || "Member"}`}
        subtitle="Here's a quick snapshot of your CIC activity."
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {cards.map((c, i) => (
          <motion.div
            key={c.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06 }}
            className="rounded-2xl bg-card border border-border p-4 sm:p-6"
          >
            <div className={`h-9 w-9 sm:h-10 sm:w-10 rounded-xl ${c.color} grid place-items-center mb-3 sm:mb-4`}>
              <c.icon size={18} />
            </div>
            <p className="font-display text-2xl sm:text-3xl font-bold text-foreground">{c.value}</p>
            <p className="text-[10px] sm:text-xs uppercase tracking-wider text-muted-foreground mt-1 leading-snug break-words">{c.label}</p>
          </motion.div>
        ))}
      </div>


      <div className="mt-10 grid lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 rounded-2xl bg-card border border-border p-7">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-display text-xl font-semibold">Quick actions</h2>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <ActionCard to="/assignments" title="Submit assignment" desc="Upload a new submission" />
            <ActionCard to="/documents" title="Browse documents" desc="Notes, reports, research" />
            <ActionCard to="/notifications" title="Notifications" desc="See latest updates" />
            <ActionCard to="/profile" title="View profile" desc="See your member details" />
          </div>
        </div>

        <div className="rounded-2xl bg-gradient-to-br from-navy to-navy-deep text-white p-7">
          <div className="flex items-center gap-2 text-gold mb-3">
            <Megaphone size={16} />
            <span className="text-xs uppercase tracking-[0.2em]">Announcements</span>
          </div>
          {announcements && announcements.length > 0 ? (
            <ul className="space-y-4">
              {announcements.map((a) => (
                <li key={a.id} className="border-b border-white/10 pb-3 last:border-0">
                  <p className="font-medium">{a.title}</p>
                  {a.description && (
                    <p className="text-sm text-white/60 mt-1 line-clamp-2">{a.description}</p>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-white/60">No announcements yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function ActionCard({ to, title, desc }: { to: string; title: string; desc: string }) {
  return (
    <Link
      to={to}
      className="group rounded-xl border border-border p-4 hover:border-gold/50 hover:bg-muted/40 transition"
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="font-semibold text-foreground">{title}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
        </div>
        <ArrowRight
          size={16}
          className="text-muted-foreground group-hover:text-gold group-hover:translate-x-0.5 transition"
        />
      </div>
    </Link>
  );
}
