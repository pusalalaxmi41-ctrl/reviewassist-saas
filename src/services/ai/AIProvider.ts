import type { Business } from '../../types/business';

export interface ReviewDraftRequest {
  business: Pick<Business, 'name' | 'category'>;
  /** The customer's own words. The only source of facts for the review. */
  experience: string;
  /** 0 for the first draft, incremented on "Generate again". */
  attempt?: number;
}

export interface ReviewDraft {
  text: string;
}

/**
 * Replaceable AI provider contract.
 *
 * Future providers (e.g. OpenRouter) must call a backend endpoint that holds
 * the API key — never embed API keys in frontend code.
 */
export interface AIProvider {
  generateReviewDraft(request: ReviewDraftRequest): Promise<ReviewDraft>;
}
