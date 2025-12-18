// @ts-ignore - Deno edge function, std library available at runtime
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
// @ts-ignore - Deno edge function, Supabase types available at runtime
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.0";
// @ts-ignore - Deno edge function, Resend types available at runtime
import { Resend } from "https://esm.sh/resend@2.0.0";
import { getSystemSecrets } from "../_shared/secrets.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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
}

interface EmailSettings {
  from_address?: string;
  from_name?: string;
  reply_to_address?: string;
  platform_name?: string;
}

// Retry logic with exponential backoff
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
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

// Replace variables in template
function replaceVariables(template: string, variables: Record<string, any>): string {
  let result = template;
  
  for (const [key, value] of Object.entries(variables)) {
    const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
    result = result.replace(regex, String(value));
  }
  
  return result;
}

// Convert HTML to plain text for email compatibility
function htmlToPlainText(html: string): string {
  return html
    .replace(/<style[^>]*>.*?<\/style>/gis, '') // Remove style tags
    .replace(/<script[^>]*>.*?<\/script>/gis, '') // Remove script tags
    .replace(/<[^>]+>/g, '') // Remove all HTML tags
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const requestId = crypto.randomUUID();
  const startTime = Date.now();
  
  // Use console.error for initial log to ensure visibility in terminal
  console.error(`📧 [${requestId}] ========================================`);
  console.error(`📧 [${requestId}] send-template-email request received`);
  console.error(`📧 [${requestId}] Method: ${req.method}`);
  console.error(`📧 [${requestId}] URL: ${req.url}`);

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

    // Log API key status (without exposing the key)
    console.error(`🔑 [${requestId}] Resend API key configured: ${resendApiKey.substring(0, 7)}...${resendApiKey.substring(resendApiKey.length - 4)}`);

    const resend = new Resend(resendApiKey);
    
    console.error(`✅ [${requestId}] Resend client initialized`);

    const { email, template_type, variables }: SendTemplateEmailRequest = await req.json();

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
    console.error(`🔍 [${requestId}] Looking up template with template_type: "${template_type}"`);
    const { data: template, error: templateError } = await supabase
      .from('email_templates')
      .select('subject, body, is_active, name, id')
      .eq('template_type', template_type)
      .eq('is_active', true)
      .maybeSingle();

    if (templateError) {
      console.error(`❌ [${requestId}] Error fetching template:`, templateError);
      console.error(`❌ [${requestId}] Template error details:`, JSON.stringify(templateError, null, 2));
      throw new Error(`Failed to fetch email template: ${templateError.message}`);
    }

    if (!template) {
      console.error(`❌ [${requestId}] Template not found: ${template_type}`);
      console.error(`❌ [${requestId}] Checking if template exists but is inactive...`);
      
      // Check if template exists but is inactive
      const { data: inactiveTemplate } = await supabase
        .from('email_templates')
        .select('id, name, is_active')
        .eq('template_type', template_type)
        .maybeSingle();
      
      if (inactiveTemplate) {
        console.error(`❌ [${requestId}] Template exists but is_active=${inactiveTemplate.is_active}`);
        throw new Error(`Email template '${template_type}' exists but is inactive. Please activate it in the admin panel.`);
      } else {
        throw new Error(`Email template '${template_type}' not found. Please create it in the admin panel.`);
      }
    }

    console.error(`✅ [${requestId}] Template fetched: ${template_type} (ID: ${template.id}, Name: ${template.name})`);

    // Step 2: Fetch email settings from platform_config
    const { data: configData } = await supabase
      .from('platform_config')
      .select('key, value')
      .in('key', ['email_from_address', 'email_from_name', 'email_reply_to', 'platform_name', 'email_settings']);

    const emailSettings: EmailSettings = {};
    if (configData) {
      configData.forEach((config: any) => {
        if (config.key === 'email_from_address') emailSettings.from_address = config.value as string;
        if (config.key === 'email_from_name') emailSettings.from_name = config.value as string;
        if (config.key === 'email_reply_to') emailSettings.reply_to_address = config.value as string;
        if (config.key === 'platform_name') emailSettings.platform_name = config.value as string;
      });

      // Prefer consolidated JSON config if present
      const settingsConfig = (configData as any[]).find((c: any) => c.key === 'email_settings');
      if (settingsConfig && settingsConfig.value && typeof settingsConfig.value === 'object') {
        const s = settingsConfig.value as Record<string, any>;
        emailSettings.from_address = s.from_address ?? emailSettings.from_address;
        emailSettings.from_name = s.from_name ?? emailSettings.from_name;
        emailSettings.reply_to_address = s.reply_to ?? emailSettings.reply_to_address;
        emailSettings.platform_name = s.platform_name ?? emailSettings.platform_name;
      }
    }
    // Default fallbacks - using verified domain
    const baseFromAddress = emailSettings.from_address || DEFAULT_FROM_ADDRESS;
    const fromName = emailSettings.from_name || emailSettings.platform_name || 'ProfitChips';
    const replyTo = emailSettings.reply_to_address || baseFromAddress;

    // Normalize to configured domain if an unverified domain address slips through
    let fromAddress = baseFromAddress;
    const domainFromAddress = fromAddress.split('@')[1]?.toLowerCase();
    const defaultDomain = DEFAULT_RESEND_DOMAIN.toLowerCase();
    
    if (domainFromAddress && domainFromAddress !== defaultDomain && !domainFromAddress.includes(defaultDomain)) {
      console.warn(`⚠️ [${requestId}] Domain mismatch detected (${fromAddress}). Normalizing to ${DEFAULT_FROM_ADDRESS}`);
      fromAddress = DEFAULT_FROM_ADDRESS;
    }

    // Validate from address format
    if (!fromAddress || !fromAddress.includes('@')) {
      console.error(`❌ [${requestId}] Invalid from address format: ${fromAddress}`);
      throw new Error(`Invalid email from address: ${fromAddress}. Must be in format 'name@domain.com'`);
    }

    const fromDomain = fromAddress.split('@')[1];
    console.error(`📧 [${requestId}] Email config: from=${fromName} <${fromAddress}>, reply-to=${replyTo}`);
    console.error(`📧 [${requestId}] Domain: ${fromDomain} (must be verified in Resend)`);

    // Step 3: Replace variables in subject and body
    const subject = replaceVariables(template.subject, variables);
    const body = replaceVariables(template.body, variables);

    console.error(`📝 [${requestId}] Variables replaced in template`);

    // Step 4: Send email via Resend with retry logic
    let emailResponse;
    
    // Generate unique tracking ID for spam prevention and monitoring
    const trackingId = `template-${template_type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    console.error(`📤 [${requestId}] Attempting to send email via Resend...`);
    console.error(`📤 [${requestId}] From: ${fromName} <${fromAddress}>`);
    console.error(`📤 [${requestId}] To: ${email}`);
    console.error(`📤 [${requestId}] Subject: ${subject}`);
    
    try {
      emailResponse = await retryWithBackoff(async () => {
        console.error(`🔄 [${requestId}] Calling Resend API...`);
        const response = await resend.emails.send({
          from: `${fromName} <${fromAddress}>`,
          to: [email],
          subject: subject,
          html: body,
          text: htmlToPlainText(body), // Plain-text version for spam prevention
          reply_to: replyTo,
          headers: {
            'X-Entity-Ref-ID': trackingId, // Unique tracking ID
            'List-Unsubscribe': `<mailto:${replyTo}>`, // RFC 2369 List-Unsubscribe header
          },
        });
        console.error(`📥 [${requestId}] Resend API response received:`, JSON.stringify(response, null, 2));
        return response;
      }, 3, 1000); // 3 retries with exponential backoff

      // Validate provider response - check for errors first
      if (emailResponse.error) {
        const providerError = emailResponse.error.message || 'Resend API returned an error';
        const errorCode = emailResponse.error.name || '';
        console.error(`❌ [${requestId}] Resend API error:`, JSON.stringify(emailResponse.error, null, 2));
        
        // Detect domain verification errors and provide helpful guidance
        if (providerError.includes('domain') && (providerError.includes('not verified') || providerError.includes('verified'))) {
          console.error(`❌ [${requestId}] ========================================`);
          console.error(`❌ [${requestId}] DOMAIN VERIFICATION ERROR DETECTED`);
          console.error(`❌ [${requestId}] Attempted to send from: ${fromAddress}`);
          console.error(`❌ [${requestId}] The domain in this address is not verified in Resend.`);
          console.error(`❌ [${requestId}] To fix this:`);
          console.error(`❌ [${requestId}] 1. Go to Resend Dashboard → Domains`);
          console.error(`❌ [${requestId}] 2. Add and verify the domain: ${fromAddress.split('@')[1]}`);
          console.error(`❌ [${requestId}] 3. Configure DNS records (SPF, DKIM, DMARC)`);
          console.error(`❌ [${requestId}] 4. Wait for verification (can take up to 48 hours)`);
          console.error(`❌ [${requestId}] 5. Ensure your Resend API key has access to this domain`);
          console.error(`❌ [${requestId}] ========================================`);
          
          throw new Error(
            `Domain verification required: The domain '${fromAddress.split('@')[1]}' is not verified in Resend. ` +
            `Please verify this domain in your Resend dashboard or use a verified domain. ` +
            `Current from address: ${fromAddress}`
          );
        }
        
        throw new Error(providerError);
      }

      // Check for missing message ID
      if (!emailResponse?.data?.id) {
        console.error(`❌ [${requestId}] Missing message ID from Resend response`);
        console.error(`❌ [${requestId}] Full response:`, JSON.stringify(emailResponse, null, 2));
        throw new Error('Missing message ID from Resend - email may not have been sent');
      }

      console.error(`✅ [${requestId}] Email sent successfully via Resend. id=${emailResponse.data.id}`);
    } catch (error: any) {
      console.error(`❌ [${requestId}] Failed to send email after retries`);
      console.error(`❌ [${requestId}] Error message:`, error.message);
      console.error(`❌ [${requestId}] Error stack:`, error.stack);
      console.error(`❌ [${requestId}] Full error:`, JSON.stringify(error, Object.getOwnPropertyNames(error)));
      
      // Log failed attempt
      try {
        await supabase.from('email_logs').insert({
          email: email,
          template_type: template_type,
          subject: subject,
          status: 'failed',
          error_message: error.message || 'Unknown error',
          metadata: {
            request_id: requestId,
            variables: variables,
            retries_exhausted: true,
            error_details: error.toString(),
            error_stack: error.stack,
          },
          sent_at: new Date().toISOString(),
        });
        console.error(`💾 [${requestId}] Failed email attempt logged to database`);
      } catch (logError) {
        console.error(`❌ [${requestId}] Failed to log error to database:`, logError);
      }

      throw error;
    }

    // Step 5: Log successful send to email_logs
    const endTime = Date.now();
    const totalTime = endTime - startTime;

    await supabase.from('email_logs').insert({
      email: email,
      template_type: template_type,
      subject: subject,
      status: 'sent',
      provider_response: emailResponse,
      metadata: {
        request_id: requestId,
        variables: variables,
        resend_id: emailResponse.data?.id,
        total_time_ms: totalTime,
      },
      sent_at: new Date().toISOString(),
    });

    console.error(`✅ [${requestId}] Email logged successfully. Total time: ${totalTime}ms`);
    console.error(`📧 [${requestId}] ========================================`);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Email sent successfully',
        request_id: requestId,
        email_id: emailResponse.data?.id,
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
        status: 200 
      }
    );

  } catch (error: any) {
    const endTime = Date.now();
    const totalTime = endTime - startTime;
    
    console.error(`❌ [${requestId}] ========================================`);
    console.error(`❌ [${requestId}] ERROR in send-template-email`);
    console.error(`❌ [${requestId}] Error message:`, error.message);
    console.error(`❌ [${requestId}] Error stack:`, error.stack);
    console.error(`⏱️ [${requestId}] Failed after ${totalTime}ms`);
    console.error(`❌ [${requestId}] ========================================`);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Failed to send email',
        request_id: requestId,
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
        status: 500 
      }
    );
  }
});
