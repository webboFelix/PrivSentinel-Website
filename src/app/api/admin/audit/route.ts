import { desc, eq, like } from "drizzle-orm";
import { connection } from "next/server";
import { ensureDatabaseSchema, getDb } from "@/db";
import { auditLogs, user } from "@/db/schema";
import { isResponse, requireAdminApi } from "@/lib/admin-api";

export async function GET(request: Request) {
  await connection();
  await ensureDatabaseSchema();
  const principal = await requireAdminApi(request);
  if (isResponse(principal)) return principal;

  const action = new URL(request.url).searchParams.get("action")?.slice(0, 100);
  const rows = await getDb().select({
    id: auditLogs.id,
    action: auditLogs.action,
    resource: auditLogs.resource,
    targetType: auditLogs.targetType,
    targetId: auditLogs.targetId,
    timestamp: auditLogs.timestamp,
    metadata: auditLogs.metadata,
    actorEmail: user.email,
  }).from(auditLogs)
    .leftJoin(user, eq(auditLogs.userId, user.id))
    .where(action ? like(auditLogs.action, `%${action}%`) : undefined)
    .orderBy(desc(auditLogs.timestamp))
    .limit(100);
  return Response.json({ events: rows }, { headers: { "Cache-Control": "no-store" } });
}
