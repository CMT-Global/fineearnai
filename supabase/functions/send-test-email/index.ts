import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TestEmailRequest {
  template_id: string;
  test_email: string;
  sample_data?: Record<string, string>;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // PHASE 1: Extract and validate authorization header
    const authHeader = req.headers.get('Authorization');
    console.log('[PHASE 1] Authorization header present:', !!authHeader);
    
    if (!authHeader) {
      console.error('[PHASE 1] ERROR: No Authorization header provided');
      return new Response(
        JSON.stringify({ error: 'Unauthorized: No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // PHASE 1: Extract JWT token from "Bearer <token>" format
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    console.log('[PHASE 1] Token extracted, length:', token.length);
    
    if (!token) {
      console.error('[PHASE 1] ERROR: Token extraction failed');
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Invalid token format' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client with user's JWT
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    // PHASE 1: Verify authentication by passing token explicitly to getUser()
    console.log('[PHASE 1] Calling auth.getUser() with explicit token...');
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);
    
    console.log('[PHASE 1] Auth result - User ID:', user?.id, 'Error:', userError?.message);
    
    if (userError || !user) {
      console.error('[PHASE 1] ERROR: Authentication failed:', userError);
      return new Response(
        JSON.stringify({ 
          error: 'Unauthorized', 
          details: userError?.message || 'User not authenticated' 
        }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // PHASE 1: Authentication successful
    console.log('[PHASE 1] ✅ User authenticated successfully - ID:', user.id, 'Email:', user.email);

    // Check if user is admin using service role for reliable RLS bypass
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const { data: roles, error: roleError } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle();
    
    console.log('Role check - Has admin role:', !!roles, 'Error:', roleError?.message);

    if (roleError || !roles) {
      console.error('Admin check failed:', roleError);
      return new Response(
        JSON.stringify({ 
          error: 'Forbidden: Admin access required',
          details: roleError?.message || 'User is not an admin'
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { template_id, test_email, sample_data }: TestEmailRequest = await req.json();

    // Validate inputs
    if (!template_id || !test_email) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: template_id and test_email' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(test_email)) {
      return new Response(
        JSON.stringify({ error: 'Invalid email address format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch template
    const { data: template, error: templateError } = await supabaseClient
      .from('email_templates')
      .select('*')
      .eq('id', template_id)
      .single();

    if (templateError || !template) {
      return new Response(
        JSON.stringify({ error: 'Template not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate sample data for variables
    const defaultSampleData: Record<string, string> = {
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
      total_earnings: '$500.00',
    };

    // Merge with custom sample data if provided
    const finalSampleData = { ...defaultSampleData, ...sample_data };

    // Replace variables in subject and body
    let personalizedSubject = template.subject;
    let personalizedBody = template.body;

    Object.entries(finalSampleData).forEach(([key, value]) => {
      const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
      personalizedSubject = personalizedSubject.replace(regex, value);
      personalizedBody = personalizedBody.replace(regex, value);
    });

    // Check if RESEND_API_KEY is configured
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    if (!RESEND_API_KEY) {
      return new Response(
        JSON.stringify({ 
          error: 'RESEND_API_KEY not configured. Please add it to your secrets.',
          details: 'The Resend API key is required to send emails.'
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Send email via Resend
    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'FineEarn <noreply@yourdomain.com>',
        to: [test_email],
        subject: `[TEST] ${personalizedSubject}`,
        html: personalizedBody,
      }),
    });

    const resendData = await resendResponse.json();

    if (!resendResponse.ok) {
      console.error('Resend API error:', resendData);
      return new Response(
        JSON.stringify({ 
          error: 'Failed to send test email via Resend',
          details: resendData.message || 'Unknown error from Resend API'
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Log test email to email_logs
    await supabaseClient.from('email_logs').insert({
      recipient_email: test_email,
      subject: personalizedSubject,
      body: personalizedBody,
      status: 'sent',
      sent_at: new Date().toISOString(),
      metadata: {
        is_test: true,
        template_id: template_id,
        template_name: template.name,
        template_type: template.template_type,
        resend_id: resendData.id,
        sent_by_admin: user.id,
        sample_data_used: finalSampleData,
        variables_replaced: Object.keys(finalSampleData),
      },
    });

    console.log(`Test email sent successfully to ${test_email} using template ${template.name}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Test email sent to ${test_email}`,
        resend_id: resendData.id,
        template_name: template.name,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in send-test-email function:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        details: error.message 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
