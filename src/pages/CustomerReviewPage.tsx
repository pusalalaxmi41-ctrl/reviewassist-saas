import { useState, useEffect, useRef } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { SearchX, Loader2 } from 'lucide-react';
import type { Business, ExperienceInputMode, ReviewFlowStep, ReviewSentiment } from '../types/business';
import { businessRepository } from '../services/storage';
import { aiProvider } from '../services/ai';
import { ProgressSteps } from '../components/review/ProgressSteps';
import { WelcomeStep } from '../components/review/WelcomeStep';
import { ExperienceStep } from '../components/review/ExperienceStep';
import { ReviewPreviewStep } from '../components/review/ReviewPreviewStep';
import { GoogleRedirectStep } from '../components/review/GoogleRedirectStep';

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
  const [error, setError] = useState<string | null>(null);

  const trackedScanRef = useRef(false);

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
      <div className="py-20 text-center">
        <Loader2 className="mx-auto h-8 w-8 animate-spin text-indigo-600" />
        <p className="mt-3 text-sm text-slate-500">Loading experience...</p>
      </div>
    );
  }

  if (!business) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
        <SearchX className="mx-auto h-10 w-10 text-slate-400" aria-hidden />
        <h1 className="mt-3 text-lg font-semibold">Business not found</h1>
        <p className="mt-1 text-sm text-slate-600">Please check the link or QR code and try again.</p>
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

  async function generate(text: string, nextAttempt: number, targetBiz: Business) {
    setLoading(true);
    setError(null);
    try {
      // Always generated from the customer's original experience text.
      const draft = await aiProvider.generateReviewDraft({
        business: targetBiz,
        experience: text,
        attempt: nextAttempt,
        mode,
      });

      setReview(draft.text);
      setAttempt(nextAttempt);

      // Track AI generation event
      void businessRepository.trackEvent({
        businessId: targetBiz.id,
        eventType: 'ai_generation',
        metadata: { attempt: nextAttempt },
      });

      // Record customer draft record
      const lower = text.toLowerCase();
      const hasCriticism = ['slow', 'wait', 'cold', 'bad', 'noisy', 'expensive', 'delay', 'issue', 'not working'].some(
        (w) => lower.includes(w),
      );
      const sentiment: ReviewSentiment = hasCriticism ? 'mixed' : 'positive';

      void businessRepository.recordDraft({
        businessId: targetBiz.id,
        originalInput: text,
        generatedReview: draft.text,
        mode,
        sentiment,
      });
    } catch {
      setError("We couldn't prepare your review right now. Please try again.");
    } finally {
      setLoading(false);
    }
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
    <div className="space-y-6">
      <ProgressSteps current={step} />
      <div key={step} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm motion-safe:animate-fade-in sm:p-8">
        {step === 'welcome' && (
          <WelcomeStep business={business} onSelect={(m) => { setMode(m); setStep('experience'); }} />
        )}
        {step === 'experience' && (
          <ExperienceStep
            key={mode}
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
            review={review}
            loading={loading}
            error={error}
            onChange={setReview}
            onRegenerate={() => void generate(experience, attempt + 1, business)}
            onBack={() => setStep('experience')}
            onContinue={() => setStep('google')}
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
