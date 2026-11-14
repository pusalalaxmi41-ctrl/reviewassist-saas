import type { AIProvider } from './AIProvider';
import { MockAIProvider } from './MockAIProvider';

// Swap this for a backend-backed provider (e.g. OpenRouter via a server proxy) later.
export const aiProvider: AIProvider = new MockAIProvider();

export type { AIProvider, ReviewDraft, ReviewDraftRequest } from './AIProvider';
