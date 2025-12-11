import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.74.0";
const supabaseUrl = Deno.env.get("SUPABASE_URL");
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};
// Simple in-memory cache with 5-minute TTL
const cache = {
  data: null,
  timestamp: 0
};
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes in milliseconds
const handler = async (req)=>{
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: corsHeaders
    });
  }
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    // Get user from JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({
        error: "Authentication required"
      }), {
        status: 401,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders
        }
      });
    }
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({
        error: "Invalid authentication"
      }), {
        status: 401,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders
        }
      });
    }
    // Verify admin role
    const { data: roleData, error: roleError } = await supabase.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
    if (roleError || !roleData) {
      return new Response(JSON.stringify({
        error: "Admin privileges required"
      }), {
        status: 403,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders
        }
      });
    }
    // Check cache
    const now = Date.now();
    if (cache.data && now - cache.timestamp < CACHE_TTL) {
      console.log("[COUNTRY-STATS] Returning cached data");
      return new Response(JSON.stringify({
        success: true,
        data: cache.data,
        cached: true,
        cache_age_seconds: Math.floor((now - cache.timestamp) / 1000)
      }), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders
        }
      });
    }
    console.log("[COUNTRY-STATS] Fetching fresh data from database");
    // Query database for country statistics
    const { data: countryStats, error: statsError } = await supabase.from("profiles").select("country").not("country", "is", null);
    if (statsError) {
      throw statsError;
    }
    // Aggregate counts by country
    const countryCounts = {};
    if (countryStats) {
      for (const profile of countryStats){
        const country = profile.country;
        if (country) {
          countryCounts[country] = (countryCounts[country] || 0) + 1;
        }
      }
    }
    // Convert to array and sort by count (descending)
    const sortedStats = Object.entries(countryCounts).map(([code, count])=>({
        code,
        count
      })).sort((a, b)=>b.count - a.count);
    // Update cache
    cache.data = sortedStats;
    cache.timestamp = now;
    console.log(`[COUNTRY-STATS] Found ${sortedStats.length} countries with users`);
    return new Response(JSON.stringify({
      success: true,
      data: sortedStats,
      cached: false,
      total_countries: sortedStats.length,
      total_users: Object.values(countryCounts).reduce((sum, count)=>sum + count, 0)
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders
      }
    });
  } catch (error) {
    console.error("[COUNTRY-STATS] Error:", error);
    return new Response(JSON.stringify({
      error: error.message
    }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders
      }
    });
  }
};
serve(handler);
