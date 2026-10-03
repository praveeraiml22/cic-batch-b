import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Total storage available to the CIC site (bytes). */
export const STORAGE_TOTAL_BYTES = 1024 * 1024 * 1024; // 1 GB

export const getStorageUsage = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.rpc("storage_usage_bytes" as never);
    if (error) throw new Error("Could not read storage usage");
    return { used: Number(data ?? 0), total: STORAGE_TOTAL_BYTES };
  });
