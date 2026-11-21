import type { Business } from './business';

export type RestaurantCurrencyCode =
  | 'INR'
  | 'USD'
  | 'EUR'
  | 'GBP'
  | 'AED'
  | 'SGD';

export type DietaryTag = 'veg' | 'non_veg' | 'egg' | 'vegan' | 'none';

export const RESTAURANT_LIMITS = {
  TAGLINE_MAX_LENGTH: 160,
  TABLE_NUMBER_MAX_LENGTH: 40,
  TABLE_LABEL_MAX_LENGTH: 80,
  TABLE_KEY_MAX_LENGTH: 40,
  CATEGORY_NAME_MAX_LENGTH: 80,
  CATEGORY_DESCRIPTION_MAX_LENGTH: 240,
  ITEM_NAME_MAX_LENGTH: 100,
  ITEM_DESCRIPTION_MAX_LENGTH: 300,
  ITEM_MAX_PRICE_PAISE: 100_000_000, // 10,00,000.00 in major units
  MAX_TABLES_PER_BUSINESS: 200,
  MAX_CATEGORIES_PER_BUSINESS: 50,
  MAX_ITEMS_PER_BUSINESS: 500,
} as const;

export interface RestaurantProfile {
  businessId: string;
  isEnabled: boolean;
  currencyCode: RestaurantCurrencyCode;
  tagline: string | null;
  gamesEnabled: boolean;
  loyaltyEnabled: boolean;
  /** Optional SHA-256 hex hash of a 4-6 digit Staff PIN for Staff Verification Mode. */
  staffPinHash?: string | null;
  /** Minimum hours between verified visit star awards for the same diner (default 4). */
  minHoursBetweenVisitStars?: number;
  updatedAt: string;
  storageSource?: 'supabase' | 'local';
}

export interface RestaurantProfileInput {
  isEnabled: boolean;
  currencyCode?: RestaurantCurrencyCode;
  tagline?: string | null;
  gamesEnabled?: boolean;
  loyaltyEnabled?: boolean;
  staffPinHash?: string | null;
  minHoursBetweenVisitStars?: number;
}

export interface RestaurantTable {
  id: string;
  businessId: string;
  tableNumber: string;
  tableLabel: string | null;
  tableKey: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface RestaurantTableInput {
  tableNumber: string;
  tableLabel?: string | null;
  tableKey?: string;
  isActive?: boolean;
}

export interface RestaurantMenuCategory {
  id: string;
  businessId: string;
  name: string;
  description: string | null;
  displayOrder: number;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface RestaurantMenuCategoryInput {
  name: string;
  description?: string | null;
  displayOrder?: number;
  isActive?: boolean;
}

export interface RestaurantMenuItem {
  id: string;
  businessId: string;
  categoryId: string;
  name: string;
  description: string | null;
  pricePaise: number;
  dietaryTag: DietaryTag;
  isAvailable: boolean;
  isFeatured: boolean;
  imageUrl: string | null;
  displayOrder: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface RestaurantMenuItemInput {
  categoryId: string;
  name: string;
  description?: string | null;
  pricePaise: number;
  dietaryTag?: DietaryTag;
  isAvailable?: boolean;
  isFeatured?: boolean;
  imageUrl?: string | null;
  displayOrder?: number;
}

export interface PublicRestaurantMenuPayload {
  business: Pick<
    Business,
    'id' | 'slug' | 'name' | 'category' | 'city' | 'googleReviewUrl'
  >;
  profile: RestaurantProfile;
  table: RestaurantTable | null;
  categories: RestaurantMenuCategory[];
  items: RestaurantMenuItem[];
  games?: RestaurantGameConfig[];
  loyaltyRules?: RestaurantLoyaltyRules;
  rewards?: RestaurantReward[];
}

// ===========================================================================
// Phase 2: Customer Identity, Restaurant Games & Secure Game-Points Ledger
// ===========================================================================

export type RestaurantGameSlug =
  | 'dish-trivia'
  | 'memory-match'
  | 'table-word-chain'
  | 'speed-tap';

export type RestaurantGameCategory =
  | 'solo'
  | 'same_table'
  | 'restaurant_wide';

export type RestaurantGameSessionStatus =
  | 'in_progress'
  | 'completed'
  | 'expired';

export type RestaurantGamePointTxType =
  | 'game_win'
  | 'exchanged_for_star'
  | 'owner_adjustment'
  | 'expired';

export interface RestaurantTriviaQuestion {
  prompt: string;
  options: string[];
  correctIndex: number;
}

export interface RestaurantGameConfig {
  id: string;
  businessId: string;
  gameSlug: RestaurantGameSlug;
  title: string;
  category: RestaurantGameCategory;
  isEnabled: boolean;
  pointsPerWin: number;
  maxPointsPerDayPerCustomer: number;
  cooldownMinutes: number;
  customQuestions: RestaurantTriviaQuestion[] | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface RestaurantGameConfigInput {
  gameSlug: RestaurantGameSlug;
  title?: string;
  category?: RestaurantGameCategory;
  isEnabled: boolean;
  pointsPerWin: number;
  maxPointsPerDayPerCustomer: number;
  cooldownMinutes: number;
  customQuestions?: RestaurantTriviaQuestion[] | null;
}

export interface RestaurantCustomer {
  id: string;
  displayName: string;
  phoneOrEmail: string | null;
  guestTokenHash?: string | null;
  createdAt: string;
}

export interface RestaurantCustomerCheckInInput {
  displayName: string;
  phoneOrEmail?: string | null;
  guestTokenHash?: string | null;
  businessSlug?: string | null;
}

export interface RestaurantGamePointTransaction {
  id: string;
  businessId: string;
  customerId: string;
  sessionId: string | null;
  txType: RestaurantGamePointTxType;
  pointsDelta: number;
  balanceAfter: number;
  idempotencyKey: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface RestaurantCustomerWalletState {
  customer: RestaurantCustomer;
  /** Separate balance strictly for Game Points (never mixed with Loyalty Stars). */
  gamePointsBalance: number;
  recentTransactions: RestaurantGamePointTransaction[];
  /** Separate balance strictly for Restaurant Loyalty Stars. */
  loyaltyStarsBalance?: number;
  /** Number of Loyalty Stars earned via point exchange in the rolling 7-day window. */
  starsExchangedThisWeek?: number;
  recentStarTransactions?: RestaurantLoyaltyStarTransaction[];
  rewardClaims?: RestaurantRewardClaim[];
}

export interface RestaurantClientTriviaPrompt {
  index: number;
  prompt: string;
  options: string[];
}

export interface RestaurantClientTableRoundPrompt {
  round: number;
  prompt: string;
  options: string[];
}

export interface RestaurantGameClientChallenge {
  gameSlug: RestaurantGameSlug;
  /** For 'dish-trivia' — note: correctIndex is stripped and kept only on the server! */
  questions?: RestaurantClientTriviaPrompt[];
  /** For 'memory-match' */
  pairsRequired?: number;
  maxMovesAllowed?: number;
  cards?: string[];
  /** For 'table-word-chain' */
  rounds?: RestaurantClientTableRoundPrompt[];
}

export interface RestaurantGameSession {
  id: string;
  businessId: string;
  tableId: string | null;
  customerId: string;
  gameSlug: RestaurantGameSlug;
  status: RestaurantGameSessionStatus;
  serverSeed: Record<string, unknown>;
  score: number;
  pointsAwarded: number;
  startedAt: string;
  completedAt: string | null;
}

export interface RestaurantGameStartResponse {
  sessionId: string;
  businessId: string;
  gameSlug: RestaurantGameSlug;
  title: string;
  pointsPerWin: number;
  challenge: RestaurantGameClientChallenge;
}

export interface RestaurantGameSubmissionInput {
  /** Selected option indices for trivia or table word chain */
  answers?: number[];
  /** For memory-match */
  matchedPairs?: number;
  movesTaken?: number;
}

export interface RestaurantGameCompletionResponse {
  sessionId: string;
  alreadyProcessed: boolean;
  passed: boolean;
  score: number;
  pointsAwarded: number;
  newBalance: number;
  transactionId: string | null;
}

export interface RestaurantGameParticipationStats {
  totalSessionsPlayed: number;
  sessionsCompletedToday: number;
  gamePointsIssuedToday: number;
  totalGamePointsIssued: number;
}

// ===========================================================================
// Phase 3: Loyalty Stars Ledger, Point-to-Star Exchange & Reward Catalogue
// ===========================================================================

export type RestaurantLoyaltyStarTxType =
  | 'verified_visit'
  | 'game_point_exchange'
  | 'reward_redeemed'
  | 'owner_adjustment'
  | 'expired';

export type RestaurantRewardClaimStatus =
  | 'pending_staff_verification'
  | 'fulfilled'
  | 'cancelled';

export interface RestaurantLoyaltyRules {
  businessId: string;
  starsPerVerifiedVisit: number;
  pointsPerStarExchange: number;
  allowPointExchange: boolean;
  maxStarsViaExchangePerWeek: number;
  wifiNetworkName: string | null;
  wifiPassword: string | null;
  suggestionBoxEnabled: boolean;
  updatedAt: string;
}

export interface RestaurantLoyaltyRulesInput {
  starsPerVerifiedVisit: number;
  pointsPerStarExchange: number;
  allowPointExchange: boolean;
  maxStarsViaExchangePerWeek: number;
  wifiNetworkName?: string | null;
  wifiPassword?: string | null;
  suggestionBoxEnabled?: boolean;
}

export interface RestaurantLoyaltyStarTransaction {
  id: string;
  businessId: string;
  customerId: string;
  txType: RestaurantLoyaltyStarTxType;
  starsDelta: number;
  balanceAfter: number;
  idempotencyKey: string;
  verifiedByStaffLabel?: string | null;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface RestaurantReward {
  id: string;
  businessId: string;
  title: string;
  description: string | null;
  starsRequired: number;
  isActive: boolean;
  maxRedemptionsTotal: number | null;
  redemptionsCount: number;
  displayOrder: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface RestaurantRewardInput {
  title: string;
  description?: string | null;
  starsRequired: number;
  isActive?: boolean;
  maxRedemptionsTotal?: number | null;
  displayOrder?: number;
}

export interface RestaurantRewardClaim {
  id: string;
  businessId: string;
  customerId: string;
  rewardId: string;
  rewardTitle?: string;
  claimCode: string;
  starsSpent: number;
  status: RestaurantRewardClaimStatus;
  fulfilledAt?: string | null;
  fulfilledBy?: string | null;
  createdAt: string;
}

export interface RestaurantPointToStarExchangeResponse {
  alreadyProcessed: boolean;
  pointsSpent: number;
  starsEarned: number;
  newGamePointsBalance: number;
  newLoyaltyStarsBalance: number;
  starTransactionId: string;
}

export interface RestaurantRewardClaimResponse {
  alreadyProcessed: boolean;
  newLoyaltyStarsBalance: number;
  claim: RestaurantRewardClaim;
}

export interface RestaurantSuggestion {
  id: string;
  businessId: string;
  tableId: string | null;
  customerName: string | null;
  message: string;
  isRead: boolean;
  createdAt: string;
}

export interface RestaurantSuggestionInput {
  businessSlug: string;
  tableKey?: string | null;
  customerName?: string | null;
  message: string;
}

// ===========================================================================
// Phase 4: Visual Table Floor Map, Staff Verification Mode & Owner Analytics
// ===========================================================================

export type RestaurantTableCallType = 'assistance' | 'ready_for_bill';

export type RestaurantTableCallStatus = 'open' | 'acknowledged' | 'resolved';

export interface RestaurantTableCall {
  id: string;
  businessId: string;
  tableId: string;
  tableNumber: string;
  tableKey: string;
  customerId: string | null;
  callType: RestaurantTableCallType;
  status: RestaurantTableCallStatus;
  staffNote?: string | null;
  createdAt: string;
  resolvedAt?: string | null;
}

export interface RestaurantVerifiedVisit {
  id: string;
  businessId: string;
  tableId: string | null;
  customerId: string;
  customerName?: string;
  starsAwarded: number;
  verifiedByLabel: string;
  idempotencyKey: string;
  createdAt: string;
}

export interface RestaurantStaffAwardVisitResponse {
  alreadyProcessed: boolean;
  visitId: string;
  customerId: string;
  customerName: string;
  starsAwarded: number;
  newLoyaltyStarsBalance: number;
  verifiedByLabel: string;
  createdAt: string;
}

export interface RestaurantEngagementAnalytics {
  /** Public QR scans — explicitly separated from verified paid visits. */
  qrScans: number;
  /** Unique diners who checked in to play games or collect stars. */
  checkedInDiners: number;
  /** Completed table game sessions. */
  gamesPlayed: number;
  /** Total verified Game Points earned by diners. */
  gamePointsIssued: number;
  /** Explicit staff/owner-verified paid dining visits. */
  verifiedPaidVisits: number;
  /** Total Loyalty Stars issued across verified visits & point exchanges. */
  loyaltyStarsIssued: number;
  /** Total reward claim tickets created by diners. */
  rewardsClaimed: number;
  /** Reward claim tickets verified & fulfilled by staff. */
  rewardsFulfilled: number;
}

export interface RestaurantFloorAndAnalyticsPayload {
  activeTableCalls: RestaurantTableCall[];
  pendingRewardClaims: Array<
    RestaurantRewardClaim & { customerName?: string }
  >;
  analytics: RestaurantEngagementAnalytics;
}
