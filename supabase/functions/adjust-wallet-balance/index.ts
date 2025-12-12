import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
Deno.serve(async (req)=>{
  if (req.method === 'OPTIONS') {
    return new Response('okk', {
      headers: corsHeaders
    });
  }
  try {
    const supabaseClient = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
    const authHeader = req.headers.get('Authorization');
    const token = authHeader.replace('Bearer ', '');
    const { data: { user: adminUser } } = await supabaseClient.auth.getUser(token);
    if (!adminUser) {
      throw new Error('Unauthorized');
    }
    // Check admin role
    const { data: adminRole } = await supabaseClient.from('user_roles').select('role').eq('user_id', adminUser.id).eq('role', 'admin').maybeSingle();
    if (!adminRole) {
      throw new Error('Admin access required');
    }
    const { userId, walletType, amount, reason, actionType } = await req.json();
    if (!userId || !walletType || !amount || !reason || !actionType) {
      throw new Error('Missing required fields');
    }
    if (amount <= 0) {
      throw new Error('Amount must be positive');
    }
    // Get current profile
    const { data: profile, error: profileError } = await supabaseClient.from('profiles').select('deposit_wallet_balance, earnings_wallet_balance').eq('id', userId).single();
    if (profileError) throw profileError;
    const currentBalance = walletType === 'deposit' ? profile.deposit_wallet_balance : profile.earnings_wallet_balance;
    let newBalance;
    let transactionType;
    if (actionType === 'credit') {
      newBalance = parseFloat(currentBalance) + amount;
      transactionType = 'adjustment';
    } else if (actionType === 'debit') {
      if (parseFloat(currentBalance) < amount) {
        throw new Error('Insufficient balance');
      }
      newBalance = parseFloat(currentBalance) - amount;
      transactionType = 'transfer';
    } else {
      throw new Error('Invalid action type');
    }
    // Create transaction record FIRST (before balance update) so balance validation trigger passes
    const { error: transactionError } = await supabaseClient.from('transactions').insert({
      user_id: userId,
      type: transactionType,
      wallet_type: walletType,
      amount: amount,
      new_balance: newBalance,
      status: 'completed',
      description: `Admin ${actionType}: ${reason}`,
      metadata: {
        admin_id: adminUser.id,
        reason: reason,
        action_type: actionType
      }
    });
    if (transactionError) throw transactionError;
    // Update wallet balance AFTER transaction insert
    const updateField = walletType === 'deposit' ? 'deposit_wallet_balance' : 'earnings_wallet_balance';
    const { error: updateError } = await supabaseClient.from('profiles').update({
      [updateField]: newBalance,
      last_activity: new Date().toISOString()
    }).eq('id', userId);
    if (updateError) throw updateError;
    // Phase 2: Database as single source of truth - realtime subscriptions handle UI updates
    console.log('✅ Adjustment completed, realtime subscriptions will update UI automatically');
    // Create audit log
    await supabaseClient.from('audit_logs').insert({
      admin_id: adminUser.id,
      action_type: 'wallet_adjustment',
      target_user_id: userId,
      details: {
        wallet_type: walletType,
        action_type: actionType,
        amount: amount,
        reason: reason,
        old_balance: currentBalance,
        new_balance: newBalance
      }
    });
    return new Response(JSON.stringify({
      success: true,
      newBalance: newBalance
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      error: error.message
    }), {
      status: 400,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
});
