import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/files/upload")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const b2 = await import("@/lib/b2.server");
        const who = await b2.userFromRequest(request);
        if (!who) return Response.json({ error: "Please sign in to upload files." }, { status: 401 });
        try {
          const url = new URL(request.url);
          const category = url.searchParams.get("category") as any;
          const fileName = url.searchParams.get("name") ?? "";
          if (!b2.B2_CATEGORIES.includes(category)) return Response.json({ error: "Invalid category" }, { status: 400 });
          if (category === "notices" && !(await b2.isAdmin(who.supabase, who.userId))) {
            return Response.json({ error: "Admins only" }, { status: 403 });
          }
          const body = await request.arrayBuffer();
          b2.validateUpload(fileName, body.byteLength);
          const key = b2.buildKey(who.userId, category, fileName);
          await b2.b2Put(key, body, request.headers.get("content-type") || "application/octet-stream");
          return Response.json({ path: `${b2.B2_PREFIX}${key}` });
        } catch (e) {
          return Response.json({ error: e instanceof Error ? e.message : "Upload failed" }, { status: 400 });
        }
      },
    },
  },
});
