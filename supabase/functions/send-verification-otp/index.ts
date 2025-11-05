import { createClient } from "https://esm.sh/@supabase/supabase-js@2.74.0";
import { corsHeaders } from "../_shared/cors.ts";

const generateOTP = (): string => {
  // Generate cryptographically secure 6-digit OTP
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  const otp = (array[0] % 1000000).toString().padStart(6, '0');
  return otp;
};

interface SendOTPRequest {
  user_id?: string;
  email?: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const requestId = crypto.randomUUID().substring(0, 8);
  console.log(`🔐 [${requestId}] Send verification OTP request started`);

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Get user from JWT or request body
    const authHeader = req.headers.get("Authorization");
    let userId: string | null = null;
    let userEmail: string | null = null;
    let username: string | null = null;

    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);
      
      if (!authError && user) {
        userId = user.id;
        userEmail = user.email || null;
      }
    }

    // Fallback to request body if no auth header
    if (!userId) {
      const body: SendOTPRequest = await req.json();
      userId = body.user_id || null;
      userEmail = body.email || null;
    }

    if (!userId) {
      console.error(`❌ [${requestId}] No user_id provided`);
      return new Response(
        JSON.stringify({ error: "Authentication required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`📧 [${requestId}] Processing OTP request for user: ${userId}`);

    // Step 1: Get user profile
    const { data: profile, error: profileError } = await supabaseClient
      .from("profiles")
      .select("email, username, email_verified")
      .eq("id", userId)
      .single();

    if (profileError || !profile) {
      console.error(`❌ [${requestId}] Profile not found:`, profileError);
      return new Response(
        JSON.stringify({ error: "User profile not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    username = profile.username;
    userEmail = userEmail || profile.email;

    if (!userEmail) {
      console.error(`❌ [${requestId}] No email found for user`);
      return new Response(
        JSON.stringify({ error: "No email address found" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step 2: Check if already verified
    if (profile.email_verified) {
      console.log(`✅ [${requestId}] Email already verified`);
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "Email already verified",
          already_verified: true
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step 3: Rate limiting check (max 3 OTPs per 15 minutes)
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    const { data: recentOTPs, error: countError } = await supabaseClient
      .from("email_verification_otps")
      .select("id", { count: "exact" })
      .eq("user_id", userId)
      .gte("created_at", fifteenMinutesAgo);

    if (countError) {
      console.error(`❌ [${requestId}] Error checking rate limit:`, countError);
    }

    const otpCount = recentOTPs?.length || 0;
    if (otpCount >= 3) {
      console.warn(`⚠️ [${requestId}] Rate limit exceeded: ${otpCount} OTPs in 15 mins`);
      return new Response(
        JSON.stringify({ 
          error: "Too many verification requests. Please try again in 15 minutes.",
          rate_limited: true
        }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`✅ [${requestId}] Rate limit check passed: ${otpCount}/3 OTPs`);

    // Step 4: Invalidate previous unused OTPs for this user
    const { error: invalidateError } = await supabaseClient
      .from("email_verification_otps")
      .delete()
      .eq("user_id", userId)
      .is("used_at", null);

    if (invalidateError) {
      console.warn(`⚠️ [${requestId}] Error invalidating old OTPs:`, invalidateError);
    } else {
      console.log(`🗑️ [${requestId}] Invalidated previous unused OTPs`);
    }

    // Step 5: Generate 6-digit OTP
    const otpCode = generateOTP();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // 15 minutes

    console.log(`🔢 [${requestId}] Generated OTP (expires in 15 mins)`);

    // Step 6: Store OTP in database
    const { data: otpRecord, error: insertError } = await supabaseClient
      .from("email_verification_otps")
      .insert({
        user_id: userId,
        email: userEmail,
        otp_code: otpCode,
        expires_at: expiresAt,
        ip_address: req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || null,
        user_agent: req.headers.get("user-agent") || null,
        attempts: 0,
        max_attempts: 3
      })
      .select()
      .single();

    if (insertError || !otpRecord) {
      console.error(`❌ [${requestId}] Failed to store OTP:`, insertError);
      return new Response(
        JSON.stringify({ error: "Failed to generate verification code" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`💾 [${requestId}] OTP stored in database: ${otpRecord.id}`);

    // Enhanced logging for debugging
    console.log(`📧 [${requestId}] Sending OTP email to: ${userEmail}`);
    console.log(`🔢 [${requestId}] Template: email_verification_otp`);

    // Step 7: Send email via template
    try {
      const { data: emailResult, error: emailError } = await supabaseClient.functions.invoke(
        "send-template-email",
        {
          body: {
            template_type: "email_verification_otp",
            email: userEmail,
            variables: {
              username: username || "User",
              otp_code: otpCode,
              email: userEmail,
              expiry_minutes: "15"
            }
          }
        }
      );

      if (emailError) {
        console.error(`❌ [${requestId}] Email send failed:`, emailError);
        // Don't fail the request - OTP is still valid for manual entry
        return new Response(
          JSON.stringify({ 
            success: true,
            message: "Verification code generated but email delivery failed. Please try again.",
            otp_id: otpRecord.id,
            email_error: true
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`✅ [${requestId}] Verification email sent successfully to ${userEmail}`);

      return new Response(
        JSON.stringify({ 
          success: true,
          message: "Verification code sent to your email",
          otp_id: otpRecord.id,
          expires_in_minutes: 15
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );

    } catch (emailErr: any) {
      console.error(`❌ [${requestId}] Email function error:`, emailErr);
      return new Response(
        JSON.stringify({ 
          success: true,
          message: "Verification code generated but email delivery encountered an issue",
          otp_id: otpRecord.id
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

  } catch (error: any) {
    console.error(`❌ [${requestId}] Unexpected error:`, error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
