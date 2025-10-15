import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

interface ManagePlanRequest {
  action: 'create_plan' | 'update_plan' | 'delete_plan' | 'activate_plan' | 'deactivate_plan';
  planId?: string;
  planData?: {
    name?: string;
    display_name?: string;
    account_type?: string;
    price?: number;
    billing_period_unit?: string;
    billing_period_value?: number;
    billing_period_days?: number;
    daily_task_limit?: number;
    earning_per_task?: number;
    task_skip_limit_per_day?: number;
    min_withdrawal?: number;
    min_daily_withdrawal?: number;
    max_daily_withdrawal?: number;
    max_active_referrals?: number;
    task_commission_rate?: number;
    deposit_commission_rate?: number;
    free_plan_expiry_days?: number;
    free_unlock_withdrawal_enabled?: boolean;
    free_unlock_withdrawal_days?: number;
    sub_account_earning_commission_rate?: number;
    max_group_members?: number;
    priority_support?: boolean;
    custom_categories?: boolean;
    features?: string[];
    is_active?: boolean;
  };
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

    const { action, planId, planData }: ManagePlanRequest = await req.json();

    console.log(`Admin ${user.id} performing action: ${action}`);

    // Validate action
    if (!action) {
      throw new Error('Action is required');
    }

    let result: any = null;
    let auditDetails: any = {};

    switch (action) {
      case 'create_plan': {
        if (!planData || !planData.name || !planData.display_name) {
          throw new Error('Plan name and display_name are required');
        }

        // Validate plan name is unique
        const { data: existingPlan } = await supabaseClient
          .from('membership_plans')
          .select('id')
          .eq('name', planData.name)
          .maybeSingle();

        if (existingPlan) {
          throw new Error(`Plan with name '${planData.name}' already exists`);
        }

        // Validate commission rates (stored as percentages 0-100)
        if (planData.task_commission_rate !== undefined && 
            (planData.task_commission_rate < 0 || planData.task_commission_rate > 100)) {
          throw new Error('Task commission rate must be between 0 and 100');
        }

        if (planData.deposit_commission_rate !== undefined && 
            (planData.deposit_commission_rate < 0 || planData.deposit_commission_rate > 100)) {
          throw new Error('Deposit commission rate must be between 0 and 100');
        }

        // Validate billing period unit
        if (planData.billing_period_unit && 
            !['day', 'month', 'year'].includes(planData.billing_period_unit)) {
          throw new Error('Billing period unit must be day, month, or year');
        }

        // Validate account type
        if (planData.account_type && 
            !['free', 'personal', 'business', 'group'].includes(planData.account_type)) {
          throw new Error('Account type must be free, personal, business, or group');
        }

        // Create the plan
        const { data: newPlan, error: createError } = await supabaseClient
          .from('membership_plans')
          .insert(planData)
          .select()
          .single();

        if (createError) {
          throw new Error(`Failed to create plan: ${createError.message}`);
        }

        result = newPlan;
        auditDetails = { action: 'create_plan', plan_data: planData };
        console.log(`Created plan: ${newPlan.name}`);
        break;
      }

      case 'update_plan': {
        if (!planId) {
          throw new Error('Plan ID is required for update');
        }

        if (!planData) {
          throw new Error('Plan data is required for update');
        }

        // Get current plan
        const { data: currentPlan, error: fetchError } = await supabaseClient
          .from('membership_plans')
          .select('*')
          .eq('id', planId)
          .maybeSingle();

        if (fetchError || !currentPlan) {
          throw new Error('Plan not found');
        }

        // Validate commission rates if being updated (stored as percentages 0-100)
        if (planData.task_commission_rate !== undefined && 
            (planData.task_commission_rate < 0 || planData.task_commission_rate > 100)) {
          throw new Error('Task commission rate must be between 0 and 100');
        }

        if (planData.deposit_commission_rate !== undefined && 
            (planData.deposit_commission_rate < 0 || planData.deposit_commission_rate > 100)) {
          throw new Error('Deposit commission rate must be between 0 and 100');
        }

        // If name is being changed, check it's unique
        if (planData.name && planData.name !== currentPlan.name) {
          const { data: existingPlan } = await supabaseClient
            .from('membership_plans')
            .select('id')
            .eq('name', planData.name)
            .maybeSingle();

          if (existingPlan) {
            throw new Error(`Plan with name '${planData.name}' already exists`);
          }

          // Check if any users are subscribed to this plan
          const { count: subscriberCount } = await supabaseClient
            .from('profiles')
            .select('id', { count: 'exact', head: true })
            .eq('membership_plan', currentPlan.name);

          if (subscriberCount && subscriberCount > 0) {
            throw new Error(`Cannot rename plan: ${subscriberCount} users are currently subscribed to '${currentPlan.name}'`);
          }
        }

        // Update the plan
        const { data: updatedPlan, error: updateError } = await supabaseClient
          .from('membership_plans')
          .update(planData)
          .eq('id', planId)
          .select()
          .single();

        if (updateError) {
          throw new Error(`Failed to update plan: ${updateError.message}`);
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

      case 'delete_plan': {
        if (!planId) {
          throw new Error('Plan ID is required for delete');
        }

        // Get the plan
        const { data: plan, error: fetchError } = await supabaseClient
          .from('membership_plans')
          .select('*')
          .eq('id', planId)
          .maybeSingle();

        if (fetchError || !plan) {
          throw new Error('Plan not found');
        }

        // Prevent deletion of free plan
        if (plan.name === 'free') {
          throw new Error('Cannot delete the free plan');
        }

        // Check if any users are subscribed to this plan
        const { data: subscribers, count: subscriberCount } = await supabaseClient
          .from('profiles')
          .select('id', { count: 'exact', head: true })
          .eq('membership_plan', plan.name);

        if (subscriberCount && subscriberCount > 0) {
          throw new Error(`Cannot delete plan: ${subscriberCount} users are currently subscribed to '${plan.name}'. Deactivate the plan instead.`);
        }

        // Delete the plan
        const { error: deleteError } = await supabaseClient
          .from('membership_plans')
          .delete()
          .eq('id', planId);

        if (deleteError) {
          throw new Error(`Failed to delete plan: ${deleteError.message}`);
        }

        result = { deleted: true, plan_name: plan.name };
        auditDetails = { action: 'delete_plan', plan_id: planId, plan_data: plan };
        console.log(`Deleted plan: ${plan.name}`);
        break;
      }

      case 'activate_plan': {
        if (!planId) {
          throw new Error('Plan ID is required');
        }

        const { data: updatedPlan, error: updateError } = await supabaseClient
          .from('membership_plans')
          .update({ is_active: true })
          .eq('id', planId)
          .select()
          .single();

        if (updateError) {
          throw new Error(`Failed to activate plan: ${updateError.message}`);
        }

        result = updatedPlan;
        auditDetails = { action: 'activate_plan', plan_id: planId };
        console.log(`Activated plan: ${updatedPlan.name}`);
        break;
      }

      case 'deactivate_plan': {
        if (!planId) {
          throw new Error('Plan ID is required');
        }

        // Get the plan
        const { data: plan } = await supabaseClient
          .from('membership_plans')
          .select('name')
          .eq('id', planId)
          .maybeSingle();

        if (plan && plan.name === 'free') {
          throw new Error('Cannot deactivate the free plan');
        }

        const { data: updatedPlan, error: updateError } = await supabaseClient
          .from('membership_plans')
          .update({ is_active: false })
          .eq('id', planId)
          .select()
          .single();

        if (updateError) {
          throw new Error(`Failed to deactivate plan: ${updateError.message}`);
        }

        result = updatedPlan;
        auditDetails = { action: 'deactivate_plan', plan_id: planId };
        console.log(`Deactivated plan: ${updatedPlan.name}`);
        break;
      }

      default:
        throw new Error(`Invalid action: ${action}`);
    }

    // Log to audit_logs
    await supabaseClient
      .from('audit_logs')
      .insert({
        admin_id: user.id,
        action_type: `membership_plan_${action}`,
        details: auditDetails
      });

    return new Response(
      JSON.stringify({ success: true, result }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in manage-membership-plan:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: error.message === 'Unauthorized' || error.message === 'Admin access required' ? 403 : 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
