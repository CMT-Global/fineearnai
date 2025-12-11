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
    const supabaseClient = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
      global: {
        headers: {
          Authorization: req.headers.get("Authorization")
        }
      }
    });
    // Authenticate user
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      console.error("[Redeem Voucher] Authentication failed:", authError);
      return new Response(JSON.stringify({
        error: "Unauthorized"
      }), {
        status: 401,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    console.log(`[Redeem Voucher] Request from user: ${user.id}`);
    const body = await req.json();
    if (!body.voucher_code) {
      return new Response(JSON.stringify({
        error: "Voucher code is required"
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    const voucher_code = body.voucher_code.trim().toUpperCase();
    console.log(`[Redeem Voucher] Attempting to redeem: ${voucher_code}`);
    // Fetch voucher details
    const { data: voucher, error: voucherError } = await supabaseClient.from("vouchers").select("*").eq("voucher_code", voucher_code).single();
    if (voucherError || !voucher) {
      console.error("[Redeem Voucher] Voucher not found:", voucherError);
      return new Response(JSON.stringify({
        error: "Invalid voucher code"
      }), {
        status: 404,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    console.log("[Redeem Voucher] Voucher found:", {
      id: voucher.id,
      status: voucher.status,
      amount: voucher.voucher_amount,
      partner_id: voucher.partner_id
    });
    // Check if voucher is already redeemed
    if (voucher.status === "redeemed") {
      return new Response(JSON.stringify({
        error: "Voucher has already been redeemed",
        redeemed_at: voucher.redeemed_at
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    // Check if voucher is expired
    if (voucher.status === "expired" || new Date(voucher.expires_at) < new Date()) {
      return new Response(JSON.stringify({
        error: "Voucher has expired",
        expired_at: voucher.expires_at
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    // Check if voucher is cancelled
    if (voucher.status === "cancelled") {
      return new Response(JSON.stringify({
        error: "Voucher has been cancelled"
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    // Prevent partner from redeeming their own voucher
    if (voucher.partner_id === user.id) {
      return new Response(JSON.stringify({
        error: "You cannot redeem your own voucher"
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    // ATOMIC TRANSACTION: Credit user wallet, update voucher status, create transaction
    console.log("[Redeem Voucher] Starting atomic transaction...");
    // Step 1: Get user's current deposit wallet balance
    const { data: profile, error: profileError } = await supabaseClient.from("profiles").select("deposit_wallet_balance, username, email").eq("id", user.id).single();
    if (profileError) {
      console.error("[Redeem Voucher] Error fetching profile:", profileError);
      throw profileError;
    }
    const new_balance = profile.deposit_wallet_balance + voucher.voucher_amount;
    console.log("[Redeem Voucher] Balance calculation:", {
      current: profile.deposit_wallet_balance,
      voucher_amount: voucher.voucher_amount,
      new_balance
    });
    // Step 2: Update user's deposit wallet balance
    const { error: updateBalanceError } = await supabaseClient.from("profiles").update({
      deposit_wallet_balance: new_balance,
      last_activity: new Date().toISOString()
    }).eq("id", user.id);
    if (updateBalanceError) {
      console.error("[Redeem Voucher] Error updating balance:", updateBalanceError);
      throw updateBalanceError;
    }
    console.log(`[Redeem Voucher] Balance updated: ${profile.deposit_wallet_balance} -> ${new_balance}`);
    // Step 3: Get partner username for transaction description
    const { data: partnerProfile } = await supabaseClient.from("profiles").select("username").eq("id", voucher.partner_id).single();
    const partnerUsername = partnerProfile?.username || 'Partner';
    // Step 4: Create transaction record with descriptive text
    const { data: transaction, error: transactionError } = await supabaseClient.from("transactions").insert({
      user_id: user.id,
      type: "deposit",
      amount: voucher.voucher_amount,
      wallet_type: "deposit",
      new_balance: new_balance,
      status: "completed",
      description: `Top-up voucher from: ${partnerUsername}`,
      payment_gateway: "voucher",
      gateway_transaction_id: voucher_code,
      metadata: {
        voucher_id: voucher.id,
        voucher_code: voucher_code,
        partner_id: voucher.partner_id,
        partner_username: partnerUsername
      }
    }).select().single();
    if (transactionError) {
      console.error("[Redeem Voucher] Error creating transaction:", transactionError);
      throw transactionError;
    }
    console.log(`[Redeem Voucher] Transaction created: ${transaction.id}`);
    // Step 5: Update voucher status
    const { error: updateVoucherError } = await supabaseClient.from("vouchers").update({
      status: "redeemed",
      redeemed_by_user_id: user.id,
      redeemed_at: new Date().toISOString(),
      redemption_transaction_id: transaction.id
    }).eq("id", voucher.id);
    if (updateVoucherError) {
      console.error("[Redeem Voucher] Error updating voucher:", updateVoucherError);
      throw updateVoucherError;
    }
    console.log(`[Redeem Voucher] Voucher status updated to redeemed`);
    // Step 6: Check and upgrade partner rank after successful redemption
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? "";
      await fetch(`${supabaseUrl}/functions/v1/check-partner-rank`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': req.headers.get('Authorization') || ''
        },
        body: JSON.stringify({
          partner_id: voucher.partner_id
        })
      });
    } catch (rankError) {
      console.error('[Redeem Voucher] Error checking partner rank:', rankError);
    // Don't fail the redemption if rank check fails
    }
    // Step 7: Log partner activity
    const { error: activityError } = await supabaseClient.from("partner_activity_log").insert({
      partner_id: voucher.partner_id,
      activity_type: "voucher_redeemed",
      details: {
        voucher_code: voucher_code,
        redeemed_by: profile.username || profile.email,
        redeemed_by_user_id: user.id,
        voucher_amount: voucher.voucher_amount
      },
      voucher_id: voucher.id,
      transaction_id: transaction.id
    });
    if (activityError) {
      console.error("[Redeem Voucher] Error logging activity:", activityError);
    }
    console.log("[Redeem Voucher] Redemption complete!");
    // Step 8: Get partner config to calculate commission for notification
    const { data: partnerConfig } = await supabaseClient.from('partner_config').select('commission_rate').eq('user_id', voucher.partner_id).single();
    const commissionRate = partnerConfig?.commission_rate || voucher.commission_rate || 0.10;
    const commissionEarned = voucher.voucher_amount * commissionRate;
    // Step 9: Send redemption notification to partner
    try {
      await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/send-partner-notification`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': req.headers.get('Authorization') || ''
        },
        body: JSON.stringify({
          user_id: voucher.partner_id,
          notification_type: 'voucher_redeemed',
          data: {
            voucher_code: voucher_code,
            voucher_amount: voucher.voucher_amount,
            redeemer_username: profile.username || profile.email,
            commission_earned: commissionEarned
          }
        })
      });
    } catch (emailError) {
      console.error('[Redeem Voucher] Failed to send redemption notification:', emailError);
    // Don't fail the redemption if email fails
    }
    return new Response(JSON.stringify({
      success: true,
      message: "Voucher redeemed successfully",
      voucher: {
        code: voucher_code,
        amount: voucher.voucher_amount,
        redeemed_at: new Date().toISOString()
      },
      transaction: {
        id: transaction.id,
        new_balance,
        amount_credited: voucher.voucher_amount
      }
    }), {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });
  } catch (error) {
    console.error("[Redeem Voucher] Error:", error);
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
