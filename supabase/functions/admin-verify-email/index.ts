import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.74.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RequestBody {
  userId: string;
  action: 'verify' | 'unverify';
  reason: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Get authenticated user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user: adminUser }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !adminUser) {
      throw new Error('Unauthorized');
    }

    // Check if user is admin
    const { data: roles, error: roleError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', adminUser.id)
      .eq('role', 'admin')
      .single();

    if (roleError || !roles) {
      throw new Error('Unauthorized: Admin access required');
    }

    const { userId, action, reason }: RequestBody = await req.json();

    // Validate input
    if (!userId || !action || !reason?.trim()) {
      throw new Error('Missing required fields: userId, action, and reason are required');
    }

    if (action !== 'verify' && action !== 'unverify') {
      throw new Error('Invalid action. Must be "verify" or "unverify"');
    }

    console.log(`[ADMIN-VERIFY-EMAIL] Admin ${adminUser.id} attempting to ${action} email for user ${userId}`);

    // Get target user profile
    const { data: targetProfile, error: profileError } = await supabase
      .from('profiles')
      .select('username, email, email_verified')
      .eq('id', userId)
      .single();

    if (profileError || !targetProfile) {
      throw new Error('User not found');
    }

    const newVerificationStatus = action === 'verify';

    // Update email verification status
    const updateData = newVerificationStatus
      ? { email_verified: true, email_verified_at: new Date().toISOString() }
      : { email_verified: false, email_verified_at: null };

    const { error: updateError } = await supabase
      .from('profiles')
      .update(updateData)
      .eq('id', userId);

    if (updateError) {
      console.error('[ADMIN-VERIFY-EMAIL] Error updating profile:', updateError);
      throw new Error('Failed to update email verification status');
    }

    // Log the admin action in audit logs
    const { error: auditError } = await supabase
      .from('audit_logs')
      .insert({
        admin_id: adminUser.id,
        action_type: `email_${action}`,
        target_user_id: userId,
        details: {
          username: targetProfile.username,
          email: targetProfile.email,
          previous_status: targetProfile.email_verified,
          new_status: newVerificationStatus,
          reason: reason.trim(),
          timestamp: new Date().toISOString(),
        },
      });

    if (auditError) {
      console.error('[ADMIN-VERIFY-EMAIL] Error creating audit log:', auditError);
      // Don't fail the operation if audit log fails
    }

    // Log in user activity log
    const { error: activityError } = await supabase
      .from('user_activity_log')
      .insert({
        user_id: userId,
        activity_type: `admin_email_${action}`,
        details: {
          admin_id: adminUser.id,
          previous_status: targetProfile.email_verified,
          new_status: newVerificationStatus,
          reason: reason.trim(),
        },
      });

    if (activityError) {
      console.error('[ADMIN-VERIFY-EMAIL] Error creating activity log:', activityError);
      // Don't fail the operation if activity log fails
    }

    console.log(`[ADMIN-VERIFY-EMAIL] Successfully ${action}ed email for user ${userId}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Email ${action}ed successfully for ${targetProfile.username}`,
        data: {
          userId,
          username: targetProfile.username,
          email_verified: newVerificationStatus,
          email_verified_at: updateData.email_verified_at,
        },
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error('[ADMIN-VERIFY-EMAIL] Error:', error.message);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Internal server error',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: error.message.includes('Unauthorized') ? 403 : 400,
      }
    );
  }
});
