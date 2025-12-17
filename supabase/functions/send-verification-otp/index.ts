// @ts-ignore - Deno URL imports work at runtime
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.74.0";
import { corsHeaders } from "../_shared/cors.ts";
const generateOTP = ()=>{
  // Generate cryptographically secure 6-digit OTP
  console.log("Generating otpp in the supabase file");
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  const otp = (array[0] % 1000000).toString().padStart(6, '0');
  return otp;
};

interface SendOTPRequest {
  user_id?: string;
  email?: string;
}

// @ts-ignore - Deno global is available at runtime
Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: corsHeaders
    });
  }
  const requestId = crypto.randomUUID().substring(0, 8);
  console.log(`🔐 [${requestId}] ========================================`);
  console.log(`🔐 [${requestId}] Send verification OTP request started`);
  console.log(`🔐 [${requestId}] Method: ${req.method}`);
  console.log(`🔐 [${requestId}] URL: ${req.url}`);
  console.log(`🔐 [${requestId}] Has Auth Header: ${!!req.headers.get("Authorization")}`);

  try {
    const supabaseClient = createClient(
      // @ts-ignore - Deno.env is available at runtime
      Deno.env.get("SUPABASE_URL") ?? "",
      // @ts-ignore - Deno.env is available at runtime
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Get user from JWT or request body
    const authHeader = req.headers.get("Authorization");
    let userId = null;
    let userEmail = null;
    let username = null;
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);
      if (!authError && user) {
        userId = user.id;
        userEmail = user.email || null;
        console.log(`✅ [${requestId}] User authenticated via JWT: ${userId}`);
      } else {
        console.error(`❌ [${requestId}] Auth error:`, authError);
      }
    } else {
      console.warn(`⚠️ [${requestId}] No Authorization header provided`);
    }

    // Fallback to request body if no auth header (for service-to-service calls)
    if (!userId) {
      try {
        // Check if request has a body before trying to parse it
        const contentType = req.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          const body: SendOTPRequest = await req.json();
          userId = body.user_id || null;
          userEmail = body.email || null;
          if (userId) {
            console.log(`✅ [${requestId}] User ID from request body: ${userId}`);
          }
        }
      } catch (bodyError: any) {
        // No body or invalid JSON - that's okay if we have auth
        console.log(`ℹ️ [${requestId}] No request body or invalid JSON (this is normal for authenticated requests)`);
      }
    }
    if (!userId) {
      console.error(`❌ [${requestId}] No user_id provided`);
      return new Response(JSON.stringify({
        error: "Authentication required"
      }), {
        status: 401,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    console.log(`📧 [${requestId}] Processing OTP request for user: ${userId}`);
    // Step 1: Get user profile
    const { data: profile, error: profileError } = await supabaseClient.from("profiles").select("email, username, email_verified").eq("id", userId).single();
    if (profileError || !profile) {
      console.error(`❌ [${requestId}] Profile not found:`, profileError);
      return new Response(JSON.stringify({
        error: "User profile not found"
      }), {
        status: 404,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    username = profile.username;
    userEmail = userEmail || profile.email;
    if (!userEmail) {
      console.error(`❌ [${requestId}] No email found for user`);
      return new Response(JSON.stringify({
        error: "No email address found"
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    // Step 2: Check if already verified
    if (profile.email_verified) {
      console.log(`✅ [${requestId}] Email already verified`);
      return new Response(JSON.stringify({
        success: true,
        message: "Email already verified",
        already_verified: true
      }), {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    // Step 3: Rate limiting check (max 3 OTPs per 15 minutes)
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    const { data: recentOTPs, error: countError } = await supabaseClient.from("email_verification_otps").select("id", {
      count: "exact"
    }).eq("user_id", userId).gte("created_at", fifteenMinutesAgo);
    if (countError) {
      console.error(`❌ [${requestId}] Error checking rate limit:`, countError);
    }
    const otpCount = recentOTPs?.length || 0;
    if (otpCount >= 3) {
      console.warn(`⚠️ [${requestId}] Rate limit exceeded: ${otpCount} OTPs in 15 mins`);
      return new Response(JSON.stringify({
        error: "Too many verification requests. Please try again in 15 minutes.",
        rate_limited: true
      }), {
        status: 429,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    console.log(`✅ [${requestId}] Rate limit check passed: ${otpCount}/3 OTPs`);
    // Step 4: Invalidate previous unused OTPs for this user
    const { error: invalidateError } = await supabaseClient.from("email_verification_otps").delete().eq("user_id", userId).is("used_at", null);
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
    const { data: otpRecord, error: insertError } = await supabaseClient.from("email_verification_otps").insert({
      user_id: userId,
      email: userEmail,
      otp_code: otpCode,
      expires_at: expiresAt,
      ip_address: req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || null,
      user_agent: req.headers.get("user-agent") || null,
      attempts: 0,
      max_attempts: 3
    }).select().single();
    if (insertError || !otpRecord) {
      console.error(`❌ [${requestId}] Failed to store OTP:`, insertError);
      return new Response(JSON.stringify({
        error: "Failed to generate verification code"
      }), {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    console.log(`💾 [${requestId}] OTP stored in database: ${otpRecord.id}`);
    // Enhanced logging for debugging
    console.log(`📧 [${requestId}] Sending OTP email to: ${userEmail}`);
    console.log(`🔢 [${requestId}] Template: email_verification_otp`);
    // Step 7: Send email via template
    try {
      console.log(`📧 [${requestId}] Invoking send-template-email function...`);
      
      // @ts-ignore - Deno.env is available at runtime
      const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
      // @ts-ignore - Deno.env is available at runtime
      const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
      
      // Make direct HTTP call to edge function with service role key
      const functionUrl = `${supabaseUrl}/functions/v1/send-template-email`;
      const response = await fetch(functionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseServiceKey}`,
        },
        body: JSON.stringify({
          template_type: "email_verification_otp",
          email: userEmail,
          variables: {
            username: username || "User",
            otp_code: otpCode,
            email: userEmail,
            expiry_minutes: "15"
          }
        }),
      });


      


      let emailResult: any = null;
      let emailError: any = null;

      if (!response.ok) {
        const errorText = await response.text();
        emailError = new Error(`Edge Function returned status ${response.status}: ${errorText}`);
      } else {
        emailResult = await response.json();
      }

      console.log(`📧 [${requestId}] Email function response received:`, {
        hasError: !!emailError,
        hasData: !!emailResult,
        emailResultType: typeof emailResult,
        emailResultKeys: emailResult ? Object.keys(emailResult) : [],
        emailResultSuccess: emailResult?.success,
        emailResultError: emailResult?.error,
        emailResultEmailId: emailResult?.email_id,
        emailErrorDetails: emailError
      });

      // CRITICAL: If there's an invocation error, email definitely failed
      if (emailError) {
        console.error(`❌ [${requestId}] Email function invocation failed:`, emailError);
        return new Response(
          JSON.stringify({ 
            success: false,  // MUST be false
            error: "Failed to send verification email. Please try again.",
            message: "Verification code generated but email delivery failed. Please try again.",
            otp_id: otpRecord.id,
            email_error: true,
            error_details: emailError.message || String(emailError)
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Check for application-level errors in response
      // Be more defensive - check for any indication of failure
      if (!emailResult) {
        console.error(`❌ [${requestId}] No email result received`);
        return new Response(
          JSON.stringify({ 
            success: false,
            error: "Email service returned no response",
            message: "Verification code generated but email delivery failed. Please try again.",
            otp_id: otpRecord.id,
            email_error: true,
            error_details: "No response from email service"
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Check if email send failed (multiple ways to indicate failure)
      // send-template-email returns: { success: true/false, error?: string, email_id?: string }
      // IMPORTANT: Check for failure indicators FIRST, before checking success
      const hasError = !!emailResult.error;
      const hasEmailId = !!emailResult.email_id && emailResult.email_id.trim() !== '';
      const isSuccess = emailResult.success === true;
      
      // Email failed if: explicit error, no email_id, or success is false
      const emailFailed = hasError || !hasEmailId || !isSuccess;

      if (emailFailed) {
        const errorMessage = emailResult?.error || 
                            (!hasEmailId ? "Email service did not return a message ID" : "Email service returned an error");
        console.error(`❌ [${requestId}] Email send failed:`, errorMessage);
        console.error(`❌ [${requestId}] Response analysis:`, {
          hasError,
          hasEmailId,
          isSuccess,
          emailFailed,
          emailResultSuccess: emailResult?.success,
          emailResultError: emailResult?.error,
          emailResultEmailId: emailResult?.email_id
        });
        console.error(`❌ [${requestId}] Full email result:`, JSON.stringify(emailResult, null, 2));
        
        return new Response(
          JSON.stringify({ 
            success: false,  // ALWAYS false when email fails
            error: errorMessage,
            message: "Verification code generated but email delivery failed. Please try again.",
            otp_id: otpRecord.id,
            email_error: true,
            error_details: emailResult
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Final safety check: Only return success if we have a valid email_id
      // This prevents returning success: true when email actually failed
      if (!emailResult.email_id || emailResult.email_id.trim() === '') {
        console.error(`❌ [${requestId}] CRITICAL: Email result has success=true but no email_id!`);
        console.error(`❌ [${requestId}] This should never happen - treating as failure`);
        return new Response(
          JSON.stringify({ 
            success: false,  // MUST be false - no email_id means email didn't send
            error: "Email service did not return a message ID",
            message: "Verification code generated but email delivery failed. Please try again.",
            otp_id: otpRecord.id,
            email_error: true,
            error_details: "Missing email_id in response"
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Success - email was sent (we have email_id as proof)
      console.log(`✅ [${requestId}] Verification email sent successfully to ${userEmail}`);
      console.log(`✅ [${requestId}] Email ID: ${emailResult.email_id}`);
      console.log(`✅ [${requestId}] OTP Code: ${otpCode} (for debugging only - remove in production)`);
      console.log(`🔐 [${requestId}] ========================================`);

      return new Response(
        JSON.stringify({ 
          success: true,
          message: "Verification code sent to your email",
          otp_id: otpRecord.id,
          expires_in_minutes: 15,
          email_id: emailResult.email_id
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );

    } catch (emailErr: any) {
      console.error(`❌ [${requestId}] Email function exception:`, emailErr);
      console.error(`❌ [${requestId}] Exception stack:`, emailErr.stack);
      return new Response(
        JSON.stringify({ 
          success: false,
          error: "Unexpected error sending email",
          message: "Verification code generated but email delivery encountered an issue. Please try again.",
          otp_id: otpRecord.id,
          email_error: true,
          error_details: emailErr.message
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  } catch (error) {
    console.error(`❌ [${requestId}] Unexpected error:`, error);
    console.error(`❌ [${requestId}] Error stack:`, error.stack);
    console.log(`🔐 [${requestId}] ========================================`);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
