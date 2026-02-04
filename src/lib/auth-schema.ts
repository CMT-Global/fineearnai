import { z } from "zod";

export const signupSchema = z.object({
  username: z
    .string()
    .min(3, "Username must be at least 3 characters")
    .max(30, "Username must be less than 30 characters")
    .regex(/^[a-zA-Z0-9_]+$/, "Username can only contain letters, numbers, and underscores"),
  fullName: z
    .string()
    .min(2, "Full name must be at least 2 characters")
    .max(100, "Full name must be less than 100 characters"),
  email: z
    .string()
    .email("Invalid email address")
    .max(255, "Email must be less than 255 characters"),
  password: z
    .string()
    .min(6, "Password must be at least 6 characters")
    .max(100, "Password must be less than 100 characters"),
  referralCode: z.string().optional(),
});

export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

const PHONE_NATIONAL_MIN = 8;
const PHONE_NATIONAL_MAX = 18;

export const updateProfileSchema = z.object({
  fullName: z
    .string()
    .min(2, "Full name must be at least 2 characters")
    .max(30, "Full name must be at most 30 characters")
    .regex(
      /^[\p{L}\s\-'.]+$/u,
      "Full name can only contain letters, spaces, hyphens, and apostrophes (no special characters like @, #, $)"
    ),
  phone: z
    .string()
    .max(25, "Phone number must be less than 25 characters")
    .optional()
    .refine(
      (val) => {
        if (!val || !val.trim()) return true;
        const digits = val.replace(/\D/g, "");
        return digits.length >= PHONE_NATIONAL_MIN && digits.length <= PHONE_NATIONAL_MAX + 4;
      },
      { message: `Phone number must be between ${PHONE_NATIONAL_MIN} and ${PHONE_NATIONAL_MAX} digits (excluding country code).` }
    ),
  country: z
    .string()
    .length(2, "Country must be a valid 2-letter country code")
    .toUpperCase()
    .optional()
    .or(z.literal("")),
});

export const changePasswordSchema = z.object({
  newPassword: z
    .string()
    .min(6, "Password must be at least 6 characters")
    .max(100, "Password must be less than 100 characters"),
  confirmPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

export type SignupFormData = z.infer<typeof signupSchema>;
export type LoginFormData = z.infer<typeof loginSchema>;
export type UpdateProfileFormData = z.infer<typeof updateProfileSchema>;
export type ChangePasswordFormData = z.infer<typeof changePasswordSchema>;
