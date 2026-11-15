import { isSupabaseConfigured } from '../../lib/supabase';
import type { AIProvider } from './AIProvider';
import { MockAIProvider } from './MockAIProvider';
import { AIProviderError, SupabaseEdgeAIProvider } from './SupabaseEdgeAIProvider';

export const aiProvider: AIProvider = isSupabaseConfigured
  ? new SupabaseEdgeAIProvider()
  : new MockAIProvider();

export { AIProviderError, MockAIProvider, SupabaseEdgeAIProvider };
export type {
  AIGenerationSource,
  AIProvider,
  BusinessResponseDraft,
  BusinessResponseRequest,
  ReviewDraft,
  ReviewDraftRequest,
} from './AIProvider';
