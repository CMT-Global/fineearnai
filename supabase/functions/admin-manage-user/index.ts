import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
Deno.serve(async (req)=>{
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: corsHeaders
    });
  }
  try {
    // Create ANON client for JWT validation
    const supabaseAuth = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_ANON_KEY') ?? '');
    // Create SERVICE ROLE client for admin operations
    const supabaseClient = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
    // Get authenticated user using ANON client
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(token);
    if (authError || !user) {
      console.error('Auth error:', authError);
      throw new Error('Unauthorized');
    }
    // Check admin role
    const { data: adminRole } = await supabaseClient.from('user_roles').select('role').eq('user_id', user.id).eq('role', 'admin').maybeSingle();
    if (!adminRole) {
      throw new Error('Admin access required');
    }
    const { action, userId, newUplineEmail, referralStatus, page = 1, limit = 20, profileData, newEmail, walletAdjustment, planData, banReason, suspendReason, roleData } = await req.json();
    console.log(`Admin ${user.id} performing action: ${action} on user ${userId}`);
    if (!action || !userId) {
      throw new Error('Action and userId are required');
    }
    let result = null;
    switch(action){
      case 'change_upline':
        {
          if (!newUplineEmail) {
            throw new Error('New upline email is required');
          }
          // Get target user
          const { data: targetUser, error: userError } = await supabaseClient.from('profiles').select('id, username, email, referral_code').eq('id', userId).maybeSingle();
          if (userError || !targetUser) {
            throw new Error('Target user not found');
          }
          // Get new upline by email
          const { data: newUpline, error: uplineError } = await supabaseClient.from('profiles').select('id, username, email, referral_code, account_status').eq('email', newUplineEmail).maybeSingle();
          if (uplineError || !newUpline) {
            throw new Error('New upline user not found');
          }
          // Prevent self-referral
          if (newUpline.id === targetUser.id) {
            throw new Error('User cannot refer themselves');
          }
          // Check if new upline is not already referred by target user (circular referral prevention)
          const { data: circularCheck } = await supabaseClient.from('referrals').select('referrer_id').eq('referred_id', newUpline.id).eq('status', 'active').maybeSingle();
          if (circularCheck && circularCheck.referrer_id === targetUser.id) {
            throw new Error('Circular referral detected: New upline is already referred by this user');
          }
          // Check new upline account status
          if (newUpline.account_status !== 'active') {
            throw new Error('New upline account must be active');
          }
          // Get old upline ID from referrals table
          const { data: oldReferral } = await supabaseClient.from('referrals').select('referrer_id').eq('referred_id', targetUser.id).eq('status', 'active').maybeSingle();
          const oldUplineId = oldReferral?.referrer_id;
          // Deactivate old referral relationship if it exists
          if (oldUplineId) {
            await supabaseClient.from('referrals').update({
              status: 'inactive'
            }).eq('referrer_id', oldUplineId).eq('referred_id', targetUser.id);
          }
          // Check if a referral relationship already exists with new upline
          const { data: existingReferral } = await supabaseClient.from('referrals').select('id, status').eq('referrer_id', newUpline.id).eq('referred_id', targetUser.id).maybeSingle();
          if (existingReferral) {
            // Reactivate existing referral
            await supabaseClient.from('referrals').update({
              status: 'active'
            }).eq('id', existingReferral.id);
          } else {
            // Create new referral relationship
            await supabaseClient.from('referrals').insert({
              referrer_id: newUpline.id,
              referred_id: targetUser.id,
              referral_code_used: newUpline.referral_code,
              status: 'active',
              total_commission_earned: 0
            });
          }
          // Referral relationship already updated in referrals table above
          // No need to update profiles.referred_by as that column has been removed
          // Log to audit_logs
          await supabaseClient.from('audit_logs').insert({
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
          await supabaseClient.from('user_activity_log').insert({
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
      case 'update_referral_status':
        {
          if (!referralStatus) {
            throw new Error('Referral status is required');
          }
          // Validate status
          if (![
            'active',
            'inactive',
            'pending'
          ].includes(referralStatus)) {
            throw new Error('Invalid referral status. Must be active, inactive, or pending');
          }
          // Get the referral relationship directly from referrals table
          const { data: referralRecord } = await supabaseClient.from('referrals').select('referrer_id').eq('referred_id', userId).eq('status', 'active').maybeSingle();
          if (!referralRecord || !referralRecord.referrer_id) {
            throw new Error('User has no active referrer');
          }
          // Update referral status
          const { data: updatedReferral, error: updateError } = await supabaseClient.from('referrals').update({
            status: referralStatus
          }).eq('referrer_id', referralRecord.referrer_id).eq('referred_id', userId).select().single();
          if (updateError) {
            throw new Error(`Failed to update referral status: ${updateError.message}`);
          }
          // Log to audit_logs
          await supabaseClient.from('audit_logs').insert({
            admin_id: user.id,
            action_type: 'update_referral_status',
            target_user_id: userId,
            details: {
              referrer_id: referralRecord.referrer_id,
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
      case 'get_user_referral_summary':
        {
          // Get referral statistics
          const { data: referrals, error: referralsError } = await supabaseClient.from('referrals').select('id, status, total_commission_earned, created_at, referred_id').eq('referrer_id', userId);
          if (referralsError) {
            throw new Error(`Failed to fetch referrals: ${referralsError.message}`);
          }
          const totalReferrals = referrals?.length || 0;
          const activeReferrals = referrals?.filter((r)=>r.status === 'active').length || 0;
          // Get referred users details
          const referredIds = referrals?.map((r)=>r.referred_id) || [];
          let freeReferrals = 0;
          let upgradedReferrals = 0;
          if (referredIds.length > 0) {
            const { data: referredUsers } = await supabaseClient.from('profiles').select('membership_plan').in('id', referredIds);
            freeReferrals = referredUsers?.filter((u)=>u.membership_plan === 'free').length || 0;
            upgradedReferrals = referredUsers?.filter((u)=>u.membership_plan !== 'free').length || 0;
          }
          // Calculate total commission earned
          const totalCommissionEarned = referrals?.reduce((sum, r)=>sum + Number(r.total_commission_earned || 0), 0) || 0;
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
      case 'get_detailed_user_referrals':
        {
          const offset = (page - 1) * limit;
          // Get paginated referrals
          const { data: referrals, error: referralsError, count } = await supabaseClient.from('referrals').select('*, referred:profiles!referred_id(id, username, email, membership_plan, account_status, created_at, last_activity)', {
            count: 'exact'
          }).eq('referrer_id', userId).order('created_at', {
            ascending: false
          }).range(offset, offset + limit - 1);
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
      case 'get_user_detail':
        {
          // Call the database function to get complete user detail
          const { data: userDetail, error: detailError } = await supabaseClient.rpc('get_user_detail_aggregated', {
            p_user_id: userId
          });
          if (detailError) {
            throw new Error(`Failed to fetch user detail: ${detailError.message}`);
          }
          result = userDetail;
          console.log(`Retrieved complete detail for user ${userId}`);
          break;
        }
      case 'update_user_profile':
        {
          if (!profileData) {
            throw new Error('Profile data is required');
          }
          const allowlist = [
            'full_name', 'phone', 'country',
            'first_name', 'last_name', 'timezone', 'preferred_language',
            'earning_goal', 'motivation', 'how_did_you_hear', 'phone_country_code',
            'usdt_bep20_address'
          ];
          const updates: Record<string, any> = {};
          for (const k of allowlist) {
            if (profileData[k] !== undefined) {
              updates[k] = profileData[k] === '' ? null : profileData[k];
            }
          }
          if (Object.keys(updates).length === 0) {
            throw new Error('No valid profile fields to update');
          }
          if (updates.usdt_bep20_address != null) {
            console.log('Admin updating payout address; audit log will record change.', { userId, adminId: user.id });
          }
          const { error: updateError } = await supabaseClient.from('profiles').update(updates).eq('id', userId);
          if (updateError) {
            throw new Error(`Failed to update profile: ${updateError.message}`);
          }
          await supabaseClient.from('audit_logs').insert({
            admin_id: user.id,
            action_type: 'update_user_profile',
            target_user_id: userId,
            details: { updated_fields: updates }
          });
          result = { success: true, message: 'Profile updated successfully' };
          console.log(`Updated profile for user ${userId}`);
          break;
        }
      case 'update_user_email':
        {
          if (!newEmail) {
            throw new Error('New email is required');
          }
          // Check if email already exists
          const { data: existingUser } = await supabaseClient.from('profiles').select('id').eq('email', newEmail).maybeSingle();
          if (existingUser && existingUser.id !== userId) {
            throw new Error('Email already in use by another user');
          }
          // Update email in auth.users using admin API
          const { error: authError } = await supabaseClient.auth.admin.updateUserById(userId, {
            email: newEmail
          });
          if (authError) {
            throw new Error(`Failed to update auth email: ${authError.message}`);
          }
          // Update email in profiles
          const { error: profileError } = await supabaseClient.from('profiles').update({
            email: newEmail
          }).eq('id', userId);
          if (profileError) {
            throw new Error(`Failed to update profile email: ${profileError.message}`);
          }
          // Log to audit
          await supabaseClient.from('audit_logs').insert({
            admin_id: user.id,
            action_type: 'update_user_email',
            target_user_id: userId,
            details: {
              new_email: newEmail
            }
          });
          result = {
            success: true,
            message: 'Email updated successfully'
          };
          console.log(`Updated email for user ${userId} to ${newEmail}`);
          break;
        }
      case 'adjust_wallet_balance':
        {
          if (!walletAdjustment) {
            throw new Error('Wallet adjustment details are required');
          }
          const { wallet_type, amount, reason } = walletAdjustment;
          if (!wallet_type || amount === undefined || !reason) {
            throw new Error('Wallet type, amount, and reason are required');
          }
          // Validate amount is not zero
          if (amount === 0) {
            throw new Error('Amount cannot be zero');
          }
          // Get current balance
          const { data: profile } = await supabaseClient.from('profiles').select('deposit_wallet_balance, earnings_wallet_balance').eq('id', userId).single();
          if (!profile) {
            throw new Error('User not found');
          }
          const currentBalance = wallet_type === 'deposit' ? parseFloat(profile.deposit_wallet_balance) : parseFloat(profile.earnings_wallet_balance);
          // Determine transaction type and calculate new balance based on sign
          let transactionType;
          let actualAmount;
          let newBalance;
          if (amount > 0) {
            // CREDIT operation
            transactionType = 'adjustment';
            actualAmount = amount;
            newBalance = currentBalance + amount;
          } else {
            // DEBIT operation (amount is negative)
            transactionType = 'transfer';
            actualAmount = Math.abs(amount);
            // Check sufficient balance for debit
            if (currentBalance < actualAmount) {
              throw new Error(`Insufficient balance. Current: ${currentBalance}, Required: ${actualAmount}`);
            }
            newBalance = currentBalance - actualAmount;
          }
          console.log(`Admin wallet adjustment - Type: ${transactionType}, Amount: ${actualAmount}, Old: ${currentBalance}, New: ${newBalance}`);
          // STEP 1: INSERT TRANSACTION FIRST (critical for validation trigger)
          const { error: transactionError } = await supabaseClient.from('transactions').insert({
            user_id: userId,
            type: transactionType,
            wallet_type: wallet_type,
            amount: actualAmount,
            new_balance: newBalance,
            status: 'completed',
            description: `Admin ${amount > 0 ? 'credit' : 'debit'}: ${reason}`,
            metadata: {
              admin_id: user.id,
              reason: reason,
              action_type: amount > 0 ? 'credit' : 'debit',
              old_balance: currentBalance
            }
          });
          if (transactionError) {
            console.error('Transaction insert failed:', transactionError);
            throw new Error(`Failed to create transaction: ${transactionError.message}`);
          }
          // STEP 2: UPDATE PROFILE BALANCE AFTER successful transaction insert
          const walletField = wallet_type === 'deposit' ? 'deposit_wallet_balance' : 'earnings_wallet_balance';
          const { error: updateError } = await supabaseClient.from('profiles').update({
            [walletField]: newBalance,
            last_activity: new Date().toISOString()
          }).eq('id', userId);
          if (updateError) {
            console.error('Profile update failed after transaction insert:', updateError);
            throw new Error(`Failed to update balance: ${updateError.message}`);
          }
          // Phase 2: Database as single source of truth - realtime subscriptions handle UI updates
          console.log('✅ Wallet adjustment completed, realtime subscriptions will update UI automatically');
          // STEP 3: LOG TO AUDIT
          await supabaseClient.from('audit_logs').insert({
            admin_id: user.id,
            action_type: 'adjust_wallet_balance',
            target_user_id: userId,
            details: {
              wallet_type,
              amount,
              reason,
              old_balance: currentBalance,
              new_balance: newBalance,
              transaction_type: transactionType
            }
          });
          result = {
            success: true,
            message: 'Wallet balance adjusted successfully',
            old_balance: currentBalance,
            new_balance: newBalance,
            transaction_type: transactionType
          };
          console.log(`✅ Adjusted ${wallet_type} wallet for user ${userId} by ${amount} (${transactionType})`);
          break;
        }
      case 'change_membership_plan':
        {
          if (!planData || !planData.plan_name) {
            throw new Error('Plan name is required');
          }
          // Validate plan exists
          const { data: plan } = await supabaseClient.from('membership_plans').select('*').eq('name', planData.plan_name).eq('is_active', true).single();
          if (!plan) {
            throw new Error('Invalid or inactive plan');
          }
          const now = new Date();
          let expiresAt = planData.expires_at ?? null;

          // Free plan: use free_plan_expiry_days if no expires_at provided; otherwise allow null
          if (plan.name === 'free') {
            if (!expiresAt && plan.free_plan_expiry_days != null && plan.free_plan_expiry_days > 0) {
              const expiry = new Date(now);
              expiry.setDate(expiry.getDate() + plan.free_plan_expiry_days);
              expiresAt = expiry.toISOString();
              console.log(`✅ Free plan expiry: free_plan_expiry_days=${plan.free_plan_expiry_days}, expiry=${expiresAt}`);
            }
            // else: expiresAt stays null (no trial or admin did not set a date)
          } else {
            // Paid plans: require billing_period_days when expires_at not provided
            if (!expiresAt) {
              const billingPeriodDays = plan.billing_period_days;
              if (!billingPeriodDays || billingPeriodDays <= 0) {
                throw new Error(`Invalid billing_period_days for plan ${planData.plan_name}: ${billingPeriodDays}`);
              }
              const expiry = new Date(now);
              expiry.setDate(expiry.getDate() + billingPeriodDays);
              expiresAt = expiry.toISOString();
              console.log(`✅ Expiry calculation: Plan=${planData.plan_name}, billing_period_days=${billingPeriodDays}, expiry=${expiresAt}`);
            }
          }

          // Update plan (allow null plan_expires_at for free with no trial).
          // Set account_status to 'active' when assigning a plan so expired users become active again.
          const { error: updateError } = await supabaseClient.from('profiles').update({
            membership_plan: planData.plan_name,
            plan_expires_at: expiresAt,
            current_plan_start_date: now.toISOString(),
            account_status: 'active'
          }).eq('id', userId);
          if (updateError) {
            throw new Error(`Failed to change plan: ${updateError.message}`);
          }
          // Create transaction record for audit trail only (no balance impact)
          await supabaseClient.from('transactions').insert({
            user_id: userId,
            type: 'plan_change',
            amount: 0,
            wallet_type: 'deposit',
            status: 'completed',
            description: `Admin changed plan to ${plan.display_name}`,
            metadata: {
              changed_by: user.id,
              plan_name: plan.name,
              admin_action: true,
              plan_price: plan.price,
              previous_plan: planData.plan_name || 'unknown'
            }
          });
          // Log to audit
          await supabaseClient.from('audit_logs').insert({
            admin_id: user.id,
            action_type: 'change_membership_plan',
            target_user_id: userId,
            details: {
              plan_name: plan.name,
              expires_at: expiresAt
            }
          });
          result = {
            success: true,
            message: 'Membership plan updated successfully',
            plan: plan.display_name,
            expires_at: expiresAt
          };
          console.log(`Changed plan for user ${userId} to ${plan.name}`);
          break;
        }
      case 'suspend_user':
        {
          // Get current status
          const { data: profile } = await supabaseClient.from('profiles').select('account_status').eq('id', userId).single();
          if (!profile) {
            throw new Error('User not found');
          }
          const newStatus = profile.account_status === 'suspended' ? 'active' : 'suspended';
          // Update status
          const { error: updateError } = await supabaseClient.from('profiles').update({
            account_status: newStatus
          }).eq('id', userId);
          if (updateError) {
            throw new Error(`Failed to suspend user: ${updateError.message}`);
          }
          // Log to audit
          await supabaseClient.from('audit_logs').insert({
            admin_id: user.id,
            action_type: 'suspend_user',
            target_user_id: userId,
            details: {
              new_status: newStatus,
              reason: suspendReason || 'No reason provided'
            }
          });
          result = {
            success: true,
            message: newStatus === 'suspended' ? 'User suspended successfully' : 'User unsuspended successfully',
            status: newStatus
          };
          console.log(`${newStatus === 'suspended' ? 'Suspended' : 'Unsuspended'} user ${userId}`);
          break;
        }
      case 'ban_user':
        {
          if (!banReason) {
            throw new Error('Ban reason is required');
          }
          // Update status to banned
          const { error: updateError } = await supabaseClient.from('profiles').update({
            account_status: 'banned'
          }).eq('id', userId);
          if (updateError) {
            throw new Error(`Failed to ban user: ${updateError.message}`);
          }
          // Log to audit
          await supabaseClient.from('audit_logs').insert({
            admin_id: user.id,
            action_type: 'ban_user',
            target_user_id: userId,
            details: {
              reason: banReason
            }
          });
          result = {
            success: true,
            message: 'User banned successfully'
          };
          console.log(`Banned user ${userId} - Reason: ${banReason}`);
          break;
        }
      case 'delete_user':
        {
          if (userId === user.id) {
            throw new Error('Cannot delete your own account');
          }
          const { data: targetProfile } = await supabaseClient.from('profiles').select('username, email').eq('id', userId).maybeSingle();
          const { error: deleteAuthError } = await supabaseClient.auth.admin.deleteUser(userId);
          if (deleteAuthError) {
            throw new Error(`Failed to delete user: ${deleteAuthError.message}`);
          }
          await supabaseClient.from('profiles').update({
            account_status: 'deleted'
          }).eq('id', userId);
          // Remove invite_requests for this user's email so they disappear from admin/users/invite-requests
          if (targetProfile?.email) {
            const emailLower = targetProfile.email.trim().toLowerCase();
            const { data: toDelete } = await supabaseClient
              .from('invite_requests')
              .select('id')
              .ilike('email', emailLower);
            if (toDelete?.length) {
              const { error: inviteDeleteError } = await supabaseClient
                .from('invite_requests')
                .delete()
                .in('id', toDelete.map((r) => r.id));
              if (inviteDeleteError) {
                console.warn(`Invite requests cleanup for deleted user ${userId}:`, inviteDeleteError.message);
              }
            }
          }
          await supabaseClient.from('audit_logs').insert({
            admin_id: user.id,
            action_type: 'delete_user',
            target_user_id: userId,
            details: {
              deleted_username: targetProfile?.username,
              deleted_email: targetProfile?.email
            }
          });
          result = {
            success: true,
            message: 'User deleted successfully'
          };
          console.log(`Deleted user ${userId}`);
          break;
        }
      case 'reset_daily_limits':
        {
          // Reset daily counters
          const { error: updateError } = await supabaseClient.from('profiles').update({
            tasks_completed_today: 0,
            skips_today: 0,
            last_task_date: new Date().toISOString().split('T')[0]
          }).eq('id', userId);
          if (updateError) {
            throw new Error(`Failed to reset limits: ${updateError.message}`);
          }
          // Log to audit
          await supabaseClient.from('audit_logs').insert({
            admin_id: user.id,
            action_type: 'reset_daily_limits',
            target_user_id: userId,
            details: {
              reset_date: new Date().toISOString()
            }
          });
          result = {
            success: true,
            message: 'Daily limits reset successfully'
          };
          console.log(`Reset daily limits for user ${userId}`);
          break;
        }
      case 'get_user_roles':
        {
          // Fetch all roles for the target user
          const { data: userRoles, error: rolesError } = await supabaseClient.from('user_roles').select('role').eq('user_id', userId);
          if (rolesError) {
            throw new Error(`Failed to fetch user roles: ${rolesError.message}`);
          }
          const roles = userRoles?.map((r)=>r.role) || [];
          result = {
            success: true,
            roles: roles
          };
          console.log(`Retrieved roles for user ${userId}: ${roles.join(', ')}`);
          break;
        }
      case 'assign_role':
        {
          if (!roleData || !roleData.role) {
            throw new Error('Role is required');
          }
          const { role } = roleData;
          // Validate role
          if (![
            'admin',
            'moderator',
            'user',
            'trainee_4opt'
          ].includes(role)) {
            throw new Error('Invalid role. Must be admin, moderator, user, or trainee_4opt');
          }
          // Prevent admin from assigning role to themselves (security measure) - except trainee_4opt
          if (userId === user.id && role !== 'trainee_4opt') {
            throw new Error('Cannot assign role to yourself');
          }
          // Check if user already has this role
          const { data: existingRole } = await supabaseClient.from('user_roles').select('id').eq('user_id', userId).eq('role', role).maybeSingle();
          if (existingRole) {
            throw new Error('User already has this role');
          }
          // Get current roles before assignment (for audit log)
          const { data: currentRoles } = await supabaseClient.from('user_roles').select('role').eq('user_id', userId);
          const previousRoles = currentRoles?.map((r)=>r.role) || [];
          // Assign the role
          const { error: insertError } = await supabaseClient.from('user_roles').insert({
            user_id: userId,
            role: role
          });
          if (insertError) {
            throw new Error(`Failed to assign role: ${insertError.message}`);
          }
          // Get target user info for audit log
          const { data: targetUser } = await supabaseClient.from('profiles').select('username, email').eq('id', userId).single();
          // Log to audit
          await supabaseClient.from('audit_logs').insert({
            admin_id: user.id,
            action_type: 'assign_role',
            target_user_id: userId,
            details: {
              role_assigned: role,
              previous_roles: previousRoles,
              new_roles: [
                ...previousRoles,
                role
              ],
              target_username: targetUser?.username,
              target_email: targetUser?.email
            }
          });
          // Log user activity
          await supabaseClient.from('user_activity_log').insert({
            user_id: userId,
            activity_type: 'role_assigned',
            details: {
              role: role,
              assigned_by: user.id
            }
          });
          result = {
            success: true,
            message: `Role '${role}' assigned successfully`,
            roles: [
              ...previousRoles,
              role
            ]
          };
          console.log(`Assigned role '${role}' to user ${userId} by admin ${user.id}`);
          break;
        }
      case 'remove_role':
        {
          if (!roleData || !roleData.role) {
            throw new Error('Role is required');
          }
          const { role } = roleData;
          // Validate role
          if (![
            'admin',
            'moderator',
            'user',
            'trainee_4opt'
          ].includes(role)) {
            throw new Error('Invalid role. Must be admin, moderator, user, or trainee_4opt');
          }
          // Prevent removing 'user' role - everyone must have base user role
          if (role === 'user') {
            throw new Error('Cannot remove \'user\' role - all users must have base role');
          }
          // Prevent admin from removing their own admin role (security measure)
          if (userId === user.id && role === 'admin') {
            throw new Error('Cannot remove your own admin role');
          }
          // Check if user has this role
          const { data: existingRole } = await supabaseClient.from('user_roles').select('id').eq('user_id', userId).eq('role', role).maybeSingle();
          if (!existingRole) {
            throw new Error('User does not have this role');
          }
          // Get current roles before removal (for audit log)
          const { data: currentRoles } = await supabaseClient.from('user_roles').select('role').eq('user_id', userId);
          const previousRoles = currentRoles?.map((r)=>r.role) || [];
          // Remove the role
          const { error: deleteError } = await supabaseClient.from('user_roles').delete().eq('user_id', userId).eq('role', role);
          if (deleteError) {
            throw new Error(`Failed to remove role: ${deleteError.message}`);
          }
          // Get target user info for audit log
          const { data: targetUser } = await supabaseClient.from('profiles').select('username, email').eq('id', userId).single();
          const newRoles = previousRoles.filter((r)=>r !== role);
          // Log to audit
          await supabaseClient.from('audit_logs').insert({
            admin_id: user.id,
            action_type: 'remove_role',
            target_user_id: userId,
            details: {
              role_removed: role,
              previous_roles: previousRoles,
              new_roles: newRoles,
              target_username: targetUser?.username,
              target_email: targetUser?.email
            }
          });
          // Log user activity
          await supabaseClient.from('user_activity_log').insert({
            user_id: userId,
            activity_type: 'role_removed',
            details: {
              role: role,
              removed_by: user.id
            }
          });
          result = {
            success: true,
            message: `Role '${role}' removed successfully`,
            roles: newRoles
          };
          console.log(`Removed role '${role}' from user ${userId} by admin ${user.id}`);
          break;
        }
      default:
        throw new Error(`Invalid action: ${action}`);
    }
    return new Response(JSON.stringify({
      success: true,
      result
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('Error in admin-manage-user:', error);
    return new Response(JSON.stringify({
      error: error.message
    }), {
      status: error.message === 'Unauthorized' || error.message === 'Admin access required' ? 403 : 400,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
});
