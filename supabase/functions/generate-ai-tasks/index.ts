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

    // ============================================================================
    // PHASE 2: CATEGORY-SPECIFIC SIMPLIFICATION TEMPLATES
    // ============================================================================
    
    interface CategoryTemplate {
      promptFormat: string;
      responseFormat: string;
      maxPromptWords: { easy: number; medium: number; hard: number };
      maxResponseWords: { easy: number; medium: number; hard: number };
      examples: { easy: string; medium: string; hard: string };
      vocabulary: string[];
    }

    const categoryTemplates: Record<string, CategoryTemplate> = {
      'Sentiment Analysis': {
        promptFormat: 'Present a simple statement about [topic]. Ask: Is this positive or negative?',
        responseFormat: 'Option A: [positive interpretation] | Option B: [negative interpretation]',
        maxPromptWords: { easy: 15, medium: 25, hard: 35 },
        maxResponseWords: { easy: 8, medium: 12, hard: 18 },
        examples: {
          easy: 'Prompt: "I love this place!" Is this positive or negative? | A: Positive feeling | B: Negative feeling',
          medium: 'Prompt: "The service was okay, but I expected more for the price." What is the overall sentiment? | A: Mostly disappointed | B: Satisfied with value',
          hard: 'Prompt: "While the product functions adequately, the user experience leaves room for improvement." What is the sentiment? | A: Cautiously positive | B: Politely critical'
        },
        vocabulary: ['happy', 'sad', 'good', 'bad', 'positive', 'negative', 'like', 'dislike', 'love', 'hate', 'satisfied', 'disappointed', 'pleased', 'upset']
      },
      'Hotel Review Sentiment': {
        promptFormat: 'Show a hotel guest comment. Ask: Was the guest happy or unhappy?',
        responseFormat: 'Option A: [guest satisfied] | Option B: [guest dissatisfied]',
        maxPromptWords: { easy: 20, medium: 30, hard: 40 },
        maxResponseWords: { easy: 10, medium: 15, hard: 20 },
        examples: {
          easy: 'Prompt: "The room was clean and the bed was comfortable." How did the guest feel? | A: Happy with the room | B: Unhappy with the room',
          medium: 'Prompt: "The hotel location was great, but the breakfast was cold and limited." Overall impression? | A: Positive despite issues | B: Negative experience',
          hard: 'Prompt: "The staff demonstrated exceptional professionalism, though the dated facilities somewhat diminished the experience." Guest sentiment? | A: Appreciative but reserved | B: Critical but fair'
        },
        vocabulary: ['clean', 'dirty', 'comfortable', 'uncomfortable', 'friendly', 'rude', 'helpful', 'unhelpful', 'nice', 'terrible', 'excellent', 'poor', 'good', 'bad']
      },
      'Product Review Sentiment': {
        promptFormat: 'Show a customer comment about a product. Ask: Did they like it or not?',
        responseFormat: 'Option A: [customer likes product] | Option B: [customer dislikes product]',
        maxPromptWords: { easy: 20, medium: 30, hard: 40 },
        maxResponseWords: { easy: 10, medium: 15, hard: 20 },
        examples: {
          easy: 'Prompt: "This phone works great. I use it every day." Customer opinion? | A: Likes the product | B: Dislikes the product',
          medium: 'Prompt: "The quality is good but it arrived late and the packaging was damaged." Overall review? | A: Satisfied with product | B: Unhappy with experience',
          hard: 'Prompt: "While the build quality meets expectations, the price point seems inconsistent with comparable alternatives." Customer view? | A: Values quality over price | B: Questions value proposition'
        },
        vocabulary: ['works', 'broken', 'quality', 'cheap', 'expensive', 'worth', 'waste', 'useful', 'useless', 'good', 'bad', 'recommend', 'avoid', 'buy', 'return']
      },
      'Business Review Sentiment': {
        promptFormat: 'Show a review about a business or service. Ask: Is this a good or bad review?',
        responseFormat: 'Option A: [positive review] | Option B: [negative review]',
        maxPromptWords: { easy: 20, medium: 30, hard: 40 },
        maxResponseWords: { easy: 10, medium: 15, hard: 20 },
        examples: {
          easy: 'Prompt: "Fast service and good prices. I will come back." Review type? | A: Good review | B: Bad review',
          medium: 'Prompt: "The staff tried hard but the wait time was too long for what we ordered." Overall? | A: Appreciates effort | B: Disappointed overall',
          hard: 'Prompt: "The establishment demonstrates potential, though operational inconsistencies suggest room for improvement." Assessment? | A: Constructive optimism | B: Measured criticism'
        },
        vocabulary: ['fast', 'slow', 'good', 'bad', 'expensive', 'cheap', 'friendly', 'rude', 'professional', 'unprofessional', 'recommend', 'avoid', 'satisfied', 'disappointed']
      },
      'Social Media Sentiment': {
        promptFormat: 'Show a social media post or comment. Ask: What is the mood or feeling?',
        responseFormat: 'Option A: [positive mood] | Option B: [negative mood]',
        maxPromptWords: { easy: 15, medium: 25, hard: 35 },
        maxResponseWords: { easy: 8, medium: 12, hard: 18 },
        examples: {
          easy: 'Prompt: "Best day ever! 😊" What is the mood? | A: Happy and excited | B: Sad and upset',
          medium: 'Prompt: "Another Monday... at least the coffee is good ☕" Sentiment? | A: Making the best of it | B: Complaining about Monday',
          hard: 'Prompt: "Fascinating how perspectives shift when circumstances change. Growth happens in unexpected ways." Tone? | A: Reflective and positive | B: Philosophical but uncertain'
        },
        vocabulary: ['happy', 'sad', 'excited', 'bored', 'angry', 'calm', 'positive', 'negative', 'fun', 'boring', 'love', 'hate', 'best', 'worst', 'good', 'bad']
      },
      'Customer Feedback Sentiment': {
        promptFormat: 'Show customer feedback or complaint. Ask: Is the customer satisfied or not?',
        responseFormat: 'Option A: [satisfied customer] | Option B: [dissatisfied customer]',
        maxPromptWords: { easy: 20, medium: 30, hard: 40 },
        maxResponseWords: { easy: 10, medium: 15, hard: 20 },
        examples: {
          easy: 'Prompt: "Thank you for fixing my problem so quickly!" Customer feeling? | A: Satisfied and grateful | B: Angry and upset',
          medium: 'Prompt: "The issue was resolved but it took three calls to get help." Satisfaction level? | A: Problem solved, acceptable | B: Frustrated by process',
          hard: 'Prompt: "While appreciating the eventual resolution, the initial response time raises concerns about support capacity." Overall sentiment? | A: Cautiously positive | B: Diplomatically critical'
        },
        vocabulary: ['satisfied', 'dissatisfied', 'happy', 'unhappy', 'helpful', 'unhelpful', 'quick', 'slow', 'resolved', 'unresolved', 'thank', 'complain', 'good', 'bad', 'pleased', 'disappointed']
      },
      'Fact Checking': {
        promptFormat: 'Present a simple statement. Ask: Is this true or false?',
        responseFormat: 'Option A: [true/accurate] | Option B: [false/inaccurate]',
        maxPromptWords: { easy: 15, medium: 25, hard: 35 },
        maxResponseWords: { easy: 8, medium: 12, hard: 18 },
        examples: {
          easy: 'Prompt: "Water freezes at 0 degrees Celsius." Is this true? | A: True statement | B: False statement',
          medium: 'Prompt: "The Great Wall of China is visible from space with the naked eye." Fact or myth? | A: True, can be seen | B: False, common myth',
          hard: 'Prompt: "Caffeine consumption demonstrably improves cognitive performance in all individuals regardless of tolerance." Accurate? | A: Scientifically supported | B: Oversimplified claim'
        },
        vocabulary: ['true', 'false', 'fact', 'myth', 'correct', 'wrong', 'real', 'fake', 'accurate', 'inaccurate', 'yes', 'no', 'right', 'incorrect']
      },
      'Tone Analysis': {
        promptFormat: 'Show a message or statement. Ask: What is the tone or feeling?',
        responseFormat: 'Option A: [tone type 1] | Option B: [tone type 2]',
        maxPromptWords: { easy: 15, medium: 25, hard: 35 },
        maxResponseWords: { easy: 8, medium: 12, hard: 18 },
        examples: {
          easy: 'Prompt: "Please help me when you can." What is the tone? | A: Polite request | B: Angry demand',
          medium: 'Prompt: "I suppose that could work if we have no other options." Tone? | A: Reluctant acceptance | B: Enthusiastic agreement',
          hard: 'Prompt: "One might consider alternative approaches given the current circumstances." Communication style? | A: Diplomatically suggestive | B: Assertively directive'
        },
        vocabulary: ['polite', 'rude', 'friendly', 'angry', 'formal', 'casual', 'happy', 'sad', 'calm', 'excited', 'serious', 'funny', 'professional', 'informal']
      },
      'Grammar Correction': {
        promptFormat: 'Show two versions of a sentence. Ask: Which one is grammatically correct?',
        responseFormat: 'Option A: [sentence version 1] | Option B: [sentence version 2]',
        maxPromptWords: { easy: 20, medium: 30, hard: 40 },
        maxResponseWords: { easy: 12, medium: 18, hard: 25 },
        examples: {
          easy: 'Prompt: Which sentence is correct? | A: She go to school every day. | B: She goes to school every day.',
          medium: 'Prompt: Which is grammatically correct? | A: The team are working on the project. | B: The team is working on the project.',
          hard: 'Prompt: Which sentence has correct grammar? | A: Neither of the proposals were acceptable to the committee. | B: Neither of the proposals was acceptable to the committee.'
        },
        vocabulary: ['correct', 'incorrect', 'right', 'wrong', 'proper', 'improper', 'grammar', 'sentence', 'word', 'spelling', 'punctuation']
      },
      'Summarization': {
        promptFormat: 'Show a text and two summaries. Ask: Which summary is better or more accurate?',
        responseFormat: 'Option A: [summary version 1] | Option B: [summary version 2]',
        maxPromptWords: { easy: 30, medium: 45, hard: 60 },
        maxResponseWords: { easy: 15, medium: 25, hard: 35 },
        examples: {
          easy: 'Prompt: "The store opens at 9am and closes at 6pm Monday to Friday. On weekends it opens at 10am." Best summary? | A: Store hours: 9am-6pm weekdays, 10am start weekends | B: The store has different opening times',
          medium: 'Prompt: "The new policy requires employees to submit expense reports within 5 days. Managers must approve within 3 days. Late submissions need director approval." Key points? | A: Time limits for expense reports and approvals with escalation | B: Employees and managers handle expense reports',
          hard: 'Prompt: "The research indicates correlation between variables, though causation remains unestablished. Further longitudinal studies would strengthen conclusions." Accurate summary? | A: Study shows relationship but cannot prove cause, needs more research | B: Research proves connection between variables'
        },
        vocabulary: ['summary', 'main', 'point', 'key', 'important', 'detail', 'brief', 'short', 'accurate', 'complete', 'missing', 'includes', 'covers', 'explains']
      },
      'Translation': {
        promptFormat: 'Show a phrase in another language and two English translations. Ask: Which translation is more accurate?',
        responseFormat: 'Option A: [translation 1] | Option B: [translation 2]',
        maxPromptWords: { easy: 20, medium: 30, hard: 40 },
        maxResponseWords: { easy: 10, medium: 15, hard: 22 },
        examples: {
          easy: 'Prompt: Spanish: "Buenos días" | A: Good morning | B: Good night',
          medium: 'Prompt: French: "Je voudrais un café, s\'il vous plaît" | A: I would like a coffee, please | B: I want coffee now',
          hard: 'Prompt: German: "Es tut mir leid, dass ich Sie warten ließ" | A: I am sorry that I kept you waiting | B: I apologize for the wait you experienced'
        },
        vocabulary: ['translation', 'meaning', 'accurate', 'correct', 'wrong', 'better', 'language', 'word', 'phrase', 'sentence', 'says', 'means']
      }
    };

    // Get template for current category
    const template = categoryTemplates[category];
    if (!template) {
      console.warn(`No template found for category: ${category}, using defaults`);
    }

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

    // Enhanced user prompt with category-specific templates
    const userPrompt = `Generate ${quantity} unique ${difficulty}-level tasks for the "${category}" category.

${template ? `
CATEGORY-SPECIFIC TEMPLATE FOR "${category}":
- Prompt Format: ${template.promptFormat}
- Response Format: ${template.responseFormat}
- Maximum Prompt Words: ${template.maxPromptWords[difficulty as keyof typeof template.maxPromptWords]} words
- Maximum Response Words: ${template.maxResponseWords[difficulty as keyof typeof template.maxResponseWords]} words per option
- Recommended Vocabulary: ${template.vocabulary.join(', ')}

EXAMPLE FOR ${difficulty.toUpperCase()} LEVEL:
${template.examples[difficulty as keyof typeof template.examples]}
` : ''}

DIFFICULTY-SPECIFIC LANGUAGE COMPLEXITY REQUIREMENTS:

${difficulty === 'easy' ? `
EASY LEVEL (6th-grade reading level):
- Vocabulary: Use only common words from the template vocabulary list
- Sentence length: Maximum 15 words per sentence
- Prompt length: ${template ? template.maxPromptWords.easy : '20-40'} words total
- Response length: ${template ? template.maxResponseWords.easy : '10-20'} words each
- Concepts: Use everyday situations everyone understands (weather, food, family, work, shopping)
- NO idioms, NO slang, NO cultural references, NO complex grammar
- Use the template format: ${template?.promptFormat || 'Keep it simple and direct'}
- Make the difference between options clear but not too obvious` : ''}

${difficulty === 'medium' ? `
MEDIUM LEVEL (9th-grade reading level):
- Vocabulary: Use template vocabulary plus basic descriptive terms
- Sentence length: Maximum 20 words per sentence
- Prompt length: ${template ? template.maxPromptWords.medium : '40-60'} words total
- Response length: ${template ? template.maxResponseWords.medium : '15-30'} words each
- Concepts: Use familiar situations with some detail
- Minimal idioms, avoid complex metaphors
- Follow template format: ${template?.promptFormat || 'Add context that requires basic judgment'}
- Include some context that requires basic judgment` : ''}

${difficulty === 'hard' ? `
HARD LEVEL (12th-grade reading level):
- Vocabulary: Template vocabulary plus more sophisticated but clear terms
- Sentence length: Maximum 25 words per sentence
- Prompt length: ${template ? template.maxPromptWords.hard : '60-80'} words total
- Response length: ${template ? template.maxResponseWords.hard : '20-40'} words each
- Concepts: Nuanced situations requiring careful judgment
- Can use some professional terminology when relevant
- Apply template format: ${template?.promptFormat || 'Require careful evaluation of subtle differences'}
- Require careful evaluation of subtle differences` : ''}

CRITICAL REQUIREMENTS FOR ALL LEVELS:
1. Follow the category template format exactly: ${template?.promptFormat || 'Use clear structure'}
2. Keep response options in template format: ${template?.responseFormat || 'Make options distinct'}
3. Use direct, simple sentence structures (Subject-Verb-Object)
4. Avoid passive voice (say "The staff helped me" not "I was helped by the staff")
5. Use concrete, specific examples instead of abstract ideas
6. Avoid double negatives ("not bad" → use "okay" or "good")
7. Keep numbers and dates simple
8. If using names, use common international names (Maria, John, Ahmed, Li)
9. Both response options must be clearly written and easy to understand
10. The differences between options should be genuine, not just word swaps
11. Stay within the word limits: Prompt max ${template?.maxPromptWords[difficulty as keyof typeof template.maxPromptWords] || 'specified'} words, Responses max ${template?.maxResponseWords[difficulty as keyof typeof template.maxResponseWords] || 'specified'} words each`;

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

      // Check for exact duplicate prompts
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

      // Semantic similarity check
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

      // Retry logic - Generate more tasks if needed
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

        // Enhanced retry prompt with template information
        const retryUserPrompt = `Generate ${remainingToGenerate} BRAND NEW unique ${difficulty}-level tasks for the "${category}" category.

⚠️ CRITICAL: The following prompts already exist in the database. You MUST generate completely different prompts:
${promptExamples ? `\nExisting prompt examples:\n- ${promptExamples}` : ''}

${template ? `
CATEGORY TEMPLATE FOR "${category}":
- Format: ${template.promptFormat}
- Vocabulary: ${template.vocabulary.slice(0, 10).join(', ')}
- Max Prompt Words: ${template.maxPromptWords[difficulty as keyof typeof template.maxPromptWords]}
- Max Response Words: ${template.maxResponseWords[difficulty as keyof typeof template.maxResponseWords]}
` : ''}

LANGUAGE SIMPLICITY REQUIREMENTS (apply ${difficulty} level guidelines):
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
5. Follow all language simplicity and template guidelines`;

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
