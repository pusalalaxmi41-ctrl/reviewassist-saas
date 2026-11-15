import { useState, useEffect, useRef } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { SearchX, Loader2 } from 'lucide-react';
import type {
  Business,
  ExperienceInputMode,
  ReviewFlowStep,
} from '../types/business';
import { businessRepository } from '../services/storage';
import { aiProvider, AIProviderError } from '../services/ai';
import { classifyEstimatedSentiment } from '../utils/sentimentClassifier';
import { ProgressSteps } from '../components/review/ProgressSteps';
import { WelcomeStep } from '../components/review/WelcomeStep';
import { ExperienceStep } from '../components/review/ExperienceStep';
import { ReviewPreviewStep } from '../components/review/ReviewPreviewStep';
import { GoogleRedirectStep } from '../components/review/GoogleRedirectStep';

const SLOW_RESPONSE_THRESHOLD_MS = 3500;
const REQUEST_TIMEOUT_MS = 22000;

export default function CustomerReviewPage() {
  const { businessSlug } = useParams();
  const [searchParams] = useSearchParams();

  const [business, setBusiness] = useState<Business | null>(null);
  const [pageLoading, setPageLoading] = useState(true);

  const [step, setStep] = useState<ReviewFlowStep>('welcome');
  const [mode, setMode] = useState<ExperienceInputMode>('text');
  const [experience, setExperience] = useState('');
  const [review, setReview] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [loading, setLoading] = useState(false);
  const [slowResponse, setSlowResponse] = useState(false);
  const [isStreamingLive, setIsStreamingLive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trackedScanRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Clean up any in-flight generation if the customer navigates away or refreshes
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  // Load business by slug and track QR scan / visit
  useEffect(() => {
    async function init() {
      if (!businessSlug) {
        setPageLoading(false);
        return;
      }
      setPageLoading(true);
      const found = await businessRepository.getBusinessBySlug(businessSlug);
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
  }, [businessSlug, searchParams]);

  if (pageLoading) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="rounded-2xl border border-[#DDE4DC] bg-[#FFFFFF] p-12 text-center shadow-2xs"
      >
        <Loader2 className="mx-auto h-7 w-7 animate-spin text-[#244B40]" aria-hidden />
        <p className="mt-3 text-[15px] font-medium text-[#626B65]">
          Loading review portal…
        </p>
      </div>
    );
  }

  if (!business) {
    return (
      <div
        role="alert"
        className="rounded-2xl border border-[#DDE4DC] bg-[#FFFFFF] p-8 text-center shadow-2xs space-y-2.5"
      >
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#EEF3EC] text-[#244B40]">
          <SearchX className="h-6 w-6" aria-hidden />
        </div>
        <h1 className="text-[24px] font-semibold tracking-tight text-[#252B29]">
          Business not found
        </h1>
        <p className="mx-auto max-w-sm text-[15px] text-[#626B65] leading-relaxed">
          We couldn&apos;t find an active review page at this link. Please check the QR code or URL and try again.
        </p>
      </div>
    );
  }

  async function handleExperienceSubmit(text: string) {
    if (!business) return;
    setExperience(text);
    setReview('');
    setStep('review');

    // Track feedback submission event
    void businessRepository.trackEvent({
      businessId: business.id,
      eventType: 'feedback_submitted',
      metadata: { mode, length: text.length },
    });

    await generate(text, 0, business);
  }

  async function generate(
    text: string,
    nextAttempt: number,
    targetBiz: Business,
  ) {
    // Cancel any previous in-flight request
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setLoading(true);
    setSlowResponse(false);
    setIsStreamingLive(false);
    setError(null);
    setReview('');

    const slowTimer = window.setTimeout(() => {
      setSlowResponse(true);
    }, SLOW_RESPONSE_THRESHOLD_MS);

    const timeoutTimer = window.setTimeout(() => {
      controller.abort('timeout');
    }, REQUEST_TIMEOUT_MS);

    try {
      const draft = await aiProvider.generateReviewDraft({
        business: targetBiz,
        experience: text,
        attempt: nextAttempt,
        mode,
        signal: controller.signal,
        onToken: (_delta, accumulated) => {
          setIsStreamingLive(true);
          setReview(accumulated);
        },
      });

      if (controller.signal.aborted) return;

      const finalText = draft.text.trim();
      if (!finalText) {
        setError(
          'We received an empty draft. Please tap Retry generation to try again.',
        );
        return;
      }

      setIsStreamingLive(Boolean(draft.streamed));
      setReview(finalText);
      setAttempt(nextAttempt);

      // Track AI generation event
      void businessRepository.trackEvent({
        businessId: targetBiz.id,
        eventType: 'ai_generation',
        metadata: {
          attempt: nextAttempt,
          streamed: Boolean(draft.streamed),
          source: draft.generationSource ?? 'unknown',
        },
      });

      // Record customer draft record with 4-way estimated sentiment
      const sentiment = classifyEstimatedSentiment(text);

      void businessRepository.recordDraft({
        businessId: targetBiz.id,
        originalInput: text,
        generatedReview: finalText,
        mode,
        sentiment,
      });
    } catch (err) {
      if (controller.signal.aborted) {
        if (controller.signal.reason === 'timeout') {
          setError(
            'Generating your review took longer than expected. Please tap Retry generation.',
          );
        }
        return;
      }

      if (err instanceof AIProviderError) {
        setError(err.message);
      } else {
        setError(
          (err as Error)?.message ||
            "We couldn't prepare your review right now. Please try again.",
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
  }

  function handleBackToExperience() {
    abortControllerRef.current?.abort();
    setLoading(false);
    setSlowResponse(false);
    setError(null);
    setStep('experience');
  }

  function handleGoogleRedirect() {
    if (!business) return;
    void businessRepository.trackEvent({
      businessId: business.id,
      eventType: 'google_redirect_click',
      metadata: { slug: business.slug },
    });
  }

  return (
    <div className="space-y-5">
      <ProgressSteps current={step} />
      <div
        key={step}
        className="rounded-2xl border border-[#DDE4DC] bg-[#FFFFFF] p-5 shadow-xs motion-safe:animate-fade-in sm:p-8"
      >
        {step === 'welcome' && (
          <WelcomeStep
            business={business}
            onSelect={(m) => {
              setMode(m);
              setStep('experience');
            }}
          />
        )}
        {step === 'experience' && (
          <ExperienceStep
            businessName={business.name}
            category={business.category}
            mode={mode}
            initialText={experience}
            onModeChange={setMode}
            onBack={() => setStep('welcome')}
            onSubmit={(text) => void handleExperienceSubmit(text)}
          />
        )}
        {step === 'review' && (
          <ReviewPreviewStep
            key={`draft-${attempt}-${loading ? 'loading' : 'ready'}`}
            business={business}
            review={review}
            loading={loading}
            slowResponse={slowResponse}
            isStreamingLive={isStreamingLive}
            error={error}
            onChange={setReview}
            onRegenerate={() => void generate(experience, attempt + 1, business)}
            onBack={handleBackToExperience}
            onGoogleRedirect={handleGoogleRedirect}
          />
        )}
        {step === 'google' && (
          <GoogleRedirectStep
            business={business}
            review={review.trim()}
            onBack={() => setStep('review')}
            onRedirect={handleGoogleRedirect}
          />
        )}
      </div>
    </div>
  );
}
