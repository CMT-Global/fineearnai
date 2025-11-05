/**
 * CPAY Notification Service
 * 
 * PURPOSE: Creates in-app notifications for CPAY transaction events
 * 
 * NOTE: This function does NOT send emails. Email notifications are handled
 * by the cpay-webhook function using professional email templates from the
 * email_templates table with proper branding and wrapper.
 * 
 * EVENTS SUPPORTED:
 * - deposit_success / deposit_failed
 * - withdrawal_approved / withdrawal_rejected / withdrawal_completed
 * 
 * FUNCTIONALITY:
 * - Creates in-app notifications visible in user dashboard
 * - Stores transaction metadata for user reference
 * - Does NOT duplicate email sending (prevents double emails)
 */

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
    } else {
      console.log('✅ In-app notification created successfully:', {
        user_id,
        type,
        title,
        notification_type: type
      });
    }

    // NOTE: Email notifications are sent by cpay-webhook function using 
    // professional templates. This function only creates in-app notifications
    // to avoid duplicate emails.

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
