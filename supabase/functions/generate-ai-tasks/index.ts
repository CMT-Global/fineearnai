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

    // System prompt for task generation with language simplicity guidelines
    const systemPrompt = `You are an AI task generator for an AI training platform. Generate high-quality, nuanced tasks for the specified category.

CRITICAL RULES:
1. Generate EXACTLY the number of tasks requested
2. Each task must be unique and realistic
3. Responses must be meaningfully different (not just opposite)
4. The correct answer should not be obvious (but not impossible either)
5. Tasks should require genuine human judgment
6. USE SIMPLE, CLEAR LANGUAGE appropriate for non-native English speakers

LANGUAGE SIMPLICITY GUIDELINES (CRITICAL):
- Use common, everyday vocabulary
- Keep sentences short and direct (max 20 words per sentence)
- Avoid idioms, slang, cultural references, and complex metaphors
- Use active voice instead of passive voice
- Break complex ideas into simple parts
- Avoid technical jargon unless it's the specific task requirement
- Use concrete examples instead of abstract concepts

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

Category Guidelines (use simple language for all):
- Sentiment Analysis: Ask users to identify if a statement feels positive, negative, or neutral. Use everyday situations.
- Hotel Review Sentiment: Present simple hotel reviews. Ask if the guest was happy or unhappy.
- Product Review Sentiment: Show basic product reviews. Ask if the customer liked or disliked the product.
- Business Review Sentiment: Present simple business reviews. Ask if the review is good or bad.
- Social Media Sentiment: Show short social media posts. Ask if the mood is positive or negative.
- Customer Feedback Sentiment: Present customer comments. Ask if the customer is satisfied or not.
- Fact Checking: Present simple statements. Ask if they are true or false based on common knowledge.
- Tone Analysis: Present messages. Ask about the feeling: friendly, angry, polite, rude, etc.
- Grammar Correction: Show two versions of a sentence. Ask which one is correct.
- Summarization: Show a short text and two summaries. Ask which one is better.
- Translation: Show a phrase in another language and two translations. Ask which is more accurate.

DIFFICULTY-SPECIFIC LANGUAGE COMPLEXITY REQUIREMENTS:

${difficulty === 'easy' ? `
EASY LEVEL (6th-grade reading level):
- Vocabulary: Use only common words (1,000-2,000 most frequent English words)
- Sentence length: Maximum 15 words per sentence
- Prompt length: 20-40 words total
- Response length: 10-20 words each
- Concepts: Use everyday situations everyone understands (weather, food, family, work, shopping)
- NO idioms, NO slang, NO cultural references, NO complex grammar
- Example vocabulary to use: happy, sad, good, bad, like, dislike, easy, hard, yes, no, big, small
- Example sentences: "The food was cold." "I like this hotel." "The service was slow."
- Make the difference between options clear but not too obvious` : ''}

${difficulty === 'medium' ? `
MEDIUM LEVEL (9th-grade reading level):
- Vocabulary: Use common words plus some descriptive terms (2,000-5,000 most frequent words)
- Sentence length: Maximum 20 words per sentence
- Prompt length: 40-60 words total
- Response length: 15-30 words each
- Concepts: Use familiar situations with some detail (customer service, travel, shopping experiences)
- Minimal idioms, avoid complex metaphors
- Example vocabulary to use: excellent, terrible, disappointed, satisfied, comfortable, professional, quality, value
- Example sentences: "The room was clean but the check-in took too long." "The product works well but costs too much."
- Include some context that requires basic judgment` : ''}

${difficulty === 'hard' ? `
HARD LEVEL (12th-grade reading level):
- Vocabulary: Can include more sophisticated terms but keep them clear (up to 10,000 frequent words)
- Sentence length: Maximum 25 words per sentence
- Prompt length: 60-80 words total
- Response length: 20-40 words each
- Concepts: Can include nuanced situations requiring careful judgment
- Can use some professional terminology when relevant
- Example vocabulary to use: exceptional, subpar, ambiguous, inconsistent, comprehensive, adequate, commendable, concerning
- Example sentences: "While the amenities met expectations, the inconsistent service quality created concerns."
- Require careful evaluation of subtle differences` : ''}

CRITICAL REQUIREMENTS FOR ALL LEVELS:
1. Use direct, simple sentence structures (Subject-Verb-Object)
2. Avoid passive voice (say "The staff helped me" not "I was helped by the staff")
3. Use concrete, specific examples instead of abstract ideas
4. Avoid double negatives ("not bad" → use "okay" or "good")
5. Keep numbers and dates simple
6. If using names, use common international names (Maria, John, Ahmed, Li)
7. Both response options must be clearly written and easy to understand
8. The differences between options should be genuine, not just word swaps`;

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
    // PHASE 2, 3 & 4: DUPLICATE CHECKING WITH RETRY LOGIC & SEMANTIC SIMILARITY
    // ============================================================================
    
    // Helper function to generate embeddings
    const generateEmbedding = async (text: string): Promise<number[]> => {
      const embeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${lovableApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'text-embedding-3-small',
          input: text,
        }),
      });

      if (!embeddingResponse.ok) {
        throw new Error('Failed to generate embedding');
      }

      const embeddingData = await embeddingResponse.json();
      return embeddingData.data[0].embedding;
    };

    // Helper function to calculate cosine similarity
    const cosineSimilarity = (a: number[], b: number[]): number => {
      let dotProduct = 0;
      let normA = 0;
      let normB = 0;
      
      for (let i = 0; i < a.length; i++) {
        dotProduct += a[i] * b[i];
        normA += a[i] * a[i];
        normB += b[i] * b[i];
      }
      
      return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
    };

    let allInsertedTasks: any[] = [];
    let totalDuplicatesSkipped = 0;
    let totalSemanticDuplicatesSkipped = 0;
    let remainingToGenerate = quantity;
    const maxRetries = 3;
    let retryCount = 0;
    const SIMILARITY_THRESHOLD = 0.90; // 90% similarity threshold

    // Prepare initial tasks for insertion
    let tasksToInsert = tasks.map(task => ({
      prompt: task.prompt,
      response_a: task.response_a,
      response_b: task.response_b,
      correct_response: task.correct_response,
      category,
      difficulty,
      is_active: true,
    }));

    // Main generation loop with retry logic
    while (remainingToGenerate > 0 && retryCount <= maxRetries) {
      // Extract all prompts to check for duplicates
      const promptsToCheck = tasksToInsert.map(t => t.prompt);
      
      console.log(`[Attempt ${retryCount + 1}] Checking ${promptsToCheck.length} prompts for duplicates...`);

      // ============================================================================
      // STEP 1: Check for exact duplicate prompts
      // ============================================================================
      const { data: existingTasks, error: checkError } = await supabase
        .from('ai_tasks')
        .select('prompt')
        .in('prompt', promptsToCheck);

      if (checkError) {
        console.error('Error checking for duplicate prompts:', checkError);
        throw checkError;
      }

      const existingPrompts = new Set(existingTasks?.map(t => t.prompt) || []);
      let uniqueTasks = tasksToInsert.filter(t => !existingPrompts.has(t.prompt));
      const exactDuplicateCount = tasksToInsert.length - uniqueTasks.length;
      totalDuplicatesSkipped += exactDuplicateCount;

      console.log(`[Attempt ${retryCount + 1}] Found ${exactDuplicateCount} exact duplicate(s), ${uniqueTasks.length} passed exact check`);

      // ============================================================================
      // PHASE 4: SEMANTIC SIMILARITY CHECK
      // ============================================================================
      if (uniqueTasks.length > 0) {
        console.log(`[Phase 4] Starting semantic similarity check for ${uniqueTasks.length} task(s)...`);
        
        // Get recent existing prompts from the same category for comparison
        const { data: recentTasks } = await supabase
          .from('ai_tasks')
          .select('prompt')
          .eq('category', category)
          .order('created_at', { ascending: false })
          .limit(50); // Check against 50 most recent tasks in category

        if (recentTasks && recentTasks.length > 0) {
          const semanticallyUniqueTasks: any[] = [];
          let semanticDuplicatesInBatch = 0;

          // Process each unique task for semantic similarity
          for (const task of uniqueTasks) {
            try {
              // Generate embedding for new task prompt
              const newTaskEmbedding = await generateEmbedding(task.prompt);
              let isTooSimilar = false;

              // Compare with a sample of existing tasks (check first 10 for efficiency)
              const tasksToCompare = recentTasks.slice(0, 10);
              
              for (const existingTask of tasksToCompare) {
                // Generate embedding for existing task
                const existingEmbedding = await generateEmbedding(existingTask.prompt);
                
                // Calculate cosine similarity
                const similarity = cosineSimilarity(newTaskEmbedding, existingEmbedding);
                
                if (similarity >= SIMILARITY_THRESHOLD) {
                  console.log(`  ⚠️ Semantic duplicate detected (${(similarity * 100).toFixed(1)}% similar):`);
                  console.log(`    New: "${task.prompt.substring(0, 60)}..."`);
                  console.log(`    Existing: "${existingTask.prompt.substring(0, 60)}..."`);
                  isTooSimilar = true;
                  semanticDuplicatesInBatch++;
                  break; // No need to check further
                }
              }

              if (!isTooSimilar) {
                semanticallyUniqueTasks.push(task);
              }
            } catch (embeddingError) {
              console.error('  ⚠️ Embedding generation failed, keeping task:', embeddingError);
              // On embedding error, keep the task (fail open)
              semanticallyUniqueTasks.push(task);
            }
          }

          totalSemanticDuplicatesSkipped += semanticDuplicatesInBatch;
          uniqueTasks = semanticallyUniqueTasks;
          
          console.log(`[Phase 4] Filtered out ${semanticDuplicatesInBatch} semantic duplicate(s), ${uniqueTasks.length} truly unique`);
        } else {
          console.log(`[Phase 4] No existing tasks to compare, skipping semantic check`);
        }
      }

      console.log(`[Attempt ${retryCount + 1}] Final unique count: ${uniqueTasks.length} task(s)`);

      // Insert unique tasks if any
      if (uniqueTasks.length > 0) {
        const { data: insertedTasks, error: insertError } = await supabase
          .from('ai_tasks')
          .insert(uniqueTasks)
          .select();

        if (insertError) {
          console.error('Insert error:', insertError);
          throw insertError;
        }

        allInsertedTasks.push(...insertedTasks);
        remainingToGenerate -= insertedTasks.length;
        
        console.log(`✅ [Attempt ${retryCount + 1}] Successfully created ${insertedTasks.length} task(s). Remaining: ${remainingToGenerate}`);
      }

      // ============================================================================
      // PHASE 3: RETRY LOGIC - Generate more tasks if needed
      // ============================================================================
      
      if (remainingToGenerate > 0 && retryCount < maxRetries) {
        retryCount++;
        console.log(`🔄 Retrying generation for ${remainingToGenerate} remaining task(s) (Retry ${retryCount}/${maxRetries})`);

        // Get all existing prompts to avoid them in retry
        const { data: allExistingTasks } = await supabase
          .from('ai_tasks')
          .select('prompt')
          .eq('category', category);

        const allExistingPrompts = allExistingTasks?.map(t => t.prompt) || [];
        const promptExamples = allExistingPrompts.slice(-5).join('\n- ');

        // Enhanced retry prompt with explicit avoidance instructions and language simplicity
        const retryUserPrompt = `Generate ${remainingToGenerate} BRAND NEW unique ${difficulty}-level tasks for the "${category}" category.

⚠️ CRITICAL: The following prompts already exist in the database. You MUST generate completely different prompts:
${promptExamples ? `\nExisting prompt examples:\n- ${promptExamples}` : ''}

Category Guidelines (use simple language):
- Sentiment Analysis: Ask users to identify if a statement feels positive, negative, or neutral. Use everyday situations.
- Hotel Review Sentiment: Present simple hotel reviews. Ask if the guest was happy or unhappy.
- Product Review Sentiment: Show basic product reviews. Ask if the customer liked or disliked the product.
- Business Review Sentiment: Present simple business reviews. Ask if the review is good or bad.
- Social Media Sentiment: Show short social media posts. Ask if the mood is positive or negative.
- Customer Feedback Sentiment: Present customer comments. Ask if the customer is satisfied or not.
- Fact Checking: Present simple statements. Ask if they are true or false.
- Tone Analysis: Present messages. Ask about the feeling: friendly, angry, polite, rude.
- Grammar Correction: Show two sentence versions. Ask which is correct.
- Summarization: Show text and two summaries. Ask which is better.
- Translation: Show a phrase and two translations. Ask which is more accurate.

LANGUAGE SIMPLICITY REQUIREMENTS (apply ${difficulty} level guidelines from main prompt):
- Use simple, everyday vocabulary appropriate for non-native speakers
- Keep sentences short and clear (max ${difficulty === 'easy' ? '15' : difficulty === 'medium' ? '20' : '25'} words)
- Avoid idioms, slang, and cultural references
- Use active voice and concrete examples
- Make both response options clear and easy to understand

Make sure your NEW prompts are:
1. Completely different scenarios from existing examples above
2. Use different contexts, situations, and wording
3. Cover different aspects of the ${category} category
4. Maintain ${difficulty} difficulty level
5. Follow all language simplicity guidelines`;

        // Call AI for retry generation
        const retryAiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${lovableApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'google/gemini-2.5-flash',
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: retryUserPrompt }
            ],
            temperature: 0.9, // Slightly higher temperature for more variety
          }),
        });

        if (!retryAiResponse.ok) {
          console.error(`Retry AI call failed: ${retryAiResponse.status}`);
          break; // Exit retry loop on API failure
        }

        const retryAiData = await retryAiResponse.json();
        const retryGeneratedContent = retryAiData.choices[0].message.content;

        // Parse retry response
        try {
          const cleaned = retryGeneratedContent.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
          const retryTasks = JSON.parse(cleaned);
          
          if (Array.isArray(retryTasks) && retryTasks.length > 0) {
            tasksToInsert = retryTasks.map(task => ({
              prompt: task.prompt,
              response_a: task.response_a,
              response_b: task.response_b,
              correct_response: task.correct_response,
              category,
              difficulty,
              is_active: true,
            }));
          } else {
            console.error('Retry AI did not return valid tasks');
            break;
          }
        } catch (parseError) {
          console.error('Failed to parse retry AI response');
          break;
        }
      } else {
        break; // Exit loop if no more retries or remaining tasks
      }
    }

    // Final response
    const finalMessage = remainingToGenerate > 0
      ? `Created ${allInsertedTasks.length}/${quantity} tasks. Skipped ${totalDuplicatesSkipped} exact duplicate(s) and ${totalSemanticDuplicatesSkipped} semantic duplicate(s). Could not generate ${remainingToGenerate} more unique task(s) after ${retryCount} retries.`
      : (totalDuplicatesSkipped > 0 || totalSemanticDuplicatesSkipped > 0)
        ? `Created ${allInsertedTasks.length} tasks. Skipped ${totalDuplicatesSkipped} exact duplicate(s) and ${totalSemanticDuplicatesSkipped} semantic duplicate(s) with ${retryCount} retry attempts.`
        : `Created ${allInsertedTasks.length} tasks successfully.`;

    console.log(`✅ Final result: ${finalMessage}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        tasksCreated: allInsertedTasks.length,
        tasksRequested: quantity,
        exactDuplicatesSkipped: totalDuplicatesSkipped,
        semanticDuplicatesSkipped: totalSemanticDuplicatesSkipped,
        totalDuplicatesSkipped: totalDuplicatesSkipped + totalSemanticDuplicatesSkipped,
        retriesUsed: retryCount,
        tasks: allInsertedTasks,
        message: finalMessage
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