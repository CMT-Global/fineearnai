import { createClient } from "https://esm.sh/@supabase/supabase-js@2.74.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface ApplicationSubmission {
  preferred_contact_method: 'whatsapp' | 'telegram' | 'both';
  whatsapp_number?: string;
  telegram_username?: string;
  whatsapp_group_link?: string;
  telegram_group_link?: string;
  application_notes?: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization")! },
        },
      }
    );

    // Authenticate user
    const {
      data: { user },
      error: authError,
    } = await supabaseClient.auth.getUser();

    if (authError || !user) {
      console.error("[Partner Application] Authentication failed:", authError);
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log(`[Partner Application] Request from user: ${user.id}`);

    // Handle GET request - Check application status
    if (req.method === "GET") {
      const { data: existingApplication, error: fetchError } = await supabaseClient
        .from("partner_applications")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (fetchError && fetchError.code !== "PGRST116") {
        console.error("[Partner Application] Error fetching application:", fetchError);
        throw fetchError;
      }

      // Check if user is already a partner
      const { data: partnerRole } = await supabaseClient
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "partner")
        .single();

      return new Response(
        JSON.stringify({
          success: true,
          application: existingApplication || null,
          is_partner: !!partnerRole,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Handle POST request - Submit application
    if (req.method === "POST") {
      const body: ApplicationSubmission = await req.json();

      console.log("[Partner Application] Submission data:", {
        user_id: user.id,
        preferred_contact_method: body.preferred_contact_method,
      });

      // Validate required fields
      if (!body.preferred_contact_method) {
        return new Response(
          JSON.stringify({ error: "Preferred contact method is required" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // Validate contact information based on preferred method
      if (body.preferred_contact_method === 'whatsapp' || body.preferred_contact_method === 'both') {
        if (!body.whatsapp_number) {
          return new Response(
            JSON.stringify({ error: "WhatsApp number is required" }),
            {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }
      }

      if (body.preferred_contact_method === 'telegram' || body.preferred_contact_method === 'both') {
        if (!body.telegram_username) {
          return new Response(
            JSON.stringify({ error: "Telegram username is required" }),
            {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }
      }

      // Check if user already has an application
      const { data: existingApplication } = await supabaseClient
        .from("partner_applications")
        .select("id, status")
        .eq("user_id", user.id)
        .single();

      if (existingApplication) {
        return new Response(
          JSON.stringify({
            error: "Application already exists",
            status: existingApplication.status,
          }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // Insert application
      const { data: application, error: insertError } = await supabaseClient
        .from("partner_applications")
        .insert({
          user_id: user.id,
          preferred_contact_method: body.preferred_contact_method,
          whatsapp_number: body.whatsapp_number,
          telegram_username: body.telegram_username,
          whatsapp_group_link: body.whatsapp_group_link,
          telegram_group_link: body.telegram_group_link,
          application_notes: body.application_notes,
          status: "pending",
        })
        .select()
        .single();

      if (insertError) {
        console.error("[Partner Application] Insert error:", insertError);
        throw insertError;
      }

      console.log(`[Partner Application] Application created: ${application.id}`);

      // Send notification to admins (optional - can be implemented later)
      // await supabaseClient.from("notifications").insert({
      //   user_id: admin_id,
      //   type: "partner_application",
      //   title: "New Partner Application",
      //   message: `User ${user.email} has applied to become a partner`,
      // });

      return new Response(
        JSON.stringify({
          success: true,
          application,
          message: "Application submitted successfully",
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("[Partner Application] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
