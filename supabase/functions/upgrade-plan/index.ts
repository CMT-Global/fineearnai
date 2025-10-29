import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.74.0';
import { getMembershipPlan } from '../_shared/cache.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      console.error('Auth error:', authError);
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { planName } = await req.json();

    console.log('Processing plan upgrade:', { userId: user.id, planName });

    // Validate plan name
    if (!planName || typeof planName !== 'string') {
      return new Response(JSON.stringify({ error: 'Invalid plan name' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get user profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      console.error('Profile not found:', profileError);
      return new Response(JSON.stringify({ error: 'Profile not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if user is trying to downgrade or already on this plan
    if (profile.membership_plan === planName) {
      return new Response(JSON.stringify({ error: 'You are already on this plan' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get the current plan details (for proration calculation) using cache
    const currentPlan = profile.membership_plan 
      ? await getMembershipPlan(supabase, profile.membership_plan)
      : null;

    // Get the new plan details using cache
    const newPlan = await getMembershipPlan(supabase, planName);

    if (!newPlan || !newPlan.is_active) {
      console.error('Plan not found or inactive:', planName);
      return new Response(JSON.stringify({ error: 'Invalid or inactive membership plan' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let finalCost = parseFloat(newPlan.price);
    let prorationDetails = null;
    
    // Calculate proration if upgrading from a paid plan (convert price string to number)
    if (currentPlan && 
        profile.current_plan_start_date && 
        parseFloat(currentPlan.price as string) > 0 && 
        profile.membership_plan !== 'free') {
      
      console.log('Calculating proration for upgrade from paid plan');
      
      // Call the database function to calculate proration
      const { data: proration, error: prorationError } = await supabase
        .rpc('calculate_proration', {
          p_current_plan_price: parseFloat(currentPlan.price),
          p_current_plan_start_date: profile.current_plan_start_date,
          p_current_plan_billing_days: currentPlan.billing_period_days,
          p_new_plan_price: parseFloat(newPlan.price)
        });

      if (!prorationError && proration) {
        prorationDetails = proration;
        finalCost = parseFloat(proration.new_cost);
        console.log('Proration calculated:', {
          originalPrice: proration.original_price,
          credit: proration.credit,
          finalCost: finalCost,
          savings: proration.savings
        });
      } else {
        console.error('Error calculating proration:', prorationError);
      }
    }

    // Check if user has sufficient balance in deposit wallet
    const depositBalance = parseFloat(profile.deposit_wallet_balance);
    if (depositBalance < finalCost) {
      return new Response(
        JSON.stringify({ 
          error: 'Insufficient balance in deposit wallet',
          required: finalCost,
          current: depositBalance,
          shortfall: finalCost - depositBalance
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Calculate new balance
    const newDepositBalance = depositBalance - finalCost;

    // Calculate plan expiry date based on billing period
    const expiryDate = new Date();
    const billingPeriodDays = newPlan.billing_period_days || 30;
    
    // Handle different billing period units
    if (newPlan.billing_period_unit === 'month') {
      expiryDate.setMonth(expiryDate.getMonth() + (newPlan.billing_period_value || 1));
    } else if (newPlan.billing_period_unit === 'year') {
      expiryDate.setFullYear(expiryDate.getFullYear() + (newPlan.billing_period_value || 1));
    } else {
      // Default to days
      expiryDate.setDate(expiryDate.getDate() + billingPeriodDays);
    }

    const now = new Date().toISOString();

    // ============================================================================
    // PHASE 1: USE ATOMIC FUNCTION TO PROCESS UPGRADE + COMMISSION
    // ============================================================================
    
    console.log('Calling atomic plan upgrade function:', { 
      userId: user.id, 
      planName, 
      finalCost,
      expiryDate: expiryDate.toISOString()
    });

    const { data: atomicResult, error: atomicError } = await supabase.rpc('process_plan_upgrade_atomic', {
      p_user_id: user.id,
      p_plan_name: planName,
      p_final_cost: finalCost,
      p_expiry_date: expiryDate.toISOString(),
      p_previous_plan: profile.membership_plan,
      p_metadata: {
        previous_plan: profile.membership_plan,
        previous_plan_display_name: currentPlan?.display_name || profile.membership_plan,
        new_plan: planName,
        new_plan_display_name: newPlan.display_name,
        original_price: parseFloat(newPlan.price),
        final_price: finalCost,
        proration_applied: prorationDetails !== null,
        proration_details: prorationDetails,
        billing_period_days: billingPeriodDays,
        billing_period_unit: newPlan.billing_period_unit,
        billing_period_value: newPlan.billing_period_value,
        expires_at: expiryDate.toISOString(),
        upgraded_at: now,
        tasks_preserved: true,
        tasks_completed_at_upgrade: profile.tasks_completed_today,
        skips_used_at_upgrade: profile.skips_today
      }
    });

    if (atomicError) {
      console.error('❌ Atomic plan upgrade failed:', atomicError);
      throw new Error('Failed to process plan upgrade atomically: ' + atomicError.message);
    }

    if (!atomicResult.success) {
      console.error('❌ Atomic plan upgrade returned error:', atomicResult);
      throw new Error(atomicResult.error || 'Plan upgrade processing failed');
    }

    console.log('✅ Atomic plan upgrade successful:', {
      transactionId: atomicResult.transaction_id,
      newBalance: atomicResult.new_deposit_balance,
      commissionProcessed: atomicResult.commission_processed,
      commissionAmount: atomicResult.commission_amount
    });

    // Log to user activity log
    await supabase
      .from('user_activity_log')
      .insert({
        user_id: user.id,
        activity_type: 'plan_upgrade',
        details: {
          from_plan: profile.membership_plan,
          to_plan: planName,
          amount_paid: finalCost,
          proration_applied: prorationDetails !== null,
          savings: prorationDetails?.savings || 0,
          commission_processed: atomicResult.commission_processed,
          commission_amount: atomicResult.commission_amount
        }
      });

    // ============================================================================
    // PHASE 1: COMMISSION NOW PROCESSED ATOMICALLY IN DATABASE
    // No queue needed - commission credited instantly in same transaction
    // ============================================================================
    if (atomicResult.commission_processed) {
      console.log(`💰 Referral commission processed atomically: $${atomicResult.commission_amount}`);
    }

    // Send plan upgrade notification (if notifications table exists)
    try {
      await supabase.from('notifications').insert({
        user_id: user.id,
        title: 'Plan Upgraded Successfully',
        message: `You have successfully upgraded to ${newPlan.display_name}. Your plan expires on ${new Date(expiryDate).toLocaleDateString()}.`,
        type: 'plan_upgrade',
        metadata: {
          plan_name: planName,
          expires_at: expiryDate.toISOString(),
          amount_paid: finalCost
        }
      });
    } catch (notifError) {
      console.log('Note: Could not create notification (table may not exist):', notifError);
    }

    console.log('Plan upgraded successfully:', { 
      userId: user.id, 
      planName, 
      finalCost,
      prorationApplied: prorationDetails !== null,
      expiryDate 
    });

    return new Response(
      JSON.stringify({
        success: true,
        plan: newPlan.display_name,
        planName: planName,
        expiresAt: expiryDate.toISOString(),
        newBalance: newDepositBalance,
        amountCharged: finalCost,
        originalPrice: parseFloat(newPlan.price),
        prorationApplied: prorationDetails !== null,
        prorationDetails: prorationDetails ? {
          credit: prorationDetails.credit,
          savings: prorationDetails.savings,
          daysRemaining: prorationDetails.days_remaining
        } : null
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in upgrade-plan function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
