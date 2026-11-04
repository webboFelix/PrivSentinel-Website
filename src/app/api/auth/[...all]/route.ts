import { eq } from "drizzle-orm";
import { connection } from "next/server";
import { ensureDatabaseSchema, getDb } from "@/db";
import { user } from "@/db/schema";
import { getAuth } from "@/lib/auth";
import { recordAudit } from "@/lib/authorization";
import { getAuthConfigurationStatus } from "@/lib/env";
import { isAdministrator } from "@/lib/permissions";
import { diagnoseWorkerOperation } from "@/lib/worker-diagnostics";

async function handleAuthRequest(request: Request) {
  await connection();
  const configuration = getAuthConfigurationStatus();
  if (!configuration.available) {
    console.error("[auth-configuration]", {
      state: "unavailable",
      missing: configuration.missing,
    });
    return Response.json(
      {
        error: "Authentication is temporarily unavailable. Please contact the site administrator.",
        code: "auth_not_configured",
      },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
  await diagnoseWorkerOperation("auth.schema.initialize", ensureDatabaseSchema);

  const path = new URL(request.url).pathname;
  let attemptedAdminId: string | null = null;
  if (request.method === "POST" && path.endsWith("/sign-in/email")) {
    let body: unknown;
    try {
      body = await request.clone().json();
    } catch (error) {
      if (!(error instanceof SyntaxError)) throw error;
    }
    if (typeof body === "object" && body !== null && "email" in body && typeof body.email === "string") {
      const email = body.email.trim().toLowerCase();
      const account = await diagnoseWorkerOperation("auth.admin-login.lookup", () =>
        getDb().query.user.findFirst({
          columns: { id: true, role: true },
          where: eq(user.email, email),
        }),
      );
      if (account && isAdministrator(account)) attemptedAdminId = account.id;
    }
  }

  const response = await diagnoseWorkerOperation("auth.handler", () =>
    getAuth().handler(request),
  );
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
}

export const GET = handleAuthRequest;
export const POST = handleAuthRequest;
