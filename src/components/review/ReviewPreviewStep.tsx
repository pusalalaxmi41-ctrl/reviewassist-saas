import { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  Check,
  CheckCircle2,
  ClipboardCopy,
  ExternalLink,
  Pencil,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import type { Business } from '../../types/business';
import { getReviewFont } from '../../config/reviewExperience';
import { copyText } from '../../utils/clipboard';
import { Button } from '../common/Button';
import { Alert } from '../common/Alert';
import { cn } from '../../utils/cn';

interface Props {
  business: Business;
  review: string;
  /** True while the AI provider network request is in flight. */
  loading: boolean;
  /** True when the network call is taking longer than 3.5 seconds. */
  slowResponse?: boolean;
  /** True when live SSE token chunks are actively arriving from the backend. */
  isStreamingLive?: boolean;
  error: string | null;
  onChange: (text: string) => void;
  onRegenerate: () => void;
  onBack: () => void;
  onGoogleRedirect: () => void;
  onContinueToThanks?: () => void;
}

type CopyStatus = 'idle' | 'copying' | 'copied' | 'failed';

export function ReviewPreviewStep({
  business,
  review,
  loading,
  slowResponse = false,
  isStreamingLive = false,
  error,
  onChange,
  onRegenerate,
  onBack,
  onGoogleRedirect,
  onContinueToThanks,
}: Props) {
  const activeFont = getReviewFont(business.reviewFont);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Controlled character-by-character reveal state when the backend response arrives all at once
  const [revealedLength, setRevealedLength] = useState(0);
  const [revealSkipped, setRevealSkipped] = useState(prefersReducedMotion);

  // Inline editing & copy state
  const [isEditing, setIsEditing] = useState(false);
  const [hasUserEdited, setHasUserEdited] = useState(false);
  const [copyStatus, setCopyStatus] = useState<CopyStatus>('idle');
  const [googleOpened, setGoogleOpened] = useState(false);

  const shouldUseTypewriter =
    !prefersReducedMotion &&
    !loading &&
    Boolean(review) &&
    !isStreamingLive &&
    !hasUserEdited &&
    !isEditing &&
    !revealSkipped;

  const isTypewriterActive =
    shouldUseTypewriter && revealedLength < review.length;

  useEffect(() => {
    if (!shouldUseTypewriter || !review || revealedLength >= review.length) {
      return;
    }

    // Character-by-character reveal (1–2 chars per 18ms tick for smooth natural AI typing)
    const stepSize = review.length > 260 ? 2 : 1;
    const timer = window.setInterval(() => {
      setRevealedLength((prev) => {
        const next = prev + stepSize;
        if (next >= review.length) {
          window.clearInterval(timer);
          return review.length;
        }
        return next;
      });
    }, 18);

    return () => window.clearInterval(timer);
  }, [shouldUseTypewriter, review, revealedLength]);

  function handleSkipReveal() {
    setRevealSkipped(true);
    setRevealedLength(review.length);
  }

  function handleStartEditing() {
    if (isTypewriterActive) {
      handleSkipReveal();
    }
    setIsEditing(true);
    setTimeout(() => {
      const el = textareaRef.current;
      if (el) {
        el.focus();
        el.setSelectionRange(el.value.length, el.value.length);
      }
    }, 20);
  }

  function handleTextChange(nextText: string) {
    setHasUserEdited(true);
    setCopyStatus('idle');
    onChange(nextText);
  }

  async function handleCopyReview(): Promise<boolean> {
    const currentText = review.trim();
    if (!currentText) return false;

    setCopyStatus('copying');
    const ok = await copyText(currentText);
    setCopyStatus(ok ? 'copied' : 'failed');
    return ok;
  }

  async function handleOpenGoogleReview() {
    const currentText = review.trim();
    if (currentText && copyStatus !== 'copied') {
      await handleCopyReview();
    }
    if (onContinueToThanks) {
      onContinueToThanks();
      return;
    }
    onGoogleRedirect();
    window.open(business.googleReviewUrl, '_blank', 'noopener,noreferrer');
    setGoogleOpened(true);
  }

  const isGeneratingOrRevealing = loading || isTypewriterActive;
  const displayedText = isTypewriterActive
    ? review.slice(0, revealedLength)
    : review;
  const isEmpty = !review.trim() && !loading;

  return (
    <div className="space-y-6">
      {/* 1. Dynamic Status Header ("Creating your review" -> "Your review is ready") */}
      <div className="space-y-2">
        <div
          className="flex flex-wrap items-center justify-between gap-2"
          role="status"
          aria-live="polite"
        >
          {isGeneratingOrRevealing ? (
            <span className="inline-flex items-center gap-2 rounded-full border border-[#A8BFA5] bg-[#EEF3EC] px-3 py-1 text-[13px] font-medium text-[#244B40]">
              <span className="h-2 w-2 rounded-full bg-[#244B40] motion-safe:animate-pulse" />
              {loading && !isStreamingLive
                ? 'Analyzing your feedback…'
                : 'Writing your review…'}
            </span>
          ) : error ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-red-300 bg-red-50 px-3 py-1 text-[13px] font-medium text-red-900">
              <AlertCircle className="h-3.5 w-3.5 text-red-700" aria-hidden />
              Generation paused
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[#A8BFA5] bg-[#EEF3EC] px-3 py-1 text-[13px] font-medium text-[#252B29]">
              <CheckCircle2 className="h-3.5 w-3.5 text-[#244B40]" aria-hidden />
              Review draft ready
              {hasUserEdited && (
                <span className="ml-1 rounded bg-[#FFFFFF] px-1.5 py-0.5 text-[11px] font-semibold text-[#252B29] border border-[#DDE4DC]">
                  Edited by you
                </span>
              )}
            </span>
          )}

          {isTypewriterActive && (
            <button
              type="button"
              onClick={handleSkipReveal}
              className="text-[13px] font-medium text-[#244B40] hover:underline cursor-pointer"
            >
              Show full text
            </button>
          )}
        </div>

        <h2 className="text-[20px] font-semibold tracking-tight text-[#252B29] sm:text-[24px]">
          {isGeneratingOrRevealing
            ? 'Creating your review'
            : error
              ? "Couldn't finish your review"
              : 'Review & approve your draft'}
        </h2>

        <p className="text-[14px] leading-relaxed text-[#626B65]">
          {isGeneratingOrRevealing
            ? slowResponse
              ? 'Taking a few extra seconds to craft your review — thank you for your patience…'
              : `Shaping your experience at ${business.name} into natural, readable language.`
            : 'Crafted strictly from what you shared. Edit any word below before copying it to Google.'}
        </p>
      </div>

      {/* 2. Error State with Recoverable Retry Option */}
      {error && (
        <div
          className="rounded-xl border border-red-300 bg-red-50 p-4 space-y-3"
          role="alert"
        >
          <div className="flex items-start gap-2.5 text-[14px] text-red-950">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-700" aria-hidden />
            <div className="space-y-1">
              <p className="font-medium">{error}</p>
              <p className="text-[13px] text-red-900">
                Your experience notes are still saved — you can retry immediately or go back to edit them.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            <Button
              type="button"
              variant="primary"
              onClick={onRegenerate}
              loading={loading}
            >
              <RefreshCw className="h-4 w-4" aria-hidden /> Retry generation
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={onBack}
              disabled={loading}
            >
              <ArrowLeft className="h-4 w-4" aria-hidden /> Edit experience
            </Button>
          </div>
        </div>
      )}

      {/* 3. Clean Review Preview Card (Progressive / Character-by-character Reveal + Cursor OR Editable Textarea) */}
      {!error && (
        <div
          className={cn(
            'overflow-hidden rounded-xl border transition-colors duration-150',
            isGeneratingOrRevealing
              ? 'border-[#A8BFA5] bg-[#F7F7F2]'
              : isEditing
                ? 'border-[#244B40] bg-[#FFFFFF] ring-2 ring-[#244B40]/20'
                : 'border-[#DDE4DC] bg-[#F7F7F2]',
          )}
        >
          {/* Card Top Bar */}
          <div className="flex items-center justify-between border-b border-[#DDE4DC] bg-[#FFFFFF] px-4 py-2.5 text-[13px]">
            <span className="inline-flex items-center gap-1.5 font-medium text-[#252B29]">
              <Sparkles className="h-3.5 w-3.5 text-[#244B40]" aria-hidden />
              <span>{business.name}</span>
            </span>

            {!isGeneratingOrRevealing && (
              <div className="flex items-center gap-3">
                <span className="font-mono text-[12px] text-[#626B65]">
                  {review.trim().length} chars
                </span>
                {isEditing ? (
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="inline-flex items-center gap-1 rounded-lg bg-[#244B40] px-2.5 py-1 text-[13px] font-medium text-[#FFFFFF] hover:bg-[#1C3B32] cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#244B40]"
                  >
                    <Check className="h-3.5 w-3.5" aria-hidden /> Done editing
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleStartEditing}
                    className="inline-flex items-center gap-1 rounded-lg border border-[#87928A] bg-[#FFFFFF] px-2.5 py-1 text-[13px] font-medium text-[#252B29] hover:border-[#244B40] hover:bg-[#EEF3EC] cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#244B40]"
                  >
                    <Pencil className="h-3.5 w-3.5" aria-hidden /> Edit text
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Card Body */}
          <div className="p-4 sm:p-5">
            {loading && !displayedText ? (
              <div
                className="space-y-3 py-2"
                aria-busy="true"
                aria-label="Creating your review"
              >
                <div className="flex items-center gap-2 text-[15px] text-[#252B29]">
                  <span className="font-medium text-[#252B29]">
                    Drafting your review
                  </span>
                  <span
                    className="inline-block h-4 w-0.5 motion-safe:animate-pulse rounded-full bg-[#244B40]"
                    aria-hidden
                  />
                </div>
                <div className="space-y-2 pt-1">
                  <div className="h-3 w-11/12 motion-safe:animate-pulse rounded bg-[#DDE4DC]" />
                  <div className="h-3 w-full motion-safe:animate-pulse rounded bg-[#DDE4DC]/80" />
                  <div className="h-3 w-3/4 motion-safe:animate-pulse rounded bg-[#DDE4DC]/60" />
                </div>
              </div>
            ) : isEditing ? (
              <div className="space-y-2">
                <label htmlFor="editableReviewTextarea" className="sr-only">
                  Edit your review text
                </label>
                <textarea
                  id="editableReviewTextarea"
                  ref={textareaRef}
                  rows={6}
                  value={review}
                  onChange={(e) => handleTextChange(e.target.value)}
                  placeholder="Write or adjust your review here…"
                  style={{
                    fontFamily: activeFont.fontFamily,
                    fontWeight: activeFont.fontWeight,
                    fontSize: `${activeFont.fontSize}px`,
                    lineHeight: activeFont.lineHeight,
                  }}
                  className="block w-full resize-y border-0 bg-transparent p-0 text-[#252B29] placeholder:text-[#626B65] focus:outline-none"
                />
                {isEmpty && (
                  <p className="text-[13px] font-medium text-red-700" role="alert">
                    Your review is currently empty. Add a sentence or tap Regenerate below.
                  </p>
                )}
              </div>
            ) : (
              <div
                onClick={() => {
                  if (!isGeneratingOrRevealing) handleStartEditing();
                }}
                role="region"
                aria-live="polite"
                aria-label="Generated review preview"
                style={{
                  fontFamily: activeFont.fontFamily,
                  fontWeight: activeFont.fontWeight,
                  fontSize: `${activeFont.fontSize}px`,
                  lineHeight: activeFont.lineHeight,
                }}
                className={cn(
                  'min-h-[112px] whitespace-pre-wrap text-[#252B29]',
                  !isGeneratingOrRevealing && 'cursor-text',
                )}
              >
                {displayedText}
                {isGeneratingOrRevealing && (
                  <span
                    className="ml-0.5 inline-block h-4 w-0.5 translate-y-0.5 motion-safe:animate-pulse rounded-full bg-[#244B40]"
                    aria-hidden
                  />
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 4. Secondary Actions: Edit & Regenerate */}
      {!error && (
        <div className="grid grid-cols-2 gap-3">
          <Button
            type="button"
            variant="secondary"
            disabled={isGeneratingOrRevealing}
            onClick={() =>
              isEditing ? setIsEditing(false) : handleStartEditing()
            }
          >
            <Pencil className="h-4 w-4" aria-hidden />
            {isEditing ? 'Done editing' : 'Edit review'}
          </Button>

          <Button
            type="button"
            variant="secondary"
            loading={loading}
            disabled={isGeneratingOrRevealing}
            onClick={onRegenerate}
          >
            {!loading && <RefreshCw className="h-4 w-4" aria-hidden />}
            Regenerate
          </Button>
        </div>
      )}

      {/* 5. Copy Feedback & Manual Copy Fallback */}
      {copyStatus === 'copied' && (
        <Alert tone="success">
          <p className="font-medium">
            Review copied to your clipboard!
          </p>
          <p className="mt-0.5 text-[13px]">
            {googleOpened
              ? `Paste your review on the ${business.name} Google tab, choose your star rating, and tap Post.`
              : `Next, tap "Open Google Review Page" below to paste and submit it on Google.`}
          </p>
        </Alert>
      )}

      {copyStatus === 'failed' && (
        <div className="space-y-2">
          <Alert tone="warning">
            <p className="font-medium">
              Automatic clipboard access was blocked by your browser.
            </p>
            <p className="mt-0.5 text-[13px]">
              Long-press or select the text box below to copy your review manually, then open Google.
            </p>
          </Alert>
          <textarea
            readOnly
            aria-label="Select and copy your review manually"
            value={review}
            rows={4}
            onFocus={(e) => e.currentTarget.select()}
            className="block w-full rounded-xl border border-[#87928A] bg-[#F7F7F2] p-3 font-sans text-[15px] text-[#252B29]"
          />
        </div>
      )}

      {business.googleReviewUrlIsPlaceholder && !isGeneratingOrRevealing && !error && (
        <Alert tone="info">
          <p className="text-[13px]">
            <strong>Preview mode:</strong> {business.name} is currently using a preview destination link while their official Google Business shortlink is being connected.
          </p>
        </Alert>
      )}

      {/* 6. Primary Approval Actions: Copy Review & Open Google Review Page */}
      {!error && (
        <div className="space-y-3 border-t border-[#DDE4DC] pt-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Button
              type="button"
              variant={copyStatus === 'copied' ? 'secondary' : 'primary'}
              disabled={isGeneratingOrRevealing || isEmpty}
              loading={copyStatus === 'copying'}
              onClick={() => void handleCopyReview()}
              className="w-full"
            >
              {copyStatus === 'copied' ? (
                <>
                  <Check className="h-4 w-4 text-[#244B40]" aria-hidden />
                  Copied to Clipboard
                </>
              ) : (
                <>
                  <ClipboardCopy className="h-4 w-4" aria-hidden />
                  Copy Review
                </>
              )}
            </Button>

            <Button
              type="button"
              variant="primary"
              disabled={isGeneratingOrRevealing || isEmpty}
              onClick={() => void handleOpenGoogleReview()}
              className="w-full"
            >
              Open Google Review Page
              <ExternalLink className="h-4 w-4" aria-hidden />
            </Button>
          </div>

          <p className="text-center text-[13px] leading-relaxed text-[#626B65]">
            Your review is <strong>not</strong> published automatically. After opening Google, paste your copied text, select your star rating, and tap <strong>Post</strong>.
          </p>

          <div className="flex justify-start pt-1">
            <Button
              type="button"
              variant="ghost"
              disabled={loading}
              onClick={onBack}
            >
              <ArrowLeft className="h-4 w-4" aria-hidden /> Back to your experience notes
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
