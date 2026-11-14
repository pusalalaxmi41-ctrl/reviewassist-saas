import { useRef } from 'react';
import { ArrowLeft, Pencil, RefreshCw, ExternalLink } from 'lucide-react';
import { Button } from '../common/Button';
import { TextArea } from '../common/TextArea';
import { Alert } from '../common/Alert';

interface Props {
  review: string;
  loading: boolean;
  error: string | null;
  onChange: (text: string) => void;
  onRegenerate: () => void;
  onBack: () => void;
  onContinue: () => void;
}

export function ReviewPreviewStep({ review, loading, error, onChange, onRegenerate, onBack, onContinue }: Props) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const empty = !review.trim();

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Your review draft</h2>
        <p className="mt-1 text-sm text-slate-600">
          Based only on what you shared. Read it carefully and edit anything that doesn't sound like you.
        </p>
      </div>

      {error && (
        <Alert tone="error">
          <p>{error}</p>
        </Alert>
      )}

      {loading && !review ? (
        <div className="space-y-2 rounded-lg border border-slate-200 bg-white p-4" aria-busy="true" aria-label="Generating review">
          <div className="h-3 w-full animate-pulse rounded bg-slate-200" />
          <div className="h-3 w-11/12 animate-pulse rounded bg-slate-200" />
          <div className="h-3 w-3/4 animate-pulse rounded bg-slate-200" />
        </div>
      ) : (
        <TextArea
          ref={ref}
          label="Review text"
          hideLabel
          rows={8}
          value={review}
          disabled={loading}
          onChange={(e) => onChange(e.target.value)}
          error={empty && !loading ? 'Your review is empty. Write something or generate again.' : null}
        />
      )}

      <div className="grid grid-cols-2 gap-3">
        <Button type="button" variant="secondary" disabled={loading} onClick={() => ref.current?.focus()}>
          <Pencil className="h-4 w-4" aria-hidden /> Edit review
        </Button>
        <Button type="button" variant="secondary" loading={loading} onClick={onRegenerate}>
          {!loading && <RefreshCw className="h-4 w-4" aria-hidden />} Generate again
        </Button>
      </div>

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
        <Button type="button" variant="ghost" onClick={onBack} disabled={loading}>
          <ArrowLeft className="h-4 w-4" aria-hidden /> Edit experience
        </Button>
        <Button type="button" onClick={onContinue} disabled={loading || empty}>
          Continue to Google <ExternalLink className="h-4 w-4" aria-hidden />
        </Button>
      </div>
    </div>
  );
}
