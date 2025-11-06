import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { step, value, dismiss } = await req.json();

    console.log('[Partner Onboarding] Update request:', { user_id: user.id, step, value, dismiss });

    // Get current onboarding record (use maybeSingle to handle missing record)
    const { data: existingOnboarding, error: fetchError } = await supabase
      .from('partner_onboarding')
      .select('*')
      .eq('partner_id', user.id)
      .maybeSingle();

    if (fetchError) {
      console.error('[Partner Onboarding] Error fetching record:', fetchError);
      throw fetchError;
    }

    let onboarding = existingOnboarding;

    // If no record exists, create one
    if (!onboarding) {
      console.log('[Partner Onboarding] No record found, creating new one...');
      const { data: created, error: createError } = await supabase
        .from('partner_onboarding')
        .insert({
          partner_id: user.id,
          setup_completed: false,
          steps_completed: {
            profile_completed: false,
            payment_methods_set: false,
            first_voucher_created: false,
            community_joined: false,
            guidelines_read: false
          }
        })
        .select()
        .single();

      if (createError) {
        console.error('[Partner Onboarding] Error creating record:', createError);
        throw createError;
      }

      onboarding = created;
      console.log('[Partner Onboarding] Record created successfully');
    }

    let updateData: any = {
      updated_at: new Date().toISOString()
    };

    // Handle dismissal
    if (dismiss) {
      updateData.dismissed_at = new Date().toISOString();
    } else {
      // Update specific step
      const stepsCompleted = onboarding.steps_completed || {};
      stepsCompleted[step] = value;
      updateData.steps_completed = stepsCompleted;

      // Check if all steps are completed
      const allStepsCompleted = Object.values(stepsCompleted).every(v => v === true);
      if (allStepsCompleted && !onboarding.setup_completed) {
        updateData.setup_completed = true;
        updateData.completed_at = new Date().toISOString();
      }
    }

    // Update the record
    const { data: updated, error: updateError } = await supabase
      .from('partner_onboarding')
      .update(updateData)
      .eq('partner_id', user.id)
      .select()
      .single();

    if (updateError) {
      throw updateError;
    }

    return new Response(
      JSON.stringify({ success: true, data: updated }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error updating partner onboarding:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});