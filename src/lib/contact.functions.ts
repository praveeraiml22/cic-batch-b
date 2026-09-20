import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const ContactSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(200),
  subject: z.string().trim().min(1).max(200),
  message: z.string().trim().min(1).max(5000),
});

/**
 * Forwards a contact-form submission to the Google Apps Script Web App,
 * which sends the email from the owner's own Gmail account.
 * The Web App URL lives in a server-only secret (GOOGLE_APPS_SCRIPT_CONTACT_URL)
 * so nothing about the mailbox is exposed to the browser.
 */
export const sendContactMessage = createServerFn({ method: "POST" })
  .inputValidator(ContactSchema)
  .handler(async ({ data }) => {
    const endpoint = process.env["GOOGLE_APPS_SCRIPT_CONTACT_URL"];
    if (!endpoint) {
      throw new Error("Contact form is not configured yet. Please try again later.");
    }

    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...data,
        submittedAt: new Date().toISOString(),
      }),
      redirect: "follow",
    });

    const text = await res.text();
    if (!res.ok) {
      console.error(`[CONTACT] Apps Script failed [${res.status}]: ${text}`);
      throw new Error("We could not send your message. Please try again.");
    }

    let parsed: { ok?: boolean; error?: string } | null = null;
    try {
      parsed = JSON.parse(text) as { ok?: boolean; error?: string };
    } catch {
      parsed = null;
    }

    if (!parsed?.ok) {
      console.error(`[CONTACT] Apps Script rejected submission: ${text}`);
      throw new Error(parsed?.error ?? "We could not send your message. Please try again.");
    }

    return { ok: true as const };
  });
