import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.0";
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};
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
  console.log(`🔒 [${requestId}] Password reset request received`);
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { token, newPassword } = await req.json();
    const clientIP = extractClientIP(req);
    if (!token || !newPassword) {
      console.log(`❌ [${requestId}] Missing required fields`);
      return new Response(JSON.stringify({
        success: false,
        error: 'missing_fields',
        message: 'Token and new password are required'
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        },
        status: 400
      });
    }
    // Validate password strength (minimum 6 characters as per Supabase default)
    if (newPassword.length < 6) {
      console.log(`❌ [${requestId}] Password too short`);
      return new Response(JSON.stringify({
        success: false,
        error: 'weak_password',
        message: 'Password must be at least 6 characters long'
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        },
        status: 400
      });
    }
    console.log(`🔑 [${requestId}] Verifying token: ${token.substring(0, 8)}..., IP: ${clientIP}`);
    // Fetch and verify token
    const { data: tokenRecord, error: tokenError } = await supabase.from('password_reset_tokens').select('*').eq('token', token).single();
    if (tokenError || !tokenRecord) {
      console.log(`❌ [${requestId}] Token not found in database`);
      return new Response(JSON.stringify({
        success: false,
        error: 'invalid_token',
        message: 'Invalid or expired reset token'
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        },
        status: 400
      });
    }
    console.log(`✅ [${requestId}] Token found: ${tokenRecord.id}`);
    // Check if token has already been used
    if (tokenRecord.used_at) {
      console.log(`❌ [${requestId}] Token already used at: ${tokenRecord.used_at}`);
      return new Response(JSON.stringify({
        success: false,
        error: 'token_used',
        message: 'This reset link has already been used'
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        },
        status: 400
      });
    }
    // Check if token has expired
    const expiresAt = new Date(tokenRecord.expires_at);
    const now = new Date();
    if (now > expiresAt) {
      console.log(`❌ [${requestId}] Token expired at: ${tokenRecord.expires_at}`);
      return new Response(JSON.stringify({
        success: false,
        error: 'token_expired',
        message: 'This reset link has expired. Please request a new password reset.'
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        },
        status: 400
      });
    }
    console.log(`🔐 [${requestId}] Updating password for user: ${tokenRecord.user_id}`);
    // Update password using Supabase Admin API
    const { data: updateData, error: updateError } = await supabase.auth.admin.updateUserById(tokenRecord.user_id, {
      password: newPassword
    });
    if (updateError) {
      console.error(`❌ [${requestId}] Failed to update password:`, updateError);
      return new Response(JSON.stringify({
        success: false,
        error: 'update_failed',
        message: 'Failed to update password. Please try again.'
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        },
        status: 500
      });
    }
    console.log(`✅ [${requestId}] Password updated successfully for user: ${tokenRecord.user_id}`);
    // Mark token as used
    const { error: markUsedError } = await supabase.from('password_reset_tokens').update({
      used_at: now.toISOString()
    }).eq('id', tokenRecord.id);
    if (markUsedError) {
      console.error(`⚠️ [${requestId}] Failed to mark token as used:`, markUsedError);
    // Don't fail the request - password was already updated
    } else {
      console.log(`✅ [${requestId}] Token marked as used`);
    }
    // Log activity for security audit
    const { error: activityError } = await supabase.from('user_activity_log').insert({
      user_id: tokenRecord.user_id,
      activity_type: 'password_reset',
      ip_address: clientIP,
      details: {
        request_id: requestId,
        reset_method: 'custom_token',
        token_id: tokenRecord.id
      }
    });
    if (activityError) {
      console.error(`⚠️ [${requestId}] Failed to log activity:`, activityError);
    }
    // Get user profile for confirmation email
    const { data: profile, error: profileError } = await supabase.from('profiles').select('username, email, full_name').eq('id', tokenRecord.user_id).single();
    // Send password change confirmation email (optional - don't fail if this fails)
    if (profile?.email) {
      console.log(`📧 [${requestId}] Sending confirmation email to: ${profile.email}`);
      const { error: emailError } = await supabase.functions.invoke('send-auth-email', {
        body: {
          email: profile.email,
          emailType: 'password_changed_confirmation',
          data: {
            username: profile.username || profile.full_name || 'User',
            email: profile.email,
            reset_date: now.toISOString(),
            ip_address: clientIP
          }
        }
      });
      if (emailError) {
        console.error(`⚠️ [${requestId}] Failed to send confirmation email:`, emailError);
      // Don't fail the request - password was already updated
      } else {
        console.log(`✅ [${requestId}] Confirmation email sent`);
      }
    }
    return new Response(JSON.stringify({
      success: true,
      message: 'Password has been reset successfully. You can now login with your new password.',
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
