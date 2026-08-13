// Client-side OneSignal helpers.
// The Android app already bundles the OneSignal SDK; when the web app runs
// inside it (or with the web SDK loaded), `window.OneSignal` is available.
// The Supabase user UUID is used as the OneSignal External User ID so the
// backend can target a single student. This is the ONLY identity we set —
// device/subscription ids are managed by OneSignal itself.

export const ONESIGNAL_APP_ID = "16a361c6-cc92-458c-8ecd-8e50a1509c0c";

type OneSignalLike = {
  login?: (externalId: string) => Promise<void> | void;
  logout?: () => Promise<void> | void;
  setExternalUserId?: (externalId: string) => Promise<void> | void;
  removeExternalUserId?: () => Promise<void> | void;
};

type DeferredOneSignal = OneSignalLike & { push?: (fn: () => void) => void };

function getOneSignal(): DeferredOneSignal | null {
  if (typeof window === "undefined") return null;
  return (window as unknown as { OneSignal?: DeferredOneSignal }).OneSignal ?? null;
}

/**
 * The SDK is often injected after React hydrates (especially inside the
 * Android WebView), so poll briefly instead of giving up immediately.
 */
async function waitForOneSignal(timeoutMs = 15000): Promise<DeferredOneSignal | null> {
  const started = Date.now();
  for (;;) {
    const os = getOneSignal();
    if (os && (typeof os.login === "function" || typeof os.setExternalUserId === "function")) return os;
    if (Date.now() - started > timeoutMs) return os;
    await new Promise((r) => setTimeout(r, 500));
  }
}

let lastLinkedUserId: string | null = null;

/** Link the signed-in Supabase user to their OneSignal subscription. */
export async function linkPushUser(userId: string): Promise<void> {
  if (lastLinkedUserId === userId) return;
  const os = await waitForOneSignal();
  if (!os) return;
  try {
    if (typeof os.login === "function") await os.login(userId);
    else if (typeof os.setExternalUserId === "function") await os.setExternalUserId(userId);
    else return;
    lastLinkedUserId = userId;
    console.log("[push] OneSignal external id linked");
  } catch (err) {
    console.warn("[push] failed to link OneSignal external id", err);
  }
}

/** Unlink on sign-out so the device stops receiving that user's notifications. */
export async function unlinkPushUser(): Promise<void> {
  const os = getOneSignal();
  lastLinkedUserId = null;
  if (!os) return;
  try {
    if (typeof os.logout === "function") await os.logout();
    else if (typeof os.removeExternalUserId === "function") await os.removeExternalUserId();
  } catch (err) {
    console.warn("[push] failed to unlink OneSignal external id", err);
  }
}
