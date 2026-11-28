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
import { aiProvider } from '../services/ai';
import {
  composeExperienceText,
  getCategoryExperience,
} from '../config/reviewExperience';
import {
  buildNaturalHumanReview,
  formatDisplayBusinessName,
  hasRoboticReviewCliche,
} from '../lib/naturalReviewCopy';
import { loadBusinessQRSettings } from '../services/qr/qrGenerator';
import { classifyEstimatedSentiment } from '../utils/sentimentClassifier';
import { copyText } from '../utils/clipboard';

const TYPEWRITER_TICK_MS = 18;
const TYPEWRITER_CHARS_PER_TICK = 3;
const REQUEST_TIMEOUT_MS = 16000;

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

function buildSelectionSignature(
  rating: ExperienceRating,
  likedIds: string[],
  improveIds: string[],
  note: string,
): string {
  return JSON.stringify({
    rating,
    liked: [...likedIds].sort(),
    improve: [...improveIds].sort(),
    note: note.trim(),
  });
}

export default function CustomerReviewPage() {
  const { businessSlug } = useParams();
  const [searchParams] = useSearchParams();

  const [business, setBusiness] = useState<Business | null>(null);
  const [pageLoading, setPageLoading] = useState(true);

  // Phase 1: Customer selects rating, highlights & optional note first
  const [rating, setRating] = useState<ExperienceRating>('excellent');
  const [likedIds, setLikedIds] = useState<string[]>([]);
  const [improveIds, setImproveIds] = useState<string[]>([]);
  const [note, setNote] = useState('');

  // Phase 2: Intentional AI Draft Generation + Left-to-Right Streaming Reveal
  const [hasGeneratedDraft, setHasGeneratedDraft] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [displayedDraft, setDisplayedDraft] = useState('');
  const [review, setReview] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [generatedSignature, setGeneratedSignature] = useState<string | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [copiedToast, setCopiedToast] = useState<string | null>(null);

  const trackedScanRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const streamTimerRef = useRef<number | null>(null);
  const draftSectionRef = useRef<HTMLElement | null>(null);

  const clearStreamTimer = useCallback(() => {
    if (streamTimerRef.current !== null) {
      window.clearInterval(streamTimerRef.current);
      streamTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
      clearStreamTimer();
    };
  }, [clearStreamTimer]);

  const categoryExp = useMemo(
    () => getCategoryExperience(business?.category),
    [business?.category],
  );

  const displayName = useMemo(
    () => (business ? formatDisplayBusinessName(business.name) : ''),
    [business],
  );

  const logoDataUrl = useMemo(() => {
    if (!business) return null;
    try {
      return loadBusinessQRSettings(business).logoDataUrl;
    } catch {
      return null;
    }
  }, [business]);

  const currentSignature = useMemo(
    () => buildSelectionSignature(rating, likedIds, improveIds, note),
    [rating, likedIds, improveIds, note],
  );

  const selectionsChangedAfterDraft =
    hasGeneratedDraft &&
    !isStreaming &&
    generatedSignature !== null &&
    currentSignature !== generatedSignature;

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
    }

    void init();
    return () => {
      active = false;
    };
  }, [businessSlug, searchParams]);

  const startLeftToRightTypewriter = useCallback(
    (fullText: string, onComplete?: () => void) => {
      clearStreamTimer();
      setDisplayedDraft('');
      setIsStreaming(true);

      let cursor = 0;
      streamTimerRef.current = window.setInterval(() => {
        cursor = Math.min(fullText.length, cursor + TYPEWRITER_CHARS_PER_TICK);
        setDisplayedDraft(fullText.slice(0, cursor));

        if (cursor >= fullText.length) {
          clearStreamTimer();
          setReview(fullText);
          setIsStreaming(false);
          onComplete?.();
        }
      }, TYPEWRITER_TICK_MS);
    },
    [clearStreamTimer],
  );

  const handleGenerateReview = useCallback(
    async (isRegenerate = false) => {
      if (!business) return;

      const nextAttempt = isRegenerate ? attempt + 1 : hasGeneratedDraft ? attempt + 1 : 0;
      const signatureAtTrigger = buildSelectionSignature(
        rating,
        likedIds,
        improveIds,
        note,
      );

      abortControllerRef.current?.abort();
      clearStreamTimer();
      const controller = new AbortController();
      abortControllerRef.current = controller;

      setHasGeneratedDraft(true);
      setIsStreaming(true);
      setDisplayedDraft('');
      setError(null);
      setCopiedToast(null);
      setGeneratedSignature(signatureAtTrigger);

      window.requestAnimationFrame(() => {
        draftSectionRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
        });
      });

      const cat = getCategoryExperience(business.category);
      const liked = cat.liked.filter((o) => likedIds.includes(o.id));
      const improve = cat.improve.filter((o) => improveIds.includes(o.id));
      const composedPrompt =
        composeExperienceText({
          rating,
          liked,
          improve,
          note,
        }).trim() ||
        `Visited ${formatDisplayBusinessName(business.name)} in ${business.city}.`;

      const naturalCandidate = buildNaturalHumanReview({
        business,
        rating,
        liked,
        improve,
        note,
        attempt: nextAttempt,
        previousText: review,
      });

      void businessRepository.trackEvent({
        businessId: business.id,
        eventType: 'feedback_submitted',
        metadata: { mode: 'text', length: composedPrompt.length },
      });

      const timeoutTimer = window.setTimeout(() => {
        controller.abort('timeout');
      }, REQUEST_TIMEOUT_MS);

      try {
        let finalText = naturalCandidate;
        let generationSource = 'natural_template';

        try {
          const draft = await aiProvider.generateReviewDraft({
            business: {
              ...business,
              name: formatDisplayBusinessName(business.name),
            },
            experience: composedPrompt,
            attempt: nextAttempt,
            mode: 'text',
            signal: controller.signal,
          });

          if (controller.signal.aborted) return;

          const candidateAiText = draft.text.trim();
          if (
            draft.generationSource === 'ai_live' &&
            candidateAiText.length >= 20 &&
            !hasRoboticReviewCliche(candidateAiText) &&
            candidateAiText !== review.trim()
          ) {
            finalText = candidateAiText;
            generationSource = 'ai_live';
          }
        } catch {
          if (controller.signal.aborted && controller.signal.reason !== 'timeout') {
            return;
          }
          // Graceful fallback to natural human copy so rate limits or offline edge states never block the guest
          finalText = naturalCandidate;
        }

        if (controller.signal.aborted && controller.signal.reason !== 'timeout') {
          return;
        }

        setAttempt(nextAttempt);

        startLeftToRightTypewriter(finalText, () => {
          void businessRepository.trackEvent({
            businessId: business.id,
            eventType: 'ai_generation',
            metadata: {
              attempt: nextAttempt,
              streamed: true,
              source: generationSource,
            },
          });

          const sentiment = classifyEstimatedSentiment(composedPrompt);
          void businessRepository.recordDraft({
            businessId: business.id,
            originalInput: composedPrompt,
            generatedReview: finalText,
            mode: 'text',
            sentiment,
          });
        });
      } catch (err) {
        setIsStreaming(false);
        setError(
          (err as Error)?.message ||
            "We couldn't prepare your review right now. Please tap Regenerate.",
        );
      } finally {
        window.clearTimeout(timeoutTimer);
      }
    },
    [
      attempt,
      business,
      clearStreamTimer,
      hasGeneratedDraft,
      improveIds,
      likedIds,
      note,
      rating,
      review,
      startLeftToRightTypewriter,
    ],
  );

  function handleSelectRating(nextRating: ExperienceRating) {
    setRating(nextRating);
    if (nextRating === 'not_good') {
      setLikedIds([]);
    }
    if (nextRating === 'excellent' || nextRating === 'good') {
      setImproveIds([]);
    }
  }

  function handleToggleLikedChip(chipId: string) {
    setLikedIds((prev) =>
      prev.includes(chipId)
        ? prev.filter((id) => id !== chipId)
        : [...prev, chipId],
    );
  }

  function handleToggleImproveChip(chipId: string) {
    setImproveIds((prev) =>
      prev.includes(chipId)
        ? prev.filter((id) => id !== chipId)
        : [...prev, chipId],
    );
  }

  async function handleCopyAndPostToGoogle() {
    if (!business || isStreaming) return;
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
      {/* HEADER CARD: Smart Title-Cased Business Name, Category/City Badge & Logo/Monogram */}
      <header className="flex items-center gap-3.5 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-2xs">
        {logoDataUrl ? (
          <img
            src={logoDataUrl}
            alt={`${displayName} logo`}
            className="h-12 w-12 shrink-0 rounded-xl border border-slate-200 bg-slate-50 object-contain p-1"
          />
        ) : (
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#0F1115] text-sm font-bold text-[#D2DB76]">
            {displayName.slice(0, 2).toUpperCase()}
          </div>
        )}
        <div className="min-w-0 flex-1 space-y-0.5">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 truncate">
            {categoryExp.emoji} {categoryExp.label} · {business.city}
          </p>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 truncate">
            {displayName}
          </h1>
        </div>
      </header>

      {/* PHASE 1: Select Rating, Highlights & Optional Detail -> Tap Generate AI Review */}
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
                  className={`inline-flex h-11 items-center justify-center gap-2 rounded-xl border px-3 text-sm font-medium transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0F1115] ${
                    active
                      ? 'border-[#0F1115] bg-[#0F1115] text-white shadow-2xs'
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
                    className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-medium transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0F1115] ${
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
                    className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-medium transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0F1115] ${
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

        {/* Full-Width Optional Custom Detail Input + Full-Width Primary Generate CTA */}
        <div className="space-y-3">
          <div className="space-y-1.5">
            <label
              htmlFor="customer-short-note"
              className="block text-xs font-semibold uppercase tracking-wider text-slate-500"
            >
              Add a quick detail (optional)
            </label>
            <input
              id="customer-short-note"
              type="text"
              maxLength={240}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !isStreaming) {
                  e.preventDefault();
                  void handleGenerateReview(false);
                }
              }}
              placeholder="Anything specific you loved? (optional)"
              className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 font-sans text-sm font-normal text-slate-800 placeholder:text-slate-400 focus:border-[#0F1115] focus:bg-white focus:outline-none"
            />
          </div>

          <button
            type="button"
            disabled={isStreaming}
            onClick={() => void handleGenerateReview(false)}
            className="inline-flex w-full items-center justify-center gap-2 py-3.5 px-5 rounded-xl bg-[#0F1115] text-sm font-semibold tracking-normal text-white shadow-sm hover:bg-[#1C2029] active:scale-[0.99] disabled:opacity-60 transition-all cursor-pointer"
          >
            <Sparkles className="h-4 w-4 text-[#D2DB76]" aria-hidden />
            <span>
              {isStreaming ? 'Writing your review…' : 'Generate AI Review ✨'}
            </span>
          </button>
        </div>
      </section>

      {/* PHASE 2: Revealed Only After Tapping Generate AI Review ✨ */}
      {hasGeneratedDraft && (
        <section
          ref={draftSectionRef}
          aria-label="Your AI Review Draft"
          className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6 shadow-2xs space-y-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Your AI Review Draft
              </p>
              {isStreaming ? (
                <span
                  role="status"
                  aria-live="polite"
                  className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-[#1E1B4B]"
                >
                  <Sparkles className="h-3 w-3 animate-pulse" aria-hidden />
                  <span>✨ Writing your review...</span>
                </span>
              ) : review.trim() ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                  <CheckCircle2 className="h-3 w-3" aria-hidden />
                  <span>✓ Editable</span>
                </span>
              ) : null}
            </div>

            <button
              type="button"
              disabled={isStreaming}
              onClick={() => void handleGenerateReview(true)}
              className="inline-flex h-8.5 items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm font-semibold tracking-normal text-slate-700 hover:bg-slate-100 disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${isStreaming ? 'animate-spin' : ''}`}
                aria-hidden
              />
              <span>Regenerate ↻</span>
            </button>
          </div>

          {selectionsChangedAfterDraft && (
            <div
              role="status"
              className="flex items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50/80 px-3.5 py-2 text-xs font-medium text-amber-900"
            >
              <span>Selections changed — tap Regenerate ↻ to update</span>
              <button
                type="button"
                onClick={() => void handleGenerateReview(true)}
                className="shrink-0 font-semibold text-amber-950 underline hover:no-underline cursor-pointer"
              >
                Regenerate ↻
              </button>
            </div>
          )}

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
            {isStreaming ? (
              <div
                aria-live="polite"
                aria-label="Streaming AI review draft"
                className="min-h-[118px] w-full rounded-xl border border-slate-200 bg-slate-50/50 p-3.5 font-sans antialiased text-[15px] leading-relaxed font-normal text-slate-800 whitespace-pre-wrap"
              >
                <span>{displayedDraft}</span>
                <span
                  aria-hidden
                  className="ml-0.5 inline-block h-[1.05em] w-[2px] translate-y-[2px] bg-[#0F1115] animate-pulse"
                />
              </div>
            ) : (
              <textarea
                aria-label="Editable Google review draft"
                rows={4}
                value={review}
                onChange={(e) => {
                  setCopiedToast(null);
                  setReview(e.target.value);
                }}
                placeholder="Edit your review before posting to Google…"
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 p-3.5 font-sans antialiased text-[15px] leading-relaxed font-normal text-slate-800 placeholder:text-slate-400 focus:border-[#0F1115] focus:bg-white focus:outline-none resize-y"
              />
            )}
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
            disabled={isStreaming || !review.trim()}
            onClick={() => void handleCopyAndPostToGoogle()}
            className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#1E1B4B] px-5 text-sm font-semibold tracking-normal text-white shadow-xs hover:bg-[#2E2A6E] disabled:opacity-50 transition-colors cursor-pointer"
          >
            <span>Copy &amp; Post to Google Review →</span>
            <ExternalLink className="h-3.5 w-3.5 opacity-75" aria-hidden />
          </button>
        </section>
      )}

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
                Open your digital star card at {displayName} &amp; unlock rewards
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
