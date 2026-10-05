import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/files/download")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const b2 = await import("@/lib/b2.server");
        const who = await b2.userFromRequest(request);
        if (!who) return new Response("Unauthorized", { status: 401 });
        const path = new URL(request.url).searchParams.get("path") ?? "";
        try {
          if (!(await b2.canRead(who.supabase, who.userId, path))) return new Response("Forbidden", { status: 403 });
          const res = await b2.b2Get(b2.toObjectKey(path));
          const h = new Headers({ "cache-control": "private, no-store" });
          for (const k of ["content-type", "content-length"]) { const v = res.headers.get(k); if (v) h.set(k, v); }
          return new Response(res.body, { status: 200, headers: h });
        } catch (e) {
          return new Response(e instanceof Error ? e.message : "Error", { status: 400 });
        }
      },
    },
  },
});
