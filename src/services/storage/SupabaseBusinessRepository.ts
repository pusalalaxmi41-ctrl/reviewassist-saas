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
  GymConfig,
  GymConfigInput,
  GymDailyCheckInResult,
  GymFitnessGoal,
  GymMember,
  GymMemberProgressHistory,
  GymOwnerDashboardPayload,
  GymOwnerMemberAction,
  GymPlan,
  GymWorkoutFocus,
  PublicGymPortalPayload,
  SubmitGymRegistrationInput,
} from '../../types/gym';
import {
  normalizeGymConfig,
  normalizeGymFitnessGoal,
  normalizeGymPhone,
  normalizeGymWorkoutFocus,
  validateGymConfigInput,
  validateGymOwnerAction,
  validateGymRegistrationInput,
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
import { businessRepository as mockBusinessRepository } from './MockLocalStorageRepository';

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

interface StatusOverlayEntry {
  status: BusinessStatus;
  statusChangedAt: string;
  statusReason: string | null;
  accountState: AccountLifecycleState;
  deletionRequestedAt: string | null;
  deletionScheduledFor: string | null;
  deletedReason: string | null;
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
            return this.rememberBusiness({
              id: b.id,
              slug: b.slug,
              name: b.name,
              category: b.category,
              city: b.city,
              googleReviewUrl: b.googleReviewUrl,
              googleReviewUrlIsPlaceholder: false,
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
    const effectiveStatus = biz.status ?? overlay?.status ?? 'active';
    const effectiveAccountState = biz.accountState ?? overlay?.accountState ?? 'active';

    // Only 'active' businesses with 'active' accountState can be served publicly
    if (effectiveStatus !== 'active' || effectiveAccountState !== 'active') {
      return null;
    }

    return this.rememberBusiness({
      ...biz,
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

    const { data: inserted, error } = await client
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
    writeLocalStatusOverlay(row.id, {
      status: row.status ?? 'pending',
      statusChangedAt: row.status_changed_at ?? now,
      statusReason: null,
      accountState: row.account_state ?? 'active',
      deletionRequestedAt: null,
      deletionScheduledFor: null,
      deletedReason: null,
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

    if (
      error &&
      (error.message.includes('Unauthorized') ||
        error.message.includes('not found'))
    ) {
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
      .select(
        'business_id, is_registration_open, renewal_alert_days, plans, created_at, updated_at',
      )
      .eq('business_id', cleanId)
      .maybeSingle();

    if (!error && data) {
      const row = data as {
        business_id: string;
        is_registration_open: boolean;
        renewal_alert_days: number;
        plans: GymPlan[];
        created_at: string;
        updated_at: string;
      };
      return normalizeGymConfig(cleanId, {
        isRegistrationOpen: row.is_registration_open,
        renewalAlertDays: row.renewal_alert_days,
        plans: row.plans,
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
      .select(
        'business_id, is_registration_open, renewal_alert_days, plans, created_at, updated_at',
      )
      .single();

    if (!error && data) {
      const row = data as {
        business_id: string;
        is_registration_open: boolean;
        renewal_alert_days: number;
        plans: GymPlan[];
        created_at: string;
        updated_at: string;
      };
      return normalizeGymConfig(cleanId, {
        isRegistrationOpen: row.is_registration_open,
        renewalAlertDays: row.renewal_alert_days,
        plans: row.plans,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      });
    }

    return mockBusinessRepository.updateGymConfig(cleanId, validation.value, options);
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
      return data as GymMember;
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
    });

    if (!error && data && typeof data === 'object') {
      return data as GymDailyCheckInResult;
    }

    if (
      error &&
      (error.message.includes('pending payment') ||
        error.message.includes('expired') ||
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
      return {
        config: payload.config ?? normalizeGymConfig(cleanId, null),
        monthKey: payload.monthKey ?? new Date().toISOString().slice(0, 7),
        members: payload.members ?? [],
        checkedInTodayCount: payload.checkedInTodayCount ?? 0,
        todaysAttendance: payload.todaysAttendance ?? [],
        monthlyRevenuePaise: Number(payload.monthlyRevenuePaise ?? 0),
        projectedNextMonthRevenuePaise: Number(
          payload.projectedNextMonthRevenuePaise ?? 0,
        ),
        inactiveAlertMembers: payload.inactiveAlertMembers ?? [],
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
}
