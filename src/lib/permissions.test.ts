import { describe, expect, it } from "vitest";
import { canDownload, isAdministrator } from "./permissions";

describe("download authorization", () => {
  it("rejects missing profiles and profiles without phone number or gender", () => {
    expect(canDownload(null)).toBe(false);
    expect(canDownload({ fullName: "Ada", phoneNumber: null, gender: "female" })).toBe(false);
    expect(canDownload({ fullName: "Ada", phoneNumber: " ", gender: "female" })).toBe(false);
    expect(canDownload({ fullName: "Ada", phoneNumber: "+254712345678", gender: null })).toBe(false);
  });

  it("allows downloads only when all required profile fields are complete", () => {
    expect(canDownload({ fullName: "Ada Lovelace", phoneNumber: "+254712345678", gender: "female" })).toBe(true);
  });
});

describe("administrator authorization", () => {
  it("grants access only to a server-provisioned admin role", () => {
    expect(isAdministrator({ role: "user" })).toBe(false);
    expect(isAdministrator({ role: "admin" })).toBe(true);
    expect(isAdministrator(null)).toBe(false);
  });
});
