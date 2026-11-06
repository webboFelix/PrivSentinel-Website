import { z } from "zod";
import { callingCodeForCountry, isCountryCode } from "@/lib/countries";
import { parsePhoneNumberFromString } from "libphonenumber-js";

function parseValidPhone(phone: string, country: string) {
  if (!isCountryCode(country)) return undefined;
  const parsed = parsePhoneNumberFromString(phone, country);
  return parsed?.isValid() && (!parsed.country || parsed.country === country) ? parsed : undefined;
}

export function normalizePhoneNumber(phone: string, country = "KE") {
  return parseValidPhone(phone, country)?.number ?? phone;
}

const phoneFields = {
  phoneNumber: z.string().trim().min(1, "Enter a phone number."),
  phoneCountry: z.string().refine(isCountryCode, "Select a valid phone country code."),
};

function withNormalizedPhone<T extends { phoneNumber: string; phoneCountry: string }>(schema: z.ZodType<T>) {
  return schema.transform((value, context) => {
    const parsed = parseValidPhone(value.phoneNumber, value.phoneCountry);
    if (!parsed) {
      context.addIssue({
        code: "custom",
        path: ["phoneNumber"],
        message: "Enter a valid phone number for the selected country.",
      });
      return z.NEVER;
    }
    return {
      ...value,
      phoneNumber: parsed.number,
      phoneCountryCode: callingCodeForCountry(value.phoneCountry),
    };
  });
}

export const phoneNumberSchema = withNormalizedPhone(z.object(phoneFields));

export const passwordSchema = z.string()
  .min(12, "Use at least 12 characters.")
  .max(128, "Password must be 128 characters or fewer.")
  .regex(/[a-z]/, "Include a lowercase letter.")
  .regex(/[A-Z]/, "Include an uppercase letter.")
  .regex(/\d/, "Include a number.")
  .regex(/[^A-Za-z0-9]/, "Include a symbol.");

export const emailSchema = z.string().trim().toLowerCase().email("Enter a valid email address.");

export const registrationSchema = withNormalizedPhone(z.object({
  fullName: z.string().trim().min(2, "Enter your full name.").max(100, "Name must be 100 characters or fewer."),
  email: emailSchema,
  countryCode: z.string().refine(isCountryCode, "Select your country."),
  ...phoneFields,
  gender: z.enum(["male", "female", "other"]),
  password: passwordSchema,
}));

export const profileSchema = withNormalizedPhone(z.object({
  fullName: z.string().trim().min(2).max(100),
  countryCode: z.string().refine(isCountryCode, "Select your country."),
  city: z.string().trim().max(100, "City must be 100 characters or fewer.").optional().transform((value) => value || null),
  region: z.string().trim().max(100, "State or region must be 100 characters or fewer.").optional().transform((value) => value || null),
  ...phoneFields,
  gender: z.enum(["male", "female", "other"]),
  organization: z.string().trim().max(150, "Organization must be 150 characters or fewer.").optional().transform((value) => value || null),
  currentPosition: z.string().trim().max(150, "Current position must be 150 characters or fewer.").optional().transform((value) => value || null),
  location: z.string().trim().max(150, "Location must be 150 characters or fewer.").optional(),
}));
