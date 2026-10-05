import { createFileRoute } from "@tanstack/react-router";

/** Public: streams the PDF attached to a published home-board notice stored in B2. */
export const Route = createFileRoute("/api/public/notice-file")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const id = new URL(request.url).searchParams.get("id") ?? "";
        if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response("Bad request", { status: 400 });
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const b2 = await import("@/lib/b2.server");
        const { data } = await supabaseAdmin.from("notices" as any).select("file_path").eq("id", id).maybeSingle();
        const path = (data as any)?.file_path as string | null;
        if (!path || !path.startsWith(b2.B2_PREFIX)) return new Response("Not found", { status: 404 });
        try {
          const res = await b2.b2Get(b2.toObjectKey(path));
          const h = new Headers({ "content-type": "application/pdf", "cache-control": "no-store" });
          const len = res.headers.get("content-length"); if (len) h.set("content-length", len);
          return new Response(res.body, { headers: h });
        } catch {
          return new Response("Not found", { status: 404 });
        }
      },
    },
  },
});
