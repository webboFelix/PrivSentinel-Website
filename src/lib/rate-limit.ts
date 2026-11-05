import { createHash } from "node:crypto";
import { getLibsqlClient } from "@/db";

async function consumeRateLimit(key: string, limit: number, windowSeconds: number) {
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

export async function enforceRateLimit(
  request: Request,
  scope: string,
  limit: number,
  windowSeconds: number,
) {
  const forwarded = request.headers.get("x-vercel-forwarded-for")
    || request.headers.get("x-real-ip")
    || request.headers.get("x-forwarded-for");
  const address = forwarded?.split(",")[0]?.trim()
    || "unknown";
  const addressHash = createHash("sha256").update(address).digest("hex");
  return consumeRateLimit(`${scope}:${addressHash}`, limit, windowSeconds);
}

export async function enforceRateLimitBySubject(
  scope: string,
  subject: string,
  limit: number,
  windowSeconds: number,
) {
  const subjectHash = createHash("sha256").update(subject).digest("hex");
  return consumeRateLimit(`${scope}:${subjectHash}`, limit, windowSeconds);
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
