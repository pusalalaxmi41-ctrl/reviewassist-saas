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
  type CompleteTableBillCheckoutResult,
  type CreatePosOrPlatformOrderInput,
  type FloorTableLayoutItem,
  type MenuPresetKey,
  type OpenTableBillSummary,
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
  type RestaurantPaymentMethod,
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
  type RestaurantTableMessage,
  type RestaurantTableMessageSenderRole,
  type RestaurantTableOrder,
  type RestaurantTableOrderItem,
  type RestaurantTableOrderStatus,
  type RestaurantVerifiedVisit,
  type VerifiedStaffMemberSession,
} from '../../types/restaurant';
import {
  ALLOWED_ORDER_SOURCES,
  calculateBillTotals,
  isBillRequestCallType,
  isPlatformOrOffPremiseSource,
} from '../../utils/hospitalityHelpers';
import type {
  AdvanceBarberQueueTicketResult,
  BarberQueueConfig,
  BarberQueueConfigInput,
  BarberQueueDelayIncrement,
  BarberQueueTicket,
  BarberQueueTicketStatus,
  BarberRevenueSummary,
  BarberServiceBreakdownRow,
  ExtendBarberQueueTimerResult,
  JoinBarberQueueInput,
  JoinBarberQueueResult,
  PublicBarberQueueStatusPayload,
} from '../../types/barberQueue';
import {
  formatTicketDisplayCode,
  getTodayQueueDateKey,
  isBarberOrSalonCategory,
  mergeHybridBarberQueue,
  normalizeBarberQueueConfig,
  resolveScheduledAtForDate,
  validateBarberDelayMinutes,
  validateBarberQueueConfigInput,
  validateBarberTicketStatus,
  validateJoinBarberQueueInput,
} from '../../utils/barberQueueValidation';
import type {
  GymAttendanceLog,
  GymBodyMeasurement,
  GymBodyMeasurementInput,
  GymCatalogExercise,
  GymCatalogExerciseInput,
  GymCatalogEquipment,
  GymCatalogMuscleGroup,
  GymCoachPlan,
  GymCommunityMessage,
  GymCommunityMessageType,
  GymConfig,
  GymConfigInput,
  GymDailyCheckInResult,
  GymDirectoryMemberEntry,
  GymEffectiveMemberStatus,
  GymExerciseLastSession,
  GymFitnessGoal,
  GymFreezeAction,
  GymInactiveAlertMember,
  GymLeaderboardEntry,
  GymLogSetResult,
  GymMember,
  GymMemberAthleteHubPayload,
  GymMemberProgressHistory,
  GymMembersCommunityHubPayload,
  GymMemberWorkoutPlanPayload,
  GymMemberWorkoutSummaryPayload,
  GymOwnerDashboardPayload,
  GymOwnerMemberAction,
  GymPaymentLog,
  GymPaymentMethod,
  GymPersonalRecordRow,
  GymPreferredShift,
  GymRetailProduct,
  GymRetailProductInput,
  GymRetailSale,
  GymRoutineExerciseItem,
  GymTodayAttendanceEntry,
  GymTrainer,
  GymTrainerCommissionRow,
  GymTrainerInput,
  GymWeeklyRevenueBucket,
  GymWorkoutFocus,
  GymWorkoutRoutine,
  GymWorkoutSession,
  GymWorkoutSetRecord,
  LogGymWorkoutSessionInput,
  MemberCreateCustomExerciseInput,
  OwnerUpdateGymBrandingInput,
  OwnerUpsertExerciseMediaInput,
  PublicGymPortalPayload,
  SubmitGymRegistrationInput,
  UpdateMemberSelfPlanInput,
  UpsertGymCoachPlanInput,
} from '../../types/gym';
import {
  addDaysToIsoDate,
  diffDaysBetweenIsoDates,
  formatPrivacySafeLeaderboardName,
  getTodayIsoDateKey,
  GYM_RETAIL_STARTER_PRODUCTS,
  inferGymCheckInShiftFromHour,
  normalizeGymAccentColor,
  normalizeGymConfig,
  normalizeGymFitnessGoal,
  normalizeGymPhone,
  normalizeGymPreferredShift,
  normalizeGymThemePreset,
  normalizeGymWorkoutFocus,
  sanitizeGymMediaUrl,
  validateGymBodyMeasurementInput,
  validateGymConfigInput,
  validateGymOwnerAction,
  validateGymRegistrationInput,
  validateGymRetailProductInput,
  validateGymTrainerInput,
  validateGymWeightKg,
} from '../../utils/gymValidation';
import {
  BUILTIN_GYM_CATALOG_EXERCISES,
  calculateEpley1RM,
  inferGymAnimationKey,
} from '../../utils/gymWorkoutEngine';
import type {
  CafeConfig,
  CafeConfigInput,
  CafeCounterOrder,
  CafeCounterOrderStatus,
  CafeInventoryActionType,
  CafeInventoryItem,
  CafeInventoryItemInput,
  CafeInventoryLog,
  CafeOwnerDashboardPayload,
  CafeRewardRedemptionType,
  CafeStampPass,
  ClaimCafeStampResponse,
  PublicCafeHubPayload,
} from '../../types/cafe';
import {
  CAFE_INVENTORY_STARTER_PACK,
  computeCafeCounterTokenSig,
  createDefaultCafeConfig,
  getCafeRotatingTimeBucket,
  isBirthdayTodayForPass,
  normalizeCafePhone,
  validateCafeConfigInput,
  validateCafeInventoryAction,
  validateCafeInventoryItemInput,
} from '../../utils/cafeValidation';
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
  RESTAURANT_TABLE_MESSAGES: 'reviewassist_mock_restaurant_table_messages_v1',
  RESTAURANT_STAFF_MEMBERS: 'reviewassist_mock_restaurant_staff_members_v1',
  RESTAURANT_MONTHLY_INVENTORY:
    'reviewassist_mock_restaurant_monthly_inventory_v1',
  BARBER_QUEUE_CONFIGS: 'reviewassist_mock_barber_queue_configs_v1',
  BARBER_QUEUE_TICKETS: 'reviewassist_mock_barber_queue_tickets_v1',
  GYM_CONFIGS: 'reviewassist_mock_gym_configs_v1',
  GYM_MEMBERS: 'reviewassist_mock_gym_members_v1',
  GYM_CHECK_INS: 'reviewassist_mock_gym_check_ins_v1',
  GYM_PAYMENT_LOGS: 'reviewassist_mock_gym_payment_logs_v1',
  GYM_TRAINERS: 'reviewassist_mock_gym_trainers_v1',
  GYM_BODY_MEASUREMENTS: 'reviewassist_mock_gym_body_measurements_v1',
  GYM_RETAIL_PRODUCTS: 'reviewassist_mock_gym_retail_products_v1',
  GYM_RETAIL_SALES: 'reviewassist_mock_gym_retail_sales_v1',
  GYM_WORKOUT_SESSIONS: 'reviewassist_mock_gym_workout_sessions_v1',
  GYM_CUSTOM_EXERCISES: 'reviewassist_mock_gym_custom_exercises_v1',
  GYM_WORKOUT_ROUTINES: 'reviewassist_mock_gym_workout_routines_v1',
  GYM_WORKOUT_SET_LOGS: 'reviewassist_mock_gym_workout_set_logs_v1',
  GYM_MEMBER_COACH_PLANS: 'reviewassist_mock_gym_member_coach_plans_v1',
  GYM_COMMUNITY_MESSAGES: 'reviewassist_mock_gym_community_messages_v1',
  GYM_EXERCISE_MEDIA_OVERRIDES:
    'reviewassist_mock_gym_exercise_media_overrides_v1',
  CAFE_CONFIGS: 'reviewassist_mock_cafe_configs_v1',
  CAFE_STAMP_PASSES: 'reviewassist_mock_cafe_stamp_passes_v1',
  CAFE_INVENTORY_ITEMS: 'reviewassist_mock_cafe_inventory_items_v1',
  CAFE_INVENTORY_LOGS: 'reviewassist_mock_cafe_inventory_logs_v1',
  CAFE_COUNTER_ORDERS: 'reviewassist_mock_cafe_counter_orders_v1',
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
  {
    id: 'biz-iron-pulse-4',
    ownerId: 'owner-iron-pulse-4',
    slug: 'iron-pulse-gym',
    name: 'Iron Pulse Fitness',
    category: 'gym',
    city: 'Hyderabad',
    googleReviewUrl: PLACEHOLDER_GOOGLE_REVIEW_URL,
    googleReviewUrlIsPlaceholder: true,
    status: 'active',
    accountState: 'active',
    createdAt: '2026-11-04T07:00:00.000Z',
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
      upiId:
        validation.value.upiId !== undefined
          ? validation.value.upiId
          : (existing?.upiId ?? null),
      upiPayeeName:
        validation.value.upiPayeeName !== undefined
          ? validation.value.upiPayeeName
          : (existing?.upiPayeeName ?? null),
      gstin:
        validation.value.gstin !== undefined
          ? validation.value.gstin
          : (existing?.gstin ?? null),
      gstPercent:
        validation.value.gstPercent !== undefined
          ? validation.value.gstPercent
          : (existing?.gstPercent ?? 0),
      serviceChargePercent:
        validation.value.serviceChargePercent !== undefined
          ? validation.value.serviceChargePercent
          : (existing?.serviceChargePercent ?? 0),
      voiceAlertsEnabled:
        validation.value.voiceAlertsEnabled !== undefined
          ? validation.value.voiceAlertsEnabled
          : (existing?.voiceAlertsEnabled ?? true),
      acceptingOrders:
        validation.value.acceptingOrders !== undefined
          ? validation.value.acceptingOrders
          : (existing?.acceptingOrders ?? true),
      hotelRoomsEnabled:
        validation.value.hotelRoomsEnabled !== undefined
          ? validation.value.hotelRoomsEnabled
          : (existing?.hotelRoomsEnabled ?? false),
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
      locationType: validation.value.locationType,
      seatCapacity: validation.value.seatCapacity,
      occupiedSince: null,
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
      locationType: validation.value.locationType,
      seatCapacity: validation.value.seatCapacity,
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
      showOnTable: validation.value.showOnTable,
      showOnRoom: validation.value.showOnRoom,
      spiceLevel: validation.value.spiceLevel,
      ingredientsSummary: validation.value.ingredientsSummary,
      prepTimeMinutes: validation.value.prepTimeMinutes,
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
      showOnTable: validation.value.showOnTable,
      showOnRoom: validation.value.showOnRoom,
      spiceLevel: validation.value.spiceLevel,
      ingredientsSummary: validation.value.ingredientsSummary,
      prepTimeMinutes: validation.value.prepTimeMinutes,
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

    const tableLocationType = matchedTable?.locationType ?? null;
    const itemStore = this.read<Record<string, RestaurantMenuItem[]>>(
      STORAGE_KEYS.RESTAURANT_ITEMS,
      {},
    );
    const availableItems = [...(itemStore[business.id] ?? [])]
      .filter((i) => {
        if (!i.isAvailable || !activeCatIds.has(i.categoryId)) return false;
        if (tableLocationType === 'table') return i.showOnTable !== false;
        if (tableLocationType === 'room') return i.showOnRoom !== false;
        return true;
      })
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
    const allowedCallTypes: ReadonlyArray<RestaurantTableCallType> = [
      'assistance',
      'water',
      'bill_request',
      'clean_table',
      'ready_for_bill',
    ];
    if (!allowedCallTypes.includes(params.callType)) {
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

    const now = new Date().toISOString();
    const created: RestaurantTableCall = {
      id: `call-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      businessId: business.id,
      tableId: table.id,
      tableNumber: table.tableNumber,
      tableKey: table.tableKey,
      locationType: table.locationType ?? 'table',
      customerId: params.customerId ?? null,
      callType: params.callType,
      status: 'open',
      assignedStaffLabel: null,
      createdAt: now,
      resolvedAt: null,
    };

    calls.unshift(created);
    this.write(STORAGE_KEYS.RESTAURANT_TABLE_CALLS, calls);

    // Also log system activity message into live 2-way table chat
    const sysText =
      params.callType === 'water'
        ? 'Guest requested drinking water'
        : params.callType === 'clean_table'
          ? 'Guest requested table cleaning'
          : isBillRequestCallType(params.callType)
            ? 'Guest asked for the final bill'
            : 'Guest called a waiter for assistance';
    const msgs = this.read<RestaurantTableMessage[]>(
      STORAGE_KEYS.RESTAURANT_TABLE_MESSAGES,
      [],
    );
    msgs.push({
      id: `tmsg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      businessId: business.id,
      tableId: table.id,
      tableNumber: table.tableNumber,
      tableKey: table.tableKey,
      locationType: table.locationType ?? 'table',
      senderRole: 'system',
      senderName: 'System',
      messageText: sysText,
      isRead: false,
      createdAt: now,
    });
    this.write(STORAGE_KEYS.RESTAURANT_TABLE_MESSAGES, msgs);

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
    assignedStaffLabel?: string | null;
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

    const cleanAssign =
      typeof params.assignedStaffLabel === 'string' &&
      params.assignedStaffLabel.trim()
        ? params.assignedStaffLabel.trim().slice(0, 100)
        : undefined;

    const updated: RestaurantTableCall = {
      ...calls[idx],
      status: params.status,
      assignedStaffLabel:
        cleanAssign !== undefined
          ? cleanAssign
          : (calls[idx].assignedStaffLabel ?? null),
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

    const oneDayAgoMs = Date.now() - 24 * 60 * 60 * 1000;
    const allBizOrders = this.read<RestaurantTableOrder[]>(
      STORAGE_KEYS.RESTAURANT_TABLE_ORDERS,
      [],
    ).filter((o) => o.businessId === business.id);

    const activeTableOrders = [...allBizOrders]
      .filter(
        (o) =>
          o.status === 'pending_approval' ||
          o.status === 'approved_for_kitchen' ||
          o.status === 'preparing' ||
          o.status === 'ready',
      )
      .reverse()
      .slice(0, 80);

    const recentOrders = [...allBizOrders]
      .filter(
        (o) =>
          o.status === 'pending_approval' ||
          o.status === 'approved_for_kitchen' ||
          o.status === 'preparing' ||
          o.status === 'ready' ||
          (o.status === 'served' && (o.paymentStatus ?? 'unpaid') !== 'paid') ||
          new Date(o.createdAt).getTime() >= oneDayAgoMs,
      )
      .reverse()
      .slice(0, 120);

    const tableStore = this.read<Record<string, RestaurantTable[]>>(
      STORAGE_KEYS.RESTAURANT_TABLES,
      {},
    );
    const activeTables = (tableStore[business.id] ?? []).filter(
      (t) => t.isActive,
    );

    const recentMessages = this.read<RestaurantTableMessage[]>(
      STORAGE_KEYS.RESTAURANT_TABLE_MESSAGES,
      [],
    )
      .filter(
        (m) =>
          m.businessId === business.id &&
          new Date(m.createdAt).getTime() >= oneDayAgoMs,
      )
      .slice(-150);

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
      floorWidthFt: profile.floorWidthFt ?? 40,
      floorHeightFt: profile.floorHeightFt ?? 28,
      tableOrders: activeTableOrders,
      recentOrders,
      tableMessages: recentMessages,
      tables: activeTables,
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
    kitchenNote?: string | null;
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
    if (profile.acceptingOrders === false) {
      throw new Error(
        'We are temporarily paused and not accepting new orders right now.',
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

    const now = new Date().toISOString();
    const orders = this.read<RestaurantTableOrder[]>(
      STORAGE_KEYS.RESTAURANT_TABLE_ORDERS,
      [],
    );

    let tableId: string | null = null;
    let tableNumber: string | null = null;
    let resolvedTableKey: string | null = null;
    let locationType: 'table' | 'room' = 'table';
    let billSessionId: string | null = null;

    if (params.tableKey && params.tableKey.trim()) {
      const cleanKey = deriveTableKey(params.tableKey);
      const tableStore = this.read<Record<string, RestaurantTable[]>>(
        STORAGE_KEYS.RESTAURANT_TABLES,
        {},
      );
      const tblList = tableStore[business.id] ?? [];
      const tblIdx = tblList.findIndex(
        (t) => t.tableKey === cleanKey && t.isActive,
      );
      if (tblIdx !== -1) {
        const tbl = tblList[tblIdx];
        tableId = tbl.id;
        tableNumber = tbl.tableNumber;
        resolvedTableKey = tbl.tableKey;
        locationType = tbl.locationType ?? 'table';

        const existingOpen = [...orders]
          .reverse()
          .find(
            (o) =>
              o.businessId === business.id &&
              o.tableId === tbl.id &&
              o.status !== 'cancelled' &&
              (o.paymentStatus ?? 'unpaid') !== 'paid' &&
              Boolean(o.billSessionId),
          );
        billSessionId =
          existingOpen?.billSessionId ??
          `bsess-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

        if (!tbl.occupiedSince) {
          tblList[tblIdx] = { ...tbl, occupiedSince: now };
          tableStore[business.id] = tblList;
          this.write(STORAGE_KEYS.RESTAURANT_TABLES, tableStore);
        }
      }
    }

    let repeatVisits = 1;
    if (params.customerId) {
      const visits = this.read<RestaurantVerifiedVisit[]>(
        STORAGE_KEYS.RESTAURANT_VERIFIED_VISITS,
        [],
      ).filter(
        (v) =>
          v.businessId === business.id && v.customerId === params.customerId,
      );
      repeatVisits = Math.max(1, visits.length + 1);
    }

    const order: RestaurantTableOrder = {
      id: `tord-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      businessId: business.id,
      tableId,
      tableNumber,
      tableKey: resolvedTableKey,
      locationType,
      customerId: params.customerId ?? null,
      guestName: params.guestName?.trim().slice(0, 80) || null,
      items: validatedItems,
      status: 'pending_approval',
      orderSource: locationType === 'room' ? 'qr_room' : 'qr_table',
      platformOrderNumber: null,
      packagingPaise: 0,
      kitchenNote: params.kitchenNote?.trim().slice(0, 300) || null,
      billSessionId,
      paymentStatus: 'unpaid',
      paymentMethod: null,
      paidAt: null,
      customerRepeatVisitCount: repeatVisits,
      approvedBy: null,
      createdAt: now,
      updatedAt: now,
    };

    orders.push(order);
    this.write(STORAGE_KEYS.RESTAURANT_TABLE_ORDERS, orders);

    if (tableId && tableNumber && resolvedTableKey) {
      const msgs = this.read<RestaurantTableMessage[]>(
        STORAGE_KEYS.RESTAURANT_TABLE_MESSAGES,
        [],
      );
      msgs.push({
        id: `tmsg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        businessId: business.id,
        tableId,
        tableNumber,
        tableKey: resolvedTableKey,
        locationType,
        senderRole: 'system',
        senderName: 'System',
        messageText: `New order placed (${validatedItems.length} items) — sent for kitchen confirmation`,
        isRead: false,
        createdAt: now,
      });
      this.write(STORAGE_KEYS.RESTAURANT_TABLE_MESSAGES, msgs);
    }

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
      statusCheck.value === 'ready' ||
      statusCheck.value === 'served';

    const now = new Date().toISOString();
    const updated: RestaurantTableOrder = {
      ...existing,
      status: statusCheck.value,
      approvedBy: shouldRecordApprover
        ? (existing.approvedBy ?? staffLabel)
        : existing.approvedBy,
      updatedAt: now,
    };
    orders[idx] = updated;
    this.write(STORAGE_KEYS.RESTAURANT_TABLE_ORDERS, orders);

    if (
      statusCheck.value === 'ready' &&
      updated.tableId &&
      updated.tableNumber &&
      updated.tableKey
    ) {
      const msgs = this.read<RestaurantTableMessage[]>(
        STORAGE_KEYS.RESTAURANT_TABLE_MESSAGES,
        [],
      );
      msgs.push({
        id: `tmsg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        businessId: business.id,
        tableId: updated.tableId,
        tableNumber: updated.tableNumber,
        tableKey: updated.tableKey,
        locationType: updated.locationType ?? 'table',
        senderRole: 'system',
        senderName: 'Kitchen',
        messageText: 'Your order is freshly prepared and on its way!',
        isRead: false,
        createdAt: now,
      });
      this.write(STORAGE_KEYS.RESTAURANT_TABLE_MESSAGES, msgs);
    }

    return updated;
  }

  // ---------------------------------------------------------------------------
  // Complete Hospitality OS (Migration 019): Counter POS, Platform Orders,
  // 2-Way Live Table/Room Chat, Multi-Order Open Bills & Realtime Sync
  // ---------------------------------------------------------------------------

  async createPosOrPlatformOrder(
    input: CreatePosOrPlatformOrderInput,
    options?: AIConfigAccessOptions,
  ): Promise<RestaurantTableOrder> {
    const idErr = validateBusinessId(input.businessId);
    if (idErr) throw new Error(idErr);
    if (!ALLOWED_ORDER_SOURCES.includes(input.orderSource)) {
      throw new Error('Unsupported order source.');
    }
    const itemsValidation = validateTableOrderItemsInput(input.items);
    if (!itemsValidation.ok) throw new Error(itemsValidation.error);

    const cleanId = input.businessId.trim();
    const business = await this.getBusinessById(cleanId);
    if (!business) {
      throw new Error(`Business with ID "${cleanId}" not found.`);
    }

    const profileStore = this.read<Record<string, RestaurantProfile>>(
      STORAGE_KEYS.RESTAURANT_PROFILES,
      {},
    );
    const profile = normalizeRestaurantProfile(
      cleanId,
      profileStore[cleanId],
      'local',
    );
    this.assertOwnerOrStaffPin(
      business,
      profile,
      input.staffPinHash,
      options,
    );

    const staffLabel = this.resolveAuditStaffLabel(
      cleanId,
      input.staffPinHash,
      input.staffLabel ?? 'Owner',
    );

    const itemStore = this.read<Record<string, RestaurantMenuItem[]>>(
      STORAGE_KEYS.RESTAURANT_ITEMS,
      {},
    );
    const bizItems = itemStore[cleanId] ?? [];
    const validatedItems: RestaurantTableOrderItem[] = [];
    for (const reqItem of itemsValidation.value) {
      const catItem = bizItems.find((i) => i.id === reqItem.itemId);
      if (!catItem) {
        throw new Error('Menu item not found for this business.');
      }
      validatedItems.push({
        itemId: catItem.id,
        name: catItem.name,
        quantity: reqItem.quantity,
        pricePaise: catItem.pricePaise,
        notes: reqItem.notes,
      });
    }

    const now = new Date().toISOString();
    const orders = this.read<RestaurantTableOrder[]>(
      STORAGE_KEYS.RESTAURANT_TABLE_ORDERS,
      [],
    );

    let resolvedTableId: string | null = null;
    let tableNumber: string | null = null;
    let tableKey: string | null = null;
    let locationType: 'table' | 'room' = 'table';
    let billSessionId: string | null = null;

    // Platform / Takeaway / Delivery orders NEVER attach to dining table bills!
    if (!isPlatformOrOffPremiseSource(input.orderSource) && input.tableId) {
      const tableStore = this.read<Record<string, RestaurantTable[]>>(
        STORAGE_KEYS.RESTAURANT_TABLES,
        {},
      );
      const tblList = tableStore[cleanId] ?? [];
      const tblIdx = tblList.findIndex((t) => t.id === input.tableId);
      if (tblIdx !== -1) {
        const tbl = tblList[tblIdx];
        resolvedTableId = tbl.id;
        tableNumber = tbl.tableNumber;
        tableKey = tbl.tableKey;
        locationType = tbl.locationType ?? 'table';

        const existingOpen = [...orders]
          .reverse()
          .find(
            (o) =>
              o.businessId === cleanId &&
              o.tableId === tbl.id &&
              o.status !== 'cancelled' &&
              (o.paymentStatus ?? 'unpaid') !== 'paid' &&
              Boolean(o.billSessionId),
          );
        billSessionId =
          existingOpen?.billSessionId ??
          `bsess-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

        if (!tbl.occupiedSince) {
          tblList[tblIdx] = { ...tbl, occupiedSince: now };
          tableStore[cleanId] = tblList;
          this.write(STORAGE_KEYS.RESTAURANT_TABLES, tableStore);
        }
      }
    }

    let customerId: string | null = null;
    let repeatVisits = 1;
    const cleanPhone = input.customerPhone?.trim() || null;
    if (cleanPhone) {
      const customers = this.read<RestaurantCustomer[]>(
        STORAGE_KEYS.RESTAURANT_CUSTOMERS,
        [],
      );
      let matched = customers.find(
        (c) =>
          (c.phoneOrEmail ?? '').toLowerCase() === cleanPhone.toLowerCase(),
      );
      if (!matched) {
        matched = {
          id: `rcust-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          displayName: input.customerName?.trim().slice(0, 80) || 'Guest',
          phoneOrEmail: cleanPhone,
          guestTokenHash: `phone-${cleanPhone.toLowerCase().replace(/[^a-z0-9]/g, '')}`,
          createdAt: now,
        };
        customers.push(matched);
        this.write(STORAGE_KEYS.RESTAURANT_CUSTOMERS, customers);
      }
      customerId = matched.id;
      const visits = this.read<RestaurantVerifiedVisit[]>(
        STORAGE_KEYS.RESTAURANT_VERIFIED_VISITS,
        [],
      ).filter(
        (v) => v.businessId === cleanId && v.customerId === matched.id,
      );
      const priorOrders = orders.filter(
        (o) =>
          o.businessId === cleanId &&
          o.customerId === matched.id &&
          o.status !== 'cancelled',
      );
      repeatVisits = Math.max(1, visits.length + priorOrders.length + 1);
    }

    const isAggregatorPrepaid =
      input.orderSource === 'swiggy' ||
      input.orderSource === 'zomato' ||
      input.orderSource === 'magicpin' ||
      input.orderSource === 'ondc';

    const packagingPaise = Math.max(
      0,
      Math.min(1_000_000, Math.round(input.packagingPaise ?? 0)),
    );

    const created: RestaurantTableOrder = {
      id: `tord-pos-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      businessId: cleanId,
      tableId: resolvedTableId,
      tableNumber,
      tableKey,
      locationType,
      customerId,
      guestName: input.customerName?.trim().slice(0, 80) || null,
      items: validatedItems,
      status: 'approved_for_kitchen',
      orderSource: input.orderSource,
      platformOrderNumber:
        input.platformOrderNumber?.trim().slice(0, 60) || null,
      packagingPaise,
      kitchenNote: input.kitchenNote?.trim().slice(0, 300) || null,
      billSessionId,
      paymentStatus: isAggregatorPrepaid ? 'paid' : 'unpaid',
      paymentMethod: isAggregatorPrepaid ? 'platform_prepaid' : null,
      paidAt: isAggregatorPrepaid ? now : null,
      customerRepeatVisitCount: repeatVisits,
      approvedBy: staffLabel,
      createdAt: now,
      updatedAt: now,
    };

    orders.push(created);
    this.write(STORAGE_KEYS.RESTAURANT_TABLE_ORDERS, orders);
    return created;
  }

  async sendTableChatMessage(params: {
    businessSlug: string;
    tableKey: string;
    senderRole: RestaurantTableMessageSenderRole;
    senderName?: string | null;
    messageText: string;
    staffPinHash?: string | null;
    options?: AIConfigAccessOptions;
  }): Promise<RestaurantTableMessage[]> {
    const cleanMsg = (params.messageText ?? '').trim().slice(0, 600);
    if (!cleanMsg) throw new Error('Message cannot be empty.');

    const business = await this.getBusinessBySlug(params.businessSlug);
    if (!business) throw new Error('Restaurant is not active.');

    if (params.senderRole === 'manager') {
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
    }

    const cleanKey = deriveTableKey(params.tableKey);
    const tableStore = this.read<Record<string, RestaurantTable[]>>(
      STORAGE_KEYS.RESTAURANT_TABLES,
      {},
    );
    const tbl = (tableStore[business.id] ?? []).find(
      (t) => t.tableKey === cleanKey,
    );
    if (!tbl) throw new Error('Table or room not found.');

    const msgs = this.read<RestaurantTableMessage[]>(
      STORAGE_KEYS.RESTAURANT_TABLE_MESSAGES,
      [],
    );
    if (params.senderRole === 'manager') {
      for (let i = 0; i < msgs.length; i++) {
        if (
          msgs[i].businessId === business.id &&
          msgs[i].tableId === tbl.id &&
          msgs[i].senderRole === 'customer'
        ) {
          msgs[i] = { ...msgs[i], isRead: true };
        }
      }
    }

    msgs.push({
      id: `tmsg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      businessId: business.id,
      tableId: tbl.id,
      tableNumber: tbl.tableNumber,
      tableKey: tbl.tableKey,
      locationType: tbl.locationType ?? 'table',
      senderRole: params.senderRole,
      senderName:
        params.senderName?.trim().slice(0, 80) ||
        (params.senderRole === 'manager'
          ? 'Manager'
          : params.senderRole === 'system'
            ? 'System'
            : 'Guest'),
      messageText: cleanMsg,
      isRead: params.senderRole === 'manager',
      createdAt: new Date().toISOString(),
    });
    this.write(STORAGE_KEYS.RESTAURANT_TABLE_MESSAGES, msgs);

    return msgs
      .filter((m) => m.businessId === business.id && m.tableId === tbl.id)
      .slice(-80);
  }

  async getTableChatMessages(params: {
    businessSlug: string;
    tableKey: string;
  }): Promise<RestaurantTableMessage[]> {
    const business = await this.getBusinessBySlug(params.businessSlug);
    if (!business) return [];
    const cleanKey = deriveTableKey(params.tableKey);
    const tableStore = this.read<Record<string, RestaurantTable[]>>(
      STORAGE_KEYS.RESTAURANT_TABLES,
      {},
    );
    const tbl = (tableStore[business.id] ?? []).find(
      (t) => t.tableKey === cleanKey,
    );
    if (!tbl) return [];

    return this.read<RestaurantTableMessage[]>(
      STORAGE_KEYS.RESTAURANT_TABLE_MESSAGES,
      [],
    )
      .filter((m) => m.businessId === business.id && m.tableId === tbl.id)
      .slice(-80);
  }

  async getOpenTableBillSummary(params: {
    businessSlug: string;
    tableKey: string;
  }): Promise<OpenTableBillSummary | null> {
    const business = await this.getBusinessBySlug(params.businessSlug);
    if (!business) return null;

    const cleanKey = deriveTableKey(params.tableKey);
    const tableStore = this.read<Record<string, RestaurantTable[]>>(
      STORAGE_KEYS.RESTAURANT_TABLES,
      {},
    );
    const tbl = (tableStore[business.id] ?? []).find(
      (t) => t.tableKey === cleanKey,
    );
    if (!tbl) return null;

    const profileStore = this.read<Record<string, RestaurantProfile>>(
      STORAGE_KEYS.RESTAURANT_PROFILES,
      {},
    );
    const profile = normalizeRestaurantProfile(
      business.id,
      profileStore[business.id],
      'local',
    );

    const allOrders = this.read<RestaurantTableOrder[]>(
      STORAGE_KEYS.RESTAURANT_TABLE_ORDERS,
      [],
    ).filter(
      (o) =>
        o.businessId === business.id &&
        o.tableId === tbl.id &&
        o.status !== 'cancelled',
    );

    let billOrders = allOrders.filter(
      (o) => (o.paymentStatus ?? 'unpaid') !== 'paid',
    );
    let isCheckedOut = false;
    let paymentStatus: 'unpaid' | 'upi_pending_verify' | 'paid' = 'unpaid';
    let paymentMethod: RestaurantPaymentMethod | null = null;
    let paidAt: string | null = null;

    if (billOrders.length > 0) {
      if (billOrders.some((o) => o.paymentStatus === 'upi_pending_verify')) {
        paymentStatus = 'upi_pending_verify';
      }
    } else {
      const sixHoursAgo = Date.now() - 6 * 60 * 60 * 1000;
      const latestPaid = [...allOrders]
        .filter(
          (o) =>
            o.paymentStatus === 'paid' &&
            o.paidAt &&
            new Date(o.paidAt).getTime() >= sixHoursAgo,
        )
        .sort((a, b) => (b.paidAt ?? '').localeCompare(a.paidAt ?? ''))[0];

      if (latestPaid) {
        isCheckedOut = true;
        paymentStatus = 'paid';
        paymentMethod = latestPaid.paymentMethod ?? null;
        paidAt = latestPaid.paidAt ?? null;
        billOrders = allOrders.filter(
          (o) =>
            o.paymentStatus === 'paid' &&
            (latestPaid.billSessionId
              ? o.billSessionId === latestPaid.billSessionId
              : o.paidAt === latestPaid.paidAt),
        );
      }
    }

    const subtotalPaise = billOrders.reduce(
      (sum, o) =>
        sum +
        o.items.reduce((s, item) => s + item.pricePaise * item.quantity, 0),
      0,
    );

    const totals = calculateBillTotals({
      subtotalPaise,
      gstPercent: profile.gstPercent ?? 0,
      serviceChargePercent: profile.serviceChargePercent ?? 0,
    });

    const calls = this.read<RestaurantTableCall[]>(
      STORAGE_KEYS.RESTAURANT_TABLE_CALLS,
      [],
    );
    const billRequested = calls.some(
      (c) =>
        c.businessId === business.id &&
        c.tableId === tbl.id &&
        isBillRequestCallType(c.callType) &&
        (c.status === 'open' || c.status === 'acknowledged'),
    );

    return {
      businessId: business.id,
      businessName: business.name,
      tableId: tbl.id,
      tableNumber: tbl.tableNumber,
      tableKey: tbl.tableKey,
      locationType: tbl.locationType ?? 'table',
      occupiedSince: tbl.occupiedSince ?? null,
      orders: billOrders,
      orderCount: billOrders.length,
      ...totals,
      currencyCode: profile.currencyCode,
      gstin: profile.gstin ?? null,
      upiId: profile.upiId ?? null,
      upiPayeeName: profile.upiPayeeName || business.name,
      paymentStatus,
      paymentMethod,
      paidAt,
      billRequested,
      isCheckedOut,
    };
  }

  async markTableBillUpiPending(params: {
    businessSlug: string;
    tableKey: string;
    guestName?: string | null;
  }): Promise<OpenTableBillSummary | null> {
    const business = await this.getBusinessBySlug(params.businessSlug);
    if (!business) throw new Error('Restaurant is not active.');

    const cleanKey = deriveTableKey(params.tableKey);
    const tableStore = this.read<Record<string, RestaurantTable[]>>(
      STORAGE_KEYS.RESTAURANT_TABLES,
      {},
    );
    const tbl = (tableStore[business.id] ?? []).find(
      (t) => t.tableKey === cleanKey,
    );
    if (!tbl) throw new Error('Table or room not found.');

    const now = new Date().toISOString();
    const orders = this.read<RestaurantTableOrder[]>(
      STORAGE_KEYS.RESTAURANT_TABLE_ORDERS,
      [],
    );
    let updatedCount = 0;
    for (let i = 0; i < orders.length; i++) {
      const o = orders[i];
      if (
        o.businessId === business.id &&
        o.tableId === tbl.id &&
        o.status !== 'cancelled' &&
        (o.paymentStatus ?? 'unpaid') === 'unpaid'
      ) {
        orders[i] = {
          ...o,
          paymentStatus: 'upi_pending_verify',
          paymentMethod: 'upi',
          updatedAt: now,
        };
        updatedCount++;
      }
    }
    this.write(STORAGE_KEYS.RESTAURANT_TABLE_ORDERS, orders);

    if (updatedCount > 0) {
      const msgs = this.read<RestaurantTableMessage[]>(
        STORAGE_KEYS.RESTAURANT_TABLE_MESSAGES,
        [],
      );
      msgs.push({
        id: `tmsg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        businessId: business.id,
        tableId: tbl.id,
        tableNumber: tbl.tableNumber,
        tableKey: tbl.tableKey,
        locationType: tbl.locationType ?? 'table',
        senderRole: 'system',
        senderName: params.guestName?.trim() || 'Guest',
        messageText:
          'UPI payment submitted — staff verifying payment for checkout',
        isRead: false,
        createdAt: now,
      });
      this.write(STORAGE_KEYS.RESTAURANT_TABLE_MESSAGES, msgs);
    }

    return this.getOpenTableBillSummary({
      businessSlug: business.slug,
      tableKey: tbl.tableKey,
    });
  }

  async completeTableBillCheckout(params: {
    businessId: string;
    tableId: string;
    paymentMethod: RestaurantPaymentMethod;
    staffLabel?: string;
    staffPinHash?: string | null;
    options?: AIConfigAccessOptions;
  }): Promise<CompleteTableBillCheckoutResult> {
    const idErr = validateBusinessId(params.businessId);
    if (idErr) throw new Error(idErr);
    const cleanId = params.businessId.trim();
    const business = await this.getBusinessById(cleanId);
    if (!business) {
      throw new Error(`Business with ID "${cleanId}" not found.`);
    }

    const profileStore = this.read<Record<string, RestaurantProfile>>(
      STORAGE_KEYS.RESTAURANT_PROFILES,
      {},
    );
    const profile = normalizeRestaurantProfile(
      cleanId,
      profileStore[cleanId],
      'local',
    );
    this.assertOwnerOrStaffPin(
      business,
      profile,
      params.staffPinHash,
      params.options,
    );

    const tableStore = this.read<Record<string, RestaurantTable[]>>(
      STORAGE_KEYS.RESTAURANT_TABLES,
      {},
    );
    const tblList = tableStore[cleanId] ?? [];
    const tblIdx = tblList.findIndex((t) => t.id === params.tableId);
    if (tblIdx === -1) {
      throw new Error('Table or room not found for this business.');
    }
    const tbl = tblList[tblIdx];
    const staffLabel = this.resolveAuditStaffLabel(
      cleanId,
      params.staffPinHash,
      params.staffLabel ?? 'Owner',
    );
    const now = new Date().toISOString();

    const orders = this.read<RestaurantTableOrder[]>(
      STORAGE_KEYS.RESTAURANT_TABLE_ORDERS,
      [],
    );
    const existingSession = [...orders]
      .reverse()
      .find(
        (o) =>
          o.businessId === cleanId &&
          o.tableId === tbl.id &&
          o.status !== 'cancelled' &&
          (o.paymentStatus ?? 'unpaid') !== 'paid' &&
          Boolean(o.billSessionId),
      )?.billSessionId;
    const sessionId =
      existingSession ??
      `bsess-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    let settledOrdersCount = 0;
    for (let i = 0; i < orders.length; i++) {
      const o = orders[i];
      if (
        o.businessId === cleanId &&
        o.tableId === tbl.id &&
        o.status !== 'cancelled' &&
        (o.paymentStatus ?? 'unpaid') !== 'paid'
      ) {
        orders[i] = {
          ...o,
          status: 'served',
          paymentStatus: 'paid',
          paymentMethod: params.paymentMethod,
          paidAt: now,
          billSessionId: o.billSessionId ?? sessionId,
          approvedBy: o.approvedBy ?? staffLabel,
          updatedAt: now,
        };
        settledOrdersCount++;
      }
    }
    this.write(STORAGE_KEYS.RESTAURANT_TABLE_ORDERS, orders);

    // Resolve open bill requests on this table/room
    const calls = this.read<RestaurantTableCall[]>(
      STORAGE_KEYS.RESTAURANT_TABLE_CALLS,
      [],
    );
    for (let i = 0; i < calls.length; i++) {
      if (
        calls[i].businessId === cleanId &&
        calls[i].tableId === tbl.id &&
        isBillRequestCallType(calls[i].callType) &&
        (calls[i].status === 'open' || calls[i].status === 'acknowledged')
      ) {
        calls[i] = { ...calls[i], status: 'resolved', resolvedAt: now };
      }
    }
    this.write(STORAGE_KEYS.RESTAURANT_TABLE_CALLS, calls);

    // Reset occupiedSince -> Available / Ready for Guests
    tblList[tblIdx] = { ...tbl, occupiedSince: null, updatedAt: now };
    tableStore[cleanId] = tblList;
    this.write(STORAGE_KEYS.RESTAURANT_TABLES, tableStore);

    // Post checkout confirmation message into live table chat
    const msgs = this.read<RestaurantTableMessage[]>(
      STORAGE_KEYS.RESTAURANT_TABLE_MESSAGES,
      [],
    );
    msgs.push({
      id: `tmsg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      businessId: cleanId,
      tableId: tbl.id,
      tableNumber: tbl.tableNumber,
      tableKey: tbl.tableKey,
      locationType: tbl.locationType ?? 'table',
      senderRole: 'system',
      senderName: staffLabel,
      messageText:
        'Checkout approved — your final bill is ready to download under View Bill',
      isRead: true,
      createdAt: now,
    });
    this.write(STORAGE_KEYS.RESTAURANT_TABLE_MESSAGES, msgs);

    const billSummary = await this.getOpenTableBillSummary({
      businessSlug: business.slug,
      tableKey: tbl.tableKey,
    });

    return { settledOrdersCount, billSummary };
  }

  async saveRestaurantFloorLayout(params: {
    businessId: string;
    floorWidthFt: number;
    floorHeightFt: number;
    tables: FloorTableLayoutItem[];
    options?: AIConfigAccessOptions;
  }): Promise<{
    floorWidthFt: number;
    floorHeightFt: number;
    updatedTablesCount: number;
  }> {
    const idErr = validateBusinessId(params.businessId);
    if (idErr) throw new Error(idErr);
    const cleanId = params.businessId.trim();
    const business = await this.getBusinessById(cleanId);
    if (!business) {
      throw new Error(`Business with ID "${cleanId}" not found.`);
    }
    this.assertOwnerAccess(business, params.options);

    const floorWidthFt = Math.max(
      10,
      Math.min(300, Math.round(params.floorWidthFt || 40)),
    );
    const floorHeightFt = Math.max(
      10,
      Math.min(300, Math.round(params.floorHeightFt || 28)),
    );
    const now = new Date().toISOString();

    const profileStore = this.read<Record<string, RestaurantProfile>>(
      STORAGE_KEYS.RESTAURANT_PROFILES,
      {},
    );
    const existingProf = normalizeRestaurantProfile(
      cleanId,
      profileStore[cleanId],
      'local',
    );
    profileStore[cleanId] = {
      ...existingProf,
      floorWidthFt,
      floorHeightFt,
      updatedAt: now,
    };
    this.write(STORAGE_KEYS.RESTAURANT_PROFILES, profileStore);

    const tableStore = this.read<Record<string, RestaurantTable[]>>(
      STORAGE_KEYS.RESTAURANT_TABLES,
      {},
    );
    const tblList = tableStore[cleanId] ?? [];
    const layoutById = new Map(params.tables.map((t) => [t.id, t]));
    let updatedTablesCount = 0;

    for (let i = 0; i < tblList.length; i++) {
      const patch = layoutById.get(tblList[i].id);
      if (!patch) continue;
      tblList[i] = {
        ...tblList[i],
        tableShape:
          patch.tableShape === 'square' ||
          patch.tableShape === 'round' ||
          patch.tableShape === 'rectangle'
            ? patch.tableShape
            : 'rectangle',
        posX: Math.max(0, Math.min(94, Number(patch.posX) || 0)),
        posY: Math.max(0, Math.min(90, Number(patch.posY) || 0)),
        widthUnits: Math.max(6, Math.min(45, Number(patch.widthUnits) || 14)),
        heightUnits: Math.max(6, Math.min(45, Number(patch.heightUnits) || 14)),
        seatCapacity: Math.max(
          1,
          Math.min(30, Math.round(Number(patch.seatCapacity) || 4)),
        ),
        updatedAt: now,
      };
      updatedTablesCount++;
    }
    tableStore[cleanId] = tblList;
    this.write(STORAGE_KEYS.RESTAURANT_TABLES, tableStore);

    return { floorWidthFt, floorHeightFt, updatedTablesCount };
  }

  subscribeToHospitalityRealtime(
    _businessId: string,
    onChange: (event: {
      table:
        | 'restaurant_table_orders'
        | 'restaurant_table_calls'
        | 'restaurant_table_messages';
    }) => void,
  ): () => void {
    // Graceful local/mock fallback: listen for cross-tab localStorage updates
    if (typeof window === 'undefined') {
      return () => {};
    }
    const handler = (e: StorageEvent) => {
      if (e.key === STORAGE_KEYS.RESTAURANT_TABLE_ORDERS) {
        onChange({ table: 'restaurant_table_orders' });
      } else if (e.key === STORAGE_KEYS.RESTAURANT_TABLE_CALLS) {
        onChange({ table: 'restaurant_table_calls' });
      } else if (e.key === STORAGE_KEYS.RESTAURANT_TABLE_MESSAGES) {
        onChange({ table: 'restaurant_table_messages' });
      }
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
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
          bookingType: inChairRaw.bookingType ?? 'walk_in',
          displayCode: formatTicketDisplayCode(inChairRaw),
          estimatedWaitMinutes: 0,
          remainingMinutes: inChairRemaining,
        }
      : null;

    const waitingRaw = allTickets.filter((t) => t.status === 'waiting');
    const {
      mergedTickets: waitingTickets,
      estimatedWaitForNewGuestMinutes,
    } = mergeHybridBarberQueue(inChairRemaining, waitingRaw);

    const bookedSlotsToday = Array.from(
      new Set(
        allTickets
          .filter(
            (t) =>
              t.bookingType === 'appointment' &&
              Boolean(t.scheduledTime) &&
              (t.status === 'waiting' || t.status === 'in_chair'),
          )
          .map((t) => t.scheduledTime as string),
      ),
    ).sort();

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
      estimatedWaitForNewGuestMinutes,
      completedTodayCount,
      bookedSlotsToday,
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

    const queueDateKey =
      validation.value.queueDateOverride ?? getTodayQueueDateKey();
    const allTickets = this.read<BarberQueueTicket[]>(
      STORAGE_KEYS.BARBER_QUEUE_TICKETS,
      [],
    );
    const dayTickets = allTickets.filter(
      (t) => t.businessId === business.id && t.queueDate === queueDateKey,
    );
    const waitingTickets = dayTickets.filter((t) => t.status === 'waiting');

    if (waitingTickets.length >= config.maxQueueSize) {
      throw new Error(
        `Walk-in queue is currently full (${config.maxQueueSize} people waiting). Please try again shortly.`,
      );
    }

    const nowIso = new Date().toISOString();
    const bookingType = validation.value.bookingType;
    const scheduledTime = validation.value.scheduledTime;
    const scheduledAt =
      validation.value.scheduledAtOverride ??
      (bookingType === 'appointment' && scheduledTime
        ? resolveScheduledAtForDate(queueDateKey, scheduledTime)
        : nowIso);

    // Prevent double-booking the exact same 15-minute appointment slot on the same day
    if (bookingType === 'appointment') {
      const targetMs = new Date(scheduledAt).getTime();
      const collision = dayTickets.find(
        (t) =>
          t.bookingType === 'appointment' &&
          (t.status === 'waiting' || t.status === 'in_chair') &&
          Math.abs(new Date(t.scheduledAt ?? t.createdAt).getTime() - targetMs) <
            900_000,
      );
      if (collision) {
        throw new Error(
          `That time slot (${scheduledTime}) is already reserved. Please pick another available slot.`,
        );
      }
    }

    // Match canonical service name, duration & price snapshot from config.services
    const matchedSvc = config.services.find(
      (s) =>
        s.name.toLowerCase() === validation.value.serviceName.toLowerCase() ||
        s.id.toLowerCase() === validation.value.serviceName.toLowerCase(),
    );
    const serviceName = matchedSvc?.name ?? validation.value.serviceName;
    const durationMinutes =
      matchedSvc?.durationMinutes ?? config.avgServiceMinutes;
    const pricePaise = matchedSvc?.pricePaise ?? 20000;

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
          createdAt: nowIso,
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

    // Daily #1 Reset per queueDateKey
    const maxToken = dayTickets.reduce(
      (max, t) => Math.max(max, t.tokenNumber),
      0,
    );
    const nextToken = maxToken + 1;
    const typeSeq =
      dayTickets.filter((t) => (t.bookingType ?? 'walk_in') === bookingType)
        .length + 1;
    const displayCode = `${bookingType === 'appointment' ? 'B' : 'W'}-${String(typeSeq).padStart(2, '0')}`;

    const created: BarberQueueTicket = {
      id: `bqt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      businessId: business.id,
      customerId,
      queueDate: queueDateKey,
      tokenNumber: nextToken,
      bookingType,
      displayCode,
      scheduledTime,
      scheduledAt,
      pricePaise,
      guestName: validation.value.guestName,
      phone: validation.value.phone,
      serviceName,
      durationMinutes,
      status: 'waiting',
      extraDelayMinutes: 0,
      assignedBarberLabel: null,
      createdAt: nowIso,
      startedAt: null,
      completedAt: null,
    };

    allTickets.push(created);
    this.write(STORAGE_KEYS.BARBER_QUEUE_TICKETS, allTickets);

    const inChairRaw =
      dayTickets
        .filter((t) => t.status === 'in_chair')
        .sort((a, b) => a.tokenNumber - b.tokenNumber)[0] ?? null;
    const inChairRemaining = this.computeInChairRemainingMinutes(inChairRaw);
    const { mergedTickets } = mergeHybridBarberQueue(inChairRemaining, [
      ...waitingTickets,
      created,
    ]);
    const matchedMerged = mergedTickets.find((t) => t.id === created.id);
    const position = matchedMerged?.position ?? waitingTickets.length + 1;
    const estimatedWaitMinutes = matchedMerged?.estimatedWaitMinutes ?? 0;

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

  async getBarberRevenueAndServiceSummary(
    businessId: string,
    monthKey?: string | null,
    options?: AIConfigAccessOptions,
  ): Promise<BarberRevenueSummary> {
    const idErr = validateBusinessId(businessId);
    if (idErr) throw new Error(idErr);
    const cleanId = businessId.trim();
    const business = await this.getBusinessById(cleanId);
    if (!business) {
      throw new Error(`Business with ID "${cleanId}" not found.`);
    }
    this.assertOwnerAccess(business, options);

    const todayDate = getTodayQueueDateKey();
    const targetMonth =
      monthKey && /^\d{4}-(0[1-9]|1[0-2])$/.test(monthKey.trim())
        ? monthKey.trim()
        : todayDate.slice(0, 7);

    const completed = this.read<BarberQueueTicket[]>(
      STORAGE_KEYS.BARBER_QUEUE_TICKETS,
      [],
    ).filter((t) => t.businessId === cleanId && t.status === 'completed');

    let todayTotalCuts = 0;
    let todayRevenuePaise = 0;
    let todayWalkIns = 0;
    let todayAppointments = 0;
    let monthTotalCuts = 0;
    let monthRevenuePaise = 0;
    let monthWalkIns = 0;
    let monthAppointments = 0;

    const byService = new Map<string, BarberServiceBreakdownRow>();

    for (const t of completed) {
      const isToday = t.queueDate === todayDate;
      const isMonth = t.queueDate.slice(0, 7) === targetMonth;
      if (!isToday && !isMonth) continue;

      const price = t.pricePaise ?? 0;
      const isAppt = t.bookingType === 'appointment';
      const svcName = t.serviceName || 'Classic Haircut';

      const row = byService.get(svcName) ?? {
        serviceName: svcName,
        countToday: 0,
        revenueTodayPaise: 0,
        countMonth: 0,
        revenueMonthPaise: 0,
      };

      if (isToday) {
        todayTotalCuts++;
        todayRevenuePaise += price;
        if (isAppt) todayAppointments++;
        else todayWalkIns++;
        row.countToday++;
        row.revenueTodayPaise += price;
      }

      if (isMonth) {
        monthTotalCuts++;
        monthRevenuePaise += price;
        if (isAppt) monthAppointments++;
        else monthWalkIns++;
        row.countMonth++;
        row.revenueMonthPaise += price;
      }

      byService.set(svcName, row);
    }

    const serviceBreakdown = Array.from(byService.values()).sort(
      (a, b) =>
        b.revenueMonthPaise - a.revenueMonthPaise ||
        b.countMonth - a.countMonth ||
        a.serviceName.localeCompare(b.serviceName),
    );

    return {
      businessId: cleanId,
      monthKey: targetMonth,
      todayDate,
      todayTotalCuts,
      todayRevenuePaise,
      todayWalkIns,
      todayAppointments,
      monthTotalCuts,
      monthRevenuePaise,
      monthWalkIns,
      monthAppointments,
      serviceBreakdown,
    };
  }

  // ---------------------------------------------------------------------------
  // Module 5 & 5B: GymOS — Membership, Daily QR Attendance, Fitness Targets,
  // Workout Tracking, 3-Day Renewal Radar & Monthly Revenue Forecasting
  // ---------------------------------------------------------------------------

  private getOrSeedMockGymCheckIns(): GymAttendanceLog[] {
    const existing = this.read<GymAttendanceLog[]>(
      STORAGE_KEYS.GYM_CHECK_INS,
      [],
    );
    if (existing.length > 0) return existing;

    const today = getTodayIsoDateKey();
    const todayMorning = new Date();
    todayMorning.setHours(7, 15, 0, 0);
    const yesterday = addDaysToIsoDate(today, -1);
    const twoDaysAgo = addDaysToIsoDate(today, -2);

    const seeded: GymAttendanceLog[] = [
      {
        id: 'gymci-demo-1',
        businessId: 'biz-iron-pulse-4',
        memberId: 'gymm-demo-3',
        checkInDate: today,
        checkedInAt: todayMorning.toISOString(),
        workoutFocus: 'chest',
        memberNote: 'Bench press & incline dumbbells',
      },
      {
        id: 'gymci-demo-2',
        businessId: 'biz-iron-pulse-4',
        memberId: 'gymm-demo-3',
        checkInDate: yesterday,
        checkedInAt: `${yesterday}T07:10:00.000Z`,
        workoutFocus: 'back',
        memberNote: null,
      },
      {
        id: 'gymci-demo-3',
        businessId: 'biz-iron-pulse-4',
        memberId: 'gymm-demo-3',
        checkInDate: twoDaysAgo,
        checkedInAt: `${twoDaysAgo}T07:25:00.000Z`,
        workoutFocus: 'legs',
        memberNote: null,
      },
      {
        id: 'gymci-demo-4',
        businessId: 'biz-iron-pulse-4',
        memberId: 'gymm-demo-2',
        checkInDate: yesterday,
        checkedInAt: `${yesterday}T08:00:00.000Z`,
        workoutFocus: 'cardio_hiit',
        memberNote: '30m HIIT treadmill',
      },
    ];
    this.write(STORAGE_KEYS.GYM_CHECK_INS, seeded);
    return seeded;
  }

  private getOrSeedMockGymPaymentLogs(): GymPaymentLog[] {
    const existing = this.read<GymPaymentLog[]>(
      STORAGE_KEYS.GYM_PAYMENT_LOGS,
      [],
    );
    if (existing.length > 0) return existing;

    const today = getTodayIsoDateKey();
    const seeded: GymPaymentLog[] = [
      {
        id: 'gympay-demo-1',
        businessId: 'biz-iron-pulse-4',
        memberId: 'gymm-demo-2',
        paymentType: 'approval',
        planId: '1_month',
        planName: '1 Month Plan',
        durationDays: 30,
        amountPaise: 150000,
        paidDate: addDaysToIsoDate(today, -28),
        recordedByLabel: 'Owner',
        createdAt: `${addDaysToIsoDate(today, -28)}T09:00:00.000Z`,
      },
      {
        id: 'gympay-demo-2',
        businessId: 'biz-iron-pulse-4',
        memberId: 'gymm-demo-3',
        paymentType: 'approval',
        planId: '3_months',
        planName: '3 Months Plan',
        durationDays: 90,
        amountPaise: 400000,
        paidDate: addDaysToIsoDate(today, -66),
        recordedByLabel: 'Owner',
        createdAt: `${addDaysToIsoDate(today, -66)}T09:00:00.000Z`,
      },
      {
        id: 'gympay-demo-3',
        businessId: 'biz-iron-pulse-4',
        memberId: 'gymm-demo-4',
        paymentType: 'approval',
        planId: '1_month',
        planName: '1 Month Plan',
        durationDays: 30,
        amountPaise: 150000,
        paidDate: addDaysToIsoDate(today, -33),
        recordedByLabel: 'Owner',
        createdAt: `${addDaysToIsoDate(today, -33)}T09:00:00.000Z`,
      },
    ];
    this.write(STORAGE_KEYS.GYM_PAYMENT_LOGS, seeded);
    return seeded;
  }

  private hydrateGymMember(
    raw: GymMember,
    renewalAlertDays: number,
    todayIso: string,
    monthKey?: string,
    allLogs?: GymAttendanceLog[],
  ): GymMember {
    let effectiveStatus: GymEffectiveMemberStatus = raw.status;
    let daysRemaining = 0;

    if (raw.isFrozen && raw.status === 'active') {
      effectiveStatus = 'frozen';
      daysRemaining = raw.endDate
        ? Math.max(0, diffDaysBetweenIsoDates(raw.endDate, todayIso))
        : 0;
    } else if (raw.status === 'active' && raw.endDate) {
      const diff = diffDaysBetweenIsoDates(raw.endDate, todayIso);
      if (diff < 0) {
        effectiveStatus = 'expired';
        daysRemaining = 0;
      } else if (diff <= renewalAlertDays) {
        effectiveStatus = 'expiring_soon';
        daysRemaining = diff;
      } else {
        effectiveStatus = 'active';
        daysRemaining = diff;
      }
    }

    const targetMonth = monthKey ?? todayIso.slice(0, 7);
    const logs = (allLogs ?? this.getOrSeedMockGymCheckIns())
      .filter((l) => l.businessId === raw.businessId && l.memberId === raw.id)
      .sort((a, b) =>
        b.checkInDate !== a.checkInDate
          ? b.checkInDate.localeCompare(a.checkInDate)
          : b.checkedInAt.localeCompare(a.checkedInAt),
      );
    const todayLog = logs.find((l) => l.checkInDate === todayIso) ?? null;
    const daysAttendedThisMonth = logs.filter(
      (l) => l.checkInDate.slice(0, 7) === targetMonth,
    ).length;

    const trainers = this.read<GymTrainer[]>(STORAGE_KEYS.GYM_TRAINERS, []);
    const matchedTrainer = raw.ptTrainerId
      ? trainers.find((t) => t.id === raw.ptTrainerId)
      : undefined;

    const routines = this.read<GymWorkoutRoutine[]>(
      STORAGE_KEYS.GYM_WORKOUT_ROUTINES,
      [],
    );
    const matchedRoutine = raw.assignedRoutineId
      ? routines.find((r) => r.id === raw.assignedRoutineId)
      : undefined;

    const measurements = this.read<GymBodyMeasurement[]>(
      STORAGE_KEYS.GYM_BODY_MEASUREMENTS,
      [],
    )
      .filter((bm) => bm.businessId === raw.businessId && bm.memberId === raw.id)
      .sort((a, b) =>
        b.recordedDate !== a.recordedDate
          ? b.recordedDate.localeCompare(a.recordedDate)
          : b.createdAt.localeCompare(a.createdAt),
      )
      .slice(0, 12);

    const workouts = this.read<GymWorkoutSession[]>(
      STORAGE_KEYS.GYM_WORKOUT_SESSIONS,
      [],
    )
      .filter((ws) => ws.businessId === raw.businessId && ws.memberId === raw.id)
      .sort((a, b) =>
        b.sessionDate !== a.sessionDate
          ? b.sessionDate.localeCompare(a.sessionDate)
          : b.createdAt.localeCompare(a.createdAt),
      )
      .slice(0, 25);

    return {
      ...raw,
      totalPlanAmountPaise: raw.totalPlanAmountPaise ?? raw.feePaise,
      amountPaidPaise:
        raw.amountPaidPaise ??
        (raw.status === 'active' || raw.status === 'expired' ? raw.feePaise : 0),
      balanceDuePaise: raw.balanceDuePaise ?? 0,
      balanceDueDate: raw.balanceDueDate ?? null,
      ptTrainerId: raw.ptTrainerId ?? null,
      ptTrainerName: matchedTrainer?.trainerName ?? raw.ptTrainerName ?? null,
      ptPackageName: raw.ptPackageName ?? null,
      ptPackageFeePaise: raw.ptPackageFeePaise ?? 0,
      ptTotalSessions: raw.ptTotalSessions ?? 0,
      ptRemainingSessions: raw.ptRemainingSessions ?? 0,
      isFrozen: Boolean(raw.isFrozen),
      frozenStartedAt: raw.frozenStartedAt ?? null,
      totalFrozenDays: raw.totalFrozenDays ?? 0,
      currentStreakDays: raw.currentStreakDays ?? 0,
      bestStreakDays: raw.bestStreakDays ?? 0,
      assignedRoutineId: raw.assignedRoutineId ?? null,
      assignedRoutineName:
        matchedRoutine?.routineName ?? raw.assignedRoutineName ?? null,
      fitnessGoal: normalizeGymFitnessGoal(raw.fitnessGoal),
      startingWeightKg: raw.startingWeightKg ?? null,
      targetWeightKg: raw.targetWeightKg ?? null,
      trainerNotes: raw.trainerNotes ?? null,
      effectiveStatus,
      daysRemaining,
      daysAttendedThisMonth,
      lastCheckInAt: todayLog?.checkedInAt ?? raw.lastCheckInAt ?? null,
      checkedInToday: Boolean(todayLog) || raw.lastCheckInDate === todayIso,
      todayWorkoutFocus: todayLog?.workoutFocus ?? null,
      todayCheckedInAt: todayLog?.checkedInAt ?? null,
      todayCheckIn: todayLog,
      recentAttendanceLogs: logs.slice(0, 21),
      bodyMeasurements: measurements,
      recentWorkouts: workouts,
    };
  }

  private getOrSeedMockGymMembers(): GymMember[] {
    const existing = this.read<GymMember[]>(STORAGE_KEYS.GYM_MEMBERS, []);
    if (existing.length > 0) return existing;

    const today = getTodayIsoDateKey();
    const now = new Date().toISOString();
    const todayMorning = new Date();
    todayMorning.setHours(7, 15, 0, 0);

    const seeded: GymMember[] = [
      {
        id: 'gymm-demo-1',
        businessId: 'biz-iron-pulse-4',
        memberCode: 'GYM-001',
        fullName: 'Rahul Sharma',
        phone: '9876543210',
        planId: '1_month',
        planName: '1 Month Plan',
        durationDays: 30,
        feePaise: 150000,
        fitnessGoal: 'muscle_gain',
        startingWeightKg: 68,
        targetWeightKg: 75,
        trainerNotes: null,
        status: 'pending_approval',
        effectiveStatus: 'pending_approval',
        daysRemaining: 0,
        startDate: null,
        endDate: null,
        totalCheckIns: 0,
        lastCheckInDate: null,
        lastCheckInAt: null,
        checkedInToday: false,
        approvedByLabel: null,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'gymm-demo-2',
        businessId: 'biz-iron-pulse-4',
        memberCode: 'GYM-002',
        fullName: 'Priya Nair',
        phone: '9876500002',
        planId: '1_month',
        planName: '1 Month Plan',
        durationDays: 30,
        feePaise: 150000,
        fitnessGoal: 'weight_loss',
        startingWeightKg: 66,
        targetWeightKg: 58,
        trainerNotes: 'Focus on HIIT + progressive strength 4x/week.',
        status: 'active',
        effectiveStatus: 'expiring_soon',
        daysRemaining: 2,
        startDate: addDaysToIsoDate(today, -28),
        endDate: addDaysToIsoDate(today, 2),
        totalCheckIns: 19,
        lastCheckInDate: addDaysToIsoDate(today, -1),
        lastCheckInAt: `${addDaysToIsoDate(today, -1)}T08:00:00.000Z`,
        checkedInToday: false,
        approvedByLabel: 'Owner',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'gymm-demo-3',
        businessId: 'biz-iron-pulse-4',
        memberCode: 'GYM-003',
        fullName: 'Vikram Reddy',
        phone: '9876500003',
        planId: '3_months',
        planName: '3 Months Plan',
        durationDays: 90,
        feePaise: 400000,
        fitnessGoal: 'muscle_gain',
        startingWeightKg: 74,
        targetWeightKg: 80,
        trainerNotes: 'Push/Pull/Legs split — hitting steady progressive overload.',
        status: 'active',
        effectiveStatus: 'active',
        daysRemaining: 24,
        startDate: addDaysToIsoDate(today, -66),
        endDate: addDaysToIsoDate(today, 24),
        totalCheckIns: 42,
        lastCheckInDate: today,
        lastCheckInAt: todayMorning.toISOString(),
        checkedInToday: true,
        approvedByLabel: 'Owner',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'gymm-demo-4',
        businessId: 'biz-iron-pulse-4',
        memberCode: 'GYM-004',
        fullName: 'Arjun Mehta',
        phone: '9876500004',
        planId: '1_month',
        planName: '1 Month Plan',
        durationDays: 30,
        feePaise: 150000,
        fitnessGoal: 'cardio_endurance',
        startingWeightKg: 79,
        targetWeightKg: 72,
        trainerNotes: null,
        status: 'active',
        effectiveStatus: 'expired',
        daysRemaining: 0,
        startDate: addDaysToIsoDate(today, -33),
        endDate: addDaysToIsoDate(today, -3),
        totalCheckIns: 21,
        lastCheckInDate: addDaysToIsoDate(today, -5),
        lastCheckInAt: `${addDaysToIsoDate(today, -5)}T06:45:00.000Z`,
        checkedInToday: false,
        approvedByLabel: 'Owner',
        createdAt: now,
        updatedAt: now,
      },
    ];

    this.write(STORAGE_KEYS.GYM_MEMBERS, seeded);
    this.getOrSeedMockGymCheckIns();
    this.getOrSeedMockGymPaymentLogs();
    return seeded;
  }

  async getGymConfig(
    businessId: string,
    options?: AIConfigAccessOptions,
  ): Promise<GymConfig> {
    const idErr = validateBusinessId(businessId);
    if (idErr) throw new Error(idErr);
    const cleanId = businessId.trim();
    const business = await this.getBusinessById(cleanId);
    if (!business) {
      throw new Error(`Business with ID "${cleanId}" not found.`);
    }
    this.assertOwnerAccess(business, options);

    const store = this.read<Record<string, GymConfig>>(
      STORAGE_KEYS.GYM_CONFIGS,
      {},
    );
    return normalizeGymConfig(cleanId, store[cleanId]);
  }

  async updateGymConfig(
    businessId: string,
    input: GymConfigInput,
    options?: AIConfigAccessOptions,
  ): Promise<GymConfig> {
    const validation = validateGymConfigInput(businessId, input);
    if (!validation.ok) throw new Error(validation.error);

    const cleanId = businessId.trim();
    const business = await this.getBusinessById(cleanId);
    if (!business) {
      throw new Error(`Business with ID "${cleanId}" not found.`);
    }
    this.assertOwnerAccess(business, options);

    const store = this.read<Record<string, GymConfig>>(
      STORAGE_KEYS.GYM_CONFIGS,
      {},
    );
    const prev = store[cleanId];
    const now = new Date().toISOString();
    const updated = normalizeGymConfig(cleanId, {
      isRegistrationOpen: validation.value.isRegistrationOpen,
      renewalAlertDays: validation.value.renewalAlertDays,
      plans: validation.value.plans,
      logoUrl:
        input.logoUrl !== undefined ? input.logoUrl : (prev?.logoUrl ?? null),
      accentColor:
        input.accentColor !== undefined
          ? normalizeGymAccentColor(input.accentColor)
          : (prev?.accentColor ?? '#C8F135'),
      themePreset:
        input.themePreset !== undefined
          ? normalizeGymThemePreset(input.themePreset)
          : (prev?.themePreset ?? 'volt_obsidian'),
      createdAt: prev?.createdAt ?? now,
      updatedAt: now,
    });
    store[cleanId] = updated;
    this.write(STORAGE_KEYS.GYM_CONFIGS, store);
    return updated;
  }

  async ownerUpdateGymBranding(
    input: OwnerUpdateGymBrandingInput,
    options?: AIConfigAccessOptions,
  ): Promise<GymConfig> {
    const idErr = validateBusinessId(input.businessId);
    if (idErr) throw new Error(idErr);
    const cleanId = input.businessId.trim();
    const business = await this.getBusinessById(cleanId);
    if (!business) {
      throw new Error(`Business with ID "${cleanId}" not found.`);
    }
    this.assertOwnerAccess(business, options);

    const store = this.read<Record<string, GymConfig>>(
      STORAGE_KEYS.GYM_CONFIGS,
      {},
    );
    const prev = normalizeGymConfig(cleanId, store[cleanId]);
    const cleanLogo =
      input.logoUrl && /^https?:\/\//i.test(input.logoUrl.trim())
        ? input.logoUrl.trim().slice(0, 600)
        : input.logoUrl === null || input.logoUrl === ''
          ? null
          : prev.logoUrl ?? null;

    const updated = normalizeGymConfig(cleanId, {
      ...prev,
      logoUrl: cleanLogo,
      accentColor: normalizeGymAccentColor(input.accentColor),
      themePreset: normalizeGymThemePreset(input.themePreset),
      updatedAt: new Date().toISOString(),
    });
    store[cleanId] = updated;
    this.write(STORAGE_KEYS.GYM_CONFIGS, store);
    return updated;
  }

  async getPublicGymPortal(
    businessSlug: string,
  ): Promise<PublicGymPortalPayload | null> {
    const cleanSlug = (businessSlug ?? '').trim().toLowerCase();
    if (!/^[a-z0-9-]{3,80}$/.test(cleanSlug)) return null;

    const business = await this.getBusinessBySlug(cleanSlug);
    if (
      !business ||
      business.status !== 'active' ||
      business.accountState !== 'active'
    ) {
      return null;
    }

    const cfgStore = this.read<Record<string, GymConfig>>(
      STORAGE_KEYS.GYM_CONFIGS,
      {},
    );
    const config = normalizeGymConfig(business.id, cfgStore[business.id]);
    const today = getTodayIsoDateKey();
    const allLogs = this.getOrSeedMockGymCheckIns();
    const members = this.getOrSeedMockGymMembers()
      .filter((m) => m.businessId === business.id)
      .map((m) =>
        this.hydrateGymMember(
          m,
          config.renewalAlertDays,
          today,
          today.slice(0, 7),
          allLogs,
        ),
      );

    const activeMembersCount = members.filter(
      (m) =>
        m.effectiveStatus === 'active' || m.effectiveStatus === 'expiring_soon',
    ).length;
    const checkedInTodayCount = members.filter((m) => m.checkedInToday).length;

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
      activeMembersCount,
      checkedInTodayCount,
    };
  }

  async submitGymMemberRegistration(
    input: SubmitGymRegistrationInput,
  ): Promise<GymMember> {
    const validation = validateGymRegistrationInput(input);
    if (!validation.ok) throw new Error(validation.error);

    const business = await this.getBusinessBySlug(validation.value.businessSlug);
    if (
      !business ||
      business.status !== 'active' ||
      business.accountState !== 'active'
    ) {
      throw new Error('Gym is not active.');
    }

    const cfgStore = this.read<Record<string, GymConfig>>(
      STORAGE_KEYS.GYM_CONFIGS,
      {},
    );
    const config = normalizeGymConfig(business.id, cfgStore[business.id]);
    if (!config.isRegistrationOpen) {
      throw new Error(
        'New member registrations are currently paused. Please speak to the front desk.',
      );
    }

    const matchedPlan =
      config.plans.find(
        (p) =>
          p.id.toLowerCase() === validation.value.planId.toLowerCase() ||
          p.name.toLowerCase() === validation.value.planId.toLowerCase(),
      ) ?? config.plans[0];

    const today = getTodayIsoDateKey();
    const now = new Date().toISOString();
    const allMembers = this.getOrSeedMockGymMembers();
    const allLogs = this.getOrSeedMockGymCheckIns();
    const idx = allMembers.findIndex(
      (m) =>
        m.businessId === business.id && m.phone === validation.value.phone,
    );

    const fitnessGoal = normalizeGymFitnessGoal(validation.value.fitnessGoal);
    const startingWeightKg = validation.value.startingWeightKg ?? null;
    const targetWeightKg = validation.value.targetWeightKg ?? null;

    if (idx !== -1) {
      const existing = this.hydrateGymMember(
        allMembers[idx],
        config.renewalAlertDays,
        today,
        today.slice(0, 7),
        allLogs,
      );
      if (
        existing.effectiveStatus === 'active' ||
        existing.effectiveStatus === 'expiring_soon'
      ) {
        throw new Error(
          'An active membership already exists for this phone number. Switch to "My Digital Pass" to view your pass.',
        );
      }

      const updated: GymMember = {
        ...existing,
        fullName: validation.value.fullName,
        planId: matchedPlan.id,
        planName: matchedPlan.name,
        durationDays: matchedPlan.durationDays,
        feePaise: matchedPlan.pricePaise,
        fitnessGoal,
        preferredShift: validation.value.preferredShift,
        startingWeightKg: startingWeightKg ?? existing.startingWeightKg ?? null,
        targetWeightKg: targetWeightKg ?? existing.targetWeightKg ?? null,
        status: 'pending_approval',
        effectiveStatus: 'pending_approval',
        daysRemaining: 0,
        updatedAt: now,
      };
      allMembers[idx] = updated;
      this.write(STORAGE_KEYS.GYM_MEMBERS, allMembers);
      return updated;
    }

    const bizMembers = allMembers.filter((m) => m.businessId === business.id);
    let seq = bizMembers.length + 1;
    let code = `GYM-${String(seq).padStart(3, '0')}`;
    const existingCodes = new Set(bizMembers.map((m) => m.memberCode));
    while (existingCodes.has(code)) {
      seq++;
      code = `GYM-${String(seq).padStart(3, '0')}`;
    }

    const created: GymMember = {
      id: `gymm-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      businessId: business.id,
      memberCode: code,
      fullName: validation.value.fullName,
      phone: validation.value.phone,
      planId: matchedPlan.id,
      planName: matchedPlan.name,
      durationDays: matchedPlan.durationDays,
      feePaise: matchedPlan.pricePaise,
      fitnessGoal,
      preferredShift: validation.value.preferredShift,
      startingWeightKg,
      targetWeightKg,
      trainerNotes: null,
      status: 'pending_approval',
      effectiveStatus: 'pending_approval',
      daysRemaining: 0,
      startDate: null,
      endDate: null,
      totalCheckIns: 0,
      daysAttendedThisMonth: 0,
      lastCheckInDate: null,
      lastCheckInAt: null,
      checkedInToday: false,
      todayWorkoutFocus: null,
      todayCheckedInAt: null,
      todayCheckIn: null,
      recentAttendanceLogs: [],
      approvedByLabel: null,
      createdAt: now,
      updatedAt: now,
    };

    allMembers.push(created);
    this.write(STORAGE_KEYS.GYM_MEMBERS, allMembers);
    return created;
  }

  async lookupGymMemberPass(params: {
    businessSlug: string;
    phone: string;
  }): Promise<GymMember | null> {
    const normPhone = normalizeGymPhone(params.phone);
    if (normPhone.length < 8) {
      throw new Error('Please enter a valid 10-digit phone number.');
    }

    const business = await this.getBusinessBySlug(params.businessSlug);
    if (
      !business ||
      business.status !== 'active' ||
      business.accountState !== 'active'
    ) {
      return null;
    }

    const cfgStore = this.read<Record<string, GymConfig>>(
      STORAGE_KEYS.GYM_CONFIGS,
      {},
    );
    const config = normalizeGymConfig(business.id, cfgStore[business.id]);
    const today = getTodayIsoDateKey();
    const allLogs = this.getOrSeedMockGymCheckIns();

    const found = this.getOrSeedMockGymMembers().find(
      (m) => m.businessId === business.id && m.phone === normPhone,
    );
    if (!found) return null;

    return this.hydrateGymMember(
      found,
      config.renewalAlertDays,
      today,
      today.slice(0, 7),
      allLogs,
    );
  }

  async gymMemberDailyCheckIn(params: {
    businessSlug: string;
    phone: string;
    workoutFocus?: GymWorkoutFocus;
    memberNote?: string | null;
    isPtSession?: boolean;
    checkInDateOverride?: string | null;
  }): Promise<GymDailyCheckInResult> {
    const normPhone = normalizeGymPhone(params.phone);
    if (normPhone.length < 8) {
      throw new Error('Please enter a valid 10-digit phone number.');
    }

    const business = await this.getBusinessBySlug(params.businessSlug);
    if (
      !business ||
      business.status !== 'active' ||
      business.accountState !== 'active'
    ) {
      throw new Error('Gym is not active.');
    }

    const cfgStore = this.read<Record<string, GymConfig>>(
      STORAGE_KEYS.GYM_CONFIGS,
      {},
    );
    const config = normalizeGymConfig(business.id, cfgStore[business.id]);
    const today = getTodayIsoDateKey();
    const targetDate =
      params.checkInDateOverride &&
      /^\d{4}-\d{2}-\d{2}$/.test(params.checkInDateOverride.trim())
        ? params.checkInDateOverride.trim()
        : today;
    const focus = normalizeGymWorkoutFocus(params.workoutFocus);
    const cleanNote =
      typeof params.memberNote === 'string' && params.memberNote.trim()
        ? params.memberNote.trim().slice(0, 280)
        : null;

    const members = this.getOrSeedMockGymMembers();
    const allLogs = this.getOrSeedMockGymCheckIns();
    const idx = members.findIndex(
      (m) => m.businessId === business.id && m.phone === normPhone,
    );
    if (idx === -1) {
      throw new Error('Member not found for this phone number.');
    }

    const hydrated = this.hydrateGymMember(
      members[idx],
      config.renewalAlertDays,
      today,
      today.slice(0, 7),
      allLogs,
    );
    if (hydrated.effectiveStatus === 'pending_approval') {
      throw new Error(
        'Your membership is pending payment approval at the front desk.',
      );
    }
    if (hydrated.isFrozen || hydrated.effectiveStatus === 'frozen') {
      throw new Error(
        'Membership is currently paused — ask front desk to resume.',
      );
    }
    if (
      hydrated.effectiveStatus !== 'active' &&
      hydrated.effectiveStatus !== 'expiring_soon'
    ) {
      throw new Error(
        'Your membership plan has expired. Please renew at the front desk to check in.',
      );
    }

    const existingLogIdx = allLogs.findIndex(
      (l) =>
        l.businessId === business.id &&
        l.memberId === hydrated.id &&
        l.checkInDate === targetDate,
    );
    const nowIso = new Date().toISOString();

    let todayLog: GymAttendanceLog;
    let alreadyCheckedInToday = false;
    let totalCheckIns = members[idx].totalCheckIns;
    let currentStreakDays = members[idx].currentStreakDays ?? 0;
    let bestStreakDays = members[idx].bestStreakDays ?? 0;
    let ptRemainingSessions = members[idx].ptRemainingSessions ?? 0;

    if (existingLogIdx !== -1) {
      alreadyCheckedInToday = true;
      const resolvedShift =
        allLogs[existingLogIdx].checkInShift ??
        inferGymCheckInShiftFromHour(
          new Date(allLogs[existingLogIdx].checkedInAt).getHours(),
        );
      todayLog = {
        ...allLogs[existingLogIdx],
        workoutFocus: focus,
        memberNote: cleanNote ?? allLogs[existingLogIdx].memberNote ?? null,
        checkInShift: resolvedShift,
      };
      allLogs[existingLogIdx] = todayLog;
      this.write(STORAGE_KEYS.GYM_CHECK_INS, allLogs);
    } else {
      const yesterdayIso = addDaysToIsoDate(targetDate, -1);
      const hadYesterday =
        members[idx].lastCheckInDate === yesterdayIso ||
        allLogs.some(
          (l) =>
            l.businessId === business.id &&
            l.memberId === hydrated.id &&
            l.checkInDate === yesterdayIso,
        );
      currentStreakDays = hadYesterday ? Math.max(1, currentStreakDays + 1) : 1;
      bestStreakDays = Math.max(bestStreakDays, currentStreakDays);

      const usePt = Boolean(params.isPtSession) && ptRemainingSessions > 0;
      const usedTrainerId = usePt ? (members[idx].ptTrainerId ?? null) : null;
      if (usePt) {
        ptRemainingSessions = Math.max(0, ptRemainingSessions - 1);
      }

      const checkedAt =
        targetDate === today ? nowIso : `${targetDate}T07:30:00.000Z`;
      const inferredShift =
        members[idx].preferredShift === 'morning' ||
        members[idx].preferredShift === 'evening'
          ? members[idx].preferredShift
          : inferGymCheckInShiftFromHour(new Date(checkedAt).getHours());

      todayLog = {
        id: `gymci-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        businessId: business.id,
        memberId: hydrated.id,
        checkInDate: targetDate,
        checkedInAt: checkedAt,
        checkInShift: inferredShift,
        workoutFocus: focus,
        memberNote: cleanNote,
        isPtSession: usePt,
        trainerId: usedTrainerId,
      };
      allLogs.push(todayLog);
      this.write(STORAGE_KEYS.GYM_CHECK_INS, allLogs);

      totalCheckIns = members[idx].totalCheckIns + 1;
      const latestDate =
        !members[idx].lastCheckInDate ||
        targetDate >= members[idx].lastCheckInDate
          ? targetDate
          : members[idx].lastCheckInDate;
      const updatedMember: GymMember = {
        ...members[idx],
        totalCheckIns,
        lastCheckInDate: latestDate,
        lastCheckInAt:
          latestDate === targetDate
            ? todayLog.checkedInAt
            : (members[idx].lastCheckInAt ?? todayLog.checkedInAt),
        currentStreakDays,
        bestStreakDays,
        ptRemainingSessions,
        checkedInToday:
          targetDate === today ? true : hydrated.checkedInToday,
        updatedAt: nowIso,
      };
      members[idx] = updatedMember;
      this.write(STORAGE_KEYS.GYM_MEMBERS, members);
    }

    const currMonth = today.slice(0, 7);
    const daysAttendedThisMonth = allLogs.filter(
      (l) =>
        l.businessId === business.id &&
        l.memberId === hydrated.id &&
        l.checkInDate.slice(0, 7) === currMonth,
    ).length;

    return {
      memberId: hydrated.id,
      memberCode: hydrated.memberCode,
      fullName: hydrated.fullName,
      alreadyCheckedInToday,
      totalCheckIns,
      daysAttendedThisMonth,
      daysRemaining: hydrated.daysRemaining,
      currentStreakDays,
      bestStreakDays,
      ptRemainingSessions,
      isPtSession: Boolean(todayLog.isPtSession),
      trainerId: todayLog.trainerId ?? null,
      checkedInDate: todayLog.checkInDate,
      checkedInAt: todayLog.checkedInAt,
      checkInShift:
        todayLog.checkInShift ??
        inferGymCheckInShiftFromHour(new Date(todayLog.checkedInAt).getHours()),
      workoutFocus: todayLog.workoutFocus,
      memberNote: todayLog.memberNote ?? null,
      todayLog,
    };
  }

  async getGymOwnerDashboard(
    businessId: string,
    options?: AIConfigAccessOptions,
    monthKey?: string | null,
  ): Promise<GymOwnerDashboardPayload> {
    const idErr = validateBusinessId(businessId);
    if (idErr) throw new Error(idErr);
    const cleanId = businessId.trim();
    const business = await this.getBusinessById(cleanId);
    if (!business) {
      throw new Error(`Business with ID "${cleanId}" not found.`);
    }
    this.assertOwnerAccess(business, options);

    const cfgStore = this.read<Record<string, GymConfig>>(
      STORAGE_KEYS.GYM_CONFIGS,
      {},
    );
    const config = normalizeGymConfig(cleanId, cfgStore[cleanId]);
    const today = getTodayIsoDateKey();
    const targetMonth =
      monthKey && /^\d{4}-(0[1-9]|1[0-2])$/.test(monthKey.trim())
        ? monthKey.trim()
        : today.slice(0, 7);

    const allLogs = this.getOrSeedMockGymCheckIns().filter(
      (l) => l.businessId === cleanId,
    );
    const allPayments = this.getOrSeedMockGymPaymentLogs().filter(
      (p) => p.businessId === cleanId,
    );

    const members = this.getOrSeedMockGymMembers()
      .filter((m) => m.businessId === cleanId)
      .map((m) =>
        this.hydrateGymMember(
          m,
          config.renewalAlertDays,
          today,
          targetMonth,
          allLogs,
        ),
      )
      .sort((a, b) => {
        const rank = (s: GymEffectiveMemberStatus) =>
          s === 'pending_approval'
            ? 1
            : s === 'expiring_soon'
              ? 2
              : s === 'active'
                ? 3
                : 4;
        const rDiff = rank(a.effectiveStatus) - rank(b.effectiveStatus);
        if (rDiff !== 0) return rDiff;
        if (a.endDate && b.endDate) return a.endDate.localeCompare(b.endDate);
        return b.createdAt.localeCompare(a.createdAt);
      });

    const memberById = new Map(members.map((m) => [m.id, m]));
    const todaysAttendance: GymTodayAttendanceEntry[] = [];
    for (const l of allLogs
      .filter((log) => log.checkInDate === today)
      .sort((a, b) => b.checkedInAt.localeCompare(a.checkedInAt))) {
      const m = memberById.get(l.memberId);
      if (!m) continue;
      todaysAttendance.push({
        id: l.id,
        memberId: m.id,
        memberCode: m.memberCode,
        fullName: m.fullName,
        phone: m.phone,
        fitnessGoal: normalizeGymFitnessGoal(m.fitnessGoal),
        preferredShift: normalizeGymPreferredShift(m.preferredShift),
        checkInDate: l.checkInDate,
        checkedInAt: l.checkedInAt,
        checkInShift:
          l.checkInShift ??
          inferGymCheckInShiftFromHour(new Date(l.checkedInAt).getHours()),
        workoutFocus: l.workoutFocus,
        memberNote: l.memberNote ?? null,
        daysAttendedThisMonth: m.daysAttendedThisMonth ?? 1,
        totalCheckIns: m.totalCheckIns,
      });
    }

    const checkedInTodayCount = todaysAttendance.length;

    const membershipRevenuePaise = allPayments
      .filter((p) => p.paidDate.slice(0, 7) === targetMonth)
      .reduce((sum, p) => sum + p.amountPaise, 0);

    const allRetailSales = this.read<GymRetailSale[]>(
      STORAGE_KEYS.GYM_RETAIL_SALES,
      [],
    ).filter((s) => s.businessId === cleanId);
    const retailRevenuePaise = allRetailSales
      .filter((s) => s.soldAt.slice(0, 7) === targetMonth)
      .reduce((sum, s) => sum + s.totalPaise, 0);
    const monthlyRevenuePaise = membershipRevenuePaise + retailRevenuePaise;

    const totalBalanceDuePaise = members
      .filter(
        (m) =>
          (m.status === 'active' || m.status === 'pending_approval') &&
          (m.balanceDuePaise ?? 0) > 0,
      )
      .reduce((sum, m) => sum + (m.balanceDuePaise ?? 0), 0);
    const balanceDueMembersCount = members.filter(
      (m) =>
        (m.status === 'active' || m.status === 'pending_approval') &&
        (m.balanceDuePaise ?? 0) > 0,
    ).length;

    // Previous month key (YYYY-MM) for Week 1..4 Revenue Comparison
    const [yrNum, moNum] = targetMonth.split('-').map(Number);
    const prevDate = new Date(Date.UTC(yrNum, (moNum || 1) - 2, 1));
    const prevMonthKey = `${prevDate.getUTCFullYear()}-${String(prevDate.getUTCMonth() + 1).padStart(2, '0')}`;
    const getWeekBucket = (isoDate: string) => {
      const day = Number.parseInt(isoDate.slice(8, 10), 10) || 1;
      return Math.min(4, Math.floor((day - 1) / 7) + 1);
    };
    const weeklyRevenueComparison: GymWeeklyRevenueBucket[] = [1, 2, 3, 4].map(
      (wk) => {
        const tmPay = allPayments
          .filter(
            (p) =>
              p.paidDate.slice(0, 7) === targetMonth &&
              getWeekBucket(p.paidDate) === wk,
          )
          .reduce((s, p) => s + p.amountPaise, 0);
        const tmRet = allRetailSales
          .filter(
            (s) =>
              s.soldAt.slice(0, 7) === targetMonth &&
              getWeekBucket(s.soldAt.slice(0, 10)) === wk,
          )
          .reduce((s, x) => s + x.totalPaise, 0);
        const lmPay = allPayments
          .filter(
            (p) =>
              p.paidDate.slice(0, 7) === prevMonthKey &&
              getWeekBucket(p.paidDate) === wk,
          )
          .reduce((s, p) => s + p.amountPaise, 0);
        const lmRet = allRetailSales
          .filter(
            (s) =>
              s.soldAt.slice(0, 7) === prevMonthKey &&
              getWeekBucket(s.soldAt.slice(0, 10)) === wk,
          )
          .reduce((s, x) => s + x.totalPaise, 0);
        return {
          weekIndex: wk,
          label: `Week ${wk}`,
          thisMonthPaise: tmPay + tmRet,
          lastMonthPaise: lmPay + lmRet,
        };
      },
    );

    const projectedNextMonthRevenuePaise = members
      .filter(
        (m) =>
          (m.effectiveStatus === 'active' ||
            m.effectiveStatus === 'expiring_soon') &&
          !m.isFrozen &&
          m.endDate !== null &&
          diffDaysBetweenIsoDates(m.endDate, today) >= 0 &&
          diffDaysBetweenIsoDates(m.endDate, today) <= 30,
      )
      .reduce((sum, m) => sum + m.feePaise, 0);

    const inactiveAlertMembers: GymInactiveAlertMember[] = members
      .filter(
        (m) =>
          (m.effectiveStatus === 'active' ||
            m.effectiveStatus === 'expiring_soon') &&
          !m.isFrozen,
      )
      .map((m) => {
        const refDate = m.lastCheckInDate ?? m.startDate ?? today;
        const daysSince = diffDaysBetweenIsoDates(today, refDate);
        return {
          memberId: m.id,
          memberCode: m.memberCode,
          fullName: m.fullName,
          phone: m.phone,
          fitnessGoal: normalizeGymFitnessGoal(m.fitnessGoal),
          daysSinceLastCheckIn: daysSince,
          lastCheckInDate: m.lastCheckInDate,
          daysRemaining: m.daysRemaining,
        };
      })
      .filter((x) => x.daysSinceLastCheckIn >= 5)
      .sort((a, b) => b.daysSinceLastCheckIn - a.daysSinceLastCheckIn);

    const trainers = await this.getGymTrainerCommissions(
      cleanId,
      targetMonth,
      options,
    );
    const retailProducts = this.read<GymRetailProduct[]>(
      STORAGE_KEYS.GYM_RETAIL_PRODUCTS,
      [],
    ).filter((p) => p.businessId === cleanId);
    const recentRetailSales = [...allRetailSales]
      .sort((a, b) => b.soldAt.localeCompare(a.soldAt))
      .slice(0, 25);
    const monthlyLeaderboard = await this.getGymMonthlyLeaderboard(
      business.slug,
    );
    const routines = this.read<GymWorkoutRoutine[]>(
      STORAGE_KEYS.GYM_WORKOUT_ROUTINES,
      [],
    )
      .filter((r) => r.businessId === cleanId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const exerciseCatalog = await this.getGymExerciseCatalog(cleanId, options);
    const activeMembersList = members.filter(
      (m) =>
        m.effectiveStatus === 'active' || m.effectiveStatus === 'expiring_soon',
    );
    const batchStats = {
      morningCheckedIn: todaysAttendance.filter(
        (t) => t.checkInShift === 'morning',
      ).length,
      eveningCheckedIn: todaysAttendance.filter(
        (t) => t.checkInShift === 'evening',
      ).length,
      morningTotal: activeMembersList.filter(
        (m) => normalizeGymPreferredShift(m.preferredShift) === 'morning',
      ).length,
      eveningTotal: activeMembersList.filter(
        (m) => normalizeGymPreferredShift(m.preferredShift) === 'evening',
      ).length,
      flexibleTotal: activeMembersList.filter(
        (m) => normalizeGymPreferredShift(m.preferredShift) === 'flexible',
      ).length,
    };

    return {
      config,
      monthKey: targetMonth,
      members,
      checkedInTodayCount,
      todaysAttendance,
      monthlyRevenuePaise,
      membershipRevenuePaise,
      retailRevenuePaise,
      projectedNextMonthRevenuePaise,
      totalBalanceDuePaise,
      balanceDueMembersCount,
      weeklyRevenueComparison,
      inactiveAlertMembers,
      trainers,
      retailProducts,
      recentRetailSales,
      monthlyLeaderboard,
      routines,
      exerciseCatalog,
      batchStats,
    };
  }

  async getGymMemberProgressHistory(params: {
    businessId: string;
    memberId: string;
    monthKey?: string | null;
    options?: AIConfigAccessOptions;
  }): Promise<GymMemberProgressHistory> {
    const idErr = validateBusinessId(params.businessId);
    if (idErr) throw new Error(idErr);
    const cleanId = params.businessId.trim();
    const business = await this.getBusinessById(cleanId);
    if (!business) {
      throw new Error(`Business with ID "${cleanId}" not found.`);
    }
    this.assertOwnerAccess(business, params.options);

    const cfgStore = this.read<Record<string, GymConfig>>(
      STORAGE_KEYS.GYM_CONFIGS,
      {},
    );
    const config = normalizeGymConfig(cleanId, cfgStore[cleanId]);
    const today = getTodayIsoDateKey();
    const targetMonth =
      params.monthKey && /^\d{4}-(0[1-9]|1[0-2])$/.test(params.monthKey.trim())
        ? params.monthKey.trim()
        : today.slice(0, 7);

    const rawMember = this.getOrSeedMockGymMembers().find(
      (m) => m.businessId === cleanId && m.id === params.memberId,
    );
    if (!rawMember) {
      throw new Error('Gym member not found for this business.');
    }

    const allLogs = this.getOrSeedMockGymCheckIns();
    const member = this.hydrateGymMember(
      rawMember,
      config.renewalAlertDays,
      today,
      targetMonth,
      allLogs,
    );

    const memberLogs = allLogs
      .filter((l) => l.businessId === cleanId && l.memberId === rawMember.id)
      .sort((a, b) =>
        b.checkInDate !== a.checkInDate
          ? b.checkInDate.localeCompare(a.checkInDate)
          : b.checkedInAt.localeCompare(a.checkedInAt),
      )
      .slice(0, 90);

    const workoutSplitCounts: Partial<Record<GymWorkoutFocus, number>> = {};
    for (const log of memberLogs) {
      workoutSplitCounts[log.workoutFocus] =
        (workoutSplitCounts[log.workoutFocus] ?? 0) + 1;
    }

    const daysAttendedThisMonth = memberLogs.filter(
      (l) => l.checkInDate.slice(0, 7) === targetMonth,
    ).length;

    return {
      member,
      monthKey: targetMonth,
      daysAttendedThisMonth,
      attendanceLogs: memberLogs,
      workoutSplitCounts,
      bodyMeasurements: member.bodyMeasurements ?? [],
      recentWorkouts: member.recentWorkouts ?? [],
    };
  }

  async ownerUpdateGymMemberProfile(params: {
    businessId: string;
    memberId: string;
    trainerNotes?: string | null;
    fitnessGoal?: GymFitnessGoal | null;
    startingWeightKg?: number | null;
    targetWeightKg?: number | null;
    options?: AIConfigAccessOptions;
  }): Promise<GymMember> {
    const idErr = validateBusinessId(params.businessId);
    if (idErr) throw new Error(idErr);
    const cleanId = params.businessId.trim();
    const business = await this.getBusinessById(cleanId);
    if (!business) {
      throw new Error(`Business with ID "${cleanId}" not found.`);
    }
    this.assertOwnerAccess(business, params.options);

    const startWt = validateGymWeightKg(params.startingWeightKg);
    if (!startWt.ok) throw new Error(`Starting weight: ${startWt.error}`);
    const targetWt = validateGymWeightKg(params.targetWeightKg);
    if (!targetWt.ok) throw new Error(`Target weight: ${targetWt.error}`);

    const members = this.getOrSeedMockGymMembers();
    const idx = members.findIndex(
      (m) => m.businessId === cleanId && m.id === params.memberId,
    );
    if (idx === -1) {
      throw new Error('Gym member not found for this business.');
    }

    const existing = members[idx];
    const cleanNotes =
      params.trainerNotes === undefined
        ? existing.trainerNotes ?? null
        : params.trainerNotes === null || params.trainerNotes.trim() === ''
          ? null
          : params.trainerNotes.trim().slice(0, 1000);

    const updated: GymMember = {
      ...existing,
      fitnessGoal: params.fitnessGoal
        ? normalizeGymFitnessGoal(params.fitnessGoal)
        : normalizeGymFitnessGoal(existing.fitnessGoal),
      trainerNotes: cleanNotes,
      startingWeightKg:
        params.startingWeightKg !== undefined
          ? startWt.value
          : (existing.startingWeightKg ?? null),
      targetWeightKg:
        params.targetWeightKg !== undefined
          ? targetWt.value
          : (existing.targetWeightKg ?? null),
      updatedAt: new Date().toISOString(),
    };

    const cfgStore = this.read<Record<string, GymConfig>>(
      STORAGE_KEYS.GYM_CONFIGS,
      {},
    );
    const config = normalizeGymConfig(cleanId, cfgStore[cleanId]);
    const today = getTodayIsoDateKey();
    const hydrated = this.hydrateGymMember(
      updated,
      config.renewalAlertDays,
      today,
    );
    members[idx] = hydrated;
    this.write(STORAGE_KEYS.GYM_MEMBERS, members);
    return hydrated;
  }

  async ownerApproveOrRenewGymMember(params: {
    businessId: string;
    memberId: string;
    action: GymOwnerMemberAction;
    planId?: string | null;
    durationDays?: number | null;
    feePaise?: number | null;
    amountPaidPaise?: number | null;
    balanceDueDate?: string | null;
    ptTrainerId?: string | null;
    ptPackageName?: string | null;
    ptSessions?: number;
    ptFeePaise?: number;
    paymentMethod?: GymPaymentMethod;
    staffLabel?: string;
    options?: AIConfigAccessOptions;
  }): Promise<GymMember> {
    const idErr = validateBusinessId(params.businessId);
    if (idErr) throw new Error(idErr);
    const actionCheck = validateGymOwnerAction(params.action);
    if (!actionCheck.ok) throw new Error(actionCheck.error);

    const cleanId = params.businessId.trim();
    const business = await this.getBusinessById(cleanId);
    if (!business) {
      throw new Error(`Business with ID "${cleanId}" not found.`);
    }
    this.assertOwnerAccess(business, params.options);

    const cfgStore = this.read<Record<string, GymConfig>>(
      STORAGE_KEYS.GYM_CONFIGS,
      {},
    );
    const config = normalizeGymConfig(cleanId, cfgStore[cleanId]);
    const today = getTodayIsoDateKey();
    const now = new Date().toISOString();

    const members = this.getOrSeedMockGymMembers();
    const idx = members.findIndex(
      (m) => m.id === params.memberId && m.businessId === cleanId,
    );
    if (idx === -1) {
      throw new Error('Gym member not found for this business.');
    }

    const existing = members[idx];
    let planId = params.planId?.trim() || existing.planId;
    let planName = existing.planName;
    let durationDays = params.durationDays ?? existing.durationDays;
    let feePaise = params.feePaise ?? existing.feePaise;

    if (params.planId) {
      const matched = config.plans.find(
        (p) => p.id.toLowerCase() === params.planId!.trim().toLowerCase(),
      );
      if (matched) {
        planId = matched.id;
        planName = matched.name;
        if (params.durationDays == null) durationDays = matched.durationDays;
        if (params.feePaise == null) feePaise = matched.pricePaise;
      }
    }

    let ptTrainerId: string | null = null;
    if (params.ptTrainerId) {
      const trainers = this.read<GymTrainer[]>(STORAGE_KEYS.GYM_TRAINERS, []);
      const foundTrainer = trainers.find(
        (t) => t.id === params.ptTrainerId && t.businessId === cleanId,
      );
      if (!foundTrainer) {
        throw new Error('Selected Personal Trainer not found for this gym.');
      }
      ptTrainerId = foundTrainer.id;
    }

    const ptSessions = Math.max(
      0,
      Math.min(500, Math.round(params.ptSessions ?? 0)),
    );
    const ptFeePaise = Math.max(
      0,
      Math.min(100_000_000, Math.round(params.ptFeePaise ?? 0)),
    );
    const ptPackageName =
      params.ptPackageName?.trim().slice(0, 80) ||
      (ptSessions > 0 ? `${ptSessions} PT Sessions` : null);

    durationDays = Math.max(1, Math.min(1095, Math.round(durationDays)));
    feePaise = Math.max(0, Math.min(100_000_000, Math.round(feePaise)));
    const totalDuePaise = feePaise + ptFeePaise;
    const paidNowPaise =
      params.amountPaidPaise == null
        ? totalDuePaise
        : Math.max(0, Math.min(totalDuePaise, Math.round(params.amountPaidPaise)));
    const newBalanceDue = Math.max(0, totalDuePaise - paidNowPaise);
    const paymentMethod: GymPaymentMethod =
      params.paymentMethod === 'cash' ? 'cash' : 'upi';
    const label = (params.staffLabel ?? 'Owner').trim().slice(0, 80) || 'Owner';

    let updated: GymMember = { ...existing, updatedAt: now };

    if (actionCheck.value === 'approve') {
      updated = {
        ...updated,
        status: 'active',
        isFrozen: false,
        frozenStartedAt: null,
        planId,
        planName,
        durationDays,
        feePaise,
        totalPlanAmountPaise: totalDuePaise,
        amountPaidPaise: paidNowPaise,
        balanceDuePaise: newBalanceDue,
        balanceDueDate:
          newBalanceDue > 0
            ? (params.balanceDueDate ?? addDaysToIsoDate(today, 14))
            : null,
        ptTrainerId: ptTrainerId ?? existing.ptTrainerId ?? null,
        ptPackageName: ptPackageName ?? existing.ptPackageName ?? null,
        ptPackageFeePaise:
          ptFeePaise > 0 ? ptFeePaise : (existing.ptPackageFeePaise ?? 0),
        ptTotalSessions:
          ptSessions > 0 ? ptSessions : (existing.ptTotalSessions ?? 0),
        ptRemainingSessions:
          ptSessions > 0 ? ptSessions : (existing.ptRemainingSessions ?? 0),
        startDate: today,
        endDate: addDaysToIsoDate(today, durationDays),
        approvedByLabel: label,
      };
      if (paidNowPaise > 0) {
        const payments = this.getOrSeedMockGymPaymentLogs();
        payments.push({
          id: `gympay-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          businessId: cleanId,
          memberId: existing.id,
          paymentType: 'approval',
          paymentMethod,
          planId,
          planName,
          durationDays,
          amountPaise: paidNowPaise,
          ptTrainerId,
          ptFeePaise,
          paidDate: today,
          recordedByLabel: label,
          createdAt: now,
        });
        this.write(STORAGE_KEYS.GYM_PAYMENT_LOGS, payments);
      }
    } else if (actionCheck.value === 'renew') {
      const baseDate =
        existing.endDate && existing.endDate > today ? existing.endDate : today;
      const combinedBalance = (existing.balanceDuePaise ?? 0) + newBalanceDue;
      updated = {
        ...updated,
        status: 'active',
        isFrozen: false,
        frozenStartedAt: null,
        planId,
        planName,
        durationDays,
        feePaise,
        totalPlanAmountPaise: totalDuePaise,
        amountPaidPaise: paidNowPaise,
        balanceDuePaise: combinedBalance,
        balanceDueDate:
          combinedBalance > 0
            ? (params.balanceDueDate ??
              existing.balanceDueDate ??
              addDaysToIsoDate(today, 14))
            : null,
        ptTrainerId: ptTrainerId ?? existing.ptTrainerId ?? null,
        ptPackageName: ptPackageName ?? existing.ptPackageName ?? null,
        ptPackageFeePaise:
          ptFeePaise > 0 ? ptFeePaise : (existing.ptPackageFeePaise ?? 0),
        ptTotalSessions:
          ptSessions > 0
            ? (existing.ptTotalSessions ?? 0) + ptSessions
            : (existing.ptTotalSessions ?? 0),
        ptRemainingSessions:
          ptSessions > 0
            ? (existing.ptRemainingSessions ?? 0) + ptSessions
            : (existing.ptRemainingSessions ?? 0),
        startDate: existing.startDate ?? today,
        endDate: addDaysToIsoDate(baseDate, durationDays),
        approvedByLabel: label,
      };
      if (paidNowPaise > 0) {
        const payments = this.getOrSeedMockGymPaymentLogs();
        payments.push({
          id: `gympay-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          businessId: cleanId,
          memberId: existing.id,
          paymentType: 'renewal',
          paymentMethod,
          planId,
          planName,
          durationDays,
          amountPaise: paidNowPaise,
          ptTrainerId,
          ptFeePaise,
          paidDate: today,
          recordedByLabel: label,
          createdAt: now,
        });
        this.write(STORAGE_KEYS.GYM_PAYMENT_LOGS, payments);
      }
    } else if (actionCheck.value === 'reject') {
      updated = { ...updated, status: 'rejected' };
    } else if (actionCheck.value === 'suspend') {
      updated = { ...updated, status: 'suspended' };
    }

    const hydrated = this.hydrateGymMember(
      updated,
      config.renewalAlertDays,
      today,
    );
    members[idx] = hydrated;
    this.write(STORAGE_KEYS.GYM_MEMBERS, members);
    return hydrated;
  }

  async collectGymBalanceDue(params: {
    businessId: string;
    memberId: string;
    collectedPaise: number;
    paymentMethod?: GymPaymentMethod;
    options?: AIConfigAccessOptions;
  }): Promise<GymMember> {
    const idErr = validateBusinessId(params.businessId);
    if (idErr) throw new Error(idErr);
    if (!Number.isFinite(params.collectedPaise) || params.collectedPaise <= 0) {
      throw new Error('Collected amount must be greater than zero.');
    }
    const cleanId = params.businessId.trim();
    const business = await this.getBusinessById(cleanId);
    if (!business) throw new Error(`Business with ID "${cleanId}" not found.`);
    this.assertOwnerAccess(business, params.options);

    const members = this.getOrSeedMockGymMembers();
    const idx = members.findIndex(
      (m) => m.id === params.memberId && m.businessId === cleanId,
    );
    if (idx === -1) throw new Error('Gym member not found for this business.');
    const existing = members[idx];
    const currentDue = existing.balanceDuePaise ?? 0;
    if (currentDue <= 0) {
      throw new Error('This member has no pending balance due.');
    }

    const applied = Math.min(currentDue, Math.round(params.collectedPaise));
    const nextBalance = Math.max(0, currentDue - applied);
    const today = getTodayIsoDateKey();
    const now = new Date().toISOString();

    const updated: GymMember = {
      ...existing,
      amountPaidPaise: (existing.amountPaidPaise ?? 0) + applied,
      balanceDuePaise: nextBalance,
      balanceDueDate: nextBalance === 0 ? null : (existing.balanceDueDate ?? null),
      updatedAt: now,
    };
    const cfgStore = this.read<Record<string, GymConfig>>(
      STORAGE_KEYS.GYM_CONFIGS,
      {},
    );
    const config = normalizeGymConfig(cleanId, cfgStore[cleanId]);
    const hydrated = this.hydrateGymMember(
      updated,
      config.renewalAlertDays,
      today,
    );
    members[idx] = hydrated;
    this.write(STORAGE_KEYS.GYM_MEMBERS, members);

    const payments = this.getOrSeedMockGymPaymentLogs();
    payments.push({
      id: `gympay-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      businessId: cleanId,
      memberId: existing.id,
      paymentType: 'balance_due',
      paymentMethod: params.paymentMethod === 'cash' ? 'cash' : 'upi',
      planId: existing.planId,
      planName: `${existing.planName} (Balance Due)`,
      durationDays: existing.durationDays,
      amountPaise: applied,
      paidDate: today,
      recordedByLabel: 'Owner',
      createdAt: now,
    });
    this.write(STORAGE_KEYS.GYM_PAYMENT_LOGS, payments);
    return hydrated;
  }

  async toggleGymMembershipFreeze(params: {
    businessId: string;
    memberId: string;
    action: GymFreezeAction;
    resumeDateOverride?: string | null;
    options?: AIConfigAccessOptions;
  }): Promise<GymMember> {
    const idErr = validateBusinessId(params.businessId);
    if (idErr) throw new Error(idErr);
    if (params.action !== 'freeze' && params.action !== 'resume') {
      throw new Error('Freeze action must be "freeze" or "resume".');
    }
    const cleanId = params.businessId.trim();
    const business = await this.getBusinessById(cleanId);
    if (!business) throw new Error(`Business with ID "${cleanId}" not found.`);
    this.assertOwnerAccess(business, params.options);

    const members = this.getOrSeedMockGymMembers();
    const idx = members.findIndex(
      (m) => m.id === params.memberId && m.businessId === cleanId,
    );
    if (idx === -1) throw new Error('Gym member not found for this business.');
    const existing = members[idx];
    if (existing.status !== 'active') {
      throw new Error('Only active memberships can be frozen or resumed.');
    }

    const today = getTodayIsoDateKey();
    const now = new Date().toISOString();
    let updated: GymMember;

    if (params.action === 'freeze') {
      if (existing.isFrozen) {
        throw new Error('Membership is already frozen.');
      }
      updated = {
        ...existing,
        isFrozen: true,
        frozenStartedAt: today,
        updatedAt: now,
      };
    } else {
      if (!existing.isFrozen) {
        throw new Error('Membership is not currently frozen.');
      }
      const resumeDate =
        params.resumeDateOverride &&
        /^\d{4}-\d{2}-\d{2}$/.test(params.resumeDateOverride.trim())
          ? params.resumeDateOverride.trim()
          : today;
      const startFreeze = existing.frozenStartedAt ?? today;
      const pausedDays = Math.max(
        1,
        diffDaysBetweenIsoDates(resumeDate, startFreeze),
      );
      const baseEnd = existing.endDate ?? today;
      updated = {
        ...existing,
        isFrozen: false,
        frozenStartedAt: null,
        endDate: addDaysToIsoDate(baseEnd, pausedDays),
        totalFrozenDays: (existing.totalFrozenDays ?? 0) + pausedDays,
        updatedAt: now,
      };
    }

    const cfgStore = this.read<Record<string, GymConfig>>(
      STORAGE_KEYS.GYM_CONFIGS,
      {},
    );
    const config = normalizeGymConfig(cleanId, cfgStore[cleanId]);
    const hydrated = this.hydrateGymMember(
      updated,
      config.renewalAlertDays,
      today,
    );
    members[idx] = hydrated;
    this.write(STORAGE_KEYS.GYM_MEMBERS, members);
    return hydrated;
  }

  async createGymTrainer(
    businessId: string,
    input: GymTrainerInput,
    options?: AIConfigAccessOptions,
  ): Promise<GymTrainer> {
    const check = validateGymTrainerInput(businessId, input);
    if (!check.ok) throw new Error(check.error);
    const cleanId = businessId.trim();
    const business = await this.getBusinessById(cleanId);
    if (!business) throw new Error(`Business with ID "${cleanId}" not found.`);
    this.assertOwnerAccess(business, options);

    const trainers = this.read<GymTrainer[]>(STORAGE_KEYS.GYM_TRAINERS, []);
    const created: GymTrainer = {
      id: `gymtr-${crypto.randomUUID()}`,
      businessId: cleanId,
      trainerName: check.value.trainerName,
      specialty: check.value.specialty,
      commissionPercent: check.value.commissionPercent,
      isActive: check.value.isActive,
      createdAt: new Date().toISOString(),
    };
    trainers.push(created);
    this.write(STORAGE_KEYS.GYM_TRAINERS, trainers);
    return created;
  }

  async deleteGymTrainer(
    businessId: string,
    trainerId: string,
    options?: AIConfigAccessOptions,
  ): Promise<void> {
    const idErr = validateBusinessId(businessId);
    if (idErr) throw new Error(idErr);
    const cleanId = businessId.trim();
    const business = await this.getBusinessById(cleanId);
    if (!business) throw new Error(`Business with ID "${cleanId}" not found.`);
    this.assertOwnerAccess(business, options);

    const trainers = this.read<GymTrainer[]>(STORAGE_KEYS.GYM_TRAINERS, []);
    this.write(
      STORAGE_KEYS.GYM_TRAINERS,
      trainers.filter((t) => !(t.businessId === cleanId && t.id === trainerId)),
    );
  }

  async getGymTrainerCommissions(
    businessId: string,
    monthKey?: string | null,
    options?: AIConfigAccessOptions,
  ): Promise<GymTrainerCommissionRow[]> {
    const idErr = validateBusinessId(businessId);
    if (idErr) throw new Error(idErr);
    const cleanId = businessId.trim();
    const business = await this.getBusinessById(cleanId);
    if (!business) throw new Error(`Business with ID "${cleanId}" not found.`);
    this.assertOwnerAccess(business, options);

    const targetMonth =
      monthKey && /^\d{4}-(0[1-9]|1[0-2])$/.test(monthKey.trim())
        ? monthKey.trim()
        : getTodayIsoDateKey().slice(0, 7);

    const trainers = this.read<GymTrainer[]>(STORAGE_KEYS.GYM_TRAINERS, []).filter(
      (t) => t.businessId === cleanId,
    );
    const members = this.getOrSeedMockGymMembers().filter(
      (m) => m.businessId === cleanId,
    );
    const logs = this.getOrSeedMockGymCheckIns().filter(
      (l) => l.businessId === cleanId && l.checkInDate.slice(0, 7) === targetMonth,
    );
    const payments = this.getOrSeedMockGymPaymentLogs().filter(
      (p) => p.businessId === cleanId && p.paidDate.slice(0, 7) === targetMonth,
    );

    return trainers.map((t) => {
      const activePtClients = members.filter(
        (m) =>
          m.ptTrainerId === t.id &&
          m.status === 'active' &&
          (m.ptRemainingSessions ?? 0) > 0,
      ).length;
      const ptSessionsDeliveredThisMonth = logs.filter(
        (l) => l.isPtSession && l.trainerId === t.id,
      ).length;
      const ptPackageRevenuePaise = payments
        .filter((p) => p.ptTrainerId === t.id)
        .reduce((sum, p) => sum + (p.ptFeePaise ?? 0), 0);
      const commissionPayoutPaise = Math.round(
        (ptPackageRevenuePaise * t.commissionPercent) / 100,
      );
      return {
        ...t,
        activePtClients,
        ptSessionsDeliveredThisMonth,
        ptPackageRevenuePaise,
        commissionPayoutPaise,
      };
    });
  }

  async logGymBodyMeasurement(
    input: GymBodyMeasurementInput,
  ): Promise<GymBodyMeasurement> {
    const check = validateGymBodyMeasurementInput(input);
    if (!check.ok) throw new Error(check.error);

    const business = await this.getBusinessBySlug(check.value.businessSlug);
    if (
      !business ||
      business.status !== 'active' ||
      business.accountState !== 'active'
    ) {
      throw new Error('Gym is not active.');
    }

    const member = this.getOrSeedMockGymMembers().find(
      (m) => m.businessId === business.id && m.phone === check.value.phone,
    );
    if (!member) {
      throw new Error('Member not found for this phone number.');
    }

    const list = this.read<GymBodyMeasurement[]>(
      STORAGE_KEYS.GYM_BODY_MEASUREMENTS,
      [],
    );
    const created: GymBodyMeasurement = {
      id: `gymbm-${crypto.randomUUID()}`,
      businessId: business.id,
      memberId: member.id,
      recordedDate: getTodayIsoDateKey(),
      weightKg: check.value.weightKg,
      waistInches: check.value.waistInches,
      chestInches: check.value.chestInches,
      bicepsInches: check.value.bicepsInches,
      bmi: check.value.bmi,
      note: check.value.note,
      createdAt: new Date().toISOString(),
    };
    list.push(created);
    this.write(STORAGE_KEYS.GYM_BODY_MEASUREMENTS, list);
    return created;
  }

  async logGymWorkoutSession(
    input: LogGymWorkoutSessionInput,
  ): Promise<GymWorkoutSession> {
    const normPhone = normalizeGymPhone(input.phone);
    const business = await this.getBusinessBySlug(input.businessSlug);
    if (
      !business ||
      business.status !== 'active' ||
      business.accountState !== 'active'
    ) {
      throw new Error('Gym is not active.');
    }
    const member = this.getOrSeedMockGymMembers().find(
      (m) => m.businessId === business.id && m.phone === normPhone,
    );
    if (!member) throw new Error('Member not found for this phone number.');

    const list = this.read<GymWorkoutSession[]>(
      STORAGE_KEYS.GYM_WORKOUT_SESSIONS,
      [],
    );
    const created: GymWorkoutSession = {
      id: `gymws-${crypto.randomUUID()}`,
      businessId: business.id,
      memberId: member.id,
      sessionDate: getTodayIsoDateKey(),
      planId: input.planId || 'ppl',
      routineName: input.routineName.trim().slice(0, 80) || 'Custom Workout',
      workoutFocus: input.workoutFocus,
      durationMinutes: Math.max(1, Math.min(360, Math.round(input.durationMinutes || 45))),
      totalVolumeKg: Math.max(0, Math.round((input.totalVolumeKg || 0) * 10) / 10),
      totalSets: Math.max(0, Math.round(input.totalSets || 0)),
      prsHitCount: Math.max(0, Math.round(input.prsHitCount || 0)),
      musclesTrained: input.musclesTrained ?? [],
      exercises: input.exercises ?? [],
      createdAt: new Date().toISOString(),
    };
    list.push(created);
    this.write(STORAGE_KEYS.GYM_WORKOUT_SESSIONS, list);
    return created;
  }

  async getGymMonthlyLeaderboard(
    businessSlug: string,
  ): Promise<GymLeaderboardEntry[]> {
    const business = await this.getBusinessBySlug(businessSlug);
    if (
      !business ||
      business.status !== 'active' ||
      business.accountState !== 'active'
    ) {
      return [];
    }
    const currMonth = getTodayIsoDateKey().slice(0, 7);
    const logs = this.getOrSeedMockGymCheckIns().filter(
      (l) => l.businessId === business.id && l.checkInDate.slice(0, 7) === currMonth,
    );
    const members = this.getOrSeedMockGymMembers().filter(
      (m) => m.businessId === business.id && m.status === 'active',
    );

    const ranked = members
      .map((m) => {
        const workoutsThisMonth = logs.filter((l) => l.memberId === m.id).length;
        return {
          memberCode: m.memberCode,
          displayName: formatPrivacySafeLeaderboardName(m.fullName),
          workoutsThisMonth,
          currentStreakDays: m.currentStreakDays ?? 0,
          bestStreakDays: m.bestStreakDays ?? 0,
          totalCheckIns: m.totalCheckIns,
        };
      })
      .filter((r) => r.workoutsThisMonth > 0 || r.currentStreakDays > 0)
      .sort(
        (a, b) =>
          b.workoutsThisMonth - a.workoutsThisMonth ||
          b.currentStreakDays - a.currentStreakDays ||
          b.totalCheckIns - a.totalCheckIns,
      )
      .slice(0, 10);

    return ranked.map((r, i) => ({
      rank: i + 1,
      memberCode: r.memberCode,
      displayName: r.displayName,
      workoutsThisMonth: r.workoutsThisMonth,
      currentStreakDays: r.currentStreakDays,
      bestStreakDays: r.bestStreakDays,
    }));
  }

  async createGymRetailProduct(
    businessId: string,
    input: GymRetailProductInput,
    options?: AIConfigAccessOptions,
  ): Promise<GymRetailProduct> {
    const check = validateGymRetailProductInput(businessId, input);
    if (!check.ok) throw new Error(check.error);
    const cleanId = businessId.trim();
    const business = await this.getBusinessById(cleanId);
    if (!business) throw new Error(`Business with ID "${cleanId}" not found.`);
    this.assertOwnerAccess(business, options);

    const products = this.read<GymRetailProduct[]>(
      STORAGE_KEYS.GYM_RETAIL_PRODUCTS,
      [],
    );
    const created: GymRetailProduct = {
      id: `gymrp-${crypto.randomUUID()}`,
      businessId: cleanId,
      productName: check.value.productName,
      pricePaise: check.value.pricePaise,
      stockQty: check.value.stockQty,
      isActive: true,
    };
    products.push(created);
    this.write(STORAGE_KEYS.GYM_RETAIL_PRODUCTS, products);
    return created;
  }

  async seedGymRetailStarterProducts(
    businessId: string,
    options?: AIConfigAccessOptions,
  ): Promise<GymRetailProduct[]> {
    const idErr = validateBusinessId(businessId);
    if (idErr) throw new Error(idErr);
    const cleanId = businessId.trim();
    const business = await this.getBusinessById(cleanId);
    if (!business) throw new Error(`Business with ID "${cleanId}" not found.`);
    this.assertOwnerAccess(business, options);

    const existing = this.read<GymRetailProduct[]>(
      STORAGE_KEYS.GYM_RETAIL_PRODUCTS,
      [],
    ).filter((p) => p.businessId === cleanId);
    const existingNames = new Set(existing.map((p) => p.productName.toLowerCase()));
    const added: GymRetailProduct[] = [];
    for (const preset of GYM_RETAIL_STARTER_PRODUCTS) {
      if (!existingNames.has(preset.productName.toLowerCase())) {
        const created = await this.createGymRetailProduct(cleanId, preset, options);
        added.push(created);
      }
    }
    return added;
  }

  async deleteGymRetailProduct(
    businessId: string,
    productId: string,
    options?: AIConfigAccessOptions,
  ): Promise<void> {
    const idErr = validateBusinessId(businessId);
    if (idErr) throw new Error(idErr);
    const cleanId = businessId.trim();
    const business = await this.getBusinessById(cleanId);
    if (!business) throw new Error(`Business with ID "${cleanId}" not found.`);
    this.assertOwnerAccess(business, options);

    const products = this.read<GymRetailProduct[]>(
      STORAGE_KEYS.GYM_RETAIL_PRODUCTS,
      [],
    );
    this.write(
      STORAGE_KEYS.GYM_RETAIL_PRODUCTS,
      products.filter((p) => !(p.businessId === cleanId && p.id === productId)),
    );
  }

  async recordGymRetailSale(params: {
    businessId: string;
    productId: string;
    quantity?: number;
    paymentMethod?: GymPaymentMethod;
    memberName?: string | null;
    options?: AIConfigAccessOptions;
  }): Promise<{ sale: GymRetailSale; product: GymRetailProduct }> {
    const idErr = validateBusinessId(params.businessId);
    if (idErr) throw new Error(idErr);
    const cleanId = params.businessId.trim();
    const business = await this.getBusinessById(cleanId);
    if (!business) throw new Error(`Business with ID "${cleanId}" not found.`);
    this.assertOwnerAccess(business, params.options);

    const products = this.read<GymRetailProduct[]>(
      STORAGE_KEYS.GYM_RETAIL_PRODUCTS,
      [],
    );
    const idx = products.findIndex(
      (p) => p.id === params.productId && p.businessId === cleanId,
    );
    if (idx === -1) throw new Error('Supplement product not found for this gym.');

    const qty = Math.max(1, Math.min(100, Math.round(params.quantity ?? 1)));
    const updatedProduct: GymRetailProduct = {
      ...products[idx],
      stockQty: Math.max(0, products[idx].stockQty - qty),
    };
    products[idx] = updatedProduct;
    this.write(STORAGE_KEYS.GYM_RETAIL_PRODUCTS, products);

    const sales = this.read<GymRetailSale[]>(STORAGE_KEYS.GYM_RETAIL_SALES, []);
    const sale: GymRetailSale = {
      id: `gymrs-${crypto.randomUUID()}`,
      businessId: cleanId,
      productId: updatedProduct.id,
      productName: updatedProduct.productName,
      quantity: qty,
      totalPaise: updatedProduct.pricePaise * qty,
      paymentMethod: params.paymentMethod === 'cash' ? 'cash' : 'upi',
      memberName: params.memberName?.trim().slice(0, 80) || null,
      soldAt: new Date().toISOString(),
    };
    sales.push(sale);
    this.write(STORAGE_KEYS.GYM_RETAIL_SALES, sales);
    return { sale, product: updatedProduct };
  }

  private applyGymExerciseMediaOverrides(
    businessId: string,
    catalog: GymCatalogExercise[],
  ): GymCatalogExercise[] {
    const overrides = this.read<
      Array<{
        businessId: string;
        exerciseKey: string;
        mediaUrl: string;
        mediaType?: string;
      }>
    >(STORAGE_KEYS.GYM_EXERCISE_MEDIA_OVERRIDES, []).filter(
      (o) => o.businessId === businessId && o.mediaUrl,
    );
    if (overrides.length === 0) return catalog;
    const byKey = new Map(
      overrides.map((o) => [o.exerciseKey.toLowerCase(), o]),
    );
    return catalog.map((ex) => {
      const ov =
        byKey.get(ex.name.trim().toLowerCase()) ||
        (ex.id ? byKey.get(ex.id.trim().toLowerCase()) : undefined);
      if (!ov) return ex;
      return {
        ...ex,
        animationGifUrl: ov.mediaUrl,
      };
    });
  }

  async getGymExerciseCatalog(
    businessId: string,
    options?: AIConfigAccessOptions,
  ): Promise<GymCatalogExercise[]> {
    const idErr = validateBusinessId(businessId);
    if (idErr) throw new Error(idErr);
    const cleanId = businessId.trim();
    const business = await this.getBusinessById(cleanId);
    if (!business) throw new Error(`Business with ID "${cleanId}" not found.`);
    this.assertOwnerAccess(business, options);

    const custom = this.read<GymCatalogExercise[]>(
      STORAGE_KEYS.GYM_CUSTOM_EXERCISES,
      [],
    ).filter((e) => e.businessId === cleanId);
    return this.applyGymExerciseMediaOverrides(cleanId, [
      ...BUILTIN_GYM_CATALOG_EXERCISES,
      ...custom,
    ]);
  }

  async ownerUpsertGymExerciseMedia(
    input: OwnerUpsertExerciseMediaInput,
    options?: AIConfigAccessOptions,
  ): Promise<{ exerciseKey: string; mediaUrl: string; mediaType?: string }> {
    const idErr = validateBusinessId(input.businessId);
    if (idErr) throw new Error(idErr);
    const cleanId = input.businessId.trim();
    const business = await this.getBusinessById(cleanId);
    if (!business) throw new Error(`Business with ID "${cleanId}" not found.`);
    this.assertOwnerAccess(business, options);

    const exerciseKey = (input.exerciseKey || '').trim().toLowerCase().slice(0, 120);
    if (!exerciseKey) {
      throw new Error('Exercise name or key is required.');
    }
    const cleanUrl = sanitizeGymMediaUrl(input.mediaUrl);
    const store = this.read<
      Array<{
        businessId: string;
        exerciseKey: string;
        mediaUrl: string;
        mediaType?: string;
        updatedAt: string;
      }>
    >(STORAGE_KEYS.GYM_EXERCISE_MEDIA_OVERRIDES, []);

    const filtered = store.filter(
      (item) =>
        !(
          item.businessId === cleanId &&
          item.exerciseKey.toLowerCase() === exerciseKey
        ),
    );
    if (cleanUrl) {
      const detectedType =
        input.mediaType ??
        (/\.(mp4|webm|mov)(\?|#|$)/i.test(cleanUrl)
          ? 'video'
          : /\.(gif)(\?|#|$)|^data:image\/gif/i.test(cleanUrl)
            ? 'gif'
            : 'image');
      filtered.push({
        businessId: cleanId,
        exerciseKey,
        mediaUrl: cleanUrl,
        mediaType: detectedType,
        updatedAt: new Date().toISOString(),
      });
      this.write(STORAGE_KEYS.GYM_EXERCISE_MEDIA_OVERRIDES, filtered);
      return {
        exerciseKey,
        mediaUrl: cleanUrl,
        mediaType: detectedType,
      };
    }

    this.write(STORAGE_KEYS.GYM_EXERCISE_MEDIA_OVERRIDES, filtered);
    return { exerciseKey, mediaUrl: '', mediaType: undefined };
  }

  async createGymCustomExercise(
    businessId: string,
    input: GymCatalogExerciseInput,
    options?: AIConfigAccessOptions,
  ): Promise<GymCatalogExercise> {
    const idErr = validateBusinessId(businessId);
    if (idErr) throw new Error(idErr);
    const cleanName = (input.name ?? '').trim().slice(0, 100);
    if (cleanName.length < 2) {
      throw new Error('Exercise name must be at least 2 characters.');
    }
    const cleanId = businessId.trim();
    const business = await this.getBusinessById(cleanId);
    if (!business) throw new Error(`Business with ID "${cleanId}" not found.`);
    this.assertOwnerAccess(business, options);

    const list = this.read<GymCatalogExercise[]>(
      STORAGE_KEYS.GYM_CUSTOM_EXERCISES,
      [],
    );
    const created: GymCatalogExercise = {
      id: `gymex-${crypto.randomUUID()}`,
      businessId: cleanId,
      name: cleanName,
      muscleGroup: input.muscleGroup,
      equipment: input.equipment,
      defaultSets: Math.max(1, Math.min(10, Math.round(input.defaultSets ?? 3))),
      defaultReps: (input.defaultReps ?? '10-12').trim().slice(0, 24) || '10-12',
      restSeconds: Math.max(15, Math.min(300, Math.round(input.restSeconds ?? 60))),
    };
    list.push(created);
    this.write(STORAGE_KEYS.GYM_CUSTOM_EXERCISES, list);
    return created;
  }

  async createOrAssignGymRoutine(params: {
    businessId: string;
    routineName: string;
    targetGoal?: string;
    exercises: GymRoutineExerciseItem[];
    assignToMemberId?: string | null;
    createdBy?: string;
    options?: AIConfigAccessOptions;
  }): Promise<GymWorkoutRoutine> {
    const idErr = validateBusinessId(params.businessId);
    if (idErr) throw new Error(idErr);
    const cleanName = (params.routineName ?? '').trim().slice(0, 100);
    if (cleanName.length < 2) {
      throw new Error('Routine name must be at least 2 characters.');
    }
    const cleanId = params.businessId.trim();
    const business = await this.getBusinessById(cleanId);
    if (!business) throw new Error(`Business with ID "${cleanId}" not found.`);
    this.assertOwnerAccess(business, params.options);

    const routines = this.read<GymWorkoutRoutine[]>(
      STORAGE_KEYS.GYM_WORKOUT_ROUTINES,
      [],
    );
    const created: GymWorkoutRoutine = {
      id: `gymrt-${crypto.randomUUID()}`,
      businessId: cleanId,
      routineName: cleanName,
      targetGoal: params.targetGoal?.trim() || 'general_fitness',
      exercises: Array.isArray(params.exercises) ? params.exercises : [],
      createdBy: params.createdBy?.trim().slice(0, 80) || 'Owner',
      createdAt: new Date().toISOString(),
    };
    routines.push(created);
    this.write(STORAGE_KEYS.GYM_WORKOUT_ROUTINES, routines);

    if (params.assignToMemberId) {
      await this.assignGymRoutineToMember({
        businessId: cleanId,
        memberId: params.assignToMemberId,
        routineId: created.id,
        options: params.options,
      });
    }

    return created;
  }

  async assignGymRoutineToMember(params: {
    businessId: string;
    memberId: string;
    routineId: string | null;
    options?: AIConfigAccessOptions;
  }): Promise<GymMember> {
    const idErr = validateBusinessId(params.businessId);
    if (idErr) throw new Error(idErr);
    const cleanId = params.businessId.trim();
    const business = await this.getBusinessById(cleanId);
    if (!business) throw new Error(`Business with ID "${cleanId}" not found.`);
    this.assertOwnerAccess(business, params.options);

    const members = this.getOrSeedMockGymMembers();
    const idx = members.findIndex(
      (m) => m.id === params.memberId && m.businessId === cleanId,
    );
    if (idx === -1) throw new Error('Gym member not found for this business.');

    if (params.routineId) {
      const routines = this.read<GymWorkoutRoutine[]>(
        STORAGE_KEYS.GYM_WORKOUT_ROUTINES,
        [],
      );
      if (!routines.some((r) => r.id === params.routineId && r.businessId === cleanId)) {
        throw new Error('Workout routine not found for this gym.');
      }
    }

    const updated: GymMember = {
      ...members[idx],
      assignedRoutineId: params.routineId,
      updatedAt: new Date().toISOString(),
    };
    const cfgStore = this.read<Record<string, GymConfig>>(
      STORAGE_KEYS.GYM_CONFIGS,
      {},
    );
    const config = normalizeGymConfig(cleanId, cfgStore[cleanId]);
    const hydrated = this.hydrateGymMember(
      updated,
      config.renewalAlertDays,
      getTodayIsoDateKey(),
    );
    members[idx] = hydrated;
    this.write(STORAGE_KEYS.GYM_MEMBERS, members);
    return hydrated;
  }

  async getGymMemberWorkoutPlan(params: {
    businessSlug: string;
    memberId: string;
  }): Promise<GymMemberWorkoutPlanPayload | null> {
    const business = await this.getBusinessBySlug(params.businessSlug);
    if (
      !business ||
      business.status !== 'active' ||
      business.accountState !== 'active'
    ) {
      return null;
    }
    const member = this.getOrSeedMockGymMembers().find(
      (m) => m.businessId === business.id && m.id === params.memberId,
    );
    if (!member) return null;

    const assignedRoutine = member.assignedRoutineId
      ? (this.read<GymWorkoutRoutine[]>(
          STORAGE_KEYS.GYM_WORKOUT_ROUTINES,
          [],
        ).find(
          (r) => r.id === member.assignedRoutineId && r.businessId === business.id,
        ) ?? null)
      : null;

    const customExercises = this.read<GymCatalogExercise[]>(
      STORAGE_KEYS.GYM_CUSTOM_EXERCISES,
      [],
    ).filter((e) => e.businessId === business.id);
    const exerciseCatalog = this.applyGymExerciseMediaOverrides(business.id, [
      ...BUILTIN_GYM_CATALOG_EXERCISES,
      ...customExercises,
    ]);

    const today = getTodayIsoDateKey();
    const weekStart = addDaysToIsoDate(today, -6);
    const memberSets = this.read<GymWorkoutSetRecord[]>(
      STORAGE_KEYS.GYM_WORKOUT_SET_LOGS,
      [],
    ).filter((l) => l.businessId === business.id && l.memberId === member.id);

    const todaySets = memberSets
      .filter((l) => l.workoutDate === today)
      .sort((a, b) => a.loggedAt.localeCompare(b.loggedAt));

    const weeklyVolumeKg =
      Math.round(
        memberSets
          .filter((l) => l.workoutDate >= weekStart)
          .reduce((sum, l) => sum + l.weightKg * l.reps, 0) * 10,
      ) / 10;

    const prMap = new Map<string, GymPersonalRecordRow>();
    for (const s of memberSets) {
      const key = s.exerciseName.toLowerCase();
      const curr = prMap.get(key);
      if (
        !curr ||
        s.estimated1rmKg > curr.best1rmKg ||
        s.weightKg > curr.bestWeightKg
      ) {
        prMap.set(key, {
          exerciseName: s.exerciseName,
          muscleGroup: s.muscleGroup,
          bestWeightKg: Math.max(curr?.bestWeightKg ?? 0, s.weightKg),
          best1rmKg: Math.max(curr?.best1rmKg ?? 0, s.estimated1rmKg),
          lastDate: s.workoutDate,
        });
      }
    }

    return {
      assignedRoutine,
      exerciseCatalog,
      todaySets,
      personalRecords: Array.from(prMap.values()).sort(
        (a, b) => b.best1rmKg - a.best1rmKg,
      ),
      weeklyVolumeKg,
    };
  }

  async logGymMemberWorkoutSet(params: {
    businessSlug: string;
    memberId: string;
    exerciseId?: string | null;
    exerciseName: string;
    muscleGroup: string;
    setNumber: number;
    weightKg: number;
    reps: number;
  }): Promise<GymLogSetResult> {
    const cleanExName = (params.exerciseName ?? '').trim().slice(0, 100);
    if (cleanExName.length < 2) throw new Error('Exercise name is required.');

    const business = await this.getBusinessBySlug(params.businessSlug);
    if (
      !business ||
      business.status !== 'active' ||
      business.accountState !== 'active'
    ) {
      throw new Error('Gym is not active.');
    }

    const member = this.getOrSeedMockGymMembers().find(
      (m) => m.businessId === business.id && m.id === params.memberId,
    );
    if (!member) throw new Error('Gym member not found.');
    if (member.isFrozen) {
      throw new Error(
        'Membership is currently paused — ask front desk to resume.',
      );
    }
    const today = getTodayIsoDateKey();
    if (
      member.status !== 'active' ||
      (member.endDate !== null && member.endDate < today)
    ) {
      throw new Error('Active membership is required to log workout sets.');
    }

    const weightKg = Math.max(0, Math.min(1000, Math.round(params.weightKg * 100) / 100));
    const reps = Math.max(1, Math.min(200, Math.round(params.reps)));
    const setNumber = Math.max(1, Math.min(20, Math.round(params.setNumber)));
    const estimated1rmKg = Math.round(calculateEpley1RM(weightKg, reps) * 100) / 100;

    const allSets = this.read<GymWorkoutSetRecord[]>(
      STORAGE_KEYS.GYM_WORKOUT_SET_LOGS,
      [],
    );
    const priorForEx = allSets.filter(
      (l) =>
        l.businessId === business.id &&
        l.memberId === member.id &&
        l.exerciseName.toLowerCase() === cleanExName.toLowerCase(),
    );
    const prevBestWt = priorForEx.reduce((m, s) => Math.max(m, s.weightKg), 0);
    const prevBest1rm = priorForEx.reduce(
      (m, s) => Math.max(m, s.estimated1rmKg),
      0,
    );
    const isPersonalRecord =
      weightKg > 0 &&
      (priorForEx.length === 0 ||
        weightKg > prevBestWt ||
        estimated1rmKg > prevBest1rm);

    const validMuscles: readonly GymCatalogMuscleGroup[] = [
      'chest',
      'back',
      'legs',
      'shoulders',
      'arms',
      'core',
      'cardio',
      'full_body',
    ];
    const muscleGroup: GymCatalogMuscleGroup = validMuscles.includes(
      params.muscleGroup as GymCatalogMuscleGroup,
    )
      ? (params.muscleGroup as GymCatalogMuscleGroup)
      : 'full_body';

    const created: GymWorkoutSetRecord = {
      id: `gymset-${crypto.randomUUID()}`,
      businessId: business.id,
      memberId: member.id,
      exerciseId: params.exerciseId ?? null,
      exerciseName: cleanExName,
      muscleGroup,
      workoutDate: today,
      setNumber,
      weightKg,
      reps,
      estimated1rmKg,
      isPersonalRecord,
      loggedAt: new Date().toISOString(),
    };
    allSets.push(created);
    this.write(STORAGE_KEYS.GYM_WORKOUT_SET_LOGS, allSets);

    if (isPersonalRecord) {
      const messages = this.read<GymCommunityMessage[]>(
        STORAGE_KEYS.GYM_COMMUNITY_MESSAGES,
        [],
      );
      const cleanSender = member.fullName
        .trim()
        .split(/\s+/)
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(' ');
      messages.push({
        id: `gymmsg-${crypto.randomUUID()}`,
        businessId: business.id,
        memberId: member.id,
        senderName: cleanSender,
        senderCode: member.memberCode,
        messageType: 'pr_celebration',
        messageText: `🏆 ${cleanSender} hit a new Personal Record: ${cleanExName} — ${weightKg} kg × ${reps}!`,
        createdAt: new Date().toISOString(),
      });
      this.write(STORAGE_KEYS.GYM_COMMUNITY_MESSAGES, messages);
    }

    const totalVolumeTodayKg =
      Math.round(
        allSets
          .filter(
            (l) =>
              l.businessId === business.id &&
              l.memberId === member.id &&
              l.workoutDate === today,
          )
          .reduce((sum, l) => sum + l.weightKg * l.reps, 0) * 10,
      ) / 10;

    return {
      setLog: created,
      isPersonalRecord,
      totalVolumeTodayKg,
    };
  }

  async getGymMemberWorkoutSummary(params: {
    businessId: string;
    memberId: string;
    options?: AIConfigAccessOptions;
  }): Promise<GymMemberWorkoutSummaryPayload> {
    const idErr = validateBusinessId(params.businessId);
    if (idErr) throw new Error(idErr);
    const cleanId = params.businessId.trim();
    const business = await this.getBusinessById(cleanId);
    if (!business) throw new Error(`Business with ID "${cleanId}" not found.`);
    this.assertOwnerAccess(business, params.options);

    const member = this.getOrSeedMockGymMembers().find(
      (m) => m.businessId === cleanId && m.id === params.memberId,
    );
    if (!member) throw new Error('Gym member not found for this business.');

    const sets = this.read<GymWorkoutSetRecord[]>(
      STORAGE_KEYS.GYM_WORKOUT_SET_LOGS,
      [],
    )
      .filter((l) => l.businessId === cleanId && l.memberId === member.id)
      .sort((a, b) => b.loggedAt.localeCompare(a.loggedAt));

    const totalVolumeKg =
      Math.round(
        sets.reduce((sum, l) => sum + l.weightKg * l.reps, 0) * 10,
      ) / 10;

    const prMap = new Map<string, GymPersonalRecordRow>();
    for (const s of sets) {
      const key = s.exerciseName.toLowerCase();
      const curr = prMap.get(key);
      if (
        !curr ||
        s.estimated1rmKg > curr.best1rmKg ||
        s.weightKg > curr.bestWeightKg
      ) {
        prMap.set(key, {
          exerciseName: s.exerciseName,
          muscleGroup: s.muscleGroup,
          bestWeightKg: Math.max(curr?.bestWeightKg ?? 0, s.weightKg),
          best1rmKg: Math.max(curr?.best1rmKg ?? 0, s.estimated1rmKg),
          lastDate: s.workoutDate,
        });
      }
    }

    return {
      memberId: member.id,
      assignedRoutineId: member.assignedRoutineId ?? null,
      totalVolumeKg,
      personalRecords: Array.from(prMap.values()).sort(
        (a, b) => b.best1rmKg - a.best1rmKg,
      ),
      recentSets: sets.slice(0, 80),
    };
  }

  async upsertAndApproveGymCoachPlan(
    input: UpsertGymCoachPlanInput,
    options?: AIConfigAccessOptions,
  ): Promise<GymCoachPlan> {
    const idErr = validateBusinessId(input.businessId);
    if (idErr) throw new Error(idErr);
    const cleanId = input.businessId.trim();
    const business = await this.getBusinessById(cleanId);
    if (!business) throw new Error(`Business with ID "${cleanId}" not found.`);
    this.assertOwnerAccess(business, options);

    const members = this.getOrSeedMockGymMembers();
    const idx = members.findIndex(
      (m) => m.businessId === cleanId && m.id === input.memberId,
    );
    if (idx === -1) throw new Error('Gym member not found in this business.');

    let trainerName: string | null = null;
    if (input.trainerId) {
      const trainers = this.read<GymTrainer[]>(STORAGE_KEYS.GYM_TRAINERS, []);
      const t = trainers.find(
        (tr: GymTrainer) => tr.businessId === cleanId && tr.id === input.trainerId,
      );
      if (t) trainerName = t.trainerName;
    }

    const now = new Date().toISOString();
    const allPlans = this.read<GymCoachPlan[]>(
      STORAGE_KEYS.GYM_MEMBER_COACH_PLANS,
      [],
    );
    const existingIdx = allPlans.findIndex(
      (p) => p.businessId === cleanId && p.memberId === input.memberId,
    );

    const plan: GymCoachPlan = {
      id: existingIdx >= 0 ? allPlans[existingIdx].id : `gymcp-${crypto.randomUUID()}`,
      businessId: cleanId,
      memberId: input.memberId,
      trainerId: trainerName ? (input.trainerId ?? null) : null,
      trainerName,
      planTitle:
        (input.planTitle || 'Personalized Transformation Plan').trim().slice(0, 120),
      scheduleMode: input.scheduleMode === 'rotation' ? 'rotation' : 'fixed_week',
      weeklySchedule: Array.isArray(input.weeklySchedule)
        ? input.weeklySchedule
        : [],
      dailyCaloriesKcal: Math.max(800, Math.min(8000, Math.round(input.dailyCaloriesKcal || 2200))),
      proteinGrams: Math.max(20, Math.min(500, Math.round(input.proteinGrams || 140))),
      carbsGrams: Math.max(0, Math.min(1000, Math.round(input.carbsGrams || 230))),
      fatsGrams: Math.max(10, Math.min(300, Math.round(input.fatsGrams || 65))),
      waterLiters: Math.max(0.5, Math.min(12, Math.round((input.waterLiters || 3.5) * 10) / 10)),
      nutritionMeals: Array.isArray(input.nutritionMeals)
        ? input.nutritionMeals
        : [],
      supplementNotes: input.supplementNotes?.trim() || null,
      coachNotes: input.coachNotes?.trim() || null,
      approvalStatus: 'approved',
      approvedBy:
        input.approvedBy?.trim() || trainerName || 'Coach',
      approvedAt: now,
      updatedAt: now,
    };

    if (existingIdx >= 0) {
      allPlans[existingIdx] = plan;
    } else {
      allPlans.push(plan);
    }
    this.write(STORAGE_KEYS.GYM_MEMBER_COACH_PLANS, allPlans);

    if (trainerName || plan.coachNotes) {
      members[idx] = {
        ...members[idx],
        ...(trainerName
          ? { ptTrainerId: plan.trainerId, ptTrainerName: trainerName }
          : {}),
        ...(plan.coachNotes ? { trainerNotes: plan.coachNotes } : {}),
        updatedAt: now,
      };
      this.write(STORAGE_KEYS.GYM_MEMBERS, members);
    }

    return plan;
  }

  async getGymMemberCoachPlanForOwner(params: {
    businessId: string;
    memberId: string;
    options?: AIConfigAccessOptions;
  }): Promise<GymCoachPlan | null> {
    const idErr = validateBusinessId(params.businessId);
    if (idErr) throw new Error(idErr);
    const cleanId = params.businessId.trim();
    const business = await this.getBusinessById(cleanId);
    if (!business) throw new Error(`Business with ID "${cleanId}" not found.`);
    this.assertOwnerAccess(business, params.options);

    const allPlans = this.read<GymCoachPlan[]>(
      STORAGE_KEYS.GYM_MEMBER_COACH_PLANS,
      [],
    );
    return (
      allPlans.find(
        (p) => p.businessId === cleanId && p.memberId === params.memberId,
      ) ?? null
    );
  }

  async getGymMemberAthleteHub(params: {
    businessSlug: string;
    memberId: string;
  }): Promise<GymMemberAthleteHubPayload | null> {
    const business = await this.getBusinessBySlug(params.businessSlug);
    if (!business || business.status !== 'active') return null;

    const member = this.getOrSeedMockGymMembers().find(
      (m) => m.businessId === business.id && m.id === params.memberId,
    );
    if (!member) return null;

    const todayIso = getTodayIsoDateKey();
    const monthPrefix = todayIso.slice(0, 7);

    const coachPlan =
      this.read<GymCoachPlan[]>(STORAGE_KEYS.GYM_MEMBER_COACH_PLANS, []).find(
        (p) => p.businessId === business.id && p.memberId === member.id,
      ) ?? null;

    const sets = this.read<GymWorkoutSetRecord[]>(
      STORAGE_KEYS.GYM_WORKOUT_SET_LOGS,
      [],
    ).filter((s) => s.businessId === business.id && s.memberId === member.id);

    const totalVolumeLiftedKg = Math.round(
      sets.reduce((sum, s) => sum + s.weightKg * s.reps, 0),
    );
    const volumeThisMonthKg = Math.round(
      sets
        .filter((s) => s.workoutDate.startsWith(monthPrefix))
        .reduce((sum, s) => sum + s.weightKg * s.reps, 0),
    );

    const checkIns = this.read<GymAttendanceLog[]>(
      STORAGE_KEYS.GYM_CHECK_INS,
      [],
    ).filter((c) => c.businessId === business.id && c.memberId === member.id);
    const workoutsThisMonth = checkIns.filter((c) =>
      c.checkInDate.startsWith(monthPrefix),
    ).length;

    const weightCheckInsThisMonth = this.read<GymBodyMeasurement[]>(
      STORAGE_KEYS.GYM_BODY_MEASUREMENTS,
      [],
    ).filter(
      (bm) =>
        bm.businessId === business.id &&
        bm.memberId === member.id &&
        bm.recordedDate.startsWith(monthPrefix),
    ).length;

    // Smart recovery insight
    const backSets = sets
      .filter((s) => s.muscleGroup === 'back')
      .sort((a, b) => b.workoutDate.localeCompare(a.workoutDate));
    const legsSets = sets
      .filter((s) => s.muscleGroup === 'legs')
      .sort((a, b) => b.workoutDate.localeCompare(a.workoutDate));

    let recoveryInsight = {
      muscleGroup: 'full_body',
      message:
        'All major muscle groups are primed. Ready to push hard today!',
    };
    const backDaysAgo = backSets[0]
      ? diffDaysBetweenIsoDates(backSets[0].workoutDate, todayIso)
      : null;
    const legsDaysAgo = legsSets[0]
      ? diffDaysBetweenIsoDates(legsSets[0].workoutDate, todayIso)
      : null;

    if (backDaysAgo === null || backDaysAgo >= 5) {
      recoveryInsight = {
        muscleGroup: 'back',
        message:
          backDaysAgo === null
            ? "Your back hasn't had tracked work yet — today's Pull session takes care of that."
            : `Your back hasn't had any work in ${backDaysAgo} days. Today's plan takes care of that.`,
      };
    } else if (legsDaysAgo === null || legsDaysAgo >= 5) {
      recoveryInsight = {
        muscleGroup: 'legs',
        message:
          legsDaysAgo === null
            ? 'Your legs are fresh — great day for squats or leg press.'
            : `Your legs haven't had any work in ${legsDaysAgo} days. Ready for heavy lower-body work.`,
      };
    }

    // Last session summary per exercise (strictly before todayIso)
    const pastByExercise = new Map<string, GymWorkoutSetRecord[]>();
    for (const s of sets) {
      if (s.workoutDate >= todayIso) continue;
      const arr = pastByExercise.get(s.exerciseName) ?? [];
      arr.push(s);
      pastByExercise.set(s.exerciseName, arr);
    }

    const lastSessionByExercise: Record<string, GymExerciseLastSession> = {};
    for (const [exName, exSets] of pastByExercise.entries()) {
      const sortedDates = exSets
        .map((s) => s.workoutDate)
        .sort((a, b) => b.localeCompare(a));
      const latestDate = sortedDates[0];
      const sessionSets = exSets
        .filter((s) => s.workoutDate === latestDate)
        .sort((a, b) => a.setNumber - b.setNumber);
      const best = sessionSets.reduce(
        (acc, s) => (s.weightKg > acc.weightKg ? s : acc),
        sessionSets[0],
      );
      lastSessionByExercise[exName] = {
        exerciseName: exName,
        summary: sessionSets.map((s) => `${s.weightKg}×${s.reps}`).join(', '),
        bestWeightKg: best.weightKg,
        repsAtBest: best.reps,
        lastDate: latestDate,
      };
    }

    // Personal records
    const prMap = new Map<string, GymPersonalRecordRow>();
    for (const s of sets) {
      const key = s.exerciseName.toLowerCase();
      const curr = prMap.get(key);
      if (
        !curr ||
        s.estimated1rmKg > curr.best1rmKg ||
        s.weightKg > curr.bestWeightKg
      ) {
        prMap.set(key, {
          exerciseName: s.exerciseName,
          muscleGroup: s.muscleGroup,
          bestWeightKg: Math.max(curr?.bestWeightKg ?? 0, s.weightKg),
          best1rmKg: Math.max(curr?.best1rmKg ?? 0, s.estimated1rmKg),
          lastDate: s.workoutDate,
        });
      }
    }

    const customExercises = this.read<GymCatalogExercise[]>(
      STORAGE_KEYS.GYM_CUSTOM_EXERCISES,
      [],
    ).filter((e) => e.businessId === business.id);

    const trainers = this.read<GymTrainer[]>(STORAGE_KEYS.GYM_TRAINERS, []).filter(
      (t) => t.businessId === business.id,
    );
    const assignedTrainer = member.ptTrainerId
      ? trainers.find((t) => t.id === member.ptTrainerId) ?? null
      : null;

    const streak = member.currentStreakDays ?? 0;

    return {
      memberId: member.id,
      weekStreakCount: streak > 0 ? Math.max(1, Math.floor(streak / 7)) : 0,
      totalVolumeLiftedKg,
      totalWorkoutsCount: member.totalCheckIns,
      workoutsThisMonth,
      monthlyWorkoutTarget: 16,
      volumeThisMonthKg,
      monthlyVolumeTargetKg: 25000,
      weightCheckInsThisMonth,
      preferredShift: normalizeGymPreferredShift(member.preferredShift),
      ptTrainerName: member.ptTrainerName ?? assignedTrainer?.trainerName ?? null,
      ptTrainerSpecialty: assignedTrainer?.specialty ?? null,
      ptRemainingSessions: member.ptRemainingSessions ?? 0,
      ptTotalSessions: member.ptTotalSessions ?? 0,
      coachPlan,
      recoveryInsight,
      lastSessionByExercise,
      personalRecords: Array.from(prMap.values()).sort(
        (a, b) => b.best1rmKg - a.best1rmKg,
      ),
      exerciseCatalog: this.applyGymExerciseMediaOverrides(business.id, [
        ...BUILTIN_GYM_CATALOG_EXERCISES,
        ...customExercises,
      ]),
    };
  }

  async updateGymMemberSelfPlan(
    input: UpdateMemberSelfPlanInput,
  ): Promise<GymCoachPlan> {
    const business = await this.getBusinessBySlug(input.businessSlug);
    if (!business || business.status !== 'active') {
      throw new Error('Gym portal is not active.');
    }

    const members = this.getOrSeedMockGymMembers();
    const member = members.find(
      (m) => m.businessId === business.id && m.id === input.memberId,
    );
    if (!member || member.status !== 'active') {
      throw new Error('Active gym membership required to customize your split.');
    }

    const now = new Date().toISOString();
    const allPlans = this.read<GymCoachPlan[]>(
      STORAGE_KEYS.GYM_MEMBER_COACH_PLANS,
      [],
    );
    const existingIdx = allPlans.findIndex(
      (p) => p.businessId === business.id && p.memberId === member.id,
    );
    const existing = existingIdx >= 0 ? allPlans[existingIdx] : null;

    const updated: GymCoachPlan = {
      id: existing?.id ?? `gymcp-${crypto.randomUUID()}`,
      businessId: business.id,
      memberId: member.id,
      trainerId: existing?.trainerId ?? member.ptTrainerId ?? null,
      trainerName: existing?.trainerName ?? member.ptTrainerName ?? null,
      planTitle:
        (input.planTitle || existing?.planTitle || 'My Custom Training Split')
          .trim()
          .slice(0, 120),
      scheduleMode:
        input.scheduleMode === 'rotation'
          ? 'rotation'
          : (input.scheduleMode === 'fixed_week'
              ? 'fixed_week'
              : (existing?.scheduleMode ?? 'fixed_week')),
      weeklySchedule: Array.isArray(input.weeklySchedule)
        ? input.weeklySchedule
        : (existing?.weeklySchedule ?? []),
      dailyCaloriesKcal: existing?.dailyCaloriesKcal ?? 2200,
      proteinGrams: existing?.proteinGrams ?? 140,
      carbsGrams: existing?.carbsGrams ?? 230,
      fatsGrams: existing?.fatsGrams ?? 65,
      waterLiters: existing?.waterLiters ?? 3.5,
      nutritionMeals: existing?.nutritionMeals ?? [],
      supplementNotes: existing?.supplementNotes ?? null,
      coachNotes: existing?.coachNotes ?? null,
      approvalStatus: existing?.approvalStatus ?? 'approved',
      approvedBy:
        existing?.approvalStatus === 'approved'
          ? (existing?.approvedBy ?? null)
          : `${member.fullName} (Self)`,
      approvedAt: existing?.approvedAt ?? now,
      updatedAt: now,
    };

    if (existingIdx >= 0) {
      allPlans[existingIdx] = updated;
    } else {
      allPlans.push(updated);
    }
    this.write(STORAGE_KEYS.GYM_MEMBER_COACH_PLANS, allPlans);
    return updated;
  }

  async updateGymMemberPreferredShift(params: {
    businessSlug: string;
    memberId: string;
    preferredShift: GymPreferredShift;
  }): Promise<GymMember> {
    const business = await this.getBusinessBySlug(params.businessSlug);
    if (!business || business.status !== 'active') {
      throw new Error('Gym portal is not active.');
    }

    const store = this.read<Record<string, GymConfig>>(
      STORAGE_KEYS.GYM_CONFIGS,
      {},
    );
    const config = normalizeGymConfig(business.id, store[business.id]);
    const members = this.getOrSeedMockGymMembers();
    const idx = members.findIndex(
      (m) => m.businessId === business.id && m.id === params.memberId,
    );
    if (idx === -1) {
      throw new Error('Member not found for this gym.');
    }

    const updatedRecord: GymMember = {
      ...members[idx],
      preferredShift: normalizeGymPreferredShift(params.preferredShift),
      updatedAt: new Date().toISOString(),
    };
    const hydrated = this.hydrateGymMember(
      updatedRecord,
      config.renewalAlertDays,
      getTodayIsoDateKey(),
    );
    members[idx] = hydrated;
    this.write(STORAGE_KEYS.GYM_MEMBERS, members);
    return hydrated;
  }

  async getGymMembersCommunityHub(params: {
    businessSlug: string;
    requesterMemberId: string;
  }): Promise<GymMembersCommunityHubPayload> {
    const business = await this.getBusinessBySlug(params.businessSlug);
    if (!business || business.status !== 'active') {
      throw new Error('Gym portal is not active.');
    }

    const allMembers = this.getOrSeedMockGymMembers();
    const requester = allMembers.find(
      (m) => m.businessId === business.id && m.id === params.requesterMemberId,
    );
    if (!requester) {
      throw new Error('Unauthorized: requester does not belong to this gym.');
    }

    const todayIso = getTodayIsoDateKey();
    const monthPrefix = todayIso.slice(0, 7);
    const checkIns = this.read<GymAttendanceLog[]>(
      STORAGE_KEYS.GYM_CHECK_INS,
      [],
    ).filter((c) => c.businessId === business.id);

    const membersDirectory: GymDirectoryMemberEntry[] = allMembers
      .filter((m) => m.businessId === business.id && m.status === 'active')
      .map((m) => {
        const myCheckIns = checkIns.filter((c) => c.memberId === m.id);
        const todayCi = myCheckIns
          .filter((c) => c.checkInDate === todayIso)
          .sort((a, b) => b.checkedInAt.localeCompare(a.checkedInAt))[0];
        const workoutsThisMonth = myCheckIns.filter((c) =>
          c.checkInDate.startsWith(monthPrefix),
        ).length;
        const cleanName = m.fullName
          .trim()
          .split(/\s+/)
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
          .join(' ');
        return {
          id: m.id,
          fullName: cleanName,
          memberCode: m.memberCode,
          fitnessGoal: m.fitnessGoal,
          currentStreakDays: m.currentStreakDays ?? 0,
          workoutsThisMonth,
          isCheckedInToday: Boolean(todayCi),
          todayWorkoutFocus: todayCi?.workoutFocus ?? null,
          isFrozen: Boolean(m.isFrozen),
        };
      })
      .sort((a, b) => {
        if (a.isCheckedInToday !== b.isCheckedInToday) {
          return a.isCheckedInToday ? -1 : 1;
        }
        if (b.workoutsThisMonth !== a.workoutsThisMonth) {
          return b.workoutsThisMonth - a.workoutsThisMonth;
        }
        return b.currentStreakDays - a.currentStreakDays;
      });

    const chatMessages = this.read<GymCommunityMessage[]>(
      STORAGE_KEYS.GYM_COMMUNITY_MESSAGES,
      [],
    )
      .filter((msg) => msg.businessId === business.id)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .slice(-60);

    return {
      membersDirectory,
      chatMessages,
    };
  }

  async sendGymCommunityMessage(params: {
    businessSlug: string;
    memberId: string;
    messageText: string;
    messageType?: GymCommunityMessageType;
  }): Promise<GymCommunityMessage> {
    const cleanText = (params.messageText || '').trim().slice(0, 500);
    if (!cleanText) {
      throw new Error('Message cannot be empty.');
    }

    const business = await this.getBusinessBySlug(params.businessSlug);
    if (!business || business.status !== 'active') {
      throw new Error('Gym portal is not active.');
    }

    const member = this.getOrSeedMockGymMembers().find(
      (m) => m.businessId === business.id && m.id === params.memberId,
    );
    if (!member || member.status !== 'active') {
      throw new Error(
        'Active gym membership required to post in community chat.',
      );
    }

    const cleanSender = member.fullName
      .trim()
      .split(/\s+/)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ');

    const created: GymCommunityMessage = {
      id: `gymmsg-${crypto.randomUUID()}`,
      businessId: business.id,
      memberId: member.id,
      senderName: cleanSender,
      senderCode: member.memberCode,
      messageType: params.messageType ?? 'chat',
      messageText: cleanText,
      createdAt: new Date().toISOString(),
    };

    const messages = this.read<GymCommunityMessage[]>(
      STORAGE_KEYS.GYM_COMMUNITY_MESSAGES,
      [],
    );
    messages.push(created);
    this.write(STORAGE_KEYS.GYM_COMMUNITY_MESSAGES, messages);

    return created;
  }

  async memberCreateCustomGymExercise(
    input: MemberCreateCustomExerciseInput,
  ): Promise<GymCatalogExercise> {
    const cleanName = (input.name || '').trim().slice(0, 80);
    if (cleanName.length < 2) {
      throw new Error('Exercise name must be at least 2 characters.');
    }

    const business = await this.getBusinessBySlug(input.businessSlug);
    if (!business || business.status !== 'active') {
      throw new Error('Gym portal is not active.');
    }

    const member = this.getOrSeedMockGymMembers().find(
      (m) => m.businessId === business.id && m.id === input.memberId,
    );
    if (!member || member.status !== 'active') {
      throw new Error(
        'Active gym membership required to add custom exercises.',
      );
    }

    const validMuscles: GymCatalogMuscleGroup[] = [
      'chest',
      'back',
      'legs',
      'shoulders',
      'arms',
      'core',
      'cardio',
      'full_body',
    ];
    const muscleGroup: GymCatalogMuscleGroup = validMuscles.includes(
      input.muscleGroup,
    )
      ? input.muscleGroup
      : 'full_body';

    const validEquip: GymCatalogEquipment[] = [
      'barbell',
      'dumbbell',
      'machine',
      'cable',
      'bodyweight',
      'cardio_machine',
    ];
    const equipment: GymCatalogEquipment = validEquip.includes(input.equipment)
      ? input.equipment
      : 'dumbbell';

    const created: GymCatalogExercise = {
      id: `gymex-${crypto.randomUUID()}`,
      businessId: business.id,
      name: cleanName,
      muscleGroup,
      equipment,
      defaultSets: Math.max(1, Math.min(10, input.defaultSets ?? 3)),
      defaultReps: (input.defaultReps || '10-12').trim().slice(0, 20),
      restSeconds: 75,
      animationKey: inferGymAnimationKey(cleanName, muscleGroup),
      animationGifUrl: sanitizeGymMediaUrl(input.animationGifUrl) || null,
      formCues:
        'Keep steady tempo, brace core, and focus on controlled eccentric contraction.',
    };

    const customExercises = this.read<GymCatalogExercise[]>(
      STORAGE_KEYS.GYM_CUSTOM_EXERCISES,
      [],
    );
    customExercises.push(created);
    this.write(STORAGE_KEYS.GYM_CUSTOM_EXERCISES, customExercises);

    return created;
  }

  async getGymCommunityMessagesForOwner(params: {
    businessId: string;
    options?: AIConfigAccessOptions;
  }): Promise<GymCommunityMessage[]> {
    const idErr = validateBusinessId(params.businessId);
    if (idErr) throw new Error(idErr);
    const cleanId = params.businessId.trim();
    const business = await this.getBusinessById(cleanId);
    if (!business) throw new Error(`Business with ID "${cleanId}" not found.`);
    this.assertOwnerAccess(business, params.options);

    return this.read<GymCommunityMessage[]>(
      STORAGE_KEYS.GYM_COMMUNITY_MESSAGES,
      [],
    )
      .filter((msg) => msg.businessId === cleanId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .slice(-60);
  }

  async ownerPostOrDeleteGymCommunityMessage(params: {
    businessId: string;
    action: 'post' | 'delete';
    messageText?: string;
    messageId?: string;
    senderName?: string;
    options?: AIConfigAccessOptions;
  }): Promise<GymCommunityMessage | { deletedId: string }> {
    const idErr = validateBusinessId(params.businessId);
    if (idErr) throw new Error(idErr);
    const cleanId = params.businessId.trim();
    const business = await this.getBusinessById(cleanId);
    if (!business) throw new Error(`Business with ID "${cleanId}" not found.`);
    this.assertOwnerAccess(business, params.options);

    const messages = this.read<GymCommunityMessage[]>(
      STORAGE_KEYS.GYM_COMMUNITY_MESSAGES,
      [],
    );

    if (params.action === 'delete') {
      if (!params.messageId) {
        throw new Error('Message ID required to delete.');
      }
      const next = messages.filter(
        (m) => !(m.id === params.messageId && m.businessId === cleanId),
      );
      this.write(STORAGE_KEYS.GYM_COMMUNITY_MESSAGES, next);
      return { deletedId: params.messageId };
    }

    const cleanText = (params.messageText || '').trim().slice(0, 500);
    if (!cleanText) {
      throw new Error('Announcement message cannot be empty.');
    }

    const created: GymCommunityMessage = {
      id: `gymmsg-${crypto.randomUUID()}`,
      businessId: cleanId,
      memberId: null,
      senderName: (params.senderName || 'Head Coach').trim().slice(0, 80),
      senderCode: 'COACH',
      messageType: 'coach_announcement',
      messageText: cleanText,
      createdAt: new Date().toISOString(),
    };
    messages.push(created);
    this.write(STORAGE_KEYS.GYM_COMMUNITY_MESSAGES, messages);
    return created;
  }

  // ---------------------------------------------------------------------------
  // Module 7: Dedicated CafeOS (Stamp Pass, Birthday Coffee, Inventory & Counter)
  // ---------------------------------------------------------------------------

  private getOrCreateCafeConfigRecord(businessId: string): CafeConfig {
    const store = this.read<Record<string, CafeConfig>>(
      STORAGE_KEYS.CAFE_CONFIGS,
      {},
    );
    const existing = store[businessId];
    if (existing) return existing;
    const created = createDefaultCafeConfig(businessId);
    store[businessId] = created;
    this.write(STORAGE_KEYS.CAFE_CONFIGS, store);
    return created;
  }

  private hydrateCafePass(
    pass: CafeStampPass,
    birthdayEnabled: boolean,
  ): CafeStampPass {
    return {
      ...pass,
      isBirthdayToday: isBirthdayTodayForPass({
        birthMonth: pass.birthMonth,
        birthDay: pass.birthDay,
        lastBirthdayRedeemedYear: pass.lastBirthdayRedeemedYear,
        birthdayEnabled,
      }),
    };
  }

  async getCafeOwnerDashboard(
    businessId: string,
    options?: AIConfigAccessOptions,
  ): Promise<CafeOwnerDashboardPayload> {
    const idErr = validateBusinessId(businessId);
    if (idErr) throw new Error(idErr);
    const cleanId = businessId.trim();
    const business = await this.getBusinessById(cleanId);
    if (!business) throw new Error(`Business "${cleanId}" not found.`);
    this.assertOwnerAccess(business, options);

    const config = this.getOrCreateCafeConfigRecord(cleanId);
    const passes = this.read<CafeStampPass[]>(
      STORAGE_KEYS.CAFE_STAMP_PASSES,
      [],
    )
      .filter((p) => p.businessId === cleanId)
      .map((p) => this.hydrateCafePass(p, config.birthdayFreeCoffeeEnabled))
      .sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      );

    const inventoryItems = this.read<CafeInventoryItem[]>(
      STORAGE_KEYS.CAFE_INVENTORY_ITEMS,
      [],
    )
      .filter((i) => i.businessId === cleanId)
      .sort((a, b) => a.itemName.localeCompare(b.itemName));

    const itemMap = new Map(inventoryItems.map((i) => [i.id, i]));
    const inventoryLogs = this.read<CafeInventoryLog[]>(
      STORAGE_KEYS.CAFE_INVENTORY_LOGS,
      [],
    )
      .filter((l) => l.businessId === cleanId)
      .map((l) => {
        const it = itemMap.get(l.inventoryItemId);
        return {
          ...l,
          itemName: l.itemName ?? it?.itemName ?? 'Ingredient',
          unit: l.unit ?? it?.unit,
        };
      })
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      )
      .slice(0, 80);

    const todayKey = getTodayIsoDateKey();
    const counterOrders = this.read<CafeCounterOrder[]>(
      STORAGE_KEYS.CAFE_COUNTER_ORDERS,
      [],
    )
      .filter((o) => o.businessId === cleanId && o.orderDate === todayKey)
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );

    const lowStockCount = inventoryItems.filter(
      (i) => i.currentStock <= i.lowStockThreshold,
    ).length;

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const stampsIssuedToday = passes.filter(
      (p) =>
        p.lastStampedAt &&
        new Date(p.lastStampedAt).getTime() >= startOfToday.getTime(),
    ).length;

    return {
      config,
      passes,
      inventoryItems,
      inventoryLogs,
      counterOrders,
      stats: {
        lowStockCount,
        activeStampHolders: passes.length,
        stampsIssuedToday,
        counterOrdersToday: counterOrders.filter(
          (o) => o.status !== 'cancelled',
        ).length,
        birthdaysTodayCount: passes.filter((p) => p.isBirthdayToday).length,
      },
    };
  }

  async updateCafeConfig(
    businessId: string,
    input: CafeConfigInput,
    options?: AIConfigAccessOptions,
  ): Promise<CafeConfig> {
    const check = validateCafeConfigInput(businessId, input);
    if (!check.ok) throw new Error(check.error);
    const cleanId = businessId.trim();
    const business = await this.getBusinessById(cleanId);
    if (!business) throw new Error(`Business "${cleanId}" not found.`);
    this.assertOwnerAccess(business, options);

    const existing = this.getOrCreateCafeConfigRecord(cleanId);
    const updated: CafeConfig = {
      ...existing,
      stampsRequired: check.value.stampsRequired,
      rewardDrinkName: check.value.rewardDrinkName,
      birthdayFreeCoffeeEnabled: check.value.birthdayFreeCoffeeEnabled,
      birthdayDrinkName: check.value.birthdayDrinkName,
      upiId: check.value.upiId ?? null,
      updatedAt: new Date().toISOString(),
    };
    const store = this.read<Record<string, CafeConfig>>(
      STORAGE_KEYS.CAFE_CONFIGS,
      {},
    );
    store[cleanId] = updated;
    this.write(STORAGE_KEYS.CAFE_CONFIGS, store);
    return updated;
  }

  async createCafeInventoryItem(
    businessId: string,
    input: CafeInventoryItemInput,
    options?: AIConfigAccessOptions,
  ): Promise<CafeInventoryItem> {
    const check = validateCafeInventoryItemInput(businessId, input);
    if (!check.ok) throw new Error(check.error);
    const cleanId = businessId.trim();
    const business = await this.getBusinessById(cleanId);
    if (!business) throw new Error(`Business "${cleanId}" not found.`);
    this.assertOwnerAccess(business, options);

    const items = this.read<CafeInventoryItem[]>(
      STORAGE_KEYS.CAFE_INVENTORY_ITEMS,
      [],
    );
    const created: CafeInventoryItem = {
      id: `cafe-inv-${crypto.randomUUID()}`,
      businessId: cleanId,
      itemName: check.value.itemName,
      category: check.value.category,
      unit: check.value.unit,
      currentStock: check.value.currentStock,
      lowStockThreshold: check.value.lowStockThreshold,
      unitCostPaise: check.value.unitCostPaise,
      supplierNote: check.value.supplierNote ?? null,
      updatedAt: new Date().toISOString(),
    };
    items.push(created);
    this.write(STORAGE_KEYS.CAFE_INVENTORY_ITEMS, items);
    return created;
  }

  async deleteCafeInventoryItem(
    businessId: string,
    itemId: string,
    options?: AIConfigAccessOptions,
  ): Promise<void> {
    const idErr = validateBusinessId(businessId);
    if (idErr) throw new Error(idErr);
    const cleanId = businessId.trim();
    const business = await this.getBusinessById(cleanId);
    if (!business) throw new Error(`Business "${cleanId}" not found.`);
    this.assertOwnerAccess(business, options);

    const items = this.read<CafeInventoryItem[]>(
      STORAGE_KEYS.CAFE_INVENTORY_ITEMS,
      [],
    );
    this.write(
      STORAGE_KEYS.CAFE_INVENTORY_ITEMS,
      items.filter((i) => !(i.businessId === cleanId && i.id === itemId)),
    );
  }

  async seedCafeInventoryStarterPack(
    businessId: string,
    options?: AIConfigAccessOptions,
  ): Promise<CafeInventoryItem[]> {
    const idErr = validateBusinessId(businessId);
    if (idErr) throw new Error(idErr);
    const cleanId = businessId.trim();
    const business = await this.getBusinessById(cleanId);
    if (!business) throw new Error(`Business "${cleanId}" not found.`);
    this.assertOwnerAccess(business, options);

    const existing = this.read<CafeInventoryItem[]>(
      STORAGE_KEYS.CAFE_INVENTORY_ITEMS,
      [],
    ).filter((i) => i.businessId === cleanId);
    const existingNames = new Set(
      existing.map((e) => e.itemName.toLowerCase()),
    );

    const added: CafeInventoryItem[] = [];
    for (const preset of CAFE_INVENTORY_STARTER_PACK) {
      if (!existingNames.has(preset.itemName.toLowerCase())) {
        const created = await this.createCafeInventoryItem(
          cleanId,
          preset,
          options,
        );
        added.push(created);
      }
    }
    return added;
  }

  async adjustCafeInventoryStock(params: {
    businessId: string;
    itemId: string;
    actionType: CafeInventoryActionType;
    quantity: number;
    costPaise?: number;
    note?: string | null;
    loggedBy?: string | null;
    options?: AIConfigAccessOptions;
  }): Promise<{ item: CafeInventoryItem; log: CafeInventoryLog }> {
    const idErr = validateBusinessId(params.businessId);
    if (idErr) throw new Error(idErr);
    const check = validateCafeInventoryAction(
      params.actionType,
      params.quantity,
    );
    if (!check.ok) throw new Error(check.error);

    const cleanId = params.businessId.trim();
    const business = await this.getBusinessById(cleanId);
    if (!business) throw new Error(`Business "${cleanId}" not found.`);
    this.assertOwnerAccess(business, params.options);

    const items = this.read<CafeInventoryItem[]>(
      STORAGE_KEYS.CAFE_INVENTORY_ITEMS,
      [],
    );
    const idx = items.findIndex(
      (i) => i.id === params.itemId && i.businessId === cleanId,
    );
    if (idx === -1) throw new Error('Cafe inventory item not found.');

    const delta =
      check.action === 'restock' ? check.quantity : -check.quantity;
    const now = new Date().toISOString();
    const updatedItem: CafeInventoryItem = {
      ...items[idx],
      currentStock: Math.max(
        0,
        Math.round((items[idx].currentStock + delta) * 100) / 100,
      ),
      updatedAt: now,
    };
    items[idx] = updatedItem;
    this.write(STORAGE_KEYS.CAFE_INVENTORY_ITEMS, items);

    const logs = this.read<CafeInventoryLog[]>(
      STORAGE_KEYS.CAFE_INVENTORY_LOGS,
      [],
    );
    const createdLog: CafeInventoryLog = {
      id: `cafe-log-${crypto.randomUUID()}`,
      businessId: cleanId,
      inventoryItemId: updatedItem.id,
      itemName: updatedItem.itemName,
      unit: updatedItem.unit,
      actionType: check.action,
      quantityDelta: delta,
      costPaise: Math.max(0, Math.round(params.costPaise ?? 0)),
      note: params.note?.trim().slice(0, 200) || null,
      loggedBy: params.loggedBy?.trim().slice(0, 80) || 'Owner',
      createdAt: now,
    };
    logs.push(createdLog);
    this.write(STORAGE_KEYS.CAFE_INVENTORY_LOGS, logs);

    return { item: updatedItem, log: createdLog };
  }

  async redeemCafePassReward(params: {
    businessId: string;
    passId: string;
    rewardType: CafeRewardRedemptionType;
    options?: AIConfigAccessOptions;
  }): Promise<CafeStampPass> {
    const idErr = validateBusinessId(params.businessId);
    if (idErr) throw new Error(idErr);
    const cleanId = params.businessId.trim();
    const business = await this.getBusinessById(cleanId);
    if (!business) throw new Error(`Business "${cleanId}" not found.`);
    this.assertOwnerAccess(business, params.options);

    const config = this.getOrCreateCafeConfigRecord(cleanId);
    const passes = this.read<CafeStampPass[]>(
      STORAGE_KEYS.CAFE_STAMP_PASSES,
      [],
    );
    const idx = passes.findIndex(
      (p) => p.id === params.passId && p.businessId === cleanId,
    );
    if (idx === -1) throw new Error('Customer coffee stamp pass not found.');

    const current = passes[idx];
    const now = new Date();
    const nowIso = now.toISOString();
    let updated: CafeStampPass;

    if (params.rewardType === 'stamp_free_drink') {
      if (current.freeDrinksAvailable < 1) {
        throw new Error('No free stamp drinks available to redeem yet.');
      }
      updated = {
        ...current,
        freeDrinksAvailable: current.freeDrinksAvailable - 1,
        updatedAt: nowIso,
      };
    } else {
      const bdayEligible = isBirthdayTodayForPass({
        birthMonth: current.birthMonth,
        birthDay: current.birthDay,
        lastBirthdayRedeemedYear: current.lastBirthdayRedeemedYear,
        birthdayEnabled: config.birthdayFreeCoffeeEnabled,
        now,
      });
      if (!bdayEligible) {
        throw new Error(
          'Birthday free coffee is either not today or has already been redeemed this year.',
        );
      }
      updated = {
        ...current,
        lastBirthdayRedeemedYear: now.getFullYear(),
        updatedAt: nowIso,
      };
    }

    const hydrated = this.hydrateCafePass(
      updated,
      config.birthdayFreeCoffeeEnabled,
    );
    passes[idx] = hydrated;
    this.write(STORAGE_KEYS.CAFE_STAMP_PASSES, passes);
    return hydrated;
  }

  async updateCafeCounterOrderStatus(params: {
    businessId: string;
    orderId: string;
    status: CafeCounterOrderStatus;
    options?: AIConfigAccessOptions;
  }): Promise<CafeCounterOrder> {
    const idErr = validateBusinessId(params.businessId);
    if (idErr) throw new Error(idErr);
    const cleanId = params.businessId.trim();
    const business = await this.getBusinessById(cleanId);
    if (!business) throw new Error(`Business "${cleanId}" not found.`);
    this.assertOwnerAccess(business, params.options);

    const orders = this.read<CafeCounterOrder[]>(
      STORAGE_KEYS.CAFE_COUNTER_ORDERS,
      [],
    );
    const idx = orders.findIndex(
      (o) => o.id === params.orderId && o.businessId === cleanId,
    );
    if (idx === -1) throw new Error('Counter order not found.');

    const updated: CafeCounterOrder = {
      ...orders[idx],
      status: params.status,
      updatedAt: new Date().toISOString(),
    };
    orders[idx] = updated;
    this.write(STORAGE_KEYS.CAFE_COUNTER_ORDERS, orders);
    return updated;
  }

  async getPublicCafeHub(
    businessSlug: string,
    phone?: string | null,
  ): Promise<PublicCafeHubPayload | null> {
    const business = await this.getBusinessBySlug(businessSlug);
    if (
      !business ||
      (business.status ?? 'active') !== 'active' ||
      (business.accountState ?? 'active') !== 'active'
    ) {
      return null;
    }

    const config = this.getOrCreateCafeConfigRecord(business.id);
    const profileStore = this.read<Record<string, RestaurantProfile>>(
      STORAGE_KEYS.RESTAURANT_PROFILES,
      {},
    );
    const prof = profileStore[business.id];
    const cleanPhone = normalizeCafePhone(phone ?? '');

    let pass: CafeStampPass | null = null;
    let todayOrders: CafeCounterOrder[] = [];
    if (cleanPhone) {
      const foundPass =
        this.read<CafeStampPass[]>(STORAGE_KEYS.CAFE_STAMP_PASSES, []).find(
          (p) => p.businessId === business.id && p.phone === cleanPhone,
        ) ?? null;
      if (foundPass) {
        pass = this.hydrateCafePass(foundPass, config.birthdayFreeCoffeeEnabled);
      }
      const todayKey = getTodayIsoDateKey();
      todayOrders = this.read<CafeCounterOrder[]>(
        STORAGE_KEYS.CAFE_COUNTER_ORDERS,
        [],
      )
        .filter(
          (o) =>
            o.businessId === business.id &&
            o.phone === cleanPhone &&
            o.orderDate === todayKey,
        )
        .sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        );
    }

    const catStore = this.read<Record<string, RestaurantMenuCategory[]>>(
      STORAGE_KEYS.RESTAURANT_CATEGORIES,
      {},
    );
    const itemStore = this.read<Record<string, RestaurantMenuItem[]>>(
      STORAGE_KEYS.RESTAURANT_ITEMS,
      {},
    );
    const categories = (catStore[business.id] ?? []).filter((c) => c.isActive);
    const activeCatIds = new Set(categories.map((c) => c.id));
    const items = (itemStore[business.id] ?? []).filter(
      (i) => i.isAvailable && activeCatIds.has(i.categoryId),
    );

    const { counterQrSecret: _hidden, ...publicConfig } = config;
    void _hidden;

    return {
      business: {
        id: business.id,
        name: business.name,
        slug: business.slug,
        city: business.city,
        category: business.category,
      },
      config: publicConfig,
      currencyCode: prof?.currencyCode ?? 'INR',
      tagline: prof?.tagline ?? null,
      pass,
      categories,
      items,
      todayOrders,
    };
  }

  async claimCafeCounterStamp(params: {
    businessSlug: string;
    customerName: string;
    phone: string;
    birthMonth?: number | null;
    birthDay?: number | null;
    timeBucket: number;
    tokenSig: string;
    bypassCooldownForTest?: boolean;
  }): Promise<ClaimCafeStampResponse> {
    const cleanName = params.customerName.trim().slice(0, 80);
    if (cleanName.length < 2) {
      throw new Error('Please enter your name (at least 2 characters).');
    }
    const cleanPhone = normalizeCafePhone(params.phone);
    if (cleanPhone.length < 7) {
      throw new Error('Please enter a valid mobile number.');
    }
    if (
      (params.birthMonth !== undefined &&
        params.birthMonth !== null &&
        (params.birthMonth < 1 || params.birthMonth > 12)) ||
      (params.birthDay !== undefined &&
        params.birthDay !== null &&
        (params.birthDay < 1 || params.birthDay > 31))
    ) {
      throw new Error('Please enter a valid birthday month and day.');
    }

    const business = await this.getBusinessBySlug(params.businessSlug);
    if (
      !business ||
      (business.status ?? 'active') !== 'active' ||
      (business.accountState ?? 'active') !== 'active'
    ) {
      throw new Error('Cafe not found or inactive.');
    }

    const config = this.getOrCreateCafeConfigRecord(business.id);
    const nowBucket = getCafeRotatingTimeBucket();
    if (Math.abs(nowBucket - params.timeBucket) > 1) {
      throw new Error(
        'Counter QR expired — please scan the live counter screen again.',
      );
    }

    const expectedSig = await computeCafeCounterTokenSig(
      config.counterQrSecret,
      params.timeBucket,
    );
    if (
      !params.tokenSig ||
      params.tokenSig.trim().toLowerCase() !== expectedSig
    ) {
      throw new Error(
        'Invalid counter QR code — please scan the live QR at the counter.',
      );
    }

    const passes = this.read<CafeStampPass[]>(
      STORAGE_KEYS.CAFE_STAMP_PASSES,
      [],
    );
    const idx = passes.findIndex(
      (p) => p.businessId === business.id && p.phone === cleanPhone,
    );
    const now = new Date();
    const nowIso = now.toISOString();
    let earnedFree = 0;
    let savedPass: CafeStampPass;

    if (idx !== -1) {
      const existing = passes[idx];
      if (
        !params.bypassCooldownForTest &&
        existing.lastStampedAt &&
        now.getTime() - new Date(existing.lastStampedAt).getTime() <
          3 * 60 * 60 * 1000
      ) {
        throw new Error(
          'Stamp already collected! You can earn your next coffee stamp after 3 hours.',
        );
      }

      let nextStamps = existing.currentStamps + 1;
      if (nextStamps >= config.stampsRequired) {
        earnedFree = Math.floor(nextStamps / config.stampsRequired);
        nextStamps = nextStamps % config.stampsRequired;
      }

      savedPass = this.hydrateCafePass(
        {
          ...existing,
          customerName: cleanName,
          birthMonth: params.birthMonth ?? existing.birthMonth,
          birthDay: params.birthDay ?? existing.birthDay,
          currentStamps: nextStamps,
          lifetimeStamps: existing.lifetimeStamps + 1,
          freeDrinksAvailable: existing.freeDrinksAvailable + earnedFree,
          lastStampedAt: nowIso,
          updatedAt: nowIso,
        },
        config.birthdayFreeCoffeeEnabled,
      );
      passes[idx] = savedPass;
    } else {
      const bizCount = passes.filter(
        (p) => p.businessId === business.id,
      ).length;
      const passCode = `BREW-${String(bizCount + 1).padStart(3, '0')}`;
      let nextStamps = 1;
      if (nextStamps >= config.stampsRequired) {
        earnedFree = 1;
        nextStamps = 0;
      }
      savedPass = this.hydrateCafePass(
        {
          id: `cafe-pass-${crypto.randomUUID()}`,
          businessId: business.id,
          passCode,
          customerName: cleanName,
          phone: cleanPhone,
          birthMonth: params.birthMonth ?? null,
          birthDay: params.birthDay ?? null,
          currentStamps: nextStamps,
          lifetimeStamps: 1,
          freeDrinksAvailable: earnedFree,
          lastBirthdayRedeemedYear: null,
          lastStampedAt: nowIso,
          isBirthdayToday: false,
          createdAt: nowIso,
          updatedAt: nowIso,
        },
        config.birthdayFreeCoffeeEnabled,
      );
      passes.push(savedPass);
    }

    this.write(STORAGE_KEYS.CAFE_STAMP_PASSES, passes);
    return {
      pass: savedPass,
      justUnlockedFreeDrink: earnedFree > 0,
      stampsRequired: config.stampsRequired,
    };
  }

  async submitCafeCounterOrder(params: {
    businessSlug: string;
    customerName: string;
    phone?: string | null;
    items: Array<{ itemId: string; quantity: number }>;
    orderNote?: string | null;
  }): Promise<CafeCounterOrder> {
    if (!Array.isArray(params.items) || params.items.length === 0) {
      throw new Error('Please add at least one drink or snack.');
    }
    const business = await this.getBusinessBySlug(params.businessSlug);
    if (
      !business ||
      (business.status ?? 'active') !== 'active' ||
      (business.accountState ?? 'active') !== 'active'
    ) {
      throw new Error('Cafe not found or inactive.');
    }

    const itemStore = this.read<Record<string, RestaurantMenuItem[]>>(
      STORAGE_KEYS.RESTAURANT_ITEMS,
      {},
    );
    const catalog = itemStore[business.id] ?? [];
    const byId = new Map(catalog.map((i) => [i.id, i]));

    let subtotalPaise = 0;
    const validatedItems = params.items.map((line) => {
      const dish = byId.get(line.itemId);
      if (!dish || !dish.isAvailable) {
        throw new Error(
          'One or more selected menu items are currently unavailable.',
        );
      }
      const qty = Math.max(1, Math.min(20, Math.round(line.quantity || 1)));
      subtotalPaise += dish.pricePaise * qty;
      return {
        itemId: dish.id,
        name: dish.name,
        quantity: qty,
        pricePaise: dish.pricePaise,
      };
    });

    const orders = this.read<CafeCounterOrder[]>(
      STORAGE_KEYS.CAFE_COUNTER_ORDERS,
      [],
    );
    const todayKey = getTodayIsoDateKey();
    const todayCount = orders.filter(
      (o) => o.businessId === business.id && o.orderDate === todayKey,
    ).length;
    const now = new Date().toISOString();
    const cleanPhone = normalizeCafePhone(params.phone ?? '') || null;

    const created: CafeCounterOrder = {
      id: `cafe-ord-${crypto.randomUUID()}`,
      businessId: business.id,
      orderDate: todayKey,
      tokenCode: `#C-${String(todayCount + 1).padStart(2, '0')}`,
      customerName: params.customerName.trim().slice(0, 80) || 'Counter Guest',
      phone: cleanPhone,
      items: validatedItems,
      subtotalPaise,
      status: 'queued',
      orderNote: params.orderNote?.trim().slice(0, 200) || null,
      createdAt: now,
      updatedAt: now,
    };
    orders.push(created);
    this.write(STORAGE_KEYS.CAFE_COUNTER_ORDERS, orders);
    return created;
  }
}

export const businessRepository: IBusinessRepository = new MockLocalStorageRepository();
