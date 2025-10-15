import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { getMembershipPlan } from '../_shared/cache.ts';

interface RenewalResult {
  userId: string;
  action: 'renewed' | 'downgraded' | 'skipped' | 'error';
  reason: string;
  amount?: number;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  console.log('=== Starting cleanup-expired-plans job ===');
  const startTime = Date.now();

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const BATCH_SIZE = 100;
    const results: RenewalResult[] = [];
    let totalProcessed = 0;
    let totalRenewed = 0;
    let totalDowngraded = 0;
    let totalErrors = 0;
    let offset = 0;
    let hasMore = true;

    // Process expired plans in batches
    while (hasMore) {
      console.log(`Processing batch starting at offset ${offset}`);

      // Get users with expired plans
      const { data: expiredUsers, error: queryError } = await supabaseClient
        .from('profiles')
        .select('id, username, email, membership_plan, plan_expires_at, deposit_wallet_balance, auto_renew, account_status, current_plan_start_date')
        .lte('plan_expires_at', new Date().toISOString())
        .not('plan_expires_at', 'is', null)
        .order('plan_expires_at', { ascending: true })
        .range(offset, offset + BATCH_SIZE - 1);

      if (queryError) {
        console.error('Error querying expired users:', queryError);
        throw new Error(`Failed to query expired users: ${queryError.message}`);
      }

      if (!expiredUsers || expiredUsers.length === 0) {
        hasMore = false;
        console.log('No more expired users to process');
        break;
      }

      console.log(`Found ${expiredUsers.length} expired users in this batch`);

      // Process each expired user
      for (const user of expiredUsers) {
        totalProcessed++;

        try {
          // Skip if user is already on free plan
          if (user.membership_plan === 'free') {
            console.log(`User ${user.id} already on free plan, skipping`);
            results.push({
              userId: user.id,
              action: 'skipped',
              reason: 'Already on free plan'
            });
            continue;
          }

          // Handle suspended/banned users separately - downgrade but preserve status
          if (user.account_status === 'suspended' || user.account_status === 'banned') {
            console.log(`User ${user.id} is ${user.account_status}, downgrading to free`);

            const { error: downgradeError } = await supabaseClient
              .from('profiles')
              .update({
                membership_plan: 'free',
                plan_expires_at: null,
                current_plan_start_date: null
              })
              .eq('id', user.id);

            if (downgradeError) {
              console.error(`Error downgrading ${user.account_status} user ${user.id}:`, downgradeError);
              totalErrors++;
              results.push({
                userId: user.id,
                action: 'error',
                reason: `Failed to downgrade ${user.account_status} user: ${downgradeError.message}`
              });
            } else {
              totalDowngraded++;
              results.push({
                userId: user.id,
                action: 'downgraded',
                reason: `${user.account_status} user downgraded to free`
              });

              // Log activity
              await supabaseClient.from('user_activity_log').insert({
                user_id: user.id,
                activity_type: 'plan_downgrade',
                details: {
                  from_plan: user.membership_plan,
                  to_plan: 'free',
                  reason: `${user.account_status}_user_expiry`,
                  expired_at: user.plan_expires_at
                }
              });
            }
            continue;
          }

          // Get the user's current membership plan details using cache
          const membershipPlan = await getMembershipPlan(supabaseClient, user.membership_plan);

          if (!membershipPlan) {
            console.error(`Membership plan not found for user ${user.id}:`, user.membership_plan);
            // Downgrade to free if plan not found
            await supabaseClient
              .from('profiles')
              .update({
                membership_plan: 'free',
                plan_expires_at: null,
                current_plan_start_date: null
              })
              .eq('id', user.id);

            totalDowngraded++;
            results.push({
              userId: user.id,
              action: 'downgraded',
              reason: 'Plan not found or inactive'
            });
            continue;
          }

          const planPrice = parseFloat(membershipPlan.price);

          // Check auto_renew flag
          if (user.auto_renew) {
            console.log(`User ${user.id} has auto_renew enabled, attempting renewal`);

            const currentBalance = parseFloat(user.deposit_wallet_balance);

            // Check if user has sufficient balance
            if (currentBalance >= planPrice) {
              console.log(`User ${user.id} has sufficient balance ($${currentBalance}), renewing plan`);

              const newBalance = currentBalance - planPrice;
              
              // Calculate new expiry date
              const newExpiryDate = new Date();
              if (membershipPlan.billing_period_unit === 'month') {
                newExpiryDate.setMonth(newExpiryDate.getMonth() + (membershipPlan.billing_period_value || 1));
              } else if (membershipPlan.billing_period_unit === 'year') {
                newExpiryDate.setFullYear(newExpiryDate.getFullYear() + (membershipPlan.billing_period_value || 1));
              } else {
                newExpiryDate.setDate(newExpiryDate.getDate() + (membershipPlan.billing_period_days || 30));
              }

              const now = new Date().toISOString();

              // Update user profile with renewed plan
              const { error: renewError } = await supabaseClient
                .from('profiles')
                .update({
                  plan_expires_at: newExpiryDate.toISOString(),
                  deposit_wallet_balance: newBalance,
                  current_plan_start_date: now,
                  last_activity: now
                })
                .eq('id', user.id);

              if (renewError) {
                console.error(`Error renewing plan for user ${user.id}:`, renewError);
                totalErrors++;
                results.push({
                  userId: user.id,
                  action: 'error',
                  reason: `Failed to renew: ${renewError.message}`
                });
                continue;
              }

              // Create transaction record
              await supabaseClient
                .from('transactions')
                .insert({
                  user_id: user.id,
                  type: 'plan_upgrade',
                  amount: planPrice,
                  wallet_type: 'deposit',
                  new_balance: newBalance,
                  description: `Auto-renewal of ${membershipPlan.display_name} plan`,
                  status: 'completed',
                  metadata: {
                    plan_name: user.membership_plan,
                    plan_display_name: membershipPlan.display_name,
                    billing_period_days: membershipPlan.billing_period_days,
                    auto_renewal: true,
                    previous_expiry: user.plan_expires_at,
                    new_expiry: newExpiryDate.toISOString()
                  }
                });

              // Log activity
              await supabaseClient.from('user_activity_log').insert({
                user_id: user.id,
                activity_type: 'plan_auto_renewal',
                details: {
                  plan: user.membership_plan,
                  amount: planPrice,
                  new_expiry: newExpiryDate.toISOString()
                }
              });

              // Send notification
              try {
                await supabaseClient.from('notifications').insert({
                  user_id: user.id,
                  title: 'Plan Auto-Renewed',
                  message: `Your ${membershipPlan.display_name} plan has been automatically renewed for $${planPrice.toFixed(2)}. New expiry: ${new Date(newExpiryDate).toLocaleDateString()}.`,
                  type: 'plan_renewal',
                  metadata: {
                    plan_name: user.membership_plan,
                    amount: planPrice,
                    expires_at: newExpiryDate.toISOString()
                  }
                });
              } catch (notifError) {
                console.log('Note: Could not create notification:', notifError);
              }

              totalRenewed++;
              results.push({
                userId: user.id,
                action: 'renewed',
                reason: 'Auto-renewal successful',
                amount: planPrice
              });

              console.log(`Successfully renewed plan for user ${user.id}`);

            } else {
              // Insufficient balance - downgrade to free
              console.log(`User ${user.id} has insufficient balance ($${currentBalance} < $${planPrice}), downgrading to free`);

              const { error: downgradeError } = await supabaseClient
                .from('profiles')
                .update({
                  membership_plan: 'free',
                  plan_expires_at: null,
                  current_plan_start_date: null
                })
                .eq('id', user.id);

              if (downgradeError) {
                console.error(`Error downgrading user ${user.id}:`, downgradeError);
                totalErrors++;
                results.push({
                  userId: user.id,
                  action: 'error',
                  reason: `Failed to downgrade: ${downgradeError.message}`
                });
                continue;
              }

              // Log activity
              await supabaseClient.from('user_activity_log').insert({
                user_id: user.id,
                activity_type: 'plan_downgrade',
                details: {
                  from_plan: user.membership_plan,
                  to_plan: 'free',
                  reason: 'insufficient_balance_for_renewal',
                  required: planPrice,
                  available: currentBalance
                }
              });

              // Send notification
              try {
                await supabaseClient.from('notifications').insert({
                  user_id: user.id,
                  title: 'Auto-Renewal Failed',
                  message: `Your ${membershipPlan.display_name} plan could not be renewed due to insufficient balance ($${currentBalance.toFixed(2)} available, $${planPrice.toFixed(2)} required). You have been downgraded to the Free plan. Please add funds to upgrade again.`,
                  type: 'plan_renewal_failed',
                  metadata: {
                    previous_plan: user.membership_plan,
                    required_amount: planPrice,
                    available_balance: currentBalance
                  }
                });
              } catch (notifError) {
                console.log('Note: Could not create notification:', notifError);
              }

              totalDowngraded++;
              results.push({
                userId: user.id,
                action: 'downgraded',
                reason: 'Insufficient balance for auto-renewal'
              });
            }

          } else {
            // Auto-renew is false - downgrade to free
            console.log(`User ${user.id} has auto_renew disabled, downgrading to free`);

            const { error: downgradeError } = await supabaseClient
              .from('profiles')
              .update({
                membership_plan: 'free',
                plan_expires_at: null,
                current_plan_start_date: null
              })
              .eq('id', user.id);

            if (downgradeError) {
              console.error(`Error downgrading user ${user.id}:`, downgradeError);
              totalErrors++;
              results.push({
                userId: user.id,
                action: 'error',
                reason: `Failed to downgrade: ${downgradeError.message}`
              });
              continue;
            }

            // Log activity
            await supabaseClient.from('user_activity_log').insert({
              user_id: user.id,
              activity_type: 'plan_downgrade',
              details: {
                from_plan: user.membership_plan,
                to_plan: 'free',
                reason: 'plan_expired_no_auto_renew',
                expired_at: user.plan_expires_at
              }
            });

            // Send notification
            try {
              await supabaseClient.from('notifications').insert({
                user_id: user.id,
                title: 'Plan Expired',
                message: `Your ${membershipPlan.display_name} plan has expired and you have been downgraded to the Free plan. Upgrade anytime to access premium features.`,
                type: 'plan_expired',
                metadata: {
                  previous_plan: user.membership_plan,
                  expired_at: user.plan_expires_at
                }
              });
            } catch (notifError) {
              console.log('Note: Could not create notification:', notifError);
            }

            totalDowngraded++;
            results.push({
              userId: user.id,
              action: 'downgraded',
              reason: 'Plan expired, auto-renew disabled'
            });
          }

        } catch (error) {
          console.error(`Error processing user ${user.id}:`, error);
          totalErrors++;
          results.push({
            userId: user.id,
            action: 'error',
            reason: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }

      // Check if we should continue to next batch
      if (expiredUsers.length < BATCH_SIZE) {
        hasMore = false;
      } else {
        offset += BATCH_SIZE;
      }

      // Small delay between batches to avoid overwhelming the database
      if (hasMore) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    const executionTime = Date.now() - startTime;

    const summary = {
      totalProcessed,
      totalRenewed,
      totalDowngraded,
      totalErrors,
      executionTimeMs: executionTime,
      completedAt: new Date().toISOString(),
      results: results.slice(0, 50) // Include first 50 detailed results
    };

    console.log('=== Cleanup job completed ===');
    console.log(`Total processed: ${totalProcessed}`);
    console.log(`Total renewed: ${totalRenewed}`);
    console.log(`Total downgraded: ${totalDowngraded}`);
    console.log(`Total errors: ${totalErrors}`);
    console.log(`Execution time: ${executionTime}ms`);

    // Send summary email to admins (optional - requires admin email list)
    try {
      // Get admin users
      const { data: adminRoles } = await supabaseClient
        .from('user_roles')
        .select('user_id')
        .eq('role', 'admin');

      if (adminRoles && adminRoles.length > 0) {
        const adminIds = adminRoles.map(r => r.user_id);
        
        // Create notifications for admins
        const adminNotifications = adminIds.map(adminId => ({
          user_id: adminId,
          title: 'Daily Plan Cleanup Report',
          message: `Expired plans cleanup completed. Processed: ${totalProcessed}, Renewed: ${totalRenewed}, Downgraded: ${totalDowngraded}, Errors: ${totalErrors}`,
          type: 'admin_report',
          metadata: summary
        }));

        await supabaseClient.from('notifications').insert(adminNotifications);
        console.log(`Sent summary notifications to ${adminIds.length} admins`);
      }
    } catch (adminError) {
      console.log('Note: Could not send admin notifications:', adminError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        summary
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Fatal error in cleanup-expired-plans:', error);
    const executionTime = Date.now() - startTime;
    
    return new Response(
      JSON.stringify({ 
        error: error.message,
        executionTimeMs: executionTime
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
