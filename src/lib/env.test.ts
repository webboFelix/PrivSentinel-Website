import { afterEach, describe, expect, it, vi } from "vitest";
import { getAuthConfigurationStatus, getCloudinaryConfig, getServerEnv, resolveOptionalUrl } from "./env";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("getAuthConfigurationStatus", () => {
  it("reports missing required runtime settings without returning their values", () => {
    vi.stubEnv("TURSO_DATABASE_URL", "");
    vi.stubEnv("TURSO_AUTH_TOKEN", "");
    vi.stubEnv("BETTER_AUTH_SECRET", "");
    vi.stubEnv("GOOGLE_CLIENT_ID", "");
    vi.stubEnv("GOOGLE_CLIENT_SECRET", "");
    vi.stubEnv("GMAIL_SMTP_USER", "");
    vi.stubEnv("GMAIL_APP_PASSWORD", "");
    vi.stubEnv("INITIAL_SUPER_ADMIN_EMAIL", "");

    expect(getAuthConfigurationStatus()).toEqual({
      available: false,
      missing: ["TURSO_DATABASE_URL", "TURSO_AUTH_TOKEN", "BETTER_AUTH_SECRET"],
    });
  });

  it("reports authentication ready only when database and auth secret exist", () => {
    vi.stubEnv("TURSO_DATABASE_URL", "libsql://database.invalid");
    vi.stubEnv("TURSO_AUTH_TOKEN", "test-token");
    vi.stubEnv("BETTER_AUTH_SECRET", "test-auth-secret-that-is-at-least-32-chars");
    vi.stubEnv("GOOGLE_CLIENT_ID", "");
    vi.stubEnv("GOOGLE_CLIENT_SECRET", "");
    vi.stubEnv("GMAIL_SMTP_USER", "");
    vi.stubEnv("GMAIL_APP_PASSWORD", "");
    vi.stubEnv("INITIAL_SUPER_ADMIN_EMAIL", "");

    expect(getAuthConfigurationStatus()).toEqual({ available: true, missing: [] });
  });

  it("selects the local or production URL from an environment-separated value", () => {
    const configured = "http://localhost:3000 || https://privsentinel.example.workers.dev";
    expect(resolveOptionalUrl(configured, "development")).toBe("http://localhost:3000");
    expect(resolveOptionalUrl(configured, "production")).toBe("https://privsentinel.example.workers.dev");
    expect(resolveOptionalUrl("  ", "production")).toBeUndefined();
  });

  it("allows the initial administrator email without a shared bootstrap secret", () => {
    vi.stubEnv("INITIAL_SUPER_ADMIN_EMAIL", "admin@example.com");
    vi.stubEnv("GOOGLE_CLIENT_ID", "");
    vi.stubEnv("GOOGLE_CLIENT_SECRET", "");
    vi.stubEnv("GMAIL_SMTP_USER", "");
    vi.stubEnv("GMAIL_APP_PASSWORD", "");

    expect(getServerEnv().INITIAL_SUPER_ADMIN_EMAIL).toBe("admin@example.com");
  });

  it("requires both Gmail SMTP settings together", () => {
    vi.stubEnv("GMAIL_SMTP_USER", "sender@gmail.com");
    vi.stubEnv("GMAIL_APP_PASSWORD", "");
    vi.stubEnv("GOOGLE_CLIENT_ID", "");
    vi.stubEnv("GOOGLE_CLIENT_SECRET", "");

    expect(() => getServerEnv()).toThrow("Server environment configuration is invalid.");

    vi.stubEnv("GMAIL_APP_PASSWORD", "test-app-password");
    expect(getServerEnv().GMAIL_SMTP_USER).toBe("sender@gmail.com");
  });

  it("does not mark authentication unavailable because an optional public URL is malformed", () => {
    vi.stubEnv("TURSO_DATABASE_URL", "libsql://database.invalid");
    vi.stubEnv("TURSO_AUTH_TOKEN", "test-token");
    vi.stubEnv("BETTER_AUTH_SECRET", "test-auth-secret-that-is-at-least-32-chars");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://localhost:3000 || https://privsentinel.example.workers.dev");
    vi.stubEnv("BETTER_AUTH_URL", "");
    vi.stubEnv("GOOGLE_CLIENT_ID", "");
    vi.stubEnv("GOOGLE_CLIENT_SECRET", "");
    vi.stubEnv("GMAIL_SMTP_USER", "");
    vi.stubEnv("GMAIL_APP_PASSWORD", "");
    vi.stubEnv("INITIAL_SUPER_ADMIN_EMAIL", "");
    vi.stubEnv("NODE_ENV", "production");

    expect(getAuthConfigurationStatus()).toEqual({ available: true, missing: [] });
    expect(getServerEnv().NEXT_PUBLIC_APP_URL).toBe("https://privsentinel.example.workers.dev");
  });

  it("requires the complete Cloudinary configuration before enabling uploads", () => {
    vi.stubEnv("CLOUDINARY_CLOUD_NAME", "test-cloud");
    vi.stubEnv("CLOUDINARY_API_KEY", "test-key");
    vi.stubEnv("CLOUDINARY_API_SECRET", "");

    expect(() => getCloudinaryConfig()).toThrow("Cloudinary is not configured.");
  });

  it("rejects malformed Cloudinary cloud names", () => {
    vi.stubEnv("CLOUDINARY_CLOUD_NAME", "invalid/cloud");
    vi.stubEnv("CLOUDINARY_API_KEY", "test-key");
    vi.stubEnv("CLOUDINARY_API_SECRET", "test-secret");

    expect(() => getCloudinaryConfig()).toThrow("CLOUDINARY_CLOUD_NAME is invalid.");
  });
});
