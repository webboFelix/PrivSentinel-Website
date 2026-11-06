import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  ensureDatabaseSchema: vi.fn(),
  findProfile: vi.fn(),
  findBilling: vi.fn(),
  transaction: vi.fn(),
  batch: vi.fn(),
  commit: vi.fn(),
  rollback: vi.fn(),
  close: vi.fn(),
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
    mocks.batch.mockResolvedValue([]);
    mocks.commit.mockResolvedValue(undefined);
    mocks.rollback.mockResolvedValue(undefined);
    mocks.close.mockReturnValue(undefined);
    mocks.transaction.mockResolvedValue({
      batch: mocks.batch,
      commit: mocks.commit,
      rollback: mocks.rollback,
      close: mocks.close,
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
    expect(mocks.batch).toHaveBeenCalledOnce();
    const [statements] = mocks.batch.mock.calls[0];
    expect(statements).toEqual(expect.arrayContaining([
      expect.objectContaining({ sql: expect.stringContaining('DELETE FROM "testimonials"') }),
      expect.objectContaining({ sql: expect.stringContaining('DELETE FROM "downloads"') }),
      expect.objectContaining({ sql: expect.stringContaining('DELETE FROM "profile_details"') }),
      { sql: `DELETE FROM "account" WHERE "userId" = ?`, args: ["user-1"] },
      { sql: `DELETE FROM "session" WHERE "userId" = ?`, args: ["user-1"] },
      {
        sql: expect.stringContaining('DELETE FROM "verification"'),
        args: ["person@example.com", "user-1"],
      },
      {
        sql: expect.stringContaining(`"targetType" = 'testimonial'`),
        args: ["user-1", "user-1", "user-1"],
      },
      {
        sql: `DELETE FROM "rate_limits" WHERE "key" = ?`,
        args: [`email-verification:${createHash("sha256").update("user-1").digest("hex")}`],
      },
      {
        sql: `DELETE FROM "rate_limits" WHERE "key" = ?`,
        args: [`super-admin-bootstrap:${createHash("sha256").update("user-1").digest("hex")}`],
      },
      {
        sql: expect.stringContaining('UPDATE "release_overrides" SET "updatedBy" = NULL'),
        args: ["user-1"],
      },
      {
        sql: expect.stringContaining('UPDATE "admin_bootstrap" SET "completedBy" = NULL'),
        args: ["user-1"],
      },
      {
        sql: expect.stringContaining('UPDATE "session" SET "impersonatedBy" = NULL'),
        args: ["user-1"],
      },
    ]));
    expect(statements).toHaveLength(25);
    expect(mocks.commit).toHaveBeenCalledOnce();
    expect(mocks.rollback).not.toHaveBeenCalled();
    expect(mocks.close).not.toHaveBeenCalled();
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
    mocks.batch.mockRejectedValueOnce(new Error("database unavailable"));
    const request = new Request("https://example.com/api/auth/delete-user", {
      headers: { "x-account-delete-confirmation": "DELETE" },
    });

    await expect(cleanAccountDataBeforeDeletion({ id: "user-1", email: "person@example.com" }, request))
      .rejects.toThrow("Personal account data could not be removed.");

    expect(mocks.rollback).toHaveBeenCalledOnce();
    expect(mocks.commit).not.toHaveBeenCalled();
    expect(mocks.close).toHaveBeenCalledOnce();
  });

  it("preserves both database and rollback errors when rollback fails", async () => {
    const databaseError = new Error("database unavailable");
    const rollbackError = new Error("connection closed");
    mocks.batch.mockRejectedValueOnce(databaseError);
    mocks.rollback.mockRejectedValueOnce(rollbackError);
    const request = new Request("https://example.com/api/auth/delete-user", {
      headers: { "x-account-delete-confirmation": "DELETE" },
    });

    const cleanup = cleanAccountDataBeforeDeletion({ id: "user-1", email: "person@example.com" }, request);
    await expect(cleanup).rejects.toThrow("Personal account data could not be removed.");
    await expect(cleanup).rejects.toMatchObject({
      cause: expect.objectContaining({
        errors: [databaseError, rollbackError],
      }),
    });

    expect(mocks.close).toHaveBeenCalledOnce();
  });
});
