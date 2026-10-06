import { supabase } from "@/integrations/supabase/client";
import { getB2FileUrl, deleteB2File } from "@/lib/files.functions";

export const B2_PREFIX = "b2:";
export const isB2Path = (p?: string | null) => !!p && p.startsWith(B2_PREFIX);
export type FileCategory = "assignments" | "documents" | "resume" | "notices" | "images" | "ppts" | "others";

async function accessToken() {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("You must be signed in.");
  return token;
}

/** Upload a file to private B2 storage (via the app server) with real progress. Returns the stored path ("b2:..."). */
export async function uploadToB2(file: File, category: FileCategory, onProgress?: (pct: number) => void): Promise<{ path: string }> {
  if (file.size > MAX_FILE_SIZE) throw new Error("File exceeds the 5 MB limit");
  const token = await accessToken();
  const url = `/api/files/upload?category=${category}&name=${encodeURIComponent(file.name)}`;
  const path = await new Promise<string>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url, true);
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.setRequestHeader("content-type", file.type || "application/octet-stream");
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress?.(Math.min(99, Math.round((e.loaded / e.total) * 100))); };
    xhr.onload = () => {
      let body: any = {};
      try { body = JSON.parse(xhr.responseText); } catch { /* ignore */ }
      if (xhr.status >= 200 && xhr.status < 300 && body.path) resolve(body.path);
      else reject(new Error(body.error ?? `Upload failed (${xhr.status})`));
    };
    xhr.onerror = () => reject(new Error("Network error during upload"));
    xhr.send(file);
  });
  onProgress?.(100);
  return { path };
}

/** Download any stored file (B2 or legacy) with progress. */
export async function downloadStoredFile(path: string, filename: string, onProgress?: (pct: number) => void) {
  if (isB2Path(path)) {
    const token = await accessToken();
    return downloadFromUrl(`/api/files/download?path=${encodeURIComponent(path)}`, filename, onProgress, { Authorization: `Bearer ${token}` });
  }
  return downloadFromUrl(await getSignedUrl(path), filename, onProgress);
}

/** Delete a stored file (B2 or legacy Supabase Storage). */
export async function removeStoredFile(path?: string | null) {
  if (!path || path.startsWith("http")) return;
  if (isB2Path(path)) await deleteB2File({ data: { path } });
  else {
    const { error } = await supabase.storage.from("cic-files").remove([path]);
    if (error) throw error;
  }
}

export const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

export async function uploadToBucket(
  userId: string,
  file: File,
  folder: string,
): Promise<{ path: string; url: string }> {
  if (folder === "assignments" || folder === "documents") {
    const { path } = await uploadToB2(file, folder);
    return { path, url: "" };
  }
  if (file.size > MAX_FILE_SIZE) {
    throw new Error("File exceeds the 5 MB limit");
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

export async function getSignedUrl(path: string, name?: string): Promise<string> {
  if (isB2Path(path)) return (await getB2FileUrl({ data: { path, name } })).url;
  // path may already be a full URL — try to parse the bucket key out
  const key = path.includes("cic-files/") ? path.split("cic-files/").pop()! : path;
  const { data } = await supabase.storage.from("cic-files").createSignedUrl(key, 60 * 60);
  return data?.signedUrl ?? path;
}

/** Force-download a file from a URL via a Blob + temporary anchor click.
 *  Streams the response so real download progress (0–100) can be reported. */
export async function downloadFromUrl(
  url: string,
  filename: string,
  onProgress?: (pct: number) => void,
  headers?: Record<string, string>,
) {
  const res = await fetch(url, headers ? { headers } : undefined);
  if (!res.ok) throw new Error(`Download failed (${res.status})`);

  const total = Number(res.headers.get("content-length")) || 0;
  let blob: Blob;
  if (res.body && total > 0) {
    const reader = res.body.getReader();
    const chunks: BlobPart[] = [];
    let loaded = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      loaded += value.byteLength;
      onProgress?.(Math.min(99, Math.round((loaded / total) * 100)));
    }
    blob = new Blob(chunks, { type: res.headers.get("content-type") ?? undefined });
  } else {
    blob = await res.blob();
  }
  onProgress?.(100);

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

/** Upload with real progress reporting via XHR (Supabase Storage REST). */
export async function uploadWithProgress(
  path: string,
  file: File,
  onProgress: (pct: number) => void,
  opts?: { upsert?: boolean },
): Promise<{ path: string }> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) throw new Error("You must be signed in to upload files.");
  const base = import.meta.env.VITE_SUPABASE_URL as string;
  const url = `${base}/storage/v1/object/cic-files/${path.split("/").map(encodeURIComponent).join("/")}`;

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url, true);
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.setRequestHeader("apikey", import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string);
    xhr.setRequestHeader("x-upsert", opts?.upsert ? "true" : "false");
    xhr.setRequestHeader("cache-control", "3600");
    if (file.type) xhr.setRequestHeader("content-type", file.type);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else {
        let msg = `Upload failed (${xhr.status})`;
        try { msg = JSON.parse(xhr.responseText)?.message ?? msg; } catch { /* ignore */ }
        reject(new Error(msg));
      }
    };
    xhr.onerror = () => reject(new Error("Network error during upload"));
    xhr.send(file);
  });
  onProgress(100);
  return { path };
}
