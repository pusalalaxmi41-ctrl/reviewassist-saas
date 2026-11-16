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
}
