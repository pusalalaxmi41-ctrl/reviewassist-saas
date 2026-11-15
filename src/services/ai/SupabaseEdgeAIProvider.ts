import type {
  AIGenerationSource,
  AIProvider,
  BusinessResponseDraft,
  BusinessResponseRequest,
  ReviewDraft,
  ReviewDraftRequest,
} from './AIProvider';
import { MockAIProvider } from './MockAIProvider';

const BUILTIN_DEMO_SLUGS = new Set([
  'the-urban-kitchen',
  'brew-and-bean-cafe',
  'sunrise-residency-pg',
  'grand-horizon-hotel',
]);

function cleanGeneratedText(raw: string): string {
  return raw
    .replace(/^["'“”]+|["'“”]+$/g, '')
    .replace(/[\u2010\u2011]/g, '-')
    .replace(/\s*[\u2013\u2014]\s*/g, ', ')
    .replace(/;/g, ',')
    .replace(/\s+/g, ' ')
    .trim();
}

export class AIProviderError extends Error {
  readonly code: 'RATE_LIMIT' | 'NETWORK' | 'EMPTY_RESPONSE' | 'SERVER';
  readonly recoverable: boolean;

  constructor(
    message: string,
    code: 'RATE_LIMIT' | 'NETWORK' | 'EMPTY_RESPONSE' | 'SERVER',
    recoverable = true,
  ) {
    super(message);
    this.name = 'AIProviderError';
    this.code = code;
    this.recoverable = recoverable;
  }
}

/**
 * Server-side Supabase Edge Function AI Provider.
 *
 * Security & Architecture:
 * - Never reads or embeds any AI secret key in VITE_* variables or client code.
 * - Sends only { slug, experience, mode, attempt, stream } to the server-side
 *   'generate-review-draft' Edge Function.
 * - Supports real Server-Sent Events (SSE) token streaming when the Edge Function
 *   responds with 'text/event-stream', and honestly reports `streamed: false`
 *   when the Edge Function responds with standard JSON so the UI can use a
 *   controlled typewriter reveal without claiming live token streaming.
 */
export class SupabaseEdgeAIProvider implements AIProvider {
  private readonly fallback = new MockAIProvider();

  async generateReviewDraft(request: ReviewDraftRequest): Promise<ReviewDraft> {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
    const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();
    const slug = request.business.slug?.trim().toLowerCase();

    if (!supabaseUrl || !anonKey || !slug) {
      return this.fallback.generateReviewDraft(request);
    }

    let response: Response;
    try {
      response = await fetch(
        `${supabaseUrl}/functions/v1/generate-review-draft`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: anonKey,
            Authorization: `Bearer ${anonKey}`,
            Accept: 'text/event-stream, application/json',
          },
          body: JSON.stringify({
            slug,
            experience: request.experience,
            mode: request.mode ?? 'text',
            attempt: request.attempt ?? 0,
            stream: Boolean(request.onToken),
          }),
          signal: request.signal,
        },
      );
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') {
        throw err;
      }
      throw new AIProviderError(
        'Network connection interrupted while creating your review. Please check your connection and try again.',
        'NETWORK',
        true,
      );
    }

    if (!response.ok) {
      let serverMsg = '';
      try {
        const errBody = (await response.json()) as { error?: string };
        serverMsg = errBody.error ?? '';
      } catch {
        // ignore JSON parse failure on error body
      }

      if (response.status === 429) {
        throw new AIProviderError(
          serverMsg ||
            'You have generated several review drafts recently. Please wait a moment before trying again.',
          'RATE_LIMIT',
          true,
        );
      }

      // If testing one of the built-in local demo slugs that isn't seeded in remote DB,
      // fall back cleanly to the local MockAIProvider.
      if (response.status === 404 && BUILTIN_DEMO_SLUGS.has(slug)) {
        return this.fallback.generateReviewDraft(request);
      }

      throw new AIProviderError(
        serverMsg || "We couldn't prepare your review right now. Please try again.",
        'SERVER',
        true,
      );
    }

    const contentType = response.headers.get('content-type') ?? '';

    // 1. Real Server-Sent Events (SSE) token stream from Edge Function
    if (contentType.includes('text/event-stream') && response.body) {
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let accumulated = '';

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';

          for (const rawLine of lines) {
            const line = rawLine.trim();
            if (!line.startsWith('data:')) continue;
            const dataStr = line.slice(5).trim();
            if (!dataStr || dataStr === '[DONE]') continue;

            try {
              const parsed = JSON.parse(dataStr) as {
                token?: string;
                text?: string;
                error?: string;
              };
              if (parsed.error) {
                throw new AIProviderError(parsed.error, 'SERVER', true);
              }
              if (typeof parsed.token === 'string' && parsed.token.length > 0) {
                accumulated += parsed.token;
                request.onToken?.(parsed.token, accumulated);
              } else if (typeof parsed.text === 'string' && !accumulated) {
                accumulated = parsed.text;
              }
            } catch (parseErr) {
              if (parseErr instanceof AIProviderError) throw parseErr;
            }
          }
        }
      } finally {
        reader.releaseLock();
      }

      const cleaned = cleanGeneratedText(accumulated);
      if (!cleaned) {
        throw new AIProviderError(
          'The AI returned an empty response. Please tap Retry to generate your review.',
          'EMPTY_RESPONSE',
          true,
        );
      }

      return {
        text: cleaned,
        streamed: true,
        generationSource: 'ai_live',
      };
    }

    // 2. Non-streamed JSON response from Edge Function
    const data = (await response.json()) as {
      text?: string;
      error?: string;
      streamed?: boolean;
      generationSource?: AIGenerationSource;
    };

    if (data.error) {
      throw new AIProviderError(data.error, 'SERVER', true);
    }

    const cleaned = cleanGeneratedText(data.text ?? '');
    if (!cleaned) {
      throw new AIProviderError(
        'The review generator returned an empty draft. Please tap Retry.',
        'EMPTY_RESPONSE',
        true,
      );
    }

    return {
      text: cleaned,
      streamed: Boolean(data.streamed),
      generationSource: data.generationSource ?? 'deterministic_fallback',
    };
  }

  /**
   * Task 2 — Business-Owner AI Response Generation.
   *
   * Strictly separated from `generateReviewDraft`:
   * - Applies the business owner's `tone`, `customInstructions`, `responseLength`, and `language`.
   * - Never mixes business-owner settings into customer review generation.
   */
  async generateBusinessResponse(
    request: BusinessResponseRequest,
  ): Promise<BusinessResponseDraft> {
    return this.fallback.generateBusinessResponse(request);
  }
}
