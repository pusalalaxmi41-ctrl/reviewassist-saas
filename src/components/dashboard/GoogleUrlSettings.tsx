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
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-4">
        <div>
          <h3 className="text-lg font-bold tracking-tight text-slate-900">
            Google Review Link & Destination
          </h3>
          <p className="mt-1 text-xs text-slate-500">
            Configured target URL when customers click "Continue to Google" on their review draft.
          </p>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-slate-600 font-mono">
          <span>Business ID:</span>
          <span className="bg-slate-100 px-2 py-0.5 rounded text-slate-800 font-bold">{business.id}</span>
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
            <AlertTriangle className="h-4 w-4 shrink-0" /> Running in Preview / Placeholder Mode
          </p>
          <p className="mt-1 text-xs text-amber-800">
            Customers testing this flow are redirected to a placeholder preview page with clear testing banners. Once your Google Business Profile is verified, paste your real shortlink below and uncheck the placeholder mode.
          </p>
        </Alert>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <TextField
          label="Direct Google Review URL"
          type="url"
          value={googleUrl}
          onChange={(e) => setGoogleUrl(e.target.value)}
          placeholder="https://g.page/r/YOUR_BUSINESS/review"
          required
        />

        <div className="flex items-start gap-2.5 rounded-lg border border-slate-200 bg-slate-50 p-3.5">
          <input
            type="checkbox"
            id="isPlaceholderCheckbox"
            checked={isPlaceholder}
            onChange={(e) => setIsPlaceholder(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
          />
          <label htmlFor="isPlaceholderCheckbox" className="text-xs text-slate-700 leading-normal">
            <strong>Mark this as a temporary preview / testing link</strong>
            <span className="block text-slate-500 mt-0.5">
              Prevents real guests from attempting to post if your Google business listing is not ready.
            </span>
          </label>
        </div>

        <div className="rounded-lg bg-slate-50 p-4 border border-slate-200 text-xs text-slate-600 space-y-2">
          <p className="font-semibold text-slate-800 flex items-center gap-1.5">
            <HelpCircle className="h-4 w-4 text-indigo-600" /> How to find your official Google Review link:
          </p>
          <ol className="list-decimal pl-4 space-y-1">
            <li>Search your business name on Google while signed into your manager account.</li>
            <li>Click <strong>"Ask for reviews"</strong> or <strong>"Get more reviews"</strong> on your Google Business Profile.</li>
            <li>Copy the short link (e.g. <code>https://g.page/r/.../review</code> or <code>https://search.google.com/local/writereview?placeid=...</code>).</li>
            <li>Paste it here and click Save.</li>
          </ol>
        </div>

        <div className="flex items-center gap-2 rounded-lg bg-indigo-50/50 border border-indigo-100 p-3 text-xs text-slate-700">
          <ShieldCheck className="h-4 w-4 text-indigo-600 shrink-0" />
          <span>Customer review text is securely copied to their device clipboard prior to redirection.</span>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <a
            href={googleUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900"
          >
            <ExternalLink className="h-3.5 w-3.5" /> Test opening this Google link
          </a>
          <Button type="submit" loading={loading}>
            {saved ? <Check className="h-4 w-4 text-emerald-200" /> : <Save className="h-4 w-4" />}
            {saved ? 'Saved' : 'Save Google URL'}
          </Button>
        </div>
      </form>
    </div>
  );
}
