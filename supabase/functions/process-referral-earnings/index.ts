import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { getMembershipPlan } from '../_shared/cache.ts';

interface ReferralEarningRequest {
  referredUserId: string;
  eventType: 'task_completion' | 'deposit';
  amount: number;
  eventId: string;
  metadata?: Record<string, any>;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Parse request body
    const { referredUserId, eventType, amount, eventId, metadata = {} }: ReferralEarningRequest = await req.json();

    console.log(`Processing referral earning: ${eventType} for user ${referredUserId}, amount: ${amount}, eventId: ${eventId}`);

    // Validate inputs
    if (!referredUserId || !eventType || amount === undefined || !eventId) {
      throw new Error('Missing required fields: referredUserId, eventType, amount, eventId');
    }

    if (amount <= 0) {
      console.log('Amount is zero or negative, skipping commission processing');
      return new Response(
        JSON.stringify({ success: true, message: 'No commission for zero/negative amount' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get the referred user's profile to find their referrer
    const { data: referredUser, error: userError } = await supabaseClient
      .from('profiles')
      .select('id, referred_by, username, email')
      .eq('id', referredUserId)
      .maybeSingle();

    if (userError) {
      console.error('Error fetching referred user:', userError);
      throw new Error(`Failed to fetch referred user: ${userError.message}`);
    }

    if (!referredUser || !referredUser.referred_by) {
      console.log('User has no referrer, skipping commission processing');
      return new Response(
        JSON.stringify({ success: true, message: 'No referrer found for user' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const referrerId = referredUser.referred_by;

    // Check for idempotency - prevent duplicate commission processing
    const idempotencyKey = `${referredUserId}_${eventType}_${eventId}`;
    const { data: existingEarning } = await supabaseClient
      .from('referral_earnings')
      .select('id')
      .eq('referred_user_id', referredUserId)
      .eq('earning_type', eventType === 'task_completion' ? 'task_commission' : 'deposit_commission')
      .eq('metadata->>eventId', eventId)
      .maybeSingle();

    if (existingEarning) {
      console.log(`Commission already processed for idempotency key: ${idempotencyKey}`);
      return new Response(
        JSON.stringify({ success: true, message: 'Commission already processed' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get referrer's profile and membership plan
    const { data: referrer, error: referrerError } = await supabaseClient
      .from('profiles')
      .select('id, username, email, membership_plan, earnings_wallet_balance, account_status')
      .eq('id', referrerId)
      .maybeSingle();

    if (referrerError || !referrer) {
      console.error('Error fetching referrer:', referrerError);
      throw new Error('Failed to fetch referrer profile');
    }

    // Check if referrer account is active
    if (referrer.account_status !== 'active') {
      console.log(`Referrer account is ${referrer.account_status}, skipping commission`);
      return new Response(
        JSON.stringify({ success: true, message: 'Referrer account not active' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get referrer's membership plan details using cache
    const membershipPlan = await getMembershipPlan(supabaseClient, referrer.membership_plan);

    if (!membershipPlan) {
      console.error('Membership plan not found:', referrer.membership_plan);
      throw new Error('Failed to fetch membership plan');
    }

    // Determine commission rate based on event type
    const commissionRate = eventType === 'task_completion' 
      ? membershipPlan.task_commission_rate 
      : membershipPlan.deposit_commission_rate;

    if (commissionRate === 0 || commissionRate === null) {
      console.log(`Commission rate is 0 for ${eventType}, skipping commission`);
      return new Response(
        JSON.stringify({ success: true, message: 'Commission rate is zero' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Calculate commission amount
    const commissionAmount = Number((amount * commissionRate).toFixed(2));

    if (commissionAmount <= 0) {
      console.log('Calculated commission is zero or negative, skipping');
      return new Response(
        JSON.stringify({ success: true, message: 'Calculated commission is zero' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Calculated commission: ${commissionAmount} (${commissionRate * 100}% of ${amount})`);

    // Update referrer's earnings wallet balance atomically
    const newBalance = Number(referrer.earnings_wallet_balance) + commissionAmount;
    const { error: updateError } = await supabaseClient
      .from('profiles')
      .update({ 
        earnings_wallet_balance: newBalance,
        total_earned: supabaseClient.rpc('increment', { x: commissionAmount })
      })
      .eq('id', referrerId);

    if (updateError) {
      console.error('Error updating referrer balance:', updateError);
      throw new Error(`Failed to update referrer balance: ${updateError.message}`);
    }

    // Create transaction record
    const { error: transactionError } = await supabaseClient
      .from('transactions')
      .insert({
        user_id: referrerId,
        type: 'referral_earning',
        amount: commissionAmount,
        wallet_type: 'earnings',
        status: 'completed',
        new_balance: newBalance,
        description: `Referral commission from ${referredUser.username || referredUser.email}'s ${eventType === 'task_completion' ? 'task completion' : 'deposit'}`,
        metadata: {
          ...metadata,
          referredUserId,
          eventType,
          baseAmount: amount,
          commissionRate,
          eventId
        }
      });

    if (transactionError) {
      console.error('Error creating transaction:', transactionError);
      throw new Error(`Failed to create transaction: ${transactionError.message}`);
    }

    // Create referral earning record
    const { error: earningError } = await supabaseClient
      .from('referral_earnings')
      .insert({
        referrer_id: referrerId,
        referred_user_id: referredUserId,
        earning_type: eventType === 'task_completion' ? 'task_commission' : 'deposit_commission',
        base_amount: amount,
        commission_amount: commissionAmount,
        commission_rate: commissionRate,
        metadata: {
          ...metadata,
          eventId,
          eventType
        }
      });

    if (earningError) {
      console.error('Error creating referral earning record:', earningError);
      // Don't throw here, transaction already created
    }

    // Update referrals table with new commission total and last commission date
    const { error: referralUpdateError } = await supabaseClient
      .from('referrals')
      .update({
        total_commission_earned: supabaseClient.rpc('increment', { x: commissionAmount }),
        last_commission_date: new Date().toISOString()
      })
      .eq('referrer_id', referrerId)
      .eq('referred_id', referredUserId);

    if (referralUpdateError) {
      console.error('Error updating referrals table:', referralUpdateError);
      // Don't throw here, main transaction successful
    }

    // Create notification for referrer (using notifications table if exists)
    // This is optional and won't fail the transaction if it errors
    try {
      await supabaseClient.from('notifications').insert({
        user_id: referrerId,
        title: 'New Referral Commission',
        message: `You earned $${commissionAmount.toFixed(2)} from ${referredUser.username || referredUser.email}'s ${eventType === 'task_completion' ? 'task completion' : 'deposit'}`,
        type: 'referral_commission',
        metadata: {
          amount: commissionAmount,
          referredUserId,
          eventType
        }
      });
    } catch (notifError) {
      console.log('Note: Could not create notification (table may not exist):', notifError);
    }

    console.log(`Successfully processed referral earning: $${commissionAmount} to ${referrer.username}`);

    return new Response(
      JSON.stringify({
        success: true,
        commission: {
          amount: commissionAmount,
          rate: commissionRate,
          referrerId,
          referredUserId,
          newBalance
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in process-referral-earnings:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
