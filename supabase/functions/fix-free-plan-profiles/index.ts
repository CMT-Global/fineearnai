import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.74.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * One-time function to fix profiles with membership_plan='free' or NULL
 * Run this once after applying the migration fix
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get the default plan name (account_type = 'free')
    const { data: defaultPlan, error: planError } = await supabase
      .from('membership_plans')
      .select('name')
      .eq('account_type', 'free')
      .eq('is_active', true)
      .limit(1)
      .maybeSingle();

    if (planError || !defaultPlan) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'No active default plan (account_type=free) found',
          details: planError?.message,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    const defaultPlanName = defaultPlan.name;

    // Find profiles that need fixing
    const { data: profilesNeedingFix, error: checkError } = await supabase
      .from('profiles')
      .select('id, username, membership_plan')
      .or(`membership_plan.is.null,membership_plan.eq.,membership_plan.ilike.free`)
      .limit(1000);

    if (checkError) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Failed to check profiles',
          details: checkError.message,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    const affectedCount = profilesNeedingFix?.length || 0;

    if (affectedCount === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No profiles need fixing - all users have valid plans!',
          default_plan_name: defaultPlanName,
          affected_users: 0,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // Update the profiles
    const userIds = profilesNeedingFix.map(p => p.id);
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ membership_plan: defaultPlanName })
      .in('id', userIds);

    if (updateError) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Failed to update profiles',
          details: updateError.message,
          affected_count: affectedCount,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    // Get updated distribution
    const { data: distribution, error: distError } = await supabase
      .from('profiles')
      .select('membership_plan')
      .limit(10000);

    const planCounts: Record<string, number> = {};
    distribution?.forEach(p => {
      const plan = p.membership_plan || 'NULL';
      planCounts[plan] = (planCounts[plan] || 0) + 1;
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: `Successfully fixed ${affectedCount} user profiles`,
        default_plan_name: defaultPlanName,
        affected_users: affectedCount,
        plan_distribution: planCounts,
        sample_fixed_users: profilesNeedingFix.slice(0, 10).map(p => ({
          username: p.username,
          old_plan: p.membership_plan || 'NULL',
          new_plan: defaultPlanName,
        })),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error) {
    console.error('Error fixing profiles:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Internal error',
        details: error.message,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
