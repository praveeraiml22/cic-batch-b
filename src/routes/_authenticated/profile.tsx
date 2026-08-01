import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Pencil, Save, X, Upload, User as UserIcon } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useProfile } from "@/hooks/use-profile";
import { PageHeader } from "@/components/page-header";

export const Route = createFileRoute("/_authenticated/profile")({
  component: ProfilePage,
});

const AVATAR_MAX = 5 * 1024 * 1024;
const AVATAR_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];

type FormShape = {
  full_name: string;
  student_id: string;
  roll_number: string;
  department: string;
  semester: string;
  mobile: string;
  bio: string;
  address: string;
};

function emptyForm(): FormShape {
  return { full_name: "", student_id: "", roll_number: "", department: "Civil Engineering", semester: "", mobile: "", bio: "", address: "" };
}

function ProfilePage() {
  const { user } = useAuth();
  const { data: profile, isLoading } = useProfile(user?.id);
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState<FormShape>(emptyForm);
  const [editing, setEditing] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string>("");
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setForm({
      full_name: profile.full_name ?? "",
      student_id: profile.student_id ?? "",
      roll_number: (profile as any).roll_number ?? "",
      department: profile.department ?? "Civil Engineering",
      semester: profile.semester ?? "",
      mobile: profile.mobile ?? "",
      bio: (profile as any).bio ?? "",
      address: (profile as any).address ?? "",
    });
    setAvatarUrl(profile.avatar_url ?? "");
  }, [profile]);

  const save = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not signed in");
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: form.full_name.trim(),
          department: form.department.trim(),
          semester: form.semester.trim(),
          mobile: form.mobile.trim(),
          bio: form.bio.trim(),
          address: form.address.trim(),
          roll_number: form.roll_number.trim(),
          updated_at: new Date().toISOString(),
        } as any)
        .eq("id", user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Profile updated successfully.");
      setEditing(false);
      qc.invalidateQueries({ queryKey: ["profile", user?.id] });
    },
    onError: (e: Error) => toast.error(e.message || "Unable to update profile."),
  });

  async function handleAvatar(file: File | null) {
    if (!file || !user) return;
    if (!AVATAR_TYPES.includes(file.type)) return toast.error("Please choose a JPG, PNG, or WEBP image.");
    if (file.size > AVATAR_MAX) return toast.error("Image must be 5 MB or smaller.");

    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${user.id}/avatars/avatar-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("cic-files").upload(path, file, {
        cacheControl: "3600", upsert: true, contentType: file.type,
      });
      if (upErr) throw upErr;
      const { data: signed } = await supabase.storage.from("cic-files").createSignedUrl(path, 60 * 60 * 24 * 365);
      const url = signed?.signedUrl ?? path;
      const { error: profErr } = await supabase.from("profiles").update({ avatar_url: url }).eq("id", user.id);
      if (profErr) throw profErr;
      setAvatarUrl(url);
      toast.success("Profile photo updated.");
      qc.invalidateQueries({ queryKey: ["profile", user.id] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not upload photo.");
    } finally {
      setUploading(false);
    }
  }

  if (isLoading) return <div className="grid place-items-center min-h-[60vh]"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="p-4 sm:p-6 lg:p-10 max-w-3xl mx-auto">
      <PageHeader
        title="My Profile"
        subtitle="Manage your member details and profile photo."
        action={
          editing ? (
            <div className="flex gap-2 [&>button]:flex-1 sm:[&>button]:flex-none">
              <button
                onClick={() => { setEditing(false); if (profile) setForm({
                  full_name: profile.full_name ?? "", student_id: profile.student_id ?? "",
                  roll_number: (profile as any).roll_number ?? "",
                  department: profile.department ?? "Civil Engineering", semester: profile.semester ?? "",
                  mobile: profile.mobile ?? "", bio: (profile as any).bio ?? "", address: (profile as any).address ?? "",
                }); }}
                className="inline-flex items-center justify-center gap-2 rounded-full border border-border bg-card px-5 py-2.5 text-sm font-semibold"
              ><X size={16} /> Cancel</button>
              <button
                onClick={() => save.mutate()}
                disabled={save.isPending}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-navy text-white px-5 py-2.5 text-sm font-semibold hover:bg-navy-deep transition disabled:opacity-50"
              >{save.isPending ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />} Save</button>
            </div>
          ) : (
            <button
              onClick={() => setEditing(true)}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-navy text-white px-5 py-2.5 text-sm font-semibold hover:bg-navy-deep transition"
            ><Pencil size={16} /> Edit profile</button>
          )
        }
      />

      <section className="rounded-2xl bg-card border border-border p-5 sm:p-7 space-y-6">
        <div className="flex items-center gap-4 sm:gap-5 pb-5 border-b border-border">

          <div className="relative">
            {avatarUrl ? (
              <img src={avatarUrl} alt={form.full_name || "Avatar"} className="h-20 w-20 rounded-full object-cover ring-2 ring-gold/40" />
            ) : (
              <div className="h-20 w-20 rounded-full bg-gradient-to-br from-[oklch(0.86_0.12_90)] to-[oklch(0.7_0.15_75)] grid place-items-center text-navy-deep font-display text-2xl font-bold">
                {(form.full_name || user?.email || "?")[0].toUpperCase()}
              </div>
            )}
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="absolute -bottom-1 -right-1 h-8 w-8 rounded-full bg-navy text-white grid place-items-center shadow ring-2 ring-card hover:bg-navy-deep transition disabled:opacity-50"
              aria-label="Change photo"
              title="Change photo"
            >{uploading ? <Loader2 className="animate-spin" size={14} /> : <Upload size={13} />}</button>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => handleAvatar(e.target.files?.[0] ?? null)}
            />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-foreground truncate">{form.full_name || "—"}</p>
            <p className="text-sm text-muted-foreground truncate">{user?.email}</p>
            <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1"><UserIcon size={12} className="shrink-0" /> JPG, PNG or WEBP, max 5 MB</p>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-4 sm:gap-5">

          <Field label="Full Name" value={form.full_name} onChange={(v) => setForm({ ...form, full_name: v })} editing={editing} />
          <Field label="Email" value={user?.email ?? ""} onChange={() => {}} editing={false} hint="Email is read-only." />
          <Field label="Student ID" value={form.student_id} onChange={() => {}} editing={false} hint="Set at signup, contact an admin to change." />
          <Field label="Roll Number" value={form.roll_number} onChange={(v) => setForm({ ...form, roll_number: v })} editing={editing} />
          <Field label="Department" value={form.department} onChange={(v) => setForm({ ...form, department: v })} editing={editing} />
          <Field label="Semester" value={form.semester} onChange={(v) => setForm({ ...form, semester: v })} editing={editing} placeholder="e.g. 6th" />
          <Field label="Phone" value={form.mobile} onChange={(v) => setForm({ ...form, mobile: v })} editing={editing} placeholder="+91 …" />
          <Field label="Address" value={form.address} onChange={(v) => setForm({ ...form, address: v })} editing={editing} />
          <div className="sm:col-span-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Bio</label>
            <textarea
              value={form.bio}
              onChange={(e) => setForm({ ...form, bio: e.target.value })}
              readOnly={!editing}
              rows={3}
              className={`mt-1.5 w-full rounded-lg border px-3 py-2 text-sm outline-none transition ${
                editing ? "border-border bg-background focus:border-gold focus:ring-2 focus:ring-gold/30" : "border-border bg-muted text-muted-foreground"
              }`}
            />
          </div>
        </div>
      </section>
    </div>
  );
}

function Field({ label, value, onChange, editing, placeholder, hint }: { label: string; value: string; onChange: (v: string) => void; editing: boolean; placeholder?: string; hint?: string }) {
  return (
    <div>
      <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</label>
      <input
        value={value}
        readOnly={!editing}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className={`mt-1.5 w-full rounded-lg border px-3 py-2 text-sm outline-none transition ${
          editing ? "border-border bg-background focus:border-gold focus:ring-2 focus:ring-gold/30" : "border-border bg-muted text-muted-foreground"
        }`}
      />
      {hint && <p className="mt-1 text-[10px] text-muted-foreground">{hint}</p>}
    </div>
  );
}
