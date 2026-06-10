import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Upload, FolderOpen, Download, Loader2, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { uploadToBucket, getSignedUrl, formatBytes } from "@/lib/upload";
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

function DocumentsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);

  const { data: docs, isLoading } = useQuery({
    queryKey: ["documents"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("documents")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const filtered = (docs ?? []).filter((d) => {
    const matchCat = filter === "all" || d.category === filter;
    const q = search.toLowerCase();
    const matchSearch = !q || d.title.toLowerCase().includes(q) || (d.description ?? "").toLowerCase().includes(q);
    return matchCat && matchSearch;
  });

  return (
    <div className="p-6 lg:p-10 max-w-7xl mx-auto">
      <PageHeader
        title="Document Library"
        subtitle="Browse, search, and upload course materials and references."
        action={
          <button
            onClick={() => setShowForm((s) => !s)}
            className="inline-flex items-center gap-2 rounded-full bg-navy text-white px-5 py-2.5 text-sm font-semibold hover:bg-navy-deep transition"
          >
            <Plus size={16} /> Upload
          </button>
        }
      />

      {showForm && (
        <UploadForm onDone={() => { setShowForm(false); qc.invalidateQueries({ queryKey: ["documents"] }); }} />
      )}

      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            placeholder="Search documents..." value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-border bg-card pl-9 pr-3 py-2 text-sm focus:border-gold focus:ring-2 focus:ring-gold/30 outline-none"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {CATEGORIES.map((c) => (
            <button
              key={c.value}
              onClick={() => setFilter(c.value)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition ${
                filter === c.value ? "bg-navy text-white" : "bg-card border border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="grid place-items-center py-20"><Loader2 className="animate-spin" /></div>
      ) : !filtered.length ? (
        <div className="rounded-2xl border-2 border-dashed border-border p-14 text-center">
          <FolderOpen className="mx-auto text-muted-foreground" size={32} />
          <p className="mt-4 font-semibold">No documents found</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((d) => <DocCard key={d.id} d={d} ownerId={user?.id} onChanged={() => qc.invalidateQueries({ queryKey: ["documents"] })} />)}
        </div>
      )}
    </div>
  );
}

function DocCard({ d, ownerId, onChanged }: { d: any; ownerId?: string; onChanged: () => void }) {
  async function download() {
    const url = await getSignedUrl(d.file_url);
    window.open(url, "_blank");
  }
  async function remove() {
    if (!confirm("Delete this document?")) return;
    const { error } = await supabase.from("documents").delete().eq("id", d.id);
    if (error) toast.error(error.message);
    else { toast.success("Deleted"); onChanged(); }
  }
  return (
    <div className="rounded-2xl bg-card border border-border p-6 hover:border-gold/40 transition flex flex-col">
      <div className="h-11 w-11 rounded-xl bg-gold/15 text-[oklch(0.55_0.13_75)] grid place-items-center mb-4">
        <FolderOpen size={18} />
      </div>
      <p className="font-semibold text-foreground line-clamp-1">{d.title}</p>
      <p className="text-xs text-muted-foreground mt-1 capitalize">{d.category.replace(/_/g, " ")} · {formatBytes(d.file_size)}</p>
      {d.description && <p className="text-sm text-muted-foreground mt-3 line-clamp-2">{d.description}</p>}
      <div className="mt-5 flex items-center gap-2">
        <button onClick={download} className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-md bg-navy text-white py-2 text-xs font-semibold hover:bg-navy-deep transition">
          <Download size={13} /> Download
        </button>
        {ownerId === d.uploaded_by && (
          <button onClick={remove} className="px-3 py-2 rounded-md border border-border text-xs text-muted-foreground hover:text-rose-600 transition">Delete</button>
        )}
      </div>
    </div>
  );
}

function UploadForm({ onDone }: { onDone: () => void }) {
  const { user } = useAuth();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("misc");
  const [file, setFile] = useState<File | null>(null);

  const m = useMutation({
    mutationFn: async () => {
      if (!user || !file) throw new Error("Missing file");
      const { path } = await uploadToBucket(user.id, file, "documents");
      const { error } = await supabase.from("documents").insert({
        title, description, category: category as any,
        file_url: path, file_name: file.name, file_size: file.size,
        uploaded_by: user.id,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Uploaded"); onDone(); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <form onSubmit={(e) => { e.preventDefault(); m.mutate(); }} className="rounded-2xl bg-card border border-border p-7 mb-6 grid sm:grid-cols-2 gap-5">
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
