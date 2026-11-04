import { createHash } from "node:crypto";
import { getLibsqlClient } from "@/db";

export async function enforceRateLimit(
  request: Request,
  scope: string,
  limit: number,
  windowSeconds: number,
) {
  const forwarded = request.headers.get("x-forwarded-for");
  const address = forwarded?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
  const addressHash = createHash("sha256").update(address).digest("hex");
  const key = `${scope}:${addressHash}`;
  const now = Math.floor(Date.now() / 1000);
  const cutoff = now - windowSeconds;
  const result = await getLibsqlClient().execute({
    sql: `INSERT INTO "rate_limits" ("key", "windowStart", "count")
      VALUES (?, ?, 1)
      ON CONFLICT("key") DO UPDATE SET
        "count" = CASE WHEN "windowStart" <= ? THEN 1 ELSE "count" + 1 END,
        "windowStart" = CASE WHEN "windowStart" <= ? THEN ? ELSE "windowStart" END
      RETURNING "count"`,
    args: [key, now, cutoff, cutoff, now],
  });

  return Number(result.rows[0]?.count ?? 0) <= limit;
}

export function isSameOriginRequest(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    const originUrl = new URL(origin);
    const requestUrl = new URL(request.url);
    return originUrl.origin === requestUrl.origin;
  } catch {
    return false;
  }
}
