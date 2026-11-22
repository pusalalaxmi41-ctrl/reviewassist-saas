import { useState, useRef, useEffect, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import QRCode from 'qrcode';
import {
  UtensilsCrossed,
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
import {
  CATEGORY_EXPERIENCE,
  CATEGORY_ORDER,
  categoryLabels,
} from '../config/reviewExperience';
import { copyText } from '../utils/clipboard';
import { getCustomerReviewUrl, getWhatsAppShareLink } from '../utils/sharing';
import { isBarberOrSalonCategory } from '../utils/barberQueueValidation';
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
      setError('Please provide a restaurant or business name.');
      return;
    }
    if (trimmedName.length < 2) {
      setError('Business name must be at least 2 characters.');
      return;
    }

    const trimmedCity = city.trim();
    if (!trimmedCity) {
      setError('Please provide the city where your restaurant is located.');
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

    const existing = await businessRepository.getBusinessBySlug(cleanSlug);
    if (existing) {
      setError(`The URL slug "/r/${cleanSlug}" is already in use. Please choose a unique slug.`);
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
        setError('Please enter your Google review link, or enable Testing / Preview mode.');
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

  useEffect(() => {
    if (createdBusiness && createdBusiness.status === 'active' && canvasRef.current) {
      const qrUrl = getCustomerReviewUrl(createdBusiness.slug, 'qr');
      void QRCode.toCanvas(canvasRef.current, qrUrl, {
        width: 240,
        margin: 2,
        color: { dark: '#1E1B4B', light: '#ffffff' },
      });
    }
  }, [createdBusiness]);

  function handleDownloadPng() {
    if (!canvasRef.current || !createdBusiness) return;
    const pngUrl = canvasRef.current.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = `${createdBusiness.slug}-qr.png`;
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

  if (createdBusiness) {
    const isApproved =
      createdBusiness.status === 'active' &&
      createdBusiness.accountState === 'active';
    const directReviewUrl = getCustomerReviewUrl(createdBusiness.slug, 'direct');
    const whatsAppLink = getWhatsAppShareLink(createdBusiness);

    if (!isApproved) {
      return (
        <div className="mx-auto max-w-xl space-y-6 text-center animate-fadeSlideUp">
          <div className="bistro-card p-8 space-y-6">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#D2DB76]/45 text-[#1E1B4B]">
              <Clock className="h-7 w-7 text-[#1E1B4B]" aria-hidden />
            </div>

            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 rounded-full bg-[#D2DB76]/45 px-3.5 py-1 text-[13px] font-semibold text-[#1E1B4B]">
                <Clock className="h-3.5 w-3.5" aria-hidden />
                Workspace Ready for Verification
              </div>
              <h1 className="text-[24px] font-extrabold tracking-tight text-[#111827] sm:text-[28px]">
                {createdBusiness.name} Created
              </h1>
              <p className="text-[15px] text-[#6B7280] max-w-md mx-auto leading-relaxed">
                Your restaurant workspace is saved. While your public Google Review redirect awaits platform activation, you can immediately configure your Digital Menu, Table Standees, Games, and Loyalty Rewards inside your dashboard.
              </p>
            </div>

            <div className="pt-2">
              <Button
                variant="primary"
                className="w-full"
                onClick={() => navigate(`/dashboard?slug=${createdBusiness.slug}`)}
              >
                Open Restaurant Workspace <ArrowRight className="h-4 w-4" aria-hidden />
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="mx-auto max-w-xl space-y-6 text-center animate-fadeSlideUp">
        <div className="bistro-card p-8 space-y-6">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-[#059669] border border-emerald-200">
            <CheckCircle2 className="h-8 w-8" aria-hidden />
          </div>

          <div>
            <span className="rounded-full bg-[#D2DB76]/45 px-3 py-1 text-[12px] font-bold text-[#1E1B4B] uppercase tracking-wider">
              {categoryLabels[createdBusiness.category]} • {createdBusiness.city}
            </span>
            <h1 className="mt-3 text-[24px] font-extrabold tracking-tight text-[#111827] sm:text-[28px]">
              {createdBusiness.name} is Live!
            </h1>
            <p className="mt-1 text-[15px] text-[#6B7280]">
              Your Digital Menu, Table Gaming &amp; Loyalty Hub, and AI Review QR are ready.
            </p>
          </div>

          <div className="rounded-2xl border border-[#1E1B4B]/10 bg-[#F8F9FA] p-5 inline-flex flex-col items-center">
            <canvas ref={canvasRef} className="h-44 w-44 rounded-xl shadow-xs bg-[#FFFFFF] p-2" />
            <p className="mt-2 font-mono text-[13px] text-[#1E1B4B] font-semibold break-all">
              {directReviewUrl}
            </p>
            <div className="mt-3 flex gap-2">
              <Button variant="secondary" onClick={handleDownloadPng}>
                <Download className="h-4 w-4" aria-hidden /> Download QR (PNG)
              </Button>
              <Button variant="secondary" onClick={handleCopyCustomerUrl}>
                {copiedLink ? <Check className="h-4 w-4 text-[#059669]" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
                {copiedLink ? 'Copied' : 'Copy link'}
              </Button>
            </div>
          </div>

          <div className="space-y-3 pt-2">
            <a
              href={whatsAppLink}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#1E1B4B] px-4 py-2.5 text-[14px] font-semibold text-[#FFFFFF] hover:bg-[#2E2A6E] active:scale-[0.98] transition-all duration-150"
            >
              <Share2 className="h-4 w-4" aria-hidden /> Share with Guests via WhatsApp
            </a>

            <div className="grid gap-3 sm:grid-cols-2">
              <a
                href={
                  isBarberOrSalonCategory(createdBusiness.category)
                    ? `/r/${createdBusiness.slug}/queue`
                    : `/r/${createdBusiness.slug}/menu`
                }
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#1E1B4B]/20 bg-[#FFFFFF] px-4 py-2.5 text-[14px] font-semibold text-[#111827] hover:border-[#1E1B4B] hover:bg-[#F8F9FA]"
              >
                <ExternalLink className="h-4 w-4" aria-hidden />{' '}
                {isBarberOrSalonCategory(createdBusiness.category)
                  ? 'Open Live Queue'
                  : 'Open Customer Menu'}
              </a>
              <Button
                variant="primary"
                onClick={() => navigate(`/dashboard?slug=${createdBusiness.slug}`)}
              >
                Open Owner Workspace
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl space-y-6 py-4 animate-fadeSlideUp">
      <div className="text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#1E1B4B] text-[#D2DB76] mb-3 shadow-sm">
          <UtensilsCrossed className="h-5 w-5" aria-hidden />
        </div>
        <h1 className="text-[26px] font-extrabold tracking-tight text-[#111827] sm:text-[30px]">
          Set Up Your Restaurant Workspace
        </h1>
        <p className="mt-1.5 text-[15px] text-[#6B7280]">
          Launch your digital table menu, interactive guest games, loyalty stars, and Google review flow in under a minute.
        </p>
      </div>

      {/* Progress Indicator */}
      <div className="flex items-center justify-center gap-2.5 text-[13px] font-semibold text-[#6B7280]">
        <span
          className={`flex h-6 w-6 items-center justify-center rounded-full ${
            step === 1 ? 'bg-[#1E1B4B] text-[#FFFFFF]' : 'bg-[#059669] text-[#FFFFFF]'
          }`}
        >
          {step > 1 ? '✓' : '1'}
        </span>
        <span className={step === 1 ? 'text-[#111827]' : 'text-[#111827]'}>Restaurant Profile</span>
        <span className="text-[#1E1B4B]/20">———</span>
        <span
          className={`flex h-6 w-6 items-center justify-center rounded-full ${
            step === 2 ? 'bg-[#1E1B4B] text-[#FFFFFF]' : 'bg-[#1E1B4B]/10 text-[#6B7280]'
          }`}
        >
          2
        </span>
        <span className={step === 2 ? 'text-[#111827]' : ''}>Google Review Link</span>
      </div>

      {error && (
        <Alert tone="error">
          <p>{error}</p>
        </Alert>
      )}

      {step === 1 && (
        <form
          onSubmit={(e) => void handleContinueToReview(e)}
          noValidate
          className="bistro-card p-6 sm:p-8 space-y-5"
        >
          <TextField
            label="Restaurant / Venue Name"
            placeholder="e.g. The Urban Kitchen, Bistro Botanica"
            value={name}
            onChange={(e) => handleNameChange(e.target.value)}
            required
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label htmlFor="categorySelect" className="block text-[13px] font-semibold text-[#111827] sm:text-[14px]">
                Hospitality Category
              </label>
              <select
                id="categorySelect"
                value={category}
                onChange={(e) => setCategory(e.target.value as BusinessCategory)}
                className="block h-11 min-h-11 w-full rounded-xl border border-[#1E1B4B]/20 bg-[#FFFFFF] px-3.5 py-2.5 text-[15px] text-[#111827] focus:border-[#1E1B4B] focus:outline-none focus:ring-2 focus:ring-[#1E1B4B]/25"
              >
                {CATEGORY_ORDER.map((cat) => (
                  <option key={cat} value={cat}>
                    {CATEGORY_EXPERIENCE[cat].emoji} {CATEGORY_EXPERIENCE[cat].setupLabel}
                  </option>
                ))}
              </select>
            </div>

            <TextField
              label="City / Location"
              placeholder="e.g. Hyderabad, Bengaluru, Mumbai"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              required
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="slugInput" className="block text-[13px] font-semibold text-[#111827] sm:text-[14px]">
              Custom Table &amp; Menu URL Slug
            </label>
            <div className="flex h-11 min-h-11 items-center rounded-xl border border-[#1E1B4B]/20 bg-[#F8F9FA] px-3.5 focus-within:border-[#1E1B4B] focus-within:bg-[#FFFFFF] focus-within:ring-2 focus-within:ring-[#1E1B4B]/25">
              <span className="text-[13px] font-mono text-[#6B7280] shrink-0">/r/</span>
              <input
                id="slugInput"
                type="text"
                value={slug}
                onChange={(e) => handleSlugChange(e.target.value)}
                placeholder="the-urban-kitchen"
                className="w-full bg-transparent py-2.5 pl-1 text-[14px] font-mono text-[#111827] focus:outline-none"
                required
              />
            </div>
            <p className="text-[13px] text-[#6B7280]">
              {isBarberOrSalonCategory(category) ? 'Live queue URL: ' : 'Guest menu URL: '}
              <span className="font-mono text-[#1E1B4B] font-semibold">
                {host}/r/{slug || 'your-slug'}/{isBarberOrSalonCategory(category) ? 'queue' : 'menu'}
              </span>
            </p>
          </div>

          <div className="pt-2">
            <Button type="submit" className="w-full">
              Continue to Step 2 <ArrowRight className="h-4 w-4" aria-hidden />
            </Button>
          </div>
        </form>
      )}

      {step === 2 && (
        <form
          onSubmit={(e) => void handleFinishSetup(e)}
          noValidate
          className="bistro-card p-6 sm:p-8 space-y-5"
        >
          <div>
            <h2 className="text-[20px] font-bold text-[#111827]">Connect Google Maps Review Link</h2>
            <p className="mt-1 text-[13px] text-[#6B7280]">
              When guests tap &ldquo;Google Review&rdquo; on your table hub, they are guided here with their AI-polished draft copied to their clipboard.
            </p>
          </div>

          <div className="rounded-2xl border border-[#1E1B4B]/10 bg-[#F8F9FA] p-4 space-y-3">
            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                id="placeholderCheckbox"
                checked={usePlaceholder}
                onChange={(e) => setUsePlaceholder(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-[#1E1B4B]/30 text-[#1E1B4B] focus:ring-[#1E1B4B]"
              />
              <label htmlFor="placeholderCheckbox" className="text-[13px] text-[#111827] leading-normal">
                <strong>Start in Preview Mode (Add Google Link Later)</strong>
                <span className="block text-[#6B7280] mt-0.5">
                  Launch your Digital Menu, Table QRs, and Loyalty Hub right away and paste your official Google Maps review shortlink anytime in settings.
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
                placeholder="https://g.page/r/YOUR_RESTAURANT/review"
                required={!usePlaceholder}
              />

              <div className="rounded-2xl bg-[#1E1B4B]/[0.04] p-4 border border-[#1E1B4B]/10 text-[13px] text-[#111827] space-y-1.5">
                <p className="font-semibold text-[#111827] flex items-center gap-1.5">
                  <HelpCircle className="h-4 w-4 text-[#1E1B4B]" aria-hidden /> Where to find your link:
                </p>
                <p className="text-[#6B7280] text-[13px] leading-relaxed">
                  Search your restaurant on Google → click <strong>&ldquo;Ask for reviews&rdquo;</strong> in your Google Business Profile → copy the short link.
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
              Launch Workspace <Sparkles className="h-4 w-4" aria-hidden />
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
