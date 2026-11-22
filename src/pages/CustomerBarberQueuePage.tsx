import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  Scissors,
  Clock,
  Users,
  BellRing,
  Star,
  CheckCircle2,
  Loader2,
  SearchX,
  RefreshCw,
  MessageSquareHeart,
  LogOut,
  AlertCircle,
  Sparkles,
  Phone,
  User,
} from 'lucide-react';
import type {
  BarberQueueTicket,
  PublicBarberQueueStatusPayload,
} from '../types/barberQueue';
import { businessRepository } from '../services/storage';
import { getTodayQueueDateKey } from '../utils/barberQueueValidation';
import { formatPriceFromPaise } from '../utils/restaurantValidation';
import { Button } from '../components/common/Button';

interface StoredQueueTicketRef {
  ticketId: string;
  tokenNumber: number;
  guestName: string;
  phone: string | null;
  serviceName: string;
  queueDate: string;
  loyaltyStarsBalance: number;
}

function getStorageKey(slug: string): string {
  return `vitaran_barber_ticket_v1:${slug.trim().toLowerCase()}`;
}

function loadStoredTicket(slug: string): StoredQueueTicketRef | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    const raw = window.localStorage.getItem(getStorageKey(slug));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredQueueTicketRef;
    // Automatically clear stale tickets from previous days
    if (parsed.queueDate !== getTodayQueueDateKey()) {
      window.localStorage.removeItem(getStorageKey(slug));
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function saveStoredTicket(slug: string, ref: StoredQueueTicketRef | null): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    if (!ref) {
      window.localStorage.removeItem(getStorageKey(slug));
    } else {
      window.localStorage.setItem(getStorageKey(slug), JSON.stringify(ref));
    }
  } catch {
    // ignore storage errors
  }
}

export default function CustomerBarberQueuePage() {
  const { businessSlug } = useParams<{ businessSlug: string }>();

  const [queueData, setQueueData] =
    useState<PublicBarberQueueStatusPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Saved customer ticket state
  const [storedTicket, setStoredTicket] = useState<StoredQueueTicketRef | null>(
    () => (businessSlug ? loadStoredTicket(businessSlug) : null),
  );
  const [loyaltyStars, setLoyaltyStars] = useState<number>(
    () => storedTicket?.loyaltyStarsBalance ?? 0,
  );

  // Join Queue Form state
  const [guestName, setGuestName] = useState('');
  const [phone, setPhone] = useState('');
  const [selectedServiceName, setSelectedServiceName] = useState<string>('');
  const [joining, setJoining] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Leave Queue confirmation state
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [leaving, setLeaving] = useState(false);

  const fetchQueueStatus = useCallback(
    async (silent = false) => {
      if (!businessSlug) {
        setLoading(false);
        return;
      }
      if (!silent) {
        setRefreshing(true);
      }
      try {
        const data =
          await businessRepository.getPublicBarberQueueStatus(businessSlug);
        setQueueData(data);
        if (data && data.config.services.length > 0) {
          setSelectedServiceName((prev) =>
            prev &&
            data.config.services.some(
              (s) => s.name.toLowerCase() === prev.toLowerCase(),
            )
              ? prev
              : data.config.services[0].name,
          );
        }
      } catch {
        // ignore transient network poll errors
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [businessSlug],
  );

  // Initial load + 10s live auto-refresh + instant refresh on tab focus
  useEffect(() => {
    let active = true;
    const initTimer = window.setTimeout(() => {
      if (active) {
        void fetchQueueStatus(true);
      }
    }, 0);
    const interval = window.setInterval(() => {
      void fetchQueueStatus(true);
    }, 10000);

    function handleFocus() {
      if (document.visibilityState !== 'hidden') {
        void fetchQueueStatus(true);
      }
    }
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleFocus);

    return () => {
      active = false;
      window.clearTimeout(initTimer);
      window.clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleFocus);
    };
  }, [fetchQueueStatus]);

  // Refresh customer's live Loyalty Star balance whenever phone is stored
  useEffect(() => {
    if (!businessSlug || !storedTicket?.phone) return;
    let active = true;
    async function syncStars() {
      try {
        const wallet =
          await businessRepository.registerOrResumeRestaurantCustomer({
            displayName: storedTicket!.guestName,
            phoneOrEmail: storedTicket!.phone,
            businessSlug: businessSlug!,
          });
        if (active && typeof wallet.loyaltyStarsBalance === 'number') {
          setLoyaltyStars(wallet.loyaltyStarsBalance);
        }
      } catch {
        // ignore
      }
    }
    void syncStars();
    return () => {
      active = false;
    };
  }, [businessSlug, storedTicket, queueData?.completedTodayCount]);

  async function handleJoinQueue(e: React.FormEvent) {
    e.preventDefault();
    if (!businessSlug) return;
    setFormError(null);
    setJoining(true);
    try {
      const res = await businessRepository.joinBarberQueue({
        businessSlug,
        guestName: guestName.trim(),
        phone: phone.trim() || null,
        serviceName: selectedServiceName || 'Classic Haircut',
      });
      const ref: StoredQueueTicketRef = {
        ticketId: res.ticket.id,
        tokenNumber: res.ticket.tokenNumber,
        guestName: res.ticket.guestName,
        phone: res.ticket.phone ?? (phone.trim() || null),
        serviceName: res.ticket.serviceName,
        queueDate: res.ticket.queueDate,
        loyaltyStarsBalance: res.loyaltyStarsBalance,
      };
      saveStoredTicket(businessSlug, ref);
      setStoredTicket(ref);
      setLoyaltyStars(res.loyaltyStarsBalance);
      setGuestName('');
      setPhone('');
      await fetchQueueStatus(true);
    } catch (err) {
      setFormError((err as Error).message);
    } finally {
      setJoining(false);
    }
  }

  async function handleLeaveQueue() {
    if (!businessSlug || !storedTicket) return;
    setLeaving(true);
    setFormError(null);
    try {
      await businessRepository.leaveBarberQueueTicket({
        businessSlug,
        ticketId: storedTicket.ticketId,
      });
      saveStoredTicket(businessSlug, null);
      setStoredTicket(null);
      setConfirmLeave(false);
      await fetchQueueStatus(true);
    } catch (err) {
      // If ticket is already finished/cancelled, clear local pass gracefully
      setFormError((err as Error).message);
      saveStoredTicket(businessSlug, null);
      setStoredTicket(null);
      setConfirmLeave(false);
      await fetchQueueStatus(true);
    } finally {
      setLeaving(false);
    }
  }

  if (loading) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="mx-auto max-w-md bistro-card p-12 text-center"
      >
        <Loader2
          className="mx-auto h-7 w-7 animate-spin text-[#1E1B4B]"
          aria-hidden
        />
        <p className="mt-3 text-[15px] font-medium text-[#6B7280]">
          Loading live queue timer…
        </p>
      </div>
    );
  }

  if (!queueData) {
    return (
      <div
        role="alert"
        className="mx-auto max-w-md bistro-card p-8 text-center space-y-3"
      >
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#1E1B4B] text-[#D2DB76]">
          <SearchX className="h-6 w-6" aria-hidden />
        </div>
        <h1 className="text-[22px] font-extrabold text-[#111827]">
          Live queue unavailable
        </h1>
        <p className="text-[14px] text-[#6B7280]">
          This shop&apos;s live queue page is not currently active.
        </p>
      </div>
    );
  }

  const {
    business,
    config,
    nowServing,
    waitingTickets,
    waitingCount,
    estimatedWaitForNewGuestMinutes,
    rewards,
  } = queueData;

  // Match stored ticket against live server state
  const liveWaitingTicket: BarberQueueTicket | null = storedTicket
    ? (waitingTickets.find((t) => t.id === storedTicket.ticketId) ?? null)
    : null;
  const isMyTicketInChair = Boolean(
    storedTicket && nowServing && nowServing.id === storedTicket.ticketId,
  );
  const myActiveTicket: BarberQueueTicket | null = isMyTicketInChair
    ? nowServing
    : liveWaitingTicket;
  const ticketFinishedOrCleared = Boolean(storedTicket && !myActiveTicket);

  const estWait = myActiveTicket?.estimatedWaitMinutes ?? 0;
  const extraDelay = myActiveTicket?.extraDelayMinutes ?? 0;
  const isAlmostUp =
    isMyTicketInChair || (Boolean(liveWaitingTicket) && estWait <= 5);

  const nextRewardTarget =
    rewards.find((r) => r.starsRequired > loyaltyStars)?.starsRequired ??
    rewards[0]?.starsRequired ??
    5;

  return (
    <div className="mx-auto w-full max-w-md pb-10 space-y-4 animate-fadeSlideUp">
      {/* 1. LIVE SHOP PULSE HEADER */}
      <header className="bistro-card p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#1E1B4B] text-[#D2DB76] shadow-sm">
              <Scissors className="h-5 w-5" aria-hidden />
            </span>
            <div className="min-w-0">
              <h1 className="truncate text-[20px] font-extrabold tracking-tight text-[#111827]">
                {business.name}
              </h1>
              <p className="truncate text-[12px] font-medium text-[#6B7280]">
                {business.city} • Live Walk-In Queue
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => void fetchQueueStatus(false)}
            aria-label="Refresh live queue"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#1E1B4B]/15 bg-[#F8F9FA] text-[#1E1B4B] hover:bg-[#1E1B4B]/10 cursor-pointer"
          >
            <RefreshCw
              className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`}
              aria-hidden
            />
          </button>
        </div>

        {/* Live Open / Paused Pill */}
        <div className="flex items-center justify-between gap-2">
          <span
            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11.5px] font-extrabold uppercase tracking-wider ${
              config.isQueueOpen
                ? 'border-emerald-200 bg-emerald-50 text-[#059669]'
                : 'border-amber-300 bg-amber-50 text-[#D97706]'
            }`}
          >
            <span className="relative flex h-2 w-2">
              {config.isQueueOpen && (
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#059669] opacity-75" />
              )}
              <span
                className={`relative inline-flex h-2 w-2 rounded-full ${
                  config.isQueueOpen ? 'bg-[#059669]' : 'bg-[#D97706]'
                }`}
              />
            </span>
            {config.isQueueOpen ? 'OPEN • Accepting Walk-Ins' : 'PAUSED'}
          </span>

          <span className="text-[11px] font-semibold text-[#6B7280]">
            Auto-updates live
          </span>
        </div>

        {/* BIG 2-COLUMN LIVE TELEMETRY STRIP */}
        <div className="grid grid-cols-2 gap-3 pt-1">
          <div className="rounded-2xl border border-[#1E1B4B]/10 bg-[#1E1B4B] p-3.5 text-[#FFFFFF]">
            <p className="text-[10.5px] font-bold uppercase tracking-wider text-[#D2DB76]">
              Now Serving
            </p>
            <p className="mt-1 text-[22px] leading-tight font-extrabold tabular-nums">
              {nowServing ? `Token #${nowServing.tokenNumber}` : 'Chair Open'}
            </p>
            <p className="mt-0.5 truncate text-[11.5px] text-white/75">
              {nowServing
                ? `~${nowServing.remainingMinutes ?? nowServing.durationMinutes}m left`
                : 'Ready for next guest'}
            </p>
          </div>

          <div className="rounded-2xl border border-[#1E1B4B]/12 bg-[#F8F9FA] p-3.5 text-[#111827]">
            <p className="text-[10.5px] font-bold uppercase tracking-wider text-[#6B7280] flex items-center gap-1">
              <Users className="h-3 w-3" aria-hidden /> Waiting
            </p>
            <p className="mt-1 text-[22px] leading-tight font-extrabold tabular-nums text-[#1E1B4B]">
              {waitingCount} {waitingCount === 1 ? 'Person' : 'People'}
            </p>
            <p className="mt-0.5 text-[11.5px] font-semibold text-[#6B7280] tabular-nums">
              ~{estimatedWaitForNewGuestMinutes} mins wait
            </p>
          </div>
        </div>
      </header>

      {formError && (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] font-semibold text-red-900"
        >
          <AlertCircle className="h-4 w-4 shrink-0 text-red-700" aria-hidden />
          <span>{formError}</span>
        </div>
      )}

      {/* 2A. ACTIVE LIVE COUNTDOWN PASS (Customer Has an Active Ticket Today) */}
      {myActiveTicket && storedTicket && (
        <section
          aria-label="Your Live Queue Pass"
          className={`rounded-3xl border-2 p-6 shadow-md space-y-4 transition-colors duration-300 ${
            isAlmostUp
              ? 'border-[#1E1B4B] bg-[#D2DB76] text-[#1E1B4B]'
              : 'border-[#1E1B4B]/15 bg-[#FFFFFF] text-[#111827]'
          }`}
        >
          {/* You're Next / In Chair Alert Banner */}
          {isAlmostUp && (
            <div
              role="status"
              className="flex items-center gap-2.5 rounded-2xl bg-[#1E1B4B] px-4 py-3 text-[#FFFFFF] shadow-sm"
            >
              <BellRing
                className="h-5 w-5 shrink-0 text-[#D2DB76] animate-bounce"
                aria-hidden
              />
              <p className="text-[13.5px] font-extrabold">
                {isMyTicketInChair
                  ? "🔔 It's Your Turn! Please take your seat at the barber chair."
                  : "🔔 You're Next! Please head back to the barber chair."}
              </p>
            </div>
          )}

          {/* Giant Token Badge + Live Countdown Timer */}
          <div className="flex items-center justify-between gap-4">
            <div>
              <span
                className={`text-[11px] font-extrabold uppercase tracking-wider ${
                  isAlmostUp ? 'text-[#1E1B4B]/80' : 'text-[#6B7280]'
                }`}
              >
                Your Live Queue Token
              </span>
              <p
                data-testid="active-queue-token"
                className="text-[52px] leading-none font-black tracking-tight tabular-nums text-[#1E1B4B] mt-1"
              >
                #{myActiveTicket.tokenNumber}
              </p>
              <p className="mt-1.5 text-[14px] font-bold">
                {myActiveTicket.guestName} • {myActiveTicket.serviceName}
              </p>
            </div>

            <div
              className={`rounded-2xl p-3.5 text-center min-w-[116px] ${
                isAlmostUp
                  ? 'bg-[#1E1B4B] text-[#FFFFFF]'
                  : 'bg-[#F8F9FA] border border-[#1E1B4B]/10 text-[#1E1B4B]'
              }`}
            >
              <Clock
                className={`mx-auto h-5 w-5 ${
                  isAlmostUp ? 'text-[#D2DB76]' : 'text-[#1E1B4B]'
                }`}
                aria-hidden
              />
              <p
                data-testid="active-queue-eta"
                className="mt-1 text-[22px] leading-none font-black tabular-nums"
              >
                {isMyTicketInChair
                  ? 'NOW'
                  : estWait === 0
                    ? '<5m'
                    : `~${estWait}m`}
              </p>
              <p className="mt-1 text-[10px] font-bold uppercase tracking-wider opacity-80">
                {isMyTicketInChair
                  ? 'In Chair'
                  : `Pos #${myActiveTicket.position ?? 1} in line`}
              </p>
            </div>
          </div>

          {/* Barber Broadcast Delay Banner (Shown whenever extraDelayMinutes > 0) */}
          {!isMyTicketInChair && extraDelay > 0 && (
            <div
              role="status"
              data-testid="barber-delay-banner"
              className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-[13px] font-bold text-[#92400E]"
            >
              ⏱ Barber extended session by +{extraDelay} mins — Your updated wait is ~{estWait} mins
            </div>
          )}

          {/* Reassuring Step-Out Indicator */}
          {!isMyTicketInChair && (
            <div
              className={`flex items-center gap-2 rounded-2xl px-3.5 py-2.5 text-[12.5px] font-semibold ${
                isAlmostUp
                  ? 'bg-[#FFFFFF]/70 text-[#1E1B4B]'
                  : 'bg-emerald-50/80 border border-emerald-200 text-[#065F46]'
              }`}
            >
              <span className="relative flex h-2.5 w-2.5 shrink-0">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#059669] opacity-75" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#059669]" />
              </span>
              <span>
                You&apos;re free to step out — we&apos;ll update your timer live
              </span>
            </div>
          )}

          {/* Leave Queue (With Confirmation — Only while waiting) */}
          {!isMyTicketInChair && (
            <div className="pt-1 border-t border-black/10">
              {!confirmLeave ? (
                <button
                  type="button"
                  onClick={() => setConfirmLeave(true)}
                  className="inline-flex items-center gap-1.5 text-[12.5px] font-bold opacity-75 hover:opacity-100 hover:underline cursor-pointer"
                >
                  <LogOut className="h-3.5 w-3.5" aria-hidden /> Leave Queue
                </button>
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-red-50 border border-red-200 p-3 text-red-900">
                  <span className="text-[12px] font-bold">
                    Give up Token #{myActiveTicket.tokenNumber}?
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setConfirmLeave(false)}
                      className="rounded-lg bg-white border border-red-200 px-3 py-1 text-[12px] font-bold text-[#111827] cursor-pointer"
                    >
                      Keep Spot
                    </button>
                    <button
                      type="button"
                      disabled={leaving}
                      onClick={() => void handleLeaveQueue()}
                      className="rounded-lg bg-red-600 px-3 py-1 text-[12px] font-extrabold text-white cursor-pointer"
                    >
                      {leaving ? 'Leaving…' : 'Yes, Leave'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {/* 2B. COMPLETED / SERVED CELEBRATION STATE */}
      {ticketFinishedOrCleared && storedTicket && (
        <section className="bistro-card border-2 border-emerald-300 bg-emerald-50/70 p-6 text-center space-y-3.5 animate-fadeSlideUp">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#059669] text-[#FFFFFF]">
            <CheckCircle2 className="h-6 w-6" aria-hidden />
          </div>
          <div className="space-y-1">
            <h2 className="text-[20px] font-extrabold text-[#111827]">
              Looking Fresh, {storedTicket.guestName}!
            </h2>
            <p className="text-[13px] font-medium text-[#065F46]">
              Token #{storedTicket.tokenNumber} ({storedTicket.serviceName}) has been completed.
              {config.awardStarOnCompletion && storedTicket.phone
                ? ' Your Loyalty Star has been credited!'
                : ''}
            </p>
          </div>
          <div className="flex flex-col gap-2 pt-1">
            <Link
              to={`/r/${business.slug}`}
              className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#1E1B4B] px-4 py-2.5 text-[14px] font-extrabold text-[#FFFFFF] hover:bg-[#2E2A6E]"
            >
              <MessageSquareHeart className="h-4 w-4 text-[#D2DB76]" aria-hidden />
              Leave a 30-Second Google Review
            </Link>
            <button
              type="button"
              onClick={() => {
                saveStoredTicket(business.slug, null);
                setStoredTicket(null);
              }}
              className="text-[12.5px] font-bold text-[#1E1B4B] hover:underline py-1 cursor-pointer"
            >
              Need another spot? Join Queue Again
            </button>
          </div>
        </section>
      )}

      {/* 2C. 1-TAP JOIN QUEUE FORM (No Active Ticket Yet) */}
      {!storedTicket && (
        <section className="bistro-card p-6 space-y-5">
          {!config.isQueueOpen ? (
            <div className="py-4 text-center space-y-2">
              <Clock className="mx-auto h-9 w-9 text-[#D97706]" aria-hidden />
              <h2 className="text-[18px] font-extrabold text-[#111827]">
                Walk-In Queue Temporarily Paused
              </h2>
              <p className="text-[13px] text-[#6B7280]">
                The barber has paused new walk-ins for a moment. Check back shortly or ask inside.
              </p>
            </div>
          ) : (
            <form
              onSubmit={(e) => void handleJoinQueue(e)}
              className="space-y-4"
            >
              <div>
                <h2 className="text-[19px] font-extrabold text-[#111827]">
                  Join the Live Queue
                </h2>
                <p className="mt-0.5 text-[13px] text-[#6B7280]">
                  Grab a digital token and relax anywhere — we&apos;ll count down your turn live.
                </p>
              </div>

              <div className="space-y-3">
                <div className="space-y-1">
                  <label
                    htmlFor="queueGuestName"
                    className="block text-[12px] font-bold uppercase tracking-wider text-[#6B7280]"
                  >
                    Your Name
                  </label>
                  <div className="relative flex items-center">
                    <User
                      className="pointer-events-none absolute left-3.5 h-4 w-4 text-[#6B7280]"
                      aria-hidden
                    />
                    <input
                      id="queueGuestName"
                      type="text"
                      required
                      maxLength={80}
                      placeholder="e.g. Rahul"
                      value={guestName}
                      onChange={(e) => setGuestName(e.target.value)}
                      className="block h-11 w-full rounded-xl border border-[#1E1B4B]/20 bg-[#FFFFFF] pl-10 pr-3.5 text-[14px] font-semibold text-[#111827] focus:border-[#1E1B4B] focus:outline-none"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label
                    htmlFor="queueGuestPhone"
                    className="block text-[12px] font-bold uppercase tracking-wider text-[#6B7280]"
                  >
                    Phone Number{' '}
                    <span className="normal-case font-semibold text-[#059669]">
                      (Saves Loyalty Stars ★ automatically)
                    </span>
                  </label>
                  <div className="relative flex items-center">
                    <Phone
                      className="pointer-events-none absolute left-3.5 h-4 w-4 text-[#6B7280]"
                      aria-hidden
                    />
                    <input
                      id="queueGuestPhone"
                      type="tel"
                      maxLength={40}
                      placeholder="e.g. +91 98765 43210"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="block h-11 w-full rounded-xl border border-[#1E1B4B]/20 bg-[#FFFFFF] pl-10 pr-3.5 text-[14px] font-semibold text-[#111827] focus:border-[#1E1B4B] focus:outline-none"
                    />
                  </div>
                </div>

                {/* Pick a Service */}
                <div className="space-y-1.5">
                  <span className="block text-[12px] font-bold uppercase tracking-wider text-[#6B7280]">
                    Select Service
                  </span>
                  <div className="grid gap-2">
                    {config.services.map((svc) => {
                      const active = selectedServiceName === svc.name;
                      return (
                        <button
                          key={svc.id}
                          type="button"
                          onClick={() => setSelectedServiceName(svc.name)}
                          className={`flex items-center justify-between gap-3 rounded-2xl border p-3.5 text-left transition-all active:scale-[0.98] cursor-pointer ${
                            active
                              ? 'border-2 border-[#1E1B4B] bg-[#1E1B4B] text-[#FFFFFF] shadow-sm'
                              : 'border-[#1E1B4B]/15 bg-[#F8F9FA] text-[#111827] hover:border-[#1E1B4B]/40'
                          }`}
                        >
                          <div className="min-w-0">
                            <p className="text-[14px] font-extrabold truncate">
                              {svc.name}
                            </p>
                            <p
                              className={`text-[11.5px] font-semibold ${
                                active ? 'text-[#D2DB76]' : 'text-[#6B7280]'
                              }`}
                            >
                              ~{svc.durationMinutes} mins
                            </p>
                          </div>
                          <span
                            className={`shrink-0 rounded-full px-3 py-1 text-[12.5px] font-extrabold tabular-nums ${
                              active
                                ? 'bg-[#D2DB76] text-[#1E1B4B]'
                                : 'bg-[#FFFFFF] border border-[#1E1B4B]/10 text-[#1E1B4B]'
                            }`}
                          >
                            {formatPriceFromPaise(svc.pricePaise, 'INR')}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <Button
                type="submit"
                variant="primary"
                loading={joining}
                className="w-full min-h-12 text-[15px]"
              >
                <Sparkles className="h-4 w-4 text-[#D2DB76]" aria-hidden />
                Get My Queue Token
              </Button>
            </form>
          )}
        </section>
      )}

      {/* 3. COMPACT LOYALTY STARS PROGRESS + GOOGLE REVIEW FOOTER */}
      <div className="bistro-card p-4 space-y-3">
        {config.awardStarOnCompletion && (
          <div className="flex items-center justify-between gap-3 rounded-2xl bg-[#1E1B4B] px-4 py-3 text-[#FFFFFF]">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#D2DB76] text-[#1E1B4B]">
                <Star className="h-4.5 w-4.5 fill-current" aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="text-[13px] font-extrabold">
                  Loyalty Progress: ★ {loyaltyStars} / {nextRewardTarget} Stars
                </p>
                <p className="text-[11px] text-[#D2DB76] truncate">
                  Earn +1 Star automatically when your cut completes!
                </p>
              </div>
            </div>
          </div>
        )}

        <Link
          to={`/r/${business.slug}`}
          className="flex items-center justify-between gap-3 rounded-2xl border border-[#1E1B4B]/12 bg-[#F8F9FA] px-4 py-3 text-[#111827] hover:border-[#1E1B4B]/35 transition-colors"
        >
          <div className="flex items-center gap-2.5">
            <MessageSquareHeart
              className="h-4.5 w-4.5 text-[#D97706]"
              aria-hidden
            />
            <div>
              <p className="text-[13.5px] font-extrabold">
                Love your fresh cut? Leave a Google Review
              </p>
              <p className="text-[11.5px] text-[#6B7280]">
                Takes 30 seconds — helps our barbers grow
              </p>
            </div>
          </div>
          <span className="text-[12px] font-extrabold text-[#1E1B4B]">→</span>
        </Link>
      </div>
    </div>
  );
}
