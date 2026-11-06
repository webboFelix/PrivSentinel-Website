import { z } from "zod";

const optionalNonEmpty = z.preprocess(
  (value) => typeof value === "string" && value.trim() === "" ? undefined : value,
  z.string().trim().min(1).optional(),
);
export function resolveOptionalUrl(value: unknown, environment = process.env.NODE_ENV) {
  if (typeof value !== "string" || value.trim() === "") return undefined;
  const candidates = value.split(/\s*\|\|\s*/).filter(Boolean);
  return environment === "production" ? candidates.at(-1) : candidates[0];
}

const optionalUrl = z.preprocess(
  (value) => resolveOptionalUrl(value),
  z.string().url().optional(),
);
const optionalHttpsUrl = z.preprocess(
  (value) => resolveOptionalUrl(value),
  z.string().url().refine((value) => new URL(value).protocol === "https:", "URL must use HTTPS.").optional(),
);

const serverEnvSchema = z.object({
  TURSO_DATABASE_URL: optionalNonEmpty,
  TURSO_AUTH_TOKEN: optionalNonEmpty,
  BETTER_AUTH_SECRET: z.preprocess(
    (value) => typeof value === "string" && value.trim() === "" ? undefined : value,
    z.string().min(32).optional(),
  ),
  BETTER_AUTH_URL: optionalUrl,
  LOGO_URL: optionalHttpsUrl,
  INITIAL_SUPER_ADMIN_EMAIL: z.preprocess(
    (value) => typeof value === "string" && value.trim() === "" ? undefined : value,
    z.string().trim().email().transform((value) => value.toLowerCase()).optional(),
  ),
  GOOGLE_CLIENT_ID: optionalNonEmpty,
  GOOGLE_CLIENT_SECRET: optionalNonEmpty,
  GITHUB_TOKEN: optionalNonEmpty,
  GMAIL_SMTP_USER: z.preprocess(
    (value) => typeof value === "string" && value.trim() === "" ? undefined : value,
    z.string().trim().email().optional(),
  ),
  GMAIL_APP_PASSWORD: optionalNonEmpty,
  CLOUDINARY_URL: optionalNonEmpty,
  CLOUDINARY_CLOUD_NAME: optionalNonEmpty,
  CLOUDINARY_API_KEY: optionalNonEmpty,
  CLOUDINARY_API_SECRET: optionalNonEmpty,
  STRIPE_SECRET_KEY: optionalNonEmpty.refine(
    (value) => !value || /^sk_(?:test|live)_/.test(value),
    "STRIPE_SECRET_KEY must be a Stripe test or live secret key.",
  ),
  GITHUB_OWNER: optionalNonEmpty,
  GITHUB_REPO: optionalNonEmpty,
  NEXT_PUBLIC_APP_URL: optionalUrl,
  NEXT_PUBLIC_DEMO_VIDEO_URL: optionalNonEmpty,
  NEXT_PUBLIC_SUPPORT_EMAIL: z.preprocess(
    (value) => typeof value === "string" && value.trim() === "" ? undefined : value,
    z.string().trim().email().optional(),
  ),
  NEXT_PUBLIC_LINKEDIN_URL: optionalHttpsUrl,
}).superRefine((env, context) => {
  if (Boolean(env.GOOGLE_CLIENT_ID) !== Boolean(env.GOOGLE_CLIENT_SECRET)) {
    context.addIssue({ code: "custom", message: "Configure both Google OAuth credentials." });
  }
  if (Boolean(env.GMAIL_SMTP_USER) !== Boolean(env.GMAIL_APP_PASSWORD)) {
    context.addIssue({ code: "custom", message: "Configure both Gmail SMTP settings or neither." });
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
  const missing = [];
  if (!process.env.TURSO_DATABASE_URL?.trim()) missing.push("TURSO_DATABASE_URL");
  if (!process.env.TURSO_AUTH_TOKEN?.trim()) missing.push("TURSO_AUTH_TOKEN");
  if ((process.env.BETTER_AUTH_SECRET?.trim().length ?? 0) < 32) missing.push("BETTER_AUTH_SECRET");
  return { available: missing.length === 0, missing };
}

export function getPublicAppUrl() {
  const parsed = optionalUrl.safeParse(process.env.NEXT_PUBLIC_APP_URL);
  return parsed.success ? parsed.data : undefined;
}

export function getPublicContactChannels() {
  const supportEmail = serverEnvSchema.shape.NEXT_PUBLIC_SUPPORT_EMAIL.safeParse(process.env.NEXT_PUBLIC_SUPPORT_EMAIL);
  const linkedInUrl = optionalHttpsUrl.safeParse(process.env.NEXT_PUBLIC_LINKEDIN_URL);
  return {
    supportEmail: supportEmail.success ? supportEmail.data : undefined,
    linkedInUrl: linkedInUrl.success ? linkedInUrl.data : undefined,
  };
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

export function getCloudinaryConfig() {
  const cloudinaryUrl = process.env.CLOUDINARY_URL?.trim();
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME?.trim();
  const apiKey = process.env.CLOUDINARY_API_KEY?.trim();
  const apiSecret = process.env.CLOUDINARY_API_SECRET?.trim();
  const hasSeparateCredentials = Boolean(cloudName || apiKey || apiSecret);
  if (hasSeparateCredentials) {
    if (!cloudName || !apiKey || !apiSecret) {
      throw new Error("Cloudinary credentials are incomplete. Set all of CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET, or set CLOUDINARY_URL.");
    }
    if (!/^[a-z0-9-]+$/i.test(cloudName)) throw new Error("CLOUDINARY_CLOUD_NAME is invalid.");
    return { cloudName, apiKey, apiSecret };
  }
  if (!cloudinaryUrl) {
    throw new Error("Cloudinary is not configured. Set CLOUDINARY_URL or all of CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET.");
  }
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(cloudinaryUrl);
  } catch {
    throw new Error("CLOUDINARY_URL is invalid. Use cloudinary://API_KEY:API_SECRET@CLOUD_NAME.");
  }
  const urlCloudName = parsedUrl.hostname;
  if (parsedUrl.protocol !== "cloudinary:" || !parsedUrl.username || !parsedUrl.password ||
      !/^[a-z0-9-]+$/i.test(urlCloudName) || (parsedUrl.pathname !== "" && parsedUrl.pathname !== "/") ||
      parsedUrl.search || parsedUrl.hash) {
    throw new Error("CLOUDINARY_URL is invalid. Use cloudinary://API_KEY:API_SECRET@CLOUD_NAME.");
  }
  try {
    return {
      cloudName: urlCloudName,
      apiKey: decodeURIComponent(parsedUrl.username),
      apiSecret: decodeURIComponent(parsedUrl.password),
    };
  } catch {
    throw new Error("CLOUDINARY_URL is invalid. Use cloudinary://API_KEY:API_SECRET@CLOUD_NAME.");
  }
}
