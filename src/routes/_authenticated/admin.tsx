import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Plus, Trash2, Pencil, Check, X, Users, Shield, FileText, Megaphone, CalendarDays, UserCog, Bell } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useIsAdmin } from "@/hooks/use-profile";
import { PageHeader } from "@/components/page-header";
import { deleteUserAccount, getAdminStats } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminPage,
});

function AdminPage() {
  const { user, loading } = useAuth();
  const { data: isAdmin, isLoading: roleLoading } = useIsAdmin(user?.id);

  if (loading || roleLoading) return <div className="grid place-items-center min-h-[60vh]"><Loader2 className="animate-spin" /></div>;
  if (!isAdmin) {
    return (
      <div className="p-10 max-w-xl mx-auto">
        <div className="rounded-2xl bg-card border border-border p-8 text-center">
          <p className="font-display text-2xl font-semibold">Admin only</p>
          <p className="text-sm text-muted-foreground mt-2">You don't have administrator access. Ask an existing admin to promote your account from the Admin Panel → Users.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-10 max-w-7xl mx-auto">
      <PageHeader title="Admin Panel" subtitle="Manage members, content, and submissions." />
      <Tabs defaultValue="stats">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="stats">Statistics</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="coordinators">Faculty & Coordinators</TabsTrigger>
          <TabsTrigger value="announcements">Notices</TabsTrigger>
          <TabsTrigger value="events">Events</TabsTrigger>
          <TabsTrigger value="assignments">Assignments</TabsTrigger>
        </TabsList>
        <TabsContent value="stats" className="mt-6"><StatsAdmin /></TabsContent>
        <TabsContent value="users" className="mt-6"><UsersAdmin /></TabsContent>
        <TabsContent value="coordinators" className="mt-6"><CoordinatorsAdmin /></TabsContent>
        <TabsContent value="announcements" className="mt-6"><AnnouncementsAdmin /></TabsContent>
        <TabsContent value="events" className="mt-6"><EventsAdmin /></TabsContent>
        <TabsContent value="assignments" className="mt-6"><AssignmentsAdmin /></TabsContent>
      </Tabs>
    </div>
  );
}

/* -------- Stats -------- */
function StatsAdmin() {
  const fetchStats = useServerFn(getAdminStats);
  const { data, isLoading } = useQuery({ queryKey: ["admin-stats"], queryFn: () => fetchStats({}) });
  if (isLoading) return <div className="grid place-items-center py-12"><Loader2 className="animate-spin" /></div>;
  const cards = [
    { label: "Members", value: data?.users ?? 0, icon: Users },
    { label: "Admins", value: data?.admins ?? 0, icon: Shield },
    { label: "Assignments", value: data?.assignments ?? 0, icon: FileText },
    { label: "Events", value: data?.events ?? 0, icon: CalendarDays },
    { label: "Notices", value: data?.announcements ?? 0, icon: Megaphone },
    { label: "Team Members", value: data?.coordinators ?? 0, icon: UserCog },
    { label: "Notifications Sent", value: data?.notifications ?? 0, icon: Bell },
  ];
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {cards.map((c) => (
        <div key={c.label} className="rounded-2xl bg-card border border-border p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{c.label}</span>
            <c.icon size={16} className="text-muted-foreground" />
          </div>
          <p className="mt-3 font-display text-3xl font-bold">{c.value}</p>
        </div>
      ))}
    </div>
  );
}

/* -------- Assignments review -------- */
function AssignmentsAdmin() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["admin-assignments"],
    queryFn: async () => {
      const { data } = await supabase.from("assignments").select("*, profiles:submitted_by(full_name, student_id)").order("created_at", { ascending: false });
      return data ?? [];
    },
  });
  async function update(id: string, patch: any) {
    const { error } = await supabase.from("assignments").update(patch).eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Updated"); qc.invalidateQueries({ queryKey: ["admin-assignments"] }); }
  }
  return (
    <div className="space-y-3">
      {data?.map((a: any) => (
        <div key={a.id} className="rounded-xl bg-card border border-border p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-semibold">{a.title}</p>
              <p className="text-xs text-muted-foreground">{a.subject} · {a.profiles?.full_name ?? "Unknown"} ({a.profiles?.student_id ?? "—"})</p>
            </div>
            <select value={a.status} onChange={(e) => update(a.id, { status: e.target.value, reviewed_at: new Date().toISOString() })} className="text-xs rounded-md border border-border bg-background px-2 py-1.5">
              <option value="submitted">submitted</option>
              <option value="under_review">under_review</option>
              <option value="approved">approved</option>
              <option value="rejected">rejected</option>
              <option value="resubmission_required">resubmission_required</option>
            </select>
          </div>
          <div className="mt-4 grid sm:grid-cols-[1fr_auto] gap-3">
            <textarea defaultValue={a.feedback ?? ""} rows={2} placeholder="Feedback..." onBlur={(e) => e.target.value !== (a.feedback ?? "") && update(a.id, { feedback: e.target.value })}
              className="rounded-md border border-border bg-background px-3 py-2 text-sm" />
            <input defaultValue={a.grade ?? ""} placeholder="Grade" onBlur={(e) => e.target.value !== (a.grade ?? "") && update(a.id, { grade: e.target.value })}
              className="rounded-md border border-border bg-background px-3 py-2 text-sm w-24" />
          </div>
        </div>
      ))}
    </div>
  );
}

/* -------- Events -------- */
function EventsAdmin() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { data } = useQuery({ queryKey: ["admin-events"], queryFn: async () => (await supabase.from("events").select("*").order("created_at", { ascending: false })).data ?? [] });
  const [f, setF] = useState({ title: "", description: "", event_date: "", tag: "event" });
  async function add(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.from("events").insert({ ...f, created_by: user!.id, event_date: f.event_date || null });
    if (error) toast.error(error.message);
    else { toast.success("Added"); setF({ title: "", description: "", event_date: "", tag: "event" }); qc.invalidateQueries({ queryKey: ["admin-events"] }); }
  }
  return (
    <>
      <form onSubmit={add} className="rounded-xl bg-card border border-border p-5 mb-5 grid sm:grid-cols-4 gap-3">
        <input required placeholder="Title" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} className="rounded-md border border-border bg-background px-3 py-2 text-sm sm:col-span-2" />
        <input type="date" value={f.event_date} onChange={(e) => setF({ ...f, event_date: e.target.value })} className="rounded-md border border-border bg-background px-3 py-2 text-sm" />
        <input placeholder="Tag" value={f.tag} onChange={(e) => setF({ ...f, tag: e.target.value })} className="rounded-md border border-border bg-background px-3 py-2 text-sm" />
        <textarea placeholder="Description" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} className="sm:col-span-4 rounded-md border border-border bg-background px-3 py-2 text-sm" rows={2} />
        <button className="sm:col-span-4 inline-flex items-center justify-center gap-2 rounded-md bg-navy text-white py-2 text-sm font-semibold"><Plus size={14} /> Add event</button>
      </form>
      <List items={data} table="events" qkey={["admin-events"]} render={(e) => (<><p className="font-semibold">{e.title}</p><p className="text-xs text-muted-foreground">{e.tag} · {e.event_date ?? "—"}</p></>)} />
    </>
  );
}

/* -------- Announcements -------- */
function AnnouncementsAdmin() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { data } = useQuery({ queryKey: ["admin-announcements"], queryFn: async () => (await supabase.from("announcements").select("*").order("created_at", { ascending: false })).data ?? [] });
  const [f, setF] = useState({ title: "", description: "", is_broadcast: false });
  const broadcast = useMutation({
    mutationFn: async () => {
      const { data: ann, error } = await supabase.from("announcements").insert({ ...f, created_by: user!.id }).select().single();
      if (error) throw error;
      if (f.is_broadcast) {
        const { data: users } = await supabase.from("profiles").select("id");
        if (users?.length) {
          await supabase.from("notifications").insert(users.map((u) => ({ user_id: u.id, title: ann.title, message: ann.description })));
        }
      }
    },
    onSuccess: () => { toast.success("Posted"); setF({ title: "", description: "", is_broadcast: false }); qc.invalidateQueries({ queryKey: ["admin-announcements"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <>
      <form onSubmit={(e) => { e.preventDefault(); broadcast.mutate(); }} className="rounded-xl bg-card border border-border p-5 mb-5 space-y-3">
        <input required placeholder="Title" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" />
        <textarea placeholder="Description" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} rows={3} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" />
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.is_broadcast} onChange={(e) => setF({ ...f, is_broadcast: e.target.checked })} /> Send as notification to all members</label>
        <button disabled={broadcast.isPending} className="inline-flex items-center gap-2 rounded-md bg-navy text-white px-4 py-2 text-sm font-semibold">{broadcast.isPending ? <Loader2 className="animate-spin" size={14} /> : <Plus size={14} />} Post</button>
      </form>
      <List items={data} table="announcements" qkey={["admin-announcements"]} render={(a) => (<><p className="font-semibold">{a.title}</p>{a.description && <p className="text-sm text-muted-foreground line-clamp-2">{a.description}</p>}</>)} />
    </>
  );
}

/* -------- Coordinators -------- */
function CoordinatorsAdmin() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["admin-coordinators"], queryFn: async () => (await supabase.from("coordinators").select("*").order("sort_order")).data ?? [] });
  const [f, setF] = useState({ type: "faculty" as "faculty" | "student", name: "", designation: "", photo_url: "" });
  async function add(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.from("coordinators").insert(f);
    if (error) toast.error(error.message);
    else { toast.success("Added"); setF({ type: "faculty", name: "", designation: "", photo_url: "" }); qc.invalidateQueries({ queryKey: ["admin-coordinators"] }); }
  }
  return (
    <>
      <form onSubmit={add} className="rounded-xl bg-card border border-border p-5 mb-5 grid sm:grid-cols-4 gap-3">
        <select value={f.type} onChange={(e) => setF({ ...f, type: e.target.value as any })} className="rounded-md border border-border bg-background px-3 py-2 text-sm">
          <option value="faculty">Faculty</option><option value="student">Student</option>
        </select>
        <input required placeholder="Name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} className="rounded-md border border-border bg-background px-3 py-2 text-sm" />
        <input required placeholder="Designation" value={f.designation} onChange={(e) => setF({ ...f, designation: e.target.value })} className="rounded-md border border-border bg-background px-3 py-2 text-sm" />
        <input placeholder="Photo URL (optional)" value={f.photo_url} onChange={(e) => setF({ ...f, photo_url: e.target.value })} className="rounded-md border border-border bg-background px-3 py-2 text-sm" />
        <button className="sm:col-span-4 inline-flex items-center justify-center gap-2 rounded-md bg-navy text-white py-2 text-sm font-semibold"><Plus size={14} /> Add</button>
      </form>
      <List items={data} table="coordinators" qkey={["admin-coordinators"]} render={(c) => (<div className="flex items-center gap-3"><span className="text-[10px] uppercase tracking-wider rounded-full bg-gold/20 text-[oklch(0.55_0.13_75)] px-2 py-0.5">{c.type}</span><div><p className="font-semibold">{c.name}</p><p className="text-xs text-muted-foreground">{c.designation}</p></div></div>)} />
    </>
  );
}

/* -------- Users -------- */
function UsersAdmin() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const { data: profiles } = await supabase.from("profiles").select("*").order("created_at", { ascending: false });
      const { data: roles } = await supabase.from("user_roles").select("user_id,role");
      return (profiles ?? []).map((p: any) => ({ ...p, is_admin: roles?.some((r: any) => r.user_id === p.id && r.role === "admin") }));
    },
  });
  async function toggleAdmin(userId: string, makeAdmin: boolean) {
    if (makeAdmin) {
      const { error } = await supabase.from("user_roles").insert({ user_id: userId, role: "admin" });
      if (error) return toast.error(error.message);
    } else {
      const { error } = await supabase.from("user_roles").delete().eq("user_id", userId).eq("role", "admin");
      if (error) return toast.error(error.message);
    }
    toast.success("Updated"); qc.invalidateQueries({ queryKey: ["admin-users"] });
  }
  return (
    <div className="rounded-xl bg-card border border-border overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground"><tr><th className="text-left p-3">Name</th><th className="text-left p-3">Student ID</th><th className="text-left p-3">Email</th><th className="text-right p-3">Role</th></tr></thead>
        <tbody>
          {data?.map((u: any) => (
            <tr key={u.id} className="border-t border-border">
              <td className="p-3 font-medium">{u.full_name || "—"}</td>
              <td className="p-3 text-muted-foreground">{u.student_id || "—"}</td>
              <td className="p-3 text-muted-foreground">{u.email || "—"}</td>
              <td className="p-3 text-right">
                <button onClick={() => toggleAdmin(u.id, !u.is_admin)} className={`px-3 py-1 rounded-full text-xs font-semibold ${u.is_admin ? "bg-gold text-navy-deep" : "bg-muted text-muted-foreground hover:bg-navy hover:text-white transition"}`}>{u.is_admin ? "Admin" : "Make admin"}</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* -------- generic list helper -------- */
function List({ items, table, qkey, render }: { items: any[] | undefined; table: string; qkey: any[]; render: (it: any) => React.ReactNode }) {
  const qc = useQueryClient();
  async function del(id: string) {
    if (!confirm("Delete?")) return;
    const { error } = await supabase.from(table as any).delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Deleted"); qc.invalidateQueries({ queryKey: qkey }); }
  }
  return (
    <div className="space-y-2">
      {items?.map((it: any) => (
        <div key={it.id} className="rounded-xl bg-card border border-border p-4 flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">{render(it)}</div>
          <button onClick={() => del(it.id)} className="p-2 rounded-md text-muted-foreground hover:text-rose-600 hover:bg-rose-50 transition"><Trash2 size={15} /></button>
        </div>
      ))}
    </div>
  );
}
