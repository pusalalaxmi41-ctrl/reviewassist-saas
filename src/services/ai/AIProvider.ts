import type { BusinessAIConfigInput } from '../../types/aiConfig';
import type {
  BusinessKnowledgeInput,
  BusinessKnowledgeProfile,
  SelectedBusinessKnowledgeContext,
} from '../../types/businessKnowledge';
import type {
  Business,
  ExperienceInputMode,
  ReviewSentiment,
} from '../../types/business';

export type AIGenerationSource = 'ai_live' | 'deterministic_fallback' | 'mock';

/**
 * TASK 1: Customer Review Generation Request.
 *
 * Strictly isolated from Business-Owner AI Configuration:
 * Business-owner tone, custom instructions, response length, and language
 * must NEVER be passed here so customer meaning and sentiment are preserved.
 */
export interface ReviewDraftRequest {
  business: Pick<Business, 'name' | 'category'> & Partial<Pick<Business, 'slug'>>;
  /** The customer's own words. The only source of facts for the review. */
  experience: string;
  /** 0 for the first draft, incremented on "Regenerate". */
  attempt?: number;
  /** Input mode ('text' | 'voice') forwarded to the server-side draft recorder. */
  mode?: ExperienceInputMode;
  /** Optional AbortSignal to cancel in-flight generation when customer navigates away. */
  signal?: AbortSignal;
  /**
   * Optional callback invoked ONLY when real server-sent token streaming is
   * supported by the backend provider.
   */
  onToken?: (delta: string, accumulated: string) => void;
}

export interface ReviewDraft {
  text: string;
  streamed?: boolean;
  generationSource?: AIGenerationSource;
}

/**
 * TASK 2: Business-Owner AI Response Generation Request.
 *
 * Used when generating responses written on behalf of the business.
 * Applies the business owner's selected tone, custom instructions,
 * response length, and language.
 */
export interface BusinessResponseRequest {
  business: Pick<Business, 'id' | 'name' | 'category' | 'city'> &
    Partial<Pick<Business, 'slug'>>;
  /** The customer review or feedback the business owner is responding to. */
  customerReviewText: string;
  /** Sentiment of the customer review ('positive' | 'neutral' | 'negative' | 'mixed'). */
  sentiment?: ReviewSentiment;
  /** 0 for initial draft generation, incremented when regenerating. */
  attempt?: number;
  /** Typed per-business AI configuration (Phase 3). */
  aiConfig: BusinessAIConfigInput;
  /** Optional per-business knowledge & local SEO context (Phase 4), applied selectively. */
  businessKnowledge?: BusinessKnowledgeInput | BusinessKnowledgeProfile | null;
  signal?: AbortSignal;
}

export interface BusinessResponseDraft {
  text: string;
  appliedConfig: BusinessAIConfigInput;
  /** The selectively matched subset of business knowledge used for this response, or null if none provided. */
  selectedKnowledge: SelectedBusinessKnowledgeContext | null;
  generationSource: AIGenerationSource;
  promptMetadata: {
    systemPrompt: string;
    userPrompt: string;
  };
}

/**
 * Replaceable AI provider contract with strict task separation between:
 * 1. Customer review generation (`generateReviewDraft`)
 * 2. Business-owner response generation (`generateBusinessResponse`)
 */
export interface AIProvider {
  generateReviewDraft(request: ReviewDraftRequest): Promise<ReviewDraft>;
  generateBusinessResponse(
    request: BusinessResponseRequest,
  ): Promise<BusinessResponseDraft>;
}
