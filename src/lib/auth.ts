import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { getDb } from "@/db";
import * as schema from "@/db/schema";
import { getServerEnv } from "@/lib/env";

function createAuth() {
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
    user: {
      additionalFields: {
        role: {
          type: "string",
          required: false,
          input: false,
          defaultValue: "user",
        },
      },
    },
    rateLimit: {
      enabled: true,
      window: 60,
      max: 30,
    },
  });
}

type AuthInstance = ReturnType<typeof createAuth>;
let authInstance: AuthInstance | undefined;

export function getAuth(): AuthInstance {
  if (!authInstance) authInstance = createAuth();
  return authInstance;
}
