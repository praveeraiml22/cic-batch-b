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

    // Remove the student's assignment folder (and any nested folders + their files).
    const { data: roots, error: rootsError } = await supabaseAdmin
      .from("document_folders")
      .select("id")
      .eq("owner_id", data.userId)
      .eq("kind", "assignment");
    if (rootsError) throw new Error(rootsError.message);
    let frontier = (roots ?? []).map((r) => r.id);
    const allIds: string[] = [...frontier];
    while (frontier.length) {
      const { data: kids, error: kidsError } = await supabaseAdmin
        .from("document_folders")
        .select("id")
        .in("parent_id", frontier);
      if (kidsError) throw new Error(kidsError.message);
      frontier = (kids ?? []).map((k) => k.id);
      allIds.push(...frontier);
    }
    if (allIds.length) {
      const { data: docs, error: docsError } = await supabaseAdmin
        .from("documents")
        .select("id, file_url")
        .in("folder_id", allIds);
      if (docsError) throw new Error(docsError.message);
      const all = (docs ?? []).map((d) => d.file_url).filter((p) => p && !p.startsWith("http"));
      const b2Paths = all.filter((p) => p.startsWith("b2:"));
      const paths = all.filter((p) => !p.startsWith("b2:"));
      if (b2Paths.length) {
        const b2 = await import("@/lib/b2.server");
        for (const p of b2Paths) {
          if (!(await b2.canDelete(supabaseAdmin as any, data.userId, p))) {
            throw new Error("Could not verify access to a file in the student's assignment folder");
          }
          await b2.b2Delete(b2.toObjectKey(p));
        }
      }
      if (paths.length) {
        const { error } = await supabaseAdmin.storage.from("cic-files").remove(paths);
        if (error) throw new Error(error.message);
      }
      if (docs?.length) {
        const { error } = await supabaseAdmin.from("documents").delete().in("folder_id", allIds);
        if (error) throw new Error(error.message);
      }
      for (const id of allIds.reverse()) {
        const { error } = await supabaseAdmin.from("document_folders").delete().eq("id", id);
        if (error) throw new Error(error.message);
      }
    }

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

    const fetchAll = () => Promise.all([
      supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
      supabaseAdmin.from("profiles").select("*"),
      supabaseAdmin.from("user_roles").select("user_id,role"),
    ]);
    let [{ data: usersData, error: usersError }, { data: profiles, error: profilesError }, { data: roles, error: rolesError }] = await fetchAll();
    if (usersError) throw new Error(usersError.message);
    if (profilesError) throw new Error(profilesError.message);
    if (rolesError) throw new Error(rolesError.message);

    // Verified users who never completed a sign-in have no profile yet —
    // create it now (status defaults to "pending") so they reach approval.
    const missing = usersData.users.filter(
      (u) => u.email_confirmed_at && !profiles?.some((p) => p.id === u.id),
    );
    if (missing.length) {
      const { loadOrCreateAccount } = await import("./account.functions");
      for (const u of missing) {
        try { await loadOrCreateAccount(u.id); } catch (e) { console.error("[admin] profile sync failed", e); }
      }
      [{ data: usersData, error: usersError }, { data: profiles, error: profilesError }, { data: roles, error: rolesError }] = await fetchAll();
      if (usersError || profilesError || rolesError) throw new Error("Failed to reload members");
    }
    // Unverified sign-ups are not accounts yet; hide them.
    usersData = { ...usersData, users: usersData.users.filter((u) => u.email_confirmed_at) } as typeof usersData;

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
  .inputValidator((d) => z.object({
    userId: z.string().uuid(),
    status: z.enum(["active", "inactive", "pending", "rejected", "suspended"]),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context as { userId: string };
    const supabaseAdmin = await assertAdmin(userId);
    if (data.userId === userId && data.status !== "active") {
      throw new Error("You cannot change your own status");
    }
    const patch: { status: string; approved_by?: string; approved_at?: string } = { status: data.status };
    if (data.status === "active") {
      patch.approved_by = userId;
      patch.approved_at = new Date().toISOString();
    }
    const { error } = await supabaseAdmin.from("profiles").update(patch as any).eq("id", data.userId);
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
    if (data.path.startsWith("b2:")) {
      const b2 = await import("@/lib/b2.server");
      return { url: await b2.b2SignedUrl(b2.toObjectKey(data.path)) };
    }
    const key = data.path.includes("cic-files/") ? data.path.split("cic-files/").pop()! : data.path;
    const { data: signed, error } = await supabaseAdmin
      .storage
      .from("cic-files")
      .createSignedUrl(key, 60 * 10);
    if (error) throw new Error(error.message);
    return { url: signed.signedUrl };
  });
