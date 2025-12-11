import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.74.0';
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-correlation-id'
};
// Simple in-memory rate limiter (resets on function cold start)
const rateLimitMap = new Map();
const RATE_LIMIT_MAX = 10; // Max 10 logs per minute per user
const RATE_LIMIT_WINDOW = 60000; // 1 minute in milliseconds
function checkRateLimit(userId) {
  const now = Date.now();
  const userLimit = rateLimitMap.get(userId);
  if (!userLimit || now > userLimit.resetAt) {
    // Reset or initialize
    rateLimitMap.set(userId, {
      count: 1,
      resetAt: now + RATE_LIMIT_WINDOW
    });
    return {
      allowed: true,
      remaining: RATE_LIMIT_MAX - 1
    };
  }
  if (userLimit.count >= RATE_LIMIT_MAX) {
    return {
      allowed: false,
      remaining: 0
    };
  }
  userLimit.count++;
  return {
    allowed: true,
    remaining: RATE_LIMIT_MAX - userLimit.count
  };
}
Deno.serve(async (req)=>{
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: corsHeaders
    });
  }
  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY');
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Unauthorized'
      }), {
        status: 401,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: {
        headers: {
          Authorization: authHeader
        }
      }
    });
    // Authenticate user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Unauthorized'
      }), {
        status: 401,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    // Check rate limit
    const { allowed, remaining } = checkRateLimit(user.id);
    if (!allowed) {
      console.warn('🚨 [log-partner-debug] Rate limit exceeded for user:', user.id);
      return new Response(JSON.stringify({
        success: false,
        error: 'Rate limit exceeded. Please try again later.',
        rate_limit: {
          remaining: 0
        }
      }), {
        status: 429,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    // Parse request body
    const { level, event, data, correlationId } = await req.json();
    // Validate required fields
    if (!level || !event || !correlationId) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Missing required fields: level, event, correlationId'
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    // Validate level
    const validLevels = [
      'debug',
      'info',
      'warn',
      'error'
    ];
    if (!validLevels.includes(level)) {
      return new Response(JSON.stringify({
        success: false,
        error: `Invalid level. Must be one of: ${validLevels.join(', ')}`
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    // Get client IP and User-Agent
    const ip_address = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
    const user_agent = req.headers.get('user-agent') || 'unknown';
    // Insert debug log
    const { error: insertError } = await supabase.from('partner_debug_logs').insert({
      user_id: user.id,
      correlation_id: correlationId,
      level,
      event,
      data: data || {},
      ip_address,
      user_agent
    });
    if (insertError) {
      console.error('🚨 [log-partner-debug] Insert error:', insertError);
      return new Response(JSON.stringify({
        success: false,
        error: 'Failed to insert debug log'
      }), {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    console.log(`✅ [log-partner-debug] Log inserted: user=${user.id}, event=${event}, correlationId=${correlationId}`);
    return new Response(JSON.stringify({
      success: true,
      rate_limit: {
        remaining
      }
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('🚨 [log-partner-debug] Exception:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Internal server error'
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
});
