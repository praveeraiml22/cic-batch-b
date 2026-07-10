// Server-only shim: @supabase/realtime-js checks for a global WebSocket at
// construction time and logs "Node.js 20 detected without native WebSocket
// support" when it's missing. We never open Realtime channels on the server —
// Realtime subscriptions are strictly browser-only in this app — so we install
// a no-op WebSocket constructor to silence the warning and avoid any attempt
// to `require('ws')` inside bundled Netlify Functions.
//
// This file MUST be imported before any `@supabase/supabase-js` client is
// created on the server. It is a no-op in the browser (where a real
// WebSocket exists).

if (typeof globalThis !== "undefined" && typeof (globalThis as any).WebSocket === "undefined") {
  class NoopWebSocket {
    static readonly CONNECTING = 0;
    static readonly OPEN = 1;
    static readonly CLOSING = 2;
    static readonly CLOSED = 3;
    readyState = 3;
    url = "";
    constructor() {
      // Intentionally does nothing. Server code must not open Realtime channels.
    }
    close() {}
    send() {}
    addEventListener() {}
    removeEventListener() {}
    dispatchEvent() {
      return false;
    }
  }
  (globalThis as any).WebSocket = NoopWebSocket;
}

export {};
