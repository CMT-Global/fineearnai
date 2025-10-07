import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.74.0';

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

    // Get the new plan details
    const { data: newPlan, error: planError } = await supabase
      .from('membership_plans')
      .select('*')
      .eq('name', planName)
      .eq('is_active', true)
      .single();

    if (planError || !newPlan) {
      console.error('Plan not found:', planError);
      return new Response(JSON.stringify({ error: 'Invalid or inactive membership plan' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const upgradeCost = parseFloat(newPlan.price);

    // Check if user has sufficient balance in deposit wallet
    const depositBalance = parseFloat(profile.deposit_wallet_balance);
    if (depositBalance < upgradeCost) {
      return new Response(
        JSON.stringify({ 
          error: 'Insufficient balance in deposit wallet',
          required: upgradeCost,
          current: depositBalance,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Calculate new balance
    const newDepositBalance = depositBalance - upgradeCost;

    // Calculate plan expiry date
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + newPlan.billing_period_days);

    // Update user profile with new plan
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        membership_plan: planName,
        plan_expires_at: expiryDate.toISOString(),
        deposit_wallet_balance: newDepositBalance,
      })
      .eq('id', user.id);

    if (updateError) {
      console.error('Error updating profile:', updateError);
      throw updateError;
    }

    // Create transaction record
    const { error: transactionError } = await supabase
      .from('transactions')
      .insert({
        user_id: user.id,
        type: 'plan_upgrade',
        amount: upgradeCost,
        wallet_type: 'deposit',
        new_balance: newDepositBalance,
        description: `Upgraded to ${newPlan.display_name} plan`,
        status: 'completed',
        metadata: {
          plan_name: planName,
          plan_display_name: newPlan.display_name,
          billing_period_days: newPlan.billing_period_days,
          expires_at: expiryDate.toISOString(),
        },
      });

    if (transactionError) {
      console.error('Error creating transaction:', transactionError);
      throw transactionError;
    }

    console.log('Plan upgraded successfully:', { userId: user.id, planName, expiryDate });

    return new Response(
      JSON.stringify({
        success: true,
        plan: newPlan.display_name,
        expiresAt: expiryDate.toISOString(),
        newBalance: newDepositBalance,
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
