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
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')!;
    const pdfShiftApiKey = Deno.env.get('PDFSHIFT_API_KEY')!;
    
    if (!lovableApiKey) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }
    
    if (!pdfShiftApiKey) {
      throw new Error('PDFSHIFT_API_KEY is not configured');
    }

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
      console.error('[PDF-GEN] Authentication failed:', authError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user is admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('username')
      .eq('id', user.id)
      .single();

    const { data: roles } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .single();

    if (!roles) {
      console.error('[PDF-GEN] User is not admin:', user.id);
      return new Response(
        JSON.stringify({ error: 'Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[PDF-GEN] Admin verified:', user.id, profile?.username);

    // Step 1: Fetch How It Works steps
    const { data: steps, error: stepsError } = await supabase
      .from('how_it_works_steps')
      .select('*')
      .eq('is_active', true)
      .order('step_number');

    if (stepsError || !steps?.length) {
      console.error('[PDF-GEN] Failed to fetch steps:', stepsError);
      throw new Error('Failed to fetch How It Works steps');
    }

    console.log(`[PDF-GEN] Fetched ${steps.length} active steps`);

    // Step 2: Calculate next version number
    const { data: existingPDFs } = await supabase
      .from('how_it_works_pdf_documents')
      .select('version')
      .order('version', { ascending: false })
      .limit(1);

    const nextVersion = (existingPDFs?.[0]?.version || 0) + 1;
    console.log('[PDF-GEN] Next version:', nextVersion);

    // Step 3: Create PDF record with 'generating' status
    const { data: pdfRecord, error: insertError } = await supabase
      .from('how_it_works_pdf_documents')
      .insert({
        status: 'generating',
        generated_by: user.id,
        content_snapshot: steps,
        version: nextVersion,
      })
      .select()
      .single();

    if (insertError) {
      console.error('[PDF-GEN] Failed to create PDF record:', insertError);
      throw insertError;
    }

    console.log('[PDF-GEN] Created PDF record:', pdfRecord.id);

    // Step 4: Ensure storage bucket exists (self-healing)
    console.log('[PDF-GEN] Checking storage bucket...');
    
    const { data: existingBuckets } = await supabase.storage.listBuckets();
    const bucketExists = existingBuckets?.some(b => b.id === 'how-it-works-pdfs');
    
    if (!bucketExists) {
      console.log('[PDF-GEN] Creating storage bucket...');
      const { error: bucketError } = await supabase.storage.createBucket('how-it-works-pdfs', {
        public: true,
        fileSizeLimit: 52428800, // 50MB
        allowedMimeTypes: ['application/pdf'] // Only PDFs allowed
      });
      
      if (bucketError) {
        console.error('[PDF-GEN] Failed to create bucket:', bucketError);
        // Update PDF record to failed status
        await supabase
          .from('how_it_works_pdf_documents')
          .update({ status: 'failed' })
          .eq('id', pdfRecord.id);
        throw new Error(`Storage bucket creation failed: ${bucketError.message}`);
      }
      console.log('[PDF-GEN] Storage bucket created successfully');
    } else {
      console.log('[PDF-GEN] Storage bucket exists');
    }

    // Step 5: Format content for AI
    const contentForAI = steps.map(step => 
      `Step ${step.step_number}: ${step.title}\n${step.description}`
    ).join('\n\n');

    // Step 6: Generate beautiful HTML using Lovable AI
    const aiPrompt = `Create a beautiful, professional HTML document for a comprehensive PDF guide titled "FineEarn - Earners Guide: How to Maximize Your AI Training Earnings".

CRITICAL REQUIREMENTS:
- Generate a COMPLETE, VALID HTML document with <!DOCTYPE html>, <html>, <head>, and <body> tags
- Use ONLY inline CSS styles (no external stylesheets or <style> tags in head)
- Make it print-ready with proper page breaks using CSS: page-break-after, page-break-before, page-break-inside
- Include a beautiful cover page with gradient backgrounds
- Use professional typography (font sizes, line heights, margins)
- Add visual elements: borders, shadows, colored sections, icons (using Unicode symbols)
- Make it engaging with modern design principles
- Ensure proper spacing and layout for PDF rendering
- Use responsive font sizes that work well in print

CONTENT TO INCLUDE (${steps.length} steps):
${contentForAI}

DESIGN GUIDELINES:
1. Cover Page:
   - Large title "FineEarn - Earners Guide"
   - Subtitle "Master AI Training & Maximize Your Earnings"
   - Professional gradient background (blue to cyan)
   - Logo placeholder or decorative element
   - Footer with version info

2. Table of Contents:
   - List all ${steps.length} steps with page references
   - Clean, organized layout

3. Each Step (separate page):
   - Step number and title as header
   - Description in readable paragraphs
   - Icon or visual element for the step
   - Highlight key points in colored boxes
   - Professional spacing

4. Footer on each page:
   - Page numbers
   - "FineEarn.com" branding

5. Color Scheme:
   - Primary: Blues and cyans (#3B82F6, #06B6D4)
   - Accents: Teal and green
   - Background: Light grays and whites
   - Text: Dark gray (#1F2937)

OUTPUT: Return ONLY the complete, valid HTML code. No explanations, no markdown code blocks, just pure HTML that can be directly used for PDF generation.`;

    console.log('[PDF-GEN] Calling Lovable AI...');

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { 
            role: 'system', 
            content: 'You are an expert HTML/CSS designer specializing in creating beautiful, print-ready documents. You always return valid, complete HTML with inline styles optimized for PDF generation.' 
          },
          { role: 'user', content: aiPrompt }
        ],
        max_tokens: 8000,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('[PDF-GEN] Lovable AI error:', aiResponse.status, errorText);
      
      if (aiResponse.status === 429) {
        throw new Error('Rate limit exceeded. Please try again later.');
      }
      if (aiResponse.status === 402) {
        throw new Error('Payment required. Please add credits to your Lovable AI workspace.');
      }
      
      throw new Error(`Lovable AI request failed: ${errorText}`);
    }

    const aiData = await aiResponse.json();
    const htmlContent = aiData.choices?.[0]?.message?.content;

    if (!htmlContent) {
      console.error('[PDF-GEN] No content from AI:', aiData);
      throw new Error('Failed to generate HTML content from AI');
    }

    console.log(`[PDF-GEN] Generated HTML (${htmlContent.length} characters)`);

    // Step 7: Store AI prompt used
    await supabase
      .from('how_it_works_pdf_documents')
      .update({ ai_prompt_used: aiPrompt })
      .eq('id', pdfRecord.id);

    // Step 7.5: Convert HTML to PDF using PDFShift
    console.log('[PDF-GEN] Converting HTML to PDF using PDFShift...');
    
    const pdfShiftResponse = await fetch('https://api.pdfshift.io/v3/convert/pdf', {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + btoa('api:' + pdfShiftApiKey),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        source: htmlContent,
        format: 'A4',
        margin: {
          top: '20mm',
          right: '15mm',
          bottom: '20mm',
          left: '15mm'
        },
        landscape: false,
        use_print: false,
      }),
    });

    if (!pdfShiftResponse.ok) {
      const errorText = await pdfShiftResponse.text();
      console.error('[PDF-GEN] PDFShift conversion failed:', pdfShiftResponse.status, errorText);
      
      // Update PDF record to failed status
      await supabase
        .from('how_it_works_pdf_documents')
        .update({ status: 'failed' })
        .eq('id', pdfRecord.id);
      
      throw new Error(`PDF conversion failed: ${pdfShiftResponse.status} - ${errorText}`);
    }

    // Get the PDF blob
    const pdfBlob = await pdfShiftResponse.blob();
    console.log(`[PDF-GEN] Generated PDF (${pdfBlob.size} bytes)`);

    // Step 8: Upload actual PDF file to storage
    const pdfFileName = `fineearn-earners-guide-v${nextVersion}-${Date.now()}.pdf`;
    
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('how-it-works-pdfs')
      .upload(pdfFileName, pdfBlob, {
        contentType: 'application/pdf',
        cacheControl: '3600',
      });

    if (uploadError) {
      console.error('[PDF-GEN] Upload error:', uploadError);
      throw uploadError;
    }

    console.log('[PDF-GEN] Uploaded PDF:', pdfFileName);

    // Get public URL for the PDF
    const { data: { publicUrl } } = supabase.storage
      .from('how-it-works-pdfs')
      .getPublicUrl(pdfFileName);

    // Step 9: Update PDF record with status 'pending_review'
    const { error: updateError } = await supabase
      .from('how_it_works_pdf_documents')
      .update({
        status: 'pending_review',
        file_url: publicUrl,
        file_size_bytes: pdfBlob.size, // PDF size instead of HTML size
        generated_at: new Date().toISOString(),
      })
      .eq('id', pdfRecord.id);

    if (updateError) {
      console.error('[PDF-GEN] Failed to update PDF record:', updateError);
      throw updateError;
    }

    console.log('[PDF-GEN] PDF generation complete:', pdfRecord.id);

    return new Response(
      JSON.stringify({
        success: true,
        pdf_id: pdfRecord.id,
        version: nextVersion,
        status: 'pending_review',
        pdf_url: publicUrl,
        file_size: pdfBlob.size,
        message: 'PDF generated successfully and ready for review.',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[PDF-GEN] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    
    return new Response(
      JSON.stringify({ 
        success: false,
        error: errorMessage,
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
