import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { linkPushUser, unlinkPushUser } from "@/lib/onesignal";

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      setLoading(false);
      if (s?.user) void linkPushUser(s.user.id);
      else if (_e === "SIGNED_OUT") void unlinkPushUser();
    });
    supabase.auth.getUser()
      .then(({ data }) => {
        setUser(data.user ?? null);
        if (data.user) void linkPushUser(data.user.id);
        return supabase.auth.getSession();
      })
      .then(({ data }) => setSession(data.session ?? null))
      .finally(() => setLoading(false));
    return () => sub.subscription.unsubscribe();
  }, []);


  return { session, user, loading };
}
