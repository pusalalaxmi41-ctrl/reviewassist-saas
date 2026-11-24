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
  CompleteTableBillCheckoutResult,
  CreatePosOrPlatformOrderInput,
  FloorTableLayoutItem,
  MenuPresetKey,
  OpenTableBillSummary,
  PublicRestaurantMenuPayload,
  PublicStaffLoginOption,
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
  RestaurantMonthlyInventoryInput,
  RestaurantMonthlyInventoryItem,
  RestaurantPaymentMethod,
  RestaurantPointToStarExchangeResponse,
  RestaurantProfile,
  RestaurantProfileInput,
  RestaurantReward,
  RestaurantRewardClaim,
  RestaurantRewardClaimResponse,
  RestaurantRewardInput,
  RestaurantStaffAwardVisitResponse,
  RestaurantStaffMember,
  RestaurantStaffMemberInput,
  RestaurantSuggestion,
  RestaurantSuggestionInput,
  RestaurantTable,
  RestaurantTableCall,
  RestaurantTableCallStatus,
  RestaurantTableCallType,
  RestaurantTableInput,
  RestaurantTableMessage,
  RestaurantTableMessageSenderRole,
  RestaurantTableOrder,
  RestaurantTableOrderStatus,
  VerifiedStaffMemberSession,
} from '../../types/restaurant';
import type {
  AdvanceBarberQueueTicketResult,
  BarberQueueConfig,
  BarberQueueConfigInput,
  BarberQueueDelayIncrement,
  BarberQueueTicketStatus,
  BarberRevenueSummary,
  ExtendBarberQueueTimerResult,
  JoinBarberQueueInput,
  JoinBarberQueueResult,
  PublicBarberQueueStatusPayload,
} from '../../types/barberQueue';
import type {
  GymBodyMeasurement,
  GymBodyMeasurementInput,
  GymCatalogExercise,
  GymCatalogExerciseInput,
  GymCoachPlan,
  GymConfig,
  GymConfigInput,
  GymDailyCheckInResult,
  GymFitnessGoal,
  GymFreezeAction,
  GymLeaderboardEntry,
  GymLogSetResult,
  GymMember,
  GymMemberAthleteHubPayload,
  GymMemberProgressHistory,
  GymMemberWorkoutPlanPayload,
  GymMemberWorkoutSummaryPayload,
  GymOwnerDashboardPayload,
  GymOwnerMemberAction,
  GymPaymentMethod,
  GymRetailProduct,
  GymRetailProductInput,
  GymRetailSale,
  GymRoutineExerciseItem,
  GymTrainer,
  GymTrainerCommissionRow,
  GymTrainerInput,
  GymWorkoutFocus,
  GymWorkoutRoutine,
  GymWorkoutSession,
  LogGymWorkoutSessionInput,
  PublicGymPortalPayload,
  SubmitGymRegistrationInput,
  UpsertGymCoachPlanInput,
} from '../../types/gym';
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

  /** Updates a table call alert status ('open' | 'acknowledged' | 'resolved') and optional assigned waiter label. */
  updateRestaurantTableCallStatus(params: {
    businessSlug: string;
    callId: string;
    status: RestaurantTableCallStatus;
    assignedStaffLabel?: string | null;
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
    kitchenNote?: string | null;
  }): Promise<RestaurantTableOrder>;

  /**
   * Lets Owner or Staff (via Staff PIN) move a table order through:
   * 'pending_approval' -> 'approved_for_kitchen' -> 'preparing' -> 'ready' -> 'served' | 'cancelled'
   */
  updateTableOrderStatus(params: {
    businessSlug: string;
    orderId: string;
    status: RestaurantTableOrderStatus;
    staffLabel?: string;
    staffPinHash?: string | null;
    options?: AIConfigAccessOptions;
  }): Promise<RestaurantTableOrder>;

  // ---------------------------------------------------------------------------
  // Complete Hospitality OS (Migration 019): Counter POS, Platform Orders,
  // 2-Way Live Table/Room Chat, Multi-Order Open Bills & Realtime Sync
  // ---------------------------------------------------------------------------

  /** Creates a Counter POS or Aggregator Platform (Swiggy/Zomato/etc.) order straight into kitchen KOT. */
  createPosOrPlatformOrder(
    input: CreatePosOrPlatformOrderInput,
    options?: AIConfigAccessOptions,
  ): Promise<RestaurantTableOrder>;

  /** Sends a live 2-way table/room chat message ('customer' | 'manager' | 'system') and returns thread. */
  sendTableChatMessage(params: {
    businessSlug: string;
    tableKey: string;
    senderRole: RestaurantTableMessageSenderRole;
    senderName?: string | null;
    messageText: string;
    staffPinHash?: string | null;
    options?: AIConfigAccessOptions;
  }): Promise<RestaurantTableMessage[]>;

  /** Retrieves chronological live chat messages for a table or hotel room. */
  getTableChatMessages(params: {
    businessSlug: string;
    tableKey: string;
  }): Promise<RestaurantTableMessage[]>;

  /** Aggregates all unpaid active orders on a table/room into an open bill with GST (CGST+SGST) & Service Charge. */
  getOpenTableBillSummary(params: {
    businessSlug: string;
    tableKey: string;
  }): Promise<OpenTableBillSummary | null>;

  /** Guest action after scanning UPI QR: marks active unpaid orders on that table as 'upi_pending_verify'. */
  markTableBillUpiPending(params: {
    businessSlug: string;
    tableKey: string;
    guestName?: string | null;
  }): Promise<OpenTableBillSummary | null>;

  /** Owner/Staff final checkout: marks open orders served + paid, resets table occupancy, posts receipt confirmation. */
  completeTableBillCheckout(params: {
    businessId: string;
    tableId: string;
    paymentMethod: RestaurantPaymentMethod;
    staffLabel?: string;
    staffPinHash?: string | null;
    options?: AIConfigAccessOptions;
  }): Promise<CompleteTableBillCheckoutResult>;

  /** Atomically saves custom floor plan dimensions (width x height ft) and dragged table shapes/coordinates. */
  saveRestaurantFloorLayout(params: {
    businessId: string;
    floorWidthFt: number;
    floorHeightFt: number;
    tables: FloorTableLayoutItem[];
    options?: AIConfigAccessOptions;
  }): Promise<{
    floorWidthFt: number;
    floorHeightFt: number;
    updatedTablesCount: number;
  }>;

  /** Subscribes to live hospitality changes (orders, calls, messages). Returns cleanup unsubscribe callback. */
  subscribeToHospitalityRealtime(
    businessId: string,
    onChange: (event: {
      table: 'restaurant_table_orders' | 'restaurant_table_calls' | 'restaurant_table_messages';
    }) => void,
  ): () => void;

  // ---------------------------------------------------------------------------
  // Master Upgrade II: Individual Staff Roster & Monthly Inventory / Expenses
  // ---------------------------------------------------------------------------

  /** Retrieves the individual Staff & Waiter Roster for a business owner. */
  getRestaurantStaffMembers(
    businessId: string,
    options?: AIConfigAccessOptions,
  ): Promise<RestaurantStaffMember[]>;

  /** Adds a new waiter/cashier/chef/manager with unique Staff Code & personal hashed PIN. */
  createRestaurantStaffMember(
    businessId: string,
    input: RestaurantStaffMemberInput,
    options?: AIConfigAccessOptions,
  ): Promise<RestaurantStaffMember>;

  /** Updates a staff member's name, role, active state, or resets their personal PIN. */
  updateRestaurantStaffMember(
    businessId: string,
    staffId: string,
    input: RestaurantStaffMemberInput,
    options?: AIConfigAccessOptions,
  ): Promise<RestaurantStaffMember>;

  /** Removes a staff member from the business's directory. */
  deleteRestaurantStaffMember(
    businessId: string,
    staffId: string,
    options?: AIConfigAccessOptions,
  ): Promise<void>;

  /**
   * Public safe staff login directory for `/r/:businessSlug/staff`.
   * Returns only `{ id, staffCode, fullName, role }` for active staff (NEVER exposes pinHash).
   */
  getPublicStaffLoginDirectory(
    businessSlug: string,
  ): Promise<PublicStaffLoginOption[]>;

  /**
   * Authenticates an individual staff member by their personal PIN (with optional Staff Code)
   * and returns their personal session `{ staffId, staffCode, fullName, role, staffLabel }`.
   * Backwards compatible with the legacy shared restaurant-level Staff PIN.
   */
  verifyStaffMemberPin(params: {
    businessSlug: string;
    staffCode?: string | null;
    staffPinHash?: string | null;
    options?: AIConfigAccessOptions;
  }): Promise<VerifiedStaffMemberSession>;

  /** Retrieves monthly stock purchase & operating expense entries (filtered by YYYY-MM if provided). */
  getRestaurantMonthlyInventory(
    businessId: string,
    monthKey?: string | null,
    options?: AIConfigAccessOptions,
  ): Promise<RestaurantMonthlyInventoryItem[]>;

  /** Logs a new monthly stock purchase or operating expense entry. */
  createRestaurantMonthlyInventoryItem(
    businessId: string,
    input: RestaurantMonthlyInventoryInput,
    options?: AIConfigAccessOptions,
  ): Promise<RestaurantMonthlyInventoryItem>;

  /** Updates an existing monthly stock or expense entry (including toggling `lowStockAlert`). */
  updateRestaurantMonthlyInventoryItem(
    businessId: string,
    itemId: string,
    input: RestaurantMonthlyInventoryInput,
    options?: AIConfigAccessOptions,
  ): Promise<RestaurantMonthlyInventoryItem>;

  /** Deletes a monthly stock or expense entry. */
  deleteRestaurantMonthlyInventoryItem(
    businessId: string,
    itemId: string,
    options?: AIConfigAccessOptions,
  ): Promise<void>;

  // ---------------------------------------------------------------------------
  // Module 4: Barber & Salon Live Queue Timer, Broadcast Delays & Loyalty
  // ---------------------------------------------------------------------------

  /** Retrieves the 1:1 Barber/Salon Live Queue configuration for a business owner. */
  getBarberQueueConfig(
    businessId: string,
    options?: AIConfigAccessOptions,
  ): Promise<BarberQueueConfig>;

  /** Validates and saves the 1:1 Barber/Salon Live Queue configuration (open/paused, services, caps). */
  updateBarberQueueConfig(
    businessId: string,
    input: BarberQueueConfigInput,
    options?: AIConfigAccessOptions,
  ): Promise<BarberQueueConfig>;

  /** Public live queue telemetry for `/r/:businessSlug/queue` (now serving, waiting list with live wait times, rewards). */
  getPublicBarberQueueStatus(
    businessSlug: string,
  ): Promise<PublicBarberQueueStatusPayload | null>;

  /** Adds a walk-in guest to today's queue with sequential daily token numbering and Loyalty wallet linking. */
  joinBarberQueue(input: JoinBarberQueueInput): Promise<JoinBarberQueueResult>;

  /** Lets a waiting customer voluntarily leave today's queue from their countdown pass. */
  leaveBarberQueueTicket(params: {
    businessSlug: string;
    ticketId: string;
  }): Promise<{
    id: string;
    status: BarberQueueTicketStatus;
    tokenNumber: number;
  }>;

  /** Broadcasts +5/+10/+15/+20/+30 minutes of extra delay to all today's waiting customers. */
  barberExtendQueueTimer(params: {
    businessSlug: string;
    addMinutes: BarberQueueDelayIncrement;
    staffPinHash?: string | null;
    options?: AIConfigAccessOptions;
  }): Promise<ExtendBarberQueueTimerResult>;

  /**
   * Advances a queue ticket ('waiting' -> 'in_chair' -> 'completed' / 'no_show' / 'cancelled').
   * When completed with `awardStarOnCompletion` enabled & a linked customer, idempotently awards Loyalty Stars.
   */
  barberAdvanceQueueTicket(params: {
    businessSlug: string;
    ticketId: string;
    status: BarberQueueTicketStatus;
    staffLabel?: string;
    staffPinHash?: string | null;
    options?: AIConfigAccessOptions;
  }): Promise<AdvanceBarberQueueTicketResult>;

  /** Daily & monthly completed haircut counts and ₹ revenue breakdown by service type. */
  getBarberRevenueAndServiceSummary(
    businessId: string,
    monthKey?: string | null,
    options?: AIConfigAccessOptions,
  ): Promise<BarberRevenueSummary>;

  // ---------------------------------------------------------------------------
  // Module 5: GymOS — Membership, Payment Approvals & 3-Day Renewal Radar
  // ---------------------------------------------------------------------------

  /** Retrieves the 1:1 GymOS configuration (plans, alert window, registration toggle). */
  getGymConfig(
    businessId: string,
    options?: AIConfigAccessOptions,
  ): Promise<GymConfig>;

  /** Validates and saves the 1:1 GymOS configuration for a gym owner. */
  updateGymConfig(
    businessId: string,
    input: GymConfigInput,
    options?: AIConfigAccessOptions,
  ): Promise<GymConfig>;

  /** Public front-desk portal payload for `/r/:businessSlug/gym`. */
  getPublicGymPortal(
    businessSlug: string,
  ): Promise<PublicGymPortalPayload | null>;

  /** Submits a new member registration card as 'pending_approval' (awaiting desk payment). */
  submitGymMemberRegistration(
    input: SubmitGymRegistrationInput,
  ): Promise<GymMember>;

  /** Looks up a returning member's live Digital Gym Pass (days remaining, expiry, check-in status) by phone. */
  lookupGymMemberPass(params: {
    businessSlug: string;
    phone: string;
  }): Promise<GymMember | null>;

  /** Records a 1-tap daily gym check-in with workout focus, streak calculation, & optional PT deduction. */
  gymMemberDailyCheckIn(params: {
    businessSlug: string;
    phone: string;
    workoutFocus?: GymWorkoutFocus;
    memberNote?: string | null;
    isPtSession?: boolean;
    /** Optional explicit YYYY-MM-DD date override for deterministic multi-day tests. */
    checkInDateOverride?: string | null;
  }): Promise<GymDailyCheckInResult>;

  /** Owner dashboard view: live attendance, combined monthly revenue, dues, weekly comparison, PT, retail & leaderboard. */
  getGymOwnerDashboard(
    businessId: string,
    options?: AIConfigAccessOptions,
    monthKey?: string | null,
  ): Promise<GymOwnerDashboardPayload>;

  /** Owner-only member progress history: full timestamped attendance timeline, body journal & workout split breakdown. */
  getGymMemberProgressHistory(params: {
    businessId: string;
    memberId: string;
    monthKey?: string | null;
    options?: AIConfigAccessOptions;
  }): Promise<GymMemberProgressHistory>;

  /** Owner/Trainer update for member trainer notes, fitness goal, and starting/target weights. */
  ownerUpdateGymMemberProfile(params: {
    businessId: string;
    memberId: string;
    trainerNotes?: string | null;
    fitnessGoal?: GymFitnessGoal | null;
    startingWeightKg?: number | null;
    targetWeightKg?: number | null;
    options?: AIConfigAccessOptions;
  }): Promise<GymMember>;

  /** Owner action: approve payment (full or installment) + optional PT package, renew, reject, or suspend member. */
  ownerApproveOrRenewGymMember(params: {
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
  }): Promise<GymMember>;

  /** Collects part or full installment balance due on a member's plan. */
  collectGymBalanceDue(params: {
    businessId: string;
    memberId: string;
    collectedPaise: number;
    paymentMethod?: GymPaymentMethod;
    options?: AIConfigAccessOptions;
  }): Promise<GymMember>;

  /** Pauses ('freeze') or resumes ('resume') a membership, auto-extending endDate by exact paused days on resume. */
  toggleGymMembershipFreeze(params: {
    businessId: string;
    memberId: string;
    action: GymFreezeAction;
    /** Optional YYYY-MM-DD override for deterministic multi-day freeze tests in Mock mode. */
    resumeDateOverride?: string | null;
    options?: AIConfigAccessOptions;
  }): Promise<GymMember>;

  /** Creates a Personal Trainer profile with commission percentage (0-100%). */
  createGymTrainer(
    businessId: string,
    input: GymTrainerInput,
    options?: AIConfigAccessOptions,
  ): Promise<GymTrainer>;

  /** Deletes a Personal Trainer profile from this gym. */
  deleteGymTrainer(
    businessId: string,
    trainerId: string,
    options?: AIConfigAccessOptions,
  ): Promise<void>;

  /** Returns monthly PT sessions delivered & exact commission payouts for all gym trainers. */
  getGymTrainerCommissions(
    businessId: string,
    monthKey?: string | null,
    options?: AIConfigAccessOptions,
  ): Promise<GymTrainerCommissionRow[]>;

  /** Logs a member's 30-day body transformation entry (weight, waist, chest, biceps, BMI). */
  logGymBodyMeasurement(
    input: GymBodyMeasurementInput,
  ): Promise<GymBodyMeasurement>;

  /** Saves a completed guided workout session (exercises, sets, weights, RPE, volume kg & PRs hit). */
  logGymWorkoutSession(
    input: LogGymWorkoutSessionInput,
  ): Promise<GymWorkoutSession>;

  /** Privacy-safe Top-10 Monthly Consistency & Streak Leaderboard for a gym. */
  getGymMonthlyLeaderboard(businessSlug: string): Promise<GymLeaderboardEntry[]>;

  /** Creates a front-desk supplement / protein bar product. */
  createGymRetailProduct(
    businessId: string,
    input: GymRetailProductInput,
    options?: AIConfigAccessOptions,
  ): Promise<GymRetailProduct>;

  /** 1-tap seeds the 4 starter supplement bar items (Whey Scoop, Pre-Workout, Water, Protein Bar). */
  seedGymRetailStarterProducts(
    businessId: string,
    options?: AIConfigAccessOptions,
  ): Promise<GymRetailProduct[]>;

  /** Deletes a front-desk supplement product. */
  deleteGymRetailProduct(
    businessId: string,
    productId: string,
    options?: AIConfigAccessOptions,
  ): Promise<void>;

  /** Records a 2-second supplement / protein bar POS sale & decrements stock. */
  recordGymRetailSale(params: {
    businessId: string;
    productId: string;
    quantity?: number;
    paymentMethod?: GymPaymentMethod;
    memberName?: string | null;
    options?: AIConfigAccessOptions;
  }): Promise<{ sale: GymRetailSale; product: GymRetailProduct }>;

  /** Returns the built-in 24+ gym exercise catalog plus this gym's custom exercises. */
  getGymExerciseCatalog(
    businessId: string,
    options?: AIConfigAccessOptions,
  ): Promise<GymCatalogExercise[]>;

  /** Creates a gym-specific custom exercise in this gym's catalog. */
  createGymCustomExercise(
    businessId: string,
    input: GymCatalogExerciseInput,
    options?: AIConfigAccessOptions,
  ): Promise<GymCatalogExercise>;

  /** Creates a reusable workout routine (e.g., Push/Pull/Legs) and optionally assigns it to a member. */
  createOrAssignGymRoutine(params: {
    businessId: string;
    routineName: string;
    targetGoal?: string;
    exercises: GymRoutineExerciseItem[];
    assignToMemberId?: string | null;
    createdBy?: string;
    options?: AIConfigAccessOptions;
  }): Promise<GymWorkoutRoutine>;

  /** Assigns an existing routine template to a member (or clears it when routineId is null). */
  assignGymRoutineToMember(params: {
    businessId: string;
    memberId: string;
    routineId: string | null;
    options?: AIConfigAccessOptions;
  }): Promise<GymMember>;

  /** Public member workout plan: assigned routine, exercise catalog, today's sets, PRs & weekly volume kg. */
  getGymMemberWorkoutPlan(params: {
    businessSlug: string;
    memberId: string;
  }): Promise<GymMemberWorkoutPlanPayload | null>;

  /** Logs a single exercise set (kg x reps), computes Epley 1RM, detects 🏆 Personal Records & updates daily volume. */
  logGymMemberWorkoutSet(params: {
    businessSlug: string;
    memberId: string;
    exerciseId?: string | null;
    exerciseName: string;
    muscleGroup: string;
    setNumber: number;
    weightKg: number;
    reps: number;
  }): Promise<GymLogSetResult>;

  /** Owner/Trainer progress summary: logged sets, total volume lifted (kg) & all-time PR milestones. */
  getGymMemberWorkoutSummary(params: {
    businessId: string;
    memberId: string;
    options?: AIConfigAccessOptions;
  }): Promise<GymMemberWorkoutSummaryPayload>;

  /** Owner/Trainer creates or updates a member's personalized weekly workout split + nutrition plan and approves it to the member app. */
  upsertAndApproveGymCoachPlan(
    input: UpsertGymCoachPlanInput,
    options?: AIConfigAccessOptions,
  ): Promise<GymCoachPlan>;

  /** Owner/Trainer reads the member's customized Coach Plan (or null if not yet customized). */
  getGymMemberCoachPlanForOwner(params: {
    businessId: string;
    memberId: string;
    options?: AIConfigAccessOptions;
  }): Promise<GymCoachPlan | null>;

  /** Full Athlete Hub payload for the Dark-Mode 5-tab Member PWA (streak, volume, monthly challenges, coach plan, recovery insight, last-session history, PRs, animated catalog). */
  getGymMemberAthleteHub(params: {
    businessSlug: string;
    memberId: string;
  }): Promise<GymMemberAthleteHubPayload | null>;

  // ---------------------------------------------------------------------------
  // Module 7: Dedicated CafeOS (Stamp Pass, Birthday Coffee, Inventory & Counter)
  // ---------------------------------------------------------------------------

  /** Owner dashboard: Cafe config, stamp passes, raw ingredient inventory, audit logs & pickup queue. */
  getCafeOwnerDashboard(
    businessId: string,
    options?: AIConfigAccessOptions,
  ): Promise<CafeOwnerDashboardPayload>;

  /** Owner update for CafeOS stamp card rules, birthday free coffee toggle & UPI ID. */
  updateCafeConfig(
    businessId: string,
    input: CafeConfigInput,
    options?: AIConfigAccessOptions,
  ): Promise<CafeConfig>;

  /** Adds a raw ingredient or packaging item (beans, milk, syrups, cups, bakery). */
  createCafeInventoryItem(
    businessId: string,
    input: CafeInventoryItemInput,
    options?: AIConfigAccessOptions,
  ): Promise<CafeInventoryItem>;

  /** Removes a raw ingredient item from the cafe's inventory tracker. */
  deleteCafeInventoryItem(
    businessId: string,
    itemId: string,
    options?: AIConfigAccessOptions,
  ): Promise<void>;

  /** 1-tap seeds the 6 essential cafe ingredients if not already present. */
  seedCafeInventoryStarterPack(
    businessId: string,
    options?: AIConfigAccessOptions,
  ): Promise<CafeInventoryItem[]>;

  /** Atomically records a restock, shift usage, or wastage adjustment with audit log. */
  adjustCafeInventoryStock(params: {
    businessId: string;
    itemId: string;
    actionType: CafeInventoryActionType;
    quantity: number;
    costPaise?: number;
    note?: string | null;
    loggedBy?: string | null;
    options?: AIConfigAccessOptions;
  }): Promise<{ item: CafeInventoryItem; log: CafeInventoryLog }>;

  /** Owner 1-tap redemption of a free stamp drink or annual birthday free coffee. */
  redeemCafePassReward(params: {
    businessId: string;
    passId: string;
    rewardType: CafeRewardRedemptionType;
    options?: AIConfigAccessOptions;
  }): Promise<CafeStampPass>;

  /** Updates a CafeOS counter pickup order token (#C-01) status (queued -> preparing -> ready -> picked_up). */
  updateCafeCounterOrderStatus(params: {
    businessId: string;
    orderId: string;
    status: CafeCounterOrderStatus;
    options?: AIConfigAccessOptions;
  }): Promise<CafeCounterOrder>;

  /** Public customer cafe hub: stamp rules, active drinks menu, and live digital coffee stamp card. */
  getPublicCafeHub(
    businessSlug: string,
    phone?: string | null,
  ): Promise<PublicCafeHubPayload | null>;

  /** Public 30s rotating counter QR stamp claim (validates time bucket + signature + 3h cooldown). */
  claimCafeCounterStamp(params: {
    businessSlug: string;
    customerName: string;
    phone: string;
    birthMonth?: number | null;
    birthDay?: number | null;
    timeBucket: number;
    tokenSig: string;
    /** Optional bypass for deterministic multi-stamp unit tests in Mock mode only. */
    bypassCooldownForTest?: boolean;
  }): Promise<ClaimCafeStampResponse>;

  /** Public guest counter quick-order generating a daily #C-01 pickup token. */
  submitCafeCounterOrder(params: {
    businessSlug: string;
    customerName: string;
    phone?: string | null;
    items: Array<{ itemId: string; quantity: number }>;
    orderNote?: string | null;
  }): Promise<CafeCounterOrder>;
}
