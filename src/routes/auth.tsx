import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { forwardRef, useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { ArrowLeft, Loader2, Mail, Lock, User, Hash } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";

import { ensureMemberAccount, getCurrentAccount } from "@/lib/account.functions";
import { signInWithStudentId } from "@/lib/auth.functions";
import { toast } from "sonner";
import { friendlyAuthError, logAuthError } from "@/lib/auth-log";
const cicLogo = { url: "/cic-logo.png" };

export const Route = createFileRoute("/auth")({
  component: AuthPage,
  head: () => ({
    meta: [
      { title: "Sign in — Civil Innovation Club" },
      { name: "description", content: "Sign in or create your CIC member account." },
    ],
  }),
});

const signInSchema = z.object({
  email: z.string().trim().min(1, "Email is required").email("Please enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

const studentIdSignInSchema = z.object({
  studentId: z.string().trim().min(1, "Student ID is required"),
  password: z.string().min(1, "Password is required"),
});

const signUpSchema = z.object({
  fullName: z.string().trim().min(2, "Please enter your full name"),
  studentId: z.string().trim().min(1, "Student ID is required"),
  email: z.string().trim().min(1, "Email is required").email("Please enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string(),
}).refine((v) => v.password === v.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

type FieldErrors = Partial<Record<"email" | "password" | "confirmPassword" | "fullName" | "studentId", string>>;

function AuthPage() {
  const navigate = useNavigate();
  const ensureAccount = useServerFn(ensureMemberAccount);
  const fetchAccount = useServerFn(getCurrentAccount);
  const signInStudentId = useServerFn(signInWithStudentId);
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [signInMethod, setSignInMethod] = useState<"email" | "studentId">("studentId");
  const [loading, setLoading] = useState(false);
  
  const [resetLoading, setResetLoading] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [studentId, setStudentId] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [announcement, setAnnouncement] = useState("");

  const refs = {
    fullName: useRef<HTMLInputElement>(null),
    studentId: useRef<HTMLInputElement>(null),
    email: useRef<HTMLInputElement>(null),
    password: useRef<HTMLInputElement>(null),
    confirmPassword: useRef<HTMLInputElement>(null),
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard" });
    });
  }, [navigate]);

  function focusFirstError(errs: FieldErrors) {
    const order: (keyof typeof refs)[] = ["fullName", "studentId", "email", "password", "confirmPassword"];
    for (const key of order) {
      if (errs[key]) {
        refs[key].current?.focus();
        return;
      }
    }
  }

  async function redirectByRole() {
    try {
      const acct = await fetchAccount({});
      navigate({ to: acct.isAdmin ? "/admin" : "/dashboard" });
    } catch {
      navigate({ to: "/dashboard" });
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    const normalizedEmail = email.trim().toLowerCase();

    if (mode === "signup") {
      const parsed = signUpSchema.safeParse({ fullName, studentId, email: normalizedEmail, password, confirmPassword });
      if (!parsed.success) {
        const fieldErrs: FieldErrors = {};
        for (const issue of parsed.error.issues) {
          const k = issue.path[0] as keyof FieldErrors;
          if (!fieldErrs[k]) fieldErrs[k] = issue.message;
        }
        setErrors(fieldErrs);
        setAnnouncement(Object.values(fieldErrs).join(". "));
        focusFirstError(fieldErrs);
        return;
      }
    } else if (signInMethod === "studentId") {
      const parsed = studentIdSignInSchema.safeParse({ studentId: studentId.trim(), password });
      if (!parsed.success) {
        const fieldErrs: FieldErrors = {};
        for (const issue of parsed.error.issues) {
          const k = issue.path[0] === "studentId" ? "studentId" : "password";
          if (!fieldErrs[k]) fieldErrs[k] = issue.message;
        }
        setErrors(fieldErrs);
        setAnnouncement(Object.values(fieldErrs).join(". "));
        focusFirstError(fieldErrs);
        return;
      }
    } else {
      const parsed = signInSchema.safeParse({ email: normalizedEmail, password });
      if (!parsed.success) {
        const fieldErrs: FieldErrors = {};
        for (const issue of parsed.error.issues) {
          const k = issue.path[0] as keyof FieldErrors;
          if (!fieldErrs[k]) fieldErrs[k] = issue.message;
        }
        setErrors(fieldErrs);
        setAnnouncement(Object.values(fieldErrs).join(". "));
        focusFirstError(fieldErrs);
        return;
      }
    }

    setLoading(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email: normalizedEmail,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/dashboard`,
            data: { full_name: fullName.trim(), student_id: studentId.trim() },
          },
        });
        if (error) throw error;
        if (data.session) {
          await ensureAccount({});
          toast.success("Account created successfully.");
          setAnnouncement("Account created successfully.");
          await redirectByRole();
        } else {
          toast.success("Account created successfully. Please check your email to verify your account.");
          setAnnouncement("Account created. Please verify your email.");
          setMode("signin");
        }
      } else if (signInMethod === "studentId") {
        const result = await signInStudentId({ data: { studentId: studentId.trim(), password } });
        if (!result.ok) throw new Error(result.error);
        const { error: sessionError } = await supabase.auth.setSession(result.session);
        if (sessionError) throw sessionError;
        await ensureAccount({});
        toast.success("Signed in successfully.");
        setAnnouncement("Signed in successfully.");
        await redirectByRole();
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password });
        if (error) throw error;
        await ensureAccount({});
        toast.success("Signed in successfully.");
        setAnnouncement("Signed in successfully.");
        await redirectByRole();
      }
    } catch (err) {
      const msg = friendlyAuthError(mode === "signup" ? "signup" : "signin", err);
      toast.error(msg);
      setAnnouncement(msg);
      void logAuthError(mode, normalizedEmail, err);
    } finally {
      setLoading(false);
    }
  }


  async function handleForgot() {
    const normalizedEmail = email.trim().toLowerCase();
    const parsed = z.string().email().safeParse(normalizedEmail);
    if (!parsed.success) {
      const msg = "Enter a valid email above first to receive a reset link.";
      toast.error(msg);
      setAnnouncement(msg);
      setErrors((prev) => ({ ...prev, email: "Please enter a valid email address" }));
      refs.email.current?.focus();
      return;
    }
    setResetLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      toast.success("Password reset link has been sent to your email.");
      setAnnouncement("Password reset link has been sent to your email.");
    } catch (err) {
      const msg = friendlyAuthError("reset", err);
      toast.error(msg);
      setAnnouncement(msg);
      void logAuthError("reset", normalizedEmail, err);
    } finally {
      setResetLoading(false);
    }
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

          {/* aria-live region for screen readers */}
          <div className="sr-only" role="status" aria-live="polite">{announcement}</div>

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            {mode === "signup" && (
              <>
                <AuthField
                  ref={refs.fullName}
                  icon={<User size={16} />}
                  label="Full Name"
                  value={fullName}
                  onChange={setFullName}
                  error={errors.fullName}
                  required
                />
                <AuthField
                  ref={refs.studentId}
                  icon={<Hash size={16} />}
                  label="Student ID"
                  value={studentId}
                  onChange={setStudentId}
                  placeholder="20231234"
                  error={errors.studentId}
                  required
                />
              </>
            )}
            {mode === "signin" && signInMethod === "studentId" ? (
              <AuthField
                ref={refs.studentId}
                icon={<Hash size={16} />}
                label="Student ID"
                value={studentId}
                onChange={setStudentId}
                placeholder="20231234"
                error={errors.studentId}
                required
              />
            ) : (
              <AuthField
                ref={refs.email}
                icon={<Mail size={16} />}
                label="Email"
                type="email"
                value={email}
                onChange={setEmail}
                error={errors.email}
                required
              />
            )}
            {mode === "signin" && (
              <div className="flex items-center gap-3">
                <span className="h-px flex-1 bg-border" />
                <span className="text-xs text-muted-foreground">or</span>
                <span className="h-px flex-1 bg-border" />
              </div>
            )}
            {mode === "signin" && (
              <button
                type="button"
                onClick={() => {
                  setSignInMethod(signInMethod === "email" ? "studentId" : "email");
                  setErrors({});
                }}
                className="w-full text-xs font-medium text-navy hover:text-gold transition"
              >
                {signInMethod === "email"
                  ? "Sign in with Student ID instead"
                  : "Sign in with Email instead"}
              </button>
            )}
            <AuthField
              ref={refs.password}
              icon={<Lock size={16} />}
              label="Password"
              type="password"
              value={password}
              onChange={setPassword}
              error={errors.password}
              hint={mode === "signup" ? "Minimum 8 characters" : undefined}
              required
            />
            {mode === "signup" && (
              <AuthField
                ref={refs.confirmPassword}
                icon={<Lock size={16} />}
                label="Confirm Password"
                type="password"
                value={confirmPassword}
                onChange={setConfirmPassword}
                error={errors.confirmPassword}
                required
              />
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-navy px-4 py-3 text-sm font-semibold text-white hover:bg-navy-deep transition disabled:opacity-50"
            >
              {loading && <Loader2 className="animate-spin" size={16} />}
              {loading
                ? (mode === "signin" ? "Signing in..." : "Creating account...")
                : (mode === "signin" ? "Sign in" : "Create account")}
            </button>
            {mode === "signin" && (
              <button
                type="button"
                onClick={handleForgot}
                disabled={resetLoading || loading}
                className="w-full text-xs text-muted-foreground hover:text-navy transition disabled:opacity-50"
              >
                {resetLoading ? "Sending reset link…" : "Forgot your password?"}
              </button>
            )}
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            {mode === "signin" ? "New to CIC? " : "Already a member? "}
            <button
              type="button"
              onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setErrors({}); }}
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

type AuthFieldProps = {
  icon: React.ReactNode;
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
  placeholder?: string;
  error?: string;
  hint?: string;
};

const AuthField = forwardRef<HTMLInputElement, AuthFieldProps>(function AuthField(
  { icon, label, value, onChange, type = "text", required, placeholder, error, hint },
  ref,
) {
  const errId = error ? `${label.replace(/\s+/g, "-").toLowerCase()}-err` : undefined;
  return (
    <label className="block">
      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <div className="mt-1.5 relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">{icon}</span>
        <input
          ref={ref}
          type={type}
          required={required}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={!!error}
          aria-describedby={errId}
          className={`w-full rounded-lg border bg-background pl-10 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 transition ${
            error
              ? "border-rose-400 focus:border-rose-500 focus:ring-rose-200"
              : "border-border focus:border-gold focus:ring-gold/30"
          }`}
        />
      </div>
      {error ? (
        <p id={errId} className="mt-1 text-xs text-rose-600">{error}</p>
      ) : hint ? (
        <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </label>
  );
});

