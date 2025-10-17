import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.74.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify admin authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    // Check admin role
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle();

    if (!roleData) {
      throw new Error('Admin access required');
    }

    const { category, difficulty, quantity } = await req.json();

    if (!category || !difficulty || !quantity) {
      throw new Error('Missing required fields');
    }

    if (quantity < 1 || quantity > 25) {
      throw new Error('Quantity must be between 1 and 25');
    }

    console.log(`Generating ${quantity} ${difficulty} ${category} tasks`);

    // System prompt for task generation
    const systemPrompt = `You are an AI task generator for an AI training platform. Generate high-quality, nuanced tasks for the specified category.

CRITICAL RULES:
1. Generate EXACTLY the number of tasks requested
2. Each task must be unique and realistic
3. Responses must be meaningfully different (not just opposite)
4. The correct answer should not be obvious
5. Tasks should require genuine human judgment

Return ONLY a valid JSON array (no markdown, no explanation) with this exact structure:
[
  {
    "prompt": "The task prompt/question",
    "response_a": "First option",
    "response_b": "Second option",
    "correct_response": "a" or "b",
    "explanation": "Why this is correct"
  }
]`;

    const userPrompt = `Generate ${quantity} unique ${difficulty}-level tasks for the "${category}" category.

Category Guidelines:
- Sentiment Analysis: Classify overall sentiment (positive/negative/neutral) of statements
- Hotel Review Sentiment: Analyze hotel review sentiment
- Product Review Sentiment: Evaluate product review sentiment  
- Business Review Sentiment: Assess business review sentiment
- Social Media Sentiment: Determine social media post sentiment
- Customer Feedback Sentiment: Analyze customer feedback sentiment
- Fact Checking: Verify if statements are factually accurate
- Tone Analysis: Identify the tone (formal/casual/aggressive/cautious/etc)
- Grammar Correction: Choose the grammatically correct version
- Summarization: Select the better summary
- Translation: Choose the better translation

Difficulty levels:
- easy: Clear, straightforward cases
- medium: Some nuance required
- hard: Subtle distinctions, expert judgment needed`;

    // Call Lovable AI Gateway
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.8,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI API error:', aiResponse.status, errorText);
      throw new Error(`AI generation failed: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const generatedContent = aiData.choices[0].message.content;
    
    console.log('AI Response:', generatedContent);

    // Parse the JSON response
    let tasks;
    try {
      // Remove markdown code blocks if present
      const cleaned = generatedContent.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      tasks = JSON.parse(cleaned);
    } catch (parseError) {
      console.error('Failed to parse AI response:', generatedContent);
      throw new Error('Failed to parse AI response');
    }

    if (!Array.isArray(tasks) || tasks.length === 0) {
      throw new Error('AI did not return valid tasks array');
    }

    // ============================================================================
    // PHASE 2: CHECK FOR DUPLICATE PROMPTS BEFORE INSERTION
    // ============================================================================
    
    // Prepare tasks for insertion
    const tasksToInsert = tasks.map(task => ({
      prompt: task.prompt,
      response_a: task.response_a,
      response_b: task.response_b,
      correct_response: task.correct_response,
      category,
      difficulty,
      is_active: true,
    }));

    // Extract all prompts to check for duplicates
    const promptsToCheck = tasksToInsert.map(t => t.prompt);
    
    console.log(`Checking ${promptsToCheck.length} prompts for duplicates...`);

    // Query database for existing prompts
    const { data: existingTasks, error: checkError } = await supabase
      .from('ai_tasks')
      .select('prompt')
      .in('prompt', promptsToCheck);

    if (checkError) {
      console.error('Error checking for duplicate prompts:', checkError);
      throw checkError;
    }

    // Create a Set of existing prompts for fast lookup
    const existingPrompts = new Set(existingTasks?.map(t => t.prompt) || []);
    
    // Filter out duplicates - only keep tasks with unique prompts
    const uniqueTasks = tasksToInsert.filter(t => !existingPrompts.has(t.prompt));
    const duplicateCount = tasksToInsert.length - uniqueTasks.length;

    console.log(`Found ${duplicateCount} duplicate(s), inserting ${uniqueTasks.length} unique task(s)`);

    // Handle case where all tasks are duplicates
    if (uniqueTasks.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          tasksCreated: 0,
          duplicatesSkipped: duplicateCount,
          tasks: [],
          message: 'All generated tasks were duplicates. No new tasks created.'
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      );
    }

    // Insert only unique tasks
    const { data: insertedTasks, error: insertError } = await supabase
      .from('ai_tasks')
      .insert(uniqueTasks)
      .select();

    if (insertError) {
      console.error('Insert error:', insertError);
      throw insertError;
    }

    console.log(`✅ Successfully created ${insertedTasks.length} unique task(s)`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        tasksCreated: insertedTasks.length,
        duplicatesSkipped: duplicateCount,
        tasks: insertedTasks,
        message: duplicateCount > 0 
          ? `Created ${insertedTasks.length} tasks, skipped ${duplicateCount} duplicate(s)`
          : `Created ${insertedTasks.length} tasks`
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error: any) {
    console.error('Error in generate-ai-tasks:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});