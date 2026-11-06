import { createHash } from "node:crypto";
import { getLibsqlClient } from "@/db";

export type RateLimitCheck = { allowed: boolean; retryAfterSeconds: number };

async function consumeRateLimit(key: string, limit: number, windowSeconds: number) {
  const now = Math.floor(Date.now() / 1000);
  const cutoff = now - windowSeconds;
  const result = await getLibsqlClient().execute({
    sql: `INSERT INTO "rate_limits" ("key", "windowStart", "count")
      VALUES (?, ?, 1)
      ON CONFLICT("key") DO UPDATE SET
        "count" = CASE WHEN "windowStart" <= ? THEN 1 ELSE "count" + 1 END,
        "windowStart" = CASE WHEN "windowStart" <= ? THEN ? ELSE "windowStart" END
      RETURNING "count", "windowStart"`,
    args: [key, now, cutoff, cutoff, now],
  });

  const row = result.rows[0];
  const allowed = Number(row?.count ?? 0) <= limit;
  const windowStart = Number(row?.windowStart ?? now);
  return {
    allowed,
    retryAfterSeconds: allowed ? 0 : Math.max(1, windowStart + windowSeconds - now),
  };
}

export async function checkRateLimit(
  request: Request,
  scope: string,
  limit: number,
  windowSeconds: number,
): Promise<RateLimitCheck> {
  const forwarded = request.headers.get("x-vercel-forwarded-for")
    || request.headers.get("x-real-ip")
    || request.headers.get("x-forwarded-for");
  const address = forwarded?.split(",")[0]?.trim()
    || "unknown";
  const addressHash = createHash("sha256").update(address).digest("hex");
  return consumeRateLimit(`${scope}:${addressHash}`, limit, windowSeconds);
}

export async function checkRateLimitBySubject(
  scope: string,
  subject: string,
  limit: number,
  windowSeconds: number,
): Promise<RateLimitCheck> {
  const subjectHash = createHash("sha256").update(subject).digest("hex");
  return consumeRateLimit(`${scope}:${subjectHash}`, limit, windowSeconds);
}

export async function enforceRateLimit(
  request: Request,
  scope: string,
  limit: number,
  windowSeconds: number,
) {
  return (await checkRateLimit(request, scope, limit, windowSeconds)).allowed;
}

export async function enforceRateLimitBySubject(
  scope: string,
  subject: string,
  limit: number,
  windowSeconds: number,
) {
  return (await checkRateLimitBySubject(scope, subject, limit, windowSeconds)).allowed;
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
