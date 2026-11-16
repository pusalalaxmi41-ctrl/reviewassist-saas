import type {
  Business,
  BusinessCategory,
  AnalyticsEvent,
  AnalyticsEventType,
  BusinessMetrics,
  CustomerDraftRecord,
  ResponseWorkflowStatus,
} from '../../types/business';
import type {
  BusinessAIConfig,
  BusinessAIConfigInput,
} from '../../types/aiConfig';
import type {
  BusinessKnowledgeInput,
  BusinessKnowledgeProfile,
} from '../../types/businessKnowledge';

export interface AIConfigAccessOptions {
  /** Optional explicit owner ID used to verify tenant isolation. */
  actorOwnerId?: string;
}

export interface IBusinessRepository {
  /** Retrieves all registered businesses. */
  getBusinesses(): Promise<Business[]>;

  /** Retrieves a specific business by ID. */
  getBusinessById(id: string): Promise<Business | null>;

  /** Retrieves a specific business by URL slug. */
  getBusinessBySlug(slug: string): Promise<Business | null>;

  /** Creates and registers a new business. */
  createBusiness(data: Omit<Business, 'id' | 'createdAt'>): Promise<Business>;

  /** Updates the business's Google review URL and placeholder status. */
  updateBusinessGoogleUrl(
    businessId: string,
    url: string,
    isPlaceholder?: boolean,
  ): Promise<Business>;

  /** Updates the business's category (updates QR quick-highlight options). */
  updateBusinessCategory(
    businessId: string,
    category: BusinessCategory,
  ): Promise<Business>;

  /** Records an analytics interaction event (QR scan, feedback, AI generation, Google redirect). */
  trackEvent(event: {
    businessId: string;
    eventType: AnalyticsEventType;
    metadata?: Record<string, unknown>;
  }): Promise<void>;

  /** Returns aggregated event metrics for a specific business ID. */
  getMetrics(businessId: string): Promise<BusinessMetrics>;

  /** Returns the chronological event log for a specific business ID. */
  getEvents(businessId: string): Promise<AnalyticsEvent[]>;

  /** Records a customer review draft generated during the customer flow. */
  recordDraft(draft: Omit<CustomerDraftRecord, 'id' | 'timestamp'>): Promise<CustomerDraftRecord>;

  /** Returns all review drafts for a specific business ID (respecting the 90-day retention window). */
  getDrafts(
    businessId: string,
    options?: AIConfigAccessOptions,
  ): Promise<CustomerDraftRecord[]>;

  /** Updates the business owner's response draft and workflow status for a specific customer draft record. */
  updateDraftResponse(
    businessId: string,
    draftId: string,
    update: {
      responseDraft: string | null;
      status: ResponseWorkflowStatus;
      attempt?: number;
    },
    options?: AIConfigAccessOptions,
  ): Promise<CustomerDraftRecord>;

  /** Retrieves the AI Configuration for a specific business ID. */
  getBusinessAIConfig(
    businessId: string,
    options?: AIConfigAccessOptions,
  ): Promise<BusinessAIConfig>;

  /** Validates and saves the AI Configuration for a specific business ID. */
  updateBusinessAIConfig(
    businessId: string,
    input: BusinessAIConfigInput,
    options?: AIConfigAccessOptions,
  ): Promise<BusinessAIConfig>;

  /** Retrieves the Business Knowledge & Local SEO profile for a specific business ID. */
  getBusinessKnowledge(
    businessId: string,
    options?: AIConfigAccessOptions,
  ): Promise<BusinessKnowledgeProfile>;

  /** Validates and saves the Business Knowledge & Local SEO profile for a specific business ID. */
  updateBusinessKnowledge(
    businessId: string,
    input: BusinessKnowledgeInput,
    options?: AIConfigAccessOptions,
  ): Promise<BusinessKnowledgeProfile>;
}
