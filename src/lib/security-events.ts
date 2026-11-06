import { createHash, randomUUID } from "node:crypto";
import { isIP } from "node:net";
import { getLibsqlClient } from "@/db";

const signInFailureLimit = 10;
const signInFailureWindowSeconds = 15 * 60;

export function clientIpFromRequest(request: Request) {
  return clientIpFromHeaders(request.headers);
}

export function clientIpFromHeaders(headers: Headers) {
  const forwardedIp = headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim()
    || headers.get("x-real-ip")?.trim();
  return forwardedIp && isIP(forwardedIp) ? forwardedIp : null;
}

export async function isIpBlocked(ipAddress: string | null) {
  if (!ipAddress) return false;
  const result = await getLibsqlClient().execute({
    sql: `SELECT 1 FROM "blocked_ips" WHERE "ipAddress" = ? LIMIT 1`,
    args: [ipAddress],
  });
  return result.rows.length > 0;
}

export async function recordFailedSignIn(input: {
  request: Request;
  user?: { id: string; email: string; name: string } | null;
}) {
  const ipAddress = clientIpFromRequest(input.request);
  if (!ipAddress) return { blocked: false, ipAddress: null };

  const client = getLibsqlClient();
  const nowSeconds = Math.floor(Date.now() / 1000);
  const cutoff = nowSeconds - signInFailureWindowSeconds;
  const ipHash = createHash("sha256").update(ipAddress).digest("hex");
  const attempt = await client.execute({
    sql: `INSERT INTO "rate_limits" ("key", "windowStart", "count")
      VALUES (?, ?, 1)
      ON CONFLICT("key") DO UPDATE SET
        "count" = CASE WHEN "windowStart" <= ? THEN 1 ELSE "count" + 1 END,
        "windowStart" = CASE WHEN "windowStart" <= ? THEN ? ELSE "windowStart" END
      RETURNING "count"`,
    args: [`signin-failure:${ipHash}`, nowSeconds, cutoff, cutoff, nowSeconds],
  });
  const count = Number(attempt.rows[0]?.count ?? 1);
  const blocked = count >= signInFailureLimit;
  const now = Date.now();
  const userAgent = input.request.headers.get("user-agent")?.slice(0, 512) ?? null;

  await client.batch([
    {
      sql: `INSERT INTO "security_events"
        ("id", "userId", "email", "name", "ipAddress", "userAgent", "action", "createdAt")
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        randomUUID(),
        input.user?.id ?? null,
        input.user?.email ?? null,
        input.user?.name ?? null,
        ipAddress,
        userAgent,
        blocked ? "auth.ip_auto_blocked" : "auth.sign_in_failed",
        now,
      ],
    },
    ...(blocked ? [{
      sql: `INSERT OR IGNORE INTO "blocked_ips" ("ipAddress", "reason", "blockedBy", "blockedAt")
        VALUES (?, ?, NULL, ?)`,
      args: [ipAddress, `Automatically blocked after ${signInFailureLimit} failed sign-in attempts within 15 minutes.`, now],
    }] : []),
  ], "write");
  return { blocked, ipAddress };
}
