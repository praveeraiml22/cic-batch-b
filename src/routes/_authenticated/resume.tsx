import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { FileText, Upload, Download, Eye, Trash2, Loader2, RefreshCcw } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { PageHeader } from "@/components/page-header";
import { formatBytes, getSignedUrl, downloadStoredFile, uploadToB2, removeStoredFile } from "@/lib/upload";

export const Route = createFileRoute("/_authenticated/resume")({
  head: () => ({
    meta: [
      { title: "My Resume | CIC Portal" },
      { name: "description", content: "Upload, replace, preview, and download your latest resume in the CIC student portal." },
      { property: "og:title", content: "My Resume | CIC Portal" },
      { property: "og:description", content: "Keep your latest resume up to date for the CIC coordination team." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ResumePage,
});

export const MAX_RESUME_SIZE = 5 * 1024 * 1024;
const ALLOWED_EXT = ["pdf", "doc", "docx"];
const ALLOWED_MIME = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

export function validateResumeFile(file: File): string | null {
  const ext = (file.name.split(".").pop() ?? "").toLowerCase();
  if (!ALLOWED_EXT.includes(ext) && !ALLOWED_MIME.includes(file.type)) {
    return "Only PDF, DOC, or DOCX files are allowed.";
  }
  if (file.size > MAX_RESUME_SIZE) return "File is larger than the 5 MB limit.";
  if (file.size === 0) return "That file appears to be empty.";
  return null;
}

function ResumePage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [busy, setBusy] = useState<null | "view" | "download" | "delete">(null);

  const { data: resume, isLoading } = useQuery({
    queryKey: ["my-resume", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("resumes")
        .select("*")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  async function handleFile(file: File) {
    if (!user?.id) return;
    const problem = validateResumeFile(file);
    if (problem) return toast.error(problem);

    const previousPath = resume?.file_path;

    setProgress(0);
    try {
      const { path } = await uploadToB2(file, "resume", setProgress);
      const { error } = await supabase.from("resumes").upsert(
        {
          user_id: user.id,
          file_path: path,
          file_name: file.name,
          file_size: file.size,
          mime_type: file.type || null,
        },
        { onConflict: "user_id" },
      );
      if (error) throw error;
      if (previousPath && previousPath !== path) {
        await removeStoredFile(previousPath).catch(() => {});
      }
      toast.success(previousPath ? "Resume replaced successfully." : "Resume uploaded successfully.");
      qc.invalidateQueries({ queryKey: ["my-resume", user.id] });
    } catch (e: any) {
      toast.error(e?.message ?? "Upload failed. Please try again.");
    } finally {
      setProgress(null);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function openResume() {
    if (!resume) return;
    setBusy("view");
    try {
      const url = await getSignedUrl(resume.file_path, resume.file_name);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch {
      toast.error("Could not open the resume.");
    } finally {
      setBusy(null);
    }
  }

  async function downloadResume() {
    if (!resume) return;
    setBusy("download");
    try {
      await downloadStoredFile(resume.file_path, resume.file_name);
    } catch {
      toast.error("Download failed.");
    } finally {
      setBusy(null);
    }
  }

  async function deleteResume() {
    if (!resume) return;
    if (!confirm("Delete your resume? You can upload a new one anytime.")) return;
    setBusy("delete");
    try {
      await removeStoredFile(resume.file_path);
      const { error } = await supabase.from("resumes").delete().eq("id", resume.id);
      if (error) throw error;
      toast.success("Resume deleted.");
      qc.invalidateQueries({ queryKey: ["my-resume", user?.id] });
    } catch (e: any) {
      toast.error(e?.message ?? "Could not delete the resume.");
    } finally {
      setBusy(null);
    }
  }

  const uploading = progress !== null;

  return (
    <div className="p-4 sm:p-6 lg:p-10 max-w-4xl mx-auto">
      <PageHeader
        title="My Resume"
        subtitle="Keep one up-to-date resume on file. Uploading a new file replaces the old one."
      />

      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
        }}
      />

      {isLoading ? (
        <div className="rounded-2xl bg-card border border-border p-10 grid place-items-center">
          <Loader2 className="animate-spin text-muted-foreground" size={20} />
        </div>
      ) : resume ? (
        <div className="rounded-2xl bg-card border border-border p-4 sm:p-6">
          <div className="flex items-start gap-3 sm:gap-4">
            <div className="h-10 w-10 sm:h-12 sm:w-12 shrink-0 grid place-items-center rounded-xl bg-navy/5 text-navy">
              <FileText size={20} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold break-words leading-snug">{resume.file_name}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {formatBytes(resume.file_size)} · Updated {new Date(resume.updated_at).toLocaleString()}
              </p>
            </div>
          </div>

          <div className="mt-5 pt-4 border-t border-border grid grid-cols-2 sm:flex sm:flex-wrap gap-2">
            <ActionButton onClick={openResume} loading={busy === "view"} icon={Eye} label="View" />
            <ActionButton onClick={downloadResume} loading={busy === "download"} icon={Download} label="Download" />
            <ActionButton
              onClick={() => inputRef.current?.click()}
              loading={uploading}
              icon={RefreshCcw}
              label="Replace"
            />
            <ActionButton
              onClick={deleteResume}
              loading={busy === "delete"}
              icon={Trash2}
              label="Delete"
              tone="danger"
            />
          </div>
        </div>
      ) : (
        <div className="rounded-2xl bg-card border border-dashed border-border p-8 sm:p-12 text-center">
          <div className="mx-auto h-12 w-12 grid place-items-center rounded-xl bg-navy/5 text-navy">
            <Upload size={22} />
          </div>
          <h2 className="mt-4 font-display text-lg font-semibold">No resume uploaded yet</h2>
          <p className="mt-1 text-sm text-muted-foreground">PDF, DOC, or DOCX — up to 5 MB.</p>
          <button
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="mt-5 inline-flex items-center gap-2 rounded-full bg-navy text-white px-5 py-2.5 text-sm font-semibold hover:bg-navy-deep transition disabled:opacity-60 w-full sm:w-auto justify-center"
          >
            <Upload size={16} /> Upload Resume
          </button>
        </div>
      )}

      {uploading && (
        <div className="mt-4 rounded-xl border border-border bg-card p-4">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Uploading…</span>
            <span>{progress}%</span>
          </div>
          <div className="mt-2 h-2 w-full rounded-full bg-muted overflow-hidden">
            <div className="h-full bg-navy transition-all" style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}
    </div>
  );
}

function ActionButton({
  onClick,
  loading,
  icon: Icon,
  label,
  tone,
}: {
  onClick: () => void;
  loading?: boolean;
  icon: React.ComponentType<{ size?: number }>;
  label: string;
  tone?: "danger";
}) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className={`inline-flex items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition disabled:opacity-60 ${
        tone === "danger"
          ? "border-destructive/40 text-destructive hover:bg-destructive/10"
          : "border-border hover:bg-muted"
      }`}
    >
      {loading ? <Loader2 size={14} className="animate-spin" /> : <Icon size={14} />} {label}
    </button>
  );
}
