import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      setLoading(false);
    });
    supabase.auth.getUser()
      .then(({ data }) => {
        setUser(data.user ?? null);
        return supabase.auth.getSession();
      })
      .then(({ data }) => setSession(data.session ?? null))
      .finally(() => setLoading(false));
    return () => sub.subscription.unsubscribe();
  }, []);

  return { session, user, loading };
}
