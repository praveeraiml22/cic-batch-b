import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { getCurrentAccount } from "@/lib/account.functions";

export function useProfile(userId?: string) {
  return useQuery({
    queryKey: ["profile", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useIsAdmin(userId?: string) {
  const getAccount = useServerFn(getCurrentAccount);
  return useQuery({
    queryKey: ["is-admin", userId],
    enabled: !!userId,
    retry: 1,
    queryFn: async () => (await getAccount({})).isAdmin,
  });
}
