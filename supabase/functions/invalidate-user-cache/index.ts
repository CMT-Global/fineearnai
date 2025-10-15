import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.74.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Shared cache reference (same as get-next-task)
const statsCache = new Map<string, { data: any; expiresAt: number }>();

/**
 * Invalidate User Cache Edge Function
 * 
 * Purpose: Invalidate the user stats cache after task completion or profile updates
 * Called by: complete-ai-task, upgrade-plan, adjust-wallet-balance edge functions
 */
Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Authenticate request (service role only)
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ 
          error: 'unauthorized',
          message: 'No authorization header provided' 
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 401,
        }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    
    // Verify it's a service role request
    if (token !== supabaseServiceKey) {
      return new Response(
        JSON.stringify({ 
          error: 'forbidden',
          message: 'This endpoint requires service role access' 
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 403,
        }
      );
    }

    // Get userId from request body
    const { userId } = await req.json();

    if (!userId) {
      return new Response(
        JSON.stringify({ 
          error: 'validation_error',
          message: 'userId is required' 
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      );
    }

    // Invalidate cache
    const cacheKey = `stats_${userId}`;
    const hadCache = statsCache.has(cacheKey);
    statsCache.delete(cacheKey);

    console.log(`🗑️ Cache invalidated for user: ${userId} (cache existed: ${hadCache})`);

    return new Response(
      JSON.stringify({
        success: true,
        userId,
        cacheInvalidated: hadCache,
        timestamp: new Date().toISOString()
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error: any) {
    console.error('❌ Error in invalidate-user-cache:', error);
    return new Response(
      JSON.stringify({ 
        error: 'internal_error',
        message: error.message || 'An unexpected error occurred'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
