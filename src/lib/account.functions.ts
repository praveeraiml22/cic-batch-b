import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function loadOrCreateAccount(userId: string) {
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

  const { data: roles, error: roleReadError } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  if (roleReadError) throw new Error(roleReadError.message);

  if (!roles?.length) {
    const { error: roleError } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: userId, role: "student" });
    if (roleError) throw new Error(roleError.message);
  }

  const [{ data: profile, error: profileLoadError }, { data: refreshedRoles, error: rolesLoadError }] = await Promise.all([
    supabaseAdmin.from("profiles").select("*").eq("id", userId).maybeSingle(),
    supabaseAdmin.from("user_roles").select("role").eq("user_id", userId),
  ]);

  if (profileLoadError) throw new Error(profileLoadError.message);
  if (rolesLoadError) throw new Error(rolesLoadError.message);

  const roleNames = refreshedRoles?.map((r) => r.role) ?? [];
  return {
    userId,
    email: user.email ?? profile?.email ?? "",
    profile,
    roles: roleNames,
    isAdmin: roleNames.includes("admin"),
  };
}

export const ensureMemberAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context as any;
    await loadOrCreateAccount(userId);
    return { ok: true };
  });

export const getCurrentAccount = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context as any;
    return loadOrCreateAccount(userId);
  });