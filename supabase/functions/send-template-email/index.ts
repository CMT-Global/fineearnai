import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.0";
import { Resend } from "https://esm.sh/resend@2.0.0";
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};
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
        console.log(`⚠️ Retry attempt ${attempt + 1}/${maxRetries} failed. Retrying in ${delay}ms...`);
        await new Promise((resolve)=>setTimeout(resolve, delay));
      }
    }
  }
  throw lastError;
}
// Replace variables in template
function replaceVariables(template, variables) {
  let result = template;
  for (const [key, value] of Object.entries(variables)){
    const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
    result = result.replace(regex, String(value));
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
  console.log(`📧 [${requestId}] send-template-email request received`);
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    if (!resendApiKey) {
      console.error(`❌ [${requestId}] RESEND_API_KEY not configured`);
      throw new Error('Email service not configured');
    }
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const resend = new Resend(resendApiKey);
    const { email, template_type, variables } = await req.json();
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
    console.log(`📧 [${requestId}] Processing email for: ${email}, template: ${template_type}`);
    // Step 1: Fetch email template from database
    const { data: template, error: templateError } = await supabase.from('email_templates').select('subject, body, is_active').eq('template_type', template_type).eq('is_active', true).maybeSingle();
    if (templateError) {
      console.error(`❌ [${requestId}] Error fetching template:`, templateError);
      throw new Error(`Failed to fetch email template: ${templateError.message}`);
    }
    if (!template) {
      console.error(`❌ [${requestId}] Template not found: ${template_type}`);
      throw new Error(`Email template '${template_type}' not found or inactive`);
    }
    console.log(`✅ [${requestId}] Template fetched: ${template_type}`);
    // Step 2: Fetch email settings from platform_config
    const { data: configData } = await supabase.from('platform_config').select('key, value').in('key', [
      'email_from_address',
      'email_from_name',
      'email_reply_to',
      'platform_name',
      'email_settings'
    ]);
    const emailSettings = {};
    if (configData) {
      configData.forEach((config)=>{
        if (config.key === 'email_from_address') emailSettings.from_address = config.value;
        if (config.key === 'email_from_name') emailSettings.from_name = config.value;
        if (config.key === 'email_reply_to') emailSettings.reply_to_address = config.value;
        if (config.key === 'platform_name') emailSettings.platform_name = config.value;
      });
      // Prefer consolidated JSON config if present
      const settingsConfig = configData.find((c)=>c.key === 'email_settings');
      if (settingsConfig && settingsConfig.value && typeof settingsConfig.value === 'object') {
        const s = settingsConfig.value;
        emailSettings.from_address = s.from_address ?? emailSettings.from_address;
        emailSettings.from_name = s.from_name ?? emailSettings.from_name;
        emailSettings.reply_to_address = s.reply_to ?? emailSettings.reply_to_address;
        emailSettings.platform_name = s.platform_name ?? emailSettings.platform_name;
      }
    }
    // Default fallbacks - using verified domain
    const baseFromAddress = emailSettings.from_address || 'noreply@mail.fineearn.com';
    const fromName = emailSettings.from_name || emailSettings.platform_name || 'FineEarn';
    const replyTo = emailSettings.reply_to_address || baseFromAddress;
    // Normalize to verified subdomain if a bare fineearn.com address slips through
    let fromAddress = baseFromAddress;
    if (fromAddress?.toLowerCase().endsWith('@fineearn.com') && !fromAddress.toLowerCase().includes('@mail.fineearn.com')) {
      console.warn(`⚠️ [${requestId}] Unverified sender domain detected (${fromAddress}). Normalizing to noreply@mail.fineearn.com`);
      fromAddress = 'noreply@mail.fineearn.com';
    }
    console.log(`📧 [${requestId}] Email config: from=${fromName} <${fromAddress}>, reply-to=${replyTo}`);
    // Step 3: Replace variables in subject and body
    const subject = replaceVariables(template.subject, variables);
    const body = replaceVariables(template.body, variables);
    console.log(`📝 [${requestId}] Variables replaced in template`);
    // Step 4: Send email via Resend with retry logic
    let emailResponse;
    // Generate unique tracking ID for spam prevention and monitoring
    const trackingId = `template-${template_type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    try {
      emailResponse = await retryWithBackoff(async ()=>{
        return await resend.emails.send({
          from: `${fromName} <${fromAddress}>`,
          to: [
            email
          ],
          subject: subject,
          html: body,
          text: htmlToPlainText(body),
          reply_to: replyTo,
          headers: {
            'X-Entity-Ref-ID': trackingId,
            'List-Unsubscribe': `<mailto:${replyTo}>`
          }
        });
      }, 3, 1000); // 3 retries with exponential backoff
      // Validate provider response
      if (!emailResponse?.data?.id) {
        const providerError = emailResponse?.error?.message || 'Missing message ID from Resend';
        throw new Error(providerError);
      }
      console.log(`✅ [${requestId}] Email sent successfully via Resend. id=${emailResponse.data.id}`);
    } catch (error) {
      console.error(`❌ [${requestId}] Failed to send email after retries:`, error);
      // Log failed attempt
      await supabase.from('email_logs').insert({
        email: email,
        template_type: template_type,
        subject: subject,
        status: 'failed',
        error_message: error.message,
        metadata: {
          request_id: requestId,
          variables: variables,
          retries_exhausted: true
        },
        sent_at: new Date().toISOString()
      });
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
        total_time_ms: totalTime
      },
      sent_at: new Date().toISOString()
    });
    console.log(`✅ [${requestId}] Email logged successfully. Total time: ${totalTime}ms`);
    return new Response(JSON.stringify({
      success: true,
      message: 'Email sent successfully',
      request_id: requestId,
      email_id: emailResponse.data?.id
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      status: 200
    });
  } catch (error) {
    const endTime = Date.now();
    const totalTime = endTime - startTime;
    console.error(`❌ [${requestId}] Error in send-template-email:`, error);
    console.error(`⏱️ [${requestId}] Failed after ${totalTime}ms`);
    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'Failed to send email',
      request_id: requestId
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      status: 500
    });
  }
});
