import { createClient } from "https://esm.sh/@supabase/supabase-js@2.74.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface ApplicationSubmission {
  // Section 1: Basic Information
  preferred_contact_method: 'whatsapp' | 'telegram' | 'both';
  whatsapp_number?: string;
  telegram_username?: string;
  whatsapp_group_link?: string;
  telegram_group_link?: string;
  application_notes?: string;
  
  // Section 2: Network & Experience
  has_community_group?: boolean;
  community_group_size?: number;
  community_group_links?: string;
  has_platform_promotion?: boolean;
  platform_promotion_details?: string;
  network_description?: string;
  expected_onboarding_count?: number;
  
  // Section 3: Local Payments & Support
  accepted_payment_methods?: string[];
  has_local_support?: boolean;
  support_preference?: 'online' | 'in_person' | 'both';
  can_organize_training?: boolean;
  
  // Section 4: Agreement
  weekly_time_commitment?: number;
  motivation?: string;
  agrees_to_guidelines?: boolean;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization")! },
        },
      }
    );

    // Authenticate user
    const {
      data: { user },
      error: authError,
    } = await supabaseClient.auth.getUser();

    if (authError || !user) {
      console.error("[Partner Application] Authentication failed:", authError);
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log(`[Partner Application] Request from user: ${user.id}`);

    // Handle GET request - Check application status
    if (req.method === "GET") {
      const { data: existingApplication, error: fetchError } = await supabaseClient
        .from("partner_applications")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (fetchError && fetchError.code !== "PGRST116") {
        console.error("[Partner Application] Error fetching application:", fetchError);
        throw fetchError;
      }

      // Check if user is already a partner
      const { data: partnerRole } = await supabaseClient
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "partner")
        .single();

      return new Response(
        JSON.stringify({
          success: true,
          application: existingApplication || null,
          is_partner: !!partnerRole,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Handle POST request - Submit application
    if (req.method === "POST") {
      const body: ApplicationSubmission = await req.json();

      console.log("[Partner Application] Submission data:", {
        user_id: user.id,
        preferred_contact_method: body.preferred_contact_method,
      });

      // Comprehensive validation
      const errors: string[] = [];

      // Section 1: Basic Information
      if (!body.preferred_contact_method) {
        errors.push("Preferred contact method is required");
      }

      if (body.preferred_contact_method === 'whatsapp' || body.preferred_contact_method === 'both') {
        if (!body.whatsapp_number) {
          errors.push("WhatsApp number is required");
        }
      }

      if (body.preferred_contact_method === 'telegram' || body.preferred_contact_method === 'both') {
        if (!body.telegram_username) {
          errors.push("Telegram username is required");
        }
      }

      // Section 2: Network & Experience validation
      if (body.has_community_group === true && !body.community_group_links) {
        errors.push("Community group links are required when you have a community group");
      }

      if (body.has_platform_promotion === true && !body.platform_promotion_details) {
        errors.push("Platform promotion details are required when you have promoted platforms");
      }

      if (body.network_description && body.network_description.length > 1000) {
        errors.push("Network description must be 1000 characters or less");
      }

      if (body.expected_onboarding_count !== undefined && body.expected_onboarding_count < 0) {
        errors.push("Expected onboarding count cannot be negative");
      }

      // Section 3: Local Payments & Support validation
      if (body.accepted_payment_methods && body.accepted_payment_methods.length === 0) {
        errors.push("At least one payment method must be selected");
      }

      if (body.support_preference && !['online', 'in_person', 'both'].includes(body.support_preference)) {
        errors.push("Invalid support preference");
      }

      // Section 4: Agreement validation
      if (body.weekly_time_commitment !== undefined) {
        if (body.weekly_time_commitment < 1 || body.weekly_time_commitment > 168) {
          errors.push("Weekly time commitment must be between 1 and 168 hours");
        }
      }

      if (body.motivation && body.motivation.length > 1000) {
        errors.push("Motivation must be 1000 characters or less");
      }

      if (body.agrees_to_guidelines !== true) {
        errors.push("You must agree to the partner guidelines");
      }

      // Return validation errors if any
      if (errors.length > 0) {
        return new Response(
          JSON.stringify({ error: errors.join(". "), validation_errors: errors }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // Check if user already has an application
      const { data: existingApplication } = await supabaseClient
        .from("partner_applications")
        .select("id, status")
        .eq("user_id", user.id)
        .single();

      if (existingApplication) {
        return new Response(
          JSON.stringify({
            error: "Application already exists",
            status: existingApplication.status,
          }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // Insert application with all fields
      const { data: application, error: insertError } = await supabaseClient
        .from("partner_applications")
        .insert({
          user_id: user.id,
          // Section 1: Basic Information
          preferred_contact_method: body.preferred_contact_method,
          whatsapp_number: body.whatsapp_number,
          telegram_username: body.telegram_username,
          whatsapp_group_link: body.whatsapp_group_link,
          telegram_group_link: body.telegram_group_link,
          application_notes: body.application_notes,
          // Section 2: Network & Experience
          has_community_group: body.has_community_group ?? false,
          community_group_size: body.community_group_size,
          community_group_links: body.community_group_links,
          has_platform_promotion: body.has_platform_promotion ?? false,
          platform_promotion_details: body.platform_promotion_details,
          network_description: body.network_description,
          expected_onboarding_count: body.expected_onboarding_count,
          // Section 3: Local Payments & Support
          accepted_payment_methods: body.accepted_payment_methods || [],
          has_local_support: body.has_local_support ?? false,
          support_preference: body.support_preference,
          can_organize_training: body.can_organize_training ?? false,
          // Section 4: Agreement
          weekly_time_commitment: body.weekly_time_commitment,
          motivation: body.motivation,
          agrees_to_guidelines: body.agrees_to_guidelines ?? false,
          status: "pending",
        })
        .select()
        .single();

      if (insertError) {
        console.error("[Partner Application] Insert error:", insertError);
        throw insertError;
      }

      console.log(`[Partner Application] Application created: ${application.id}`);

      // Send notification to admins (optional - can be implemented later)
      // await supabaseClient.from("notifications").insert({
      //   user_id: admin_id,
      //   type: "partner_application",
      //   title: "New Partner Application",
      //   message: `User ${user.email} has applied to become a partner`,
      // });

      return new Response(
        JSON.stringify({
          success: true,
          application,
          message: "Application submitted successfully",
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("[Partner Application] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
