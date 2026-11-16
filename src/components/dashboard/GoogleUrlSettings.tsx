import { useState, type FormEvent } from 'react';
import { Save, ExternalLink, HelpCircle, Check, AlertTriangle, ShieldCheck } from 'lucide-react';
import type { Business } from '../../types/business';
import { businessRepository } from '../../services/storage';
import { Button } from '../common/Button';
import { TextField } from '../common/TextField';
import { Alert } from '../common/Alert';

interface Props {
  business: Business;
  onUpdated: (updated: Business) => void;
}

export function GoogleUrlSettings({ business, onUpdated }: Props) {
  const [googleUrl, setGoogleUrl] = useState(business.googleReviewUrl);
  const [isPlaceholder, setIsPlaceholder] = useState(Boolean(business.googleReviewUrlIsPlaceholder));
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const trimmed = googleUrl.trim();
    if (!trimmed) {
      setError('Please provide a valid Google review link or placeholder URL.');
      setLoading(false);
      return;
    }

    try {
      new URL(trimmed);
    } catch {
      setError('Please enter a valid web URL (must start with https://).');
      setLoading(false);
      return;
    }

    try {
      const updated = await businessRepository.updateBusinessGoogleUrl(
        business.id,
        trimmed,
        isPlaceholder,
      );
      onUpdated(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError((err as Error).message || 'Failed to update Google review URL.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl border border-[#DDE4DC] bg-[#FFFFFF] p-6 shadow-2xs space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#DDE4DC] pb-4">
        <div>
          <h3 className="text-[18px] font-semibold tracking-tight text-[#252B29] sm:text-[20px]">
            Google Review Link &amp; Destination
          </h3>
          <p className="mt-1 text-[13px] text-[#626B65]">
            Configured target URL when customers click &ldquo;Open Google Review Page&rdquo; on their review draft.
          </p>
        </div>
        <div className="flex items-center gap-1.5 text-[12px] text-[#626B65] font-mono">
          <span>Business ID:</span>
          <span className="bg-[#F7F7F2] border border-[#DDE4DC] px-2 py-0.5 rounded text-[#252B29] font-bold">{business.id}</span>
        </div>
      </div>

      {saved && (
        <Alert tone="success">
          <p>Google Review URL updated successfully! Customer flows will now use this destination.</p>
        </Alert>
      )}

      {error && (
        <Alert tone="error">
          <p>{error}</p>
        </Alert>
      )}

      {isPlaceholder && (
        <Alert tone="warning">
          <p className="flex items-center gap-1.5 font-medium">
            <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden /> Running in Preview / Placeholder Mode
          </p>
          <p className="mt-1 text-[13px] text-[#252B29]">
            Customers testing this flow are redirected to a placeholder preview page with clear testing banners. Once your Google Business Profile is verified, paste your real shortlink below and uncheck the placeholder mode.
          </p>
        </Alert>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <TextField
          label="Direct Google Review URL"
          type="url"
          value={googleUrl}
          onChange={(e) => {
            const val = e.target.value;
            setGoogleUrl(val);
            if (
              val.trim().startsWith('https://') &&
              !val.includes('example.com') &&
              !val.includes('placeholder')
            ) {
              setIsPlaceholder(false);
            }
          }}
          placeholder="https://g.page/r/YOUR_BUSINESS/review"
          required
        />

        <div className="flex items-start gap-2.5 rounded-xl border border-[#DDE4DC] bg-[#F7F7F2] p-3.5">
          <input
            type="checkbox"
            id="isPlaceholderCheckbox"
            checked={isPlaceholder}
            onChange={(e) => setIsPlaceholder(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-[#87928A] text-[#244B40] focus:ring-[#244B40]"
          />
          <label htmlFor="isPlaceholderCheckbox" className="text-[13px] text-[#252B29] leading-normal">
            <strong>Mark this as a temporary preview / testing link</strong>
            <span className="block text-[#626B65] mt-0.5">
              Prevents real guests from attempting to post if your Google business listing is not ready.
            </span>
          </label>
        </div>

        <div className="rounded-xl bg-[#F7F7F2] p-4 border border-[#DDE4DC] text-[13px] text-[#626B65] space-y-2">
          <p className="font-semibold text-[#252B29] flex items-center gap-1.5">
            <HelpCircle className="h-4 w-4 text-[#244B40]" aria-hidden /> How to find your official Google Review link:
          </p>
          <ol className="list-decimal pl-4 space-y-1">
            <li>Search your business name on Google while signed into your manager account.</li>
            <li>Click <strong>&ldquo;Ask for reviews&rdquo;</strong> or <strong>&ldquo;Get more reviews&rdquo;</strong> on your Google Business Profile.</li>
            <li>Copy the short link (e.g. <code>https://g.page/r/.../review</code> or <code>https://search.google.com/local/writereview?placeid=...</code>).</li>
            <li>Paste it here and click Save.</li>
          </ol>
        </div>

        <div className="flex items-center gap-2 rounded-xl bg-[#EEF3EC] border border-[#A8BFA5] p-3.5 text-[13px] text-[#252B29]">
          <ShieldCheck className="h-4 w-4 text-[#244B40] shrink-0" aria-hidden />
          <span>Customer review text is securely copied to their device clipboard prior to redirection.</span>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <a
            href={googleUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[#244B40] hover:underline"
          >
            <ExternalLink className="h-3.5 w-3.5" aria-hidden /> Test opening this Google link
          </a>
          <Button type="submit" loading={loading}>
            {saved ? <Check className="h-4 w-4" aria-hidden /> : <Save className="h-4 w-4" aria-hidden />}
            {saved ? 'Saved' : 'Save Google URL'}
          </Button>
        </div>
      </form>
    </div>
  );
}
