import { isSupabaseConfigured } from '../../lib/supabase';
import type { AIProvider } from './AIProvider';
import { MockAIProvider } from './MockAIProvider';
import { SupabaseEdgeAIProvider } from './SupabaseEdgeAIProvider';

export const aiProvider: AIProvider = isSupabaseConfigured
  ? new SupabaseEdgeAIProvider()
  : new MockAIProvider();

export type { AIProvider, ReviewDraft, ReviewDraftRequest } from './AIProvider';
