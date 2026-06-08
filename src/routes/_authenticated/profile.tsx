import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useProfile } from "@/hooks/use-profile";
import { PageHeader } from "@/components/page-header";

export const Route = createFileRoute("/_authenticated/profile")({
  component: ProfilePage,
});

function ProfilePage() {
  const { user } = useAuth();
  const { data: profile } = useProfile(user?.id);
  const [form, setForm] = useState({ full_name: "", student_id: "", department: "", semester: "", mobile: "" });

  useEffect(() => {
    if (profile) setForm({
      full_name: profile.full_name ?? "",
      student_id: profile.student_id ?? "",
      department: profile.department ?? "Civil Engineering",
      semester: profile.semester ?? "",
      mobile: profile.mobile ?? "",
    });
  }, [profile]);

  const m = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("profiles").update(form).eq("id", user!.id);
      if (error) throw error;
    },
    onSuccess: () => toast.success("Profile updated"),
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="p-6 lg:p-10 max-w-3xl mx-auto">
      <PageHeader title="My Profile" subtitle="Keep your member details up to date." />
      <form
        onSubmit={(e) => { e.preventDefault(); m.mutate(); }}
        className="rounded-2xl bg-card border border-border p-7 space-y-5"
      >
        <div className="flex items-center gap-5 pb-5 border-b border-border">
          <div className="h-20 w-20 rounded-full bg-gradient-to-br from-[oklch(0.86_0.12_90)] to-[oklch(0.7_0.15_75)] grid place-items-center text-navy-deep font-display text-2xl font-bold">
            {(form.full_name || user?.email || "?")[0].toUpperCase()}
          </div>
          <div>
            <p className="font-semibold text-foreground">{form.full_name || "—"}</p>
            <p className="text-sm text-muted-foreground">{user?.email}</p>
          </div>
        </div>
        <div className="grid sm:grid-cols-2 gap-5">
          <F label="Full Name" v={form.full_name} on={(v) => setForm({ ...form, full_name: v })} />
          <F label="Student ID" v={form.student_id} on={(v) => setForm({ ...form, student_id: v })} />
          <F label="Department" v={form.department} on={(v) => setForm({ ...form, department: v })} />
          <F label="Semester" v={form.semester} on={(v) => setForm({ ...form, semester: v })} />
          <F label="Mobile" v={form.mobile} on={(v) => setForm({ ...form, mobile: v })} />
        </div>
        <button disabled={m.isPending} className="inline-flex items-center gap-2 rounded-full bg-navy text-white px-6 py-2.5 text-sm font-semibold hover:bg-navy-deep disabled:opacity-50">
          {m.isPending ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
          Save changes
        </button>
      </form>
    </div>
  );
}

function F({ label, v, on }: { label: string; v: string; on: (v: string) => void }) {
  return (
    <div>
      <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</label>
      <input value={v} onChange={(e) => on(e.target.value)} className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-gold focus:ring-2 focus:ring-gold/30" />
    </div>
  );
}
