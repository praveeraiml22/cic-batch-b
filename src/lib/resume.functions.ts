import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdminClient(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: admin only");
  return supabaseAdmin;
}

/** Admin: list every student's latest resume with owner details. */
export const listAllResumes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context as { userId: string };
    const supabaseAdmin = await assertAdminClient(userId);

    const { data: resumes, error } = await supabaseAdmin
      .from("resumes")
      .select("*")
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);

    const ids = Array.from(new Set((resumes ?? []).map((r) => r.user_id)));
    let profiles: Array<Record<string, any>> = [];
    if (ids.length) {
      const { data: ps, error: pErr } = await supabaseAdmin
        .from("profiles")
        .select("id, full_name, email, student_id, semester, department, status")
        .in("id", ids);
      if (pErr) throw new Error(pErr.message);
      profiles = ps ?? [];
    }

    return (resumes ?? []).map((r) => {
      const p = profiles.find((x) => x.id === r.user_id);
      return {
        id: r.id,
        user_id: r.user_id,
        file_path: r.file_path,
        file_name: r.file_name,
        file_size: r.file_size,
        mime_type: r.mime_type,
        updated_at: r.updated_at,
        created_at: r.created_at,
        full_name: (p?.full_name as string) ?? "",
        email: (p?.email as string) ?? "",
        student_id: (p?.student_id as string) ?? "",
        semester: (p?.semester as string) ?? "",
        department: (p?.department as string) ?? "",
        status: (p?.status as string) ?? "",
      };
    });
  });
