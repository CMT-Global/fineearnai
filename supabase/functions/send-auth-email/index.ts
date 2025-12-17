import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.74.0";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { wrapInProfessionalTemplate } from "../_shared/email-template-wrapper.ts";
const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
const supabaseUrl = Deno.env.get("SUPABASE_URL");
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const hookSecret = Deno.env.get("HOOK_SECRET");
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};
/**
 * Map Supabase auth action types to our template types
 */ function getTemplateType(emailActionType) {
  const typeMap = {
    "signup": "auth_email_confirmation",
    "magiclink": "auth_magic_link",
    "recovery": "auth_password_reset",
    "email_change": "auth_email_change",
    "invite": "auth_invite"
  };
  return typeMap[emailActionType] || "auth_default";
}
/**
 * Build authentication link with proper token
 */ function buildAuthLink(siteUrl, type, tokenHash, redirectTo) {
  const baseUrl = siteUrl || supabaseUrl;
  return `${baseUrl}/auth/v1/verify?token=${tokenHash}&type=${type}&redirect_to=${encodeURIComponent(redirectTo)}`;
}
/**
 * Replace template variables with actual data
 */ function populateTemplate(templateBody, variables) {
  let populatedBody = templateBody;
  for (const [key, value] of Object.entries(variables)){
    const regex = new RegExp(`{{${key}}}`, "g");
    populatedBody = populatedBody.replace(regex, value || "");
  }
  return populatedBody;
}
/**
 * Log email to email_logs table
 */ async function logEmail(supabase, recipientEmail, recipientUserId, subject, body, status, templateId, error) {
  try {
    await supabase.from("email_logs").insert([
      {
        recipient_email: recipientEmail,
        recipient_user_id: recipientUserId,
        subject: subject,
        body: body,
        status: status,
        template_id: templateId,
        sent_at: new Date().toISOString(),
        metadata: error ? {
          error
        } : {}
      }
    ]);
  } catch (logError) {
    console.error("Failed to log email:", logError);
  }
}
/**
 * Fetch email template from database
 */ async function fetchTemplate(supabase, templateType) {
  try {
    const { data, error } = await supabase.from("email_templates").select("*").eq("template_type", templateType).eq("is_active", true).single();
    if (error) {
      console.error(`Template fetch error for type ${templateType}:`, error);
      return null;
    }
    return data;
  } catch (error) {
    console.error("Error fetching template:", error);
    return null;
  }
}
/**
 * Generate fallback email HTML when template is missing
 */
function generateFallbackEmail(
  emailActionType: string,
  username: string,
  authLink: string,
  token: string,
  platformName: string = 'ProfitChips'
): { subject: string; body: string } {
  const fallbackTemplates: Record<string, { subject: string; body: string }> = {
    recovery: {
      subject: "Reset Your Password",
      body: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #333;">Reset Your Password</h1>
          <p>Hi ${username},</p>
          <p>You recently requested to reset your password. Click the button below to reset it:</p>
          <div style="margin: 30px 0;">
            <a href="${authLink}" 
               style="display: inline-block; padding: 12px 24px; background: #0066ff; color: white; text-decoration: none; border-radius: 6px; font-weight: bold;">
              Reset Password
            </a>
          </div>
          <p style="color: #666; font-size: 14px;">Or copy and paste this link into your browser:</p>
          <p style="background: #f5f5f5; padding: 10px; border-radius: 4px; word-break: break-all; font-size: 12px;">
            ${authLink}
          </p>
          <p style="color: #666; font-size: 14px; margin-top: 20px;">
            If you didn't request this, you can safely ignore this email.
          </p>
          <p style="color: #666; font-size: 14px;">This link expires in 1 hour.</p>
        </div>
      `
    },
    signup: {
      subject: "Confirm Your Email",
      body: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #333;">Welcome to ${platformName}!</h1>
          <p>Hi ${username},</p>
          <p>Thanks for signing up! Please confirm your email address by clicking the button below:</p>
          <div style="margin: 30px 0;">
            <a href="${authLink}" 
               style="display: inline-block; padding: 12px 24px; background: #0066ff; color: white; text-decoration: none; border-radius: 6px; font-weight: bold;">
              Confirm Email
            </a>
          </div>
          <p style="color: #666; font-size: 14px;">Or use this code: <strong>${token}</strong></p>
          <p style="color: #666; font-size: 14px; margin-top: 20px;">
            If you didn't create this account, you can ignore this email.
          </p>
        </div>
      `
    },
    email_change: {
      subject: "Confirm Email Change",
      body: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #333;">Email Change Request</h1>
          <p>Hi ${username},</p>
          <p>You requested to change your email address. Click the button below to confirm:</p>
          <div style="margin: 30px 0;">
            <a href="${authLink}" 
               style="display: inline-block; padding: 12px 24px; background: #0066ff; color: white; text-decoration: none; border-radius: 6px; font-weight: bold;">
              Confirm Email Change
            </a>
          </div>
          <p style="color: #666; font-size: 14px; margin-top: 20px;">
            If you didn't request this, please contact support immediately.
          </p>
        </div>
      `
    },
    magiclink: {
      subject: "Your Magic Link",
      body: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #333;">Login to ${platformName}</h1>
          <p>Hi ${username},</p>
          <p>Click the button below to login to your account:</p>
          <div style="margin: 30px 0;">
            <a href="${authLink}" 
               style="display: inline-block; padding: 12px 24px; background: #0066ff; color: white; text-decoration: none; border-radius: 6px; font-weight: bold;">
              Login Now
            </a>
          </div>
          <p style="color: #666; font-size: 14px;">Or use this code: <strong>${token}</strong></p>
          <p style="color: #666; font-size: 14px; margin-top: 20px;">
            If you didn't request this, you can ignore this email.
          </p>
        </div>
      `
    }
  };
  return fallbackTemplates[emailActionType] || fallbackTemplates.recovery;
}
serve(async (req)=>{
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: corsHeaders
    });
  }
  try {
    console.log("🔐 [Auth Email Hook] Received request");
    // Verify hook secret for security
    const authHeader = req.headers.get("authorization");
    if (hookSecret && authHeader !== `Bearer ${hookSecret}`) {
      console.error("❌ [Auth Email Hook] Invalid hook secret");
      return new Response(JSON.stringify({
        error: "Unauthorized"
      }), {
        status: 401,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const requestData = await req.json();
    const { user, email_data } = requestData;
    const { email_action_type, token, token_hash, redirect_to, site_url } = email_data;
    console.log(`📧 [Auth Email Hook] Processing ${email_action_type} for ${user.email}`);
    // Extract user details
    const username = user.user_metadata?.username || user.user_metadata?.full_name || user.email.split("@")[0];
    const userId = user.id;
    // Build authentication link
    const authLink = buildAuthLink(site_url, email_action_type, token_hash, redirect_to);
    // Determine template type
    const templateType = getTemplateType(email_action_type);
    console.log(`🔍 [Auth Email Hook] Template type: ${templateType}`);
    // Fetch custom template
    const template = await fetchTemplate(supabase, templateType);
    let subject;
    let htmlBody;
    let templateId;
    if (template) {
      console.log(`✅ [Auth Email Hook] Using custom template: ${template.name}`);
      // Populate template variables
      const variables = {
        username: username,
        email: user.email,
        reset_link: email_action_type === "recovery" ? authLink : null,
        confirmation_link: email_action_type !== "recovery" ? authLink : null,
        auth_link: authLink,
        token: token,
        site_url: site_url
      };
      subject = template.subject;
      htmlBody = populateTemplate(template.body, variables);
      templateId = template.id;
    } else {
      console.warn(`⚠️ [Auth Email Hook] No custom template found, using fallback`);
      // Use fallback template
      const fallback = generateFallbackEmail(
        email_action_type, 
        username, 
        authLink, 
        token,
        emailSettings.platform_name || 'ProfitChips'
      );
      subject = fallback.subject;
      htmlBody = fallback.body;
    }
    // ============================================
    // FETCH DYNAMIC EMAIL SETTINGS (PHASE 4)
    // ============================================
    console.log(`⚙️  [Auth Email Hook] Fetching dynamic email settings...`);
    const { data: configData } = await supabase.from('platform_config').select('value').eq('key', 'email_settings').maybeSingle();
    const emailSettings = configData?.value || {
      from_address: 'noreply@profitchips.com',
      from_name: 'ProfitChips',
      reply_to_address: 'support@profitchips.com',
      reply_to_name: 'ProfitChips Support',
      platform_name: 'ProfitChips',
      platform_url: 'https://profitchips.com',
    };
    console.log(`📧 [Auth Email Hook] Using settings - From: ${emailSettings.from_name} <${emailSettings.from_address}>`);
    console.log(`📧 [Auth Email Hook] Reply-To: ${emailSettings.reply_to_name} <${emailSettings.reply_to_address}>`);
    // ============================================
    // APPLY PROFESSIONAL EMAIL WRAPPER (PHASE 3)
    // ============================================
    console.log(`🎨 [Auth Email Hook] Checking if email needs professional wrapper...`);
    const needsWrapper = !htmlBody.trim().toLowerCase().startsWith('<!doctype html');
    if (needsWrapper) {
      console.log(`🎨 [Auth Email Hook] Template is HTML fragment - applying professional wrapper`);
      
      htmlBody = await wrapInProfessionalTemplate(htmlBody, {
        title: emailSettings.platform_name || 'ProfitChips',
        preheader: subject,
        headerGradient: true,
        includeFooter: true,
        platformName: emailSettings.platform_name || 'ProfitChips',
        platformUrl: emailSettings.platform_url || 'https://profitchips.com',
        supportUrl: `${emailSettings.platform_url || 'https://profitchips.com'}/support`,
        privacyUrl: `${emailSettings.platform_url || 'https://profitchips.com'}/privacy`,
        logoHtml: '',
      }, supabase);
      
      console.log(`✅ [Auth Email Hook] Professional wrapper applied successfully`);
    } else {
      console.log(`ℹ️  [Auth Email Hook] Template already has full HTML structure - skipping wrapper`);
    }
    // ============================================
    // SEND EMAIL VIA RESEND
    // ============================================
    console.log(`📤 [Auth Email Hook] Sending email to ${user.email}`);
    // Generate unique tracking ID for spam prevention and monitoring
    const trackingId = `auth-${email_action_type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    try {
      const emailResponse = await resend.emails.send({
        from: `${emailSettings.from_name} <${emailSettings.from_address}>`,
        to: [
          user.email
        ],
        subject: subject,
        html: htmlBody,
        reply_to: `${emailSettings.reply_to_name} <${emailSettings.reply_to_address}>`,
        headers: {
          'X-Entity-Ref-ID': trackingId,
          'List-Unsubscribe': `<mailto:${emailSettings.reply_to_address}>`
        }
      });
      console.log(`✅ [Auth Email Hook] Email sent successfully. Resend ID: ${emailResponse.data?.id}`);
      // Log success
      await logEmail(supabase, user.email, userId, subject, htmlBody, "sent", templateId);
      return new Response(JSON.stringify({
        success: true,
        message: "Email sent successfully",
        resend_id: emailResponse.data?.id
      }), {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    } catch (emailError) {
      console.error(`❌ [Auth Email Hook] Failed to send email:`, emailError);
      // Log failure
      await logEmail(supabase, user.email, userId, subject, htmlBody, "failed", templateId, emailError.message);
      return new Response(JSON.stringify({
        success: false,
        error: "Failed to send email",
        details: emailError.message
      }), {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
  } catch (error) {
    console.error("❌ [Auth Email Hook] Unexpected error:", error);
    return new Response(JSON.stringify({
      success: false,
      error: "Internal server error",
      details: error.message
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });
  }
});
