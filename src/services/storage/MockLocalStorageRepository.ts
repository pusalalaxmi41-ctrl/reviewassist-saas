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
import {
  RESTAURANT_LIMITS,
  type ApplyMenuPresetResult,
  type MenuPresetKey,
  type PublicRestaurantMenuPayload,
  type PublicStaffLoginOption,
  type RestaurantCustomer,
  type RestaurantCustomerCheckInInput,
  type RestaurantCustomerWalletState,
  type RestaurantFloorAndAnalyticsPayload,
  type RestaurantGameCompletionResponse,
  type RestaurantGameConfig,
  type RestaurantGameConfigInput,
  type RestaurantGameParticipationStats,
  type RestaurantGamePointTransaction,
  type RestaurantGameSession,
  type RestaurantGameSlug,
  type RestaurantGameStartResponse,
  type RestaurantGameSubmissionInput,
  type RestaurantLoyaltyRules,
  type RestaurantLoyaltyRulesInput,
  type RestaurantLoyaltyStarTransaction,
  type RestaurantMenuCategory,
  type RestaurantMenuCategoryInput,
  type RestaurantMenuItem,
  type RestaurantMenuItemInput,
  type RestaurantMonthlyInventoryInput,
  type RestaurantMonthlyInventoryItem,
  type RestaurantPointToStarExchangeResponse,
  type RestaurantProfile,
  type RestaurantProfileInput,
  type RestaurantReward,
  type RestaurantRewardClaim,
  type RestaurantRewardClaimResponse,
  type RestaurantRewardInput,
  type RestaurantStaffAwardVisitResponse,
  type RestaurantStaffMember,
  type RestaurantStaffMemberInput,
  type RestaurantSuggestion,
  type RestaurantSuggestionInput,
  type RestaurantTable,
  type RestaurantTableCall,
  type RestaurantTableCallStatus,
  type RestaurantTableCallType,
  type RestaurantTableInput,
  type RestaurantTableOrder,
  type RestaurantTableOrderItem,
  type RestaurantTableOrderStatus,
  type RestaurantVerifiedVisit,
  type VerifiedStaffMemberSession,
} from '../../types/restaurant';
import type {
  AdvanceBarberQueueTicketResult,
  BarberQueueConfig,
  BarberQueueConfigInput,
  BarberQueueDelayIncrement,
  BarberQueueTicket,
  BarberQueueTicketStatus,
  ExtendBarberQueueTimerResult,
  JoinBarberQueueInput,
  JoinBarberQueueResult,
  PublicBarberQueueStatusPayload,
} from '../../types/barberQueue';
import {
  getTodayQueueDateKey,
  isBarberOrSalonCategory,
  normalizeBarberQueueConfig,
  validateBarberDelayMinutes,
  validateBarberQueueConfigInput,
  validateBarberTicketStatus,
  validateJoinBarberQueueInput,
} from '../../utils/barberQueueValidation';
import { MENU_PRESET_PACKS } from '../../config/menuPresets';
import {
  buildServerSeedAndClientChallenge,
  deriveTableKey,
  formatStaffAuditLabel,
  generateNextStaffCode,
  generateRewardClaimCode,
  getDefaultRestaurantGameConfigs,
  normalizeRestaurantLoyaltyRules,
  normalizeRestaurantProfile,
  parseCustomerLoyaltyLookup,
  validateMenuPresetKey,
  validateMonthlyInventoryInput,
  validateRestaurantCustomerCheckInInput,
  validateRestaurantGameConfigInput,
  validateRestaurantLoyaltyRulesInput,
  validateRestaurantMenuCategoryInput,
  validateRestaurantMenuItemInput,
  validateRestaurantProfileInput,
  validateRestaurantRewardInput,
  validateRestaurantSuggestionInput,
  validateRestaurantTableInput,
  validateStaffMemberInput,
  validateTableOrderItemsInput,
  validateTableOrderStatus,
  verifyGameSubmissionAgainstServerSeed,
} from '../../utils/restaurantValidation';

export const PLACEHOLDER_GOOGLE_REVIEW_URL =
  'https://example.com/PLACEHOLDER-google-review-link-not-configured';

const STORAGE_KEYS = {
  BUSINESSES: 'reviewassist_mock_businesses_v2',
  EVENTS: 'reviewassist_mock_events_v2',
  DRAFTS: 'reviewassist_mock_drafts_v2',
  AI_CONFIGS: 'reviewassist_mock_ai_configs_v1',
  KNOWLEDGE_PROFILES: 'reviewassist_mock_knowledge_v1',
  RESTAURANT_PROFILES: 'reviewassist_mock_restaurant_profiles_v1',
  RESTAURANT_TABLES: 'reviewassist_mock_restaurant_tables_v1',
  RESTAURANT_CATEGORIES: 'reviewassist_mock_restaurant_categories_v1',
  RESTAURANT_ITEMS: 'reviewassist_mock_restaurant_items_v1',
  RESTAURANT_GAME_CONFIGS: 'reviewassist_mock_restaurant_game_configs_v1',
  RESTAURANT_CUSTOMERS: 'reviewassist_mock_restaurant_customers_v1',
  RESTAURANT_GAME_SESSIONS: 'reviewassist_mock_restaurant_game_sessions_v1',
  RESTAURANT_GAME_POINT_TXS: 'reviewassist_mock_restaurant_game_point_txs_v1',
  RESTAURANT_LOYALTY_RULES: 'reviewassist_mock_restaurant_loyalty_rules_v1',
  RESTAURANT_LOYALTY_STAR_TXS: 'reviewassist_mock_restaurant_loyalty_star_txs_v1',
  RESTAURANT_REWARDS: 'reviewassist_mock_restaurant_rewards_v1',
  RESTAURANT_REWARD_CLAIMS: 'reviewassist_mock_restaurant_reward_claims_v1',
  RESTAURANT_SUGGESTIONS: 'reviewassist_mock_restaurant_suggestions_v1',
  RESTAURANT_TABLE_CALLS: 'reviewassist_mock_restaurant_table_calls_v1',
  RESTAURANT_VERIFIED_VISITS: 'reviewassist_mock_restaurant_verified_visits_v1',
  RESTAURANT_TABLE_ORDERS: 'reviewassist_mock_restaurant_table_orders_v1',
  RESTAURANT_STAFF_MEMBERS: 'reviewassist_mock_restaurant_staff_members_v1',
  RESTAURANT_MONTHLY_INVENTORY:
    'reviewassist_mock_restaurant_monthly_inventory_v1',
  BARBER_QUEUE_CONFIGS: 'reviewassist_mock_barber_queue_configs_v1',
  BARBER_QUEUE_TICKETS: 'reviewassist_mock_barber_queue_tickets_v1',
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
  {
    id: 'biz-crown-cuts-3',
    ownerId: 'owner-crown-cuts-3',
    slug: 'crown-cuts-barber',
    name: 'Crown Cuts Barbershop',
    category: 'barber',
    city: 'Bengaluru',
    googleReviewUrl: PLACEHOLDER_GOOGLE_REVIEW_URL,
    googleReviewUrlIsPlaceholder: true,
    status: 'active',
    accountState: 'active',
    createdAt: '2026-11-03T09:30:00.000Z',
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

  async updateBusinessCategory(
    businessId: string,
    category: Business['category'],
  ): Promise<Business> {
    const list = await this.getBusinesses();
    const index = list.findIndex((b) => b.id === businessId);
    if (index === -1) {
      throw new Error(`Business with ID ${businessId} not found.`);
    }

    const updatedBiz: Business = {
      ...list[index],
      category,
    };

    list[index] = updatedBiz;
    this.write(STORAGE_KEYS.BUSINESSES, list);
    return updatedBiz;
  }

  async updateBusinessReviewFont(
    businessId: string,
    reviewFont: NonNullable<Business['reviewFont']>,
  ): Promise<Business> {
    const list = await this.getBusinesses();
    const index = list.findIndex((b) => b.id === businessId);
    if (index === -1) {
      throw new Error(`Business with ID ${businessId} not found.`);
    }

    const updatedBiz: Business = {
      ...list[index],
      reviewFont,
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

  // ---------------------------------------------------------------------------
  // Phase 1: Restaurant Foundation, Tables & Digital Menu
  // ---------------------------------------------------------------------------

  async getRestaurantProfile(
    businessId: string,
    options?: AIConfigAccessOptions,
  ): Promise<RestaurantProfile> {
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

    const store = this.read<Record<string, RestaurantProfile>>(
      STORAGE_KEYS.RESTAURANT_PROFILES,
      {},
    );
    return normalizeRestaurantProfile(cleanId, store[cleanId], 'local');
  }

  async updateRestaurantProfile(
    businessId: string,
    input: RestaurantProfileInput,
    options?: AIConfigAccessOptions,
  ): Promise<RestaurantProfile> {
    const validation = validateRestaurantProfileInput(businessId, input);
    if (!validation.ok) {
      throw new Error(validation.error);
    }
    const cleanId = businessId.trim();
    const business = await this.getBusinessById(cleanId);
    if (!business) {
      throw new Error(`Business with ID "${cleanId}" not found.`);
    }
    this.assertOwnerAccess(business, options);

    const store = this.read<Record<string, RestaurantProfile>>(
      STORAGE_KEYS.RESTAURANT_PROFILES,
      {},
    );
    const existing = store[cleanId];
    const updated: RestaurantProfile = {
      businessId: cleanId,
      isEnabled: validation.value.isEnabled,
      currencyCode: validation.value.currencyCode,
      tagline: validation.value.tagline,
      gamesEnabled: validation.value.gamesEnabled,
      loyaltyEnabled: validation.value.loyaltyEnabled,
      staffPinHash:
        validation.value.staffPinHash !== undefined
          ? validation.value.staffPinHash
          : (existing?.staffPinHash ?? null),
      minHoursBetweenVisitStars:
        validation.value.minHoursBetweenVisitStars !== undefined
          ? validation.value.minHoursBetweenVisitStars
          : (existing?.minHoursBetweenVisitStars ?? 4),
      tableOrderingEnabled:
        validation.value.tableOrderingEnabled !== undefined
          ? validation.value.tableOrderingEnabled
          : Boolean(existing?.tableOrderingEnabled),
      menuThemeTemplate:
        validation.value.menuThemeTemplate !== undefined
          ? validation.value.menuThemeTemplate
          : (existing?.menuThemeTemplate ?? 'default'),
      businessMode:
        validation.value.businessMode !== undefined
          ? validation.value.businessMode
          : (existing?.businessMode ?? 'restaurant'),
      customLogoUrl:
        validation.value.customLogoUrl !== undefined
          ? validation.value.customLogoUrl
          : (existing?.customLogoUrl ?? null),
      customAccentColor:
        validation.value.customAccentColor !== undefined
          ? validation.value.customAccentColor
          : (existing?.customAccentColor ?? null),
      updatedAt: new Date().toISOString(),
      storageSource: 'local',
    };
    store[cleanId] = updated;
    this.write(STORAGE_KEYS.RESTAURANT_PROFILES, store);
    return updated;
  }

  async getRestaurantTables(
    businessId: string,
    options?: AIConfigAccessOptions,
  ): Promise<RestaurantTable[]> {
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

    const store = this.read<Record<string, RestaurantTable[]>>(
      STORAGE_KEYS.RESTAURANT_TABLES,
      {},
    );
    return [...(store[cleanId] ?? [])];
  }

  async createRestaurantTable(
    businessId: string,
    input: RestaurantTableInput,
    options?: AIConfigAccessOptions,
  ): Promise<RestaurantTable> {
    const validation = validateRestaurantTableInput(businessId, input);
    if (!validation.ok) {
      throw new Error(validation.error);
    }
    const cleanId = businessId.trim();
    const business = await this.getBusinessById(cleanId);
    if (!business) {
      throw new Error(`Business with ID "${cleanId}" not found.`);
    }
    this.assertOwnerAccess(business, options);

    const store = this.read<Record<string, RestaurantTable[]>>(
      STORAGE_KEYS.RESTAURANT_TABLES,
      {},
    );
    const list = store[cleanId] ?? [];
    if (list.length >= RESTAURANT_LIMITS.MAX_TABLES_PER_BUSINESS) {
      throw new Error(
        `Maximum of ${RESTAURANT_LIMITS.MAX_TABLES_PER_BUSINESS} tables reached.`,
      );
    }
    if (list.some((t) => t.tableKey === validation.value.tableKey)) {
      throw new Error(
        `Duplicate table key "${validation.value.tableKey}" already exists for this business.`,
      );
    }

    const now = new Date().toISOString();
    const created: RestaurantTable = {
      id: `tbl-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      businessId: cleanId,
      tableNumber: validation.value.tableNumber,
      tableLabel: validation.value.tableLabel,
      tableKey: validation.value.tableKey,
      isActive: validation.value.isActive,
      createdAt: now,
      updatedAt: now,
    };
    store[cleanId] = [...list, created];
    this.write(STORAGE_KEYS.RESTAURANT_TABLES, store);
    return created;
  }

  async updateRestaurantTable(
    businessId: string,
    tableId: string,
    input: RestaurantTableInput,
    options?: AIConfigAccessOptions,
  ): Promise<RestaurantTable> {
    const validation = validateRestaurantTableInput(businessId, input);
    if (!validation.ok) {
      throw new Error(validation.error);
    }
    const cleanId = businessId.trim();
    const business = await this.getBusinessById(cleanId);
    if (!business) {
      throw new Error(`Business with ID "${cleanId}" not found.`);
    }
    this.assertOwnerAccess(business, options);

    const store = this.read<Record<string, RestaurantTable[]>>(
      STORAGE_KEYS.RESTAURANT_TABLES,
      {},
    );
    const list = store[cleanId] ?? [];
    const idx = list.findIndex((t) => t.id === tableId);
    if (idx === -1) {
      throw new Error(`Table "${tableId}" not found for business "${cleanId}".`);
    }
    if (
      list.some(
        (t, i) => i !== idx && t.tableKey === validation.value.tableKey,
      )
    ) {
      throw new Error(
        `Duplicate table key "${validation.value.tableKey}" already exists for this business.`,
      );
    }

    const updated: RestaurantTable = {
      ...list[idx],
      tableNumber: validation.value.tableNumber,
      tableLabel: validation.value.tableLabel,
      tableKey: validation.value.tableKey,
      isActive: validation.value.isActive,
      updatedAt: new Date().toISOString(),
    };
    list[idx] = updated;
    store[cleanId] = list;
    this.write(STORAGE_KEYS.RESTAURANT_TABLES, store);
    return updated;
  }

  async deleteRestaurantTable(
    businessId: string,
    tableId: string,
    options?: AIConfigAccessOptions,
  ): Promise<void> {
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

    const store = this.read<Record<string, RestaurantTable[]>>(
      STORAGE_KEYS.RESTAURANT_TABLES,
      {},
    );
    const list = store[cleanId] ?? [];
    if (!list.some((t) => t.id === tableId)) {
      throw new Error(`Table "${tableId}" not found for business "${cleanId}".`);
    }
    store[cleanId] = list.filter((t) => t.id !== tableId);
    this.write(STORAGE_KEYS.RESTAURANT_TABLES, store);
  }

  async getRestaurantMenuCategories(
    businessId: string,
    options?: AIConfigAccessOptions,
  ): Promise<RestaurantMenuCategory[]> {
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

    const store = this.read<Record<string, RestaurantMenuCategory[]>>(
      STORAGE_KEYS.RESTAURANT_CATEGORIES,
      {},
    );
    return [...(store[cleanId] ?? [])].sort(
      (a, b) => a.displayOrder - b.displayOrder,
    );
  }

  async createRestaurantMenuCategory(
    businessId: string,
    input: RestaurantMenuCategoryInput,
    options?: AIConfigAccessOptions,
  ): Promise<RestaurantMenuCategory> {
    const validation = validateRestaurantMenuCategoryInput(businessId, input);
    if (!validation.ok) {
      throw new Error(validation.error);
    }
    const cleanId = businessId.trim();
    const business = await this.getBusinessById(cleanId);
    if (!business) {
      throw new Error(`Business with ID "${cleanId}" not found.`);
    }
    this.assertOwnerAccess(business, options);

    const store = this.read<Record<string, RestaurantMenuCategory[]>>(
      STORAGE_KEYS.RESTAURANT_CATEGORIES,
      {},
    );
    const list = store[cleanId] ?? [];
    if (list.length >= RESTAURANT_LIMITS.MAX_CATEGORIES_PER_BUSINESS) {
      throw new Error(
        `Maximum of ${RESTAURANT_LIMITS.MAX_CATEGORIES_PER_BUSINESS} categories reached.`,
      );
    }

    const now = new Date().toISOString();
    const created: RestaurantMenuCategory = {
      id: `cat-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      businessId: cleanId,
      name: validation.value.name,
      description: validation.value.description,
      displayOrder:
        input.displayOrder !== undefined
          ? validation.value.displayOrder
          : list.length,
      isActive: validation.value.isActive,
      createdAt: now,
      updatedAt: now,
    };
    store[cleanId] = [...list, created];
    this.write(STORAGE_KEYS.RESTAURANT_CATEGORIES, store);
    return created;
  }

  async updateRestaurantMenuCategory(
    businessId: string,
    categoryId: string,
    input: RestaurantMenuCategoryInput,
    options?: AIConfigAccessOptions,
  ): Promise<RestaurantMenuCategory> {
    const validation = validateRestaurantMenuCategoryInput(businessId, input);
    if (!validation.ok) {
      throw new Error(validation.error);
    }
    const cleanId = businessId.trim();
    const business = await this.getBusinessById(cleanId);
    if (!business) {
      throw new Error(`Business with ID "${cleanId}" not found.`);
    }
    this.assertOwnerAccess(business, options);

    const store = this.read<Record<string, RestaurantMenuCategory[]>>(
      STORAGE_KEYS.RESTAURANT_CATEGORIES,
      {},
    );
    const list = store[cleanId] ?? [];
    const idx = list.findIndex((c) => c.id === categoryId);
    if (idx === -1) {
      throw new Error(
        `Menu category "${categoryId}" not found for business "${cleanId}".`,
      );
    }

    const updated: RestaurantMenuCategory = {
      ...list[idx],
      name: validation.value.name,
      description: validation.value.description,
      displayOrder:
        input.displayOrder !== undefined
          ? validation.value.displayOrder
          : list[idx].displayOrder,
      isActive: validation.value.isActive,
      updatedAt: new Date().toISOString(),
    };
    list[idx] = updated;
    store[cleanId] = list;
    this.write(STORAGE_KEYS.RESTAURANT_CATEGORIES, store);
    return updated;
  }

  async deleteRestaurantMenuCategory(
    businessId: string,
    categoryId: string,
    options?: AIConfigAccessOptions,
  ): Promise<void> {
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

    const catStore = this.read<Record<string, RestaurantMenuCategory[]>>(
      STORAGE_KEYS.RESTAURANT_CATEGORIES,
      {},
    );
    const list = catStore[cleanId] ?? [];
    if (!list.some((c) => c.id === categoryId)) {
      throw new Error(
        `Menu category "${categoryId}" not found for business "${cleanId}".`,
      );
    }
    catStore[cleanId] = list.filter((c) => c.id !== categoryId);
    this.write(STORAGE_KEYS.RESTAURANT_CATEGORIES, catStore);

    // Cascade delete menu items belonging to this category
    const itemStore = this.read<Record<string, RestaurantMenuItem[]>>(
      STORAGE_KEYS.RESTAURANT_ITEMS,
      {},
    );
    if (itemStore[cleanId]) {
      itemStore[cleanId] = itemStore[cleanId].filter(
        (item) => item.categoryId !== categoryId,
      );
      this.write(STORAGE_KEYS.RESTAURANT_ITEMS, itemStore);
    }
  }

  async getRestaurantMenuItems(
    businessId: string,
    options?: AIConfigAccessOptions,
  ): Promise<RestaurantMenuItem[]> {
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

    const store = this.read<Record<string, RestaurantMenuItem[]>>(
      STORAGE_KEYS.RESTAURANT_ITEMS,
      {},
    );
    return [...(store[cleanId] ?? [])].sort(
      (a, b) => a.displayOrder - b.displayOrder,
    );
  }

  async createRestaurantMenuItem(
    businessId: string,
    input: RestaurantMenuItemInput,
    options?: AIConfigAccessOptions,
  ): Promise<RestaurantMenuItem> {
    const validation = validateRestaurantMenuItemInput(businessId, input);
    if (!validation.ok) {
      throw new Error(validation.error);
    }
    const cleanId = businessId.trim();
    const business = await this.getBusinessById(cleanId);
    if (!business) {
      throw new Error(`Business with ID "${cleanId}" not found.`);
    }
    this.assertOwnerAccess(business, options);

    const categories = await this.getRestaurantMenuCategories(cleanId, options);
    if (!categories.some((c) => c.id === validation.value.categoryId)) {
      throw new Error(
        `Menu category "${validation.value.categoryId}" does not belong to business "${cleanId}".`,
      );
    }

    const store = this.read<Record<string, RestaurantMenuItem[]>>(
      STORAGE_KEYS.RESTAURANT_ITEMS,
      {},
    );
    const list = store[cleanId] ?? [];
    if (list.length >= RESTAURANT_LIMITS.MAX_ITEMS_PER_BUSINESS) {
      throw new Error(
        `Maximum of ${RESTAURANT_LIMITS.MAX_ITEMS_PER_BUSINESS} menu items reached.`,
      );
    }

    const now = new Date().toISOString();
    const created: RestaurantMenuItem = {
      id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      businessId: cleanId,
      categoryId: validation.value.categoryId,
      name: validation.value.name,
      description: validation.value.description,
      pricePaise: validation.value.pricePaise,
      dietaryTag: validation.value.dietaryTag,
      isAvailable: validation.value.isAvailable,
      isFeatured: validation.value.isFeatured,
      imageUrl: validation.value.imageUrl,
      displayOrder:
        input.displayOrder !== undefined
          ? validation.value.displayOrder
          : list.filter((i) => i.categoryId === validation.value.categoryId)
              .length,
      createdAt: now,
      updatedAt: now,
    };
    store[cleanId] = [...list, created];
    this.write(STORAGE_KEYS.RESTAURANT_ITEMS, store);
    return created;
  }

  async updateRestaurantMenuItem(
    businessId: string,
    itemId: string,
    input: RestaurantMenuItemInput,
    options?: AIConfigAccessOptions,
  ): Promise<RestaurantMenuItem> {
    const validation = validateRestaurantMenuItemInput(businessId, input);
    if (!validation.ok) {
      throw new Error(validation.error);
    }
    const cleanId = businessId.trim();
    const business = await this.getBusinessById(cleanId);
    if (!business) {
      throw new Error(`Business with ID "${cleanId}" not found.`);
    }
    this.assertOwnerAccess(business, options);

    const categories = await this.getRestaurantMenuCategories(cleanId, options);
    if (!categories.some((c) => c.id === validation.value.categoryId)) {
      throw new Error(
        `Menu category "${validation.value.categoryId}" does not belong to business "${cleanId}".`,
      );
    }

    const store = this.read<Record<string, RestaurantMenuItem[]>>(
      STORAGE_KEYS.RESTAURANT_ITEMS,
      {},
    );
    const list = store[cleanId] ?? [];
    const idx = list.findIndex((i) => i.id === itemId);
    if (idx === -1) {
      throw new Error(
        `Menu item "${itemId}" not found for business "${cleanId}".`,
      );
    }

    const updated: RestaurantMenuItem = {
      ...list[idx],
      categoryId: validation.value.categoryId,
      name: validation.value.name,
      description: validation.value.description,
      pricePaise: validation.value.pricePaise,
      dietaryTag: validation.value.dietaryTag,
      isAvailable: validation.value.isAvailable,
      isFeatured: validation.value.isFeatured,
      imageUrl: validation.value.imageUrl,
      displayOrder:
        input.displayOrder !== undefined
          ? validation.value.displayOrder
          : list[idx].displayOrder,
      updatedAt: new Date().toISOString(),
    };
    list[idx] = updated;
    store[cleanId] = list;
    this.write(STORAGE_KEYS.RESTAURANT_ITEMS, store);
    return updated;
  }

  async deleteRestaurantMenuItem(
    businessId: string,
    itemId: string,
    options?: AIConfigAccessOptions,
  ): Promise<void> {
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

    const store = this.read<Record<string, RestaurantMenuItem[]>>(
      STORAGE_KEYS.RESTAURANT_ITEMS,
      {},
    );
    const list = store[cleanId] ?? [];
    if (!list.some((i) => i.id === itemId)) {
      throw new Error(
        `Menu item "${itemId}" not found for business "${cleanId}".`,
      );
    }
    store[cleanId] = list.filter((i) => i.id !== itemId);
    this.write(STORAGE_KEYS.RESTAURANT_ITEMS, store);
  }

  async getPublicRestaurantMenu(
    businessSlug: string,
    tableKey?: string | null,
  ): Promise<PublicRestaurantMenuPayload | null> {
    const business = await this.getBusinessBySlug(businessSlug);
    if (!business) {
      return null;
    }

    const profileStore = this.read<Record<string, RestaurantProfile>>(
      STORAGE_KEYS.RESTAURANT_PROFILES,
      {},
    );
    const profile = normalizeRestaurantProfile(
      business.id,
      profileStore[business.id],
      'local',
    );
    if (!profile.isEnabled) {
      return null;
    }

    let matchedTable: RestaurantTable | null = null;
    if (tableKey && tableKey.trim()) {
      const cleanTableKey = deriveTableKey(tableKey);
      const tableStore = this.read<Record<string, RestaurantTable[]>>(
        STORAGE_KEYS.RESTAURANT_TABLES,
        {},
      );
      const bizTables = tableStore[business.id] ?? [];
      matchedTable =
        bizTables.find((t) => t.tableKey === cleanTableKey && t.isActive) ??
        null;
    }

    const catStore = this.read<Record<string, RestaurantMenuCategory[]>>(
      STORAGE_KEYS.RESTAURANT_CATEGORIES,
      {},
    );
    const activeCategories = [...(catStore[business.id] ?? [])]
      .filter((c) => c.isActive)
      .sort((a, b) => a.displayOrder - b.displayOrder);
    const activeCatIds = new Set(activeCategories.map((c) => c.id));

    const itemStore = this.read<Record<string, RestaurantMenuItem[]>>(
      STORAGE_KEYS.RESTAURANT_ITEMS,
      {},
    );
    const availableItems = [...(itemStore[business.id] ?? [])]
      .filter((i) => i.isAvailable && activeCatIds.has(i.categoryId))
      .sort((a, b) => a.displayOrder - b.displayOrder);

    const gameStore = this.read<Record<string, RestaurantGameConfig[]>>(
      STORAGE_KEYS.RESTAURANT_GAME_CONFIGS,
      {},
    );
    const allGames =
      gameStore[business.id] && gameStore[business.id].length > 0
        ? gameStore[business.id]
        : getDefaultRestaurantGameConfigs(business.id);
    const activeGames = profile.gamesEnabled
      ? allGames.filter((g) => g.isEnabled)
      : [];

    const rulesStore = this.read<Record<string, RestaurantLoyaltyRules>>(
      STORAGE_KEYS.RESTAURANT_LOYALTY_RULES,
      {},
    );
    const loyaltyRules = normalizeRestaurantLoyaltyRules(
      business.id,
      rulesStore[business.id],
    );

    const rewardsStore = this.read<Record<string, RestaurantReward[]>>(
      STORAGE_KEYS.RESTAURANT_REWARDS,
      {},
    );
    const activeRewards = profile.loyaltyEnabled
      ? [...(rewardsStore[business.id] ?? [])]
          .filter((r) => r.isActive)
          .sort(
            (a, b) =>
              a.displayOrder - b.displayOrder ||
              a.starsRequired - b.starsRequired,
          )
      : [];

    return {
      business: {
        id: business.id,
        slug: business.slug,
        name: business.name,
        category: business.category,
        city: business.city,
        googleReviewUrl: business.googleReviewUrl,
      },
      profile,
      table: matchedTable,
      categories: activeCategories,
      items: availableItems,
      games: activeGames,
      loyaltyRules,
      rewards: activeRewards,
    };
  }

  // ---------------------------------------------------------------------------
  // Phase 2: Customer Identity, Restaurant Games & Secure Game-Points Ledger
  // ---------------------------------------------------------------------------

  async getRestaurantGameConfigs(
    businessId: string,
    options?: AIConfigAccessOptions,
  ): Promise<RestaurantGameConfig[]> {
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

    const store = this.read<Record<string, RestaurantGameConfig[]>>(
      STORAGE_KEYS.RESTAURANT_GAME_CONFIGS,
      {},
    );
    if (!store[cleanId] || store[cleanId].length === 0) {
      const defaults = getDefaultRestaurantGameConfigs(cleanId);
      store[cleanId] = defaults;
      this.write(STORAGE_KEYS.RESTAURANT_GAME_CONFIGS, store);
      return [...defaults];
    }
    return [...store[cleanId]];
  }

  async updateRestaurantGameConfig(
    businessId: string,
    input: RestaurantGameConfigInput,
    options?: AIConfigAccessOptions,
  ): Promise<RestaurantGameConfig> {
    const validation = validateRestaurantGameConfigInput(businessId, input);
    if (!validation.ok) {
      throw new Error(validation.error);
    }
    const cleanId = businessId.trim();
    const business = await this.getBusinessById(cleanId);
    if (!business) {
      throw new Error(`Business with ID "${cleanId}" not found.`);
    }
    this.assertOwnerAccess(business, options);

    const configs = await this.getRestaurantGameConfigs(cleanId, options);
    const idx = configs.findIndex(
      (c) => c.gameSlug === validation.value.gameSlug,
    );
    const now = new Date().toISOString();

    const updated: RestaurantGameConfig = {
      id:
        idx !== -1
          ? configs[idx].id
          : `game-cfg-${cleanId}-${validation.value.gameSlug}`,
      businessId: cleanId,
      gameSlug: validation.value.gameSlug,
      title: validation.value.title,
      category: validation.value.category,
      isEnabled: validation.value.isEnabled,
      pointsPerWin: validation.value.pointsPerWin,
      maxPointsPerDayPerCustomer: validation.value.maxPointsPerDayPerCustomer,
      cooldownMinutes: validation.value.cooldownMinutes,
      customQuestions: validation.value.customQuestions,
      createdAt: idx !== -1 ? configs[idx].createdAt : now,
      updatedAt: now,
    };

    if (idx !== -1) {
      configs[idx] = updated;
    } else {
      configs.push(updated);
    }

    const store = this.read<Record<string, RestaurantGameConfig[]>>(
      STORAGE_KEYS.RESTAURANT_GAME_CONFIGS,
      {},
    );
    store[cleanId] = configs;
    this.write(STORAGE_KEYS.RESTAURANT_GAME_CONFIGS, store);
    return updated;
  }

  async getRestaurantGameStats(
    businessId: string,
    options?: AIConfigAccessOptions,
  ): Promise<RestaurantGameParticipationStats> {
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

    const sessions = this.read<RestaurantGameSession[]>(
      STORAGE_KEYS.RESTAURANT_GAME_SESSIONS,
      [],
    ).filter((s) => s.businessId === cleanId && s.status === 'completed');

    const txs = this.read<RestaurantGamePointTransaction[]>(
      STORAGE_KEYS.RESTAURANT_GAME_POINT_TXS,
      [],
    ).filter((t) => t.businessId === cleanId && t.txType === 'game_win');

    const startOfToday = new Date();
    startOfToday.setUTCHours(0, 0, 0, 0);
    const todayMs = startOfToday.getTime();

    const sessionsCompletedToday = sessions.filter((s) => {
      const t = s.completedAt ? new Date(s.completedAt).getTime() : 0;
      return t >= todayMs;
    }).length;

    const gamePointsIssuedToday = txs
      .filter((tx) => new Date(tx.createdAt).getTime() >= todayMs)
      .reduce((sum, tx) => sum + tx.pointsDelta, 0);

    const totalGamePointsIssued = txs.reduce(
      (sum, tx) => sum + tx.pointsDelta,
      0,
    );

    return {
      totalSessionsPlayed: sessions.length,
      sessionsCompletedToday,
      gamePointsIssuedToday,
      totalGamePointsIssued,
    };
  }

  async registerOrResumeRestaurantCustomer(
    input: RestaurantCustomerCheckInInput,
  ): Promise<RestaurantCustomerWalletState> {
    const validation = validateRestaurantCustomerCheckInInput(input);
    if (!validation.ok) {
      throw new Error(validation.error);
    }
    const { displayName, phoneOrEmail, guestTokenHash, businessSlug } =
      validation.value;

    const customers = this.read<RestaurantCustomer[]>(
      STORAGE_KEYS.RESTAURANT_CUSTOMERS,
      [],
    );

    let matched: RestaurantCustomer | undefined;
    if (phoneOrEmail) {
      matched = customers.find((c) => c.phoneOrEmail === phoneOrEmail);
    }
    if (!matched && guestTokenHash) {
      matched = customers.find((c) => c.guestTokenHash === guestTokenHash);
    }

    const now = new Date().toISOString();
    if (!matched) {
      matched = {
        id: `cust-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        displayName,
        phoneOrEmail,
        guestTokenHash,
        createdAt: now,
      };
      customers.push(matched);
    } else {
      matched.displayName = displayName;
      if (phoneOrEmail) matched.phoneOrEmail = phoneOrEmail;
      if (guestTokenHash) matched.guestTokenHash = guestTokenHash;
    }
    this.write(STORAGE_KEYS.RESTAURANT_CUSTOMERS, customers);

    let gamePointsBalance = 0;
    let recentTransactions: RestaurantGamePointTransaction[] = [];
    let loyaltyStarsBalance = 0;
    let starsExchangedThisWeek = 0;
    let recentStarTransactions: RestaurantLoyaltyStarTransaction[] = [];
    let rewardClaims: RestaurantRewardClaim[] = [];

    if (businessSlug) {
      const biz = await this.getBusinessBySlug(businessSlug);
      if (biz) {
        const allTxs = this.read<RestaurantGamePointTransaction[]>(
          STORAGE_KEYS.RESTAURANT_GAME_POINT_TXS,
          [],
        )
          .filter(
            (tx) => tx.businessId === biz.id && tx.customerId === matched!.id,
          )
          .reverse();
        if (allTxs.length > 0) {
          gamePointsBalance = allTxs[0].balanceAfter;
          recentTransactions = allTxs.slice(0, 20);
        }

        const allStarTxs = this.read<RestaurantLoyaltyStarTransaction[]>(
          STORAGE_KEYS.RESTAURANT_LOYALTY_STAR_TXS,
          [],
        )
          .filter(
            (tx) => tx.businessId === biz.id && tx.customerId === matched!.id,
          )
          .reverse();
        if (allStarTxs.length > 0) {
          loyaltyStarsBalance = allStarTxs[0].balanceAfter;
          recentStarTransactions = allStarTxs.slice(0, 20);
        }

        const sevenDaysAgoMs = Date.now() - 7 * 24 * 60 * 60 * 1000;
        starsExchangedThisWeek = allStarTxs
          .filter(
            (tx) =>
              tx.txType === 'game_point_exchange' &&
              new Date(tx.createdAt).getTime() >= sevenDaysAgoMs,
          )
          .reduce((sum, tx) => sum + tx.starsDelta, 0);

        const allClaims = this.read<RestaurantRewardClaim[]>(
          STORAGE_KEYS.RESTAURANT_REWARD_CLAIMS,
          [],
        )
          .filter(
            (c) => c.businessId === biz.id && c.customerId === matched!.id,
          )
          .reverse();
        rewardClaims = allClaims.slice(0, 20);
      }
    }

    return {
      customer: { ...matched },
      gamePointsBalance,
      recentTransactions,
      loyaltyStarsBalance,
      starsExchangedThisWeek,
      recentStarTransactions,
      rewardClaims,
    };
  }

  async startRestaurantGameSession(params: {
    businessSlug: string;
    tableKey?: string | null;
    customerId: string;
    gameSlug: RestaurantGameSlug;
  }): Promise<RestaurantGameStartResponse> {
    if (!params.customerId || !params.customerId.trim()) {
      throw new Error(
        'Customer check-in is required before starting a game.',
      );
    }
    const business = await this.getBusinessBySlug(params.businessSlug);
    if (!business) {
      throw new Error('Restaurant is not active.');
    }

    const profileStore = this.read<Record<string, RestaurantProfile>>(
      STORAGE_KEYS.RESTAURANT_PROFILES,
      {},
    );
    const profile = normalizeRestaurantProfile(
      business.id,
      profileStore[business.id],
      'local',
    );
    if (!profile.isEnabled || !profile.gamesEnabled) {
      throw new Error(
        'Table games are currently disabled for this restaurant.',
      );
    }

    const gameStore = this.read<Record<string, RestaurantGameConfig[]>>(
      STORAGE_KEYS.RESTAURANT_GAME_CONFIGS,
      {},
    );
    const configs =
      gameStore[business.id] && gameStore[business.id].length > 0
        ? gameStore[business.id]
        : getDefaultRestaurantGameConfigs(business.id);

    const config = configs.find((c) => c.gameSlug === params.gameSlug);
    if (!config || !config.isEnabled) {
      throw new Error(
        'This game is currently turned off by the restaurant.',
      );
    }

    const sessions = this.read<RestaurantGameSession[]>(
      STORAGE_KEYS.RESTAURANT_GAME_SESSIONS,
      [],
    );

    // 1. Cooldown check
    if (config.cooldownMinutes > 0) {
      const completedForGame = sessions
        .filter(
          (s) =>
            s.businessId === business.id &&
            s.customerId === params.customerId &&
            s.gameSlug === params.gameSlug &&
            s.status === 'completed' &&
            s.completedAt,
        )
        .sort(
          (a, b) =>
            new Date(b.completedAt!).getTime() -
            new Date(a.completedAt!).getTime(),
        );

      if (completedForGame.length > 0) {
        const lastCompletedMs = new Date(
          completedForGame[0].completedAt!,
        ).getTime();
        const cooldownMs = config.cooldownMinutes * 60 * 1000;
        if (Date.now() - lastCompletedMs < cooldownMs) {
          throw new Error(
            `Cooldown active: please wait ${config.cooldownMinutes} minute(s) before replaying this game.`,
          );
        }
      }
    }

    // 2. Daily point cap check
    const startOfToday = new Date();
    startOfToday.setUTCHours(0, 0, 0, 0);
    const todayMs = startOfToday.getTime();

    const txs = this.read<RestaurantGamePointTransaction[]>(
      STORAGE_KEYS.RESTAURANT_GAME_POINT_TXS,
      [],
    );
    const pointsToday = txs
      .filter(
        (tx) =>
          tx.businessId === business.id &&
          tx.customerId === params.customerId &&
          tx.txType === 'game_win' &&
          new Date(tx.createdAt).getTime() >= todayMs,
      )
      .reduce((sum, tx) => sum + tx.pointsDelta, 0);

    if (pointsToday >= config.maxPointsPerDayPerCustomer) {
      throw new Error(
        `Daily game point limit (${config.maxPointsPerDayPerCustomer} pts) reached for today.`,
      );
    }

    let tableId: string | null = null;
    if (params.tableKey && params.tableKey.trim()) {
      const cleanTableKey = deriveTableKey(params.tableKey);
      const tableStore = this.read<Record<string, RestaurantTable[]>>(
        STORAGE_KEYS.RESTAURANT_TABLES,
        {},
      );
      const tbl = (tableStore[business.id] ?? []).find(
        (t) => t.tableKey === cleanTableKey && t.isActive,
      );
      tableId = tbl?.id ?? null;
    }

    const { serverSeed, clientChallenge } =
      buildServerSeedAndClientChallenge(config);

    const sessionId = `gsess-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const newSession: RestaurantGameSession = {
      id: sessionId,
      businessId: business.id,
      tableId,
      customerId: params.customerId,
      gameSlug: params.gameSlug,
      status: 'in_progress',
      serverSeed,
      score: 0,
      pointsAwarded: 0,
      startedAt: new Date().toISOString(),
      completedAt: null,
    };

    sessions.push(newSession);
    this.write(STORAGE_KEYS.RESTAURANT_GAME_SESSIONS, sessions);

    return {
      sessionId,
      businessId: business.id,
      gameSlug: params.gameSlug,
      title: config.title,
      pointsPerWin: config.pointsPerWin,
      challenge: clientChallenge,
    };
  }

  async completeRestaurantGameSession(params: {
    sessionId: string;
    customerId: string;
    submission: RestaurantGameSubmissionInput;
    idempotencyKey: string;
  }): Promise<RestaurantGameCompletionResponse> {
    if (!params.sessionId || !params.customerId) {
      throw new Error('Session ID and customer ID are required.');
    }
    const cleanIdem = (params.idempotencyKey ?? '').trim();
    if (cleanIdem.length < 4 || cleanIdem.length > 160) {
      throw new Error(
        'A valid idempotency key (4..160 chars) is required.',
      );
    }

    const sessions = this.read<RestaurantGameSession[]>(
      STORAGE_KEYS.RESTAURANT_GAME_SESSIONS,
      [],
    );
    const sessionIdx = sessions.findIndex(
      (s) => s.id === params.sessionId && s.customerId === params.customerId,
    );
    if (sessionIdx === -1) {
      throw new Error('Game session not found for this customer.');
    }

    const session = sessions[sessionIdx];
    const txs = this.read<RestaurantGamePointTransaction[]>(
      STORAGE_KEYS.RESTAURANT_GAME_POINT_TXS,
      [],
    );

    // 1. Idempotency check (by idempotencyKey OR sessionId)
    const existingTx = txs.find(
      (tx) =>
        tx.businessId === session.businessId &&
        (tx.idempotencyKey === cleanIdem || tx.sessionId === session.id),
    );
    if (existingTx) {
      return {
        sessionId: session.id,
        alreadyProcessed: true,
        passed: existingTx.pointsDelta > 0,
        score: session.score,
        pointsAwarded: existingTx.pointsDelta,
        newBalance: existingTx.balanceAfter,
        transactionId: existingTx.id,
      };
    }

    // Current balance helper (newest appended transaction last -> reverse to get latest at [0])
    const customerTxs = txs
      .filter(
        (tx) =>
          tx.businessId === session.businessId &&
          tx.customerId === params.customerId,
      )
      .reverse();
    const prevBalance =
      customerTxs.length > 0 ? customerTxs[0].balanceAfter : 0;

    if (session.status !== 'in_progress') {
      return {
        sessionId: session.id,
        alreadyProcessed: true,
        passed: session.pointsAwarded > 0,
        score: session.score,
        pointsAwarded: session.pointsAwarded,
        newBalance: prevBalance,
        transactionId: null,
      };
    }

    // 2. Load game configuration
    const gameStore = this.read<Record<string, RestaurantGameConfig[]>>(
      STORAGE_KEYS.RESTAURANT_GAME_CONFIGS,
      {},
    );
    const configs =
      gameStore[session.businessId] &&
      gameStore[session.businessId].length > 0
        ? gameStore[session.businessId]
        : getDefaultRestaurantGameConfigs(session.businessId);
    const config = configs.find((c) => c.gameSlug === session.gameSlug);
    const pointsPerWin = config?.pointsPerWin ?? 10;
    const maxPointsPerDay = config?.maxPointsPerDayPerCustomer ?? 50;

    // 3. Server-side answer & performance verification (never trusts client score)
    const { passed, score } = verifyGameSubmissionAgainstServerSeed(
      session.gameSlug,
      session.serverSeed,
      params.submission,
    );

    // 4. Daily point cap enforcement
    const startOfToday = new Date();
    startOfToday.setUTCHours(0, 0, 0, 0);
    const todayMs = startOfToday.getTime();
    const pointsToday = customerTxs
      .filter(
        (tx) =>
          tx.txType === 'game_win' &&
          new Date(tx.createdAt).getTime() >= todayMs,
      )
      .reduce((sum, tx) => sum + tx.pointsDelta, 0);

    const remainingDaily = Math.max(0, maxPointsPerDay - pointsToday);
    const pointsToAward = passed
      ? Math.min(pointsPerWin, remainingDaily)
      : 0;
    const newBalance = prevBalance + pointsToAward;
    const now = new Date().toISOString();

    sessions[sessionIdx] = {
      ...session,
      status: 'completed',
      score,
      pointsAwarded: pointsToAward,
      completedAt: now,
    };
    this.write(STORAGE_KEYS.RESTAURANT_GAME_SESSIONS, sessions);

    let transactionId: string | null = null;
    if (pointsToAward > 0) {
      const txId = `gptx-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const newTx: RestaurantGamePointTransaction = {
        id: txId,
        businessId: session.businessId,
        customerId: params.customerId,
        sessionId: session.id,
        txType: 'game_win',
        pointsDelta: pointsToAward,
        balanceAfter: newBalance,
        idempotencyKey: cleanIdem,
        metadata: {
          gameSlug: session.gameSlug,
          score,
        },
        createdAt: now,
      };
      txs.push(newTx);
      this.write(STORAGE_KEYS.RESTAURANT_GAME_POINT_TXS, txs);
      transactionId = txId;
    }

    return {
      sessionId: session.id,
      alreadyProcessed: false,
      passed,
      score,
      pointsAwarded: pointsToAward,
      newBalance,
      transactionId,
    };
  }

  // ---------------------------------------------------------------------------
  // Phase 3: Loyalty Stars Ledger, Point-to-Star Exchange & Reward Catalogue
  // ---------------------------------------------------------------------------

  async getRestaurantLoyaltyRules(
    businessId: string,
    options?: AIConfigAccessOptions,
  ): Promise<RestaurantLoyaltyRules> {
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

    const store = this.read<Record<string, RestaurantLoyaltyRules>>(
      STORAGE_KEYS.RESTAURANT_LOYALTY_RULES,
      {},
    );
    return normalizeRestaurantLoyaltyRules(cleanId, store[cleanId]);
  }

  async updateRestaurantLoyaltyRules(
    businessId: string,
    input: RestaurantLoyaltyRulesInput,
    options?: AIConfigAccessOptions,
  ): Promise<RestaurantLoyaltyRules> {
    const validation = validateRestaurantLoyaltyRulesInput(businessId, input);
    if (!validation.ok) {
      throw new Error(validation.error);
    }
    const cleanId = businessId.trim();
    const business = await this.getBusinessById(cleanId);
    if (!business) {
      throw new Error(`Business with ID "${cleanId}" not found.`);
    }
    this.assertOwnerAccess(business, options);

    const store = this.read<Record<string, RestaurantLoyaltyRules>>(
      STORAGE_KEYS.RESTAURANT_LOYALTY_RULES,
      {},
    );
    const updated: RestaurantLoyaltyRules = {
      businessId: cleanId,
      starsPerVerifiedVisit: validation.value.starsPerVerifiedVisit,
      pointsPerStarExchange: validation.value.pointsPerStarExchange,
      allowPointExchange: validation.value.allowPointExchange,
      maxStarsViaExchangePerWeek: validation.value.maxStarsViaExchangePerWeek,
      wifiNetworkName: validation.value.wifiNetworkName,
      wifiPassword: validation.value.wifiPassword,
      suggestionBoxEnabled: validation.value.suggestionBoxEnabled,
      updatedAt: new Date().toISOString(),
    };
    store[cleanId] = updated;
    this.write(STORAGE_KEYS.RESTAURANT_LOYALTY_RULES, store);
    return updated;
  }

  async getRestaurantRewards(
    businessId: string,
    options?: AIConfigAccessOptions,
  ): Promise<RestaurantReward[]> {
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

    const store = this.read<Record<string, RestaurantReward[]>>(
      STORAGE_KEYS.RESTAURANT_REWARDS,
      {},
    );
    return [...(store[cleanId] ?? [])].sort(
      (a, b) =>
        a.displayOrder - b.displayOrder || a.starsRequired - b.starsRequired,
    );
  }

  async createRestaurantReward(
    businessId: string,
    input: RestaurantRewardInput,
    options?: AIConfigAccessOptions,
  ): Promise<RestaurantReward> {
    const validation = validateRestaurantRewardInput(businessId, input);
    if (!validation.ok) {
      throw new Error(validation.error);
    }
    const cleanId = businessId.trim();
    const business = await this.getBusinessById(cleanId);
    if (!business) {
      throw new Error(`Business with ID "${cleanId}" not found.`);
    }
    this.assertOwnerAccess(business, options);

    const store = this.read<Record<string, RestaurantReward[]>>(
      STORAGE_KEYS.RESTAURANT_REWARDS,
      {},
    );
    const list = store[cleanId] ?? [];
    const now = new Date().toISOString();
    const created: RestaurantReward = {
      id: `rwd-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      businessId: cleanId,
      title: validation.value.title,
      description: validation.value.description,
      starsRequired: validation.value.starsRequired,
      isActive: validation.value.isActive,
      maxRedemptionsTotal: validation.value.maxRedemptionsTotal,
      redemptionsCount: 0,
      displayOrder:
        input.displayOrder !== undefined
          ? validation.value.displayOrder
          : list.length,
      createdAt: now,
      updatedAt: now,
    };
    store[cleanId] = [...list, created];
    this.write(STORAGE_KEYS.RESTAURANT_REWARDS, store);
    return created;
  }

  async updateRestaurantReward(
    businessId: string,
    rewardId: string,
    input: RestaurantRewardInput,
    options?: AIConfigAccessOptions,
  ): Promise<RestaurantReward> {
    const validation = validateRestaurantRewardInput(businessId, input);
    if (!validation.ok) {
      throw new Error(validation.error);
    }
    const cleanId = businessId.trim();
    const business = await this.getBusinessById(cleanId);
    if (!business) {
      throw new Error(`Business with ID "${cleanId}" not found.`);
    }
    this.assertOwnerAccess(business, options);

    const store = this.read<Record<string, RestaurantReward[]>>(
      STORAGE_KEYS.RESTAURANT_REWARDS,
      {},
    );
    const list = store[cleanId] ?? [];
    const idx = list.findIndex((r) => r.id === rewardId);
    if (idx === -1) {
      throw new Error(
        `Reward "${rewardId}" not found for business "${cleanId}".`,
      );
    }

    const updated: RestaurantReward = {
      ...list[idx],
      title: validation.value.title,
      description: validation.value.description,
      starsRequired: validation.value.starsRequired,
      isActive: validation.value.isActive,
      maxRedemptionsTotal: validation.value.maxRedemptionsTotal,
      displayOrder:
        input.displayOrder !== undefined
          ? validation.value.displayOrder
          : list[idx].displayOrder,
      updatedAt: new Date().toISOString(),
    };
    list[idx] = updated;
    store[cleanId] = list;
    this.write(STORAGE_KEYS.RESTAURANT_REWARDS, store);
    return updated;
  }

  async deleteRestaurantReward(
    businessId: string,
    rewardId: string,
    options?: AIConfigAccessOptions,
  ): Promise<void> {
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

    const store = this.read<Record<string, RestaurantReward[]>>(
      STORAGE_KEYS.RESTAURANT_REWARDS,
      {},
    );
    const list = store[cleanId] ?? [];
    if (!list.some((r) => r.id === rewardId)) {
      throw new Error(
        `Reward "${rewardId}" not found for business "${cleanId}".`,
      );
    }
    store[cleanId] = list.filter((r) => r.id !== rewardId);
    this.write(STORAGE_KEYS.RESTAURANT_REWARDS, store);
  }

  async exchangeGamePointsForStar(params: {
    businessSlug: string;
    customerId: string;
    idempotencyKey: string;
  }): Promise<RestaurantPointToStarExchangeResponse> {
    if (!params.customerId || !params.customerId.trim()) {
      throw new Error('Customer check-in is required.');
    }
    const cleanIdem = (params.idempotencyKey ?? '').trim();
    if (cleanIdem.length < 4 || cleanIdem.length > 160) {
      throw new Error('A valid idempotency key (4..160 chars) is required.');
    }

    const business = await this.getBusinessBySlug(params.businessSlug);
    if (!business) {
      throw new Error('Restaurant is not active.');
    }

    const profileStore = this.read<Record<string, RestaurantProfile>>(
      STORAGE_KEYS.RESTAURANT_PROFILES,
      {},
    );
    const profile = normalizeRestaurantProfile(
      business.id,
      profileStore[business.id],
      'local',
    );
    if (!profile.isEnabled || !profile.loyaltyEnabled) {
      throw new Error(
        'Loyalty Stars are currently disabled for this restaurant.',
      );
    }

    const pointTxs = this.read<RestaurantGamePointTransaction[]>(
      STORAGE_KEYS.RESTAURANT_GAME_POINT_TXS,
      [],
    );
    const starTxs = this.read<RestaurantLoyaltyStarTransaction[]>(
      STORAGE_KEYS.RESTAURANT_LOYALTY_STAR_TXS,
      [],
    );

    const customerPointTxs = pointTxs
      .filter(
        (tx) =>
          tx.businessId === business.id &&
          tx.customerId === params.customerId,
      )
      .reverse();
    const currentPoints =
      customerPointTxs.length > 0 ? customerPointTxs[0].balanceAfter : 0;

    // 1. Idempotency check
    const existingStarTx = starTxs.find(
      (tx) =>
        tx.businessId === business.id && tx.idempotencyKey === cleanIdem,
    );
    if (existingStarTx) {
      return {
        alreadyProcessed: true,
        pointsSpent: 0,
        starsEarned: existingStarTx.starsDelta,
        newGamePointsBalance: currentPoints,
        newLoyaltyStarsBalance: existingStarTx.balanceAfter,
        starTransactionId: existingStarTx.id,
      };
    }

    // 2. Load rules & check allowPointExchange + weekly cap
    const rulesStore = this.read<Record<string, RestaurantLoyaltyRules>>(
      STORAGE_KEYS.RESTAURANT_LOYALTY_RULES,
      {},
    );
    const rules = normalizeRestaurantLoyaltyRules(
      business.id,
      rulesStore[business.id],
    );
    if (!rules.allowPointExchange) {
      throw new Error(
        'Point-to-Star exchange is disabled by this restaurant.',
      );
    }

    const customerStarTxs = starTxs
      .filter(
        (tx) =>
          tx.businessId === business.id &&
          tx.customerId === params.customerId,
      )
      .reverse();
    const currentStars =
      customerStarTxs.length > 0 ? customerStarTxs[0].balanceAfter : 0;

    const sevenDaysAgoMs = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const exchangedThisWeek = customerStarTxs
      .filter(
        (tx) =>
          tx.txType === 'game_point_exchange' &&
          new Date(tx.createdAt).getTime() >= sevenDaysAgoMs,
      )
      .reduce((sum, tx) => sum + tx.starsDelta, 0);

    if (exchangedThisWeek >= rules.maxStarsViaExchangePerWeek) {
      throw new Error(
        `Weekly Point-to-Star exchange limit (${rules.maxStarsViaExchangePerWeek} star(s)/week) reached.`,
      );
    }

    // 3. Verify sufficient Game Points balance
    if (currentPoints < rules.pointsPerStarExchange) {
      throw new Error(
        `Insufficient Game Points: ${rules.pointsPerStarExchange} pts required to exchange for 1 Loyalty Star (you have ${currentPoints} pts).`,
      );
    }

    const newPoints = currentPoints - rules.pointsPerStarExchange;
    const newStars = currentStars + 1;
    const now = new Date().toISOString();

    // 4. Atomic debit in Game-Points Ledger + credit in Loyalty-Stars Ledger
    const ptTxId = `gptx-ex-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const newPointTx: RestaurantGamePointTransaction = {
      id: ptTxId,
      businessId: business.id,
      customerId: params.customerId,
      sessionId: null,
      txType: 'exchanged_for_star',
      pointsDelta: -rules.pointsPerStarExchange,
      balanceAfter: newPoints,
      idempotencyKey: cleanIdem,
      metadata: { starsEarned: 1 },
      createdAt: now,
    };

    const starTxId = `lstx-ex-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const newStarTx: RestaurantLoyaltyStarTransaction = {
      id: starTxId,
      businessId: business.id,
      customerId: params.customerId,
      txType: 'game_point_exchange',
      starsDelta: 1,
      balanceAfter: newStars,
      idempotencyKey: cleanIdem,
      metadata: {
        pointsSpent: rules.pointsPerStarExchange,
        pointTransactionId: ptTxId,
      },
      createdAt: now,
    };

    pointTxs.push(newPointTx);
    starTxs.push(newStarTx);
    this.write(STORAGE_KEYS.RESTAURANT_GAME_POINT_TXS, pointTxs);
    this.write(STORAGE_KEYS.RESTAURANT_LOYALTY_STAR_TXS, starTxs);

    return {
      alreadyProcessed: false,
      pointsSpent: rules.pointsPerStarExchange,
      starsEarned: 1,
      newGamePointsBalance: newPoints,
      newLoyaltyStarsBalance: newStars,
      starTransactionId: starTxId,
    };
  }

  async claimRestaurantReward(params: {
    businessSlug: string;
    customerId: string;
    rewardId: string;
    idempotencyKey: string;
  }): Promise<RestaurantRewardClaimResponse> {
    if (!params.customerId || !params.rewardId) {
      throw new Error('Customer ID and Reward ID are required.');
    }
    const cleanIdem = (params.idempotencyKey ?? '').trim();
    if (cleanIdem.length < 4 || cleanIdem.length > 160) {
      throw new Error('A valid idempotency key (4..160 chars) is required.');
    }

    const business = await this.getBusinessBySlug(params.businessSlug);
    if (!business) {
      throw new Error('Restaurant is not active.');
    }

    const starTxs = this.read<RestaurantLoyaltyStarTransaction[]>(
      STORAGE_KEYS.RESTAURANT_LOYALTY_STAR_TXS,
      [],
    );
    const claims = this.read<RestaurantRewardClaim[]>(
      STORAGE_KEYS.RESTAURANT_REWARD_CLAIMS,
      [],
    );
    const rewardsStore = this.read<Record<string, RestaurantReward[]>>(
      STORAGE_KEYS.RESTAURANT_REWARDS,
      {},
    );
    const bizRewards = rewardsStore[business.id] ?? [];

    // 1. Idempotency check
    const existingTx = starTxs.find(
      (tx) =>
        tx.businessId === business.id && tx.idempotencyKey === cleanIdem,
    );
    if (existingTx) {
      const existingClaim = claims.find(
        (c) =>
          c.businessId === business.id &&
          c.customerId === params.customerId &&
          c.rewardId === params.rewardId,
      );
      if (existingClaim) {
        return {
          alreadyProcessed: true,
          newLoyaltyStarsBalance: existingTx.balanceAfter,
          claim: existingClaim,
        };
      }
    }

    const rewardIdx = bizRewards.findIndex(
      (r) => r.id === params.rewardId && r.isActive,
    );
    if (rewardIdx === -1) {
      throw new Error('Reward is not available.');
    }
    const reward = bizRewards[rewardIdx];

    if (
      reward.maxRedemptionsTotal !== null &&
      reward.redemptionsCount >= reward.maxRedemptionsTotal
    ) {
      throw new Error(
        'This reward has reached its maximum redemption limit.',
      );
    }

    const customerStarTxs = starTxs
      .filter(
        (tx) =>
          tx.businessId === business.id &&
          tx.customerId === params.customerId,
      )
      .reverse();
    const currentStars =
      customerStarTxs.length > 0 ? customerStarTxs[0].balanceAfter : 0;

    if (currentStars < reward.starsRequired) {
      throw new Error(
        `Insufficient Loyalty Stars: ${reward.starsRequired} Stars required (you have ${currentStars} Stars).`,
      );
    }

    const newStars = currentStars - reward.starsRequired;
    const now = new Date().toISOString();

    let claimCode = generateRewardClaimCode();
    while (
      claims.some(
        (c) => c.businessId === business.id && c.claimCode === claimCode,
      )
    ) {
      claimCode = generateRewardClaimCode();
    }

    const newStarTx: RestaurantLoyaltyStarTransaction = {
      id: `lstx-clm-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      businessId: business.id,
      customerId: params.customerId,
      txType: 'reward_redeemed',
      starsDelta: -reward.starsRequired,
      balanceAfter: newStars,
      idempotencyKey: cleanIdem,
      metadata: {
        rewardId: reward.id,
        rewardTitle: reward.title,
        claimCode,
      },
      createdAt: now,
    };

    const newClaim: RestaurantRewardClaim = {
      id: `rclm-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      businessId: business.id,
      customerId: params.customerId,
      rewardId: reward.id,
      rewardTitle: reward.title,
      claimCode,
      starsSpent: reward.starsRequired,
      status: 'pending_staff_verification',
      createdAt: now,
    };

    bizRewards[rewardIdx] = {
      ...reward,
      redemptionsCount: reward.redemptionsCount + 1,
      updatedAt: now,
    };
    rewardsStore[business.id] = bizRewards;

    starTxs.push(newStarTx);
    claims.push(newClaim);

    this.write(STORAGE_KEYS.RESTAURANT_REWARDS, rewardsStore);
    this.write(STORAGE_KEYS.RESTAURANT_LOYALTY_STAR_TXS, starTxs);
    this.write(STORAGE_KEYS.RESTAURANT_REWARD_CLAIMS, claims);

    return {
      alreadyProcessed: false,
      newLoyaltyStarsBalance: newStars,
      claim: newClaim,
    };
  }

  async submitRestaurantSuggestion(
    input: RestaurantSuggestionInput,
  ): Promise<RestaurantSuggestion> {
    const validation = validateRestaurantSuggestionInput(input);
    if (!validation.ok) {
      throw new Error(validation.error);
    }

    const business = await this.getBusinessBySlug(
      validation.value.businessSlug,
    );
    if (!business) {
      throw new Error('Restaurant is not active.');
    }

    const rulesStore = this.read<Record<string, RestaurantLoyaltyRules>>(
      STORAGE_KEYS.RESTAURANT_LOYALTY_RULES,
      {},
    );
    const rules = normalizeRestaurantLoyaltyRules(
      business.id,
      rulesStore[business.id],
    );
    if (!rules.suggestionBoxEnabled) {
      throw new Error(
        'Suggestion box is currently disabled for this restaurant.',
      );
    }

    let tableId: string | null = null;
    if (validation.value.tableKey) {
      const tableStore = this.read<Record<string, RestaurantTable[]>>(
        STORAGE_KEYS.RESTAURANT_TABLES,
        {},
      );
      const tbl = (tableStore[business.id] ?? []).find(
        (t) => t.tableKey === validation.value.tableKey,
      );
      tableId = tbl?.id ?? null;
    }

    const suggestions = this.read<RestaurantSuggestion[]>(
      STORAGE_KEYS.RESTAURANT_SUGGESTIONS,
      [],
    );
    const created: RestaurantSuggestion = {
      id: `sug-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      businessId: business.id,
      tableId,
      customerName: validation.value.customerName,
      message: validation.value.message,
      isRead: false,
      createdAt: new Date().toISOString(),
    };
    suggestions.unshift(created);
    this.write(STORAGE_KEYS.RESTAURANT_SUGGESTIONS, suggestions);
    return created;
  }

  async getRestaurantSuggestions(
    businessId: string,
    options?: AIConfigAccessOptions,
  ): Promise<RestaurantSuggestion[]> {
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

    const suggestions = this.read<RestaurantSuggestion[]>(
      STORAGE_KEYS.RESTAURANT_SUGGESTIONS,
      [],
    );
    return suggestions.filter((s) => s.businessId === cleanId);
  }

  async markRestaurantSuggestionRead(
    businessId: string,
    suggestionId: string,
    isRead = true,
    options?: AIConfigAccessOptions,
  ): Promise<RestaurantSuggestion> {
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

    const suggestions = this.read<RestaurantSuggestion[]>(
      STORAGE_KEYS.RESTAURANT_SUGGESTIONS,
      [],
    );
    const idx = suggestions.findIndex(
      (s) => s.id === suggestionId && s.businessId === cleanId,
    );
    if (idx === -1) {
      throw new Error(
        `Suggestion "${suggestionId}" not found for business "${cleanId}".`,
      );
    }

    const updated: RestaurantSuggestion = {
      ...suggestions[idx],
      isRead,
    };
    suggestions[idx] = updated;
    this.write(STORAGE_KEYS.RESTAURANT_SUGGESTIONS, suggestions);
    return updated;
  }

  // ---------------------------------------------------------------------------
  // Phase 4: Visual Table Floor Map, Staff Verification Mode & Owner Analytics
  // ---------------------------------------------------------------------------

  private findActiveStaffMemberByPin(
    businessId: string,
    staffPinHash?: string | null,
    staffCode?: string | null,
  ): RestaurantStaffMember | null {
    const cleanHash = (staffPinHash ?? '').trim().toLowerCase();
    if (!cleanHash) {
      return null;
    }
    const cleanCode = (staffCode ?? '').trim().toUpperCase();
    const store = this.read<Record<string, RestaurantStaffMember[]>>(
      STORAGE_KEYS.RESTAURANT_STAFF_MEMBERS,
      {},
    );
    const list = store[businessId] ?? [];
    return (
      list.find(
        (m) =>
          m.isActive &&
          m.pinHash === cleanHash &&
          (!cleanCode || m.staffCode.toUpperCase() === cleanCode),
      ) ?? null
    );
  }

  private resolveAuditStaffLabel(
    businessId: string,
    staffPinHash?: string | null,
    fallbackLabel?: string,
  ): string {
    const matched = this.findActiveStaffMemberByPin(businessId, staffPinHash);
    if (matched) {
      return formatStaffAuditLabel(matched.fullName, matched.staffCode);
    }
    return (fallbackLabel ?? '').trim().slice(0, 80) || 'Staff';
  }

  private assertOwnerOrStaffPin(
    business: Business,
    profile: RestaurantProfile,
    staffPinHash?: string | null,
    options?: AIConfigAccessOptions,
  ): void {
    // 1. If explicit actorOwnerId is supplied (e.g. cross-tenant tests or owner action), check ownership
    if (options?.actorOwnerId) {
      if (business.ownerId && options.actorOwnerId !== business.ownerId) {
        throw new Error(
          `Unauthorized: Owner "${options.actorOwnerId}" cannot access or modify restaurant staff data for business "${business.id}".`,
        );
      }
      return;
    }

    // 2. If staffPinHash is provided, verify it matches either an active staff member PIN OR legacy profile.staffPinHash
    if (staffPinHash !== undefined && staffPinHash !== null) {
      const cleanHash = staffPinHash.trim().toLowerCase();
      const matchedMember = this.findActiveStaffMemberByPin(
        business.id,
        cleanHash,
      );
      if (matchedMember) {
        return;
      }
      if (!profile.staffPinHash || profile.staffPinHash !== cleanHash) {
        throw new Error('Invalid Staff PIN.');
      }
      return;
    }
  }

  async createRestaurantTableCall(params: {
    businessSlug: string;
    tableKey: string;
    customerId?: string | null;
    callType: RestaurantTableCallType;
  }): Promise<RestaurantTableCall> {
    if (
      params.callType !== 'assistance' &&
      params.callType !== 'ready_for_bill'
    ) {
      throw new Error('Invalid table call type.');
    }

    const business = await this.getBusinessBySlug(params.businessSlug);
    if (!business) {
      throw new Error('Restaurant is not active.');
    }

    const cleanTableKey = deriveTableKey(params.tableKey);
    const tableStore = this.read<Record<string, RestaurantTable[]>>(
      STORAGE_KEYS.RESTAURANT_TABLES,
      {},
    );
    const table = (tableStore[business.id] ?? []).find(
      (t) => t.tableKey === cleanTableKey && t.isActive,
    );
    if (!table) {
      throw new Error('Table not found or inactive.');
    }

    const calls = this.read<RestaurantTableCall[]>(
      STORAGE_KEYS.RESTAURANT_TABLE_CALLS,
      [],
    );

    // Spam protection: reuse open/acknowledged call of same type for this table within 15 minutes
    const fifteenMinsAgo = Date.now() - 15 * 60 * 1000;
    const existing = calls.find(
      (c) =>
        c.businessId === business.id &&
        c.tableId === table.id &&
        c.callType === params.callType &&
        (c.status === 'open' || c.status === 'acknowledged') &&
        new Date(c.createdAt).getTime() >= fifteenMinsAgo,
    );
    if (existing) {
      return existing;
    }

    const created: RestaurantTableCall = {
      id: `call-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      businessId: business.id,
      tableId: table.id,
      tableNumber: table.tableNumber,
      tableKey: table.tableKey,
      customerId: params.customerId ?? null,
      callType: params.callType,
      status: 'open',
      createdAt: new Date().toISOString(),
      resolvedAt: null,
    };

    calls.unshift(created);
    this.write(STORAGE_KEYS.RESTAURANT_TABLE_CALLS, calls);
    return created;
  }

  async verifyRestaurantStaffPin(params: {
    businessSlug: string;
    staffPinHash?: string | null;
    options?: AIConfigAccessOptions;
  }): Promise<{
    verified: boolean;
    businessId: string;
    businessSlug: string;
    businessName: string;
  }> {
    const business = await this.getBusinessBySlug(params.businessSlug);
    if (!business) {
      throw new Error('Restaurant is not active.');
    }
    const profile = await this.getRestaurantProfile(business.id);
    const queueConfigStore = this.read<Record<string, BarberQueueConfig>>(
      STORAGE_KEYS.BARBER_QUEUE_CONFIGS,
      {},
    );
    const hasQueueAccess =
      Boolean(queueConfigStore[business.id]) ||
      isBarberOrSalonCategory(business.category);
    if (!profile.isEnabled && !hasQueueAccess) {
      throw new Error('Staff floor mode is not enabled for this business.');
    }

    if (params.options?.actorOwnerId) {
      this.assertOwnerAccess(business, params.options);
    } else {
      const cleanHash = (params.staffPinHash ?? '').trim().toLowerCase();
      const matchedMember = this.findActiveStaffMemberByPin(
        business.id,
        cleanHash,
      );
      if (
        !matchedMember &&
        (!profile.staffPinHash || !cleanHash || profile.staffPinHash !== cleanHash)
      ) {
        throw new Error('Invalid Staff PIN.');
      }
    }

    return {
      verified: true,
      businessId: business.id,
      businessSlug: business.slug,
      businessName: business.name,
    };
  }

  async updateRestaurantTableCallStatus(params: {
    businessSlug: string;
    callId: string;
    status: RestaurantTableCallStatus;
    staffPinHash?: string | null;
    options?: AIConfigAccessOptions;
  }): Promise<RestaurantTableCall> {
    if (
      params.status !== 'open' &&
      params.status !== 'acknowledged' &&
      params.status !== 'resolved'
    ) {
      throw new Error('Invalid table call status.');
    }

    const business = await this.getBusinessBySlug(params.businessSlug);
    if (!business) {
      throw new Error('Restaurant not found.');
    }
    const profileStore = this.read<Record<string, RestaurantProfile>>(
      STORAGE_KEYS.RESTAURANT_PROFILES,
      {},
    );
    const profile = normalizeRestaurantProfile(
      business.id,
      profileStore[business.id],
      'local',
    );
    this.assertOwnerOrStaffPin(
      business,
      profile,
      params.staffPinHash,
      params.options,
    );

    const calls = this.read<RestaurantTableCall[]>(
      STORAGE_KEYS.RESTAURANT_TABLE_CALLS,
      [],
    );
    const idx = calls.findIndex(
      (c) => c.id === params.callId && c.businessId === business.id,
    );
    if (idx === -1) {
      throw new Error('Table call alert not found.');
    }

    const updated: RestaurantTableCall = {
      ...calls[idx],
      status: params.status,
      resolvedAt:
        params.status === 'resolved' ? new Date().toISOString() : null,
    };
    calls[idx] = updated;
    this.write(STORAGE_KEYS.RESTAURANT_TABLE_CALLS, calls);
    return updated;
  }

  async staffAwardVisitStars(params: {
    businessSlug: string;
    customerLookup: string;
    tableKey?: string | null;
    staffLabel?: string;
    idempotencyKey: string;
    staffPinHash?: string | null;
    options?: AIConfigAccessOptions;
  }): Promise<RestaurantStaffAwardVisitResponse> {
    const cleanLookup = (params.customerLookup ?? '').trim();
    if (cleanLookup.length < 2) {
      throw new Error(
        'Please enter a customer Loyalty QR token, phone/email, or customer ID.',
      );
    }
    const cleanIdem = (params.idempotencyKey ?? '').trim();
    if (cleanIdem.length < 4 || cleanIdem.length > 160) {
      throw new Error('A valid idempotency key (4..160 chars) is required.');
    }

    const business = await this.getBusinessBySlug(params.businessSlug);
    if (!business) {
      throw new Error('Restaurant is not active.');
    }

    const profileStore = this.read<Record<string, RestaurantProfile>>(
      STORAGE_KEYS.RESTAURANT_PROFILES,
      {},
    );
    const profile = normalizeRestaurantProfile(
      business.id,
      profileStore[business.id],
      'local',
    );
    if (!profile.isEnabled || !profile.loyaltyEnabled) {
      throw new Error(
        'Loyalty Stars are currently disabled for this restaurant.',
      );
    }

    this.assertOwnerOrStaffPin(
      business,
      profile,
      params.staffPinHash,
      params.options,
    );

    const visits = this.read<RestaurantVerifiedVisit[]>(
      STORAGE_KEYS.RESTAURANT_VERIFIED_VISITS,
      [],
    );
    const starTxs = this.read<RestaurantLoyaltyStarTransaction[]>(
      STORAGE_KEYS.RESTAURANT_LOYALTY_STAR_TXS,
      [],
    );
    const customers = this.read<RestaurantCustomer[]>(
      STORAGE_KEYS.RESTAURANT_CUSTOMERS,
      [],
    );

    // 1. Idempotency check
    const existingVisit = visits.find(
      (v) => v.businessId === business.id && v.idempotencyKey === cleanIdem,
    );
    if (existingVisit) {
      const cust = customers.find((c) => c.id === existingVisit.customerId);
      const custStarTxs = starTxs
        .filter(
          (tx) =>
            tx.businessId === business.id &&
            tx.customerId === existingVisit.customerId,
        )
        .reverse();
      return {
        alreadyProcessed: true,
        visitId: existingVisit.id,
        customerId: existingVisit.customerId,
        customerName: cust?.displayName ?? 'Diner',
        starsAwarded: existingVisit.starsAwarded,
        newLoyaltyStarsBalance:
          custStarTxs.length > 0 ? custStarTxs[0].balanceAfter : 0,
        verifiedByLabel: existingVisit.verifiedByLabel,
        createdAt: existingVisit.createdAt,
      };
    }

    // 2. Resolve customer from Loyalty QR token (`vitaran-loyalty://<slug>/<customerId>`), customer ID, or phone/email
    const parsedLookup = parseCustomerLoyaltyLookup(cleanLookup);
    if (
      parsedLookup.mode === 'qr_token' &&
      parsedLookup.tokenBusinessSlug &&
      parsedLookup.tokenBusinessSlug !== business.slug.toLowerCase()
    ) {
      throw new Error(
        'This Loyalty QR Pass belongs to a different restaurant.',
      );
    }

    const customer = customers.find(
      (c) =>
        c.id === parsedLookup.value ||
        (c.phoneOrEmail &&
          c.phoneOrEmail.toLowerCase() === parsedLookup.value.toLowerCase()),
    );
    if (!customer) {
      throw new Error(
        `Diner account not found for "${cleanLookup}". Ask the guest to open their Loyalty QR pass or check their phone/email.`,
      );
    }

    // 3. Enforce cooldown between verified visit stars
    const minHours = profile.minHoursBetweenVisitStars ?? 4;
    if (minHours > 0) {
      const customerVisits = visits
        .filter(
          (v) => v.businessId === business.id && v.customerId === customer.id,
        )
        .reverse();
      if (customerVisits.length > 0) {
        const lastVisitMs = new Date(customerVisits[0].createdAt).getTime();
        const cooldownMs = minHours * 60 * 60 * 1000;
        if (Date.now() - lastVisitMs < cooldownMs) {
          throw new Error(
            `Visit Star cooldown active: this diner already received visit stars within the last ${minHours} hour(s).`,
          );
        }
      }
    }

    // 4. Load loyalty rules for `starsPerVerifiedVisit`
    const rulesStore = this.read<Record<string, RestaurantLoyaltyRules>>(
      STORAGE_KEYS.RESTAURANT_LOYALTY_RULES,
      {},
    );
    const rules = normalizeRestaurantLoyaltyRules(
      business.id,
      rulesStore[business.id],
    );

    let tableId: string | null = null;
    if (params.tableKey && params.tableKey.trim()) {
      const cleanTableKey = deriveTableKey(params.tableKey);
      const tableStore = this.read<Record<string, RestaurantTable[]>>(
        STORAGE_KEYS.RESTAURANT_TABLES,
        {},
      );
      const tbl = (tableStore[business.id] ?? []).find(
        (t) => t.tableKey === cleanTableKey,
      );
      tableId = tbl?.id ?? null;
    }

    const customerStarTxs = starTxs
      .filter(
        (tx) =>
          tx.businessId === business.id && tx.customerId === customer.id,
      )
      .reverse();
    const currentStars =
      customerStarTxs.length > 0 ? customerStarTxs[0].balanceAfter : 0;
    const newStars = currentStars + rules.starsPerVerifiedVisit;
    const now = new Date().toISOString();
    const staffLabel = this.resolveAuditStaffLabel(
      business.id,
      params.staffPinHash,
      params.staffLabel,
    );

    const visitId = `vvisit-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const newVisit: RestaurantVerifiedVisit = {
      id: visitId,
      businessId: business.id,
      tableId,
      customerId: customer.id,
      customerName: customer.displayName,
      starsAwarded: rules.starsPerVerifiedVisit,
      verifiedByLabel: staffLabel,
      idempotencyKey: cleanIdem,
      createdAt: now,
    };

    const newStarTx: RestaurantLoyaltyStarTransaction = {
      id: `lstx-vv-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      businessId: business.id,
      customerId: customer.id,
      txType: 'verified_visit',
      starsDelta: rules.starsPerVerifiedVisit,
      balanceAfter: newStars,
      idempotencyKey: cleanIdem,
      verifiedByStaffLabel: staffLabel,
      metadata: {
        visitId,
        tableId,
      },
      createdAt: now,
    };

    visits.push(newVisit);
    starTxs.push(newStarTx);
    this.write(STORAGE_KEYS.RESTAURANT_VERIFIED_VISITS, visits);
    this.write(STORAGE_KEYS.RESTAURANT_LOYALTY_STAR_TXS, starTxs);

    return {
      alreadyProcessed: false,
      visitId,
      customerId: customer.id,
      customerName: customer.displayName,
      starsAwarded: rules.starsPerVerifiedVisit,
      newLoyaltyStarsBalance: newStars,
      verifiedByLabel: staffLabel,
      createdAt: now,
    };
  }

  async staffFulfillRewardClaim(params: {
    businessSlug: string;
    claimCode: string;
    staffLabel?: string;
    staffPinHash?: string | null;
    options?: AIConfigAccessOptions;
  }): Promise<RestaurantRewardClaim & { customerName?: string }> {
    const cleanCode = (params.claimCode ?? '').trim().toUpperCase();
    if (!/^[A-Z0-9]{6}$/.test(cleanCode)) {
      throw new Error(
        'Claim code must be a 6-character alphanumeric code.',
      );
    }

    const business = await this.getBusinessBySlug(params.businessSlug);
    if (!business) {
      throw new Error('Restaurant is not active.');
    }

    const profileStore = this.read<Record<string, RestaurantProfile>>(
      STORAGE_KEYS.RESTAURANT_PROFILES,
      {},
    );
    const profile = normalizeRestaurantProfile(
      business.id,
      profileStore[business.id],
      'local',
    );
    this.assertOwnerOrStaffPin(
      business,
      profile,
      params.staffPinHash,
      params.options,
    );

    const claims = this.read<RestaurantRewardClaim[]>(
      STORAGE_KEYS.RESTAURANT_REWARD_CLAIMS,
      [],
    );
    const idx = claims.findIndex(
      (c) => c.businessId === business.id && c.claimCode === cleanCode,
    );
    if (idx === -1) {
      throw new Error(
        `Reward claim code "${cleanCode}" not found for this restaurant.`,
      );
    }

    const claim = claims[idx];
    if (claim.status === 'fulfilled') {
      throw new Error(
        `Reward claim code "${cleanCode}" has already been fulfilled.`,
      );
    }
    if (claim.status === 'cancelled') {
      throw new Error(`Reward claim code "${cleanCode}" was cancelled.`);
    }

    const staffLabel = this.resolveAuditStaffLabel(
      business.id,
      params.staffPinHash,
      params.staffLabel,
    );
    const updated: RestaurantRewardClaim = {
      ...claim,
      status: 'fulfilled',
      fulfilledAt: new Date().toISOString(),
      fulfilledBy: staffLabel,
    };
    claims[idx] = updated;
    this.write(STORAGE_KEYS.RESTAURANT_REWARD_CLAIMS, claims);

    const customers = this.read<RestaurantCustomer[]>(
      STORAGE_KEYS.RESTAURANT_CUSTOMERS,
      [],
    );
    const cust = customers.find((c) => c.id === updated.customerId);

    return {
      ...updated,
      customerName: cust?.displayName ?? 'Diner',
    };
  }

  async getRestaurantFloorAndAnalytics(params: {
    businessSlug: string;
    staffPinHash?: string | null;
    options?: AIConfigAccessOptions;
  }): Promise<RestaurantFloorAndAnalyticsPayload> {
    const list = await this.getBusinesses();
    const business =
      list.find(
        (b) => b.slug.toLowerCase() === params.businessSlug.trim().toLowerCase(),
      ) ?? null;
    if (!business) {
      throw new Error('Restaurant not found.');
    }

    const profileStore = this.read<Record<string, RestaurantProfile>>(
      STORAGE_KEYS.RESTAURANT_PROFILES,
      {},
    );
    const profile = normalizeRestaurantProfile(
      business.id,
      profileStore[business.id],
      'local',
    );
    this.assertOwnerOrStaffPin(
      business,
      profile,
      params.staffPinHash,
      params.options,
    );

    const calls = this.read<RestaurantTableCall[]>(
      STORAGE_KEYS.RESTAURANT_TABLE_CALLS,
      [],
    ).filter(
      (c) =>
        c.businessId === business.id &&
        (c.status === 'open' || c.status === 'acknowledged'),
    );

    const customers = this.read<RestaurantCustomer[]>(
      STORAGE_KEYS.RESTAURANT_CUSTOMERS,
      [],
    );
    const custMap = new Map(customers.map((c) => [c.id, c.displayName]));

    const allClaims = this.read<RestaurantRewardClaim[]>(
      STORAGE_KEYS.RESTAURANT_REWARD_CLAIMS,
      [],
    ).filter((c) => c.businessId === business.id);

    const pendingRewardClaims = allClaims
      .filter((c) => c.status === 'pending_staff_verification')
      .map((c) => ({
        ...c,
        customerName: custMap.get(c.customerId) ?? 'Diner',
      }));

    const metrics = await this.getMetrics(business.id);
    const sessions = this.read<RestaurantGameSession[]>(
      STORAGE_KEYS.RESTAURANT_GAME_SESSIONS,
      [],
    ).filter((s) => s.businessId === business.id);
    const completedGames = sessions.filter((s) => s.status === 'completed');

    const pointTxs = this.read<RestaurantGamePointTransaction[]>(
      STORAGE_KEYS.RESTAURANT_GAME_POINT_TXS,
      [],
    ).filter((tx) => tx.businessId === business.id && tx.pointsDelta > 0);
    const gamePointsIssued = pointTxs.reduce(
      (sum, tx) => sum + tx.pointsDelta,
      0,
    );

    const verifiedVisits = this.read<RestaurantVerifiedVisit[]>(
      STORAGE_KEYS.RESTAURANT_VERIFIED_VISITS,
      [],
    ).filter((v) => v.businessId === business.id);

    const starTxs = this.read<RestaurantLoyaltyStarTransaction[]>(
      STORAGE_KEYS.RESTAURANT_LOYALTY_STAR_TXS,
      [],
    ).filter((tx) => tx.businessId === business.id && tx.starsDelta > 0);
    const loyaltyStarsIssued = starTxs.reduce(
      (sum, tx) => sum + tx.starsDelta,
      0,
    );

    const distinctCustomers = new Set<string>();
    for (const s of sessions) distinctCustomers.add(s.customerId);
    for (const tx of starTxs) distinctCustomers.add(tx.customerId);
    for (const v of verifiedVisits) distinctCustomers.add(v.customerId);

    const allOrders = this.read<RestaurantTableOrder[]>(
      STORAGE_KEYS.RESTAURANT_TABLE_ORDERS,
      [],
    ).filter(
      (o) =>
        o.businessId === business.id &&
        (o.status === 'pending_approval' ||
          o.status === 'approved_for_kitchen' ||
          o.status === 'preparing'),
    );

    const activeTableOrders = [...allOrders].reverse();

    const startOfToday = new Date();
    startOfToday.setUTCHours(0, 0, 0, 0);
    const todayMs = startOfToday.getTime();
    const staffVerificationCountsToday: Record<string, number> = {};
    for (const visit of verifiedVisits) {
      if (new Date(visit.createdAt).getTime() >= todayMs) {
        const key = visit.verifiedByLabel || 'Staff';
        staffVerificationCountsToday[key] =
          (staffVerificationCountsToday[key] ?? 0) + 1;
      }
    }

    return {
      activeTableCalls: calls,
      pendingRewardClaims,
      tableOrderingEnabled: Boolean(profile.tableOrderingEnabled),
      businessMode: profile.businessMode ?? 'restaurant',
      tableOrders: activeTableOrders,
      staffVerificationCountsToday,
      analytics: {
        qrScans: metrics.qrScans,
        checkedInDiners: distinctCustomers.size,
        gamesPlayed: completedGames.length,
        gamePointsIssued,
        verifiedPaidVisits: verifiedVisits.length,
        loyaltyStarsIssued,
        rewardsClaimed: allClaims.length,
        rewardsFulfilled: allClaims.filter((c) => c.status === 'fulfilled')
          .length,
      },
    };
  }

  // ---------------------------------------------------------------------------
  // Master Upgrade: 1-Tap Preset Menu Injection & Optional Table Ordering
  // ---------------------------------------------------------------------------

  async applyRestaurantMenuPreset(
    businessId: string,
    presetKey: MenuPresetKey,
    options?: AIConfigAccessOptions,
  ): Promise<ApplyMenuPresetResult> {
    const idErr = validateBusinessId(businessId);
    if (idErr) {
      throw new Error(idErr);
    }
    const presetCheck = validateMenuPresetKey(presetKey);
    if (!presetCheck.ok) {
      throw new Error(presetCheck.error);
    }

    const cleanId = businessId.trim();
    const business = await this.getBusinessById(cleanId);
    if (!business) {
      throw new Error(`Business with ID "${cleanId}" not found.`);
    }
    this.assertOwnerAccess(business, options);

    const pack = MENU_PRESET_PACKS[presetCheck.value];

    const catStore = this.read<Record<string, RestaurantMenuCategory[]>>(
      STORAGE_KEYS.RESTAURANT_CATEGORIES,
      {},
    );
    const itemStore = this.read<Record<string, RestaurantMenuItem[]>>(
      STORAGE_KEYS.RESTAURANT_ITEMS,
      {},
    );
    const rewardStore = this.read<Record<string, RestaurantReward[]>>(
      STORAGE_KEYS.RESTAURANT_REWARDS,
      {},
    );
    const profileStore = this.read<Record<string, RestaurantProfile>>(
      STORAGE_KEYS.RESTAURANT_PROFILES,
      {},
    );

    const existingCats = catStore[cleanId] ?? [];
    const existingItems = itemStore[cleanId] ?? [];
    const existingRewards = rewardStore[cleanId] ?? [];
    const now = new Date().toISOString();

    const newCategories: RestaurantMenuCategory[] = [];
    const newItems: RestaurantMenuItem[] = [];

    pack.categories.forEach((catSpec, catIdx) => {
      const catId = `cat-preset-${Date.now()}-${catIdx}-${Math.random().toString(36).slice(2, 6)}`;
      newCategories.push({
        id: catId,
        businessId: cleanId,
        name: catSpec.name,
        description: catSpec.description,
        displayOrder: existingCats.length + catIdx,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      });

      catSpec.dishes.forEach((dishSpec, dishIdx) => {
        newItems.push({
          id: `item-preset-${Date.now()}-${catIdx}-${dishIdx}-${Math.random().toString(36).slice(2, 6)}`,
          businessId: cleanId,
          categoryId: catId,
          name: dishSpec.name,
          description: dishSpec.description,
          pricePaise: dishSpec.pricePaise,
          dietaryTag: dishSpec.dietaryTag,
          isAvailable: true,
          isFeatured: Boolean(dishSpec.isFeatured),
          imageUrl: null,
          displayOrder: dishIdx,
          createdAt: now,
          updatedAt: now,
        });
      });
    });

    catStore[cleanId] = [...existingCats, ...newCategories];
    itemStore[cleanId] = [...existingItems, ...newItems];
    this.write(STORAGE_KEYS.RESTAURANT_CATEGORIES, catStore);
    this.write(STORAGE_KEYS.RESTAURANT_ITEMS, itemStore);

    let rewardsInserted = 0;
    if (existingRewards.length === 0) {
      const seededRewards: RestaurantReward[] = pack.starterRewards.map(
        (rSpec, idx) => ({
          id: `rwd-preset-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
          businessId: cleanId,
          title: rSpec.title,
          description: rSpec.description,
          starsRequired: rSpec.starsRequired,
          isActive: true,
          maxRedemptionsTotal: null,
          redemptionsCount: 0,
          displayOrder: idx,
          createdAt: now,
          updatedAt: now,
        }),
      );
      rewardStore[cleanId] = seededRewards;
      this.write(STORAGE_KEYS.RESTAURANT_REWARDS, rewardStore);
      rewardsInserted = seededRewards.length;
    }

    const existingProf = normalizeRestaurantProfile(
      cleanId,
      profileStore[cleanId],
      'local',
    );
    profileStore[cleanId] = {
      ...existingProf,
      isEnabled: true,
      menuThemeTemplate: pack.themeTemplate,
      tagline: existingProf.tagline || pack.tagline,
      updatedAt: now,
    };
    this.write(STORAGE_KEYS.RESTAURANT_PROFILES, profileStore);

    return {
      presetKey: pack.presetKey,
      themeTemplate: pack.themeTemplate,
      categoriesInserted: newCategories.length,
      itemsInserted: newItems.length,
      rewardsInserted,
    };
  }

  async submitCustomerTableOrder(params: {
    businessSlug: string;
    tableKey?: string | null;
    customerId?: string | null;
    guestName?: string | null;
    items: Array<{ itemId: string; quantity: number; notes?: string | null }>;
  }): Promise<RestaurantTableOrder> {
    const itemsValidation = validateTableOrderItemsInput(params.items);
    if (!itemsValidation.ok) {
      throw new Error(itemsValidation.error);
    }

    const business = await this.getBusinessBySlug(params.businessSlug);
    if (!business) {
      throw new Error('Restaurant is not active.');
    }

    const profileStore = this.read<Record<string, RestaurantProfile>>(
      STORAGE_KEYS.RESTAURANT_PROFILES,
      {},
    );
    const profile = normalizeRestaurantProfile(
      business.id,
      profileStore[business.id],
      'local',
    );
    if (!profile.isEnabled) {
      throw new Error('Digital menu is not enabled for this restaurant.');
    }
    if (!profile.tableOrderingEnabled) {
      throw new Error(
        'Customer phone ordering is currently turned off. Please place your order with your server.',
      );
    }

    const catStore = this.read<Record<string, RestaurantMenuCategory[]>>(
      STORAGE_KEYS.RESTAURANT_CATEGORIES,
      {},
    );
    const activeCatIds = new Set(
      (catStore[business.id] ?? [])
        .filter((c) => c.isActive)
        .map((c) => c.id),
    );

    const itemStore = this.read<Record<string, RestaurantMenuItem[]>>(
      STORAGE_KEYS.RESTAURANT_ITEMS,
      {},
    );
    const bizItems = itemStore[business.id] ?? [];

    const validatedItems: RestaurantTableOrderItem[] = [];
    for (const reqItem of itemsValidation.value) {
      const catalogItem = bizItems.find(
        (i) =>
          i.id === reqItem.itemId &&
          i.isAvailable &&
          activeCatIds.has(i.categoryId),
      );
      if (!catalogItem) {
        throw new Error(
          'One or more selected menu items are currently unavailable.',
        );
      }
      validatedItems.push({
        itemId: catalogItem.id,
        name: catalogItem.name,
        quantity: reqItem.quantity,
        pricePaise: catalogItem.pricePaise,
        notes: reqItem.notes,
      });
    }

    let tableId: string | null = null;
    let tableNumber: string | null = null;
    let resolvedTableKey: string | null = null;
    if (params.tableKey && params.tableKey.trim()) {
      const cleanKey = deriveTableKey(params.tableKey);
      const tableStore = this.read<Record<string, RestaurantTable[]>>(
        STORAGE_KEYS.RESTAURANT_TABLES,
        {},
      );
      const tbl = (tableStore[business.id] ?? []).find(
        (t) => t.tableKey === cleanKey && t.isActive,
      );
      if (tbl) {
        tableId = tbl.id;
        tableNumber = tbl.tableNumber;
        resolvedTableKey = tbl.tableKey;
      }
    }

    const now = new Date().toISOString();
    const order: RestaurantTableOrder = {
      id: `tord-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      businessId: business.id,
      tableId,
      tableNumber,
      tableKey: resolvedTableKey,
      customerId: params.customerId ?? null,
      guestName: params.guestName?.trim().slice(0, 80) || null,
      items: validatedItems,
      status: 'pending_approval',
      approvedBy: null,
      createdAt: now,
      updatedAt: now,
    };

    const orders = this.read<RestaurantTableOrder[]>(
      STORAGE_KEYS.RESTAURANT_TABLE_ORDERS,
      [],
    );
    orders.push(order);
    this.write(STORAGE_KEYS.RESTAURANT_TABLE_ORDERS, orders);
    return order;
  }

  async updateTableOrderStatus(params: {
    businessSlug: string;
    orderId: string;
    status: RestaurantTableOrderStatus;
    staffLabel?: string;
    staffPinHash?: string | null;
    options?: AIConfigAccessOptions;
  }): Promise<RestaurantTableOrder> {
    const statusCheck = validateTableOrderStatus(params.status);
    if (!statusCheck.ok) {
      throw new Error(statusCheck.error);
    }

    const list = await this.getBusinesses();
    const business =
      list.find(
        (b) => b.slug.toLowerCase() === params.businessSlug.trim().toLowerCase(),
      ) ?? null;
    if (!business) {
      throw new Error('Restaurant not found.');
    }

    const profileStore = this.read<Record<string, RestaurantProfile>>(
      STORAGE_KEYS.RESTAURANT_PROFILES,
      {},
    );
    const profile = normalizeRestaurantProfile(
      business.id,
      profileStore[business.id],
      'local',
    );
    this.assertOwnerOrStaffPin(
      business,
      profile,
      params.staffPinHash,
      params.options,
    );

    const orders = this.read<RestaurantTableOrder[]>(
      STORAGE_KEYS.RESTAURANT_TABLE_ORDERS,
      [],
    );
    const idx = orders.findIndex(
      (o) => o.id === params.orderId && o.businessId === business.id,
    );
    if (idx === -1) {
      throw new Error('Table order not found for this restaurant.');
    }

    const staffLabel = this.resolveAuditStaffLabel(
      business.id,
      params.staffPinHash,
      params.staffLabel,
    );
    const existing = orders[idx];
    const shouldRecordApprover =
      statusCheck.value === 'approved_for_kitchen' ||
      statusCheck.value === 'preparing' ||
      statusCheck.value === 'served';

    const updated: RestaurantTableOrder = {
      ...existing,
      status: statusCheck.value,
      approvedBy: shouldRecordApprover
        ? (existing.approvedBy ?? staffLabel)
        : existing.approvedBy,
      updatedAt: new Date().toISOString(),
    };
    orders[idx] = updated;
    this.write(STORAGE_KEYS.RESTAURANT_TABLE_ORDERS, orders);
    return updated;
  }

  // ---------------------------------------------------------------------------
  // Master Upgrade II: Individual Staff Roster & Monthly Inventory / Expenses
  // ---------------------------------------------------------------------------

  async getRestaurantStaffMembers(
    businessId: string,
    options?: AIConfigAccessOptions,
  ): Promise<RestaurantStaffMember[]> {
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

    const store = this.read<Record<string, RestaurantStaffMember[]>>(
      STORAGE_KEYS.RESTAURANT_STAFF_MEMBERS,
      {},
    );
    return [...(store[cleanId] ?? [])].sort((a, b) =>
      a.staffCode.localeCompare(b.staffCode),
    );
  }

  async createRestaurantStaffMember(
    businessId: string,
    input: RestaurantStaffMemberInput,
    options?: AIConfigAccessOptions,
  ): Promise<RestaurantStaffMember> {
    const validation = validateStaffMemberInput(businessId, input, true);
    if (!validation.ok) {
      throw new Error(validation.error);
    }
    const cleanId = businessId.trim();
    const business = await this.getBusinessById(cleanId);
    if (!business) {
      throw new Error(`Business with ID "${cleanId}" not found.`);
    }
    this.assertOwnerAccess(business, options);

    const store = this.read<Record<string, RestaurantStaffMember[]>>(
      STORAGE_KEYS.RESTAURANT_STAFF_MEMBERS,
      {},
    );
    const list = store[cleanId] ?? [];
    const staffCode =
      validation.value.staffCode ??
      generateNextStaffCode(
        validation.value.role,
        list.map((m) => m.staffCode),
      );

    if (
      list.some(
        (m) => m.staffCode.toUpperCase() === staffCode.toUpperCase(),
      )
    ) {
      throw new Error(
        `Staff ID "${staffCode}" is already assigned to another team member.`,
      );
    }

    const now = new Date().toISOString();
    const created: RestaurantStaffMember = {
      id: `stf-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      businessId: cleanId,
      staffCode,
      fullName: validation.value.fullName,
      role: validation.value.role,
      pinHash: validation.value.pinHash!,
      isActive: validation.value.isActive,
      createdAt: now,
      updatedAt: now,
    };

    store[cleanId] = [...list, created];
    this.write(STORAGE_KEYS.RESTAURANT_STAFF_MEMBERS, store);
    return created;
  }

  async updateRestaurantStaffMember(
    businessId: string,
    staffId: string,
    input: RestaurantStaffMemberInput,
    options?: AIConfigAccessOptions,
  ): Promise<RestaurantStaffMember> {
    const validation = validateStaffMemberInput(businessId, input, false);
    if (!validation.ok) {
      throw new Error(validation.error);
    }
    const cleanId = businessId.trim();
    const business = await this.getBusinessById(cleanId);
    if (!business) {
      throw new Error(`Business with ID "${cleanId}" not found.`);
    }
    this.assertOwnerAccess(business, options);

    const store = this.read<Record<string, RestaurantStaffMember[]>>(
      STORAGE_KEYS.RESTAURANT_STAFF_MEMBERS,
      {},
    );
    const list = store[cleanId] ?? [];
    const idx = list.findIndex((m) => m.id === staffId);
    if (idx === -1) {
      throw new Error(`Staff member "${staffId}" not found for this business.`);
    }

    const existing = list[idx];
    const nextCode = validation.value.staffCode ?? existing.staffCode;
    if (
      list.some(
        (m) =>
          m.id !== staffId &&
          m.staffCode.toUpperCase() === nextCode.toUpperCase(),
      )
    ) {
      throw new Error(
        `Staff ID "${nextCode}" is already assigned to another team member.`,
      );
    }

    const updated: RestaurantStaffMember = {
      ...existing,
      staffCode: nextCode,
      fullName: validation.value.fullName,
      role: validation.value.role,
      pinHash: validation.value.pinHash ?? existing.pinHash,
      isActive: validation.value.isActive,
      updatedAt: new Date().toISOString(),
    };
    list[idx] = updated;
    store[cleanId] = list;
    this.write(STORAGE_KEYS.RESTAURANT_STAFF_MEMBERS, store);
    return updated;
  }

  async deleteRestaurantStaffMember(
    businessId: string,
    staffId: string,
    options?: AIConfigAccessOptions,
  ): Promise<void> {
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

    const store = this.read<Record<string, RestaurantStaffMember[]>>(
      STORAGE_KEYS.RESTAURANT_STAFF_MEMBERS,
      {},
    );
    const list = store[cleanId] ?? [];
    if (!list.some((m) => m.id === staffId)) {
      throw new Error(`Staff member "${staffId}" not found for this business.`);
    }
    store[cleanId] = list.filter((m) => m.id !== staffId);
    this.write(STORAGE_KEYS.RESTAURANT_STAFF_MEMBERS, store);
  }

  async getPublicStaffLoginDirectory(
    businessSlug: string,
  ): Promise<PublicStaffLoginOption[]> {
    const business = await this.getBusinessBySlug(businessSlug);
    if (
      !business ||
      business.status !== 'active' ||
      business.accountState !== 'active'
    ) {
      return [];
    }
    const profileStore = this.read<Record<string, RestaurantProfile>>(
      STORAGE_KEYS.RESTAURANT_PROFILES,
      {},
    );
    const profile = normalizeRestaurantProfile(
      business.id,
      profileStore[business.id],
      'local',
    );
    const queueConfigStore = this.read<Record<string, BarberQueueConfig>>(
      STORAGE_KEYS.BARBER_QUEUE_CONFIGS,
      {},
    );
    const hasQueueAccess =
      Boolean(queueConfigStore[business.id]) ||
      isBarberOrSalonCategory(business.category);
    if (!profile.isEnabled && !hasQueueAccess) {
      return [];
    }
    const store = this.read<Record<string, RestaurantStaffMember[]>>(
      STORAGE_KEYS.RESTAURANT_STAFF_MEMBERS,
      {},
    );
    return (store[business.id] ?? [])
      .filter((m) => m.isActive)
      .sort((a, b) => a.staffCode.localeCompare(b.staffCode))
      .map((m) => ({
        id: m.id,
        staffCode: m.staffCode,
        fullName: m.fullName,
        role: m.role,
      }));
  }

  async verifyStaffMemberPin(params: {
    businessSlug: string;
    staffCode?: string | null;
    staffPinHash?: string | null;
    options?: AIConfigAccessOptions;
  }): Promise<VerifiedStaffMemberSession> {
    const business = await this.getBusinessBySlug(params.businessSlug);
    if (
      !business ||
      business.status !== 'active' ||
      business.accountState !== 'active'
    ) {
      throw new Error('Restaurant is not active.');
    }
    const profileStore = this.read<Record<string, RestaurantProfile>>(
      STORAGE_KEYS.RESTAURANT_PROFILES,
      {},
    );
    const profile = normalizeRestaurantProfile(
      business.id,
      profileStore[business.id],
      'local',
    );
    const queueConfigStore = this.read<Record<string, BarberQueueConfig>>(
      STORAGE_KEYS.BARBER_QUEUE_CONFIGS,
      {},
    );
    const hasQueueAccess =
      Boolean(queueConfigStore[business.id]) ||
      isBarberOrSalonCategory(business.category);
    if (!profile.isEnabled && !hasQueueAccess) {
      throw new Error('Staff floor mode is not enabled for this business.');
    }

    if (params.options?.actorOwnerId) {
      this.assertOwnerAccess(business, params.options);
      return {
        verified: true,
        staffId: null,
        staffCode: 'OWNER',
        fullName: 'Owner',
        role: 'manager',
        staffLabel: 'Owner',
        businessId: business.id,
        businessSlug: business.slug,
        businessName: business.name,
        businessMode: profile.businessMode ?? 'restaurant',
      };
    }

    const cleanHash = (params.staffPinHash ?? '').trim().toLowerCase();
    const cleanCode = (params.staffCode ?? '').trim().toUpperCase();
    if (!cleanHash) {
      throw new Error('Invalid Staff ID or PIN.');
    }

    // 1. Check active individual staff roster first
    const matchedMember = this.findActiveStaffMemberByPin(
      business.id,
      cleanHash,
      cleanCode || null,
    );
    if (matchedMember) {
      return {
        verified: true,
        staffId: matchedMember.id,
        staffCode: matchedMember.staffCode,
        fullName: matchedMember.fullName,
        role: matchedMember.role,
        staffLabel: formatStaffAuditLabel(
          matchedMember.fullName,
          matchedMember.staffCode,
        ),
        businessId: business.id,
        businessSlug: business.slug,
        businessName: business.name,
        businessMode: profile.businessMode ?? 'restaurant',
      };
    }

    // 2. Fallback to legacy restaurant-level shared Staff PIN when no specific staffCode mismatch
    if (
      !cleanCode &&
      profile.staffPinHash &&
      profile.staffPinHash === cleanHash
    ) {
      return {
        verified: true,
        staffId: null,
        staffCode: 'STAFF',
        fullName: 'Floor Staff',
        role: 'manager',
        staffLabel: 'Floor Staff (STAFF)',
        businessId: business.id,
        businessSlug: business.slug,
        businessName: business.name,
        businessMode: profile.businessMode ?? 'restaurant',
      };
    }

    throw new Error('Invalid Staff ID or PIN.');
  }

  async getRestaurantMonthlyInventory(
    businessId: string,
    monthKey?: string | null,
    options?: AIConfigAccessOptions,
  ): Promise<RestaurantMonthlyInventoryItem[]> {
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

    const store = this.read<Record<string, RestaurantMonthlyInventoryItem[]>>(
      STORAGE_KEYS.RESTAURANT_MONTHLY_INVENTORY,
      {},
    );
    const list = store[cleanId] ?? [];
    const cleanMonth = (monthKey ?? '').trim();
    const filtered = cleanMonth
      ? list.filter((item) => item.monthKey === cleanMonth)
      : list;
    return [...filtered].reverse();
  }

  async createRestaurantMonthlyInventoryItem(
    businessId: string,
    input: RestaurantMonthlyInventoryInput,
    options?: AIConfigAccessOptions,
  ): Promise<RestaurantMonthlyInventoryItem> {
    const validation = validateMonthlyInventoryInput(businessId, input);
    if (!validation.ok) {
      throw new Error(validation.error);
    }
    const cleanId = businessId.trim();
    const business = await this.getBusinessById(cleanId);
    if (!business) {
      throw new Error(`Business with ID "${cleanId}" not found.`);
    }
    this.assertOwnerAccess(business, options);

    const store = this.read<Record<string, RestaurantMonthlyInventoryItem[]>>(
      STORAGE_KEYS.RESTAURANT_MONTHLY_INVENTORY,
      {},
    );
    const list = store[cleanId] ?? [];
    const now = new Date().toISOString();
    const created: RestaurantMonthlyInventoryItem = {
      id: `inv-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      businessId: cleanId,
      monthKey: validation.value.monthKey,
      entryType: validation.value.entryType,
      category: validation.value.category,
      itemName: validation.value.itemName,
      quantityLabel: validation.value.quantityLabel,
      amountPaise: validation.value.amountPaise,
      lowStockAlert: validation.value.lowStockAlert,
      notes: validation.value.notes,
      createdAt: now,
      updatedAt: now,
    };
    store[cleanId] = [...list, created];
    this.write(STORAGE_KEYS.RESTAURANT_MONTHLY_INVENTORY, store);
    return created;
  }

  async updateRestaurantMonthlyInventoryItem(
    businessId: string,
    itemId: string,
    input: RestaurantMonthlyInventoryInput,
    options?: AIConfigAccessOptions,
  ): Promise<RestaurantMonthlyInventoryItem> {
    const validation = validateMonthlyInventoryInput(businessId, input);
    if (!validation.ok) {
      throw new Error(validation.error);
    }
    const cleanId = businessId.trim();
    const business = await this.getBusinessById(cleanId);
    if (!business) {
      throw new Error(`Business with ID "${cleanId}" not found.`);
    }
    this.assertOwnerAccess(business, options);

    const store = this.read<Record<string, RestaurantMonthlyInventoryItem[]>>(
      STORAGE_KEYS.RESTAURANT_MONTHLY_INVENTORY,
      {},
    );
    const list = store[cleanId] ?? [];
    const idx = list.findIndex((i) => i.id === itemId);
    if (idx === -1) {
      throw new Error(
        `Inventory/expense entry "${itemId}" not found for this business.`,
      );
    }

    const updated: RestaurantMonthlyInventoryItem = {
      ...list[idx],
      monthKey: validation.value.monthKey,
      entryType: validation.value.entryType,
      category: validation.value.category,
      itemName: validation.value.itemName,
      quantityLabel: validation.value.quantityLabel,
      amountPaise: validation.value.amountPaise,
      lowStockAlert: validation.value.lowStockAlert,
      notes: validation.value.notes,
      updatedAt: new Date().toISOString(),
    };
    list[idx] = updated;
    store[cleanId] = list;
    this.write(STORAGE_KEYS.RESTAURANT_MONTHLY_INVENTORY, store);
    return updated;
  }

  async deleteRestaurantMonthlyInventoryItem(
    businessId: string,
    itemId: string,
    options?: AIConfigAccessOptions,
  ): Promise<void> {
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

    const store = this.read<Record<string, RestaurantMonthlyInventoryItem[]>>(
      STORAGE_KEYS.RESTAURANT_MONTHLY_INVENTORY,
      {},
    );
    const list = store[cleanId] ?? [];
    if (!list.some((i) => i.id === itemId)) {
      throw new Error(
        `Inventory/expense entry "${itemId}" not found for this business.`,
      );
    }
    store[cleanId] = list.filter((i) => i.id !== itemId);
    this.write(STORAGE_KEYS.RESTAURANT_MONTHLY_INVENTORY, store);
  }

  // ---------------------------------------------------------------------------
  // Module 4: Barber & Salon Live Queue Timer, Broadcast Delays & Loyalty
  // ---------------------------------------------------------------------------

  private computeInChairRemainingMinutes(
    ticket: BarberQueueTicket | null,
  ): number {
    if (!ticket) return 0;
    const startedMs = new Date(ticket.startedAt ?? ticket.createdAt).getTime();
    const elapsedMins = Math.max(
      0,
      Math.floor((Date.now() - startedMs) / 60000),
    );
    return Math.max(1, ticket.durationMinutes - elapsedMins);
  }

  async getBarberQueueConfig(
    businessId: string,
    options?: AIConfigAccessOptions,
  ): Promise<BarberQueueConfig> {
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

    const store = this.read<Record<string, BarberQueueConfig>>(
      STORAGE_KEYS.BARBER_QUEUE_CONFIGS,
      {},
    );
    return normalizeBarberQueueConfig(cleanId, store[cleanId]);
  }

  async updateBarberQueueConfig(
    businessId: string,
    input: BarberQueueConfigInput,
    options?: AIConfigAccessOptions,
  ): Promise<BarberQueueConfig> {
    const validation = validateBarberQueueConfigInput(businessId, input);
    if (!validation.ok) {
      throw new Error(validation.error);
    }
    const cleanId = businessId.trim();
    const business = await this.getBusinessById(cleanId);
    if (!business) {
      throw new Error(`Business with ID "${cleanId}" not found.`);
    }
    this.assertOwnerAccess(business, options);

    const store = this.read<Record<string, BarberQueueConfig>>(
      STORAGE_KEYS.BARBER_QUEUE_CONFIGS,
      {},
    );
    const now = new Date().toISOString();
    const existing = store[cleanId];
    const updated: BarberQueueConfig = {
      businessId: cleanId,
      isQueueOpen: validation.value.isQueueOpen,
      avgServiceMinutes: validation.value.avgServiceMinutes,
      maxQueueSize: validation.value.maxQueueSize,
      awardStarOnCompletion: validation.value.awardStarOnCompletion,
      services: validation.value.services,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    store[cleanId] = updated;
    this.write(STORAGE_KEYS.BARBER_QUEUE_CONFIGS, store);
    return updated;
  }

  async getPublicBarberQueueStatus(
    businessSlug: string,
  ): Promise<PublicBarberQueueStatusPayload | null> {
    const cleanSlug = (businessSlug ?? '').trim().toLowerCase();
    if (!/^[a-z0-9-]{3,80}$/.test(cleanSlug)) {
      return null;
    }
    const business = await this.getBusinessBySlug(cleanSlug);
    if (
      !business ||
      business.status !== 'active' ||
      business.accountState !== 'active'
    ) {
      return null;
    }

    const cfgStore = this.read<Record<string, BarberQueueConfig>>(
      STORAGE_KEYS.BARBER_QUEUE_CONFIGS,
      {},
    );
    const config = normalizeBarberQueueConfig(business.id, cfgStore[business.id]);

    const todayKey = getTodayQueueDateKey();
    const allTickets = this.read<BarberQueueTicket[]>(
      STORAGE_KEYS.BARBER_QUEUE_TICKETS,
      [],
    ).filter((t) => t.businessId === business.id && t.queueDate === todayKey);

    const inChairRaw =
      allTickets
        .filter((t) => t.status === 'in_chair')
        .sort((a, b) => a.tokenNumber - b.tokenNumber)[0] ?? null;

    const inChairRemaining = this.computeInChairRemainingMinutes(inChairRaw);
    const nowServing: BarberQueueTicket | null = inChairRaw
      ? {
          ...inChairRaw,
          estimatedWaitMinutes: 0,
          remainingMinutes: inChairRemaining,
        }
      : null;

    const waitingRaw = allTickets
      .filter((t) => t.status === 'waiting')
      .sort((a, b) => a.tokenNumber - b.tokenNumber);

    let runningAhead = 0;
    const waitingTickets: BarberQueueTicket[] = waitingRaw.map((t, idx) => {
      const estimatedWaitMinutes = Math.max(
        0,
        inChairRemaining + runningAhead + t.extraDelayMinutes,
      );
      runningAhead += t.durationMinutes;
      return {
        ...t,
        position: idx + 1,
        estimatedWaitMinutes,
      };
    });

    const completedTodayCount = allTickets.filter(
      (t) => t.status === 'completed',
    ).length;

    const rewardStore = this.read<Record<string, RestaurantReward[]>>(
      STORAGE_KEYS.RESTAURANT_REWARDS,
      {},
    );
    const rewards = (rewardStore[business.id] ?? [])
      .filter((r) => r.isActive)
      .sort(
        (a, b) =>
          a.displayOrder - b.displayOrder || a.starsRequired - b.starsRequired,
      );

    return {
      business: {
        id: business.id,
        slug: business.slug,
        name: business.name,
        category: business.category,
        city: business.city,
        googleReviewUrl: business.googleReviewUrl,
      },
      config,
      nowServing,
      waitingTickets,
      waitingCount: waitingTickets.length,
      estimatedWaitForNewGuestMinutes: Math.max(
        0,
        inChairRemaining + runningAhead,
      ),
      completedTodayCount,
      rewards,
    };
  }

  async joinBarberQueue(
    input: JoinBarberQueueInput,
  ): Promise<JoinBarberQueueResult> {
    const validation = validateJoinBarberQueueInput(input);
    if (!validation.ok) {
      throw new Error(validation.error);
    }

    const business = await this.getBusinessBySlug(validation.value.businessSlug);
    if (
      !business ||
      business.status !== 'active' ||
      business.accountState !== 'active'
    ) {
      throw new Error('Shop is not active.');
    }

    const cfgStore = this.read<Record<string, BarberQueueConfig>>(
      STORAGE_KEYS.BARBER_QUEUE_CONFIGS,
      {},
    );
    const config = normalizeBarberQueueConfig(business.id, cfgStore[business.id]);
    if (!cfgStore[business.id]) {
      cfgStore[business.id] = config;
      this.write(STORAGE_KEYS.BARBER_QUEUE_CONFIGS, cfgStore);
    }

    if (!config.isQueueOpen) {
      throw new Error(
        'Walk-in queue is currently paused. Please check with the barber.',
      );
    }

    const todayKey = getTodayQueueDateKey();
    const allTickets = this.read<BarberQueueTicket[]>(
      STORAGE_KEYS.BARBER_QUEUE_TICKETS,
      [],
    );
    const todayTickets = allTickets.filter(
      (t) => t.businessId === business.id && t.queueDate === todayKey,
    );
    const waitingTickets = todayTickets.filter((t) => t.status === 'waiting');

    if (waitingTickets.length >= config.maxQueueSize) {
      throw new Error(
        `Walk-in queue is currently full (${config.maxQueueSize} people waiting). Please try again shortly.`,
      );
    }

    // Match canonical service name & duration from config.services
    const matchedSvc = config.services.find(
      (s) =>
        s.name.toLowerCase() === validation.value.serviceName.toLowerCase() ||
        s.id.toLowerCase() === validation.value.serviceName.toLowerCase(),
    );
    const serviceName = matchedSvc?.name ?? validation.value.serviceName;
    const durationMinutes =
      matchedSvc?.durationMinutes ?? config.avgServiceMinutes;

    // Auto-create / resume shared Loyalty customer when phone is provided
    let customerId: string | null = null;
    let loyaltyStarsBalance = 0;
    if (validation.value.phone) {
      const normPhone = validation.value.phone.toLowerCase();
      const customers = this.read<RestaurantCustomer[]>(
        STORAGE_KEYS.RESTAURANT_CUSTOMERS,
        [],
      );
      let existing = customers.find(
        (c) => c.phoneOrEmail && c.phoneOrEmail.toLowerCase() === normPhone,
      );
      if (!existing) {
        existing = {
          id: `cust-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          displayName: validation.value.guestName,
          phoneOrEmail: normPhone,
          guestTokenHash: null,
          createdAt: new Date().toISOString(),
        };
        customers.push(existing);
        this.write(STORAGE_KEYS.RESTAURANT_CUSTOMERS, customers);
      }
      customerId = existing.id;

      const starTxs = this.read<RestaurantLoyaltyStarTransaction[]>(
        STORAGE_KEYS.RESTAURANT_LOYALTY_STAR_TXS,
        [],
      )
        .filter(
          (tx) => tx.businessId === business.id && tx.customerId === customerId,
        )
        .reverse();
      loyaltyStarsBalance = starTxs.length > 0 ? starTxs[0].balanceAfter : 0;
    }

    const inChairRaw =
      todayTickets
        .filter((t) => t.status === 'in_chair')
        .sort((a, b) => a.tokenNumber - b.tokenNumber)[0] ?? null;
    const inChairRemaining = this.computeInChairRemainingMinutes(inChairRaw);
    const aheadDuration = waitingTickets.reduce(
      (sum, t) => sum + t.durationMinutes,
      0,
    );
    const estimatedWaitMinutes = Math.max(0, inChairRemaining + aheadDuration);

    const maxToken = todayTickets.reduce(
      (max, t) => Math.max(max, t.tokenNumber),
      0,
    );
    const nextToken = maxToken + 1;
    const position = waitingTickets.length + 1;
    const now = new Date().toISOString();

    const created: BarberQueueTicket = {
      id: `bqt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      businessId: business.id,
      customerId,
      queueDate: todayKey,
      tokenNumber: nextToken,
      guestName: validation.value.guestName,
      phone: validation.value.phone,
      serviceName,
      durationMinutes,
      status: 'waiting',
      extraDelayMinutes: 0,
      assignedBarberLabel: null,
      createdAt: now,
      startedAt: null,
      completedAt: null,
    };

    allTickets.push(created);
    this.write(STORAGE_KEYS.BARBER_QUEUE_TICKETS, allTickets);

    return {
      ticket: {
        ...created,
        position,
        estimatedWaitMinutes,
      },
      estimatedWaitMinutes,
      position,
      loyaltyStarsBalance,
    };
  }

  async leaveBarberQueueTicket(params: {
    businessSlug: string;
    ticketId: string;
  }): Promise<{
    id: string;
    status: BarberQueueTicketStatus;
    tokenNumber: number;
  }> {
    const business = await this.getBusinessBySlug(params.businessSlug);
    if (
      !business ||
      business.status !== 'active' ||
      business.accountState !== 'active'
    ) {
      throw new Error('Shop not found.');
    }

    const todayKey = getTodayQueueDateKey();
    const tickets = this.read<BarberQueueTicket[]>(
      STORAGE_KEYS.BARBER_QUEUE_TICKETS,
      [],
    );
    const idx = tickets.findIndex(
      (t) =>
        t.id === params.ticketId &&
        t.businessId === business.id &&
        t.queueDate === todayKey &&
        t.status === 'waiting',
    );
    if (idx === -1) {
      throw new Error('Waiting ticket not found or already in chair.');
    }

    tickets[idx] = {
      ...tickets[idx],
      status: 'cancelled',
    };
    this.write(STORAGE_KEYS.BARBER_QUEUE_TICKETS, tickets);

    return {
      id: tickets[idx].id,
      status: 'cancelled',
      tokenNumber: tickets[idx].tokenNumber,
    };
  }

  async barberExtendQueueTimer(params: {
    businessSlug: string;
    addMinutes: BarberQueueDelayIncrement;
    staffPinHash?: string | null;
    options?: AIConfigAccessOptions;
  }): Promise<ExtendBarberQueueTimerResult> {
    const delayCheck = validateBarberDelayMinutes(params.addMinutes);
    if (!delayCheck.ok) {
      throw new Error(delayCheck.error);
    }

    const list = await this.getBusinesses();
    const business =
      list.find(
        (b) => b.slug.toLowerCase() === params.businessSlug.trim().toLowerCase(),
      ) ?? null;
    if (!business) {
      throw new Error('Shop not found.');
    }

    const profileStore = this.read<Record<string, RestaurantProfile>>(
      STORAGE_KEYS.RESTAURANT_PROFILES,
      {},
    );
    const profile = normalizeRestaurantProfile(
      business.id,
      profileStore[business.id],
      'local',
    );
    this.assertOwnerOrStaffPin(
      business,
      profile,
      params.staffPinHash,
      params.options,
    );

    const staffLabel = this.resolveAuditStaffLabel(
      business.id,
      params.staffPinHash,
      'Owner',
    );

    const todayKey = getTodayQueueDateKey();
    const tickets = this.read<BarberQueueTicket[]>(
      STORAGE_KEYS.BARBER_QUEUE_TICKETS,
      [],
    );
    let updatedCount = 0;
    for (let i = 0; i < tickets.length; i++) {
      const t = tickets[i];
      if (
        t.businessId === business.id &&
        t.queueDate === todayKey &&
        t.status === 'waiting'
      ) {
        tickets[i] = {
          ...t,
          extraDelayMinutes: Math.min(
            600,
            t.extraDelayMinutes + delayCheck.value,
          ),
        };
        updatedCount++;
      }
    }
    this.write(STORAGE_KEYS.BARBER_QUEUE_TICKETS, tickets);

    return {
      updatedCount,
      addedMinutes: delayCheck.value,
      staffLabel,
      updatedAt: new Date().toISOString(),
    };
  }

  async barberAdvanceQueueTicket(params: {
    businessSlug: string;
    ticketId: string;
    status: BarberQueueTicketStatus;
    staffLabel?: string;
    staffPinHash?: string | null;
    options?: AIConfigAccessOptions;
  }): Promise<AdvanceBarberQueueTicketResult> {
    const statusCheck = validateBarberTicketStatus(params.status);
    if (!statusCheck.ok) {
      throw new Error(statusCheck.error);
    }

    const list = await this.getBusinesses();
    const business =
      list.find(
        (b) => b.slug.toLowerCase() === params.businessSlug.trim().toLowerCase(),
      ) ?? null;
    if (!business) {
      throw new Error('Shop not found.');
    }

    const profileStore = this.read<Record<string, RestaurantProfile>>(
      STORAGE_KEYS.RESTAURANT_PROFILES,
      {},
    );
    const profile = normalizeRestaurantProfile(
      business.id,
      profileStore[business.id],
      'local',
    );
    this.assertOwnerOrStaffPin(
      business,
      profile,
      params.staffPinHash,
      params.options,
    );

    const resolvedLabel = this.resolveAuditStaffLabel(
      business.id,
      params.staffPinHash,
      params.staffLabel ?? 'Barber',
    );

    const tickets = this.read<BarberQueueTicket[]>(
      STORAGE_KEYS.BARBER_QUEUE_TICKETS,
      [],
    );
    const idx = tickets.findIndex(
      (t) => t.id === params.ticketId && t.businessId === business.id,
    );
    if (idx === -1) {
      throw new Error('Queue ticket not found for this shop.');
    }

    const now = new Date().toISOString();
    const existing = tickets[idx];
    const nextStatus = statusCheck.value;

    const updatedTicket: BarberQueueTicket = {
      ...existing,
      status: nextStatus,
      assignedBarberLabel:
        nextStatus === 'in_chair' || nextStatus === 'completed'
          ? resolvedLabel
          : existing.assignedBarberLabel,
      startedAt:
        nextStatus === 'in_chair' ? (existing.startedAt ?? now) : existing.startedAt,
      completedAt:
        nextStatus === 'completed'
          ? (existing.completedAt ?? now)
          : existing.completedAt,
    };
    tickets[idx] = updatedTicket;
    this.write(STORAGE_KEYS.BARBER_QUEUE_TICKETS, tickets);

    let starAwarded = false;
    let starsAwarded = 0;
    let newLoyaltyStarsBalance = 0;
    let alreadyAwarded = false;

    if (nextStatus === 'completed' && updatedTicket.customerId) {
      const cfgStore = this.read<Record<string, BarberQueueConfig>>(
        STORAGE_KEYS.BARBER_QUEUE_CONFIGS,
        {},
      );
      const config = normalizeBarberQueueConfig(
        business.id,
        cfgStore[business.id],
      );

      if (config.awardStarOnCompletion) {
        const idemKey = `barber-ticket-${updatedTicket.id}`;
        const starTxs = this.read<RestaurantLoyaltyStarTransaction[]>(
          STORAGE_KEYS.RESTAURANT_LOYALTY_STAR_TXS,
          [],
        );
        const existingTx = starTxs.find(
          (tx) =>
            tx.businessId === business.id && tx.idempotencyKey === idemKey,
        );

        const customerStarTxs = starTxs
          .filter(
            (tx) =>
              tx.businessId === business.id &&
              tx.customerId === updatedTicket.customerId,
          )
          .reverse();
        const currentStars =
          customerStarTxs.length > 0 ? customerStarTxs[0].balanceAfter : 0;

        if (existingTx) {
          alreadyAwarded = true;
          starsAwarded = existingTx.starsDelta;
          newLoyaltyStarsBalance = currentStars;
        } else {
          const rulesStore = this.read<Record<string, RestaurantLoyaltyRules>>(
            STORAGE_KEYS.RESTAURANT_LOYALTY_RULES,
            {},
          );
          const rules = normalizeRestaurantLoyaltyRules(
            business.id,
            rulesStore[business.id],
          );
          const delta = rules.starsPerVerifiedVisit;
          newLoyaltyStarsBalance = currentStars + delta;

          const visits = this.read<RestaurantVerifiedVisit[]>(
            STORAGE_KEYS.RESTAURANT_VERIFIED_VISITS,
            [],
          );
          if (
            !visits.some(
              (v) =>
                v.businessId === business.id && v.idempotencyKey === idemKey,
            )
          ) {
            visits.push({
              id: `vvisit-barber-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
              businessId: business.id,
              tableId: null,
              customerId: updatedTicket.customerId,
              customerName: updatedTicket.guestName,
              starsAwarded: delta,
              verifiedByLabel: resolvedLabel,
              idempotencyKey: idemKey,
              createdAt: now,
            });
            this.write(STORAGE_KEYS.RESTAURANT_VERIFIED_VISITS, visits);
          }

          starTxs.push({
            id: `lstx-barber-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            businessId: business.id,
            customerId: updatedTicket.customerId,
            txType: 'verified_visit',
            starsDelta: delta,
            balanceAfter: newLoyaltyStarsBalance,
            idempotencyKey: idemKey,
            verifiedByStaffLabel: resolvedLabel,
            metadata: {
              source: 'barber_queue_completion',
              ticketId: updatedTicket.id,
              tokenNumber: updatedTicket.tokenNumber,
              serviceName: updatedTicket.serviceName,
            },
            createdAt: now,
          });
          this.write(STORAGE_KEYS.RESTAURANT_LOYALTY_STAR_TXS, starTxs);

          starAwarded = true;
          starsAwarded = delta;
        }
      }
    }

    return {
      ticket: updatedTicket,
      starAwarded,
      starsAwarded,
      newLoyaltyStarsBalance,
      alreadyAwarded,
    };
  }
}

export const businessRepository: IBusinessRepository = new MockLocalStorageRepository();
