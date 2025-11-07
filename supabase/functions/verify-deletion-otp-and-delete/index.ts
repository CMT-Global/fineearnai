import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

interface VerifyOTPRequest {
  otp_code: string;
  user_id?: string;
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
    // Create Supabase client with user's JWT
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    // Create admin client for deletion
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // Get authenticated user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);
    
    if (authError || !user) {
      console.error('[VERIFY-DELETION-OTP] Auth error:', authError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = user.id;
    console.log('[VERIFY-DELETION-OTP] Verifying OTP for user:', userId);

    // Parse request body
    const body: VerifyOTPRequest = await req.json();
    const { otp_code } = body;

    if (!otp_code || otp_code.length !== 6) {
      return new Response(
        JSON.stringify({ error: 'Invalid OTP format. Please enter a 6-digit code.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[VERIFY-DELETION-OTP] Looking for OTP:', otp_code);

    // Find the OTP record
    const { data: otpRecord, error: otpError } = await supabaseAdmin
      .from('account_deletion_otps')
      .select('*')
      .eq('user_id', userId)
      .eq('otp_code', otp_code)
      .is('used_at', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (otpError || !otpRecord) {
      console.error('[VERIFY-DELETION-OTP] OTP not found:', otpError);
      return new Response(
        JSON.stringify({ error: 'Invalid OTP code. Please check and try again.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[VERIFY-DELETION-OTP] OTP record found:', otpRecord.id);

    // Check if OTP has expired
    const now = new Date();
    const expiresAt = new Date(otpRecord.expires_at);
    
    if (now > expiresAt) {
      console.warn('[VERIFY-DELETION-OTP] OTP expired:', otpRecord.id);
      return new Response(
        JSON.stringify({ error: 'OTP has expired. Please request a new one.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if max attempts exceeded
    if (otpRecord.attempts >= otpRecord.max_attempts) {
      console.warn('[VERIFY-DELETION-OTP] Max attempts exceeded:', otpRecord.id);
      return new Response(
        JSON.stringify({ error: 'Maximum verification attempts exceeded. Please request a new OTP.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Mark OTP as used
    const { error: updateError } = await supabaseAdmin
      .from('account_deletion_otps')
      .update({ 
        used_at: new Date().toISOString(),
        attempts: otpRecord.attempts + 1
      })
      .eq('id', otpRecord.id);

    if (updateError) {
      console.error('[VERIFY-DELETION-OTP] Error updating OTP:', updateError);
      return new Response(
        JSON.stringify({ error: 'Failed to verify OTP' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[VERIFY-DELETION-OTP] OTP verified successfully. Proceeding with account deletion...');

    // Get user profile info for logging
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('username, email')
      .eq('id', userId)
      .single();

    // Log the deletion event in audit logs BEFORE deletion
    const { error: auditError } = await supabaseAdmin
      .from('user_activity_log')
      .insert({
        user_id: userId,
        activity_type: 'account_deletion_initiated',
        details: {
          username: profile?.username,
          email: profile?.email,
          deleted_at: new Date().toISOString(),
          ip_address: otpRecord.ip_address,
          user_agent: otpRecord.user_agent
        },
        ip_address: otpRecord.ip_address
      });

    if (auditError) {
      console.error('[VERIFY-DELETION-OTP] Error logging deletion:', auditError);
    }

    // **CRITICAL DELETION STEP**: Delete user from auth.users
    // This will trigger CASCADE deletions across all related tables
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);

    if (deleteError) {
      console.error('[VERIFY-DELETION-OTP] Error deleting user:', deleteError);
      return new Response(
        JSON.stringify({ 
          error: 'Failed to delete account. Please contact support.',
          details: deleteError.message
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[VERIFY-DELETION-OTP] ✅ Account deleted successfully:', userId);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Your account has been permanently deleted. You will be logged out shortly.'
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[VERIFY-DELETION-OTP] Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});