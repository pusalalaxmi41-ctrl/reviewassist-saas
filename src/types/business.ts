export type BusinessCategory = 'restaurant' | 'cafe' | 'hotel' | 'pg';

export interface Business {
  id: string;
  slug: string;
  name: string;
  category: BusinessCategory;
  city: string;
  googleReviewUrl: string;
  /** True while the business has not configured its real Google review link. */
  googleReviewUrlIsPlaceholder?: boolean;
  createdAt: string;
}

export type ExperienceInputMode = 'text' | 'voice';

export type ReviewFlowStep = 'welcome' | 'experience' | 'review' | 'google';

export type ReviewSentiment = 'positive' | 'neutral' | 'mixed';

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
}
