import { createMiddleware } from "@tanstack/react-start";

import { installServerWebSocketShim } from "./websocket-shim";

export const installServerRuntime = createMiddleware({ type: "function" }).server(
  async ({ next }) => {
    installServerWebSocketShim();
    return next();
  },
);