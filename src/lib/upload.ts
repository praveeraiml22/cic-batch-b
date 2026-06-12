import { supabase } from "@/integrations/supabase/client";

export const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100 MB

export async function uploadToBucket(
  userId: string,
  file: File,
  folder: string,
): Promise<{ path: string; url: string }> {
  if (file.size > MAX_FILE_SIZE) {
    throw new Error("File exceeds 100 MB limit");
  }
  const ext = file.name.split(".").pop() || "bin";
  const safe = file.name.replace(/[^\w.\-]+/g, "_");
  const path = `${userId}/${folder}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}-${safe}`;
  const { error } = await supabase.storage.from("cic-files").upload(path, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: file.type || `application/${ext}`,
  });
  if (error) throw error;
  const { data: signed } = await supabase.storage.from("cic-files").createSignedUrl(path, 60 * 60 * 24 * 365);
  return { path, url: signed?.signedUrl ?? "" };
}

export async function getSignedUrl(path: string): Promise<string> {
  // path may already be a full URL — try to parse the bucket key out
  const key = path.includes("cic-files/") ? path.split("cic-files/").pop()! : path;
  const { data } = await supabase.storage.from("cic-files").createSignedUrl(key, 60 * 60);
  return data?.signedUrl ?? path;
}

/** Force-download a file from a URL via a Blob + temporary anchor click. */
export async function downloadFromUrl(url: string, filename: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed (${res.status})`);
  const blob = await res.blob();
  const blobUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = blobUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
}

export function formatBytes(n?: number | null) {
  if (!n) return "—";
  const units = ["B", "KB", "MB", "GB"];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(1)} ${units[i]}`;
}
