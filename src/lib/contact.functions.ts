import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const ContactSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(200),
  subject: z.string().trim().min(1).max(200),
  message: z.string().trim().min(1).max(5000),
});

type ContactResult = { ok: true } | { ok: false; error: string };

/**
 * Forwards a contact-form submission to the Google Apps Script Web App,
 * which sends the email from the owner's own Gmail account.
 * The Web App URL lives in a server-only secret (GOOGLE_APPS_SCRIPT_CONTACT_URL)
 * so nothing about the mailbox is exposed to the browser.
 * Returns a result object (never throws) so the form can show a friendly
 * error state instead of crashing.
 */
export const sendContactMessage = createServerFn({ method: "POST" })
  .inputValidator(ContactSchema)
  .handler(async ({ data }): Promise<ContactResult> => {
    const endpoint = process.env["GOOGLE_APPS_SCRIPT_CONTACT_URL"];
    if (!endpoint) {
      return { ok: false, error: "Contact form is not configured yet. Please try again later." };
    }

    try {
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
        return { ok: false, error: "We could not send your message. Please try again." };
      }

      let parsed: { ok?: boolean; error?: string } | null = null;
      try {
        parsed = JSON.parse(text) as { ok?: boolean; error?: string };
      } catch {
        parsed = null;
      }

      if (!parsed?.ok) {
        console.error(`[CONTACT] Apps Script rejected submission: ${text}`);
        return { ok: false, error: parsed?.error ?? "We could not send your message. Please try again." };
      }

      return { ok: true };
    } catch (err) {
      console.error("[CONTACT] Delivery error:", err);
      return { ok: false, error: "We could not send your message. Please try again." };
    }
  });
