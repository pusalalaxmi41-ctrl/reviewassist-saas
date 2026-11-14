import type { AIProvider, ReviewDraft, ReviewDraftRequest } from './AIProvider';

const FILLERS = /\b(?:um+|uh+|erm+|hmm+)\b,?\s*/gi;

/**
 * Local, deterministic placeholder for a real AI provider.
 *
 * It only tidies the customer's own words (spacing, capitalisation,
 * punctuation, filler words, shouting) and adds a neutral opening line.
 * It never adds facts, never removes sentences, so criticism is preserved.
 */
export class MockAIProvider implements AIProvider {
  private readonly latencyMs: number;

  constructor(latencyMs = 700) {
    this.latencyMs = latencyMs;
  }

  async generateReviewDraft({ business, experience, attempt = 0 }: ReviewDraftRequest): Promise<ReviewDraft> {
    if (!experience.trim()) throw new Error('Experience text is required.');
    await new Promise((r) => setTimeout(r, this.latencyMs));

    const sentences = toSentences(experience);
    const openers = [
      `Here is my honest experience at ${business.name}.`,
      '',
      `A few thoughts on ${business.name}.`,
    ];
    const opener = openers[attempt % openers.length];
    return { text: [opener, ...sentences].filter(Boolean).join(' ') };
  }
}

export function toSentences(input: string): string[] {
  const cleaned = input
    .replace(FILLERS, '')
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.!?])/g, '$1')
    .replace(/\bi\b/g, 'I')
    // Tone down shouting: ALL-CAPS words of 4+ letters become lowercase.
    .replace(/\b[A-Z]{4,}\b/g, (w) => w.toLowerCase())
    .replace(/([!?])\1+/g, '$1')
    .trim();

  return cleaned
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      const capped = s.charAt(0).toUpperCase() + s.slice(1);
      return /[.!?]$/.test(capped) ? capped : `${capped}.`;
    });
}
