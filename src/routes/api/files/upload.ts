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
          const topicId = url.searchParams.get("topic");
          if (!b2.B2_CATEGORIES.includes(category)) return Response.json({ error: "Invalid category" }, { status: 400 });
          if (category === "notices" && !(await b2.isAdmin(who.supabase, who.userId))) {
            return Response.json({ error: "Admins only" }, { status: 403 });
          }
          // Server-side deadline enforcement: files for an expired assignment are rejected
          // even when sent straight to this endpoint.
          if (category === "assignments" && topicId) {
            const { data: topic } = await who.supabase
              .from("assignment_topics")
              .select("deadline, is_published")
              .eq("id", topicId)
              .maybeSingle();
            if (!topic || !topic.is_published) {
              return Response.json({ error: "This assignment is not open for submissions." }, { status: 403 });
            }
            if (topic.deadline && new Date(topic.deadline).getTime() < Date.now()) {
              return Response.json({ error: "Submission deadline expired" }, { status: 403 });
            }
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
