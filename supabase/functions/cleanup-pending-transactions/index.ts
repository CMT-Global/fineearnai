import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.74.0';
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};
Deno.serve(async (req)=>{
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: corsHeaders
    });
  }
  try {
    console.log('🧹 Starting cleanup of old pending transactions...');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
    // Calculate cutoff time (24 hours ago)
    const cutoffTime = new Date();
    cutoffTime.setHours(cutoffTime.getHours() - 24);
    const cutoffTimeISO = cutoffTime.toISOString();
    console.log(`🔍 Looking for pending deposit transactions older than: ${cutoffTimeISO}`);
    // First, get count of transactions to be deleted
    const { count: pendingCount, error: countError } = await supabase.from('transactions').select('*', {
      count: 'exact',
      head: true
    }).eq('type', 'deposit').eq('status', 'pending').lt('created_at', cutoffTimeISO);
    if (countError) {
      console.error('❌ Error counting pending transactions:', countError);
      throw countError;
    }
    console.log(`📊 Found ${pendingCount || 0} pending deposit transactions to cleanup`);
    if (!pendingCount || pendingCount === 0) {
      console.log('✅ No pending transactions to cleanup');
      return new Response(JSON.stringify({
        success: true,
        message: 'No pending transactions to cleanup',
        deleted_count: 0,
        cutoff_time: cutoffTimeISO
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        },
        status: 200
      });
    }
    // Fetch the transactions to log details before deletion
    const { data: pendingTransactions, error: fetchError } = await supabase.from('transactions').select('id, user_id, amount, created_at, gateway_transaction_id').eq('type', 'deposit').eq('status', 'pending').lt('created_at', cutoffTimeISO);
    if (fetchError) {
      console.error('❌ Error fetching pending transactions:', fetchError);
      throw fetchError;
    }
    console.log(`📋 Transaction IDs to be deleted: ${pendingTransactions?.map((t)=>t.id).join(', ')}`);
    // Delete old pending deposit transactions
    const { data: deletedData, error: deleteError } = await supabase.from('transactions').delete().eq('type', 'deposit').eq('status', 'pending').lt('created_at', cutoffTimeISO).select();
    if (deleteError) {
      console.error('❌ Error deleting pending transactions:', deleteError);
      throw deleteError;
    }
    const deletedCount = deletedData?.length || 0;
    console.log(`✅ Successfully deleted ${deletedCount} pending deposit transactions`);
    // Log to audit_logs for tracking
    if (deletedCount > 0) {
      const { error: auditError } = await supabase.from('audit_logs').insert({
        action_type: 'system_cleanup',
        target_entity: 'transactions',
        details: {
          action: 'cleanup_pending_transactions',
          deleted_count: deletedCount,
          cutoff_time: cutoffTimeISO,
          transaction_ids: pendingTransactions?.map((t)=>t.id),
          total_amount: pendingTransactions?.reduce((sum, t)=>sum + t.amount, 0)
        },
        created_at: new Date().toISOString()
      });
      if (auditError) {
        console.warn('⚠️ Failed to create audit log:', auditError);
      } else {
        console.log('📝 Audit log created successfully');
      }
    }
    // Get statistics after cleanup
    const { count: remainingPending } = await supabase.from('transactions').select('*', {
      count: 'exact',
      head: true
    }).eq('type', 'deposit').eq('status', 'pending');
    console.log(`📊 Remaining pending deposits: ${remainingPending || 0}`);
    return new Response(JSON.stringify({
      success: true,
      message: `Successfully cleaned up ${deletedCount} old pending transactions`,
      deleted_count: deletedCount,
      remaining_pending: remainingPending || 0,
      cutoff_time: cutoffTimeISO,
      deleted_transaction_ids: pendingTransactions?.map((t)=>t.id)
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      status: 200
    });
  } catch (error) {
    console.error('❌ Cleanup failed:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    const errorStack = error instanceof Error ? error.stack : undefined;
    return new Response(JSON.stringify({
      success: false,
      error: errorMessage,
      stack: errorStack
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      status: 500
    });
  }
});
