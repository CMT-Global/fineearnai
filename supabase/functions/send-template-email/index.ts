// @ts-ignore - Deno edge function, std library available at runtime
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
// @ts-ignore - Deno edge function, Supabase types available at runtime
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.0";
// @ts-ignore - Deno edge function, Resend types available at runtime
import { Resend } from "https://esm.sh/resend@2.0.0";
import { getSystemSecrets } from "../_shared/secrets.ts";
import { wrapInProfessionalTemplate } from "../_shared/email-template-wrapper.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

// ============================================
// RESEND DOMAIN CONFIGURATION
// ============================================
// Default Resend domain - can be overridden via platform_config table
// To change: Update the 'email_from_address' or 'email_settings' key in platform_config table
// Or set RESEND_DOMAIN environment variable (e.g., "mail.yourdomain.com")
// @ts-ignore - Deno global is available in Deno runtime
const DEFAULT_RESEND_DOMAIN = Deno.env.get('RESEND_DOMAIN') || 'profitchips.com';
const DEFAULT_FROM_ADDRESS = `noreply@${DEFAULT_RESEND_DOMAIN}`;

interface SendTemplateEmailRequest {
  email: string;
  template_type: string;
  variables: Record<string, any>;
  use_wrapper?: boolean; // Optional: Force usage of professional wrapper
}

interface EmailSettings {
  from_address?: string;
  from_name?: string;
  reply_to_address?: string;
  platform_name?: string;
  platform_url?: string;
}

// Retry logic with exponential backoff
async function retryWithBackoff(fn, maxRetries = 3, baseDelay = 1000) {
  let lastError = null;
  for(let attempt = 0; attempt < maxRetries; attempt++){
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt < maxRetries - 1) {
        const delay = baseDelay * Math.pow(2, attempt); // Exponential backoff: 1s, 2s, 4s
        console.error(`⚠️ Retry attempt ${attempt + 1}/${maxRetries} failed. Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  throw lastError;
}

// Replace variables in template - improved with more robust regex and case-insensitivity
function replaceVariables(template, variables) {
  let result = template;
  for (const [key, value] of Object.entries(variables)){
    // Handle both snake_case and camelCase by being slightly more flexible, 
    // and handle spaces around variable names
    const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'gi');
    result = result.replace(regex, String(value ?? ''));
  }
  return result;
}

// Convert HTML to plain text for email compatibility
function htmlToPlainText(html) {
  return html.replace(/<style[^>]*>.*?<\/style>/gis, '') // Remove style tags
  .replace(/<script[^>]*>.*?<\/script>/gis, '') // Remove script tags
  .replace(/<[^>]+>/g, '') // Remove all HTML tags
  .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/\s+/g, ' ') // Normalize whitespace
  .trim();
}

serve(async (req)=>{
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: corsHeaders
    });
  }
  const requestId = crypto.randomUUID();
  const startTime = Date.now();
  
  // Use console.error for initial log to ensure visibility in terminal
  console.error(`📧 [${requestId}] ========================================`);
  console.error(`📧 [${requestId}] send-template-email request received`);

  try {
    // @ts-ignore - Deno.env is available at runtime
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    // @ts-ignore - Deno.env is available at runtime
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { resendApiKey } = await getSystemSecrets(supabase);

    if (!resendApiKey) {
      console.error(`❌ [${requestId}] RESEND_API_KEY not configured`);
      throw new Error('Email service not configured');
    }

    const resend = new Resend(resendApiKey);
    
    const body: SendTemplateEmailRequest = await req.json();
    const { email, template_type, variables, use_wrapper = true } = body;

    // Validate email address
    if (!email || typeof email !== 'string' || !email.includes('@')) {
      console.error(`❌ [${requestId}] Invalid email address: ${email}`);
      throw new Error('Valid email address is required');
    }
    // Validate template_type
    if (!template_type || typeof template_type !== 'string' || template_type.trim().length === 0) {
      console.error(`❌ [${requestId}] Invalid template_type: ${template_type}`);
      throw new Error('Valid template_type is required');
    }

    console.error(`📧 [${requestId}] Processing email for: ${email}, template: ${template_type}`);

    // Step 1: Fetch email template from database
    const { data: template, error: templateError } = await supabase
      .from('email_templates')
      .select('subject, body, is_active, name, id')
      .eq('template_type', template_type)
      .eq('is_active', true)
      .maybeSingle();

    if (templateError) {
      console.error(`❌ [${requestId}] Error fetching template:`, templateError);
      throw new Error(`Failed to fetch email template: ${templateError.message}`);
    }
    
    if (!template) {
      console.error(`❌ [${requestId}] Active template not found: ${template_type}`);
      throw new Error(`Email template '${template_type}' not found or inactive.`);
    }

    // Step 2: Fetch email settings and branding from platform_config
    const { data: configData } = await supabase.from('platform_config').select('key, value').in('key', [
      'email_settings',
      'platform_branding'
    ]);
    
    const emailSettings: EmailSettings = configData?.find(c => c.key === 'email_settings')?.value || {};
    const platformBranding = configData?.find(c => c.key === 'platform_branding')?.value || {};

    const platformName = platformBranding.name || emailSettings.platform_name || 'ProfitChips';
    const platformUrl = platformBranding.url || emailSettings.platform_url || 'https://profitchips.com';
    const baseFromAddress = emailSettings.from_address || DEFAULT_FROM_ADDRESS;
    const fromName = emailSettings.from_name || platformName;
    const replyTo = emailSettings.reply_to_address || baseFromAddress;

    // Normalize from address
    let fromAddress = baseFromAddress;
    const domainFromAddress = fromAddress.split('@')[1]?.toLowerCase();
    if (domainFromAddress && !domainFromAddress.includes(DEFAULT_RESEND_DOMAIN.toLowerCase())) {
      fromAddress = DEFAULT_FROM_ADDRESS;
    }

    // Step 3: Replace variables in subject and body
    // Inject common variables if not present
    const enhancedVariables = {
      platform_name: platformName,
      platform_url: platformUrl,
      support_email: emailSettings.support_email || `support@${DEFAULT_RESEND_DOMAIN}`,
      ...variables
    };

    let subject = replaceVariables(template.subject, enhancedVariables);
    let htmlBody = replaceVariables(template.body, enhancedVariables);

    // Replace branding placeholder if present
    subject = subject.replace(/FineEarn/g, platformName);
    htmlBody = htmlBody.replace(/FineEarn/g, platformName);

    // Apply professional wrapper if requested and not already a full HTML document
    if (use_wrapper && !htmlBody.trim().toLowerCase().startsWith('<!doctype html')) {
      console.error(`🎨 [${requestId}] Applying professional wrapper to template content`);
      htmlBody = await wrapInProfessionalTemplate(htmlBody, {
        title: platformName,
        preheader: subject,
        platformName,
        platformUrl,
        supportUrl: `${platformUrl}/support`,
        privacyUrl: `${platformUrl}/privacy`,
      }, supabase);
    }

    // Step 4: Send email via Resend with retry logic
    const trackingId = `template-${template_type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const emailResponse = await retryWithBackoff(async () => {
      return await resend.emails.send({
        from: `${fromName} <${fromAddress}>`,
        to: [email],
        subject: subject,
        html: htmlBody,
        text: htmlToPlainText(htmlBody),
        reply_to: replyTo,
        headers: {
          'X-Entity-Ref-ID': trackingId,
          'List-Unsubscribe': `<mailto:${replyTo}>`
        }
      });
    }, 3, 1000);

    if (emailResponse.error) {
      throw new Error(emailResponse.error.message || 'Resend API returned an error');
    }

    // Step 5: Log to email_logs (include recipient_user_id when present for dedup e.g. plan_expiry_reminder)
    const recipientUserId = enhancedVariables.recipient_user_id ?? null;
    await supabase.from('email_logs').insert({
      recipient_email: email,
      ...(recipientUserId && { recipient_user_id: recipientUserId }),
      subject: subject,
      body: htmlBody,
      status: 'sent',
      template_id: template.id,
      metadata: {
        request_id: requestId,
        template_type,
        variables: enhancedVariables,
        resend_id: emailResponse.data?.id
      },
      sent_at: new Date().toISOString()
    });

    return new Response(JSON.stringify({
      success: true,
      message: 'Email sent successfully',
      request_id: requestId,
      email_id: emailResponse.data?.id,
    }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
      status: 200 
    });

  } catch (error: any) {
    console.error(`❌ [${requestId}] ERROR:`, error.message);
    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'Failed to send email',
      request_id: requestId,
    }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
      status: 500 
    });
  }
});
