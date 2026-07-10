import { createServerFn } from "@tanstack/react-start";
import { installServerWebSocketShim } from "./websocket-shim";
import { installServerRuntime } from "./server-runtime-middleware";
import { requireAppAuth } from "./supabase-auth-runtime";
import { loadOrCreateAccount, type AccountContext } from "./account.server";

installServerWebSocketShim();

export const ensureMemberAccount = createServerFn({ method: "POST" })
  .middleware([installServerRuntime, requireAppAuth])
  .handler(async ({ context }) => {
    await loadOrCreateAccount(context as AccountContext);
    return { ok: true };
  });

export const getCurrentAccount = createServerFn({ method: "GET" })
  .middleware([installServerRuntime, requireAppAuth])
  .handler(async ({ context }) => loadOrCreateAccount(context as AccountContext));