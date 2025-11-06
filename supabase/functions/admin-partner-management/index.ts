import { createClient } from "https://esm.sh/@supabase/supabase-js@2.74.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface ApprovalRequest {
  application_id: string;
  action: 'approve' | 'reject';
  rejection_reason?: string;
  custom_commission_rate?: number;
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

    // Authenticate admin
    const {
      data: { user },
      error: authError,
    } = await supabaseClient.auth.getUser();

    if (authError || !user) {
      console.error("[Admin Partner] Authentication failed:", authError);
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Verify admin role
    const { data: adminRole } = await supabaseClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .single();

    if (!adminRole) {
      console.error("[Admin Partner] User is not an admin");
      return new Response(
        JSON.stringify({ error: "Admin access required" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log(`[Admin Partner] Request from admin: ${user.id}`);

    const body: ApprovalRequest = await req.json();

    if (!body.application_id || !body.action) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: application_id and action" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log("[Admin Partner] Processing application:", {
      application_id: body.application_id,
      action: body.action,
    });

    // Fetch application
    const { data: application, error: fetchError } = await supabaseClient
      .from("partner_applications")
      .select("*")
      .eq("id", body.application_id)
      .single();

    if (fetchError || !application) {
      console.error("[Admin Partner] Application not found:", fetchError);
      return new Response(
        JSON.stringify({ error: "Application not found" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (application.status !== "pending") {
      return new Response(
        JSON.stringify({
          error: "Application has already been processed",
          current_status: application.status,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Get applicant profile
    const { data: applicantProfile } = await supabaseClient
      .from("profiles")
      .select("username, email, full_name")
      .eq("id", application.user_id)
      .single();

    if (body.action === "approve") {
      console.log("[Admin Partner] Approving application...");

      // Step 1: Update application status
      const { error: updateAppError } = await supabaseClient
        .from("partner_applications")
        .update({
          status: "approved",
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", body.application_id);

      if (updateAppError) {
        console.error("[Admin Partner] Error updating application:", updateAppError);
        throw updateAppError;
      }

      // Step 2: Add 'partner' role to user
      const { error: roleError } = await supabaseClient
        .from("user_roles")
        .insert({
          user_id: application.user_id,
          role: "partner",
        });

      if (roleError && roleError.code !== "23505") { // Ignore duplicate key error
        console.error("[Admin Partner] Error adding role:", roleError);
        throw roleError;
      }

      // Step 3: Create partner config
      const commission_rate = body.custom_commission_rate || 0.10;
      
      const { error: configError } = await supabaseClient
        .from("partner_config")
        .insert({
          user_id: application.user_id,
          commission_rate,
          use_global_commission: !body.custom_commission_rate,
          payment_methods: [],
          current_rank: "bronze",
          is_active: true,
        });

      if (configError && configError.code !== "23505") { // Ignore duplicate key error
        console.error("[Admin Partner] Error creating config:", configError);
        throw configError;
      }

      // Step 4: Log activity
      const { error: activityError } = await supabaseClient
        .from("partner_activity_log")
        .insert({
          partner_id: application.user_id,
          activity_type: "application_approved",
          details: {
            approved_by: user.id,
            commission_rate,
            application_id: body.application_id,
          },
        });

      if (activityError) {
        console.error("[Admin Partner] Error logging activity:", activityError);
      }

      // Step 5: Create notification for applicant
      const { error: notificationError } = await supabaseClient
        .from("notifications")
        .insert({
          user_id: application.user_id,
          type: "partner_approval",
          title: "Partner Application Approved! 🎉",
          message: "Congratulations! Your partner application has been approved. You can now start selling vouchers and earning commissions.",
          priority: "high",
        });

      if (notificationError) {
        console.error("[Admin Partner] Error creating notification:", notificationError);
      }

      // Step 6: Send approval notification email
      try {
        await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/send-partner-notification`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': req.headers.get('Authorization') || '',
          },
          body: JSON.stringify({
            user_id: application.user_id,
            notification_type: 'application_approved',
            data: {
              username: applicantProfile?.username,
              commission_rate: commission_rate,
            },
          }),
        });
        console.log('[Admin Partner] Approval email sent successfully');
      } catch (emailError) {
        console.error('[Admin Partner] Failed to send approval email:', emailError);
        // Don't fail the approval if email fails
      }

      console.log("[Admin Partner] Application approved successfully");

      return new Response(
        JSON.stringify({
          success: true,
          message: "Partner application approved",
          partner: {
            user_id: application.user_id,
            username: applicantProfile?.username,
            email: applicantProfile?.email,
            commission_rate,
          },
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    } else if (body.action === "reject") {
      console.log("[Admin Partner] Rejecting application...");

      if (!body.rejection_reason) {
        return new Response(
          JSON.stringify({ error: "Rejection reason is required" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // Update application status
      const { error: updateAppError } = await supabaseClient
        .from("partner_applications")
        .update({
          status: "rejected",
          rejection_reason: body.rejection_reason,
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", body.application_id);

      if (updateAppError) {
        console.error("[Admin Partner] Error updating application:", updateAppError);
        throw updateAppError;
      }

      // Create notification for applicant
      const { error: notificationError } = await supabaseClient
        .from("notifications")
        .insert({
          user_id: application.user_id,
          type: "partner_rejection",
          title: "Partner Application Update",
          message: `Your partner application has been reviewed. Reason: ${body.rejection_reason}`,
          priority: "medium",
        });

      if (notificationError) {
        console.error("[Admin Partner] Error creating notification:", notificationError);
      }

      // Send rejection notification email
      try {
        await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/send-partner-notification`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': req.headers.get('Authorization') || '',
          },
          body: JSON.stringify({
            user_id: application.user_id,
            notification_type: 'application_rejected',
            data: {
              username: applicantProfile?.username,
              rejection_reason: body.rejection_reason,
            },
          }),
        });
        console.log('[Admin Partner] Rejection email sent successfully');
      } catch (emailError) {
        console.error('[Admin Partner] Failed to send rejection email:', emailError);
        // Don't fail the rejection if email fails
      }

      console.log("[Admin Partner] Application rejected");

      return new Response(
        JSON.stringify({
          success: true,
          message: "Partner application rejected",
          application_id: body.application_id,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid action" }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("[Admin Partner] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
