import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

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

    // Get authenticated user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);

    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    // Parse query parameters
    const url = new URL(req.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '20');
    const offset = (page - 1) * limit;

    console.log(`Fetching referrals for user ${user.id}, page ${page}, limit ${limit}`);

    // Get total count of referrals
    const { count: totalCount, error: countError } = await supabaseClient
      .from('referrals')
      .select('*', { count: 'exact', head: true })
      .eq('referrer_id', user.id);

    if (countError) {
      console.error('Error counting referrals:', countError);
      throw new Error(`Failed to count referrals: ${countError.message}`);
    }

    // Get paginated referrals with referred user details
    const { data: referrals, error: referralsError } = await supabaseClient
      .from('referrals')
      .select(`
        id,
        referred_id,
        referral_code_used,
        total_commission_earned,
        last_commission_date,
        status,
        created_at
      `)
      .eq('referrer_id', user.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (referralsError) {
      console.error('Error fetching referrals:', referralsError);
      throw new Error(`Failed to fetch referrals: ${referralsError.message}`);
    }

    // Get referred user details for all referrals
    const referredUserIds = referrals?.map(r => r.referred_id) || [];
    
    let referredUsers: any[] = [];
    if (referredUserIds.length > 0) {
      const { data: users, error: usersError } = await supabaseClient
        .from('profiles')
        .select('id, username, email, full_name, membership_plan, account_status, created_at, last_activity')
        .in('id', referredUserIds);

      if (usersError) {
        console.error('Error fetching referred users:', usersError);
      } else {
        referredUsers = users || [];
      }
    }

    // Create a map of user details by id for quick lookup
    const userDetailsMap = new Map(referredUsers.map(u => [u.id, u]));

    // Combine referral data with user details
    const enrichedReferrals = referrals?.map(referral => {
      const userDetails = userDetailsMap.get(referral.referred_id);
      
      return {
        id: referral.id,
        referredUser: {
          id: referral.referred_id,
          username: userDetails?.username || 'Unknown',
          email: userDetails?.email || '',
          fullName: userDetails?.full_name || null,
          membershipPlan: userDetails?.membership_plan || 'free',
          accountStatus: userDetails?.account_status || 'active',
          joinedAt: userDetails?.created_at || referral.created_at,
          lastActivity: userDetails?.last_activity || null
        },
        referralCode: referral.referral_code_used,
        totalCommissionEarned: Number(referral.total_commission_earned || 0),
        lastCommissionDate: referral.last_commission_date,
        status: referral.status,
        createdAt: referral.created_at
      };
    }) || [];

    // Calculate pagination metadata
    const totalPages = Math.ceil((totalCount || 0) / limit);
    const hasNextPage = page < totalPages;
    const hasPreviousPage = page > 1;

    console.log(`Found ${totalCount} total referrals, returning page ${page} of ${totalPages}`);

    return new Response(
      JSON.stringify({
        success: true,
        data: enrichedReferrals,
        pagination: {
          page,
          limit,
          totalCount: totalCount || 0,
          totalPages,
          hasNextPage,
          hasPreviousPage
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in get-paginated-referrals:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: error.message === 'Unauthorized' ? 401 : 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
