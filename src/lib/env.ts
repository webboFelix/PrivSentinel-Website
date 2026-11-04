import { z } from "zod";

const optionalNonEmpty = z.preprocess(
  (value) => typeof value === "string" && value.trim() === "" ? undefined : value,
  z.string().trim().min(1).optional(),
);
const optionalUrl = z.preprocess(
  (value) => typeof value === "string" && value.trim() === "" ? undefined : value,
  z.string().url().optional(),
);

const serverEnvSchema = z.object({
  TURSO_DATABASE_URL: optionalNonEmpty,
  TURSO_AUTH_TOKEN: optionalNonEmpty,
  BETTER_AUTH_SECRET: z.preprocess(
    (value) => typeof value === "string" && value.trim() === "" ? undefined : value,
    z.string().min(32).optional(),
  ),
  BETTER_AUTH_URL: optionalUrl,
  INITIAL_SUPER_ADMIN_EMAIL: z.preprocess(
    (value) => typeof value === "string" && value.trim() === "" ? undefined : value,
    z.string().trim().email().transform((value) => value.toLowerCase()).optional(),
  ),
  SUPER_ADMIN_BOOTSTRAP_SECRET: z.preprocess(
    (value) => typeof value === "string" && value.trim() === "" ? undefined : value,
    z.string().min(32).optional(),
  ),
  GOOGLE_CLIENT_ID: optionalNonEmpty,
  GOOGLE_CLIENT_SECRET: optionalNonEmpty,
  GITHUB_TOKEN: optionalNonEmpty,
  RESEND_API_KEY: optionalNonEmpty,
  STRIPE_SECRET_KEY: optionalNonEmpty.refine(
    (value) => !value || /^sk_(?:test|live)_/.test(value),
    "STRIPE_SECRET_KEY must be a Stripe test or live secret key.",
  ),
  RESEND_FROM_EMAIL: z.preprocess(
    (value) => typeof value === "string" && value.trim() === "" ? undefined : value,
    z.string().email().optional(),
  ),
  GITHUB_OWNER: optionalNonEmpty,
  GITHUB_REPO: optionalNonEmpty,
  NEXT_PUBLIC_APP_URL: optionalUrl,
  NEXT_PUBLIC_DEMO_VIDEO_URL: optionalNonEmpty,
}).superRefine((env, context) => {
  if (Boolean(env.GOOGLE_CLIENT_ID) !== Boolean(env.GOOGLE_CLIENT_SECRET)) {
    context.addIssue({ code: "custom", message: "Configure both Google OAuth credentials." });
  }
  if (Boolean(env.RESEND_API_KEY) !== Boolean(env.RESEND_FROM_EMAIL)) {
    context.addIssue({ code: "custom", message: "Configure both password reset email settings." });
  }
  if (Boolean(env.INITIAL_SUPER_ADMIN_EMAIL) !== Boolean(env.SUPER_ADMIN_BOOTSTRAP_SECRET)) {
    context.addIssue({ code: "custom", message: "Configure both initial super-admin bootstrap settings or neither." });
  }
});

export function getServerEnv() {
  const parsed = serverEnvSchema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error("Server environment configuration is invalid.");
  }
  return parsed.data;
}

export function getAuthConfigurationStatus() {
  const parsed = serverEnvSchema.safeParse(process.env);
  if (!parsed.success) {
    return { available: false, missing: ["server configuration"] };
  }

  const missing = [];
  if (!parsed.data.TURSO_DATABASE_URL) missing.push("TURSO_DATABASE_URL");
  if (!parsed.data.TURSO_AUTH_TOKEN) missing.push("TURSO_AUTH_TOKEN");
  if (!parsed.data.BETTER_AUTH_SECRET) missing.push("BETTER_AUTH_SECRET");
  return { available: missing.length === 0, missing };
}

export function getDatabaseConfig() {
  const env = getServerEnv();
  if (!env.TURSO_DATABASE_URL || !env.TURSO_AUTH_TOKEN) {
    throw new Error("Database is not configured. Set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN.");
  }
  return { url: env.TURSO_DATABASE_URL, authToken: env.TURSO_AUTH_TOKEN };
}

export function getGitHubConfig() {
  const env = getServerEnv();
  const owner = env.GITHUB_OWNER ?? "CybersecurityHubVAPT";
  const repo = env.GITHUB_REPO ?? "PrivSentinel-Releases";
  if (!/^[\w.-]+$/.test(owner) || !/^[\w.-]+$/.test(repo)) {
    throw new Error("GitHub repository configuration is invalid.");
  }
  return { owner, repo };
}
