import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: admin only");
}

export const deleteUserAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ userId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertAdmin(supabase, userId);
    if (data.userId === userId) throw new Error("Cannot delete your own account");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getAdminStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as any;
    await assertAdmin(supabase, userId);
    const [users, admins, assignments, events, anns, coords, notifs] = await Promise.all([
      supabase.from("profiles").select("*", { count: "exact", head: true }),
      supabase.from("user_roles").select("*", { count: "exact", head: true }).eq("role", "admin"),
      supabase.from("assignments").select("*", { count: "exact", head: true }),
      supabase.from("events").select("*", { count: "exact", head: true }),
      supabase.from("announcements").select("*", { count: "exact", head: true }),
      supabase.from("coordinators").select("*", { count: "exact", head: true }),
      supabase.from("notifications").select("*", { count: "exact", head: true }),
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

export const listAdminUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as any;
    await assertAdmin(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [{ data: usersData, error: usersError }, { data: profiles, error: profilesError }, { data: roles, error: rolesError }] = await Promise.all([
      supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
      supabaseAdmin.from("profiles").select("*"),
      supabaseAdmin.from("user_roles").select("user_id,role"),
    ]);

    if (usersError) throw new Error(usersError.message);
    if (profilesError) throw new Error(profilesError.message);
    if (rolesError) throw new Error(rolesError.message);

    return usersData.users.map((authUser) => {
      const profile = profiles?.find((p: any) => p.id === authUser.id);
      const userRoles = roles?.filter((r: any) => r.user_id === authUser.id).map((r: any) => r.role) ?? [];
      return {
        id: authUser.id,
        email: authUser.email ?? profile?.email ?? "",
        full_name: profile?.full_name ?? authUser.user_metadata?.full_name ?? authUser.user_metadata?.name ?? "",
        student_id: profile?.student_id ?? authUser.user_metadata?.student_id ?? "",
        created_at: authUser.created_at,
        email_confirmed_at: authUser.email_confirmed_at,
        is_admin: userRoles.includes("admin"),
      };
    });
  });

export const setUserAdminRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ userId: z.string().uuid(), role: z.enum(["admin", "student"]) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertAdmin(supabase, userId);
    if (data.userId === userId && data.role === "student") throw new Error("Cannot remove your own admin access");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
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
