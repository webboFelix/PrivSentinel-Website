import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin, createAccessControl } from "better-auth/plugins";
import { getDb } from "@/db";
import { auditLogs, schema } from "@/db/schema";
import { getAuthConfigurationStatus, getServerEnv } from "@/lib/env";
import { cleanAccountDataBeforeDeletion } from "@/services/account-deletion";
import { enforceRateLimit, enforceRateLimitBySubject } from "@/lib/rate-limit";
import { sendGmailEmail } from "@/lib/gmail-email";

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
  const appUrl = env.BETTER_AUTH_URL ?? env.NEXT_PUBLIC_APP_URL;
  const trustedOrigins = new Set([appUrl ?? "http://localhost:3000"]);
  if (process.env.NODE_ENV === "development") {
    for (const host of ["localhost", "127.0.0.1"]) {
      trustedOrigins.add(`http://${host}:3000`);
      trustedOrigins.add(`http://${host}:3001`);
    }
  }

  return betterAuth({
    user: {
      deleteUser: {
        enabled: true,
        beforeDelete: cleanAccountDataBeforeDeletion,
      },
    },
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
      requireEmailVerification: true,
      minPasswordLength: 12,
      maxPasswordLength: 128,
      sendResetPassword: async ({ user, url }) => {
        if (!env.GMAIL_SMTP_USER || !env.GMAIL_APP_PASSWORD) {
          throw new Error("Password reset email delivery is not configured.");
        }
        const safeUrl = url.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
        await sendGmailEmail({
          user: env.GMAIL_SMTP_USER,
          appPassword: env.GMAIL_APP_PASSWORD,
          to: user.email,
          subject: "Reset your PrivSentinel password",
          html: `<p>Use this secure link to reset your PrivSentinel password:</p><p><a href="${safeUrl}">Reset password</a></p><p>If you did not request this, you can ignore this email.</p>`,
          operation: "password-reset",
        });
      },
    },
    emailVerification: {
      sendOnSignUp: true,
      sendOnSignIn: true,
      autoSignInAfterVerification: true,
      expiresIn: 3600,
      sendVerificationEmail: async ({ user, url }, request) => {
        if (!env.GMAIL_SMTP_USER || !env.GMAIL_APP_PASSWORD) {
          throw new Error("Email verification delivery is not configured.");
        }
        const [subjectAllowed, addressAllowed] = await Promise.all([
          enforceRateLimitBySubject("email-verification", user.id, 3, 3600),
          request ? enforceRateLimit(request, "email-verification", 10, 3600) : Promise.resolve(true),
        ]);
        if (!subjectAllowed || !addressAllowed) {
          throw new Error("Email verification requests are temporarily rate-limited.");
        }
        const safeUrl = url.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
        await sendGmailEmail({
          user: env.GMAIL_SMTP_USER,
          appPassword: env.GMAIL_APP_PASSWORD,
          to: user.email,
          subject: "Verify your PrivSentinel email",
          html: `<p>Confirm your email address to secure your PrivSentinel account:</p><p><a href="${safeUrl}">Verify email address</a></p><p>This link expires in one hour. If you did not create this account, you can ignore this email.</p>`,
          operation: "email-verification",
        });
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
