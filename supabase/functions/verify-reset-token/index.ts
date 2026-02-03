import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: corsHeaders
    });
  }

  const requestId = crypto.randomUUID();
  console.log(`🔒 [${requestId}] Verify reset token request received`);

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { token } = await req.json();

    if (!token) {
      console.log(`❌ [${requestId}] Missing token`);
      return new Response(JSON.stringify({
        success: false,
        error: 'missing_token',
        message: 'Reset token is required'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      });
    }

    console.log(`🔑 [${requestId}] Verifying token: ${token.substring(0, 8)}...`);

    // Fetch token from database
    const { data: tokenRecord, error: tokenError } = await supabase
      .from('password_reset_tokens')
      .select('*')
      .eq('token', token)
      .maybeSingle();

    if (tokenError) {
      console.error(`❌ [${requestId}] Error fetching token:`, tokenError);
      throw new Error('Failed to verify token');
    }

    if (!tokenRecord) {
      console.log(`❌ [${requestId}] Token not found`);
      return new Response(JSON.stringify({
        success: false,
        error: 'invalid_token',
        message: 'Invalid or expired reset token'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      });
    }

    // Check if used
    if (tokenRecord.used_at) {
      console.log(`❌ [${requestId}] Token already used at: ${tokenRecord.used_at}`);
      return new Response(JSON.stringify({
        success: false,
        error: 'token_used',
        message: 'This reset link has already been used'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      });
    }

    // Check expiry
    const expiresAt = new Date(tokenRecord.expires_at);
    const now = new Date();
    if (now > expiresAt) {
      console.log(`❌ [${requestId}] Token expired at: ${tokenRecord.expires_at}`);
      return new Response(JSON.stringify({
        success: false,
        error: 'token_expired',
        message: 'This reset link has expired. Please request a new password reset.'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      });
    }

    // Get user email
    const { data: profile } = await supabase
      .from('profiles')
      .select('email')
      .eq('id', tokenRecord.user_id)
      .maybeSingle();

    const timeRemainingMinutes = Math.round((expiresAt.getTime() - now.getTime()) / (1000 * 60));

    console.log(`✅ [${requestId}] Token verified successfully`);

    return new Response(JSON.stringify({
      success: true,
      data: {
        email: profile?.email || tokenRecord.email,
        timeRemainingMinutes
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });

  } catch (error: any) {
    console.error(`❌ [${requestId}] Unexpected error:`, error);
    return new Response(JSON.stringify({
      success: false,
      error: 'internal_error',
      message: error.message || 'An unexpected error occurred'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }
});