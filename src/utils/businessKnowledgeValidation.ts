import {
  BUSINESS_KNOWLEDGE_LIMITS,
  type BusinessKnowledgeInput,
  type BusinessKnowledgeProfile,
  type BusinessProductItem,
  type BusinessServiceItem,
} from '../types/businessKnowledge';
import { validateBusinessId } from './aiConfigValidation';

const UNSAFE_KNOWLEDGE_PATTERNS: ReadonlyArray<{
  pattern: RegExp;
  reason: string;
}> = [
  {
    pattern:
      /\b(?:ignore|disregard|bypass|override|forget)\s+(?:all\s+)?(?:previous|prior|system|safety)\s+(?:instructions|rules|prompts|guardrails)\b/i,
    reason:
      'Business knowledge cannot contain prompt-override instructions that bypass system safety rules.',
  },
  {
    pattern:
      /\b(?:turn|change|convert|rewrite)\s+(?:negative|bad|critical|poor)\s+(?:reviews?|feedback|comments?)\s+(?:into|to)\s+(?:positive|good|5[\s-]*star|five[\s-]*star)\b/i,
    reason:
      'Business knowledge cannot instruct the AI to alter customer sentiment or rewrite negative reviews into praise.',
  },
  {
    pattern:
      /\b(?:invent|fabricate|make\s+up|fake)\s+(?:customer\s+)?(?:reviews?|experiences?|facts?|ratings?)\b/i,
    reason:
      'Business knowledge cannot instruct the AI to fabricate customer experiences.',
  },
];

function stripControlChars(raw: string): string {
  return Array.from(raw)
    .filter((ch) => {
      const code = ch.charCodeAt(0);
      return code === 9 || code === 10 || code === 13 || (code >= 32 && code !== 127);
    })
    .join('')
    .trim();
}

function normalizeKey(value: string): string {
  return stripControlChars(value).toLowerCase().replace(/\s+/g, ' ');
}

function checkUnsafeText(value: string, fieldLabel: string): string | null {
  for (const rule of UNSAFE_KNOWLEDGE_PATTERNS) {
    if (rule.pattern.test(value)) {
      return `${fieldLabel}: ${rule.reason}`;
    }
  }
  return null;
}

export function validateBusinessDescription(
  description: unknown,
  options?: { allowEmpty?: boolean },
): string | null {
  if (typeof description !== 'string') {
    return 'Business description must be a text string.';
  }
  const cleaned = stripControlChars(description);
  if (!cleaned) {
    return options?.allowEmpty
      ? null
      : 'Business description cannot be empty. Please describe what your business offers.';
  }
  if (cleaned.length < BUSINESS_KNOWLEDGE_LIMITS.DESCRIPTION_MIN_LENGTH) {
    return `Business description must be at least ${BUSINESS_KNOWLEDGE_LIMITS.DESCRIPTION_MIN_LENGTH} characters.`;
  }
  if (cleaned.length > BUSINESS_KNOWLEDGE_LIMITS.DESCRIPTION_MAX_LENGTH) {
    return `Business description must be ${BUSINESS_KNOWLEDGE_LIMITS.DESCRIPTION_MAX_LENGTH} characters or fewer (currently ${cleaned.length}).`;
  }
  return checkUnsafeText(cleaned, 'Business description');
}

export function validateTargetKeywords(
  keywords: unknown,
): { ok: true; value: string[] } | { ok: false; error: string } {
  if (!Array.isArray(keywords)) {
    return { ok: false, error: 'Target keywords must be a list of strings.' };
  }
  if (keywords.length > BUSINESS_KNOWLEDGE_LIMITS.MAX_TARGET_KEYWORDS) {
    return {
      ok: false,
      error: `You can configure up to ${BUSINESS_KNOWLEDGE_LIMITS.MAX_TARGET_KEYWORDS} target keywords (received ${keywords.length}).`,
    };
  }

  const seen = new Set<string>();
  const sanitized: string[] = [];

  for (const raw of keywords) {
    if (typeof raw !== 'string') {
      return { ok: false, error: 'Each target keyword must be a text string.' };
    }
    const cleaned = stripControlChars(raw).replace(/\s+/g, ' ');
    if (!cleaned) {
      return { ok: false, error: 'Target keywords cannot be empty.' };
    }
    if (cleaned.length < BUSINESS_KNOWLEDGE_LIMITS.KEYWORD_MIN_LENGTH) {
      return {
        ok: false,
        error: `Keyword "${cleaned}" is too short (minimum ${BUSINESS_KNOWLEDGE_LIMITS.KEYWORD_MIN_LENGTH} characters).`,
      };
    }
    if (cleaned.length > BUSINESS_KNOWLEDGE_LIMITS.KEYWORD_MAX_LENGTH) {
      return {
        ok: false,
        error: `Keyword "${cleaned.slice(0, 30)}..." exceeds the ${BUSINESS_KNOWLEDGE_LIMITS.KEYWORD_MAX_LENGTH}-character limit.`,
      };
    }
    const unsafeErr = checkUnsafeText(cleaned, 'Target keyword');
    if (unsafeErr) {
      return { ok: false, error: unsafeErr };
    }

    const key = normalizeKey(cleaned);
    if (seen.has(key)) {
      return {
        ok: false,
        error: `Duplicate target keyword "${cleaned}" is not allowed.`,
      };
    }
    seen.add(key);
    sanitized.push(cleaned);
  }

  return { ok: true, value: sanitized };
}

export function validateProductsList(
  products: unknown,
): { ok: true; value: BusinessProductItem[] } | { ok: false; error: string } {
  if (!Array.isArray(products)) {
    return { ok: false, error: 'Products must be a list.' };
  }
  if (products.length > BUSINESS_KNOWLEDGE_LIMITS.MAX_PRODUCTS) {
    return {
      ok: false,
      error: `You can configure up to ${BUSINESS_KNOWLEDGE_LIMITS.MAX_PRODUCTS} products (received ${products.length}).`,
    };
  }

  const seenNames = new Set<string>();
  const sanitized: BusinessProductItem[] = [];

  for (let i = 0; i < products.length; i++) {
    const item = products[i];
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      return { ok: false, error: `Product at index ${i} is malformed.` };
    }
    const rec = item as Record<string, unknown>;
    if (typeof rec.name !== 'string') {
      return { ok: false, error: 'Product name is required.' };
    }
    const name = stripControlChars(rec.name).replace(/\s+/g, ' ');
    if (!name) {
      return { ok: false, error: 'Product name cannot be empty.' };
    }
    if (name.length > BUSINESS_KNOWLEDGE_LIMITS.PRODUCT_NAME_MAX_LENGTH) {
      return {
        ok: false,
        error: `Product name "${name.slice(0, 30)}..." exceeds ${BUSINESS_KNOWLEDGE_LIMITS.PRODUCT_NAME_MAX_LENGTH} characters.`,
      };
    }

    const rawDesc =
      rec.description === undefined || rec.description === null
        ? ''
        : rec.description;
    if (typeof rawDesc !== 'string') {
      return { ok: false, error: `Description for product "${name}" must be text.` };
    }
    const description = stripControlChars(rawDesc);
    if (
      description.length >
      BUSINESS_KNOWLEDGE_LIMITS.PRODUCT_DESCRIPTION_MAX_LENGTH
    ) {
      return {
        ok: false,
        error: `Description for product "${name}" exceeds ${BUSINESS_KNOWLEDGE_LIMITS.PRODUCT_DESCRIPTION_MAX_LENGTH} characters.`,
      };
    }

    const rawCategory =
      rec.category === undefined || rec.category === null ? '' : rec.category;
    if (typeof rawCategory !== 'string') {
      return { ok: false, error: `Category for product "${name}" must be text.` };
    }
    const category = stripControlChars(rawCategory).replace(/\s+/g, ' ');
    if (category.length > BUSINESS_KNOWLEDGE_LIMITS.PRODUCT_CATEGORY_MAX_LENGTH) {
      return {
        ok: false,
        error: `Category for product "${name}" exceeds ${BUSINESS_KNOWLEDGE_LIMITS.PRODUCT_CATEGORY_MAX_LENGTH} characters.`,
      };
    }

    const unsafeErr =
      checkUnsafeText(name, 'Product name') ||
      checkUnsafeText(description, 'Product description') ||
      checkUnsafeText(category, 'Product category');
    if (unsafeErr) {
      return { ok: false, error: unsafeErr };
    }

    const key = normalizeKey(name);
    if (seenNames.has(key)) {
      return {
        ok: false,
        error: `Duplicate product "${name}" is not allowed.`,
      };
    }
    seenNames.add(key);

    const id =
      typeof rec.id === 'string' && rec.id.trim().length > 0
        ? stripControlChars(rec.id)
        : `prod-${i + 1}-${key.replace(/[^a-z0-9]+/g, '-').slice(0, 24)}`;

    sanitized.push({
      id,
      name,
      description,
      ...(category ? { category } : {}),
    });
  }

  return { ok: true, value: sanitized };
}

export function validateServicesList(
  services: unknown,
): { ok: true; value: BusinessServiceItem[] } | { ok: false; error: string } {
  if (!Array.isArray(services)) {
    return { ok: false, error: 'Services must be a list.' };
  }
  if (services.length > BUSINESS_KNOWLEDGE_LIMITS.MAX_SERVICES) {
    return {
      ok: false,
      error: `You can configure up to ${BUSINESS_KNOWLEDGE_LIMITS.MAX_SERVICES} services (received ${services.length}).`,
    };
  }

  const seenNames = new Set<string>();
  const sanitized: BusinessServiceItem[] = [];

  for (let i = 0; i < services.length; i++) {
    const item = services[i];
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      return { ok: false, error: `Service at index ${i} is malformed.` };
    }
    const rec = item as Record<string, unknown>;
    if (typeof rec.name !== 'string') {
      return { ok: false, error: 'Service name is required.' };
    }
    const name = stripControlChars(rec.name).replace(/\s+/g, ' ');
    if (!name) {
      return { ok: false, error: 'Service name cannot be empty.' };
    }
    if (name.length > BUSINESS_KNOWLEDGE_LIMITS.SERVICE_NAME_MAX_LENGTH) {
      return {
        ok: false,
        error: `Service name "${name.slice(0, 30)}..." exceeds ${BUSINESS_KNOWLEDGE_LIMITS.SERVICE_NAME_MAX_LENGTH} characters.`,
      };
    }

    const rawDesc =
      rec.description === undefined || rec.description === null
        ? ''
        : rec.description;
    if (typeof rawDesc !== 'string') {
      return { ok: false, error: `Description for service "${name}" must be text.` };
    }
    const description = stripControlChars(rawDesc);
    if (
      description.length >
      BUSINESS_KNOWLEDGE_LIMITS.SERVICE_DESCRIPTION_MAX_LENGTH
    ) {
      return {
        ok: false,
        error: `Description for service "${name}" exceeds ${BUSINESS_KNOWLEDGE_LIMITS.SERVICE_DESCRIPTION_MAX_LENGTH} characters.`,
      };
    }

    const unsafeErr =
      checkUnsafeText(name, 'Service name') ||
      checkUnsafeText(description, 'Service description');
    if (unsafeErr) {
      return { ok: false, error: unsafeErr };
    }

    const key = normalizeKey(name);
    if (seenNames.has(key)) {
      return {
        ok: false,
        error: `Duplicate service "${name}" is not allowed.`,
      };
    }
    seenNames.add(key);

    const id =
      typeof rec.id === 'string' && rec.id.trim().length > 0
        ? stripControlChars(rec.id)
        : `svc-${i + 1}-${key.replace(/[^a-z0-9]+/g, '-').slice(0, 24)}`;

    sanitized.push({
      id,
      name,
      description,
    });
  }

  return { ok: true, value: sanitized };
}

export function validateServiceAreas(
  serviceAreas: unknown,
): { ok: true; value: string[] } | { ok: false; error: string } {
  if (!Array.isArray(serviceAreas)) {
    return { ok: false, error: 'Service areas must be a list of locations.' };
  }
  if (serviceAreas.length > BUSINESS_KNOWLEDGE_LIMITS.MAX_SERVICE_AREAS) {
    return {
      ok: false,
      error: `You can configure up to ${BUSINESS_KNOWLEDGE_LIMITS.MAX_SERVICE_AREAS} service areas (received ${serviceAreas.length}).`,
    };
  }

  const seen = new Set<string>();
  const sanitized: string[] = [];

  for (const raw of serviceAreas) {
    if (typeof raw !== 'string') {
      return { ok: false, error: 'Each service area must be a text string.' };
    }
    const cleaned = stripControlChars(raw).replace(/\s+/g, ' ');
    if (!cleaned) {
      return { ok: false, error: 'Service area location cannot be empty.' };
    }
    if (cleaned.length < BUSINESS_KNOWLEDGE_LIMITS.SERVICE_AREA_MIN_LENGTH) {
      return {
        ok: false,
        error: `Service area "${cleaned}" is too short (minimum ${BUSINESS_KNOWLEDGE_LIMITS.SERVICE_AREA_MIN_LENGTH} characters).`,
      };
    }
    if (cleaned.length > BUSINESS_KNOWLEDGE_LIMITS.SERVICE_AREA_MAX_LENGTH) {
      return {
        ok: false,
        error: `Service area "${cleaned.slice(0, 30)}..." exceeds ${BUSINESS_KNOWLEDGE_LIMITS.SERVICE_AREA_MAX_LENGTH} characters.`,
      };
    }
    const unsafeErr = checkUnsafeText(cleaned, 'Service area');
    if (unsafeErr) {
      return { ok: false, error: unsafeErr };
    }

    const key = normalizeKey(cleaned);
    if (seen.has(key)) {
      return {
        ok: false,
        error: `Duplicate service area "${cleaned}" is not allowed.`,
      };
    }
    seen.add(key);
    sanitized.push(cleaned);
  }

  return { ok: true, value: sanitized };
}

export function validateBusinessKnowledgeInput(
  businessId: unknown,
  input: unknown,
  options?: { allowEmptyDescription?: boolean },
):
  | {
      ok: true;
      value: {
        description: string;
        primaryCategory: string;
        additionalInfo: string;
        targetKeywords: string[];
        products: BusinessProductItem[];
        services: BusinessServiceItem[];
        serviceAreas: string[];
      };
    }
  | { ok: false; error: string } {
  const idErr = validateBusinessId(businessId);
  if (idErr) {
    return { ok: false, error: idErr };
  }

  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return {
      ok: false,
      error: 'Business knowledge configuration must be a valid object.',
    };
  }

  const candidate = input as Record<string, unknown>;

  const descErr = validateBusinessDescription(candidate.description, {
    allowEmpty: options?.allowEmptyDescription,
  });
  if (descErr) {
    return { ok: false, error: descErr };
  }
  const description = stripControlChars(String(candidate.description ?? ''));

  const rawCategory =
    candidate.primaryCategory === undefined ||
    candidate.primaryCategory === null
      ? ''
      : candidate.primaryCategory;
  if (typeof rawCategory !== 'string' || !stripControlChars(rawCategory)) {
    return { ok: false, error: 'Primary business category is required.' };
  }
  const primaryCategory = stripControlChars(rawCategory).replace(/\s+/g, ' ');
  if (
    primaryCategory.length >
    BUSINESS_KNOWLEDGE_LIMITS.PRIMARY_CATEGORY_MAX_LENGTH
  ) {
    return {
      ok: false,
      error: `Primary category must be ${BUSINESS_KNOWLEDGE_LIMITS.PRIMARY_CATEGORY_MAX_LENGTH} characters or fewer.`,
    };
  }
  const catUnsafeErr = checkUnsafeText(primaryCategory, 'Primary category');
  if (catUnsafeErr) {
    return { ok: false, error: catUnsafeErr };
  }

  const rawAdditional =
    candidate.additionalInfo === undefined || candidate.additionalInfo === null
      ? ''
      : candidate.additionalInfo;
  if (typeof rawAdditional !== 'string') {
    return { ok: false, error: 'Additional business information must be text.' };
  }
  const additionalInfo = stripControlChars(rawAdditional);
  if (
    additionalInfo.length >
    BUSINESS_KNOWLEDGE_LIMITS.ADDITIONAL_INFO_MAX_LENGTH
  ) {
    return {
      ok: false,
      error: `Additional information must be ${BUSINESS_KNOWLEDGE_LIMITS.ADDITIONAL_INFO_MAX_LENGTH} characters or fewer.`,
    };
  }
  const addUnsafeErr = checkUnsafeText(additionalInfo, 'Additional information');
  if (addUnsafeErr) {
    return { ok: false, error: addUnsafeErr };
  }

  const keywordsCheck = validateTargetKeywords(candidate.targetKeywords ?? []);
  if (!keywordsCheck.ok) {
    return keywordsCheck;
  }

  const productsCheck = validateProductsList(candidate.products ?? []);
  if (!productsCheck.ok) {
    return productsCheck;
  }

  const servicesCheck = validateServicesList(candidate.services ?? []);
  if (!servicesCheck.ok) {
    return servicesCheck;
  }

  const areasCheck = validateServiceAreas(candidate.serviceAreas ?? []);
  if (!areasCheck.ok) {
    return areasCheck;
  }

  return {
    ok: true,
    value: {
      description,
      primaryCategory,
      additionalInfo,
      targetKeywords: keywordsCheck.value,
      products: productsCheck.value,
      services: servicesCheck.value,
      serviceAreas: areasCheck.value,
    },
  };
}

/**
 * Returns a normalized BusinessKnowledgeProfile with sensible empty states
 * (never infers service areas from business city/address unless explicitly configured).
 */
export function normalizeBusinessKnowledgeProfile(
  businessId: string,
  defaultCategory: string,
  partial?: Partial<BusinessKnowledgeInput & BusinessKnowledgeProfile> | null,
  storageSource?: 'supabase' | 'local',
): BusinessKnowledgeProfile {
  const cleanId = businessId.trim();
  const description =
    typeof partial?.description === 'string' &&
    validateBusinessDescription(partial.description, { allowEmpty: true }) ===
      null
      ? stripControlChars(partial.description)
      : '';

  const primaryCategory =
    typeof partial?.primaryCategory === 'string' &&
    stripControlChars(partial.primaryCategory).length > 0 &&
    stripControlChars(partial.primaryCategory).length <=
      BUSINESS_KNOWLEDGE_LIMITS.PRIMARY_CATEGORY_MAX_LENGTH &&
    checkUnsafeText(partial.primaryCategory, 'Primary category') === null
      ? stripControlChars(partial.primaryCategory)
      : defaultCategory;

  const additionalInfo =
    typeof partial?.additionalInfo === 'string' &&
    stripControlChars(partial.additionalInfo).length <=
      BUSINESS_KNOWLEDGE_LIMITS.ADDITIONAL_INFO_MAX_LENGTH &&
    checkUnsafeText(partial.additionalInfo, 'Additional info') === null
      ? stripControlChars(partial.additionalInfo)
      : '';

  const keywordsRes = validateTargetKeywords(partial?.targetKeywords ?? []);
  const productsRes = validateProductsList(partial?.products ?? []);
  const servicesRes = validateServicesList(partial?.services ?? []);
  const areasRes = validateServiceAreas(partial?.serviceAreas ?? []);

  return {
    businessId: cleanId,
    description,
    primaryCategory,
    additionalInfo,
    targetKeywords: keywordsRes.ok ? keywordsRes.value : [],
    products: productsRes.ok ? productsRes.value : [],
    services: servicesRes.ok ? servicesRes.value : [],
    serviceAreas: areasRes.ok ? areasRes.value : [],
    updatedAt:
      (partial as Partial<BusinessKnowledgeProfile> | undefined)?.updatedAt ||
      new Date().toISOString(),
    storageSource:
      storageSource ??
      (partial as Partial<BusinessKnowledgeProfile> | undefined)
        ?.storageSource ??
      'local',
  };
}
