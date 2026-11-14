import { useState } from 'react';
import { ArrowLeft, ClipboardCopy, ExternalLink } from 'lucide-react';
import type { Business } from '../../types/business';
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
  const [copyState, setCopyState] = useState<CopyState>('idle');
  const [opened, setOpened] = useState(false);

  function openGoogle() {
    onRedirect?.();
    window.open(business.googleReviewUrl, '_blank', 'noopener,noreferrer');
    setOpened(true);
  }

  async function copyAndOpen() {
    setCopyState('copying');
    const ok = await copyText(review);
    setCopyState(ok ? 'copied' : 'failed');
    if (ok) openGoogle();
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Post your review on Google</h2>
        <p className="mt-1 text-sm text-slate-600">We can't post for you — you stay in control of what gets published.</p>
      </div>

      <ol className="space-y-3 text-sm">
        {[
          'We copy your review to the clipboard.',
          `Google's review page for ${business.name} opens in a new tab.`,
          'Choose your star rating, paste the review (long-press → Paste on mobile) and tap Post.',
        ].map((t, i) => (
          <li key={t} className="flex gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-xs font-semibold text-indigo-700">{i + 1}</span>
            <span className="pt-0.5 text-slate-700">{t}</span>
          </li>
        ))}
      </ol>

      {business.googleReviewUrlIsPlaceholder && (
        <Alert tone="warning">
          <p><strong>Preview mode:</strong> this business hasn't configured its Google review link yet, so a placeholder page will open instead of Google.</p>
        </Alert>
      )}

      {copyState === 'copied' && (
        <Alert tone="success">
          <p>Review copied. {opened ? 'Paste it on the Google page and submit it there.' : ''}</p>
          <p>Your review is not published until you submit it on Google yourself.</p>
        </Alert>
      )}

      {copyState === 'failed' && (
        <Alert tone="error">
          <p>We couldn't copy automatically. Select the text below and copy it manually, then open Google.</p>
        </Alert>
      )}

      {copyState === 'failed' && (
        <textarea
          readOnly
          aria-label="Your review — select and copy"
          value={review}
          rows={6}
          onFocus={(e) => e.currentTarget.select()}
          className="block w-full rounded-lg border border-slate-300 bg-slate-50 p-3 text-sm"
        />
      )}

      <div className="space-y-3">
        <Button type="button" className="w-full" loading={copyState === 'copying'} onClick={copyAndOpen}>
          <ClipboardCopy className="h-4 w-4" aria-hidden /> Copy review & open Google
        </Button>
        {(copyState === 'failed' || opened) && (
          <Button type="button" variant="secondary" className="w-full" onClick={openGoogle}>
            Open Google review page <ExternalLink className="h-4 w-4" aria-hidden />
          </Button>
        )}
        <Button type="button" variant="ghost" className="w-full" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" aria-hidden /> Back to review
        </Button>
      </div>
    </div>
  );
}
