import { describe, expect, it } from "vitest";
import { normalizePhoneNumber, phoneNumberSchema, profileSchema, registrationSchema } from "./validation";

describe("registration validation", () => {
  it("normalizes common Kenyan phone number forms", () => {
    expect(normalizePhoneNumber("0712 345 678")).toBe("+254712345678");
    expect(normalizePhoneNumber("254-712-345-678")).toBe("+254712345678");
    expect(phoneNumberSchema.safeParse("+1 (415) 555-2671").success).toBe(true);
  });

  it("rejects malformed or too-short phone numbers", () => {
    expect(phoneNumberSchema.safeParse("12345").success).toBe(false);
    expect(phoneNumberSchema.safeParse("letters-only").success).toBe(false);
  });

  it("requires a valid email, name, gender, phone number, and reasonably strong password", () => {
    const valid = {
      fullName: "Ada Sentinel",
      email: "ada@example.com",
      phoneNumber: "+254712345678",
      gender: "female",
      password: "SecurePass2026!",
    };
    expect(registrationSchema.safeParse(valid).success).toBe(true);
    expect(registrationSchema.safeParse({ ...valid, email: "invalid" }).success).toBe(false);
    expect(registrationSchema.safeParse({ ...valid, gender: "" }).success).toBe(false);
    expect(registrationSchema.safeParse({ ...valid, gender: "unspecified" }).success).toBe(false);
    expect(registrationSchema.safeParse({ ...valid, password: "short" }).success).toBe(false);
    expect(registrationSchema.safeParse({ ...valid, password: "Aa1!abcdefg" }).success).toBe(false);
    expect(registrationSchema.safeParse({ ...valid, password: "Aa1!abcdefgh" }).success).toBe(true);
    expect(registrationSchema.safeParse({ ...valid, password: "SecurePass2026" }).success).toBe(false);
    expect(registrationSchema.safeParse({ ...valid, fullName: "A" }).success).toBe(false);
  });
});

describe("account profile validation", () => {
  const validProfile = { fullName: "Ada Sentinel", phoneNumber: "+254712345678" };

  it("requires gender and trims optional work details", () => {
    expect(profileSchema.safeParse(validProfile).success).toBe(false);
    const result = profileSchema.safeParse({
      ...validProfile,
      gender: "other" as const,
      organization: "  Sentinel Labs  ",
      currentPosition: "  Analyst  ",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toMatchObject({
        gender: "other",
        organization: "Sentinel Labs",
        currentPosition: "Analyst",
      });
    }
  });

  it("rejects unsupported gender values and overlong optional fields", () => {
    expect(profileSchema.safeParse({ ...validProfile, gender: "unspecified" }).success).toBe(false);
    expect(profileSchema.safeParse({ ...validProfile, organization: "x".repeat(151) }).success).toBe(false);
  });
});
