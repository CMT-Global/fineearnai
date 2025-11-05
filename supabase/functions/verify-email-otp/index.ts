import { createClient } from "https://esm.sh/@supabase/supabase-js@2.74.0";
import { corsHeaders } from "../_shared/cors.ts";

interface VerifyOTPRequest {
  otp_code: string;
  user_id?: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const requestId = crypto.randomUUID().substring(0, 8);
  console.log(`🔐 [${requestId}] Verify email OTP request started`);

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Get user from JWT
    const authHeader = req.headers.get("Authorization");
    let userId: string | null = null;

    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);
      
      if (!authError && user) {
        userId = user.id;
      }
    }

    // Parse request body
    const body: VerifyOTPRequest = await req.json();
    const otpCode = body.otp_code?.trim();

    // Use user_id from body if not authenticated (fallback)
    if (!userId && body.user_id) {
      userId = body.user_id;
    }

    if (!userId) {
      console.error(`❌ [${requestId}] No user_id provided`);
      return new Response(
        JSON.stringify({ error: "Authentication required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!otpCode || otpCode.length !== 6 || !/^\d{6}$/.test(otpCode)) {
      console.error(`❌ [${requestId}] Invalid OTP format: ${otpCode}`);
      return new Response(
        JSON.stringify({ error: "Invalid verification code format. Please enter a 6-digit code." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`🔍 [${requestId}] Verifying OTP for user: ${userId}`);

    // Step 1: Find matching OTP
    const { data: otpRecords, error: findError } = await supabaseClient
      .from("email_verification_otps")
      .select("*")
      .eq("user_id", userId)
      .eq("otp_code", otpCode)
      .is("used_at", null)
      .order("created_at", { ascending: false })
      .limit(1);

    if (findError) {
      console.error(`❌ [${requestId}] Error finding OTP:`, findError);
      return new Response(
        JSON.stringify({ error: "Verification failed. Please try again." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!otpRecords || otpRecords.length === 0) {
      console.warn(`⚠️ [${requestId}] OTP not found or already used`);
      return new Response(
        JSON.stringify({ 
          error: "Invalid verification code. Please check and try again.",
          invalid_code: true
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const otpRecord = otpRecords[0];
    console.log(`✅ [${requestId}] OTP found: ${otpRecord.id}`);

    // Step 2: Check if expired
    const now = new Date();
    const expiresAt = new Date(otpRecord.expires_at);
    
    if (now > expiresAt) {
      console.warn(`⚠️ [${requestId}] OTP expired at ${expiresAt.toISOString()}`);
      
      // Mark as expired (delete it)
      await supabaseClient
        .from("email_verification_otps")
        .delete()
        .eq("id", otpRecord.id);

      return new Response(
        JSON.stringify({ 
          error: "Verification code has expired. Please request a new one.",
          expired: true
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step 3: Check attempt count
    if (otpRecord.attempts >= otpRecord.max_attempts) {
      console.warn(`⚠️ [${requestId}] Max attempts reached: ${otpRecord.attempts}/${otpRecord.max_attempts}`);
      
      // Invalidate OTP
      await supabaseClient
        .from("email_verification_otps")
        .delete()
        .eq("id", otpRecord.id);

      return new Response(
        JSON.stringify({ 
          error: "Too many failed attempts. Please request a new verification code.",
          max_attempts_reached: true
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step 4: Verify the code (it matches if we got here)
    console.log(`✅ [${requestId}] OTP code verified successfully`);

    // Step 5: Mark OTP as used
    const { error: updateOTPError } = await supabaseClient
      .from("email_verification_otps")
      .update({ 
        used_at: new Date().toISOString(),
        attempts: otpRecord.attempts + 1
      })
      .eq("id", otpRecord.id);

    if (updateOTPError) {
      console.error(`❌ [${requestId}] Failed to mark OTP as used:`, updateOTPError);
      // Continue anyway - this is not critical
    }

    // Step 6: Update user profile - mark email as verified
    const { error: updateProfileError } = await supabaseClient
      .from("profiles")
      .update({ 
        email_verified: true,
        email_verified_at: new Date().toISOString()
      })
      .eq("id", userId);

    if (updateProfileError) {
      console.error(`❌ [${requestId}] Failed to update profile:`, updateProfileError);
      return new Response(
        JSON.stringify({ error: "Failed to verify email. Please try again." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`✅ [${requestId}] Profile updated - email marked as verified`);

    // Step 7: Cleanup - delete all other OTPs for this user
    const { error: cleanupError } = await supabaseClient
      .from("email_verification_otps")
      .delete()
      .eq("user_id", userId)
      .neq("id", otpRecord.id);

    if (cleanupError) {
      console.warn(`⚠️ [${requestId}] Cleanup of old OTPs failed:`, cleanupError);
      // Non-critical error
    } else {
      console.log(`🗑️ [${requestId}] Cleaned up other OTPs for user`);
    }

    // Step 8: Log activity
    try {
      await supabaseClient
        .from("user_activity_log")
        .insert({
          user_id: userId,
          activity_type: "email_verified",
          ip_address: req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || null,
          details: {
            otp_id: otpRecord.id,
            verified_at: new Date().toISOString()
          }
        });
    } catch (logError) {
      console.warn(`⚠️ [${requestId}] Failed to log activity:`, logError);
      // Non-critical
    }

    console.log(`🎉 [${requestId}] Email verification completed successfully`);

    return new Response(
      JSON.stringify({ 
        success: true,
        message: "Email verified successfully!",
        verified_at: new Date().toISOString()
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error(`❌ [${requestId}] Unexpected error:`, error);
    
    // If it's an invalid attempt, increment the attempt counter
    if (error.message?.includes("Invalid") || error.message?.includes("incorrect")) {
      // This will be handled in the OTP lookup section above
    }

    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
