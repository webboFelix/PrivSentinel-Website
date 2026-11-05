import { connection } from "next/server";
import { ensureDatabaseSchema, getLibsqlClient } from "@/db";
import { getPrincipal } from "@/lib/authorization";
import { getServerEnv } from "@/lib/env";
import { enforceRateLimit, enforceRateLimitBySubject, isSameOriginRequest } from "@/lib/rate-limit";

export async function POST(request: Request) {
  await connection();
  await ensureDatabaseSchema();
  if (!isSameOriginRequest(request)) {
    return Response.json({ error: "Request origin could not be verified." }, { status: 403 });
  }

  const env = getServerEnv();
  if (!env.INITIAL_SUPER_ADMIN_EMAIL) {
    return Response.json({ error: "Initial administrator setup is unavailable." }, { status: 404 });
  }

  const principal = await getPrincipal(request.headers);
  if (!principal) return Response.json({ error: "Sign in with the designated account first." }, { status: 401 });
  if (principal.actor.email.toLowerCase() !== env.INITIAL_SUPER_ADMIN_EMAIL) {
    return Response.json({ error: "This account is not eligible for administrator setup." }, { status: 403 });
  }
  const [addressAllowed, accountAllowed] = await Promise.all([
    enforceRateLimit(request, "super-admin-bootstrap", 5, 3600),
    enforceRateLimitBySubject("super-admin-bootstrap", principal.actor.id, 5, 3600),
  ]);
  if (!addressAllowed || !accountAllowed) {
    return Response.json({ error: "Too many setup attempts. Try again later." }, { status: 429 });
  }

  const client = getLibsqlClient();
  const transaction = await client.transaction("write");
  try {
    const bootstrap = await transaction.execute({
      sql: `SELECT "completedAt" FROM "admin_bootstrap" WHERE "id" = 'initial-super-admin'`,
    });
    if (bootstrap.rows[0]?.completedAt != null) {
      await transaction.commit();
      return Response.json({ error: "Initial administrator setup has already been completed." }, { status: 409 });
    }

    const target = await transaction.execute({
      sql: `SELECT "id", "emailVerified", "role" FROM "user" WHERE lower("email") = ? LIMIT 1`,
      args: [env.INITIAL_SUPER_ADMIN_EMAIL],
    });
    const targetAccount = target.rows[0];
    if (!targetAccount || String(targetAccount.id) !== principal.actor.id) {
      await transaction.rollback();
      return Response.json({ error: "Register and sign in with the designated initial administrator email first." }, { status: 403 });
    }
    if (Number(targetAccount.emailVerified) !== 1) {
      await transaction.rollback();
      return Response.json({ error: "Verify the designated account's email before setting up administrator access." }, { status: 403 });
    }
    const existing = await transaction.execute({
      sql: `SELECT "id" FROM "user" WHERE "role" = 'super_admin' LIMIT 1`,
    });
    if (existing.rows.length > 0 && String(existing.rows[0].id) !== principal.actor.id) {
      await transaction.rollback();
      return Response.json({ error: "A super administrator has already been configured." }, { status: 409 });
    }

    if (String(targetAccount.role) !== "super_admin") {
      const promoted = await transaction.execute({
        sql: `UPDATE "user" SET "role" = 'super_admin', "updatedAt" = ?
          WHERE "id" = ? AND "emailVerified" = 1 AND "role" IN ('user', 'admin') AND "banned" = 0`,
        args: [Date.now(), principal.actor.id],
      });
      if (promoted.rowsAffected !== 1) {
        await transaction.rollback();
        return Response.json({ error: "The designated account could not be promoted. Check that it is active and try again." }, { status: 409 });
      }
    }

    const now = Date.now();
    await transaction.execute({
      sql: `INSERT INTO "admin_bootstrap" ("id", "completedAt", "completedBy")
        VALUES ('initial-super-admin', ?, ?)
        ON CONFLICT("id") DO UPDATE SET "completedAt" = excluded."completedAt", "completedBy" = excluded."completedBy"`,
      args: [now, principal.actor.id],
    });
    await transaction.execute({
      sql: `INSERT INTO "audit_logs" ("id", "userId", "action", "resource", "timestamp", "targetType", "targetId", "metadata")
        VALUES (?, ?, 'admin.bootstrap.completed', 'admin_bootstrap', ?, 'user', ?, NULL)`,
      args: [crypto.randomUUID(), principal.actor.id, now, principal.actor.id],
    });
    await transaction.commit();
    return Response.json({ success: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}
