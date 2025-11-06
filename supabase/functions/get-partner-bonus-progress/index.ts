import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.74.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface BonusTier {
  id: string;
  tier_name: string;
  min_weekly_sales: number;
  max_weekly_sales: number;
  bonus_percentage: number;
  tier_order: number;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    });

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    console.log(`[BONUS-PROGRESS] Getting progress for partner: ${user.id}`);

    // Check if user is a partner
    const { data: partnerConfig, error: partnerError } = await supabase
      .from('partner_config')
      .select('is_active, current_rank')
      .eq('user_id', user.id)
      .single();

    if (partnerError || !partnerConfig || !partnerConfig.is_active) {
      return new Response(
        JSON.stringify({ error: 'Not an active partner' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
      );
    }

    // Calculate current week boundaries (Sunday to now)
    const now = new Date();
    const currentSunday = new Date(now);
    currentSunday.setDate(now.getDate() - now.getDay()); // Go back to current Sunday
    currentSunday.setHours(0, 0, 0, 0);
    
    const currentSaturday = new Date(currentSunday);
    currentSaturday.setDate(currentSunday.getDate() + 6);
    currentSaturday.setHours(23, 59, 59, 999);

    const weekStartDate = currentSunday.toISOString().split('T')[0];
    const weekEndDate = currentSaturday.toISOString().split('T')[0];

    console.log(`[BONUS-PROGRESS] Current week: ${weekStartDate} to ${weekEndDate}`);

    // Get partner's sales for current week
    const { data: salesData, error: salesError } = await supabase
      .from('vouchers')
      .select('voucher_amount')
      .eq('partner_id', user.id)
      .eq('status', 'redeemed')
      .gte('redeemed_at', currentSunday.toISOString())
      .lte('redeemed_at', now.toISOString());

    if (salesError) {
      console.error('[BONUS-PROGRESS] Error fetching sales:', salesError);
      throw salesError;
    }

    const currentWeekSales = salesData?.reduce((sum, sale) => sum + Number(sale.voucher_amount), 0) || 0;

    console.log(`[BONUS-PROGRESS] Current week sales: $${currentWeekSales}`);

    // Get all active bonus tiers
    const { data: tiers, error: tiersError } = await supabase
      .from('partner_bonus_tiers')
      .select('*')
      .eq('is_active', true)
      .order('tier_order', { ascending: true });

    if (tiersError) {
      console.error('[BONUS-PROGRESS] Error fetching tiers:', tiersError);
      throw tiersError;
    }

    if (!tiers || tiers.length === 0) {
      return new Response(
        JSON.stringify({ 
          error: 'No active bonus tiers configured',
          current_week_sales: currentWeekSales,
          week_start_date: weekStartDate,
          week_end_date: weekEndDate,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // Find current tier
    let currentTier: BonusTier | null = null;
    let nextTier: BonusTier | null = null;
    let currentBonus = 0;
    let potentialBonus = 0;

    for (let i = 0; i < tiers.length; i++) {
      const tier = tiers[i] as BonusTier;
      if (currentWeekSales >= tier.min_weekly_sales && currentWeekSales <= tier.max_weekly_sales) {
        currentTier = tier;
        currentBonus = currentWeekSales * tier.bonus_percentage;
        
        // Get next tier if available
        if (i < tiers.length - 1) {
          nextTier = tiers[i + 1] as BonusTier;
          potentialBonus = currentWeekSales * nextTier.bonus_percentage;
        }
        break;
      }
    }

    // If no current tier, user hasn't reached first tier yet
    if (!currentTier && tiers.length > 0) {
      nextTier = tiers[0] as BonusTier;
    }

    // Calculate progress metrics
    const progressToNextTier = nextTier 
      ? ((currentWeekSales - (currentTier?.min_weekly_sales || 0)) / (nextTier.min_weekly_sales - (currentTier?.min_weekly_sales || 0))) * 100
      : 100;

    const amountToNextTier = nextTier 
      ? Math.max(0, nextTier.min_weekly_sales - currentWeekSales)
      : 0;

    // Calculate time metrics
    const daysIntoWeek = Math.floor((now.getTime() - currentSunday.getTime()) / (1000 * 60 * 60 * 24));
    const daysRemaining = 7 - daysIntoWeek;
    const dailyAverageSales = daysIntoWeek > 0 ? currentWeekSales / daysIntoWeek : 0;
    const projectedWeekEndSales = currentWeekSales + (dailyAverageSales * daysRemaining);

    // Calculate projected tier at current pace
    let projectedTier: BonusTier | null = null;
    for (const tier of tiers) {
      if (projectedWeekEndSales >= tier.min_weekly_sales && projectedWeekEndSales <= tier.max_weekly_sales) {
        projectedTier = tier;
        break;
      }
    }

    const projectedBonus = projectedTier ? projectedWeekEndSales * projectedTier.bonus_percentage : 0;

    // Get countdown to payout (next Sunday)
    const nextSunday = new Date(currentSaturday);
    nextSunday.setDate(currentSaturday.getDate() + 1);
    nextSunday.setHours(0, 0, 0, 0);
    const msToNextPayout = nextSunday.getTime() - now.getTime();
    const daysToNextPayout = Math.floor(msToNextPayout / (1000 * 60 * 60 * 24));
    const hoursToNextPayout = Math.floor((msToNextPayout % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

    const result = {
      success: true,
      week_start_date: weekStartDate,
      week_end_date: weekEndDate,
      current_week_sales: currentWeekSales,
      current_tier: currentTier ? {
        id: currentTier.id,
        name: currentTier.tier_name,
        bonus_percentage: currentTier.bonus_percentage,
        min_sales: currentTier.min_weekly_sales,
        max_sales: currentTier.max_weekly_sales,
      } : null,
      current_bonus: currentBonus,
      next_tier: nextTier ? {
        id: nextTier.id,
        name: nextTier.tier_name,
        bonus_percentage: nextTier.bonus_percentage,
        min_sales: nextTier.min_weekly_sales,
        max_sales: nextTier.max_weekly_sales,
      } : null,
      amount_to_next_tier: amountToNextTier,
      progress_to_next_tier: Math.min(100, Math.max(0, progressToNextTier)),
      potential_bonus_at_next_tier: nextTier ? (currentWeekSales * nextTier.bonus_percentage) : currentBonus,
      all_tiers: tiers.map(tier => ({
        id: tier.id,
        name: tier.tier_name,
        bonus_percentage: tier.bonus_percentage,
        min_sales: tier.min_weekly_sales,
        max_sales: tier.max_weekly_sales,
        order: tier.tier_order,
      })),
      velocity: {
        days_into_week: daysIntoWeek,
        days_remaining: daysRemaining,
        daily_average_sales: dailyAverageSales,
        projected_week_end_sales: projectedWeekEndSales,
        projected_tier: projectedTier ? projectedTier.tier_name : null,
        projected_bonus: projectedBonus,
      },
      countdown: {
        days: daysToNextPayout,
        hours: hoursToNextPayout,
        message: `Payout in ${daysToNextPayout} days ${hoursToNextPayout} hours`,
      },
      timestamp: new Date().toISOString(),
    };

    console.log('[BONUS-PROGRESS] Progress calculated successfully');

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error) {
    console.error('[BONUS-PROGRESS] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage,
        timestamp: new Date().toISOString()
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
