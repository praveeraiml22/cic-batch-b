import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const MEMBER_ROLES = ["admin", "faculty", "coordinator", "student"] as const;
type MemberRole = (typeof MEMBER_ROLES)[number];

async function assertAdmin(userId: string) {
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

export const deleteUserAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ userId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context as { userId: string };
    const supabaseAdmin = await assertAdmin(userId);
    if (data.userId === userId) throw new Error("You cannot delete your own account");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getAdminStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context as { userId: string };
    const supabaseAdmin = await assertAdmin(userId);
    const [users, admins, assignments, events, anns, coords, notifs] = await Promise.all([
      supabaseAdmin.from("profiles").select("*", { count: "exact", head: true }),
      supabaseAdmin.from("user_roles").select("*", { count: "exact", head: true }).eq("role", "admin"),
      supabaseAdmin.from("assignments").select("*", { count: "exact", head: true }),
      supabaseAdmin.from("events").select("*", { count: "exact", head: true }),
      supabaseAdmin.from("announcements").select("*", { count: "exact", head: true }),
      supabaseAdmin.from("coordinators").select("*", { count: "exact", head: true }),
      supabaseAdmin.from("notifications").select("*", { count: "exact", head: true }),
    ]);
    return {
      users: users.count ?? 0,
      admins: admins.count ?? 0,
      assignments: assignments.count ?? 0,
      events: events.count ?? 0,
      announcements: anns.count ?? 0,
      coordinators: coords.count ?? 0,
      notifications: notifs.count ?? 0,
    };
  });

function primaryRole(roles: string[]): MemberRole {
  if (roles.includes("admin")) return "admin";
  if (roles.includes("faculty")) return "faculty";
  if (roles.includes("coordinator")) return "coordinator";
  return "student";
}

export const listAdminUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context as { userId: string };
    const supabaseAdmin = await assertAdmin(userId);

    const [{ data: usersData, error: usersError }, { data: profiles, error: profilesError }, { data: roles, error: rolesError }] = await Promise.all([
      supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
      supabaseAdmin.from("profiles").select("*"),
      supabaseAdmin.from("user_roles").select("user_id,role"),
    ]);
    if (usersError) throw new Error(usersError.message);
    if (profilesError) throw new Error(profilesError.message);
    if (rolesError) throw new Error(rolesError.message);

    return usersData.users.map((authUser) => {
      const profile = profiles?.find((p) => p.id === authUser.id) as Record<string, any> | undefined;
      const userRoles = roles?.filter((r) => r.user_id === authUser.id).map((r) => r.role) ?? [];
      return {
        id: authUser.id,
        email: authUser.email ?? profile?.email ?? "",
        full_name: profile?.full_name ?? authUser.user_metadata?.full_name ?? authUser.user_metadata?.name ?? "",
        student_id: profile?.student_id ?? authUser.user_metadata?.student_id ?? "",
        department: profile?.department ?? "",
        mobile: profile?.mobile ?? "",
        avatar_url: profile?.avatar_url ?? "",
        status: (profile?.status as string) ?? "active",
        created_at: authUser.created_at,
        email_confirmed_at: authUser.email_confirmed_at,
        role: primaryRole(userRoles as string[]),
        roles: userRoles,
        is_admin: userRoles.includes("admin"),
      };
    });
  });

/** Legacy two-role helper (admin/student) kept for back-compat. */
export const setUserAdminRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ userId: z.string().uuid(), role: z.enum(["admin", "student"]) }).parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context as { userId: string };
    const supabaseAdmin = await assertAdmin(userId);
    if (data.userId === userId && data.role === "student") throw new Error("You cannot remove your own admin access");

    await supabaseAdmin.from("user_roles").upsert(
      { user_id: data.userId, role: "student" },
      { onConflict: "user_id,role" },
    );
    if (data.role === "admin") {
      const { error } = await supabaseAdmin.from("user_roles").upsert(
        { user_id: data.userId, role: "admin" },
        { onConflict: "user_id,role" },
      );
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabaseAdmin.from("user_roles").delete().eq("user_id", data.userId).eq("role", "admin");
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

/** Set a member's primary role to one of admin/faculty/coordinator/student. */
export const setMemberRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ userId: z.string().uuid(), role: z.enum(MEMBER_ROLES) }).parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context as { userId: string };
    const supabaseAdmin = await assertAdmin(userId);
    if (data.userId === userId && data.role !== "admin") throw new Error("You cannot remove your own admin access");

    // Replace all existing role rows with the single new primary role.
    const { error: delError } = await supabaseAdmin.from("user_roles").delete().eq("user_id", data.userId);
    if (delError) throw new Error(delError.message);

    const { error: insError } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: data.userId, role: data.role });
    if (insError) throw new Error(insError.message);

    return { ok: true };
  });

export const setMemberStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ userId: z.string().uuid(), status: z.enum(["active", "inactive"]) }).parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context as { userId: string };
    const supabaseAdmin = await assertAdmin(userId);
    if (data.userId === userId && data.status === "inactive") throw new Error("You cannot deactivate your own account");
    const { error } = await supabaseAdmin.from("profiles").update({ status: data.status }).eq("id", data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Generate a short-lived signed URL so admins can download any user's submission. */
export const getAdminFileUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ path: z.string().min(1) }).parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context as { userId: string };
    const supabaseAdmin = await assertAdmin(userId);
    const key = data.path.includes("cic-files/") ? data.path.split("cic-files/").pop()! : data.path;
    const { data: signed, error } = await supabaseAdmin
      .storage
      .from("cic-files")
      .createSignedUrl(key, 60 * 10);
    if (error) throw new Error(error.message);
    return { url: signed.signedUrl };
  });
