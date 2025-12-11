import { createClient } from "https://esm.sh/@supabase/supabase-js@2.74.0";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};
Deno.serve(async (req)=>{
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: corsHeaders
    });
  }
  try {
    const supabaseClient = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
    console.log("Starting materialized view refresh...");
    const startTime = Date.now();
    // Refresh materialized views
    const { error } = await supabaseClient.rpc("refresh_materialized_views");
    if (error) throw error;
    const executionTime = Date.now() - startTime;
    console.log(`Materialized views refreshed in ${executionTime}ms`);
    return new Response(JSON.stringify({
      success: true,
      executionTime,
      message: "Materialized views refreshed successfully"
    }), {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });
  } catch (error) {
    console.error("Error refreshing materialized views:", error);
    return new Response(JSON.stringify({
      error: error.message
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });
  }
});
