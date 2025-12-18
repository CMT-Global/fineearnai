// @ts-ignore
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.74.0';
import { getSystemSecrets } from '../_shared/secrets.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// @ts-ignore
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // @ts-ignore
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    // @ts-ignore
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { geminiApiKey: rawApiKey } = await getSystemSecrets(supabase);
    const geminiApiKey = rawApiKey?.trim();
    
    if (!geminiApiKey) {
      throw new Error('AI API key not configured');
    }

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

    interface Task {
      prompt: string;
      response_a: string;
      response_b: string;
      correct_response: 'a' | 'b';
      explanation?: string;
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
        responseFormat: 'Option A: Positive | Option B: Negative',
        maxPromptWords: { easy: 25, medium: 35, hard: 45 },
        maxResponseWords: { easy: 8, medium: 12, hard: 18 },
        examples: {
          easy: 'Prompt: "The internet connection is working well. Speed tests show good results. The price is fair and customer support responded in 3 hours." Is this positive or negative? | A: Positive | B: Negative [All positive = CLEAR]',
          medium: 'Prompt: "The customer service was friendly and solved my issue quickly. But I had to wait 50 minutes on hold and call three times before reaching someone. The resolution was good though." Overall sentiment? | A: Positive | B: Negative [Mixed, requires weighing]',
          hard: 'Prompt: "The implementation appears to meet basic requirements, though one might suggest the approach could be more efficient. The results are acceptable, relatively speaking, and there seems to be room for optimization." Sentiment? | A: Positive | B: Negative [Indirect negative]'
        },
        vocabulary: ['happy', 'sad', 'good', 'bad', 'positive', 'negative', 'like', 'dislike', 'satisfied', 'disappointed', 'pleased', 'upset', 'decent', 'fair', 'okay', 'acceptable', 'but', 'however', 'although', 'despite', 'could be better', 'room for improvement', 'appears to', 'seems to', 'relatively', 'somewhat', 'fairly']
      },
      'Hotel Review Sentiment': {
        promptFormat: 'Show a hotel guest comment. Ask: Was the guest happy or unhappy?',
        responseFormat: 'Option A: Positive | Option B: Negative',
        maxPromptWords: { easy: 25, medium: 40, hard: 50 },
        maxResponseWords: { easy: 10, medium: 15, hard: 20 },
        examples: {
          easy: 'Prompt: "The hotel room was clean and spacious. The bed was comfortable and wifi worked well. Staff were helpful with our requests. Good value for the price." Guest feeling? | A: Positive | B: Negative [All positive = CLEAR]',
          medium: 'Prompt: "The hotel room was spacious and location was perfect for downtown. Staff were friendly. However, the air conditioning was broken, check-in took 45 minutes, and breakfast was cold." Overall? | A: Positive | B: Negative [2 positive, 3 negative = Requires weighing]',
          hard: 'Prompt: "The accommodations appear adequate for the price point, though one might observe the amenities seem somewhat dated. The service level tends to be acceptable, relatively speaking, but there appears to be room for enhancement." Sentiment? | A: Positive | B: Negative [Indirect negative]'
        },
        vocabulary: ['clean', 'dirty', 'comfortable', 'uncomfortable', 'friendly', 'helpful', 'unhelpful', 'good', 'bad', 'decent', 'fair', 'okay', 'acceptable', 'worth', 'but', 'however', 'although', 'despite', 'could be better', 'room for improvement', 'appears to', 'seems to', 'relatively', 'somewhat', 'tends to']
      },
      'Product Review Sentiment': {
        promptFormat: 'Show a customer comment about a product. Ask: Did they like it or not?',
        responseFormat: 'Option A: Positive | Option B: Negative',
        maxPromptWords: { easy: 25, medium: 40, hard: 50 },
        maxResponseWords: { easy: 10, medium: 15, hard: 20 },
        examples: {
          easy: 'Prompt: "I bought this laptop three months ago. The battery lasts 7 hours and handles my tasks well. The keyboard is comfortable and the price was fair." Opinion? | A: Positive | B: Negative [All positive = CLEAR]',
          medium: 'Prompt: "The camera quality on this phone is excellent and battery lasts all day. Screen is bright and clear. But it overheats during video calls, storage filled up quickly, and customer support was unhelpful." Overall? | A: Positive | B: Negative [3 positive, 3 negative = Balance]',
          hard: 'Prompt: "The device appears to function within acceptable parameters. One might suggest the interface could be more intuitive, though it tends to be fairly responsive. The value proposition seems reasonable, relatively speaking." View? | A: Positive | B: Negative [Indirect cautious positive]'
        },
        vocabulary: ['works', 'quality', 'worth', 'useful', 'good', 'bad', 'recommend', 'avoid', 'decent', 'fair', 'okay', 'acceptable', 'reliable', 'handles', 'but', 'however', 'although', 'despite', 'could be better', 'room for improvement', 'appears to', 'seems to', 'relatively', 'somewhat', 'tends to', 'fairly']
      },
      'Business Review Sentiment': {
        promptFormat: 'Show a review about a business or service. Ask: Is this a good or bad review?',
        responseFormat: 'Option A: Positive | Option B: Negative',
        maxPromptWords: { easy: 25, medium: 40, hard: 50 },
        maxResponseWords: { easy: 10, medium: 15, hard: 20 },
        examples: {
          easy: 'Prompt: "The car repair shop fixed my issue in two days. The mechanic explained everything clearly. The bill matched the estimate and the price was fair." Review? | A: Positive | B: Negative [All positive = CLEAR]',
          medium: 'Prompt: "The restaurant has nice atmosphere and staff were polite and attentive. Food presentation was good. However, meals came out cold, order was wrong twice, and prices are high for the quality." Overall? | A: Positive | B: Negative [3 positive, 3 negative = Balance]',
          hard: 'Prompt: "The establishment appears to have potential in terms of concept. Service delivery tends to be adequate during off-peak hours, though efficiency could be enhanced. The experience seems acceptable, relatively speaking." Assessment? | A: Positive | B: Negative [Indirect cautious positive]'
        },
        vocabulary: ['good', 'bad', 'professional', 'helpful', 'recommend', 'avoid', 'satisfied', 'disappointed', 'decent', 'fair', 'okay', 'acceptable', 'reliable', 'fixed', 'but', 'however', 'although', 'despite', 'could be better', 'room for improvement', 'appears to', 'seems to', 'relatively', 'somewhat', 'tends to', 'potential for']
      },
      'Social Media Sentiment': {
        promptFormat: 'Show a social media post or comment. Ask: What is the mood or feeling?',
        responseFormat: 'Option A: Positive | Option B: Negative',
        maxPromptWords: { easy: 25, medium: 35, hard: 45 },
        maxResponseWords: { easy: 8, medium: 12, hard: 18 },
        examples: {
          easy: 'Prompt: "Got my tax refund today. The process was smooth and the amount was good. Filed online easily and got the money in 10 days. Good start to the month." Mood? | A: Positive | B: Negative [All positive = CLEAR]',
          medium: 'Prompt: "First week at new job done. Team is nice and office is modern. However, commute is 90 minutes each way, I wake at 5am, and parking costs $200 monthly. Not sustainable long-term." Sentiment? | A: Positive | B: Negative [2 positive, 3 negative = Weighing needed]',
          hard: 'Prompt: "The changes appear to be moving forward, though one might observe the timeline seems somewhat ambitious. Progress tends to be visible in certain areas, relatively speaking, but the direction could potentially be clearer." Tone? | A: Positive | B: Negative [Indirect uncertain/cautious]'
        },
        vocabulary: ['happy', 'sad', 'positive', 'negative', 'good', 'bad', 'pleased', 'upset', 'decent', 'fair', 'okay', 'acceptable', 'satisfied', 'disappointed', 'but', 'however', 'although', 'despite', 'could be better', 'appears to', 'seems to', 'relatively', 'somewhat', 'tends to', 'potentially']
      },
      'Customer Feedback Sentiment': {
        promptFormat: 'Show customer feedback or complaint. Ask: Is the customer satisfied or not?',
        responseFormat: 'Option A: Positive | Option B: Negative',
        maxPromptWords: { easy: 25, medium: 40, hard: 50 },
        maxResponseWords: { easy: 10, medium: 15, hard: 20 },
        examples: {
          easy: 'Prompt: "The support team answered my email within 24 hours. They solved my billing issue and explained each step clearly. They also gave me a refund. Fair outcome." Feeling? | A: Positive | B: Negative [All positive = CLEAR]',
          medium: 'Prompt: "The technician was professional and fixed my internet quickly. Work was done well. But the appointment was rescheduled twice, I took time off work three times, and no one called to apologize." Satisfaction? | A: Positive | B: Negative [2 positive, 3 negative = Weighing]',
          hard: 'Prompt: "The resolution appears to address the immediate concern, though one might suggest response time could be improved. The outcome seems acceptable given circumstances, relatively speaking, but the process tends to leave room for enhancement." Sentiment? | A: Positive | B: Negative [Indirect mixed/cautious]'
        },
        vocabulary: ['satisfied', 'dissatisfied', 'helpful', 'unhelpful', 'resolved', 'unresolved', 'good', 'bad', 'pleased', 'disappointed', 'decent', 'fair', 'okay', 'acceptable', 'answered', 'but', 'however', 'although', 'despite', 'could be better', 'room for improvement', 'appears to', 'seems to', 'relatively', 'somewhat', 'tends to']
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
7. FOR SENTIMENT CATEGORIES: Response options MUST be EXACTLY "Positive" and "Negative" - NO other words or descriptions allowed

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
EASY LEVEL - Single Clear Sentiment (Ages 21-45):
- Target Audience: Adults who need clear, unambiguous tasks with accessible language
- CRITICAL RULE: 80%+ of the content should support ONE sentiment (positive OR negative)
- Include 2-3 data points that MOSTLY align with the same sentiment
- If you include a minor opposing point, it MUST be clearly outweighed (e.g., "small issue" vs multiple strong positives)
- ⚠️ BANNED: Do NOT create 50/50 or 60/40 mixed sentiments - those belong in MEDIUM level
- Vocabulary: Use common everyday words plus mild qualifiers like 'decent', 'fair', 'okay', 'acceptable'
- BANNED WORDS (too extreme/childish): 'fantastic', 'amazing', 'incredible', 'terrible', 'horrible', 'awful', 'perfect', 'worst', 'best', 'love' (use sparingly)
- Sentence length: Maximum 15 words per sentence
- Prompt length: ${template ? template.maxPromptWords.easy : '20-25'} words total
- Response length: ${template ? template.maxResponseWords.easy : '8-10'} words each
- Context Requirements: Include 2-3 specific data points (numbers, timeframes, concrete details)
- Real-world scenarios: Work situations, service experiences, bills/payments, purchases, appointments, repairs, utilities, subscriptions, everyday adult decisions
- Tone: Straightforward and practical, not childish or overly enthusiastic
- NO idioms, NO slang, NO cultural references, NO complex grammar
- Use the template format: ${template?.promptFormat || 'Keep it simple and direct'}
- Goal: Users should answer correctly 85-90% of the time (clear but requires basic reading)

CORRECT EASY EXAMPLE: "The internet connection has been stable all week. Speed tests show consistent performance. Support resolved my ticket in 2 hours." (All positive → Clear answer)
WRONG EASY EXAMPLE: "The staff were helpful at check-in. The bed was comfortable. However, the air conditioning did not work well." (2 positive, 1 negative = This is MEDIUM level!)` : ''}

${difficulty === 'medium' ? `
MEDIUM LEVEL - Balanced Mixed Sentiment (Ages 21-45):
- Target: Adults who can evaluate conflicting information and weigh competing factors
- CRITICAL REQUIREMENT: 40-60% positive AND 40-60% negative (genuine mixed sentiment)
- Include 2-3 positive aspects AND 2-3 negative aspects of roughly equal weight
- Vocabulary: Template vocabulary plus contrast words ('but', 'however', 'although', 'despite', 'while', 'yet')
- Sentence length: Maximum 20 words per sentence
- Prompt length: ${template ? template.maxPromptWords.medium : '35-40'} words total (longer to accommodate both sentiments)
- Response length: ${template ? template.maxResponseWords.medium : '12-15'} words each
- Structure: Use transition words to show contrast between positive and negative elements
- Context: Professional/consumer scenarios (workplace, purchases, services, appointments)
- User Task: Determine which sentiment is STRONGER overall (requires genuine weighing)
- Make both sentiments substantial - avoid token mentions
- Follow template format: ${template?.promptFormat || 'Present balanced but leaning scenario'}
- Goal: Users should answer correctly 70-75% of the time (requires careful analysis)

CORRECT MEDIUM EXAMPLE: "The hotel room was spacious and clean. Location was perfect. But check-in took 45 minutes, AC was broken, and breakfast was cold." (2 positive, 3 negative = Requires weighing)` : ''}

${difficulty === 'hard' ? `
HARD LEVEL - Subtle/Indirect Sentiment (Ages 21-45):
- Target: Adults who can detect underlying sentiment in diplomatic/professional language
- Sentiment Type: Can be single sentiment OR mixed, but ALWAYS expressed INDIRECTLY
- Vocabulary: Template vocabulary plus indirect/subtle expressions (see required phrases below)
- REQUIRED INDIRECT PHRASES (use at least 2 per task): 'could be better', 'could be improved', 'room for improvement', 'room for enhancement', 'leaves room for', 'acceptable', 'adequate', 'fairly', 'somewhat', 'relatively', 'appears to', 'seems to', 'tends to', 'one might suggest', 'one could argue', 'potential for'
- Sentence length: Maximum 25 words per sentence
- Prompt length: ${template ? template.maxPromptWords.hard : '40-50'} words total (longer for subtle buildup)
- Response length: ${template ? template.maxResponseWords.hard : '18-20'} words each
- Tone: Professional, diplomatic, measured - not direct or obvious
- Language style: Use qualifiers and hedging language that softens the message
- Sentiment Expression: NEVER state sentiment directly - always use indirect phrasing
- Context: Professional reviews, diplomatic feedback, business assessments, formal evaluations
- User Challenge: Read between the lines to understand the true sentiment
- Follow template format: ${template?.promptFormat || 'Require careful interpretation'}
- Goal: Users should answer correctly 60-65% of the time (requires careful reading & interpretation)

CORRECT HARD EXAMPLE: "The implementation appears to meet basic requirements, though one might suggest the approach could be more efficient. Results are acceptable, relatively speaking." (Indirect negative sentiment)` : ''}

CRITICAL REQUIREMENTS FOR ALL LEVELS:
1. Follow the category template format exactly: ${template?.promptFormat || 'Use clear structure'}
2. Keep response options in template format: ${template?.responseFormat || 'Make options distinct'}
3. ${category.includes('Sentiment') || category.includes('Review') || category.includes('Feedback') ? '⚠️ MANDATORY: For sentiment tasks, response_a and response_b MUST be EXACTLY "Positive" and "Negative" - no other words, descriptions, or variations allowed!' : 'Make options clearly distinct and easy to understand'}
4. Use direct, simple sentence structures (Subject-Verb-Object)
5. Avoid passive voice (say "The staff helped me" not "I was helped by the staff")
    6. Use concrete, specific examples instead of abstract ideas
    7. Avoid double negatives ("not bad" → use "okay" or "good")
    8. Keep numbers and dates simple
    9. If using names, use common international names (Maria, John, Ahmed, Li)
    10. Both response options must be clearly written and easy to understand
    11. The differences between options should be genuine, not just word swaps
    12. Stay within the word limits: Prompt max ${template?.maxPromptWords[difficulty as keyof typeof template.maxPromptWords] || 'specified'} words, Responses max ${template?.maxResponseWords[difficulty as keyof typeof template.maxResponseWords] || 'specified'} words each`;

    // Call Google Gemini 3 API directly for task generation
    const aiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-preview:generateContent`,
      {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': geminiApiKey,
      },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [
              {
                // Combine system + user prompt into a single Gemini-friendly text block
                text: `${systemPrompt}\n\nUSER REQUEST:\n${userPrompt}`,
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 1.0,
        },
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI API error:', aiResponse.status, errorText);
      throw new Error(`AI generation failed: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const generatedContent = aiData.candidates?.[0]?.content?.parts?.[0]?.text;
    
    console.log('AI Response:', generatedContent);

    // Parse the JSON response
    let tasks: Task[];
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
      const embeddingResponse = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent`,
        {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
            'x-goog-api-key': geminiApiKey,
        },
        body: JSON.stringify({
            content: {
              parts: [{ text }],
            },
        }),
        }
      );

      if (!embeddingResponse.ok) {
        throw new Error('Failed to generate embedding');
      }

      const embeddingData: any = await embeddingResponse.json();
      const values = embeddingData.embeddings?.[0]?.values;
      if (!values || !Array.isArray(values)) {
        throw new Error('Invalid embedding response from Gemini');
      }
      return values;
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

        // Call Gemini for retry generation
        const retryAiResponse = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-preview:generateContent`,
          {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
              'x-goog-api-key': geminiApiKey,
          },
          body: JSON.stringify({
              contents: [
                {
                  role: 'user',
                  parts: [
                    {
                      text: `${systemPrompt}\n\nRETRY USER REQUEST:\n${retryUserPrompt}`,
                    },
                  ],
                },
              ],
              generationConfig: {
                temperature: 1.0,
              },
          }),
          }
        );

        if (!retryAiResponse.ok) {
          console.error(`Retry AI call failed: ${retryAiResponse.status}`);
          break; // Exit retry loop on API failure
        }

        const retryAiData = await retryAiResponse.json();
        const retryGeneratedContent = retryAiData.candidates?.[0]?.content?.parts?.[0]?.text;

        // Parse retry response
        try {
          const cleaned = retryGeneratedContent.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
          const retryTasks: Task[] = JSON.parse(cleaned);
          
          if (Array.isArray(retryTasks) && retryTasks.length > 0) {
            tasksToInsert = retryTasks.map((task: Task) => ({
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
