import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  execute: vi.fn(),
  batch: vi.fn(),
}));
vi.mock("@/db", () => ({
  getLibsqlClient: () => ({ execute: mocks.execute, batch: mocks.batch }),
}));

import { clientIpFromRequest, recordFailedSignIn } from "./security-events";

afterEach(() => {
  vi.clearAllMocks();
});

describe("security event tracking", () => {
  it("accepts only valid proxy-provided client IPs", () => {
    expect(clientIpFromRequest(new Request("https://example.test", {
      headers: { "x-vercel-forwarded-for": "203.0.113.8, 10.0.0.1" },
    }))).toBe("203.0.113.8");
    expect(clientIpFromRequest(new Request("https://example.test", {
      headers: { "x-vercel-forwarded-for": "not-an-ip", "x-forwarded-for": "203.0.113.8" },
    }))).toBeNull();
  });

  it("permanently blocks an IP and records the user agent at the configured threshold", async () => {
    mocks.execute.mockResolvedValue({ rows: [{ count: 10 }] });
    mocks.batch.mockResolvedValue([]);
    const request = new Request("https://example.test/api/auth/sign-in/email", {
      headers: {
        "x-vercel-forwarded-for": "203.0.113.8",
        "user-agent": "TestBrowser/1",
      },
    });

    await expect(recordFailedSignIn({
      request,
      user: { id: "user-1", email: "person@example.com", name: "Person" },
    })).resolves.toEqual({ blocked: true, ipAddress: "203.0.113.8" });

    expect(mocks.batch).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({
        sql: expect.stringContaining('INSERT INTO "security_events"'),
        args: expect.arrayContaining(["person@example.com", "Person", "203.0.113.8", "TestBrowser/1", "auth.ip_auto_blocked"]),
      }),
      expect.objectContaining({
        sql: expect.stringContaining('INSERT OR IGNORE INTO "blocked_ips"'),
      }),
    ]), "write");
  });
});
