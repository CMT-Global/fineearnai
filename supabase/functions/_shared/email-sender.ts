// @ts-ignore - Deno edge function, Resend types available at runtime
import { Resend } from "https://esm.sh/resend@2.0.0";
import { wrapInProfessionalTemplate } from "./email-template-wrapper.ts";

// @ts-ignore - Deno global is available in Deno runtime
const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

// ============================================
// RESEND DOMAIN CONFIGURATION
// ============================================
// Default Resend domain - can be overridden via platform_config table
// To change: Update the 'email_from_address' or 'email_settings' key in platform_config table
// Or set RESEND_DOMAIN environment variable (e.g., "mail.yourdomain.com")
// @ts-expect-error - Deno global is available in Deno runtime
const DEFAULT_RESEND_DOMAIN = Deno.env.get('RESEND_DOMAIN') || 'profitchips.com';
const DEFAULT_FROM_ADDRESS = `noreply@${DEFAULT_RESEND_DOMAIN}`;

// ============================================
// EMAIL SETTINGS CACHE (60-second TTL)
// ============================================
let emailSettingsCache: any = null;
let cacheTimestamp: number = 0;
const CACHE_TTL = 60000; // 1 minute cache

/**
 * Get email settings from platform_config with caching
 * 
 * PHASE 3 IMPLEMENTATION:
 * - Fetches dynamic email settings from platform_config table
 * - Implements 60-second in-memory cache to reduce database queries
 * - Graceful fallback to hardcoded defaults if config not found
 * - Performance optimized for high-volume email sending
 * 
 * @param supabaseClient - Supabase client instance
 * @returns Email settings object
 */
async function getEmailSettings(supabaseClient: any) {
  const now = Date.now();
  
  // Return cached settings if fresh (within TTL)
  if (emailSettingsCache && (now - cacheTimestamp) < CACHE_TTL) {
    console.log(`⚡ [Email Settings] Using cached settings (age: ${now - cacheTimestamp}ms)`);
    return emailSettingsCache;
  }
  
  console.log(`🔄 [Email Settings] Cache miss or expired, fetching from database...`);
  
  // Fetch from database
  const { data, error } = await supabaseClient
    .from('platform_config')
    .select('value')
    .eq('key', 'email_settings')
    .maybeSingle();
  
  if (error || !data) {
    console.warn(`⚠️  [Email Settings] Failed to load from database, using hardcoded defaults`);
    if (error) {
      console.warn(`⚠️  [Email Settings] Error:`, error.message);
    }
    
    // Return hardcoded defaults as fallback
    const defaultDomain = DEFAULT_RESEND_DOMAIN.split('.').slice(-2).join('.'); // Extract base domain (e.g., "profitchips.com")
    return {
      from_address: DEFAULT_FROM_ADDRESS,
      from_name: 'ProfitChips',
      reply_to_address: `support@${defaultDomain}`,
      reply_to_name: 'ProfitChips Support',
      support_email: `support@${defaultDomain}`,
      platform_name: 'ProfitChips',
      platform_url: `https://${defaultDomain}`,
    };
  }
  
  // Cache and return
  emailSettingsCache = data.value;
  cacheTimestamp = now;
  console.log(`✅ [Email Settings] Settings loaded and cached successfully`);
  console.log(`📧 [Email Settings] From: ${emailSettingsCache.from_name} <${emailSettingsCache.from_address}>`);
  console.log(`📧 [Email Settings] Reply-To: ${emailSettingsCache.reply_to_name} <${emailSettingsCache.reply_to_address}>`);
  
  return emailSettingsCache;
}

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
  
  // Security emails
  'withdrawal_address_change': 'security',
  
  // Auth emails (handled by auth hook)
  'auth_magic_link': 'auth_magic_link',
  'auth_email_confirmation': 'auth_email_confirmation',
  'auth_password_reset': 'auth_password_reset',
  'auth_email_change': 'auth_email_change',
  'default_email_change': 'auth_email_change',
};

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  template_type: string;
  variables: string[] | string;
  is_active: boolean;
}

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

    let template: EmailTemplate | null = null;
    let templateError: any = null;
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
        console.log(`📄 [Email Sender] Template details: name="${(template as EmailTemplate).name}", type="${(template as EmailTemplate).template_type}", id="${(template as EmailTemplate).id}"`);
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
        console.log(`📄 [Email Sender] Template details: name="${(template as EmailTemplate).name}", type="${(template as EmailTemplate).template_type}", id="${(template as EmailTemplate).id}"`);
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
        console.log(`📄 [Email Sender] Template details: name="${(template as EmailTemplate).name}", type="${(template as EmailTemplate).template_type}", id="${(template as EmailTemplate).id}"`);
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
    
    // TypeScript guard: template is guaranteed to be non-null here due to early return above
    if (!template) {
      return {
        success: false,
        error: 'Template is null after discovery',
      };
    }
    
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
    // FETCH DYNAMIC EMAIL SETTINGS (PHASE 3)
    // ============================================
    console.log(`⚙️  [Email Sender] Fetching dynamic email settings...`);
    const settingsStart = Date.now();
    const emailSettings = await getEmailSettings(supabaseClient);
    const settingsTime = Date.now() - settingsStart;
    console.log(`✅ [Email Sender] Email settings loaded in ${settingsTime}ms`);

    // ============================================
    // APPLY PROFESSIONAL EMAIL WRAPPER (PHASE 2)
    // ============================================
    console.log(`🎨 [Email Sender] Checking if email needs professional wrapper...`);
    
    const needsWrapper = !populatedBody.trim().toLowerCase().startsWith('<!doctype html');
    
    if (needsWrapper) {
      console.log(`🎨 [Email Sender] Template is HTML fragment - applying professional wrapper`);
      const wrapperStart = Date.now();
      
      populatedBody = await wrapInProfessionalTemplate(populatedBody, {
        title: emailSettings.platform_name || 'ProfitChips',
        preheader: populatedSubject,
        headerGradient: true,
        includeFooter: true,
        platformName: emailSettings.platform_name || 'ProfitChips',
        platformUrl: emailSettings.platform_url || 'https://profitchips.com',
        supportUrl: `${emailSettings.platform_url || 'https://profitchips.com'}/support`,
        privacyUrl: `${emailSettings.platform_url || 'https://profitchips.com'}/privacy`,
        logoHtml: '', // Can be added later if logo URL is stored in config
      }, supabaseClient);
      
      const wrapperTime = Date.now() - wrapperStart;
      console.log(`✅ [Email Sender] Professional wrapper applied in ${wrapperTime}ms`);
    } else {
      console.log(`ℹ️  [Email Sender] Template already has full HTML structure - skipping wrapper`);
    }

    // ============================================
    // SEND EMAIL VIA RESEND
    // ============================================
    console.log(`📤 [Email Sender] Sending email to: ${recipientEmail}`);
    console.log(`📤 [Email Sender] Subject: ${populatedSubject}`);
    console.log(`📤 [Email Sender] From: ${emailSettings.from_name} <${emailSettings.from_address}>`);
    console.log(`📤 [Email Sender] Reply-To: ${emailSettings.reply_to_name} <${emailSettings.reply_to_address}>`);
    
    // Generate unique tracking ID for spam prevention and monitoring
    const trackingId = `${templateType}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    console.log(`🔖 [Email Sender] Tracking ID: ${trackingId}`);
    
    const sendStart = Date.now();
    const emailResponse = await resend.emails.send({
      from: `${emailSettings.from_name} <${emailSettings.from_address}>`,
      to: [recipientEmail],
      subject: populatedSubject,
      html: populatedBody,
      reply_to: `${emailSettings.reply_to_name} <${emailSettings.reply_to_address}>`,
      headers: {
        'X-Entity-Ref-ID': trackingId, // Unique tracking ID for deliverability
        'List-Unsubscribe': `<mailto:${emailSettings.reply_to_address}>`, // RFC 2369 List-Unsubscribe header
      },
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
          total_time_ms: Date.now() - startTime,
          tracking_id: trackingId, // Include tracking ID in metadata
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
