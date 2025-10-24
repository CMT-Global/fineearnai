import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify admin authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check admin role
    const { data: roleData, error: roleError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .single();

    if (roleError || !roleData) {
      return new Response(
        JSON.stringify({ error: 'Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check for CPAY credentials existence (without exposing values)
    const hasPublicKey = !!Deno.env.get('CPAY_API_PUBLIC_KEY');
    const hasPrivateKey = !!Deno.env.get('CPAY_API_PRIVATE_KEY');
    const hasWalletId = !!Deno.env.get('CPAY_WALLET_ID');
    const hasPassphrase = !!Deno.env.get('CPAY_WALLET_PASSPHRASE');

    console.log('[CPAY-CONFIG-HEALTH] Credential check:', {
      hasPublicKey,
      hasPrivateKey,
      hasWalletId,
      hasPassphrase
    });

    return new Response(
      JSON.stringify({
        success: true,
        credentials: {
          hasPublicKey,
          hasPrivateKey,
          hasWalletId,
          hasPassphrase
        },
        allPresent: hasPublicKey && hasPrivateKey && hasWalletId && hasPassphrase,
        message: hasPublicKey && hasPrivateKey && hasWalletId && hasPassphrase
          ? '✅ All CPAY credentials are configured'
          : '⚠️ Some CPAY credentials are missing'
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[CPAY-CONFIG-HEALTH] Error:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
