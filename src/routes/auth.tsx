import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { ArrowLeft, Loader2, Mail, Lock, User, Hash } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { ensureMemberAccount } from "@/lib/account.functions";
import { toast } from "sonner";
import cicLogo from "@/assets/cic-logo.png.asset.json";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
  head: () => ({
    meta: [
      { title: "Sign in — Civil Innovation Club" },
      { name: "description", content: "Sign in or create your CIC member account." },
    ],
  }),
});

function AuthPage() {
  const navigate = useNavigate();
  const ensureAccount = useServerFn(ensureMemberAccount);
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [studentId, setStudentId] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard" });
    });
  }, [navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/dashboard`,
            data: { full_name: fullName, student_id: studentId },
          },
        });
        if (error) throw error;
        toast.success("Account created. You can sign in now.");
        setMode("signin");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
        await ensureAccount({});
        toast.success("Welcome back!");
        navigate({ to: "/dashboard" });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    setOauthLoading(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: `${window.location.origin}/dashboard`,
    });
    if (result.error) {
      toast.error("Google sign-in failed");
      setOauthLoading(false);
      return;
    }
    if (result.redirected) return;
    await ensureAccount({});
    navigate({ to: "/dashboard" });
  }

  return (
    <main className="min-h-screen bg-hero relative overflow-hidden flex items-center justify-center px-4 py-12">
      <div
        className="absolute inset-0 opacity-[0.06] pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)",
          backgroundSize: "64px 64px",
          maskImage: "radial-gradient(ellipse at center, black 30%, transparent 75%)",
        }}
      />
      <Link
        to="/"
        className="absolute top-6 left-6 inline-flex items-center gap-2 text-sm text-white/70 hover:text-gold transition"
      >
        <ArrowLeft size={16} /> Back to home
      </Link>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative w-full max-w-md"
      >
        <div className="flex flex-col items-center mb-8">
          <div className="h-16 w-16 rounded-full bg-white p-2 shadow-gold ring-1 ring-gold/40">
            <img src={cicLogo.url} alt="CIC" className="h-full w-full object-contain" />
          </div>
          <h1 className="mt-5 font-display text-3xl font-bold text-white text-center">
            {mode === "signin" ? "Welcome back" : "Join CIC"}
          </h1>
          <p className="mt-2 text-sm text-white/60 text-center">
            {mode === "signin" ? "Sign in to your member account" : "Create your member account"}
          </p>
        </div>

        <div className="rounded-2xl bg-white/95 backdrop-blur p-8 shadow-elegant">
          <button
            type="button"
            onClick={handleGoogle}
            disabled={oauthLoading}
            className="w-full inline-flex items-center justify-center gap-3 rounded-lg border border-border bg-white px-4 py-3 text-sm font-semibold text-foreground hover:bg-muted transition disabled:opacity-50"
          >
            {oauthLoading ? <Loader2 className="animate-spin" size={18} /> : <GoogleIcon />}
            Continue with Google
          </button>

          <div className="flex items-center gap-3 my-6">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs uppercase tracking-wider text-muted-foreground">or</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "signup" && (
              <>
                <AuthField
                  icon={<User size={16} />}
                  label="Full Name"
                  value={fullName}
                  onChange={setFullName}
                  required
                />
                <AuthField
                  icon={<Hash size={16} />}
                  label="Student ID"
                  value={studentId}
                  onChange={setStudentId}
                  placeholder="20231234"
                  required
                />
              </>
            )}
            <AuthField
              icon={<Mail size={16} />}
              label="Email"
              type="email"
              value={email}
              onChange={setEmail}
              required
            />
            <AuthField
              icon={<Lock size={16} />}
              label="Password"
              type="password"
              value={password}
              onChange={setPassword}
              required
            />

            <button
              type="submit"
              disabled={loading}
              className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-navy px-4 py-3 text-sm font-semibold text-white hover:bg-navy-deep transition disabled:opacity-50"
            >
              {loading && <Loader2 className="animate-spin" size={16} />}
              {mode === "signin" ? "Sign in" : "Create account"}
            </button>
            {mode === "signin" && (
              <button
                type="button"
                onClick={async () => {
                  if (!email) return toast.error("Enter your email above first");
                  const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
                    redirectTo: `${window.location.origin}/reset-password`,
                  });
                  if (error) toast.error(error.message);
                  else toast.success("Password reset link sent to your email");
                }}
                className="w-full text-xs text-muted-foreground hover:text-navy transition"
              >
                Forgot your password?
              </button>
            )}
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            {mode === "signin" ? "New to CIC? " : "Already a member? "}
            <button
              type="button"
              onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
              className="font-semibold text-navy hover:text-gold transition"
            >
              {mode === "signin" ? "Create an account" : "Sign in"}
            </button>
          </p>
        </div>
      </motion.div>
    </main>
  );
}

function AuthField({
  icon,
  label,
  value,
  onChange,
  type = "text",
  required,
  placeholder,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <div className="mt-1.5 relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">{icon}</span>
        <input
          type={type}
          required={required}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-lg border border-border bg-background pl-10 pr-3 py-2.5 text-sm focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/30 transition"
        />
      </div>
    </label>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.49h4.84a4.14 4.14 0 01-1.8 2.72v2.26h2.92a8.78 8.78 0 002.68-6.63z"/>
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.32A9 9 0 009 18z"/>
      <path fill="#FBBC05" d="M3.97 10.72A5.41 5.41 0 013.68 9c0-.6.1-1.18.29-1.72V4.96H.96a9 9 0 000 8.08l3.01-2.32z"/>
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.46 3.44 1.35l2.58-2.58A9 9 0 00.96 4.96l3.01 2.32C4.68 5.16 6.66 3.58 9 3.58z"/>
    </svg>
  );
}
