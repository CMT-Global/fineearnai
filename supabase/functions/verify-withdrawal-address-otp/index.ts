import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.74.0';
import { corsHeaders } from '../_shared/cors.ts';

interface VerifyOTPRequest {
  otpCode: string;
  usdcAddress?: string;
  usdtAddress?: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Authenticate user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      console.error('Authentication error:', authError);
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('[OTP Verify] Starting OTP verification for user:', user.id);

    const { otpCode, usdcAddress, usdtAddress }: VerifyOTPRequest = await req.json();

    // Validate OTP code format
    if (!otpCode || otpCode.length !== 6 || !/^\d{6}$/.test(otpCode)) {
      return new Response(JSON.stringify({ error: 'Invalid OTP format. Must be 6 digits.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Find valid OTP record
    const { data: otpRecord, error: otpError } = await supabase
      .from('withdrawal_address_otps')
      .select('*')
      .eq('user_id', user.id)
      .eq('otp_code', otpCode)
      .is('used_at', null)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (otpError) {
      console.error('[OTP Verify] Database query error:', otpError);
      return new Response(JSON.stringify({ error: 'Failed to verify OTP' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!otpRecord) {
      console.log('[OTP Verify] No valid OTP found for user:', user.id);
      return new Response(JSON.stringify({ error: 'Invalid or expired OTP code' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check max attempts
    if (otpRecord.attempts >= otpRecord.max_attempts) {
      console.log('[OTP Verify] Max attempts exceeded for OTP:', otpRecord.id);
      
      // Mark as used to prevent further attempts
      await supabase
        .from('withdrawal_address_otps')
        .update({ used_at: new Date().toISOString() })
        .eq('id', otpRecord.id);

      return new Response(JSON.stringify({ error: 'Maximum verification attempts exceeded. Please request a new OTP.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Increment attempt counter
    const newAttempts = otpRecord.attempts + 1;
    await supabase
      .from('withdrawal_address_otps')
      .update({ attempts: newAttempts })
      .eq('id', otpRecord.id);

    console.log('[OTP Verify] OTP verified successfully, updating profile...');

    // Mark OTP as used
    await supabase
      .from('withdrawal_address_otps')
      .update({ used_at: new Date().toISOString() })
      .eq('id', otpRecord.id);

    // Update profile with new addresses
    const updateData: any = {
      withdrawal_addresses_updated_at: new Date().toISOString(),
    };

    // Only update addresses that were provided
    if (usdcAddress !== undefined) {
      updateData.usdc_solana_address = usdcAddress.trim() || null;
    }
    if (usdtAddress !== undefined) {
      updateData.usdt_bep20_address = usdtAddress.trim() || null;
    }

    const { error: updateError } = await supabase
      .from('profiles')
      .update(updateData)
      .eq('id', user.id);

    if (updateError) {
      console.error('[OTP Verify] Profile update error:', updateError);
      return new Response(JSON.stringify({ error: 'Failed to update withdrawal addresses' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('[OTP Verify] Profile updated successfully for user:', user.id);

    // Log activity
    await supabase.from('user_activity_log').insert({
      user_id: user.id,
      activity_type: 'withdrawal_address_updated',
      details: {
        usdc_updated: usdcAddress !== undefined,
        usdt_updated: usdtAddress !== undefined,
        timestamp: new Date().toISOString(),
      },
      ip_address: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown',
    });

    return new Response(JSON.stringify({ 
      success: true,
      message: 'Withdrawal addresses updated successfully',
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('[OTP Verify] Unexpected error:', error);
    return new Response(JSON.stringify({ error: error.message || 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});