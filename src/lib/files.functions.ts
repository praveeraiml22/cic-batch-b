import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Short-lived (5 min) signed link for viewing a B2 file, after an access check. */
export const getB2FileUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ path: z.string().startsWith("b2:"), name: z.string().optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const b2 = await import("@/lib/b2.server");
    const { userId, supabase } = context as any;
    if (!(await b2.canRead(supabase, userId, data.path))) throw new Error("You don't have access to this file");
    return { url: await b2.b2SignedUrl(b2.toObjectKey(data.path), data.name) };
  });

/** Delete a B2 object. Owner or admin only (same rule as before). */
export const deleteB2File = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ path: z.string().startsWith("b2:") }).parse(d))
  .handler(async ({ data, context }) => {
    const b2 = await import("@/lib/b2.server");
    const { userId, supabase } = context as any;
    if (!(await b2.canDelete(supabase, userId, data.path))) throw new Error("Not allowed to delete this file");
    await b2.b2Delete(b2.toObjectKey(data.path));
    return { ok: true };
  });
