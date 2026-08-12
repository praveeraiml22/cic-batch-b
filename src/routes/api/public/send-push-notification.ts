import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

export const ONESIGNAL_APP_ID = "16a361c6-cc92-458c-8ecd-8e50a1509c0c";

const PayloadSchema = z.object({
  log_id: z.string().uuid().optional(),
  event_type: z.string().min(1),
  user_id: z.string().uuid().nullable().optional(),
  is_broadcast: z.boolean().optional().default(false),
  title: z.string().min(1),
  body: z.string().nullable().optional(),
  link: z.string().nullable().optional(),
});

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export const Route = createFileRoute("/api/public/send-push-notification")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const provided = request.headers.get("x-push-secret") ?? "";
        const { data: config } = await supabaseAdmin
          .from("push_config")
          .select("webhook_secret, enabled")
          .eq("id", true)
          .maybeSingle();

        if (!config || !safeEqual(provided, config.webhook_secret)) {
          return new Response("Unauthorized", { status: 401 });
        }
        if (!config.enabled) {
          return Response.json({ skipped: true, reason: "push disabled" });
        }

        let payload: z.infer<typeof PayloadSchema>;
        try {
          payload = PayloadSchema.parse(await request.json());
        } catch {
          return new Response("Invalid payload", { status: 400 });
        }

        const restKey = process.env["ONESIGNAL_REST_API_KEY"];
        const finish = async (status: string, error: string | null, response: unknown) => {
          if (payload.log_id) {
            await supabaseAdmin
              .from("push_notification_logs")
              .update({
                status,
                error,
                response: (response ?? null) as never,
              })
              .eq("id", payload.log_id);
          }
        };

        if (!restKey) {
          await finish("failed", "ONESIGNAL_REST_API_KEY is not configured", null);
          return Response.json({ ok: false, error: "not configured" }, { status: 503 });
        }

        // Deduplication: a log row is created (and uniquely keyed) by the database
        // before this endpoint is called. If it is already sent, do nothing.
        if (payload.log_id) {
          const { data: log } = await supabaseAdmin
            .from("push_notification_logs")
            .select("status")
            .eq("id", payload.log_id)
            .maybeSingle();
          if (log?.status === "sent") {
            return Response.json({ ok: true, deduplicated: true });
          }
        }

        const targeting =
          payload.is_broadcast || !payload.user_id
            ? { included_segments: ["Subscribed Users"] }
            : { include_aliases: { external_id: [payload.user_id] }, target_channel: "push" };

        const notification = {
          app_id: ONESIGNAL_APP_ID,
          headings: { en: payload.title },
          contents: { en: payload.body ?? payload.title },
          data: { event_type: payload.event_type, link: payload.link ?? null },
          ...(payload.link ? { url: payload.link } : {}),
          android_channel_name: "CIC Notifications",
          priority: 10,
          ...targeting,
        };

        try {
          const res = await fetch("https://api.onesignal.com/notifications", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Basic ${restKey}`,
            },
            body: JSON.stringify(notification),
          });
          const json: unknown = await res.json().catch(() => null);

          if (!res.ok) {
            await finish("failed", `OneSignal responded ${res.status}`, json);
            return Response.json({ ok: false }, { status: 502 });
          }

          await finish("sent", null, json);
          return Response.json({ ok: true });
        } catch (err) {
          await finish("failed", err instanceof Error ? err.message : "unknown error", null);
          return Response.json({ ok: false }, { status: 502 });
        }
      },
    },
  },
});
