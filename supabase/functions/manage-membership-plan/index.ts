import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
/**
 * Comprehensive server-side validation for membership plan data
 * Single source of truth for all plan validation rules
 */ function validatePlanData(planData) {
  const errors = [];
  // ========== Required Fields Validation ==========
  if (!planData.name || typeof planData.name !== 'string' || planData.name.trim().length === 0) {
    errors.push("Plan name is required and must be a non-empty string");
  }
  if (!planData.display_name || typeof planData.display_name !== 'string' || planData.display_name.trim().length === 0) {
    errors.push("Display name is required and must be a non-empty string");
  }
  if (!planData.account_type || typeof planData.account_type !== 'string' || planData.account_type.trim().length === 0) {
    errors.push("Account type is required");
  }
  // ========== Account Type Validation ==========
  const validAccountTypes = [
    'free',
    'personal',
    'business',
    'group'
  ];
  if (planData.account_type && !validAccountTypes.includes(planData.account_type)) {
    errors.push(`Account type must be one of: ${validAccountTypes.join(', ')}`);
  }
  // ========== Price Validation ==========
  if (planData.price !== undefined) {
    if (typeof planData.price !== 'number' || isNaN(planData.price)) {
      errors.push("Price must be a valid number");
    } else if (planData.price < 0) {
      errors.push("Price cannot be negative");
    } else if (planData.price > 10000) {
      errors.push("Price cannot exceed 10000");
    }
  }
  // ========== Daily Task Limit Validation ==========
  if (planData.daily_task_limit !== undefined) {
    if (typeof planData.daily_task_limit !== 'number' || isNaN(planData.daily_task_limit)) {
      errors.push("Daily task limit must be a valid number");
    } else if (planData.daily_task_limit < 0 || planData.daily_task_limit > 1000) {
      errors.push("Daily task limit must be between 0 and 1000");
    }
  }
  // ========== Task Skip Limit Validation ==========
  if (planData.task_skip_limit_per_day !== undefined) {
    if (typeof planData.task_skip_limit_per_day !== 'number' || isNaN(planData.task_skip_limit_per_day)) {
      errors.push("Task skip limit must be a valid number");
    } else if (planData.task_skip_limit_per_day < 0 || planData.task_skip_limit_per_day > 100) {
      errors.push("Task skip limit must be between 0 and 100");
    }
  }
  // ========== Earning Per Task Validation ==========
  if (planData.earning_per_task !== undefined) {
    if (typeof planData.earning_per_task !== 'number' || isNaN(planData.earning_per_task)) {
      errors.push("Earning per task must be a valid number");
    } else if (planData.earning_per_task < 0) {
      errors.push("Earning per task cannot be negative");
    } else if (planData.earning_per_task > 100) {
      errors.push("Earning per task cannot exceed 100");
    }
  }
  // ========== Commission Rates Validation (0-100%) ==========
  if (planData.task_commission_rate !== undefined) {
    if (typeof planData.task_commission_rate !== 'number' || isNaN(planData.task_commission_rate)) {
      errors.push("Task commission rate must be a valid number");
    } else if (planData.task_commission_rate < 0 || planData.task_commission_rate > 100) {
      errors.push("Task commission rate must be between 0 and 100");
    }
  }
  if (planData.deposit_commission_rate !== undefined) {
    if (typeof planData.deposit_commission_rate !== 'number' || isNaN(planData.deposit_commission_rate)) {
      errors.push("Deposit commission rate must be a valid number");
    } else if (planData.deposit_commission_rate < 0 || planData.deposit_commission_rate > 100) {
      errors.push("Deposit commission rate must be between 0 and 100");
    }
  }
  // ========== Max Active Referrals Validation ==========
  if (planData.max_active_referrals !== undefined) {
    if (typeof planData.max_active_referrals !== 'number' || isNaN(planData.max_active_referrals)) {
      errors.push("Max active referrals must be a valid number");
    } else if (planData.max_active_referrals < 0 || planData.max_active_referrals > 999999) {
      errors.push("Max active referrals must be between 0 and 999999");
    }
  }
  // ========== Withdrawal Amount Validations ==========
  if (planData.min_withdrawal !== undefined) {
    if (typeof planData.min_withdrawal !== 'number' || isNaN(planData.min_withdrawal)) {
      errors.push("Minimum withdrawal must be a valid number");
    } else if (planData.min_withdrawal < 0 || planData.min_withdrawal > 10000) {
      errors.push("Minimum withdrawal must be between 0 and 10000");
    }
  }
  if (planData.min_daily_withdrawal !== undefined) {
    if (typeof planData.min_daily_withdrawal !== 'number' || isNaN(planData.min_daily_withdrawal)) {
      errors.push("Minimum daily withdrawal must be a valid number");
    } else if (planData.min_daily_withdrawal < 0 || planData.min_daily_withdrawal > 10000) {
      errors.push("Minimum daily withdrawal must be between 0 and 10000");
    }
  }
  if (planData.max_daily_withdrawal !== undefined) {
    if (typeof planData.max_daily_withdrawal !== 'number' || isNaN(planData.max_daily_withdrawal)) {
      errors.push("Maximum daily withdrawal must be a valid number");
    } else if (planData.max_daily_withdrawal < 0 || planData.max_daily_withdrawal > 100000) {
      errors.push("Maximum daily withdrawal must be between 0 and 100000");
    }
  }
  // ========== Withdrawal Logic Cross-Validation ==========
  if (planData.min_withdrawal !== undefined && planData.max_daily_withdrawal !== undefined) {
    if (planData.min_withdrawal > planData.max_daily_withdrawal) {
      errors.push("Minimum withdrawal cannot exceed maximum daily withdrawal");
    }
  }
  if (planData.min_daily_withdrawal !== undefined && planData.max_daily_withdrawal !== undefined) {
    if (planData.min_daily_withdrawal > planData.max_daily_withdrawal) {
      errors.push("Minimum daily withdrawal cannot exceed maximum daily withdrawal");
    }
  }
  // ========== Billing Period Validation ==========
  if (planData.billing_period_days !== undefined) {
    if (typeof planData.billing_period_days !== 'number' || isNaN(planData.billing_period_days)) {
      errors.push("Billing period days must be a valid number");
    } else if (planData.billing_period_days < 1 || planData.billing_period_days > 365) {
      errors.push("Billing period must be between 1 and 365 days");
    }
  }
  // ========== Free Plan Expiry Validation ==========
  if (planData.free_plan_expiry_days !== undefined && planData.free_plan_expiry_days !== null) {
    if (typeof planData.free_plan_expiry_days !== 'number' || isNaN(planData.free_plan_expiry_days)) {
      errors.push("Default plan expiry days must be a valid number");
    } else if (planData.free_plan_expiry_days < 0 || planData.free_plan_expiry_days > 365) {
      errors.push("Default plan expiry days must be between 0 and 365 days");
    }
  }
  // ========== Free Trial Days Validation (per-plan onboarding trial) ==========
  // Coerce to number (client/JSON may send string)
  if (planData.free_trial_days !== undefined && planData.free_trial_days !== null) {
    const v = Number(planData.free_trial_days);
    if (isNaN(v)) {
      errors.push("Free trial days must be a valid number");
    } else {
      planData.free_trial_days = v;
      if (planData.free_trial_days < 0 || planData.free_trial_days > 365) {
        errors.push("Free trial days must be between 0 and 365 days");
      }
    }
  }
  // ========== Business Logic Rules ==========
  if (planData.account_type === 'free' && planData.price && planData.price > 0) {
    errors.push("Free account type cannot have a price greater than 0");
  }
  // Phase 3: Default tier (Trainee) must have referral_eligible = false
  if (planData.account_type === 'free' && planData.referral_eligible === true) {
    errors.push("Free account type must have referral_eligible set to false");
  }
  // Phase 3: Enforce referral_eligible for default tier (Trainee)
  if (planData.account_type === 'free') {
    planData.referral_eligible = false; // Force to false for default plan
  }
  // Validate billing period unit if provided
  if (planData.billing_period_unit && ![
    'day',
    'month',
    'year'
  ].includes(planData.billing_period_unit)) {
    errors.push("Billing period unit must be 'day', 'month', or 'year'");
  }
  return {
    valid: errors.length === 0,
    errors
  };
}
Deno.serve(async (req)=>{
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: corsHeaders
    });
  }
  try {
    const supabaseClient = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
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
    const { data: adminRole } = await supabaseClient.from('user_roles').select('role').eq('user_id', user.id).eq('role', 'admin').maybeSingle();
    if (!adminRole) {
      throw new Error('Admin access required');
    }
    const { action, planId, planData } = await req.json();
    console.log(`Admin ${user.id} performing action: ${action}`);
    // Validate action
    if (!action) {
      throw new Error('Action is required');
    }
    let result = null;
    let auditDetails = {};
    let profilesUpdatedCount = undefined;
    switch(action){
      case 'create_plan':
        {
          if (!planData) {
            throw new Error('Plan data is required');
          }
          // Comprehensive validation using centralized validation function
          const validation = validatePlanData(planData);
          if (!validation.valid) {
            console.error('Validation errors:', validation.errors);
            throw new Error(`Validation failed: ${validation.errors.join('; ')}`);
          }
          // Validate plan name is unique
          const { data: existingPlan } = await supabaseClient.from('membership_plans').select('id').eq('name', planData.name).maybeSingle();
          if (existingPlan) {
            throw new Error(`Plan with name '${planData.name}' already exists`);
          }
          // Create the plan
          const { data: newPlan, error: createError } = await supabaseClient.from('membership_plans').insert(planData).select().single();
          if (createError) {
            throw new Error(`Failed to create plan: ${createError.message}`);
          }
          result = newPlan;
          auditDetails = {
            action: 'create_plan',
            plan_data: planData
          };
          console.log(`Created plan: ${newPlan.name}`);
          break;
        }
      case 'update_plan':
        {
          if (!planId) {
            throw new Error('Plan ID is required for update');
          }
          if (!planData) {
            throw new Error('Plan data is required for update');
          }
          // Comprehensive validation using centralized validation function
          const validation = validatePlanData(planData);
          if (!validation.valid) {
            console.error('Validation errors:', validation.errors);
            throw new Error(`Validation failed: ${validation.errors.join('; ')}`);
          }
          // Get current plan
          const { data: currentPlan, error: fetchError } = await supabaseClient.from('membership_plans').select('*').eq('id', planId).maybeSingle();
          if (fetchError || !currentPlan) {
            throw new Error('Plan not found');
          }
          // If name is being changed, check it's unique and sync ALL users on this plan to the new name.
          // Applies to every plan (free, premium, Beginner, Junior, etc.) – all associated users get the new plan name.
          if (planData.name && planData.name !== currentPlan.name) {
            const { data: existingPlan } = await supabaseClient.from('membership_plans').select('id').eq('name', planData.name).maybeSingle();
            if (existingPlan) {
              throw new Error(`Plan with name '${planData.name}' already exists`);
            }
            const { data: updatedProfiles, error: profilesUpdateError } = await supabaseClient
              .from('profiles')
              .update({ membership_plan: planData.name })
              .eq('membership_plan', currentPlan.name)
              .select('id');
            if (profilesUpdateError) {
              throw new Error(`Failed to update subscriber profiles for plan rename: ${profilesUpdateError.message}`);
            }
            profilesUpdatedCount = updatedProfiles?.length ?? 0;
            console.log(`Plan rename: updated ${profilesUpdatedCount} user(s) from "${currentPlan.name}" to "${planData.name}"`);
          }
          // Update the plan
          const { data: updatedPlan, error: updateError } = await supabaseClient.from('membership_plans').update(planData).eq('id', planId).select().single();
          if (updateError) {
            throw new Error(`Failed to update plan: ${updateError.message}`);
          }

          // When the free-tier plan (account_type = 'free') is updated, recalculate plan_expires_at for ALL users on that plan
          // via DB RPC so the dashboard banner shows correct days left (works for any plan name: free, Trainee, etc.)
          const isFreeTierPlan = (updatedPlan.account_type || '').toLowerCase().trim() === 'free';
          if (isFreeTierPlan) {
            const newExpiryDays = updatedPlan.free_plan_expiry_days != null ? Number(updatedPlan.free_plan_expiry_days) : null;
            const { data: updatedCount, error: rpcError } = await supabaseClient.rpc('recalculate_free_plan_expiries', {
              p_expiry_days: newExpiryDays
            });
            if (rpcError) {
              console.error('recalculate_free_plan_expiries RPC error:', rpcError);
              throw new Error(`Failed to recalculate default plan expiries: ${rpcError.message}`);
            }
            console.log(`Recalculated plan_expires_at for ${updatedCount ?? 0} free-tier plan user(s) with free_plan_expiry_days=${newExpiryDays}`);
          }

          result = updatedPlan;
          auditDetails = {
            action: 'update_plan',
            plan_id: planId,
            old_values: currentPlan,
            new_values: planData
          };
          console.log(`Updated plan: ${updatedPlan.name}`);
          break;
        }
      case 'delete_plan':
        {
          if (!planId) {
            throw new Error('Plan ID is required for delete');
          }
          // Get the plan
          const { data: plan, error: fetchError } = await supabaseClient.from('membership_plans').select('*').eq('id', planId).maybeSingle();
          if (fetchError || !plan) {
            throw new Error('Plan not found');
          }
          // Prevent deletion of default plan (Trainee / account_type = free)
          if ((plan.account_type || '').toLowerCase().trim() === 'free') {
            throw new Error('Cannot delete the default plan (Trainee)');
          }
          // Check if any users are subscribed to this plan
          const { data: subscribers, count: subscriberCount } = await supabaseClient.from('profiles').select('id', {
            count: 'exact',
            head: true
          }).eq('membership_plan', plan.name);
          if (subscriberCount && subscriberCount > 0) {
            throw new Error(`Cannot delete plan: ${subscriberCount} users are currently subscribed to '${plan.name}'. Deactivate the plan instead.`);
          }
          // Delete the plan
          const { error: deleteError } = await supabaseClient.from('membership_plans').delete().eq('id', planId);
          if (deleteError) {
            throw new Error(`Failed to delete plan: ${deleteError.message}`);
          }
          result = {
            deleted: true,
            plan_name: plan.name
          };
          auditDetails = {
            action: 'delete_plan',
            plan_id: planId,
            plan_data: plan
          };
          console.log(`Deleted plan: ${plan.name}`);
          break;
        }
      case 'activate_plan':
        {
          if (!planId) {
            throw new Error('Plan ID is required');
          }
          const { data: updatedPlan, error: updateError } = await supabaseClient.from('membership_plans').update({
            is_active: true
          }).eq('id', planId).select().single();
          if (updateError) {
            throw new Error(`Failed to activate plan: ${updateError.message}`);
          }
          result = updatedPlan;
          auditDetails = {
            action: 'activate_plan',
            plan_id: planId
          };
          console.log(`Activated plan: ${updatedPlan.name}`);
          break;
        }
      case 'deactivate_plan':
        {
          if (!planId) {
            throw new Error('Plan ID is required');
          }
          // Get the plan
          const { data: plan } = await supabaseClient.from('membership_plans').select('name, account_type').eq('id', planId).maybeSingle();
          if (plan && (plan.account_type || '').toLowerCase().trim() === 'free') {
            throw new Error('Cannot deactivate the default plan (Trainee)');
          }
          const { data: updatedPlan, error: updateError } = await supabaseClient.from('membership_plans').update({
            is_active: false
          }).eq('id', planId).select().single();
          if (updateError) {
            throw new Error(`Failed to deactivate plan: ${updateError.message}`);
          }
          result = updatedPlan;
          auditDetails = {
            action: 'deactivate_plan',
            plan_id: planId
          };
          console.log(`Deactivated plan: ${updatedPlan.name}`);
          break;
        }
      default:
        throw new Error(`Invalid action: ${action}`);
    }
    // Log to audit_logs
    await supabaseClient.from('audit_logs').insert({
      admin_id: user.id,
      action_type: `membership_plan_${action}`,
      details: auditDetails
    });
    const body = { success: true, result };
    if (profilesUpdatedCount !== undefined) {
      body.profilesUpdatedCount = profilesUpdatedCount;
    }
    return new Response(JSON.stringify(body), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('Error in manage-membership-plan:', error);
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
