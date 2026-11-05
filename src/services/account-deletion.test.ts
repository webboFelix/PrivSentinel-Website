import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  ensureDatabaseSchema: vi.fn(),
  findProfile: vi.fn(),
  findBilling: vi.fn(),
  transaction: vi.fn(),
  execute: vi.fn(),
  commit: vi.fn(),
  rollback: vi.fn(),
  deleteAvatar: vi.fn(),
  deleteCustomer: vi.fn(),
}));

vi.mock("@/db", () => ({
  ensureDatabaseSchema: mocks.ensureDatabaseSchema,
  getDb: () => ({
    query: {
      profileDetails: { findFirst: mocks.findProfile },
      billingCustomers: { findFirst: mocks.findBilling },
    },
  }),
  getLibsqlClient: () => ({ transaction: mocks.transaction }),
}));

vi.mock("@/lib/cloudinary", () => ({ deleteProfileAvatar: mocks.deleteAvatar }));
vi.mock("@/lib/stripe", () => ({
  getStripe: () => ({ customers: { del: mocks.deleteCustomer } }),
}));

import { cleanAccountDataBeforeDeletion } from "./account-deletion";

describe("cleanAccountDataBeforeDeletion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findProfile.mockResolvedValue({ avatar: "https://res.cloudinary.com/test/image/upload/avatar" });
    mocks.findBilling.mockResolvedValue({ stripeCustomerId: "cus_test" });
    mocks.execute.mockResolvedValue(undefined);
    mocks.commit.mockResolvedValue(undefined);
    mocks.rollback.mockResolvedValue(undefined);
    mocks.transaction.mockResolvedValue({
      execute: mocks.execute,
      commit: mocks.commit,
      rollback: mocks.rollback,
    });
    mocks.deleteAvatar.mockResolvedValue(undefined);
    mocks.deleteCustomer.mockResolvedValue(undefined);
  });

  it("removes external resources and account-owned rows in one database transaction", async () => {
    const request = new Request("https://example.com/api/auth/delete-user", {
      headers: { "x-account-delete-confirmation": "DELETE" },
    });
    await cleanAccountDataBeforeDeletion({ id: "user-1", email: "person@example.com" }, request);

    expect(mocks.deleteCustomer).toHaveBeenCalledWith("cus_test");
    expect(mocks.deleteAvatar).toHaveBeenCalledWith("user-1");
    expect(mocks.transaction).toHaveBeenCalledWith("write");
    expect(mocks.execute).toHaveBeenCalledWith(expect.objectContaining({
      sql: expect.stringContaining('DELETE FROM "testimonials"'),
    }));
    expect(mocks.execute).toHaveBeenCalledWith(expect.objectContaining({
      sql: expect.stringContaining('DELETE FROM "downloads"'),
    }));
    expect(mocks.execute).toHaveBeenCalledWith(expect.objectContaining({
      sql: expect.stringContaining('DELETE FROM "profile_details"'),
    }));
    expect(mocks.execute).toHaveBeenCalledWith(expect.objectContaining({
      sql: expect.stringContaining('DELETE FROM "account"'),
      args: ["user-1"],
    }));
    expect(mocks.execute).toHaveBeenCalledWith(expect.objectContaining({
      sql: expect.stringContaining('DELETE FROM "session"'),
      args: ["user-1"],
    }));
    expect(mocks.execute).toHaveBeenCalledWith(expect.objectContaining({
      sql: expect.stringContaining('DELETE FROM "verification"'),
      args: ["person@example.com", "user-1"],
    }));
    expect(mocks.execute).toHaveBeenCalledWith(expect.objectContaining({
      sql: expect.stringContaining(`"targetType" = 'testimonial'`),
      args: ["user-1", "user-1", "user-1"],
    }));
    expect(mocks.execute).toHaveBeenCalledWith({
      sql: `DELETE FROM "rate_limits" WHERE "key" = ?`,
      args: [`email-verification:${createHash("sha256").update("user-1").digest("hex")}`],
    });
    expect(mocks.execute).toHaveBeenCalledWith({
      sql: `DELETE FROM "rate_limits" WHERE "key" = ?`,
      args: [`super-admin-bootstrap:${createHash("sha256").update("user-1").digest("hex")}`],
    });
    expect(mocks.execute).toHaveBeenCalledWith(expect.objectContaining({
      sql: expect.stringContaining('UPDATE "release_overrides" SET "updatedBy" = NULL'),
      args: ["user-1"],
    }));
    expect(mocks.execute).toHaveBeenCalledWith(expect.objectContaining({
      sql: expect.stringContaining('UPDATE "admin_bootstrap" SET "completedBy" = NULL'),
      args: ["user-1"],
    }));
    expect(mocks.execute).toHaveBeenCalledWith(expect.objectContaining({
      sql: expect.stringContaining('UPDATE "session" SET "impersonatedBy" = NULL'),
      args: ["user-1"],
    }));
    expect(mocks.commit).toHaveBeenCalledOnce();
    expect(mocks.rollback).not.toHaveBeenCalled();
  });

  it("does not erase local account data if external billing cleanup fails", async () => {
    mocks.deleteCustomer.mockRejectedValue(new Error("Stripe unavailable"));

    const request = new Request("https://example.com/api/auth/delete-user", {
      headers: { "x-account-delete-confirmation": "DELETE" },
    });
    await expect(cleanAccountDataBeforeDeletion({ id: "user-1", email: "person@example.com" }, request))
      .rejects.toThrow("The billing profile could not be removed.");

    expect(mocks.deleteAvatar).not.toHaveBeenCalled();
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("requires server-verified confirmation before clearing account data", async () => {
    const request = new Request("https://example.com/api/auth/delete-user");

    await expect(cleanAccountDataBeforeDeletion({ id: "user-1", email: "person@example.com" }, request))
      .rejects.toThrow("Confirm account deletion before continuing.");

    expect(mocks.findProfile).not.toHaveBeenCalled();
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("rolls back local cleanup if any database deletion fails", async () => {
    mocks.execute.mockRejectedValueOnce(new Error("database unavailable"));
    const request = new Request("https://example.com/api/auth/delete-user", {
      headers: { "x-account-delete-confirmation": "DELETE" },
    });

    await expect(cleanAccountDataBeforeDeletion({ id: "user-1", email: "person@example.com" }, request))
      .rejects.toThrow("Personal account data could not be removed.");

    expect(mocks.rollback).toHaveBeenCalledOnce();
    expect(mocks.commit).not.toHaveBeenCalled();
  });
});
