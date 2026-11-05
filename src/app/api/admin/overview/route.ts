import { and, count, desc, eq, gt, isNull, lte, or } from "drizzle-orm";
import { connection } from "next/server";
import { ensureDatabaseSchema, getDb } from "@/db";
import { auditLogs, downloads, releases, user } from "@/db/schema";
import { isResponse, requireAdminApi } from "@/lib/admin-api";

export async function GET(request: Request) {
  await connection();
  await ensureDatabaseSchema();
  const principal = await requireAdminApi(request);
  if (isResponse(principal)) return principal;

  const db = getDb();
  const now = new Date();
  const activeCondition = or(
    eq(user.banned, false),
    and(eq(user.banned, true), lte(user.banExpires, now)),
  );
  const [totalUsers, activeUsers, totalDownloads, roleCounts, latestRegistrations, recentActivity, suspendedUsers] =
    await Promise.all([
      db.select({ value: count() }).from(user),
      db.select({ value: count() }).from(user).where(activeCondition),
      db.select({ value: count() }).from(downloads),
      db.select({ role: user.role, value: count() }).from(user).groupBy(user.role),
      db.select({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt,
      }).from(user)
        .orderBy(desc(user.createdAt))
        .limit(8),
      db.select({
        id: auditLogs.id,
        action: auditLogs.action,
        resource: auditLogs.resource,
        timestamp: auditLogs.timestamp,
        actorEmail: user.email,
      }).from(auditLogs)
        .leftJoin(user, eq(auditLogs.userId, user.id))
        .orderBy(desc(auditLogs.timestamp))
        .limit(12),
      db.select({ value: count() }).from(user).where(
        and(eq(user.banned, true), or(gt(user.banExpires, now), isNull(user.banExpires))),
      ),
    ]);

  return Response.json({
    totals: {
      users: totalUsers[0]?.value ?? 0,
      activeUsers: activeUsers[0]?.value ?? 0,
      suspendedUsers: suspendedUsers[0]?.value ?? 0,
      downloads: totalDownloads[0]?.value ?? 0,
    },
    roleDistribution: Object.fromEntries(roleCounts.map((entry) => [entry.role, entry.value])),
    latestRegistrations,
    recentActivity,
    releases: (await db.select({ value: count() }).from(releases))[0]?.value ?? 0,
  }, { headers: { "Cache-Control": "no-store" } });
}
