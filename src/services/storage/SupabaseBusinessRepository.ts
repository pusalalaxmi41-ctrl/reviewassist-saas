import type {
  AccountLifecycleState,
  AnalyticsEvent,
  AnalyticsEventType,
  Business,
  BusinessCategory,
  BusinessMetrics,
  BusinessStatus,
  CustomerDraftRecord,
  ExperienceInputMode,
  ResponseWorkflowStatus,
  ReviewFontStyle,
  ReviewSentiment,
} from '../../types/business';
import type {
  AICommunicationTone,
  AILanguageCode,
  AIResponseLength,
  BusinessAIConfig,
  BusinessAIConfigInput,
} from '../../types/aiConfig';
import type {
  BusinessKnowledgeInput,
  BusinessKnowledgeProfile,
  BusinessProductItem,
  BusinessServiceItem,
} from '../../types/businessKnowledge';
import type {
  ApplyMenuPresetResult,
  CompleteTableBillCheckoutResult,
  CreatePosOrPlatformOrderInput,
  DietaryTag,
  DishSpiceLevel,
  FloorTableLayoutItem,
  MenuPresetKey,
  MenuThemeTemplate,
  MonthlyInventoryEntryType,
  OpenTableBillSummary,
  PublicRestaurantMenuPayload,
  PublicStaffLoginOption,
  RestaurantBusinessMode,
  RestaurantCurrencyCode,
  RestaurantCustomerCheckInInput,
  RestaurantCustomerWalletState,
  RestaurantFloorAndAnalyticsPayload,
  RestaurantGameCategory,
  RestaurantGameCompletionResponse,
  RestaurantGameConfig,
  RestaurantGameConfigInput,
  RestaurantGameParticipationStats,
  RestaurantGameSlug,
  RestaurantGameStartResponse,
  RestaurantGameSubmissionInput,
  RestaurantLocationType,
  RestaurantLoyaltyRules,
  RestaurantLoyaltyRulesInput,
  RestaurantMenuCategory,
  RestaurantMenuCategoryInput,
  RestaurantMenuItem,
  RestaurantMenuItemInput,
  RestaurantMonthlyInventoryInput,
  RestaurantMonthlyInventoryItem,
  RestaurantOrderSource,
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
  RestaurantStaffRole,
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
  RestaurantTriviaQuestion,
  VerifiedStaffMemberSession,
} from '../../types/restaurant';
import type {
  AdvanceBarberQueueTicketResult,
  BarberQueueConfig,
  BarberQueueConfigInput,
  BarberQueueDelayIncrement,
  BarberQueueService,
  BarberQueueTicketStatus,
  BarberRevenueSummary,
  ExtendBarberQueueTimerResult,
  JoinBarberQueueInput,
  JoinBarberQueueResult,
  PublicBarberQueueStatusPayload,
} from '../../types/barberQueue';
import {
  normalizeBarberQueueConfig,
  validateBarberDelayMinutes,
  validateBarberQueueConfigInput,
  validateBarberTicketStatus,
  validateJoinBarberQueueInput,
} from '../../utils/barberQueueValidation';
import type {
  GymAnimationKey,
  GymBodyMeasurement,
  GymBodyMeasurementInput,
  GymCatalogExercise,
  GymCatalogExerciseInput,
  GymCoachPlan,
  GymCommunityMessage,
  GymCommunityMessageType,
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
  GymMembersCommunityHubPayload,
  GymMemberWorkoutPlanPayload,
  GymMemberWorkoutSummaryPayload,
  GymOwnerDashboardPayload,
  GymOwnerMemberAction,
  GymPaymentMethod,
  GymPlan,
  GymPreferredShift,
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
  MemberCreateCustomExerciseInput,
  OwnerUpdateGymBrandingInput,
  OwnerUpsertExerciseMediaInput,
  PublicGymPortalPayload,
  SubmitGymRegistrationInput,
  UpdateMemberSelfPlanInput,
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
import type {
  ClaimLoyaltyStarResponse,
  LoyaltyMemberCard,
  LoyaltyOwnerDashboardPayload,
  LoyaltyProgramConfig,
  LoyaltyProgramConfigInput,
  LoyaltySourceChannel,
  PublicLoyaltyHubPayload,
} from '../../types/loyalty';
import {
  normalizeLoyaltyPhone,
  validateLoyaltyConfigInput,
} from '../../utils/loyaltyValidation';
import type {
  AssignClinicPackageInput,
  CheckinClinicTokenInput,
  CheckinClinicTokenResult,
  ClinicConfig,
  ClinicConfigInput,
  ClinicDoctor,
  ClinicDoctorInput,
  ClinicOwnerDashboardPayload,
  ClinicPatient,
  ClinicPaymentMethod,
  ClinicVisitAndQueue,
  ClinicVisitStatus,
  ClinicVitals,
  CompleteClinicConsultationInput,
  CompleteClinicConsultationResult,
  PublicClinicHubPayload,
} from '../../types/clinic';
import {
  normalizeClinicPhone,
  sanitizeClinicVitals,
  sanitizePrescriptionItems,
  validateClinicConfigInput,
  validateClinicDoctorInput,
} from '../../utils/clinicValidation';
import type {
  CateringChefKitchenPortalPayload,
  CateringConfig,
  CateringConfigInput,
  CateringDishAndRecipe,
  CateringDishAndRecipeInput,
  CateringKitchenChecklist,
  CateringOrder,
  CateringOrderStatus,
  CateringOwnerDashboardPayload,
  CateringPackage,
  CateringPackageInput,
  CateringPaymentMethod,
  CateringPaymentStage,
  CateringVesselDispatchLine,
  PublicCateringPortalPayload,
  SubmitCateringOrderInput,
} from '../../types/catering';
import {
  computeCateringGroceryShoppingList,
  validateCateringConfigInput,
  validateCateringDishInput,
  validateCateringPackageInput,
} from '../../utils/cateringValidation';
import {
  CAFE_INVENTORY_STARTER_PACK,
  createDefaultCafeConfig,
  isBirthdayTodayForPass,
  normalizeCafePhone,
  validateCafeConfigInput,
  validateCafeInventoryAction,
  validateCafeInventoryItemInput,
} from '../../utils/cafeValidation';
import {
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
import { MENU_PRESET_PACKS } from '../../config/menuPresets';
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
  deriveTableKey,
  generateNextStaffCode,
  getDefaultRestaurantGameConfigs,
  normalizeRestaurantLoyaltyRules,
  normalizeRestaurantProfile,
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
} from '../../utils/restaurantValidation';
import {
  filterActiveRetentionDrafts,
  validateResponseWorkflowUpdate,
} from '../../utils/reviewResponseValidation';
import { supabase } from '../../lib/supabase';
import type {
  AIConfigAccessOptions,
  IBusinessRepository,
} from './BusinessRepository';
import {
  businessRepository as mockBusinessRepository,
  type MockLocalStorageRepository,
} from './MockLocalStorageRepository';

interface DbBusinessRow {
  id: string;
  owner_id?: string;
  slug: string;
  name: string;
  category: BusinessCategory;
  city: string;
  google_review_url: string;
  google_review_url_is_placeholder: boolean;
  review_font?: ReviewFontStyle;
  loyalty_enabled?: boolean;
  status?: BusinessStatus;
  status_changed_at?: string;
  status_reason?: string | null;
  account_state?: AccountLifecycleState;
  deletion_requested_at?: string | null;
  deletion_scheduled_for?: string | null;
  deleted_reason?: string | null;
  created_at: string;
}

interface DbAnalyticsEventRow {
  id: string;
  business_id: string;
  event_type: AnalyticsEventType;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

interface DbCustomerDraftRow {
  id: string;
  business_id: string;
  original_input: string;
  generated_review: string;
  mode: ExperienceInputMode;
  sentiment: ReviewSentiment;
  created_at: string;
  owner_response_draft?: string | null;
  response_status?: ResponseWorkflowStatus;
  response_attempt?: number;
  response_generated_at?: string | null;
  response_approved_at?: string | null;
  response_completed_at?: string | null;
  response_updated_at?: string | null;
}

interface DraftResponseOverlayEntry {
  businessId: string;
  ownerResponseDraft: string | null;
  responseStatus: ResponseWorkflowStatus;
  responseAttempt: number;
  responseGeneratedAt: string | null;
  responseApprovedAt: string | null;
  responseCompletedAt: string | null;
  responseUpdatedAt: string | null;
}

const LOCAL_DRAFT_RESPONSE_OVERLAY_KEY = 'reviewassist_draft_response_overlay_v1';

function readLocalDraftResponseOverlay(): Record<string, DraftResponseOverlayEntry> {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const raw = window.localStorage.getItem(LOCAL_DRAFT_RESPONSE_OVERLAY_KEY);
      if (raw) return JSON.parse(raw) as Record<string, DraftResponseOverlayEntry>;
    }
  } catch {
    // ignore
  }
  return {};
}

function writeLocalDraftResponseOverlay(
  draftId: string,
  entry: DraftResponseOverlayEntry,
): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const current = readLocalDraftResponseOverlay();
      current[draftId] = entry;
      window.localStorage.setItem(
        LOCAL_DRAFT_RESPONSE_OVERLAY_KEY,
        JSON.stringify(current),
      );
    }
  } catch {
    // ignore
  }
}

interface DbBusinessAISettingsRow {
  business_id: string;
  ai_tone: AICommunicationTone;
  ai_custom_instructions: string;
  ai_response_length: AIResponseLength;
  ai_language: AILanguageCode;
  created_at: string;
  updated_at: string;
}

const LOCAL_AI_CONFIG_OVERLAY_KEY = 'reviewassist_ai_config_overlay_v1';
const LOCAL_KNOWLEDGE_OVERLAY_KEY = 'reviewassist_knowledge_overlay_v1';

function readLocalKnowledgeOverlay(): Record<string, BusinessKnowledgeProfile> {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const raw = window.localStorage.getItem(LOCAL_KNOWLEDGE_OVERLAY_KEY);
      if (raw) return JSON.parse(raw) as Record<string, BusinessKnowledgeProfile>;
    }
  } catch {
    // ignore
  }
  return {};
}

function writeLocalKnowledgeOverlay(
  businessId: string,
  profile: BusinessKnowledgeProfile,
): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const current = readLocalKnowledgeOverlay();
      current[businessId] = profile;
      window.localStorage.setItem(
        LOCAL_KNOWLEDGE_OVERLAY_KEY,
        JSON.stringify(current),
      );
    }
  } catch {
    // ignore
  }
}

function readLocalAIConfigOverlay(): Record<string, BusinessAIConfig> {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const raw = window.localStorage.getItem(LOCAL_AI_CONFIG_OVERLAY_KEY);
      if (raw) return JSON.parse(raw) as Record<string, BusinessAIConfig>;
    }
  } catch {
    // ignore
  }
  return {};
}

function writeLocalAIConfigOverlay(
  businessId: string,
  config: BusinessAIConfig,
): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const current = readLocalAIConfigOverlay();
      current[businessId] = config;
      window.localStorage.setItem(
        LOCAL_AI_CONFIG_OVERLAY_KEY,
        JSON.stringify(current),
      );
    }
  } catch {
    // ignore
  }
}

const LOCAL_STATUS_OVERLAY_KEY = 'reviewassist_status_overlay_v1';
const LOCAL_LOYALTY_ENABLED_OVERLAY_KEY =
  'reviewassist_loyalty_enabled_overlay_v1';

interface StatusOverlayEntry {
  status: BusinessStatus;
  statusChangedAt: string;
  statusReason: string | null;
  accountState: AccountLifecycleState;
  deletionRequestedAt: string | null;
  deletionScheduledFor: string | null;
  deletedReason: string | null;
  loyaltyEnabled?: boolean;
}

export function readLocalLoyaltyEnabledOverlay(): Record<string, boolean> {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const raw = window.localStorage.getItem(LOCAL_LOYALTY_ENABLED_OVERLAY_KEY);
      if (raw) return JSON.parse(raw) as Record<string, boolean>;
    }
  } catch {
    // ignore
  }
  return {};
}

export function writeLocalLoyaltyEnabledOverlay(
  businessId: string,
  enabled: boolean,
): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const current = readLocalLoyaltyEnabledOverlay();
      current[businessId] = enabled;
      window.localStorage.setItem(
        LOCAL_LOYALTY_ENABLED_OVERLAY_KEY,
        JSON.stringify(current),
      );
    }
  } catch {
    // ignore
  }
}

export function readLocalStatusOverlay(): Record<string, StatusOverlayEntry> {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const raw = window.localStorage.getItem(LOCAL_STATUS_OVERLAY_KEY);
      if (raw) return JSON.parse(raw) as Record<string, StatusOverlayEntry>;
    }
  } catch {
    // ignore
  }
  return {};
}

export function writeLocalStatusOverlay(
  businessId: string,
  entry: StatusOverlayEntry,
): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const current = readLocalStatusOverlay();
      current[businessId] = entry;
      window.localStorage.setItem(LOCAL_STATUS_OVERLAY_KEY, JSON.stringify(current));
    }
  } catch {
    // ignore
  }
}

function mapBusinessRow(row: DbBusinessRow): Business {
  const overlay = readLocalStatusOverlay()[row.id];
  const loyaltyOverlay = readLocalLoyaltyEnabledOverlay();
  const resolvedLoyaltyEnabled =
    typeof row.loyalty_enabled === 'boolean'
      ? row.loyalty_enabled
      : typeof overlay?.loyaltyEnabled === 'boolean'
        ? overlay.loyaltyEnabled
        : typeof loyaltyOverlay[row.id] === 'boolean'
          ? loyaltyOverlay[row.id]
          : row.category === 'loyalty';
  return {
    id: row.id,
    ownerId: row.owner_id,
    slug: row.slug,
    name: row.name,
    category: row.category,
    city: row.city,
    googleReviewUrl: row.google_review_url,
    googleReviewUrlIsPlaceholder: row.google_review_url_is_placeholder,
    reviewFont: row.review_font ?? 'classic',
    loyaltyEnabled: resolvedLoyaltyEnabled,
    status: row.status ?? overlay?.status ?? 'active',
    statusChangedAt: row.status_changed_at ?? overlay?.statusChangedAt ?? row.created_at,
    statusReason:
      row.status_reason !== undefined ? row.status_reason : (overlay?.statusReason ?? null),
    accountState: row.account_state ?? overlay?.accountState ?? 'active',
    deletionRequestedAt:
      row.deletion_requested_at !== undefined
        ? row.deletion_requested_at
        : (overlay?.deletionRequestedAt ?? null),
    deletionScheduledFor:
      row.deletion_scheduled_for !== undefined
        ? row.deletion_scheduled_for
        : (overlay?.deletionScheduledFor ?? null),
    deletedReason:
      row.deleted_reason !== undefined
        ? row.deleted_reason
        : (overlay?.deletedReason ?? null),
    createdAt: row.created_at,
  };
}

export class SupabaseBusinessRepository implements IBusinessRepository {
  private readonly slugByIdCache = new Map<string, string>();

  private requireClient() {
    if (!supabase) {
      throw new Error('Supabase client is not configured.');
    }
    return supabase;
  }

  private rememberBusiness(business: Business): Business {
    this.slugByIdCache.set(business.id, business.slug);
    return business;
  }

  async getBusinesses(): Promise<Business[]> {
    const client = this.requireClient();
    const { data, error } = await client
      .from('businesses')
      .select('*')
      .order('created_at', { ascending: false });

    if (error || !data) {
      return [];
    }

    return (data as DbBusinessRow[]).map((row) =>
      this.rememberBusiness(mapBusinessRow(row)),
    );
  }

  async getBusinessById(id: string): Promise<Business | null> {
    const client = this.requireClient();
    const { data, error } = await client
      .from('businesses')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error || !data) {
      return null;
    }

    return this.rememberBusiness(mapBusinessRow(data as DbBusinessRow));
  }

  async getBusinessBySlug(slug: string): Promise<Business | null> {
    const client = this.requireClient();
    const cleanSlug = slug.trim().toLowerCase();
    if (!cleanSlug) return null;

    // Fast Path: Direct hardened PostgreSQL RPC lookup (returns loyalty_enabled & avoids Edge cold-start/rate-limit)
    if (/^[a-z0-9-]{3,80}$/.test(cleanSlug)) {
      try {
        const { data: rpcRows, error: rpcErr } = await client.rpc(
          'get_public_business_by_slug',
          { p_slug: cleanSlug },
        );
        if (!rpcErr && Array.isArray(rpcRows)) {
          const row = rpcRows[0] as DbBusinessRow | undefined;
          if (!row) {
            const demoFallback = await mockBusinessRepository.getBusinessBySlug(
              cleanSlug,
            );
            return demoFallback ? this.rememberBusiness(demoFallback) : null;
          }
          const loyaltyOverlay = readLocalLoyaltyEnabledOverlay();
          return this.rememberBusiness({
            id: row.id,
            slug: row.slug,
            name: row.name,
            category: row.category,
            city: row.city,
            googleReviewUrl: row.google_review_url,
            googleReviewUrlIsPlaceholder: Boolean(
              row.google_review_url_is_placeholder,
            ),
            reviewFont: row.review_font ?? 'classic',
            loyaltyEnabled:
              typeof row.loyalty_enabled === 'boolean'
                ? row.loyalty_enabled
                : (loyaltyOverlay[row.id] ?? row.category === 'loyalty'),
            status: 'active',
            accountState: 'active',
            createdAt: row.created_at,
          });
        }
      } catch {
        // fall through to Edge Function lookup
      }
    }

    const { data, error } = await client.functions.invoke<{ business?: Business }>(
      'public-business-lookup',
      { body: { slug: cleanSlug } },
    );

    if (error || !data?.business) {
      // Fallback 1: Direct PostgreSQL RPC lookup (bypasses Edge Function 30/hr lookup limit)
      if (/^[a-z0-9-]{3,80}$/.test(cleanSlug)) {
        try {
          const { data: queuePayload, error: queueErr } = await client.rpc(
            'get_public_barber_queue_status',
            { p_slug: cleanSlug },
          );
          if (
            !queueErr &&
            queuePayload &&
            typeof queuePayload === 'object' &&
            'business' in (queuePayload as Record<string, unknown>)
          ) {
            const b = (queuePayload as PublicBarberQueueStatusPayload).business;
            const loyaltyOverlay = readLocalLoyaltyEnabledOverlay();
            return this.rememberBusiness({
              id: b.id,
              slug: b.slug,
              name: b.name,
              category: b.category,
              city: b.city,
              googleReviewUrl: b.googleReviewUrl,
              googleReviewUrlIsPlaceholder: false,
              loyaltyEnabled: loyaltyOverlay[b.id] ?? b.category === 'loyalty',
              status: 'active',
              accountState: 'active',
              createdAt: new Date().toISOString(),
            });
          }
        } catch {
          // ignore and fall through to demo fallback
        }
      }

      const demoFallback = await mockBusinessRepository.getBusinessBySlug(cleanSlug);
      if (demoFallback) {
        return this.rememberBusiness(demoFallback);
      }
      return null;
    }

    const biz = data.business;
    const overlay = readLocalStatusOverlay()[biz.id];
    const loyaltyOverlay = readLocalLoyaltyEnabledOverlay();
    const effectiveStatus = biz.status ?? overlay?.status ?? 'active';
    const effectiveAccountState = biz.accountState ?? overlay?.accountState ?? 'active';

    // Only 'active' businesses with 'active' accountState can be served publicly
    if (effectiveStatus !== 'active' || effectiveAccountState !== 'active') {
      return null;
    }

    return this.rememberBusiness({
      ...biz,
      loyaltyEnabled:
        typeof biz.loyaltyEnabled === 'boolean'
          ? biz.loyaltyEnabled
          : (loyaltyOverlay[biz.id] ?? biz.category === 'loyalty'),
      status: effectiveStatus,
      accountState: effectiveAccountState,
    });
  }

  async createBusiness(data: Omit<Business, 'id' | 'createdAt'>): Promise<Business> {
    const client = this.requireClient();
    const {
      data: { user },
    } = await client.auth.getUser();

    if (!user) {
      throw new Error('Please sign in as a business owner before registering a business.');
    }

    const initialLoyaltyEnabled =
      typeof data.loyaltyEnabled === 'boolean'
        ? data.loyaltyEnabled
        : data.category === 'loyalty';

    let { data: inserted, error } = await client
      .from('businesses')
      .insert({
        owner_id: user.id,
        slug: data.slug.trim().toLowerCase(),
        name: data.name.trim(),
        category: data.category,
        city: data.city.trim(),
        google_review_url: data.googleReviewUrl.trim(),
        google_review_url_is_placeholder: Boolean(data.googleReviewUrlIsPlaceholder),
        loyalty_enabled: initialLoyaltyEnabled,
      })
      .select('*')
      .single();

    if (error && error.message?.includes('loyalty_enabled')) {
      const retry = await client
        .from('businesses')
        .insert({
          owner_id: user.id,
          slug: data.slug.trim().toLowerCase(),
          name: data.name.trim(),
          category: data.category,
          city: data.city.trim(),
          google_review_url: data.googleReviewUrl.trim(),
          google_review_url_is_placeholder: Boolean(data.googleReviewUrlIsPlaceholder),
        })
        .select('*')
        .single();
      inserted = retry.data;
      error = retry.error;
    }

    if (error || !inserted) {
      if (error?.code === '23505') {
        throw new Error(
          `The URL slug "/r/${data.slug.trim().toLowerCase()}" is already in use. Please choose another.`,
        );
      }
      throw new Error(error?.message || 'Failed to register business.');
    }

    const row = inserted as DbBusinessRow;
    const now = new Date().toISOString();
    writeLocalLoyaltyEnabledOverlay(row.id, initialLoyaltyEnabled);
    writeLocalStatusOverlay(row.id, {
      status: row.status ?? 'pending',
      statusChangedAt: row.status_changed_at ?? now,
      statusReason: null,
      accountState: row.account_state ?? 'active',
      deletionRequestedAt: null,
      deletionScheduledFor: null,
      deletedReason: null,
      loyaltyEnabled: initialLoyaltyEnabled,
    });

    return this.rememberBusiness(mapBusinessRow(row));
  }

  async updateBusinessGoogleUrl(
    businessId: string,
    url: string,
    isPlaceholder = false,
  ): Promise<Business> {
    const client = this.requireClient();
    const { data: updated, error } = await client
      .from('businesses')
      .update({
        google_review_url: url.trim(),
        google_review_url_is_placeholder: isPlaceholder,
      })
      .eq('id', businessId)
      .select('*')
      .single();

    if (error || !updated) {
      throw new Error(error?.message || 'Unable to update Google review URL.');
    }

    return this.rememberBusiness(mapBusinessRow(updated as DbBusinessRow));
  }

  async updateBusinessCategory(
    businessId: string,
    category: BusinessCategory,
  ): Promise<Business> {
    const client = this.requireClient();
    const { data: updated, error } = await client
      .from('businesses')
      .update({ category })
      .eq('id', businessId)
      .select('*')
      .single();

    if (error || !updated) {
      throw new Error(error?.message || 'Unable to update business category.');
    }

    return this.rememberBusiness(mapBusinessRow(updated as DbBusinessRow));
  }

  async updateBusinessReviewFont(
    businessId: string,
    reviewFont: ReviewFontStyle,
  ): Promise<Business> {
    const client = this.requireClient();
    const { data: updated, error } = await client
      .from('businesses')
      .update({ review_font: reviewFont })
      .eq('id', businessId)
      .select('*')
      .single();

    if (error || !updated) {
      throw new Error(error?.message || 'Unable to update review font.');
    }

    return this.rememberBusiness(mapBusinessRow(updated as DbBusinessRow));
  }

  async setBusinessLoyaltyEnabled(
    businessId: string,
    enabled: boolean,
    options?: AIConfigAccessOptions,
  ): Promise<Business> {
    const idErr = validateBusinessId(businessId);
    if (idErr) {
      throw new Error(idErr);
    }
    const cleanId = businessId.trim();
    const nextEnabled = Boolean(enabled);

    if (options?.actorOwnerId) {
      await this.verifyBusinessOwnership(cleanId, options);
    }

    const client = this.requireClient();
    const { data, error } = await client.rpc('set_business_loyalty_enabled', {
      p_business_id: cleanId,
      p_enabled: nextEnabled,
    });

    if (!error && data && typeof data === 'object') {
      writeLocalLoyaltyEnabledOverlay(cleanId, nextEnabled);
      return this.rememberBusiness(data as Business);
    }

    if (
      error &&
      (error.message.includes('Unauthorized') ||
        error.message.includes('Forbidden') ||
        error.message.includes('Business not found'))
    ) {
      throw new Error(error.message);
    }

    const { data: updated, error: updateErr } = await client
      .from('businesses')
      .update({ loyalty_enabled: nextEnabled })
      .eq('id', cleanId)
      .select('*')
      .maybeSingle();

    if (!updateErr && updated) {
      writeLocalLoyaltyEnabledOverlay(cleanId, nextEnabled);
      return this.rememberBusiness(mapBusinessRow(updated as DbBusinessRow));
    }

    const fallbackBiz = await mockBusinessRepository.setBusinessLoyaltyEnabled(
      cleanId,
      nextEnabled,
      options,
    );
    writeLocalLoyaltyEnabledOverlay(cleanId, nextEnabled);
    return this.rememberBusiness(fallbackBiz);
  }

  async trackEvent(event: {
    businessId: string;
    eventType: AnalyticsEventType;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    if (event.eventType !== 'qr_scan' && event.eventType !== 'google_redirect_click') {
      return;
    }

    const client = this.requireClient();
    const slugFromMeta =
      typeof event.metadata?.slug === 'string' ? event.metadata.slug : undefined;
    const slug = slugFromMeta || this.slugByIdCache.get(event.businessId);
    if (!slug) return;

    const source =
      typeof event.metadata?.source === 'string' ? event.metadata.source : 'direct';

    await client.functions.invoke('track-customer-event', {
      body: {
        slug,
        eventType: event.eventType,
        source,
      },
    });
  }

  async getMetrics(businessId: string): Promise<BusinessMetrics> {
    const client = this.requireClient();
    const { data, error } = await client.rpc('get_business_metrics', {
      p_business_id: businessId,
    });

    if (error || !data || typeof data !== 'object') {
      return {
        qrScans: 0,
        feedbackSubmissions: 0,
        aiGenerations: 0,
        googleRedirectClicks: 0,
      };
    }

    const raw = data as Record<string, unknown>;
    return {
      qrScans: Number(raw.qrScans ?? 0),
      feedbackSubmissions: Number(raw.feedbackSubmissions ?? 0),
      aiGenerations: Number(raw.aiGenerations ?? 0),
      googleRedirectClicks: Number(raw.googleRedirectClicks ?? 0),
    };
  }

  async getEvents(businessId: string): Promise<AnalyticsEvent[]> {
    const client = this.requireClient();
    const { data, error } = await client
      .from('analytics_events')
      .select('id, business_id, event_type, metadata, created_at')
      .eq('business_id', businessId)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error || !data) {
      return [];
    }

    return (data as DbAnalyticsEventRow[]).map((row) => ({
      id: row.id,
      businessId: row.business_id,
      eventType: row.event_type,
      timestamp: row.created_at,
      metadata: row.metadata ?? undefined,
    }));
  }

  async recordDraft(
    draft: Omit<CustomerDraftRecord, 'id' | 'timestamp'>,
  ): Promise<CustomerDraftRecord> {
    return {
      ...draft,
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
    };
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
    await this.verifyBusinessOwnership(cleanId, options);

    const client = this.requireClient();
    const { data, error } = await client
      .from('customer_drafts')
      .select('*')
      .eq('business_id', cleanId)
      .order('created_at', { ascending: false })
      .limit(100);

    const overlayMap = readLocalDraftResponseOverlay();

    if (error || !data || data.length === 0) {
      const localExists = await mockBusinessRepository.getBusinessById(cleanId);
      if (localExists) {
        return mockBusinessRepository.getDrafts(cleanId, options);
      }
      return [];
    }

    const mapped = (data as DbCustomerDraftRow[]).map((row) => {
      const ov = overlayMap[row.id];
      return {
        id: row.id,
        businessId: row.business_id,
        originalInput: row.original_input,
        generatedReview: row.generated_review,
        mode: row.mode,
        sentiment: row.sentiment,
        timestamp: row.created_at,
        ownerResponseDraft:
          row.owner_response_draft !== undefined
            ? row.owner_response_draft
            : (ov?.ownerResponseDraft ?? null),
        responseStatus:
          row.response_status ?? ov?.responseStatus ?? 'pending',
        responseAttempt:
          row.response_attempt ?? ov?.responseAttempt ?? 0,
        responseGeneratedAt:
          row.response_generated_at ?? ov?.responseGeneratedAt ?? null,
        responseApprovedAt:
          row.response_approved_at ?? ov?.responseApprovedAt ?? null,
        responseCompletedAt:
          row.response_completed_at ?? ov?.responseCompletedAt ?? null,
        responseUpdatedAt:
          row.response_updated_at ?? ov?.responseUpdatedAt ?? null,
      };
    });

    return filterActiveRetentionDrafts(mapped);
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
    await this.verifyBusinessOwnership(cleanBizId, options);

    const existingDrafts = await this.getDrafts(cleanBizId, options);
    const existing = existingDrafts.find((d) => d.id === draftId);
    if (!existing) {
      throw new Error(
        `Review draft "${draftId}" not found for business "${cleanBizId}".`,
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

    const generatedAt =
      update.status === 'draft_generated'
        ? now
        : (existing.responseGeneratedAt ?? now);
    const approvedAt =
      update.status === 'approved'
        ? now
        : update.status === 'completed'
          ? (existing.responseApprovedAt ?? now)
          : null;
    const completedAt = update.status === 'completed' ? now : null;

    const client = this.requireClient();
    const { data, error } = await client
      .from('customer_drafts')
      .update({
        owner_response_draft: workflowValidation.cleanedDraft,
        response_status: update.status,
        response_attempt: nextAttempt,
        response_generated_at: generatedAt,
        response_approved_at: approvedAt,
        response_completed_at: completedAt,
        response_updated_at: now,
      })
      .eq('id', draftId)
      .eq('business_id', cleanBizId)
      .select('*')
      .maybeSingle();

    writeLocalDraftResponseOverlay(draftId, {
      businessId: cleanBizId,
      ownerResponseDraft: workflowValidation.cleanedDraft,
      responseStatus: update.status,
      responseAttempt: nextAttempt,
      responseGeneratedAt: generatedAt,
      responseApprovedAt: approvedAt,
      responseCompletedAt: completedAt,
      responseUpdatedAt: now,
    });

    if (!error && data) {
      const row = data as DbCustomerDraftRow;
      return {
        id: row.id,
        businessId: row.business_id,
        originalInput: row.original_input,
        generatedReview: row.generated_review,
        mode: row.mode,
        sentiment: row.sentiment,
        timestamp: row.created_at,
        ownerResponseDraft: row.owner_response_draft ?? workflowValidation.cleanedDraft,
        responseStatus: row.response_status ?? update.status,
        responseAttempt: row.response_attempt ?? nextAttempt,
        responseGeneratedAt: row.response_generated_at ?? generatedAt,
        responseApprovedAt: row.response_approved_at ?? approvedAt,
        responseCompletedAt: row.response_completed_at ?? completedAt,
        responseUpdatedAt: row.response_updated_at ?? now,
      };
    }

    const localExists = await mockBusinessRepository.getBusinessById(cleanBizId);
    if (localExists) {
      try {
        return await mockBusinessRepository.updateDraftResponse(
          cleanBizId,
          draftId,
          update,
          options,
        );
      } catch {
        // ignore if draft was remote-only
      }
    }

    return {
      ...existing,
      ownerResponseDraft: workflowValidation.cleanedDraft,
      responseStatus: update.status,
      responseAttempt: nextAttempt,
      responseGeneratedAt: generatedAt,
      responseApprovedAt: approvedAt,
      responseCompletedAt: completedAt,
      responseUpdatedAt: now,
    };
  }

  private async verifyBusinessOwnership(
    businessId: string,
    options?: AIConfigAccessOptions,
  ): Promise<Business> {
    const biz =
      (await this.getBusinessById(businessId)) ??
      (await mockBusinessRepository.getBusinessById(businessId));

    if (!biz) {
      throw new Error(`Business with ID "${businessId}" not found.`);
    }

    if (
      options?.actorOwnerId &&
      biz.ownerId &&
      options.actorOwnerId !== biz.ownerId
    ) {
      throw new Error(
        `Unauthorized: Owner "${options.actorOwnerId}" cannot access or modify AI configuration for business "${biz.id}".`,
      );
    }

    const client = this.requireClient();
    const {
      data: { user },
    } = await client.auth.getUser();

    if (user && biz.ownerId && user.id !== biz.ownerId) {
      throw new Error(
        `Unauthorized: Authenticated user cannot access or modify AI configuration for business "${biz.id}".`,
      );
    }

    return biz;
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
    await this.verifyBusinessOwnership(cleanId, options);

    const client = this.requireClient();
    const { data, error } = await client
      .from('business_ai_settings')
      .select(
        'business_id, ai_tone, ai_custom_instructions, ai_response_length, ai_language, created_at, updated_at',
      )
      .eq('business_id', cleanId)
      .maybeSingle();

    if (!error && data) {
      const row = data as DbBusinessAISettingsRow;
      return normalizeBusinessAIConfig(
        cleanId,
        {
          tone: row.ai_tone,
          customInstructions: row.ai_custom_instructions,
          responseLength: row.ai_response_length,
          language: row.ai_language,
          updatedAt: row.updated_at,
        },
        'supabase',
      );
    }

    // Fallback to local per-business overlay / mock store when migration 004 has not been applied yet
    const overlay = readLocalAIConfigOverlay()[cleanId];
    if (overlay) {
      return normalizeBusinessAIConfig(cleanId, overlay, 'local');
    }

    const localExists = await mockBusinessRepository.getBusinessById(cleanId);
    if (localExists) {
      return mockBusinessRepository.getBusinessAIConfig(cleanId, options);
    }

    return normalizeBusinessAIConfig(cleanId, undefined, 'local');
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
    await this.verifyBusinessOwnership(cleanId, options);

    const now = new Date().toISOString();
    const client = this.requireClient();
    const { data, error } = await client
      .from('business_ai_settings')
      .upsert(
        {
          business_id: cleanId,
          ai_tone: validation.value.tone,
          ai_custom_instructions: validation.value.customInstructions,
          ai_response_length: validation.value.responseLength,
          ai_language: validation.value.language,
          updated_at: now,
        },
        { onConflict: 'business_id' },
      )
      .select(
        'business_id, ai_tone, ai_custom_instructions, ai_response_length, ai_language, created_at, updated_at',
      )
      .single();

    if (!error && data) {
      const row = data as DbBusinessAISettingsRow;
      const saved = normalizeBusinessAIConfig(
        cleanId,
        {
          tone: row.ai_tone,
          customInstructions: row.ai_custom_instructions,
          responseLength: row.ai_response_length,
          language: row.ai_language,
          updatedAt: row.updated_at,
        },
        'supabase',
      );
      writeLocalAIConfigOverlay(cleanId, saved);
      return saved;
    }

    // Fallback when migration 004_business_ai_configuration.sql has not been applied yet on remote DB
    const localSaved = normalizeBusinessAIConfig(
      cleanId,
      {
        ...validation.value,
        updatedAt: now,
      },
      'local',
    );
    writeLocalAIConfigOverlay(cleanId, localSaved);

    const localExists = await mockBusinessRepository.getBusinessById(cleanId);
    if (localExists) {
      return mockBusinessRepository.updateBusinessAIConfig(
        cleanId,
        validation.value,
        options,
      );
    }

    return localSaved;
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
    const biz = await this.verifyBusinessOwnership(cleanId, options);
    const client = this.requireClient();

    const [profileRes, keywordsRes, productsRes, servicesRes, areasRes] =
      await Promise.all([
        client
          .from('business_knowledge_profiles')
          .select('business_id, description, primary_category, additional_info, updated_at')
          .eq('business_id', cleanId)
          .maybeSingle(),
        client
          .from('business_target_keywords')
          .select('keyword, display_order')
          .eq('business_id', cleanId)
          .order('display_order', { ascending: true }),
        client
          .from('business_products')
          .select('id, name, description, category, display_order')
          .eq('business_id', cleanId)
          .order('display_order', { ascending: true }),
        client
          .from('business_services')
          .select('id, name, description, display_order')
          .eq('business_id', cleanId)
          .order('display_order', { ascending: true }),
        client
          .from('business_service_areas')
          .select('location_name, display_order')
          .eq('business_id', cleanId)
          .order('display_order', { ascending: true }),
      ]);

    const hasRemoteTables =
      !profileRes.error &&
      !keywordsRes.error &&
      !productsRes.error &&
      !servicesRes.error &&
      !areasRes.error;

    if (hasRemoteTables && profileRes.data) {
      const pRow = profileRes.data as {
        description: string;
        primary_category: string;
        additional_info: string;
        updated_at: string;
      };
      const targetKeywords = (
        (keywordsRes.data ?? []) as Array<{ keyword: string }>
      ).map((r) => r.keyword);

      const products: BusinessProductItem[] = (
        (productsRes.data ?? []) as Array<{
          id: string;
          name: string;
          description: string;
          category: string;
        }>
      ).map((r) => ({
        id: r.id,
        name: r.name,
        description: r.description,
        ...(r.category ? { category: r.category } : {}),
      }));

      const services: BusinessServiceItem[] = (
        (servicesRes.data ?? []) as Array<{
          id: string;
          name: string;
          description: string;
        }>
      ).map((r) => ({
        id: r.id,
        name: r.name,
        description: r.description,
      }));

      const serviceAreas = (
        (areasRes.data ?? []) as Array<{ location_name: string }>
      ).map((r) => r.location_name);

      return normalizeBusinessKnowledgeProfile(
        cleanId,
        biz.category,
        {
          description: pRow.description,
          primaryCategory: pRow.primary_category,
          additionalInfo: pRow.additional_info,
          targetKeywords,
          products,
          services,
          serviceAreas,
          updatedAt: pRow.updated_at,
        },
        'supabase',
      );
    }

    // Fallback when migration 005_business_knowledge_and_local_seo.sql has not been applied yet
    const overlay = readLocalKnowledgeOverlay()[cleanId];
    if (overlay) {
      return normalizeBusinessKnowledgeProfile(
        cleanId,
        biz.category,
        overlay,
        'local',
      );
    }

    const localExists = await mockBusinessRepository.getBusinessById(cleanId);
    if (localExists) {
      return mockBusinessRepository.getBusinessKnowledge(cleanId, options);
    }

    return normalizeBusinessKnowledgeProfile(
      cleanId,
      biz.category,
      undefined,
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
    const biz = await this.verifyBusinessOwnership(cleanId, options);
    const now = new Date().toISOString();
    const client = this.requireClient();

    const { error: profileErr } = await client
      .from('business_knowledge_profiles')
      .upsert(
        {
          business_id: cleanId,
          description: validation.value.description,
          primary_category: validation.value.primaryCategory,
          additional_info: validation.value.additionalInfo,
          updated_at: now,
        },
        { onConflict: 'business_id' },
      );

    if (!profileErr) {
      await Promise.all([
        client
          .from('business_target_keywords')
          .delete()
          .eq('business_id', cleanId),
        client.from('business_products').delete().eq('business_id', cleanId),
        client.from('business_services').delete().eq('business_id', cleanId),
        client
          .from('business_service_areas')
          .delete()
          .eq('business_id', cleanId),
      ]);

      if (validation.value.targetKeywords.length > 0) {
        await client.from('business_target_keywords').insert(
          validation.value.targetKeywords.map((keyword, idx) => ({
            business_id: cleanId,
            keyword,
            display_order: idx,
          })),
        );
      }

      if (validation.value.products.length > 0) {
        await client.from('business_products').insert(
          validation.value.products.map((prod, idx) => ({
            business_id: cleanId,
            name: prod.name,
            description: prod.description,
            category: prod.category ?? '',
            display_order: idx,
          })),
        );
      }

      if (validation.value.services.length > 0) {
        await client.from('business_services').insert(
          validation.value.services.map((svc, idx) => ({
            business_id: cleanId,
            name: svc.name,
            description: svc.description,
            display_order: idx,
          })),
        );
      }

      if (validation.value.serviceAreas.length > 0) {
        await client.from('business_service_areas').insert(
          validation.value.serviceAreas.map((location_name, idx) => ({
            business_id: cleanId,
            location_name,
            display_order: idx,
          })),
        );
      }

      const saved = normalizeBusinessKnowledgeProfile(
        cleanId,
        biz.category,
        {
          ...validation.value,
          updatedAt: now,
        },
        'supabase',
      );
      writeLocalKnowledgeOverlay(cleanId, saved);
      return saved;
    }

    // Fallback when migration 005 has not been applied yet on the remote database
    const localSaved = normalizeBusinessKnowledgeProfile(
      cleanId,
      biz.category,
      {
        ...validation.value,
        updatedAt: now,
      },
      'local',
    );
    writeLocalKnowledgeOverlay(cleanId, localSaved);

    const localExists = await mockBusinessRepository.getBusinessById(cleanId);
    if (localExists) {
      return mockBusinessRepository.updateBusinessKnowledge(
        cleanId,
        validation.value,
        options,
      );
    }

    return localSaved;
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
    await this.verifyBusinessOwnership(cleanId, options);
    const client = this.requireClient();

    const { data, error } = await client
      .from('restaurant_profiles')
      .select('*')
      .eq('business_id', cleanId)
      .maybeSingle();

    if (!error && data) {
      const row = data as {
        business_id: string;
        is_enabled: boolean;
        currency_code: RestaurantCurrencyCode;
        tagline: string | null;
        games_enabled: boolean;
        loyalty_enabled: boolean;
        staff_pin_hash?: string | null;
        min_hours_between_visit_stars?: number;
        table_ordering_enabled?: boolean;
        menu_theme_template?: MenuThemeTemplate;
        business_mode?: RestaurantBusinessMode;
        custom_logo_url?: string | null;
        custom_accent_color?: string | null;
        upi_id?: string | null;
        upi_payee_name?: string | null;
        gstin?: string | null;
        gst_percent?: number | string | null;
        service_charge_percent?: number | string | null;
        voice_alerts_enabled?: boolean;
        accepting_orders?: boolean;
        hotel_rooms_enabled?: boolean;
        updated_at: string;
      };
      return normalizeRestaurantProfile(
        cleanId,
        {
          isEnabled: row.is_enabled,
          currencyCode: row.currency_code,
          tagline: row.tagline,
          gamesEnabled: row.games_enabled,
          loyaltyEnabled: row.loyalty_enabled,
          staffPinHash: row.staff_pin_hash ?? null,
          minHoursBetweenVisitStars: row.min_hours_between_visit_stars ?? 4,
          tableOrderingEnabled: Boolean(row.table_ordering_enabled),
          menuThemeTemplate: row.menu_theme_template ?? 'default',
          businessMode: row.business_mode ?? 'restaurant',
          customLogoUrl: row.custom_logo_url ?? null,
          customAccentColor: row.custom_accent_color ?? null,
          upiId: row.upi_id ?? null,
          upiPayeeName: row.upi_payee_name ?? null,
          gstin: row.gstin ?? null,
          gstPercent: Number(row.gst_percent ?? 0),
          serviceChargePercent: Number(row.service_charge_percent ?? 0),
          voiceAlertsEnabled:
            typeof row.voice_alerts_enabled === 'boolean'
              ? row.voice_alerts_enabled
              : true,
          acceptingOrders:
            typeof row.accepting_orders === 'boolean'
              ? row.accepting_orders
              : true,
          hotelRoomsEnabled: Boolean(row.hotel_rooms_enabled),
          updatedAt: row.updated_at,
        },
        'supabase',
      );
    }

    return mockBusinessRepository.getRestaurantProfile(cleanId, options);
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
    await this.verifyBusinessOwnership(cleanId, options);
    const now = new Date().toISOString();
    const client = this.requireClient();

    const upsertPayload: Record<string, unknown> = {
      business_id: cleanId,
      is_enabled: validation.value.isEnabled,
      currency_code: validation.value.currencyCode,
      tagline: validation.value.tagline,
      games_enabled: validation.value.gamesEnabled,
      loyalty_enabled: validation.value.loyaltyEnabled,
      updated_at: now,
    };
    if (validation.value.staffPinHash !== undefined) {
      upsertPayload.staff_pin_hash = validation.value.staffPinHash;
    }
    if (validation.value.minHoursBetweenVisitStars !== undefined) {
      upsertPayload.min_hours_between_visit_stars =
        validation.value.minHoursBetweenVisitStars;
    }
    if (validation.value.tableOrderingEnabled !== undefined) {
      upsertPayload.table_ordering_enabled =
        validation.value.tableOrderingEnabled;
    }
    if (validation.value.menuThemeTemplate !== undefined) {
      upsertPayload.menu_theme_template = validation.value.menuThemeTemplate;
    }
    if (validation.value.businessMode !== undefined) {
      upsertPayload.business_mode = validation.value.businessMode;
    }
    if (validation.value.customLogoUrl !== undefined) {
      upsertPayload.custom_logo_url = validation.value.customLogoUrl;
    }
    if (validation.value.customAccentColor !== undefined) {
      upsertPayload.custom_accent_color = validation.value.customAccentColor;
    }
    if (validation.value.upiId !== undefined) {
      upsertPayload.upi_id = validation.value.upiId;
    }
    if (validation.value.upiPayeeName !== undefined) {
      upsertPayload.upi_payee_name = validation.value.upiPayeeName;
    }
    if (validation.value.gstin !== undefined) {
      upsertPayload.gstin = validation.value.gstin;
    }
    if (validation.value.gstPercent !== undefined) {
      upsertPayload.gst_percent = validation.value.gstPercent;
    }
    if (validation.value.serviceChargePercent !== undefined) {
      upsertPayload.service_charge_percent =
        validation.value.serviceChargePercent;
    }
    if (validation.value.voiceAlertsEnabled !== undefined) {
      upsertPayload.voice_alerts_enabled = validation.value.voiceAlertsEnabled;
    }
    if (validation.value.acceptingOrders !== undefined) {
      upsertPayload.accepting_orders = validation.value.acceptingOrders;
    }
    if (validation.value.hotelRoomsEnabled !== undefined) {
      upsertPayload.hotel_rooms_enabled = validation.value.hotelRoomsEnabled;
    }

    const { data, error } = await client
      .from('restaurant_profiles')
      .upsert(upsertPayload, { onConflict: 'business_id' })
      .select('*')
      .single();

    if (!error && data) {
      const row = data as {
        business_id: string;
        is_enabled: boolean;
        currency_code: RestaurantCurrencyCode;
        tagline: string | null;
        games_enabled: boolean;
        loyalty_enabled: boolean;
        staff_pin_hash?: string | null;
        min_hours_between_visit_stars?: number;
        table_ordering_enabled?: boolean;
        menu_theme_template?: MenuThemeTemplate;
        business_mode?: RestaurantBusinessMode;
        custom_logo_url?: string | null;
        custom_accent_color?: string | null;
        upi_id?: string | null;
        upi_payee_name?: string | null;
        gstin?: string | null;
        gst_percent?: number | string | null;
        service_charge_percent?: number | string | null;
        voice_alerts_enabled?: boolean;
        accepting_orders?: boolean;
        hotel_rooms_enabled?: boolean;
        updated_at: string;
      };
      return normalizeRestaurantProfile(
        cleanId,
        {
          isEnabled: row.is_enabled,
          currencyCode: row.currency_code,
          tagline: row.tagline,
          gamesEnabled: row.games_enabled,
          loyaltyEnabled: row.loyalty_enabled,
          staffPinHash: row.staff_pin_hash ?? null,
          minHoursBetweenVisitStars: row.min_hours_between_visit_stars ?? 4,
          tableOrderingEnabled: Boolean(row.table_ordering_enabled),
          menuThemeTemplate: row.menu_theme_template ?? 'default',
          businessMode: row.business_mode ?? 'restaurant',
          customLogoUrl: row.custom_logo_url ?? null,
          customAccentColor: row.custom_accent_color ?? null,
          upiId: row.upi_id ?? null,
          upiPayeeName: row.upi_payee_name ?? null,
          gstin: row.gstin ?? null,
          gstPercent: Number(row.gst_percent ?? 0),
          serviceChargePercent: Number(row.service_charge_percent ?? 0),
          voiceAlertsEnabled:
            typeof row.voice_alerts_enabled === 'boolean'
              ? row.voice_alerts_enabled
              : true,
          acceptingOrders:
            typeof row.accepting_orders === 'boolean'
              ? row.accepting_orders
              : true,
          hotelRoomsEnabled: Boolean(row.hotel_rooms_enabled),
          updatedAt: row.updated_at,
        },
        'supabase',
      );
    }

    return mockBusinessRepository.updateRestaurantProfile(
      cleanId,
      validation.value,
      options,
    );
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
    await this.verifyBusinessOwnership(cleanId, options);
    const client = this.requireClient();

    const { data, error } = await client
      .from('restaurant_tables')
      .select('*')
      .eq('business_id', cleanId)
      .order('created_at', { ascending: true });

    if (!error && data) {
      return (
        data as Array<{
          id: string;
          business_id: string;
          table_number: string;
          table_label: string | null;
          table_key: string;
          location_type?: RestaurantLocationType;
          seat_capacity?: number;
          occupied_since?: string | null;
          table_shape?: 'square' | 'rectangle' | 'round';
          pos_x?: number | null;
          pos_y?: number | null;
          width_units?: number | null;
          height_units?: number | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        }>
      ).map((row) => ({
        id: row.id,
        businessId: row.business_id,
        tableNumber: row.table_number,
        tableLabel: row.table_label,
        tableKey: row.table_key,
        locationType: row.location_type ?? 'table',
        seatCapacity: row.seat_capacity ?? 4,
        occupiedSince: row.occupied_since ?? null,
        tableShape: row.table_shape ?? 'rectangle',
        posX:
          row.pos_x !== null && row.pos_x !== undefined
            ? Number(row.pos_x)
            : null,
        posY:
          row.pos_y !== null && row.pos_y !== undefined
            ? Number(row.pos_y)
            : null,
        widthUnits:
          row.width_units !== null && row.width_units !== undefined
            ? Number(row.width_units)
            : 14,
        heightUnits:
          row.height_units !== null && row.height_units !== undefined
            ? Number(row.height_units)
            : 14,
        isActive: row.is_active,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }));
    }

    return mockBusinessRepository.getRestaurantTables(cleanId, options);
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
    await this.verifyBusinessOwnership(cleanId, options);
    const client = this.requireClient();

    const { data, error } = await client
      .from('restaurant_tables')
      .insert({
        business_id: cleanId,
        table_number: validation.value.tableNumber,
        table_label: validation.value.tableLabel,
        table_key: validation.value.tableKey,
        location_type: validation.value.locationType,
        seat_capacity: validation.value.seatCapacity,
        is_active: validation.value.isActive,
      })
      .select('*')
      .single();

    if (error) {
      if (error.code === '23505') {
        throw new Error(
          `Duplicate table key "${validation.value.tableKey}" already exists for this business.`,
        );
      }
      return mockBusinessRepository.createRestaurantTable(
        cleanId,
        validation.value,
        options,
      );
    }

    const row = data as {
      id: string;
      business_id: string;
      table_number: string;
      table_label: string | null;
      table_key: string;
      location_type?: RestaurantLocationType;
      seat_capacity?: number;
      occupied_since?: string | null;
      is_active: boolean;
      created_at: string;
      updated_at: string;
    };
    return {
      id: row.id,
      businessId: row.business_id,
      tableNumber: row.table_number,
      tableLabel: row.table_label,
      tableKey: row.table_key,
      locationType: row.location_type ?? 'table',
      seatCapacity: row.seat_capacity ?? 4,
      occupiedSince: row.occupied_since ?? null,
      isActive: row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
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
    await this.verifyBusinessOwnership(cleanId, options);
    const client = this.requireClient();

    const { data, error } = await client
      .from('restaurant_tables')
      .update({
        table_number: validation.value.tableNumber,
        table_label: validation.value.tableLabel,
        table_key: validation.value.tableKey,
        location_type: validation.value.locationType,
        seat_capacity: validation.value.seatCapacity,
        is_active: validation.value.isActive,
      })
      .eq('id', tableId)
      .eq('business_id', cleanId)
      .select('*')
      .single();

    if (error) {
      if (error.code === '23505') {
        throw new Error(
          `Duplicate table key "${validation.value.tableKey}" already exists for this business.`,
        );
      }
      return mockBusinessRepository.updateRestaurantTable(
        cleanId,
        tableId,
        validation.value,
        options,
      );
    }

    const row = data as {
      id: string;
      business_id: string;
      table_number: string;
      table_label: string | null;
      table_key: string;
      location_type?: RestaurantLocationType;
      seat_capacity?: number;
      occupied_since?: string | null;
      is_active: boolean;
      created_at: string;
      updated_at: string;
    };
    return {
      id: row.id,
      businessId: row.business_id,
      tableNumber: row.table_number,
      tableLabel: row.table_label,
      tableKey: row.table_key,
      locationType: row.location_type ?? 'table',
      seatCapacity: row.seat_capacity ?? 4,
      occupiedSince: row.occupied_since ?? null,
      isActive: row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
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
    await this.verifyBusinessOwnership(cleanId, options);
    const client = this.requireClient();

    const { error } = await client
      .from('restaurant_tables')
      .delete()
      .eq('id', tableId)
      .eq('business_id', cleanId);

    if (error) {
      await mockBusinessRepository.deleteRestaurantTable(
        cleanId,
        tableId,
        options,
      );
    }
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
    await this.verifyBusinessOwnership(cleanId, options);
    const client = this.requireClient();

    const { data, error } = await client
      .from('restaurant_menu_categories')
      .select(
        'id, business_id, name, description, display_order, is_active, created_at, updated_at',
      )
      .eq('business_id', cleanId)
      .order('display_order', { ascending: true })
      .order('created_at', { ascending: true });

    if (!error && data) {
      return (
        data as Array<{
          id: string;
          business_id: string;
          name: string;
          description: string | null;
          display_order: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        }>
      ).map((row) => ({
        id: row.id,
        businessId: row.business_id,
        name: row.name,
        description: row.description,
        displayOrder: row.display_order,
        isActive: row.is_active,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }));
    }

    return mockBusinessRepository.getRestaurantMenuCategories(cleanId, options);
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
    await this.verifyBusinessOwnership(cleanId, options);
    const client = this.requireClient();

    const { data, error } = await client
      .from('restaurant_menu_categories')
      .insert({
        business_id: cleanId,
        name: validation.value.name,
        description: validation.value.description,
        display_order: validation.value.displayOrder,
        is_active: validation.value.isActive,
      })
      .select(
        'id, business_id, name, description, display_order, is_active, created_at, updated_at',
      )
      .single();

    if (error || !data) {
      return mockBusinessRepository.createRestaurantMenuCategory(
        cleanId,
        validation.value,
        options,
      );
    }

    const row = data as {
      id: string;
      business_id: string;
      name: string;
      description: string | null;
      display_order: number;
      is_active: boolean;
      created_at: string;
      updated_at: string;
    };
    return {
      id: row.id,
      businessId: row.business_id,
      name: row.name,
      description: row.description,
      displayOrder: row.display_order,
      isActive: row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
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
    await this.verifyBusinessOwnership(cleanId, options);
    const client = this.requireClient();

    const { data, error } = await client
      .from('restaurant_menu_categories')
      .update({
        name: validation.value.name,
        description: validation.value.description,
        display_order: validation.value.displayOrder,
        is_active: validation.value.isActive,
      })
      .eq('id', categoryId)
      .eq('business_id', cleanId)
      .select(
        'id, business_id, name, description, display_order, is_active, created_at, updated_at',
      )
      .single();

    if (error || !data) {
      return mockBusinessRepository.updateRestaurantMenuCategory(
        cleanId,
        categoryId,
        validation.value,
        options,
      );
    }

    const row = data as {
      id: string;
      business_id: string;
      name: string;
      description: string | null;
      display_order: number;
      is_active: boolean;
      created_at: string;
      updated_at: string;
    };
    return {
      id: row.id,
      businessId: row.business_id,
      name: row.name,
      description: row.description,
      displayOrder: row.display_order,
      isActive: row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
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
    await this.verifyBusinessOwnership(cleanId, options);
    const client = this.requireClient();

    const { error } = await client
      .from('restaurant_menu_categories')
      .delete()
      .eq('id', categoryId)
      .eq('business_id', cleanId);

    if (error) {
      await mockBusinessRepository.deleteRestaurantMenuCategory(
        cleanId,
        categoryId,
        options,
      );
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
    await this.verifyBusinessOwnership(cleanId, options);
    const client = this.requireClient();

    const { data, error } = await client
      .from('restaurant_menu_items')
      .select('*')
      .eq('business_id', cleanId)
      .order('display_order', { ascending: true })
      .order('created_at', { ascending: true });

    if (!error && data) {
      return (
        data as Array<{
          id: string;
          business_id: string;
          category_id: string;
          name: string;
          description: string | null;
          price_paise: number;
          dietary_tag: DietaryTag;
          is_available: boolean;
          is_featured: boolean;
          image_url: string | null;
          display_order: number;
          show_on_table?: boolean;
          show_on_room?: boolean;
          spice_level?: DishSpiceLevel | null;
          ingredients_summary?: string | null;
          prep_time_minutes?: number | null;
          created_at: string;
          updated_at: string;
        }>
      ).map((row) => ({
        id: row.id,
        businessId: row.business_id,
        categoryId: row.category_id,
        name: row.name,
        description: row.description,
        pricePaise: row.price_paise,
        dietaryTag: row.dietary_tag,
        isAvailable: row.is_available,
        isFeatured: row.is_featured,
        imageUrl: row.image_url,
        displayOrder: row.display_order,
        showOnTable: row.show_on_table ?? true,
        showOnRoom: row.show_on_room ?? true,
        spiceLevel: row.spice_level ?? null,
        ingredientsSummary: row.ingredients_summary ?? null,
        prepTimeMinutes: row.prep_time_minutes ?? null,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }));
    }

    return mockBusinessRepository.getRestaurantMenuItems(cleanId, options);
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
    await this.verifyBusinessOwnership(cleanId, options);
    const client = this.requireClient();

    const { data, error } = await client
      .from('restaurant_menu_items')
      .insert({
        business_id: cleanId,
        category_id: validation.value.categoryId,
        name: validation.value.name,
        description: validation.value.description,
        price_paise: validation.value.pricePaise,
        dietary_tag: validation.value.dietaryTag,
        is_available: validation.value.isAvailable,
        is_featured: validation.value.isFeatured,
        image_url: validation.value.imageUrl,
        display_order: validation.value.displayOrder,
        show_on_table: validation.value.showOnTable,
        show_on_room: validation.value.showOnRoom,
        spice_level: validation.value.spiceLevel,
        ingredients_summary: validation.value.ingredientsSummary,
        prep_time_minutes: validation.value.prepTimeMinutes,
      })
      .select('*')
      .single();

    if (error || !data) {
      return mockBusinessRepository.createRestaurantMenuItem(
        cleanId,
        validation.value,
        options,
      );
    }

    const row = data as {
      id: string;
      business_id: string;
      category_id: string;
      name: string;
      description: string | null;
      price_paise: number;
      dietary_tag: DietaryTag;
      is_available: boolean;
      is_featured: boolean;
      image_url: string | null;
      display_order: number;
      show_on_table?: boolean;
      show_on_room?: boolean;
      spice_level?: DishSpiceLevel | null;
      ingredients_summary?: string | null;
      prep_time_minutes?: number | null;
      created_at: string;
      updated_at: string;
    };
    return {
      id: row.id,
      businessId: row.business_id,
      categoryId: row.category_id,
      name: row.name,
      description: row.description,
      pricePaise: row.price_paise,
      dietaryTag: row.dietary_tag,
      isAvailable: row.is_available,
      isFeatured: row.is_featured,
      imageUrl: row.image_url,
      displayOrder: row.display_order,
      showOnTable: row.show_on_table ?? true,
      showOnRoom: row.show_on_room ?? true,
      spiceLevel: row.spice_level ?? null,
      ingredientsSummary: row.ingredients_summary ?? null,
      prepTimeMinutes: row.prep_time_minutes ?? null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
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
    await this.verifyBusinessOwnership(cleanId, options);
    const client = this.requireClient();

    const { data, error } = await client
      .from('restaurant_menu_items')
      .update({
        category_id: validation.value.categoryId,
        name: validation.value.name,
        description: validation.value.description,
        price_paise: validation.value.pricePaise,
        dietary_tag: validation.value.dietaryTag,
        is_available: validation.value.isAvailable,
        is_featured: validation.value.isFeatured,
        image_url: validation.value.imageUrl,
        display_order: validation.value.displayOrder,
        show_on_table: validation.value.showOnTable,
        show_on_room: validation.value.showOnRoom,
        spice_level: validation.value.spiceLevel,
        ingredients_summary: validation.value.ingredientsSummary,
        prep_time_minutes: validation.value.prepTimeMinutes,
      })
      .eq('id', itemId)
      .eq('business_id', cleanId)
      .select('*')
      .single();

    if (error || !data) {
      return mockBusinessRepository.updateRestaurantMenuItem(
        cleanId,
        itemId,
        validation.value,
        options,
      );
    }

    const row = data as {
      id: string;
      business_id: string;
      category_id: string;
      name: string;
      description: string | null;
      price_paise: number;
      dietary_tag: DietaryTag;
      is_available: boolean;
      is_featured: boolean;
      image_url: string | null;
      display_order: number;
      show_on_table?: boolean;
      show_on_room?: boolean;
      spice_level?: DishSpiceLevel | null;
      ingredients_summary?: string | null;
      prep_time_minutes?: number | null;
      created_at: string;
      updated_at: string;
    };
    return {
      id: row.id,
      businessId: row.business_id,
      categoryId: row.category_id,
      name: row.name,
      description: row.description,
      pricePaise: row.price_paise,
      dietaryTag: row.dietary_tag,
      isAvailable: row.is_available,
      isFeatured: row.is_featured,
      imageUrl: row.image_url,
      displayOrder: row.display_order,
      showOnTable: row.show_on_table ?? true,
      showOnRoom: row.show_on_room ?? true,
      spiceLevel: row.spice_level ?? null,
      ingredientsSummary: row.ingredients_summary ?? null,
      prepTimeMinutes: row.prep_time_minutes ?? null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
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
    await this.verifyBusinessOwnership(cleanId, options);
    const client = this.requireClient();

    const { error } = await client
      .from('restaurant_menu_items')
      .delete()
      .eq('id', itemId)
      .eq('business_id', cleanId);

    if (error) {
      await mockBusinessRepository.deleteRestaurantMenuItem(
        cleanId,
        itemId,
        options,
      );
    }
  }

  async getPublicRestaurantMenu(
    businessSlug: string,
    tableKey?: string | null,
  ): Promise<PublicRestaurantMenuPayload | null> {
    const cleanSlug = businessSlug.trim().toLowerCase();
    if (!cleanSlug) return null;

    const cleanTableKey =
      tableKey && tableKey.trim() ? deriveTableKey(tableKey) : null;

    const client = this.requireClient();
    const { data, error } = await client.rpc('get_public_restaurant_menu', {
      p_slug: cleanSlug,
      p_table_key: cleanTableKey,
    });

    if (!error && data && typeof data === 'object') {
      const payload = data as PublicRestaurantMenuPayload;
      if (payload.business && payload.profile?.isEnabled) {
        return payload;
      }
    }

    return mockBusinessRepository.getPublicRestaurantMenu(
      cleanSlug,
      cleanTableKey,
    );
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
    await this.verifyBusinessOwnership(cleanId, options);
    const client = this.requireClient();

    const { data, error } = await client
      .from('restaurant_game_configs')
      .select(
        'id, business_id, game_slug, title, category, is_enabled, points_per_win, max_points_per_day_per_customer, cooldown_minutes, custom_questions, created_at, updated_at',
      )
      .eq('business_id', cleanId)
      .order('created_at', { ascending: true });

    if (!error && data) {
      if (data.length === 0) {
        return getDefaultRestaurantGameConfigs(cleanId);
      }
      return (
        data as Array<{
          id: string;
          business_id: string;
          game_slug: RestaurantGameSlug;
          title: string;
          category: RestaurantGameCategory;
          is_enabled: boolean;
          points_per_win: number;
          max_points_per_day_per_customer: number;
          cooldown_minutes: number;
          custom_questions: RestaurantTriviaQuestion[] | null;
          created_at: string;
          updated_at: string;
        }>
      ).map((row) => ({
        id: row.id,
        businessId: row.business_id,
        gameSlug: row.game_slug,
        title: row.title,
        category: row.category,
        isEnabled: row.is_enabled,
        pointsPerWin: row.points_per_win,
        maxPointsPerDayPerCustomer: row.max_points_per_day_per_customer,
        cooldownMinutes: row.cooldown_minutes,
        customQuestions: row.custom_questions,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }));
    }

    return mockBusinessRepository.getRestaurantGameConfigs(cleanId, options);
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
    await this.verifyBusinessOwnership(cleanId, options);
    const client = this.requireClient();

    const { data, error } = await client
      .from('restaurant_game_configs')
      .upsert(
        {
          business_id: cleanId,
          game_slug: validation.value.gameSlug,
          title: validation.value.title,
          category: validation.value.category,
          is_enabled: validation.value.isEnabled,
          points_per_win: validation.value.pointsPerWin,
          max_points_per_day_per_customer:
            validation.value.maxPointsPerDayPerCustomer,
          cooldown_minutes: validation.value.cooldownMinutes,
          custom_questions: validation.value.customQuestions,
        },
        { onConflict: 'business_id,game_slug' },
      )
      .select(
        'id, business_id, game_slug, title, category, is_enabled, points_per_win, max_points_per_day_per_customer, cooldown_minutes, custom_questions, created_at, updated_at',
      )
      .single();

    if (!error && data) {
      const row = data as {
        id: string;
        business_id: string;
        game_slug: RestaurantGameSlug;
        title: string;
        category: RestaurantGameCategory;
        is_enabled: boolean;
        points_per_win: number;
        max_points_per_day_per_customer: number;
        cooldown_minutes: number;
        custom_questions: RestaurantTriviaQuestion[] | null;
        created_at: string;
        updated_at: string;
      };
      return {
        id: row.id,
        businessId: row.business_id,
        gameSlug: row.game_slug,
        title: row.title,
        category: row.category,
        isEnabled: row.is_enabled,
        pointsPerWin: row.points_per_win,
        maxPointsPerDayPerCustomer: row.max_points_per_day_per_customer,
        cooldownMinutes: row.cooldown_minutes,
        customQuestions: row.custom_questions,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      };
    }

    return mockBusinessRepository.updateRestaurantGameConfig(
      cleanId,
      validation.value,
      options,
    );
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
    await this.verifyBusinessOwnership(cleanId, options);
    const client = this.requireClient();

    const [sessionsRes, txsRes] = await Promise.all([
      client
        .from('restaurant_game_sessions')
        .select('id, status, completed_at')
        .eq('business_id', cleanId)
        .eq('status', 'completed'),
      client
        .from('restaurant_game_point_transactions')
        .select('id, points_delta, created_at')
        .eq('business_id', cleanId)
        .eq('tx_type', 'game_win'),
    ]);

    if (!sessionsRes.error && !txsRes.error && sessionsRes.data && txsRes.data) {
      const startOfToday = new Date();
      startOfToday.setUTCHours(0, 0, 0, 0);
      const todayMs = startOfToday.getTime();

      const sessions = sessionsRes.data as Array<{
        id: string;
        completed_at: string | null;
      }>;
      const txs = txsRes.data as Array<{
        id: string;
        points_delta: number;
        created_at: string;
      }>;

      const sessionsCompletedToday = sessions.filter(
        (s) => s.completed_at && new Date(s.completed_at).getTime() >= todayMs,
      ).length;
      const gamePointsIssuedToday = txs
        .filter((t) => new Date(t.created_at).getTime() >= todayMs)
        .reduce((sum, t) => sum + Number(t.points_delta || 0), 0);
      const totalGamePointsIssued = txs.reduce(
        (sum, t) => sum + Number(t.points_delta || 0),
        0,
      );

      return {
        totalSessionsPlayed: sessions.length,
        sessionsCompletedToday,
        gamePointsIssuedToday,
        totalGamePointsIssued,
      };
    }

    return mockBusinessRepository.getRestaurantGameStats(cleanId, options);
  }

  async registerOrResumeRestaurantCustomer(
    input: RestaurantCustomerCheckInInput,
  ): Promise<RestaurantCustomerWalletState> {
    const validation = validateRestaurantCustomerCheckInInput(input);
    if (!validation.ok) {
      throw new Error(validation.error);
    }

    const client = this.requireClient();
    const { data, error } = await client.rpc(
      'register_or_resume_restaurant_customer',
      {
        p_display_name: validation.value.displayName,
        p_phone_or_email: validation.value.phoneOrEmail,
        p_guest_token_hash: validation.value.guestTokenHash,
        p_business_slug: validation.value.businessSlug,
      },
    );

    if (!error && data && typeof data === 'object') {
      return data as RestaurantCustomerWalletState;
    }

    return mockBusinessRepository.registerOrResumeRestaurantCustomer(input);
  }

  async startRestaurantGameSession(params: {
    businessSlug: string;
    tableKey?: string | null;
    customerId: string;
    gameSlug: RestaurantGameSlug;
  }): Promise<RestaurantGameStartResponse> {
    const client = this.requireClient();
    const { data, error } = await client.rpc('start_restaurant_game_session', {
      p_slug: params.businessSlug.trim().toLowerCase(),
      p_table_key: params.tableKey ? deriveTableKey(params.tableKey) : null,
      p_customer_id: params.customerId,
      p_game_slug: params.gameSlug,
    });

    if (!error && data && typeof data === 'object') {
      return data as RestaurantGameStartResponse;
    }

    if (
      error &&
      (error.message.includes('Cooldown active') ||
        error.message.includes('Daily game point limit') ||
        error.message.includes('turned off') ||
        error.message.includes('disabled'))
    ) {
      throw new Error(error.message);
    }

    return mockBusinessRepository.startRestaurantGameSession(params);
  }

  async completeRestaurantGameSession(params: {
    sessionId: string;
    customerId: string;
    submission: RestaurantGameSubmissionInput;
    idempotencyKey: string;
  }): Promise<RestaurantGameCompletionResponse> {
    const client = this.requireClient();
    const { data, error } = await client.rpc(
      'complete_restaurant_game_session',
      {
        p_session_id: params.sessionId,
        p_customer_id: params.customerId,
        p_submission: params.submission,
        p_idempotency_key: params.idempotencyKey,
      },
    );

    if (!error && data && typeof data === 'object') {
      return data as RestaurantGameCompletionResponse;
    }

    return mockBusinessRepository.completeRestaurantGameSession(params);
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
    await this.verifyBusinessOwnership(cleanId, options);
    const client = this.requireClient();

    const { data, error } = await client
      .from('restaurant_loyalty_rules')
      .select(
        'business_id, stars_per_verified_visit, points_per_star_exchange, allow_point_exchange, max_stars_via_exchange_per_week, wifi_network_name, wifi_password, suggestion_box_enabled, updated_at',
      )
      .eq('business_id', cleanId)
      .maybeSingle();

    if (!error && data) {
      const row = data as {
        business_id: string;
        stars_per_verified_visit: number;
        points_per_star_exchange: number;
        allow_point_exchange: boolean;
        max_stars_via_exchange_per_week: number;
        wifi_network_name: string | null;
        wifi_password: string | null;
        suggestion_box_enabled: boolean;
        updated_at: string;
      };
      return normalizeRestaurantLoyaltyRules(cleanId, {
        starsPerVerifiedVisit: row.stars_per_verified_visit,
        pointsPerStarExchange: row.points_per_star_exchange,
        allowPointExchange: row.allow_point_exchange,
        maxStarsViaExchangePerWeek: row.max_stars_via_exchange_per_week,
        wifiNetworkName: row.wifi_network_name,
        wifiPassword: row.wifi_password,
        suggestionBoxEnabled: row.suggestion_box_enabled,
        updatedAt: row.updated_at,
      });
    }

    return mockBusinessRepository.getRestaurantLoyaltyRules(cleanId, options);
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
    await this.verifyBusinessOwnership(cleanId, options);
    const client = this.requireClient();

    const { data, error } = await client
      .from('restaurant_loyalty_rules')
      .upsert(
        {
          business_id: cleanId,
          stars_per_verified_visit: validation.value.starsPerVerifiedVisit,
          points_per_star_exchange: validation.value.pointsPerStarExchange,
          allow_point_exchange: validation.value.allowPointExchange,
          max_stars_via_exchange_per_week:
            validation.value.maxStarsViaExchangePerWeek,
          wifi_network_name: validation.value.wifiNetworkName,
          wifi_password: validation.value.wifiPassword,
          suggestion_box_enabled: validation.value.suggestionBoxEnabled,
        },
        { onConflict: 'business_id' },
      )
      .select(
        'business_id, stars_per_verified_visit, points_per_star_exchange, allow_point_exchange, max_stars_via_exchange_per_week, wifi_network_name, wifi_password, suggestion_box_enabled, updated_at',
      )
      .single();

    if (!error && data) {
      const row = data as {
        business_id: string;
        stars_per_verified_visit: number;
        points_per_star_exchange: number;
        allow_point_exchange: boolean;
        max_stars_via_exchange_per_week: number;
        wifi_network_name: string | null;
        wifi_password: string | null;
        suggestion_box_enabled: boolean;
        updated_at: string;
      };
      return normalizeRestaurantLoyaltyRules(cleanId, {
        starsPerVerifiedVisit: row.stars_per_verified_visit,
        pointsPerStarExchange: row.points_per_star_exchange,
        allowPointExchange: row.allow_point_exchange,
        maxStarsViaExchangePerWeek: row.max_stars_via_exchange_per_week,
        wifiNetworkName: row.wifi_network_name,
        wifiPassword: row.wifi_password,
        suggestionBoxEnabled: row.suggestion_box_enabled,
        updatedAt: row.updated_at,
      });
    }

    return mockBusinessRepository.updateRestaurantLoyaltyRules(
      cleanId,
      validation.value,
      options,
    );
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
    await this.verifyBusinessOwnership(cleanId, options);
    const client = this.requireClient();

    const { data, error } = await client
      .from('restaurant_rewards')
      .select(
        'id, business_id, title, description, stars_required, is_active, max_redemptions_total, redemptions_count, display_order, created_at, updated_at',
      )
      .eq('business_id', cleanId)
      .order('display_order', { ascending: true })
      .order('stars_required', { ascending: true });

    if (!error && data) {
      return (
        data as Array<{
          id: string;
          business_id: string;
          title: string;
          description: string | null;
          stars_required: number;
          is_active: boolean;
          max_redemptions_total: number | null;
          redemptions_count: number;
          display_order: number;
          created_at: string;
          updated_at: string;
        }>
      ).map((row) => ({
        id: row.id,
        businessId: row.business_id,
        title: row.title,
        description: row.description,
        starsRequired: row.stars_required,
        isActive: row.is_active,
        maxRedemptionsTotal: row.max_redemptions_total,
        redemptionsCount: row.redemptions_count,
        displayOrder: row.display_order,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }));
    }

    return mockBusinessRepository.getRestaurantRewards(cleanId, options);
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
    await this.verifyBusinessOwnership(cleanId, options);
    const client = this.requireClient();

    const { data, error } = await client
      .from('restaurant_rewards')
      .insert({
        business_id: cleanId,
        title: validation.value.title,
        description: validation.value.description,
        stars_required: validation.value.starsRequired,
        is_active: validation.value.isActive,
        max_redemptions_total: validation.value.maxRedemptionsTotal,
        display_order: validation.value.displayOrder,
      })
      .select(
        'id, business_id, title, description, stars_required, is_active, max_redemptions_total, redemptions_count, display_order, created_at, updated_at',
      )
      .single();

    if (error || !data) {
      return mockBusinessRepository.createRestaurantReward(
        cleanId,
        validation.value,
        options,
      );
    }

    const row = data as {
      id: string;
      business_id: string;
      title: string;
      description: string | null;
      stars_required: number;
      is_active: boolean;
      max_redemptions_total: number | null;
      redemptions_count: number;
      display_order: number;
      created_at: string;
      updated_at: string;
    };
    return {
      id: row.id,
      businessId: row.business_id,
      title: row.title,
      description: row.description,
      starsRequired: row.stars_required,
      isActive: row.is_active,
      maxRedemptionsTotal: row.max_redemptions_total,
      redemptionsCount: row.redemptions_count,
      displayOrder: row.display_order,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
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
    await this.verifyBusinessOwnership(cleanId, options);
    const client = this.requireClient();

    const { data, error } = await client
      .from('restaurant_rewards')
      .update({
        title: validation.value.title,
        description: validation.value.description,
        stars_required: validation.value.starsRequired,
        is_active: validation.value.isActive,
        max_redemptions_total: validation.value.maxRedemptionsTotal,
        display_order: validation.value.displayOrder,
      })
      .eq('id', rewardId)
      .eq('business_id', cleanId)
      .select(
        'id, business_id, title, description, stars_required, is_active, max_redemptions_total, redemptions_count, display_order, created_at, updated_at',
      )
      .single();

    if (error || !data) {
      return mockBusinessRepository.updateRestaurantReward(
        cleanId,
        rewardId,
        validation.value,
        options,
      );
    }

    const row = data as {
      id: string;
      business_id: string;
      title: string;
      description: string | null;
      stars_required: number;
      is_active: boolean;
      max_redemptions_total: number | null;
      redemptions_count: number;
      display_order: number;
      created_at: string;
      updated_at: string;
    };
    return {
      id: row.id,
      businessId: row.business_id,
      title: row.title,
      description: row.description,
      starsRequired: row.stars_required,
      isActive: row.is_active,
      maxRedemptionsTotal: row.max_redemptions_total,
      redemptionsCount: row.redemptions_count,
      displayOrder: row.display_order,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
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
    await this.verifyBusinessOwnership(cleanId, options);
    const client = this.requireClient();

    const { error } = await client
      .from('restaurant_rewards')
      .delete()
      .eq('id', rewardId)
      .eq('business_id', cleanId);

    if (error) {
      await mockBusinessRepository.deleteRestaurantReward(
        cleanId,
        rewardId,
        options,
      );
    }
  }

  async exchangeGamePointsForStar(params: {
    businessSlug: string;
    customerId: string;
    idempotencyKey: string;
  }): Promise<RestaurantPointToStarExchangeResponse> {
    const client = this.requireClient();
    const { data, error } = await client.rpc('exchange_game_points_for_star', {
      p_slug: params.businessSlug.trim().toLowerCase(),
      p_customer_id: params.customerId,
      p_idempotency_key: params.idempotencyKey,
    });

    if (!error && data && typeof data === 'object') {
      return data as RestaurantPointToStarExchangeResponse;
    }

    if (
      error &&
      (error.message.includes('Insufficient Game Points') ||
        error.message.includes('Weekly Point-to-Star exchange limit') ||
        error.message.includes('disabled'))
    ) {
      throw new Error(error.message);
    }

    return mockBusinessRepository.exchangeGamePointsForStar(params);
  }

  async claimRestaurantReward(params: {
    businessSlug: string;
    customerId: string;
    rewardId: string;
    idempotencyKey: string;
  }): Promise<RestaurantRewardClaimResponse> {
    const client = this.requireClient();
    const { data, error } = await client.rpc('claim_restaurant_reward', {
      p_slug: params.businessSlug.trim().toLowerCase(),
      p_customer_id: params.customerId,
      p_reward_id: params.rewardId,
      p_idempotency_key: params.idempotencyKey,
    });

    if (!error && data && typeof data === 'object') {
      return data as RestaurantRewardClaimResponse;
    }

    if (
      error &&
      (error.message.includes('Insufficient Loyalty Stars') ||
        error.message.includes('maximum redemption limit') ||
        error.message.includes('not available'))
    ) {
      throw new Error(error.message);
    }

    return mockBusinessRepository.claimRestaurantReward(params);
  }

  async submitRestaurantSuggestion(
    input: RestaurantSuggestionInput,
  ): Promise<RestaurantSuggestion> {
    const validation = validateRestaurantSuggestionInput(input);
    if (!validation.ok) {
      throw new Error(validation.error);
    }

    const client = this.requireClient();
    const { data, error } = await client.rpc('submit_restaurant_suggestion', {
      p_slug: validation.value.businessSlug,
      p_table_key: validation.value.tableKey,
      p_customer_name: validation.value.customerName,
      p_message: validation.value.message,
    });

    if (!error && data && typeof data === 'object') {
      return data as RestaurantSuggestion;
    }

    return mockBusinessRepository.submitRestaurantSuggestion(input);
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
    await this.verifyBusinessOwnership(cleanId, options);
    const client = this.requireClient();

    const { data, error } = await client
      .from('restaurant_suggestions')
      .select(
        'id, business_id, table_id, customer_name, message, is_read, created_at',
      )
      .eq('business_id', cleanId)
      .order('created_at', { ascending: false });

    if (!error && data) {
      return (
        data as Array<{
          id: string;
          business_id: string;
          table_id: string | null;
          customer_name: string | null;
          message: string;
          is_read: boolean;
          created_at: string;
        }>
      ).map((row) => ({
        id: row.id,
        businessId: row.business_id,
        tableId: row.table_id,
        customerName: row.customer_name,
        message: row.message,
        isRead: row.is_read,
        createdAt: row.created_at,
      }));
    }

    return mockBusinessRepository.getRestaurantSuggestions(cleanId, options);
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
    await this.verifyBusinessOwnership(cleanId, options);
    const client = this.requireClient();

    const { data, error } = await client
      .from('restaurant_suggestions')
      .update({ is_read: isRead })
      .eq('id', suggestionId)
      .eq('business_id', cleanId)
      .select(
        'id, business_id, table_id, customer_name, message, is_read, created_at',
      )
      .single();

    if (!error && data) {
      const row = data as {
        id: string;
        business_id: string;
        table_id: string | null;
        customer_name: string | null;
        message: string;
        is_read: boolean;
        created_at: string;
      };
      return {
        id: row.id,
        businessId: row.business_id,
        tableId: row.table_id,
        customerName: row.customer_name,
        message: row.message,
        isRead: row.is_read,
        createdAt: row.created_at,
      };
    }

    return mockBusinessRepository.markRestaurantSuggestionRead(
      cleanId,
      suggestionId,
      isRead,
      options,
    );
  }

  // ---------------------------------------------------------------------------
  // Phase 4: Visual Table Floor Map, Staff Verification Mode & Owner Analytics
  // ---------------------------------------------------------------------------

  async createRestaurantTableCall(params: {
    businessSlug: string;
    tableKey: string;
    customerId?: string | null;
    callType: RestaurantTableCallType;
  }): Promise<RestaurantTableCall> {
    const client = this.requireClient();
    const { data, error } = await client.rpc('create_restaurant_table_call', {
      p_slug: params.businessSlug.trim().toLowerCase(),
      p_table_key: deriveTableKey(params.tableKey),
      p_customer_id: params.customerId ?? null,
      p_call_type: params.callType,
    });

    if (!error && data && typeof data === 'object') {
      return data as RestaurantTableCall;
    }

    return mockBusinessRepository.createRestaurantTableCall(params);
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
    const client = this.requireClient();
    const { data, error } = await client.rpc('verify_staff_pin', {
      p_slug: params.businessSlug.trim().toLowerCase(),
      p_staff_pin_hash: params.staffPinHash ?? null,
    });

    if (!error && data && typeof data === 'object') {
      return data as {
        verified: boolean;
        businessId: string;
        businessSlug: string;
        businessName: string;
      };
    }

    if (error && error.message.includes('Invalid Staff PIN')) {
      throw new Error(error.message);
    }

    return mockBusinessRepository.verifyRestaurantStaffPin(params);
  }

  async updateRestaurantTableCallStatus(params: {
    businessSlug: string;
    callId: string;
    status: RestaurantTableCallStatus;
    assignedStaffLabel?: string | null;
    staffPinHash?: string | null;
    options?: AIConfigAccessOptions;
  }): Promise<RestaurantTableCall> {
    const client = this.requireClient();
    const { data, error } = await client.rpc(
      'update_restaurant_table_call_status',
      {
        p_slug: params.businessSlug.trim().toLowerCase(),
        p_call_id: params.callId,
        p_new_status: params.status,
        p_staff_pin_hash: params.staffPinHash ?? null,
        p_assigned_staff_label: params.assignedStaffLabel ?? null,
      },
    );

    if (!error && data && typeof data === 'object') {
      return data as RestaurantTableCall;
    }

    if (error && error.message.includes('Unauthorized')) {
      throw new Error(error.message);
    }

    return mockBusinessRepository.updateRestaurantTableCallStatus(params);
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
    const client = this.requireClient();
    const { data, error } = await client.rpc('staff_award_visit_stars', {
      p_slug: params.businessSlug.trim().toLowerCase(),
      p_customer_lookup: params.customerLookup,
      p_table_key: params.tableKey ? deriveTableKey(params.tableKey) : null,
      p_staff_label: params.staffLabel ?? 'Staff',
      p_idempotency_key: params.idempotencyKey,
      p_staff_pin_hash: params.staffPinHash ?? null,
    });

    if (!error && data && typeof data === 'object') {
      return data as RestaurantStaffAwardVisitResponse;
    }

    if (
      error &&
      (error.message.includes('Unauthorized') ||
        error.message.includes('Visit Star cooldown active') ||
        error.message.includes('Diner account not found'))
    ) {
      throw new Error(error.message);
    }

    return mockBusinessRepository.staffAwardVisitStars(params);
  }

  async staffFulfillRewardClaim(params: {
    businessSlug: string;
    claimCode: string;
    staffLabel?: string;
    staffPinHash?: string | null;
    options?: AIConfigAccessOptions;
  }): Promise<RestaurantRewardClaim & { customerName?: string }> {
    const client = this.requireClient();
    const { data, error } = await client.rpc('staff_fulfill_reward_claim', {
      p_slug: params.businessSlug.trim().toLowerCase(),
      p_claim_code: params.claimCode.trim().toUpperCase(),
      p_staff_label: params.staffLabel ?? 'Staff',
      p_staff_pin_hash: params.staffPinHash ?? null,
    });

    if (!error && data && typeof data === 'object') {
      return data as RestaurantRewardClaim & { customerName?: string };
    }

    if (
      error &&
      (error.message.includes('Unauthorized') ||
        error.message.includes('already been fulfilled') ||
        error.message.includes('not found'))
    ) {
      throw new Error(error.message);
    }

    return mockBusinessRepository.staffFulfillRewardClaim(params);
  }

  async getRestaurantFloorAndAnalytics(params: {
    businessSlug: string;
    staffPinHash?: string | null;
    options?: AIConfigAccessOptions;
  }): Promise<RestaurantFloorAndAnalyticsPayload> {
    const client = this.requireClient();
    const { data, error } = await client.rpc(
      'get_restaurant_floor_and_analytics',
      {
        p_slug: params.businessSlug.trim().toLowerCase(),
        p_staff_pin_hash: params.staffPinHash ?? null,
      },
    );

    if (!error && data && typeof data === 'object') {
      const payload = data as RestaurantFloorAndAnalyticsPayload;
      // If Migration 020 hasn't been applied on Supabase yet, overlay any local floor layout saved by the owner
      if (
        payload.floorWidthFt === undefined &&
        Array.isArray(payload.tables) &&
        payload.tables.length > 0 &&
        typeof window !== 'undefined' &&
        window.localStorage
      ) {
        const bizId = payload.tables[0]?.businessId;
        if (bizId) {
          try {
            const raw = window.localStorage.getItem(
              `vitaran_floor_layout_${bizId}`,
            );
            if (raw) {
              const saved = JSON.parse(raw) as {
                floorWidthFt?: number;
                floorHeightFt?: number;
                tables?: FloorTableLayoutItem[];
              };
              const byId = new Map(
                (saved.tables ?? []).map((t) => [t.id, t]),
              );
              return {
                ...payload,
                floorWidthFt: saved.floorWidthFt ?? 40,
                floorHeightFt: saved.floorHeightFt ?? 28,
                tables: payload.tables.map((tbl) => {
                  const patch = byId.get(tbl.id);
                  return patch
                    ? {
                        ...tbl,
                        tableShape: patch.tableShape,
                        posX: patch.posX,
                        posY: patch.posY,
                        widthUnits: patch.widthUnits,
                        heightUnits: patch.heightUnits,
                        seatCapacity: patch.seatCapacity ?? tbl.seatCapacity,
                      }
                    : tbl;
                }),
              };
            }
          } catch {
            // ignore corrupted fallback cache
          }
        }
      }
      return payload;
    }

    return mockBusinessRepository.getRestaurantFloorAndAnalytics(params);
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
    await this.verifyBusinessOwnership(cleanId, options);
    const client = this.requireClient();

    const { data, error } = await client.rpc('apply_restaurant_menu_preset', {
      p_business_id: cleanId,
      p_preset_key: presetCheck.value,
    });

    if (!error && data && typeof data === 'object') {
      return data as ApplyMenuPresetResult;
    }

    if (error && error.message.includes('Unauthorized')) {
      throw new Error(error.message);
    }

    // Graceful fallback if migration 012 RPC is not yet applied on remote DB
    const pack = MENU_PRESET_PACKS[presetCheck.value];
    const existingCats = await this.getRestaurantMenuCategories(
      cleanId,
      options,
    );
    let itemsInserted = 0;

    for (let cIdx = 0; cIdx < pack.categories.length; cIdx++) {
      const catSpec = pack.categories[cIdx];
      const createdCat = await this.createRestaurantMenuCategory(
        cleanId,
        {
          name: catSpec.name,
          description: catSpec.description,
          displayOrder: existingCats.length + cIdx,
          isActive: true,
        },
        options,
      );
      for (let dIdx = 0; dIdx < catSpec.dishes.length; dIdx++) {
        const dSpec = catSpec.dishes[dIdx];
        await this.createRestaurantMenuItem(
          cleanId,
          {
            categoryId: createdCat.id,
            name: dSpec.name,
            description: dSpec.description,
            pricePaise: dSpec.pricePaise,
            dietaryTag: dSpec.dietaryTag,
            isAvailable: true,
            isFeatured: Boolean(dSpec.isFeatured),
            displayOrder: dIdx,
          },
          options,
        );
        itemsInserted++;
      }
    }

    const existingRewards = await this.getRestaurantRewards(cleanId, options);
    let rewardsInserted = 0;
    if (existingRewards.length === 0) {
      for (let rIdx = 0; rIdx < pack.starterRewards.length; rIdx++) {
        const rSpec = pack.starterRewards[rIdx];
        await this.createRestaurantReward(
          cleanId,
          {
            title: rSpec.title,
            description: rSpec.description,
            starsRequired: rSpec.starsRequired,
            isActive: true,
            displayOrder: rIdx,
          },
          options,
        );
        rewardsInserted++;
      }
    }

    const currentProf = await this.getRestaurantProfile(cleanId, options);
    await this.updateRestaurantProfile(
      cleanId,
      {
        isEnabled: true,
        currencyCode: currentProf.currencyCode,
        tagline: currentProf.tagline || pack.tagline,
        gamesEnabled: currentProf.gamesEnabled,
        loyaltyEnabled: currentProf.loyaltyEnabled,
        tableOrderingEnabled: currentProf.tableOrderingEnabled,
        menuThemeTemplate: pack.themeTemplate,
      },
      options,
    );

    return {
      presetKey: pack.presetKey,
      themeTemplate: pack.themeTemplate,
      categoriesInserted: pack.categories.length,
      itemsInserted,
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

    const client = this.requireClient();
    const { data, error } = await client.rpc('submit_customer_table_order', {
      p_slug: params.businessSlug.trim().toLowerCase(),
      p_table_key: params.tableKey ? deriveTableKey(params.tableKey) : null,
      p_customer_id: params.customerId ?? null,
      p_guest_name: params.guestName ?? null,
      p_items: itemsValidation.value,
      p_kitchen_note: params.kitchenNote?.trim().slice(0, 300) ?? null,
    });

    if (!error && data && typeof data === 'object') {
      return data as RestaurantTableOrder;
    }

    if (
      error &&
      (error.message.includes('turned off') ||
        error.message.includes('paused') ||
        error.message.includes('unavailable') ||
        error.message.includes('not active'))
    ) {
      throw new Error(error.message);
    }

    return mockBusinessRepository.submitCustomerTableOrder(params);
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

    const client = this.requireClient();
    const { data, error } = await client.rpc('update_table_order_status', {
      p_slug: params.businessSlug.trim().toLowerCase(),
      p_order_id: params.orderId,
      p_new_status: statusCheck.value,
      p_staff_label: params.staffLabel ?? 'Staff',
      p_staff_pin_hash: params.staffPinHash ?? null,
    });

    if (!error && data && typeof data === 'object') {
      return data as RestaurantTableOrder;
    }

    // Resilient owner-session fallback if an older DB RPC fails on NULL table_id (e.g. before Migration 021)
    if (error && !params.staffPinHash) {
      const nextApproved =
        statusCheck.value === 'approved_for_kitchen' ||
        statusCheck.value === 'preparing' ||
        statusCheck.value === 'ready' ||
        statusCheck.value === 'served';
      const { data: directRow, error: directErr } = await client
        .from('restaurant_table_orders')
        .update({
          status: statusCheck.value,
          ...(nextApproved
            ? { approved_by: params.staffLabel ?? 'Owner' }
            : {}),
          updated_at: new Date().toISOString(),
        })
        .eq('id', params.orderId)
        .select('*')
        .single();

      if (!directErr && directRow) {
        const row = directRow as {
          id: string;
          business_id: string;
          table_id: string | null;
          customer_id: string | null;
          guest_name: string | null;
          items: RestaurantTableOrder['items'];
          status: RestaurantTableOrderStatus;
          order_source?: RestaurantOrderSource;
          platform_order_number?: string | null;
          packaging_paise?: number | null;
          kitchen_note?: string | null;
          bill_session_id?: string | null;
          payment_status?: RestaurantTableOrder['paymentStatus'];
          payment_method?: RestaurantPaymentMethod | null;
          paid_at?: string | null;
          customer_repeat_visit_count?: number | null;
          approved_by: string | null;
          created_at: string;
          updated_at: string;
        };
        return {
          id: row.id,
          businessId: row.business_id,
          tableId: row.table_id,
          customerId: row.customer_id,
          guestName: row.guest_name,
          items: row.items,
          status: row.status,
          orderSource: row.order_source ?? 'qr_table',
          platformOrderNumber: row.platform_order_number ?? null,
          packagingPaise: row.packaging_paise ?? 0,
          kitchenNote: row.kitchen_note ?? null,
          billSessionId: row.bill_session_id ?? null,
          paymentStatus: row.payment_status ?? 'unpaid',
          paymentMethod: row.payment_method ?? null,
          paidAt: row.paid_at ?? null,
          customerRepeatVisitCount: row.customer_repeat_visit_count ?? 1,
          approvedBy: row.approved_by,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        };
      }
    }

    if (error) {
      throw new Error(error.message);
    }

    return mockBusinessRepository.updateTableOrderStatus(params);
  }

  // ---------------------------------------------------------------------------
  // Complete Hospitality OS (Migration 019): Counter POS, Platform Orders,
  // 2-Way Live Table/Room Chat, Multi-Order Open Bills & Supabase Realtime
  // ---------------------------------------------------------------------------

  async createPosOrPlatformOrder(
    input: CreatePosOrPlatformOrderInput,
    options?: AIConfigAccessOptions,
  ): Promise<RestaurantTableOrder> {
    const idErr = validateBusinessId(input.businessId);
    if (idErr) throw new Error(idErr);
    const itemsValidation = validateTableOrderItemsInput(input.items);
    if (!itemsValidation.ok) throw new Error(itemsValidation.error);

    const cleanId = input.businessId.trim();
    if (!input.staffPinHash) {
      await this.verifyBusinessOwnership(cleanId, options);
    }
    const client = this.requireClient();

    const { data, error } = await client.rpc('create_pos_or_platform_order', {
      p_business_id: cleanId,
      p_order_source: input.orderSource,
      p_table_id: input.tableId ?? null,
      p_platform_order_number: input.platformOrderNumber ?? null,
      p_customer_name: input.customerName ?? null,
      p_customer_phone: input.customerPhone ?? null,
      p_kitchen_note: input.kitchenNote ?? null,
      p_packaging_paise: Math.max(0, Math.round(input.packagingPaise ?? 0)),
      p_items: itemsValidation.value,
      p_staff_label: input.staffLabel ?? 'Owner',
      p_staff_pin_hash: input.staffPinHash ?? null,
    });

    if (!error && data && typeof data === 'object') {
      return data as RestaurantTableOrder;
    }
    if (error && error.message.includes('Unauthorized')) {
      throw new Error(error.message);
    }

    return mockBusinessRepository.createPosOrPlatformOrder(input, options);
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
    const client = this.requireClient();
    const { data, error } = await client.rpc('send_table_chat_message', {
      p_slug: params.businessSlug.trim().toLowerCase(),
      p_table_key: deriveTableKey(params.tableKey),
      p_sender_role: params.senderRole,
      p_sender_name: params.senderName ?? null,
      p_message_text: params.messageText.trim().slice(0, 600),
      p_staff_pin_hash: params.staffPinHash ?? null,
    });

    if (!error && Array.isArray(data)) {
      return data as RestaurantTableMessage[];
    }
    if (error && error.message.includes('Unauthorized')) {
      throw new Error(error.message);
    }

    return mockBusinessRepository.sendTableChatMessage(params);
  }

  async getTableChatMessages(params: {
    businessSlug: string;
    tableKey: string;
  }): Promise<RestaurantTableMessage[]> {
    const client = this.requireClient();
    const { data, error } = await client.rpc('get_table_chat_messages', {
      p_slug: params.businessSlug.trim().toLowerCase(),
      p_table_key: deriveTableKey(params.tableKey),
    });

    if (!error && Array.isArray(data)) {
      return data as RestaurantTableMessage[];
    }

    return mockBusinessRepository.getTableChatMessages(params);
  }

  async getOpenTableBillSummary(params: {
    businessSlug: string;
    tableKey: string;
  }): Promise<OpenTableBillSummary | null> {
    const client = this.requireClient();
    const { data, error } = await client.rpc('get_open_table_bill_summary', {
      p_slug: params.businessSlug.trim().toLowerCase(),
      p_table_key: deriveTableKey(params.tableKey),
    });

    if (!error) {
      return (data as OpenTableBillSummary | null) ?? null;
    }

    return mockBusinessRepository.getOpenTableBillSummary(params);
  }

  async markTableBillUpiPending(params: {
    businessSlug: string;
    tableKey: string;
    guestName?: string | null;
  }): Promise<OpenTableBillSummary | null> {
    const client = this.requireClient();
    const { data, error } = await client.rpc('mark_table_bill_upi_pending', {
      p_slug: params.businessSlug.trim().toLowerCase(),
      p_table_key: deriveTableKey(params.tableKey),
      p_guest_name: params.guestName ?? null,
    });

    if (!error) {
      return (data as OpenTableBillSummary | null) ?? null;
    }

    return mockBusinessRepository.markTableBillUpiPending(params);
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
    if (!params.staffPinHash) {
      await this.verifyBusinessOwnership(cleanId, params.options);
    }
    const client = this.requireClient();

    const { data, error } = await client.rpc('complete_table_bill_checkout', {
      p_business_id: cleanId,
      p_table_id: params.tableId,
      p_payment_method: params.paymentMethod,
      p_staff_label: params.staffLabel ?? 'Owner',
      p_staff_pin_hash: params.staffPinHash ?? null,
    });

    if (!error && data && typeof data === 'object') {
      return data as CompleteTableBillCheckoutResult;
    }
    if (error && error.message.includes('Unauthorized')) {
      throw new Error(error.message);
    }

    return mockBusinessRepository.completeTableBillCheckout(params);
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
    await this.verifyBusinessOwnership(cleanId, params.options);
    const client = this.requireClient();

    const { data, error } = await client.rpc('save_restaurant_floor_layout', {
      p_business_id: cleanId,
      p_floor_width_ft: Math.max(
        10,
        Math.min(300, Math.round(params.floorWidthFt || 40)),
      ),
      p_floor_height_ft: Math.max(
        10,
        Math.min(300, Math.round(params.floorHeightFt || 28)),
      ),
      p_tables: params.tables,
    });

    if (!error && data && typeof data === 'object') {
      return data as {
        floorWidthFt: number;
        floorHeightFt: number;
        updatedTablesCount: number;
      };
    }
    if (error && error.message.includes('Unauthorized')) {
      throw new Error(error.message);
    }

    // Graceful localStorage persistence if Migration 020 hasn't been applied yet
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(
          `vitaran_floor_layout_${cleanId}`,
          JSON.stringify({
            floorWidthFt: params.floorWidthFt,
            floorHeightFt: params.floorHeightFt,
            tables: params.tables,
          }),
        );
      }
    } catch {
      // ignore localStorage errors
    }

    return {
      floorWidthFt: params.floorWidthFt,
      floorHeightFt: params.floorHeightFt,
      updatedTablesCount: params.tables.length,
    };
  }

  subscribeToHospitalityRealtime(
    businessId: string,
    onChange: (event: {
      table:
        | 'restaurant_table_orders'
        | 'restaurant_table_calls'
        | 'restaurant_table_messages';
    }) => void,
  ): () => void {
    if (!supabase || !businessId) {
      return mockBusinessRepository.subscribeToHospitalityRealtime(
        businessId,
        onChange,
      );
    }

    const client = supabase;
    const channelName = `hospitality-live-${businessId}-${Math.random().toString(36).slice(2, 8)}`;
    const channel = client
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'restaurant_table_orders',
          filter: `business_id=eq.${businessId}`,
        },
        () => onChange({ table: 'restaurant_table_orders' }),
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'restaurant_table_calls',
          filter: `business_id=eq.${businessId}`,
        },
        () => onChange({ table: 'restaurant_table_calls' }),
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'restaurant_table_messages',
          filter: `business_id=eq.${businessId}`,
        },
        () => onChange({ table: 'restaurant_table_messages' }),
      )
      .subscribe();

    return () => {
      void client.removeChannel(channel);
    };
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
    await this.verifyBusinessOwnership(cleanId, options);
    const client = this.requireClient();

    const { data, error } = await client
      .from('restaurant_staff_members')
      .select(
        'id, business_id, staff_code, full_name, role, pin_hash, is_active, created_at, updated_at',
      )
      .eq('business_id', cleanId)
      .order('staff_code', { ascending: true });

    if (!error && data) {
      return (
        data as Array<{
          id: string;
          business_id: string;
          staff_code: string;
          full_name: string;
          role: RestaurantStaffRole;
          pin_hash: string;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        }>
      ).map((row) => ({
        id: row.id,
        businessId: row.business_id,
        staffCode: row.staff_code,
        fullName: row.full_name,
        role: row.role,
        pinHash: row.pin_hash,
        isActive: row.is_active,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }));
    }

    return mockBusinessRepository.getRestaurantStaffMembers(cleanId, options);
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
    await this.verifyBusinessOwnership(cleanId, options);
    const client = this.requireClient();

    let staffCode = validation.value.staffCode;
    if (!staffCode) {
      const existing = await this.getRestaurantStaffMembers(cleanId, options);
      staffCode = generateNextStaffCode(
        validation.value.role,
        existing.map((m) => m.staffCode),
      );
    }

    const { data, error } = await client
      .from('restaurant_staff_members')
      .insert({
        business_id: cleanId,
        staff_code: staffCode,
        full_name: validation.value.fullName,
        role: validation.value.role,
        pin_hash: validation.value.pinHash!,
        is_active: validation.value.isActive,
      })
      .select(
        'id, business_id, staff_code, full_name, role, pin_hash, is_active, created_at, updated_at',
      )
      .single();

    if (error) {
      if (error.code === '23505') {
        throw new Error(
          `Staff ID "${staffCode}" is already assigned to another team member.`,
        );
      }
      return mockBusinessRepository.createRestaurantStaffMember(
        cleanId,
        { ...validation.value, staffCode },
        options,
      );
    }

    const row = data as {
      id: string;
      business_id: string;
      staff_code: string;
      full_name: string;
      role: RestaurantStaffRole;
      pin_hash: string;
      is_active: boolean;
      created_at: string;
      updated_at: string;
    };
    return {
      id: row.id,
      businessId: row.business_id,
      staffCode: row.staff_code,
      fullName: row.full_name,
      role: row.role,
      pinHash: row.pin_hash,
      isActive: row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
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
    await this.verifyBusinessOwnership(cleanId, options);
    const client = this.requireClient();

    const updatePayload: Record<string, unknown> = {
      full_name: validation.value.fullName,
      role: validation.value.role,
      is_active: validation.value.isActive,
      updated_at: new Date().toISOString(),
    };
    if (validation.value.staffCode) {
      updatePayload.staff_code = validation.value.staffCode;
    }
    if (validation.value.pinHash) {
      updatePayload.pin_hash = validation.value.pinHash;
    }

    const { data, error } = await client
      .from('restaurant_staff_members')
      .update(updatePayload)
      .eq('id', staffId)
      .eq('business_id', cleanId)
      .select(
        'id, business_id, staff_code, full_name, role, pin_hash, is_active, created_at, updated_at',
      )
      .single();

    if (error) {
      if (error.code === '23505') {
        throw new Error(
          `Staff ID "${validation.value.staffCode ?? ''}" is already assigned to another team member.`,
        );
      }
      return mockBusinessRepository.updateRestaurantStaffMember(
        cleanId,
        staffId,
        validation.value,
        options,
      );
    }

    const row = data as {
      id: string;
      business_id: string;
      staff_code: string;
      full_name: string;
      role: RestaurantStaffRole;
      pin_hash: string;
      is_active: boolean;
      created_at: string;
      updated_at: string;
    };
    return {
      id: row.id,
      businessId: row.business_id,
      staffCode: row.staff_code,
      fullName: row.full_name,
      role: row.role,
      pinHash: row.pin_hash,
      isActive: row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
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
    await this.verifyBusinessOwnership(cleanId, options);
    const client = this.requireClient();

    const { error } = await client
      .from('restaurant_staff_members')
      .delete()
      .eq('id', staffId)
      .eq('business_id', cleanId);

    if (error) {
      await mockBusinessRepository.deleteRestaurantStaffMember(
        cleanId,
        staffId,
        options,
      );
    }
  }

  async getPublicStaffLoginDirectory(
    businessSlug: string,
  ): Promise<PublicStaffLoginOption[]> {
    const client = this.requireClient();
    const { data, error } = await client.rpc(
      'get_public_staff_roster_for_login',
      {
        p_slug: businessSlug.trim().toLowerCase(),
      },
    );

    if (!error && Array.isArray(data)) {
      return data as PublicStaffLoginOption[];
    }

    return mockBusinessRepository.getPublicStaffLoginDirectory(businessSlug);
  }

  async verifyStaffMemberPin(params: {
    businessSlug: string;
    staffCode?: string | null;
    staffPinHash?: string | null;
    options?: AIConfigAccessOptions;
  }): Promise<VerifiedStaffMemberSession> {
    const client = this.requireClient();
    const cleanCode = (params.staffCode ?? '').trim().toUpperCase() || null;
    const cleanHash = (params.staffPinHash ?? '').trim().toLowerCase() || null;

    const { data, error } = await client.rpc('verify_staff_member_pin', {
      p_slug: params.businessSlug.trim().toLowerCase(),
      p_staff_code_or_pin_hash: cleanCode ?? cleanHash,
      p_pin_hash: cleanCode ? cleanHash : null,
    });

    if (!error && data && typeof data === 'object') {
      return data as VerifiedStaffMemberSession;
    }

    if (
      error &&
      (error.message.includes('Invalid Staff ID or PIN') ||
        error.message.includes('Invalid Staff PIN'))
    ) {
      throw new Error(error.message);
    }

    // Backwards compatibility fallback when migration 013 RPC is not yet live
    try {
      const legacy = await this.verifyRestaurantStaffPin({
        businessSlug: params.businessSlug,
        staffPinHash: params.staffPinHash,
        options: params.options,
      });
      if (legacy.verified) {
        return {
          verified: true,
          staffId: null,
          staffCode: 'STAFF',
          fullName: 'Floor Staff',
          role: 'manager',
          staffLabel: 'Floor Staff (STAFF)',
          businessId: legacy.businessId,
          businessSlug: legacy.businessSlug,
          businessName: legacy.businessName,
        };
      }
    } catch {
      // Fall through to mock repository fallback
    }

    return mockBusinessRepository.verifyStaffMemberPin(params);
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
    await this.verifyBusinessOwnership(cleanId, options);
    const client = this.requireClient();

    let query = client
      .from('restaurant_monthly_inventory')
      .select(
        'id, business_id, month_key, entry_type, category, item_name, quantity_label, amount_paise, low_stock_alert, notes, created_at, updated_at',
      )
      .eq('business_id', cleanId);

    const cleanMonth = (monthKey ?? '').trim();
    if (cleanMonth) {
      query = query.eq('month_key', cleanMonth);
    }

    const { data, error } = await query.order('created_at', {
      ascending: false,
    });

    if (!error && data) {
      return (
        data as Array<{
          id: string;
          business_id: string;
          month_key: string;
          entry_type: MonthlyInventoryEntryType;
          category: string;
          item_name: string;
          quantity_label: string | null;
          amount_paise: number;
          low_stock_alert: boolean;
          notes: string | null;
          created_at: string;
          updated_at: string;
        }>
      ).map((row) => ({
        id: row.id,
        businessId: row.business_id,
        monthKey: row.month_key,
        entryType: row.entry_type,
        category: row.category,
        itemName: row.item_name,
        quantityLabel: row.quantity_label,
        amountPaise: row.amount_paise,
        lowStockAlert: row.low_stock_alert,
        notes: row.notes,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }));
    }

    return mockBusinessRepository.getRestaurantMonthlyInventory(
      cleanId,
      monthKey,
      options,
    );
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
    await this.verifyBusinessOwnership(cleanId, options);
    const client = this.requireClient();

    const { data, error } = await client
      .from('restaurant_monthly_inventory')
      .insert({
        business_id: cleanId,
        month_key: validation.value.monthKey,
        entry_type: validation.value.entryType,
        category: validation.value.category,
        item_name: validation.value.itemName,
        quantity_label: validation.value.quantityLabel,
        amount_paise: validation.value.amountPaise,
        low_stock_alert: validation.value.lowStockAlert,
        notes: validation.value.notes,
      })
      .select(
        'id, business_id, month_key, entry_type, category, item_name, quantity_label, amount_paise, low_stock_alert, notes, created_at, updated_at',
      )
      .single();

    if (error || !data) {
      return mockBusinessRepository.createRestaurantMonthlyInventoryItem(
        cleanId,
        validation.value,
        options,
      );
    }

    const row = data as {
      id: string;
      business_id: string;
      month_key: string;
      entry_type: MonthlyInventoryEntryType;
      category: string;
      item_name: string;
      quantity_label: string | null;
      amount_paise: number;
      low_stock_alert: boolean;
      notes: string | null;
      created_at: string;
      updated_at: string;
    };
    return {
      id: row.id,
      businessId: row.business_id,
      monthKey: row.month_key,
      entryType: row.entry_type,
      category: row.category,
      itemName: row.item_name,
      quantityLabel: row.quantity_label,
      amountPaise: row.amount_paise,
      lowStockAlert: row.low_stock_alert,
      notes: row.notes,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
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
    await this.verifyBusinessOwnership(cleanId, options);
    const client = this.requireClient();

    const { data, error } = await client
      .from('restaurant_monthly_inventory')
      .update({
        month_key: validation.value.monthKey,
        entry_type: validation.value.entryType,
        category: validation.value.category,
        item_name: validation.value.itemName,
        quantity_label: validation.value.quantityLabel,
        amount_paise: validation.value.amountPaise,
        low_stock_alert: validation.value.lowStockAlert,
        notes: validation.value.notes,
        updated_at: new Date().toISOString(),
      })
      .eq('id', itemId)
      .eq('business_id', cleanId)
      .select(
        'id, business_id, month_key, entry_type, category, item_name, quantity_label, amount_paise, low_stock_alert, notes, created_at, updated_at',
      )
      .single();

    if (error || !data) {
      return mockBusinessRepository.updateRestaurantMonthlyInventoryItem(
        cleanId,
        itemId,
        validation.value,
        options,
      );
    }

    const row = data as {
      id: string;
      business_id: string;
      month_key: string;
      entry_type: MonthlyInventoryEntryType;
      category: string;
      item_name: string;
      quantity_label: string | null;
      amount_paise: number;
      low_stock_alert: boolean;
      notes: string | null;
      created_at: string;
      updated_at: string;
    };
    return {
      id: row.id,
      businessId: row.business_id,
      monthKey: row.month_key,
      entryType: row.entry_type,
      category: row.category,
      itemName: row.item_name,
      quantityLabel: row.quantity_label,
      amountPaise: row.amount_paise,
      lowStockAlert: row.low_stock_alert,
      notes: row.notes,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
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
    await this.verifyBusinessOwnership(cleanId, options);
    const client = this.requireClient();

    const { error } = await client
      .from('restaurant_monthly_inventory')
      .delete()
      .eq('id', itemId)
      .eq('business_id', cleanId);

    if (error) {
      await mockBusinessRepository.deleteRestaurantMonthlyInventoryItem(
        cleanId,
        itemId,
        options,
      );
    }
  }

  // ---------------------------------------------------------------------------
  // Module 4: Barber & Salon Live Queue Timer, Broadcast Delays & Loyalty
  // ---------------------------------------------------------------------------

  async getBarberQueueConfig(
    businessId: string,
    options?: AIConfigAccessOptions,
  ): Promise<BarberQueueConfig> {
    const idErr = validateBusinessId(businessId);
    if (idErr) {
      throw new Error(idErr);
    }
    const cleanId = businessId.trim();
    await this.verifyBusinessOwnership(cleanId, options);
    const client = this.requireClient();

    const { data, error } = await client
      .from('barber_queue_configs')
      .select(
        'business_id, is_queue_open, avg_service_minutes, max_queue_size, award_star_on_completion, services, created_at, updated_at',
      )
      .eq('business_id', cleanId)
      .maybeSingle();

    if (!error && data) {
      const row = data as {
        business_id: string;
        is_queue_open: boolean;
        avg_service_minutes: number;
        max_queue_size: number;
        award_star_on_completion: boolean;
        services: BarberQueueService[];
        created_at: string;
        updated_at: string;
      };
      return normalizeBarberQueueConfig(cleanId, {
        isQueueOpen: row.is_queue_open,
        avgServiceMinutes: row.avg_service_minutes,
        maxQueueSize: row.max_queue_size,
        awardStarOnCompletion: row.award_star_on_completion,
        services: row.services,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      });
    }

    if (!error && !data) {
      return normalizeBarberQueueConfig(cleanId, null);
    }

    return mockBusinessRepository.getBarberQueueConfig(cleanId, options);
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
    await this.verifyBusinessOwnership(cleanId, options);
    const client = this.requireClient();
    const now = new Date().toISOString();

    const { data, error } = await client
      .from('barber_queue_configs')
      .upsert(
        {
          business_id: cleanId,
          is_queue_open: validation.value.isQueueOpen,
          avg_service_minutes: validation.value.avgServiceMinutes,
          max_queue_size: validation.value.maxQueueSize,
          award_star_on_completion: validation.value.awardStarOnCompletion,
          services: validation.value.services,
          updated_at: now,
        },
        { onConflict: 'business_id' },
      )
      .select(
        'business_id, is_queue_open, avg_service_minutes, max_queue_size, award_star_on_completion, services, created_at, updated_at',
      )
      .single();

    if (!error && data) {
      const row = data as {
        business_id: string;
        is_queue_open: boolean;
        avg_service_minutes: number;
        max_queue_size: number;
        award_star_on_completion: boolean;
        services: BarberQueueService[];
        created_at: string;
        updated_at: string;
      };
      return normalizeBarberQueueConfig(cleanId, {
        isQueueOpen: row.is_queue_open,
        avgServiceMinutes: row.avg_service_minutes,
        maxQueueSize: row.max_queue_size,
        awardStarOnCompletion: row.award_star_on_completion,
        services: row.services,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      });
    }

    return mockBusinessRepository.updateBarberQueueConfig(
      cleanId,
      validation.value,
      options,
    );
  }

  async getPublicBarberQueueStatus(
    businessSlug: string,
  ): Promise<PublicBarberQueueStatusPayload | null> {
    const cleanSlug = (businessSlug ?? '').trim().toLowerCase();
    if (!/^[a-z0-9-]{3,80}$/.test(cleanSlug)) {
      return null;
    }
    const client = this.requireClient();
    const { data, error } = await client.rpc('get_public_barber_queue_status', {
      p_slug: cleanSlug,
    });

    if (!error) {
      if (data) {
        return data as PublicBarberQueueStatusPayload;
      }
      // Allow built-in demo slug (e.g. crown-cuts-barber) to work cleanly in preview mode
      const demoFallback =
        await mockBusinessRepository.getPublicBarberQueueStatus(cleanSlug);
      if (demoFallback) {
        return demoFallback;
      }
      return null;
    }

    return mockBusinessRepository.getPublicBarberQueueStatus(cleanSlug);
  }

  async joinBarberQueue(
    input: JoinBarberQueueInput,
  ): Promise<JoinBarberQueueResult> {
    const validation = validateJoinBarberQueueInput(input);
    if (!validation.ok) {
      throw new Error(validation.error);
    }

    const client = this.requireClient();
    const { data, error } = await client.rpc('join_barber_queue', {
      p_slug: validation.value.businessSlug,
      p_guest_name: validation.value.guestName,
      p_phone: validation.value.phone,
      p_service_name: validation.value.serviceName,
      p_booking_type: validation.value.bookingType,
      p_scheduled_time: validation.value.scheduledTime,
    });

    if (!error && data && typeof data === 'object') {
      return data as JoinBarberQueueResult;
    }

    if (
      error &&
      (error.message.includes('paused') ||
        error.message.includes('full') ||
        error.message.includes('already reserved') ||
        error.message.includes('valid appointment'))
    ) {
      throw new Error(error.message);
    }

    if (error && error.message.includes('not active')) {
      const isDemo = await mockBusinessRepository.getBusinessBySlug(
        validation.value.businessSlug,
      );
      if (!isDemo) {
        throw new Error(error.message);
      }
    }

    return mockBusinessRepository.joinBarberQueue(input);
  }

  async leaveBarberQueueTicket(params: {
    businessSlug: string;
    ticketId: string;
  }): Promise<{
    id: string;
    status: BarberQueueTicketStatus;
    tokenNumber: number;
  }> {
    const client = this.requireClient();
    const { data, error } = await client.rpc('leave_barber_queue_ticket', {
      p_slug: params.businessSlug.trim().toLowerCase(),
      p_ticket_id: params.ticketId,
    });

    if (!error && data && typeof data === 'object') {
      return data as {
        id: string;
        status: BarberQueueTicketStatus;
        tokenNumber: number;
      };
    }

    if (error && error.message.includes('not found')) {
      const isDemo = await mockBusinessRepository.getBusinessBySlug(
        params.businessSlug.trim().toLowerCase(),
      );
      if (!isDemo) {
        throw new Error(error.message);
      }
    }

    return mockBusinessRepository.leaveBarberQueueTicket(params);
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

    const client = this.requireClient();
    const { data, error } = await client.rpc('barber_extend_queue_timer', {
      p_slug: params.businessSlug.trim().toLowerCase(),
      p_add_minutes: delayCheck.value,
      p_staff_pin_hash: params.staffPinHash ?? null,
    });

    if (!error && data && typeof data === 'object') {
      return data as ExtendBarberQueueTimerResult;
    }

    if (
      error &&
      (error.message.includes('Unauthorized') ||
        error.message.includes('Extension minutes'))
    ) {
      throw new Error(error.message);
    }

    return mockBusinessRepository.barberExtendQueueTimer(params);
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

    const client = this.requireClient();
    const { data, error } = await client.rpc('barber_advance_queue_ticket', {
      p_slug: params.businessSlug.trim().toLowerCase(),
      p_ticket_id: params.ticketId,
      p_new_status: statusCheck.value,
      p_staff_label: params.staffLabel ?? 'Barber',
      p_staff_pin_hash: params.staffPinHash ?? null,
    });

    if (!error && data && typeof data === 'object') {
      return data as AdvanceBarberQueueTicketResult;
    }

    if (
      error &&
      (error.message.includes('Unauthorized') ||
        error.message.includes('not found'))
    ) {
      throw new Error(error.message);
    }

    return mockBusinessRepository.barberAdvanceQueueTicket(params);
  }

  async getBarberRevenueAndServiceSummary(
    businessId: string,
    monthKey?: string | null,
    options?: AIConfigAccessOptions,
  ): Promise<BarberRevenueSummary> {
    const idErr = validateBusinessId(businessId);
    if (idErr) throw new Error(idErr);
    const cleanId = businessId.trim();
    await this.verifyBusinessOwnership(cleanId, options);
    const client = this.requireClient();

    const { data, error } = await client.rpc(
      'get_barber_revenue_and_service_summary',
      {
        p_business_id: cleanId,
        p_month_key: monthKey ?? null,
      },
    );

    if (!error && data && typeof data === 'object') {
      return data as BarberRevenueSummary;
    }

    return mockBusinessRepository.getBarberRevenueAndServiceSummary(
      cleanId,
      monthKey,
      options,
    );
  }

  // ---------------------------------------------------------------------------
  // Module 5: GymOS — Membership, Payment Approvals & 3-Day Renewal Radar
  // ---------------------------------------------------------------------------

  async getGymConfig(
    businessId: string,
    options?: AIConfigAccessOptions,
  ): Promise<GymConfig> {
    const idErr = validateBusinessId(businessId);
    if (idErr) throw new Error(idErr);
    const cleanId = businessId.trim();
    await this.verifyBusinessOwnership(cleanId, options);
    const client = this.requireClient();

    const { data, error } = await client
      .from('gym_configs')
      .select('*')
      .eq('business_id', cleanId)
      .maybeSingle();

    if (!error && data) {
      const row = data as {
        business_id: string;
        is_registration_open: boolean;
        renewal_alert_days: number;
        plans: GymPlan[];
        logo_url?: string | null;
        accent_color?: string | null;
        theme_preset?: string | null;
        created_at: string;
        updated_at: string;
      };
      return normalizeGymConfig(cleanId, {
        isRegistrationOpen: row.is_registration_open,
        renewalAlertDays: row.renewal_alert_days,
        plans: row.plans,
        logoUrl: row.logo_url ?? null,
        accentColor: row.accent_color ?? undefined,
        themePreset: row.theme_preset
          ? normalizeGymThemePreset(row.theme_preset)
          : undefined,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      });
    }

    if (!error && !data) {
      return normalizeGymConfig(cleanId, null);
    }

    return mockBusinessRepository.getGymConfig(cleanId, options);
  }

  async updateGymConfig(
    businessId: string,
    input: GymConfigInput,
    options?: AIConfigAccessOptions,
  ): Promise<GymConfig> {
    const validation = validateGymConfigInput(businessId, input);
    if (!validation.ok) throw new Error(validation.error);

    const cleanId = businessId.trim();
    await this.verifyBusinessOwnership(cleanId, options);
    const client = this.requireClient();
    const now = new Date().toISOString();

    const { data, error } = await client
      .from('gym_configs')
      .upsert(
        {
          business_id: cleanId,
          is_registration_open: validation.value.isRegistrationOpen,
          renewal_alert_days: validation.value.renewalAlertDays,
          plans: validation.value.plans,
          updated_at: now,
        },
        { onConflict: 'business_id' },
      )
      .select('*')
      .single();

    if (!error && data) {
      const row = data as {
        business_id: string;
        is_registration_open: boolean;
        renewal_alert_days: number;
        plans: GymPlan[];
        logo_url?: string | null;
        accent_color?: string | null;
        theme_preset?: string | null;
        created_at: string;
        updated_at: string;
      };
      return normalizeGymConfig(cleanId, {
        isRegistrationOpen: row.is_registration_open,
        renewalAlertDays: row.renewal_alert_days,
        plans: row.plans,
        logoUrl: row.logo_url ?? null,
        accentColor: row.accent_color ?? undefined,
        themePreset: row.theme_preset
          ? normalizeGymThemePreset(row.theme_preset)
          : undefined,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      });
    }

    return mockBusinessRepository.updateGymConfig(cleanId, validation.value, options);
  }

  async ownerUpdateGymBranding(
    input: OwnerUpdateGymBrandingInput,
    options?: AIConfigAccessOptions,
  ): Promise<GymConfig> {
    const idErr = validateBusinessId(input.businessId);
    if (idErr) throw new Error(idErr);
    const cleanId = input.businessId.trim();
    await this.verifyBusinessOwnership(cleanId, options);
    const client = this.requireClient();

    const cleanLogo =
      input.logoUrl && /^https?:\/\//i.test(input.logoUrl.trim())
        ? input.logoUrl.trim().slice(0, 600)
        : null;
    const accent = normalizeGymAccentColor(input.accentColor);
    const preset = normalizeGymThemePreset(input.themePreset);

    const { data, error } = await client.rpc('owner_update_gym_branding', {
      p_business_id: cleanId,
      p_logo_url: cleanLogo,
      p_accent_color: accent,
      p_theme_preset: preset,
    });

    if (!error && data && typeof data === 'object') {
      const baseConfig = await this.getGymConfig(cleanId, options);
      const res = data as {
        logoUrl?: string | null;
        accentColor?: string;
        themePreset?: string;
      };
      return normalizeGymConfig(cleanId, {
        ...baseConfig,
        logoUrl: res.logoUrl ?? cleanLogo,
        accentColor: res.accentColor ?? accent,
        themePreset: res.themePreset
          ? normalizeGymThemePreset(res.themePreset)
          : preset,
      });
    }

    if (
      error &&
      !error.message?.includes('does not exist') &&
      error.code !== 'PGRST202' &&
      error.code !== '42883'
    ) {
      throw new Error(error.message || 'Failed to update gym branding.');
    }

    return mockBusinessRepository.ownerUpdateGymBranding(input, options);
  }

  async getPublicGymPortal(
    businessSlug: string,
  ): Promise<PublicGymPortalPayload | null> {
    const cleanSlug = (businessSlug ?? '').trim().toLowerCase();
    if (!/^[a-z0-9-]{3,80}$/.test(cleanSlug)) return null;
    const client = this.requireClient();

    const { data, error } = await client.rpc('get_public_gym_portal', {
      p_slug: cleanSlug,
    });

    if (!error) {
      if (data) return data as PublicGymPortalPayload;
      const demoFallback = await mockBusinessRepository.getPublicGymPortal(cleanSlug);
      if (demoFallback) return demoFallback;
      return null;
    }

    return mockBusinessRepository.getPublicGymPortal(cleanSlug);
  }

  async submitGymMemberRegistration(
    input: SubmitGymRegistrationInput,
  ): Promise<GymMember> {
    const validation = validateGymRegistrationInput(input);
    if (!validation.ok) throw new Error(validation.error);

    const client = this.requireClient();
    const { data, error } = await client.rpc('submit_gym_member_registration', {
      p_slug: validation.value.businessSlug,
      p_full_name: validation.value.fullName,
      p_phone: validation.value.phone,
      p_plan_id: validation.value.planId,
      p_fitness_goal: validation.value.fitnessGoal ?? 'general_fitness',
      p_starting_weight_kg: validation.value.startingWeightKg ?? null,
      p_target_weight_kg: validation.value.targetWeightKg ?? null,
    });

    if (!error && data && typeof data === 'object') {
      const member = data as GymMember;
      if (validation.value.preferredShift && member.id) {
        try {
          await client.rpc('update_gym_member_preferred_shift', {
            p_slug: validation.value.businessSlug,
            p_member_id: member.id,
            p_preferred_shift: validation.value.preferredShift,
          });
          return {
            ...member,
            preferredShift: validation.value.preferredShift,
          };
        } catch {
          // Graceful no-op if migration 028 has not run yet
        }
      }
      return member;
    }

    if (
      error &&
      (error.message.includes('paused') ||
        error.message.includes('already exists') ||
        error.message.includes('valid') ||
        error.message.includes('between 20 and 300'))
    ) {
      throw new Error(error.message);
    }

    if (error && error.message.includes('not active')) {
      const isDemo = await mockBusinessRepository.getBusinessBySlug(
        validation.value.businessSlug,
      );
      if (!isDemo) throw new Error(error.message);
    }

    return mockBusinessRepository.submitGymMemberRegistration(input);
  }

  async lookupGymMemberPass(params: {
    businessSlug: string;
    phone: string;
  }): Promise<GymMember | null> {
    const normPhone = normalizeGymPhone(params.phone);
    if (normPhone.length < 8) {
      throw new Error('Please enter a valid 10-digit phone number.');
    }

    const cleanSlug = params.businessSlug.trim().toLowerCase();
    const client = this.requireClient();
    const { data, error } = await client.rpc('lookup_gym_member_pass', {
      p_slug: cleanSlug,
      p_phone: normPhone,
    });

    if (!error) {
      if (data) return data as GymMember;
      const isDemo = await mockBusinessRepository.getBusinessBySlug(cleanSlug);
      if (isDemo) {
        return mockBusinessRepository.lookupGymMemberPass({
          businessSlug: cleanSlug,
          phone: normPhone,
        });
      }
      return null;
    }

    return mockBusinessRepository.lookupGymMemberPass(params);
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

    const cleanSlug = params.businessSlug.trim().toLowerCase();
    const focus = normalizeGymWorkoutFocus(params.workoutFocus);
    const cleanNote =
      typeof params.memberNote === 'string' && params.memberNote.trim()
        ? params.memberNote.trim().slice(0, 280)
        : null;
    const client = this.requireClient();
    const { data, error } = await client.rpc('gym_member_daily_check_in', {
      p_slug: cleanSlug,
      p_phone: normPhone,
      p_workout_focus: focus,
      p_member_note: cleanNote,
      p_is_pt_session: Boolean(params.isPtSession),
    });

    if (!error && data && typeof data === 'object') {
      return data as GymDailyCheckInResult;
    }

    if (
      error &&
      (error.message.includes('pending payment') ||
        error.message.includes('expired') ||
        error.message.includes('paused') ||
        error.message.includes('Member not found'))
    ) {
      const isDemo = await mockBusinessRepository.getBusinessBySlug(cleanSlug);
      if (!isDemo) throw new Error(error.message);
    }

    return mockBusinessRepository.gymMemberDailyCheckIn(params);
  }

  async getGymOwnerDashboard(
    businessId: string,
    options?: AIConfigAccessOptions,
    monthKey?: string | null,
  ): Promise<GymOwnerDashboardPayload> {
    const idErr = validateBusinessId(businessId);
    if (idErr) throw new Error(idErr);
    const cleanId = businessId.trim();
    await this.verifyBusinessOwnership(cleanId, options);
    const client = this.requireClient();

    const { data, error } = await client.rpc('get_gym_owner_dashboard', {
      p_business_id: cleanId,
      p_month_key: monthKey ?? null,
    });

    if (!error && data && typeof data === 'object') {
      const payload = data as Partial<GymOwnerDashboardPayload>;
      let membersList = payload.members ?? [];
      let todaysAttendance = payload.todaysAttendance ?? [];
      let batchStats = payload.batchStats;

      try {
        const { data: batchData, error: batchErr } = await client.rpc(
          'get_gym_members_batch_stats',
          { p_business_id: cleanId },
        );
        if (!batchErr && batchData && typeof batchData === 'object') {
          const stats = batchData as {
            morningTotal?: number;
            eveningTotal?: number;
            flexibleTotal?: number;
            morningCheckedIn?: number;
            eveningCheckedIn?: number;
            memberShifts?: Record<string, GymPreferredShift>;
            todayCheckInShifts?: Record<string, 'morning' | 'evening'>;
          };
          const memberShifts = stats.memberShifts ?? {};
          const todayShifts = stats.todayCheckInShifts ?? {};
          membersList = membersList.map((m) => ({
            ...m,
            preferredShift: normalizeGymPreferredShift(
              memberShifts[m.id] ?? m.preferredShift,
            ),
          }));
          todaysAttendance = todaysAttendance.map((t) => ({
            ...t,
            preferredShift: normalizeGymPreferredShift(
              memberShifts[t.memberId] ?? t.preferredShift,
            ),
            checkInShift:
              todayShifts[t.memberId] ??
              t.checkInShift ??
              inferGymCheckInShiftFromHour(new Date(t.checkedInAt).getHours()),
          }));
          batchStats = {
            morningCheckedIn: Number(stats.morningCheckedIn ?? 0),
            eveningCheckedIn: Number(stats.eveningCheckedIn ?? 0),
            morningTotal: Number(stats.morningTotal ?? 0),
            eveningTotal: Number(stats.eveningTotal ?? 0),
            flexibleTotal: Number(stats.flexibleTotal ?? 0),
          };
        }
      } catch {
        // Fallback: infer checkInShift client-side from timestamp
        todaysAttendance = todaysAttendance.map((t) => ({
          ...t,
          checkInShift:
            t.checkInShift ??
            inferGymCheckInShiftFromHour(new Date(t.checkedInAt).getHours()),
        }));
      }

      const rawConfig = payload.config
        ? normalizeGymConfig(cleanId, payload.config)
        : normalizeGymConfig(cleanId, null);

      return {
        config: rawConfig,
        monthKey: payload.monthKey ?? new Date().toISOString().slice(0, 7),
        members: membersList,
        checkedInTodayCount: payload.checkedInTodayCount ?? 0,
        todaysAttendance,
        monthlyRevenuePaise: Number(payload.monthlyRevenuePaise ?? 0),
        membershipRevenuePaise: Number(
          payload.membershipRevenuePaise ?? payload.monthlyRevenuePaise ?? 0,
        ),
        retailRevenuePaise: Number(payload.retailRevenuePaise ?? 0),
        projectedNextMonthRevenuePaise: Number(
          payload.projectedNextMonthRevenuePaise ?? 0,
        ),
        totalBalanceDuePaise: Number(payload.totalBalanceDuePaise ?? 0),
        balanceDueMembersCount: Number(payload.balanceDueMembersCount ?? 0),
        weeklyRevenueComparison: payload.weeklyRevenueComparison ?? [],
        inactiveAlertMembers: payload.inactiveAlertMembers ?? [],
        trainers: payload.trainers ?? [],
        retailProducts: payload.retailProducts ?? [],
        recentRetailSales: payload.recentRetailSales ?? [],
        monthlyLeaderboard: payload.monthlyLeaderboard ?? [],
        routines: payload.routines ?? [],
        exerciseCatalog: payload.exerciseCatalog ?? [],
        batchStats: batchStats ?? {
          morningCheckedIn: todaysAttendance.filter(
            (t) => t.checkInShift === 'morning',
          ).length,
          eveningCheckedIn: todaysAttendance.filter(
            (t) => t.checkInShift === 'evening',
          ).length,
          morningTotal: membersList.filter(
            (m) => normalizeGymPreferredShift(m.preferredShift) === 'morning',
          ).length,
          eveningTotal: membersList.filter(
            (m) => normalizeGymPreferredShift(m.preferredShift) === 'evening',
          ).length,
          flexibleTotal: membersList.filter(
            (m) => normalizeGymPreferredShift(m.preferredShift) === 'flexible',
          ).length,
        },
      };
    }

    return mockBusinessRepository.getGymOwnerDashboard(
      cleanId,
      options,
      monthKey,
    );
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
    await this.verifyBusinessOwnership(cleanId, params.options);
    const client = this.requireClient();

    const { data, error } = await client.rpc(
      'get_gym_member_progress_history',
      {
        p_business_id: cleanId,
        p_member_id: params.memberId,
        p_month_key: params.monthKey ?? null,
      },
    );

    if (!error && data && typeof data === 'object') {
      return data as GymMemberProgressHistory;
    }

    if (
      error &&
      (error.message.includes('Unauthorized') ||
        error.message.includes('not found'))
    ) {
      throw new Error(error.message);
    }

    return mockBusinessRepository.getGymMemberProgressHistory(params);
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
    const startWt = validateGymWeightKg(params.startingWeightKg);
    if (!startWt.ok) throw new Error(`Starting weight: ${startWt.error}`);
    const targetWt = validateGymWeightKg(params.targetWeightKg);
    if (!targetWt.ok) throw new Error(`Target weight: ${targetWt.error}`);

    const cleanId = params.businessId.trim();
    await this.verifyBusinessOwnership(cleanId, params.options);
    const client = this.requireClient();

    const { data, error } = await client.rpc(
      'owner_update_gym_member_profile',
      {
        p_business_id: cleanId,
        p_member_id: params.memberId,
        p_trainer_notes:
          params.trainerNotes === undefined ? null : params.trainerNotes,
        p_fitness_goal: params.fitnessGoal
          ? normalizeGymFitnessGoal(params.fitnessGoal)
          : null,
        p_starting_weight_kg: startWt.value,
        p_target_weight_kg: targetWt.value,
      },
    );

    if (!error && data && typeof data === 'object') {
      return data as GymMember;
    }

    if (
      error &&
      (error.message.includes('Unauthorized') ||
        error.message.includes('not found'))
    ) {
      throw new Error(error.message);
    }

    return mockBusinessRepository.ownerUpdateGymMemberProfile(params);
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
    await this.verifyBusinessOwnership(cleanId, params.options);
    const client = this.requireClient();

    const { data, error } = await client.rpc('owner_approve_or_renew_gym_member', {
      p_business_id: cleanId,
      p_member_id: params.memberId,
      p_action: actionCheck.value,
      p_plan_id: params.planId ?? null,
      p_duration_days: params.durationDays ?? null,
      p_fee_paise: params.feePaise ?? null,
      p_staff_label: params.staffLabel ?? 'Owner',
      p_amount_paid_paise: params.amountPaidPaise ?? null,
      p_balance_due_date: params.balanceDueDate ?? null,
      p_pt_trainer_id: params.ptTrainerId ?? null,
      p_pt_package_name: params.ptPackageName ?? null,
      p_pt_sessions: params.ptSessions ?? 0,
      p_pt_fee_paise: params.ptFeePaise ?? 0,
      p_payment_method: params.paymentMethod ?? 'upi',
    });

    if (!error && data && typeof data === 'object') {
      return data as GymMember;
    }

    if (
      error &&
      (error.message.includes('Unauthorized') ||
        error.message.includes('not found'))
    ) {
      throw new Error(error.message);
    }

    return mockBusinessRepository.ownerApproveOrRenewGymMember(params);
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
    const cleanId = params.businessId.trim();
    await this.verifyBusinessOwnership(cleanId, params.options);
    const client = this.requireClient();

    const { data, error } = await client.rpc('collect_gym_balance_due', {
      p_business_id: cleanId,
      p_member_id: params.memberId,
      p_collected_paise: Math.round(params.collectedPaise),
      p_payment_method: params.paymentMethod ?? 'upi',
    });

    if (!error && data && typeof data === 'object') {
      return data as GymMember;
    }
    if (
      error &&
      (error.message.includes('Unauthorized') ||
        error.message.includes('balance due'))
    ) {
      throw new Error(error.message);
    }
    return mockBusinessRepository.collectGymBalanceDue(params);
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
    const cleanId = params.businessId.trim();
    await this.verifyBusinessOwnership(cleanId, params.options);
    const client = this.requireClient();

    const { data, error } = await client.rpc('toggle_gym_membership_freeze', {
      p_business_id: cleanId,
      p_member_id: params.memberId,
      p_action: params.action,
    });

    if (!error && data && typeof data === 'object') {
      return data as GymMember;
    }
    if (
      error &&
      (error.message.includes('Unauthorized') ||
        error.message.includes('frozen'))
    ) {
      throw new Error(error.message);
    }
    return mockBusinessRepository.toggleGymMembershipFreeze(params);
  }

  async createGymTrainer(
    businessId: string,
    input: GymTrainerInput,
    options?: AIConfigAccessOptions,
  ): Promise<GymTrainer> {
    const check = validateGymTrainerInput(businessId, input);
    if (!check.ok) throw new Error(check.error);
    const cleanId = businessId.trim();
    await this.verifyBusinessOwnership(cleanId, options);
    const client = this.requireClient();

    const { data, error } = await client
      .from('gym_trainers')
      .insert({
        business_id: cleanId,
        trainer_name: check.value.trainerName,
        specialty: check.value.specialty,
        commission_percent: check.value.commissionPercent,
        is_active: check.value.isActive,
      })
      .select('*')
      .single();

    if (!error && data) {
      const r = data as {
        id: string;
        business_id: string;
        trainer_name: string;
        specialty: string;
        commission_percent: number;
        is_active: boolean;
        created_at: string;
      };
      return {
        id: r.id,
        businessId: r.business_id,
        trainerName: r.trainer_name,
        specialty: r.specialty,
        commissionPercent: Number(r.commission_percent),
        isActive: r.is_active,
        createdAt: r.created_at,
      };
    }
    return mockBusinessRepository.createGymTrainer(cleanId, input, options);
  }

  async deleteGymTrainer(
    businessId: string,
    trainerId: string,
    options?: AIConfigAccessOptions,
  ): Promise<void> {
    const idErr = validateBusinessId(businessId);
    if (idErr) throw new Error(idErr);
    const cleanId = businessId.trim();
    await this.verifyBusinessOwnership(cleanId, options);
    const client = this.requireClient();

    const { error } = await client
      .from('gym_trainers')
      .delete()
      .eq('id', trainerId)
      .eq('business_id', cleanId);
    if (error) {
      await mockBusinessRepository.deleteGymTrainer(cleanId, trainerId, options);
    }
  }

  async getGymTrainerCommissions(
    businessId: string,
    monthKey?: string | null,
    options?: AIConfigAccessOptions,
  ): Promise<GymTrainerCommissionRow[]> {
    const idErr = validateBusinessId(businessId);
    if (idErr) throw new Error(idErr);
    const cleanId = businessId.trim();
    await this.verifyBusinessOwnership(cleanId, options);
    const client = this.requireClient();

    const { data, error } = await client.rpc('get_gym_trainer_commissions', {
      p_business_id: cleanId,
      p_month_key: monthKey ?? null,
    });
    if (!error && Array.isArray(data)) {
      return data as GymTrainerCommissionRow[];
    }
    return mockBusinessRepository.getGymTrainerCommissions(
      cleanId,
      monthKey,
      options,
    );
  }

  async logGymBodyMeasurement(
    input: GymBodyMeasurementInput,
  ): Promise<GymBodyMeasurement> {
    const check = validateGymBodyMeasurementInput(input);
    if (!check.ok) throw new Error(check.error);
    const client = this.requireClient();

    const { data, error } = await client.rpc('log_gym_body_measurement', {
      p_slug: check.value.businessSlug,
      p_phone: check.value.phone,
      p_weight_kg: check.value.weightKg,
      p_waist_inches: check.value.waistInches,
      p_chest_inches: check.value.chestInches,
      p_biceps_inches: check.value.bicepsInches,
      p_bmi: check.value.bmi,
      p_note: check.value.note,
    });
    if (!error && data && typeof data === 'object') {
      return data as GymBodyMeasurement;
    }
    return mockBusinessRepository.logGymBodyMeasurement(input);
  }

  async logGymWorkoutSession(
    input: LogGymWorkoutSessionInput,
  ): Promise<GymWorkoutSession> {
    const client = this.requireClient();
    const { data, error } = await client.rpc('log_gym_workout_session', {
      p_slug: input.businessSlug.trim().toLowerCase(),
      p_phone: normalizeGymPhone(input.phone),
      p_plan_id: input.planId,
      p_routine_name: input.routineName,
      p_workout_focus: input.workoutFocus,
      p_duration_minutes: input.durationMinutes,
      p_total_volume_kg: input.totalVolumeKg,
      p_total_sets: input.totalSets,
      p_prs_hit_count: input.prsHitCount,
      p_muscles_trained: input.musclesTrained,
      p_exercises: input.exercises,
    });
    if (!error && data && typeof data === 'object') {
      return data as GymWorkoutSession;
    }
    return mockBusinessRepository.logGymWorkoutSession(input);
  }

  async getGymMonthlyLeaderboard(
    businessSlug: string,
  ): Promise<GymLeaderboardEntry[]> {
    const client = this.requireClient();
    const { data, error } = await client.rpc('get_gym_monthly_leaderboard', {
      p_slug: businessSlug.trim().toLowerCase(),
    });
    if (!error && Array.isArray(data)) {
      return data as GymLeaderboardEntry[];
    }
    return mockBusinessRepository.getGymMonthlyLeaderboard(businessSlug);
  }

  async createGymRetailProduct(
    businessId: string,
    input: GymRetailProductInput,
    options?: AIConfigAccessOptions,
  ): Promise<GymRetailProduct> {
    const check = validateGymRetailProductInput(businessId, input);
    if (!check.ok) throw new Error(check.error);
    const cleanId = businessId.trim();
    await this.verifyBusinessOwnership(cleanId, options);
    const client = this.requireClient();

    const { data, error } = await client
      .from('gym_retail_products')
      .insert({
        business_id: cleanId,
        product_name: check.value.productName,
        price_paise: check.value.pricePaise,
        stock_qty: check.value.stockQty,
      })
      .select('*')
      .single();

    if (!error && data) {
      const r = data as {
        id: string;
        business_id: string;
        product_name: string;
        price_paise: number;
        stock_qty: number;
        is_active: boolean;
      };
      return {
        id: r.id,
        businessId: r.business_id,
        productName: r.product_name,
        pricePaise: Number(r.price_paise),
        stockQty: Number(r.stock_qty),
        isActive: r.is_active,
      };
    }
    return mockBusinessRepository.createGymRetailProduct(cleanId, input, options);
  }

  async seedGymRetailStarterProducts(
    businessId: string,
    options?: AIConfigAccessOptions,
  ): Promise<GymRetailProduct[]> {
    const idErr = validateBusinessId(businessId);
    if (idErr) throw new Error(idErr);
    const cleanId = businessId.trim();
    await this.verifyBusinessOwnership(cleanId, options);
    const dash = await this.getGymOwnerDashboard(cleanId, options);
    const existing = new Set(
      (dash.retailProducts ?? []).map((p) => p.productName.toLowerCase()),
    );
    const added: GymRetailProduct[] = [];
    for (const preset of GYM_RETAIL_STARTER_PRODUCTS) {
      if (!existing.has(preset.productName.toLowerCase())) {
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
    await this.verifyBusinessOwnership(cleanId, options);
    const client = this.requireClient();
    const { error } = await client
      .from('gym_retail_products')
      .delete()
      .eq('id', productId)
      .eq('business_id', cleanId);
    if (error) {
      await mockBusinessRepository.deleteGymRetailProduct(
        cleanId,
        productId,
        options,
      );
    }
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
    await this.verifyBusinessOwnership(cleanId, params.options);
    const client = this.requireClient();

    const { data, error } = await client.rpc('record_gym_retail_sale', {
      p_business_id: cleanId,
      p_product_id: params.productId,
      p_quantity: params.quantity ?? 1,
      p_payment_method: params.paymentMethod ?? 'upi',
      p_member_name: params.memberName ?? null,
    });
    if (!error && data && typeof data === 'object') {
      return data as { sale: GymRetailSale; product: GymRetailProduct };
    }
    return mockBusinessRepository.recordGymRetailSale(params);
  }

  async getGymExerciseCatalog(
    businessId: string,
    options?: AIConfigAccessOptions,
  ): Promise<GymCatalogExercise[]> {
    const idErr = validateBusinessId(businessId);
    if (idErr) throw new Error(idErr);
    const cleanId = businessId.trim();
    await this.verifyBusinessOwnership(cleanId, options);
    const client = this.requireClient();

    const { data, error } = await client
      .from('gym_exercises')
      .select('*')
      .or(`business_id.is.null,business_id.eq.${cleanId}`)
      .order('muscle_group', { ascending: true })
      .order('name', { ascending: true });

    if (!error && Array.isArray(data)) {
      const overrideMap = new Map<string, string>();
      try {
        const { data: ovRows } = await client
          .from('gym_exercise_media_overrides')
          .select('exercise_key, media_url')
          .eq('business_id', cleanId);
        if (Array.isArray(ovRows)) {
          for (const ov of ovRows as Array<{
            exercise_key: string;
            media_url: string;
          }>) {
            if (ov.exercise_key && ov.media_url) {
              overrideMap.set(ov.exercise_key.toLowerCase(), ov.media_url);
            }
          }
        }
      } catch {
        // Ignore if table not migrated yet
      }

      return (data as Array<{
        id: string;
        business_id: string | null;
        name: string;
        muscle_group: GymCatalogExercise['muscleGroup'];
        equipment: GymCatalogExercise['equipment'];
        default_sets: number;
        default_reps: string;
        rest_seconds: number;
        animation_key?: string | null;
        animation_gif_url?: string | null;
        form_cues?: string | null;
      }>).map((e) => ({
        id: e.id,
        businessId: e.business_id,
        name: e.name,
        muscleGroup: e.muscle_group,
        equipment: e.equipment,
        defaultSets: Number(e.default_sets),
        defaultReps: e.default_reps,
        restSeconds: Number(e.rest_seconds),
        animationKey: e.animation_key
          ? (e.animation_key as GymAnimationKey)
          : undefined,
        animationGifUrl:
          overrideMap.get(e.name.trim().toLowerCase()) ??
          overrideMap.get(e.id.trim().toLowerCase()) ??
          e.animation_gif_url ??
          null,
        formCues: e.form_cues ?? null,
      }));
    }
    return mockBusinessRepository.getGymExerciseCatalog(cleanId, options);
  }

  async ownerUpsertGymExerciseMedia(
    input: OwnerUpsertExerciseMediaInput,
    options?: AIConfigAccessOptions,
  ): Promise<{ exerciseKey: string; mediaUrl: string; mediaType?: string }> {
    const idErr = validateBusinessId(input.businessId);
    if (idErr) throw new Error(idErr);
    const cleanId = input.businessId.trim();
    await this.verifyBusinessOwnership(cleanId, options);
    const client = this.requireClient();

    const cleanUrl = sanitizeGymMediaUrl(input.mediaUrl);
    const detectedType =
      input.mediaType ??
      (/\.(mp4|webm|mov)(\?|#|$)/i.test(cleanUrl) ? 'video' : 'gif');

    const { data, error } = await client.rpc(
      'owner_upsert_gym_exercise_media',
      {
        p_business_id: cleanId,
        p_exercise_key: input.exerciseKey.trim().toLowerCase(),
        p_media_url: cleanUrl,
        p_media_type: detectedType,
      },
    );

    if (!error && data && typeof data === 'object') {
      return data as {
        exerciseKey: string;
        mediaUrl: string;
        mediaType?: string;
      };
    }

    if (
      error &&
      !error.message?.includes('does not exist') &&
      error.code !== 'PGRST202' &&
      error.code !== '42883'
    ) {
      throw new Error(error.message || 'Failed to save exercise media.');
    }

    return mockBusinessRepository.ownerUpsertGymExerciseMedia(input, options);
  }

  async createGymCustomExercise(
    businessId: string,
    input: GymCatalogExerciseInput,
    options?: AIConfigAccessOptions,
  ): Promise<GymCatalogExercise> {
    const idErr = validateBusinessId(businessId);
    if (idErr) throw new Error(idErr);
    const cleanId = businessId.trim();
    await this.verifyBusinessOwnership(cleanId, options);
    const client = this.requireClient();

    const { data, error } = await client
      .from('gym_exercises')
      .insert({
        business_id: cleanId,
        name: input.name.trim().slice(0, 100),
        muscle_group: input.muscleGroup,
        equipment: input.equipment,
        default_sets: input.defaultSets ?? 3,
        default_reps: input.defaultReps ?? '10-12',
        rest_seconds: input.restSeconds ?? 60,
      })
      .select('*')
      .single();

    if (!error && data) {
      const e = data as {
        id: string;
        business_id: string | null;
        name: string;
        muscle_group: GymCatalogExercise['muscleGroup'];
        equipment: GymCatalogExercise['equipment'];
        default_sets: number;
        default_reps: string;
        rest_seconds: number;
      };
      return {
        id: e.id,
        businessId: e.business_id,
        name: e.name,
        muscleGroup: e.muscle_group,
        equipment: e.equipment,
        defaultSets: Number(e.default_sets),
        defaultReps: e.default_reps,
        restSeconds: Number(e.rest_seconds),
      };
    }
    return mockBusinessRepository.createGymCustomExercise(cleanId, input, options);
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
    const cleanId = params.businessId.trim();
    await this.verifyBusinessOwnership(cleanId, params.options);
    const client = this.requireClient();

    const { data, error } = await client.rpc('create_or_assign_gym_routine', {
      p_business_id: cleanId,
      p_routine_name: params.routineName,
      p_target_goal: params.targetGoal ?? 'general_fitness',
      p_exercises: params.exercises,
      p_assign_to_member_id: params.assignToMemberId ?? null,
      p_created_by: params.createdBy ?? 'Owner',
    });
    if (!error && data && typeof data === 'object') {
      return data as GymWorkoutRoutine;
    }
    return mockBusinessRepository.createOrAssignGymRoutine(params);
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
    await this.verifyBusinessOwnership(cleanId, params.options);
    const client = this.requireClient();

    const { error } = await client
      .from('gym_members')
      .update({
        assigned_routine_id: params.routineId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', params.memberId)
      .eq('business_id', cleanId);

    if (!error) {
      const dash = await this.getGymOwnerDashboard(cleanId, params.options);
      const found = dash.members.find((m) => m.id === params.memberId);
      if (found) return found;
    }
    return mockBusinessRepository.assignGymRoutineToMember(params);
  }

  async getGymMemberWorkoutPlan(params: {
    businessSlug: string;
    memberId: string;
  }): Promise<GymMemberWorkoutPlanPayload | null> {
    const client = this.requireClient();
    const { data, error } = await client.rpc('get_gym_member_workout_plan', {
      p_slug: params.businessSlug.trim().toLowerCase(),
      p_member_id: params.memberId,
    });
    if (!error && data && typeof data === 'object') {
      return data as GymMemberWorkoutPlanPayload;
    }
    return mockBusinessRepository.getGymMemberWorkoutPlan(params);
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
    const client = this.requireClient();
    const uuidRe =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const validExId =
      params.exerciseId && uuidRe.test(params.exerciseId)
        ? params.exerciseId
        : null;
    const { data, error } = await client.rpc('log_gym_member_workout_set', {
      p_slug: params.businessSlug.trim().toLowerCase(),
      p_member_id: params.memberId,
      p_exercise_id: validExId,
      p_exercise_name: params.exerciseName,
      p_muscle_group: params.muscleGroup,
      p_set_number: params.setNumber,
      p_weight_kg: params.weightKg,
      p_reps: params.reps,
    });
    if (!error && data && typeof data === 'object') {
      return data as GymLogSetResult;
    }
    if (error && (error.message.includes('paused') || error.message.includes('Active membership'))) {
      throw new Error(error.message);
    }
    return mockBusinessRepository.logGymMemberWorkoutSet(params);
  }

  async getGymMemberWorkoutSummary(params: {
    businessId: string;
    memberId: string;
    options?: AIConfigAccessOptions;
  }): Promise<GymMemberWorkoutSummaryPayload> {
    const idErr = validateBusinessId(params.businessId);
    if (idErr) throw new Error(idErr);
    const cleanId = params.businessId.trim();
    await this.verifyBusinessOwnership(cleanId, params.options);
    const client = this.requireClient();

    const { data, error } = await client.rpc('get_gym_member_workout_summary', {
      p_business_id: cleanId,
      p_member_id: params.memberId,
    });
    if (!error && data && typeof data === 'object') {
      return data as GymMemberWorkoutSummaryPayload;
    }
    return mockBusinessRepository.getGymMemberWorkoutSummary(params);
  }

  async upsertAndApproveGymCoachPlan(
    input: UpsertGymCoachPlanInput,
    options?: AIConfigAccessOptions,
  ): Promise<GymCoachPlan> {
    const idErr = validateBusinessId(input.businessId);
    if (idErr) throw new Error(idErr);
    const cleanId = input.businessId.trim();
    await this.verifyBusinessOwnership(cleanId, options);
    const client = this.requireClient();

    const { data, error } = await client.rpc(
      'upsert_and_approve_gym_coach_plan',
      {
        p_business_id: cleanId,
        p_member_id: input.memberId,
        p_trainer_id: input.trainerId ?? null,
        p_plan_title: input.planTitle,
        p_schedule_mode: input.scheduleMode,
        p_weekly_schedule: input.weeklySchedule,
        p_daily_calories_kcal: input.dailyCaloriesKcal,
        p_protein_grams: input.proteinGrams,
        p_carbs_grams: input.carbsGrams,
        p_fats_grams: input.fatsGrams,
        p_water_liters: input.waterLiters,
        p_nutrition_meals: input.nutritionMeals,
        p_supplement_notes: input.supplementNotes ?? null,
        p_coach_notes: input.coachNotes ?? null,
        p_approved_by: input.approvedBy ?? 'Coach',
      },
    );

    if (error) {
      const msg = error.message ?? '';
      if (
        msg.includes('does not exist') ||
        error.code === '42P01' ||
        error.code === '42883' ||
        error.code === 'PGRST202'
      ) {
        return mockBusinessRepository.upsertAndApproveGymCoachPlan(
          input,
          options,
        );
      }
      throw new Error(error.message || 'Failed to approve coach plan.');
    }

    return data as GymCoachPlan;
  }

  async getGymMemberCoachPlanForOwner(params: {
    businessId: string;
    memberId: string;
    options?: AIConfigAccessOptions;
  }): Promise<GymCoachPlan | null> {
    const idErr = validateBusinessId(params.businessId);
    if (idErr) throw new Error(idErr);
    const cleanId = params.businessId.trim();
    await this.verifyBusinessOwnership(cleanId, params.options);
    const client = this.requireClient();

    const { data, error } = await client
      .from('gym_member_coach_plans')
      .select('*, gym_trainers(trainer_name)')
      .eq('business_id', cleanId)
      .eq('member_id', params.memberId)
      .maybeSingle();

    if (error) {
      const msg = error.message ?? '';
      if (
        msg.includes('does not exist') ||
        error.code === '42P01' ||
        error.code === '42883' ||
        error.code === 'PGRST202'
      ) {
        return mockBusinessRepository.getGymMemberCoachPlanForOwner(params);
      }
      throw new Error(error.message);
    }

    if (!data) return null;
    const row = data as Record<string, unknown>;
    const trainerObj = row.gym_trainers as
      | { trainer_name?: string }
      | null
      | undefined;

    return {
      id: String(row.id),
      businessId: String(row.business_id),
      memberId: String(row.member_id),
      trainerId: (row.trainer_id as string | null) ?? null,
      trainerName: trainerObj?.trainer_name ?? null,
      planTitle: String(row.plan_title ?? 'Personalized Transformation Plan'),
      scheduleMode:
        row.schedule_mode === 'rotation' ? 'rotation' : 'fixed_week',
      weeklySchedule: Array.isArray(row.weekly_schedule)
        ? (row.weekly_schedule as GymCoachPlan['weeklySchedule'])
        : [],
      dailyCaloriesKcal: Number(row.daily_calories_kcal ?? 2200),
      proteinGrams: Number(row.protein_grams ?? 140),
      carbsGrams: Number(row.carbs_grams ?? 230),
      fatsGrams: Number(row.fats_grams ?? 65),
      waterLiters: Number(row.water_liters ?? 3.5),
      nutritionMeals: Array.isArray(row.nutrition_meals)
        ? (row.nutrition_meals as GymCoachPlan['nutritionMeals'])
        : [],
      supplementNotes: (row.supplement_notes as string | null) ?? null,
      coachNotes: (row.coach_notes as string | null) ?? null,
      approvalStatus:
        row.approval_status === 'draft' ? 'draft' : 'approved',
      approvedBy: (row.approved_by as string | null) ?? null,
      approvedAt: (row.approved_at as string | null) ?? null,
      updatedAt: String(row.updated_at ?? new Date().toISOString()),
    };
  }

  async getGymMemberAthleteHub(params: {
    businessSlug: string;
    memberId: string;
  }): Promise<GymMemberAthleteHubPayload | null> {
    const client = this.requireClient();
    const { data, error } = await client.rpc(
      'get_gym_member_full_athlete_hub',
      {
        p_slug: params.businessSlug.trim(),
        p_member_id: params.memberId,
      },
    );
    if (!error && data && typeof data === 'object') {
      return data as GymMemberAthleteHubPayload;
    }
    return mockBusinessRepository.getGymMemberAthleteHub(params);
  }

  async getGymMembersCommunityHub(params: {
    businessSlug: string;
    requesterMemberId: string;
  }): Promise<GymMembersCommunityHubPayload> {
    const client = this.requireClient();
    const { data, error } = await client.rpc('get_gym_members_community_hub', {
      p_slug: params.businessSlug.trim(),
      p_requester_member_id: params.requesterMemberId,
    });
    if (!error && data && typeof data === 'object') {
      return data as GymMembersCommunityHubPayload;
    }
    if (
      error &&
      !error.message?.includes('does not exist') &&
      error.code !== 'PGRST202' &&
      error.code !== '42883'
    ) {
      throw new Error(error.message || 'Failed to load gym community.');
    }
    return mockBusinessRepository.getGymMembersCommunityHub(params);
  }

  async sendGymCommunityMessage(params: {
    businessSlug: string;
    memberId: string;
    messageText: string;
    messageType?: GymCommunityMessageType;
  }): Promise<GymCommunityMessage> {
    const client = this.requireClient();
    const { data, error } = await client.rpc('send_gym_community_message', {
      p_slug: params.businessSlug.trim(),
      p_member_id: params.memberId,
      p_message_text: params.messageText,
      p_message_type: params.messageType ?? 'chat',
    });
    if (!error && data && typeof data === 'object') {
      return data as GymCommunityMessage;
    }
    if (
      error &&
      !error.message?.includes('does not exist') &&
      error.code !== 'PGRST202' &&
      error.code !== '42883'
    ) {
      throw new Error(error.message || 'Failed to send chat message.');
    }
    return mockBusinessRepository.sendGymCommunityMessage(params);
  }

  async memberCreateCustomGymExercise(
    input: MemberCreateCustomExerciseInput,
  ): Promise<GymCatalogExercise> {
    const client = this.requireClient();
    const { data, error } = await client.rpc('create_custom_gym_exercise', {
      p_slug: input.businessSlug.trim(),
      p_member_id: input.memberId,
      p_name: input.name,
      p_muscle_group: input.muscleGroup,
      p_equipment: input.equipment,
      p_default_sets: input.defaultSets ?? 3,
      p_default_reps: input.defaultReps ?? '10-12',
      p_animation_gif_url: sanitizeGymMediaUrl(input.animationGifUrl) || null,
    });
    if (!error && data && typeof data === 'object') {
      return data as GymCatalogExercise;
    }
    if (
      error &&
      !error.message?.includes('does not exist') &&
      error.code !== 'PGRST202' &&
      error.code !== '42883'
    ) {
      throw new Error(error.message || 'Failed to create custom exercise.');
    }
    return mockBusinessRepository.memberCreateCustomGymExercise(input);
  }

  async updateGymMemberSelfPlan(
    input: UpdateMemberSelfPlanInput,
  ): Promise<GymCoachPlan> {
    const client = this.requireClient();
    const { data, error } = await client.rpc('update_gym_member_self_plan', {
      p_slug: input.businessSlug.trim().toLowerCase(),
      p_member_id: input.memberId,
      p_schedule_mode: input.scheduleMode ?? 'fixed_week',
      p_weekly_schedule: input.weeklySchedule,
      p_plan_title: input.planTitle ?? null,
    });
    if (!error && data && typeof data === 'object') {
      return data as GymCoachPlan;
    }
    if (
      error &&
      !error.message?.includes('does not exist') &&
      error.code !== 'PGRST202' &&
      error.code !== '42883'
    ) {
      throw new Error(error.message || 'Failed to save custom workout plan.');
    }
    return mockBusinessRepository.updateGymMemberSelfPlan(input);
  }

  async updateGymMemberPreferredShift(params: {
    businessSlug: string;
    memberId: string;
    preferredShift: GymPreferredShift;
  }): Promise<GymMember> {
    const client = this.requireClient();
    const cleanShift = normalizeGymPreferredShift(params.preferredShift);
    const { data, error } = await client.rpc(
      'update_gym_member_preferred_shift',
      {
        p_slug: params.businessSlug.trim().toLowerCase(),
        p_member_id: params.memberId,
        p_preferred_shift: cleanShift,
      },
    );
    if (!error && data && typeof data === 'object') {
      const res = data as Record<string, unknown>;
      return {
        ...res,
        id: String(res.memberId ?? params.memberId),
        preferredShift: normalizeGymPreferredShift(
          typeof res.preferredShift === 'string'
            ? res.preferredShift
            : cleanShift,
        ),
      } as unknown as GymMember;
    }
    if (
      error &&
      !error.message?.includes('does not exist') &&
      error.code !== 'PGRST202' &&
      error.code !== '42883'
    ) {
      throw new Error(error.message || 'Failed to update workout batch shift.');
    }
    return mockBusinessRepository.updateGymMemberPreferredShift(params);
  }

  async getGymCommunityMessagesForOwner(params: {
    businessId: string;
    options?: AIConfigAccessOptions;
  }): Promise<GymCommunityMessage[]> {
    const idErr = validateBusinessId(params.businessId);
    if (idErr) throw new Error(idErr);
    const cleanId = params.businessId.trim();
    await this.verifyBusinessOwnership(cleanId, params.options);
    const client = this.requireClient();

    const { data, error } = await client
      .from('gym_community_messages')
      .select('*')
      .eq('business_id', cleanId)
      .order('created_at', { ascending: true })
      .limit(60);

    if (error) {
      const msg = error.message ?? '';
      if (
        msg.includes('does not exist') ||
        error.code === '42P01' ||
        error.code === 'PGRST202'
      ) {
        return mockBusinessRepository.getGymCommunityMessagesForOwner(params);
      }
      throw new Error(error.message);
    }

    return (data ?? []).map((row) => ({
      id: String(row.id),
      businessId: String(row.business_id),
      memberId: (row.member_id as string | null) ?? null,
      senderName: String(row.sender_name),
      senderCode: (row.sender_code as string | null) ?? null,
      messageType:
        (row.message_type as GymCommunityMessageType) ?? 'chat',
      messageText: String(row.message_text),
      createdAt: String(row.created_at),
    }));
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
    await this.verifyBusinessOwnership(cleanId, params.options);
    const client = this.requireClient();

    const { data, error } = await client.rpc(
      'owner_post_or_delete_gym_community_message',
      {
        p_business_id: cleanId,
        p_action: params.action,
        p_message_text: params.messageText ?? null,
        p_message_id: params.messageId ?? null,
        p_sender_name: params.senderName ?? 'Head Coach',
      },
    );

    if (error) {
      const msg = error.message ?? '';
      if (
        msg.includes('does not exist') ||
        error.code === '42P01' ||
        error.code === '42883' ||
        error.code === 'PGRST202'
      ) {
        return mockBusinessRepository.ownerPostOrDeleteGymCommunityMessage(
          params,
        );
      }
      throw new Error(error.message);
    }

    return data as GymCommunityMessage | { deletedId: string };
  }

  // ---------------------------------------------------------------------------
  // Module 7: Dedicated CafeOS (Stamp Pass, Birthday Coffee, Inventory & Counter)
  // ---------------------------------------------------------------------------

  async getCafeOwnerDashboard(
    businessId: string,
    options?: AIConfigAccessOptions,
  ): Promise<CafeOwnerDashboardPayload> {
    const idErr = validateBusinessId(businessId);
    if (idErr) throw new Error(idErr);
    const cleanId = businessId.trim();
    await this.verifyBusinessOwnership(cleanId, options);
    const client = this.requireClient();

    // Ensure cafe_configs row exists
    const { data: cfgRow, error: cfgErr } = await client
      .from('cafe_configs')
      .select('*')
      .eq('business_id', cleanId)
      .maybeSingle();

    if (cfgErr) {
      return mockBusinessRepository.getCafeOwnerDashboard(cleanId, options);
    }

    let config: CafeConfig;
    if (cfgRow) {
      const r = cfgRow as {
        business_id: string;
        stamps_required: number;
        reward_drink_name: string;
        birthday_free_coffee_enabled: boolean;
        birthday_drink_name: string;
        counter_qr_secret: string;
        upi_id: string | null;
        created_at: string;
        updated_at: string;
      };
      config = {
        businessId: r.business_id,
        stampsRequired: r.stamps_required,
        rewardDrinkName: r.reward_drink_name,
        birthdayFreeCoffeeEnabled: r.birthday_free_coffee_enabled,
        birthdayDrinkName: r.birthday_drink_name,
        counterQrSecret: r.counter_qr_secret,
        upiId: r.upi_id,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      };
    } else {
      const def = createDefaultCafeConfig(cleanId);
      const { data: insertedCfg } = await client
        .from('cafe_configs')
        .insert({
          business_id: cleanId,
          stamps_required: def.stampsRequired,
          reward_drink_name: def.rewardDrinkName,
          birthday_free_coffee_enabled: def.birthdayFreeCoffeeEnabled,
          birthday_drink_name: def.birthdayDrinkName,
          counter_qr_secret: def.counterQrSecret,
        })
        .select('*')
        .single();
      if (insertedCfg) {
        const r = insertedCfg as {
          business_id: string;
          stamps_required: number;
          reward_drink_name: string;
          birthday_free_coffee_enabled: boolean;
          birthday_drink_name: string;
          counter_qr_secret: string;
          upi_id: string | null;
          created_at: string;
          updated_at: string;
        };
        config = {
          businessId: r.business_id,
          stampsRequired: r.stamps_required,
          rewardDrinkName: r.reward_drink_name,
          birthdayFreeCoffeeEnabled: r.birthday_free_coffee_enabled,
          birthdayDrinkName: r.birthday_drink_name,
          counterQrSecret: r.counter_qr_secret,
          upiId: r.upi_id,
          createdAt: r.created_at,
          updatedAt: r.updated_at,
        };
      } else {
        config = def;
      }
    }

    const todayDate = new Date().toISOString().slice(0, 10);
    const [passesRes, itemsRes, logsRes, ordersRes] = await Promise.all([
      client
        .from('cafe_stamp_passes')
        .select('*')
        .eq('business_id', cleanId)
        .order('updated_at', { ascending: false })
        .limit(200),
      client
        .from('cafe_inventory_items')
        .select('*')
        .eq('business_id', cleanId)
        .order('item_name', { ascending: true }),
      client
        .from('cafe_inventory_logs')
        .select('*')
        .eq('business_id', cleanId)
        .order('created_at', { ascending: false })
        .limit(80),
      client
        .from('cafe_counter_orders')
        .select('*')
        .eq('business_id', cleanId)
        .eq('order_date', todayDate)
        .order('created_at', { ascending: false }),
    ]);

    const passes: CafeStampPass[] = ((passesRes.data ?? []) as Array<{
      id: string;
      business_id: string;
      pass_code: string;
      customer_name: string;
      phone: string;
      birth_month: number | null;
      birth_day: number | null;
      current_stamps: number;
      lifetime_stamps: number;
      free_drinks_available: number;
      last_birthday_redeemed_year: number | null;
      last_stamped_at: string | null;
      created_at: string;
      updated_at: string;
    }>).map((p) => ({
      id: p.id,
      businessId: p.business_id,
      passCode: p.pass_code,
      customerName: p.customer_name,
      phone: p.phone,
      birthMonth: p.birth_month,
      birthDay: p.birth_day,
      currentStamps: p.current_stamps,
      lifetimeStamps: p.lifetime_stamps,
      freeDrinksAvailable: p.free_drinks_available,
      lastBirthdayRedeemedYear: p.last_birthday_redeemed_year,
      lastStampedAt: p.last_stamped_at,
      isBirthdayToday: isBirthdayTodayForPass({
        birthMonth: p.birth_month,
        birthDay: p.birth_day,
        lastBirthdayRedeemedYear: p.last_birthday_redeemed_year,
        birthdayEnabled: config.birthdayFreeCoffeeEnabled,
      }),
      createdAt: p.created_at,
      updatedAt: p.updated_at,
    }));

    const inventoryItems: CafeInventoryItem[] = (
      (itemsRes.data ?? []) as Array<{
        id: string;
        business_id: string;
        item_name: string;
        category: CafeInventoryItem['category'];
        unit: CafeInventoryItem['unit'];
        current_stock: number | string;
        low_stock_threshold: number | string;
        unit_cost_paise: number;
        supplier_note: string | null;
        updated_at: string;
      }>
    ).map((i) => ({
      id: i.id,
      businessId: i.business_id,
      itemName: i.item_name,
      category: i.category,
      unit: i.unit,
      currentStock: Number(i.current_stock),
      lowStockThreshold: Number(i.low_stock_threshold),
      unitCostPaise: Number(i.unit_cost_paise || 0),
      supplierNote: i.supplier_note,
      updatedAt: i.updated_at,
    }));

    const invMap = new Map(inventoryItems.map((i) => [i.id, i]));
    const inventoryLogs: CafeInventoryLog[] = (
      (logsRes.data ?? []) as Array<{
        id: string;
        business_id: string;
        inventory_item_id: string;
        action_type: CafeInventoryActionType;
        quantity_delta: number | string;
        cost_paise: number;
        note: string | null;
        logged_by: string | null;
        created_at: string;
      }>
    ).map((l) => {
      const it = invMap.get(l.inventory_item_id);
      return {
        id: l.id,
        businessId: l.business_id,
        inventoryItemId: l.inventory_item_id,
        itemName: it?.itemName ?? 'Ingredient',
        unit: it?.unit,
        actionType: l.action_type,
        quantityDelta: Number(l.quantity_delta),
        costPaise: Number(l.cost_paise || 0),
        note: l.note,
        loggedBy: l.logged_by,
        createdAt: l.created_at,
      };
    });

    const counterOrders: CafeCounterOrder[] = (
      (ordersRes.data ?? []) as Array<{
        id: string;
        business_id: string;
        order_date: string;
        token_code: string;
        customer_name: string;
        phone: string | null;
        items: CafeCounterOrder['items'];
        subtotal_paise: number;
        status: CafeCounterOrderStatus;
        order_note: string | null;
        created_at: string;
        updated_at: string;
      }>
    ).map((o) => ({
      id: o.id,
      businessId: o.business_id,
      orderDate: o.order_date,
      tokenCode: o.token_code,
      customerName: o.customer_name,
      phone: o.phone,
      items: o.items ?? [],
      subtotalPaise: Number(o.subtotal_paise || 0),
      status: o.status,
      orderNote: o.order_note,
      createdAt: o.created_at,
      updatedAt: o.updated_at,
    }));

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    return {
      config,
      passes,
      inventoryItems,
      inventoryLogs,
      counterOrders,
      stats: {
        lowStockCount: inventoryItems.filter(
          (i) => i.currentStock <= i.lowStockThreshold,
        ).length,
        activeStampHolders: passes.length,
        stampsIssuedToday: passes.filter(
          (p) =>
            p.lastStampedAt &&
            new Date(p.lastStampedAt).getTime() >= startOfToday.getTime(),
        ).length,
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
    await this.verifyBusinessOwnership(cleanId, options);
    const client = this.requireClient();

    const { data, error } = await client
      .from('cafe_configs')
      .upsert(
        {
          business_id: cleanId,
          stamps_required: check.value.stampsRequired,
          reward_drink_name: check.value.rewardDrinkName,
          birthday_free_coffee_enabled: check.value.birthdayFreeCoffeeEnabled,
          birthday_drink_name: check.value.birthdayDrinkName,
          upi_id: check.value.upiId ?? null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'business_id' },
      )
      .select('*')
      .single();

    if (!error && data) {
      const r = data as {
        business_id: string;
        stamps_required: number;
        reward_drink_name: string;
        birthday_free_coffee_enabled: boolean;
        birthday_drink_name: string;
        counter_qr_secret: string;
        upi_id: string | null;
        created_at: string;
        updated_at: string;
      };
      return {
        businessId: r.business_id,
        stampsRequired: r.stamps_required,
        rewardDrinkName: r.reward_drink_name,
        birthdayFreeCoffeeEnabled: r.birthday_free_coffee_enabled,
        birthdayDrinkName: r.birthday_drink_name,
        counterQrSecret: r.counter_qr_secret,
        upiId: r.upi_id,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      };
    }

    return mockBusinessRepository.updateCafeConfig(cleanId, input, options);
  }

  async createCafeInventoryItem(
    businessId: string,
    input: CafeInventoryItemInput,
    options?: AIConfigAccessOptions,
  ): Promise<CafeInventoryItem> {
    const check = validateCafeInventoryItemInput(businessId, input);
    if (!check.ok) throw new Error(check.error);
    const cleanId = businessId.trim();
    await this.verifyBusinessOwnership(cleanId, options);
    const client = this.requireClient();

    const { data, error } = await client
      .from('cafe_inventory_items')
      .insert({
        business_id: cleanId,
        item_name: check.value.itemName,
        category: check.value.category,
        unit: check.value.unit,
        current_stock: check.value.currentStock,
        low_stock_threshold: check.value.lowStockThreshold,
        unit_cost_paise: check.value.unitCostPaise,
        supplier_note: check.value.supplierNote ?? null,
      })
      .select('*')
      .single();

    if (!error && data) {
      const r = data as {
        id: string;
        business_id: string;
        item_name: string;
        category: CafeInventoryItem['category'];
        unit: CafeInventoryItem['unit'];
        current_stock: number | string;
        low_stock_threshold: number | string;
        unit_cost_paise: number;
        supplier_note: string | null;
        updated_at: string;
      };
      return {
        id: r.id,
        businessId: r.business_id,
        itemName: r.item_name,
        category: r.category,
        unit: r.unit,
        currentStock: Number(r.current_stock),
        lowStockThreshold: Number(r.low_stock_threshold),
        unitCostPaise: Number(r.unit_cost_paise || 0),
        supplierNote: r.supplier_note,
        updatedAt: r.updated_at,
      };
    }

    return mockBusinessRepository.createCafeInventoryItem(
      cleanId,
      input,
      options,
    );
  }

  async deleteCafeInventoryItem(
    businessId: string,
    itemId: string,
    options?: AIConfigAccessOptions,
  ): Promise<void> {
    const idErr = validateBusinessId(businessId);
    if (idErr) throw new Error(idErr);
    const cleanId = businessId.trim();
    await this.verifyBusinessOwnership(cleanId, options);
    const client = this.requireClient();

    const { error } = await client
      .from('cafe_inventory_items')
      .delete()
      .eq('id', itemId)
      .eq('business_id', cleanId);

    if (error) {
      await mockBusinessRepository.deleteCafeInventoryItem(
        cleanId,
        itemId,
        options,
      );
    }
  }

  async seedCafeInventoryStarterPack(
    businessId: string,
    options?: AIConfigAccessOptions,
  ): Promise<CafeInventoryItem[]> {
    const idErr = validateBusinessId(businessId);
    if (idErr) throw new Error(idErr);
    const cleanId = businessId.trim();
    await this.verifyBusinessOwnership(cleanId, options);

    const dash = await this.getCafeOwnerDashboard(cleanId, options);
    const existingNames = new Set(
      dash.inventoryItems.map((i) => i.itemName.toLowerCase()),
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
    await this.verifyBusinessOwnership(cleanId, params.options);
    const client = this.requireClient();

    const { data, error } = await client.rpc('adjust_cafe_inventory_stock', {
      p_business_id: cleanId,
      p_item_id: params.itemId,
      p_action_type: check.action,
      p_quantity: check.quantity,
      p_cost_paise: Math.max(0, Math.round(params.costPaise ?? 0)),
      p_note: params.note ?? null,
      p_logged_by: params.loggedBy ?? 'Owner',
    });

    if (!error && data && typeof data === 'object') {
      return data as { item: CafeInventoryItem; log: CafeInventoryLog };
    }
    if (error && error.message.includes('Unauthorized')) {
      throw new Error(error.message);
    }

    return mockBusinessRepository.adjustCafeInventoryStock(params);
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
    await this.verifyBusinessOwnership(cleanId, params.options);
    const client = this.requireClient();

    const { data, error } = await client.rpc('redeem_cafe_pass_reward', {
      p_business_id: cleanId,
      p_pass_id: params.passId,
      p_reward_type: params.rewardType,
    });

    if (!error && data && typeof data === 'object') {
      return data as CafeStampPass;
    }
    if (
      error &&
      (error.message.includes('Unauthorized') ||
        error.message.includes('Birthday') ||
        error.message.includes('No free stamp'))
    ) {
      throw new Error(error.message);
    }

    return mockBusinessRepository.redeemCafePassReward(params);
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
    await this.verifyBusinessOwnership(cleanId, params.options);
    const client = this.requireClient();

    const { data, error } = await client
      .from('cafe_counter_orders')
      .update({
        status: params.status,
        updated_at: new Date().toISOString(),
      })
      .eq('id', params.orderId)
      .eq('business_id', cleanId)
      .select('*')
      .single();

    if (!error && data) {
      const o = data as {
        id: string;
        business_id: string;
        order_date: string;
        token_code: string;
        customer_name: string;
        phone: string | null;
        items: CafeCounterOrder['items'];
        subtotal_paise: number;
        status: CafeCounterOrderStatus;
        order_note: string | null;
        created_at: string;
        updated_at: string;
      };
      return {
        id: o.id,
        businessId: o.business_id,
        orderDate: o.order_date,
        tokenCode: o.token_code,
        customerName: o.customer_name,
        phone: o.phone,
        items: o.items ?? [],
        subtotalPaise: Number(o.subtotal_paise || 0),
        status: o.status,
        orderNote: o.order_note,
        createdAt: o.created_at,
        updatedAt: o.updated_at,
      };
    }

    return mockBusinessRepository.updateCafeCounterOrderStatus(params);
  }

  async getPublicCafeHub(
    businessSlug: string,
    phone?: string | null,
  ): Promise<PublicCafeHubPayload | null> {
    const client = this.requireClient();
    const { data, error } = await client.rpc('get_public_cafe_hub', {
      p_slug: businessSlug.trim().toLowerCase(),
      p_phone: phone ? normalizeCafePhone(phone) : null,
    });

    if (!error && data && typeof data === 'object') {
      return data as PublicCafeHubPayload;
    }
    if (!error && data === null) {
      return null;
    }

    return mockBusinessRepository.getPublicCafeHub(businessSlug, phone);
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
    const client = this.requireClient();
    const { data, error } = await client.rpc('claim_cafe_counter_stamp', {
      p_slug: params.businessSlug.trim().toLowerCase(),
      p_customer_name: params.customerName.trim().slice(0, 80),
      p_phone: normalizeCafePhone(params.phone),
      p_birth_month: params.birthMonth ?? null,
      p_birth_day: params.birthDay ?? null,
      p_time_bucket: params.timeBucket,
      p_token_sig: params.tokenSig.trim().toLowerCase(),
    });

    if (!error && data && typeof data === 'object') {
      return data as ClaimCafeStampResponse;
    }
    if (
      error &&
      (error.message.includes('expired') ||
        error.message.includes('Invalid counter QR') ||
        error.message.includes('already collected') ||
        error.message.includes('valid'))
    ) {
      throw new Error(error.message);
    }

    return mockBusinessRepository.claimCafeCounterStamp(params);
  }

  async submitCafeCounterOrder(params: {
    businessSlug: string;
    customerName: string;
    phone?: string | null;
    items: Array<{ itemId: string; quantity: number }>;
    orderNote?: string | null;
  }): Promise<CafeCounterOrder> {
    const client = this.requireClient();
    const { data, error } = await client.rpc('submit_cafe_counter_order', {
      p_slug: params.businessSlug.trim().toLowerCase(),
      p_customer_name: params.customerName.trim().slice(0, 80),
      p_phone: params.phone ? normalizeCafePhone(params.phone) : null,
      p_items: params.items,
      p_order_note: params.orderNote?.trim().slice(0, 200) || null,
    });

    if (!error && data && typeof data === 'object') {
      return data as CafeCounterOrder;
    }
    if (error && error.message.includes('unavailable')) {
      throw new Error(error.message);
    }

    return mockBusinessRepository.submitCafeCounterOrder(params);
  }

  // ---------------------------------------------------------------------------
  // Module 8: Standalone Loyalty & AI Google Review OS (LoyaltyOS)
  // ---------------------------------------------------------------------------

  async getLoyaltyOwnerDashboard(
    businessId: string,
    options?: AIConfigAccessOptions,
  ): Promise<LoyaltyOwnerDashboardPayload> {
    const err = validateBusinessId(businessId);
    if (err) throw new Error(err);
    const cleanId = businessId.trim();
    await this.verifyBusinessOwnership(cleanId, options);
    const client = this.requireClient();

    const { data, error } = await client.rpc('get_loyalty_owner_dashboard', {
      p_business_id: cleanId,
    });
    if (!error && data && typeof data === 'object') {
      return data as LoyaltyOwnerDashboardPayload;
    }
    if (error && error.message.includes('Unauthorized')) {
      throw new Error(error.message);
    }
    return mockBusinessRepository.getLoyaltyOwnerDashboard(cleanId, options);
  }

  async updateLoyaltyProgramConfig(
    businessId: string,
    input: LoyaltyProgramConfigInput,
    options?: AIConfigAccessOptions,
  ): Promise<LoyaltyProgramConfig> {
    const cleanInput = validateLoyaltyConfigInput(businessId, input);
    const cleanId = businessId.trim();
    await this.verifyBusinessOwnership(cleanId, options);
    const client = this.requireClient();

    const { data, error } = await client
      .from('loyalty_program_configs')
      .upsert(
        {
          business_id: cleanId,
          stars_required: cleanInput.starsRequired,
          reward_title: cleanInput.rewardTitle,
          reward_description: cleanInput.rewardDescription ?? null,
          verification_mode: cleanInput.verificationMode,
          counter_secret_pin: cleanInput.counterSecretPin || '1234',
          scan_cooldown_hours: cleanInput.scanCooldownHours,
          google_review_bonus_enabled: cleanInput.googleReviewBonusEnabled,
          google_review_bonus_stars: cleanInput.googleReviewBonusStars,
          brand_accent_hex: cleanInput.brandAccentHex || '#C8F135',
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'business_id' },
      )
      .select('*')
      .single();

    if (!error && data) {
      const r = data as {
        business_id: string;
        stars_required: number;
        reward_title: string;
        reward_description: string | null;
        verification_mode: LoyaltyProgramConfig['verificationMode'];
        counter_secret_pin: string;
        scan_cooldown_hours: number;
        google_review_bonus_enabled: boolean;
        google_review_bonus_stars: number;
        brand_accent_hex: string;
        created_at: string;
        updated_at: string;
      };
      return {
        businessId: r.business_id,
        starsRequired: r.stars_required,
        rewardTitle: r.reward_title,
        rewardDescription: r.reward_description,
        verificationMode: r.verification_mode,
        counterSecretPin: r.counter_secret_pin,
        scanCooldownHours: r.scan_cooldown_hours,
        googleReviewBonusEnabled: r.google_review_bonus_enabled,
        googleReviewBonusStars: r.google_review_bonus_stars,
        brandAccentHex: r.brand_accent_hex,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      };
    }

    return mockBusinessRepository.updateLoyaltyProgramConfig(cleanId, input, options);
  }

  async approvePendingLoyaltyStar(params: {
    businessId: string;
    eventId: string;
    decision: 'approved' | 'rejected';
    options?: AIConfigAccessOptions;
  }): Promise<{ status: 'approved' | 'rejected'; eventId: string }> {
    const err = validateBusinessId(params.businessId);
    if (err) throw new Error(err);
    const cleanId = params.businessId.trim();
    await this.verifyBusinessOwnership(cleanId, params.options);
    const client = this.requireClient();

    const { data, error } = await client.rpc('approve_pending_loyalty_star', {
      p_business_id: cleanId,
      p_event_id: params.eventId,
      p_decision: params.decision,
    });
    if (!error && data && typeof data === 'object') {
      return data as { status: 'approved' | 'rejected'; eventId: string };
    }
    if (
      error &&
      (error.message.includes('Unauthorized') ||
        error.message.includes('Pending star request'))
    ) {
      throw new Error(error.message);
    }
    return mockBusinessRepository.approvePendingLoyaltyStar(params);
  }

  async issueLoyaltyDeskStar(params: {
    businessId: string;
    customerName: string;
    phone: string;
    note?: string | null;
    options?: AIConfigAccessOptions;
  }): Promise<LoyaltyMemberCard> {
    const err = validateBusinessId(params.businessId);
    if (err) throw new Error(err);
    const cleanId = params.businessId.trim();
    await this.verifyBusinessOwnership(cleanId, params.options);
    const client = this.requireClient();

    const { data, error } = await client.rpc('issue_loyalty_desk_star', {
      p_business_id: cleanId,
      p_customer_name: params.customerName.trim().slice(0, 80),
      p_phone: normalizeLoyaltyPhone(params.phone),
      p_note: params.note?.trim().slice(0, 160) || null,
    });
    if (!error && data && typeof data === 'object') {
      return data as LoyaltyMemberCard;
    }
    if (
      error &&
      (error.message.includes('Unauthorized') || error.message.includes('valid'))
    ) {
      throw new Error(error.message);
    }
    return mockBusinessRepository.issueLoyaltyDeskStar(params);
  }

  async confirmLoyaltyRewardRedemption(params: {
    businessId: string;
    cardId: string;
    options?: AIConfigAccessOptions;
  }): Promise<LoyaltyMemberCard> {
    const err = validateBusinessId(params.businessId);
    if (err) throw new Error(err);
    const cleanId = params.businessId.trim();
    await this.verifyBusinessOwnership(cleanId, params.options);
    const client = this.requireClient();

    const { data, error } = await client.rpc(
      'request_or_confirm_loyalty_reward_redemption',
      {
        p_slug: null,
        p_business_id: cleanId,
        p_card_id: params.cardId,
        p_phone: null,
        p_action: 'confirm',
      },
    );
    if (!error && data && typeof data === 'object') {
      return data as LoyaltyMemberCard;
    }
    if (
      error &&
      (error.message.includes('Unauthorized') || error.message.includes('No unlocked'))
    ) {
      throw new Error(error.message);
    }
    return mockBusinessRepository.confirmLoyaltyRewardRedemption(params);
  }

  async getPublicLoyaltyHub(
    businessSlug: string,
    phone?: string | null,
  ): Promise<PublicLoyaltyHubPayload | null> {
    const client = this.requireClient();
    const { data, error } = await client.rpc('get_public_loyalty_hub', {
      p_slug: businessSlug.trim().toLowerCase(),
      p_phone: phone ? normalizeLoyaltyPhone(phone) : null,
    });
    if (!error && data && typeof data === 'object') {
      return data as PublicLoyaltyHubPayload;
    }
    if (!error && data === null) {
      return null;
    }
    return mockBusinessRepository.getPublicLoyaltyHub(businessSlug, phone);
  }

  async claimLoyaltyVisitStar(params: {
    businessSlug: string;
    customerName: string;
    phone: string;
    counterPin?: string | null;
    sourceChannel?: LoyaltySourceChannel;
    bypassCooldownForTest?: boolean;
  }): Promise<ClaimLoyaltyStarResponse> {
    const client = this.requireClient();
    const { data, error } = await client.rpc('claim_loyalty_visit_star', {
      p_slug: params.businessSlug.trim().toLowerCase(),
      p_customer_name: params.customerName.trim().slice(0, 80),
      p_phone: normalizeLoyaltyPhone(params.phone),
      p_counter_pin: params.counterPin?.trim() || null,
      p_source_channel: params.sourceChannel ?? 'qr_nfc',
    });
    if (!error && data && typeof data === 'object') {
      return data as ClaimLoyaltyStarResponse;
    }
    if (
      error &&
      (error.message.includes('Cooldown active') ||
        error.message.includes('Invalid Counter PIN') ||
        error.message.includes('waiting for cashier approval') ||
        error.message.includes('valid') ||
        error.message.includes('at least 2'))
    ) {
      throw new Error(error.message);
    }
    return mockBusinessRepository.claimLoyaltyVisitStar(params);
  }

  async claimLoyaltyGoogleReviewBonus(params: {
    businessSlug: string;
    phone: string;
  }): Promise<ClaimLoyaltyStarResponse> {
    const client = this.requireClient();
    const { data, error } = await client.rpc('claim_loyalty_google_review_bonus', {
      p_slug: params.businessSlug.trim().toLowerCase(),
      p_phone: normalizeLoyaltyPhone(params.phone),
    });
    if (!error && data && typeof data === 'object') {
      return data as ClaimLoyaltyStarResponse;
    }
    if (
      error &&
      (error.message.includes('already claimed') ||
        error.message.includes('first visit star') ||
        error.message.includes('disabled'))
    ) {
      throw new Error(error.message);
    }
    return mockBusinessRepository.claimLoyaltyGoogleReviewBonus(params);
  }

  async requestLoyaltyRewardRedemption(params: {
    businessSlug: string;
    phone: string;
  }): Promise<LoyaltyMemberCard> {
    const client = this.requireClient();
    const { data, error } = await client.rpc(
      'request_or_confirm_loyalty_reward_redemption',
      {
        p_slug: params.businessSlug.trim().toLowerCase(),
        p_business_id: null,
        p_card_id: null,
        p_phone: normalizeLoyaltyPhone(params.phone),
        p_action: 'request',
      },
    );
    if (!error && data && typeof data === 'object') {
      return data as LoyaltyMemberCard;
    }
    if (
      error &&
      (error.message.includes('No unlocked') || error.message.includes('not found'))
    ) {
      throw new Error(error.message);
    }
    return mockBusinessRepository.requestLoyaltyRewardRedemption(params);
  }

  // ---------------------------------------------------------------------------
  // Module 9: ClinicOS (Healthcare, Dental, Skin, Physio & Diagnostic Clinic OS)
  // ---------------------------------------------------------------------------

  async getPublicClinicHub(
    businessSlug: string,
    phone?: string | null,
  ): Promise<PublicClinicHubPayload | null> {
    const client = this.requireClient();
    const { data, error } = await client.rpc('get_public_clinic_hub', {
      p_slug: businessSlug.trim().toLowerCase(),
      p_phone: phone ? normalizeClinicPhone(phone) : null,
    });
    if (!error && data && typeof data === 'object') {
      return data as PublicClinicHubPayload;
    }
    if (!error && data === null) {
      // Allow local demo fixture fallback for aura-care-clinic if not yet seeded in cloud
      if (businessSlug.trim().toLowerCase() === 'aura-care-clinic') {
        return mockBusinessRepository.getPublicClinicHub(businessSlug, phone);
      }
      return null;
    }
    return mockBusinessRepository.getPublicClinicHub(businessSlug, phone);
  }

  async checkinOrBookClinicToken(
    input: CheckinClinicTokenInput,
    options?: AIConfigAccessOptions,
  ): Promise<CheckinClinicTokenResult> {
    const client = this.requireClient();
    const { data, error } = await client.rpc('checkin_or_book_clinic_token', {
      p_slug: input.businessSlug.trim().toLowerCase(),
      p_full_name: input.fullName.trim().slice(0, 80),
      p_phone: normalizeClinicPhone(input.phone),
      p_doctor_id: input.doctorId || null,
      p_visit_type: input.visitType ?? 'walk_in',
      p_chief_complaint: input.chiefComplaint?.trim().slice(0, 240) || null,
      p_age: input.age ?? null,
      p_allergies: input.allergies?.trim().slice(0, 200) || null,
      p_gender: input.gender ?? null,
      p_blood_group: input.bloodGroup?.trim().slice(0, 12) || null,
      p_scheduled_slot: input.scheduledSlot?.trim().slice(0, 40) || null,
    });
    if (!error && data && typeof data === 'object') {
      return data as CheckinClinicTokenResult;
    }
    if (
      error &&
      (error.message.includes('Please enter') ||
        error.message.includes('Age must') ||
        error.message.includes('paused') ||
        error.message.includes('unavailable') ||
        error.message.includes('does not belong'))
    ) {
      throw new Error(error.message);
    }
    return mockBusinessRepository.checkinOrBookClinicToken(input, options);
  }

  async getClinicOwnerDashboard(
    businessId: string,
    options?: AIConfigAccessOptions,
  ): Promise<ClinicOwnerDashboardPayload> {
    const err = validateBusinessId(businessId);
    if (err) throw new Error(err);
    const cleanId = businessId.trim();
    await this.verifyBusinessOwnership(cleanId, options);
    const client = this.requireClient();

    const { data, error } = await client.rpc('get_clinic_owner_dashboard', {
      p_business_id: cleanId,
    });
    if (!error && data && typeof data === 'object') {
      return data as ClinicOwnerDashboardPayload;
    }
    if (error && error.message.includes('Unauthorized')) {
      throw new Error(error.message);
    }
    return mockBusinessRepository.getClinicOwnerDashboard(cleanId, options);
  }

  async updateClinicBrandingConfig(
    businessId: string,
    input: ClinicConfigInput,
    options?: AIConfigAccessOptions,
  ): Promise<ClinicConfig> {
    const cleanInput = validateClinicConfigInput(businessId, input);
    const cleanId = cleanInput.businessId;
    await this.verifyBusinessOwnership(cleanId, options);
    const client = this.requireClient();

    const { data, error } = await client
      .from('clinic_configs')
      .upsert(
        {
          business_id: cleanId,
          clinic_tagline: cleanInput.clinicTagline,
          logo_url: cleanInput.logoUrl,
          accent_color: cleanInput.accentColor,
          is_queue_open: cleanInput.isQueueOpen,
          recall_window_days: cleanInput.recallWindowDays,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'business_id' },
      )
      .select('*')
      .single();

    if (!error && data) {
      const r = data as {
        business_id: string;
        clinic_tagline: string;
        logo_url: string | null;
        accent_color: string;
        is_queue_open: boolean;
        recall_window_days: number;
        created_at: string;
        updated_at: string;
      };
      return {
        businessId: r.business_id,
        clinicTagline: r.clinic_tagline,
        logoUrl: r.logo_url,
        accentColor: r.accent_color,
        isQueueOpen: r.is_queue_open,
        recallWindowDays: r.recall_window_days,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      };
    }

    return mockBusinessRepository.updateClinicBrandingConfig(
      cleanId,
      input,
      options,
    );
  }

  async upsertClinicDoctor(
    businessId: string,
    input: ClinicDoctorInput,
    options?: AIConfigAccessOptions,
  ): Promise<ClinicDoctor> {
    const clean = validateClinicDoctorInput(businessId, input);
    const cleanId = clean.businessId;
    await this.verifyBusinessOwnership(cleanId, options);
    const client = this.requireClient();

    const payload: Record<string, unknown> = {
      business_id: cleanId,
      doctor_name: clean.doctorName,
      specialty: clean.specialty,
      cabin_label: clean.cabinLabel,
      consultation_fee_paise: clean.consultationFeePaise,
      avg_consult_minutes: clean.avgConsultMinutes,
      commission_percent: clean.commissionPercent,
      is_available: clean.isAvailable,
    };
    if (clean.id) {
      payload.id = clean.id;
    }

    const query = clean.id
      ? client
          .from('clinic_doctors')
          .update(payload)
          .eq('id', clean.id)
          .eq('business_id', cleanId)
          .select('*')
          .single()
      : client.from('clinic_doctors').insert(payload).select('*').single();

    const { data, error } = await query;
    if (!error && data) {
      const r = data as {
        id: string;
        business_id: string;
        doctor_name: string;
        specialty: string;
        cabin_label: string;
        consultation_fee_paise: number;
        avg_consult_minutes: number;
        extra_delay_minutes: number;
        commission_percent: number | string;
        is_available: boolean;
        created_at: string;
      };
      return {
        id: r.id,
        businessId: r.business_id,
        doctorName: r.doctor_name,
        specialty: r.specialty,
        cabinLabel: r.cabin_label,
        consultationFeePaise: r.consultation_fee_paise,
        avgConsultMinutes: r.avg_consult_minutes,
        extraDelayMinutes: r.extra_delay_minutes,
        commissionPercent: Number(r.commission_percent),
        isAvailable: r.is_available,
        createdAt: r.created_at,
      };
    }

    return mockBusinessRepository.upsertClinicDoctor(cleanId, input, options);
  }

  async adjustClinicDoctorDelay(params: {
    businessId: string;
    doctorId: string;
    deltaMinutes: number;
    options?: AIConfigAccessOptions;
  }): Promise<ClinicDoctor> {
    const err = validateBusinessId(params.businessId);
    if (err) throw new Error(err);
    const cleanId = params.businessId.trim();
    await this.verifyBusinessOwnership(cleanId, params.options);
    const client = this.requireClient();

    const { data, error } = await client.rpc('adjust_clinic_doctor_delay', {
      p_business_id: cleanId,
      p_doctor_id: params.doctorId,
      p_delta_minutes: Math.round(Number(params.deltaMinutes) || 0),
    });
    if (!error && data && typeof data === 'object') {
      return data as ClinicDoctor;
    }
    if (
      error &&
      (error.message.includes('Unauthorized') ||
        error.message.includes('not found'))
    ) {
      throw new Error(error.message);
    }
    return mockBusinessRepository.adjustClinicDoctorDelay(params);
  }

  async updateClinicVisitVitalsAndStatus(params: {
    businessId: string;
    visitId: string;
    status: ClinicVisitStatus;
    vitalsJson?: ClinicVitals | null;
    doctorId?: string | null;
    options?: AIConfigAccessOptions;
  }): Promise<ClinicVisitAndQueue> {
    const err = validateBusinessId(params.businessId);
    if (err) throw new Error(err);
    const cleanId = params.businessId.trim();
    await this.verifyBusinessOwnership(cleanId, params.options);
    const client = this.requireClient();

    const { data, error } = await client.rpc(
      'update_clinic_visit_vitals_and_status',
      {
        p_business_id: cleanId,
        p_visit_id: params.visitId,
        p_status: params.status,
        p_vitals_json: params.vitalsJson
          ? sanitizeClinicVitals(params.vitalsJson)
          : null,
        p_doctor_id: params.doctorId ?? null,
      },
    );
    if (!error && data && typeof data === 'object') {
      return data as ClinicVisitAndQueue;
    }
    if (
      error &&
      (error.message.includes('Unauthorized') ||
        error.message.includes('Invalid') ||
        error.message.includes('not found'))
    ) {
      throw new Error(error.message);
    }
    return mockBusinessRepository.updateClinicVisitVitalsAndStatus(params);
  }

  async completeClinicConsultationAndRx(
    input: CompleteClinicConsultationInput,
    options?: AIConfigAccessOptions,
  ): Promise<CompleteClinicConsultationResult> {
    const err = validateBusinessId(input.businessId);
    if (err) throw new Error(err);
    const cleanId = input.businessId.trim();
    await this.verifyBusinessOwnership(cleanId, options);
    const client = this.requireClient();

    const { data, error } = await client.rpc(
      'complete_clinic_consultation_and_rx',
      {
        p_business_id: cleanId,
        p_visit_id: input.visitId,
        p_diagnosis_notes: input.diagnosisNotes?.trim().slice(0, 2000) || null,
        p_prescription_items: sanitizePrescriptionItems(input.prescriptionItems),
        p_rx_attachment_url: input.rxAttachmentUrl?.trim() || null,
        p_fee_charged_paise: Math.max(
          0,
          Math.round(Number(input.feeChargedPaise) || 0),
        ),
        p_amount_collected_paise: Math.max(
          0,
          Math.round(Number(input.amountCollectedPaise) || 0),
        ),
        p_payment_method: input.paymentMethod,
        p_deduct_package_session: Boolean(input.deductPackageSession),
        p_next_followup_date: input.nextFollowupDate?.trim() || null,
        p_followup_reason: input.followupReason?.trim().slice(0, 160) || null,
      },
    );
    if (!error && data && typeof data === 'object') {
      return data as CompleteClinicConsultationResult;
    }
    if (
      error &&
      (error.message.includes('Unauthorized') ||
        error.message.includes('not found'))
    ) {
      throw new Error(error.message);
    }
    return mockBusinessRepository.completeClinicConsultationAndRx(
      input,
      options,
    );
  }

  async assignClinicTreatmentPackage(
    input: AssignClinicPackageInput,
    options?: AIConfigAccessOptions,
  ): Promise<ClinicPatient> {
    const err = validateBusinessId(input.businessId);
    if (err) throw new Error(err);
    const cleanId = input.businessId.trim();
    await this.verifyBusinessOwnership(cleanId, options);
    const client = this.requireClient();

    const { data, error } = await client.rpc(
      'assign_clinic_treatment_package',
      {
        p_business_id: cleanId,
        p_patient_id: input.patientId,
        p_package_name: input.packageName.trim().slice(0, 120),
        p_sessions_total: Math.max(
          1,
          Math.min(100, Math.round(Number(input.sessionsTotal) || 1)),
        ),
        p_package_fee_paise: Math.max(
          0,
          Math.round(Number(input.packageFeePaise) || 0),
        ),
        p_amount_paid_now_paise: Math.max(
          0,
          Math.round(Number(input.amountPaidNowPaise) || 0),
        ),
        p_next_followup_date: input.nextFollowupDate?.trim() || null,
        p_followup_reason: input.followupReason?.trim().slice(0, 160) || null,
      },
    );
    if (!error && data && typeof data === 'object') {
      return data as ClinicPatient;
    }
    if (
      error &&
      (error.message.includes('Unauthorized') ||
        error.message.includes('valid') ||
        error.message.includes('not found'))
    ) {
      throw new Error(error.message);
    }
    return mockBusinessRepository.assignClinicTreatmentPackage(input, options);
  }

  async collectClinicPatientBalance(params: {
    businessId: string;
    patientId: string;
    amountCollectedPaise: number;
    paymentMethod?: ClinicPaymentMethod;
    options?: AIConfigAccessOptions;
  }): Promise<ClinicPatient> {
    const err = validateBusinessId(params.businessId);
    if (err) throw new Error(err);
    const cleanId = params.businessId.trim();
    await this.verifyBusinessOwnership(cleanId, params.options);
    const client = this.requireClient();

    const { data, error } = await client.rpc('collect_clinic_patient_balance', {
      p_business_id: cleanId,
      p_patient_id: params.patientId,
      p_amount_collected_paise: Math.max(
        0,
        Math.round(Number(params.amountCollectedPaise) || 0),
      ),
      p_payment_method: params.paymentMethod ?? 'upi',
    });
    if (!error && data && typeof data === 'object') {
      return data as ClinicPatient;
    }
    if (
      error &&
      (error.message.includes('Unauthorized') ||
        error.message.includes('greater than zero') ||
        error.message.includes('no pending balance') ||
        error.message.includes('not found'))
    ) {
      throw new Error(error.message);
    }
    return mockBusinessRepository.collectClinicPatientBalance(params);
  }

  // ---------------------------------------------------------------------------
  // Module 10: CateringOS & Banquet Hall Management System
  // ---------------------------------------------------------------------------

  private async ensureSupabaseCateringStarterCatalog(
    businessId: string,
  ): Promise<void> {
    const client = this.requireClient();
    const { count: pkgCount, error: checkErr } = await client
      .from('catering_packages')
      .select('id', { count: 'exact', head: true })
      .eq('business_id', businessId);

    if (checkErr || (pkgCount ?? 0) > 0) return;

    await client.from('catering_packages').insert([
      {
        business_id: businessId,
        package_name: 'Silver Feast',
        tier_badge: 'Silver',
        meal_session: 'all_day',
        veg_price_paise: 30000,
        non_veg_price_paise: 42000,
        slot_rules: [
          { category: 'starter', label: 'Starters & Appetizers', maxSelect: 2 },
          { category: 'main_course', label: 'Main Course Curries', maxSelect: 2 },
          { category: 'rice_bread', label: 'Biryani / Rice & Breads', maxSelect: 2 },
          { category: 'dessert', label: 'Desserts & Sweets', maxSelect: 1 },
        ],
        description:
          'Classic celebratory spread ideal for birthdays, poojas & corporate lunches.',
        is_active: true,
      },
      {
        business_id: businessId,
        package_name: 'Royal Gold Banquet',
        tier_badge: 'Gold',
        meal_session: 'all_day',
        veg_price_paise: 45000,
        non_veg_price_paise: 58000,
        slot_rules: [
          { category: 'starter', label: 'Starters & Appetizers', maxSelect: 3 },
          { category: 'main_course', label: 'Main Course Curries', maxSelect: 3 },
          { category: 'rice_bread', label: 'Biryani / Rice & Breads', maxSelect: 2 },
          { category: 'dessert', label: 'Desserts & Sweets', maxSelect: 2 },
        ],
        description:
          'Signature wedding & reception buffet with Hyderabadi Dum Biryanis and Mughlai curries.',
        is_active: true,
      },
      {
        business_id: businessId,
        package_name: 'Imperial Wedding Platinum',
        tier_badge: 'Platinum',
        meal_session: 'all_day',
        veg_price_paise: 65000,
        non_veg_price_paise: 82000,
        slot_rules: [
          { category: 'starter', label: 'Starters & Appetizers', maxSelect: 4 },
          { category: 'main_course', label: 'Main Course Curries', maxSelect: 4 },
          { category: 'rice_bread', label: 'Biryani / Rice & Breads', maxSelect: 3 },
          { category: 'dessert', label: 'Desserts & Sweets', maxSelect: 2 },
          { category: 'live_counter', label: 'Live Chaat / Dosa Counters', maxSelect: 1 },
        ],
        description:
          'Grand luxury banquet experience with live counters, welcome mocktails & royal desserts.',
        is_active: true,
      },
    ]);

    const { count: dishCount } = await client
      .from('catering_dishes_and_recipes')
      .select('id', { count: 'exact', head: true })
      .eq('business_id', businessId);

    if ((dishCount ?? 0) === 0) {
      await client.from('catering_dishes_and_recipes').insert([
        {
          business_id: businessId,
          dish_name: 'Crispy Veg Manchurian',
          category: 'starter',
          diet_type: 'veg',
          available_in_packages: true,
          available_bulk_alacarte: true,
          bulk_unit: 'tray',
          bulk_unit_price_paise: 180000,
          ingredients_per_100_plates: [
            { ingredientName: 'Cabbage & Carrots', unit: 'kg', qtyPer100: 10 },
            { ingredientName: 'Refined Flour', unit: 'kg', qtyPer100: 3 },
            { ingredientName: 'Cooking Oil', unit: 'litres', qtyPer100: 2.5 },
          ],
          is_active: true,
        },
        {
          business_id: businessId,
          dish_name: 'Hyderabadi Chicken 65',
          category: 'starter',
          diet_type: 'non_veg',
          available_in_packages: true,
          available_bulk_alacarte: true,
          bulk_unit: 'kg',
          bulk_unit_price_paise: 65000,
          ingredients_per_100_plates: [
            { ingredientName: 'Boneless Chicken', unit: 'kg', qtyPer100: 14 },
            { ingredientName: 'Fresh Curd', unit: 'kg', qtyPer100: 3 },
          ],
          is_active: true,
        },
        {
          business_id: businessId,
          dish_name: 'Shahi Paneer Butter Masala',
          category: 'main_course',
          diet_type: 'veg',
          available_in_packages: true,
          available_bulk_alacarte: true,
          bulk_unit: 'kg',
          bulk_unit_price_paise: 52000,
          ingredients_per_100_plates: [
            { ingredientName: 'Malai Paneer', unit: 'kg', qtyPer100: 14 },
            { ingredientName: 'Ripe Tomatoes', unit: 'kg', qtyPer100: 12 },
            { ingredientName: 'Salted Butter', unit: 'kg', qtyPer100: 2.5 },
          ],
          is_active: true,
        },
        {
          business_id: businessId,
          dish_name: 'Hyderabadi Chicken Dum Biryani',
          category: 'rice_bread',
          diet_type: 'non_veg',
          available_in_packages: true,
          available_bulk_alacarte: true,
          bulk_unit: 'kg',
          bulk_unit_price_paise: 48000,
          ingredients_per_100_plates: [
            { ingredientName: 'Basmati Rice', unit: 'kg', qtyPer100: 15 },
            { ingredientName: 'Chicken', unit: 'kg', qtyPer100: 18 },
            { ingredientName: 'Pure Ghee', unit: 'litres', qtyPer100: 3 },
          ],
          is_active: true,
        },
        {
          business_id: businessId,
          dish_name: 'Subz Zafrani Veg Dum Biryani',
          category: 'rice_bread',
          diet_type: 'veg',
          available_in_packages: true,
          available_bulk_alacarte: true,
          bulk_unit: 'kg',
          bulk_unit_price_paise: 34000,
          ingredients_per_100_plates: [
            { ingredientName: 'Basmati Rice', unit: 'kg', qtyPer100: 15 },
            { ingredientName: 'Mixed Vegetables', unit: 'kg', qtyPer100: 12 },
          ],
          is_active: true,
        },
        {
          business_id: businessId,
          dish_name: 'Royal Double Ka Meetha',
          category: 'dessert',
          diet_type: 'veg',
          available_in_packages: true,
          available_bulk_alacarte: true,
          bulk_unit: 'tray',
          bulk_unit_price_paise: 220000,
          ingredients_per_100_plates: [
            { ingredientName: 'Milk Bread', unit: 'kg', qtyPer100: 8 },
            { ingredientName: 'Full Cream Milk', unit: 'litres', qtyPer100: 12 },
            { ingredientName: 'Sugar', unit: 'kg', qtyPer100: 6 },
          ],
          is_active: true,
        },
      ]);
    }
  }

  private async resolveCloudOrOwnerPreviewBusinessBySlug(
    cleanSlug: string,
  ): Promise<Business | null> {
    const publicBiz = await this.getBusinessBySlug(cleanSlug);
    if (publicBiz) return publicBiz;

    // Authenticated owner / platform-admin preview fallback (strictly governed by Supabase RLS)
    try {
      const client = this.requireClient();
      const { data } = await client
        .from('businesses')
        .select('*')
        .eq('slug', cleanSlug)
        .maybeSingle();
      if (data) {
        return this.rememberBusiness(mapBusinessRow(data as DbBusinessRow));
      }
    } catch {
      // ignore if unauthenticated
    }
    return null;
  }

  async getPublicCateringPortal(
    businessSlug: string,
  ): Promise<PublicCateringPortalPayload | null> {
    const cleanSlug = (businessSlug ?? '').trim().toLowerCase();
    if (!cleanSlug) return null;
    const client = this.requireClient();

    const { data, error } = await client.rpc('get_public_catering_portal', {
      p_slug: cleanSlug,
    });
    if (!error && data && typeof data === 'object') {
      const payload = data as PublicCateringPortalPayload;
      if (
        (payload.packages?.length ?? 0) === 0 &&
        (payload.dishes?.length ?? 0) === 0 &&
        payload.business?.id
      ) {
        try {
          await this.ensureSupabaseCateringStarterCatalog(payload.business.id);
          const retry = await client.rpc('get_public_catering_portal', {
            p_slug: cleanSlug,
          });
          if (!retry.error && retry.data && typeof retry.data === 'object') {
            return retry.data as PublicCateringPortalPayload;
          }
        } catch {
          // If anonymous visitor before owner seeded, fall through cleanly
        }
      }
      return payload;
    }

    // 1. Check built-in demo fixture (e.g. royal-imperial-banquet)
    const demo = await mockBusinessRepository.getPublicCateringPortal(cleanSlug);
    if (demo) return demo;

    // 2. Check cloud business (handles unmigrated 034 fallback OR authenticated owner previewing a pending venue)
    const cloudBiz = await this.resolveCloudOrOwnerPreviewBusinessBySlug(cleanSlug);
    if (cloudBiz) {
      (mockBusinessRepository as MockLocalStorageRepository).syncExternalBusinessForFallback(
        cloudBiz,
      );
      return mockBusinessRepository.getPublicCateringPortal(cleanSlug);
    }

    return null;
  }

  async submitCateringOrder(
    input: SubmitCateringOrderInput,
    options?: AIConfigAccessOptions,
  ): Promise<CateringOrder> {
    const client = this.requireClient();
    const { data, error } = await client.rpc('submit_catering_order', {
      p_payload: input,
    });
    if (!error && data && typeof data === 'object') {
      return data as CateringOrder;
    }
    if (
      error &&
      (error.message.includes('Minimum headcount') ||
        error.message.includes('Maximum capacity') ||
        error.message.includes('blacked out') ||
        error.message.includes('advance notice') ||
        error.message.includes('already booked') ||
        error.message.includes('disabled') ||
        error.message.includes('Please enter') ||
        error.message.includes('Please select'))
    ) {
      throw new Error(error.message);
    }
    const cleanSlug = (input.businessSlug ?? '').trim().toLowerCase();
    const cloudBiz = await this.resolveCloudOrOwnerPreviewBusinessBySlug(cleanSlug);
    if (cloudBiz) {
      (mockBusinessRepository as MockLocalStorageRepository).syncExternalBusinessForFallback(
        cloudBiz,
      );
    }
    return mockBusinessRepository.submitCateringOrder(input, options);
  }

  async getCateringOwnerDashboard(
    businessId: string,
    options?: AIConfigAccessOptions,
  ): Promise<CateringOwnerDashboardPayload> {
    const err = validateBusinessId(businessId);
    if (err) throw new Error(err);
    const cleanId = businessId.trim();
    const biz = await this.verifyBusinessOwnership(cleanId, options);
    const client = this.requireClient();

    await this.ensureSupabaseCateringStarterCatalog(cleanId).catch(() => {});

    const { data, error } = await client.rpc('get_catering_owner_dashboard', {
      p_business_id: cleanId,
    });
    if (!error && data && typeof data === 'object') {
      const payload = data as CateringOwnerDashboardPayload;
      const todayIso = new Date().toISOString().slice(0, 10);
      const upcomingActive = (payload.orders ?? []).filter(
        (o) => o.orderStatus !== 'cancelled' && o.eventDate >= todayIso,
      );
      return {
        ...payload,
        groceryList: computeCateringGroceryShoppingList({
          orders: upcomingActive,
          dishesCatalog: payload.dishes ?? [],
          wastagePercent: payload.config?.defaultWastagePercent ?? 5,
        }),
      };
    }
    if (error && error.message.includes('Unauthorized')) {
      throw new Error(error.message);
    }
    (mockBusinessRepository as MockLocalStorageRepository).syncExternalBusinessForFallback(
      biz,
    );
    return mockBusinessRepository.getCateringOwnerDashboard(cleanId, options);
  }

  async updateCateringConfig(
    businessId: string,
    input: CateringConfigInput,
    options?: AIConfigAccessOptions,
  ): Promise<CateringConfig> {
    const validated = validateCateringConfigInput(businessId, input);
    await this.verifyBusinessOwnership(validated.businessId, options);
    const client = this.requireClient();

    const { data, error } = await client
      .from('catering_configs')
      .upsert(
        {
          business_id: validated.businessId,
          min_headcount: validated.minHeadcount,
          max_capacity_per_event: validated.maxCapacityPerEvent,
          min_advance_hours: validated.minAdvanceHours,
          cutoff_hours_before_event: validated.cutoffHoursBeforeEvent,
          service_zones: validated.serviceZones,
          blackout_dates: validated.blackoutDates,
          banquet_hall_enabled: validated.banquetHallEnabled,
          hall_name: validated.hallName,
          hall_slots: validated.hallSlots,
          hall_addons_catalog: validated.hallAddonsCatalog,
          service_rates_json: validated.serviceRatesJson,
          chef_station_pin: validated.chefStationPin ?? '4321',
          default_wastage_percent: validated.defaultWastagePercent,
          brand_logo_url: validated.brandLogoUrl,
          primary_accent_hex: validated.primaryAccentHex,
          secondary_surface_hex: validated.secondarySurfaceHex,
          whatsapp_quote_template: validated.whatsappQuoteTemplate,
          updated_at: validated.updatedAt,
        },
        { onConflict: 'business_id' },
      )
      .select()
      .single();

    if (!error && data) {
      return validated;
    }
    if (error && error.message.includes('Unauthorized')) {
      throw new Error(error.message);
    }
    return mockBusinessRepository.updateCateringConfig(
      validated.businessId,
      input,
      options,
    );
  }

  async upsertCateringPackage(
    businessId: string,
    input: CateringPackageInput,
    options?: AIConfigAccessOptions,
  ): Promise<CateringPackage> {
    const validated = validateCateringPackageInput(businessId, input);
    await this.verifyBusinessOwnership(validated.businessId, options);
    const client = this.requireClient();

    const rowPayload: Record<string, unknown> = {
      business_id: validated.businessId,
      package_name: validated.packageName,
      tier_badge: validated.tierBadge,
      meal_session: validated.mealSession,
      veg_price_paise: validated.vegPricePaise,
      non_veg_price_paise: validated.nonVegPricePaise,
      slot_rules: validated.slotRules,
      description: validated.description,
      is_active: validated.isActive,
    };
    if (validated.id && /^[0-9a-f-]{36}$/i.test(validated.id)) {
      rowPayload.id = validated.id;
    }

    const { data, error } = await client
      .from('catering_packages')
      .upsert(rowPayload)
      .select()
      .single();

    if (!error && data && typeof data === 'object') {
      const r = data as Record<string, unknown>;
      return {
        id: String(r.id),
        businessId: String(r.business_id),
        packageName: String(r.package_name),
        tierBadge: String(r.tier_badge),
        mealSession: validated.mealSession,
        vegPricePaise: Number(r.veg_price_paise),
        nonVegPricePaise: Number(r.non_veg_price_paise),
        slotRules: validated.slotRules,
        description: (r.description as string | null) ?? null,
        isActive: Boolean(r.is_active),
        createdAt: String(r.created_at),
      };
    }
    if (error && error.message.includes('Unauthorized')) {
      throw new Error(error.message);
    }
    return mockBusinessRepository.upsertCateringPackage(
      validated.businessId,
      input,
      options,
    );
  }

  async deleteCateringPackage(
    businessId: string,
    packageId: string,
    options?: AIConfigAccessOptions,
  ): Promise<void> {
    const err = validateBusinessId(businessId);
    if (err) throw new Error(err);
    const cleanId = businessId.trim();
    await this.verifyBusinessOwnership(cleanId, options);
    const client = this.requireClient();

    const { error } = await client
      .from('catering_packages')
      .delete()
      .eq('id', packageId)
      .eq('business_id', cleanId);

    if (error) {
      if (error.message.includes('Unauthorized')) {
        throw new Error(error.message);
      }
      await mockBusinessRepository.deleteCateringPackage(
        cleanId,
        packageId,
        options,
      );
    }
  }

  async upsertCateringDishAndRecipe(
    businessId: string,
    input: CateringDishAndRecipeInput,
    options?: AIConfigAccessOptions,
  ): Promise<CateringDishAndRecipe> {
    const validated = validateCateringDishInput(businessId, input);
    await this.verifyBusinessOwnership(validated.businessId, options);
    const client = this.requireClient();

    const rowPayload: Record<string, unknown> = {
      business_id: validated.businessId,
      dish_name: validated.dishName,
      category: validated.category,
      diet_type: validated.dietType,
      available_in_packages: validated.availableInPackages,
      available_bulk_alacarte: validated.availableBulkAlacarte,
      bulk_unit: validated.bulkUnit,
      bulk_unit_price_paise: validated.bulkUnitPricePaise,
      ingredients_per_100_plates: validated.ingredientsPer100Plates,
      is_active: validated.isActive,
    };
    if (validated.id && /^[0-9a-f-]{36}$/i.test(validated.id)) {
      rowPayload.id = validated.id;
    }

    const { data, error } = await client
      .from('catering_dishes_and_recipes')
      .upsert(rowPayload)
      .select()
      .single();

    if (!error && data && typeof data === 'object') {
      const r = data as Record<string, unknown>;
      return {
        id: String(r.id),
        businessId: String(r.business_id),
        dishName: String(r.dish_name),
        category: validated.category,
        dietType: validated.dietType,
        availableInPackages: Boolean(r.available_in_packages),
        availableBulkAlacarte: Boolean(r.available_bulk_alacarte),
        bulkUnit: validated.bulkUnit,
        bulkUnitPricePaise: Number(r.bulk_unit_price_paise),
        ingredientsPer100Plates: validated.ingredientsPer100Plates,
        isActive: Boolean(r.is_active),
        createdAt: String(r.created_at),
      };
    }
    if (error && error.message.includes('Unauthorized')) {
      throw new Error(error.message);
    }
    return mockBusinessRepository.upsertCateringDishAndRecipe(
      validated.businessId,
      input,
      options,
    );
  }

  async deleteCateringDishAndRecipe(
    businessId: string,
    dishId: string,
    options?: AIConfigAccessOptions,
  ): Promise<void> {
    const err = validateBusinessId(businessId);
    if (err) throw new Error(err);
    const cleanId = businessId.trim();
    await this.verifyBusinessOwnership(cleanId, options);
    const client = this.requireClient();

    const { error } = await client
      .from('catering_dishes_and_recipes')
      .delete()
      .eq('id', dishId)
      .eq('business_id', cleanId);

    if (error) {
      if (error.message.includes('Unauthorized')) {
        throw new Error(error.message);
      }
      await mockBusinessRepository.deleteCateringDishAndRecipe(
        cleanId,
        dishId,
        options,
      );
    }
  }

  async recordCateringStagePayment(params: {
    businessId: string;
    orderId: string;
    stage: CateringPaymentStage;
    amountPaise: number;
    method: CateringPaymentMethod;
    note?: string | null;
    options?: AIConfigAccessOptions;
  }): Promise<CateringOrder> {
    const err = validateBusinessId(params.businessId);
    if (err) throw new Error(err);
    const cleanId = params.businessId.trim();
    await this.verifyBusinessOwnership(cleanId, params.options);
    const client = this.requireClient();

    const { data, error } = await client.rpc('record_catering_stage_payment', {
      p_business_id: cleanId,
      p_order_id: params.orderId,
      p_stage: params.stage,
      p_amount_paise: Math.max(0, Math.round(Number(params.amountPaise) || 0)),
      p_method: params.method || 'upi',
      p_note: params.note ?? null,
    });
    if (!error && data && typeof data === 'object') {
      return data as CateringOrder;
    }
    if (
      error &&
      (error.message.includes('Unauthorized') ||
        error.message.includes('greater than zero') ||
        error.message.includes('not found'))
    ) {
      throw new Error(error.message);
    }
    return mockBusinessRepository.recordCateringStagePayment(params);
  }

  async addCateringExtraPlates(params: {
    businessId: string;
    orderId: string;
    extraPlates: number;
    options?: AIConfigAccessOptions;
  }): Promise<CateringOrder> {
    const err = validateBusinessId(params.businessId);
    if (err) throw new Error(err);
    const cleanId = params.businessId.trim();
    await this.verifyBusinessOwnership(cleanId, params.options);
    const client = this.requireClient();

    const { data, error } = await client.rpc('add_catering_extra_plates', {
      p_business_id: cleanId,
      p_order_id: params.orderId,
      p_extra_plates: Math.max(0, Math.floor(Number(params.extraPlates) || 0)),
    });
    if (!error && data && typeof data === 'object') {
      return data as CateringOrder;
    }
    if (
      error &&
      (error.message.includes('Unauthorized') ||
        error.message.includes('at least 1') ||
        error.message.includes('not found'))
    ) {
      throw new Error(error.message);
    }
    return mockBusinessRepository.addCateringExtraPlates(params);
  }

  async updateCateringKitchenAndVessels(params: {
    businessId: string;
    orderId: string;
    chefPin?: string | null;
    orderStatus?: CateringOrderStatus;
    kitchenChecklist?: CateringKitchenChecklist;
    vesselsDispatched?: CateringVesselDispatchLine[];
    chefNotes?: string | null;
    options?: AIConfigAccessOptions;
  }): Promise<
    Partial<CateringOrder> & Pick<CateringOrder, 'id' | 'orderCode' | 'orderStatus'>
  > {
    const err = validateBusinessId(params.businessId);
    if (err) throw new Error(err);
    const cleanId = params.businessId.trim();
    if (!params.chefPin) {
      await this.verifyBusinessOwnership(cleanId, params.options);
    }
    const client = this.requireClient();

    const { data, error } = await client.rpc(
      'update_catering_kitchen_and_vessels',
      {
        p_business_id: cleanId,
        p_order_id: params.orderId,
        p_chef_pin: params.chefPin ?? null,
        p_order_status: params.orderStatus ?? null,
        p_kitchen_checklist: params.kitchenChecklist ?? null,
        p_vessels_dispatched: params.vesselsDispatched ?? null,
        p_chef_notes: params.chefNotes ?? null,
      },
    );
    if (!error && data && typeof data === 'object') {
      return data as Partial<CateringOrder> &
        Pick<CateringOrder, 'id' | 'orderCode' | 'orderStatus'>;
    }
    if (
      error &&
      (error.message.includes('Invalid Head Chef PIN') ||
        error.message.includes('Unauthorized') ||
        error.message.includes('not found'))
    ) {
      throw new Error(error.message);
    }
    return mockBusinessRepository.updateCateringKitchenAndVessels(params);
  }

  async getCateringChefKitchenPortal(params: {
    businessId: string;
    chefPin: string;
    dateFrom?: string;
    dateTo?: string;
  }): Promise<CateringChefKitchenPortalPayload> {
    const err = validateBusinessId(params.businessId);
    if (err) throw new Error(err);
    const cleanId = params.businessId.trim();
    const client = this.requireClient();

    const { data, error } = await client.rpc('get_catering_chef_kitchen_portal', {
      p_business_id: cleanId,
      p_chef_pin: params.chefPin,
      p_date_from: params.dateFrom ?? undefined,
      p_date_to: params.dateTo ?? undefined,
    });
    if (!error && data && typeof data === 'object') {
      return data as CateringChefKitchenPortalPayload;
    }
    if (
      error &&
      (error.message.includes('Invalid Head Chef PIN') ||
        error.message.includes('Business not found'))
    ) {
      throw new Error(error.message);
    }
    return mockBusinessRepository.getCateringChefKitchenPortal(params);
  }
}
