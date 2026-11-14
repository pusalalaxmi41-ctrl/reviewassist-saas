import { supabase } from '../../lib/supabase';
import type { AIProvider, ReviewDraft, ReviewDraftRequest } from './AIProvider';
import { MockAIProvider } from './MockAIProvider';

const SYSTEM_PROMPT = `You are a helpful review-writing assistant for real customers of local businesses.
Strict rules:
1. Write a natural, authentic 2 to 4 sentence Google review in first person ("I" or "we") based ONLY on the customer's words.
2. NEVER invent dishes, staff names, rooms, prices, or details that the customer did not mention.
3. Preserve the customer's honest sentiment: if they mention a problem or criticism, keep it polite, constructive, and honest — never turn a complaint into fake praise.
4. Output ONLY the final review text with no quotation marks, no title, and no preamble.`;

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

  const attemptHint =
    (request.attempt ?? 0) > 0
      ? `\n(Variation #${request.attempt}: use slightly different, natural phrasing while keeping the exact same facts.)`
      : '';

  const userPrompt = `Business Name: ${request.business.name} (${request.business.category})
Customer's raw experience: "${request.experience}"${attemptHint}

Write the polished review now:`;

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
              generationConfig: { temperature: 0.5, maxOutputTokens: 300 },
            }),
          },
        );
        if (res.ok) {
          const data = (await res.json()) as {
            candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
          };
          const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
          if (text) return text.replace(/^["']|["']$/g, '').trim();
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
        temperature: 0.5,
        max_tokens: 300,
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
    return text ? text.replace(/^["']|["']$/g, '').trim() : null;
  } catch {
    return null;
  }
}

export class SupabaseEdgeAIProvider implements AIProvider {
  private readonly fallback = new MockAIProvider();

  async generateReviewDraft(request: ReviewDraftRequest): Promise<ReviewDraft> {
    const tempKey = import.meta.env.VITE_TEMP_AI_API_KEY?.trim() ?? '';
    const slug = request.business.slug?.trim().toLowerCase();

    // If a temporary local API key is set in .env.local, generate with the real LLM
    // and still invoke the Edge Function so the draft & analytics events are saved in Supabase.
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

    return { text: data.text };
  }
}
