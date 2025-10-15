import { createClient } from "https://esm.sh/@supabase/supabase-js@2.74.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface NotificationRequest {
  userId: string;
  title: string;
  message: string;
  type: "plan" | "referral" | "wallet" | "task" | "system";
  priority?: "low" | "medium" | "high";
  metadata?: Record<string, any>;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const {
      userId,
      title,
      message,
      type,
      priority = "medium",
      metadata = {},
    }: NotificationRequest = await req.json();

    // Validate required fields
    if (!userId || !title || !message || !type) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Create notification
    const { data: notification, error } = await supabaseClient
      .from("notifications")
      .insert({
        user_id: userId,
        title,
        message,
        type,
        priority,
        metadata,
      })
      .select()
      .single();

    if (error) throw error;

    console.log("Notification created:", notification.id);

    return new Response(
      JSON.stringify({ success: true, notification }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error creating notification:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
