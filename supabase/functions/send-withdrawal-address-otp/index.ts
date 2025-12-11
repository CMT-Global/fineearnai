import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.74.0';
import { corsHeaders } from '../_shared/cors.ts';
import { sendTemplateEmail } from '../_shared/email-sender.ts';
Deno.serve(async (req)=>{
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: corsHeaders
    });
  }
  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
    // Authenticate user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({
        error: 'Missing authorization header'
      }), {
        status: 401,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      console.error('Authentication error:', authError);
      return new Response(JSON.stringify({
        error: 'Unauthorized'
      }), {
        status: 401,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    console.log('[OTP] Starting OTP generation for user:', user.id);
    const { usdcAddress, usdtAddress } = await req.json();
    // Validate at least one address is provided
    if (!usdcAddress && !usdtAddress) {
      return new Response(JSON.stringify({
        error: 'At least one cryptocurrency address is required'
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    // Get user profile for email
    const { data: profile, error: profileError } = await supabase.from('profiles').select('email, username').eq('id', user.id).single();
    if (profileError || !profile) {
      console.error('Profile fetch error:', profileError);
      return new Response(JSON.stringify({
        error: 'User profile not found'
      }), {
        status: 404,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    const email = profile.email || user.email;
    if (!email) {
      return new Response(JSON.stringify({
        error: 'User email not found'
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    // Check for recent OTP requests (rate limiting - 1 per minute)
    const oneMinuteAgo = new Date(Date.now() - 60000).toISOString();
    const { data: recentOTP } = await supabase.from('withdrawal_address_otps').select('id').eq('user_id', user.id).gte('created_at', oneMinuteAgo).limit(1);
    if (recentOTP && recentOTP.length > 0) {
      return new Response(JSON.stringify({
        error: 'Please wait at least 1 minute before requesting another OTP'
      }), {
        status: 429,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    // Generate 6-digit OTP
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    console.log('[OTP] Generated OTP code for user:', user.id);
    // Store OTP in database (expires in 10 minutes)
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    const { error: insertError } = await supabase.from('withdrawal_address_otps').insert({
      user_id: user.id,
      email,
      otp_code: otpCode,
      expires_at: expiresAt,
      usdc_address: usdcAddress || null,
      usdt_address: usdtAddress || null,
      ip_address: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown',
      user_agent: req.headers.get('user-agent') || 'unknown'
    });
    if (insertError) {
      console.error('[OTP] Database insert error:', insertError);
      return new Response(JSON.stringify({
        error: 'Failed to create OTP'
      }), {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    console.log('[OTP] OTP stored in database, sending email...');
    // Send OTP email
    try {
      await sendTemplateEmail({
        templateType: 'withdrawal_address_change',
        recipientEmail: email,
        recipientUserId: user.id,
        variables: {
          username: profile.username || 'User',
          otp_code: otpCode,
          usdc_address: usdcAddress || 'Not provided',
          usdt_address: usdtAddress || 'Not provided',
          expiry_minutes: '10',
          platform_url: Deno.env.get('VITE_SUPABASE_URL')?.replace('//', '//app.') || 'https://fineearn.com'
        },
        supabaseClient: supabase
      });
      console.log('[OTP] Email sent successfully to:', email);
    } catch (emailError) {
      console.error('[OTP] Email sending failed:', emailError);
      // Don't fail the request if email fails, user can retry
      return new Response(JSON.stringify({
        success: true,
        warning: 'OTP created but email delivery may have failed. Please check your inbox or try again.'
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    return new Response(JSON.stringify({
      success: true,
      message: 'OTP sent successfully to your email'
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('[OTP] Unexpected error:', error);
    return new Response(JSON.stringify({
      error: error.message || 'Internal server error'
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
});
