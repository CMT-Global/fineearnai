import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface VerifyResetTokenBody {
  token: string;
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const requestId = crypto.randomUUID();
  console.log(`🔍 [${requestId}] Token verification request received`);

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { token }: VerifyResetTokenBody = await req.json();

    if (!token) {
      console.log(`❌ [${requestId}] No token provided`);
      return new Response(
        JSON.stringify({
          success: false,
          error: 'missing_token',
          message: 'Reset token is required',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    console.log(`🔑 [${requestId}] Verifying token: ${token.substring(0, 8)}...`);

    // Fetch token from database
    const { data: tokenRecord, error: tokenError } = await supabase
      .from('password_reset_tokens')
      .select('*')
      .eq('token', token)
      .single();

    if (tokenError || !tokenRecord) {
      console.log(`❌ [${requestId}] Token not found in database`);
      return new Response(
        JSON.stringify({
          success: false,
          error: 'invalid_token',
          message: 'Invalid or expired reset token',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    console.log(`✅ [${requestId}] Token found: ${tokenRecord.id}`);

    // Check if token has already been used
    if (tokenRecord.used_at) {
      console.log(`❌ [${requestId}] Token already used at: ${tokenRecord.used_at}`);
      return new Response(
        JSON.stringify({
          success: false,
          error: 'token_used',
          message: 'This reset link has already been used. Please request a new password reset.',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Check if token has expired
    const expiresAt = new Date(tokenRecord.expires_at);
    const now = new Date();
    
    if (now > expiresAt) {
      console.log(`❌ [${requestId}] Token expired at: ${tokenRecord.expires_at}`);
      return new Response(
        JSON.stringify({
          success: false,
          error: 'token_expired',
          message: 'This reset link has expired. Please request a new password reset.',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Fetch user info
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('username, email')
      .eq('id', tokenRecord.user_id)
      .single();

    if (profileError) {
      console.error(`❌ [${requestId}] Error fetching profile:`, profileError);
    }

    const timeRemaining = Math.floor((expiresAt.getTime() - now.getTime()) / 1000 / 60); // minutes

    console.log(`✅ [${requestId}] Token is valid, expires in ${timeRemaining} minutes`);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Token is valid',
        data: {
          userId: tokenRecord.user_id,
          email: tokenRecord.email,
          username: profile?.username || 'User',
          expiresAt: tokenRecord.expires_at,
          timeRemainingMinutes: timeRemaining,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error: any) {
    console.error(`❌ [${requestId}] Unexpected error:`, error);
    return new Response(
      JSON.stringify({
        success: false,
        error: 'internal_error',
        message: 'An unexpected error occurred. Please try again later.',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
