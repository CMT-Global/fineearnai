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

    // Update user profile with new plan
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        membership_plan: planName,
        plan_expires_at: expiryDate.toISOString(),
        deposit_wallet_balance: newDepositBalance,
        current_plan_start_date: now,
        last_activity: now,
        // PHASE 2 FIX: Reset daily counters on upgrade so user can immediately use new plan's higher limits
        tasks_completed_today: 0,
        skips_today: 0
      })
      .eq('id', user.id);

    if (updateError) {
      console.error('Error updating profile:', updateError);
      throw updateError;
    }

    // Create detailed transaction record
    const { error: transactionError } = await supabase
      .from('transactions')
      .insert({
        user_id: user.id,
        type: 'plan_upgrade',
        amount: finalCost,
        wallet_type: 'deposit',
        new_balance: newDepositBalance,
        description: `Upgraded from ${currentPlan?.display_name || profile.membership_plan} to ${newPlan.display_name}`,
        status: 'completed',
        metadata: {
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
          // PHASE 2: Track that daily counters were reset
          tasks_reset: true,
          previous_tasks_completed: profile.tasks_completed_today,
          previous_skips: profile.skips_today
        },
      });

    if (transactionError) {
      console.error('Error creating transaction:', transactionError);
      throw transactionError;
    }

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
          savings: prorationDetails?.savings || 0
        }
      });

    // Queue referral commission if user has a referrer (async processing)
    if (profile.referred_by) {
      console.log('Checking referral commission for plan upgrade');
      
      try {
        // Get referrer's membership plan to check THEIR commission rate
        const { data: referrerProfile } = await supabase
          .from('profiles')
          .select('membership_plan')
          .eq('id', profile.referred_by)
          .single();

        if (referrerProfile) {
          const referrerPlan = await getMembershipPlan(supabase, referrerProfile.membership_plan);

          // Only queue commission if referrer's plan has deposit commission enabled
          if (referrerPlan && referrerPlan.deposit_commission_rate > 0) {
            console.log('Queueing referral commission for plan upgrade', { 
              referrerPlan: referrerProfile.membership_plan, 
              commissionRate: referrerPlan.deposit_commission_rate 
            });
            // Queue commission for async processing (non-blocking)
            const { error: queueError } = await supabase
              .from('commission_queue')
              .insert({
                referrer_id: profile.referred_by,
                referred_user_id: user.id,
                event_type: 'upgrade',
                amount: finalCost,
                commission_rate: referrerPlan.deposit_commission_rate / 100,
                metadata: {
                  source: 'plan_upgrade',
                  plan_name: planName,
                  original_amount: parseFloat(newPlan.price),
                  proration_applied: prorationDetails !== null
                }
              });

            if (queueError) {
              console.error('Error queueing upgrade commission:', queueError);
              // Don't fail the upgrade if queue insertion fails
            } else {
              console.log('Upgrade commission queued successfully');
            }
          } else {
            console.log('No commission: referrer plan has 0% deposit commission rate');
          }
        }
      } catch (commissionError) {
        console.error('Exception processing referral commission:', commissionError);
        // Don't fail the upgrade if commission processing fails
      }
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
