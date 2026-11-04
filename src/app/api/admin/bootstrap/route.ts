import { connection } from "next/server";
import { ensureDatabaseSchema, getLibsqlClient } from "@/db";
import { getPrincipal } from "@/lib/authorization";
import { getServerEnv } from "@/lib/env";
import { enforceRateLimit, isSameOriginRequest } from "@/lib/rate-limit";

async function matchesSecret(provided: string, expected: string) {
  const encoder = new TextEncoder();
  const [providedDigest, expectedDigest] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(provided)),
    crypto.subtle.digest("SHA-256", encoder.encode(expected)),
  ]);
  const providedBytes = new Uint8Array(providedDigest);
  const expectedBytes = new Uint8Array(expectedDigest);
  let difference = 0;
  for (let index = 0; index < providedBytes.length; index += 1) {
    difference |= providedBytes[index] ^ expectedBytes[index];
  }
  return difference === 0;
}

export async function POST(request: Request) {
  await connection();
  await ensureDatabaseSchema();
  if (!isSameOriginRequest(request)) {
    return Response.json({ error: "Request origin could not be verified." }, { status: 403 });
  }

  const env = getServerEnv();
  if (!env.INITIAL_SUPER_ADMIN_EMAIL || !env.SUPER_ADMIN_BOOTSTRAP_SECRET) {
    return Response.json({ error: "Initial administrator setup is unavailable." }, { status: 404 });
  }

  const principal = await getPrincipal(request.headers);
  if (!principal) return Response.json({ error: "Sign in with the designated account first." }, { status: 401 });
  if (principal.actor.email.toLowerCase() !== env.INITIAL_SUPER_ADMIN_EMAIL) {
    return Response.json({ error: "This account is not eligible for administrator setup." }, { status: 403 });
  }
  if (!(await enforceRateLimit(request, `super-admin-bootstrap:${principal.actor.id}`, 3, 3600))) {
    return Response.json({ error: "Too many setup attempts. Try again later." }, { status: 429 });
  }

  const providedSecret = request.headers.get("x-super-admin-bootstrap-secret") ?? "";
  if (!(await matchesSecret(providedSecret, env.SUPER_ADMIN_BOOTSTRAP_SECRET))) {
    return Response.json({ error: "The bootstrap credential is invalid." }, { status: 403 });
  }

  const client = getLibsqlClient();
  const transaction = await client.transaction("write");
  try {
    const bootstrap = await transaction.execute({
      sql: `SELECT "completedAt" FROM "admin_bootstrap" WHERE "id" = 'initial-super-admin'`,
    });
    if (bootstrap.rows[0]?.completedAt != null) {
      await transaction.commit();
      return Response.json({ success: true, alreadyInitialized: true }, {
        headers: { "Cache-Control": "no-store" },
      });
    }

    const target = await transaction.execute({
      sql: `SELECT "id" FROM "user" WHERE lower("email") = ? LIMIT 1`,
      args: [env.INITIAL_SUPER_ADMIN_EMAIL],
    });
    if (String(target.rows[0]?.id ?? "") !== principal.actor.id) {
      await transaction.rollback();
      return Response.json({ error: "The designated account must be registered before setup." }, { status: 403 });
    }

    const existing = await transaction.execute({
      sql: `SELECT "id" FROM "user" WHERE "role" = 'super_admin' LIMIT 1`,
    });
    if (existing.rows.length > 0) {
      await transaction.rollback();
      return Response.json({ error: "A super administrator has already been configured." }, { status: 409 });
    }

    const promoted = await transaction.execute({
      sql: `UPDATE "user" SET "role" = 'super_admin', "updatedAt" = ?
        WHERE "id" = ? AND "role" IN ('user', 'admin') AND "banned" = 0`,
      args: [Date.now(), principal.actor.id],
    });
    if (promoted.rowsAffected !== 1) {
      await transaction.rollback();
      return Response.json({ error: "The designated account could not be promoted." }, { status: 409 });
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
