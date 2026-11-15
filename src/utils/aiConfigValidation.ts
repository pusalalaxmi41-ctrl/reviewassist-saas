import {
  AI_LANGUAGE_OPTIONS,
  AI_RESPONSE_LENGTH_OPTIONS,
  AI_TONE_OPTIONS,
  CUSTOM_INSTRUCTIONS_MAX_LENGTH,
  DEFAULT_BUSINESS_AI_CONFIG,
  type AICommunicationTone,
  type AILanguageCode,
  type AIResponseLength,
  type BusinessAIConfig,
  type BusinessAIConfigInput,
} from '../types/aiConfig';

const VALID_TONES = new Set<string>(AI_TONE_OPTIONS.map((o) => o.value));
const VALID_LENGTHS = new Set<string>(
  AI_RESPONSE_LENGTH_OPTIONS.map((o) => o.value),
);
const VALID_LANGUAGES = new Set<string>(
  AI_LANGUAGE_OPTIONS.map((o) => o.value),
);

/**
 * Patterns that attempt to override system-level safety rules, prompt guardrails,
 * or customer feedback integrity.
 */
const UNSAFE_INSTRUCTION_PATTERNS: ReadonlyArray<{
  pattern: RegExp;
  reason: string;
}> = [
  {
    pattern:
      /\b(?:ignore|disregard|bypass|override|forget)\s+(?:all\s+)?(?:previous|prior|system|safety)\s+(?:instructions|rules|prompts|guardrails)\b/i,
    reason:
      'Custom instructions cannot override system safety rules or prompt guardrails.',
  },
  {
    pattern:
      /\b(?:turn|change|convert|rewrite)\s+(?:negative|bad|critical|poor)\s+(?:reviews?|feedback|comments?)\s+(?:into|to)\s+(?:positive|good|5[\s-]*star|five[\s-]*star)\b/i,
    reason:
      'Custom instructions cannot alter customer sentiment or turn negative feedback into positive praise.',
  },
  {
    pattern:
      /\b(?:invent|fabricate|make\s+up|fake)\s+(?:customer\s+)?(?:reviews?|experiences?|facts?|ratings?)\b/i,
    reason:
      'Custom instructions cannot request fabricated or fake customer experiences.',
  },
];

export function isValidAITone(value: unknown): value is AICommunicationTone {
  return typeof value === 'string' && VALID_TONES.has(value);
}

export function isValidAIResponseLength(
  value: unknown,
): value is AIResponseLength {
  return typeof value === 'string' && VALID_LENGTHS.has(value);
}

export function isValidAILanguage(value: unknown): value is AILanguageCode {
  return typeof value === 'string' && VALID_LANGUAGES.has(value);
}

export function validateBusinessId(businessId: unknown): string | null {
  if (typeof businessId !== 'string') {
    return 'A valid business ID is required.';
  }
  const trimmed = businessId.trim();
  if (trimmed.length < 3 || trimmed.length > 120 || !/^[a-zA-Z0-9_-]+$/.test(trimmed)) {
    return 'Invalid business ID format.';
  }
  return null;
}

export function validateCustomInstructions(instructions: unknown): string | null {
  if (typeof instructions !== 'string') {
    return 'Custom instructions must be a text string.';
  }

  const trimmed = instructions.trim();
  if (trimmed.length === 0) {
    return null; // Empty custom instructions are valid
  }

  if (trimmed.length > CUSTOM_INSTRUCTIONS_MAX_LENGTH) {
    return `Custom instructions must be ${CUSTOM_INSTRUCTIONS_MAX_LENGTH} characters or fewer (currently ${trimmed.length}).`;
  }

  for (const rule of UNSAFE_INSTRUCTION_PATTERNS) {
    if (rule.pattern.test(trimmed)) {
      return rule.reason;
    }
  }

  return null;
}

export function validateBusinessAIConfigInput(
  businessId: unknown,
  input: unknown,
): { ok: true; value: BusinessAIConfigInput } | { ok: false; error: string } {
  const idErr = validateBusinessId(businessId);
  if (idErr) {
    return { ok: false, error: idErr };
  }

  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { ok: false, error: 'AI configuration must be a valid object.' };
  }

  const candidate = input as Record<string, unknown>;

  if (!isValidAITone(candidate.tone)) {
    return {
      ok: false,
      error: `Unsupported AI tone "${String(candidate.tone ?? '')}". Allowed tones: ${Array.from(VALID_TONES).join(', ')}.`,
    };
  }

  if (!isValidAIResponseLength(candidate.responseLength)) {
    return {
      ok: false,
      error: `Unsupported response length "${String(candidate.responseLength ?? '')}". Allowed values: short, medium, long.`,
    };
  }

  if (!isValidAILanguage(candidate.language)) {
    return {
      ok: false,
      error: `Unsupported language "${String(candidate.language ?? '')}". Supported languages: English (en), Hindi (hi), Telugu (te).`,
    };
  }

  const rawInstructions =
    candidate.customInstructions === undefined ||
    candidate.customInstructions === null
      ? ''
      : candidate.customInstructions;

  const instructionsErr = validateCustomInstructions(rawInstructions);
  if (instructionsErr) {
    return { ok: false, error: instructionsErr };
  }

  const sanitizedInstructions = Array.from(String(rawInstructions))
    .filter((ch) => {
      const code = ch.charCodeAt(0);
      return code === 9 || code === 10 || code === 13 || (code >= 32 && code !== 127);
    })
    .join('')
    .trim();

  return {
    ok: true,
    value: {
      tone: candidate.tone,
      customInstructions: sanitizedInstructions,
      responseLength: candidate.responseLength,
      language: candidate.language,
    },
  };
}

/**
 * Returns a complete BusinessAIConfig with safe defaults
 * (Tone: 'professional', Language: 'en', Response length: 'medium', Custom instructions: '')
 * whenever any field is missing or unrecognised.
 */
export function normalizeBusinessAIConfig(
  businessId: string,
  partial?: Partial<BusinessAIConfig> | null,
  storageSource?: 'supabase' | 'local',
): BusinessAIConfig {
  const cleanInstructions =
    typeof partial?.customInstructions === 'string' &&
    validateCustomInstructions(partial.customInstructions) === null
      ? partial.customInstructions.trim()
      : DEFAULT_BUSINESS_AI_CONFIG.customInstructions;

  return {
    businessId: businessId.trim(),
    tone: isValidAITone(partial?.tone)
      ? partial.tone
      : DEFAULT_BUSINESS_AI_CONFIG.tone,
    customInstructions: cleanInstructions,
    responseLength: isValidAIResponseLength(partial?.responseLength)
      ? partial.responseLength
      : DEFAULT_BUSINESS_AI_CONFIG.responseLength,
    language: isValidAILanguage(partial?.language)
      ? partial.language
      : DEFAULT_BUSINESS_AI_CONFIG.language,
    updatedAt: partial?.updatedAt || new Date().toISOString(),
    storageSource: storageSource ?? partial?.storageSource ?? 'local',
  };
}
