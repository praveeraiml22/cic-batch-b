import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const attachmentSchema = z.object({
  path: z.string().min(1),
  name: z.string().min(1),
  size: z.number().int().nonnegative().optional(),
});

async function assertAdmin(supabase: any, userId: string) {
  const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (data !== true) throw new Error("Only admins can manage assignments");
}

/** Admin creates a published (or draft) assignment with optional deadline and attachments. */
export const createAssignmentTopic = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    title: z.string().trim().min(1, "Title is required").max(200),
    subject: z.string().trim().max(120).optional().default(""),
    description: z.string().trim().max(5000).optional().default(""),
    deadline: z.string().datetime().nullable(),
    isPublished: z.boolean(),
    attachments: z.array(attachmentSchema).max(10),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertAdmin(supabase, userId);

    const { data: topic, error } = await supabase
      .from("assignment_topics")
      .insert({
        title: data.title,
        subject: data.subject || null,
        description: data.description || null,
        deadline: data.deadline,
        is_published: data.isPublished,
        created_by: userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    if (data.attachments.length) {
      const { error: attError } = await supabase.from("assignment_attachments").insert(
        data.attachments.map((a, i) => ({
          topic_id: topic.id,
          file_path: a.path,
          file_name: a.name,
          file_size: a.size ?? null,
          sort_order: i,
        })),
      );
      if (attError) throw new Error(attError.message);
    }
    return { id: topic.id as string };
  });

/** Admin edits details, extends/changes the deadline, or publishes/unpublishes. */
export const updateAssignmentTopic = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    id: z.string().uuid(),
    title: z.string().trim().min(1).max(200).optional(),
    subject: z.string().trim().max(120).nullable().optional(),
    description: z.string().trim().max(5000).nullable().optional(),
    deadline: z.string().datetime().nullable().optional(),
    isPublished: z.boolean().optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertAdmin(supabase, userId);

    const patch: Record<string, unknown> = {};
    if (data.title !== undefined) patch.title = data.title;
    if (data.subject !== undefined) patch.subject = data.subject || null;
    if (data.description !== undefined) patch.description = data.description || null;
    if (data.deadline !== undefined) patch.deadline = data.deadline;
    if (data.isPublished !== undefined) patch.is_published = data.isPublished;
    if (!Object.keys(patch).length) return { ok: true };

    const { error } = await supabase.from("assignment_topics").update(patch).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Admin removes an attachment from a topic and its stored file. */
export const deleteTopicAttachment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertAdmin(supabase, userId);
    const b2 = await import("@/lib/b2.server");

    const { data: att, error } = await supabase
      .from("assignment_attachments")
      .select("id, file_path")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!att) return { ok: true };

    const path = att.file_path as string;
    if (path.startsWith(b2.B2_PREFIX)) {
      await b2.b2Delete(b2.toObjectKey(path));
    } else {
      const { error: stErr } = await supabase.storage.from("cic-files").remove([path]);
      if (stErr) throw new Error(`Could not delete the stored file: ${stErr.message}`);
    }
    const { error: delError } = await supabase.from("assignment_attachments").delete().eq("id", att.id);
    if (delError) throw new Error(delError.message);
    return { ok: true };
  });

/** Admin deletes a whole assignment: every attachment, submission and stored file first, then the topic. */
export const deleteAssignmentTopic = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertAdmin(supabase, userId);
    const b2 = await import("@/lib/b2.server");

    const paths: string[] = [];
    const { data: atts, error: attsError } = await supabase
      .from("assignment_attachments").select("file_path").eq("topic_id", data.id);
    if (attsError) throw new Error(attsError.message);
    paths.push(...(atts ?? []).map((a: any) => a.file_path));

    const { data: subs, error: subsError } = await supabase
      .from("assignments").select("id, file_url").eq("topic_id", data.id);
    if (subsError) throw new Error(subsError.message);
    paths.push(...(subs ?? []).map((s: any) => s.file_url).filter(Boolean));

    if (subs?.length) {
      const { data: files, error: filesError } = await supabase
        .from("assignment_files").select("file_path").in("assignment_id", subs.map((s: any) => s.id));
      if (filesError) throw new Error(filesError.message);
      paths.push(...(files ?? []).map((f: any) => f.file_path));
    }

    for (const path of paths) {
      if (!path || path.startsWith("http")) continue;
      if (path.startsWith(b2.B2_PREFIX)) {
        await b2.b2Delete(b2.toObjectKey(path));
      } else {
        const { error } = await supabase.storage.from("cic-files").remove([path]);
        if (error) throw new Error(`Could not delete a stored file: ${error.message}`);
      }
    }

    const { error: delError } = await supabase.from("assignment_topics").delete().eq("id", data.id);
    if (delError) throw new Error(delError.message);
    return { ok: true };
  });

/** Student submits files against a published assignment — deadline enforced on the server. */
export const submitTopicAssignment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    topicId: z.string().uuid(),
    note: z.string().trim().max(5000).optional().default(""),
    files: z.array(attachmentSchema).min(1, "Please attach at least one file").max(10),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;

    const { data: topic, error: topicError } = await supabase
      .from("assignment_topics")
      .select("id, title, subject, deadline, is_published")
      .eq("id", data.topicId)
      .maybeSingle();
    if (topicError) throw new Error(topicError.message);
    if (!topic || !topic.is_published) throw new Error("This assignment is not available for submission.");
    if (topic.deadline && new Date(topic.deadline).getTime() < Date.now()) {
      throw new Error("Submission deadline expired. Ask an admin to extend the deadline.");
    }

    const { data: row, error: insError } = await supabase
      .from("assignments")
      .insert({
        title: topic.title,
        subject: topic.subject ?? "",
        description: data.note || null,
        submitted_by: userId,
        topic_id: topic.id,
      })
      .select("id")
      .single();
    if (insError) throw new Error(insError.message);

    const { error: filesError } = await supabase.from("assignment_files").insert(
      data.files.map((f) => ({
        assignment_id: row.id,
        file_path: f.path,
        file_name: f.name,
        file_size: f.size ?? null,
      })),
    );
    if (filesError) throw new Error(filesError.message);
    return { id: row.id as string };
  });
