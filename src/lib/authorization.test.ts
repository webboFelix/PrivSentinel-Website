import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findUser: vi.fn(),
  getSession: vi.fn(),
  isIpBlocked: vi.fn(),
}));

vi.mock("@/db", () => ({
  ensureDatabaseSchema: vi.fn(),
  getDb: () => ({ query: { user: { findFirst: mocks.findUser } } }),
}));
vi.mock("@/lib/auth", () => ({
  getAuth: () => ({ api: { getSession: mocks.getSession } }),
}));
vi.mock("@/lib/security-events", () => ({
  clientIpFromHeaders: () => null,
  isIpBlocked: mocks.isIpBlocked,
}));

import { getPrincipal } from "./authorization";

describe("getPrincipal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSession.mockResolvedValue({
      user: { id: "user-1" },
      session: { id: "session-1" },
    });
    mocks.isIpBlocked.mockResolvedValue(false);
  });

  it("does not grant protected access before email verification", async () => {
    mocks.findUser.mockResolvedValue({
      id: "user-1",
      email: "person@example.com",
      emailVerified: false,
      name: "Person",
      role: "user",
      banned: false,
      banExpires: null,
    });

    await expect(getPrincipal(new Headers())).resolves.toBeNull();
  });

  it("allows a verified, active user and rejects blocked IPs", async () => {
    mocks.findUser.mockResolvedValue({
      id: "user-1",
      email: "person@example.com",
      emailVerified: true,
      name: "Person",
      role: "user",
      banned: false,
      banExpires: null,
    });
    await expect(getPrincipal(new Headers())).resolves.toMatchObject({
      actor: { id: "user-1", emailVerified: true },
    });

    mocks.isIpBlocked.mockResolvedValue(true);
    await expect(getPrincipal(new Headers())).resolves.toBeNull();
    await expect(getPrincipal(new Headers(), true)).resolves.toMatchObject({
      actor: { id: "user-1" },
    });
    expect(mocks.isIpBlocked).toHaveBeenCalledTimes(2);
  });
});
