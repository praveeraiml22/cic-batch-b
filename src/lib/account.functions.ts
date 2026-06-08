import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const ensureMemberAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context as any;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.getUserById(userId);
    if (authError) throw new Error(authError.message);

    const user = authUser.user;
    const metadata = user.user_metadata ?? {};
    const { error: profileError } = await supabaseAdmin.from("profiles").upsert(
      {
        id: userId,
        email: user.email ?? "",
        full_name: metadata.full_name ?? metadata.name ?? "",
        student_id: metadata.student_id ?? null,
      },
      { onConflict: "id", ignoreDuplicates: true },
    );
    if (profileError) throw new Error(profileError.message);

    const { data: existingRoles, error: roleReadError } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    if (roleReadError) throw new Error(roleReadError.message);

    if (!existingRoles?.length) {
      const { error: roleError } = await supabaseAdmin.from("user_roles").insert({ user_id: userId, role: "student" });
      if (roleError) throw new Error(roleError.message);
    }

    return { ok: true };
  });