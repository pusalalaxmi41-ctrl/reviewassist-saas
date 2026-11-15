export type AICommunicationTone =
  | 'friendly'
  | 'professional'
  | 'formal'
  | 'warm_and_welcoming'
  | 'conversational'
  | 'premium'
  | 'short_and_direct';

export type AIResponseLength = 'short' | 'medium' | 'long';

export type AILanguageCode = 'en' | 'hi' | 'te';

export interface BusinessAIConfig {
  businessId: string;
  tone: AICommunicationTone;
  customInstructions: string;
  responseLength: AIResponseLength;
  language: AILanguageCode;
  updatedAt: string;
  /** Indicates whether the config is persisted in live Supabase ('supabase') or local storage ('local'). */
  storageSource?: 'supabase' | 'local';
}

export interface BusinessAIConfigInput {
  tone: AICommunicationTone;
  customInstructions: string;
  responseLength: AIResponseLength;
  language: AILanguageCode;
}

export const AI_TONE_OPTIONS: ReadonlyArray<{
  value: AICommunicationTone;
  label: string;
  description: string;
}> = [
  {
    value: 'friendly',
    label: 'Friendly',
    description: 'Approachable, upbeat, and neighbourly.',
  },
  {
    value: 'professional',
    label: 'Professional',
    description: 'Balanced, courteous, and business-appropriate (Default).',
  },
  {
    value: 'formal',
    label: 'Formal',
    description: 'Respectful, structured, and traditional.',
  },
  {
    value: 'warm_and_welcoming',
    label: 'Warm and welcoming',
    description: 'Hospitable, heartfelt, and guest-focused.',
  },
  {
    value: 'conversational',
    label: 'Conversational',
    description: 'Natural, relaxed everyday language.',
  },
  {
    value: 'premium',
    label: 'Premium',
    description: 'Refined, polished, and attentive to detail.',
  },
  {
    value: 'short_and_direct',
    label: 'Short and direct',
    description: 'Concise, clear, and straight to the point.',
  },
];

export const AI_RESPONSE_LENGTH_OPTIONS: ReadonlyArray<{
  value: AIResponseLength;
  label: string;
  description: string;
}> = [
  {
    value: 'short',
    label: 'Short',
    description: '1–2 concise sentences (~20–35 words).',
  },
  {
    value: 'medium',
    label: 'Medium',
    description: '3–4 balanced sentences (~45–75 words, Default).',
  },
  {
    value: 'long',
    label: 'Long',
    description: '5–6 detailed, thoughtful sentences (~85–130 words).',
  },
];

export const AI_LANGUAGE_OPTIONS: ReadonlyArray<{
  value: AILanguageCode;
  label: string;
  nativeLabel: string;
}> = [
  { value: 'en', label: 'English', nativeLabel: 'English' },
  { value: 'hi', label: 'Hindi', nativeLabel: 'हिन्दी (Hindi)' },
  { value: 'te', label: 'Telugu', nativeLabel: 'తెలుగు (Telugu)' },
];

export const CUSTOM_INSTRUCTIONS_MAX_LENGTH = 500;

export const DEFAULT_BUSINESS_AI_CONFIG: Omit<
  BusinessAIConfig,
  'businessId' | 'updatedAt'
> = {
  tone: 'professional',
  customInstructions: '',
  responseLength: 'medium',
  language: 'en',
};
