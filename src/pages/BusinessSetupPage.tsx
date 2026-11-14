import { useState, useRef, useEffect, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import QRCode from 'qrcode';
import {
  Building2,
  CheckCircle2,
  ExternalLink,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  Download,
  Share2,
  Copy,
  Check,
  HelpCircle,
} from 'lucide-react';
import type { Business, BusinessCategory } from '../types/business';
import { businessRepository, PLACEHOLDER_GOOGLE_REVIEW_URL } from '../services/storage';
import { categoryLabels } from '../services/business/mockBusinesses';
import { copyText } from '../utils/clipboard';
import { getCustomerReviewUrl, getWhatsAppShareLink } from '../utils/sharing';
import { Button } from '../components/common/Button';
import { TextField } from '../components/common/TextField';
import { Alert } from '../components/common/Alert';

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export default function BusinessSetupPage() {
  const navigate = useNavigate();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [step, setStep] = useState<1 | 2>(1);
  const [name, setName] = useState('');
  const [category, setCategory] = useState<BusinessCategory>('restaurant');
  const [city, setCity] = useState('');
  const [slug, setSlug] = useState('');
  const [slugCustomized, setSlugCustomized] = useState(false);
  const [googleUrl, setGoogleUrl] = useState('');
  const [usePlaceholder, setUsePlaceholder] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdBusiness, setCreatedBusiness] = useState<Business | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  function handleNameChange(newName: string) {
    setName(newName);
    if (!slugCustomized) {
      setSlug(slugify(newName));
    }
  }

  function handleSlugChange(newSlug: string) {
    setSlug(slugify(newSlug));
    setSlugCustomized(true);
  }

  async function handleContinueToReview(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Please provide a business name.');
      return;
    }
    if (trimmedName.length < 2) {
      setError('Business name must be at least 2 characters.');
      return;
    }

    const trimmedCity = city.trim();
    if (!trimmedCity) {
      setError('Please provide the city where your business is located.');
      return;
    }

    const cleanSlug = slug.trim();
    if (!cleanSlug || cleanSlug.length < 3) {
      setError('Customer URL slug must be at least 3 characters.');
      return;
    }

    if (!/^[a-z0-9-]+$/.test(cleanSlug)) {
      setError('URL slug can only contain lowercase letters, numbers, and hyphens.');
      return;
    }

    // Verify slug uniqueness in repository
    const existing = await businessRepository.getBusinessBySlug(cleanSlug);
    if (existing) {
      setError(`The URL slug "/r/${cleanSlug}" is already in use by another business. Please choose a unique slug.`);
      return;
    }

    setStep(2);
  }

  async function handleFinishSetup(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    let finalGoogleUrl = googleUrl.trim();
    let isPlaceholder = usePlaceholder;

    if (!usePlaceholder) {
      if (!finalGoogleUrl) {
        setError('Please enter your Google review link, or enable Testing / Placeholder mode.');
        setLoading(false);
        return;
      }
      try {
        const parsed = new URL(finalGoogleUrl);
        if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
          throw new Error('Invalid protocol');
        }
      } catch {
        setError('Please enter a valid web URL starting with https://');
        setLoading(false);
        return;
      }
    } else {
      finalGoogleUrl = PLACEHOLDER_GOOGLE_REVIEW_URL;
      isPlaceholder = true;
    }

    try {
      const newBiz = await businessRepository.createBusiness({
        name: name.trim(),
        category,
        city: city.trim(),
        slug: slug.trim(),
        googleReviewUrl: finalGoogleUrl,
        googleReviewUrlIsPlaceholder: isPlaceholder,
      });

      setCreatedBusiness(newBiz);
    } catch (err) {
      setError((err as Error).message || 'Failed to register business.');
    } finally {
      setLoading(false);
    }
  }

  // Draw QR code on canvas when business is created
  useEffect(() => {
    if (createdBusiness && canvasRef.current) {
      const qrUrl = getCustomerReviewUrl(createdBusiness.slug, 'qr');
      void QRCode.toCanvas(canvasRef.current, qrUrl, {
        width: 240,
        margin: 2,
        color: { dark: '#0f172a', light: '#ffffff' },
      });
    }
  }, [createdBusiness]);

  function handleDownloadPng() {
    if (!canvasRef.current || !createdBusiness) return;
    const pngUrl = canvasRef.current.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = `${createdBusiness.slug}-review-qr.png`;
    link.href = pngUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  async function handleCopyCustomerUrl() {
    if (!createdBusiness) return;
    const url = getCustomerReviewUrl(createdBusiness.slug, 'direct');
    const ok = await copyText(url);
    if (ok) {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  }

  const host = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173';

  // Step 3: Success Confirmation & Immediate Action Center
  if (createdBusiness) {
    const directReviewUrl = getCustomerReviewUrl(createdBusiness.slug, 'direct');
    const whatsAppLink = getWhatsAppShareLink(createdBusiness);

    return (
      <div className="mx-auto max-w-xl space-y-6 text-center">
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm space-y-6">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
            <CheckCircle2 className="h-8 w-8" />
          </div>

          <div>
            <span className="rounded-md bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700 uppercase">
              {categoryLabels[createdBusiness.category]} · {createdBusiness.city}
            </span>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
              {createdBusiness.name} is Registered!
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Your customer review flow, unique QR code, and WhatsApp links are ready to use.
            </p>
          </div>

          {/* QR Canvas Card */}
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 inline-flex flex-col items-center">
            <canvas ref={canvasRef} className="h-44 w-44 rounded-lg shadow-sm bg-white p-2" />
            <p className="mt-2 font-mono text-xs text-indigo-700 font-semibold break-all">
              {directReviewUrl}
            </p>
            <div className="mt-3 flex gap-2">
              <Button variant="secondary" onClick={handleDownloadPng}>
                <Download className="h-4 w-4" /> Download QR (PNG)
              </Button>
              <Button variant="secondary" onClick={handleCopyCustomerUrl}>
                {copiedLink ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                {copiedLink ? 'Copied' : 'Copy link'}
              </Button>
            </div>
          </div>

          {/* Quick Sharing & Access Actions */}
          <div className="space-y-3 pt-2">
            <a
              href={whatsAppLink}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-700"
            >
              <Share2 className="h-4 w-4" /> Share with Customers via WhatsApp
            </a>

            <div className="grid gap-3 sm:grid-cols-2">
              <a
                href={directReviewUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                <ExternalLink className="h-4 w-4" /> Test Customer Flow
              </a>
              <Button
                variant="primary"
                onClick={() => navigate(`/dashboard?slug=${createdBusiness.slug}`)}
              >
                Open Dashboard
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div className="text-center">
        <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 mb-2">
          <Building2 className="h-5 w-5" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          Register Your Business
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Set up your local business, generate a unique customer QR code, and start capturing authentic Google reviews.
        </p>
      </div>

      {/* Progress Indicator */}
      <div className="flex items-center justify-center gap-2 text-xs font-medium text-slate-500">
        <span
          className={`flex h-6 w-6 items-center justify-center rounded-full ${
            step === 1 ? 'bg-indigo-600 text-white font-bold' : 'bg-emerald-600 text-white'
          }`}
        >
          {step > 1 ? '✓' : '1'}
        </span>
        <span className={step === 1 ? 'text-slate-900 font-semibold' : ''}>Business Details</span>
        <span className="text-slate-300">———</span>
        <span
          className={`flex h-6 w-6 items-center justify-center rounded-full ${
            step === 2 ? 'bg-indigo-600 text-white font-bold' : 'bg-slate-200 text-slate-600'
          }`}
        >
          2
        </span>
        <span className={step === 2 ? 'text-slate-900 font-semibold' : ''}>Google Review Destination</span>
      </div>

      {error && (
        <Alert tone="error">
          <p>{error}</p>
        </Alert>
      )}

      {/* Step 1: Business Details & Slug */}
      {step === 1 && (
        <form
          onSubmit={handleContinueToReview}
          noValidate
          className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm space-y-5"
        >
          <TextField
            label="Business Name"
            placeholder="e.g. Hyderabad Spice Kitchen, Cafe Botanica, Blue Moon PG"
            value={name}
            onChange={(e) => handleNameChange(e.target.value)}
            required
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label htmlFor="categorySelect" className="block text-sm font-medium text-slate-700">
                Business Category
              </label>
              <select
                id="categorySelect"
                value={category}
                onChange={(e) => setCategory(e.target.value as BusinessCategory)}
                className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
              >
                <option value="restaurant">Restaurant / Dining</option>
                <option value="cafe">Cafe / Bakery / Coffee</option>
                <option value="hotel">Hotel / Resort / Homestay</option>
                <option value="pg">PG / Co-living Accommodation</option>
              </select>
            </div>

            <TextField
              label="City / Location"
              placeholder="e.g. Hyderabad, Bengaluru, Pune"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              required
            />
          </div>

          {/* URL Slug preview */}
          <div className="space-y-1.5">
            <label htmlFor="slugInput" className="block text-sm font-medium text-slate-700">
              Unique Customer Review Slug
            </label>
            <div className="flex items-center rounded-lg border border-slate-300 bg-slate-50 px-3 focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/30">
              <span className="text-xs font-mono text-slate-500 shrink-0">/r/</span>
              <input
                id="slugInput"
                type="text"
                value={slug}
                onChange={(e) => handleSlugChange(e.target.value)}
                placeholder="hyderabad-spice-kitchen"
                className="w-full bg-transparent py-2.5 pl-1 text-sm font-mono text-slate-900 focus:outline-none"
                required
              />
            </div>
            <p className="text-xs text-slate-500">
              Live URL will be: <span className="font-mono text-indigo-700">{host}/r/{slug || 'your-slug'}</span>
            </p>
          </div>

          <div className="pt-2">
            <Button type="submit" className="w-full">
              Continue to Step 2 <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </form>
      )}

      {/* Step 2: Google Review Link */}
      {step === 2 && (
        <form
          onSubmit={handleFinishSetup}
          noValidate
          className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm space-y-5"
        >
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Configure Google Review Target</h2>
            <p className="mt-1 text-xs text-slate-600">
              When guests complete their review draft, they are redirected to this URL with their review copied to their clipboard.
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
            <div className="flex items-start gap-2.5">
              <input
                type="checkbox"
                id="placeholderCheckbox"
                checked={usePlaceholder}
                onChange={(e) => setUsePlaceholder(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              <label htmlFor="placeholderCheckbox" className="text-xs text-slate-700 leading-normal">
                <strong>Start in Testing / Preview Mode</strong>
                <span className="block text-slate-500 mt-0.5">
                  Check this if you do not have your official Google Business shortlink yet. You can test the end-to-end flow and update the link anytime in your dashboard.
                </span>
              </label>
            </div>
          </div>

          {!usePlaceholder && (
            <div className="space-y-4">
              <TextField
                label="Direct Google Review URL"
                type="url"
                value={googleUrl}
                onChange={(e) => setGoogleUrl(e.target.value)}
                placeholder="https://g.page/r/YOUR_BUSINESS/review"
                required={!usePlaceholder}
              />

              <div className="rounded-lg bg-indigo-50/50 p-3.5 border border-indigo-100 text-xs text-slate-700 space-y-1.5">
                <p className="font-semibold text-indigo-950 flex items-center gap-1">
                  <HelpCircle className="h-3.5 w-3.5 text-indigo-600" /> How to find your Google review link:
                </p>
                <p className="text-slate-600 text-[11px] leading-relaxed">
                  Go to Google Search → Search your business name → Click <strong>"Ask for reviews"</strong> in your Google Business Profile → Copy the short link (e.g. <code>https://g.page/r/.../review</code>).
                </p>
              </div>
            </div>
          )}

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setError(null);
                setStep(1);
              }}
              disabled={loading}
            >
              <ArrowLeft className="h-4 w-4" /> Back
            </Button>
            <Button type="submit" loading={loading}>
              Register Business & Generate QR <Sparkles className="h-4 w-4" />
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
