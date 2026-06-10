import { supabase } from "@/integrations/supabase/client";

/**
 * Log a failed authentication attempt. Best-effort — never throws.
 * Inserts directly via the publishable key (anon insert policy on public.auth_logs).
 */
export async function logAuthError(action: string, email: string, error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  if (import.meta.env.DEV) {
    console.error(`[auth:${action}] ${email || "<no-email>"} →`, message);
  }
  try {
    await supabase.from("auth_logs").insert({
      action,
      user_email: email || null,
      error_message: message.slice(0, 500),
    });
  } catch {
    /* swallow — logging must never break the UI */
  }
}

/**
 * Translate raw Supabase auth errors into friendly user-facing messages.
 */
export function friendlyAuthError(action: "signin" | "signup" | "reset", err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err ?? "Unexpected error");
  const m = raw.toLowerCase();
  if (m.includes("invalid login")) return "Incorrect email or password.";
  if (m.includes("email not confirmed")) return "Please verify your email before signing in. Check your inbox for the confirmation link.";
  if (m.includes("user already registered") || m.includes("already been registered")) return "This email is already registered. Try signing in instead.";
  if (m.includes("password should be") || m.includes("weak password")) return "Password is too weak. Use at least 8 characters with a mix of letters and numbers.";
  if (m.includes("rate limit")) return "Too many attempts. Please wait a moment and try again.";
  if (m.includes("invalid email")) return "Please enter a valid email address.";
  if (m.includes("network") || m.includes("fetch")) return "Network connection failed. Check your internet and try again.";
  if (m.includes("user not found")) return "No account found with that email.";
  if (action === "signin") return raw || "Sign in failed. Please try again.";
  if (action === "signup") return raw || "Could not create account. Please try again.";
  return raw || "Could not send reset email. Please try again.";
}
