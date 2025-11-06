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

interface PartnerSales {
  partner_id: string;
  total_sales: number;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('[CALCULATE-BONUSES] Starting weekly bonus calculation...');

    // Check if bonus system is enabled
    const { data: configData } = await supabase
      .from('platform_config')
      .select('value')
      .eq('key', 'partner_bonus_system_enabled')
      .single();

    if (!configData || configData.value === false) {
      console.log('[CALCULATE-BONUSES] Bonus system is disabled');
      return new Response(
        JSON.stringify({ success: false, message: 'Bonus system is disabled' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // Calculate previous week boundaries (Sunday to Saturday)
    const now = new Date();
    const lastSunday = new Date(now);
    lastSunday.setDate(now.getDate() - now.getDay() - 7); // Go back to previous Sunday
    lastSunday.setHours(0, 0, 0, 0);
    
    const lastSaturday = new Date(lastSunday);
    lastSaturday.setDate(lastSunday.getDate() + 6);
    lastSaturday.setHours(23, 59, 59, 999);

    const weekStartDate = lastSunday.toISOString().split('T')[0];
    const weekEndDate = lastSaturday.toISOString().split('T')[0];

    console.log(`[CALCULATE-BONUSES] Calculating for week: ${weekStartDate} to ${weekEndDate}`);

    // Get all active bonus tiers, ordered by sales threshold
    const { data: tiers, error: tiersError } = await supabase
      .from('partner_bonus_tiers')
      .select('*')
      .eq('is_active', true)
      .order('tier_order', { ascending: true });

    if (tiersError) {
      console.error('[CALCULATE-BONUSES] Error fetching tiers:', tiersError);
      throw tiersError;
    }

    if (!tiers || tiers.length === 0) {
      console.log('[CALCULATE-BONUSES] No active bonus tiers found');
      return new Response(
        JSON.stringify({ success: false, message: 'No active bonus tiers configured' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    console.log(`[CALCULATE-BONUSES] Found ${tiers.length} active tiers`);

    // Get all active partners
    const { data: partners, error: partnersError } = await supabase
      .from('partner_config')
      .select('user_id')
      .eq('is_active', true);

    if (partnersError) {
      console.error('[CALCULATE-BONUSES] Error fetching partners:', partnersError);
      throw partnersError;
    }

    if (!partners || partners.length === 0) {
      console.log('[CALCULATE-BONUSES] No active partners found');
      return new Response(
        JSON.stringify({ success: true, message: 'No active partners to process', bonuses_calculated: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    console.log(`[CALCULATE-BONUSES] Processing ${partners.length} partners`);

    // Calculate sales for each partner during the week
    const { data: salesData, error: salesError } = await supabase
      .from('vouchers')
      .select('partner_id, voucher_amount')
      .eq('status', 'redeemed')
      .gte('redeemed_at', lastSunday.toISOString())
      .lte('redeemed_at', lastSaturday.toISOString());

    if (salesError) {
      console.error('[CALCULATE-BONUSES] Error fetching sales:', salesError);
      throw salesError;
    }

    // Group sales by partner
    const partnerSalesMap = new Map<string, number>();
    if (salesData) {
      salesData.forEach((sale) => {
        const current = partnerSalesMap.get(sale.partner_id) || 0;
        partnerSalesMap.set(sale.partner_id, current + Number(sale.voucher_amount));
      });
    }

    console.log(`[CALCULATE-BONUSES] Sales data aggregated for ${partnerSalesMap.size} partners`);

    // Process each partner
    let bonusesCalculated = 0;
    let totalBonusAmount = 0;

    for (const partner of partners) {
      const totalSales = partnerSalesMap.get(partner.user_id) || 0;
      
      // Find qualifying tier
      let qualifiedTier: BonusTier | null = null;
      for (const tier of tiers) {
        if (totalSales >= tier.min_weekly_sales && totalSales <= tier.max_weekly_sales) {
          qualifiedTier = tier;
          break;
        }
      }

      const bonusPercentage = qualifiedTier ? qualifiedTier.bonus_percentage : 0;
      const bonusAmount = totalSales * bonusPercentage;

      console.log(`[CALCULATE-BONUSES] Partner ${partner.user_id}: Sales=$${totalSales}, Tier=${qualifiedTier?.tier_name || 'None'}, Bonus=$${bonusAmount}`);

      // Insert or update bonus record
      const { error: upsertError } = await supabase
        .from('partner_weekly_bonuses')
        .upsert({
          partner_id: partner.user_id,
          week_start_date: weekStartDate,
          week_end_date: weekEndDate,
          total_weekly_sales: totalSales,
          qualified_tier_id: qualifiedTier?.id || null,
          bonus_percentage: bonusPercentage,
          bonus_amount: bonusAmount,
          status: bonusAmount > 0 ? 'calculated' : 'pending',
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'partner_id,week_start_date'
        });

      if (upsertError) {
        console.error(`[CALCULATE-BONUSES] Error upserting bonus for partner ${partner.user_id}:`, upsertError);
        continue;
      }

      if (bonusAmount > 0) {
        bonusesCalculated++;
        totalBonusAmount += bonusAmount;
      }
    }

    const result = {
      success: true,
      week_start_date: weekStartDate,
      week_end_date: weekEndDate,
      partners_processed: partners.length,
      bonuses_calculated: bonusesCalculated,
      total_bonus_amount: totalBonusAmount,
      timestamp: new Date().toISOString(),
    };

    console.log('[CALCULATE-BONUSES] Calculation complete:', result);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error) {
    console.error('[CALCULATE-BONUSES] Error:', error);
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
