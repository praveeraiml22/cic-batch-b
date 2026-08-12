// Client-side OneSignal helpers.
// The Android app already bundles the OneSignal SDK; when the web app runs
// inside it (or with the web SDK loaded), `window.OneSignal` is available.
// The Supabase user UUID is used as the OneSignal External User ID so the
// backend can target a single student.

export const ONESIGNAL_APP_ID = "16a361c6-cc92-458c-8ecd-8e50a1509c0c";

type OneSignalLike = {
  login?: (externalId: string) => Promise<void> | void;
  logout?: () => Promise<void> | void;
  setExternalUserId?: (externalId: string) => Promise<void> | void;
  removeExternalUserId?: () => Promise<void> | void;
};

function getOneSignal(): OneSignalLike | null {
  if (typeof window === "undefined") return null;
  const os = (window as unknown as { OneSignal?: OneSignalLike }).OneSignal;
  return os ?? null;
}

/** Link the signed-in Supabase user to their OneSignal subscription. */
export async function linkPushUser(userId: string): Promise<void> {
  const os = getOneSignal();
  if (!os) return;
  try {
    if (typeof os.login === "function") await os.login(userId);
    else if (typeof os.setExternalUserId === "function") await os.setExternalUserId(userId);
  } catch (err) {
    console.warn("[push] failed to link OneSignal external id", err);
  }
}

/** Unlink on sign-out so the device stops receiving that user's notifications. */
export async function unlinkPushUser(): Promise<void> {
  const os = getOneSignal();
  if (!os) return;
  try {
    if (typeof os.logout === "function") await os.logout();
    else if (typeof os.removeExternalUserId === "function") await os.removeExternalUserId();
  } catch (err) {
    console.warn("[push] failed to unlink OneSignal external id", err);
  }
}
