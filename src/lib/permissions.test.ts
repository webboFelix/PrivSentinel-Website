import { describe, expect, it } from "vitest";
import {
  canDownload,
  canManageRole,
  isAccountSuspended,
  isAdministrator,
  isSuperAdministrator,
} from "./permissions";

describe("download authorization", () => {
  it("rejects missing profiles and profiles without phone number or gender", () => {
    expect(canDownload(null)).toBe(false);
    expect(canDownload({ fullName: "Ada", phoneNumber: null, gender: "female", countryCode: "KE" })).toBe(false);
    expect(canDownload({ fullName: "Ada", phoneNumber: " ", gender: "female", countryCode: "KE" })).toBe(false);
    expect(canDownload({ fullName: "Ada", phoneNumber: "+254712345678", gender: null, countryCode: "KE" })).toBe(false);
    expect(canDownload({ fullName: "Ada", phoneNumber: "+254712345678", gender: "female", countryCode: null })).toBe(false);
  });

  it("allows downloads only when all required profile fields are complete", () => {
    expect(canDownload({ fullName: "Ada Lovelace", phoneNumber: "+254712345678", gender: "female", countryCode: "KE" })).toBe(true);
  });
});

describe("administrator authorization", () => {
  it("recognizes administrators and super administrators only", () => {
    expect(isAdministrator({ role: "user" })).toBe(false);
    expect(isAdministrator({ role: "admin" })).toBe(true);
    expect(isAdministrator({ role: "super_admin" })).toBe(true);
    expect(isAdministrator(null)).toBe(false);
    expect(isSuperAdministrator({ role: "admin" })).toBe(false);
    expect(isSuperAdministrator({ role: "super_admin" })).toBe(true);
  });

  it("enforces role hierarchy and prevents self-role changes", () => {
    const admin = { id: "admin-1", role: "admin" };
    const user = { id: "user-1", role: "user" };
    const otherAdmin = { id: "admin-2", role: "admin" };
    const superAdmin = { id: "root-1", role: "super_admin" };
    expect(canManageRole(admin, user, "admin")).toBe(true);
    expect(canManageRole(admin, user, "super_admin")).toBe(false);
    expect(canManageRole(admin, otherAdmin, "user")).toBe(false);
    expect(canManageRole(admin, superAdmin, "user")).toBe(false);
    expect(canManageRole(admin, admin, "user")).toBe(false);
    expect(canManageRole(superAdmin, otherAdmin, "admin")).toBe(true);
    expect(canManageRole(superAdmin, user, "super_admin")).toBe(true);
    expect(canManageRole(superAdmin, superAdmin, "admin")).toBe(false);
  });

  it("treats only active bans as account suspensions", () => {
    expect(isAccountSuspended({ banned: true, banExpires: null })).toBe(true);
    expect(isAccountSuspended({ banned: true, banExpires: new Date(200) }, 100)).toBe(true);
    expect(isAccountSuspended({ banned: true, banExpires: new Date(50) }, 100)).toBe(false);
    expect(isAccountSuspended({ banned: false, banExpires: null })).toBe(false);
  });
});
