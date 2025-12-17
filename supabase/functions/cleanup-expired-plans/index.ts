import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { getMembershipPlan } from '../_shared/cache.ts';
import { sendTemplateEmail } from '../_shared/email-sender.ts';

interface RenewalResult {
  userId: string;
  action: 'renewed' | 'downgraded' | 'skipped' | 'error';
  reason: string;
  amount?: number;
}

interface ReminderResult {
  userId: string;
  action: 'reminder_sent' | 'reminder_skipped' | 'error';
  reason: string;
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
    const reminderResults: ReminderResult[] = [];
    let totalProcessed = 0;
    let totalRenewed = 0;
    let totalDowngraded = 0;
    let totalErrors = 0;
    let totalRemindersSent = 0;
    let offset = 0;
    let hasMore = true;

    // ============================================
    // PHASE 1: SEND PLAN EXPIRY REMINDERS (Daily from 5 days before to 1 day before)
    // ============================================
    console.log('=== Phase 1: Processing plan expiry reminders (5-day window) ===');
    
    // Calculate 5-day window
    const fiveDaysFromNow = new Date();
    fiveDaysFromNow.setDate(fiveDaysFromNow.getDate() + 5);
    fiveDaysFromNow.setHours(23, 59, 59, 999); // End of day
    
    const oneDayFromNow = new Date();
    oneDayFromNow.setDate(oneDayFromNow.getDate() + 1);
    oneDayFromNow.setHours(0, 0, 0, 0); // Start of day
    
    console.log(`Looking for plans expiring between ${oneDayFromNow.toISOString()} and ${fiveDaysFromNow.toISOString()}`);

    // Get users whose plans expire in 1-5 days
    const { data: upcomingExpiryUsers, error: reminderQueryError } = await supabaseClient
      .from('profiles')
      .select('id, username, email, membership_plan, plan_expires_at')
      .gte('plan_expires_at', oneDayFromNow.toISOString())
      .lte('plan_expires_at', fiveDaysFromNow.toISOString())
      .neq('membership_plan', 'free')
      .not('plan_expires_at', 'is', null)
      .eq('account_status', 'active');

    if (reminderQueryError) {
      console.error('Error querying users for expiry reminders:', reminderQueryError);
    } else if (upcomingExpiryUsers && upcomingExpiryUsers.length > 0) {
      console.log(`Found ${upcomingExpiryUsers.length} users with plans expiring in 1-5 days`);

      // Fetch platform URL from email settings once for all reminders
      const { data: emailConfig } = await supabaseClient
        .from('platform_config')
        .select('value')
        .eq('key', 'email_settings')
        .maybeSingle();
      
      const emailSettings = emailConfig?.value || {
        platform_url: 'https://profitchips.com',
      };
      const platformUrl = emailSettings.platform_url || Deno.env.get('SUPABASE_URL')?.replace('/supabase', '') || 'https://profitchips.com';

      for (const user of upcomingExpiryUsers) {
        try {
          // Check if we already sent a reminder TODAY for this user
          const reminderCheckDate = new Date();
          reminderCheckDate.setHours(0, 0, 0, 0);
          const reminderCheckTomorrow = new Date(reminderCheckDate);
          reminderCheckTomorrow.setDate(reminderCheckTomorrow.getDate() + 1);

          const { data: todayReminder } = await supabaseClient
            .from('email_logs')
            .select('id, sent_at')
            .eq('recipient_user_id', user.id)
            .contains('metadata', { template_type: 'plan_expiry_reminder' })
            .gte('sent_at', reminderCheckDate.toISOString())
            .lt('sent_at', reminderCheckTomorrow.toISOString())
            .limit(1)
            .maybeSingle();

          if (todayReminder) {
            console.log(`Reminder already sent today to user ${user.id}, skipping`);
            reminderResults.push({
              userId: user.id,
              action: 'reminder_skipped',
              reason: 'Reminder already sent today'
            });
            continue;
          }


          // Get plan details
          const membershipPlan = await getMembershipPlan(supabaseClient, user.membership_plan);
          if (!membershipPlan) {
            console.log(`Plan not found for user ${user.id}, skipping reminder`);
            continue;
          }

          // Calculate days until expiry
          const expiryDate = new Date(user.plan_expires_at);
          const currentDate = new Date();
          const daysUntilExpiry = Math.ceil((expiryDate.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24));

          // Send expiry reminder email
          console.log(`Sending expiry reminder to ${user.email} (${user.username}) - ${daysUntilExpiry} days until expiry`);
          
          const emailResult = await sendTemplateEmail({
            templateType: 'plan_expiry_reminder',
            recipientEmail: user.email,
            recipientUserId: user.id,
            variables: {
              username: user.username || 'Member',
              plan_name: membershipPlan.display_name,
              expiry_date: expiryDate.toLocaleDateString('en-US', { 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              }),
              days_until_expiry: daysUntilExpiry.toString(),
              plan_price: parseFloat(membershipPlan.price).toFixed(2),
              platform_url: platformUrl
            },
            supabaseClient
          });

          if (emailResult.success) {
            console.log(`✅ Expiry reminder sent to ${user.email} - ${daysUntilExpiry} days remaining`);
            totalRemindersSent++;
            reminderResults.push({
              userId: user.id,
              action: 'reminder_sent',
              reason: `Reminder sent for plan expiring in ${daysUntilExpiry} day${daysUntilExpiry !== 1 ? 's' : ''}`
            });

            // Create in-app notification with days remaining
            await supabaseClient.from('notifications').insert({
              user_id: user.id,
              type: 'membership',
              title: `⏰ ${daysUntilExpiry} Day${daysUntilExpiry !== 1 ? 's' : ''} Until Plan Expires`,
              message: `Your ${membershipPlan.display_name} plan expires in ${daysUntilExpiry} day${daysUntilExpiry !== 1 ? 's' : ''} on ${expiryDate.toLocaleDateString()}. Renew now to keep your premium benefits!`,
              priority: 'high',
              metadata: {
                plan_name: user.membership_plan,
                expiry_date: user.plan_expires_at,
                days_until_expiry: daysUntilExpiry,
                reminder_date: new Date().toISOString()
              }
            });
          } else {
            console.error(`Failed to send expiry reminder to ${user.email}:`, emailResult.error);
            reminderResults.push({
              userId: user.id,
              action: 'error',
              reason: `Email send failed: ${emailResult.error}`
            });
          }

        } catch (error) {
          console.error(`Error processing reminder for user ${user.id}:`, error);
          reminderResults.push({
            userId: user.id,
            action: 'error',
            reason: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }
    } else {
      console.log('No users found with plans expiring in 1-5 days');
    }

    console.log('=== Phase 1 completed: Expiry reminders processed ===');
    console.log(`Total reminders sent: ${totalRemindersSent}`);

    // ============================================
    // PHASE 2: PROCESS EXPIRED PLANS (existing logic)
    // ============================================
    console.log('=== Phase 2: Processing expired plans ===');

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
      totalRemindersSent,
      executionTimeMs: executionTime,
      completedAt: new Date().toISOString(),
      results: results.slice(0, 50), // Include first 50 detailed results
      reminderResults: reminderResults.slice(0, 20) // Include first 20 reminder results
    };

    console.log('=== Cleanup job completed ===');
    console.log(`Total reminders sent: ${totalRemindersSent}`);
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
          message: `Expired plans cleanup completed. Reminders: ${totalRemindersSent}, Processed: ${totalProcessed}, Renewed: ${totalRenewed}, Downgraded: ${totalDowngraded}, Errors: ${totalErrors}`,
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
