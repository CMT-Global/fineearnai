import { createClient } from "https://esm.sh/@supabase/supabase-js@2.74.0";
import { corsHeaders } from "../_shared/cors.ts";

interface UserTransfersConfig {
  enabled?: boolean;
  min_amount?: number;
  max_amount?: number;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { recipientInput } = await req.json();
    const input = (recipientInput as string)?.trim();
    if (!input) {
      return new Response(
        JSON.stringify({ error: "Recipient username or email is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: configRow } = await supabase
      .from("platform_config")
      .select("value")
      .eq("key", "user_transfers_config")
      .maybeSingle();
    const config = (configRow?.value as UserTransfersConfig) ?? {};
    if (config.enabled === false) {
      return new Response(
        JSON.stringify({
          error: "Transfers are currently unavailable. Please try again later.",
        }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const isEmail = input.includes("@");
    let query = supabase
      .from("profiles")
      .select("id, full_name, username, account_status")
      .neq("id", user.id);

    if (isEmail) {
      query = query.eq("email", input.toLowerCase());
    } else {
      query = query.eq("username", input);
    }

    const { data: profile, error } = await query.maybeSingle();
    if (error) {
      console.error("[lookup-transfer-recipient]", error);
      return new Response(JSON.stringify({ error: "Failed to lookup recipient" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!profile) {
      return new Response(
        JSON.stringify({ error: "Recipient not found. Check the username or email." }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const accountStatus = (profile as { account_status?: string }).account_status;
    if (accountStatus === "suspended" || accountStatus === "banned") {
      return new Response(
        JSON.stringify({ error: "This recipient account is not active." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        recipient: {
          id: profile.id,
          full_name: profile.full_name ?? "",
          username: profile.username ?? "",
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[lookup-transfer-recipient]", err);
    return new Response(
      JSON.stringify({ error: err?.message ?? "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
