import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // Create admin client with service role key
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

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
      console.error('[INIT-STORAGE] Authentication failed:', authError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user is admin
    const { data: roles } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .single();

    if (!roles) {
      console.error('[INIT-STORAGE] User is not admin:', user.id);
      return new Response(
        JSON.stringify({ error: 'Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[INIT-STORAGE] Admin verified:', user.id);

    // Check if bucket already exists
    const { data: existingBuckets, error: listError } = await supabase.storage.listBuckets();
    
    if (listError) {
      console.error('[INIT-STORAGE] Error listing buckets:', listError);
      throw listError;
    }

    const bucketExists = existingBuckets?.some(b => b.id === 'how-it-works-pdfs');

    if (bucketExists) {
      console.log('[INIT-STORAGE] Bucket already exists');
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Storage bucket already exists',
          bucket_id: 'how-it-works-pdfs',
          already_exists: true
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create the storage bucket
    const { data: bucket, error: createError } = await supabase.storage.createBucket('how-it-works-pdfs', {
      public: true,
      fileSizeLimit: 52428800, // 50MB limit
      allowedMimeTypes: ['application/pdf']
    });

    if (createError) {
      console.error('[INIT-STORAGE] Error creating bucket:', createError);
      throw createError;
    }

    console.log('[INIT-STORAGE] Bucket created successfully:', bucket);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Storage bucket created successfully',
        bucket_id: 'how-it-works-pdfs',
        bucket_data: bucket,
        public: true,
        rls_policies: 'Applied via migration'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[INIT-STORAGE] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ 
        success: false,
        error: errorMessage,
        details: error 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
