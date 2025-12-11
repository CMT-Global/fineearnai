import { createClient } from "https://esm.sh/@supabase/supabase-js@2.74.0";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-correlation-id"
};
Deno.serve(async (req)=>{
  // Phase 2: Extract correlation ID from headers for end-to-end tracing
  const correlationId = req.headers.get("X-Correlation-Id") || req.headers.get("x-correlation-id") || "no-correlation-id";
  const startTime = Date.now();
  console.log(`🆔 [Partner Application] Request started`, {
    event: 'partner-application.start',
    correlationId,
    method: req.method,
    timestamp: new Date().toISOString()
  });
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: corsHeaders
    });
  }
  try {
    const supabaseClient = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
      global: {
        headers: {
          Authorization: req.headers.get("Authorization")
        }
      }
    });
    // Authenticate user
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      console.error(`🚨 [Partner Application] Authentication failed`, {
        event: 'partner-application.auth-failed',
        correlationId,
        error: authError?.message,
        timingMs: Date.now() - startTime
      });
      return new Response(JSON.stringify({
        error: "Unauthorized"
      }), {
        status: 401,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    console.log(`✅ [Partner Application] User authenticated`, {
      event: 'partner-application.authenticated',
      correlationId,
      userId: user.id,
      email: user.email,
      timingMs: Date.now() - startTime
    });
    // Handle GET request - Check application status
    if (req.method === "GET") {
      console.log(`📋 [Partner Application] GET request - checking status`, {
        event: 'partner-application.get-status',
        correlationId,
        userId: user.id
      });
      const { data: existingApplication, error: fetchError } = await supabaseClient.from("partner_applications").select("*").eq("user_id", user.id).single();
      if (fetchError && fetchError.code !== "PGRST116") {
        console.error(`🚨 [Partner Application] Error fetching application`, {
          event: 'partner-application.fetch-error',
          correlationId,
          userId: user.id,
          error: fetchError.message,
          timingMs: Date.now() - startTime
        });
        throw fetchError;
      }
      // Check if user is already a partner
      const { data: partnerRole } = await supabaseClient.from("user_roles").select("role").eq("user_id", user.id).eq("role", "partner").single();
      console.log(`✅ [Partner Application] Status check complete`, {
        event: 'partner-application.status-result',
        correlationId,
        userId: user.id,
        hasApplication: !!existingApplication,
        applicationId: existingApplication?.id,
        applicationStatus: existingApplication?.status,
        isPartner: !!partnerRole,
        timingMs: Date.now() - startTime
      });
      return new Response(JSON.stringify({
        success: true,
        application: existingApplication || null,
        is_partner: !!partnerRole
      }), {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    // Handle POST request - Submit application
    if (req.method === "POST") {
      const body = await req.json();
      console.log(`📝 [Partner Application] POST request - submission started`, {
        event: 'partner-application.submission-start',
        correlationId,
        userId: user.id,
        preferred_contact_method: body.preferred_contact_method,
        membership_plan: body.current_membership_plan,
        country: body.applicant_country
      });
      // Fetch user profile to validate membership plan server-side
      const { data: profile, error: profileError } = await supabaseClient.from("profiles").select("membership_plan, country").eq("id", user.id).single();
      if (profileError || !profile) {
        console.error(`🚨 [Partner Application] Profile fetch error`, {
          event: 'partner-application.profile-error',
          correlationId,
          userId: user.id,
          error: profileError?.message,
          timingMs: Date.now() - startTime
        });
        return new Response(JSON.stringify({
          error: "Failed to fetch user profile"
        }), {
          status: 500,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json"
          }
        });
      }
      console.log(`✅ [Partner Application] Profile fetched`, {
        event: 'partner-application.profile-fetched',
        correlationId,
        userId: user.id,
        membershipPlan: profile.membership_plan
      });
      // SERVER-SIDE FREE PLAN VALIDATION
      if (profile.membership_plan === 'free') {
        console.log(`⛔ [Partner Application] BLOCKED: Free plan`, {
          event: 'partner-application.free-plan-blocked',
          correlationId,
          userId: user.id,
          membershipPlan: profile.membership_plan,
          timingMs: Date.now() - startTime
        });
        return new Response(JSON.stringify({
          error: "Free plan users cannot apply to become partners. Please upgrade your membership plan first.",
          error_code: "FREE_PLAN_BLOCKED"
        }), {
          status: 403,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json"
          }
        });
      }
      // Fetch referral data for validation
      const { count: totalReferrals, error: referralError } = await supabaseClient.from("referrals").select("*", {
        count: "exact",
        head: true
      }).eq("referrer_id", user.id);
      if (referralError) {
        console.error("[Partner Application] Referral fetch error:", referralError);
      }
      console.log("[Partner Application] Referral count:", totalReferrals);
      // Comprehensive validation
      const errors = [];
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
      // Validate new required fields
      if (!body.applicant_country || body.applicant_country.length !== 2) {
        errors.push("Valid country code is required");
      }
      if (!body.current_membership_plan) {
        errors.push("Membership plan information is required");
      }
      if (typeof body.total_referrals !== 'number' || body.total_referrals < 0) {
        errors.push("Valid referral count is required");
      }
      if (typeof body.upgraded_referrals !== 'number' || body.upgraded_referrals < 0) {
        errors.push("Valid upgraded referral count is required");
      }
      // Section 2: Network & Experience validation
      if (body.manages_community === true && !body.community_group_links) {
        errors.push("Community group links are required when you have a community group");
      }
      if (body.promoted_platforms === true && !body.platform_promotion_details) {
        errors.push("Platform promotion details are required when you have promoted platforms");
      }
      if (body.network_description && body.network_description.length > 1000) {
        errors.push("Network description must be 1000 characters or less");
      }
      // Section 3: Local Payments & Support validation
      if (body.local_payment_methods && body.local_payment_methods.trim().length < 5) {
        errors.push("Please provide details about payment methods you can accept (minimum 5 characters)");
      }
      if (body.support_preference && ![
        'online',
        'in_person',
        'both'
      ].includes(body.support_preference)) {
        errors.push("Invalid support preference");
      }
      // Section 4: Agreement validation
      if (!body.daily_time_commitment) {
        errors.push("Daily time commitment is required");
      } else if (![
        '1-2',
        '2-4',
        '4-6',
        '6+'
      ].includes(body.daily_time_commitment)) {
        errors.push("Invalid daily time commitment value");
      }
      if (typeof body.is_currently_employed !== 'boolean') {
        errors.push("Employment status is required");
      }
      if (body.motivation_text && body.motivation_text.length < 50) {
        errors.push("Motivation must be at least 50 characters");
      }
      if (body.motivation_text && body.motivation_text.length > 1000) {
        errors.push("Motivation must be 1000 characters or less");
      }
      if (body.agrees_to_guidelines !== true) {
        errors.push("You must agree to the partner guidelines");
      }
      // Return validation errors if any
      if (errors.length > 0) {
        console.log(`⚠️ [Partner Application] Validation failed`, {
          event: 'partner-application.validation-failed',
          correlationId,
          userId: user.id,
          errorCount: errors.length,
          errors: errors,
          timingMs: Date.now() - startTime
        });
        return new Response(JSON.stringify({
          error: errors.join(". "),
          validation_errors: errors
        }), {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json"
          }
        });
      }
      console.log(`✅ [Partner Application] Validation passed`, {
        event: 'partner-application.validation-passed',
        correlationId,
        userId: user.id,
        timingMs: Date.now() - startTime
      });
      // Check if user already has an application
      const { data: existingApplication } = await supabaseClient.from("partner_applications").select("id, status").eq("user_id", user.id).single();
      if (existingApplication) {
        console.log(`⚠️ [Partner Application] Duplicate application attempt`, {
          event: 'partner-application.duplicate-application',
          correlationId,
          userId: user.id,
          existingApplicationId: existingApplication.id,
          existingStatus: existingApplication.status,
          timingMs: Date.now() - startTime
        });
        return new Response(JSON.stringify({
          error: "Application already exists",
          status: existingApplication.status
        }), {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json"
          }
        });
      }
      console.log(`🔄 [Partner Application] Creating application`, {
        event: 'partner-application.creating',
        correlationId,
        userId: user.id
      });
      // Insert application with all fields
      const { data: application, error: insertError } = await supabaseClient.from("partner_applications").insert({
        user_id: user.id,
        // Section 1: Basic Information
        preferred_contact_method: body.preferred_contact_method,
        whatsapp_number: body.whatsapp_number,
        telegram_username: body.telegram_username,
        whatsapp_group_link: body.whatsapp_group_link,
        telegram_group_link: body.telegram_group_link,
        application_notes: body.application_notes,
        applicant_country: body.applicant_country,
        current_membership_plan: body.current_membership_plan,
        total_referrals: body.total_referrals,
        upgraded_referrals: body.upgraded_referrals,
        // Section 2: Network & Experience
        manages_community: body.manages_community ?? false,
        community_group_links: body.community_group_links,
        community_member_count: body.community_member_count,
        promoted_platforms: body.promoted_platforms ?? false,
        platform_promotion_details: body.platform_promotion_details,
        network_description: body.network_description,
        expected_monthly_onboarding: body.expected_monthly_onboarding,
        // Section 3: Local Payments & Support
        local_payment_methods: body.local_payment_methods,
        can_provide_local_support: body.can_provide_local_support ?? false,
        support_preference: body.support_preference,
        organize_training_sessions: body.organize_training_sessions ?? false,
        // Section 4: Agreement
        weekly_time_commitment: body.weekly_time_commitment,
        daily_time_commitment: body.daily_time_commitment,
        is_currently_employed: body.is_currently_employed,
        motivation_text: body.motivation_text,
        agrees_to_guidelines: body.agrees_to_guidelines ?? false,
        status: "pending"
      }).select().single();
      if (insertError) {
        console.error(`🚨 [Partner Application] Insert error`, {
          event: 'partner-application.insert-error',
          correlationId,
          userId: user.id,
          error: insertError.message,
          code: insertError.code,
          timingMs: Date.now() - startTime
        });
        throw insertError;
      }
      console.log(`✅ [Partner Application] Application created successfully`, {
        event: 'partner-application.created',
        correlationId,
        userId: user.id,
        applicationId: application.id,
        status: application.status,
        membershipPlan: application.current_membership_plan,
        country: application.applicant_country,
        totalReferrals: application.total_referrals,
        upgradedReferrals: application.upgraded_referrals,
        timingMs: Date.now() - startTime
      });
      // Send notification to admins (optional - can be implemented later)
      // await supabaseClient.from("notifications").insert({
      //   user_id: admin_id,
      //   type: "partner_application",
      //   title: "New Partner Application",
      //   message: `User ${user.email} has applied to become a partner`,
      // });
      return new Response(JSON.stringify({
        success: true,
        application,
        message: "Application submitted successfully"
      }), {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    return new Response(JSON.stringify({
      error: "Method not allowed"
    }), {
      status: 405,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });
  } catch (error) {
    console.error(`🚨 [Partner Application] Unhandled error`, {
      event: 'partner-application.error',
      correlationId: req.headers.get("X-Correlation-Id") || req.headers.get("x-correlation-id") || "no-correlation-id",
      error: error.message,
      stack: error.stack,
      timingMs: Date.now() - startTime
    });
    return new Response(JSON.stringify({
      error: error.message
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });
  }
});
