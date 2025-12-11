import { createClient } from "https://esm.sh/@supabase/supabase-js@2.74.0";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};
Deno.serve(async (req)=>{
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: corsHeaders
    });
  }
  try {
    const supabaseClient = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
      global: {
        headers: {
          Authorization: req.headers.get("Authorization")
        }
      }
    });
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({
        error: "Unauthorized"
      }), {
        status: 401,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    const { partner_id, date_range = 'month' } = await req.json();
    // Check if user is admin
    const { data: adminRole } = await supabaseClient.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").single();
    const isAdmin = !!adminRole;
    // Determine target partner ID
    let targetPartnerId = partner_id;
    if (!isAdmin) {
      // If not admin, can only view own analytics
      const { data: partnerRole } = await supabaseClient.from("user_roles").select("role").eq("user_id", user.id).eq("role", "partner").single();
      if (!partnerRole) {
        return new Response(JSON.stringify({
          error: "Only partners can access analytics"
        }), {
          status: 403,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json"
          }
        });
      }
      targetPartnerId = user.id;
    }
    // Calculate date ranges
    const now = new Date();
    let startDate;
    switch(date_range){
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'quarter':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case 'year':
        startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }
    console.log(`[PARTNER-ANALYTICS] Fetching analytics for partner: ${targetPartnerId}, range: ${date_range}`);
    // Build query conditionally
    let vouchersQuery = supabaseClient.from('vouchers').select('*').gte('created_at', startDate.toISOString());
    if (targetPartnerId) {
      vouchersQuery = vouchersQuery.eq('partner_id', targetPartnerId);
    }
    const { data: vouchers, error: vouchersError } = await vouchersQuery;
    if (vouchersError) {
      throw vouchersError;
    }
    // Calculate overall metrics
    const totalVouchers = vouchers?.length || 0;
    const redeemedVouchers = vouchers?.filter((v)=>v.status === 'redeemed').length || 0;
    const activeVouchers = vouchers?.filter((v)=>v.status === 'active').length || 0;
    const expiredVouchers = vouchers?.filter((v)=>v.status === 'expired').length || 0;
    const conversionRate = totalVouchers > 0 ? redeemedVouchers / totalVouchers * 100 : 0;
    const totalSales = vouchers?.reduce((sum, v)=>sum + Number(v.voucher_amount), 0) || 0;
    const totalCommission = vouchers?.reduce((sum, v)=>sum + Number(v.commission_amount), 0) || 0;
    const redeemedSales = vouchers?.filter((v)=>v.status === 'redeemed').reduce((sum, v)=>sum + Number(v.voucher_amount), 0) || 0;
    // Sales trend (daily aggregation)
    const salesByDay = {};
    vouchers?.forEach((voucher)=>{
      const date = new Date(voucher.created_at).toISOString().split('T')[0];
      if (!salesByDay[date]) {
        salesByDay[date] = {
          sales: 0,
          count: 0,
          commission: 0
        };
      }
      salesByDay[date].sales += Number(voucher.voucher_amount);
      salesByDay[date].count += 1;
      salesByDay[date].commission += Number(voucher.commission_amount);
    });
    const salesTrend = Object.entries(salesByDay).sort(([a], [b])=>a.localeCompare(b)).map(([date, data])=>({
        date,
        sales: data.sales,
        vouchers: data.count,
        commission: data.commission
      }));
    // Top selling amounts
    const voucherAmounts = {};
    vouchers?.forEach((voucher)=>{
      const amount = Number(voucher.voucher_amount);
      voucherAmounts[amount] = (voucherAmounts[amount] || 0) + 1;
    });
    const topSellingAmounts = Object.entries(voucherAmounts).sort(([, a], [, b])=>b - a).slice(0, 10).map(([amount, count])=>({
        amount: Number(amount),
        count,
        percentage: totalVouchers > 0 ? count / totalVouchers * 100 : 0
      }));
    // Commission earnings over time
    const commissionByDay = {};
    vouchers?.filter((v)=>v.status === 'redeemed').forEach((voucher)=>{
      const date = voucher.redeemed_at ? new Date(voucher.redeemed_at).toISOString().split('T')[0] : new Date(voucher.created_at).toISOString().split('T')[0];
      commissionByDay[date] = (commissionByDay[date] || 0) + Number(voucher.commission_amount);
    });
    const commissionTrend = Object.entries(commissionByDay).sort(([a], [b])=>a.localeCompare(b)).map(([date, commission])=>({
        date,
        commission
      }));
    // Partner performance (if admin viewing all partners)
    let partnerPerformance = [];
    if (isAdmin && !partner_id) {
      const { data: allVouchers } = await supabaseClient.from('vouchers').select(`
          *,
          partner:partner_id (
            username,
            full_name
          )
        `).gte('created_at', startDate.toISOString());
      const partnerStats = {};
      allVouchers?.forEach((voucher)=>{
        const pid = voucher.partner_id;
        if (!partnerStats[pid]) {
          partnerStats[pid] = {
            partner_id: pid,
            partner_name: voucher.partner?.username || 'Unknown',
            total_vouchers: 0,
            redeemed_vouchers: 0,
            total_sales: 0,
            total_commission: 0
          };
        }
        partnerStats[pid].total_vouchers += 1;
        partnerStats[pid].total_sales += Number(voucher.voucher_amount);
        partnerStats[pid].total_commission += Number(voucher.commission_amount);
        if (voucher.status === 'redeemed') {
          partnerStats[pid].redeemed_vouchers += 1;
        }
      });
      partnerPerformance = Object.values(partnerStats).sort((a, b)=>b.total_sales - a.total_sales).slice(0, 10);
    }
    const response = {
      success: true,
      date_range,
      start_date: startDate.toISOString(),
      end_date: now.toISOString(),
      partner_id: targetPartnerId,
      is_admin: isAdmin,
      overview: {
        total_vouchers: totalVouchers,
        redeemed_vouchers: redeemedVouchers,
        active_vouchers: activeVouchers,
        expired_vouchers: expiredVouchers,
        conversion_rate: Math.round(conversionRate * 100) / 100,
        total_sales: totalSales,
        redeemed_sales: redeemedSales,
        total_commission: totalCommission
      },
      sales_trend: salesTrend,
      commission_trend: commissionTrend,
      top_selling_amounts: topSellingAmounts,
      partner_performance: partnerPerformance
    };
    return new Response(JSON.stringify(response), {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });
  } catch (error) {
    console.error("[PARTNER-ANALYTICS] Error:", error);
    return new Response(JSON.stringify({
      error: error.message
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });
  }
});
