import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Short-lived (5 min) signed link for viewing a B2 file, after an access check. */
export const getB2FileUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ path: z.string().startsWith("b2:"), name: z.string().optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const b2 = await import("@/lib/b2.server");
    const { userId, supabase } = context as any;
    if (!(await b2.canRead(supabase, userId, data.path))) throw new Error("You don't have access to this file");
    return { url: await b2.b2SignedUrl(b2.toObjectKey(data.path), data.name) };
  });

/** Delete a B2 object. Owner or admin only (same rule as before). */
export const deleteB2File = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ path: z.string().startsWith("b2:") }).parse(d))
  .handler(async ({ data, context }) => {
    const b2 = await import("@/lib/b2.server");
    const { userId, supabase } = context as any;
    if (!(await b2.canDelete(supabase, userId, data.path))) throw new Error("Not allowed to delete this file");
    await b2.b2Delete(b2.toObjectKey(data.path));
    return { ok: true };
  });

/** Resolve a file path from its database row, verify the caller, remove the file, then remove the row. */
export const deleteStoredRecord = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ kind: z.enum(["assignment", "document", "resume", "notice"]), id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { userId, supabase } = context as any;
    const b2 = await import("@/lib/b2.server");
    const isAdmin = await b2.isAdmin(supabase, userId);
    const tables = {
      assignment: { table: "assignments", pathColumn: "file_url", ownerColumn: "submitted_by", bucket: "cic-files" },
      document: { table: "documents", pathColumn: "file_url", ownerColumn: "uploaded_by", bucket: "cic-files" },
      resume: { table: "resumes", pathColumn: "file_path", ownerColumn: "user_id", bucket: "cic-files" },
      notice: { table: "notices", pathColumn: "file_path", ownerColumn: "created_by", bucket: "notices" },
    } as const;
    const config = tables[data.kind];
    const { data: row, error: readError } = await supabase
      .from(config.table)
      .select(`id,${config.pathColumn},${config.ownerColumn}${data.kind === "assignment" ? ",status" : ""}`)
      .eq("id", data.id)
      .maybeSingle();
    if (readError) throw new Error(readError.message);
    if (!row) throw new Error("This item no longer exists or you do not have permission to delete it.");

    const ownerId = row[config.ownerColumn];
    if (data.kind === "notice" ? !isAdmin : !isAdmin && ownerId !== userId) {
      throw new Error("You are not allowed to delete this item.");
    }
    if (data.kind === "assignment" && !isAdmin && row.status !== "submitted") {
      throw new Error("Only submitted assignments can be deleted by their owner.");
    }

    const path = row[config.pathColumn] as string | null;
    if (path && !path.startsWith("http")) {
      if (path.startsWith(b2.B2_PREFIX)) {
        if (!(await b2.canDelete(supabase, userId, path))) throw new Error("You are not allowed to delete this file.");
        await b2.b2Delete(b2.toObjectKey(path));
      } else {
        const { error } = await supabase.storage.from(config.bucket).remove([path]);
        if (error) throw new Error(`Could not delete the stored file: ${error.message}`);
      }
    }

    const { error: deleteError } = await supabase.from(config.table).delete().eq("id", data.id);
    if (deleteError) throw new Error(`The file was deleted, but its database record could not be removed: ${deleteError.message}`);
    return { ok: true };
  });

/** Delete a user-owned document folder and its stored files before removing any records. */
export const deleteDocumentFolder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ folderId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    const b2 = await import("@/lib/b2.server");
    const { data: folder, error: folderError } = await supabase
      .from("document_folders")
      .select("id,owner_id,kind")
      .eq("id", data.folderId)
      .maybeSingle();
    if (folderError) throw new Error(folderError.message);
    if (!folder || folder.kind !== "user") throw new Error("Folder not found or not allowed to delete");
    if (folder.owner_id !== userId && !(await b2.isAdmin(supabase, userId))) {
      throw new Error("You are not allowed to delete this folder");
    }

    const folderIds = [folder.id as string];
    let frontier = [folder.id as string];
    while (frontier.length) {
      const { data: children, error } = await supabase
        .from("document_folders")
        .select("id")
        .in("parent_id", frontier);
      if (error) throw new Error(error.message);
      frontier = (children ?? []).map((child: { id: string }) => child.id);
      folderIds.push(...frontier);
    }

    const { data: documents, error: documentsError } = await supabase
      .from("documents")
      .select("id,file_url")
      .in("folder_id", folderIds);
    if (documentsError) throw new Error(documentsError.message);

    for (const document of documents ?? []) {
      const path = document.file_url as string | null;
      if (!path || path.startsWith("http")) continue;
      if (path.startsWith(b2.B2_PREFIX)) {
        if (!(await b2.canDelete(supabase, userId, path))) throw new Error("You are not allowed to delete one or more files in this folder");
        await b2.b2Delete(b2.toObjectKey(path));
      } else {
        const { error } = await supabase.storage.from("cic-files").remove([path]);
        if (error) throw new Error(error.message);
      }
    }

    if (documents?.length) {
      const { error } = await supabase.from("documents").delete().in("folder_id", folderIds);
      if (error) throw new Error(error.message);
    }
    for (const id of folderIds.reverse()) {
      const { error } = await supabase.from("document_folders").delete().eq("id", id);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });
