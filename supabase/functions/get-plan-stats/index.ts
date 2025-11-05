import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.74.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Simple in-memory cache
const cache = new Map<string, { data: any; timestamp: number }>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

interface PlanStat {
  name: string;
  display_name: string;
  account_type: string;
  count: number;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Authenticate user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      console.error('[get-plan-stats] Authentication failed:', authError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user is admin
    const { data: roleData, error: roleError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle();

    if (roleError || !roleData) {
      console.error('[get-plan-stats] Admin check failed:', roleError);
      return new Response(
        JSON.stringify({ error: 'Forbidden: Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[get-plan-stats] Admin verified, fetching plan statistics');

    // Check cache first
    const cacheKey = 'plan-stats';
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      console.log('[get-plan-stats] Returning cached data');
      return new Response(
        JSON.stringify(cached.data),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Query user counts per plan
    const { data: userCounts, error: countError } = await supabase
      .from('profiles')
      .select('membership_plan');

    if (countError) {
      console.error('[get-plan-stats] Error fetching user counts:', countError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch user counts' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Count users per plan
    const planCounts = new Map<string, number>();
    userCounts?.forEach((profile) => {
      const plan = profile.membership_plan;
      planCounts.set(plan, (planCounts.get(plan) || 0) + 1);
    });

    // Get all active membership plans
    const { data: plans, error: plansError } = await supabase
      .from('membership_plans')
      .select('name, display_name, account_type')
      .eq('is_active', true)
      .order('account_type', { ascending: true })
      .order('price', { ascending: true });

    if (plansError) {
      console.error('[get-plan-stats] Error fetching plans:', plansError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch membership plans' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Combine plans with counts
    const planStats: PlanStat[] = (plans || []).map((plan) => ({
      name: plan.name,
      display_name: plan.display_name,
      account_type: plan.account_type,
      count: planCounts.get(plan.name) || 0,
    }));

    console.log(`[get-plan-stats] Returning ${planStats.length} plans with user counts`);

    // Cache the result
    cache.set(cacheKey, { data: planStats, timestamp: Date.now() });

    return new Response(
      JSON.stringify(planStats),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[get-plan-stats] Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
};

serve(handler);
