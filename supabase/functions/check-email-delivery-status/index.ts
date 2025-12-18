import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.74.0";
import { getSystemSecrets } from "../_shared/secrets.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface DeliveryStatusRequest {
  emailLogId: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { resendApiKey } = await getSystemSecrets(supabase);

    // Verify admin authentication
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        {
          status: 401,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        {
          status: 401,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleData) {
      return new Response(
        JSON.stringify({ error: "Admin access required" }),
        {
          status: 403,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    const { emailLogId }: DeliveryStatusRequest = await req.json();

    if (!emailLogId) {
      return new Response(
        JSON.stringify({ error: "Email log ID required" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Get email log from database
    const { data: emailLog, error: logError } = await supabase
      .from("email_logs")
      .select("metadata")
      .eq("id", emailLogId)
      .single();

    if (logError || !emailLog) {
      return new Response(
        JSON.stringify({ error: "Email log not found" }),
        {
          status: 404,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    const resendId = emailLog.metadata?.resend_id;

    if (!resendId) {
      return new Response(
        JSON.stringify({ 
          error: "No Resend ID found",
          message: "This email was not sent via Resend or the ID was not logged"
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Check delivery status from Resend API
    console.log(`[DELIVERY STATUS] Checking email: ${resendId}`);
    
    const resendResponse = await fetch(
      `https://api.resend.com/emails/${resendId}`,
      {
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
        },
      }
    );

    if (!resendResponse.ok) {
      const errorText = await resendResponse.text();
      console.error("[DELIVERY STATUS] Resend API error:", errorText);
      return new Response(
        JSON.stringify({ 
          error: "Failed to fetch delivery status",
          details: errorText
        }),
        {
          status: resendResponse.status,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    const deliveryData = await resendResponse.json();
    
    console.log("[DELIVERY STATUS] Response:", deliveryData);

    // Update email log with delivery information
    const updatedMetadata = {
      ...emailLog.metadata,
      delivery_status: {
        last_event: deliveryData.last_event,
        status: deliveryData.status,
        created_at: deliveryData.created_at,
        from: deliveryData.from,
        to: deliveryData.to,
        subject: deliveryData.subject,
        checked_at: new Date().toISOString(),
      }
    };

    const { error: updateError } = await supabase
      .from("email_logs")
      .update({ metadata: updatedMetadata })
      .eq("id", emailLogId);

    if (updateError) {
      console.error("[DELIVERY STATUS] Update error:", updateError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        delivery_status: deliveryData,
        updated: !updateError
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    );
  } catch (error: any) {
    console.error("[DELIVERY STATUS] Error:", error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        details: "Failed to check delivery status"
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);