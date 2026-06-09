import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Loader2, Lock } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import cicLogo from "@/assets/cic-logo.png.asset.json";

export const Route = createFileRoute("/reset-password")({
  component: ResetPasswordPage,
  head: () => ({
    meta: [
      { title: "Reset password — Civil Innovation Club" },
      { name: "description", content: "Set a new password for your CIC member account." },
    ],
  }),
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("code");
    if (!code) {
      setReady(true);
      return;
    }
    supabase.auth.exchangeCodeForSession(code)
      .then(({ error }) => {
        if (error) toast.error(error.message);
      })
      .finally(() => setReady(true));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) return toast.error("Password must be at least 8 characters");
    if (password !== confirmPassword) return toast.error("Passwords do not match");

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success("Password updated. Please sign in again.");
      await supabase.auth.signOut();
      navigate({ to: "/auth", replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update password");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-hero relative overflow-hidden flex items-center justify-center px-4 py-12">
      <Link to="/auth" className="absolute top-6 left-6 inline-flex items-center gap-2 text-sm text-white/70 hover:text-gold transition">
        <ArrowLeft size={16} /> Back to sign in
      </Link>
      <section className="relative w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <div className="h-16 w-16 rounded-full bg-white p-2 shadow-gold ring-1 ring-gold/40">
            <img src={cicLogo.url} alt="CIC" className="h-full w-full object-contain" />
          </div>
          <h1 className="mt-5 font-display text-3xl font-bold text-white text-center">Reset password</h1>
          <p className="mt-2 text-sm text-white/60 text-center">Choose a new password for your member account</p>
        </div>
        <form onSubmit={handleSubmit} className="rounded-2xl bg-white/95 backdrop-blur p-8 shadow-elegant space-y-4">
          <PasswordField label="New password" value={password} onChange={setPassword} />
          <PasswordField label="Confirm password" value={confirmPassword} onChange={setConfirmPassword} />
          <button disabled={loading || !ready} className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-navy px-4 py-3 text-sm font-semibold text-white hover:bg-navy-deep transition disabled:opacity-50">
            {(loading || !ready) && <Loader2 className="animate-spin" size={16} />}
            {ready ? "Update password" : "Preparing reset…"}
          </button>
        </form>
      </section>
    </main>
  );
}

function PasswordField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
      <div className="mt-1.5 relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"><Lock size={16} /></span>
        <input
          type="password"
          required
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-lg border border-border bg-background pl-10 pr-3 py-2.5 text-sm focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/30 transition"
        />
      </div>
    </label>
  );
}