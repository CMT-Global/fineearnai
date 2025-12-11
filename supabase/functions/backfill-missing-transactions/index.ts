import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.74.0';
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
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    // Authenticate admin
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      throw new Error('Unauthorized');
    }
    // Check admin role
    const { data: adminRole } = await supabase.from('user_roles').select('role').eq('user_id', user.id).eq('role', 'admin').maybeSingle();
    if (!adminRole) {
      throw new Error('Admin access required');
    }
    const result = {
      taskCompletionTransactionsCreated: 0,
      referralEarningTransactionsCreated: 0,
      errors: []
    };
    console.log('🚀 Starting backfill of missing transactions...');
    // ============================================================================
    // PART 1: Backfill task_earning transactions
    // ============================================================================
    console.log('📊 Finding task completions without transactions...');
    // Get all task completions where is_correct=true and earnings_amount > 0
    const { data: taskCompletions, error: tcError } = await supabase.from('task_completions').select('id, user_id, task_id, earnings_amount, completed_at, is_correct').eq('is_correct', true).gt('earnings_amount', 0).order('completed_at', {
      ascending: true
    });
    if (tcError) {
      console.error('Error fetching task completions:', tcError);
      result.errors.push({
        type: 'task_completions_fetch',
        error: tcError
      });
    } else if (taskCompletions) {
      console.log(`Found ${taskCompletions.length} task completions with earnings`);
      for (const tc of taskCompletions){
        try {
          // Check if transaction already exists for this task completion
          const { data: existingTx } = await supabase.from('transactions').select('id').eq('user_id', tc.user_id).eq('type', 'task_earning').contains('metadata', {
            task_id: tc.task_id
          }).maybeSingle();
          if (existingTx) {
            console.log(`  ⏭️  Transaction already exists for task completion ${tc.id}`);
            continue;
          }
          // Get user's current profile to calculate what the balance was
          const { data: profile } = await supabase.from('profiles').select('earnings_wallet_balance, username').eq('id', tc.user_id).single();
          if (!profile) {
            console.error(`  ❌ Profile not found for user ${tc.user_id}`);
            result.errors.push({
              type: 'profile_not_found',
              user_id: tc.user_id,
              task_completion_id: tc.id
            });
            continue;
          }
          // Get task details for description
          const { data: task } = await supabase.from('ai_tasks').select('category, difficulty').eq('id', tc.task_id).maybeSingle();
          // For backfill, we'll use the current balance as new_balance
          // This is a simplification - in production you'd calculate historical balance
          const newBalance = Number(profile.earnings_wallet_balance);
          // Insert transaction
          const { error: insertError } = await supabase.from('transactions').insert({
            user_id: tc.user_id,
            type: 'task_earning',
            amount: tc.earnings_amount,
            wallet_type: 'earnings',
            new_balance: newBalance,
            description: `AI Task completed: ${task?.category || 'Unknown'}`,
            status: 'completed',
            created_at: tc.completed_at,
            metadata: {
              task_id: tc.task_id,
              category: task?.category,
              difficulty: task?.difficulty,
              backfilled: true,
              backfill_date: new Date().toISOString()
            }
          });
          if (insertError) {
            console.error(`  ❌ Failed to insert transaction for task completion ${tc.id}:`, insertError);
            result.errors.push({
              type: 'transaction_insert',
              task_completion_id: tc.id,
              error: insertError
            });
          } else {
            console.log(`  ✅ Created transaction for task completion ${tc.id} (user: ${profile.username}, amount: $${tc.earnings_amount})`);
            result.taskCompletionTransactionsCreated++;
          }
        } catch (error) {
          console.error(`  💥 Error processing task completion ${tc.id}:`, error);
          result.errors.push({
            type: 'processing_error',
            task_completion_id: tc.id,
            error: error.message
          });
        }
      }
    }
    // ============================================================================
    // PART 2: Backfill referral_commission transactions
    // ============================================================================
    console.log('📊 Finding referral earnings without transactions...');
    const { data: referralEarnings, error: reError } = await supabase.from('referral_earnings').select('id, referrer_id, referred_user_id, earning_type, commission_amount, created_at, metadata').order('created_at', {
      ascending: true
    });
    if (reError) {
      console.error('Error fetching referral earnings:', reError);
      result.errors.push({
        type: 'referral_earnings_fetch',
        error: reError
      });
    } else if (referralEarnings) {
      console.log(`Found ${referralEarnings.length} referral earnings`);
      for (const re of referralEarnings){
        try {
          // Check if transaction already exists
          const eventId = re.metadata?.eventId;
          let existingTx = null;
          if (eventId) {
            const { data } = await supabase.from('transactions').select('id').eq('user_id', re.referrer_id).eq('type', 'referral_commission').contains('metadata', {
              eventId
            }).maybeSingle();
            existingTx = data;
          }
          if (existingTx) {
            console.log(`  ⏭️  Transaction already exists for referral earning ${re.id}`);
            continue;
          }
          // Get referrer profile
          const { data: referrer } = await supabase.from('profiles').select('earnings_wallet_balance, username').eq('id', re.referrer_id).single();
          if (!referrer) {
            console.error(`  ❌ Referrer profile not found for ${re.referrer_id}`);
            result.errors.push({
              type: 'referrer_not_found',
              referrer_id: re.referrer_id,
              referral_earning_id: re.id
            });
            continue;
          }
          // Get referred user for description
          const { data: referredUser } = await supabase.from('profiles').select('username').eq('id', re.referred_user_id).maybeSingle();
          const newBalance = Number(referrer.earnings_wallet_balance);
          // Insert transaction
          const { error: insertError } = await supabase.from('transactions').insert({
            user_id: re.referrer_id,
            type: 'referral_commission',
            amount: re.commission_amount,
            wallet_type: 'earnings',
            new_balance: newBalance,
            description: `Referral commission from ${referredUser?.username || 'user'}'s ${re.earning_type}`,
            status: 'completed',
            created_at: re.created_at,
            metadata: {
              ...re.metadata,
              referred_user_id: re.referred_user_id,
              earning_type: re.earning_type,
              backfilled: true,
              backfill_date: new Date().toISOString()
            }
          });
          if (insertError) {
            console.error(`  ❌ Failed to insert transaction for referral earning ${re.id}:`, insertError);
            result.errors.push({
              type: 'transaction_insert',
              referral_earning_id: re.id,
              error: insertError
            });
          } else {
            console.log(`  ✅ Created transaction for referral earning ${re.id} (referrer: ${referrer.username}, amount: $${re.commission_amount})`);
            result.referralEarningTransactionsCreated++;
          }
        } catch (error) {
          console.error(`  💥 Error processing referral earning ${re.id}:`, error);
          result.errors.push({
            type: 'processing_error',
            referral_earning_id: re.id,
            error: error.message
          });
        }
      }
    }
    console.log('✅ Backfill complete!');
    console.log(`📊 Summary:`);
    console.log(`   - Task earning transactions created: ${result.taskCompletionTransactionsCreated}`);
    console.log(`   - Referral commission transactions created: ${result.referralEarningTransactionsCreated}`);
    console.log(`   - Errors: ${result.errors.length}`);
    return new Response(JSON.stringify({
      success: true,
      result
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      status: 200
    });
  } catch (error) {
    console.error('💥 Fatal error in backfill:', error);
    return new Response(JSON.stringify({
      error: error.message || 'Internal server error'
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      status: 500
    });
  }
});
