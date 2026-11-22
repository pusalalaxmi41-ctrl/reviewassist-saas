import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import QRCode from 'qrcode';
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
  QrCode,
  CalendarClock,
} from 'lucide-react';
import type {
  BarberBookingType,
  BarberQueueTicket,
  PublicBarberQueueStatusPayload,
} from '../types/barberQueue';
import { businessRepository } from '../services/storage';
import {
  encodeBarberQueueTicketQr,
  formatTicketDisplayCode,
  formatTimeSlot12h,
  generateBookableTimeSlots,
  getTodayQueueDateKey,
} from '../utils/barberQueueValidation';
import { formatPriceFromPaise } from '../utils/restaurantValidation';

const BOOKABLE_TIME_SLOTS = generateBookableTimeSlots();

interface StoredQueueTicketRef {
  ticketId: string;
  tokenNumber: number;
  displayCode?: string;
  bookingType?: BarberBookingType;
  scheduledTime?: string | null;
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

  // Join Queue Form state (Hybrid Walk-In vs Booked Time Slot)
  const [bookingMode, setBookingMode] = useState<BarberBookingType>('walk_in');
  const [selectedSlotTime, setSelectedSlotTime] = useState<string>('16:30');
  const [guestName, setGuestName] = useState('');
  const [phone, setPhone] = useState('');
  const [selectedServiceName, setSelectedServiceName] = useState<string>('');
  const [joining, setJoining] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Leave Queue confirmation state
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [leaving, setLeaving] = useState(false);

  // Personal Live Token QR code canvas ref (QR #2 given to customer after scanning Shop QR #1)
  const tokenQrCanvasRef = useRef<HTMLCanvasElement>(null);

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

  // Initial load + 5s live auto-refresh + instant refresh on tab focus
  useEffect(() => {
    let active = true;
    const initTimer = window.setTimeout(() => {
      if (active) {
        void fetchQueueStatus(true);
      }
    }, 0);
    const interval = window.setInterval(() => {
      void fetchQueueStatus(true);
    }, 5000);

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

  // Draw the customer's scannable Personal Live Token QR code whenever they hold an active ticket
  useEffect(() => {
    if (!businessSlug || !storedTicket || !tokenQrCanvasRef.current) return;
    const qrPayload = encodeBarberQueueTicketQr(
      businessSlug,
      storedTicket.ticketId,
      storedTicket.tokenNumber,
    );
    void QRCode.toCanvas(tokenQrCanvasRef.current, qrPayload, {
      width: 176,
      margin: 2,
      errorCorrectionLevel: 'M',
      color: { dark: '#111318', light: '#FFFFFF' },
    });
  }, [businessSlug, storedTicket, queueData?.waitingCount, queueData?.nowServing?.id]);

  const bookedSlotsSet = new Set(queueData?.bookedSlotsToday ?? []);
  const effectiveSlotTime = bookedSlotsSet.has(selectedSlotTime)
    ? (BOOKABLE_TIME_SLOTS.find((s) => !bookedSlotsSet.has(s.value))?.value ??
      selectedSlotTime)
    : selectedSlotTime;

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
        bookingType: bookingMode,
        scheduledTime: bookingMode === 'appointment' ? effectiveSlotTime : null,
      });
      const ref: StoredQueueTicketRef = {
        ticketId: res.ticket.id,
        tokenNumber: res.ticket.tokenNumber,
        displayCode: formatTicketDisplayCode(res.ticket),
        bookingType: res.ticket.bookingType ?? bookingMode,
        scheduledTime: res.ticket.scheduledTime ?? null,
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
        className="mx-auto max-w-md rounded-3xl border border-[#111318]/12 bg-[#FAF8F5] p-12 text-center shadow-sm"
      >
        <Loader2
          className="mx-auto h-7 w-7 animate-spin text-[#111318]"
          aria-hidden
        />
        <p className="mt-3 text-[15px] font-semibold text-[#5C6068]">
          Loading Barber Live Queue…
        </p>
      </div>
    );
  }

  if (!queueData) {
    return (
      <div
        role="alert"
        className="mx-auto max-w-md rounded-3xl border border-[#111318]/12 bg-[#FAF8F5] p-8 text-center shadow-sm space-y-4"
      >
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#111318] text-[#C89B3C]">
          <SearchX className="h-6 w-6" aria-hidden />
        </div>
        <h1 className="text-[22px] font-extrabold text-[#111318]">
          Live queue unavailable
        </h1>
        <p className="text-[14px] text-[#5C6068] leading-relaxed">
          No active barber shop matched{' '}
          <span className="font-mono font-semibold text-[#111318]">
            /r/{businessSlug || '(empty)'}/queue
          </span>
          . If you just registered this shop, approve it under{' '}
          <strong>Barber &amp; Salon Approvals</strong> in the Admin Panel or
          open your Barber Studio.
        </p>
        <div className="flex flex-col gap-2 pt-2">
          <Link
            to="/barber/dashboard"
            className="inline-flex h-11 items-center justify-center rounded-xl bg-[#111318] px-4 text-[14px] font-bold text-[#FAF8F5] hover:bg-[#1F232C]"
          >
            Open Barber Queue Studio
          </Link>
          <Link
            to="/r/crown-cuts-barber/queue"
            className="inline-flex h-10 items-center justify-center rounded-xl border border-[#111318]/20 bg-[#FFFFFF] px-4 text-[13px] font-bold text-[#111318] hover:bg-[#F3EFE8]"
          >
            Try Demo Barber Live Queue
          </Link>
        </div>
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
    <div className="mx-auto w-full max-w-md pb-12 space-y-4 animate-fadeSlideUp">
      {/* 1. DEDICATED BARBERSHOP STUDIO HEADER (Obsidian + Brushed Brass Gold) */}
      <header className="overflow-hidden rounded-3xl border border-[#111318]/15 bg-[#111318] text-[#FAF8F5] shadow-lg">
        {/* Subtle Barber Brass Top Stripe */}
        <div className="h-1.5 w-full bg-gradient-to-r from-[#C89B3C] via-[#F3E3B8] to-[#C89B3C]" />
        <div className="p-5 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-[#C89B3C]/40 bg-[#1B1F27] text-[#F3E3B8] shadow-sm">
                <Scissors className="h-5 w-5" aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-[#C89B3C]">
                  BARBER LIVE QUEUE PASS
                </p>
                <h1 className="truncate text-[21px] font-black tracking-tight text-[#FFFFFF]">
                  {business.name}
                </h1>
                <p className="truncate text-[12px] font-medium text-[#A3A8B3]">
                  {business.city} • Real-Time Chair Timer
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => void fetchQueueStatus(false)}
              aria-label="Refresh live queue"
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/15 bg-white/5 text-[#F3E3B8] hover:bg-white/10 cursor-pointer"
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
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-extrabold uppercase tracking-wider ${
                config.isQueueOpen
                  ? 'border-emerald-500/35 bg-emerald-500/15 text-emerald-300'
                  : 'border-amber-400/40 bg-amber-500/15 text-amber-300'
              }`}
            >
              <span className="relative flex h-2 w-2">
                {config.isQueueOpen && (
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                )}
                <span
                  className={`relative inline-flex h-2 w-2 rounded-full ${
                    config.isQueueOpen ? 'bg-emerald-400' : 'bg-amber-400'
                  }`}
                />
              </span>
              {config.isQueueOpen ? 'OPEN • Walk-Ins & Slots Live' : 'PAUSED'}
            </span>

            <span className="text-[11px] font-semibold text-[#A3A8B3]">
              Syncs every 5s
            </span>
          </div>

          {/* BIG 2-COLUMN LIVE TELEMETRY STRIP */}
          <div className="grid grid-cols-2 gap-3 pt-1">
            <div className="rounded-2xl border border-[#C89B3C]/30 bg-[#1B1F27] p-3.5">
              <p className="text-[10.5px] font-bold uppercase tracking-wider text-[#F3E3B8]">
                Now In Chair
              </p>
              <p className="mt-1 text-[23px] leading-tight font-black tabular-nums text-[#FFFFFF]">
                {nowServing ? formatTicketDisplayCode(nowServing) : 'Open'}
              </p>
              <p className="mt-0.5 truncate text-[11.5px] text-[#A3A8B3]">
                {nowServing
                  ? `~${nowServing.remainingMinutes ?? nowServing.durationMinutes}m left${
                      nowServing.bookingType === 'appointment' &&
                      nowServing.scheduledTime
                        ? ` · ${formatTimeSlot12h(nowServing.scheduledTime)}`
                        : ''
                    }`
                  : 'Chair ready now'}
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-[#1B1F27] p-3.5">
              <p className="text-[10.5px] font-bold uppercase tracking-wider text-[#A3A8B3] flex items-center gap-1">
                <Users className="h-3 w-3 text-[#C89B3C]" aria-hidden /> Waiting
              </p>
              <p className="mt-1 text-[23px] leading-tight font-black tabular-nums text-[#FFFFFF]">
                {waitingCount} {waitingCount === 1 ? 'Guest' : 'Guests'}
              </p>
              <p className="mt-0.5 text-[11.5px] font-semibold text-[#F3E3B8] tabular-nums">
                ~{estimatedWaitForNewGuestMinutes} mins wait
              </p>
            </div>
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

      {/* 2A. ACTIVE LIVE COUNTDOWN + PERSONAL TOKEN QR PASS */}
      {myActiveTicket && storedTicket && (
        <section
          aria-label="Your Live Queue Token Pass"
          className={`rounded-3xl border-2 p-5 sm:p-6 shadow-md space-y-4 transition-colors duration-300 ${
            isAlmostUp
              ? 'border-[#C89B3C] bg-[#F3E3B8] text-[#111318]'
              : 'border-[#111318]/15 bg-[#FAF8F5] text-[#111318]'
          }`}
        >
          {/* You're Next / In Chair Alert Banner */}
          {isAlmostUp && (
            <div
              role="status"
              className="flex items-center gap-2.5 rounded-2xl bg-[#111318] px-4 py-3 text-[#FAF8F5] shadow-sm"
            >
              <BellRing
                className="h-5 w-5 shrink-0 text-[#F3E3B8] animate-bounce"
                aria-hidden
              />
              <p className="text-[13.5px] font-extrabold">
                {isMyTicketInChair
                  ? "It's Your Turn! Please take your seat at the barber chair."
                  : "You're Up Next! Head back to the shop & flash your Token QR."}
              </p>
            </div>
          )}

          {/* Giant Token Badge + Live Countdown Timer */}
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5">
                {myActiveTicket.bookingType === 'appointment' ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-[#111318] px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-[#F3E3B8]">
                    <CalendarClock className="h-3 w-3" aria-hidden />
                    Booked{' '}
                    {formatTimeSlot12h(myActiveTicket.scheduledTime) || 'Slot'}
                  </span>
                ) : (
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider ${
                      isAlmostUp
                        ? 'bg-[#111318]/12 text-[#111318]'
                        : 'bg-[#111318]/8 text-[#5C6068]'
                    }`}
                  >
                    Walk-In Token
                  </span>
                )}
              </div>
              <p
                data-testid="active-queue-token"
                className="text-[50px] leading-none font-black tracking-tight tabular-nums text-[#111318] mt-1.5"
              >
                {formatTicketDisplayCode(myActiveTicket)}
              </p>
              <p className="mt-1.5 text-[14px] font-bold text-[#111318] truncate">
                {myActiveTicket.guestName} • {myActiveTicket.serviceName}
              </p>
            </div>

            <div
              className={`rounded-2xl p-3.5 text-center min-w-[116px] ${
                isAlmostUp
                  ? 'bg-[#111318] text-[#FFFFFF]'
                  : 'bg-[#111318] text-[#FFFFFF] shadow-sm'
              }`}
            >
              <Clock
                className="mx-auto h-5 w-5 text-[#F3E3B8]"
                aria-hidden
              />
              <p
                data-testid="active-queue-eta"
                className="mt-1 text-[23px] leading-none font-black tabular-nums text-[#FFFFFF]"
              >
                {isMyTicketInChair
                  ? 'NOW'
                  : estWait === 0
                    ? '<5m'
                    : `~${estWait}m`}
              </p>
              <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-[#F3E3B8]">
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
              className="rounded-2xl border border-amber-400 bg-amber-50 px-4 py-3 text-[13px] font-bold text-[#92400E]"
            >
              ⏱ Barber updated live timer (+{extraDelay} mins) — Your updated wait is ~{estWait} mins
            </div>
          )}

          {/* CUSTOMER'S NEW PERSONAL SCANNABLE TOKEN QR CODE (QR #2) */}
          <div className="rounded-2xl border border-[#111318]/12 bg-[#FFFFFF] p-4 text-center space-y-2.5 shadow-2xs">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-[#111318] px-3 py-1 text-[10.5px] font-extrabold uppercase tracking-wider text-[#F3E3B8]">
              <QrCode className="h-3.5 w-3.5" aria-hidden />
              <span>Your Personal Chair Check-In QR</span>
            </div>
            <div className="flex justify-center">
              <canvas
                ref={tokenQrCanvasRef}
                aria-label={`Personal Live Queue Token QR for Token #${myActiveTicket.tokenNumber}`}
                className="rounded-xl border border-[#111318]/10 bg-[#FFFFFF] p-1"
              />
            </div>
            <p className="font-mono text-[11px] font-bold text-[#5C6068]">
              {formatTicketDisplayCode(myActiveTicket)} ·{' '}
              {myActiveTicket.guestName.toUpperCase()}
              {myActiveTicket.bookingType === 'appointment' &&
              myActiveTicket.scheduledTime
                ? ` · ${formatTimeSlot12h(myActiveTicket.scheduledTime)}`
                : ''}
            </p>
            <p className="text-[12px] text-[#5C6068] leading-snug">
              Show this QR pass to your barber when your timer reaches zero to check in &amp; earn your Loyalty Star.
            </p>
          </div>

          {/* Reassuring Step-Out Indicator */}
          {!isMyTicketInChair && (
            <div
              className={`flex items-center gap-2 rounded-2xl px-3.5 py-2.5 text-[12.5px] font-semibold ${
                isAlmostUp
                  ? 'bg-[#FFFFFF]/80 text-[#111318]'
                  : 'bg-emerald-50 border border-emerald-200 text-[#065F46]'
              }`}
            >
              <span className="relative flex h-2.5 w-2.5 shrink-0">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#059669] opacity-75" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#059669]" />
              </span>
              <span>
                Step out worry-free — your timer updates automatically whenever the barber adjusts time
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
                  className="inline-flex items-center gap-1.5 text-[12.5px] font-bold text-[#111318]/70 hover:text-[#111318] hover:underline cursor-pointer"
                >
                  <LogOut className="h-3.5 w-3.5" aria-hidden /> Leave Queue
                </button>
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-red-50 border border-red-200 p-3 text-red-900">
                  <span className="text-[12px] font-bold">
                    Give up {formatTicketDisplayCode(myActiveTicket)}?
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setConfirmLeave(false)}
                      className="rounded-lg bg-white border border-red-200 px-3 py-1 text-[12px] font-bold text-[#111318] cursor-pointer"
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
        <section className="rounded-3xl border-2 border-emerald-400 bg-emerald-50 p-6 text-center shadow-sm space-y-3.5 animate-fadeSlideUp">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#059669] text-[#FFFFFF]">
            <CheckCircle2 className="h-6 w-6" aria-hidden />
          </div>
          <div className="space-y-1">
            <h2 className="text-[20px] font-extrabold text-[#111318]">
              Looking Fresh, {storedTicket.guestName}!
            </h2>
            <p className="text-[13px] font-medium text-[#065F46]">
              Token {formatTicketDisplayCode(storedTicket)} ({storedTicket.serviceName}) is complete.
              {config.awardStarOnCompletion && storedTicket.phone
                ? ' Your Loyalty Star has been credited!'
                : ''}
            </p>
          </div>
          <div className="flex flex-col gap-2 pt-1">
            <Link
              to={`/r/${business.slug}`}
              className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#111318] px-4 py-2.5 text-[14px] font-extrabold text-[#FAF8F5] hover:bg-[#1F232C]"
            >
              <MessageSquareHeart className="h-4 w-4 text-[#F3E3B8]" aria-hidden />
              Leave a 30-Second Google Review
            </Link>
            <button
              type="button"
              onClick={() => {
                saveStoredTicket(business.slug, null);
                setStoredTicket(null);
              }}
              className="text-[12.5px] font-bold text-[#111318] hover:underline py-1 cursor-pointer"
            >
              Need another spot? Join Queue Again
            </button>
          </div>
        </section>
      )}

      {/* 2C. 1-TAP JOIN QUEUE FORM (No Active Ticket Yet) */}
      {!storedTicket && (
        <section className="rounded-3xl border border-[#111318]/12 bg-[#FAF8F5] p-6 shadow-sm space-y-5">
          {!config.isQueueOpen ? (
            <div className="py-4 text-center space-y-2">
              <Clock className="mx-auto h-9 w-9 text-[#C89B3C]" aria-hidden />
              <h2 className="text-[18px] font-extrabold text-[#111318]">
                Walk-In Queue Temporarily Paused
              </h2>
              <p className="text-[13px] text-[#5C6068]">
                The barber has paused new walk-ins for a moment. Check back shortly or ask inside.
              </p>
            </div>
          ) : (
            <form
              onSubmit={(e) => void handleJoinQueue(e)}
              className="space-y-4"
            >
              <div>
                <h2 className="text-[19px] font-black text-[#111318]">
                  Claim Your Live Token or Book a Slot
                </h2>
                <p className="mt-0.5 text-[13px] text-[#5C6068]">
                  Join the instant walk-in line or reserve an exact time slot today — both give you a live Token QR pass.
                </p>
              </div>

              {/* 2-OPTION HYBRID QUEUE SWITCHER: Walk-In vs Booked Time Slot */}
              <div
                role="tablist"
                aria-label="Choose walk-in or time slot booking"
                className="grid grid-cols-2 gap-2 rounded-2xl border border-[#111318]/12 bg-[#FFFFFF] p-1.5"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={bookingMode === 'walk_in'}
                  onClick={() => {
                    setBookingMode('walk_in');
                    setFormError(null);
                  }}
                  className={`rounded-xl px-3 py-2.5 text-left transition-all cursor-pointer ${
                    bookingMode === 'walk_in'
                      ? 'bg-[#111318] text-[#FAF8F5] shadow-sm'
                      : 'text-[#5C6068] hover:bg-[#FAF8F5] hover:text-[#111318]'
                  }`}
                >
                  <span className="flex items-center gap-1.5 text-[12.5px] font-extrabold">
                    <Users className="h-3.5 w-3.5 text-[#C89B3C]" aria-hidden />
                    Join Walk-In
                  </span>
                  <span
                    className={`mt-0.5 block text-[10.5px] font-semibold ${
                      bookingMode === 'walk_in'
                        ? 'text-[#F3E3B8]'
                        : 'text-[#5C6068]'
                    }`}
                  >
                    Next open (~{estimatedWaitForNewGuestMinutes}m)
                  </span>
                </button>

                <button
                  type="button"
                  role="tab"
                  aria-selected={bookingMode === 'appointment'}
                  onClick={() => {
                    setBookingMode('appointment');
                    setFormError(null);
                  }}
                  className={`rounded-xl px-3 py-2.5 text-left transition-all cursor-pointer ${
                    bookingMode === 'appointment'
                      ? 'bg-[#111318] text-[#FAF8F5] shadow-sm'
                      : 'text-[#5C6068] hover:bg-[#FAF8F5] hover:text-[#111318]'
                  }`}
                >
                  <span className="flex items-center gap-1.5 text-[12.5px] font-extrabold">
                    <CalendarClock
                      className="h-3.5 w-3.5 text-[#C89B3C]"
                      aria-hidden
                    />
                    Book Time Slot
                  </span>
                  <span
                    className={`mt-0.5 block text-[10.5px] font-semibold ${
                      bookingMode === 'appointment'
                        ? 'text-[#F3E3B8]'
                        : 'text-[#5C6068]'
                    }`}
                  >
                    Reserve today&apos;s slot
                  </span>
                </button>
              </div>

              {/* TIME SLOT PICKER (Only when Booking a Specific Time Slot Today) */}
              {bookingMode === 'appointment' && (
                <div className="rounded-2xl border border-[#C89B3C]/40 bg-[#FFFFFF] p-3.5 space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#111318]">
                      Select Today&apos;s Appointment Slot
                    </span>
                    <span className="text-[11px] font-bold text-[#9A7420]">
                      {formatTimeSlot12h(effectiveSlotTime)}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5 max-h-44 overflow-y-auto pr-1">
                    {BOOKABLE_TIME_SLOTS.map((slot) => {
                      const isTaken = bookedSlotsSet.has(slot.value);
                      const isSelected = effectiveSlotTime === slot.value;
                      return (
                        <button
                          key={slot.value}
                          type="button"
                          disabled={isTaken}
                          onClick={() => setSelectedSlotTime(slot.value)}
                          className={`rounded-xl border px-2 py-2 text-center text-[11.5px] font-extrabold tabular-nums transition-all ${
                            isTaken
                              ? 'border-[#111318]/10 bg-[#F3EFE8] text-[#9CA3AF] line-through cursor-not-allowed'
                              : isSelected
                                ? 'border-2 border-[#C89B3C] bg-[#111318] text-[#F3E3B8] shadow-xs cursor-pointer'
                                : 'border-[#111318]/15 bg-[#FAF8F5] text-[#111318] hover:border-[#C89B3C] cursor-pointer'
                          }`}
                        >
                          {slot.label}
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-[11px] font-medium text-[#5C6068] leading-snug">
                    Fair Queue Guarantee: Your slot is reserved automatically — walk-in guests see honest wait times up front.
                  </p>
                </div>
              )}

              <div className="space-y-3">
                <div className="space-y-1">
                  <label
                    htmlFor="queueGuestName"
                    className="block text-[11.5px] font-bold uppercase tracking-wider text-[#5C6068]"
                  >
                    Your Name
                  </label>
                  <div className="relative flex items-center">
                    <User
                      className="pointer-events-none absolute left-3.5 h-4 w-4 text-[#5C6068]"
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
                      className="block h-11 w-full rounded-xl border border-[#111318]/20 bg-[#FFFFFF] pl-10 pr-3.5 text-[14px] font-semibold text-[#111318] focus:border-[#111318] focus:outline-none"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label
                    htmlFor="queueGuestPhone"
                    className="block text-[11.5px] font-bold uppercase tracking-wider text-[#5C6068]"
                  >
                    Phone Number{' '}
                    <span className="normal-case font-semibold text-[#059669]">
                      (Saves Loyalty Stars ★ automatically)
                    </span>
                  </label>
                  <div className="relative flex items-center">
                    <Phone
                      className="pointer-events-none absolute left-3.5 h-4 w-4 text-[#5C6068]"
                      aria-hidden
                    />
                    <input
                      id="queueGuestPhone"
                      type="tel"
                      maxLength={40}
                      placeholder="e.g. +91 98765 43210"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="block h-11 w-full rounded-xl border border-[#111318]/20 bg-[#FFFFFF] pl-10 pr-3.5 text-[14px] font-semibold text-[#111318] focus:border-[#111318] focus:outline-none"
                    />
                  </div>
                </div>

                {/* Pick a Service */}
                <div className="space-y-1.5">
                  <span className="block text-[11.5px] font-bold uppercase tracking-wider text-[#5C6068]">
                    Select Grooming Service
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
                              ? 'border-2 border-[#111318] bg-[#111318] text-[#FFFFFF] shadow-sm'
                              : 'border-[#111318]/15 bg-[#FFFFFF] text-[#111318] hover:border-[#C89B3C]'
                          }`}
                        >
                          <div className="min-w-0">
                            <p className="text-[14px] font-extrabold truncate">
                              {svc.name}
                            </p>
                            <p
                              className={`text-[11.5px] font-semibold ${
                                active ? 'text-[#F3E3B8]' : 'text-[#5C6068]'
                              }`}
                            >
                              ~{svc.durationMinutes} mins
                            </p>
                          </div>
                          <span
                            className={`shrink-0 rounded-full px-3 py-1 text-[12.5px] font-extrabold tabular-nums ${
                              active
                                ? 'bg-[#C89B3C] text-[#111318]'
                                : 'bg-[#FAF8F5] border border-[#111318]/12 text-[#111318]'
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

              <button
                type="submit"
                disabled={
                  joining ||
                  (bookingMode === 'appointment' &&
                    bookedSlotsSet.has(effectiveSlotTime))
                }
                className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#111318] px-5 py-3 text-[15px] font-extrabold text-[#FAF8F5] shadow-md hover:bg-[#1F232C] active:scale-[0.98] disabled:opacity-60 transition-all cursor-pointer"
              >
                {bookingMode === 'appointment' ? (
                  <CalendarClock
                    className="h-4 w-4 text-[#F3E3B8]"
                    aria-hidden
                  />
                ) : (
                  <Sparkles className="h-4 w-4 text-[#F3E3B8]" aria-hidden />
                )}
                {joining
                  ? bookingMode === 'appointment'
                    ? 'Reserving Your Time Slot…'
                    : 'Issuing Your Token QR…'
                  : bookingMode === 'appointment'
                    ? `Book ${formatTimeSlot12h(effectiveSlotTime)} Slot & Get QR Pass`
                    : 'Get Walk-In Token & QR Pass'}
              </button>
            </form>
          )}
        </section>
      )}

      {/* 3. GROOMING LOYALTY STARS + GOOGLE REVIEW FOOTER */}
      <div className="rounded-3xl border border-[#111318]/12 bg-[#FAF8F5] p-4 shadow-2xs space-y-3">
        {config.awardStarOnCompletion && (
          <div className="flex items-center justify-between gap-3 rounded-2xl bg-[#111318] px-4 py-3 text-[#FAF8F5]">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#C89B3C] text-[#111318]">
                <Star className="h-4.5 w-4.5 fill-current" aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="text-[13px] font-extrabold">
                  Loyalty Progress: ★ {loyaltyStars} / {nextRewardTarget} Stars
                </p>
                <p className="text-[11px] text-[#F3E3B8] truncate">
                  Earn +1 Star automatically when your cut completes!
                </p>
              </div>
            </div>
          </div>
        )}

        <Link
          to={`/r/${business.slug}`}
          className="flex items-center justify-between gap-3 rounded-2xl border border-[#111318]/12 bg-[#FFFFFF] px-4 py-3 text-[#111318] hover:border-[#C89B3C] transition-colors"
        >
          <div className="flex items-center gap-2.5">
            <MessageSquareHeart
              className="h-4.5 w-4.5 text-[#C89B3C]"
              aria-hidden
            />
            <div>
              <p className="text-[13.5px] font-extrabold">
                Love your fresh cut? Leave a Google Review
              </p>
              <p className="text-[11.5px] text-[#5C6068]">
                Takes 30 seconds — helps our barbers grow
              </p>
            </div>
          </div>
          <span className="text-[12px] font-extrabold text-[#111318]">→</span>
        </Link>
      </div>
    </div>
  );
}
