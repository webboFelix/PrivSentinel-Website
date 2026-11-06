import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { connection } from "next/server";
import { ensureDatabaseSchema, getDb } from "@/db";
import { auditLogs, contactMessages } from "@/db/schema";
import { isResponse, requireAdminApi } from "@/lib/admin-api";
import { getServerEnv } from "@/lib/env";
import { sendGmailEmail } from "@/lib/gmail-email";
import { isSameOriginRequest } from "@/lib/rate-limit";

const updateSchema = z.object({
  response: z.string().trim().min(1).max(5000).optional(),
  status: z.enum(["new", "in_progress", "responded", "closed"]).optional(),
}).strict().refine((value) => Number(value.response !== undefined) + Number(value.status !== undefined) === 1);

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;",
  })[character]!);
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  await connection();
  await ensureDatabaseSchema();
  if (!isSameOriginRequest(request)) {
    return Response.json({ error: "Request origin could not be verified." }, { status: 403 });
  }
  const principal = await requireAdminApi(request);
  if (isResponse(principal)) return principal;
  const { id } = await context.params;
  if (!id || id.length > 100) return Response.json({ error: "Contact message was not found." }, { status: 404 });

  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return Response.json({ error: "Provide a valid message update." }, { status: 400 });
  }
  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) return Response.json({ error: "Provide a reply or one valid status update." }, { status: 400 });

  const db = getDb();
  const message = await db.query.contactMessages.findFirst({
    where: eq(contactMessages.id, id),
  });
  if (!message) return Response.json({ error: "Contact message was not found." }, { status: 404 });

  if (parsed.data.response) {
    const env = getServerEnv();
    if (!env.GMAIL_SMTP_USER || !env.GMAIL_APP_PASSWORD) {
      return Response.json({ error: "Email reply delivery is not configured." }, { status: 503 });
    }
    const escapedResponse = escapeHtml(parsed.data.response).replace(/\n/g, "<br>");
    try {
      await sendGmailEmail({
        user: env.GMAIL_SMTP_USER,
        appPassword: env.GMAIL_APP_PASSWORD,
        to: message.email,
        subject: "Reply from PrivSentinel support",
        html: `<p>Hello ${escapeHtml(message.name)},</p><p>${escapedResponse}</p><p>PrivSentinel Support</p>`,
        text: `Hello ${message.name},\n\n${parsed.data.response}\n\nPrivSentinel Support`,
        operation: "contact-response",
      });
    } catch (error) {
      console.error("Could not send admin reply to contact message.", error);
      return Response.json({ error: "The reply could not be delivered. The message remains unchanged." }, { status: 502 });
    }
    await db.update(contactMessages).set({
      response: parsed.data.response,
      status: "responded",
      respondedBy: principal.actor.id,
      respondedAt: new Date(),
    }).where(eq(contactMessages.id, id));
  } else {
    await db.update(contactMessages).set({
      status: parsed.data.status!,
      respondedBy: principal.actor.id,
      respondedAt: parsed.data.status === "closed" ? new Date() : null,
    }).where(eq(contactMessages.id, id));
  }
  await db.insert(auditLogs).values({
    id: randomUUID(),
    userId: principal.actor.id,
    action: parsed.data.response ? "admin.contact.replied" : "admin.contact.status_changed",
    resource: "contact",
    targetType: "contact_message",
    targetId: id,
  });
  return Response.json({ success: true });
}
