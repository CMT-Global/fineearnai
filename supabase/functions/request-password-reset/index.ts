import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.0";
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};
// Generate cryptographically secure random token (32 bytes = 256 bits)
function generateSecureToken() {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, (byte)=>byte.toString(16).padStart(2, '0')).join('');
}
// Extract IP address from request headers
function extractClientIP(req) {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  const realIp = req.headers.get('x-real-ip');
  if (realIp) {
    return realIp;
  }
  return 'unknown';
}
serve(async (req)=>{
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: corsHeaders
    });
  }
  const requestId = crypto.randomUUID();
  console.log(`🔐 [${requestId}] Password reset request received`);
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { email } = await req.json();
    const clientIP = extractClientIP(req);
    const userAgent = req.headers.get('user-agent') || 'unknown';
    console.log(`📧 [${requestId}] Processing password reset for email: ${email}, IP: ${clientIP}`);
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
      console.log(`❌ [${requestId}] Invalid email format: ${email}`);
      // Return success anyway to prevent email enumeration
      return new Response(JSON.stringify({
        success: true,
        message: 'If an account exists with this email, you will receive a password reset link shortly.'
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        },
        status: 200
      });
    }
    // RATE LIMITING: 5 attempts per 5 minutes (more user-friendly, still secure)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const { data: recentRequests, error: rateLimitError } = await supabase.from('password_reset_tokens').select('id, created_at').eq('email', email.toLowerCase()).gte('created_at', fiveMinutesAgo).order('created_at', {
      ascending: false
    });
    if (rateLimitError) {
      console.error(`❌ [${requestId}] Rate limit check failed:`, rateLimitError);
    } else if (recentRequests && recentRequests.length >= 5) {
      console.log(`⚠️ [${requestId}] Rate limit exceeded for email: ${email} (${recentRequests.length} requests in last 5 minutes)`);
      return new Response(JSON.stringify({
        success: false,
        error: 'rate_limit_exceeded',
        message: 'Too many password reset requests. Please wait 5 minutes and try again.'
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        },
        status: 429
      });
    }
    // Check if user exists in profiles table (indexed, scalable for 1M+ users)
    const { data: profile, error: profileError } = await supabase.from('profiles').select('id, email, username, full_name').eq('email', email.toLowerCase()).maybeSingle();
    if (profileError) {
      console.error(`❌ [${requestId}] Error fetching profile:`, profileError);
      throw new Error('Failed to process request');
    }
    if (!profile) {
      console.log(`ℹ️ [${requestId}] No user found with email: ${email}`);
      // Return success anyway to prevent email enumeration attacks
      return new Response(JSON.stringify({
        success: true,
        message: 'If an account exists with this email, you will receive a password reset link shortly.'
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        },
        status: 200
      });
    }
    console.log(`✅ [${requestId}] User found: ${profile.id}`);
    const username = profile.username || profile.full_name || 'User';
    // Generate secure token
    const token = generateSecureToken();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now
    console.log(`🔑 [${requestId}] Generated secure token, expires at: ${expiresAt.toISOString()}`);
    // Store token in database
    const { data: tokenRecord, error: tokenError } = await supabase.from('password_reset_tokens').insert({
      user_id: profile.id,
      email: email.toLowerCase(),
      token: token,
      expires_at: expiresAt.toISOString(),
      ip_address: clientIP,
      user_agent: userAgent
    }).select().single();
    if (tokenError) {
      console.error(`❌ [${requestId}] Error storing token:`, tokenError);
      throw new Error('Failed to create password reset token');
    }
    console.log(`✅ [${requestId}] Token stored in database: ${tokenRecord.id}`);
    // Generate reset link
    const resetLink = `${req.headers.get('origin') || 'https://fineearn.com'}/reset-password?token=${token}`;
    // Send email using new template email sender
    console.log(`📧 [${requestId}] Sending password reset email to: ${email}`);
    const { error: emailError } = await supabase.functions.invoke('send-template-email', {
      body: {
        email: email,
        template_type: 'auth_password_reset',
        variables: {
          username: username,
          reset_link: resetLink,
          email: email
        }
      }
    });
    if (emailError) {
      console.error(`❌ [${requestId}] Error sending email:`, emailError);
    // Don't fail the request - token is already created
    // User can try requesting again
    } else {
      console.log(`✅ [${requestId}] Password reset email sent successfully`);
    }
    return new Response(JSON.stringify({
      success: true,
      message: 'If an account exists with this email, you will receive a password reset link shortly.',
      requestId: requestId
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      status: 200
    });
  } catch (error) {
    console.error(`❌ [${requestId}] Unexpected error:`, error);
    return new Response(JSON.stringify({
      success: false,
      error: 'internal_error',
      message: 'An unexpected error occurred. Please try again later.'
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      status: 500
    });
  }
});
