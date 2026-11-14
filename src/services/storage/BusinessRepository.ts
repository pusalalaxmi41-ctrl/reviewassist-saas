import type {
  Business,
  AnalyticsEvent,
  AnalyticsEventType,
  BusinessMetrics,
  CustomerDraftRecord,
} from '../../types/business';

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

  /** Returns all review drafts for a specific business ID. */
  getDrafts(businessId: string): Promise<CustomerDraftRecord[]>;
}
