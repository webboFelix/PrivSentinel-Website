import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { auditLogs, user } from "@/db/schema";
import { getAuth } from "@/lib/auth";
import { isAccountSuspended, isAdministrator } from "@/lib/permissions";
import { diagnoseWorkerOperation } from "@/lib/worker-diagnostics";

type AuthSession = NonNullable<Awaited<ReturnType<ReturnType<typeof getAuth>["api"]["getSession"]>>>;

export type Principal = {
  session: AuthSession;
  actor: {
    id: string;
    email: string;
    name: string;
    role: string;
  };
};

export async function getPrincipal(requestHeaders: Headers): Promise<Principal | null> {
  const session = await diagnoseWorkerOperation("auth.session.read", () =>
    getAuth().api.getSession({ headers: requestHeaders }),
  );
  if (!session) return null;

  const account = await diagnoseWorkerOperation("auth.principal.lookup", () =>
    getDb().query.user.findFirst({
      columns: {
        id: true,
        email: true,
        name: true,
        role: true,
        banned: true,
        banExpires: true,
      },
      where: eq(user.id, session.user.id),
    }),
  );
  if (!account || isAccountSuspended(account)) return null;

  return {
    session,
    actor: {
      id: account.id,
      email: account.email,
      name: account.name,
      role: account.role,
    },
  };
}

export async function getAdministrator(requestHeaders: Headers): Promise<Principal | null> {
  const principal = await getPrincipal(requestHeaders);
  return principal && isAdministrator(principal.actor) ? principal : null;
}

export async function recordAudit(input: {
  actorId?: string | null;
  action: string;
  resource: string;
  targetType?: string | null;
  targetId?: string | null;
  metadata?: Record<string, unknown> | null;
}) {
  await getDb().insert(auditLogs).values({
    id: crypto.randomUUID(),
    userId: input.actorId ?? null,
    action: input.action,
    resource: input.resource,
    targetType: input.targetType ?? null,
    targetId: input.targetId ?? null,
    metadata: input.metadata ? JSON.stringify(input.metadata) : null,
  });
}
