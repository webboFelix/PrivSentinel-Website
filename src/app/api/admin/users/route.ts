import { and, count, desc, eq, gt, inArray, isNull, like, lte, max, or } from "drizzle-orm";
import { connection } from "next/server";
import { ensureDatabaseSchema, getDb } from "@/db";
import { auditLogs, session, user } from "@/db/schema";
import { isResponse, requireAdminApi } from "@/lib/admin-api";

const roles = new Set(["user", "admin", "super_admin"]);

function boundedInteger(value: string | null, fallback: number, maximum: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? Math.min(parsed, maximum) : fallback;
}

export async function GET(request: Request) {
  await connection();
  await ensureDatabaseSchema();
  const principal = await requireAdminApi(request);
  if (isResponse(principal)) return principal;

  const params = new URL(request.url).searchParams;
  const search = (params.get("search") ?? "").trim().replace(/[%_]/g, "").slice(0, 100);
  const roleFilter = params.get("role");
  const statusFilter = params.get("status");
  const limit = boundedInteger(params.get("limit"), 25, 100) || 25;
  const offset = boundedInteger(params.get("offset"), 0, 100_000);
  if (roleFilter && !roles.has(roleFilter)) {
    return Response.json({ error: "Select a valid role filter." }, { status: 400 });
  }
  if (statusFilter && !["active", "suspended"].includes(statusFilter)) {
    return Response.json({ error: "Select a valid account status filter." }, { status: 400 });
  }

  const now = new Date();
  const filters = [
    search ? or(like(user.name, `%${search}%`), like(user.email, `%${search}%`)) : undefined,
    roleFilter ? eq(user.role, roleFilter) : undefined,
    statusFilter === "suspended"
      ? and(eq(user.banned, true), or(gt(user.banExpires, now), isNull(user.banExpires)))
      : statusFilter === "active"
        ? or(eq(user.banned, false), and(eq(user.banned, true), lte(user.banExpires, now)))
        : undefined,
  ].filter((condition) => condition !== undefined);
  const where = filters.length ? and(...filters) : undefined;
  const db = getDb();

  const [total, rows] = await Promise.all([
    db.select({ value: count() }).from(user).where(where),
    db.select({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
      banned: user.banned,
      banExpires: user.banExpires,
    }).from(user)
      .where(where)
      .orderBy(desc(user.createdAt))
      .limit(limit)
      .offset(offset),
  ]);
  const ids = rows.map((row) => row.id);
  const lastSessions = ids.length
    ? await db.select({
        userId: session.userId,
        lastLoginAt: max(session.createdAt),
      }).from(session)
        .where(inArray(session.userId, ids))
        .groupBy(session.userId)
    : [];
  const lastLoginByUser = new Map(lastSessions.map((entry) => [entry.userId, entry.lastLoginAt]));
  const lastLoginEvents = ids.length
    ? await db.select({
        userId: auditLogs.userId,
        lastLoginAt: max(auditLogs.timestamp),
      }).from(auditLogs)
        .where(and(
          inArray(auditLogs.userId, ids),
          inArray(auditLogs.action, ["auth.login.succeeded", "auth.admin_login.succeeded"]),
        ))
        .groupBy(auditLogs.userId)
    : [];
  for (const entry of lastLoginEvents) {
    if (entry.userId && entry.lastLoginAt) lastLoginByUser.set(entry.userId, entry.lastLoginAt);
  }

  return Response.json({
    total: total[0]?.value ?? 0,
    limit,
    offset,
    users: rows.map((row) => ({
      ...row,
      displayName: row.name,
      status: row.banned && (!row.banExpires || row.banExpires > now) ? "suspended" : "active",
      lastLoginAt: lastLoginByUser.get(row.id) ?? null,
    })),
  }, { headers: { "Cache-Control": "no-store" } });
}
