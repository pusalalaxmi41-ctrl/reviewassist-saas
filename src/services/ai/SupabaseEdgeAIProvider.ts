import { supabase } from '../../lib/supabase';
import type { AIProvider, ReviewDraft, ReviewDraftRequest } from './AIProvider';
import { MockAIProvider } from './MockAIProvider';

const HUMAN_STYLE_VARIATIONS = [
  'Style 1 (Quick phone review, 1 to 2 short sentences): Write like someone quickly typing on their phone right after eating or staying here. Start directly with the food, room, or service without a formal intro.',
  'Style 2 (Casual everyday customer, 2 to 3 simple sentences): Use plain, conversational Indian English. Sound warm and genuine, not like a professional food critic.',
  'Style 3 (Direct & grounded, 2 sentences): Mention the specific things that were good (or could improve) in simple everyday words, and end with a natural recommendation if positive.',
  'Style 4 (Friendly local visitor, 2 to 3 short sentences): Vary sentence lengths naturally — one slightly longer sentence and one short sentence at the end.',
  'Style 5 (Simple & honest, 2 sentences): Do NOT start with "I visited" or "We went to". Jump straight into how the food, stay, water, or ambience was.',
];

const SYSTEM_PROMPT = `You write short, real-sounding Google reviews for everyday customers in India.
Your #1 goal is that the review MUST sound 100% written by a normal human typing on their phone — NEVER like AI or ChatGPT.

STRICT ANTI-AI RULES:
1. Use ONLY simple, everyday Indian English words (like "really good", "tasty", "clean", "nice ambience", "polite staff", "worth the price", "decent", "homely", "recommend").
2. NEVER use robotic AI buzzwords: BANNED words include "impeccable", "culinary", "delightful", "memorable", "testament", "exceeded expectations", "top-notch", "seamless", "nestled", "attentive", "furthermore", "moreover", "impressed by", "pleasant experience", "truly", "undeniably", "exquisite", "gastronomic".
3. NEVER use em-dashes (—), en-dashes (–), semicolons (;), or fancy hyphenated adjectives. Use only normal commas and periods.
4. Use ONLY the facts from the customer's selected highlights or notes. NEVER invent dish names, room numbers, or details they did not provide.
5. Keep the customer's honest sentiment: if they selected a "could be better" or "slow" point, mention it naturally and politely without sounding fake.
6. Output ONLY the review text itself (no quotes, no labels).`;

function humanizeReviewText(raw: string): string {
  return raw
    .replace(/^["'“”]+|["'“”]+$/g, '')
    // Replace unicode non-breaking hyphens and en/em dashes with normal punctuation
    .replace(/[\u2010\u2011]/g, '-')
    .replace(/\s*[\u2013\u2014]\s*/g, ', ')
    .replace(/;/g, ',')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Calls Gemini, OpenRouter, Groq, or OpenAI automatically based on key prefix
 * when a temporary local test key (VITE_TEMP_AI_API_KEY) is provided in .env.local.
 */
async function generateWithTempApiKey(
  apiKey: string,
  request: ReviewDraftRequest,
): Promise<string | null> {
  const key = apiKey.trim();
  if (!key) return null;

  const styleIndex =
    Math.floor(Math.random() * HUMAN_STYLE_VARIATIONS.length + (request.attempt ?? 0)) %
    HUMAN_STYLE_VARIATIONS.length;
  const chosenStyle = HUMAN_STYLE_VARIATIONS[styleIndex];

  const userPrompt = `Place: ${request.business.name} (${request.business.category})
Customer's selected points / notes: "${request.experience}"
Writing style to follow this time: ${chosenStyle}

Write the natural human review now:`;

  try {
    // 1. Google Gemini API key (starts with AIza)
    if (key.startsWith('AIza')) {
      for (const model of ['gemini-2.5-flash', 'gemini-2.0-flash']) {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
              contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
              generationConfig: { temperature: 0.8, maxOutputTokens: 220 },
            }),
          },
        );
        if (res.ok) {
          const data = (await res.json()) as {
            candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
          };
          const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
          if (text) return humanizeReviewText(text);
        }
      }
      return null;
    }

    // 2. OpenRouter / Groq / OpenAI compatible chat completions
    let endpoint = 'https://api.openai.com/v1/chat/completions';
    let model = 'gpt-4o-mini';

    if (key.startsWith('sk-or-')) {
      endpoint = 'https://openrouter.ai/api/v1/chat/completions';
      model = 'openai/gpt-4o-mini';
    } else if (key.startsWith('gsk_')) {
      endpoint = 'https://api.groq.com/openai/v1/chat/completions';
      model = 'openai/gpt-oss-120b';
    }

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        temperature: 0.8,
        max_tokens: 600,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
      }),
    });

    if (!res.ok) return null;

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const text = data.choices?.[0]?.message?.content?.trim();
    return text ? humanizeReviewText(text) : null;
  } catch {
    return null;
  }
}

export class SupabaseEdgeAIProvider implements AIProvider {
  private readonly fallback = new MockAIProvider();

  async generateReviewDraft(request: ReviewDraftRequest): Promise<ReviewDraft> {
    const tempKey = import.meta.env.VITE_TEMP_AI_API_KEY?.trim() ?? '';
    const slug = request.business.slug?.trim().toLowerCase();

    const aiTextPromise = tempKey
      ? generateWithTempApiKey(tempKey, request)
      : Promise.resolve(null);

    if (!supabase || !slug) {
      const aiText = await aiTextPromise;
      if (aiText) return { text: aiText };
      return this.fallback.generateReviewDraft(request);
    }

    const [aiText, edgeResult] = await Promise.all([
      aiTextPromise,
      supabase.functions.invoke<{ text?: string; error?: string }>(
        'generate-review-draft',
        {
          body: {
            slug,
            experience: request.experience,
            mode: request.mode ?? 'text',
            attempt: request.attempt ?? 0,
          },
        },
      ),
    ]);

    if (aiText) {
      return { text: aiText };
    }

    const { data, error } = edgeResult;
    if (error || !data?.text) {
      throw new Error(data?.error || error?.message || 'Unable to generate review draft.');
    }

    return { text: humanizeReviewText(data.text) };
  }
}
