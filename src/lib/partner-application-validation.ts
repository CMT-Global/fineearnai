import { z } from "zod";
import { isValidCountryCode } from "./countries";

// Section 1: Basic Information
export const section1Schema = z.object({
  preferred_contact_method: z.enum(["whatsapp", "telegram", "both"], {
    required_error: "Please select a contact method",
  }),
  whatsapp_number: z.string().min(1, "WhatsApp number is required"),
  telegram_username: z.string().min(1, "Telegram username is required"),
  whatsapp_group_link: z
    .string()
    .min(1, "WhatsApp group link is required")
    .url("Must be a valid URL"),
  telegram_group_link: z
    .string()
    .min(1, "Telegram group link is required")
    .url("Must be a valid URL"),
  // Phase 2: New fields
  applicant_country: z
    .string()
    .min(2, "Country is required")
    .refine((code) => isValidCountryCode(code), {
      message: "Please select a valid country",
    }),
  current_membership_plan: z
    .string()
    .min(1, "Membership plan is required"),
  total_referrals: z.number().int().min(0).optional(),
  upgraded_referrals: z.number().int().min(0).optional(),
});

// Section 2: Network & Experience
export const section2Schema = z.object({
  manages_community: z.boolean({
    required_error: "Please answer this question",
  }),
  community_group_links: z.string().optional(),
  community_member_count: z.string().optional(),
  promoted_platforms: z.boolean({
    required_error: "Please answer this question",
  }),
  platform_promotion_details: z.string().optional(),
  network_description: z
    .string()
    .min(50, "Please provide at least 50 characters")
    .max(500, "Maximum 500 characters allowed"),
  expected_monthly_onboarding: z.enum(
    ["less_than_50", "50_100", "100_500", "500_plus"],
    {
      required_error: "Please select your expected onboarding capacity",
    }
  ),
});

// Section 3: Local Payments & Support
export const section3Schema = z.object({
  local_payment_methods: z
    .string()
    .min(10, "Please provide details about payment methods you can accept"),
  can_provide_local_support: z.boolean({
    required_error: "Please answer this question",
  }),
  support_preference: z.enum(["online", "in_person", "both"], {
    required_error: "Please select your support preference",
  }),
  organize_training_sessions: z.boolean({
    required_error: "Please answer this question",
  }),
});

// Section 4: Agreement
export const section4Schema = z.object({
  // Phase 2: Changed from weekly to daily (keeping weekly optional for backward compatibility)
  daily_time_commitment: z.enum(["1-2", "2-4", "4-6", "6+"], {
    required_error: "Please select your daily time commitment",
  }),
  weekly_time_commitment: z.string().optional(), // Kept for backward compatibility
  // Phase 2: New employment status field
  is_currently_employed: z.boolean({
    required_error: "Please answer whether you are currently employed",
  }),
  motivation_text: z
    .string()
    .min(50, "Please provide at least 50 characters")
    .max(1000, "Maximum 1000 characters allowed"),
  agrees_to_guidelines: z.boolean().refine((val) => val === true, {
    message: "You must agree to the Partner Guidelines",
  }),
});

// Complete application schema (all sections combined)
export const completeApplicationSchema = z.object({
  // Section 1
  preferred_contact_method: z.enum(["whatsapp", "telegram", "both"], {
    required_error: "Please select a contact method",
  }),
  whatsapp_number: z.string().min(1, "WhatsApp number is required"),
  telegram_username: z.string().min(1, "Telegram username is required"),
  whatsapp_group_link: z
    .string()
    .min(1, "WhatsApp group link is required")
    .url("Must be a valid URL"),
  telegram_group_link: z
    .string()
    .min(1, "Telegram group link is required")
    .url("Must be a valid URL"),
  // Phase 2: New Section 1 fields
  applicant_country: z
    .string()
    .min(2, "Country is required")
    .refine((code) => isValidCountryCode(code), {
      message: "Please select a valid country",
    }),
  current_membership_plan: z
    .string()
    .min(1, "Membership plan is required"),
  total_referrals: z.number().int().min(0).optional(),
  upgraded_referrals: z.number().int().min(0).optional(),
  
  // Section 2
  manages_community: z.boolean({
    required_error: "Please answer this question",
  }),
  community_group_links: z.string().optional(),
  community_member_count: z.string().optional(),
  promoted_platforms: z.boolean({
    required_error: "Please answer this question",
  }),
  platform_promotion_details: z.string().optional(),
  network_description: z
    .string()
    .min(50, "Please provide at least 50 characters")
    .max(500, "Maximum 500 characters allowed"),
  expected_monthly_onboarding: z.enum(
    ["less_than_50", "50_100", "100_500", "500_plus"],
    {
      required_error: "Please select your expected onboarding capacity",
    }
  ),
  
  // Section 3
  local_payment_methods: z
    .string()
    .min(10, "Please provide details about payment methods you can accept"),
  can_provide_local_support: z.boolean({
    required_error: "Please answer this question",
  }),
  support_preference: z.enum(["online", "in_person", "both"], {
    required_error: "Please select your support preference",
  }),
  organize_training_sessions: z.boolean({
    required_error: "Please answer this question",
  }),
  
  // Section 4
  // Phase 2: Changed from weekly to daily (keeping weekly optional for backward compatibility)
  daily_time_commitment: z.enum(["1-2", "2-4", "4-6", "6+"], {
    required_error: "Please select your daily time commitment",
  }),
  weekly_time_commitment: z.string().optional(), // Kept for backward compatibility
  // Phase 2: New employment status field
  is_currently_employed: z.boolean({
    required_error: "Please answer whether you are currently employed",
  }),
  motivation_text: z
    .string()
    .min(50, "Please provide at least 50 characters")
    .max(1000, "Maximum 1000 characters allowed"),
  agrees_to_guidelines: z.boolean().refine((val) => val === true, {
    message: "You must agree to the Partner Guidelines",
  }),
}).refine((data) => {
  // Validate conditional fields for Section 1
  if (data.preferred_contact_method === "whatsapp" || data.preferred_contact_method === "both") {
    return data.whatsapp_number && data.whatsapp_number.length > 0;
  }
  return true;
}, {
  message: "WhatsApp number is required when WhatsApp is selected",
  path: ["whatsapp_number"],
}).refine((data) => {
  if (data.preferred_contact_method === "telegram" || data.preferred_contact_method === "both") {
    return data.telegram_username && data.telegram_username.length > 0;
  }
  return true;
}, {
  message: "Telegram username is required when Telegram is selected",
  path: ["telegram_username"],
}).refine((data) => {
  // Validate conditional fields for Section 2
  if (data.manages_community) {
    return data.community_group_links && data.community_group_links.length > 0 &&
           data.community_member_count && data.community_member_count.length > 0;
  }
  return true;
}, {
  message: "Please provide group links and member count when you manage a community",
  path: ["community_group_links"],
}).refine((data) => {
  if (data.promoted_platforms) {
    return data.platform_promotion_details && data.platform_promotion_details.length > 0;
  }
  return true;
}, {
  message: "Please describe your previous platform promotion experience",
  path: ["platform_promotion_details"],
});

export type Section1Data = z.infer<typeof section1Schema>;
export type Section2Data = z.infer<typeof section2Schema>;
export type Section3Data = z.infer<typeof section3Schema>;
export type Section4Data = z.infer<typeof section4Schema>;
export type CompleteApplicationData = z.infer<typeof completeApplicationSchema>;
