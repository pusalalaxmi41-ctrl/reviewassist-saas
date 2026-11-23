import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import {
  Cake,
  Camera,
  Check,
  CheckCircle2,
  Clock,
  Coffee,
  Gift,
  Minus,
  Plus,
  QrCode,
  ShoppingBag,
  Smartphone,
  Sparkles,
  Star,
  UserCheck,
  X,
} from 'lucide-react';
import type { CafeCounterOrder, PublicCafeHubPayload } from '../types/cafe';
import { businessRepository } from '../services/storage';
import {
  getCafeMorningGreetingBanner,
  MONTH_OPTIONS,
  normalizeCafePhone,
} from '../utils/cafeValidation';
import { formatPriceFromPaise } from '../utils/restaurantValidation';
import { Button } from '../components/common/Button';

type CustomerCafeTab = 'pass' | 'order' | 'review';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface BarcodeDetectorLike {
  detect: (source: HTMLVideoElement) => Promise<Array<{ rawValue?: string }>>;
}

interface BarcodeDetectorCtor {
  new (options?: { formats?: string[] }): BarcodeDetectorLike;
}

interface StoredCafeGuest {
  phone: string;
  customerName: string;
}

function getGuestStorageKey(slug: string): string {
  return `vitaran_cafe_pass_v1_${slug.toLowerCase()}`;
}

function readStoredGuest(slug: string): StoredCafeGuest | null {
  try {
    const raw = localStorage.getItem(getGuestStorageKey(slug));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredCafeGuest>;
    const phone = normalizeCafePhone(parsed.phone ?? '');
    if (phone.length < 7) return null;
    return {
      phone,
      customerName: String(parsed.customerName ?? '').trim(),
    };
  } catch {
    return null;
  }
}

function writeStoredGuest(slug: string, guest: StoredCafeGuest | null): void {
  try {
    const key = getGuestStorageKey(slug);
    if (!guest) {
      localStorage.removeItem(key);
    } else {
      localStorage.setItem(key, JSON.stringify(guest));
    }
  } catch {
    // Ignore private-mode storage failures
  }
}

function parseCounterTokenFromRawValue(
  rawValue: string,
): { timeBucket: number; tokenSig: string } | null {
  try {
    const parsed = new URL(rawValue.trim());
    const tb = Number(parsed.searchParams.get('tb'));
    const sig = parsed.searchParams.get('sig')?.trim() ?? '';
    if (Number.isInteger(tb) && tb > 0 && /^[a-f0-9]{16}$/i.test(sig)) {
      return { timeBucket: tb, tokenSig: sig.toLowerCase() };
    }
    return null;
  } catch {
    return null;
  }
}

function getOrderStatusBadge(status: CafeCounterOrder['status']): {
  label: string;
  className: string;
} {
  switch (status) {
    case 'ready':
      return {
        label: 'Ready at Counter',
        className: 'bg-emerald-100 text-emerald-900 border-emerald-200',
      };
    case 'preparing':
      return {
        label: 'Brewing Now',
        className: 'bg-amber-100 text-amber-900 border-amber-200',
      };
    case 'picked_up':
      return {
        label: 'Picked Up',
        className: 'bg-slate-100 text-slate-700 border-slate-200',
      };
    case 'cancelled':
      return {
        label: 'Cancelled',
        className: 'bg-rose-100 text-rose-800 border-rose-200',
      };
    case 'queued':
    default:
      return {
        label: 'In Queue',
        className: 'bg-indigo-50 text-[#1E1B4B] border-indigo-200',
      };
  }
}

export default function CustomerCafeHubPage() {
  const { businessSlug = '' } = useParams<{ businessSlug: string }>();
  const [searchParams, setSearchParams] = useSearchParams();

  const [hub, setHub] = useState<PublicCafeHubPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFoundError, setNotFoundError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<CustomerCafeTab>('pass');

  // Persisted guest identity
  const [savedPhone, setSavedPhone] = useState<string>(() =>
    readStoredGuest(businessSlug)?.phone ?? '',
  );
  const [guestNameInput, setGuestNameInput] = useState<string>(() =>
    readStoredGuest(businessSlug)?.customerName ?? '',
  );
  const [phoneInput, setPhoneInput] = useState<string>(() =>
    readStoredGuest(businessSlug)?.phone ?? '',
  );
  const [birthMonth, setBirthMonth] = useState<string>('');
  const [birthDay, setBirthDay] = useState<string>('');
  const [showPhoneLookup, setShowPhoneLookup] = useState(false);

  // Rotating Counter QR token (from URL or in-page camera scanner)
  const urlTb = Number(searchParams.get('tb') ?? '0');
  const urlSig = (searchParams.get('sig') ?? '').trim().toLowerCase();
  const [scannedToken, setScannedToken] = useState<{
    timeBucket: number;
    tokenSig: string;
  } | null>(null);

  const activeCounterToken = useMemo(() => {
    if (scannedToken) return scannedToken;
    if (Number.isInteger(urlTb) && urlTb > 0 && /^[a-f0-9]{16}$/i.test(urlSig)) {
      return { timeBucket: urlTb, tokenSig: urlSig };
    }
    return null;
  }, [scannedToken, urlTb, urlSig]);

  // Stamp claim feedback
  const [claimingStamp, setClaimingStamp] = useState(false);
  const [stampMessage, setStampMessage] = useState<string | null>(null);
  const [stampError, setStampError] = useState<string | null>(null);

  // Add-to-Home-Screen PWA prompt + manual guide
  const [deferredInstallPrompt, setDeferredInstallPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [showHomeScreenGuide, setShowHomeScreenGuide] = useState(false);
  const [installFeedback, setInstallFeedback] = useState<string | null>(null);

  // Optional live QR scanner modal
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scannerError, setScannerError] = useState<string | null>(null);
  const [manualQrUrlInput, setManualQrUrlInput] = useState('');
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Counter Quick Order cart
  const [cart, setCart] = useState<Record<string, number>>({});
  const [orderName, setOrderName] = useState<string>(() =>
    readStoredGuest(businessSlug)?.customerName ?? '',
  );
  const [orderPhone, setOrderPhone] = useState<string>(() =>
    readStoredGuest(businessSlug)?.phone ?? '',
  );
  const [orderNote, setOrderNote] = useState('');
  const [submittingOrder, setSubmittingOrder] = useState(false);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [recentOrder, setRecentOrder] = useState<CafeCounterOrder | null>(null);

  const greetingBanner = useMemo(() => getCafeMorningGreetingBanner(), []);

  const loadHub = useCallback(
    async (phoneOverride?: string) => {
      if (!businessSlug) {
        setNotFoundError('Cafe link is incomplete.');
        setLoading(false);
        return;
      }
      try {
        const effectivePhone =
          phoneOverride !== undefined ? phoneOverride : savedPhone;
        const payload = await businessRepository.getPublicCafeHub(
          businessSlug,
          effectivePhone || undefined,
        );
        if (!payload) {
          setNotFoundError(
            'This cafe pass is not active right now. Please ask the barista at the counter.',
          );
          setHub(null);
        } else {
          setHub(payload);
          setNotFoundError(null);
          if (payload.pass) {
            setGuestNameInput((prev) => prev || payload.pass!.customerName);
            setOrderName((prev) => prev || payload.pass!.customerName);
            setOrderPhone((prev) => prev || payload.pass!.phone);
            if (payload.pass.birthMonth) {
              setBirthMonth(String(payload.pass.birthMonth));
            }
            if (payload.pass.birthDay) {
              setBirthDay(String(payload.pass.birthDay));
            }
          }
        }
      } catch (err) {
        setNotFoundError(
          (err as Error).message || 'Could not load this cafe pass.',
        );
      } finally {
        setLoading(false);
      }
    },
    [businessSlug, savedPhone],
  );

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(() => {
      if (!active) return;
      const stored = readStoredGuest(businessSlug);
      const initialPhone = stored?.phone ?? '';
      setSavedPhone(initialPhone);
      setPhoneInput(initialPhone);
      setGuestNameInput(stored?.customerName ?? '');
      setOrderName(stored?.customerName ?? '');
      setOrderPhone(initialPhone);
      void loadHub(initialPhone);
    }, 0);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [businessSlug, loadHub]);

  // Capture PWA Add-to-Home-Screen install prompt when supported (Chrome / Android / Edge)
  useEffect(() => {
    function handleBeforeInstallPrompt(e: Event) {
      e.preventDefault();
      setDeferredInstallPrompt(e as BeforeInstallPromptEvent);
    }
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => {
      window.removeEventListener(
        'beforeinstallprompt',
        handleBeforeInstallPrompt,
      );
    };
  }, []);

  // Optional live camera QR scanner (uses native BarcodeDetector when available)
  useEffect(() => {
    if (!scannerOpen) return;
    let active = true;
    let stream: MediaStream | null = null;
    let rafId = 0;

    async function startScanner() {
      setScannerError(null);
      const Detector = (
        window as unknown as { BarcodeDetector?: BarcodeDetectorCtor }
      ).BarcodeDetector;
      if (!Detector || !navigator.mediaDevices?.getUserMedia) {
        setScannerError(
          'Your phone camera scans counter QRs directly from the built-in Camera app — or paste the counter QR link below.',
        );
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
          audio: false,
        });
        if (!active || !videoRef.current) return;
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        const detector = new Detector({ formats: ['qr_code'] });

        const tick = async () => {
          if (!active || !videoRef.current) return;
          try {
            const codes = await detector.detect(videoRef.current);
            for (const code of codes) {
              if (!code.rawValue) continue;
              const token = parseCounterTokenFromRawValue(code.rawValue);
              if (token) {
                setScannedToken(token);
                setScannerOpen(false);
                setStampError(null);
                return;
              }
            }
          } catch {
            // Keep scanning smoothly
          }
          rafId = requestAnimationFrame(() => {
            void tick();
          });
        };
        rafId = requestAnimationFrame(() => {
          void tick();
        });
      } catch {
        setScannerError(
          'Camera permission was declined. Use your phone Camera app to scan the counter QR, or paste the link below.',
        );
      }
    }

    void startScanner();
    return () => {
      active = false;
      if (rafId) cancelAnimationFrame(rafId);
      if (stream) {
        for (const track of stream.getTracks()) track.stop();
      }
    };
  }, [scannerOpen]);

  async function handleSaveToHomeScreen() {
    setInstallFeedback(null);
    if (deferredInstallPrompt) {
      await deferredInstallPrompt.prompt();
      const choice = await deferredInstallPrompt.userChoice;
      setDeferredInstallPrompt(null);
      if (choice.outcome === 'accepted') {
        setInstallFeedback('Coffee Pass pinned to your phone Home Screen!');
        return;
      }
    }
    setShowHomeScreenGuide((prev) => !prev);
  }

  async function handleLookupPass(e: FormEvent) {
    e.preventDefault();
    setStampError(null);
    const cleaned = normalizeCafePhone(phoneInput);
    if (cleaned.length < 7) {
      setStampError('Please enter a valid 10-digit mobile number.');
      return;
    }
    setSavedPhone(cleaned);
    writeStoredGuest(businessSlug, {
      phone: cleaned,
      customerName: guestNameInput.trim(),
    });
    setShowPhoneLookup(false);
    await loadHub(cleaned);
  }

  function handleSwitchGuest() {
    writeStoredGuest(businessSlug, null);
    setSavedPhone('');
    setPhoneInput('');
    setGuestNameInput('');
    setBirthMonth('');
    setBirthDay('');
    setShowPhoneLookup(true);
    void loadHub('');
  }

  async function handleClaimStamp(e: FormEvent) {
    e.preventDefault();
    if (!hub || !activeCounterToken) return;
    setStampError(null);
    setStampMessage(null);

    const cleanedPhone = normalizeCafePhone(phoneInput || savedPhone);
    const cleanedName = (guestNameInput || hub.pass?.customerName || '').trim();
    if (cleanedPhone.length < 7) {
      setStampError('Enter your mobile number to link your Coffee Stamp Card.');
      return;
    }
    if (cleanedName.length < 2) {
      setStampError('Enter your name so we can personalize your pass.');
      return;
    }

    const parsedMonth = birthMonth ? Number(birthMonth) : null;
    const parsedDay = birthDay ? Number(birthDay) : null;
    if ((parsedMonth && !parsedDay) || (!parsedMonth && parsedDay)) {
      setStampError(
        'Please pick both Birthday Month and Day (or leave both blank).',
      );
      return;
    }

    setClaimingStamp(true);
    try {
      const res = await businessRepository.claimCafeCounterStamp({
        businessSlug,
        customerName: cleanedName,
        phone: cleanedPhone,
        timeBucket: activeCounterToken.timeBucket,
        tokenSig: activeCounterToken.tokenSig,
        birthMonth: parsedMonth,
        birthDay: parsedDay,
      });

      setSavedPhone(res.pass.phone);
      setPhoneInput(res.pass.phone);
      setGuestNameInput(res.pass.customerName);
      setOrderName((prev) => prev || res.pass.customerName);
      setOrderPhone((prev) => prev || res.pass.phone);
      writeStoredGuest(businessSlug, {
        phone: res.pass.phone,
        customerName: res.pass.customerName,
      });

      setScannedToken(null);
      if (searchParams.has('tb') || searchParams.has('sig')) {
        setSearchParams({}, { replace: true });
      }

      if (res.justUnlockedFreeDrink) {
        setStampMessage(
          `Congratulations! You unlocked a FREE ${hub.config.rewardDrinkName}! Show code ${res.pass.passCode} at the counter anytime.`,
        );
      } else {
        const remaining = Math.max(
          0,
          res.stampsRequired - res.pass.currentStamps,
        );
        setStampMessage(
          `+1 Stamp collected! ${remaining} more ${remaining === 1 ? 'stamp' : 'stamps'} to unlock your free ${hub.config.rewardDrinkName}.`,
        );
      }

      await loadHub(res.pass.phone);
    } catch (err) {
      setStampError(
        (err as Error).message ||
          'Could not verify this counter QR. Please scan the fresh QR at the counter.',
      );
    } finally {
      setClaimingStamp(false);
    }
  }

  function handleApplyManualQrLink(e: FormEvent) {
    e.preventDefault();
    const token = parseCounterTokenFromRawValue(manualQrUrlInput);
    if (!token) {
      setScannerError(
        'That link does not contain a valid live counter stamp token (?tb=...&sig=...).',
      );
      return;
    }
    setScannedToken(token);
    setManualQrUrlInput('');
    setScannerOpen(false);
    setStampError(null);
  }

  function updateCartQty(itemId: string, delta: number) {
    setCart((prev) => {
      const nextQty = (prev[itemId] ?? 0) + delta;
      if (nextQty <= 0) {
        const clone = { ...prev };
        delete clone[itemId];
        return clone;
      }
      return { ...prev, [itemId]: Math.min(20, nextQty) };
    });
  }

  const cartSummary = useMemo(() => {
    if (!hub) return { count: 0, subtotalPaise: 0, lines: [] as Array<{ itemId: string; name: string; quantity: number; pricePaise: number }> };
    const lines: Array<{
      itemId: string;
      name: string;
      quantity: number;
      pricePaise: number;
    }> = [];
    let count = 0;
    let subtotalPaise = 0;
    for (const item of hub.items) {
      const qty = cart[item.id] ?? 0;
      if (qty > 0) {
        count += qty;
        subtotalPaise += item.pricePaise * qty;
        lines.push({
          itemId: item.id,
          name: item.name,
          quantity: qty,
          pricePaise: item.pricePaise,
        });
      }
    }
    return { count, subtotalPaise, lines };
  }, [hub, cart]);

  async function handleSubmitOrder(e: FormEvent) {
    e.preventDefault();
    if (!hub || cartSummary.lines.length === 0) return;
    setOrderError(null);

    const cleanedName = (
      orderName ||
      guestNameInput ||
      hub.pass?.customerName ||
      ''
    ).trim();
    if (cleanedName.length < 2) {
      setOrderError('Please enter your name for pickup call-out.');
      return;
    }

    setSubmittingOrder(true);
    try {
      const order = await businessRepository.submitCafeCounterOrder({
        businessSlug,
        customerName: cleanedName,
        phone: orderPhone || savedPhone || null,
        items: cartSummary.lines,
        orderNote: orderNote.trim() || null,
      });
      setRecentOrder(order);
      setCart({});
      setOrderNote('');
      await loadHub(savedPhone || normalizeCafePhone(orderPhone));
    } catch (err) {
      setOrderError(
        (err as Error).message || 'Could not place your counter order.',
      );
    } finally {
      setSubmittingOrder(false);
    }
  }

  if (loading) {
    return (
      <div className="py-20 text-center" role="status">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-[#1E1B4B] border-r-transparent" />
        <p className="mt-3 text-[13.5px] font-medium text-slate-500">
          Opening your Coffee Stamp Pass…
        </p>
      </div>
    );
  }

  if (notFoundError || !hub) {
    return (
      <div className="mx-auto w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center space-y-3">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
          <Coffee className="h-6 w-6" aria-hidden />
        </div>
        <h1 className="text-[19px] font-bold text-[#111827]">
          Cafe Pass Unavailable
        </h1>
        <p className="text-[13.5px] text-slate-500 leading-relaxed">
          {notFoundError || 'This cafe hub could not be found.'}
        </p>
      </div>
    );
  }

  const pass = hub.pass;
  const stampsRequired = hub.config.stampsRequired;
  const collectedStamps = pass?.currentStamps ?? 0;
  const stampsLeft = Math.max(0, stampsRequired - collectedStamps);
  const birthdayLabel =
    pass?.birthMonth && pass?.birthDay
      ? `${MONTH_OPTIONS.find((m) => m.value === pass.birthMonth)?.label ?? ''} ${pass.birthDay}`
      : null;

  const groupedMenu = hub.categories
    .map((cat) => ({
      category: cat,
      items: hub.items.filter(
        (item) => item.categoryId === cat.id && item.isAvailable !== false,
      ),
    }))
    .filter((group) => group.items.length > 0);

  return (
    <div className="mx-auto w-full max-w-md space-y-4">
      {/* 1. DYNAMIC MORNING / WALK-BY RE-ENGAGEMENT BANNER */}
      <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 flex items-start gap-3">
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#1E1B4B] text-[#D2DB76]">
          <Coffee className="h-4 w-4" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-bold text-[#111827]">
            {greetingBanner.title}
          </p>
          <p className="text-[12px] text-slate-500 leading-snug mt-0.5">
            {greetingBanner.subtitle}
          </p>
        </div>
      </div>

      {/* 2. AUTOMATIC BIRTHDAY FREE COFFEE BANNER */}
      {pass?.isBirthdayToday && (
        <div
          role="status"
          className="rounded-xl border-2 border-[#D2DB76] bg-[#1E1B4B] p-4 text-white space-y-2"
        >
          <div className="flex items-center gap-2 text-[#D2DB76]">
            <Cake className="h-5 w-5 shrink-0" aria-hidden />
            <span className="text-[11px] font-bold uppercase tracking-wider">
              Birthday Voucher Unlocked Today
            </span>
          </div>
          <h2 className="text-[18px] font-bold leading-tight">
            Happy Birthday, {pass.customerName}! Today, your coffee&apos;s on us.
          </h2>
          <p className="text-[12.5px] text-indigo-100 leading-relaxed">
            Enjoy 1 complimentary{' '}
            <strong className="text-[#D2DB76]">
              {hub.config.birthdayDrinkName}
            </strong>
            . Show your pass code{' '}
            <span className="rounded bg-white/15 px-1.5 py-0.5 font-mono font-bold text-[#D2DB76]">
              {pass.passCode}
            </span>{' '}
            at the counter to claim!
          </p>
        </div>
      )}

      {/* 3. WALLET-STYLE DIGITAL COFFEE STAMP CARD */}
      <section
        aria-label="Digital Coffee Stamp Card"
        className="overflow-hidden rounded-2xl border border-[#1E1B4B] bg-[#1E1B4B] text-white shadow-sm"
      >
        {/* Top Pass Strip */}
        <div className="flex items-start justify-between gap-3 border-b border-white/10 px-5 py-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-[#D2DB76] text-[#1E1B4B]">
                <Coffee className="h-3.5 w-3.5" aria-hidden />
              </span>
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#D2DB76]">
                Coffee Stamp Pass
              </span>
            </div>
            <h1 className="mt-1.5 truncate text-[20px] font-bold tracking-tight">
              {hub.business.name}
            </h1>
            <p className="text-[12px] text-indigo-200">
              {hub.tagline || `${hub.business.city} · Counter Loyalty Pass`}
            </p>
          </div>
          <div className="text-right shrink-0">
            <span className="inline-block rounded-lg border border-white/15 bg-white/10 px-2.5 py-1 font-mono text-[12px] font-bold text-[#D2DB76]">
              {pass ? pass.passCode : 'NEW PASS'}
            </span>
            {pass && (
              <p className="mt-1 text-[11px] text-indigo-200 truncate max-w-[120px]">
                {pass.customerName}
              </p>
            )}
          </div>
        </div>

        {/* Visual Coffee Stamp Grid */}
        <div className="px-5 py-4 space-y-4">
          {pass && pass.freeDrinksAvailable > 0 && (
            <div className="flex items-center justify-between gap-2 rounded-xl bg-[#D2DB76] px-3.5 py-2.5 text-[#1E1B4B]">
              <div className="flex items-center gap-2">
                <Gift className="h-4.5 w-4.5 shrink-0" aria-hidden />
                <span className="text-[13px] font-bold">
                  {pass.freeDrinksAvailable} Free{' '}
                  {pass.freeDrinksAvailable === 1 ? 'Drink' : 'Drinks'} Ready!
                </span>
              </div>
              <span className="rounded-md bg-[#1E1B4B] px-2 py-0.5 text-[11px] font-bold text-[#D2DB76]">
                Show at Counter
              </span>
            </div>
          )}

          <div
            className="grid gap-2.5"
            style={{
              gridTemplateColumns: `repeat(${Math.min(5, Math.max(4, Math.ceil(stampsRequired / 2)))}, minmax(0, 1fr))`,
            }}
          >
            {Array.from({ length: stampsRequired }).map((_, idx) => {
              const filled = idx < collectedStamps;
              const isRewardSlot = idx === stampsRequired - 1;
              return (
                <div
                  key={idx}
                  className={`flex aspect-square flex-col items-center justify-center rounded-xl border transition-colors ${
                    filled
                      ? 'border-[#D2DB76] bg-[#D2DB76] text-[#1E1B4B]'
                      : isRewardSlot
                        ? 'border-dashed border-[#D2DB76]/60 bg-white/5 text-[#D2DB76]'
                        : 'border-white/15 bg-white/5 text-indigo-200/70'
                  }`}
                >
                  {filled ? (
                    <Check className="h-5 w-5 stroke-[2.5]" aria-hidden />
                  ) : isRewardSlot ? (
                    <Gift className="h-4.5 w-4.5" aria-hidden />
                  ) : (
                    <Coffee className="h-4 w-4 opacity-70" aria-hidden />
                  )}
                  <span className="mt-0.5 text-[10px] font-bold tabular-nums">
                    {isRewardSlot && !filled ? 'FREE' : idx + 1}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-between gap-2 text-[12.5px]">
            <span className="font-semibold text-white">
              {collectedStamps} / {stampsRequired} Stamps
            </span>
            <span className="text-indigo-200">
              {stampsLeft === 0
                ? 'Reward unlocked!'
                : `${stampsLeft} more for free drink`}
            </span>
          </div>
        </div>

        {/* Bottom Wallet Controls */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 bg-black/15 px-4 py-3">
          <button
            type="button"
            onClick={() => void handleSaveToHomeScreen()}
            className="inline-flex h-8.5 items-center gap-1.5 rounded-lg bg-[#D2DB76] px-3 text-[12px] font-bold text-[#1E1B4B] hover:bg-[#c5cf62] cursor-pointer"
          >
            <Smartphone className="h-3.5 w-3.5" aria-hidden />
            Save Pass to Home Screen
          </button>

          {pass ? (
            <button
              type="button"
              onClick={handleSwitchGuest}
              className="inline-flex h-8.5 items-center gap-1 rounded-lg border border-white/15 px-2.5 text-[11.5px] font-semibold text-indigo-100 hover:bg-white/10 cursor-pointer"
            >
              Switch Phone
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setShowPhoneLookup((v) => !v)}
              className="inline-flex h-8.5 items-center gap-1 rounded-lg border border-white/15 px-2.5 text-[11.5px] font-semibold text-indigo-100 hover:bg-white/10 cursor-pointer"
            >
              <UserCheck className="h-3.5 w-3.5" aria-hidden />
              Open Saved Pass
            </button>
          )}
        </div>
      </section>

      {installFeedback && (
        <div
          role="status"
          className="rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-[12.5px] font-semibold text-emerald-900 flex items-center gap-2"
        >
          <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden />
          <span>{installFeedback}</span>
        </div>
      )}

      {/* Save-to-Home-Screen 2-step guide (for iPhone Safari / browsers without beforeinstallprompt) */}
      {showHomeScreenGuide && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-2.5">
          <div className="flex items-center justify-between">
            <p className="text-[13px] font-bold text-[#111827] flex items-center gap-1.5">
              <Smartphone className="h-4 w-4 text-[#1E1B4B]" aria-hidden />
              Pin Your Coffee Card to Home Screen
            </p>
            <button
              type="button"
              onClick={() => setShowHomeScreenGuide(false)}
              className="rounded p-1 text-slate-400 hover:bg-slate-100 cursor-pointer"
              aria-label="Close Home Screen guide"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>
          <ol className="space-y-1.5 text-[12.5px] text-slate-600 list-decimal pl-4">
            <li>
              <strong>iPhone (Safari):</strong> Tap the{' '}
              <strong>Share</strong> icon at the bottom → tap{' '}
              <strong>Add to Home Screen</strong>.
            </li>
            <li>
              <strong>Android (Chrome):</strong> Tap the{' '}
              <strong>⋮ Menu</strong> top-right → tap{' '}
              <strong>Add to Home screen</strong> / <strong>Install App</strong>.
            </li>
          </ol>
          <p className="text-[11.5px] text-slate-500">
            Your stamp progress stays saved on this phone automatically — no app
            download required!
          </p>
        </div>
      )}

      {/* 4. LIVE COUNTER QR STAMP CLAIM CARD (SHOWN WHEN SCANNED WITH ?tb=...&sig=...) */}
      {activeCounterToken && (
        <form
          onSubmit={(e) => void handleClaimStamp(e)}
          className="rounded-xl border-2 border-[#1E1B4B] bg-white p-4 space-y-3.5"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#D2DB76] text-[#1E1B4B]">
                <QrCode className="h-4 w-4" aria-hidden />
              </span>
              <div>
                <h2 className="text-[14.5px] font-bold text-[#111827]">
                  Counter QR Verified · Claim +1 Stamp
                </h2>
                <p className="text-[11.5px] text-slate-500">
                  {pass
                    ? `Crediting pass ${pass.passCode} (${pass.customerName})`
                    : 'Enter your details once — future visits are 1-tap!'}
                </p>
              </div>
            </div>
          </div>

          {!pass && (
            <div className="grid gap-2.5 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="block text-[11.5px] font-semibold text-slate-700">
                  Your Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Aarav"
                  value={guestNameInput}
                  onChange={(e) => setGuestNameInput(e.target.value)}
                  className="h-9.5 w-full rounded-lg border border-slate-300 px-3 text-[13px] text-[#111827] focus:border-[#1E1B4B] focus:outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-[11.5px] font-semibold text-slate-700">
                  Mobile Number *
                </label>
                <input
                  type="tel"
                  required
                  placeholder="10-digit mobile"
                  value={phoneInput}
                  onChange={(e) => setPhoneInput(e.target.value)}
                  className="h-9.5 w-full rounded-lg border border-slate-300 px-3 text-[13px] text-[#111827] focus:border-[#1E1B4B] focus:outline-none"
                />
              </div>
            </div>
          )}

          {/* Optional Birthday Capture for Automatic Free Birthday Coffee */}
          {hub.config.birthdayFreeCoffeeEnabled && !birthdayLabel && (
            <div className="rounded-lg border border-amber-200 bg-amber-50/70 p-3 space-y-2">
              <p className="text-[12px] font-semibold text-amber-950 flex items-center gap-1.5">
                <Cake className="h-3.5 w-3.5 text-amber-700" aria-hidden />
                Add your Birthday for a Free Birthday Coffee every year!
              </p>
              <div className="grid grid-cols-2 gap-2">
                <select
                  aria-label="Birthday Month"
                  value={birthMonth}
                  onChange={(e) => setBirthMonth(e.target.value)}
                  className="h-9 rounded-lg border border-amber-300 bg-white px-2.5 text-[12.5px] font-medium text-[#111827]"
                >
                  <option value="">Month (Optional)</option>
                  {MONTH_OPTIONS.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
                <select
                  aria-label="Birthday Day"
                  value={birthDay}
                  onChange={(e) => setBirthDay(e.target.value)}
                  className="h-9 rounded-lg border border-amber-300 bg-white px-2.5 text-[12.5px] font-medium text-[#111827]"
                >
                  <option value="">Day (Optional)</option>
                  {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
                    <option key={day} value={day}>
                      {day}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          <Button
            type="submit"
            variant="primary"
            className="w-full"
            loading={claimingStamp}
          >
            <CheckCircle2 className="h-4 w-4" aria-hidden />
            {pass ? 'Collect +1 Coffee Stamp Now' : 'Create Pass & Collect +1 Stamp'}
          </Button>
        </form>
      )}

      {/* Feedback Alerts */}
      {stampMessage && (
        <div
          role="status"
          className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-[13px] font-semibold text-emerald-900 flex items-start gap-2"
        >
          <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" aria-hidden />
          <span>{stampMessage}</span>
        </div>
      )}

      {stampError && (
        <div
          role="alert"
          className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-[13px] font-medium text-rose-800"
        >
          {stampError}
        </div>
      )}

      {/* Phone Lookup Drawer (when returning guest wants to load existing pass) */}
      {showPhoneLookup && !activeCounterToken && (
        <form
          onSubmit={(e) => void handleLookupPass(e)}
          className="rounded-xl border border-slate-200 bg-white p-4 space-y-3"
        >
          <div className="flex items-center justify-between">
            <p className="text-[13.5px] font-bold text-[#111827]">
              Find Your Saved Coffee Pass
            </p>
            <button
              type="button"
              onClick={() => setShowPhoneLookup(false)}
              className="rounded p-1 text-slate-400 hover:bg-slate-100 cursor-pointer"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>
          <div className="flex gap-2">
            <input
              type="tel"
              required
              placeholder="Enter 10-digit mobile number"
              value={phoneInput}
              onChange={(e) => setPhoneInput(e.target.value)}
              className="h-9.5 flex-1 rounded-lg border border-slate-300 px-3 text-[13px] text-[#111827] focus:border-[#1E1B4B] focus:outline-none"
            />
            <Button type="submit" variant="primary">
              Load Pass
            </Button>
          </div>
        </form>
      )}

      {/* 5. THREE CLEAN NAVIGATION TABS */}
      <div className="grid grid-cols-3 rounded-xl border border-slate-200 bg-white p-1">
        {(
          [
            { id: 'pass', label: 'Stamp Card', Icon: Coffee },
            {
              id: 'order',
              label:
                cartSummary.count > 0
                  ? `Order (${cartSummary.count})`
                  : 'Quick Order',
              Icon: ShoppingBag,
            },
            { id: 'review', label: 'Review', Icon: Star },
          ] as const
        ).map(({ id, label, Icon }) => {
          const active = activeTab === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setActiveTab(id)}
              className={`inline-flex h-9.5 items-center justify-center gap-1.5 rounded-lg text-[12.5px] font-semibold transition-colors cursor-pointer ${
                active
                  ? 'bg-[#1E1B4B] text-white'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-[#111827]'
              }`}
            >
              <Icon
                className={`h-3.5 w-3.5 ${active ? 'text-[#D2DB76]' : ''}`}
                aria-hidden
              />
              <span>{label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: MY STAMP CARD & PERKS */}
      {activeTab === 'pass' && (
        <div className="space-y-3">
          {!activeCounterToken && (
            <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-[14.5px] font-bold text-[#111827]">
                    Ready for Today&apos;s Coffee Stamp?
                  </h2>
                  <p className="mt-0.5 text-[12.5px] text-slate-500">
                    Scan the live 30-second QR displayed on the cafe counter
                    screen after ordering.
                  </p>
                </div>
                <QrCode className="h-5 w-5 shrink-0 text-[#1E1B4B]" aria-hidden />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="primary"
                  className="flex-1"
                  onClick={() => setScannerOpen(true)}
                >
                  <Camera className="h-4 w-4" aria-hidden /> Scan Live Counter QR
                </Button>
                {!pass && (
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setShowPhoneLookup(true)}
                  >
                    Enter Phone
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Reward Rules & Birthday Perk Card */}
          <div className="rounded-xl border border-slate-200 bg-white divide-y divide-slate-100">
            <div className="p-4 flex items-start gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-[#1E1B4B]">
                <Gift className="h-4 w-4" aria-hidden />
              </span>
              <div>
                <p className="text-[13px] font-bold text-[#111827]">
                  Collect {stampsRequired} Stamps → Free Drink
                </p>
                <p className="text-[12px] text-slate-500 mt-0.5">
                  Reward: {hub.config.rewardDrinkName}
                </p>
              </div>
            </div>

            {hub.config.birthdayFreeCoffeeEnabled && (
              <div className="p-4 flex items-start gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-700">
                  <Cake className="h-4 w-4" aria-hidden />
                </span>
                <div>
                  <p className="text-[13px] font-bold text-[#111827]">
                    Birthday Free Coffee Perk
                  </p>
                  <p className="text-[12px] text-slate-500 mt-0.5">
                    {birthdayLabel
                      ? `Saved Birthday: ${birthdayLabel} — automatic free ${hub.config.birthdayDrinkName} unlocks on your date every year.`
                      : `Add your birthday on your next stamp scan to unlock a free ${hub.config.birthdayDrinkName} every year.`}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Active Pickup Tokens Today */}
          {(recentOrder || hub.todayOrders.length > 0) && (
            <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-[13.5px] font-bold text-[#111827] flex items-center gap-1.5">
                  <Clock className="h-4 w-4 text-[#1E1B4B]" aria-hidden />
                  Your Counter Pickup Tokens Today
                </h3>
              </div>
              <div className="space-y-2">
                {(recentOrder
                  ? [
                      recentOrder,
                      ...hub.todayOrders.filter((o) => o.id !== recentOrder.id),
                    ]
                  : hub.todayOrders
                ).map((ord) => {
                  const badge = getOrderStatusBadge(ord.status);
                  return (
                    <div
                      key={ord.id}
                      className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5"
                    >
                      <div>
                        <span className="font-mono text-[15px] font-extrabold text-[#1E1B4B]">
                          {ord.tokenCode}
                        </span>
                        <p className="text-[11.5px] text-slate-500">
                          {ord.items
                            .map((i) => `${i.quantity}× ${i.name}`)
                            .join(', ')}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 rounded-md border px-2 py-0.5 text-[11px] font-semibold ${badge.className}`}
                      >
                        {badge.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: COUNTER QUICK ORDER */}
      {activeTab === 'order' && (
        <div className="space-y-4">
          {recentOrder && (
            <div
              role="status"
              className="rounded-xl border-2 border-[#1E1B4B] bg-[#1E1B4B] p-4 text-white space-y-2"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#D2DB76]">
                  Order Sent to Barista
                </span>
                <span className="rounded-md bg-[#D2DB76] px-2.5 py-0.5 font-mono text-[15px] font-extrabold text-[#1E1B4B]">
                  {recentOrder.tokenCode}
                </span>
              </div>
              <p className="text-[13px] text-indigo-100">
                Listen for token <strong>{recentOrder.tokenCode}</strong> (
                {recentOrder.customerName}) at the pickup counter. Total:{' '}
                <strong>
                  {formatPriceFromPaise(
                    recentOrder.subtotalPaise,
                    hub.currencyCode,
                  )}
                </strong>
                .
              </p>
            </div>
          )}

          {groupedMenu.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white p-8 text-center space-y-2">
              <Coffee className="mx-auto h-7 w-7 text-slate-400" aria-hidden />
              <p className="text-[14px] font-bold text-[#111827]">
                Order Directly at the Counter
              </p>
              <p className="text-[12.5px] text-slate-500">
                The barista hasn&apos;t published mobile quick-order items yet.
                Place your order at the counter and scan for your stamp!
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {groupedMenu.map(({ category, items }) => (
                <div
                  key={category.id}
                  className="rounded-xl border border-slate-200 bg-white overflow-hidden"
                >
                  <div className="border-b border-slate-100 bg-slate-50 px-4 py-2.5">
                    <h2 className="text-[13px] font-bold uppercase tracking-wider text-[#1E1B4B]">
                      {category.name}
                    </h2>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {items.map((item) => {
                      const qty = cart[item.id] ?? 0;
                      return (
                        <div
                          key={item.id}
                          className="flex items-center justify-between gap-3 px-4 py-3"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="text-[13.5px] font-bold text-[#111827]">
                              {item.name}
                            </p>
                            {item.description && (
                              <p className="text-[11.5px] text-slate-500 line-clamp-2 mt-0.5">
                                {item.description}
                              </p>
                            )}
                            <p className="mt-1 text-[13px] font-bold text-[#1E1B4B] tabular-nums">
                              {formatPriceFromPaise(
                                item.pricePaise,
                                hub.currencyCode,
                              )}
                            </p>
                          </div>

                          {qty === 0 ? (
                            <button
                              type="button"
                              onClick={() => updateCartQty(item.id, 1)}
                              className="inline-flex h-8.5 items-center gap-1 rounded-lg border border-[#1E1B4B] bg-white px-3 text-[12px] font-bold text-[#1E1B4B] hover:bg-[#1E1B4B] hover:text-white transition-colors cursor-pointer"
                            >
                              <Plus className="h-3.5 w-3.5" aria-hidden /> Add
                            </button>
                          ) : (
                            <div className="inline-flex items-center gap-2 rounded-lg border border-[#1E1B4B] bg-[#1E1B4B] p-1 text-white">
                              <button
                                type="button"
                                onClick={() => updateCartQty(item.id, -1)}
                                className="flex h-6.5 w-6.5 items-center justify-center rounded bg-white/10 hover:bg-white/20 cursor-pointer"
                                aria-label={`Decrease ${item.name}`}
                              >
                                <Minus className="h-3.5 w-3.5" aria-hidden />
                              </button>
                              <span className="min-w-[18px] text-center text-[12.5px] font-bold tabular-nums">
                                {qty}
                              </span>
                              <button
                                type="button"
                                onClick={() => updateCartQty(item.id, 1)}
                                className="flex h-6.5 w-6.5 items-center justify-center rounded bg-[#D2DB76] text-[#1E1B4B] cursor-pointer"
                                aria-label={`Increase ${item.name}`}
                              >
                                <Plus className="h-3.5 w-3.5" aria-hidden />
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}

              {/* Checkout Box when cart has items */}
              {cartSummary.count > 0 && (
                <form
                  onSubmit={(e) => void handleSubmitOrder(e)}
                  className="rounded-xl border-2 border-[#1E1B4B] bg-white p-4 space-y-3"
                >
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                    <span className="text-[13.5px] font-bold text-[#111827]">
                      Counter Pickup ({cartSummary.count}{' '}
                      {cartSummary.count === 1 ? 'item' : 'items'})
                    </span>
                    <span className="text-[15px] font-extrabold text-[#1E1B4B] tabular-nums">
                      {formatPriceFromPaise(
                        cartSummary.subtotalPaise,
                        hub.currencyCode,
                      )}
                    </span>
                  </div>

                  <div className="grid gap-2.5 sm:grid-cols-2">
                    <input
                      type="text"
                      required
                      placeholder="Your Name for Pickup *"
                      value={orderName}
                      onChange={(e) => setOrderName(e.target.value)}
                      className="h-9.5 rounded-lg border border-slate-300 px-3 text-[13px] text-[#111827]"
                    />
                    <input
                      type="tel"
                      placeholder="Mobile (Optional)"
                      value={orderPhone}
                      onChange={(e) => setOrderPhone(e.target.value)}
                      className="h-9.5 rounded-lg border border-slate-300 px-3 text-[13px] text-[#111827]"
                    />
                  </div>
                  <input
                    type="text"
                    placeholder="Barista note (e.g. Oat milk, less sugar, extra hot)"
                    value={orderNote}
                    onChange={(e) => setOrderNote(e.target.value)}
                    className="h-9.5 w-full rounded-lg border border-slate-300 px-3 text-[13px] text-[#111827]"
                  />

                  {orderError && (
                    <p role="alert" className="text-[12px] font-medium text-rose-700">
                      {orderError}
                    </p>
                  )}

                  <Button
                    type="submit"
                    variant="primary"
                    className="w-full"
                    loading={submittingOrder}
                  >
                    Place Counter Order &amp; Get Token →
                  </Button>
                </form>
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: LEAVE A GOOGLE REVIEW (SHARED AI ENGINE) */}
      {activeTab === 'review' && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 text-center space-y-4">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-[#1E1B4B] text-[#D2DB76]">
            <Sparkles className="h-6 w-6" aria-hidden />
          </div>
          <div className="space-y-1">
            <h2 className="text-[17px] font-bold text-[#111827]">
              Loved Your Brew at {hub.business.name}?
            </h2>
            <p className="text-[13px] text-slate-500 leading-relaxed">
              Share a quick 10-second Google review with our AI helper — it
              really supports our local baristas!
            </p>
          </div>
          <Link
            to={`/r/${hub.business.slug}`}
            className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-[#1E1B4B] px-4 text-[13.5px] font-semibold text-white hover:bg-[#2E2A6E]"
          >
            <Star className="h-4 w-4 text-[#D2DB76]" aria-hidden />
            Write a Quick Google Review
          </Link>
        </div>
      )}

      {/* OPTIONAL IN-PAGE QR SCANNER MODAL */}
      {scannerOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Scan Counter QR Code"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-[2px]"
        >
          <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="text-[15px] font-bold text-[#111827] flex items-center gap-2">
                <Camera className="h-4 w-4 text-[#1E1B4B]" aria-hidden />
                Scan Live Counter QR
              </h2>
              <button
                type="button"
                onClick={() => setScannerOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 cursor-pointer"
                aria-label="Close scanner"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>

            <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-950 aspect-square flex items-center justify-center">
              <video
                ref={videoRef}
                muted
                playsInline
                className="h-full w-full object-cover"
              />
            </div>

            {scannerError && (
              <p className="rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-[12px] text-amber-900">
                {scannerError}
              </p>
            )}

            <form onSubmit={handleApplyManualQrLink} className="space-y-2">
              <label className="block text-[11.5px] font-semibold text-slate-600">
                Or paste counter QR link
              </label>
              <div className="flex gap-2">
                <input
                  type="url"
                  placeholder="https://.../r/.../cafe?tb=...&sig=..."
                  value={manualQrUrlInput}
                  onChange={(e) => setManualQrUrlInput(e.target.value)}
                  className="h-9 flex-1 rounded-lg border border-slate-300 px-2.5 text-[12px]"
                />
                <Button type="submit" variant="secondary">
                  Verify
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
