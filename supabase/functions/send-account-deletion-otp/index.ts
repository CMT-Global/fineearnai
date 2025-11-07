import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

// Generate cryptographically secure 6-digit OTP
function generateOTP(): string {
  const array = new Uint8Array(3);
  crypto.getRandomValues(array);
  const num = ((array[0] << 16) | (array[1] << 8) | array[2]) % 1000000;
  return num.toString().padStart(6, '0');
}

interface SendOTPRequest {
  user_id?: string;
  email?: string;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    // Get user from JWT or request body
    let userId: string;
    let userEmail: string;

    const authHeader = req.headers.get('Authorization');
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);
      
      if (authError || !user) {
        console.error('[SEND-DELETION-OTP] Auth error:', authError);
        return new Response(
          JSON.stringify({ error: 'Unauthorized' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      userId = user.id;
      userEmail = user.email || '';
    } else {
      const body: SendOTPRequest = await req.json();
      if (!body.user_id || !body.email) {
        return new Response(
          JSON.stringify({ error: 'Missing user_id or email' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      userId = body.user_id;
      userEmail = body.email;
    }

    console.log('[SEND-DELETION-OTP] Generating OTP for user:', userId);

    // Check if user profile exists
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('email, email_verified, username')
      .eq('id', userId)
      .single();

    if (profileError || !profile) {
      console.error('[SEND-DELETION-OTP] Profile not found:', profileError);
      return new Response(
        JSON.stringify({ error: 'User profile not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const finalEmail = userEmail || profile.email;
    if (!finalEmail) {
      return new Response(
        JSON.stringify({ error: 'User email not found' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Rate limiting: Check for recent OTP requests (max 3 per 15 minutes)
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    const { data: recentOTPs, error: recentError } = await supabaseClient
      .from('account_deletion_otps')
      .select('id')
      .eq('user_id', userId)
      .gte('created_at', fifteenMinutesAgo);

    if (recentError) {
      console.error('[SEND-DELETION-OTP] Error checking recent OTPs:', recentError);
    }

    if (recentOTPs && recentOTPs.length >= 3) {
      console.warn('[SEND-DELETION-OTP] Rate limit exceeded for user:', userId);
      return new Response(
        JSON.stringify({ 
          error: 'Too many OTP requests. Please wait 15 minutes before trying again.',
          rate_limited: true
        }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Invalidate all previous unused OTPs for this user
    const { error: invalidateError } = await supabaseClient
      .from('account_deletion_otps')
      .update({ used_at: new Date().toISOString() })
      .eq('user_id', userId)
      .is('used_at', null);

    if (invalidateError) {
      console.error('[SEND-DELETION-OTP] Error invalidating old OTPs:', invalidateError);
    }

    // Generate new OTP
    const otpCode = generateOTP();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes expiry

    console.log('[SEND-DELETION-OTP] Generated OTP:', otpCode, 'Expires at:', expiresAt);

    // Extract IP and User-Agent for audit trail
    const ipAddress = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
    const userAgent = req.headers.get('user-agent') || 'unknown';

    // Store OTP in database
    const { data: otpRecord, error: otpError } = await supabaseClient
      .from('account_deletion_otps')
      .insert({
        user_id: userId,
        email: finalEmail,
        otp_code: otpCode,
        expires_at: expiresAt.toISOString(),
        ip_address: ipAddress,
        user_agent: userAgent,
        attempts: 0,
        max_attempts: 3
      })
      .select()
      .single();

    if (otpError) {
      console.error('[SEND-DELETION-OTP] Error storing OTP:', otpError);
      return new Response(
        JSON.stringify({ error: 'Failed to generate OTP' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[SEND-DELETION-OTP] OTP stored successfully:', otpRecord.id);

    // Send OTP via email using send-template-email function
    const { data: emailResponse, error: emailError } = await supabaseClient.functions.invoke(
      'send-template-email',
      {
        body: {
          to: finalEmail,
          template_type: 'account_deletion_otp',
          variables: {
            username: profile.username || 'User',
            otp_code: otpCode,
            expiry_minutes: '15'
          }
        }
      }
    );

    if (emailError) {
      console.error('[SEND-DELETION-OTP] Error sending email:', emailError);
      return new Response(
        JSON.stringify({ 
          error: 'OTP generated but email failed to send. Please try again.',
          otp_stored: true
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[SEND-DELETION-OTP] Email sent successfully:', emailResponse);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Account deletion OTP sent to your email',
        expires_at: expiresAt.toISOString()
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[SEND-DELETION-OTP] Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});