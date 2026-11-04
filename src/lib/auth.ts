import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin, createAccessControl } from "better-auth/plugins";
import { getDb } from "@/db";
import { auditLogs, schema } from "@/db/schema";
import { getAuthConfigurationStatus, getServerEnv } from "@/lib/env";

const statements = {
  user: ["create", "list", "set-role", "ban", "impersonate", "impersonate-admins", "delete", "set-password", "set-email", "get", "update"],
  session: ["list", "revoke", "delete"],
} as const;
const accessControl = createAccessControl(statements);
const userRole = accessControl.newRole({ user: [], session: [] });
const administratorRole = accessControl.newRole({
  user: ["list", "get"],
  session: [],
});
const superAdministratorRole = accessControl.newRole({
  user: ["list", "get"],
  session: [],
});

function createAuth() {
  if (!getAuthConfigurationStatus().available) {
    throw new Error("Authentication server configuration is incomplete.");
  }
  const env = getServerEnv();
  const googleConfigured = Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
  const appUrl = env.BETTER_AUTH_URL ?? process.env.NEXT_PUBLIC_APP_URL;
  const trustedOrigins = new Set([appUrl ?? "http://localhost:3000"]);
  if (process.env.NODE_ENV === "development") {
    for (const host of ["localhost", "127.0.0.1"]) {
      trustedOrigins.add(`http://${host}:3000`);
      trustedOrigins.add(`http://${host}:3001`);
    }
  }

  return betterAuth({
    database: drizzleAdapter(getDb(), {
      provider: "sqlite",
      schema: {
        user: schema.user,
        session: schema.session,
        account: schema.account,
        verification: schema.verification,
      },
      camelCase: true,
    }),
    ...(env.BETTER_AUTH_SECRET ? { secret: env.BETTER_AUTH_SECRET } : {}),
    ...(appUrl ? { baseURL: appUrl } : {}),
    trustedOrigins: [...trustedOrigins],
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 12,
      maxPasswordLength: 128,
      sendResetPassword: async ({ user, url }) => {
        if (!env.RESEND_API_KEY || !env.RESEND_FROM_EMAIL) {
          throw new Error("Password reset email delivery is not configured.");
        }
        const safeUrl = url.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
        const response = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${env.RESEND_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: env.RESEND_FROM_EMAIL,
            to: [user.email],
            subject: "Reset your PrivSentinel password",
            html: `<p>Use this secure link to reset your PrivSentinel password:</p><p><a href="${safeUrl}">Reset password</a></p><p>If you did not request this, you can ignore this email.</p>`,
          }),
        });
        if (!response.ok) throw new Error("Password reset email could not be delivered.");
      },
    },
    socialProviders: googleConfigured
      ? {
          google: {
            clientId: env.GOOGLE_CLIENT_ID!,
            clientSecret: env.GOOGLE_CLIENT_SECRET!,
          },
        }
      : {},
    rateLimit: {
      enabled: true,
      window: 60,
      max: 30,
    },
    plugins: [
      admin({
        defaultRole: "user",
        adminRoles: ["admin", "super_admin"],
        ac: accessControl,
        roles: {
          user: userRole,
          admin: administratorRole,
          super_admin: superAdministratorRole,
        },
      }),
    ],
    databaseHooks: {
      user: {
        create: {
          after: async (createdUser) => {
            await getDb().insert(auditLogs).values({
              id: crypto.randomUUID(),
              userId: createdUser.id,
              action: "user.registered",
              resource: "user",
              targetType: "user",
              targetId: createdUser.id,
            });
          },
        },
      },
      session: {
        create: {
          after: async (createdSession) => {
            const account = await getDb().query.user.findFirst({
              columns: { role: true },
              where: (user, { eq }) => eq(user.id, createdSession.userId),
            });
            await getDb().insert(auditLogs).values({
              id: crypto.randomUUID(),
              userId: createdSession.userId,
              action: account?.role === "admin" || account?.role === "super_admin"
                ? "auth.admin_login.succeeded"
                : "auth.login.succeeded",
              resource: "auth",
              targetType: "user",
              targetId: createdSession.userId,
            });
          },
        },
      },
    },
  });
}

type AuthInstance = ReturnType<typeof createAuth>;
let authInstance: AuthInstance | undefined;

export function getAuth(): AuthInstance {
  if (!authInstance) authInstance = createAuth();
  return authInstance;
}
