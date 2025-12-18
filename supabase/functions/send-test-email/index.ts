import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { wrapInProfessionalTemplate } from "../_shared/email-template-wrapper.ts";
import { getSystemSecrets } from "../_shared/secrets.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};
serve(async (req)=>{
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: corsHeaders
    });
  }
  try {
    // PHASE 1: Extract and validate authorization header
    const authHeader = req.headers.get('Authorization');
    console.log('[PHASE 1] Authorization header present:', !!authHeader);
    if (!authHeader) {
      console.error('[PHASE 1] ERROR: No Authorization header provided');
      return new Response(JSON.stringify({
        error: 'Unauthorized: No authorization header'
      }), {
        status: 401,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    // PHASE 1: Extract JWT token from "Bearer <token>" format
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    console.log('[PHASE 1] Token extracted, length:', token.length);
    if (!token) {
      console.error('[PHASE 1] ERROR: Token extraction failed');
      return new Response(JSON.stringify({
        error: 'Unauthorized: Invalid token format'
      }), {
        status: 401,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    // Create Supabase client with user's JWT
    const supabaseClient = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
      global: {
        headers: {
          Authorization: authHeader
        }
      }
    });
    // PHASE 1: Verify authentication by passing token explicitly to getUser()
    console.log('[PHASE 1] Calling auth.getUser() with explicit token...');
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);
    console.log('[PHASE 1] Auth result - User ID:', user?.id, 'Error:', userError?.message);
    if (userError || !user) {
      console.error('[PHASE 1] ERROR: Authentication failed:', userError);
      return new Response(JSON.stringify({
        error: 'Unauthorized',
        details: userError?.message || 'User not authenticated'
      }), {
        status: 401,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    // PHASE 1: Authentication successful
    console.log('[PHASE 1] ✅ User authenticated successfully - ID:', user.id, 'Email:', user.email);
    // Check if user is admin using service role for reliable RLS bypass
    const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
    const { data: roles, error: roleError } = await supabaseAdmin.from('user_roles').select('role').eq('user_id', user.id).eq('role', 'admin').maybeSingle();
    console.log('Role check - Has admin role:', !!roles, 'Error:', roleError?.message);
    if (roleError || !roles) {
      console.error('Admin check failed:', roleError);
      return new Response(JSON.stringify({
        error: 'Forbidden: Admin access required',
        details: roleError?.message || 'User is not an admin'
      }), {
        status: 403,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    const { template_id, test_email, sample_data } = await req.json();
    // Validate test_email is provided
    if (!test_email) {
      return new Response(JSON.stringify({
        error: 'Missing required field: test_email'
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(test_email)) {
      return new Response(JSON.stringify({
        error: 'Invalid email address format'
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    // PHASE 4: Fetch dynamic email settings from platform_config
    console.log(`⚙️  [Test Email] Fetching dynamic email settings...`);
    const { data: configData } = await supabaseClient.from('platform_config').select('value').eq('key', 'email_settings').maybeSingle();
    const emailSettings = configData?.value || {
      from_address: 'noreply@profitchips.com',
      from_name: 'ProfitChips',
      reply_to_address: 'support@profitchips.com',
      reply_to_name: 'ProfitChips Support',
      platform_name: 'ProfitChips',
      platform_url: 'https://profitchips.com',
    };
    console.log(`✅ [Test Email] Using settings - From: ${emailSettings.from_name} <${emailSettings.from_address}>`);
    console.log(`✅ [Test Email] Reply-To: ${emailSettings.reply_to_name} <${emailSettings.reply_to_address}>`);
    let personalizedSubject;
    let personalizedBody;
    let templateName = 'Generic Test Email';
    // Check if template_id is provided - if not, send generic test email
    if (!template_id) {
      console.log('[Test Email] No template_id provided - sending generic test email');
      // Generic test email without template
      personalizedSubject = `Test Email from ${emailSettings.platform_name}`;
      personalizedBody = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #333; border-bottom: 2px solid #0066ff; padding-bottom: 10px;">
            Test Email
          </h1>
          <p style="color: #666; line-height: 1.6;">
            This is a test email sent from <strong>${emailSettings.platform_name}</strong> email settings to verify your email configuration.
          </p>
          <div style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #333;">Email Configuration:</h3>
            <p style="margin: 5px 0;"><strong>From:</strong> ${emailSettings.from_name} &lt;${emailSettings.from_address}&gt;</p>
            <p style="margin: 5px 0;"><strong>Reply-To:</strong> ${emailSettings.reply_to_name} &lt;${emailSettings.reply_to_address}&gt;</p>
            <p style="margin: 5px 0;"><strong>Platform:</strong> ${emailSettings.platform_name}</p>
            <p style="margin: 5px 0;"><strong>URL:</strong> <a href="${emailSettings.platform_url}">${emailSettings.platform_url}</a></p>
          </div>
          <p style="color: #999; font-size: 12px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd;">
            ${emailSettings.footer_text || 'This is an automated test email.'}
          </p>
        </div>
      `;
      console.log('[Test Email] Generic test email prepared');
    } else {
      // Template-based test email (existing functionality)
      console.log('[Test Email] Template ID provided - fetching template:', template_id);
      const { data: template, error: templateError } = await supabaseClient.from('email_templates').select('*').eq('id', template_id).single();
      if (templateError || !template) {
        return new Response(JSON.stringify({
          error: 'Template not found'
        }), {
          status: 404,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        });
      }
      templateName = template.name;
      // Generate sample data for variables
      const defaultSampleData = {
        username: 'TestUser',
        email: test_email,
        full_name: 'Test User',
        reset_link: 'https://example.com/reset?token=sample_token_123',
        confirmation_link: 'https://example.com/confirm?token=sample_token_123',
        magic_link: 'https://example.com/login?token=sample_token_123',
        token_hash: 'sample_token_hash_123456789',
        redirect_to: 'https://example.com/dashboard',
        old_email: 'old.test@example.com',
        new_email: test_email,
        plan_name: 'Premium Plan',
        expiry_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        milestone: '100 tasks completed',
        total_earnings: '$500.00'
      };
      // Merge with custom sample data if provided
      const finalSampleData = {
        ...defaultSampleData,
        ...sample_data
      };
      // Replace variables in subject and body
      personalizedSubject = template.subject;
      personalizedBody = template.body;
      Object.entries(finalSampleData).forEach(([key, value])=>{
        const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
        personalizedSubject = personalizedSubject.replace(regex, value);
        personalizedBody = personalizedBody.replace(regex, value);
      });
      console.log('[Test Email] Template-based email prepared:', template.name);
    }
    // PHASE 2.5: Apply professional email wrapper (matching production behavior)
    console.log('[Test Email] Checking if email needs professional wrapper...');
    const needsWrapper = !personalizedBody.trim().toLowerCase().startsWith('<!doctype html');
    if (needsWrapper) {
      console.log('[Test Email] Template is HTML fragment - applying professional wrapper');
      const wrapperStart = Date.now();
      
      personalizedBody = await wrapInProfessionalTemplate(personalizedBody, {
        title: emailSettings.platform_name || 'ProfitChips',
        preheader: personalizedSubject,
        headerGradient: true,
        includeFooter: true,
        platformName: emailSettings.platform_name || 'ProfitChips',
        platformUrl: emailSettings.platform_url || 'https://profitchips.com',
        supportUrl: `${emailSettings.platform_url || 'https://profitchips.com'}/support`,
        privacyUrl: `${emailSettings.platform_url || 'https://profitchips.com'}/privacy`,
        logoHtml: '',
      }, supabaseClient);
      
      const wrapperTime = Date.now() - wrapperStart;
      console.log(`[Test Email] ✅ Professional wrapper applied in ${wrapperTime}ms`);
    } else {
      console.log('[Test Email] ℹ️ Template already has full HTML structure - skipping wrapper');
    }

    const { resendApiKey: RESEND_API_KEY } = await getSystemSecrets(supabaseAdmin);
    console.log('[PHASE 2] Resend API Key configured:', !!RESEND_API_KEY);
    if (!RESEND_API_KEY) {
      console.error('[PHASE 2] ERROR: RESEND_API_KEY not configured');
      return new Response(JSON.stringify({
        error: 'RESEND_API_KEY not configured. Please add it to your secrets.',
        details: 'The Resend API key is required to send emails.'
      }), {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    // PHASE 2: Prepare email payload with dynamic settings
    const emailPayload = {
      from: `${emailSettings.from_name} <${emailSettings.from_address}>`,
      to: [
        test_email
      ],
      subject: `[TEST] ${personalizedSubject}`,
      html: personalizedBody,
      reply_to: `${emailSettings.reply_to_name} <${emailSettings.reply_to_address}>`
    };
    console.log('[PHASE 2] Sending email via Resend API...');
    console.log('[PHASE 2] Email payload:', {
      from: emailPayload.from,
      to: emailPayload.to,
      subject: emailPayload.subject,
      body_length: personalizedBody.length,
      wrapper_applied: needsWrapper
    });
    // PHASE 2: Send email via Resend with comprehensive error tracking
    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(emailPayload)
    });
    console.log('[PHASE 2] Resend API response status:', resendResponse.status, resendResponse.statusText);
    const resendData = await resendResponse.json();
    console.log('[PHASE 2] Resend API response data:', resendData);
    if (!resendResponse.ok) {
      console.error('[PHASE 2] ERROR: Resend API request failed');
      console.error('[PHASE 2] Error details:', resendData);
      return new Response(JSON.stringify({
        error: 'Failed to send test email via Resend',
        details: resendData.message || resendData.error || 'Unknown error from Resend API',
        resend_error: resendData
      }), {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    console.log('[PHASE 2] ✅ Email sent successfully via Resend - ID:', resendData.id);
    // Log test email to email_logs
    console.log('[PHASE 2] Logging email to database...');
    await supabaseClient.from('email_logs').insert({
      recipient_email: test_email,
      subject: personalizedSubject,
      body: personalizedBody,
      status: 'sent',
      sent_at: new Date().toISOString(),
      metadata: {
        is_test: true,
        template_id: template_id || null,
        template_name: templateName,
        resend_id: resendData.id,
        sent_by_admin: user.id,
        email_type: template_id ? 'template_based' : 'generic'
      }
    });
    console.log('[PHASE 2] ✅ Email logged to database successfully');
    console.log(`[PHASE 2] ✅✅ COMPLETE: Test email sent successfully to ${test_email} using ${templateName}`);
    return new Response(JSON.stringify({
      success: true,
      message: `Test email sent to ${test_email}`,
      resend_id: resendData.id,
      template_name: templateName,
      email_type: template_id ? 'template_based' : 'generic'
    }), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('Error in send-test-email function:', error);
    return new Response(JSON.stringify({
      error: 'Internal server error',
      details: error.message
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
});
