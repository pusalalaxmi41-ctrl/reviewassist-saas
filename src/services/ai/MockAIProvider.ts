import type {
  AIProvider,
  BusinessResponseDraft,
  BusinessResponseRequest,
  ReviewDraft,
  ReviewDraftRequest,
} from './AIProvider';
import {
  buildBusinessResponsePrompts,
  synthesizeDeterministicBusinessResponse,
} from './businessResponseGenerator';
import { formatDisplayBusinessName } from '../../lib/naturalReviewCopy';

const FILLERS = /\b(?:um+|uh+|erm+|hmm+)\b,?\s*/gi;

const COMMON_GRAMMAR_FIXES: Array<[RegExp, string]> = [
  [/\bi\b/g, 'I'],
  [/\bim\b/gi, "I'm"],
  [/\bdont\b/gi, "don't"],
  [/\bdidnt\b/gi, "didn't"],
  [/\bwasnt\b/gi, "wasn't"],
  [/\bwerent\b/gi, "weren't"],
  [/\bcant\b/gi, "can't"],
  [/\bwont\b/gi, "won't"],
  [/\bit['’]?s\s+was\b/gi, 'it was'],
  [/\bfood\s+were\b/gi, 'food was'],
  [/\bstaff\s+was\s+very\s+polite\s+and\s+staff\b/gi, 'staff were very polite and'],
  [/\brecomend\b/gi, 'recommend'],
  [/\bambianc[e]?\b/gi, 'ambience'],
  [/\bawsome\b/gi, 'awesome'],
  [/\bexcellant\b/gi, 'excellent'],
];

/**
 * Local, deterministic placeholder for a real AI provider.
 *
 * It only tidies the customer's own words (grammar, spacing, capitalisation,
 * punctuation, filler words, shouting) and formats a natural, readable review
 * that strictly preserves the customer's actual experience and original sentiment.
 * It never invents products/services or turns negative feedback into praise.
 */
export class MockAIProvider implements AIProvider {
  private readonly latencyMs: number;

  constructor(latencyMs = 550) {
    this.latencyMs = latencyMs;
  }

  async generateReviewDraft({
    business,
    experience,
    attempt = 0,
    signal,
  }: ReviewDraftRequest): Promise<ReviewDraft> {
    const trimmed = experience.trim();
    if (!trimmed) {
      throw new Error('Please share a few details about your experience first.');
    }

    await new Promise<void>((resolve, reject) => {
      if (signal?.aborted) {
        reject(new DOMException('Generation cancelled', 'AbortError'));
        return;
      }
      const timer = setTimeout(resolve, this.latencyMs);
      signal?.addEventListener(
        'abort',
        () => {
          clearTimeout(timer);
          reject(new DOMException('Generation cancelled', 'AbortError'));
        },
        { once: true },
      );
    });

    const sentences = toSentences(trimmed);
    const displayName = formatDisplayBusinessName(business.name);
    const openers = [
      '',
      `Stopped by ${displayName} today.`,
      `Visited ${displayName} recently.`,
      `Checked out ${displayName} and wanted to share a quick note.`,
    ];
    const opener = openers[Math.abs(attempt) % openers.length];

    return {
      text: [opener, ...sentences].filter(Boolean).join(' '),
      streamed: false,
      generationSource: 'mock',
    };
  }

  async generateBusinessResponse(
    request: BusinessResponseRequest,
  ): Promise<BusinessResponseDraft> {
    const trimmedReview = request.customerReviewText.trim();
    if (!trimmedReview) {
      throw new Error('Customer review text is required to generate a business response.');
    }

    const sentiment = request.sentiment ?? 'positive';
    const {
      systemPrompt,
      userPrompt,
      validatedConfig,
      selectedKnowledge,
    } = buildBusinessResponsePrompts({
      business: request.business,
      customerReviewText: trimmedReview,
      sentiment,
      attempt: request.attempt,
      aiConfig: request.aiConfig,
      businessKnowledge: request.businessKnowledge,
    });

    await new Promise<void>((resolve, reject) => {
      if (request.signal?.aborted) {
        reject(new DOMException('Generation cancelled', 'AbortError'));
        return;
      }
      const timer = setTimeout(resolve, Math.min(this.latencyMs, 350));
      request.signal?.addEventListener(
        'abort',
        () => {
          clearTimeout(timer);
          reject(new DOMException('Generation cancelled', 'AbortError'));
        },
        { once: true },
      );
    });

    const text = synthesizeDeterministicBusinessResponse({
      business: request.business,
      customerReviewText: trimmedReview,
      sentiment,
      attempt: request.attempt,
      aiConfig: validatedConfig,
      selectedKnowledge,
    });

    return {
      text,
      appliedConfig: validatedConfig,
      selectedKnowledge,
      generationSource: 'mock',
      promptMetadata: {
        systemPrompt,
        userPrompt,
      },
    };
  }
}

export function toSentences(input: string): string[] {
  let cleaned = input
    .replace(FILLERS, '')
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.!?])/g, '$1')
    // Tone down shouting: ALL-CAPS words of 4+ letters become lowercase.
    .replace(/\b[A-Z]{4,}\b/g, (w) => w.toLowerCase())
    .replace(/([!?])\1+/g, '$1')
    .trim();

  for (const [pattern, replacement] of COMMON_GRAMMAR_FIXES) {
    cleaned = cleaned.replace(pattern, replacement);
  }

  return cleaned
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      const capped = s.charAt(0).toUpperCase() + s.slice(1);
      return /[.!?]$/.test(capped) ? capped : `${capped}.`;
    });
}
