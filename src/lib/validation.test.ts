import { describe, expect, it } from "vitest";
import { countryOptions } from "@/lib/countries";
import { normalizePhoneNumber, phoneNumberSchema, profileSchema, registrationSchema } from "./validation";

describe("country options", () => {
  it("uses a stable country label for server and browser rendering", () => {
    expect(countryOptions.find((country) => country.code === "FK")?.name).toBe("Falkland Islands (Malvinas)");
  });
});

describe("registration validation", () => {
  it("normalizes common Kenyan phone number forms", () => {
    expect(normalizePhoneNumber("0712 345 678", "KE")).toBe("+254712345678");
    expect(normalizePhoneNumber("254-712-345-678", "KE")).toBe("+254712345678");
    expect(phoneNumberSchema.safeParse({ phoneNumber: "(415) 555-2671", phoneCountry: "US" }).success).toBe(true);
  });

  it("rejects malformed or too-short phone numbers", () => {
    expect(phoneNumberSchema.safeParse({ phoneNumber: "12345", phoneCountry: "KE" }).success).toBe(false);
    expect(phoneNumberSchema.safeParse({ phoneNumber: "letters-only", phoneCountry: "KE" }).success).toBe(false);
    expect(phoneNumberSchema.safeParse({ phoneNumber: "+1 (415) 555-2671", phoneCountry: "KE" }).success).toBe(false);
  });

  it("requires a valid email, name, country, gender, phone number, and reasonably strong password", () => {
    const valid = {
      fullName: "Ada Sentinel",
      email: "ada@example.com",
      phoneNumber: "0712 345 678",
      phoneCountry: "KE",
      countryCode: "KE",
      gender: "female",
      password: "SecurePass2026!",
    };
    expect(registrationSchema.safeParse(valid).success).toBe(true);
    expect(registrationSchema.safeParse({ ...valid, countryCode: "" }).success).toBe(false);
    expect(registrationSchema.safeParse({ ...valid, phoneCountry: "invalid" }).success).toBe(false);
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
  const validProfile = { fullName: "Ada Sentinel", phoneNumber: "0712 345 678", phoneCountry: "KE", countryCode: "KE" };

  it("requires gender and trims optional work details", () => {
    expect(profileSchema.safeParse(validProfile).success).toBe(false);
    const result = profileSchema.safeParse({
      ...validProfile,
      gender: "other" as const,
      organization: "  Sentinel Labs  ",
      currentPosition: "  Analyst  ",
      city: "  Nairobi  ",
      region: "  Nairobi County  ",
      location: "  Nairobi, Kenya  ",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toMatchObject({
        phoneNumber: "+254712345678",
        phoneCountryCode: "+254",
        countryCode: "KE",
        city: "Nairobi",
        region: "Nairobi County",
        gender: "other",
        organization: "Sentinel Labs",
        currentPosition: "Analyst",
        location: "Nairobi, Kenya",
      });
    }
  });

  it("rejects unsupported gender values and overlong optional fields", () => {
    expect(profileSchema.safeParse({ ...validProfile, gender: "unspecified" }).success).toBe(false);
    expect(profileSchema.safeParse({ ...validProfile, organization: "x".repeat(151) }).success).toBe(false);
    expect(profileSchema.safeParse({ ...validProfile, location: "x".repeat(151) }).success).toBe(false);
    expect(profileSchema.safeParse({ ...validProfile, city: "x".repeat(101) }).success).toBe(false);
    expect(profileSchema.safeParse({ ...validProfile, region: "x".repeat(101) }).success).toBe(false);
  });
});
