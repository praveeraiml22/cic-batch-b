import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

export const ONESIGNAL_APP_ID = "16a361c6-cc92-458c-8ecd-8e50a1509c0c";

const PayloadSchema = z.object({
  log_id: z.string().uuid().optional(),
  event_type: z.string().min(1),
  source_table: z.string().nullable().optional(),
  source_id: z.string().uuid().nullable().optional(),
  user_id: z.string().uuid().nullable().optional(),
  is_broadcast: z.boolean().optional().default(false),
  title: z.string().min(1),
  body: z.string().nullable().optional(),
  link: z.string().nullable().optional(),
});

type OneSignalResponse = {
  id?: string | null;
  recipients?: number | null;
  errors?: unknown;
};

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
          console.error("[BROADCAST ERROR] invalid payload");
          return new Response("Invalid payload", { status: 400 });
        }

        console.log(
          `[BROADCAST] Received ${payload.event_type} log=${payload.log_id ?? "none"} audience=${
            payload.is_broadcast ? "all_members" : "selected_member"
          }`,
        );

        const restKey = process.env["ONESIGNAL_REST_API_KEY"];

        // Resolve the originating row so status can be mirrored back onto it.
        let sourceTable = payload.source_table ?? null;
        let sourceId = payload.source_id ?? null;
        if (payload.log_id && (!sourceTable || !sourceId)) {
          const { data: log } = await supabaseAdmin
            .from("push_notification_logs")
            .select("source_table, source_id")
            .eq("id", payload.log_id)
            .maybeSingle();
          sourceTable = sourceTable ?? log?.source_table ?? null;
          sourceId = sourceId ?? log?.source_id ?? null;
        }

        const finish = async (
          status: string,
          error: string | null,
          response: unknown,
          onesignalId: string | null = null,
        ) => {
          if (payload.log_id) {
            await supabaseAdmin
              .from("push_notification_logs")
              .update({ status, error, response: (response ?? null) as never })
              .eq("id", payload.log_id);
          }
          if (sourceTable && sourceId) {
            await supabaseAdmin.rpc("sync_push_result", {
              _source_table: sourceTable,
              _source_id: sourceId,
              _status: status,
              _onesignal_id: onesignalId as string,
              _error: error as string,
            });
          }
        };

        if (!restKey) {
          console.error("[BROADCAST ERROR] ONESIGNAL_REST_API_KEY is not configured");
          await finish("failed", "ONESIGNAL_REST_API_KEY is not configured", null);
          return Response.json({ ok: false, error: "not configured" }, { status: 503 });
        }

        // Idempotency: exactly one invocation may deliver a given log row.
        if (payload.log_id) {
          const { data: claimed, error: claimError } = await supabaseAdmin.rpc("claim_push_log", {
            _log_id: payload.log_id,
          });
          if (claimError) {
            console.error(`[BROADCAST ERROR] claim failed: ${claimError.message}`);
            return Response.json({ ok: false, error: "claim failed" }, { status: 500 });
          }
          if (!claimed) {
            console.log("[BROADCAST] Already sent or in flight — skipping duplicate");
            return Response.json({ ok: true, deduplicated: true });
          }
        }

        // Never mix segments with alias targeting in one request.
        const targeting =
          payload.is_broadcast || !payload.user_id
            ? { included_segments: ["Subscribed Users"] }
            : { include_aliases: { external_id: [payload.user_id] } };

        const notification = {
          app_id: ONESIGNAL_APP_ID,
          target_channel: "push",
          headings: { en: payload.title },
          contents: { en: payload.body ?? payload.title },
          data: {
            type: "broadcast",
            source: "CIC",
            event_type: payload.event_type,
            broadcast_id: sourceId,
            link: payload.link ?? null,
          },
          ...(payload.link ? { url: payload.link } : {}),
          android_channel_name: "CIC Notifications",
          priority: 10,
          ...targeting,
        };

        console.log("[BROADCAST] Preparing OneSignal request");

        try {
          const res = await fetch("https://api.onesignal.com/notifications", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Key ${restKey}`,
            },
            body: JSON.stringify(notification),
          });
          const json = (await res.json().catch(() => null)) as OneSignalResponse | null;
          console.log(`[BROADCAST] OneSignal HTTP status: ${res.status}`);

          if (!res.ok) {
            const reason =
              res.status === 401 || res.status === 403
                ? "OneSignal rejected the API key (401/403)"
                : res.status === 400
                  ? "Invalid OneSignal payload or targeting (400)"
                  : res.status === 429
                    ? "OneSignal rate limit (429)"
                    : `OneSignal error HTTP ${res.status}`;
            console.error(`[ONESIGNAL ERROR] HTTP ${res.status}: ${JSON.stringify(json?.errors ?? null)}`);
            // 429/5xx are transient: leave the row reclaimable for a later retry.
            const transient = res.status === 429 || res.status >= 500;
            await finish(transient ? "retry" : "failed", reason, json);
            return Response.json({ ok: false, error: reason }, { status: 502 });
          }

          const recipients = json?.recipients ?? 0;
          const notificationId = json?.id ?? null;

          if (!notificationId || recipients === 0) {
            const reason = "No subscribed OneSignal recipients for this target";
            console.error(`[ONESIGNAL ERROR] ${reason}: ${JSON.stringify(json?.errors ?? null)}`);
            await finish("no_recipients", reason, json);
            return Response.json({ ok: false, error: reason, recipients: 0 });
          }

          console.log(`[BROADCAST] OneSignal notification ID: ${notificationId} recipients=${recipients}`);
          await finish("sent", null, json, notificationId);
          console.log("[BROADCAST] Broadcast marked as sent");
          return Response.json({ ok: true, id: notificationId, recipients });
        } catch (err) {
          const message = err instanceof Error ? err.message : "unknown error";
          console.error(`[BROADCAST ERROR] ${message}`);
          await finish("retry", message, null);
          return Response.json({ ok: false }, { status: 502 });
        }
      },
    },
  },
});
