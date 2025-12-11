import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.74.0';
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};
Deno.serve(async (req)=>{
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: corsHeaders
    });
  }
  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
    // Verify authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({
        error: 'Missing authorization header'
      }), {
        status: 401,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (authError || !user) {
      return new Response(JSON.stringify({
        error: 'Unauthorized'
      }), {
        status: 401,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    const { userIds } = await req.json();
    if (!Array.isArray(userIds) || userIds.length === 0) {
      return new Response(JSON.stringify({
        error: 'userIds must be a non-empty array'
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    console.log(`📋 Fetching profiles for ${userIds.length} user IDs`);
    // Fetch user profiles in a single query
    const { data: profiles, error: profileError } = await supabase.from('profiles').select('id, username, email').in('id', userIds);
    if (profileError) {
      console.error('❌ Error fetching profiles:', profileError);
      return new Response(JSON.stringify({
        error: 'Failed to fetch user profiles'
      }), {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    console.log(`✅ Successfully fetched ${profiles?.length || 0} profiles`);
    // Create a map of user ID to profile for easy lookup
    const profileMap = {};
    profiles?.forEach((profile)=>{
      profileMap[profile.id] = {
        id: profile.id,
        username: profile.username || 'Unknown',
        email: profile.email || ''
      };
    });
    return new Response(JSON.stringify({
      profiles: profileMap
    }), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('❌ Unexpected error:', error);
    return new Response(JSON.stringify({
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
