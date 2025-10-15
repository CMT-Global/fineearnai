import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

interface AdminManageUserRequest {
  action: 'change_upline' | 'update_referral_status' | 'get_user_referral_summary' | 'get_detailed_user_referrals';
  userId: string;
  newUplineEmail?: string;
  referralStatus?: string;
  page?: number;
  limit?: number;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get authenticated user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);

    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    // Check admin role
    const { data: adminRole } = await supabaseClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle();

    if (!adminRole) {
      throw new Error('Admin access required');
    }

    const { action, userId, newUplineEmail, referralStatus, page = 1, limit = 20 }: AdminManageUserRequest = await req.json();

    console.log(`Admin ${user.id} performing action: ${action} on user ${userId}`);

    if (!action || !userId) {
      throw new Error('Action and userId are required');
    }

    let result: any = null;

    switch (action) {
      case 'change_upline': {
        if (!newUplineEmail) {
          throw new Error('New upline email is required');
        }

        // Get target user
        const { data: targetUser, error: userError } = await supabaseClient
          .from('profiles')
          .select('id, username, email, referred_by, referral_code')
          .eq('id', userId)
          .maybeSingle();

        if (userError || !targetUser) {
          throw new Error('Target user not found');
        }

        // Get new upline by email
        const { data: newUpline, error: uplineError } = await supabaseClient
          .from('profiles')
          .select('id, username, email, referral_code, account_status')
          .eq('email', newUplineEmail)
          .maybeSingle();

        if (uplineError || !newUpline) {
          throw new Error('New upline user not found');
        }

        // Prevent self-referral
        if (newUpline.id === targetUser.id) {
          throw new Error('User cannot refer themselves');
        }

        // Check if new upline is not already referred by target user (circular referral prevention)
        const { data: circularCheck } = await supabaseClient
          .from('profiles')
          .select('referred_by')
          .eq('id', newUpline.id)
          .maybeSingle();

        if (circularCheck && circularCheck.referred_by === targetUser.id) {
          throw new Error('Circular referral detected: New upline is already referred by this user');
        }

        // Check new upline account status
        if (newUpline.account_status !== 'active') {
          throw new Error('New upline account must be active');
        }

        // Store old upline ID for audit
        const oldUplineId = targetUser.referred_by;

        // Deactivate old referral relationship if it exists
        if (oldUplineId) {
          await supabaseClient
            .from('referrals')
            .update({ status: 'inactive' })
            .eq('referrer_id', oldUplineId)
            .eq('referred_id', targetUser.id);
        }

        // Check if a referral relationship already exists with new upline
        const { data: existingReferral } = await supabaseClient
          .from('referrals')
          .select('id, status')
          .eq('referrer_id', newUpline.id)
          .eq('referred_id', targetUser.id)
          .maybeSingle();

        if (existingReferral) {
          // Reactivate existing referral
          await supabaseClient
            .from('referrals')
            .update({ status: 'active' })
            .eq('id', existingReferral.id);
        } else {
          // Create new referral relationship
          await supabaseClient
            .from('referrals')
            .insert({
              referrer_id: newUpline.id,
              referred_id: targetUser.id,
              referral_code_used: newUpline.referral_code,
              status: 'active',
              total_commission_earned: 0
            });
        }

        // Update target user's referred_by
        const { error: updateError } = await supabaseClient
          .from('profiles')
          .update({ referred_by: newUpline.id })
          .eq('id', targetUser.id);

        if (updateError) {
          throw new Error(`Failed to update user's upline: ${updateError.message}`);
        }

        // Log to audit_logs
        await supabaseClient
          .from('audit_logs')
          .insert({
            admin_id: user.id,
            action_type: 'change_upline',
            target_user_id: targetUser.id,
            details: {
              target_user_email: targetUser.email,
              old_upline_id: oldUplineId,
              new_upline_id: newUpline.id,
              new_upline_email: newUpline.email
            }
          });

        // Log user activity
        await supabaseClient
          .from('user_activity_log')
          .insert({
            user_id: targetUser.id,
            activity_type: 'upline_changed_by_admin',
            details: {
              old_upline_id: oldUplineId,
              new_upline_id: newUpline.id,
              changed_by: user.id
            }
          });

        result = {
          success: true,
          message: 'Upline changed successfully',
          old_upline_id: oldUplineId,
          new_upline: {
            id: newUpline.id,
            email: newUpline.email,
            username: newUpline.username
          }
        };

        console.log(`Changed upline for user ${userId} to ${newUpline.id}`);
        break;
      }

      case 'update_referral_status': {
        if (!referralStatus) {
          throw new Error('Referral status is required');
        }

        // Validate status
        if (!['active', 'inactive', 'pending'].includes(referralStatus)) {
          throw new Error('Invalid referral status. Must be active, inactive, or pending');
        }

        // Get the referral relationship
        const { data: targetUser } = await supabaseClient
          .from('profiles')
          .select('referred_by')
          .eq('id', userId)
          .maybeSingle();

        if (!targetUser || !targetUser.referred_by) {
          throw new Error('User has no referrer');
        }

        // Update referral status
        const { data: updatedReferral, error: updateError } = await supabaseClient
          .from('referrals')
          .update({ status: referralStatus })
          .eq('referrer_id', targetUser.referred_by)
          .eq('referred_id', userId)
          .select()
          .single();

        if (updateError) {
          throw new Error(`Failed to update referral status: ${updateError.message}`);
        }

        // Log to audit_logs
        await supabaseClient
          .from('audit_logs')
          .insert({
            admin_id: user.id,
            action_type: 'update_referral_status',
            target_user_id: userId,
            details: {
              referrer_id: targetUser.referred_by,
              new_status: referralStatus
            }
          });

        result = {
          success: true,
          message: 'Referral status updated successfully',
          referral: updatedReferral
        };

        console.log(`Updated referral status for user ${userId} to ${referralStatus}`);
        break;
      }

      case 'get_user_referral_summary': {
        // Get referral statistics
        const { data: referrals, error: referralsError } = await supabaseClient
          .from('referrals')
          .select('id, status, total_commission_earned, created_at, referred_id')
          .eq('referrer_id', userId);

        if (referralsError) {
          throw new Error(`Failed to fetch referrals: ${referralsError.message}`);
        }

        const totalReferrals = referrals?.length || 0;
        const activeReferrals = referrals?.filter(r => r.status === 'active').length || 0;

        // Get referred users details
        const referredIds = referrals?.map(r => r.referred_id) || [];
        let freeReferrals = 0;
        let upgradedReferrals = 0;

        if (referredIds.length > 0) {
          const { data: referredUsers } = await supabaseClient
            .from('profiles')
            .select('membership_plan')
            .in('id', referredIds);

          freeReferrals = referredUsers?.filter(u => u.membership_plan === 'free').length || 0;
          upgradedReferrals = referredUsers?.filter(u => u.membership_plan !== 'free').length || 0;
        }

        // Calculate total commission earned
        const totalCommissionEarned = referrals?.reduce((sum, r) => sum + Number(r.total_commission_earned || 0), 0) || 0;

        result = {
          totalReferrals,
          activeReferrals,
          freeReferrals,
          upgradedReferrals,
          totalCommissionEarned
        };

        console.log(`Retrieved referral summary for user ${userId}`);
        break;
      }

      case 'get_detailed_user_referrals': {
        const offset = (page - 1) * limit;

        // Get paginated referrals
        const { data: referrals, error: referralsError, count } = await supabaseClient
          .from('referrals')
          .select('*, referred:profiles!referred_id(id, username, email, membership_plan, account_status, created_at, last_activity)', { count: 'exact' })
          .eq('referrer_id', userId)
          .order('created_at', { ascending: false })
          .range(offset, offset + limit - 1);

        if (referralsError) {
          throw new Error(`Failed to fetch detailed referrals: ${referralsError.message}`);
        }

        const totalPages = Math.ceil((count || 0) / limit);

        result = {
          referrals: referrals || [],
          pagination: {
            page,
            limit,
            totalCount: count || 0,
            totalPages,
            hasNextPage: page < totalPages,
            hasPreviousPage: page > 1
          }
        };

        console.log(`Retrieved detailed referrals for user ${userId}, page ${page}`);
        break;
      }

      default:
        throw new Error(`Invalid action: ${action}`);
    }

    return new Response(
      JSON.stringify({ success: true, result }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in admin-manage-user:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: error.message === 'Unauthorized' || error.message === 'Admin access required' ? 403 : 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
