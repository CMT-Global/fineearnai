import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface NotificationRequest {
  user_id: string;
  type: 'deposit_success' | 'deposit_failed' | 'withdrawal_approved' | 'withdrawal_rejected' | 'withdrawal_completed';
  data: {
    amount?: number;
    currency?: string;
    transaction_id?: string;
    reason?: string;
    payout_address?: string;
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const resendApiKey = Deno.env.get('RESEND_API_KEY');

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { user_id, type, data }: NotificationRequest = await req.json();

    // Get user profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('email, username, full_name')
      .eq('id', user_id)
      .single();

    if (profileError || !profile) {
      throw new Error('User not found');
    }

    // Generate notification content based on type
    let title = '';
    let message = '';
    let priority = 'medium';

    switch (type) {
      case 'deposit_success':
        title = '💰 Deposit Successful!';
        message = `Your deposit of ${data.amount} ${data.currency || 'USDT'} has been successfully credited to your account.`;
        priority = 'high';
        break;
      
      case 'deposit_failed':
        title = '❌ Deposit Failed';
        message = `Your deposit attempt has failed. Please try again or contact support if the issue persists.`;
        priority = 'high';
        break;
      
      case 'withdrawal_approved':
        title = '✅ Withdrawal Approved';
        message = `Your withdrawal request for ${data.amount} ${data.currency || 'USDT'} has been approved and is being processed.`;
        priority = 'high';
        break;
      
      case 'withdrawal_rejected':
        title = '🚫 Withdrawal Rejected';
        message = `Your withdrawal request has been rejected. Reason: ${data.reason || 'Not specified'}. Funds have been refunded to your earnings wallet.`;
        priority = 'high';
        break;
      
      case 'withdrawal_completed':
        title = '✨ Withdrawal Completed';
        message = `Your withdrawal of ${data.amount} ${data.currency || 'USDT'} has been successfully sent to ${data.payout_address}.`;
        priority = 'high';
        break;
    }

    // Create in-app notification
    const { error: notificationError } = await supabase
      .from('notifications')
      .insert({
        user_id,
        title,
        message,
        type: 'transaction',
        priority,
        metadata: {
          notification_type: type,
          ...data,
        },
      });

    if (notificationError) {
      console.error('Failed to create notification:', notificationError);
    }

    // Send email notification if Resend is configured
    if (resendApiKey && profile.email) {
      try {
        const emailResponse = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${resendApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: 'FineEarn <notifications@fineearn.com>',
            to: profile.email,
            subject: title,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #333;">${title}</h2>
                <p style="color: #666; line-height: 1.6;">${message}</p>
                <div style="margin-top: 30px; padding: 20px; background-color: #f5f5f5; border-radius: 8px;">
                  <h3 style="color: #333; margin-top: 0;">Transaction Details</h3>
                  ${data.amount ? `<p><strong>Amount:</strong> ${data.amount} ${data.currency || 'USDT'}</p>` : ''}
                  ${data.transaction_id ? `<p><strong>Transaction ID:</strong> ${data.transaction_id}</p>` : ''}
                  ${data.payout_address ? `<p><strong>Address:</strong> ${data.payout_address}</p>` : ''}
                </div>
                <p style="margin-top: 30px; color: #999; font-size: 12px;">
                  This is an automated notification from FineEarn. Please do not reply to this email.
                </p>
              </div>
            `,
          }),
        });

        if (!emailResponse.ok) {
          const errorData = await emailResponse.json();
          console.error('Failed to send email:', errorData);
        }
      } catch (emailError) {
        console.error('Email sending error:', emailError);
      }
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Notification sent' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in send-cpay-notification:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
