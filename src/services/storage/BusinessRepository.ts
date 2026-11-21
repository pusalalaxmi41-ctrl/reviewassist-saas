import type {
  Business,
  BusinessCategory,
  ReviewFontStyle,
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
import type {
  ApplyMenuPresetResult,
  MenuPresetKey,
  PublicRestaurantMenuPayload,
  RestaurantCustomerCheckInInput,
  RestaurantCustomerWalletState,
  RestaurantFloorAndAnalyticsPayload,
  RestaurantGameCompletionResponse,
  RestaurantGameConfig,
  RestaurantGameConfigInput,
  RestaurantGameParticipationStats,
  RestaurantGameSlug,
  RestaurantGameStartResponse,
  RestaurantGameSubmissionInput,
  RestaurantLoyaltyRules,
  RestaurantLoyaltyRulesInput,
  RestaurantMenuCategory,
  RestaurantMenuCategoryInput,
  RestaurantMenuItem,
  RestaurantMenuItemInput,
  RestaurantPointToStarExchangeResponse,
  RestaurantProfile,
  RestaurantProfileInput,
  RestaurantReward,
  RestaurantRewardClaim,
  RestaurantRewardClaimResponse,
  RestaurantRewardInput,
  RestaurantStaffAwardVisitResponse,
  RestaurantSuggestion,
  RestaurantSuggestionInput,
  RestaurantTable,
  RestaurantTableCall,
  RestaurantTableCallStatus,
  RestaurantTableCallType,
  RestaurantTableInput,
  RestaurantTableOrder,
  RestaurantTableOrderStatus,
} from '../../types/restaurant';

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

  /** Updates the review display font shown to customers while writing. */
  updateBusinessReviewFont(
    businessId: string,
    reviewFont: ReviewFontStyle,
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

  // ---------------------------------------------------------------------------
  // Phase 1: Restaurant Foundation, Tables & Digital Menu
  // ---------------------------------------------------------------------------

  /** Retrieves the 1:1 Restaurant Profile for a specific business ID. */
  getRestaurantProfile(
    businessId: string,
    options?: AIConfigAccessOptions,
  ): Promise<RestaurantProfile>;

  /** Validates and saves the 1:1 Restaurant Profile for a specific business ID. */
  updateRestaurantProfile(
    businessId: string,
    input: RestaurantProfileInput,
    options?: AIConfigAccessOptions,
  ): Promise<RestaurantProfile>;

  /** Retrieves all configured restaurant tables for a specific business ID. */
  getRestaurantTables(
    businessId: string,
    options?: AIConfigAccessOptions,
  ): Promise<RestaurantTable[]>;

  /** Creates a new restaurant table with a unique table_key per business. */
  createRestaurantTable(
    businessId: string,
    input: RestaurantTableInput,
    options?: AIConfigAccessOptions,
  ): Promise<RestaurantTable>;

  /** Updates an existing restaurant table. */
  updateRestaurantTable(
    businessId: string,
    tableId: string,
    input: RestaurantTableInput,
    options?: AIConfigAccessOptions,
  ): Promise<RestaurantTable>;

  /** Deletes a restaurant table. */
  deleteRestaurantTable(
    businessId: string,
    tableId: string,
    options?: AIConfigAccessOptions,
  ): Promise<void>;

  /** Retrieves all digital menu categories for a specific business ID. */
  getRestaurantMenuCategories(
    businessId: string,
    options?: AIConfigAccessOptions,
  ): Promise<RestaurantMenuCategory[]>;

  /** Creates a new digital menu category. */
  createRestaurantMenuCategory(
    businessId: string,
    input: RestaurantMenuCategoryInput,
    options?: AIConfigAccessOptions,
  ): Promise<RestaurantMenuCategory>;

  /** Updates an existing digital menu category. */
  updateRestaurantMenuCategory(
    businessId: string,
    categoryId: string,
    input: RestaurantMenuCategoryInput,
    options?: AIConfigAccessOptions,
  ): Promise<RestaurantMenuCategory>;

  /** Deletes a digital menu category and cascades its items. */
  deleteRestaurantMenuCategory(
    businessId: string,
    categoryId: string,
    options?: AIConfigAccessOptions,
  ): Promise<void>;

  /** Retrieves all digital menu items for a specific business ID. */
  getRestaurantMenuItems(
    businessId: string,
    options?: AIConfigAccessOptions,
  ): Promise<RestaurantMenuItem[]>;

  /** Creates a new digital menu item inside a category belonging to the same business. */
  createRestaurantMenuItem(
    businessId: string,
    input: RestaurantMenuItemInput,
    options?: AIConfigAccessOptions,
  ): Promise<RestaurantMenuItem>;

  /** Updates an existing digital menu item. */
  updateRestaurantMenuItem(
    businessId: string,
    itemId: string,
    input: RestaurantMenuItemInput,
    options?: AIConfigAccessOptions,
  ): Promise<RestaurantMenuItem>;

  /** Deletes a digital menu item. */
  deleteRestaurantMenuItem(
    businessId: string,
    itemId: string,
    options?: AIConfigAccessOptions,
  ): Promise<void>;

  /**
   * Public customer lookup for `/r/:businessSlug/menu` and `/r/:businessSlug/table/:tableKey`.
   * Returns null unless the business is active, accountState is active, and restaurant profile is enabled.
   */
  getPublicRestaurantMenu(
    businessSlug: string,
    tableKey?: string | null,
  ): Promise<PublicRestaurantMenuPayload | null>;

  // ---------------------------------------------------------------------------
  // Phase 2: Customer Identity, Restaurant Games & Secure Game-Points Ledger
  // ---------------------------------------------------------------------------

  /** Retrieves the restaurant's game configurations (initializing defaults if not customized yet). */
  getRestaurantGameConfigs(
    businessId: string,
    options?: AIConfigAccessOptions,
  ): Promise<RestaurantGameConfig[]>;

  /** Updates a restaurant game configuration (enabled state, points, daily limits, cooldown, custom trivia). */
  updateRestaurantGameConfig(
    businessId: string,
    input: RestaurantGameConfigInput,
    options?: AIConfigAccessOptions,
  ): Promise<RestaurantGameConfig>;

  /** Retrieves game participation metrics (sessions played, points issued today/total) for the business owner. */
  getRestaurantGameStats(
    businessId: string,
    options?: AIConfigAccessOptions,
  ): Promise<RestaurantGameParticipationStats>;

  /** Creates or resumes a diner customer profile and returns their Game Points wallet & transaction ledger. */
  registerOrResumeRestaurantCustomer(
    input: RestaurantCustomerCheckInInput,
  ): Promise<RestaurantCustomerWalletState>;

  /**
   * Starts a server-validated game session after checking active status, cooldowns, and daily caps.
   * Returns a sanitized challenge with expected answers stripped out.
   */
  startRestaurantGameSession(params: {
    businessSlug: string;
    tableKey?: string | null;
    customerId: string;
    gameSlug: RestaurantGameSlug;
  }): Promise<RestaurantGameStartResponse>;

  /**
   * Validates a customer's game answers/performance on the backend, enforces idempotency and daily point caps,
   * writes an immutable game-points ledger transaction, and returns the verified points earned + updated balance.
   */
  completeRestaurantGameSession(params: {
    sessionId: string;
    customerId: string;
    submission: RestaurantGameSubmissionInput;
    idempotencyKey: string;
  }): Promise<RestaurantGameCompletionResponse>;

  // ---------------------------------------------------------------------------
  // Phase 3: Loyalty Stars Ledger, Point-to-Star Exchange & Reward Catalogue
  // ---------------------------------------------------------------------------

  /** Retrieves the 1:1 loyalty economy rules (stars/visit, points/star, weekly cap, Wi-Fi, suggestion box). */
  getRestaurantLoyaltyRules(
    businessId: string,
    options?: AIConfigAccessOptions,
  ): Promise<RestaurantLoyaltyRules>;

  /** Validates and saves the 1:1 loyalty economy rules for a business. */
  updateRestaurantLoyaltyRules(
    businessId: string,
    input: RestaurantLoyaltyRulesInput,
    options?: AIConfigAccessOptions,
  ): Promise<RestaurantLoyaltyRules>;

  /** Retrieves all configured rewards for a business. */
  getRestaurantRewards(
    businessId: string,
    options?: AIConfigAccessOptions,
  ): Promise<RestaurantReward[]>;

  /** Creates a new reward in the restaurant's loyalty catalogue. */
  createRestaurantReward(
    businessId: string,
    input: RestaurantRewardInput,
    options?: AIConfigAccessOptions,
  ): Promise<RestaurantReward>;

  /** Updates an existing reward in the restaurant's loyalty catalogue. */
  updateRestaurantReward(
    businessId: string,
    rewardId: string,
    input: RestaurantRewardInput,
    options?: AIConfigAccessOptions,
  ): Promise<RestaurantReward>;

  /** Deletes a reward from the restaurant's loyalty catalogue. */
  deleteRestaurantReward(
    businessId: string,
    rewardId: string,
    options?: AIConfigAccessOptions,
  ): Promise<void>;

  /**
   * Atomically exchanges `pointsPerStarExchange` Game Points for +1 Loyalty Star.
   * Updates both the Game-Points ledger and the Loyalty-Stars ledger together.
   */
  exchangeGamePointsForStar(params: {
    businessSlug: string;
    customerId: string;
    idempotencyKey: string;
  }): Promise<RestaurantPointToStarExchangeResponse>;

  /**
   * Atomically deducts `starsRequired` Loyalty Stars and issues a 6-character claim code
   * in `pending_staff_verification` status.
   */
  claimRestaurantReward(params: {
    businessSlug: string;
    customerId: string;
    rewardId: string;
    idempotencyKey: string;
  }): Promise<RestaurantRewardClaimResponse>;

  /** Submits a private Suggestion Box note from a table guest to the restaurant owner. */
  submitRestaurantSuggestion(
    input: RestaurantSuggestionInput,
  ): Promise<RestaurantSuggestion>;

  /** Retrieves private Suggestion Box messages for the business owner. */
  getRestaurantSuggestions(
    businessId: string,
    options?: AIConfigAccessOptions,
  ): Promise<RestaurantSuggestion[]>;

  /** Marks a private Suggestion Box message as read by the business owner. */
  markRestaurantSuggestionRead(
    businessId: string,
    suggestionId: string,
    isRead?: boolean,
    options?: AIConfigAccessOptions,
  ): Promise<RestaurantSuggestion>;

  // ---------------------------------------------------------------------------
  // Phase 4: Visual Table Floor Map, Staff Verification Mode & Owner Analytics
  // ---------------------------------------------------------------------------

  /** Creates a "Call Waiter" or "Ready for Bill" alert from a table QR hub (with spam deduplication). */
  createRestaurantTableCall(params: {
    businessSlug: string;
    tableKey: string;
    customerId?: string | null;
    callType: RestaurantTableCallType;
  }): Promise<RestaurantTableCall>;

  /** Verifies a hashed Staff PIN (or authenticated owner session) for Staff Verification Mode. */
  verifyRestaurantStaffPin(params: {
    businessSlug: string;
    staffPinHash?: string | null;
    options?: AIConfigAccessOptions;
  }): Promise<{
    verified: boolean;
    businessId: string;
    businessSlug: string;
    businessName: string;
  }>;

  /** Updates a table call alert status ('open' | 'acknowledged' | 'resolved'). */
  updateRestaurantTableCallStatus(params: {
    businessSlug: string;
    callId: string;
    status: RestaurantTableCallStatus;
    staffPinHash?: string | null;
    options?: AIConfigAccessOptions;
  }): Promise<RestaurantTableCall>;

  /**
   * Explicit staff/owner verification of a paid dining visit.
   * Resolves diner by Loyalty QR token (`vitaran-loyalty://...`), customer ID, or phone/email,
   * enforces `minHoursBetweenVisitStars` cooldown and idempotency, records the verified visit,
   * and atomically credits `starsPerVerifiedVisit` into the Loyalty Stars ledger.
   */
  staffAwardVisitStars(params: {
    businessSlug: string;
    customerLookup: string;
    tableKey?: string | null;
    staffLabel?: string;
    idempotencyKey: string;
    staffPinHash?: string | null;
    options?: AIConfigAccessOptions;
  }): Promise<RestaurantStaffAwardVisitResponse>;

  /**
   * Validates a 6-character reward claim code is in `pending_staff_verification` status
   * for this business and marks it `fulfilled`.
   */
  staffFulfillRewardClaim(params: {
    businessSlug: string;
    claimCode: string;
    staffLabel?: string;
    staffPinHash?: string | null;
    options?: AIConfigAccessOptions;
  }): Promise<RestaurantRewardClaim & { customerName?: string }>;

  /**
   * Returns live table floor alerts, pending reward claims, active table orders, and accurate engagement funnel
   * metrics (explicitly separating QR scans from verified paid visits).
   */
  getRestaurantFloorAndAnalytics(params: {
    businessSlug: string;
    staffPinHash?: string | null;
    options?: AIConfigAccessOptions;
  }): Promise<RestaurantFloorAndAnalyticsPayload>;

  // ---------------------------------------------------------------------------
  // Master Upgrade: 1-Tap Preset Menu Injection & Optional Table Ordering
  // ---------------------------------------------------------------------------

  /**
   * Injects one of the 5 complete cultural menu preset packs (3 categories, 10 dishes,
   * matching cultural theme template, and 2 starter rewards if none exist).
   */
  applyRestaurantMenuPreset(
    businessId: string,
    presetKey: MenuPresetKey,
    options?: AIConfigAccessOptions,
  ): Promise<ApplyMenuPresetResult>;

  /**
   * Submits a guest table order strictly when `tableOrderingEnabled === true`.
   * Resolves canonical dish names and prices from the backend catalog (zero payment/tax).
   */
  submitCustomerTableOrder(params: {
    businessSlug: string;
    tableKey?: string | null;
    customerId?: string | null;
    guestName?: string | null;
    items: Array<{ itemId: string; quantity: number; notes?: string | null }>;
  }): Promise<RestaurantTableOrder>;

  /**
   * Lets Owner or Staff (via Staff PIN) move a table order through:
   * 'pending_approval' -> 'approved_for_kitchen' -> 'preparing' -> 'served' | 'cancelled'
   */
  updateTableOrderStatus(params: {
    businessSlug: string;
    orderId: string;
    status: RestaurantTableOrderStatus;
    staffLabel?: string;
    staffPinHash?: string | null;
    options?: AIConfigAccessOptions;
  }): Promise<RestaurantTableOrder>;
}
