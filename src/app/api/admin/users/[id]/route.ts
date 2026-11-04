import { and, count, desc, eq, inArray, or } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { connection } from "next/server";
import { ensureDatabaseSchema, getDb, getLibsqlClient } from "@/db";
import { auditLogs, downloads, profileDetails, profiles, session, user } from "@/db/schema";
import { isResponse, requireAdminApi } from "@/lib/admin-api";
import { canManageRole, isAccountSuspended } from "@/lib/permissions";
import { enforceRateLimit, isSameOriginRequest } from "@/lib/rate-limit";

const changeSchema = z.object({
  role: z.enum(["user", "admin", "super_admin"]).optional(),
  suspended: z.boolean().optional(),
  reason: z.string().trim().max(300).optional(),
}).strict().refine((value) => Number(value.role !== undefined) + Number(value.suspended !== undefined) === 1);

export async function GET(request: Request, context: RouteContext<"/api/admin/users/[id]">) {
  await connection();
  await ensureDatabaseSchema();
  const principal = await requireAdminApi(request);
  if (isResponse(principal)) return principal;
  const { id } = await context.params;
  if (!id || id.length > 200) return Response.json({ error: "User was not found." }, { status: 404 });

  const db = getDb();
  const account = await db.select({
    id: user.id,
    name: user.name,
    fullName: profiles.fullName,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt,
    emailVerified: user.emailVerified,
    banned: user.banned,
    banReason: user.banReason,
    banExpires: user.banExpires,
    phoneNumber: profiles.phoneNumber,
    organization: profileDetails.organization,
    currentPosition: profileDetails.currentPosition,
  }).from(user)
    .leftJoin(profiles, eq(user.id, profiles.userId))
    .leftJoin(profileDetails, eq(user.id, profileDetails.userId))
    .where(eq(user.id, id))
    .limit(1);
  const target = account[0];
  if (!target) return Response.json({ error: "User was not found." }, { status: 404 });

  const [lastLogin, lastLoginEvent, downloadCount, activity] = await Promise.all([
    db.select({ value: session.createdAt }).from(session)
      .where(eq(session.userId, id))
      .orderBy(desc(session.createdAt))
      .limit(1),
    db.select({ value: auditLogs.timestamp }).from(auditLogs)
      .where(and(
        eq(auditLogs.userId, id),
        inArray(auditLogs.action, ["auth.login.succeeded", "auth.admin_login.succeeded"]),
      ))
      .orderBy(desc(auditLogs.timestamp))
      .limit(1),
    db.select({ value: count() }).from(downloads).where(eq(downloads.userId, id)),
    db.select({
      id: auditLogs.id,
      action: auditLogs.action,
      resource: auditLogs.resource,
      timestamp: auditLogs.timestamp,
      metadata: auditLogs.metadata,
    }).from(auditLogs)
      .where(or(
        eq(auditLogs.userId, id),
        and(eq(auditLogs.targetType, "user"), eq(auditLogs.targetId, id)),
      ))
      .orderBy(desc(auditLogs.timestamp))
      .limit(30),
  ]);
  const now = new Date();
  return Response.json({
    user: {
      ...target,
      displayName: target.fullName || target.name,
      status: isAccountSuspended(target, now.getTime()) ? "suspended" : "active",
      lastLoginAt: lastLoginEvent[0]?.value ?? lastLogin[0]?.value ?? null,
      downloadCount: downloadCount[0]?.value ?? 0,
    },
    activity,
  }, { headers: { "Cache-Control": "no-store" } });
}

export async function PATCH(request: Request, context: RouteContext<"/api/admin/users/[id]">) {
  await connection();
  await ensureDatabaseSchema();
  if (!isSameOriginRequest(request)) {
    return Response.json({ error: "Request origin could not be verified." }, { status: 403 });
  }
  const principal = await requireAdminApi(request);
  if (isResponse(principal)) return principal;
  if (!(await enforceRateLimit(request, `admin-user-update:${principal.actor.id}`, 60, 3600))) {
    return Response.json({ error: "Too many account management requests. Try again later." }, { status: 429 });
  }

  const { id } = await context.params;
  if (!id || id.length > 200) return Response.json({ error: "User was not found." }, { status: 404 });
  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return Response.json({ error: "Provide a valid account change." }, { status: 400 });
  }
  const parsed = changeSchema.safeParse(input);
  if (!parsed.success) {
    return Response.json({ error: "Provide exactly one valid role or account-status change." }, { status: 400 });
  }
  if (parsed.data.suspended === true && (!parsed.data.reason || parsed.data.reason.length < 5)) {
    return Response.json({ error: "Provide a suspension reason of at least five characters." }, { status: 400 });
  }

  const client = getLibsqlClient();
  const transaction = await client.transaction("write");
  try {
    const result = await transaction.execute({
      sql: `SELECT "id", "role", "banned", "banExpires" FROM "user" WHERE "id" = ? LIMIT 1`,
      args: [id],
    });
    const target = result.rows[0];
    if (!target) {
      await transaction.rollback();
      return Response.json({ error: "User was not found." }, { status: 404 });
    }

    const targetRole = String(target.role);
    const targetUser = { id, role: targetRole };
    if (!canManageRole(principal.actor, targetUser, parsed.data.role ?? targetRole)) {
      await transaction.rollback();
      return Response.json({ error: "You are not authorized to change this account." }, { status: 403 });
    }
    if (parsed.data.suspended !== undefined &&
        (principal.actor.id === id || (principal.actor.role !== "super_admin" && targetRole !== "user"))) {
      await transaction.rollback();
      return Response.json({ error: "You are not authorized to change this account status." }, { status: 403 });
    }

    const wasSuspended = isAccountSuspended({
      banned: Boolean(target.banned),
      banExpires: target.banExpires ? new Date(Number(target.banExpires)) : null,
    });
    const suspendingSuperAdmin = targetRole === "super_admin" &&
      (parsed.data.role !== undefined && parsed.data.role !== "super_admin" ||
        parsed.data.suspended === true && !wasSuspended);
    if (suspendingSuperAdmin) {
      const activeSupers = await transaction.execute({
        sql: `SELECT COUNT(*) AS "count" FROM "user"
          WHERE "role" = 'super_admin'
          AND ("banned" = 0 OR "banExpires" IS NOT NULL AND "banExpires" <= ?)`,
        args: [Date.now()],
      });
      if (Number(activeSupers.rows[0]?.count ?? 0) <= 1) {
        await transaction.rollback();
        return Response.json({ error: "At least one active super administrator must remain." }, { status: 409 });
      }
    }

    const now = Date.now();
    let action: string;
    let metadata: Record<string, unknown>;
    if (parsed.data.role !== undefined) {
      await transaction.execute({
        sql: `UPDATE "user" SET "role" = ?, "updatedAt" = ? WHERE "id" = ?`,
        args: [parsed.data.role, now, id],
      });
      action = "admin.user.role_changed";
      metadata = { previousRole: targetRole, role: parsed.data.role };
    } else if (parsed.data.suspended) {
      await transaction.execute({
        sql: `UPDATE "user" SET "banned" = 1, "banReason" = ?, "banExpires" = NULL, "updatedAt" = ? WHERE "id" = ?`,
        args: [parsed.data.reason!, now, id],
      });
      await transaction.execute({ sql: `DELETE FROM "session" WHERE "userId" = ?`, args: [id] });
      action = "admin.user.suspended";
      metadata = { reason: parsed.data.reason };
    } else {
      await transaction.execute({
        sql: `UPDATE "user" SET "banned" = 0, "banReason" = NULL, "banExpires" = NULL, "updatedAt" = ? WHERE "id" = ?`,
        args: [now, id],
      });
      action = "admin.user.reactivated";
      metadata = {};
    }

    await transaction.execute({
      sql: `INSERT INTO "audit_logs" ("id", "userId", "action", "resource", "timestamp", "targetType", "targetId", "metadata")
        VALUES (?, ?, ?, 'user', ?, 'user', ?, ?)`,
      args: [randomUUID(), principal.actor.id, action, now, id, JSON.stringify(metadata)],
    });
    await transaction.commit();
    return Response.json({ success: true, action }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}
