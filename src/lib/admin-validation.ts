import { z } from "zod";

/**
 * Admin validation schemas and utilities
 * Ensures all admin operations have proper client-side validation
 */

// Wallet adjustment validation
export const walletAdjustmentSchema = z.object({
  wallet_type: z.enum(["deposit", "earnings"], {
    required_error: "Wallet type is required",
  }),
  amount: z
    .number({
      required_error: "Amount is required",
      invalid_type_error: "Amount must be a number",
    })
    .refine((val) => val !== 0, {
      message: "Amount cannot be zero",
    })
    .refine((val) => Math.abs(val) <= 1000000, {
      message: "Amount cannot exceed $1,000,000",
    }),
  reason: z
    .string({
      required_error: "Reason is required",
    })
    .min(10, "Reason must be at least 10 characters")
    .max(500, "Reason must not exceed 500 characters")
    .trim(),
});

// Plan change validation
export const planChangeSchema = z.object({
  planName: z
    .string({
      required_error: "Plan name is required",
    })
    .min(1, "Plan name cannot be empty"),
  expiryDate: z
    .string({
      required_error: "Expiry date is required",
    })
    .refine(
      (date) => {
        const selected = new Date(date);
        const now = new Date();
        return selected > now;
      },
      {
        message: "Expiry date must be in the future",
      }
    ),
});

// Suspension validation
export const suspensionSchema = z.object({
  suspendReason: z
    .string()
    .max(500, "Reason must not exceed 500 characters")
    .optional(),
});

// Ban validation
export const banSchema = z.object({
  banReason: z
    .string({
      required_error: "Ban reason is required",
    })
    .min(20, "Ban reason must be at least 20 characters for accountability")
    .max(1000, "Ban reason must not exceed 1000 characters")
    .trim(),
  confirmed: z
    .boolean()
    .refine((val) => val === true, {
      message: "You must confirm the ban action",
    }),
});

// Profile update validation
export const profileUpdateSchema = z.object({
  full_name: z
    .string()
    .min(2, "Full name must be at least 2 characters")
    .max(100, "Full name must not exceed 100 characters")
    .optional(),
  country: z.string().max(100).optional(),
  phone_number: z
    .string()
    .regex(/^\+?[1-9]\d{1,14}$/, "Invalid phone number format")
    .optional()
    .or(z.literal("")),
});

// Email update validation
export const emailUpdateSchema = z.object({
  newEmail: z
    .string({
      required_error: "Email is required",
    })
    .email("Invalid email address")
    .max(255, "Email must not exceed 255 characters")
    .toLowerCase()
    .trim(),
});

// Bulk operations validation
export const bulkOperationSchema = z.object({
  userIds: z
    .array(z.string().uuid("Invalid user ID"))
    .min(1, "At least one user must be selected")
    .max(100, "Cannot perform bulk operations on more than 100 users at once"),
});

// Search and filter validation
export const searchFiltersSchema = z.object({
  searchTerm: z.string().max(200).optional(),
  planFilter: z.string().optional(),
  statusFilter: z.enum(["all", "active", "suspended", "banned"]).optional(),
  countryFilter: z.string().max(100).optional(),
  sortBy: z
    .enum(["username", "email", "membership_plan", "total_earned", "created_at"])
    .optional(),
  sortOrder: z.enum(["ASC", "DESC"]).optional(),
});

/**
 * Validation utility functions
 */

export function validateWalletAdjustment(data: unknown) {
  return walletAdjustmentSchema.safeParse(data);
}

export function validatePlanChange(data: unknown) {
  return planChangeSchema.safeParse(data);
}

export function validateSuspension(data: unknown) {
  return suspensionSchema.safeParse(data);
}

export function validateBan(data: unknown) {
  return banSchema.safeParse(data);
}

export function validateProfileUpdate(data: unknown) {
  return profileUpdateSchema.safeParse(data);
}

export function validateEmailUpdate(data: unknown) {
  return emailUpdateSchema.safeParse(data);
}

export function validateBulkOperation(data: unknown) {
  return bulkOperationSchema.safeParse(data);
}

export function validateSearchFilters(data: unknown) {
  return searchFiltersSchema.safeParse(data);
}

/**
 * Sanitization helpers
 */

export function sanitizeUserInput(input: string): string {
  return input
    .trim()
    .replace(/[<>]/g, "") // Remove potential HTML tags
    .slice(0, 1000); // Limit length
}

export function sanitizeSearchTerm(term: string): string {
  return term
    .trim()
    .replace(/[<>'"]/g, "") // Remove quotes and HTML
    .slice(0, 200);
}

/**
 * Security checks
 */

export function isValidUserId(userId: string): boolean {
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(userId);
}

export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= 255;
}

export function isSafeAmount(amount: number): boolean {
  return (
    !isNaN(amount) &&
    isFinite(amount) &&
    Math.abs(amount) <= 1000000 &&
    amount !== 0
  );
}

/**
 * Error message formatting
 */

export function formatValidationErrors(
  errors: z.ZodIssue[]
): Record<string, string> {
  const formatted: Record<string, string> = {};
  
  errors.forEach((error) => {
    const field = error.path.join(".");
    formatted[field] = error.message;
  });
  
  return formatted;
}

export function getFirstValidationError(errors: z.ZodIssue[]): string {
  return errors[0]?.message || "Validation error";
}
