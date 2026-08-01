import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { Upload, FileText, Download, Loader2, Plus, Trash2, RefreshCcw, Lock } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { uploadToBucket, getSignedUrl, formatBytes } from "@/lib/upload";
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

  const { data: assignments, isLoading } = useQuery({
    queryKey: ["assignments", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assignments")
        .select("*")
        .eq("submitted_by", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

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
    </div>
  );
}

function AssignmentRow({ a, onChanged }: { a: any; onChanged: () => void }) {
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

  async function remove() {
    if (locked) return;
    if (!confirm("Delete this submission? This cannot be undone.")) return;
    setBusy("delete");
    try {
      const { error } = await supabase.from("assignments").delete().eq("id", a.id);
      if (error) throw error;
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
          <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">File (max 100 MB)</label>
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
