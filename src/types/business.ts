export type BusinessCategory =
  | 'restaurant'
  | 'cafe'
  | 'hotel'
  | 'pg'
  | 'salon'
  | 'barber'
  | 'clinic'
  | 'catering'
  | 'gym'
  | 'loyalty'
  | 'retail'
  | 'services';

/**
 * Display font used on the customer review page while the AI writes the draft.
 * Purely visual: the copied review is always plain text so it posts cleanly on Google.
 */
export type ReviewFontStyle =
  | 'classic'
  | 'handwritten'
  | 'script'
  | 'typewriter'
  | 'gothic'
  | 'gothic_bold';

/** Overall rating the customer picks in step 1 of the review flow. */
export type ExperienceRating = 'excellent' | 'good' | 'average' | 'not_good';

export type BusinessStatus = 'pending' | 'active' | 'rejected' | 'suspended';

export type AccountLifecycleState = 'active' | 'disabled' | 'pending_deletion';

export interface Business {
  id: string;
  ownerId?: string;
  slug: string;
  name: string;
  category: BusinessCategory;
  city: string;
  googleReviewUrl: string;
  /** True while the business has not configured its real Google review link. */
  googleReviewUrlIsPlaceholder?: boolean;
  /** Font shown to customers while their review is being written. Defaults to 'classic'. */
  reviewFont?: ReviewFontStyle;
  /** Modular switch controlling whether Loyalty & Star Rewards are active for this business. */
  loyaltyEnabled?: boolean;
  /** Platform approval status. Defaults to 'pending' on new signups. */
  status?: BusinessStatus;
  statusChangedAt?: string;
  statusReason?: string | null;
  /** Account lifecycle state managed by platform admins. */
  accountState?: AccountLifecycleState;
  deletionRequestedAt?: string | null;
  deletionScheduledFor?: string | null;
  deletedReason?: string | null;
  createdAt: string;
}

export type ExperienceInputMode = 'text' | 'voice';

export type ReviewFlowStep = 'welcome' | 'rating' | 'highlights' | 'review' | 'thanks';

/**
 * Estimated sentiment classification of customer feedback.
 * Important: This is an automated lexical estimate, NOT a verified star rating.
 */
export type ReviewSentiment = 'positive' | 'neutral' | 'negative' | 'mixed';

/**
 * Distinct workflow states for a business owner's response to customer feedback:
 * 1. 'pending' — No owner response draft has been generated yet.
 * 2. 'draft_generated' — An AI response draft has been generated or edited.
 * 3. 'approved' — The business owner explicitly approved the response text.
 * 4. 'completed' — The business owner explicitly confirmed they completed the external response action.
 */
export type ResponseWorkflowStatus =
  | 'pending'
  | 'draft_generated'
  | 'approved'
  | 'completed';

/** Approved customer draft retention window (90 days, matching migration 002). */
export const CUSTOMER_DRAFT_RETENTION_DAYS = 90;

export type AnalyticsEventType =
  | 'qr_scan'
  | 'feedback_submitted'
  | 'ai_generation'
  | 'google_redirect_click';

export interface AnalyticsEvent {
  id: string;
  businessId: string;
  eventType: AnalyticsEventType;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export interface BusinessMetrics {
  qrScans: number;
  feedbackSubmissions: number;
  aiGenerations: number;
  googleRedirectClicks: number;
}

export interface CustomerDraftRecord {
  id: string;
  businessId: string;
  originalInput: string;
  generatedReview: string;
  mode: ExperienceInputMode;
  sentiment: ReviewSentiment;
  timestamp: string;
  /** Optional business-owner response draft generated/edited for this feedback. */
  ownerResponseDraft?: string | null;
  /** Distinct response workflow status (defaults to 'pending'). */
  responseStatus?: ResponseWorkflowStatus;
  /** Number of generation/regeneration attempts for the owner response draft. */
  responseAttempt?: number;
  responseGeneratedAt?: string | null;
  responseApprovedAt?: string | null;
  responseCompletedAt?: string | null;
  responseUpdatedAt?: string | null;
}
