import { randomUUID } from "node:crypto";
import { desc, eq } from "drizzle-orm";
import { isIP } from "node:net";
import { z } from "zod";
import { connection } from "next/server";
import { ensureDatabaseSchema, getDb } from "@/db";
import { blockedIps, securityEvents } from "@/db/schema";
import { isResponse, requireAdminApi } from "@/lib/admin-api";
import { getServerEnv } from "@/lib/env";
import { sendGmailEmail } from "@/lib/gmail-email";
import { isSameOriginRequest } from "@/lib/rate-limit";

const securityActionSchema = z.object({
  action: z.enum(["block", "unblock"]),
  ipAddress: z.string().trim().refine((value) => isIP(value) > 0, "Enter a valid IP address."),
  reason: z.string().trim().min(5).max(300).optional(),
}).strict();

export async function GET(request: Request) {
  await connection();
  await ensureDatabaseSchema();
  const principal = await requireAdminApi(request, true);
  if (isResponse(principal)) return principal;

  const db = getDb();
  const [events, blocked] = await Promise.all([
    db.select().from(securityEvents).orderBy(desc(securityEvents.createdAt)).limit(100),
    db.select().from(blockedIps).orderBy(desc(blockedIps.blockedAt)).limit(500),
  ]);
  return Response.json({ events, blockedIps: blocked }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  await connection();
  await ensureDatabaseSchema();
  if (!isSameOriginRequest(request)) {
    return Response.json({ error: "Request origin could not be verified." }, { status: 403 });
  }
  const principal = await requireAdminApi(request, true);
  if (isResponse(principal)) return principal;

  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return Response.json({ error: "Provide a valid security action." }, { status: 400 });
  }
  const parsed = securityActionSchema.safeParse(input);
  if (!parsed.success || (parsed.data.action === "block" && !parsed.data.reason)) {
    return Response.json({ error: "Provide a valid IP action and a reason of at least five characters when blocking." }, { status: 400 });
  }

  const { action, ipAddress } = parsed.data;
  const now = Date.now();
  const db = getDb();
  if (action === "block") {
    await db.insert(blockedIps).values({
      ipAddress,
      reason: parsed.data.reason!,
      blockedBy: principal.actor.id,
      blockedAt: new Date(now),
    }).onConflictDoUpdate({
      target: blockedIps.ipAddress,
      set: {
        reason: parsed.data.reason!,
        blockedBy: principal.actor.id,
        blockedAt: new Date(now),
      },
    });
  } else {
    await db.delete(blockedIps).where(eq(blockedIps.ipAddress, ipAddress));
  }

  await db.insert(securityEvents).values({
    id: randomUUID(),
    email: principal.actor.email,
    name: principal.actor.name,
    ipAddress,
    action: action === "block" ? "admin.ip_blocked" : "admin.ip_unblocked",
    createdAt: new Date(now),
  });

  const recipients = await db.selectDistinct({
    email: securityEvents.email,
  }).from(securityEvents)
    .where(eq(securityEvents.ipAddress, ipAddress))
    .limit(50);
  const affectedEmails = recipients.flatMap((recipient) =>
    recipient.email && recipient.email !== principal.actor.email ? [recipient.email] : [],
  );
  const env = getServerEnv();
  let notificationSent = false;
  if (affectedEmails.length && env.GMAIL_SMTP_USER && env.GMAIL_APP_PASSWORD) {
    const escapedIp = ipAddress.replace(/[&<>"']/g, "");
    const status = action === "block" ? "blocked" : "unblocked";
    const reason = parsed.data.reason?.replace(/[&<>"']/g, "") ?? "An administrator reviewed recent security activity.";
    try {
      await Promise.all(affectedEmails.map((email) => sendGmailEmail({
        user: env.GMAIL_SMTP_USER!,
        appPassword: env.GMAIL_APP_PASSWORD!,
        to: email,
        subject: `PrivSentinel sign-in access ${status}`,
        html: `<p>Sign-in access from IP address <strong>${escapedIp}</strong> was ${status} by an administrator.</p><p>${reason}</p>`,
        text: `Sign-in access from IP address ${ipAddress} was ${status} by an administrator.\n${reason}`,
        operation: "security-notice",
      })));
      notificationSent = true;
    } catch (error) {
      console.error("Could not send security action notification.", error);
    }
  }

  return Response.json({
    success: true,
    notificationSent,
    notificationWarning: affectedEmails.length && !notificationSent
      ? "The IP action was saved, but user notification could not be delivered."
      : null,
  });
}
