import { useState, useRef, useEffect, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import QRCode from 'qrcode';
import {
  Building2,
  CheckCircle2,
  Clock,
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

  // Draw QR code on canvas when business is created and active
  useEffect(() => {
    if (createdBusiness && createdBusiness.status === 'active' && canvasRef.current) {
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

  // Step 3: Awaiting Approval OR Live Confirmation
  if (createdBusiness) {
    const isApproved =
      createdBusiness.status === 'active' &&
      createdBusiness.accountState === 'active';
    const directReviewUrl = getCustomerReviewUrl(createdBusiness.slug, 'direct');
    const whatsAppLink = getWhatsAppShareLink(createdBusiness);

    if (!isApproved) {
      return (
        <div className="mx-auto max-w-xl space-y-6 text-center">
          <div className="rounded-2xl border border-[#DDE4DC] bg-[#FFFFFF] p-8 shadow-2xs space-y-6">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#FAF3DF] text-[#252B29] border border-[#E4BD63]">
              <Clock className="h-7 w-7 text-[#244B40]" aria-hidden />
            </div>

            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 rounded-full bg-[#FAF3DF] border border-[#E4BD63] px-3 py-1 text-[13px] font-medium text-[#252B29]">
                <Clock className="h-3.5 w-3.5 text-[#252B29]" aria-hidden />
                Awaiting Approval
              </div>
              <h1 className="text-[24px] font-bold tracking-tight text-[#252B29] sm:text-[28px]">
                {createdBusiness.name} Submitted for Review
              </h1>
              <p className="text-[15px] text-[#626B65] max-w-md mx-auto leading-relaxed">
                Your business details have been saved with status{' '}
                <code className="rounded bg-[#F7F7F2] px-1.5 py-0.5 font-mono text-[13px] text-[#252B29]">
                  pending
                </code>
                . Your customer QR code and review page (
                <code className="font-mono text-[13px] text-[#252B29]">
                  /r/{createdBusiness.slug}
                </code>
                ) are <strong>not live yet</strong> and will unlock as soon as a
                platform administrator approves your account.
              </p>
            </div>

            <div className="rounded-xl border border-[#DDE4DC] bg-[#F7F7F2] p-4 text-left text-[13px] text-[#626B65] space-y-1.5">
              <p className="font-semibold text-[#252B29]">What happens next?</p>
              <ul className="list-disc pl-4 space-y-1">
                <li>
                  Our platform team reviews your business details and Google
                  Review destination URL.
                </li>
                <li>
                  While pending, public visitors to{' '}
                  <code className="font-mono">/r/{createdBusiness.slug}</code>{' '}
                  cannot access or generate reviews.
                </li>
                <li>
                  Once approved, your QR code and WhatsApp sharing tools become
                  active in your dashboard.
                </li>
              </ul>
            </div>

            <div className="pt-2">
              <Button
                variant="primary"
                className="w-full"
                onClick={() => navigate(`/dashboard?slug=${createdBusiness.slug}`)}
              >
                Go to Business Dashboard
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="mx-auto max-w-xl space-y-6 text-center">
        <div className="rounded-2xl border border-[#DDE4DC] bg-[#FFFFFF] p-8 shadow-2xs space-y-6">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-[#A8BFA5] bg-[#EEF3EC] text-[#244B40]">
            <CheckCircle2 className="h-8 w-8" aria-hidden />
          </div>

          <div>
            <span className="rounded-md border border-[#DDE4DC] bg-[#F7F7F2] px-2.5 py-0.5 text-[12px] font-semibold text-[#252B29] uppercase">
              {categoryLabels[createdBusiness.category]} · {createdBusiness.city}
            </span>
            <h1 className="mt-2 text-[24px] font-bold tracking-tight text-[#252B29] sm:text-[28px]">
              {createdBusiness.name} is Registered!
            </h1>
            <p className="mt-1 text-[15px] text-[#626B65]">
              Your customer review flow, unique QR code, and WhatsApp links are ready to use.
            </p>
          </div>

          {/* QR Canvas Card */}
          <div className="rounded-xl border border-[#DDE4DC] bg-[#F7F7F2] p-5 inline-flex flex-col items-center">
            <canvas ref={canvasRef} className="h-44 w-44 rounded-lg shadow-2xs bg-[#FFFFFF] p-2" />
            <p className="mt-2 font-mono text-[13px] text-[#244B40] font-semibold break-all">
              {directReviewUrl}
            </p>
            <div className="mt-3 flex gap-2">
              <Button variant="secondary" onClick={handleDownloadPng}>
                <Download className="h-4 w-4" aria-hidden /> Download QR (PNG)
              </Button>
              <Button variant="secondary" onClick={handleCopyCustomerUrl}>
                {copiedLink ? <Check className="h-4 w-4 text-[#244B40]" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
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
              className="w-full inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#244B40] px-4 py-2.5 text-[14px] font-medium text-[#FFFFFF] hover:bg-[#1C3B32] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#244B40] focus-visible:ring-offset-2"
            >
              <Share2 className="h-4 w-4" aria-hidden /> Share with Customers via WhatsApp
            </a>

            <div className="grid gap-3 sm:grid-cols-2">
              <a
                href={directReviewUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#87928A] bg-[#FFFFFF] px-4 py-2.5 text-[14px] font-medium text-[#252B29] hover:border-[#244B40] hover:bg-[#F7F7F2] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#244B40] focus-visible:ring-offset-2"
              >
                <ExternalLink className="h-4 w-4" aria-hidden /> Test Customer Flow
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
        <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl border border-[#A8BFA5] bg-[#EEF3EC] text-[#244B40] mb-2">
          <Building2 className="h-5 w-5" aria-hidden />
        </div>
        <h1 className="text-[24px] font-bold tracking-tight text-[#252B29] sm:text-[28px]">
          Register Your Business
        </h1>
        <p className="mt-1 text-[15px] text-[#626B65]">
          Set up your local business, generate a unique customer QR code, and start capturing authentic Google reviews.
        </p>
      </div>

      {/* Progress Indicator */}
      <div className="flex items-center justify-center gap-2 text-[13px] font-medium text-[#626B65]">
        <span
          className={`flex h-6 w-6 items-center justify-center rounded-full ${
            step === 1 ? 'bg-[#244B40] text-[#FFFFFF] font-bold' : 'bg-[#244B40] text-[#FFFFFF]'
          }`}
        >
          {step > 1 ? '✓' : '1'}
        </span>
        <span className={step === 1 ? 'text-[#252B29] font-semibold' : 'text-[#252B29]'}>Business Details</span>
        <span className="text-[#DDE4DC]">———</span>
        <span
          className={`flex h-6 w-6 items-center justify-center rounded-full ${
            step === 2 ? 'bg-[#244B40] text-[#FFFFFF] font-bold' : 'bg-[#E8EBE7] text-[#626B65]'
          }`}
        >
          2
        </span>
        <span className={step === 2 ? 'text-[#252B29] font-semibold' : ''}>Google Review Destination</span>
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
          className="rounded-2xl border border-[#DDE4DC] bg-[#FFFFFF] p-6 sm:p-8 shadow-2xs space-y-5"
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
              <label htmlFor="categorySelect" className="block text-[13px] font-medium text-[#252B29] sm:text-[14px]">
                Business Category
              </label>
              <select
                id="categorySelect"
                value={category}
                onChange={(e) => setCategory(e.target.value as BusinessCategory)}
                className="block min-h-11 w-full rounded-xl border border-[#87928A] bg-[#FFFFFF] px-3.5 py-2.5 text-[15px] text-[#252B29] focus:border-[#244B40] focus:outline-none focus:ring-2 focus:ring-[#244B40]/25"
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
            <label htmlFor="slugInput" className="block text-[13px] font-medium text-[#252B29] sm:text-[14px]">
              Unique Customer Review Slug
            </label>
            <div className="flex min-h-11 items-center rounded-xl border border-[#87928A] bg-[#F7F7F2] px-3.5 focus-within:border-[#244B40] focus-within:ring-2 focus-within:ring-[#244B40]/25">
              <span className="text-[13px] font-mono text-[#626B65] shrink-0">/r/</span>
              <input
                id="slugInput"
                type="text"
                value={slug}
                onChange={(e) => handleSlugChange(e.target.value)}
                placeholder="hyderabad-spice-kitchen"
                className="w-full bg-transparent py-2.5 pl-1 text-[14px] font-mono text-[#252B29] focus:outline-none"
                required
              />
            </div>
            <p className="text-[13px] text-[#626B65]">
              Live URL will be: <span className="font-mono text-[#244B40] font-medium">{host}/r/{slug || 'your-slug'}</span>
            </p>
          </div>

          <div className="pt-2">
            <Button type="submit" className="w-full">
              Continue to Step 2 <ArrowRight className="h-4 w-4" aria-hidden />
            </Button>
          </div>
        </form>
      )}

      {/* Step 2: Google Review Link */}
      {step === 2 && (
        <form
          onSubmit={handleFinishSetup}
          noValidate
          className="rounded-2xl border border-[#DDE4DC] bg-[#FFFFFF] p-6 sm:p-8 shadow-2xs space-y-5"
        >
          <div>
            <h2 className="text-[20px] font-semibold text-[#252B29]">Configure Google Review Target</h2>
            <p className="mt-1 text-[13px] text-[#626B65]">
              When guests complete their review draft, they are redirected to this URL with their review copied to their clipboard.
            </p>
          </div>

          <div className="rounded-xl border border-[#DDE4DC] bg-[#F7F7F2] p-4 space-y-3">
            <div className="flex items-start gap-2.5">
              <input
                type="checkbox"
                id="placeholderCheckbox"
                checked={usePlaceholder}
                onChange={(e) => setUsePlaceholder(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-[#87928A] text-[#244B40] focus:ring-[#244B40]"
              />
              <label htmlFor="placeholderCheckbox" className="text-[13px] text-[#252B29] leading-normal">
                <strong>Start in Testing / Preview Mode</strong>
                <span className="block text-[#626B65] mt-0.5">
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

              <div className="rounded-xl bg-[#EEF3EC] p-3.5 border border-[#A8BFA5] text-[13px] text-[#252B29] space-y-1.5">
                <p className="font-semibold text-[#252B29] flex items-center gap-1.5">
                  <HelpCircle className="h-4 w-4 text-[#244B40]" aria-hidden /> How to find your Google review link:
                </p>
                <p className="text-[#626B65] text-[13px] leading-relaxed">
                  Go to Google Search → Search your business name → Click <strong>&ldquo;Ask for reviews&rdquo;</strong> in your Google Business Profile → Copy the short link (e.g. <code>https://g.page/r/.../review</code>).
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
              <ArrowLeft className="h-4 w-4" aria-hidden /> Back
            </Button>
            <Button type="submit" loading={loading}>
              Register Business &amp; Generate QR <Sparkles className="h-4 w-4" aria-hidden />
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
