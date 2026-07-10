import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { installServerWebSocketShim } from "./websocket-shim";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

installServerWebSocketShim();

const MEMBER_ROLES = ["admin", "faculty", "coordinator", "student"] as const;
type MemberRole = (typeof MEMBER_ROLES)[number];

const SUPER_ADMIN_ERROR =
  "This account is the Permanent Super Admin and cannot be modified.";

type AdminContext = { supabase: any; userId: string };

async function assertAdmin(context: AdminContext) {
  const { data, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: admin only");
  return context;
}

/** Load full role list once per request. */
async function loadRoles(supabase: any, userId: string) {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r: { role: string }) => r.role as string);
}

async function isSuperAdmin(supabase: any, userId: string) {
  const roles = await loadRoles(supabase, userId);
  return roles.includes("super_admin");
}

async function logAudit(
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

export const deleteUserAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ userId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const ctx = await assertAdmin(context as AdminContext);
    if (data.userId === ctx.userId) throw new Error("You cannot delete your own account");

    if (await isSuperAdmin(ctx.supabase, data.userId)) {
      await logAudit(ctx.supabase, {
        actor_id: ctx.userId,
        target_user_id: data.userId,
        action: "user.delete",
        status: "blocked",
        reason: SUPER_ADMIN_ERROR,
      });
      throw new Error(SUPER_ADMIN_ERROR);
    }

    const { error: profileError } = await ctx.supabase.from("profiles").update({ status: "inactive" }).eq("id", data.userId);
    if (profileError) throw new Error(profileError.message);
    const { error: roleError } = await ctx.supabase.from("user_roles").delete().eq("user_id", data.userId).neq("role", "super_admin");
    if (roleError) throw new Error(roleError.message);
    await logAudit(ctx.supabase, {
      actor_id: ctx.userId,
      target_user_id: data.userId,
      action: "user.deactivate",
      status: "success",
    });
    return { ok: true };
  });

export const getAdminStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const ctx = await assertAdmin(context as AdminContext);
    const [users, admins, superAdmins, assignments, events, anns, coords, notifs] = await Promise.all([
      ctx.supabase.from("profiles").select("*", { count: "exact", head: true }),
      ctx.supabase.from("user_roles").select("*", { count: "exact", head: true }).eq("role", "admin"),
      ctx.supabase.from("user_roles").select("*", { count: "exact", head: true }).eq("role", "super_admin"),
      ctx.supabase.from("assignments").select("*", { count: "exact", head: true }),
      ctx.supabase.from("events").select("*", { count: "exact", head: true }),
      ctx.supabase.from("announcements").select("*", { count: "exact", head: true }),
      ctx.supabase.from("coordinators").select("*", { count: "exact", head: true }),
      ctx.supabase.from("notifications").select("*", { count: "exact", head: true }),
    ]);
    return {
      users: users.count ?? 0,
      admins: (admins.count ?? 0) + (superAdmins.count ?? 0),
      super_admins: superAdmins.count ?? 0,
      assignments: assignments.count ?? 0,
      events: events.count ?? 0,
      announcements: anns.count ?? 0,
      coordinators: coords.count ?? 0,
      notifications: notifs.count ?? 0,
    };
  });

function primaryRole(roles: string[]): MemberRole | "super_admin" {
  if (roles.includes("super_admin")) return "super_admin";
  if (roles.includes("admin")) return "admin";
  if (roles.includes("faculty")) return "faculty";
  if (roles.includes("coordinator")) return "coordinator";
  return "student";
}

export const listAdminUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const ctx = await assertAdmin(context as AdminContext);

    const [{ data: profiles, error: profilesError }, { data: roles, error: rolesError }] = await Promise.all([
      ctx.supabase.from("profiles").select("*").order("created_at", { ascending: false }),
      ctx.supabase.from("user_roles").select("user_id,role"),
    ]);
    if (profilesError) throw new Error(profilesError.message);
    if (rolesError) throw new Error(rolesError.message);

    return (profiles ?? []).map((profile: Record<string, any>) => {
      const userRoles = roles?.filter((r: { user_id: string; role: string }) => r.user_id === profile.id).map((r: { role: string }) => r.role) ?? [];
      const isSuper = userRoles.includes("super_admin");
      return {
        id: profile.id,
        email: profile.email ?? "",
        full_name: profile.full_name ?? "",
        student_id: profile.student_id ?? "",
        department: profile.department ?? "",
        mobile: profile.mobile ?? "",
        avatar_url: profile.avatar_url ?? "",
        status: profile.status ?? "active",
        created_at: profile.created_at,
        email_confirmed_at: null,
        role: primaryRole(userRoles as string[]),
        roles: userRoles,
        is_admin: userRoles.includes("admin") || isSuper,
        is_super_admin: isSuper,
      };
    });
  });

/** Legacy two-role helper (admin/student) kept for back-compat. */
export const setUserAdminRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ userId: z.string().uuid(), role: z.enum(["admin", "student"]) }).parse(d))
  .handler(async ({ data, context }) => {
    const ctx = await assertAdmin(context as AdminContext);
    if (data.userId === ctx.userId && data.role === "student") throw new Error("You cannot remove your own admin access");

    if (await isSuperAdmin(ctx.supabase, data.userId)) {
      await logAudit(ctx.supabase, {
        actor_id: ctx.userId,
        target_user_id: data.userId,
        action: "role.set_admin",
        new_role: data.role,
        status: "blocked",
        reason: SUPER_ADMIN_ERROR,
      });
      throw new Error(SUPER_ADMIN_ERROR);
    }

    await ctx.supabase.from("user_roles").upsert(
      { user_id: data.userId, role: "student" },
      { onConflict: "user_id,role" },
    );
    if (data.role === "admin") {
      const { error } = await ctx.supabase.from("user_roles").upsert(
        { user_id: data.userId, role: "admin" },
        { onConflict: "user_id,role" },
      );
      if (error) throw new Error(error.message);
    } else {
      const { error } = await ctx.supabase.from("user_roles").delete().eq("user_id", data.userId).eq("role", "admin");
      if (error) throw new Error(error.message);
    }

    await logAudit(ctx.supabase, {
      actor_id: ctx.userId,
      target_user_id: data.userId,
      action: "role.set_admin",
      new_role: data.role,
      status: "success",
    });
    return { ok: true };
  });

/** Set a member's primary role. Super admin is never assignable through this API. */
export const setMemberRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ userId: z.string().uuid(), role: z.enum(MEMBER_ROLES) }).parse(d))
  .handler(async ({ data, context }) => {
    const ctx = await assertAdmin(context as AdminContext);
    if (data.userId === ctx.userId && data.role !== "admin") throw new Error("You cannot remove your own admin access");

    // Block ANY modification to a super admin's roles through the app.
    if (await isSuperAdmin(ctx.supabase, data.userId)) {
      await logAudit(ctx.supabase, {
        actor_id: ctx.userId,
        target_user_id: data.userId,
        action: "role.set_primary",
        new_role: data.role,
        status: "blocked",
        reason: SUPER_ADMIN_ERROR,
      });
      throw new Error(SUPER_ADMIN_ERROR);
    }

    // Fetch previous primary role for the audit trail.
    const prevRoles = await loadRoles(ctx.supabase, data.userId);
    const prev = primaryRole(prevRoles);

    // Replace all non-super role rows with the new primary role.
    // The trigger already blocks any accidental super_admin deletion.
    const { error: delError } = await ctx.supabase
      .from("user_roles")
      .delete()
      .eq("user_id", data.userId)
      .neq("role", "super_admin");
    if (delError) throw new Error(delError.message);

    const { error: insError } = await ctx.supabase
      .from("user_roles")
      .insert({ user_id: data.userId, role: data.role });
    if (insError) throw new Error(insError.message);

    await logAudit(ctx.supabase, {
      actor_id: ctx.userId,
      target_user_id: data.userId,
      action: "role.set_primary",
      old_role: prev,
      new_role: data.role,
      status: "success",
    });
    return { ok: true };
  });

export const setMemberStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    userId: z.string().uuid(),
    status: z.enum(["active", "inactive", "pending", "rejected", "suspended"]),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const ctx = await assertAdmin(context as AdminContext);
    if (data.userId === ctx.userId && data.status !== "active") {
      throw new Error("You cannot change your own status");
    }

    if (await isSuperAdmin(ctx.supabase, data.userId)) {
      await logAudit(ctx.supabase, {
        actor_id: ctx.userId,
        target_user_id: data.userId,
        action: "profile.status_change",
        status: "blocked",
        reason: SUPER_ADMIN_ERROR,
        metadata: { new_status: data.status },
      });
      throw new Error(SUPER_ADMIN_ERROR);
    }

    const patch: { status: string; approved_by?: string; approved_at?: string } = { status: data.status };
    if (data.status === "active") {
      patch.approved_by = ctx.userId;
      patch.approved_at = new Date().toISOString();
    }
    const { error } = await ctx.supabase.from("profiles").update(patch as any).eq("id", data.userId);
    if (error) throw new Error(error.message);

    await logAudit(ctx.supabase, {
      actor_id: ctx.userId,
      target_user_id: data.userId,
      action: "profile.status_change",
      status: "success",
      metadata: { new_status: data.status },
    });
    return { ok: true };
  });

/** Generate a short-lived signed URL so admins can download any user's submission. */
export const getAdminFileUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ path: z.string().min(1) }).parse(d))
  .handler(async ({ data, context }) => {
    const ctx = await assertAdmin(context as AdminContext);
    const key = data.path.includes("cic-files/") ? data.path.split("cic-files/").pop()! : data.path;
    const { data: signed, error } = await ctx.supabase
      .storage
      .from("cic-files")
      .createSignedUrl(key, 60 * 10);
    if (error) throw new Error(error.message);
    return { url: signed.signedUrl };
  });
