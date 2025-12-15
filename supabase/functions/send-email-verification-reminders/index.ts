import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.74.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ReminderConfig {
  enabled: boolean;
  first_reminder_days: number;
  second_reminder_days: number;
  third_reminder_days: number;
  reminder_frequency_days: number;
  max_reminders: number;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    console.log('[EMAIL-VERIFICATION-REMINDERS] Starting reminder process...');

    // Fetch reminder configuration
    const { data: configData, error: configError } = await supabase
      .from('platform_config')
      .select('value')
      .eq('key', 'email_verification_reminders')
      .single();

    if (configError) {
      throw new Error(`Failed to fetch reminder config: ${configError.message}`);
    }

    const config: ReminderConfig = configData.value as ReminderConfig;

    if (!config.enabled) {
      console.log('[EMAIL-VERIFICATION-REMINDERS] Reminders are disabled in config');
      return new Response(
        JSON.stringify({ success: true, message: 'Reminders disabled', sent: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[EMAIL-VERIFICATION-REMINDERS] Config:', config);

    // Fetch unverified users
    const { data: unverifiedUsers, error: usersError } = await supabase
      .from('profiles')
      .select('id, username, email, created_at')
      .eq('email_verified', false)
      .not('email', 'is', null);

    if (usersError) {
      throw new Error(`Failed to fetch unverified users: ${usersError.message}`);
    }

    console.log(`[EMAIL-VERIFICATION-REMINDERS] Found ${unverifiedUsers?.length || 0} unverified users`);

    let remindersSent = 0;
    const now = new Date();

    for (const user of unverifiedUsers || []) {
      try {
        const accountAge = Math.floor((now.getTime() - new Date(user.created_at).getTime()) / (1000 * 60 * 60 * 24));
        
        console.log(`[EMAIL-VERIFICATION-REMINDERS] Processing user ${user.username}, account age: ${accountAge} days`);

        // Get reminder history
        const { data: reminderHistory, error: historyError } = await supabase
          .from('email_verification_reminders')
          .select('*')
          .eq('user_id', user.id)
          .single();

        let shouldSendReminder = false;
        let reminderNumber = 1;

        if (!reminderHistory) {
          // First reminder check
          if (accountAge >= config.first_reminder_days) {
            shouldSendReminder = true;
            reminderNumber = 1;
          }
        } else {
          // Check if max reminders reached
          if (reminderHistory.reminder_count >= config.max_reminders) {
            console.log(`[EMAIL-VERIFICATION-REMINDERS] Max reminders reached for ${user.username}`);
            continue;
          }

          // Check timing for subsequent reminders
          const daysSinceLastReminder = reminderHistory.last_reminder_sent_at
            ? Math.floor((now.getTime() - new Date(reminderHistory.last_reminder_sent_at).getTime()) / (1000 * 60 * 60 * 24))
            : 999;

          // Determine which reminder threshold to use
          const nextReminderCount = reminderHistory.reminder_count + 1;
          let requiredDays = config.reminder_frequency_days;

          if (nextReminderCount === 2 && accountAge >= config.second_reminder_days) {
            requiredDays = config.second_reminder_days;
          } else if (nextReminderCount === 3 && accountAge >= config.third_reminder_days) {
            requiredDays = config.third_reminder_days;
          }

          if (daysSinceLastReminder >= requiredDays) {
            shouldSendReminder = true;
            reminderNumber = nextReminderCount;
          }
        }

        if (shouldSendReminder) {
          console.log(`[EMAIL-VERIFICATION-REMINDERS] Sending reminder #${reminderNumber} to ${user.username}`);

          // Send email via template - use direct HTTP call with service role key
          const functionUrl = `${Deno.env.get('SUPABASE_URL')!}/functions/v1/send-template-email`;
          const response = await fetch(functionUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!}`,
            },
            body: JSON.stringify({
              email: user.email,
              template_type: 'email_verification_reminder',
              variables: {
                username: user.username,
                email: user.email,
                reminder_number: reminderNumber.toString(),
                account_age_days: accountAge.toString(),
                days_since_signup: accountAge.toString(),
              },
            }),
          });

          let emailError: any = null;
          if (!response.ok) {
            const errorText = await response.text();
            emailError = new Error(`Edge Function returned status ${response.status}: ${errorText}`);
          }

          if (emailError) {
            console.error(`[EMAIL-VERIFICATION-REMINDERS] Failed to send email to ${user.username}:`, emailError);
            continue;
          }

          // Update or create reminder record
          if (!reminderHistory) {
            await supabase.from('email_verification_reminders').insert({
              user_id: user.id,
              reminder_count: 1,
              last_reminder_sent_at: now.toISOString(),
            });
          } else {
            await supabase
              .from('email_verification_reminders')
              .update({
                reminder_count: reminderHistory.reminder_count + 1,
                last_reminder_sent_at: now.toISOString(),
              })
              .eq('user_id', user.id);
          }

          remindersSent++;
          console.log(`[EMAIL-VERIFICATION-REMINDERS] Successfully sent reminder to ${user.username}`);
        }
      } catch (userError: any) {
        console.error(`[EMAIL-VERIFICATION-REMINDERS] Error processing user ${user.username}:`, userError);
        continue;
      }
    }

    console.log(`[EMAIL-VERIFICATION-REMINDERS] Process complete. Sent ${remindersSent} reminders.`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Sent ${remindersSent} email verification reminders`,
        sent: remindersSent,
        processed: unverifiedUsers?.length || 0,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error('[EMAIL-VERIFICATION-REMINDERS] Error:', error.message);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Internal server error',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
