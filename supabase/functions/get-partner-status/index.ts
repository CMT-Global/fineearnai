import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.74.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-correlation-id',
};

interface StructuredLog {
  event: string;
  correlationId: string | null;
  userId: string | null;
  timingMs?: number;
  application?: { id: string; status: string } | null;
  isPartner?: boolean;
  error?: string;
}

function log(data: StructuredLog) {
  console.log(JSON.stringify(data));
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  const correlationId = req.headers.get('x-correlation-id') || null;

  log({
    event: 'get-partner-status.start',
    correlationId,
    userId: null,
    timingMs: 0,
  });

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const authHeader = req.headers.get('Authorization');

    if (!authHeader) {
      log({
        event: 'get-partner-status.error',
        correlationId,
        userId: null,
        timingMs: Date.now() - startTime,
        error: 'Missing authorization header',
      });
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Authenticate user
    const authStartTime = Date.now();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error('❌ Auth error details:', {
        hasError: !!authError,
        errorMessage: authError?.message,
        errorDetails: authError,
        hasUser: !!user,
        authHeader: authHeader?.substring(0, 20) + '...'
      });
      
      log({
        event: 'get-partner-status.auth-failed',
        correlationId,
        userId: null,
        timingMs: Date.now() - startTime,
        error: authError?.message || 'Authentication failed',
      });
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Unauthorized',
          debug: authError?.message 
        }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const authDuration = Date.now() - authStartTime;
    log({
      event: 'get-partner-status.authenticated',
      correlationId,
      userId: user.id,
      timingMs: authDuration,
    });

    // Check if user has partner role in user_roles table
    const roleCheckStartTime = Date.now();
    const { data: roleData, error: roleError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'partner')
      .maybeSingle();

    if (roleError) {
      log({
        event: 'get-partner-status.role-check-error',
        correlationId,
        userId: user.id,
        timingMs: Date.now() - startTime,
        error: roleError.message,
      });
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to check partner role' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const isPartner = !!roleData;
    const roleCheckDuration = Date.now() - roleCheckStartTime;

    log({
      event: 'get-partner-status.role-checked',
      correlationId,
      userId: user.id,
      timingMs: roleCheckDuration,
      isPartner,
    });

    // Get partner application if exists
    const appCheckStartTime = Date.now();
    const { data: application, error: appError } = await supabase
      .from('partner_applications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (appError) {
      log({
        event: 'get-partner-status.application-error',
        correlationId,
        userId: user.id,
        timingMs: Date.now() - startTime,
        error: appError.message,
      });
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to fetch application' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const appCheckDuration = Date.now() - appCheckStartTime;
    const totalDuration = Date.now() - startTime;

    const applicationSummary = application
      ? { id: application.id, status: application.status }
      : null;

    log({
      event: 'get-partner-status.result',
      correlationId,
      userId: user.id,
      timingMs: totalDuration,
      application: applicationSummary,
      isPartner,
    });

    return new Response(
      JSON.stringify({
        success: true,
        is_partner: isPartner,
        application: application || null,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    const totalDuration = Date.now() - startTime;
    log({
      event: 'get-partner-status.exception',
      correlationId,
      userId: null,
      timingMs: totalDuration,
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    return new Response(
      JSON.stringify({ success: false, error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
