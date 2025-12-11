import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.74.0';
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};
Deno.serve(async (req)=>{
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: corsHeaders
    });
  }
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    console.log('[BONUS-PAYOUTS] Starting bonus payout processing...');
    // Check if bonus system is enabled
    const { data: configData } = await supabase.from('platform_config').select('value').eq('key', 'partner_bonus_system_enabled').single();
    if (!configData || configData.value === false) {
      console.log('[BONUS-PAYOUTS] Bonus system is disabled');
      return new Response(JSON.stringify({
        success: false,
        message: 'Bonus system is disabled'
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        },
        status: 200
      });
    }
    // Get all bonuses with status='calculated' (ready for payout)
    const { data: bonuses, error: bonusesError } = await supabase.from('partner_weekly_bonuses').select('*').eq('status', 'calculated').gt('bonus_amount', 0).order('created_at', {
      ascending: true
    });
    if (bonusesError) {
      console.error('[BONUS-PAYOUTS] Error fetching bonuses:', bonusesError);
      throw bonusesError;
    }
    if (!bonuses || bonuses.length === 0) {
      console.log('[BONUS-PAYOUTS] No bonuses ready for payout');
      return new Response(JSON.stringify({
        success: true,
        message: 'No bonuses to process',
        bonuses_paid: 0
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        },
        status: 200
      });
    }
    console.log(`[BONUS-PAYOUTS] Processing ${bonuses.length} bonus payouts`);
    let bonusesPaid = 0;
    let bonusesFailed = 0;
    let totalPaidAmount = 0;
    const errors = [];
    // Process each bonus
    for (const bonus of bonuses){
      console.log(`[BONUS-PAYOUTS] Processing bonus ${bonus.id} for partner ${bonus.partner_id}: $${bonus.bonus_amount}`);
      try {
        // Step 1: Lock partner profile and get current balance
        const { data: profile, error: profileError } = await supabase.from('profiles').select('earnings_wallet_balance, total_earned, username').eq('id', bonus.partner_id).single();
        if (profileError || !profile) {
          console.error(`[BONUS-PAYOUTS] Partner profile not found: ${bonus.partner_id}`);
          await supabase.from('partner_weekly_bonuses').update({
            status: 'failed',
            updated_at: new Date().toISOString()
          }).eq('id', bonus.id);
          bonusesFailed++;
          errors.push(`Partner ${bonus.partner_id}: Profile not found`);
          continue;
        }
        const oldBalance = Number(profile.earnings_wallet_balance);
        const newBalance = oldBalance + bonus.bonus_amount;
        // Step 2: Update partner's earnings wallet balance
        const { error: updateError } = await supabase.from('profiles').update({
          earnings_wallet_balance: newBalance,
          total_earned: Number(profile.total_earned) + bonus.bonus_amount,
          last_activity: new Date().toISOString()
        }).eq('id', bonus.partner_id);
        if (updateError) {
          console.error(`[BONUS-PAYOUTS] Error updating profile: ${updateError.message}`);
          await supabase.from('partner_weekly_bonuses').update({
            status: 'failed',
            updated_at: new Date().toISOString()
          }).eq('id', bonus.id);
          bonusesFailed++;
          errors.push(`Partner ${bonus.partner_id}: ${updateError.message}`);
          continue;
        }
        console.log(`[BONUS-PAYOUTS] Updated balance: ${oldBalance} -> ${newBalance}`);
        // Step 3: Create transaction record
        const { data: transaction, error: txError } = await supabase.from('transactions').insert({
          user_id: bonus.partner_id,
          type: 'referral_commission',
          amount: bonus.bonus_amount,
          wallet_type: 'earnings',
          new_balance: newBalance,
          status: 'completed',
          description: `Weekly bonus: ${bonus.week_start_date} to ${bonus.week_end_date}`,
          metadata: {
            bonus_id: bonus.id,
            week_start: bonus.week_start_date,
            week_end: bonus.week_end_date,
            total_sales: bonus.total_weekly_sales,
            bonus_percentage: bonus.bonus_percentage,
            tier_id: bonus.qualified_tier_id,
            bonus_type: 'weekly_performance'
          },
          created_at: new Date().toISOString()
        }).select().single();
        if (txError) {
          console.error(`[BONUS-PAYOUTS] Error creating transaction: ${txError.message}`);
          // Attempt to rollback balance update
          await supabase.from('profiles').update({
            earnings_wallet_balance: oldBalance
          }).eq('id', bonus.partner_id);
          await supabase.from('partner_weekly_bonuses').update({
            status: 'failed',
            updated_at: new Date().toISOString()
          }).eq('id', bonus.id);
          bonusesFailed++;
          errors.push(`Partner ${bonus.partner_id}: ${txError.message}`);
          continue;
        }
        // Step 4: Update bonus record to 'paid' status
        const { error: bonusUpdateError } = await supabase.from('partner_weekly_bonuses').update({
          status: 'paid',
          paid_at: new Date().toISOString(),
          transaction_id: transaction.id,
          updated_at: new Date().toISOString()
        }).eq('id', bonus.id);
        if (bonusUpdateError) {
          console.error(`[BONUS-PAYOUTS] Error updating bonus status: ${bonusUpdateError.message}`);
        }
        // Step 5: Log activity
        await supabase.from('partner_activity_log').insert({
          partner_id: bonus.partner_id,
          activity_type: 'bonus_payout',
          transaction_id: transaction.id,
          details: {
            bonus_id: bonus.id,
            week: `${bonus.week_start_date} to ${bonus.week_end_date}`,
            amount: bonus.bonus_amount,
            sales: bonus.total_weekly_sales,
            percentage: bonus.bonus_percentage
          },
          created_at: new Date().toISOString()
        });
        // Step 6: Send notification to partner
        await supabase.functions.invoke('send-partner-notification', {
          body: {
            partnerId: bonus.partner_id,
            type: 'bonus_paid',
            title: '💰 Weekly Bonus Credited!',
            message: `Congratulations! Your weekly bonus of $${bonus.bonus_amount.toFixed(2)} has been credited to your earnings wallet for the week of ${bonus.week_start_date} to ${bonus.week_end_date}. Total sales: $${bonus.total_weekly_sales.toFixed(2)}`,
            metadata: {
              bonus_amount: bonus.bonus_amount,
              week_start: bonus.week_start_date,
              week_end: bonus.week_end_date,
              total_sales: bonus.total_weekly_sales
            }
          }
        });
        bonusesPaid++;
        totalPaidAmount += bonus.bonus_amount;
        console.log(`[BONUS-PAYOUTS] Successfully processed bonus ${bonus.id}`);
      } catch (error) {
        console.error(`[BONUS-PAYOUTS] Error processing bonus ${bonus.id}:`, error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        await supabase.from('partner_weekly_bonuses').update({
          status: 'failed',
          updated_at: new Date().toISOString()
        }).eq('id', bonus.id);
        bonusesFailed++;
        errors.push(`Bonus ${bonus.id}: ${errorMessage}`);
      }
    }
    const result = {
      success: true,
      bonuses_paid: bonusesPaid,
      bonuses_failed: bonusesFailed,
      total_paid_amount: totalPaidAmount,
      errors: errors.length > 0 ? errors : undefined,
      timestamp: new Date().toISOString()
    };
    console.log('[BONUS-PAYOUTS] Payout processing complete:', result);
    return new Response(JSON.stringify(result), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      status: 200
    });
  } catch (error) {
    console.error('[BONUS-PAYOUTS] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(JSON.stringify({
      success: false,
      error: errorMessage,
      timestamp: new Date().toISOString()
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      status: 500
    });
  }
});
