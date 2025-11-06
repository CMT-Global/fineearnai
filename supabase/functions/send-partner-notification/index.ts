import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { corsHeaders } from "../_shared/cors.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

interface NotificationRequest {
  user_id: string;
  notification_type: 'application_approved' | 'voucher_purchased' | 'voucher_redeemed';
  data?: {
    voucher_code?: string;
    voucher_amount?: number;
    redeemer_username?: string;
    commission_earned?: number;
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { user_id, notification_type, data = {} }: NotificationRequest = await req.json();

    console.log('[PARTNER-NOTIFICATION] Processing:', { user_id, notification_type });

    // Get user profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('email, username, full_name')
      .eq('id', user_id)
      .single();

    if (profileError || !profile) {
      throw new Error('User profile not found');
    }

    // Get email settings
    const { data: emailSettings } = await supabase
      .from('platform_config')
      .select('value')
      .eq('key', 'email_settings')
      .single();

    const settings = emailSettings?.value as any || {};
    const fromEmail = settings.from_email || 'noreply@fineearn.com';
    const fromName = settings.from_name || 'FineEarn';

    // Generate email content based on notification type
    let subject = '';
    let htmlBody = '';
    let textBody = '';

    switch (notification_type) {
      case 'application_approved':
        subject = '🎉 Your Partner Application Has Been Approved!';
        htmlBody = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #059669;">Congratulations, ${profile.full_name || profile.username}! 🎉</h2>
            <p>Your application to become a <strong>FineEarn Local Partner</strong> has been approved!</p>
            
            <div style="background: #f0fdf4; border-left: 4px solid #059669; padding: 15px; margin: 20px 0;">
              <h3 style="margin-top: 0; color: #059669;">What's Next?</h3>
              <ul>
                <li>Access your Partner Dashboard to start purchasing vouchers</li>
                <li>Share vouchers with your network at competitive rates</li>
                <li>Earn instant commission on every voucher sale</li>
                <li>Track your sales and earnings in real-time</li>
              </ul>
            </div>

            <div style="background: #fef3c7; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <h4 style="margin-top: 0;">💰 Earning Potential</h4>
              <p>Our top partners earn an average of <strong>$1,400 per week</strong> by helping others access our platform!</p>
            </div>

            <a href="${Deno.env.get("SITE_URL") || "https://app.fineearn.com"}/partner/dashboard" 
               style="display: inline-block; background: #059669; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0;">
              Go to Partner Dashboard →
            </a>

            <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
              Need help? Contact our partner support team anytime.
            </p>
          </div>
        `;
        textBody = `Congratulations ${profile.full_name || profile.username}! Your Partner Application has been approved. Visit your Partner Dashboard to start earning: ${Deno.env.get("SITE_URL") || "https://app.fineearn.com"}/partner/dashboard`;
        break;

      case 'voucher_purchased':
        subject = '✅ Voucher Purchase Confirmed';
        htmlBody = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #2563eb;">Voucher Purchase Confirmed ✅</h2>
            <p>Hi ${profile.full_name || profile.username},</p>
            <p>Your voucher purchase has been successfully processed.</p>
            
            <div style="background: #f8fafc; border: 2px solid #e2e8f0; border-radius: 8px; padding: 20px; margin: 20px 0;">
              <h3 style="margin-top: 0;">Voucher Details</h3>
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; color: #64748b;">Voucher Code:</td>
                  <td style="padding: 8px 0; font-weight: bold; font-family: monospace; font-size: 18px;">${data.voucher_code}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #64748b;">Voucher Value:</td>
                  <td style="padding: 8px 0; font-weight: bold; color: #059669;">$${data.voucher_amount?.toFixed(2)}</td>
                </tr>
              </table>
            </div>

            <div style="background: #fef3c7; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <p style="margin: 0;"><strong>📋 Next Steps:</strong></p>
              <ol style="margin: 10px 0;">
                <li>Share this voucher code with your customer</li>
                <li>Customer redeems it on their account</li>
                <li>You earn your commission instantly!</li>
              </ol>
            </div>

            <p style="color: #6b7280; font-size: 14px;">
              Track all your vouchers in your Partner Dashboard.
            </p>
          </div>
        `;
        textBody = `Voucher Purchase Confirmed! Code: ${data.voucher_code} | Value: $${data.voucher_amount?.toFixed(2)}`;
        break;

      case 'voucher_redeemed':
        subject = '🎊 Your Voucher Was Redeemed!';
        htmlBody = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #059669;">Great News! 🎊</h2>
            <p>Hi ${profile.full_name || profile.username},</p>
            <p>One of your vouchers has been successfully redeemed!</p>
            
            <div style="background: #f0fdf4; border-left: 4px solid #059669; padding: 20px; margin: 20px 0;">
              <h3 style="margin-top: 0; color: #059669;">Redemption Details</h3>
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; color: #64748b;">Voucher Code:</td>
                  <td style="padding: 8px 0; font-weight: bold; font-family: monospace;">${data.voucher_code}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #64748b;">Redeemed By:</td>
                  <td style="padding: 8px 0; font-weight: bold;">${data.redeemer_username}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #64748b;">Your Commission:</td>
                  <td style="padding: 8px 0; font-weight: bold; color: #059669; font-size: 20px;">$${data.commission_earned?.toFixed(2)}</td>
                </tr>
              </table>
            </div>

            <div style="background: #dbeafe; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <p style="margin: 0;"><strong>💰 Commission Credited</strong></p>
              <p style="margin: 10px 0 0 0;">Your commission has been added to your deposit wallet and is available for new voucher purchases.</p>
            </div>

            <a href="${Deno.env.get("SITE_URL") || "https://app.fineearn.com"}/partner/dashboard" 
               style="display: inline-block; background: #059669; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0;">
              View Dashboard →
            </a>

            <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
              Keep up the great work! 🚀
            </p>
          </div>
        `;
        textBody = `Your voucher ${data.voucher_code} was redeemed by ${data.redeemer_username}! Commission earned: $${data.commission_earned?.toFixed(2)}`;
        break;
    }

    // Send email via Resend
    if (RESEND_API_KEY) {
      const resendResponse = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: `${fromName} <${fromEmail}>`,
          to: [profile.email],
          subject,
          html: htmlBody,
          text: textBody,
        }),
      });

      if (!resendResponse.ok) {
        const error = await resendResponse.text();
        console.error('[PARTNER-NOTIFICATION] Resend error:', error);
        throw new Error(`Failed to send email: ${error}`);
      }

      console.log('[PARTNER-NOTIFICATION] Email sent successfully');
    }

    // Create in-app notification
    await supabase.from('notifications').insert({
      user_id,
      title: subject,
      message: textBody,
      type: 'partner_activity',
      priority: 'high',
      is_read: false,
    });

    // Log email
    await supabase.from('email_logs').insert({
      user_id,
      email: profile.email,
      subject,
      body: htmlBody,
      status: 'sent',
      sent_at: new Date().toISOString(),
    });

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Partner notification sent',
      }),
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );

  } catch (error: any) {
    console.error('[PARTNER-NOTIFICATION] Error:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Failed to send partner notification',
      }),
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
