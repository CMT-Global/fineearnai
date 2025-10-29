import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.74.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CommissionJob {
  id: string;
  referrer_id: string;
  referred_user_id: string;
  event_type: string;
  amount: number;
  commission_rate: number;
  retry_count: number;
  metadata: any;
}

interface ProcessResult {
  id: string;
  success: boolean;
  error?: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    const startTime = Date.now();
    console.log('Starting commission queue processing...');

    // Fetch batch of pending commissions (100 at a time)
    const { data: batch, error: fetchError } = await supabase
      .from('commission_queue')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(100);

    if (fetchError) {
      console.error('Error fetching commission queue:', fetchError);
      throw fetchError;
    }

    if (!batch || batch.length === 0) {
      console.log('No pending commissions to process');
      return new Response(
        JSON.stringify({ 
          processed: 0, 
          message: 'No pending commissions' 
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      );
    }

    console.log(`Processing ${batch.length} commission jobs`);

    // Process in parallel (10 at a time to avoid overwhelming DB)
    const results: ProcessResult[] = [];
    for (let i = 0; i < batch.length; i += 10) {
      const chunk = batch.slice(i, i + 10);
      const chunkResults = await Promise.all(
        chunk.map(job => processCommission(supabase, job))
      );
      results.push(...chunkResults);
    }

    const successCount = results.filter(r => r.success).length;
    const errorCount = results.filter(r => !r.success).length;
    const processingTime = Date.now() - startTime;

    const metrics = {
      queue_size: batch.length,
      processing_time_ms: processingTime,
      success_count: successCount,
      error_count: errorCount,
      processed_at: new Date().toISOString()
    };

    console.log('Commission batch processed:', metrics);

    return new Response(
      JSON.stringify({ 
        processed: successCount,
        failed: errorCount,
        metrics 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Fatal error in commission processor:', error);
    return new Response(
      JSON.stringify({ 
        error: (error as Error).message || 'Unknown error',
        details: 'Failed to process commission queue'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});

async function processCommission(
  supabase: any,
  job: CommissionJob
): Promise<ProcessResult> {
  const jobId = job.id;
  
  try {
    console.log(`Processing commission job ${jobId}`, {
      event_type: job.event_type,
      amount: job.amount,
      rate: job.commission_rate
    });

    // Mark as processing
    await supabase
      .from('commission_queue')
      .update({ status: 'processing' })
      .eq('id', jobId);

    // Calculate commission amount with 4-decimal precision for accurate small commissions
    const commissionAmount = Number((job.amount * job.commission_rate).toFixed(4));

    // Use database function for atomic commission processing
    const { data: result, error: processError } = await supabase
      .rpc('process_commission_atomic', {
        p_referrer_id: job.referrer_id,
        p_commission_amount: commissionAmount,
        p_referred_user_id: job.referred_user_id,
        p_event_type: job.event_type,
        p_base_amount: job.amount,
        p_commission_rate: job.commission_rate, // Already stored as decimal (0.07), not percentage
        p_metadata: job.metadata
      });

    if (processError) {
      throw processError;
    }

    if (!result || !result.success) {
      throw new Error(result?.error || 'Commission processing failed');
    }

    // Mark as completed
    await supabase
      .from('commission_queue')
      .update({ 
        status: 'completed', 
        processed_at: new Date().toISOString() 
      })
      .eq('id', jobId);

    console.log(`Commission job ${jobId} completed successfully`, {
      commission_amount: commissionAmount,
      new_balance: result.new_balance
    });

    return { id: jobId, success: true };

  } catch (error) {
    console.error(`Error processing commission job ${jobId}:`, error);

    // Determine if we should retry or mark as failed
    const shouldRetry = job.retry_count < 3;
    const newStatus = shouldRetry ? 'pending' : 'failed';
    const newRetryCount = job.retry_count + 1;

    await supabase
      .from('commission_queue')
      .update({ 
        status: newStatus,
        retry_count: newRetryCount,
        error_message: (error as Error).message || 'Unknown error'
      })
      .eq('id', jobId);

    console.log(`Commission job ${jobId} ${shouldRetry ? 'queued for retry' : 'marked as failed'}`, {
      retry_count: newRetryCount,
      error: (error as Error).message || 'Unknown error'
    });

    return { 
      id: jobId, 
      success: false, 
      error: (error as Error).message || 'Unknown error'
    };
  }
}
