import { randomUUID } from "node:crypto";
import { inArray } from "drizzle-orm";
import { connection } from "next/server";
import { z } from "zod";
import { ensureDatabaseSchema, getDb } from "@/db";
import { contactMessages, user } from "@/db/schema";
import { getServerEnv } from "@/lib/env";
import { sendGmailEmail } from "@/lib/gmail-email";
import { enforceRateLimit, isSameOriginRequest } from "@/lib/rate-limit";
import { clientIpFromRequest, isIpBlocked } from "@/lib/security-events";

const contactSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
  message: z.string().trim().min(10).max(5000),
}).strict();

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;",
  })[character]!);
}

export async function POST(request: Request) {
  await connection();
  await ensureDatabaseSchema();
  if (!isSameOriginRequest(request)) {
    return Response.json({ error: "Request origin could not be verified." }, { status: 403 });
  }
  if (await isIpBlocked(clientIpFromRequest(request))) {
    return Response.json({ error: "Requests from this network are blocked." }, { status: 403 });
  }
  if (!(await enforceRateLimit(request, "contact-message", 5, 3600))) {
    return Response.json({ error: "Too many contact messages. Please try again later." }, { status: 429 });
  }

  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return Response.json({ error: "Provide valid contact details." }, { status: 400 });
  }
  const parsed = contactSchema.safeParse(input);
  if (!parsed.success) {
    return Response.json({
      error: "Check your name, email address, and message, then try again.",
      fields: parsed.error.flatten().fieldErrors,
    }, { status: 400 });
  }

  const { name, email, message } = parsed.data;
  await getDb().insert(contactMessages).values({
    id: randomUUID(),
    name,
    email,
    message,
  });

  const env = getServerEnv();
  const admins = await getDb().select({ email: user.email }).from(user)
    .where(inArray(user.role, ["admin", "super_admin"]))
    .limit(50);
  const recipients = [...new Set([
    ...admins.map((admin) => admin.email),
    ...(env.INITIAL_SUPER_ADMIN_EMAIL ? [env.INITIAL_SUPER_ADMIN_EMAIL] : []),
  ])];
  if (!env.GMAIL_SMTP_USER || !env.GMAIL_APP_PASSWORD || recipients.length === 0) {
    return Response.json({
      success: true,
      notificationSent: false,
      message: "Your message was saved, but admin email notification is not configured yet.",
    }, { status: 202 });
  }

  const escapedName = escapeHtml(name);
  const escapedEmail = escapeHtml(email);
  const escapedMessage = escapeHtml(message).replace(/\n/g, "<br>");
  try {
    await Promise.all(recipients.map((to) => sendGmailEmail({
      user: env.GMAIL_SMTP_USER!,
      appPassword: env.GMAIL_APP_PASSWORD!,
      to,
      subject: `New PrivSentinel contact message from ${name}`,
      html: `<h2>New contact message</h2><p><strong>${escapedName}</strong> · <a href="mailto:${escapedEmail}">${escapedEmail}</a></p><p>${escapedMessage}</p><p>Open the admin console to reply.</p>`,
      text: `New contact message from ${name} (${email}):\n\n${message}\n\nOpen the admin console to reply.`,
      operation: "contact-notification",
    })));
  } catch (error) {
    console.error("Contact message was saved, but admin notification could not be delivered.", error);
    return Response.json({
      success: true,
      notificationSent: false,
      message: "Your message was saved, but admin email notification could not be delivered. You may also contact us by WhatsApp or phone.",
    }, { status: 202 });
  }

  return Response.json({
    success: true,
    notificationSent: true,
    message: "Your message was sent to the PrivSentinel team.",
  }, { status: 201 });
}
