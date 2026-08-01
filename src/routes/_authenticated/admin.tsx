import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Plus, Trash2, Pencil, Check, X, Users, Shield, FileText, Megaphone, UserCog, Bell, Download, Upload, ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useIsAdmin } from "@/hooks/use-profile";
import { PageHeader } from "@/components/page-header";
import { deleteUserAccount, getAdminStats, listAdminUsers, setUserAdminRole, setMemberStatus, getAdminFileUrl } from "@/lib/admin.functions";
import { uploadToBucket } from "@/lib/upload";

function AdminDownloadButton({ path, name }: { path: string; name?: string | null }) {
  const getUrl = useServerFn(getAdminFileUrl);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  async function go() {
    if (loading) return;
    setLoading(true);
    setProgress(0);
    try {
      const { url } = await getUrl({ data: { path } });
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Download failed (${res.status})`);
      const total = Number(res.headers.get("content-length") ?? 0);
      const reader = res.body?.getReader();
      const chunks: Uint8Array[] = [];
      let received = 0;
      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value) {
            chunks.push(value);
            received += value.length;
            if (total) setProgress(Math.round((received / total) * 100));
          }
        }
      }
      const blob = new Blob(chunks as BlobPart[]);
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = name || path.split("/").pop() || "download";
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
      toast.success("Download started");
    } catch (e) {
      console.error("[admin:download]", e);
      toast.error(e instanceof Error ? e.message : "Download failed");
    } finally {
      setLoading(false);
      setProgress(0);
    }
  }
  return (
    <button onClick={go} disabled={loading} className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1.5 text-xs hover:bg-muted transition disabled:opacity-60">
      {loading ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
      {loading ? (progress ? `${progress}%` : "Downloading…") : "Download"}
    </button>
  );
}

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
    <div className="p-4 sm:p-6 lg:p-10 max-w-7xl mx-auto">
      <PageHeader title="Admin Panel" subtitle="Manage members, content, and submissions." />
      <Tabs defaultValue="stats">
        <div className="-mx-4 px-4 sm:mx-0 sm:px-0 overflow-x-auto">
          <TabsList className="h-auto w-max flex-nowrap sm:w-full sm:flex-wrap">
            <TabsTrigger value="stats" className="whitespace-nowrap">Statistics</TabsTrigger>
            <TabsTrigger value="pending" className="whitespace-nowrap">Pending Approvals</TabsTrigger>
            <TabsTrigger value="members" className="whitespace-nowrap">Members</TabsTrigger>
            <TabsTrigger value="coordinators" className="whitespace-nowrap">Faculty &amp; Coordinators</TabsTrigger>
            <TabsTrigger value="announcements" className="whitespace-nowrap">Notices</TabsTrigger>
            <TabsTrigger value="assignments" className="whitespace-nowrap">Assignments</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="stats" className="mt-6"><StatsAdmin /></TabsContent>
        <TabsContent value="pending" className="mt-6"><PendingApprovalsAdmin /></TabsContent>
        <TabsContent value="members" className="mt-6"><UsersAdmin /></TabsContent>
        <TabsContent value="coordinators" className="mt-6"><CoordinatorsAdmin /></TabsContent>
        <TabsContent value="announcements" className="mt-6"><AnnouncementsAdmin /></TabsContent>
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
      const { data: assignments, error } = await supabase
        .from("assignments")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      const ids = Array.from(new Set((assignments ?? []).map((a) => a.submitted_by).filter(Boolean)));
      let profiles: any[] = [];
      if (ids.length) {
        const { data: ps } = await supabase.from("profiles").select("id, full_name, student_id").in("id", ids);
        profiles = ps ?? [];
      }
      return (assignments ?? []).map((a) => ({ ...a, profiles: profiles.find((p) => p.id === a.submitted_by) }));
    },
  });
  async function update(id: string, patch: any) {
    const { error } = await supabase.from("assignments").update(patch).eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Updated"); qc.invalidateQueries({ queryKey: ["admin-assignments"] }); }
  }
  return (
    <div className="space-y-3">
      {!data?.length && <p className="text-sm text-muted-foreground text-center py-8">No assignments submitted yet.</p>}
      {data?.map((a: any) => (
        <div key={a.id} className="rounded-xl bg-card border border-border p-4 sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="font-semibold break-words leading-snug">{a.title}</p>
              <p className="text-xs text-muted-foreground break-words mt-0.5">{a.subject} · {a.profiles?.full_name ?? "Unknown"} ({a.profiles?.student_id ?? "—"})</p>
            </div>
            <select value={a.status} onChange={(e) => update(a.id, { status: e.target.value, reviewed_at: new Date().toISOString() })} className="w-full sm:w-auto text-xs rounded-md border border-border bg-background px-2 py-1.5">
              <option value="submitted">submitted</option>
              <option value="under_review">under_review</option>
              <option value="approved">approved</option>
              <option value="rejected">rejected</option>
              <option value="resubmission_required">resubmission_required</option>
            </select>
          </div>
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-[1fr_auto_auto] gap-3 items-start">
            <textarea defaultValue={a.feedback ?? ""} rows={2} placeholder="Feedback..." onBlur={(e) => e.target.value !== (a.feedback ?? "") && update(a.id, { feedback: e.target.value })}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" />
            <input defaultValue={a.grade ?? ""} placeholder="Grade" onBlur={(e) => e.target.value !== (a.grade ?? "") && update(a.id, { grade: e.target.value })}
              className="rounded-md border border-border bg-background px-3 py-2 text-sm w-full sm:w-24" />
            {a.file_url && <AdminDownloadButton path={a.file_url} name={a.file_name} />}
          </div>
        </div>
      ))}
    </div>
  );
}

/* -------- Announcements -------- */
type Audience = "public" | "all" | "selected";
function AnnouncementsAdmin() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { data } = useQuery({ queryKey: ["admin-announcements"], queryFn: async () => (await supabase.from("announcements").select("*").order("created_at", { ascending: false })).data ?? [] });
  const { data: members } = useQuery({
    queryKey: ["admin-member-list"],
    queryFn: async () => (await supabase.from("profiles").select("id, full_name, email, student_id").order("full_name")).data ?? [],
  });
  const [f, setF] = useState({ title: "", description: "" });
  const [audience, setAudience] = useState<Audience>("public");
  const [selected, setSelected] = useState<string[]>([]);
  const [search, setSearch] = useState("");

  const filteredMembers = (members ?? []).filter((m: any) => {
    const q = search.toLowerCase();
    return !q || (m.full_name ?? "").toLowerCase().includes(q) || (m.email ?? "").toLowerCase().includes(q) || (m.student_id ?? "").toLowerCase().includes(q);
  });

  const post = useMutation({
    mutationFn: async () => {
      if (audience === "selected" && selected.length === 0) {
        throw new Error("Pick at least one member to notify.");
      }
      // Public posts go on the announcements board so everyone sees them.
      if (audience === "public" || audience === "all") {
        const { data: ann, error } = await supabase.from("announcements")
          .insert({ title: f.title, description: f.description, is_broadcast: audience === "all", created_by: user!.id })
          .select().single();
        if (error) throw error;
        if (audience === "all" && members?.length) {
          const rows = members.map((u: any) => ({ user_id: u.id, title: ann.title, message: ann.description }));
          const { error: nerr } = await supabase.from("notifications").insert(rows);
          if (nerr) throw nerr;
        }
      } else {
        // Targeted: notification only, no public announcement.
        const rows = selected.map((id) => ({ user_id: id, title: f.title, message: f.description }));
        const { error } = await supabase.from("notifications").insert(rows);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(audience === "selected" ? `Notice sent to ${selected.length} member(s)` : "Posted");
      setF({ title: "", description: "" });
      setSelected([]); setSearch(""); setAudience("public");
      qc.invalidateQueries({ queryKey: ["admin-announcements"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function toggle(id: string) {
    setSelected((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  }

  return (
    <>
      <form onSubmit={(e) => { e.preventDefault(); post.mutate(); }} className="rounded-xl bg-card border border-border p-5 mb-5 space-y-3">
        <input required placeholder="Title" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" />
        <textarea required placeholder="Description" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} rows={3} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" />

        <fieldset className="space-y-2">
          <legend className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Audience</legend>
          <div className="flex flex-wrap gap-3 text-sm">
            <label className="inline-flex items-center gap-2"><input type="radio" name="aud" checked={audience === "public"} onChange={() => setAudience("public")} /> Public notice board only</label>
            <label className="inline-flex items-center gap-2"><input type="radio" name="aud" checked={audience === "all"} onChange={() => setAudience("all")} /> Notify all members</label>
            <label className="inline-flex items-center gap-2"><input type="radio" name="aud" checked={audience === "selected"} onChange={() => setAudience("selected")} /> Notify selected members</label>
          </div>
        </fieldset>

        {audience === "selected" && (
          <div className="rounded-md border border-border bg-background p-3 space-y-2">
            <div className="flex items-center justify-between gap-3">
              <input
                placeholder="Search by name, email, or ID…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="flex-1 rounded-md border border-border bg-background px-2 py-1.5 text-xs"
              />
              <span className="text-xs text-muted-foreground whitespace-nowrap">{selected.length} selected</span>
            </div>
            <div className="max-h-60 overflow-y-auto divide-y divide-border">
              {filteredMembers.length === 0 && <p className="text-xs text-muted-foreground py-2">No members match.</p>}
              {filteredMembers.map((m: any) => (
                <label key={m.id} className="flex items-center gap-3 py-1.5 cursor-pointer hover:bg-muted/40 px-1 rounded">
                  <input type="checkbox" checked={selected.includes(m.id)} onChange={() => toggle(m.id)} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{m.full_name || m.email || "Unnamed"}</p>
                    <p className="text-xs text-muted-foreground truncate">{m.email}{m.student_id ? ` · ${m.student_id}` : ""}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>
        )}

        <button disabled={post.isPending} className="inline-flex items-center gap-2 rounded-md bg-navy text-white px-4 py-2 text-sm font-semibold disabled:opacity-60">
          {post.isPending ? <Loader2 className="animate-spin" size={14} /> : <Plus size={14} />}
          {audience === "selected" ? "Send notice" : "Post"}
        </button>
      </form>
      <List items={data} table="announcements" qkey={["admin-announcements"]} render={(a) => (<><p className="font-semibold">{a.title}</p>{a.description && <p className="text-sm text-muted-foreground line-clamp-2">{a.description}</p>}</>)} />
    </>
  );
}

/* -------- Photo upload helper -------- */
function PhotoUpload({ value, onChange }: { value: string; onChange: (url: string) => void }) {
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  async function pick(file: File | null) {
    if (!file || !user) return;
    if (!/^image\/(png|jpe?g)$/i.test(file.type)) {
      toast.error("Please choose a JPG or PNG image");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be 5 MB or smaller");
      return;
    }
    setBusy(true);
    try {
      const { url } = await uploadToBucket(user.id, file, "coordinators");
      onChange(url);
      toast.success("Photo uploaded");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="flex items-center gap-3">
      {value ? (
        <img src={value} alt="" className="h-12 w-12 rounded-full object-cover ring-2 ring-border" />
      ) : (
        <div className="h-12 w-12 rounded-full bg-muted grid place-items-center text-muted-foreground"><ImageIcon size={16} /></div>
      )}
      <label className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs cursor-pointer hover:bg-muted">
        {busy ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
        {busy ? "Uploading…" : value ? "Change photo" : "Upload JPG/PNG"}
        <input type="file" accept="image/png,image/jpeg" className="hidden" onChange={(e) => pick(e.target.files?.[0] ?? null)} />
      </label>
      {value && !busy && (
        <button type="button" onClick={() => onChange("")} className="text-xs text-muted-foreground hover:text-rose-600">Remove</button>
      )}
    </div>
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
      <form onSubmit={add} className="rounded-xl bg-card border border-border p-5 mb-5 grid sm:grid-cols-3 gap-3">
        <select value={f.type} onChange={(e) => setF({ ...f, type: e.target.value as any })} className="rounded-md border border-border bg-background px-3 py-2 text-sm">
          <option value="faculty">Faculty</option><option value="student">Student</option>
        </select>
        <input required placeholder="Name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} className="rounded-md border border-border bg-background px-3 py-2 text-sm" />
        <input required placeholder="Designation" value={f.designation} onChange={(e) => setF({ ...f, designation: e.target.value })} className="rounded-md border border-border bg-background px-3 py-2 text-sm" />
        <div className="sm:col-span-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Photo (JPG or PNG)</p>
          <PhotoUpload value={f.photo_url} onChange={(url) => setF({ ...f, photo_url: url })} />
        </div>
        <button className="sm:col-span-3 inline-flex items-center justify-center gap-2 rounded-md bg-navy text-white py-2 text-sm font-semibold"><Plus size={14} /> Add</button>
      </form>
      <div className="space-y-2">
        {data?.map((c: any) => (
          <CoordinatorRow key={c.id} c={c} />
        ))}
      </div>
    </>
  );
}

function CoordinatorRow({ c }: { c: any }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ name: c.name, designation: c.designation, type: c.type, photo_url: c.photo_url ?? "" });
  async function save() {
    const { error } = await supabase.from("coordinators").update(draft).eq("id", c.id);
    if (error) return toast.error(error.message);
    toast.success("Saved"); setEditing(false); qc.invalidateQueries({ queryKey: ["admin-coordinators"] });
  }
  async function del() {
    if (!confirm("Delete this member?")) return;
    const { error } = await supabase.from("coordinators").delete().eq("id", c.id);
    if (error) return toast.error(error.message);
    toast.success("Deleted"); qc.invalidateQueries({ queryKey: ["admin-coordinators"] });
  }
  if (editing) {
    return (
      <div className="rounded-xl bg-card border border-border p-4 grid sm:grid-cols-3 gap-2">
        <select value={draft.type} onChange={(e) => setDraft({ ...draft, type: e.target.value })} className="rounded-md border border-border bg-background px-3 py-2 text-sm">
          <option value="faculty">Faculty</option><option value="student">Student</option>
        </select>
        <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className="rounded-md border border-border bg-background px-3 py-2 text-sm" />
        <input value={draft.designation} onChange={(e) => setDraft({ ...draft, designation: e.target.value })} className="rounded-md border border-border bg-background px-3 py-2 text-sm" />
        <div className="sm:col-span-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Photo (JPG or PNG)</p>
          <PhotoUpload value={draft.photo_url} onChange={(url) => setDraft({ ...draft, photo_url: url })} />
        </div>
        <div className="sm:col-span-3 flex gap-2 justify-end">
          <button onClick={() => setEditing(false)} className="inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-xs border border-border"><X size={13} /> Cancel</button>
          <button onClick={save} className="inline-flex items-center gap-1 rounded-md bg-navy text-white px-3 py-1.5 text-xs font-semibold"><Check size={13} /> Save</button>
        </div>
      </div>
    );
  }
  return (
    <div className="rounded-xl bg-card border border-border p-4 flex items-center justify-between gap-3">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <span className="text-[10px] uppercase tracking-wider rounded-full bg-gold/20 text-[oklch(0.55_0.13_75)] px-2 py-0.5">{c.type}</span>
        <div className="min-w-0">
          <p className="font-semibold break-words leading-snug">{c.name}</p>
          <p className="text-xs text-muted-foreground break-words">{c.designation}</p>
        </div>
      </div>
      <div className="flex items-center gap-1">
        <button onClick={() => setEditing(true)} className="p-2 rounded-md text-muted-foreground hover:text-navy hover:bg-muted transition"><Pencil size={15} /></button>
        <button onClick={del} className="p-2 rounded-md text-muted-foreground hover:text-rose-600 hover:bg-rose-50 transition"><Trash2 size={15} /></button>
      </div>
    </div>
  );
}

/* -------- Users -------- */
function UsersAdmin() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const deleteFn = useServerFn(deleteUserAccount);
  const listUsersFn = useServerFn(listAdminUsers);
  const setRoleFn = useServerFn(setUserAdminRole);
  const { data } = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => listUsersFn({}),
  });
  async function setRole(userId: string, role: "admin" | "student") {
    try {
      await setRoleFn({ data: { userId, role } });
      toast.success("Role updated"); qc.invalidateQueries({ queryKey: ["admin-users"] }); qc.invalidateQueries({ queryKey: ["admin-stats"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update role");
    }
  }
  async function removeUser(userId: string, name: string) {
    if (!confirm(`Permanently delete ${name}? This cannot be undone.`)) return;
    try {
      await deleteFn({ data: { userId } });
      toast.success("User deleted");
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      qc.invalidateQueries({ queryKey: ["admin-stats"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to delete");
    }
  }
  return (
    <div className="rounded-xl bg-card border border-border overflow-x-auto">
      <table className="w-full text-sm min-w-[700px]">
        <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
          <tr>
            <th className="text-left p-3">Name</th>
            <th className="text-left p-3">Student ID</th>
            <th className="text-left p-3">Email</th>
            <th className="text-left p-3">Role</th>
            <th className="text-right p-3">Actions</th>
          </tr>
        </thead>
        <tbody>
          {data?.map((u: any) => (
            <tr key={u.id} className="border-t border-border">
              <td className="p-3 font-medium">{u.full_name || "—"}</td>
              <td className="p-3 text-muted-foreground">{u.student_id || "—"}</td>
              <td className="p-3 text-muted-foreground">{u.email || "—"}</td>
              <td className="p-3">
                <select
                  value={u.is_admin ? "admin" : "student"}
                  onChange={(e) => setRole(u.id, e.target.value as any)}
                  disabled={u.id === user?.id}
                  className="text-xs rounded-md border border-border bg-background px-2 py-1.5 disabled:opacity-50"
                >
                  <option value="student">Student</option>
                  <option value="admin">Admin</option>
                </select>
              </td>
              <td className="p-3 text-right">
                <button
                  onClick={() => removeUser(u.id, u.full_name || u.email || "this user")}
                  disabled={u.id === user?.id}
                  title={u.id === user?.id ? "You cannot delete yourself" : "Delete user"}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs text-rose-600 hover:bg-rose-50 transition disabled:opacity-40 disabled:hover:bg-transparent"
                >
                  <Trash2 size={13} /> Delete
                </button>
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

/* -------- Pending approvals -------- */
function PendingApprovalsAdmin() {
  const qc = useQueryClient();
  const listUsersFn = useServerFn(listAdminUsers);
  const setStatusFn = useServerFn(setMemberStatus);
  const { data, isLoading } = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => listUsersFn({}),
  });
  const pending = (data ?? []).filter((u: any) => (u.status ?? "active") === "pending");

  async function act(userId: string, status: "active" | "rejected" | "suspended", label: string) {
    try {
      await setStatusFn({ data: { userId, status } });
      toast.success(`${label} successfully`);
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      qc.invalidateQueries({ queryKey: ["admin-stats"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : `Failed to ${label.toLowerCase()}`);
    }
  }

  if (isLoading) return <div className="grid place-items-center py-12"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="rounded-xl bg-card border border-border overflow-x-auto">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <p className="text-sm font-semibold">Pending User Requests</p>
        <span className="text-xs text-muted-foreground">{pending.length} pending</span>
      </div>
      {pending.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-10">No pending requests right now.</p>
      ) : (
        <table className="w-full text-sm min-w-[800px]">
          <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="text-left p-3">Name</th>
              <th className="text-left p-3">Email</th>
              <th className="text-left p-3">Role</th>
              <th className="text-left p-3">Registered</th>
              <th className="text-right p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {pending.map((u: any) => (
              <tr key={u.id} className="border-t border-border">
                <td className="p-3 font-medium">{u.full_name || "—"}<div className="text-xs text-muted-foreground font-normal">{u.student_id || ""}</div></td>
                <td className="p-3 text-muted-foreground">{u.email || "—"}</td>
                <td className="p-3 capitalize">{u.role}</td>
                <td className="p-3 text-muted-foreground">{u.created_at ? new Date(u.created_at).toLocaleDateString() : "—"}</td>
                <td className="p-3">
                  <div className="flex items-center gap-2 justify-end">
                    <button onClick={() => act(u.id, "active", "Approved")} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs bg-emerald-600 text-white hover:bg-emerald-700"><Check size={13} /> Approve</button>
                    <button onClick={() => act(u.id, "rejected", "Rejected")} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs bg-rose-600 text-white hover:bg-rose-700"><X size={13} /> Reject</button>
                    <button onClick={() => act(u.id, "suspended", "Suspended")} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs border border-border hover:bg-muted">Suspend</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
