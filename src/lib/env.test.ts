import { afterEach, describe, expect, it, vi } from "vitest";
import { getAuthConfigurationStatus } from "./env";

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
    vi.stubEnv("RESEND_API_KEY", "");
    vi.stubEnv("RESEND_FROM_EMAIL", "");
    vi.stubEnv("INITIAL_SUPER_ADMIN_EMAIL", "");
    vi.stubEnv("SUPER_ADMIN_BOOTSTRAP_SECRET", "");

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
    vi.stubEnv("RESEND_API_KEY", "");
    vi.stubEnv("RESEND_FROM_EMAIL", "");
    vi.stubEnv("INITIAL_SUPER_ADMIN_EMAIL", "");
    vi.stubEnv("SUPER_ADMIN_BOOTSTRAP_SECRET", "");

    expect(getAuthConfigurationStatus()).toEqual({ available: true, missing: [] });
  });
});
