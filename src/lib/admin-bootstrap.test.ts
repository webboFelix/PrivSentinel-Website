import { describe, expect, it } from "vitest";
import { isAdminBootstrapInitialized } from "./admin-bootstrap";

describe("initial administrator setup state", () => {
  it("recognizes an active super administrator as initialized", () => {
    expect(isAdminBootstrapInitialized({
      hasCompletionTimestamp: false,
      hasCompletingAccount: false,
      hasSuperAdministrator: true,
    })).toBe(true);
  });

  it("keeps a completed setup locked while its completing account still exists", () => {
    expect(isAdminBootstrapInitialized({
      hasCompletionTimestamp: true,
      hasCompletingAccount: true,
      hasSuperAdministrator: false,
    })).toBe(true);
  });

  it("allows recovery when the completing account was deleted and no super administrator remains", () => {
    expect(isAdminBootstrapInitialized({
      hasCompletionTimestamp: true,
      hasCompletingAccount: false,
      hasSuperAdministrator: false,
    })).toBe(false);
  });

  it("allows first-time setup when no bootstrap marker or super administrator exists", () => {
    expect(isAdminBootstrapInitialized({
      hasCompletionTimestamp: false,
      hasCompletingAccount: false,
      hasSuperAdministrator: false,
    })).toBe(false);
  });
});
