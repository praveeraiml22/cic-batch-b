import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const studentSignInSchema = z.object({
  studentId: z.string().trim().min(1, "Student ID is required").max(50),
  password: z.string().min(1, "Password is required"),
});

/**
 * Sign in with Student ID + password.
 * The Student ID is resolved to the account email entirely server-side so
 * member emails are never exposed to the browser. Returns the session tokens
 * so the client can attach them via supabase.auth.setSession().
 */
export const signInWithStudentId = createServerFn({ method: "POST" })
  .inputValidator((data) => studentSignInSchema.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("id, email")
      .eq("student_id", data.studentId)
      .maybeSingle();

    if (profileError || !profile?.email) {
      return { ok: false as const, error: "No account found with that Student ID." };
    }

    const { createClient } = await import("@supabase/supabase-js");
    const anon = createClient(
      process.env["SUPABASE_URL"]!,
      process.env["SUPABASE_PUBLISHABLE_KEY"]!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );

    const { data: authData, error: authError } = await anon.auth.signInWithPassword({
      email: profile.email,
      password: data.password,
    });

    if (authError || !authData.session) {
      return { ok: false as const, error: "Incorrect Student ID or password." };
    }

    return {
      ok: true as const,
      session: {
        access_token: authData.session.access_token,
        refresh_token: authData.session.refresh_token,
      },
    };
  });
