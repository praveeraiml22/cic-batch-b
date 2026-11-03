import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState, useEffect } from "react";
import { Upload, FileText, Download, Loader2, Plus, Trash2, RefreshCcw, Lock, CalendarClock, FileUp, CheckCircle2, Clock, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { uploadToBucket, uploadToB2, getSignedUrl, formatBytes, removeStoredFile } from "@/lib/upload";
import { deleteStoredRecord } from "@/lib/files.functions";
import { submitTopicAssignment } from "@/lib/assignments.functions";
import { PageHeader } from "@/components/page-header";

export const Route = createFileRoute("/_authenticated/assignments")({
  component: AssignmentsPage,
});

const STATUS_COLORS: Record<string, string> = {
  submitted: "bg-blue-500/10 text-blue-700",
  under_review: "bg-amber-500/10 text-amber-700",
  approved: "bg-emerald-500/10 text-emerald-700",
  rejected: "bg-rose-500/10 text-rose-700",
  resubmission_required: "bg-orange-500/10 text-orange-700",
};

function AssignmentsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [openTopic, setOpenTopic] = useState<string | null>(null);

  // Live updates: a new, edited or deadline-extended assignment appears/refreshes instantly.
  useEffect(() => {
    const channel = supabase
      .channel(`assignment-topics-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "assignment_topics" }, () => {
        qc.invalidateQueries({ queryKey: ["assignment-topics"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [qc]);

  const topicsQ = useQuery({
    queryKey: ["assignment-topics"],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assignment_topics")
        .select("id, title, subject, description, deadline, is_published, created_at, attachments:assignment_attachments(id, file_path, file_name, file_size, sort_order)")
        .eq("is_published", true)
        .order("created_at", { ascending: false })
        .order("sort_order", { ascending: true, referencedTable: "assignment_attachments" });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: assignments, isLoading } = useQuery({
    queryKey: ["assignments", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assignments")
        .select("*, files:assignment_files(id, file_path, file_name, file_size, created_at)")
        .eq("submitted_by", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  // Status per published assignment: Submitted > Deadline Passed > Not Submitted.
  const myByTopic = new Map<string, any[]>();
  for (const a of assignments ?? []) {
    if (a.topic_id) {
      const list = myByTopic.get(a.topic_id) ?? [];
      list.push(a);
      myByTopic.set(a.topic_id, list);
    }
  }

  return (
    <div className="p-4 sm:p-6 lg:p-10 max-w-7xl mx-auto">
      <PageHeader
        title="My Assignments"
        subtitle="Submit, track, and review feedback on your work."
        action={
          <button
            onClick={() => setShowForm((s) => !s)}
            className="inline-flex items-center gap-2 rounded-full bg-navy text-white px-5 py-2.5 text-sm font-semibold hover:bg-navy-deep transition"
          >
            <Plus size={16} /> {showForm ? "Cancel" : "New Submission"}
          </button>
        }
      />

      {showForm && (
        <SubmitForm
          onDone={() => {
            setShowForm(false);
            qc.invalidateQueries({ queryKey: ["assignments"] });
            qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
          }}
        />
      )}

      {(topicsQ.data ?? []).length > 0 && (
        <section className="mb-10">
          <h2 className="font-display text-lg sm:text-xl font-semibold mb-4">Assignments for you</h2>
          <div className="space-y-3">
            {(topicsQ.data ?? []).map((t: any) => {
              const mine = myByTopic.get(t.id) ?? [];
              const passed = !!t.deadline && new Date(t.deadline).getTime() < Date.now();
              const status = mine.length ? "Submitted" : passed ? "Deadline Passed" : "Not Submitted";
              return (
                <TopicCard
                  key={t.id}
                  topic={t}
                  status={status}
                  mine={mine}
                  open={openTopic === t.id}
                  onToggle={() => setOpenTopic(openTopic === t.id ? null : t.id)}
                  onSubmitted={() => qc.invalidateQueries({ queryKey: ["assignments", user?.id] })}
                />
              );
            })}
          </div>
        </section>
      )}

      <section>
        <h2 className="font-display text-lg sm:text-xl font-semibold mb-4">My submissions</h2>
        {isLoading ? (
          <div className="grid place-items-center py-20"><Loader2 className="animate-spin" /></div>
        ) : !assignments?.length ? (
          <EmptyState />
        ) : (
          <div className="space-y-4">
            {assignments.map((a) => (
              <AssignmentRow key={a.id} a={a} onChanged={() => qc.invalidateQueries({ queryKey: ["assignments"] })} />
            ))}
          </div>
        )}
      </section>

      <PublicAssignments />
    </div>
  );
}

function statusBadge(status: string) {
  const map: Record<string, string> = {
    "Submitted": "bg-emerald-500/10 text-emerald-700",
    "Deadline Passed": "bg-rose-500/10 text-rose-700",
    "Not Submitted": "bg-amber-500/10 text-amber-700",
  };
  return <span className={`shrink-0 px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wider ${map[status] ?? "bg-muted"}`}>{status}</span>;
}

function TopicCard({ topic, status, mine, open, onToggle, onSubmitted }: { topic: any; status: string; mine: any[]; open: boolean; onToggle: () => void; onSubmitted: () => void }) {
  const submitFn = useServerFn(submitTopicAssignment);
  const { user } = useAuth();
  const [files, setFiles] = useState<File[]>([]);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [uploadMsg, setUploadMsg] = useState("");
  const passed = !!topic.deadline && new Date(topic.deadline).getTime() < Date.now();

  async function openPath(path: string, name?: string) {
    try { window.open(await getSignedUrl(path, name), "_blank"); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Could not open file."); }
  }

  async function submit() {
    if (!user || busy) return;
    if (!files.length) { toast.error("Please attach at least one file"); return; }
    if (passed) { toast.error("Submission deadline expired"); return; }
    setBusy(true);
    try {
      const uploaded: { path: string; name: string; size: number }[] = [];
      for (let i = 0; i < files.length; i++) {
        setUploadMsg(`Uploading file ${i + 1} of ${files.length}...`);
        const { path } = await uploadToB2(files[i], "assignments", undefined, { topicId: topic.id });
        uploaded.push({ path, name: files[i].name, size: files[i].size });
      }
      await submitFn({ data: { topicId: topic.id, note, files: uploaded } });
      toast.success("Assignment submitted successfully.");
      setFiles([]); setNote(""); setUploadMsg("");
      onSubmitted();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not submit the assignment.");
    } finally {
      setBusy(false);
      setUploadMsg("");
    }
  }

  return (
    <div className="rounded-2xl bg-card border border-border overflow-hidden">
      <button onClick={onToggle} className="w-full text-left p-4 sm:p-5 flex items-start gap-3 sm:gap-4 hover:border-gold/40 transition">
        <div className="h-10 w-10 sm:h-11 sm:w-11 rounded-xl bg-navy/5 text-navy grid place-items-center shrink-0">
          <FileText size={18} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
            <p className="font-semibold text-foreground text-base leading-snug break-words min-w-0 flex-1">{topic.title}</p>
            {statusBadge(status)}
          </div>
          <p className="text-sm text-muted-foreground mt-1 break-words">
            {topic.subject ? `${topic.subject} · ` : ""}
            {topic.deadline ? (
              <span className={passed ? "text-rose-600" : ""}>
                Deadline: {new Date(topic.deadline).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true })}
              </span>
            ) : "No deadline"}
            {topic.attachments?.length ? ` · ${topic.attachments.length} attachment${topic.attachments.length === 1 ? "" : "s"}` : ""}
          </p>
        </div>
      </button>

      {open && (
        <div className="px-4 sm:px-5 pb-5 space-y-4 border-t border-border pt-4">
          {topic.description && <p className="text-sm text-muted-foreground whitespace-pre-wrap break-words">{topic.description}</p>}
          {!!topic.attachments?.length && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Attached files</p>
              <div className="flex flex-wrap gap-2">
                {topic.attachments.map((att: any) => (
                  <button key={att.id} onClick={() => openPath(att.file_path, att.file_name)}
                    className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm hover:bg-muted max-w-full">
                    <Download size={14} className="shrink-0" /> <span className="truncate">{att.file_name}</span>
                    {att.file_size ? <span className="text-xs text-muted-foreground shrink-0">({formatBytes(att.file_size)})</span> : null}
                  </button>
                ))}
              </div>
            </div>
          )}

          {mine.length > 0 && (
            <div className="rounded-xl bg-muted/50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Your submission{mine.length > 1 ? "s" : ""}</p>
              {mine.map((m) => (
                <div key={m.id} className="flex flex-wrap items-center gap-2 py-1">
                  <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
                  <span className="text-sm">Submitted {new Date(m.created_at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true })}</span>
                  {(m.files ?? []).map((f: any) => (
                    <button key={f.id} onClick={() => openPath(f.file_path, f.file_name)} className="inline-flex items-center gap-1 text-xs text-navy hover:text-gold max-w-full">
                      <Download size={11} className="shrink-0" /> <span className="truncate">{f.file_name}</span>
                    </button>
                  ))}
                  {m.file_url && (
                    <button onClick={() => openPath(m.file_url, m.file_name)} className="inline-flex items-center gap-1 text-xs text-navy hover:text-gold max-w-full">
                      <Download size={11} className="shrink-0" /> <span className="truncate">{m.file_name}</span>
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {passed ? (
            <div className="rounded-xl border border-rose-300 bg-rose-500/10 p-3 flex items-center gap-2 text-rose-700">
              <Clock size={16} className="shrink-0" />
              <p className="text-sm font-semibold">Submission Deadline Expired — new submissions are closed. Only an admin can extend the deadline.</p>
            </div>
          ) : (
            <div className="space-y-3">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block">Upload your response (multiple files allowed, max 5 MB each)</label>
              <input
                type="file"
                multiple
                onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
                className="w-full text-sm file:mr-3 file:py-2 file:px-4 file:rounded-md file:border-0 file:bg-navy file:text-white file:cursor-pointer"
              />
              {!!files.length && (
                <ul className="text-xs text-muted-foreground space-y-1">
                  {files.map((f, i) => (
                    <li key={i} className="flex items-center gap-2">
                      <FileUp size={11} className="shrink-0" /> <span className="truncate">{f.name}</span>
                      <span className="shrink-0">({formatBytes(f.size)})</span>
                      <button onClick={() => setFiles(files.filter((_, j) => j !== i))} className="text-rose-600 hover:text-rose-700 shrink-0"><X size={12} /></button>
                    </li>
                  ))}
                </ul>
              )}
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                placeholder="Note to your teacher (optional)"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-gold focus:ring-2 focus:ring-gold/30 outline-none"
              />
              <button
                onClick={submit}
                disabled={busy}
                className="inline-flex items-center gap-2 rounded-full bg-gradient-to-br from-[oklch(0.86_0.12_90)] to-[oklch(0.7_0.15_75)] text-navy-deep px-6 py-2.5 text-sm font-semibold disabled:opacity-50"
              >
                {busy ? <Loader2 className="animate-spin" size={16} /> : <Upload size={16} />}
                {uploadMsg || "Submit assignment"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function PublicAssignments() {
  const { user } = useAuth();
  const { data } = useQuery({
    queryKey: ["public-assignments"],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assignments")
        .select("id,title,subject,file_url,file_name,created_at")
        .eq("is_public", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
  if (!data?.length) return null;
  async function open(path: string) {
    try { window.open(await getSignedUrl(path), "_blank"); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Could not open file."); }
  }
  return (
    <section className="mt-10">
      <h2 className="font-display text-lg sm:text-xl font-semibold mb-4">Following assignments are allowed for the public view.</h2>
      <div className="space-y-3">
        {data.map((a) => (
          <div key={a.id} className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="font-semibold break-words">{a.title}</p>
              <p className="text-xs text-muted-foreground break-words">{a.subject}{a.file_name ? ` · ${a.file_name}` : ""}</p>
            </div>
            {a.file_url && (
              <button onClick={() => open(a.file_url!)} className="inline-flex items-center justify-center gap-2 rounded-md border border-border px-3 py-2 text-sm hover:bg-muted">
                <Download size={14} /> Open
              </button>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

function AssignmentRow({ a, onChanged }: { a: any; onChanged: () => void }) {
  const deleteRecord = useServerFn(deleteStoredRecord);
  const reuploadRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<"download" | "delete" | "reupload" | null>(null);
  const { user } = useAuth();
  const locked = a.status !== "submitted";

  async function download() {
    if (!a.file_url) return;
    setBusy("download");
    try {
      const url = await getSignedUrl(a.file_url);
      window.open(url, "_blank");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not generate download link.");
    } finally {
      setBusy(null);
    }
  }

  async function openPath(path: string, name?: string) {
    try { window.open(await getSignedUrl(path, name), "_blank"); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Could not open file."); }
  }

  async function remove() {
    if (locked) return;
    if (!confirm("Delete this submission? This cannot be undone.")) return;
    setBusy("delete");
    try {
      await deleteRecord({ data: { kind: "assignment", id: a.id } });
      toast.success("Assignment deleted successfully.");
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete assignment.");
    } finally {
      setBusy(null);
    }
  }

  async function reupload(file: File | null) {
    if (!file || !user || locked) return;
    setBusy("reupload");
    try {
      const { path } = await uploadToBucket(user.id, file, "assignments");
      const { error } = await supabase.from("assignments").update({
        file_url: path, file_name: file.name, file_size: file.size,
      }).eq("id", a.id);
      if (error) throw error;
      if (a.file_url) {
        try { await removeStoredFile(a.file_url); }
        catch (cleanupError) {
          toast.error(cleanupError instanceof Error ? `Assignment replaced, but old file cleanup failed: ${cleanupError.message}` : "Assignment replaced, but the old file could not be removed.");
        }
      }
      toast.success("Assignment replaced successfully.");
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not replace assignment.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="rounded-2xl bg-card border border-border p-4 sm:p-6 hover:border-gold/40 transition">
      <div className="flex items-start gap-3 sm:gap-4">
        <div className="h-10 w-10 sm:h-11 sm:w-11 rounded-xl bg-navy/5 text-navy grid place-items-center shrink-0">
          <FileText size={18} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
            <p className="font-semibold text-foreground text-base leading-snug break-words min-w-0 flex-1">
              {a.title}
            </p>
            <span className={`shrink-0 px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wider ${STATUS_COLORS[a.status] || "bg-muted"}`}>
              {a.status.replace(/_/g, " ")}
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-1 break-words">
            {a.subject} · {a.semester || "—"}
          </p>
          {a.description && <p className="text-sm text-muted-foreground mt-2 line-clamp-3 break-words">{a.description}</p>}
          {a.feedback && (
            <div className="mt-3 rounded-lg bg-muted/60 p-3 border-l-2 border-gold">
              <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Feedback</p>
              <p className="text-sm text-foreground break-words">{a.feedback}</p>
              {a.grade && <p className="text-xs text-navy font-semibold mt-1">Grade: {a.grade}</p>}
            </div>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border pt-3">
            {a.file_url && (
              <button onClick={download} disabled={busy === "download"} className="inline-flex items-center gap-1.5 text-xs text-navy hover:text-gold transition disabled:opacity-50">
                {busy === "download" ? <Loader2 className="animate-spin" size={12} /> : <Download size={12} />} {formatBytes(a.file_size)}
              </button>
            )}
            {(a.files ?? []).filter((f: any) => f.file_path !== a.file_url).map((f: any) => (
              <button
                key={f.id}
                onClick={() => openPath(f.file_path, f.file_name)}
                className="inline-flex items-center gap-1.5 text-xs text-navy hover:text-gold transition max-w-full"
              >
                <Download size={12} className="shrink-0" /> <span className="truncate">{f.file_name}</span>
                <span className="shrink-0 text-muted-foreground">({formatBytes(f.file_size)})</span>
              </button>
            ))}
            {locked ? (
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><Lock size={11} /> Reviewed (Locked)</span>
            ) : (
              <>
                <button
                  onClick={() => reuploadRef.current?.click()}
                  disabled={busy === "reupload"}
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-navy transition disabled:opacity-50"
                >
                  {busy === "reupload" ? <Loader2 className="animate-spin" size={11} /> : <RefreshCcw size={11} />} Re-upload
                </button>
                <input ref={reuploadRef} type="file" className="hidden" onChange={(e) => reupload(e.target.files?.[0] ?? null)} />
                <button
                  onClick={remove}
                  disabled={busy === "delete"}
                  className="inline-flex items-center gap-1 text-xs text-rose-600 hover:text-rose-700 transition disabled:opacity-50"
                >
                  {busy === "delete" ? <Loader2 className="animate-spin" size={11} /> : <Trash2 size={11} />} Delete
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}


function SubmitForm({ onDone }: { onDone: () => void }) {
  const { user } = useAuth();
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [semester, setSemester] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not signed in");
      if (!file) throw new Error("Please attach a file");
      const { path, url } = await uploadToBucket(user.id, file, "assignments");
      const { error } = await supabase.from("assignments").insert({
        title, subject, semester, description,
        file_url: path, file_name: file.name, file_size: file.size,
        submitted_by: user.id,
      });
      if (error) throw error;
      return url;
    },
    onSuccess: () => { toast.success("Assignment uploaded successfully."); onDone(); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }}
      className="rounded-2xl bg-card border border-border p-4 sm:p-7 mb-6 space-y-5"
    >
      <div className="grid sm:grid-cols-2 gap-4 sm:gap-5">
        <Input label="Title" value={title} onChange={setTitle} required />
        <Input label="Subject" value={subject} onChange={setSubject} required />
        <Input label="Semester" value={semester} onChange={setSemester} placeholder="6th" />
        <div>
          <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">File (max 5 MB)</label>
          <input
            type="file"
            required
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="mt-1.5 w-full text-sm file:mr-3 file:py-2 file:px-4 file:rounded-md file:border-0 file:bg-navy file:text-white file:cursor-pointer"
          />
        </div>
      </div>
      <div>
        <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-gold focus:ring-2 focus:ring-gold/30 outline-none"
        />
      </div>
      <button
        disabled={mutation.isPending}
        className="inline-flex items-center gap-2 rounded-full bg-gradient-to-br from-[oklch(0.86_0.12_90)] to-[oklch(0.7_0.15_75)] text-navy-deep px-6 py-2.5 text-sm font-semibold disabled:opacity-50"
      >
        {mutation.isPending ? <Loader2 className="animate-spin" size={16} /> : <Upload size={16} />}
        Submit
      </button>
    </form>
  );
}

function Input({ label, value, onChange, required, placeholder }: { label: string; value: string; onChange: (v: string) => void; required?: boolean; placeholder?: string }) {
  return (
    <div>
      <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</label>
      <input
        required={required} value={value} placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-gold focus:ring-2 focus:ring-gold/30 outline-none"
      />
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-2xl border-2 border-dashed border-border p-8 sm:p-14 text-center">
      <FileText className="mx-auto text-muted-foreground" size={32} />
      <p className="mt-4 font-semibold">No submissions yet</p>
      <p className="text-sm text-muted-foreground mt-1">Click "New Submission" to upload your first assignment.</p>
    </div>
  );
}
