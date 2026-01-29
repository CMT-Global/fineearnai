import { z } from "zod";

// Email validation
export const emailSchema = z
  .string()
  .trim()
  .email({ message: "Please enter a valid email address" })
  .max(255, { message: "Email must be less than 255 characters" });

// Password validation
export const passwordSchema = z
  .string()
  .min(8, { message: "Password must be at least 8 characters" })
  .max(100, { message: "Password must be less than 100 characters" })
  .regex(/[A-Z]/, { message: "Password must contain at least one uppercase letter" })
  .regex(/[a-z]/, { message: "Password must contain at least one lowercase letter" })
  .regex(/[0-9]/, { message: "Password must contain at least one number" });

// Username validation
export const usernameSchema = z
  .string()
  .trim()
  .min(3, { message: "Username must be at least 3 characters" })
  .max(30, { message: "Username must be less than 30 characters" })
  .regex(/^[a-zA-Z0-9_]+$/, { message: "Username can only contain letters, numbers, and underscores" });

// Amount validation
export const amountSchema = z
  .number()
  .positive({ message: "Amount must be positive" })
  .max(1000000, { message: "Amount is too large" })
  .refine((val) => Number(val.toFixed(2)) === val, {
    message: "Amount can only have up to 2 decimal places",
  });

// Referral code validation
export const referralCodeSchema = z
  .string()
  .trim()
  .length(8, { message: "Referral code must be exactly 8 characters" })
  .regex(/^[A-Z0-9]+$/, { message: "Invalid referral code format" });

// Task submission validation
export const taskSubmissionSchema = z.object({
  userTaskId: z.string().uuid({ message: "Invalid task ID" }),
  submissionData: z.record(z.any()).optional(),
});

// Withdrawal validation
export const withdrawalSchema = z.object({
  amount: amountSchema,
  withdrawalMethod: z.enum(["bank_transfer", "paypal", "crypto"], {
    errorMap: () => ({ message: "Please select a valid withdrawal method" }),
  }),
  accountDetails: z
    .string()
    .trim()
    .min(5, { message: "Account details must be at least 5 characters" })
    .max(500, { message: "Account details must be less than 500 characters" }),
});

// Deposit validation
export const depositSchema = z.object({
  amount: amountSchema,
  paymentMethod: z.enum(["bank_transfer", "card", "paypal", "crypto"], {
    errorMap: () => ({ message: "Please select a valid payment method" }),
  }),
});

/** BEP20 (Ethereum-style) address: 0x + 40 hex chars, length 42. */
export const bep20AddressSchema = z
  .string()
  .trim()
  .regex(/^0x[a-fA-F0-9]{40}$/, { message: "Invalid BEP20 address. Must be 0x followed by 40 hex characters." })
  .length(42, { message: "BEP20 address must be 42 characters (0x + 40 hex)." });

export function isValidBep20Address(value: string): boolean {
  return bep20AddressSchema.safeParse(value).success;
}

// Utility function to safely parse and validate data
export const safeValidate = <T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; error: string } => {
  try {
    const result = schema.safeParse(data);
    if (result.success) {
      return { success: true, data: result.data };
    }
    const firstError = result.error.issues[0];
    return { success: false, error: firstError.message };
  } catch (error) {
    return { success: false, error: "Validation failed" };
  }
};
