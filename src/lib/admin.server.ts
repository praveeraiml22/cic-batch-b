export const SUPER_ADMIN_ERROR =
  "This account is the Permanent Super Admin and cannot be modified.";

export type AdminContext = { supabase: any; userId: string };

export async function assertAdmin(context: AdminContext) {
  const { data, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: admin only");
  return context;
}

export async function loadRoles(supabase: any, userId: string) {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r: { role: string }) => r.role as string);
}

export async function isSuperAdmin(supabase: any, userId: string) {
  const roles = await loadRoles(supabase, userId);
  return roles.includes("super_admin");
}

export async function logAudit(
  supabase: any,
  entry: {
    actor_id: string | null;
    target_user_id: string | null;
    action: string;
    old_role?: string | null;
    new_role?: string | null;
    status: "success" | "blocked" | "error";
    reason?: string | null;
    metadata?: Record<string, unknown> | null;
  },
) {
  try {
    await supabase.from("role_audit_logs").insert(entry as any);
  } catch {
    /* audit logging must not break the request */
  }
}

export function primaryRole(roles: string[]) {
  if (roles.includes("super_admin")) return "super_admin";
  if (roles.includes("admin")) return "admin";
  if (roles.includes("faculty")) return "faculty";
  if (roles.includes("coordinator")) return "coordinator";
  return "student";
}