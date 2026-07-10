import { createServerFn } from "@tanstack/react-start";
import { installServerWebSocketShim } from "./websocket-shim";
import { installServerRuntime } from "./server-runtime-middleware";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

installServerWebSocketShim();

type AccountContext = {
  supabase: any;
  userId: string;
  claims?: Record<string, any>;
};

async function loadOrCreateAccount(context: AccountContext) {
  const { supabase, userId, claims = {} } = context;
  const metadata = claims.user_metadata ?? claims.app_metadata ?? {};
  const email = claims.email ?? metadata.email ?? "";

  const { error: profileError } = await supabase.from("profiles").upsert(
    {
      id: userId,
      email,
      full_name: metadata.full_name ?? metadata.name ?? "",
      student_id: metadata.student_id ?? null,
      status: "pending",
    },
    { onConflict: "id", ignoreDuplicates: true },
  );
  if (profileError) throw new Error(profileError.message);

  const { data: roles, error: roleReadError } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  if (roleReadError) throw new Error(roleReadError.message);

  if (!roles?.length) {
    const { error: roleError } = await supabase
      .from("user_roles")
      .insert({ user_id: userId, role: "student" });
    if (roleError) throw new Error(roleError.message);
  }

  const [{ data: profile, error: profileLoadError }, { data: refreshedRoles, error: rolesLoadError }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
    supabase.from("user_roles").select("role").eq("user_id", userId),
  ]);

  if (profileLoadError) throw new Error(profileLoadError.message);
  if (rolesLoadError) throw new Error(rolesLoadError.message);

  const roleNames = refreshedRoles?.map((r: { role: string }) => r.role) ?? [];
  return {
    userId,
    email: email || profile?.email || "",
    profile,
    roles: roleNames,
    isAdmin: roleNames.includes("admin") || roleNames.includes("super_admin"),
  };
}

export const ensureMemberAccount = createServerFn({ method: "POST" })
  .middleware([installServerRuntime, requireSupabaseAuth])
  .handler(async ({ context }) => {
    await loadOrCreateAccount(context as AccountContext);
    return { ok: true };
  });

export const getCurrentAccount = createServerFn({ method: "GET" })
  .middleware([installServerRuntime, requireSupabaseAuth])
  .handler(async ({ context }) => loadOrCreateAccount(context as AccountContext));