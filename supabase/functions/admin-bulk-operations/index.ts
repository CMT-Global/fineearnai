import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

interface BulkOperationRequest {
  action: 'bulk_update_plan' | 'bulk_suspend' | 'bulk_export' | 'bulk_email';
  userIds: string[];
  planName?: string;
  suspendReason?: string;
  exportFormat?: 'csv' | 'json';
  emailData?: {
    subject: string;
    body: string;
  };
}

Deno.serve(async (req) => {
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

    // Check admin role
    const { data: adminRole } = await supabaseClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle();

    if (!adminRole) {
      throw new Error('Admin access required');
    }

    const { action, userIds, planName, suspendReason, exportFormat = 'csv', emailData }: BulkOperationRequest = await req.json();

    console.log(`Admin ${user.id} performing bulk action: ${action} on ${userIds?.length || 0} users`);

    if (!action || !userIds || userIds.length === 0) {
      throw new Error('Action and userIds are required');
    }

    // Limit bulk operations to 1000 users at a time
    if (userIds.length > 1000) {
      throw new Error('Bulk operations limited to 1000 users at a time');
    }

    let result: any = null;

    switch (action) {
      case 'bulk_update_plan': {
        if (!planName) {
          throw new Error('Plan name is required');
        }

        // Validate plan exists
        const { data: plan } = await supabaseClient
          .from('membership_plans')
          .select('*')
          .eq('name', planName)
          .eq('is_active', true)
          .single();

        if (!plan) {
          throw new Error('Invalid or inactive plan');
        }

        // Calculate expiry date using billing_period_days as single source of truth
        const billingPeriodDays = plan.billing_period_days;
        
        if (!billingPeriodDays || billingPeriodDays <= 0) {
          throw new Error(`Invalid billing_period_days for plan ${planName}: ${billingPeriodDays}`);
        }
        
        const now = new Date();
        now.setDate(now.getDate() + billingPeriodDays);
        const expiresAt = now.toISOString();
        
        console.log(`✅ Bulk expiry calculation: Plan=${planName}, billing_period_days=${billingPeriodDays}, expiry=${expiresAt}`);

        const results = {
          successful: [] as string[],
          failed: [] as { userId: string; error: string }[]
        };

        // Process users in batches for performance
        const batchSize = 100;
        for (let i = 0; i < userIds.length; i += batchSize) {
          const batch = userIds.slice(i, i + batchSize);

          // Update all users in batch
          const { error: updateError } = await supabaseClient
            .from('profiles')
            .update({
              membership_plan: planName,
              plan_expires_at: expiresAt,
              current_plan_start_date: new Date().toISOString()
            })
            .in('id', batch);

          if (updateError) {
            batch.forEach(id => results.failed.push({ userId: id, error: updateError.message }));
          } else {
            results.successful.push(...batch);

            // Create transaction records
            const transactions = batch.map(userId => ({
              user_id: userId,
              type: 'plan_upgrade',
              amount: plan.price,
              wallet_type: 'deposit',
              status: 'completed',
              description: `Bulk admin plan change to ${plan.display_name}`,
              metadata: { changed_by: user.id, bulk_operation: true }
            }));

            await supabaseClient.from('transactions').insert(transactions);
          }
        }

        // Log to audit
        await supabaseClient
          .from('audit_logs')
          .insert({
            admin_id: user.id,
            action_type: 'bulk_update_plan',
            details: {
              plan_name: planName,
              total_users: userIds.length,
              successful: results.successful.length,
              failed: results.failed.length
            }
          });

        result = {
          success: true,
          message: `Bulk plan update completed`,
          results
        };

        console.log(`Bulk updated ${results.successful.length} users to plan ${planName}`);
        break;
      }

      case 'bulk_suspend': {
        const results = {
          successful: [] as string[],
          failed: [] as { userId: string; error: string }[]
        };

        // Process in batches
        const batchSize = 100;
        for (let i = 0; i < userIds.length; i += batchSize) {
          const batch = userIds.slice(i, i + batchSize);

          const { error: updateError } = await supabaseClient
            .from('profiles')
            .update({ account_status: 'suspended' })
            .in('id', batch);

          if (updateError) {
            batch.forEach(id => results.failed.push({ userId: id, error: updateError.message }));
          } else {
            results.successful.push(...batch);
          }
        }

        // Log to audit
        await supabaseClient
          .from('audit_logs')
          .insert({
            admin_id: user.id,
            action_type: 'bulk_suspend',
            details: {
              reason: suspendReason || 'No reason provided',
              total_users: userIds.length,
              successful: results.successful.length,
              failed: results.failed.length
            }
          });

        result = {
          success: true,
          message: `Bulk suspend completed`,
          results
        };

        console.log(`Bulk suspended ${results.successful.length} users`);
        break;
      }

      case 'bulk_export': {
        // Fetch user data
        const { data: users, error: fetchError } = await supabaseClient
          .from('mv_user_management')
          .select('*')
          .in('id', userIds);

        if (fetchError) {
          throw new Error(`Failed to fetch user data: ${fetchError.message}`);
        }

        let exportData: string;

        if (exportFormat === 'csv') {
          // Generate CSV
          if (!users || users.length === 0) {
            throw new Error('No users found');
          }

          const headers = Object.keys(users[0]).join(',');
          const rows = users.map(user => 
            Object.values(user).map(val => 
              typeof val === 'string' && val.includes(',') ? `"${val}"` : val
            ).join(',')
          );
          exportData = [headers, ...rows].join('\n');
        } else {
          // Generate JSON
          exportData = JSON.stringify(users, null, 2);
        }

        // Log to audit
        await supabaseClient
          .from('audit_logs')
          .insert({
            admin_id: user.id,
            action_type: 'bulk_export',
            details: {
              format: exportFormat,
              total_users: userIds.length,
              exported: users?.length || 0
            }
          });

        result = {
          success: true,
          message: `Export completed`,
          data: exportData,
          format: exportFormat,
          count: users?.length || 0
        };

        console.log(`Exported ${users?.length || 0} users as ${exportFormat}`);
        break;
      }

      case 'bulk_email': {
        if (!emailData || !emailData.subject || !emailData.body) {
          throw new Error('Email subject and body are required');
        }

        // Fetch user emails
        const { data: users, error: fetchError } = await supabaseClient
          .from('profiles')
          .select('id, email, full_name')
          .in('id', userIds);

        if (fetchError) {
          throw new Error(`Failed to fetch users: ${fetchError.message}`);
        }

        if (!users || users.length === 0) {
          throw new Error('No users found');
        }

        const results = {
          queued: [] as string[],
          failed: [] as { userId: string; error: string }[]
        };

        // Queue emails in email_logs for processing
        const emailRecords = users.map(user => ({
          recipient_user_id: user.id,
          recipient_email: user.email,
          subject: emailData.subject,
          body: emailData.body,
          status: 'pending',
          sent_by: user.id,
          metadata: {
            bulk_operation: true,
            full_name: user.full_name
          }
        }));

        const { error: insertError } = await supabaseClient
          .from('email_logs')
          .insert(emailRecords);

        if (insertError) {
          throw new Error(`Failed to queue emails: ${insertError.message}`);
        }

        results.queued = userIds;

        // Log to audit
        await supabaseClient
          .from('audit_logs')
          .insert({
            admin_id: user.id,
            action_type: 'bulk_email',
            details: {
              subject: emailData.subject,
              total_users: userIds.length,
              queued: results.queued.length
            }
          });

        result = {
          success: true,
          message: `Bulk email queued for sending`,
          results: {
            queued: results.queued.length,
            message: 'Emails will be processed by the system'
          }
        };

        console.log(`Queued ${results.queued.length} emails for bulk send`);
        break;
      }

      default:
        throw new Error(`Invalid bulk action: ${action}`);
    }

    return new Response(
      JSON.stringify({ success: true, result }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in admin-bulk-operations:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: error.message === 'Unauthorized' || error.message === 'Admin access required' ? 403 : 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});