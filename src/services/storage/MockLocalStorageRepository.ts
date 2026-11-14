import type { IBusinessRepository } from './BusinessRepository';
import type {
  Business,
  AnalyticsEvent,
  AnalyticsEventType,
  BusinessMetrics,
  CustomerDraftRecord,
} from '../../types/business';

export const PLACEHOLDER_GOOGLE_REVIEW_URL =
  'https://example.com/PLACEHOLDER-google-review-link-not-configured';

const STORAGE_KEYS = {
  BUSINESSES: 'reviewassist_mock_businesses_v2',
  EVENTS: 'reviewassist_mock_events_v2',
  DRAFTS: 'reviewassist_mock_drafts_v2',
};

// Initial seed businesses for development & preview
const INITIAL_BUSINESSES: Business[] = [
  {
    id: 'biz-urban-kitchen-1',
    slug: 'the-urban-kitchen',
    name: 'The Urban Kitchen',
    category: 'restaurant',
    city: 'Hyderabad',
    googleReviewUrl: PLACEHOLDER_GOOGLE_REVIEW_URL,
    googleReviewUrlIsPlaceholder: true,
    createdAt: '2026-11-01T10:00:00.000Z',
  },
  {
    id: 'biz-blue-tokai-2',
    slug: 'blue-tokai-cafe',
    name: 'Blue Tokai Cafe',
    category: 'cafe',
    city: 'Bengaluru',
    googleReviewUrl: PLACEHOLDER_GOOGLE_REVIEW_URL,
    googleReviewUrlIsPlaceholder: true,
    createdAt: '2026-11-02T11:00:00.000Z',
  },
];

// Initial seed events for The Urban Kitchen
const INITIAL_EVENTS: AnalyticsEvent[] = [
  { id: 'ev-1', businessId: 'biz-urban-kitchen-1', eventType: 'qr_scan', timestamp: '2026-11-08T18:30:00.000Z' },
  { id: 'ev-2', businessId: 'biz-urban-kitchen-1', eventType: 'qr_scan', timestamp: '2026-11-08T19:15:00.000Z' },
  { id: 'ev-3', businessId: 'biz-urban-kitchen-1', eventType: 'feedback_submitted', timestamp: '2026-11-08T19:17:00.000Z' },
  { id: 'ev-4', businessId: 'biz-urban-kitchen-1', eventType: 'ai_generation', timestamp: '2026-11-08T19:17:30.000Z' },
  { id: 'ev-5', businessId: 'biz-urban-kitchen-1', eventType: 'google_redirect_click', timestamp: '2026-11-08T19:18:00.000Z' },
  { id: 'ev-6', businessId: 'biz-urban-kitchen-1', eventType: 'qr_scan', timestamp: '2026-11-08T20:00:00.000Z' },
  { id: 'ev-7', businessId: 'biz-urban-kitchen-1', eventType: 'feedback_submitted', timestamp: '2026-11-08T20:04:00.000Z' },
  { id: 'ev-8', businessId: 'biz-urban-kitchen-1', eventType: 'ai_generation', timestamp: '2026-11-08T20:04:30.000Z' },
  { id: 'ev-9', businessId: 'biz-urban-kitchen-1', eventType: 'google_redirect_click', timestamp: '2026-11-08T20:05:00.000Z' },
  { id: 'ev-10', businessId: 'biz-urban-kitchen-1', eventType: 'qr_scan', timestamp: '2026-11-09T08:30:00.000Z' },
];

const INITIAL_DRAFTS: CustomerDraftRecord[] = [
  {
    id: 'd-1',
    businessId: 'biz-urban-kitchen-1',
    originalInput: 'the mutton biryani was extraordinary and super tender, but wait time for drinks was around 20 mins. overall great food',
    generatedReview: 'Here is my honest experience at The Urban Kitchen. The mutton biryani was extraordinary and super tender. However, the wait time for drinks was around 20 mins. Overall great food.',
    mode: 'voice',
    sentiment: 'mixed',
    timestamp: '2026-11-08T19:17:30.000Z',
  },
  {
    id: 'd-2',
    businessId: 'biz-urban-kitchen-1',
    originalInput: 'loved the ambiance and outdoor seating! the butter chicken and garlic naan were fresh and delicious. staff was courteous',
    generatedReview: 'A few thoughts on The Urban Kitchen. Loved the ambiance and outdoor seating. The butter chicken and garlic naan were fresh and delicious. Staff was courteous.',
    mode: 'text',
    sentiment: 'positive',
    timestamp: '2026-11-08T20:04:30.000Z',
  },
];

/**
 * MockLocalStorageRepository
 *
 * Implements IBusinessRepository using local browser storage with clearly marked
 * temporary mock data. When Supabase is connected, a SupabaseBusinessRepository
 * will be swapped in without modifying any UI components.
 */
export class MockLocalStorageRepository implements IBusinessRepository {
  private memoryStore = new Map<string, string>();

  private read<T>(key: string, fallback: T): T {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const data = localStorage.getItem(key);
        if (!data) return fallback;
        return JSON.parse(data) as T;
      }
    } catch {
      // fallback to memoryStore
    }
    const mem = this.memoryStore.get(key);
    if (!mem) return fallback;
    try {
      return JSON.parse(mem) as T;
    } catch {
      return fallback;
    }
  }

  private write<T>(key: string, value: T): void {
    const serialized = JSON.stringify(value);
    this.memoryStore.set(key, serialized);
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem(key, serialized);
      }
    } catch (e) {
      console.warn('LocalStorage write failed:', e);
    }
  }

  async getBusinesses(): Promise<Business[]> {
    const list = this.read<Business[]>(STORAGE_KEYS.BUSINESSES, []);
    if (list.length === 0) {
      this.write(STORAGE_KEYS.BUSINESSES, INITIAL_BUSINESSES);
      return INITIAL_BUSINESSES;
    }
    return list;
  }

  async getBusinessById(id: string): Promise<Business | null> {
    const list = await this.getBusinesses();
    return list.find((b) => b.id === id) ?? null;
  }

  async getBusinessBySlug(slug: string): Promise<Business | null> {
    if (!slug) return null;
    const list = await this.getBusinesses();
    return list.find((b) => b.slug.toLowerCase() === slug.toLowerCase()) ?? null;
  }

  async createBusiness(data: Omit<Business, 'id' | 'createdAt'>): Promise<Business> {
    const list = await this.getBusinesses();
    const newBiz: Business = {
      ...data,
      id: `biz-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      createdAt: new Date().toISOString(),
    };
    const updated = [newBiz, ...list];
    this.write(STORAGE_KEYS.BUSINESSES, updated);
    return newBiz;
  }

  async updateBusinessGoogleUrl(
    businessId: string,
    url: string,
    isPlaceholder = false,
  ): Promise<Business> {
    const list = await this.getBusinesses();
    const index = list.findIndex((b) => b.id === businessId);
    if (index === -1) {
      throw new Error(`Business with ID ${businessId} not found.`);
    }

    const updatedBiz: Business = {
      ...list[index],
      googleReviewUrl: url,
      googleReviewUrlIsPlaceholder: isPlaceholder,
    };

    list[index] = updatedBiz;
    this.write(STORAGE_KEYS.BUSINESSES, list);
    return updatedBiz;
  }

  async trackEvent(event: {
    businessId: string;
    eventType: AnalyticsEventType;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    const events = this.read<AnalyticsEvent[]>(STORAGE_KEYS.EVENTS, INITIAL_EVENTS);
    const newEvent: AnalyticsEvent = {
      id: `ev-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      businessId: event.businessId,
      eventType: event.eventType,
      timestamp: new Date().toISOString(),
      metadata: event.metadata,
    };
    events.unshift(newEvent);
    this.write(STORAGE_KEYS.EVENTS, events);
  }

  async getEvents(businessId: string): Promise<AnalyticsEvent[]> {
    const events = this.read<AnalyticsEvent[]>(STORAGE_KEYS.EVENTS, INITIAL_EVENTS);
    return events.filter((e) => e.businessId === businessId);
  }

  async getMetrics(businessId: string): Promise<BusinessMetrics> {
    const events = await this.getEvents(businessId);
    let qrScans = 0;
    let feedbackSubmissions = 0;
    let aiGenerations = 0;
    let googleRedirectClicks = 0;

    for (const ev of events) {
      switch (ev.eventType) {
        case 'qr_scan':
          qrScans++;
          break;
        case 'feedback_submitted':
          feedbackSubmissions++;
          break;
        case 'ai_generation':
          aiGenerations++;
          break;
        case 'google_redirect_click':
          googleRedirectClicks++;
          break;
      }
    }

    return {
      qrScans,
      feedbackSubmissions,
      aiGenerations,
      googleRedirectClicks,
    };
  }

  async recordDraft(draft: Omit<CustomerDraftRecord, 'id' | 'timestamp'>): Promise<CustomerDraftRecord> {
    const drafts = this.read<CustomerDraftRecord[]>(STORAGE_KEYS.DRAFTS, INITIAL_DRAFTS);
    const newDraft: CustomerDraftRecord = {
      ...draft,
      id: `draft-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      timestamp: new Date().toISOString(),
    };
    drafts.unshift(newDraft);
    this.write(STORAGE_KEYS.DRAFTS, drafts);
    return newDraft;
  }

  async getDrafts(businessId: string): Promise<CustomerDraftRecord[]> {
    const drafts = this.read<CustomerDraftRecord[]>(STORAGE_KEYS.DRAFTS, INITIAL_DRAFTS);
    return drafts.filter((d) => d.businessId === businessId);
  }
}

// Export singleton instance of the repository
export const businessRepository: IBusinessRepository = new MockLocalStorageRepository();
