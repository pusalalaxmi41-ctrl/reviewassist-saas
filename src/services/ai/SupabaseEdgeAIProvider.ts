import { supabase } from '../../lib/supabase';
import type { AIProvider, ReviewDraft, ReviewDraftRequest } from './AIProvider';
import { MockAIProvider } from './MockAIProvider';

export class SupabaseEdgeAIProvider implements AIProvider {
  private readonly fallback = new MockAIProvider();

  async generateReviewDraft(request: ReviewDraftRequest): Promise<ReviewDraft> {
    const slug = request.business.slug?.trim().toLowerCase();
    if (!supabase || !slug) {
      return this.fallback.generateReviewDraft(request);
    }

    const { data, error } = await supabase.functions.invoke<{
      text?: string;
      error?: string;
    }>('generate-review-draft', {
      body: {
        slug,
        experience: request.experience,
        mode: request.mode ?? 'text',
        attempt: request.attempt ?? 0,
      },
    });

    if (error || !data?.text) {
      throw new Error(data?.error || error?.message || 'Unable to generate review draft.');
    }

    return { text: data.text };
  }
}
