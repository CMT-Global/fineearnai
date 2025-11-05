import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

/**
 * Template Type Mapping
 * Maps friendly template names to their actual database template_type values
 */
const TEMPLATE_TYPE_MAP: Record<string, string> = {
  // Transaction emails
  'deposit_confirmation': 'transaction',
  'withdrawal_processed': 'transaction',
  'withdrawal_rejected': 'transaction',
  
  // Referral emails
  'new_referral_signup': 'referral',
  'referral_milestone': 'referral',
  
  // Membership emails
  'plan_upgrade': 'membership',
  'plan_expiry_reminder': 'membership',
  'plan_expired': 'membership',
  
  // User onboarding
  'welcome': 'user_onboarding',
  
  // Auth emails (handled by auth hook)
  'auth_magic_link': 'auth_magic_link',
  'auth_email_confirmation': 'auth_email_confirmation',
  'auth_password_reset': 'auth_password_reset',
  'auth_email_change': 'auth_email_change',
  'default_email_change': 'auth_email_change',
};

interface SendTemplateEmailParams {
  templateType: string;
  recipientEmail: string;
  recipientUserId?: string;
  variables: Record<string, string | number | null>;
  supabaseClient: any;
}

interface SendTemplateEmailResult {
  success: boolean;
  error?: string;
  messageId?: string;
  emailLogId?: string;
}

/**
 * Send templated email via Resend
 * 
 * This helper fetches an email template from the database, replaces variables,
 * sends the email via Resend, and logs the result.
 * 
 * @param params - Email sending parameters
 * @returns Result object with success status and details
 */
export async function sendTemplateEmail(
  params: SendTemplateEmailParams
): Promise<SendTemplateEmailResult> {
  const { templateType, recipientEmail, recipientUserId, variables, supabaseClient } = params;

  try {
    console.log(`📧 [Email Sender] Fetching template: ${templateType}`);

    // Map template type using the mapping (e.g., 'deposit_confirmation' -> 'transaction')
    const mappedTemplateType = TEMPLATE_TYPE_MAP[templateType] || templateType;
    console.log(`🔍 [Email Sender] Template mapping: "${templateType}" -> "${mappedTemplateType}"`);

    let template = null;
    let templateError = null;

    // Strategy 1: Try by mapped template_type
    if (mappedTemplateType) {
      console.log(`🔍 [Email Sender] Attempting to fetch by template_type: ${mappedTemplateType}`);
      const result = await supabaseClient
        .from("email_templates")
        .select("*")
        .eq("template_type", mappedTemplateType)
        .eq("is_active", true)
        .maybeSingle();
      
      template = result.data;
      templateError = result.error;
      
      if (template) {
        console.log(`✅ [Email Sender] Template found via template_type mapping: ${template.name}`);
      }
    }

    // Strategy 2: Fallback - try by name (for backward compatibility)
    if (!template && templateType !== mappedTemplateType) {
      console.log(`🔍 [Email Sender] Fallback: Attempting to fetch by name: ${templateType}`);
      const result = await supabaseClient
        .from("email_templates")
        .select("*")
        .eq("name", templateType)
        .eq("is_active", true)
        .maybeSingle();
      
      template = result.data;
      
      if (template) {
        console.log(`✅ [Email Sender] Template found via name fallback: ${template.name}`);
      }
    }

    // Strategy 3: Final fallback - try original value as template_type
    if (!template && templateType !== mappedTemplateType) {
      console.log(`🔍 [Email Sender] Final fallback: Attempting to fetch by original template_type: ${templateType}`);
      const result = await supabaseClient
        .from("email_templates")
        .select("*")
        .eq("template_type", templateType)
        .eq("is_active", true)
        .maybeSingle();
      
      template = result.data;
      
      if (template) {
        console.log(`✅ [Email Sender] Template found via original template_type: ${template.name}`);
      }
    }

    if (!template) {
      console.error(`❌ [Email Sender] Template not found after all strategies: ${templateType}`, templateError);
      return {
        success: false,
        error: `Template not found: ${templateType}`,
      };
    }

    console.log(`✅ [Email Sender] Final template selected: ${template.name} (type: ${template.template_type})`);

    // Replace variables in subject and body
    let populatedSubject = template.subject;
    let populatedBody = template.body;

    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`{{${key}}}`, "g");
      const stringValue = value?.toString() || "";
      populatedSubject = populatedSubject.replace(regex, stringValue);
      populatedBody = populatedBody.replace(regex, stringValue);
    }

    // Send email via Resend
    console.log(`📤 [Email Sender] Sending email to ${recipientEmail}`);
    
    const emailResponse = await resend.emails.send({
      from: "FineEarn <noreply@mail.fineearn.com>",
      to: [recipientEmail],
      subject: populatedSubject,
      html: populatedBody,
    });

    if (emailResponse.error) {
      throw new Error(emailResponse.error.message);
    }

    console.log(`✅ [Email Sender] Email sent. Message ID: ${emailResponse.data?.id}`);

    // Log to email_logs table
    const { data: emailLog, error: logError } = await supabaseClient
      .from("email_logs")
      .insert({
        recipient_email: recipientEmail,
        recipient_user_id: recipientUserId || null,
        subject: populatedSubject,
        body: populatedBody,
        status: "sent",
        template_id: template.id,
        sent_at: new Date().toISOString(),
        metadata: {
          resend_message_id: emailResponse.data?.id,
          template_type: templateType,
          variables_used: Object.keys(variables),
        },
      })
      .select()
      .single();

    if (logError) {
      console.warn("⚠️ [Email Sender] Failed to log email:", logError);
    }

    return {
      success: true,
      messageId: emailResponse.data?.id,
      emailLogId: emailLog?.id,
    };
  } catch (error: any) {
    console.error("❌ [Email Sender] Failed to send email:", error);

    // Attempt to log failure
    try {
      await supabaseClient.from("email_logs").insert({
        recipient_email: recipientEmail,
        recipient_user_id: recipientUserId || null,
        subject: `Failed: ${templateType}`,
        body: "",
        status: "failed",
        template_id: null,
        sent_at: new Date().toISOString(),
        error_message: error.message,
        metadata: {
          template_type: templateType,
          error: error.toString(),
        },
      });
    } catch (logError) {
      console.error("❌ [Email Sender] Failed to log error:", logError);
    }

    return {
      success: false,
      error: error.message || "Unknown error sending email",
    };
  }
}
