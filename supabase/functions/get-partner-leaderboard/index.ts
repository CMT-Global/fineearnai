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
    const { time_period } = await req.json();
    // Check if leaderboard is enabled
    const { data: config } = await supabase.from('platform_config').select('value').eq('key', 'partner_leaderboard_enabled').single();
    if (!config?.value || config.value === false) {
      return new Response(JSON.stringify({
        enabled: false,
        leaderboard: []
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    // Calculate date range
    let dateFilter = new Date();
    if (time_period === 'week') {
      dateFilter.setDate(dateFilter.getDate() - 7);
    } else if (time_period === 'month') {
      dateFilter.setMonth(dateFilter.getMonth() - 1);
    } else if (time_period === 'year') {
      dateFilter.setFullYear(dateFilter.getFullYear() - 1);
    } else {
      // All time - set to beginning of time
      dateFilter = new Date('2000-01-01');
    }
    // Get partner configs with their sales
    const { data: partners, error: partnersError } = await supabase.from('partner_config').select(`
        user_id,
        current_rank,
        total_vouchers_sold,
        total_commission_earned,
        profiles!inner(username, full_name)
      `).eq('is_active', true);
    if (partnersError) throw partnersError;
    // For each partner, calculate sales in the time period
    const leaderboardData = await Promise.all(partners.map(async (partner)=>{
      const { data: salesData } = await supabase.from('vouchers').select('voucher_amount, partner_paid_amount, commission_amount').eq('partner_id', partner.user_id).eq('status', 'redeemed').gte('redeemed_at', dateFilter.toISOString());
      const periodSales = salesData?.reduce((sum, v)=>sum + Number(v.voucher_amount), 0) || 0;
      const periodCommission = salesData?.reduce((sum, v)=>sum + Number(v.commission_amount), 0) || 0;
      const periodVouchers = salesData?.length || 0;
      return {
        partner_id: partner.user_id,
        username: partner.profiles?.username || 'Anonymous',
        full_name: partner.profiles?.full_name,
        rank: partner.current_rank,
        total_sales: time_period === 'all_time' ? await supabase.from('vouchers').select('voucher_amount').eq('partner_id', partner.user_id).eq('status', 'redeemed').then(({ data })=>data?.reduce((sum, v)=>sum + Number(v.voucher_amount), 0) || 0) : periodSales,
        total_commission: time_period === 'all_time' ? Number(partner.total_commission_earned) : periodCommission,
        vouchers_sold: time_period === 'all_time' ? Number(partner.total_vouchers_sold) : periodVouchers
      };
    }));
    // Sort by total sales descending
    const sortedLeaderboard = leaderboardData.filter((p)=>p.total_sales > 0).sort((a, b)=>b.total_sales - a.total_sales).slice(0, 50); // Top 50
    return new Response(JSON.stringify({
      enabled: true,
      leaderboard: sortedLeaderboard,
      time_period: time_period || 'all_time'
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
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
