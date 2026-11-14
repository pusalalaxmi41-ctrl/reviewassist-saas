import type {
  AnalyticsEvent,
  AnalyticsEventType,
  Business,
  BusinessCategory,
  BusinessMetrics,
  CustomerDraftRecord,
  ExperienceInputMode,
  ReviewSentiment,
} from '../../types/business';
import { supabase } from '../../lib/supabase';
import type { IBusinessRepository } from './BusinessRepository';

interface DbBusinessRow {
  id: string;
  slug: string;
  name: string;
  category: BusinessCategory;
  city: string;
  google_review_url: string;
  google_review_url_is_placeholder: boolean;
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
}

function mapBusinessRow(row: DbBusinessRow): Business {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    category: row.category,
    city: row.city,
    googleReviewUrl: row.google_review_url,
    googleReviewUrlIsPlaceholder: row.google_review_url_is_placeholder,
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
      .select(
        'id, slug, name, category, city, google_review_url, google_review_url_is_placeholder, created_at',
      )
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
      .select(
        'id, slug, name, category, city, google_review_url, google_review_url_is_placeholder, created_at',
      )
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
      return null;
    }

    return this.rememberBusiness(data.business);
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
      .select(
        'id, slug, name, category, city, google_review_url, google_review_url_is_placeholder, created_at',
      )
      .single();

    if (error || !inserted) {
      if (error?.code === '23505') {
        throw new Error(
          `The URL slug "/r/${data.slug.trim().toLowerCase()}" is already in use. Please choose another.`,
        );
      }
      throw new Error(error?.message || 'Failed to register business.');
    }

    return this.rememberBusiness(mapBusinessRow(inserted as DbBusinessRow));
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
      .select(
        'id, slug, name, category, city, google_review_url, google_review_url_is_placeholder, created_at',
      )
      .single();

    if (error || !updated) {
      throw new Error(error?.message || 'Unable to update Google review URL.');
    }

    return this.rememberBusiness(mapBusinessRow(updated as DbBusinessRow));
  }

  async trackEvent(event: {
    businessId: string;
    eventType: AnalyticsEventType;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    // 'feedback_submitted' and 'ai_generation' are recorded atomically on the server
    // inside the generate-review-draft Edge Function (record_customer_draft_with_events).
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
    // Persisted atomically on the server inside generate-review-draft via
    // public.record_customer_draft_with_events().
    return {
      ...draft,
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
    };
  }

  async getDrafts(businessId: string): Promise<CustomerDraftRecord[]> {
    const client = this.requireClient();
    const { data, error } = await client
      .from('customer_drafts')
      .select(
        'id, business_id, original_input, generated_review, mode, sentiment, created_at',
      )
      .eq('business_id', businessId)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error || !data) {
      return [];
    }

    return (data as DbCustomerDraftRow[]).map((row) => ({
      id: row.id,
      businessId: row.business_id,
      originalInput: row.original_input,
      generatedReview: row.generated_review,
      mode: row.mode,
      sentiment: row.sentiment,
      timestamp: row.created_at,
    }));
  }
}
