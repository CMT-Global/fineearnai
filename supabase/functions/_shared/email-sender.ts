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
 * PHASE 5 ENHANCEMENTS:
 * - Multi-tier fallback strategy for template discovery
 * - Comprehensive logging at each step
 * - Performance metrics tracking
 * - Variable validation
 * 
 * @param params - Email sending parameters
 * @returns Result object with success status and details
 */
export async function sendTemplateEmail(
  params: SendTemplateEmailParams
): Promise<SendTemplateEmailResult> {
  const { templateType, recipientEmail, recipientUserId, variables, supabaseClient } = params;
  const startTime = Date.now();

  try {
    console.log(`📧 [Email Sender] ========================================`);
    console.log(`📧 [Email Sender] Starting email send process`);
    console.log(`📧 [Email Sender] Template requested: "${templateType}"`);
    console.log(`📧 [Email Sender] Recipient: ${recipientEmail}`);
    console.log(`📧 [Email Sender] Variables: ${Object.keys(variables).join(', ')}`);

    // Map template type using the mapping (e.g., 'deposit_confirmation' -> 'transaction')
    const mappedTemplateType = TEMPLATE_TYPE_MAP[templateType] || null;
    console.log(`🔍 [Email Sender] Template mapping: "${templateType}" -> "${mappedTemplateType || 'NO MAPPING'}"`);

    let template = null;
    let templateError = null;
    let discoveryMethod = '';
    let attemptNumber = 0;

    // ============================================
    // STRATEGY 1: Try by mapped template_type
    // ============================================
    if (mappedTemplateType) {
      attemptNumber++;
      console.log(`🔍 [Email Sender] [Attempt ${attemptNumber}] Fetching by mapped template_type: "${mappedTemplateType}"`);
      
      const queryStart = Date.now();
      const result = await supabaseClient
        .from("email_templates")
        .select("*")
        .eq("template_type", mappedTemplateType)
        .eq("is_active", true)
        .maybeSingle();
      
      const queryTime = Date.now() - queryStart;
      console.log(`⏱️  [Email Sender] [Attempt ${attemptNumber}] Query completed in ${queryTime}ms`);
      
      template = result.data;
      templateError = result.error;
      
      if (result.error) {
        console.log(`⚠️  [Email Sender] [Attempt ${attemptNumber}] Query error:`, result.error.message);
      }
      
      if (template) {
        discoveryMethod = `mapped_template_type:${mappedTemplateType}`;
        console.log(`✅ [Email Sender] [Attempt ${attemptNumber}] SUCCESS - Template found!`);
        console.log(`📄 [Email Sender] Template details: name="${template.name}", type="${template.template_type}", id="${template.id}"`);
      } else {
        console.log(`❌ [Email Sender] [Attempt ${attemptNumber}] No template found with template_type="${mappedTemplateType}"`);
      }
    } else {
      console.log(`⏭️  [Email Sender] Skipping Strategy 1: No mapping exists for "${templateType}"`);
    }

    // ============================================
    // STRATEGY 2: Fallback - try by name (backward compatibility)
    // ============================================
    if (!template && templateType !== mappedTemplateType) {
      attemptNumber++;
      console.log(`🔍 [Email Sender] [Attempt ${attemptNumber}] Fallback: Fetching by name: "${templateType}"`);
      
      const queryStart = Date.now();
      const result = await supabaseClient
        .from("email_templates")
        .select("*")
        .eq("name", templateType)
        .eq("is_active", true)
        .maybeSingle();
      
      const queryTime = Date.now() - queryStart;
      console.log(`⏱️  [Email Sender] [Attempt ${attemptNumber}] Query completed in ${queryTime}ms`);
      
      template = result.data;
      
      if (result.error) {
        console.log(`⚠️  [Email Sender] [Attempt ${attemptNumber}] Query error:`, result.error.message);
      }
      
      if (template) {
        discoveryMethod = `name:${templateType}`;
        console.log(`✅ [Email Sender] [Attempt ${attemptNumber}] SUCCESS - Template found via name fallback!`);
        console.log(`📄 [Email Sender] Template details: name="${template.name}", type="${template.template_type}", id="${template.id}"`);
      } else {
        console.log(`❌ [Email Sender] [Attempt ${attemptNumber}] No template found with name="${templateType}"`);
      }
    }

    // ============================================
    // STRATEGY 3: Final fallback - try original value as template_type
    // ============================================
    if (!template && templateType !== mappedTemplateType) {
      attemptNumber++;
      console.log(`🔍 [Email Sender] [Attempt ${attemptNumber}] Final fallback: Fetching by original template_type: "${templateType}"`);
      
      const queryStart = Date.now();
      const result = await supabaseClient
        .from("email_templates")
        .select("*")
        .eq("template_type", templateType)
        .eq("is_active", true)
        .maybeSingle();
      
      const queryTime = Date.now() - queryStart;
      console.log(`⏱️  [Email Sender] [Attempt ${attemptNumber}] Query completed in ${queryTime}ms`);
      
      template = result.data;
      
      if (result.error) {
        console.log(`⚠️  [Email Sender] [Attempt ${attemptNumber}] Query error:`, result.error.message);
      }
      
      if (template) {
        discoveryMethod = `original_template_type:${templateType}`;
        console.log(`✅ [Email Sender] [Attempt ${attemptNumber}] SUCCESS - Template found via original template_type!`);
        console.log(`📄 [Email Sender] Template details: name="${template.name}", type="${template.template_type}", id="${template.id}"`);
      } else {
        console.log(`❌ [Email Sender] [Attempt ${attemptNumber}] No template found with template_type="${templateType}"`);
      }
    }

    // ============================================
    // TEMPLATE NOT FOUND - LOG COMPREHENSIVE ERROR
    // ============================================
    if (!template) {
      const searchTime = Date.now() - startTime;
      console.log(`❌❌❌ [Email Sender] TEMPLATE NOT FOUND ❌❌❌`);
      console.log(`❌ [Email Sender] Requested: "${templateType}"`);
      console.log(`❌ [Email Sender] Mapped to: "${mappedTemplateType || 'N/A'}"`);
      console.log(`❌ [Email Sender] Attempts made: ${attemptNumber}`);
      console.log(`❌ [Email Sender] Total search time: ${searchTime}ms`);
      console.log(`❌ [Email Sender] Last error:`, templateError);
      console.log(`📧 [Email Sender] ========================================`);
      
      return {
        success: false,
        error: `Template not found: ${templateType} (searched: mapped_type="${mappedTemplateType || 'none'}", name="${templateType}", original_type="${templateType}")`,
      };
    }

    const discoveryTime = Date.now() - startTime;
    console.log(`✅ [Email Sender] Template discovery completed in ${discoveryTime}ms via: ${discoveryMethod}`);

    // ============================================
    // VARIABLE REPLACEMENT & VALIDATION
    // ============================================
    console.log(`🔄 [Email Sender] Starting variable replacement...`);
    
    let populatedSubject = template.subject;
    let populatedBody = template.body;
    let replacedVariables = 0;
    let missingVariables: string[] = [];

    // Get template variables if defined
    const templateVariables = Array.isArray(template.variables) 
      ? template.variables 
      : (typeof template.variables === 'string' ? JSON.parse(template.variables) : []);

    console.log(`📋 [Email Sender] Template expects variables: [${templateVariables.join(', ')}]`);
    console.log(`📋 [Email Sender] Provided variables: [${Object.keys(variables).join(', ')}]`);

    // Check for missing required variables
    for (const requiredVar of templateVariables) {
      if (!(requiredVar in variables)) {
        missingVariables.push(requiredVar);
      }
    }

    if (missingVariables.length > 0) {
      console.log(`⚠️  [Email Sender] Missing variables: [${missingVariables.join(', ')}] - will use empty strings`);
    }

    // Replace variables in subject and body
    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`{{${key}}}`, "g");
      const stringValue = value?.toString() || "";
      
      const subjectMatches = (populatedSubject.match(regex) || []).length;
      const bodyMatches = (populatedBody.match(regex) || []).length;
      
      if (subjectMatches > 0 || bodyMatches > 0) {
        populatedSubject = populatedSubject.replace(regex, stringValue);
        populatedBody = populatedBody.replace(regex, stringValue);
        replacedVariables++;
        console.log(`✓ [Email Sender] Replaced {{${key}}} (${subjectMatches + bodyMatches} occurrence(s))`);
      }
    }

    console.log(`✅ [Email Sender] Variable replacement complete: ${replacedVariables} variables replaced`);

    // ============================================
    // SEND EMAIL VIA RESEND
    // ============================================
    console.log(`📤 [Email Sender] Sending email to: ${recipientEmail}`);
    console.log(`📤 [Email Sender] Subject: ${populatedSubject}`);
    
    const sendStart = Date.now();
    const emailResponse = await resend.emails.send({
      from: "FineEarn <noreply@mail.fineearn.com>",
      to: [recipientEmail],
      subject: populatedSubject,
      html: populatedBody,
    });
    const sendTime = Date.now() - sendStart;

    if (emailResponse.error) {
      console.log(`❌ [Email Sender] Resend API error (${sendTime}ms):`, emailResponse.error);
      throw new Error(emailResponse.error.message);
    }

    console.log(`✅ [Email Sender] Email sent successfully in ${sendTime}ms!`);
    console.log(`📬 [Email Sender] Resend Message ID: ${emailResponse.data?.id}`);

    // ============================================
    // LOG TO DATABASE
    // ============================================
    console.log(`💾 [Email Sender] Logging email to database...`);
    
    const logStart = Date.now();
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
          template_name: template.name,
          discovery_method: discoveryMethod,
          variables_used: Object.keys(variables),
          variables_replaced: replacedVariables,
          missing_variables: missingVariables,
          discovery_time_ms: discoveryTime,
          send_time_ms: sendTime,
          total_time_ms: Date.now() - startTime
        },
      })
      .select()
      .single();
    
    const logTime = Date.now() - logStart;

    if (logError) {
      console.warn(`⚠️  [Email Sender] Failed to log email (${logTime}ms):`, logError.message);
    } else {
      console.log(`✅ [Email Sender] Email logged successfully (${logTime}ms). Log ID: ${emailLog?.id}`);
    }

    const totalTime = Date.now() - startTime;
    console.log(`🎉 [Email Sender] Process complete in ${totalTime}ms!`);
    console.log(`📧 [Email Sender] ========================================`);

    return {
      success: true,
      messageId: emailResponse.data?.id,
      emailLogId: emailLog?.id,
    };
  } catch (error: any) {
    const totalTime = Date.now() - startTime;
    console.log(`❌❌❌ [Email Sender] SEND FAILED (${totalTime}ms) ❌❌❌`);
    console.error(`❌ [Email Sender] Error:`, error.message);
    console.error(`❌ [Email Sender] Stack:`, error.stack);
    console.log(`📧 [Email Sender] ========================================`);

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
