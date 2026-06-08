import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
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

  return (
    <div className="p-6 lg:p-10 max-w-3xl mx-auto">
      <PageHeader title="My Profile" subtitle="Your member details are managed by CIC administrators." />
      <section className="rounded-2xl bg-card border border-border p-7 space-y-5">
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
          <F label="Full Name" v={form.full_name} />
          <F label="Student ID" v={form.student_id} />
          <F label="Department" v={form.department} />
          <F label="Semester" v={form.semester} />
          <F label="Mobile" v={form.mobile} />
        </div>
      </section>
    </div>
  );
}

function F({ label, v }: { label: string; v: string }) {
  return (
    <div>
      <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</label>
      <input value={v || "—"} readOnly className="mt-1.5 w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm text-muted-foreground outline-none" />
    </div>
  );
}
