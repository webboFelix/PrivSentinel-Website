import { createHash } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";

const { execute } = vi.hoisted(() => ({ execute: vi.fn() }));
vi.mock("@/db", () => ({
  getLibsqlClient: () => ({ execute }),
}));

import { enforceRateLimit, enforceRateLimitBySubject } from "./rate-limit";

afterEach(() => {
  execute.mockReset();
});

describe("rate limits", () => {
  it("uses a stable hashed subject key independent of request headers", async () => {
    execute.mockResolvedValue({ rows: [{ count: 2 }] });
    const allowed = await enforceRateLimitBySubject("bootstrap", "admin-user-id", 1, 3600);

    expect(allowed).toBe(false);
    const expectedHash = createHash("sha256").update("admin-user-id").digest("hex");
    expect(execute).toHaveBeenCalledWith(expect.objectContaining({
      args: expect.arrayContaining([`bootstrap:${expectedHash}`]),
    }));
    expect(JSON.stringify(execute.mock.calls)).not.toContain("admin-user-id");
  });

  it("uses Vercel's request IP headers rather than untrusted forwarded values", async () => {
    execute.mockResolvedValue({ rows: [{ count: 1 }] });
    const request = new Request("https://example.test/api/admin/bootstrap", {
      headers: {
        "x-vercel-forwarded-for": "203.0.113.8",
        "x-real-ip": "203.0.113.8",
        "x-forwarded-for": "198.51.100.4",
      },
    });

    await enforceRateLimit(request, "bootstrap", 5, 3600);

    const expectedHash = createHash("sha256").update("203.0.113.8").digest("hex");
    expect(execute).toHaveBeenCalledWith(expect.objectContaining({
      args: expect.arrayContaining([`bootstrap:${expectedHash}`]),
    }));
  });
});
