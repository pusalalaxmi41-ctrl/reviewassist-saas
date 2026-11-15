import type {
  AIConfigAccessOptions,
  IBusinessRepository,
} from './BusinessRepository';
import type {
  Business,
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
import {
  normalizeBusinessAIConfig,
  validateBusinessAIConfigInput,
  validateBusinessId,
} from '../../utils/aiConfigValidation';
import {
  normalizeBusinessKnowledgeProfile,
  validateBusinessKnowledgeInput,
} from '../../utils/businessKnowledgeValidation';
import {
  filterActiveRetentionDrafts,
  validateResponseWorkflowUpdate,
} from '../../utils/reviewResponseValidation';

export const PLACEHOLDER_GOOGLE_REVIEW_URL =
  'https://example.com/PLACEHOLDER-google-review-link-not-configured';

const STORAGE_KEYS = {
  BUSINESSES: 'reviewassist_mock_businesses_v2',
  EVENTS: 'reviewassist_mock_events_v2',
  DRAFTS: 'reviewassist_mock_drafts_v2',
  AI_CONFIGS: 'reviewassist_mock_ai_configs_v1',
  KNOWLEDGE_PROFILES: 'reviewassist_mock_knowledge_v1',
};

// Initial seed businesses for development & preview
const INITIAL_BUSINESSES: Business[] = [
  {
    id: 'biz-urban-kitchen-1',
    ownerId: 'owner-urban-1',
    slug: 'the-urban-kitchen',
    name: 'The Urban Kitchen',
    category: 'restaurant',
    city: 'Hyderabad',
    googleReviewUrl: PLACEHOLDER_GOOGLE_REVIEW_URL,
    googleReviewUrlIsPlaceholder: true,
    status: 'active',
    accountState: 'active',
    createdAt: '2026-11-01T10:00:00.000Z',
  },
  {
    id: 'biz-blue-tokai-2',
    ownerId: 'owner-bluetokai-2',
    slug: 'blue-tokai-cafe',
    name: 'Blue Tokai Cafe',
    category: 'cafe',
    city: 'Bengaluru',
    googleReviewUrl: PLACEHOLDER_GOOGLE_REVIEW_URL,
    googleReviewUrlIsPlaceholder: true,
    status: 'pending',
    accountState: 'active',
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
    ownerResponseDraft: null,
    responseStatus: 'pending',
    responseAttempt: 0,
  },
  {
    id: 'd-2',
    businessId: 'biz-urban-kitchen-1',
    originalInput: 'loved the ambiance and outdoor seating! the butter chicken and garlic naan were fresh and delicious. staff was courteous',
    generatedReview: 'A few thoughts on The Urban Kitchen. Loved the ambiance and outdoor seating. The butter chicken and garlic naan were fresh and delicious. Staff was courteous.',
    mode: 'text',
    sentiment: 'positive',
    timestamp: '2026-11-08T20:04:30.000Z',
    ownerResponseDraft: null,
    responseStatus: 'pending',
    responseAttempt: 0,
  },
  {
    id: 'd-3',
    businessId: 'biz-urban-kitchen-1',
    originalInput: 'visited for weekday lunch around 1pm and ordered the veg thali and lime soda at the ground floor dining hall.',
    generatedReview: 'Visited The Urban Kitchen for weekday lunch around 1pm and ordered the veg thali and lime soda at the ground floor dining hall.',
    mode: 'text',
    sentiment: 'neutral',
    timestamp: '2026-11-09T13:20:00.000Z',
    ownerResponseDraft: null,
    responseStatus: 'pending',
    responseAttempt: 0,
  },
  {
    id: 'd-4',
    businessId: 'biz-urban-kitchen-1',
    originalInput: 'the soup was cold and the table was not clean when we arrived. waited too long for the bill.',
    generatedReview: 'The soup was cold and the table was not clean when we arrived. Waited too long for the bill.',
    mode: 'text',
    sentiment: 'negative',
    timestamp: '2026-11-10T21:10:00.000Z',
    ownerResponseDraft: null,
    responseStatus: 'pending',
    responseAttempt: 0,
  },
];

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
    return list.map((b) => ({
      ...b,
      status: b.status ?? 'active',
      accountState: b.accountState ?? 'active',
    }));
  }

  async getBusinessById(id: string): Promise<Business | null> {
    const list = await this.getBusinesses();
    return list.find((b) => b.id === id) ?? null;
  }

  async getBusinessBySlug(slug: string): Promise<Business | null> {
    if (!slug) return null;
    const list = await this.getBusinesses();
    const found = list.find((b) => b.slug.toLowerCase() === slug.toLowerCase()) ?? null;
    if (!found) return null;
    // Only 'active' businesses with 'active' accountState are served publicly
    if ((found.status ?? 'active') !== 'active' || (found.accountState ?? 'active') !== 'active') {
      return null;
    }
    return found;
  }

  async createBusiness(data: Omit<Business, 'id' | 'createdAt'>): Promise<Business> {
    const list = await this.getBusinesses();
    const now = new Date().toISOString();
    const newBiz: Business = {
      ...data,
      id: `biz-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      status: 'pending',
      statusChangedAt: now,
      statusReason: null,
      accountState: 'active',
      createdAt: now,
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
      ownerResponseDraft: draft.ownerResponseDraft ?? null,
      responseStatus: draft.responseStatus ?? 'pending',
      responseAttempt: draft.responseAttempt ?? 0,
      responseGeneratedAt: draft.responseGeneratedAt ?? null,
      responseApprovedAt: draft.responseApprovedAt ?? null,
      responseCompletedAt: draft.responseCompletedAt ?? null,
      responseUpdatedAt: draft.responseUpdatedAt ?? null,
    };
    drafts.unshift(newDraft);
    this.write(STORAGE_KEYS.DRAFTS, drafts);
    return newDraft;
  }

  async getDrafts(
    businessId: string,
    options?: AIConfigAccessOptions,
  ): Promise<CustomerDraftRecord[]> {
    const idErr = validateBusinessId(businessId);
    if (idErr) {
      throw new Error(idErr);
    }

    const cleanId = businessId.trim();
    const business = await this.getBusinessById(cleanId);
    if (!business) {
      throw new Error(`Business with ID "${cleanId}" not found.`);
    }

    this.assertOwnerAccess(business, options);

    const drafts = this.read<CustomerDraftRecord[]>(
      STORAGE_KEYS.DRAFTS,
      INITIAL_DRAFTS,
    );
    const tenantDrafts = drafts
      .filter((d) => d.businessId === cleanId)
      .map((d) => ({
        ...d,
        ownerResponseDraft: d.ownerResponseDraft ?? null,
        responseStatus: d.responseStatus ?? 'pending',
        responseAttempt: d.responseAttempt ?? 0,
      }));

    return filterActiveRetentionDrafts(tenantDrafts);
  }

  async updateDraftResponse(
    businessId: string,
    draftId: string,
    update: {
      responseDraft: string | null;
      status: ResponseWorkflowStatus;
      attempt?: number;
    },
    options?: AIConfigAccessOptions,
  ): Promise<CustomerDraftRecord> {
    const idErr = validateBusinessId(businessId);
    if (idErr) {
      throw new Error(idErr);
    }

    const cleanBizId = businessId.trim();
    const business = await this.getBusinessById(cleanBizId);
    if (!business) {
      throw new Error(`Business with ID "${cleanBizId}" not found.`);
    }

    this.assertOwnerAccess(business, options);

    const drafts = this.read<CustomerDraftRecord[]>(
      STORAGE_KEYS.DRAFTS,
      INITIAL_DRAFTS,
    );
    const idx = drafts.findIndex((d) => d.id === draftId);
    if (idx === -1) {
      throw new Error(`Review draft "${draftId}" not found.`);
    }

    const existing = drafts[idx];
    if (existing.businessId !== cleanBizId) {
      throw new Error(
        `Unauthorized: Review draft "${draftId}" does not belong to business "${cleanBizId}".`,
      );
    }

    const currentStatus: ResponseWorkflowStatus =
      existing.responseStatus ?? 'pending';
    const workflowValidation = validateResponseWorkflowUpdate({
      currentStatus,
      nextStatus: update.status,
      responseDraft: update.responseDraft,
    });

    if (!workflowValidation.ok) {
      throw new Error(workflowValidation.error);
    }

    const now = new Date().toISOString();
    const nextAttempt =
      typeof update.attempt === 'number' && update.attempt >= 0
        ? Math.floor(update.attempt)
        : (existing.responseAttempt ?? 0);

    const updatedRecord: CustomerDraftRecord = {
      ...existing,
      ownerResponseDraft: workflowValidation.cleanedDraft,
      responseStatus: update.status,
      responseAttempt: nextAttempt,
      responseGeneratedAt:
        update.status === 'draft_generated'
          ? now
          : (existing.responseGeneratedAt ?? now),
      responseApprovedAt:
        update.status === 'approved'
          ? now
          : update.status === 'completed'
            ? (existing.responseApprovedAt ?? now)
            : null,
      responseCompletedAt: update.status === 'completed' ? now : null,
      responseUpdatedAt: now,
    };

    drafts[idx] = updatedRecord;
    this.write(STORAGE_KEYS.DRAFTS, drafts);
    return updatedRecord;
  }

  private assertOwnerAccess(
    business: Business,
    options?: AIConfigAccessOptions,
  ): void {
    if (
      options?.actorOwnerId &&
      business.ownerId &&
      options.actorOwnerId !== business.ownerId
    ) {
      throw new Error(
        `Unauthorized: Owner "${options.actorOwnerId}" cannot access or modify AI configuration for business "${business.id}".`,
      );
    }
  }

  async getBusinessAIConfig(
    businessId: string,
    options?: AIConfigAccessOptions,
  ): Promise<BusinessAIConfig> {
    const idErr = validateBusinessId(businessId);
    if (idErr) {
      throw new Error(idErr);
    }

    const cleanId = businessId.trim();
    const business = await this.getBusinessById(cleanId);
    if (!business) {
      throw new Error(`Business with ID "${cleanId}" not found.`);
    }

    this.assertOwnerAccess(business, options);

    const store = this.read<Record<string, BusinessAIConfig>>(
      STORAGE_KEYS.AI_CONFIGS,
      {},
    );
    const existing = store[cleanId];
    if (!existing) {
      return normalizeBusinessAIConfig(cleanId, undefined, 'local');
    }

    return normalizeBusinessAIConfig(cleanId, existing, 'local');
  }

  async updateBusinessAIConfig(
    businessId: string,
    input: BusinessAIConfigInput,
    options?: AIConfigAccessOptions,
  ): Promise<BusinessAIConfig> {
    const validation = validateBusinessAIConfigInput(businessId, input);
    if (!validation.ok) {
      throw new Error(validation.error);
    }

    const cleanId = businessId.trim();
    const business = await this.getBusinessById(cleanId);
    if (!business) {
      throw new Error(`Business with ID "${cleanId}" not found.`);
    }

    this.assertOwnerAccess(business, options);

    const store = this.read<Record<string, BusinessAIConfig>>(
      STORAGE_KEYS.AI_CONFIGS,
      {},
    );
    const updated: BusinessAIConfig = {
      businessId: cleanId,
      tone: validation.value.tone,
      customInstructions: validation.value.customInstructions,
      responseLength: validation.value.responseLength,
      language: validation.value.language,
      updatedAt: new Date().toISOString(),
      storageSource: 'local',
    };

    store[cleanId] = updated;
    this.write(STORAGE_KEYS.AI_CONFIGS, store);
    return updated;
  }

  async getBusinessKnowledge(
    businessId: string,
    options?: AIConfigAccessOptions,
  ): Promise<BusinessKnowledgeProfile> {
    const idErr = validateBusinessId(businessId);
    if (idErr) {
      throw new Error(idErr);
    }

    const cleanId = businessId.trim();
    const business = await this.getBusinessById(cleanId);
    if (!business) {
      throw new Error(`Business with ID "${cleanId}" not found.`);
    }

    this.assertOwnerAccess(business, options);

    const store = this.read<Record<string, BusinessKnowledgeProfile>>(
      STORAGE_KEYS.KNOWLEDGE_PROFILES,
      {},
    );
    const existing = store[cleanId];
    if (!existing) {
      return normalizeBusinessKnowledgeProfile(
        cleanId,
        business.category,
        undefined,
        'local',
      );
    }

    return normalizeBusinessKnowledgeProfile(
      cleanId,
      business.category,
      existing,
      'local',
    );
  }

  async updateBusinessKnowledge(
    businessId: string,
    input: BusinessKnowledgeInput,
    options?: AIConfigAccessOptions,
  ): Promise<BusinessKnowledgeProfile> {
    const validation = validateBusinessKnowledgeInput(businessId, input);
    if (!validation.ok) {
      throw new Error(validation.error);
    }

    const cleanId = businessId.trim();
    const business = await this.getBusinessById(cleanId);
    if (!business) {
      throw new Error(`Business with ID "${cleanId}" not found.`);
    }

    this.assertOwnerAccess(business, options);

    const store = this.read<Record<string, BusinessKnowledgeProfile>>(
      STORAGE_KEYS.KNOWLEDGE_PROFILES,
      {},
    );

    const updated: BusinessKnowledgeProfile = {
      businessId: cleanId,
      description: validation.value.description,
      primaryCategory: validation.value.primaryCategory,
      additionalInfo: validation.value.additionalInfo,
      targetKeywords: validation.value.targetKeywords,
      products: validation.value.products,
      services: validation.value.services,
      serviceAreas: validation.value.serviceAreas,
      updatedAt: new Date().toISOString(),
      storageSource: 'local',
    };

    store[cleanId] = updated;
    this.write(STORAGE_KEYS.KNOWLEDGE_PROFILES, store);
    return updated;
  }
}

export const businessRepository: IBusinessRepository = new MockLocalStorageRepository();
