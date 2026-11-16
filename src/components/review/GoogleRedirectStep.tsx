import { useState } from 'react';
import { ArrowLeft, ArrowRight, Check, ClipboardCopy, Sparkles } from 'lucide-react';
import type { Business } from '../../types/business';
import { getCategoryExperience } from '../../config/reviewExperience';
import { copyText } from '../../utils/clipboard';
import { Button } from '../common/Button';
import { Alert } from '../common/Alert';

interface Props {
  business: Business;
  review: string;
  onBack: () => void;
  onRedirect?: () => void;
}

type CopyState = 'idle' | 'copying' | 'copied' | 'failed';

export function GoogleRedirectStep({ business, review, onBack, onRedirect }: Props) {
  const [copyState, setCopyState] = useState<CopyState>('copied');
  const [opened, setOpened] = useState(false);
  const cat = getCategoryExperience(business.category);

  async function handleContinueToGoogle() {
    setCopyState('copying');
    const ok = await copyText(review);
    setCopyState(ok ? 'copied' : 'failed');
    onRedirect?.();
    window.open(business.googleReviewUrl, '_blank', 'noopener,noreferrer');
    setOpened(true);
  }

  return (
    <div className="space-y-6 text-center py-2">
      {/* Big Animated Checkmark + Sparkles */}
      <div className="relative mx-auto flex h-20 w-20 items-center justify-center">
        <span className="absolute -left-3 -top-1 text-[#E4BD63] motion-safe:animate-float-slow">
          <Sparkles className="h-5 w-5" aria-hidden />
        </span>
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-[#244B40] text-white shadow-sm motion-safe:animate-pop-in">
          <Check className="h-8 w-8 stroke-[2.75]" aria-hidden />
        </span>
        <span className="absolute -right-3 bottom-1 text-[#A8BFA5] motion-safe:animate-float-slow">
          <Sparkles className="h-4 w-4" aria-hidden />
        </span>
      </div>

      {/* Heading */}
      <div className="space-y-1.5">
        <h2 className="text-[26px] font-bold tracking-tight text-[#252B29] sm:text-[28px]">
          Thank you!
        </h2>
        <p className="mx-auto max-w-xs text-[14px] leading-relaxed text-[#626B65]">
          Your feedback helps <strong className="text-[#252B29]">{business.name}</strong> improve and serve you better.
        </p>
      </div>

      {business.googleReviewUrlIsPlaceholder && (
        <Alert tone="warning" className="text-left">
          <p className="text-[13px]">
            <strong>Preview mode:</strong> this business is still using a preview link while connecting its official Google Review URL.
          </p>
        </Alert>
      )}

      {copyState === 'failed' && (
        <div className="space-y-2 text-left">
          <Alert tone="warning">
            <p className="text-[13px]">
              Automatic copy was blocked — tap below to select and copy your review, then paste it on Google:
            </p>
          </Alert>
          <textarea
            readOnly
            aria-label="Select and copy your review"
            value={review}
            rows={4}
            onFocus={(e) => e.currentTarget.select()}
            className="block w-full rounded-xl border border-[#87928A] bg-[#F7F7F2] p-3 text-[14px] text-[#252B29]"
          />
        </div>
      )}

      {/* Primary CTA */}
      <div className="space-y-2.5">
        <Button
          type="button"
          loading={copyState === 'copying'}
          onClick={() => void handleContinueToGoogle()}
          className="w-full rounded-full text-[15px] font-semibold"
        >
          Continue to Google <ArrowRight className="h-4 w-4" aria-hidden />
        </Button>

        {opened && (
          <p className="inline-flex items-center justify-center gap-1.5 text-[13px] font-medium text-[#244B40]">
            <ClipboardCopy className="h-3.5 w-3.5" aria-hidden />
            Review copied — paste it on the Google tab and tap Post!
          </p>
        )}

        <div>
          <Button
            type="button"
            variant="ghost"
            onClick={onBack}
            className="text-[13px]"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> Back to edit review
          </Button>
        </div>
      </div>

      {/* Storefront Scene Footer */}
      <div className="mx-auto flex items-center justify-center gap-3 rounded-2xl border border-[#DDE4DC] bg-[#F7F7F2] px-5 py-3 text-2xl">
        <span aria-hidden>{cat.sceneEmojis[0]}</span>
        <span aria-hidden>{cat.emoji}</span>
        <span aria-hidden>{cat.sceneEmojis[1]}</span>
      </div>
    </div>
  );
}
