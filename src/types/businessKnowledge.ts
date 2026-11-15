import type { BusinessCategory } from './business';

export interface BusinessProductItem {
  id: string;
  name: string;
  description: string;
  category?: string;
}

export interface BusinessServiceItem {
  id: string;
  name: string;
  description: string;
}

export interface BusinessKnowledgeProfile {
  businessId: string;
  /** Core description of what the business does (e.g., "We are a vegetarian restaurant serving traditional South Indian food in Hyderabad."). */
  description: string;
  /** Business category label or classification used for business context. */
  primaryCategory: BusinessCategory | string;
  /** Optional additional factual notes about the business. */
  additionalInfo: string;
  /** Local SEO / topical keywords configured by the owner (never auto-stuffed into every response or customer review). */
  targetKeywords: string[];
  /** Configured products offered by the business. */
  products: BusinessProductItem[];
  /** Configured services provided by the business. */
  services: BusinessServiceItem[];
  /** Explicit locations/neighbourhoods served (never inferred automatically from address). */
  serviceAreas: string[];
  updatedAt: string;
  /** Indicates whether the knowledge profile is persisted in live Supabase ('supabase') or local storage ('local'). */
  storageSource?: 'supabase' | 'local';
}

export interface BusinessKnowledgeInput {
  description: string;
  primaryCategory: BusinessCategory | string;
  additionalInfo?: string;
  targetKeywords: string[];
  products: Array<Omit<BusinessProductItem, 'id'> & { id?: string }>;
  services: Array<Omit<BusinessServiceItem, 'id'> & { id?: string }>;
  serviceAreas: string[];
}

/**
 * Subset of BusinessKnowledgeProfile selectively matched to a specific AI task
 * so irrelevant catalog items or unmentioned keywords are not dumped into every prompt.
 */
export interface SelectedBusinessKnowledgeContext {
  description: string;
  primaryCategory: string;
  additionalInfo: string;
  matchedProducts: BusinessProductItem[];
  matchedServices: BusinessServiceItem[];
  matchedServiceAreas: string[];
  matchedKeywords: string[];
}

export const BUSINESS_KNOWLEDGE_LIMITS = {
  DESCRIPTION_MIN_LENGTH: 10,
  DESCRIPTION_MAX_LENGTH: 600,
  PRIMARY_CATEGORY_MAX_LENGTH: 80,
  ADDITIONAL_INFO_MAX_LENGTH: 400,
  MAX_TARGET_KEYWORDS: 15,
  KEYWORD_MIN_LENGTH: 2,
  KEYWORD_MAX_LENGTH: 80,
  MAX_PRODUCTS: 25,
  PRODUCT_NAME_MAX_LENGTH: 80,
  PRODUCT_DESCRIPTION_MAX_LENGTH: 200,
  PRODUCT_CATEGORY_MAX_LENGTH: 60,
  MAX_SERVICES: 20,
  SERVICE_NAME_MAX_LENGTH: 80,
  SERVICE_DESCRIPTION_MAX_LENGTH: 200,
  MAX_SERVICE_AREAS: 15,
  SERVICE_AREA_MIN_LENGTH: 2,
  SERVICE_AREA_MAX_LENGTH: 80,
} as const;
