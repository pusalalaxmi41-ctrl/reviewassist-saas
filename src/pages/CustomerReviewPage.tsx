import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import {
  AlertCircle,
  ArrowRight,
  Check,
  CheckCircle2,
  ExternalLink,
  Loader2,
  RefreshCw,
  SearchX,
  Sparkles,
  Star,
} from 'lucide-react';
import type { Business, ExperienceRating } from '../types/business';
import {
  businessRepository,
  PLACEHOLDER_GOOGLE_REVIEW_URL,
} from '../services/storage';
import { aiProvider, AIProviderError } from '../services/ai';
import {
  composeExperienceText,
  getCategoryExperience,
} from '../config/reviewExperience';
import { loadBusinessQRSettings } from '../services/qr/qrGenerator';
import { classifyEstimatedSentiment } from '../utils/sentimentClassifier';
import { copyText } from '../utils/clipboard';

const SLOW_RESPONSE_THRESHOLD_MS = 3500;
const REQUEST_TIMEOUT_MS = 22000;

const EXPERIENCE_PILLS: ReadonlyArray<{
  id: ExperienceRating;
  emoji: string;
  label: string;
}> = [
  { id: 'excellent', emoji: '😍', label: 'Excellent' },
  { id: 'good', emoji: '😊', label: 'Good' },
  { id: 'average', emoji: '😐', label: 'Average' },
  { id: 'not_good', emoji: '😞', label: 'Needs work' },
];

export default function CustomerReviewPage() {
  const { businessSlug } = useParams();
  const [searchParams] = useSearchParams();

  const [business, setBusiness] = useState<Business | null>(null);
  const [pageLoading, setPageLoading] = useState(true);

  // Unified Single-Screen State (100% Text Mode — Zero Wizards, Zero Speak/Text Chooser)
  const [rating, setRating] = useState<ExperienceRating>('excellent');
  const [likedIds, setLikedIds] = useState<string[]>([]);
  const [improveIds, setImproveIds] = useState<string[]>([]);
  const [note, setNote] = useState('');
  const [review, setReview] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [loading, setLoading] = useState(false);
  const [slowResponse, setSlowResponse] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedToast, setCopiedToast] = useState<string | null>(null);

  const trackedScanRef = useRef(false);
  const initialDraftTriggeredRef = useRef<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const chipDebounceTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
      if (chipDebounceTimerRef.current !== null) {
        window.clearTimeout(chipDebounceTimerRef.current);
      }
    };
  }, []);

  const categoryExp = useMemo(
    () => getCategoryExperience(business?.category),
    [business?.category],
  );

  const logoDataUrl = useMemo(() => {
    if (!business) return null;
    try {
      return loadBusinessQRSettings(business).logoDataUrl;
    } catch {
      return null;
    }
  }, [business]);

  const buildPromptText = useCallback(
    (
      nextRating: ExperienceRating,
      nextLikedIds: string[],
      nextImproveIds: string[],
      nextNote: string,
      targetBiz: Business,
    ): string => {
      const cat = getCategoryExperience(targetBiz.category);
      const liked = cat.liked.filter((o) => nextLikedIds.includes(o.id));
      const improve = cat.improve.filter((o) => nextImproveIds.includes(o.id));
      const composed = composeExperienceText({
        rating: nextRating,
        liked,
        improve,
        note: nextNote,
      }).trim();
      return (
        composed ||
        `Overall, my visit to ${targetBiz.name} in ${targetBiz.city} was ${nextRating.replace('_', ' ')}.`
      );
    },
    [],
  );

  const generateDraftInPlace = useCallback(
    async (params: {
      targetBiz: Business;
      promptText: string;
      nextAttempt: number;
      recordFeedbackEvent?: boolean;
    }) => {
      const { targetBiz, promptText, nextAttempt, recordFeedbackEvent = false } =
        params;

      abortControllerRef.current?.abort();
      const controller = new AbortController();
      abortControllerRef.current = controller;

      setLoading(true);
      setSlowResponse(false);
      setError(null);
      setCopiedToast(null);

      if (recordFeedbackEvent) {
        void businessRepository.trackEvent({
          businessId: targetBiz.id,
          eventType: 'feedback_submitted',
          metadata: { mode: 'text', length: promptText.length },
        });
      }

      const slowTimer = window.setTimeout(() => {
        setSlowResponse(true);
      }, SLOW_RESPONSE_THRESHOLD_MS);

      const timeoutTimer = window.setTimeout(() => {
        controller.abort('timeout');
      }, REQUEST_TIMEOUT_MS);

      try {
        const draft = await aiProvider.generateReviewDraft({
          business: targetBiz,
          experience: promptText,
          attempt: nextAttempt,
          mode: 'text',
          signal: controller.signal,
          onToken: (_delta, accumulated) => {
            setReview(accumulated);
          },
        });

        if (controller.signal.aborted) return;

        const finalText = draft.text.trim();
        if (!finalText) {
          setError(
            'We received an empty draft. Tap Regenerate to write a fresh version.',
          );
          return;
        }

        setReview(finalText);
        setAttempt(nextAttempt);

        void businessRepository.trackEvent({
          businessId: targetBiz.id,
          eventType: 'ai_generation',
          metadata: {
            attempt: nextAttempt,
            streamed: Boolean(draft.streamed),
            source: draft.generationSource ?? 'unknown',
          },
        });

        const sentiment = classifyEstimatedSentiment(promptText);
        void businessRepository.recordDraft({
          businessId: targetBiz.id,
          originalInput: promptText,
          generatedReview: finalText,
          mode: 'text',
          sentiment,
        });
      } catch (err) {
        if (controller.signal.aborted) {
          if (controller.signal.reason === 'timeout') {
            setError(
              'Generating your review took longer than expected. Tap Regenerate to try again.',
            );
          }
          return;
        }

        if (err instanceof AIProviderError) {
          setError(err.message);
        } else {
          setError(
            (err as Error)?.message ||
              "We couldn't prepare your review right now. Please tap Regenerate.",
          );
        }
      } finally {
        window.clearTimeout(slowTimer);
        window.clearTimeout(timeoutTimer);
        if (abortControllerRef.current === controller) {
          setLoading(false);
          setSlowResponse(false);
        }
      }
    },
    [],
  );

  useEffect(() => {
    let active = true;
    async function init() {
      if (!businessSlug) {
        setPageLoading(false);
        return;
      }
      setPageLoading(true);
      const found = await businessRepository.getBusinessBySlug(businessSlug);
      if (!active) return;
      setBusiness(found);
      setPageLoading(false);

      if (found && !trackedScanRef.current) {
        trackedScanRef.current = true;
        const source = searchParams.get('src') || 'direct';
        void businessRepository.trackEvent({
          businessId: found.id,
          eventType: 'qr_scan',
          metadata: { source, slug: found.slug },
        });
      }

      if (found && initialDraftTriggeredRef.current !== found.id) {
        initialDraftTriggeredRef.current = found.id;
        const initialPrompt = buildPromptText('excellent', [], [], '', found);
        void generateDraftInPlace({
          targetBiz: found,
          promptText: initialPrompt,
          nextAttempt: 0,
          recordFeedbackEvent: false,
        });
      }
    }

    void init();
    return () => {
      active = false;
    };
  }, [businessSlug, searchParams, buildPromptText, generateDraftInPlace]);

  function scheduleDebouncedGeneration(
    nextRating: ExperienceRating,
    nextLikedIds: string[],
    nextImproveIds: string[],
    nextNote: string,
  ) {
    if (!business) return;
    if (chipDebounceTimerRef.current !== null) {
      window.clearTimeout(chipDebounceTimerRef.current);
    }
    const targetBiz = business;
    chipDebounceTimerRef.current = window.setTimeout(() => {
      const promptText = buildPromptText(
        nextRating,
        nextLikedIds,
        nextImproveIds,
        nextNote,
        targetBiz,
      );
      void generateDraftInPlace({
        targetBiz,
        promptText,
        nextAttempt: 0,
        recordFeedbackEvent: true,
      });
    }, 320);
  }

  function handleSelectRating(nextRating: ExperienceRating) {
    setRating(nextRating);
    const nextLiked = nextRating === 'not_good' ? [] : likedIds;
    const nextImprove =
      nextRating === 'excellent' || nextRating === 'good' ? [] : improveIds;
    setLikedIds(nextLiked);
    setImproveIds(nextImprove);
    if (!business) return;
    if (chipDebounceTimerRef.current !== null) {
      window.clearTimeout(chipDebounceTimerRef.current);
    }
    const promptText = buildPromptText(
      nextRating,
      nextLiked,
      nextImprove,
      note,
      business,
    );
    void generateDraftInPlace({
      targetBiz: business,
      promptText,
      nextAttempt: 0,
      recordFeedbackEvent: true,
    });
  }

  function handleToggleLikedChip(chipId: string) {
    const nextLiked = likedIds.includes(chipId)
      ? likedIds.filter((id) => id !== chipId)
      : [...likedIds, chipId];
    setLikedIds(nextLiked);
    scheduleDebouncedGeneration(rating, nextLiked, improveIds, note);
  }

  function handleToggleImproveChip(chipId: string) {
    const nextImprove = improveIds.includes(chipId)
      ? improveIds.filter((id) => id !== chipId)
      : [...improveIds, chipId];
    setImproveIds(nextImprove);
    scheduleDebouncedGeneration(rating, likedIds, nextImprove, note);
  }

  function handleGenerateExplicit(nextAttempt = 0) {
    if (!business) return;
    if (chipDebounceTimerRef.current !== null) {
      window.clearTimeout(chipDebounceTimerRef.current);
    }
    const promptText = buildPromptText(
      rating,
      likedIds,
      improveIds,
      note,
      business,
    );
    void generateDraftInPlace({
      targetBiz: business,
      promptText,
      nextAttempt,
      recordFeedbackEvent: true,
    });
  }

  async function handleCopyAndPostToGoogle() {
    if (!business) return;
    const trimmed = review.trim();
    if (!trimmed) return;

    const copied = await copyText(trimmed);
    const hasRealGoogleUrl =
      Boolean(business.googleReviewUrl) &&
      !business.googleReviewUrlIsPlaceholder &&
      business.googleReviewUrl !== PLACEHOLDER_GOOGLE_REVIEW_URL;

    const toastMessage = copied
      ? hasRealGoogleUrl
        ? 'Copied! Opening Google...'
        : 'Copied review text to clipboard!'
      : 'Opening Google Review...';
    setCopiedToast(toastMessage);
    window.setTimeout(() => {
      setCopiedToast((prev) => (prev === toastMessage ? null : prev));
    }, 4000);

    void businessRepository.trackEvent({
      businessId: business.id,
      eventType: 'google_redirect_click',
      metadata: { slug: business.slug },
    });

    if (business.googleReviewUrl) {
      window.open(business.googleReviewUrl, '_blank', 'noopener,noreferrer');
    }
  }

  if (pageLoading) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="rounded-2xl border border-slate-200 bg-white p-12 text-center font-sans antialiased shadow-2xs"
      >
        <Loader2
          className="mx-auto h-7 w-7 animate-spin text-slate-800"
          aria-hidden
        />
        <p className="mt-3 text-sm font-medium text-slate-500">
          Loading review page…
        </p>
      </div>
    );
  }

  if (!business) {
    return (
      <div
        role="alert"
        className="rounded-2xl border border-slate-200 bg-white p-8 text-center font-sans antialiased shadow-2xs space-y-2.5"
      >
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-700">
          <SearchX className="h-6 w-6" aria-hidden />
        </div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
          Business not found
        </h1>
        <p className="mx-auto max-w-sm text-sm text-slate-500 leading-relaxed">
          We couldn&apos;t find an active review page at this link. Please check the QR code or URL and try again.
        </p>
      </div>
    );
  }

  const showLikedChips = rating !== 'not_good';
  const showImproveChips = rating === 'average' || rating === 'not_good';
  const isLoyaltyEnabled = Boolean(business.loyaltyEnabled);

  return (
    <div className="w-full space-y-4 font-sans antialiased">
      {/* HEADER CARD: Business Name, Category/City Badge & Logo/Monogram */}
      <header className="flex items-center gap-3.5 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-2xs">
        {logoDataUrl ? (
          <img
            src={logoDataUrl}
            alt={`${business.name} logo`}
            className="h-12 w-12 shrink-0 rounded-xl border border-slate-200 bg-slate-50 object-contain p-1"
          />
        ) : (
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#1E1B4B] text-sm font-bold text-[#D2DB76]">
            {business.name.slice(0, 2).toUpperCase()}
          </div>
        )}
        <div className="min-w-0 flex-1 space-y-0.5">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 truncate">
            {categoryExp.emoji} {categoryExp.label} · {business.city}
          </p>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 truncate">
            {business.name}
          </h1>
        </div>
      </header>

      {/* STEP A: Instant Experience & Highlight Selector (Top Card) */}
      <section
        aria-label="Share your experience"
        className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6 shadow-2xs space-y-5"
      >
        {/* 1-Tap Experience Rating Pills */}
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            How was your experience?
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {EXPERIENCE_PILLS.map((pill) => {
              const active = rating === pill.id;
              return (
                <button
                  key={pill.id}
                  type="button"
                  onClick={() => handleSelectRating(pill.id)}
                  aria-pressed={active}
                  className={`inline-flex h-11 items-center justify-center gap-2 rounded-xl border px-3 text-sm font-medium transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1E1B4B] ${
                    active
                      ? 'border-[#1E1B4B] bg-[#1E1B4B] text-white shadow-2xs'
                      : 'border-slate-200 bg-slate-50/70 text-slate-700 hover:border-slate-300 hover:bg-white'
                  }`}
                >
                  <span className="text-base leading-none" aria-hidden>
                    {pill.emoji}
                  </span>
                  <span>{pill.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Optional 1-Tap Tailored Highlight Chips */}
        {showLikedChips && (
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Tap highlights (optional)
            </p>
            <div className="flex flex-wrap gap-2">
              {categoryExp.liked.map((chip) => {
                const active = likedIds.includes(chip.id);
                return (
                  <button
                    key={chip.id}
                    type="button"
                    onClick={() => handleToggleLikedChip(chip.id)}
                    aria-pressed={active}
                    className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-medium transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1E1B4B] ${
                      active
                        ? 'border-[#1E1B4B] bg-[#EEF2FF] text-[#1E1B4B]'
                        : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <span className="leading-none" aria-hidden>
                      {chip.emoji}
                    </span>
                    <span>{chip.label}</span>
                    {active && (
                      <Check
                        className="h-3.5 w-3.5 shrink-0 text-[#1E1B4B]"
                        aria-hidden
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {showImproveChips && (
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              What could be better? (optional)
            </p>
            <div className="flex flex-wrap gap-2">
              {categoryExp.improve.map((chip) => {
                const active = improveIds.includes(chip.id);
                return (
                  <button
                    key={chip.id}
                    type="button"
                    onClick={() => handleToggleImproveChip(chip.id)}
                    aria-pressed={active}
                    className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-medium transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1E1B4B] ${
                      active
                        ? 'border-amber-400 bg-amber-50 text-slate-900'
                        : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <span className="leading-none" aria-hidden>
                      {chip.emoji}
                    </span>
                    <span>{chip.label}</span>
                    {active && (
                      <Check
                        className="h-3.5 w-3.5 shrink-0 text-amber-700"
                        aria-hidden
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Optional Short Custom Note + Explicit Generate AI Review Trigger */}
        <div className="space-y-2.5">
          <label
            htmlFor="customer-short-note"
            className="block text-xs font-semibold uppercase tracking-wider text-slate-500"
          >
            Add a quick detail (optional)
          </label>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              id="customer-short-note"
              type="text"
              maxLength={240}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleGenerateExplicit(0);
                }
              }}
              placeholder="Anything specific you loved? (optional)"
              className="h-11 flex-1 rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 font-sans text-sm font-normal text-slate-800 placeholder:text-slate-400 focus:border-[#1E1B4B] focus:bg-white focus:outline-none"
            />
            <button
              type="button"
              disabled={loading}
              onClick={() => handleGenerateExplicit(attempt + 1)}
              className="inline-flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold tracking-normal text-[#1E1B4B] hover:bg-slate-50 disabled:opacity-60 cursor-pointer"
            >
              <Sparkles className="h-4 w-4 text-[#1E1B4B]" aria-hidden />
              <span>Generate AI Review ✨</span>
            </button>
          </div>
        </div>
      </section>

      {/* STEP B: Immediate In-Place AI Review Generation & Direct Google Post (Same Screen!) */}
      <section
        aria-label="Your AI Review Draft"
        className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6 shadow-2xs space-y-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Your AI Review Draft
            </p>
            {loading ? (
              <span
                role="status"
                aria-live="polite"
                className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-[#1E1B4B]"
              >
                <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                <span>
                  {slowResponse ? 'Polishing your draft…' : 'Writing…'}
                </span>
              </span>
            ) : review.trim() ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                <CheckCircle2 className="h-3 w-3" aria-hidden />
                <span>Editable</span>
              </span>
            ) : null}
          </div>

          <button
            type="button"
            disabled={loading}
            onClick={() => handleGenerateExplicit(attempt + 1)}
            className="inline-flex h-8.5 items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm font-semibold tracking-normal text-slate-700 hover:bg-slate-100 disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`}
              aria-hidden
            />
            <span>Regenerate ↻</span>
          </button>
        </div>

        {error && (
          <div
            role="alert"
            className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3.5 text-sm text-red-900"
          >
            <AlertCircle
              className="mt-0.5 h-4 w-4 shrink-0 text-red-600"
              aria-hidden
            />
            <span className="flex-1">{error}</span>
          </div>
        )}

        <div className="relative">
          <textarea
            aria-label="Editable Google review draft"
            rows={4}
            value={review}
            onChange={(e) => {
              setCopiedToast(null);
              setReview(e.target.value);
            }}
            placeholder={
              loading
                ? 'Crafting a natural review from your experience…'
                : 'Tap an experience pill above or write your review here…'
            }
            className="w-full rounded-xl border border-slate-200 bg-slate-50/50 p-3.5 font-sans antialiased text-[15px] leading-relaxed font-normal text-slate-800 placeholder:text-slate-400 focus:border-[#1E1B4B] focus:bg-white focus:outline-none resize-y"
          />
        </div>

        {copiedToast && (
          <div
            role="status"
            aria-live="polite"
            className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-sm font-medium text-emerald-900"
          >
            <CheckCircle2
              className="h-4 w-4 shrink-0 text-emerald-700"
              aria-hidden
            />
            <span>{copiedToast}</span>
          </div>
        )}

        <button
          type="button"
          disabled={loading || !review.trim()}
          onClick={() => void handleCopyAndPostToGoogle()}
          className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#1E1B4B] px-5 text-sm font-semibold tracking-normal text-white shadow-xs hover:bg-[#2E2A6E] disabled:opacity-50 transition-colors cursor-pointer"
        >
          <span>Copy &amp; Post to Google Review</span>
          <ArrowRight className="h-4 w-4 text-[#D2DB76]" aria-hidden />
          <ExternalLink className="h-3.5 w-3.5 opacity-75" aria-hidden />
        </button>
      </section>

      {/* CONDITIONAL LOYALTY INTEGRATION (STRICTLY CONTROLLED BY business.loyaltyEnabled) */}
      {isLoyaltyEnabled && (
        <Link
          to={`/r/${business.slug}/loyalty`}
          className="flex items-center justify-between gap-3 rounded-2xl border border-[#2D323B] bg-[#0F1115] p-4 sm:p-5 text-[#F8F9FA] shadow-xs hover:border-[#C8F135] transition-colors group"
        >
          <div className="flex items-center gap-3.5 min-w-0">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#C8F135] text-[#0F1115]">
              <Star className="h-5 w-5 fill-current" aria-hidden />
            </span>
            <div className="min-w-0 space-y-0.5">
              <p className="text-sm font-semibold tracking-normal text-[#F8F9FA] truncate">
                ✨ Claim +1 Loyalty Star for Your Review
              </p>
              <p className="text-xs text-[#A0A6B1] truncate">
                Open your digital star card at {business.name} &amp; unlock rewards
              </p>
            </div>
          </div>
          <span className="inline-flex h-9 shrink-0 items-center gap-1 rounded-xl bg-[#20242C] border border-[#2D323B] px-3 text-xs font-semibold text-[#C8F135] group-hover:border-[#C8F135]">
            Open Card <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          </span>
        </Link>
      )}
    </div>
  );
}
