import { z } from "zod";

export function normalizePhoneNumber(phone: string) {
  const compact = phone.replace(/[\s().-]/g, "");
  if (/^0(?:7|1)\d{8}$/.test(compact)) return `+254${compact.slice(1)}`;
  if (/^254(?:7|1)\d{8}$/.test(compact)) return `+${compact}`;
  return compact;
}

export const phoneNumberSchema = z.string()
  .trim()
  .min(1, "Enter a phone number.")
  .transform(normalizePhoneNumber)
  .refine((value) => /^\+[1-9]\d{7,14}$/.test(value), {
    message: "Enter a valid international phone number, such as +254 712 345 678.",
  });

export const registrationSchema = z.object({
  fullName: z.string().trim().min(2, "Enter your full name.").max(100, "Name must be 100 characters or fewer."),
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
  phoneNumber: phoneNumberSchema,
  gender: z.enum(["male", "female", "other"]),
  password: z.string()
    .min(12, "Use at least 12 characters.")
    .max(128, "Password must be 128 characters or fewer.")
    .regex(/[a-z]/, "Include a lowercase letter.")
    .regex(/[A-Z]/, "Include an uppercase letter.")
    .regex(/\d/, "Include a number.")
    .regex(/[^A-Za-z0-9]/, "Include a symbol."),
});

export const profileSchema = z.object({
  fullName: z.string().trim().min(2).max(100),
  phoneNumber: phoneNumberSchema,
  gender: z.enum(["male", "female", "other"]),
  organization: z.string().trim().max(150, "Organization must be 150 characters or fewer.").optional().transform((value) => value || null),
  currentPosition: z.string().trim().max(150, "Current position must be 150 characters or fewer.").optional().transform((value) => value || null),
});
