import { AwsClient } from "aws4fetch";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

/** Prefix stored in DB path columns to mark objects living in Backblaze B2.
 *  Paths without it are legacy Supabase Storage objects (left untouched). */
export const B2_PREFIX = "b2:";

export const B2_CATEGORIES = ["assignments", "documents", "resume", "notices", "images", "ppts", "others"] as const;
export type B2Category = (typeof B2_CATEGORIES)[number];

export const B2_MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_EXT = new Set(["pdf", "doc", "docx", "ppt", "pptx", "xls", "xlsx", "txt", "csv", "zip", "png", "jpg", "jpeg", "webp", "gif", "dwg"]);

function cfg() {
  const bucket = process.env["B2_BUCKET_NAME"];
  let endpoint = process.env["B2_ENDPOINT"];
  const region = process.env["B2_REGION"];
  const keyId = process.env["B2_APPLICATION_KEY_ID"];
  const key = process.env["B2_APPLICATION_KEY"];
  if (!bucket || !endpoint || !region || !keyId || !key) throw new Error("File storage is not configured");
  if (!/^https?:\/\//.test(endpoint)) endpoint = `https://${endpoint}`;
  endpoint = endpoint.replace(/\/+$/, "");
  return { bucket, endpoint, region, client: new AwsClient({ accessKeyId: keyId, secretAccessKey: key, service: "s3", region }) };
}

function objectUrl(objectKey: string) {
  const c = cfg();
  const enc = objectKey.split("/").map(encodeURIComponent).join("/");
  return { ...c, url: `${c.endpoint}/${c.bucket}/${enc}` };
}

export function toObjectKey(path: string) {
  if (!path.startsWith(B2_PREFIX)) throw new Error("Not a B2 path");
  const k = path.slice(B2_PREFIX.length);
  if (!k || k.includes("..")) throw new Error("Invalid path");
  return k;
}

export function validateUpload(fileName: string, size: number) {
  const ext = (fileName.split(".").pop() ?? "").toLowerCase();
  if (!ALLOWED_EXT.has(ext)) throw new Error("This file type is not allowed");
  if (size <= 0) throw new Error("That file appears to be empty");
  if (size > B2_MAX_BYTES) throw new Error("File exceeds the 5 MB limit");
}

export function buildKey(userId: string, category: B2Category, fileName: string) {
  const safe = fileName.replace(/[^\w.\-]+/g, "_").slice(-120);
  return `${userId}/${category}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}-${safe}`;
}

export async function b2Put(objectKey: string, body: ArrayBuffer, contentType: string) {
  const { client, url } = objectUrl(objectKey);
  const res = await client.fetch(url, { method: "PUT", body, headers: { "content-type": contentType } });
  if (!res.ok) {
    console.error("[b2:put]", res.status, await res.text());
    throw new Error("Upload to storage failed");
  }
}

export async function b2Get(objectKey: string) {
  const { client, url } = objectUrl(objectKey);
  const res = await client.fetch(url, { method: "GET" });
  if (!res.ok) {
    console.error("[b2:get]", res.status);
    throw new Error(res.status === 404 ? "File not found" : "Could not read file");
  }
  return res;
}

export async function b2Delete(objectKey: string) {
  const { client, url } = objectUrl(objectKey);
  const res = await client.fetch(url, { method: "DELETE" });
  if (!res.ok && res.status !== 404) {
    console.error("[b2:delete]", res.status, await res.text());
    throw new Error(`Could not delete file from Backblaze B2 (HTTP ${res.status}). Check that the application key has deleteFiles permission.`);
  }
}

/** Short-lived presigned GET URL (default 5 minutes). */
export async function b2SignedUrl(objectKey: string, fileName?: string, expiresSec = 300) {
  const { client, url } = objectUrl(objectKey);
  const u = new URL(url);
  u.searchParams.set("X-Amz-Expires", String(expiresSec));
  if (fileName) u.searchParams.set("response-content-disposition", `inline; filename="${fileName.replace(/"/g, "")}"`);
  const signed = await client.sign(u.toString(), { method: "GET", aws: { signQuery: true } });
  return signed.url;
}

/** Supabase client acting as the given user (RLS applies). */
export function userClient(token: string) {
  const url = process.env["SUPABASE_URL"]!;
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
}

export async function userFromRequest(request: Request) {
  const auth = request.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) return null;
  const sb = userClient(token);
  const { data, error } = await sb.auth.getUser(token);
  if (error || !data.user) return null;
  return { userId: data.user.id, supabase: sb };
}

type SB = ReturnType<typeof userClient>;

export async function isAdmin(sb: SB, userId: string) {
  const { data } = await sb.rpc("has_role", { _user_id: userId, _role: "admin" });
  return data === true;
}

/** Read access: owner, admin, or the caller can see a DB row referencing the path under existing RLS. */
export async function canRead(sb: SB, userId: string, path: string) {
  const key = toObjectKey(path);
  if (key.split("/")[0] === userId) return true;
  if (await isAdmin(sb, userId)) return true;
  const checks = await Promise.all([
    sb.from("documents").select("id").eq("file_url", path).limit(1),
    sb.from("assignments").select("id").eq("file_url", path).limit(1),
    sb.from("resumes").select("id").eq("file_path", path).limit(1),
  ]);
  return checks.some((r) => (r.data?.length ?? 0) > 0);
}

/** Delete access mirrors existing rules: owner or admin. */
export async function canDelete(sb: SB, userId: string, path: string) {
  const key = toObjectKey(path);
  if (key.split("/")[0] === userId) return true;
  return isAdmin(sb, userId);
}
