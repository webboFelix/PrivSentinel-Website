import { eq } from "drizzle-orm";
import { connection } from "next/server";
import { ensureDatabaseSchema, getDb } from "@/db";
import { user } from "@/db/schema";
import { getAuth } from "@/lib/auth";
import { recordAudit } from "@/lib/authorization";
import { getAuthConfigurationStatus } from "@/lib/env";
import { isAdministrator } from "@/lib/permissions";
import { clientIpFromRequest, isIpBlocked, recordFailedSignIn } from "@/lib/security-events";

async function handleAuthRequest(request: Request) {
  await connection();
  const configuration = getAuthConfigurationStatus();
  if (!configuration.available) {
    return Response.json(
      {
        error: "Authentication is temporarily unavailable. Please contact the site administrator.",
        code: "auth_not_configured",
      },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
  await ensureDatabaseSchema();

  const path = new URL(request.url).pathname;
  let attemptedAdminId: string | null = null;
  let attemptedUser: { id: string; email: string; name: string; role: string } | null = null;
  const isEmailSignIn = request.method === "POST" && path.endsWith("/sign-in/email");
  if (isEmailSignIn && await isIpBlocked(clientIpFromRequest(request))) {
    return Response.json({
      error: "Sign-in from this network has been blocked. Contact support if you believe this is a mistake.",
      code: "IP_BLOCKED",
    }, { status: 403, headers: { "Cache-Control": "no-store" } });
  }
  if (isEmailSignIn) {
    let body: unknown;
    try {
      body = await request.clone().json();
    } catch (error) {
      if (!(error instanceof SyntaxError)) throw error;
    }
    if (typeof body === "object" && body !== null && "email" in body && typeof body.email === "string") {
      const email = body.email.trim().toLowerCase();
      const account = await getDb().query.user.findFirst({
        columns: { id: true, role: true, email: true, name: true },
        where: eq(user.email, email),
      });
      if (account) {
        attemptedUser = account;
        if (isAdministrator(account)) attemptedAdminId = account.id;
      }
    }
  }

  try {
    const response = await getAuth().handler(request);
    if (isEmailSignIn && response.status === 401) {
      const failure = await recordFailedSignIn({ request, user: attemptedUser });
      if (failure.blocked) {
        return Response.json({
          error: "Sign-in from this network has been blocked after repeated failed attempts. Contact support if you believe this is a mistake.",
          code: "IP_BLOCKED",
        }, { status: 429, headers: { "Cache-Control": "no-store" } });
      }
    }
    if (attemptedAdminId && response.status >= 400) {
      await recordAudit({
        action: "auth.admin_login.failed",
        resource: "auth",
        targetType: "user",
        targetId: attemptedAdminId,
        metadata: { method: "email", status: response.status },
      });
    }
    return response;
  } catch (error) {
    console.error("Authentication request failed.", error);
    return Response.json(
      {
        error: "Authentication is temporarily unavailable. Please try again in a moment.",
        code: "auth_unavailable",
      },
      {
        status: 503,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }
}

export const GET = handleAuthRequest;
export const POST = handleAuthRequest;
