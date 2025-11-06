import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.74.0';
import { Resend } from 'https://esm.sh/resend@2.0.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface NotificationRequest {
  partner_id: string;
  notification_type: 'weekly_summary' | 'bonus_calculated' | 'bonus_paid' | 'tier_milestone';
  data: {
    week_start_date?: string;
    week_end_date?: string;
    total_sales?: number;
    bonus_amount?: number;
    tier_name?: string;
    next_tier_name?: string;
    amount_to_next_tier?: number;
    payment_method?: string;
    transaction_id?: string;
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { partner_id, notification_type, data }: NotificationRequest = await req.json();

    console.log(`[PARTNER-NOTIFICATION] Processing ${notification_type} for partner=${partner_id}`);

    // Get partner details
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('username, email, full_name')
      .eq('id', partner_id)
      .single();

    if (profileError || !profile) {
      console.error('[PARTNER-NOTIFICATION] Partner not found:', profileError);
      return new Response(
        JSON.stringify({ success: false, error: 'Partner not found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      );
    }

    // Generate email content based on notification type
    let subject = '';
    let html = '';
    const partnerName = profile.full_name || profile.username;

    switch (notification_type) {
      case 'weekly_summary':
        subject = `Weekly Sales Summary - ${data.week_start_date} to ${data.week_end_date}`;
        html = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #2563eb;">Weekly Sales Summary</h2>
            <p>Hello ${partnerName},</p>
            <p>Here's your sales summary for the week of <strong>${data.week_start_date}</strong> to <strong>${data.week_end_date}</strong>:</p>
            
            <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="margin-top: 0; color: #1f2937;">📊 Week Performance</h3>
              <p style="font-size: 18px; margin: 10px 0;">
                <strong>Total Sales:</strong> $${data.total_sales?.toFixed(2)}
              </p>
              ${data.tier_name ? `
                <p style="font-size: 16px; margin: 10px 0;">
                  <strong>Current Tier:</strong> ${data.tier_name}
                </p>
              ` : ''}
              ${data.bonus_amount && data.bonus_amount > 0 ? `
                <p style="font-size: 18px; margin: 10px 0; color: #059669;">
                  <strong>Bonus Earned:</strong> $${data.bonus_amount.toFixed(2)}
                </p>
              ` : `
                <p style="color: #6b7280;">No bonus earned this week. Keep pushing to reach the next tier!</p>
              `}
            </div>

            ${data.next_tier_name && data.amount_to_next_tier ? `
              <div style="background: #fef3c7; padding: 15px; border-radius: 8px; border-left: 4px solid #f59e0b;">
                <p style="margin: 0; color: #92400e;">
                  <strong>💡 Next Tier:</strong> ${data.next_tier_name}<br/>
                  You need <strong>$${data.amount_to_next_tier.toFixed(2)}</strong> more in sales to reach the next tier!
                </p>
              </div>
            ` : ''}

            <p style="margin-top: 30px;">Keep up the great work! 🚀</p>
            <p>Best regards,<br/>The Team</p>
          </div>
        `;
        break;

      case 'bonus_calculated':
        subject = `🎉 Your Weekly Bonus Has Been Calculated!`;
        html = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #059669;">🎉 Bonus Calculated!</h2>
            <p>Hello ${partnerName},</p>
            <p>Great news! Your weekly bonus has been calculated for the period <strong>${data.week_start_date}</strong> to <strong>${data.week_end_date}</strong>.</p>
            
            <div style="background: #d1fae5; padding: 25px; border-radius: 8px; margin: 20px 0; text-align: center;">
              <p style="font-size: 16px; color: #065f46; margin: 0;">Your Bonus Amount</p>
              <p style="font-size: 36px; font-weight: bold; color: #059669; margin: 10px 0;">
                $${data.bonus_amount?.toFixed(2)}
              </p>
              <p style="font-size: 14px; color: #065f46; margin: 0;">
                Based on $${data.total_sales?.toFixed(2)} in sales
              </p>
              ${data.tier_name ? `
                <p style="font-size: 14px; color: #065f46; margin: 5px 0;">
                  Tier: <strong>${data.tier_name}</strong>
                </p>
              ` : ''}
            </div>

            <p>Your bonus will be processed and paid out shortly. You'll receive another notification once the payment is complete.</p>
            
            <p style="margin-top: 30px;">Congratulations on your achievement! 🎊</p>
            <p>Best regards,<br/>The Team</p>
          </div>
        `;
        break;

      case 'bonus_paid':
        subject = `💰 Your Weekly Bonus Has Been Paid!`;
        html = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #059669;">💰 Bonus Payment Confirmed!</h2>
            <p>Hello ${partnerName},</p>
            <p>Excellent news! Your weekly bonus has been successfully paid to your earnings wallet.</p>
            
            <div style="background: #d1fae5; padding: 25px; border-radius: 8px; margin: 20px 0;">
              <h3 style="margin-top: 0; color: #065f46;">Payment Details</h3>
              <p style="font-size: 24px; font-weight: bold; color: #059669; margin: 10px 0;">
                +$${data.bonus_amount?.toFixed(2)}
              </p>
              <p style="font-size: 14px; color: #065f46; margin: 5px 0;">
                Week: ${data.week_start_date} to ${data.week_end_date}
              </p>
              ${data.tier_name ? `
                <p style="font-size: 14px; color: #065f46; margin: 5px 0;">
                  Tier: <strong>${data.tier_name}</strong>
                </p>
              ` : ''}
              ${data.transaction_id ? `
                <p style="font-size: 12px; color: #6b7280; margin-top: 15px;">
                  Transaction ID: ${data.transaction_id}
                </p>
              ` : ''}
            </div>

            <p>The funds are now available in your earnings wallet and can be withdrawn according to your account settings.</p>
            
            <p style="margin-top: 30px;">Thank you for your continued excellence! 💪</p>
            <p>Best regards,<br/>The Team</p>
          </div>
        `;
        break;

      case 'tier_milestone':
        subject = `🏆 Congratulations! You've Reached a New Tier!`;
        html = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #dc2626;">🏆 New Tier Unlocked!</h2>
            <p>Hello ${partnerName},</p>
            <p>Amazing work! You've just reached a new bonus tier!</p>
            
            <div style="background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); padding: 30px; border-radius: 8px; margin: 20px 0; text-align: center; border: 2px solid #f59e0b;">
              <p style="font-size: 18px; color: #78350f; margin: 0;">You've Advanced To</p>
              <p style="font-size: 32px; font-weight: bold; color: #b45309; margin: 15px 0;">
                ${data.tier_name}
              </p>
              <p style="font-size: 16px; color: #78350f; margin: 0;">
                Based on $${data.total_sales?.toFixed(2)} in sales this week!
              </p>
            </div>

            ${data.bonus_amount ? `
              <div style="background: #d1fae5; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <p style="text-align: center; margin: 0; color: #065f46;">
                  Your new tier bonus: <strong style="font-size: 24px; color: #059669;">$${data.bonus_amount.toFixed(2)}</strong>
                </p>
              </div>
            ` : ''}

            ${data.next_tier_name ? `
              <p style="background: #f3f4f6; padding: 15px; border-radius: 8px;">
                <strong>Next Challenge:</strong> Reach <strong>${data.next_tier_name}</strong> tier to unlock even higher bonuses!
              </p>
            ` : ''}

            <p style="margin-top: 30px;">This is a testament to your outstanding performance. Keep pushing forward! 🚀</p>
            <p>Best regards,<br/>The Team</p>
          </div>
        `;
        break;

      default:
        return new Response(
          JSON.stringify({ success: false, error: 'Invalid notification type' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
    }

    // Get email settings
    const { data: emailConfig } = await supabase
      .from('platform_config')
      .select('value')
      .eq('key', 'email_settings')
      .maybeSingle();

    const emailSettings = emailConfig?.value || {
      from_address: 'noreply@mail.fineearn.com',
      from_name: 'FineEarn',
    };

    // Send email via Resend
    const resend = new Resend(Deno.env.get('RESEND_API_KEY'));
    const emailResult = await resend.emails.send({
      from: `${emailSettings.from_name} <${emailSettings.from_address}>`,
      to: [profile.email],
      subject,
      html,
    });

    if (emailResult.error) {
      console.error('[PARTNER-NOTIFICATION] Email send failed:', emailResult.error);
      return new Response(
        JSON.stringify({ success: false, error: emailResult.error.message }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    console.log(`[PARTNER-NOTIFICATION] Email sent successfully to ${profile.email}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Notification sent successfully',
        email_sent_to: profile.email
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error) {
    console.error('[PARTNER-NOTIFICATION] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage,
        timestamp: new Date().toISOString()
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
