import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import {
  Upload,
  FolderOpen,
  Folder,
  FolderPlus,
  Download,
  Loader2,
  Plus,
  Search,
  ChevronRight,
  FileText,
  Home,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { uploadToBucket, getSignedUrl, formatBytes, downloadStoredFile, removeStoredFile } from "@/lib/upload";
import { deleteDocumentFolder } from "@/lib/files.functions";
import { PageHeader } from "@/components/page-header";

export const Route = createFileRoute("/_authenticated/documents")({
  component: DocumentsPage,
});

const CATEGORIES = [
  { value: "all", label: "All" },
  { value: "reports", label: "Reports" },
  { value: "research_papers", label: "Research" },
  { value: "project_files", label: "Projects" },
  { value: "notes", label: "Notes" },
  { value: "misc", label: "Other" },
] as const;

type FolderRow = { id: string; name: string; parent_id: string | null; owner_id: string };

function DocumentsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [showFolderForm, setShowFolderForm] = useState(false);
  const [currentId, setCurrentId] = useState<string | null>(null);

  const { data: folders, isLoading: loadingFolders } = useQuery({
    queryKey: ["document-folders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("document_folders")
        .select("id,name,parent_id,owner_id")
        .eq("kind", "user")
        .order("name");
      if (error) throw error;
      return (data ?? []) as FolderRow[];
    },
  });

  const { data: docs, isLoading } = useQuery({
    queryKey: ["documents", currentId],
    enabled: !!currentId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("documents")
        .select("*")
        .eq("folder_id", currentId!)
        .neq("category", "assignments")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const all = folders ?? [];
  const byId = new Map(all.map((f) => [f.id, f]));
  const children = all.filter((f) => f.parent_id === currentId);

  const breadcrumbs: FolderRow[] = [];
  let cursor = currentId ? byId.get(currentId) : undefined;
  while (cursor) {
    breadcrumbs.unshift(cursor);
    cursor = cursor.parent_id ? byId.get(cursor.parent_id) : undefined;
  }

  const q = search.toLowerCase();
  const visibleFolders = children.filter((f) => !q || f.name.toLowerCase().includes(q));
  const filtered = (docs ?? []).filter((d) => {
    const matchCat = filter === "all" || d.category === filter;
    const matchSearch =
      !q || d.title.toLowerCase().includes(q) || (d.description ?? "").toLowerCase().includes(q);
    return matchCat && matchSearch;
  });

  function refresh() {
    qc.invalidateQueries({ queryKey: ["documents"] });
    qc.invalidateQueries({ queryKey: ["document-folders"] });
  }

  return (
    <div className="p-4 sm:p-6 lg:p-10 max-w-7xl mx-auto">
      <PageHeader
        title="Document Library"
        subtitle="Organise files in folders — open a folder to upload, view, or download its documents."
        action={
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => { setShowFolderForm((s) => !s); setShowForm(false); }}
              className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 sm:px-5 py-2.5 text-sm font-semibold hover:border-gold transition"
            >
              <FolderPlus size={16} /> New folder
            </button>
            <button
              onClick={() => {
                if (!currentId) {
                  toast.error("Open or create a folder first — files must be stored inside a folder.");
                  return;
                }
                setShowForm((s) => !s);
                setShowFolderForm(false);
              }}
              disabled={!currentId}
              title={currentId ? "Upload to this folder" : "Select a folder first"}
              className="inline-flex items-center gap-2 rounded-full bg-navy text-white px-4 sm:px-5 py-2.5 text-sm font-semibold hover:bg-navy-deep transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Plus size={16} /> Upload
            </button>
          </div>
        }
      />



      {/* Breadcrumbs */}
      <nav aria-label="Folder path" className="mb-5 flex flex-wrap items-center gap-1 text-sm">
        <button
          onClick={() => setCurrentId(null)}
          className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 font-semibold transition ${
            currentId === null ? "text-foreground" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Home size={14} /> All folders
        </button>
        {breadcrumbs.map((b) => (
          <span key={b.id} className="flex items-center gap-1 min-w-0">
            <ChevronRight size={14} className="shrink-0 text-muted-foreground" />
            <button
              onClick={() => setCurrentId(b.id)}
              className={`truncate max-w-[10rem] rounded-md px-2 py-1 font-semibold transition ${
                currentId === b.id ? "text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {b.name}
            </button>
          </span>
        ))}
      </nav>

      {showFolderForm && (
        <FolderForm
          parentId={currentId}
          onDone={() => { setShowFolderForm(false); refresh(); }}
        />
      )}

      {showForm && currentId && (
        <UploadForm folderId={currentId} onDone={() => { setShowForm(false); refresh(); }} />
      )}

      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            placeholder="Search this folder..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-border bg-card pl-9 pr-3 py-2 text-sm focus:border-gold focus:ring-2 focus:ring-gold/30 outline-none"
          />
        </div>
        {currentId && (
          <div className="flex flex-wrap gap-1.5">
            {CATEGORIES.map((c) => (
              <button
                key={c.value}
                onClick={() => setFilter(c.value)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition ${
                  filter === c.value
                    ? "bg-navy text-white"
                    : "bg-card border border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Folders */}
      {loadingFolders ? (
        <div className="grid place-items-center py-16"><Loader2 className="animate-spin" /></div>
      ) : visibleFolders.length > 0 ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 mb-8">
          {visibleFolders.map((f) => (
            <FolderCard
              key={f.id}
              f={f}
              ownerId={user?.id}
              onOpen={() => { setCurrentId(f.id); setSearch(""); }}
              onChanged={refresh}
            />
          ))}
        </div>
      ) : null}

      {/* Files */}
      {!currentId ? (
        !loadingFolders && visibleFolders.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-border p-10 sm:p-14 text-center">
            <FolderPlus className="mx-auto text-muted-foreground" size={32} />
            <p className="mt-4 font-semibold">No folders yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Create a folder first — every file must live inside one.
            </p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Select a folder to view and download its files.</p>
        )
      ) : isLoading ? (
        <div className="grid place-items-center py-16"><Loader2 className="animate-spin" /></div>
      ) : !filtered.length ? (
        <div className="rounded-2xl border-2 border-dashed border-border p-10 sm:p-14 text-center">
          <FolderOpen className="mx-auto text-muted-foreground" size={32} />
          <p className="mt-4 font-semibold">No documents in this folder</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((d) => (
            <DocCard key={d.id} d={d} ownerId={user?.id} onChanged={refresh} />
          ))}
        </div>
      )}
    </div>
  );
}

function FolderCard({
  f,
  ownerId,
  onOpen,
  onChanged,
}: {
  f: FolderRow;
  ownerId?: string;
  onOpen: () => void;
  onChanged: () => void;
}) {
  const deleteFolder = useServerFn(deleteDocumentFolder);
  async function rename() {
    const name = prompt("Rename folder", f.name)?.trim();
    if (!name || name === f.name) return;
    const { error } = await supabase.from("document_folders").update({ name }).eq("id", f.id);
    if (error) toast.error(error.message);
    else { toast.success("Folder renamed"); onChanged(); }
  }
  async function remove() {
    if (!confirm("Delete this folder, its subfolders and all files inside?")) return;
    try {
      await deleteFolder({ data: { folderId: f.id } });
      toast.success("Folder and its files deleted");
      onChanged();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not delete the folder and its files");
    }
  }
  return (
    <div className="rounded-2xl bg-card border border-border p-4 sm:p-5 hover:border-gold/40 transition">
      <button onClick={onOpen} className="w-full text-left flex items-center gap-3 min-w-0">
        <span className="h-11 w-11 shrink-0 rounded-xl bg-navy/10 text-navy grid place-items-center">
          <Folder size={18} />
        </span>
        <span className="min-w-0">
          <span className="block font-semibold text-foreground truncate">{f.name}</span>
          <span className="block text-xs text-muted-foreground">Open folder</span>
        </span>
      </button>
      {ownerId === f.owner_id && (
        <div className="mt-4 flex items-center gap-2">
          <button onClick={rename} className="flex-1 rounded-md border border-border py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition">
            Rename
          </button>
          <button onClick={remove} className="flex-1 rounded-md border border-border py-1.5 text-xs font-semibold text-muted-foreground hover:text-rose-600 transition">
            Delete
          </button>
        </div>
      )}
    </div>
  );
}

function FolderForm({ parentId, onDone }: { parentId: string | null; onDone: () => void }) {
  const { user } = useAuth();
  const [name, setName] = useState("");

  const m = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("You must be signed in");
      const { error } = await supabase
        .from("document_folders")
        .insert({ name: name.trim(), parent_id: parentId, owner_id: user.id });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Folder created"); setName(""); onDone(); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); m.mutate(); }}
      className="rounded-2xl bg-card border border-border p-5 sm:p-7 mb-6 flex flex-col sm:flex-row sm:items-end gap-4"
    >
      <div className="flex-1 min-w-0">
        <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {parentId ? "New subfolder name" : "New folder name"}
        </label>
        <input
          required value={name} onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Semester 5 / Structural Analysis"
          className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-gold focus:ring-2 focus:ring-gold/30"
        />
      </div>
      <button
        disabled={m.isPending}
        className="inline-flex items-center justify-center gap-2 rounded-full bg-navy text-white px-6 py-2.5 text-sm font-semibold disabled:opacity-50"
      >
        {m.isPending ? <Loader2 className="animate-spin" size={16} /> : <FolderPlus size={16} />}
        Create
      </button>
    </form>
  );
}

function DocCard({ d, ownerId, onChanged }: { d: any; ownerId?: string; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  async function download() {
    if (busy) return;
    setBusy(true);
    setProgress(0);
    try {
      await downloadStoredFile(d.file_url, d.file_name || d.title || "document", setProgress);
      toast.success("Download complete");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Download failed");
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }
  async function view() {
    try {
      const url = await getSignedUrl(d.file_url);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not open file");
    }
  }
  async function remove() {
    if (!confirm("Delete this document?")) return;
    try {
      await removeStoredFile(d.file_url);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not delete the file; its record was kept.");
      return;
    }
    const { error } = await supabase.from("documents").delete().eq("id", d.id);
    if (error) return toast.error(error.message);
    toast.success("Deleted"); onChanged();
  }
  return (
    <div className="rounded-2xl bg-card border border-border p-5 sm:p-6 hover:border-gold/40 transition flex flex-col">
      <div className="h-11 w-11 rounded-xl bg-gold/15 text-[oklch(0.55_0.13_75)] grid place-items-center mb-4">
        <FileText size={18} />
      </div>
      <p className="font-semibold text-foreground line-clamp-1">{d.title}</p>
      <p className="text-xs text-muted-foreground mt-1 capitalize">
        {d.category.replace(/_/g, " ")} · {formatBytes(d.file_size)}
      </p>
      {d.description && <p className="text-sm text-muted-foreground mt-3 line-clamp-2">{d.description}</p>}
      <div className="mt-5 flex flex-wrap items-center gap-2">
        <button onClick={view} className="rounded-md border border-border px-3 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground transition">
          View
        </button>
        <button onClick={download} disabled={busy} className="flex-1 min-w-[7rem] inline-flex items-center justify-center gap-1.5 rounded-md bg-navy text-white py-2 text-xs font-semibold hover:bg-navy-deep transition disabled:opacity-60">
          {busy ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
          {busy ? (progress !== null ? `Downloading… ${progress}%` : "Downloading…") : "Download"}
        </button>
        {ownerId === d.uploaded_by && (
          <button onClick={remove} className="px-3 py-2 rounded-md border border-border text-xs text-muted-foreground hover:text-rose-600 transition">
            Delete
          </button>
        )}
      </div>
      {busy && progress !== null && (
        <div className="mt-3">
          <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-gold transition-[width] duration-200"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="mt-1 text-[11px] font-medium text-muted-foreground text-right">{progress}%</p>
        </div>
      )}
    </div>
  );
}

function UploadForm({ folderId, onDone }: { folderId: string; onDone: () => void }) {
  const { user } = useAuth();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("misc");
  const [file, setFile] = useState<File | null>(null);

  const m = useMutation({
    mutationFn: async () => {
      if (!user || !file) throw new Error("Missing file");
      if (!folderId) throw new Error("Select a folder before uploading");
      const { path } = await uploadToBucket(user.id, file, "documents");
      const { error } = await supabase.from("documents").insert({
        title, description, category: category as any,
        file_url: path, file_name: file.name, file_size: file.size,
        uploaded_by: user.id, folder_id: folderId,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Uploaded"); onDone(); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <form onSubmit={(e) => { e.preventDefault(); m.mutate(); }} className="rounded-2xl bg-card border border-border p-5 sm:p-7 mb-6 grid sm:grid-cols-2 gap-5">
      <div className="sm:col-span-2">
        <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Title</label>
        <input required value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-gold focus:ring-2 focus:ring-gold/30" />
      </div>
      <div>
        <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Category</label>
        <select value={category} onChange={(e) => setCategory(e.target.value)} className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-gold">
          {CATEGORIES.slice(1).map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
      </div>
      <div>
        <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">File</label>
        <input type="file" required onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="mt-1.5 w-full text-sm file:mr-3 file:py-2 file:px-4 file:rounded-md file:border-0 file:bg-navy file:text-white" />
      </div>
      <div className="sm:col-span-2">
        <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Description</label>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-gold focus:ring-2 focus:ring-gold/30" />
      </div>
      <div className="sm:col-span-2">
        <button disabled={m.isPending} className="inline-flex items-center gap-2 rounded-full bg-gradient-to-br from-[oklch(0.86_0.12_90)] to-[oklch(0.7_0.15_75)] text-navy-deep px-6 py-2.5 text-sm font-semibold disabled:opacity-50">
          {m.isPending ? <Loader2 className="animate-spin" size={16} /> : <Upload size={16} />}
          Upload
        </button>
      </div>
    </form>
  );
}
