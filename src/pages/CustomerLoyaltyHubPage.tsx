import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  Check,
  CheckCircle2,
  Clock,
  Copy,
  ExternalLink,
  Gift,
  KeyRound,
  Loader2,
  RefreshCw,
  SearchX,
  ShieldCheck,
  Sparkles,
  Star,
  UserCheck,
  XCircle,
} from 'lucide-react';
import type { PublicLoyaltyHubPayload } from '../types/loyalty';
import type { ExperienceRating } from '../types/business';
import { businessRepository, PLACEHOLDER_GOOGLE_REVIEW_URL } from '../services/storage';
import { aiProvider } from '../services/ai';
import {
  RATING_OPTIONS,
  getCategoryExperience,
} from '../config/reviewExperience';
import { loadBusinessQRSettings } from '../services/qr/qrGenerator';
import { normalizeLoyaltyPhone } from '../utils/loyaltyValidation';
import { copyText } from '../utils/clipboard';

interface StoredLoyaltyMember {
  phone: string;
  customerName: string;
}

function getStorageKey(slug: string): string {
  return `vitaran_loyalty_wallet_v1_${slug.toLowerCase()}`;
}

function readStoredMember(slug: string): StoredLoyaltyMember | null {
  try {
    const raw = localStorage.getItem(getStorageKey(slug));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredLoyaltyMember>;
    const phone = normalizeLoyaltyPhone(parsed.phone ?? '');
    if (phone.length < 7) return null;
    return {
      phone,
      customerName: String(parsed.customerName ?? '').trim(),
    };
  } catch {
    return null;
  }
}

function writeStoredMember(slug: string, member: StoredLoyaltyMember | null): void {
  try {
    const key = getStorageKey(slug);
    if (!member) {
      localStorage.removeItem(key);
    } else {
      localStorage.setItem(key, JSON.stringify(member));
    }
  } catch {
    // ignore storage errors
  }
}

function isCooldownMessage(message: string): boolean {
  const lower = message.toLowerCase();
  return lower.includes('cooldown') || lower.includes('already earned');
}

function formatNextEligibleVisit(
  lastStarIso: string | null,
  cooldownHours: number,
  nowMs: number,
): string | null {
  if (!lastStarIso) return null;
  const lastMs = new Date(lastStarIso).getTime();
  if (Number.isNaN(lastMs)) return null;
  const eligibleMs = lastMs + cooldownHours * 3600_000;
  const diffMs = eligibleMs - nowMs;
  if (diffMs <= 0) return null;
  const mins = Math.ceil(diffMs / 60_000);
  if (mins < 60) return `Eligible again in ~${mins} min${mins === 1 ? '' : 's'}`;
  const hrs = Math.ceil(mins / 60);
  return `Next visit eligible around ${new Date(eligibleMs).toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  })} (~${hrs}h)`;
}

function pickContrastText(hexColor: string): string {
  const clean = hexColor.replace('#', '');
  if (clean.length !== 6) return '#0F1115';
  const r = Number.parseInt(clean.slice(0, 2), 16);
  const g = Number.parseInt(clean.slice(2, 4), 16);
  const b = Number.parseInt(clean.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.58 ? '#0F1115' : '#FFFFFF';
}

export default function CustomerLoyaltyHubPage() {
  const { businessSlug } = useParams<{ businessSlug: string }>();

  const [savedMember, setSavedMember] = useState<StoredLoyaltyMember | null>(() =>
    businessSlug ? readStoredMember(businessSlug) : null,
  );
  const [hub, setHub] = useState<PublicLoyaltyHubPayload | null>(null);
  const [loading, setLoading] = useState(true);

  // Registration & Claim Inputs
  const [customerName, setCustomerName] = useState(
    () => savedMember?.customerName ?? '',
  );
  const [phoneInput, setPhoneInput] = useState(() => savedMember?.phone ?? '');
  const [counterPin, setCounterPin] = useState('');
  const [claiming, setClaiming] = useState(false);
  const [requestingReward, setRequestingReward] = useState(false);

  // Feedback / Celebrations / Friendly Cooldown State
  const [starCelebration, setStarCelebration] = useState<{
    starsEarned: number;
    justUnlockedReward: boolean;
  } | null>(null);
  const [cooldownHint, setCooldownHint] = useState<string | null>(null);
  const [pendingApprovalNotice, setPendingApprovalNotice] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Optional Independent AI Google Review Assistant (non-incentivized)
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewRating, setReviewRating] = useState<ExperienceRating>('excellent');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [extraNote, setExtraNote] = useState('');
  const [draftingReview, setDraftingReview] = useState(false);
  const [generatedDraft, setGeneratedDraft] = useState('');
  const [copiedDraft, setCopiedDraft] = useState(false);
  const [referenceNowMs, setReferenceNowMs] = useState<number>(() => Date.now());

  const loadHub = useCallback(
    async (explicitPhone?: string | null) => {
      if (!businessSlug) {
        setLoading(false);
        return;
      }
      try {
        const lookupPhone = explicitPhone ?? savedMember?.phone ?? null;
        const data = await businessRepository.getPublicLoyaltyHub(
          businessSlug,
          lookupPhone,
        );
        setHub(data);
        setReferenceNowMs(Date.now());
      } catch {
        // non-blocking
      } finally {
        setLoading(false);
      }
    },
    [businessSlug, savedMember],
  );

  useEffect(() => {
    const t = window.setTimeout(() => void loadHub(), 0);
    return () => window.clearTimeout(t);
  }, [loadHub]);

  // Poll gently while pending approval OR waiting at counter with a live 4-digit lock code
  useEffect(() => {
    const hasPendingEvent =
      pendingApprovalNotice ||
      Boolean(hub?.recentEvents.some((e) => e.status === 'pending_approval'));
    const hasOpenRedemptionCode = Boolean(hub?.card?.pendingRedemptionCode);
    if (!hasPendingEvent && !hasOpenRedemptionCode) return;

    const timer = window.setInterval(() => {
      void loadHub();
    }, 6000);
    return () => window.clearInterval(timer);
  }, [
    pendingApprovalNotice,
    hub?.recentEvents,
    hub?.card?.pendingRedemptionCode,
    loadHub,
  ]);

  const accentHex = hub?.config.brandAccentHex || '#C8F135';
  const accentTextHex = pickContrastText(accentHex);

  const categoryExp = useMemo(
    () => getCategoryExperience(hub?.business.category),
    [hub?.business.category],
  );

  const shopLogoUrl = useMemo(() => {
    if (!hub) return null;
    try {
      return loadBusinessQRSettings({
        id: hub.business.id,
        slug: hub.business.slug,
        name: hub.business.name,
        category: hub.business.category,
        city: hub.business.city,
        googleReviewUrl: hub.business.googleReviewUrl,
        createdAt: '',
      }).logoDataUrl;
    } catch {
      return null;
    }
  }, [hub]);

  async function handleCollectStar(e: FormEvent) {
    e.preventDefault();
    if (!businessSlug || !hub) return;
    setFormError(null);
    setCooldownHint(null);
    setPendingApprovalNotice(false);
    setStarCelebration(null);
    setClaiming(true);

    const activeName = (customerName || savedMember?.customerName || '').trim();
    const activePhone = normalizeLoyaltyPhone(
      phoneInput || savedMember?.phone || '',
    );

    try {
      const res = await businessRepository.claimLoyaltyVisitStar({
        businessSlug,
        customerName: activeName,
        phone: activePhone,
        counterPin:
          hub.config.verificationMode === 'counter_pin' ? counterPin : null,
        sourceChannel: 'qr_nfc',
      });

      const nextSaved: StoredLoyaltyMember = {
        phone: res.card.phone,
        customerName: res.card.customerName,
      };
      writeStoredMember(businessSlug, nextSaved);
      setSavedMember(nextSaved);
      setCustomerName(res.card.customerName);
      setPhoneInput(res.card.phone);
      setCounterPin('');

      if (res.pendingApproval) {
        setPendingApprovalNotice(true);
      } else {
        setStarCelebration({
          starsEarned: 1,
          justUnlockedReward: res.justUnlockedReward,
        });
        window.setTimeout(() => setStarCelebration(null), 4200);
      }

      await loadHub(res.card.phone);
    } catch (err) {
      const msg = (err as Error).message || 'Could not collect star right now.';
      if (isCooldownMessage(msg)) {
        setCooldownHint(msg);
      } else {
        setFormError(msg);
      }
      if (activePhone.length >= 7) {
        await loadHub(activePhone);
      }
    } finally {
      setClaiming(false);
    }
  }

  async function handleRequestRewardCode() {
    if (!businessSlug || !hub?.card) return;
    setFormError(null);
    setRequestingReward(true);
    try {
      await businessRepository.requestLoyaltyRewardRedemption({
        businessSlug,
        phone: hub.card.phone,
      });
      await loadHub(hub.card.phone);
    } catch (err) {
      setFormError((err as Error).message);
    } finally {
      setRequestingReward(false);
    }
  }

  async function handleDraftAiReview() {
    if (!hub) return;
    setDraftingReview(true);
    setCopiedDraft(false);
    try {
      const ratingMeta = RATING_OPTIONS.find((r) => r.id === reviewRating);
      const tagPool =
        reviewRating === 'not_good'
          ? [...categoryExp.improve, ...categoryExp.liked]
          : categoryExp.liked;
      const pickedPhrases = tagPool
        .filter((item) => selectedTags.includes(item.id))
        .map((item) => item.phrase);

      const parts = [
        ratingMeta?.phrase ?? '',
        pickedPhrases.length > 0 ? `Highlights: ${pickedPhrases.join(', ')}.` : '',
        extraNote.trim(),
      ].filter(Boolean);
      const combinedExperience =
        parts.join(' ').trim() ||
        `Had a ${reviewRating} visit at ${hub.business.name} in ${hub.business.city}.`;

      const aiDraft = await aiProvider.generateReviewDraft({
        business: {
          slug: hub.business.slug,
          name: hub.business.name,
          category: hub.business.category,
        },
        experience: combinedExperience,
        mode: 'text',
        attempt: 0,
      });
      setGeneratedDraft(aiDraft.text);
      void businessRepository.trackEvent({
        businessId: hub.business.id,
        eventType: 'ai_generation',
      });
      void businessRepository.recordDraft({
        businessId: hub.business.id,
        originalInput: combinedExperience,
        generatedReview: aiDraft.text,
        mode: 'text',
        sentiment: reviewRating === 'not_good' ? 'negative' : 'positive',
        ownerResponseDraft: null,
        responseStatus: 'pending',
        responseAttempt: 0,
      });
    } catch {
      setGeneratedDraft(
        `Visited ${hub.business.name} in ${hub.business.city}${extraNote.trim() ? ` — ${extraNote.trim()}` : '.'}`,
      );
    } finally {
      setDraftingReview(false);
    }
  }

  async function handleCopyAndOpenGoogle() {
    if (!hub) return;
    if (generatedDraft.trim()) {
      const ok = await copyText(generatedDraft.trim());
      if (ok) setCopiedDraft(true);
    }
    void businessRepository.trackEvent({
      businessId: hub.business.id,
      eventType: 'google_redirect_click',
    });
    const url = hub.business.googleReviewUrl;
    if (url && url !== PLACEHOLDER_GOOGLE_REVIEW_URL) {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-md rounded-3xl border border-[#2D323B] bg-[#0F1115] p-12 text-center text-[#F8F9FA]">
        <Loader2
          className="mx-auto h-7 w-7 animate-spin text-[#C8F135]"
          aria-hidden
        />
        <p className="mt-3 text-[14px] font-medium text-[#A0A6B1]">
          Loading your Loyalty Wallet…
        </p>
      </div>
    );
  }

  if (!hub) {
    return (
      <div className="mx-auto max-w-md rounded-3xl border border-[#2D323B] bg-[#0F1115] p-8 text-center font-sans antialiased text-[#F8F9FA] space-y-4">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#171A20] border border-[#2D323B] text-[#C8F135]">
          <SearchX className="h-6 w-6" aria-hidden />
        </div>
        <h1 className="text-xl font-bold tracking-tight">Loyalty Portal Not Found</h1>
        <p className="text-sm text-[#A0A6B1]">
          No active store matched{' '}
          <span className="font-semibold text-[#F8F9FA]">{businessSlug}</span>.
        </p>
        <Link
          to="/r/glow-boutique-rewards/loyalty"
          className="inline-flex h-11 items-center justify-center rounded-xl bg-[#C8F135] px-5 text-sm font-semibold tracking-normal text-[#0F1115]"
        >
          Preview Glow Boutique Loyalty Wallet →
        </Link>
      </div>
    );
  }

  if (hub.business.loyaltyEnabled === false) {
    return (
      <div
        role="status"
        className="mx-auto max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center font-sans antialiased shadow-xs space-y-4"
      >
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-600">
          <Star className="h-6 w-6" aria-hidden />
        </div>
        <div className="space-y-1.5">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            {hub.business.name}
          </h1>
          <p className="text-sm font-medium text-slate-700 leading-relaxed">
            Loyalty rewards are currently paused for this business
          </p>
          <p className="text-xs text-slate-500 leading-relaxed">
            You can still leave a quick Google Review for {hub.business.name} in one tap below.
          </p>
        </div>
        <Link
          to={`/r/${hub.business.slug}`}
          className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 text-sm font-semibold tracking-normal text-white hover:bg-slate-800 transition-colors"
        >
          <span>Leave a Google Review →</span>
        </Link>
      </div>
    );
  }

  const card = hub.card;
  const starsReq = hub.config.starsRequired;
  const currentStars = card?.currentStars ?? 0;
  const starsRemaining = Math.max(0, starsReq - currentStars);
  const progressPct = Math.min(100, Math.round((currentStars / starsReq) * 100));
  const eligibleHint = card
    ? formatNextEligibleVisit(
        card.lastStarEarnedAt,
        hub.config.scanCooldownHours,
        referenceNowMs,
      )
    : null;
  const hasGoogleLink =
    Boolean(hub.business.googleReviewUrl) &&
    hub.business.googleReviewUrl !== PLACEHOLDER_GOOGLE_REVIEW_URL;

  return (
    <div className="mx-auto w-full max-w-md rounded-[28px] border border-[#2D323B] bg-[#0F1115] p-4 sm:p-5 font-sans antialiased text-[#F8F9FA] shadow-2xl space-y-4">
      {/* 01 · COMPACT HEADER */}
      <header className="flex items-center justify-between gap-3 px-1">
        <div className="flex items-center gap-3 min-w-0">
          {shopLogoUrl ? (
            <img
              src={shopLogoUrl}
              alt={`${hub.business.name} logo`}
              className="h-10 w-10 shrink-0 rounded-xl border border-[#2D323B] bg-[#171A20] object-contain p-0.5"
            />
          ) : (
            <span
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl font-black"
              style={{ backgroundColor: accentHex, color: accentTextHex }}
            >
              <Star className="h-5 w-5 fill-current" aria-hidden />
            </span>
          )}
          <div className="min-w-0">
            <h1 className="truncate text-[16px] font-extrabold text-[#F8F9FA]">
              {hub.business.name}
            </h1>
            <p className="text-[11.5px] font-medium text-[#A0A6B1] truncate">
              {hub.business.city} · Digital Loyalty Wallet
            </p>
          </div>
        </div>

        {card && (
          <button
            type="button"
            onClick={() => {
              writeStoredMember(hub.business.slug, null);
              setSavedMember(null);
              setCustomerName('');
              setPhoneInput('');
              setCooldownHint(null);
              setFormError(null);
              void loadHub('');
            }}
            className="shrink-0 rounded-lg border border-[#2D323B] bg-[#171A20] px-2.5 py-1.5 text-[11px] font-bold text-[#A0A6B1] hover:text-[#F8F9FA] cursor-pointer"
          >
            Switch
          </button>
        )}
      </header>

      {/* 02 · DIGITAL STAR WALLET CARD (#171A20) */}
      <section
        aria-label="Digital Star Wallet Card"
        className="rounded-2xl border border-[#2D323B] bg-[#171A20] p-5 space-y-4"
      >
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-[10.5px] font-extrabold uppercase tracking-[0.18em] text-[#A0A6B1]">
              YOUR LOYALTY WALLET
            </p>
            <p className="mt-0.5 text-[24px] font-black leading-none text-[#F8F9FA] tabular-nums">
              {currentStars} / {starsReq}{' '}
              <span className="text-[14px] font-bold text-[#A0A6B1]">Stars</span>
            </p>
          </div>
          <div className="text-right">
            {card ? (
              <span className="inline-block rounded-lg border border-[#2D323B] bg-[#20242C] px-2.5 py-1 font-mono text-[11.5px] font-extrabold text-[#F8F9FA]">
                {card.memberCode}
              </span>
            ) : (
              <span
                className="inline-block rounded-lg px-2.5 py-1 text-[11px] font-extrabold"
                style={{ backgroundColor: accentHex, color: accentTextHex }}
              >
                New Card
              </span>
            )}
          </div>
        </div>

        {/* Visual Star Grid — Large distinct stars (no tiny unreadable stars) */}
        <div
          className="grid gap-2"
          style={{
            gridTemplateColumns: `repeat(${Math.min(5, starsReq)}, minmax(0, 1fr))`,
          }}
        >
          {Array.from({ length: starsReq }).map((_, idx) => {
            const earned = idx < currentStars;
            return (
              <div
                key={idx}
                className={`flex h-12 items-center justify-center rounded-xl border transition-transform duration-300 ${
                  earned && starCelebration && idx === currentStars - 1
                    ? 'motion-safe:scale-105'
                    : ''
                }`}
                style={
                  earned
                    ? {
                        backgroundColor: accentHex,
                        borderColor: accentHex,
                        color: accentTextHex,
                      }
                    : {
                        backgroundColor: '#20242C',
                        borderColor: '#2D323B',
                        color: '#525866',
                      }
                }
              >
                <Star
                  className={`h-5 w-5 ${earned ? 'fill-current' : ''}`}
                  aria-label={earned ? 'Earned star' : 'Remaining star'}
                />
              </div>
            );
          })}
        </div>

        {/* Progress Bar & Reward Summary */}
        <div className="space-y-1.5">
          <div className="h-2 w-full overflow-hidden rounded-full bg-[#20242C]">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${progressPct}%`, backgroundColor: accentHex }}
            />
          </div>
          <div className="flex items-center justify-between text-[12px]">
            <span className="font-semibold text-[#A0A6B1]">
              {card
                ? starsRemaining === 1
                  ? '1 more visit to unlock reward'
                  : `${starsRemaining} more visits to unlock reward`
                : `Collect ${starsReq} stars to unlock:`}
            </span>
            <span className="font-bold text-[#F8F9FA] tabular-nums">
              {progressPct}%
            </span>
          </div>
          <div className="rounded-xl border border-[#2D323B] bg-[#20242C] px-3 py-2 flex items-center justify-between gap-2">
            <span className="text-[12px] font-bold text-[#F8F9FA] truncate">
              🎁 {hub.config.rewardTitle}
            </span>
            {(card?.rewardsUnlocked ?? 0) > 0 && (
              <span className="shrink-0 rounded-full bg-[#22C55E] px-2 py-0.5 text-[10.5px] font-black text-[#0F1115]">
                {card?.rewardsUnlocked} Ready
              </span>
            )}
          </div>
        </div>
      </section>

      {/* Star Earned Celebration Strip (400-900ms purposeful feedback) */}
      {starCelebration && (
        <div
          role="status"
          className="rounded-2xl border border-[#22C55E]/40 bg-[#22C55E]/15 p-4 text-center space-y-1 animate-fadeSlideUp"
        >
          <p className="text-[16px] font-black text-[#22C55E]">
            +{starCelebration.starsEarned} STAR EARNED!
          </p>
          <p className="text-[12.5px] text-[#F8F9FA]">
            {starCelebration.justUnlockedReward
              ? `Congratulations! You unlocked: ${hub.config.rewardTitle}`
              : `Your loyalty card is now at ${currentStars} of ${starsReq} stars.`}
          </p>
        </div>
      )}

      {/* Pending Cashier Approval Banner */}
      {(pendingApprovalNotice ||
        hub.recentEvents.some((ev) => ev.status === 'pending_approval')) && (
        <div
          role="status"
          className="rounded-2xl border border-[#F59E0B]/40 bg-[#F59E0B]/10 p-4 flex items-start gap-3"
        >
          <Clock className="h-5 w-5 shrink-0 text-[#F59E0B] mt-0.5" aria-hidden />
          <div className="space-y-0.5 text-[12.5px]">
            <p className="font-extrabold text-[#F59E0B]">
              Waiting for Cashier Approval
            </p>
            <p className="text-[#F8F9FA]">
              Your +1 ★ visit request is at the register. This screen refreshes automatically once approved.
            </p>
          </div>
        </div>
      )}

      {/* Friendly Cooldown Message (keeps wallet visible) */}
      {cooldownHint && (
        <div
          role="status"
          className="rounded-2xl border border-[#F59E0B]/40 bg-[#171A20] p-4 space-y-1"
        >
          <p className="text-[13.5px] font-extrabold text-[#F59E0B]">
            You&apos;ve already collected today&apos;s star!
          </p>
          <p className="text-[12.5px] text-[#A0A6B1]">
            {eligibleHint
              ? `${eligibleHint}. Keep this pass saved for your next visit.`
              : cooldownHint}
          </p>
        </div>
      )}

      {/* Error Banner */}
      {formError && (
        <div
          role="alert"
          className="rounded-2xl border border-[#EF4444]/40 bg-[#EF4444]/10 p-3.5 text-[12.5px] font-semibold text-[#EF4444]"
        >
          {formError}
        </div>
      )}

      {/* 03 · PRIMARY ACTION — COLLECT TODAY'S VISIT STAR (48-56px Touch Target) */}
      <form
        onSubmit={(e) => void handleCollectStar(e)}
        className="rounded-2xl border border-[#2D323B] bg-[#171A20] p-4 space-y-3.5"
      >
        {!card && (
          <div className="space-y-3">
            <div>
              <h2 className="text-[15px] font-extrabold text-[#F8F9FA]">
                Welcome to {hub.business.name} Rewards
              </h2>
              <p className="text-[12px] text-[#A0A6B1]">
                Enter your name &amp; mobile number once to start collecting stars.
              </p>
            </div>
            <div className="space-y-2.5">
              <input
                type="text"
                required
                maxLength={80}
                placeholder="Your full name (e.g. Rahul)"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="h-12 w-full rounded-xl border border-[#2D323B] bg-[#20242C] px-3.5 text-[14px] font-semibold text-[#F8F9FA] placeholder:text-[#A0A6B1]/60 focus:border-[#C8F135] focus:outline-none"
              />
              <input
                type="tel"
                required
                maxLength={20}
                placeholder="Mobile number (e.g. +91 98765 43210)"
                value={phoneInput}
                onChange={(e) => setPhoneInput(e.target.value)}
                className="h-12 w-full rounded-xl border border-[#2D323B] bg-[#20242C] px-3.5 text-[14px] font-semibold text-[#F8F9FA] placeholder:text-[#A0A6B1]/60 focus:border-[#C8F135] focus:outline-none"
              />
            </div>
            <p className="text-[11px] text-[#A0A6B1] flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-[#22C55E]" aria-hidden />
              Used only to save your star card — no password or spam.
            </p>
          </div>
        )}

        {hub.config.verificationMode === 'counter_pin' && (
          <div className="space-y-1.5">
            <label
              htmlFor="loyaltyCounterPin"
              className="flex items-center gap-1.5 text-[11.5px] font-extrabold uppercase tracking-wider text-[#A0A6B1]"
            >
              <KeyRound className="h-3.5 w-3.5 text-[#C8F135]" aria-hidden />
              Counter Verification PIN (Ask Cashier)
            </label>
            <input
              id="loyaltyCounterPin"
              type="password"
              inputMode="numeric"
              required
              maxLength={6}
              placeholder="Enter 4-digit counter PIN"
              value={counterPin}
              onChange={(e) =>
                setCounterPin(e.target.value.replace(/\D/g, '').slice(0, 6))
              }
              className="h-12 w-full rounded-xl border border-[#2D323B] bg-[#20242C] px-4 text-center font-mono text-[20px] font-black tracking-[0.35em] text-[#F8F9FA] focus:border-[#C8F135] focus:outline-none"
            />
          </div>
        )}

        <button
          type="submit"
          disabled={claiming}
          style={{ backgroundColor: accentHex, color: accentTextHex }}
          className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl px-4 text-[15px] font-black shadow-sm transition-transform active:scale-[0.98] disabled:opacity-60 cursor-pointer"
        >
          <Star className="h-5 w-5 fill-current" aria-hidden />
          {claiming
            ? 'Verifying Visit…'
            : hub.config.verificationMode === 'cashier_approval'
              ? "Request Today's Visit Star ★"
              : "Collect Today's Visit Star ★"}
        </button>

        {card && eligibleHint && !cooldownHint && (
          <p className="text-center text-[11.5px] text-[#A0A6B1]">
            Cooldown protection: {eligibleHint}
          </p>
        )}
      </form>

      {/* 04 · REWARDS UNLOCKED & IN-STORE 4-DIGIT LOCK */}
      {card && card.rewardsUnlocked > 0 && (
        <section
          aria-label="Unlocked Rewards"
          className="rounded-2xl border border-[#22C55E]/40 bg-[#171A20] p-4 space-y-3"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#22C55E]/15 text-[#22C55E]">
                <Gift className="h-5 w-5" aria-hidden />
              </span>
              <div>
                <p className="text-[11px] font-extrabold uppercase tracking-wider text-[#22C55E]">
                  {card.rewardsUnlocked} Reward{card.rewardsUnlocked > 1 ? 's' : ''} Unlocked
                </p>
                <p className="text-[15px] font-extrabold text-[#F8F9FA]">
                  {hub.config.rewardTitle}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => void loadHub(card.phone)}
              aria-label="Refresh redemption status"
              className="rounded-lg border border-[#2D323B] bg-[#20242C] p-2 text-[#A0A6B1] hover:text-[#F8F9FA] cursor-pointer"
            >
              <RefreshCw className="h-3.5 w-3.5" aria-hidden />
            </button>
          </div>

          {card.pendingRedemptionCode ? (
            <div className="rounded-xl border border-[#C8F135]/40 bg-[#0F1115] p-4 text-center space-y-1.5">
              <p className="text-[10.5px] font-extrabold uppercase tracking-[0.2em] text-[#A0A6B1]">
                SHOW THIS CODE AT THE COUNTER
              </p>
              <p
                className="font-mono text-[36px] font-black tracking-[0.25em]"
                style={{ color: accentHex }}
              >
                {card.pendingRedemptionCode}
              </p>
              <p className="text-[12px] text-[#A0A6B1]">
                Cashier verification required to mark reward redeemed
              </p>
            </div>
          ) : (
            <button
              type="button"
              disabled={requestingReward}
              onClick={() => void handleRequestRewardCode()}
              className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-[#22C55E] px-4 text-[14px] font-black text-[#0F1115] hover:bg-emerald-400 cursor-pointer"
            >
              <Gift className="h-4 w-4" aria-hidden />
              {requestingReward ? 'Generating Counter Code…' : 'Claim My Reward'}
            </button>
          )}
        </section>
      )}

      {/* 05 · COMPACT LOYALTY ACTIVITY TIMELINE */}
      {card && hub.recentEvents.length > 0 && (
        <section
          aria-label="Recent Loyalty Activity"
          className="rounded-2xl border border-[#2D323B] bg-[#171A20] p-4 space-y-3"
        >
          <p className="text-[11px] font-extrabold uppercase tracking-wider text-[#A0A6B1]">
            Recent Loyalty Activity
          </p>
          <div className="space-y-2">
            {hub.recentEvents.slice(0, 6).map((ev) => {
              const Icon =
                ev.status === 'rejected'
                  ? XCircle
                  : ev.status === 'pending_approval'
                    ? Clock
                    : ev.eventType === 'reward_redeemed'
                      ? Gift
                      : ev.eventType === 'manual_bonus'
                        ? UserCheck
                        : CheckCircle2;
              const iconColor =
                ev.status === 'rejected'
                  ? 'text-[#EF4444]'
                  : ev.status === 'pending_approval'
                    ? 'text-[#F59E0B]'
                    : 'text-[#22C55E]';

              const label =
                ev.eventType === 'reward_redeemed'
                  ? 'Reward Redeemed'
                  : ev.eventType === 'manual_bonus'
                    ? 'Desk Star Added'
                    : ev.eventType === 'google_review_bonus'
                      ? 'Bonus Star'
                      : 'Visit Star';

              return (
                <div
                  key={ev.id}
                  className="flex items-center justify-between gap-2 rounded-xl border border-[#2D323B] bg-[#20242C] px-3 py-2 text-[12px]"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Icon className={`h-4 w-4 shrink-0 ${iconColor}`} aria-hidden />
                    <div className="min-w-0">
                      <p className="font-bold text-[#F8F9FA] truncate">{label}</p>
                      <p className="text-[10.5px] text-[#A0A6B1]">
                        {new Date(ev.createdAt).toLocaleDateString()} ·{' '}
                        {ev.status === 'pending_approval'
                          ? 'Pending Cashier'
                          : ev.status === 'rejected'
                            ? 'Declined'
                            : 'Verified'}
                      </p>
                    </div>
                  </div>
                  {ev.starsDelta > 0 && (
                    <span
                      className="shrink-0 font-extrabold tabular-nums"
                      style={{ color: accentHex }}
                    >
                      +{ev.starsDelta} ★
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* 06 · OPTIONAL INDEPENDENT AI GOOGLE REVIEW ASSISTANT (Non-Incentivized) */}
      <section
        aria-label="Share your honest experience"
        className="rounded-2xl border border-[#2D323B] bg-[#171A20] p-4 space-y-3"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#20242C] text-[#C8F135]">
              <Sparkles className="h-4 w-4" aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="text-[13.5px] font-extrabold text-[#F8F9FA]">
                Share your experience on Google
              </p>
              <p className="text-[11.5px] text-[#A0A6B1]">
                Optional 20-second AI writing helper — completely separate from stars
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setReviewOpen((v) => !v)}
            className="shrink-0 rounded-xl border border-[#2D323B] bg-[#20242C] px-3 py-1.5 text-[12px] font-bold text-[#F8F9FA] hover:border-[#C8F135] cursor-pointer"
          >
            {reviewOpen ? 'Hide' : 'Start Writing'}
          </button>
        </div>

        {reviewOpen && (
          <div className="space-y-3 border-t border-[#2D323B] pt-3">
            <div className="grid grid-cols-4 gap-1.5">
              {RATING_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setReviewRating(opt.id)}
                  className={`rounded-xl border px-2 py-2 text-center text-[11px] font-bold cursor-pointer ${
                    reviewRating === opt.id
                      ? 'border-[#C8F135] bg-[#20242C] text-[#C8F135]'
                      : 'border-[#2D323B] bg-[#0F1115] text-[#A0A6B1]'
                  }`}
                >
                  <span className="block text-[15px]">{opt.emoji}</span>
                  {opt.label}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap gap-1.5">
              {categoryExp.liked.map((tag) => {
                const active = selectedTags.includes(tag.id);
                return (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() =>
                      setSelectedTags((prev) =>
                        prev.includes(tag.id)
                          ? prev.filter((id) => id !== tag.id)
                          : [...prev, tag.id],
                      )
                    }
                    className={`rounded-lg border px-2.5 py-1 text-[11.5px] font-semibold cursor-pointer ${
                      active
                        ? 'border-[#C8F135] bg-[#C8F135] text-[#0F1115]'
                        : 'border-[#2D323B] bg-[#20242C] text-[#F8F9FA]'
                    }`}
                  >
                    {tag.emoji} {tag.label}
                  </button>
                );
              })}
            </div>

            <input
              type="text"
              maxLength={240}
              placeholder={categoryExp.notePlaceholder}
              value={extraNote}
              onChange={(e) => setExtraNote(e.target.value)}
              className="h-10 w-full rounded-xl border border-[#2D323B] bg-[#20242C] px-3 text-[12.5px] text-[#F8F9FA] placeholder:text-[#A0A6B1]/60 focus:border-[#C8F135] focus:outline-none"
            />

            <button
              type="button"
              disabled={draftingReview}
              onClick={() => void handleDraftAiReview()}
              className="flex h-10 w-full items-center justify-center gap-1.5 rounded-xl bg-[#20242C] border border-[#C8F135]/40 text-[12.5px] font-extrabold text-[#C8F135] hover:bg-[#2D323B] cursor-pointer"
            >
              <Sparkles className="h-3.5 w-3.5" aria-hidden />
              {draftingReview ? 'Drafting Review…' : 'Generate Draft'}
            </button>

            {generatedDraft && (
              <div className="space-y-2">
                <textarea
                  rows={3}
                  value={generatedDraft}
                  onChange={(e) => setGeneratedDraft(e.target.value)}
                  className="w-full rounded-xl border border-[#2D323B] bg-[#0F1115] p-3 font-sans antialiased text-[15px] leading-relaxed font-normal text-[#F8F9FA] focus:border-[#C8F135] focus:outline-none"
                />
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      void copyText(generatedDraft).then((ok) => {
                        if (ok) {
                          setCopiedDraft(true);
                          window.setTimeout(() => setCopiedDraft(false), 2000);
                        }
                      });
                    }}
                    className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-[#2D323B] bg-[#20242C] text-[12px] font-bold text-[#F8F9FA] cursor-pointer"
                  >
                    {copiedDraft ? (
                      <Check className="h-3.5 w-3.5 text-[#22C55E]" aria-hidden />
                    ) : (
                      <Copy className="h-3.5 w-3.5 text-[#A0A6B1]" aria-hidden />
                    )}
                    {copiedDraft ? 'Copied' : 'Copy Draft'}
                  </button>
                  {hasGoogleLink && (
                    <button
                      type="button"
                      onClick={() => void handleCopyAndOpenGoogle()}
                      className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl bg-[#C8F135] text-[12px] font-extrabold text-[#0F1115] cursor-pointer"
                    >
                      Open Google <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
