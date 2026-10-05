import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Trash2, Pencil, X, Check, FileText } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { formatBytes } from "@/lib/upload";

const input = "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gold/50";
const btn = "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition disabled:opacity-60";

/* ---------------- Achievements ---------------- */
type Ach = { id: string; title: string; description: string | null; student_name: string | null; achieved_on: string | null; sort_order: number };
const emptyAch = { title: "", description: "", student_name: "", achieved_on: "", sort_order: 0 };

export function AchievementsAdmin() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["admin-achievements"],
    queryFn: async () => {
      const { data, error } = await supabase.from("achievements" as any).select("*").order("sort_order").order("created_at", { ascending: false });
      if (error) throw error;
      return (data as any as Ach[]) ?? [];
    },
  });
  const [form, setForm] = useState<typeof emptyAch>(emptyAch);
  const [editId, setEditId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) return toast.error("Title is required");
    setBusy(true);
    const payload = {
      title: form.title.trim(),
      description: form.description.trim() || null,
      student_name: form.student_name.trim() || null,
      achieved_on: form.achieved_on || null,
      sort_order: Number(form.sort_order) || 0,
    };
    const { data: u } = await supabase.auth.getUser();
    const res = editId
      ? await supabase.from("achievements" as any).update(payload).eq("id", editId)
      : await supabase.from("achievements" as any).insert({ ...payload, created_by: u.user?.id });
    setBusy(false);
    if (res.error) return toast.error(res.error.message);
    toast.success(editId ? "Achievement updated" : "Achievement added");
    setForm(emptyAch); setEditId(null);
    qc.invalidateQueries({ queryKey: ["admin-achievements"] });
  }

  async function remove(id: string) {
    if (!confirm("Delete this achievement?")) return;
    const { error } = await supabase.from("achievements" as any).delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    qc.invalidateQueries({ queryKey: ["admin-achievements"] });
  }

  return (
    <div className="space-y-6">
      <form onSubmit={save} className="rounded-2xl border border-border bg-card p-5 space-y-3">
        <h3 className="font-semibold">{editId ? "Edit achievement" : "Add achievement"}</h3>
        <input className={input} placeholder="Title (e.g. 1st Prize, National Bridge Design Contest)" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        <div className="grid gap-3 sm:grid-cols-3">
          <input className={input} placeholder="Student name(s)" value={form.student_name} onChange={(e) => setForm({ ...form, student_name: e.target.value })} />
          <input className={input} type="date" value={form.achieved_on} onChange={(e) => setForm({ ...form, achieved_on: e.target.value })} />
          <input className={input} type="number" placeholder="Display order" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) })} />
        </div>
        <textarea className={input} rows={3} placeholder="Details" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        <div className="flex flex-wrap gap-2">
          <button disabled={busy} className={`${btn} bg-gold text-navy-deep`}>
            {busy ? <Loader2 size={16} className="animate-spin" /> : editId ? <Check size={16} /> : <Plus size={16} />}
            {editId ? "Save changes" : "Add achievement"}
          </button>
          {editId && (
            <button type="button" onClick={() => { setEditId(null); setForm(emptyAch); }} className={`${btn} border border-border`}>
              <X size={16} /> Cancel
            </button>
          )}
        </div>
      </form>

      {isLoading ? <Loader2 className="animate-spin" /> : (
        <div className="space-y-3">
          {data?.length === 0 && <p className="text-sm text-muted-foreground">No achievements yet.</p>}
          {data?.map((a) => (
            <div key={a.id} className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <p className="font-semibold break-words">{a.title}</p>
                <p className="text-xs text-muted-foreground">{[a.student_name, a.achieved_on].filter(Boolean).join(" · ")}</p>
                {a.description && <p className="mt-1 text-sm text-muted-foreground whitespace-pre-line break-words">{a.description}</p>}
              </div>
              <div className="flex gap-2 shrink-0">
                <button onClick={() => { setEditId(a.id); setForm({ title: a.title, description: a.description ?? "", student_name: a.student_name ?? "", achieved_on: a.achieved_on ?? "", sort_order: a.sort_order }); window.scrollTo({ top: 0, behavior: "smooth" }); }} className={`${btn} border border-border`}><Pencil size={14} /> Edit</button>
                <button onClick={() => remove(a.id)} className={`${btn} border border-destructive/40 text-destructive`}><Trash2 size={14} /> Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------------- Public notices ---------------- */
type Notice = { id: string; title: string; body: string | null; category: string; file_path: string | null; file_name: string | null; file_size: number | null; notice_date: string };
const CATEGORIES = ["general", "meetup", "event", "workshop", "exam", "other"];
const emptyNotice = { title: "", body: "", category: "general", notice_date: new Date().toISOString().slice(0, 10) };

export function PublicNoticesAdmin() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["admin-public-notices"],
    queryFn: async () => {
      const { data, error } = await supabase.from("notices" as any).select("*").order("notice_date", { ascending: false }).order("created_at", { ascending: false });
      if (error) throw error;
      return (data as any as Notice[]) ?? [];
    },
  });
  const [form, setForm] = useState(emptyNotice);
  const [file, setFile] = useState<File | null>(null);
  const [editing, setEditing] = useState<Notice | null>(null);
  const [removeFile, setRemoveFile] = useState(false);
  const [busy, setBusy] = useState(false);

  function reset() { setForm(emptyNotice); setFile(null); setEditing(null); setRemoveFile(false); }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) return toast.error("Title is required");
    if (!form.body.trim() && !file && !(editing?.file_path && !removeFile)) return toast.error("Add a text message or attach a PDF");
    if (file && file.type !== "application/pdf") return toast.error("Only PDF files are allowed");
    if (file && file.size > 5 * 1024 * 1024) return toast.error("PDF must be 5 MB or smaller");
    setBusy(true);
    try {
      let fileFields: Record<string, any> = {};
      if (file) {
        const { path } = await uploadToB2(file, "notices");
        fileFields = { file_path: path, file_name: file.name, file_size: file.size };
      } else if (removeFile) {
        fileFields = { file_path: null, file_name: null, file_size: null };
      }
      const payload = { title: form.title.trim(), body: form.body.trim() || null, category: form.category, notice_date: form.notice_date, ...fileFields };
      const { data: u } = await supabase.auth.getUser();
      const res = editing
        ? await supabase.from("notices" as any).update(payload).eq("id", editing.id)
        : await supabase.from("notices" as any).insert({ ...payload, created_by: u.user?.id });
      if (res.error) throw res.error;
      if (editing?.file_path && (file || removeFile)) await removeNoticeFile(editing.file_path);
      toast.success(editing ? "Notice updated" : "Notice published");
      reset();
      qc.invalidateQueries({ queryKey: ["admin-public-notices"] });
    } catch (err: any) {
      toast.error(err?.message ?? "Could not save notice");
    } finally {
      setBusy(false);
    }
  }

  async function remove(n: Notice) {
    if (!confirm("Delete this notice?")) return;
    const { error } = await supabase.from("notices" as any).delete().eq("id", n.id);
    if (error) return toast.error(error.message);
    if (n.file_path) await removeNoticeFile(n.file_path);
    toast.success("Deleted");
    qc.invalidateQueries({ queryKey: ["admin-public-notices"] });
  }

  return (
    <div className="space-y-6">
      <form onSubmit={save} className="rounded-2xl border border-border bg-card p-5 space-y-3">
        <h3 className="font-semibold">{editing ? "Edit notice" : "Publish notice on home page"}</h3>
        <input className={input} placeholder="Notice title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        <div className="grid gap-3 sm:grid-cols-2">
          <select className={input} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c[0].toUpperCase() + c.slice(1)}</option>)}
          </select>
          <input className={input} type="date" value={form.notice_date} onChange={(e) => setForm({ ...form, notice_date: e.target.value })} />
        </div>
        <textarea className={input} rows={4} placeholder="Notice text (optional if a PDF is attached)" value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} />
        <div>
          <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">PDF attachment (optional, max 5 MB)</label>
          <input className={`${input} mt-1`} type="file" accept="application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          {editing?.file_path && !file && (
            <label className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
              <input type="checkbox" checked={removeFile} onChange={(e) => setRemoveFile(e.target.checked)} />
              Remove current PDF ({editing.file_name})
            </label>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <button disabled={busy} className={`${btn} bg-gold text-navy-deep`}>
            {busy ? <Loader2 size={16} className="animate-spin" /> : editing ? <Check size={16} /> : <Plus size={16} />}
            {editing ? "Save changes" : "Publish notice"}
          </button>
          {editing && <button type="button" onClick={reset} className={`${btn} border border-border`}><X size={16} /> Cancel</button>}
        </div>
      </form>

      {isLoading ? <Loader2 className="animate-spin" /> : (
        <div className="space-y-3">
          {data?.length === 0 && <p className="text-sm text-muted-foreground">No notices yet.</p>}
          {data?.map((n) => (
            <div key={n.id} className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <p className="text-xs uppercase tracking-wide text-gold font-semibold">{n.category} · {n.notice_date}</p>
                <p className="font-semibold break-words">{n.title}</p>
                {n.body && <p className="mt-1 text-sm text-muted-foreground whitespace-pre-line break-words line-clamp-3">{n.body}</p>}
                {n.file_path && <p className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground break-all"><FileText size={12} /> {n.file_name} · {formatBytes(n.file_size)}</p>}
              </div>
              <div className="flex gap-2 shrink-0">
                <button onClick={() => { setEditing(n); setFile(null); setRemoveFile(false); setForm({ title: n.title, body: n.body ?? "", category: n.category, notice_date: n.notice_date }); window.scrollTo({ top: 0, behavior: "smooth" }); }} className={`${btn} border border-border`}><Pencil size={14} /> Edit</button>
                <button onClick={() => remove(n)} className={`${btn} border border-destructive/40 text-destructive`}><Trash2 size={14} /> Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

async function removeNoticeFile(path: string) {
  try {
    if (isB2Path(path)) await removeStoredFile(path);
    else await supabase.storage.from("notices").remove([path]);
  } catch { /* file cleanup is best-effort */ }
}
