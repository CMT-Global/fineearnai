import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.47.10';
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};
Deno.serve(async (req)=>{
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: corsHeaders
    });
  }
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const supabase = createClient(supabaseUrl, supabaseKey);
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }
    const { data: { user }, error: userError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (userError || !user) {
      throw new Error('Unauthorized');
    }
    const { partner_id } = await req.json();
    const targetPartnerId = partner_id || user.id;
    console.log('Checking rank for partner:', targetPartnerId);
    // Get partner config
    const { data: partnerConfig, error: configError } = await supabase.from('partner_config').select('*').eq('user_id', targetPartnerId).single();
    if (configError || !partnerConfig) {
      throw new Error('Partner config not found');
    }
    // Get all rank definitions ordered by rank_order
    const { data: ranks, error: ranksError } = await supabase.from('partner_ranks').select('*').order('rank_order', {
      ascending: true
    });
    if (ranksError) {
      throw new Error('Failed to fetch ranks');
    }
    if (!ranks || ranks.length === 0) {
      return new Response(JSON.stringify({
        success: false,
        message: 'No ranks configured',
        current_rank: partnerConfig.current_rank
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    // Calculate total sales amount from vouchers
    const { data: salesData, error: salesError } = await supabase.from('vouchers').select('voucher_amount').eq('partner_id', targetPartnerId).eq('status', 'redeemed');
    if (salesError) {
      throw new Error('Failed to fetch sales data');
    }
    const totalSales = salesData?.reduce((sum, v)=>sum + Number(v.voucher_amount), 0) || 0;
    console.log('Total sales:', totalSales);
    // Find appropriate rank based on total sales
    let newRank = null;
    for(let i = ranks.length - 1; i >= 0; i--){
      if (totalSales >= ranks[i].daily_sales_target) {
        newRank = ranks[i];
        break;
      }
    }
    // Default to first rank if no milestone met
    if (!newRank) {
      newRank = ranks[0];
    }
    // At this point, newRank is guaranteed to be defined since ranks has at least one element
    if (!newRank) {
      throw new Error('Failed to determine partner rank');
    }
    const currentRank = ranks.find((r)=>r.rank_name.toLowerCase() === partnerConfig.current_rank.toLowerCase());
    const currentRankOrder = currentRank?.rank_order || 0;
    const upgraded = newRank.rank_order > currentRankOrder;
    console.log('Current rank:', partnerConfig.current_rank, 'New rank:', newRank.rank_name, 'Upgraded:', upgraded);
    // Update partner config if rank changed
    if (upgraded) {
      const { error: updateError } = await supabase.from('partner_config').update({
        current_rank: newRank.rank_name.toLowerCase(),
        commission_rate: newRank.commission_rate,
        updated_at: new Date().toISOString()
      }).eq('user_id', targetPartnerId);
      if (updateError) {
        throw new Error('Failed to update partner rank');
      }
      // Create notification for partner
      await supabase.from('notifications').insert({
        user_id: targetPartnerId,
        type: 'rank_upgrade',
        title: '🎉 Rank Upgrade!',
        message: `Congratulations! You've been promoted to ${newRank.rank_name} rank with ${(newRank.commission_rate * 100).toFixed(0)}% commission rate!`,
        priority: 'high',
        metadata: {
          previous_rank: partnerConfig.current_rank,
          new_rank: newRank.rank_name,
          new_commission_rate: newRank.commission_rate,
          total_sales: totalSales
        }
      });
      // Log activity
      await supabase.from('partner_activity_log').insert({
        partner_id: targetPartnerId,
        activity_type: 'rank_upgrade',
        details: {
          previous_rank: partnerConfig.current_rank,
          new_rank: newRank.rank_name,
          previous_commission: partnerConfig.commission_rate,
          new_commission: newRank.commission_rate,
          total_sales: totalSales
        }
      });
      console.log('Partner rank upgraded successfully');
    }
    return new Response(JSON.stringify({
      success: true,
      upgraded,
      previous_rank: partnerConfig.current_rank,
      current_rank: newRank.rank_name,
      commission_rate: newRank.commission_rate,
      total_sales: totalSales,
      next_rank: ranks.find((r)=>r.rank_order > newRank.rank_order) || null
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('Error checking partner rank:', error);
    return new Response(JSON.stringify({
      error: error?.message || 'Unknown error occurred'
    }), {
      status: 400,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
});
