import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.74.0';
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};
/**
 * Invalidate User Cache Edge Function (Phase 2: No-Op)
 * 
 * Purpose: Legacy endpoint - now a no-op since Phase 2 removed all caching
 * Database is the single source of truth - no cache to invalidate
 * Kept for backward compatibility in case any code still calls this
 */ Deno.serve(async (req)=>{
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: corsHeaders
    });
  }
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    // Authenticate request (service role only)
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({
        error: 'unauthorized',
        message: 'No authorization header provided'
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        },
        status: 401
      });
    }
    const token = authHeader.replace('Bearer ', '');
    // Verify it's a service role request
    if (token !== supabaseServiceKey) {
      return new Response(JSON.stringify({
        error: 'forbidden',
        message: 'This endpoint requires service role access'
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        },
        status: 403
      });
    }
    // Get userId from request body
    const { userId } = await req.json();
    if (!userId) {
      return new Response(JSON.stringify({
        error: 'validation_error',
        message: 'userId is required'
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        },
        status: 400
      });
    }
    // Phase 2: No-op - no cache to invalidate
    // Database is the single source of truth
    console.log(`ℹ️ Cache invalidation no-op for user: ${userId} (caching removed in Phase 2)`);
    return new Response(JSON.stringify({
      success: true,
      userId,
      cacheInvalidated: false,
      message: 'No-op: Caching removed in Phase 2. Database is single source of truth.',
      timestamp: new Date().toISOString()
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      status: 200
    });
  } catch (error) {
    console.error('❌ Error in invalidate-user-cache:', error);
    return new Response(JSON.stringify({
      error: 'internal_error',
      message: error.message || 'An unexpected error occurred'
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      status: 500
    });
  }
});
