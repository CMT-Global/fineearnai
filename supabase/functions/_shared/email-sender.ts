import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

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

    // Fetch active template from database
    const { data: template, error: templateError } = await supabaseClient
      .from("email_templates")
      .select("*")
      .eq("template_type", templateType)
      .eq("is_active", true)
      .single();

    if (templateError || !template) {
      console.error(`❌ [Email Sender] Template not found: ${templateType}`, templateError);
      return {
        success: false,
        error: `Template not found: ${templateType}`,
      };
    }

    console.log(`✅ [Email Sender] Template found: ${template.name}`);

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
