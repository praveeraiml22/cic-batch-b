import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/** Public: returns a short-lived download link for a published notice's PDF.
 *  Only files attached to an existing notice can be fetched. */
export const getNoticeFileUrl = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: notice, error } = await supabaseAdmin
      .from("notices" as any)
      .select("file_path")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    const path = (notice as any)?.file_path as string | null;
    if (!path) throw new Error("This notice has no attachment");
    if (path.startsWith("b2:")) return { url: `/api/public/notice-file?id=${data.id}` };
    const { data: signed, error: sErr } = await supabaseAdmin.storage.from("notices").createSignedUrl(path, 600);
    if (sErr || !signed) throw new Error(sErr?.message ?? "Could not create download link");
    return { url: signed.signedUrl };
  });
