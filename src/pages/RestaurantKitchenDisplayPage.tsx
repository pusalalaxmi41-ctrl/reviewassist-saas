import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  AlertCircle,
  CheckCircle2,
  ChefHat,
  Clock,
  Flame,
  KeyRound,
  Loader2,
  Lock,
  LogOut,
  Printer,
  RefreshCw,
  SearchX,
  Volume2,
  VolumeX,
} from 'lucide-react';
import type { Business } from '../types/business';
import type {
  PublicStaffLoginOption,
  RestaurantTableOrder,
  RestaurantTableOrderStatus,
  VerifiedStaffMemberSession,
} from '../types/restaurant';
import { useAuth } from '../context/useAuth';
import { businessRepository } from '../services/storage';
import {
  hashStaffPin,
  validateStaffPinFormat,
} from '../utils/restaurantValidation';
import {
  formatElapsedTimerMMSS,
  isPlatformOrOffPremiseSource,
  ORDER_SOURCE_METADATA,
  printKitchenKotTicket,
  speakHospitalityAlert,
} from '../utils/hospitalityHelpers';

type KdsChannelFilter = 'all' | 'tables' | 'rooms' | 'delivery';

export default function RestaurantKitchenDisplayPage() {
  const { businessSlug } = useParams<{ businessSlug: string }>();
  const { user } = useAuth();

  const [business, setBusiness] = useState<Business | null>(null);
  const [staffDirectory, setStaffDirectory] = useState<
    PublicStaffLoginOption[]
  >([]);
  const [loading, setLoading] = useState(true);

  // Auth / PIN state
  const [selectedStaffCode, setSelectedStaffCode] = useState('');
  const [pinInput, setPinInput] = useState('');
  const [verifiedPinHash, setVerifiedPinHash] = useState<string | null>(null);
  const [ownerBypassUnlocked, setOwnerBypassUnlocked] = useState(false);
  const [staffSession, setStaffSession] =
    useState<VerifiedStaffMemberSession | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // KDS Live State
  const [orders, setOrders] = useState<RestaurantTableOrder[]>([]);
  const [channelFilter, setChannelFilter] = useState<KdsChannelFilter>('all');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);
  const [statusBanner, setStatusBanner] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState<number>(() => Date.now());

  const soundEnabledRef = useRef(true);
  const initializedRef = useRef(false);
  const seenTicketIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    soundEnabledRef.current = soundEnabled;
  }, [soundEnabled]);

  // 1-second live elapsed timer tick (avoids Date.now() during render)
  useEffect(() => {
    const tick = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => window.clearInterval(tick);
  }, []);

  // Load business + staff login directory
  useEffect(() => {
    async function load() {
      if (!businessSlug) {
        setLoading(false);
        return;
      }
      setLoading(true);
      const biz = await businessRepository.getBusinessBySlug(businessSlug);
      setBusiness(biz);
      if (biz) {
        if (user && biz.ownerId === user.id) {
          setOwnerBypassUnlocked(true);
        }
        try {
          const dir = await businessRepository.getPublicStaffLoginDirectory(
            biz.slug,
          );
          setStaffDirectory(dir);
          const chefFirst =
            dir.find((d) => d.role === 'chef') ??
            dir.find((d) => d.role === 'manager') ??
            dir[0];
          if (chefFirst) {
            setSelectedStaffCode(chefFirst.staffCode);
          }
        } catch {
          setStaffDirectory([]);
        }
      }
      setLoading(false);
    }
    void load();
  }, [businessSlug, user]);

  const isUnlocked = ownerBypassUnlocked || Boolean(staffSession);

  const loadTickets = useCallback(async () => {
    if (!business || !isUnlocked) return;
    try {
      const payload = await businessRepository.getRestaurantFloorAndAnalytics({
        businessSlug: business.slug,
        staffPinHash: ownerBypassUnlocked ? null : verifiedPinHash,
      });
      const activeTickets = (payload.tableOrders ?? []).filter(
        (o) => o.status !== 'cancelled' && o.status !== 'served',
      );
      setOrders(activeTickets);

      if (!initializedRef.current) {
        seenTicketIdsRef.current = new Set(activeTickets.map((t) => t.id));
        initializedRef.current = true;
      } else {
        for (const ticket of activeTickets) {
          if (!seenTicketIdsRef.current.has(ticket.id)) {
            seenTicketIdsRef.current.add(ticket.id);
            const src =
              ORDER_SOURCE_METADATA[ticket.orderSource ?? 'qr_table'] ??
              ORDER_SOURCE_METADATA.qr_table;
            const loc = ticket.platformOrderNumber
              ? `${src.shortLabel} order ${ticket.platformOrderNumber}`
              : ticket.tableNumber || src.shortLabel;
            speakHospitalityAlert(
              `New kitchen ticket for ${loc}`,
              soundEnabledRef.current,
            );
            break;
          }
        }
      }
    } catch {
      // ignore transient polling errors
    }
  }, [business, isUnlocked, ownerBypassUnlocked, verifiedPinHash]);

  useEffect(() => {
    if (!business || !isUnlocked) return;
    const initTimer = window.setTimeout(() => {
      void loadTickets();
    }, 0);
    const unsub = businessRepository.subscribeToHospitalityRealtime(
      business.id,
      () => {
        void loadTickets();
      },
    );
    const poll = window.setInterval(() => {
      void loadTickets();
    }, 8000);
    return () => {
      window.clearTimeout(initTimer);
      unsub();
      window.clearInterval(poll);
    };
  }, [business, isUnlocked, loadTickets]);

  async function handleUnlockWithPin(e: React.FormEvent) {
    e.preventDefault();
    if (!business) return;
    setAuthError(null);
    const check = validateStaffPinFormat(pinInput);
    if (!check.ok) {
      setAuthError(check.error);
      return;
    }
    setVerifying(true);
    try {
      const hashed = await hashStaffPin(business.slug, check.pin);
      const session = await businessRepository.verifyStaffMemberPin({
        businessSlug: business.slug,
        staffCode: selectedStaffCode || null,
        staffPinHash: hashed,
      });
      setStaffSession(session);
      setVerifiedPinHash(hashed);
      setPinInput('');
    } catch (err) {
      setAuthError((err as Error).message);
    } finally {
      setVerifying(false);
    }
  }

  async function handleAdvanceStatus(
    orderId: string,
    nextStatus: RestaurantTableOrderStatus,
  ) {
    if (!business) return;
    setUpdatingOrderId(orderId);
    try {
      await businessRepository.updateTableOrderStatus({
        businessSlug: business.slug,
        orderId,
        status: nextStatus,
        staffLabel: staffSession?.staffLabel ?? 'Kitchen Chef',
        staffPinHash: ownerBypassUnlocked ? null : verifiedPinHash,
      });
      await loadTickets();
      const msg =
        nextStatus === 'preparing'
          ? 'Ticket moved to Preparing 🔥'
          : nextStatus === 'ready'
            ? 'Ticket marked READY for pickup ✓'
            : 'Ticket handed over / served ✓';
      setStatusBanner(msg);
      window.setTimeout(() => {
        setStatusBanner((prev) => (prev === msg ? null : prev));
      }, 3000);
    } catch (err) {
      setAuthError((err as Error).message);
    } finally {
      setUpdatingOrderId(null);
    }
  }

  const filteredTickets = useMemo(() => {
    const sorted = [...orders].sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );
    return sorted.filter((ord) => {
      if (channelFilter === 'all') return true;
      if (channelFilter === 'rooms') {
        return ord.locationType === 'room' || ord.orderSource === 'qr_room';
      }
      if (channelFilter === 'delivery') {
        return isPlatformOrOffPremiseSource(ord.orderSource);
      }
      if (channelFilter === 'tables') {
        return (
          !isPlatformOrOffPremiseSource(ord.orderSource) &&
          ord.locationType !== 'room' &&
          ord.orderSource !== 'qr_room'
        );
      }
      return true;
    });
  }, [orders, channelFilter]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0B1120] text-slate-100 flex items-center justify-center p-6">
        <div className="text-center space-y-3">
          <Loader2
            className="mx-auto h-9 w-9 animate-spin text-[#D2DB76]"
            aria-hidden
          />
          <p className="text-[14px] font-bold text-slate-300">
            Booting Dark-Mode Kitchen Display System…
          </p>
        </div>
      </div>
    );
  }

  if (!business) {
    return (
      <div className="min-h-screen bg-[#0B1120] text-slate-100 flex items-center justify-center p-6">
        <div className="max-w-md w-full rounded-3xl border border-slate-800 bg-slate-900 p-8 text-center space-y-3">
          <SearchX className="mx-auto h-8 w-8 text-[#D2DB76]" aria-hidden />
          <h1 className="text-[22px] font-extrabold text-white">
            Kitchen Not Found
          </h1>
          <p className="text-[13.5px] text-slate-400">
            Double-check the venue URL and try again.
          </p>
        </div>
      </div>
    );
  }

  // PIN Lock Gate (for dedicated kitchen tablets)
  if (!isUnlocked) {
    return (
      <div className="min-h-screen bg-[#0B1120] text-slate-100 flex items-center justify-center p-5">
        <div className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900/95 p-7 shadow-2xl space-y-6">
          <div className="text-center space-y-2">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#1E1B4B] border border-[#D2DB76]/40 text-[#D2DB76]">
              <ChefHat className="h-7 w-7" aria-hidden />
            </div>
            <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-[#D2DB76]">
              Kitchen Display System (KDS)
            </p>
            <h1 className="text-[24px] font-extrabold text-white">
              {business.name}
            </h1>
            <p className="text-[13px] text-slate-400">
              Enter your Chef or Manager PIN to open live Kitchen Order Tickets.
            </p>
          </div>

          {authError && (
            <div
              role="alert"
              className="flex items-center gap-2 rounded-xl border border-rose-500/40 bg-rose-500/15 px-3.5 py-2.5 text-[12.5px] font-semibold text-rose-200"
            >
              <AlertCircle className="h-4 w-4 shrink-0" aria-hidden />
              <span>{authError}</span>
            </div>
          )}

          <form onSubmit={(e) => void handleUnlockWithPin(e)} className="space-y-4">
            {staffDirectory.length > 0 && (
              <div className="space-y-1.5">
                <label
                  htmlFor="kdsStaffSelect"
                  className="block text-[12px] font-bold uppercase tracking-wider text-slate-300"
                >
                  Chef / Staff Profile
                </label>
                <select
                  id="kdsStaffSelect"
                  value={selectedStaffCode}
                  onChange={(e) => setSelectedStaffCode(e.target.value)}
                  className="h-11 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 text-[14px] font-bold text-white focus:border-[#D2DB76] focus:outline-none"
                >
                  {staffDirectory.map((opt) => (
                    <option key={opt.staffCode} value={opt.staffCode}>
                      {opt.fullName} ({opt.staffCode} · {opt.role.toUpperCase()})
                    </option>
                  ))}
                  <option value="">Shared Venue PIN</option>
                </select>
              </div>
            )}

            <div className="space-y-1.5">
              <label
                htmlFor="kdsPinInput"
                className="block text-[12px] font-bold uppercase tracking-wider text-slate-300"
              >
                4–6 Digit PIN
              </label>
              <div className="relative">
                <KeyRound
                  className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                  aria-hidden
                />
                <input
                  id="kdsPinInput"
                  type="password"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  required
                  placeholder="••••"
                  value={pinInput}
                  onChange={(e) =>
                    setPinInput(e.target.value.replace(/\D/g, '').slice(0, 6))
                  }
                  className="h-12 w-full rounded-xl border border-slate-700 bg-slate-950 pl-10 pr-4 text-center font-mono text-[20px] font-extrabold tracking-[0.4em] text-white focus:border-[#D2DB76] focus:outline-none"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={verifying || pinInput.length < 4}
              className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#D2DB76] text-[14px] font-extrabold text-[#1E1B4B] hover:brightness-95 disabled:opacity-50 cursor-pointer"
            >
              {verifying ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <Lock className="h-4 w-4" aria-hidden />
              )}
              {verifying ? 'Verifying PIN…' : 'Unlock Kitchen Display'}
            </button>
          </form>

          <div className="text-center">
            <Link
              to={`/r/${business.slug}/staff`}
              className="text-[12px] font-semibold text-slate-400 hover:text-white underline"
            >
              Switch to Waiter Floor App →
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0B1120] text-slate-100 flex flex-col">
      {/* Dark-Mode KDS Top Command Header */}
      <header className="sticky top-0 z-20 border-b border-slate-800 bg-[#0B1120]/95 backdrop-blur px-4 sm:px-6 py-3.5">
        <div className="mx-auto max-w-[1600px] flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#1E1B4B] border border-[#D2DB76]/40 text-[#D2DB76]">
              <ChefHat className="h-6 w-6" aria-hidden />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-[19px] sm:text-[22px] font-extrabold tracking-tight text-white">
                  {business.name}
                </h1>
                <span className="rounded-full bg-[#D2DB76] px-2.5 py-0.5 text-[11px] font-extrabold text-[#1E1B4B] tabular-nums">
                  {orders.length} ACTIVE KOT{orders.length === 1 ? '' : 'S'}
                </span>
              </div>
              <p className="text-[12px] font-semibold text-slate-400">
                Kitchen Display System •{' '}
                {ownerBypassUnlocked
                  ? 'Owner Live Session'
                  : staffSession?.staffLabel || 'Kitchen Team'}
              </p>
            </div>
          </div>

          {/* Filter Pills */}
          <div className="flex flex-wrap items-center gap-1.5">
            {(
              [
                { id: 'all', label: 'All Tickets' },
                { id: 'tables', label: 'Tables' },
                { id: 'rooms', label: 'Rooms' },
                { id: 'delivery', label: 'Delivery / Platform' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setChannelFilter(tab.id)}
                className={`h-9 rounded-xl px-3.5 text-[12.5px] font-extrabold transition-all cursor-pointer ${
                  channelFilter === tab.id
                    ? 'bg-[#D2DB76] text-[#1E1B4B] shadow-sm'
                    : 'border border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Sound, Refresh, Lock */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                const next = !soundEnabled;
                setSoundEnabled(next);
                if (next) speakHospitalityAlert('Kitchen sound alerts on', true);
              }}
              className={`inline-flex h-9 items-center gap-1.5 rounded-xl border px-3 text-[12px] font-extrabold cursor-pointer ${
                soundEnabled
                  ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300'
                  : 'border-slate-700 bg-slate-900 text-slate-400'
              }`}
            >
              {soundEnabled ? (
                <Volume2 className="h-4 w-4" aria-hidden />
              ) : (
                <VolumeX className="h-4 w-4" aria-hidden />
              )}
              {soundEnabled ? 'Sound ON' : 'Muted'}
            </button>

            <button
              type="button"
              onClick={() => void loadTickets()}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-900 px-3 text-[12px] font-bold text-slate-200 hover:bg-slate-800 cursor-pointer"
            >
              <RefreshCw className="h-3.5 w-3.5" aria-hidden />
              Sync
            </button>

            <button
              type="button"
              onClick={() => {
                setOwnerBypassUnlocked(false);
                setStaffSession(null);
                setVerifiedPinHash(null);
              }}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-900 px-3 text-[12px] font-bold text-slate-300 hover:border-rose-500/50 hover:text-rose-300 cursor-pointer"
              title="Lock KDS screen"
            >
              <LogOut className="h-3.5 w-3.5" aria-hidden />
              Lock
            </button>
          </div>
        </div>
      </header>

      {/* Main KOT Grid Canvas */}
      <main className="mx-auto w-full max-w-[1600px] flex-1 p-4 sm:p-6 space-y-4">
        {statusBanner && (
          <div className="flex items-center gap-2 rounded-2xl border border-emerald-500/40 bg-emerald-500/15 px-4 py-2.5 text-[13px] font-extrabold text-emerald-200">
            <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden />
            <span>{statusBanner}</span>
          </div>
        )}

        {filteredTickets.length === 0 ? (
          <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-16 text-center space-y-3">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300">
              <CheckCircle2 className="h-8 w-8" aria-hidden />
            </div>
            <h2 className="text-[22px] font-extrabold text-white">
              All Kitchen Tickets Clear!
            </h2>
            <p className="text-[14px] text-slate-400 max-w-md mx-auto">
              New QR Table orders, Room Service tickets, Counter POS orders, and Swiggy/Zomato tickets appear here automatically with live prep timers.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 items-start">
            {filteredTickets.map((ticket) => {
              const timer = formatElapsedTimerMMSS(ticket.createdAt, nowMs);
              const isOverdue = timer.minutes >= 20;
              const isWarning = timer.minutes >= 10 && timer.minutes < 20;
              const isBusy = updatingOrderId === ticket.id;

              const headerBarClass = isOverdue
                ? 'bg-rose-600 text-white'
                : isWarning
                  ? 'bg-amber-500 text-[#111827]'
                  : 'bg-emerald-600 text-white';

              const cardBorderClass = isOverdue
                ? 'border-rose-500/80 ring-1 ring-rose-500/40'
                : isWarning
                  ? 'border-amber-500/70'
                  : 'border-slate-700';

              const sourceMeta =
                ORDER_SOURCE_METADATA[ticket.orderSource ?? 'qr_table'] ??
                ORDER_SOURCE_METADATA.qr_table;

              const locHeadline = ticket.platformOrderNumber
                ? `${sourceMeta.shortLabel.toUpperCase()} #${ticket.platformOrderNumber}`
                : ticket.tableNumber
                  ? `${ticket.locationType === 'room' ? 'ROOM' : 'TABLE'} ${ticket.tableNumber.replace(/^(table|room)\s*/i, '')}`
                  : sourceMeta.label.toUpperCase();

              return (
                <article
                  key={ticket.id}
                  className={`rounded-2xl border-2 bg-slate-900 overflow-hidden shadow-xl flex flex-col ${cardBorderClass}`}
                >
                  {/* Color-Coded Urgency Header */}
                  <div
                    className={`px-4 py-3 flex items-center justify-between gap-2 ${headerBarClass}`}
                  >
                    <div className="min-w-0">
                      <p className="text-[18px] font-black tracking-tight truncate">
                        {locHeadline}
                      </p>
                      <p className="text-[11px] font-bold uppercase tracking-wider opacity-90">
                        {sourceMeta.label}
                        {ticket.guestName ? ` · ${ticket.guestName}` : ''}
                      </p>
                    </div>
                    <div
                      className={`shrink-0 flex items-center gap-1 rounded-xl bg-black/25 px-2.5 py-1 font-mono text-[16px] font-black tabular-nums ${
                        isOverdue ? 'animate-pulse' : ''
                      }`}
                    >
                      <Clock className="h-4 w-4" aria-hidden />
                      {timer.label}
                    </div>
                  </div>

                  {/* Status + Print Row */}
                  <div className="flex items-center justify-between gap-2 border-b border-slate-800 px-4 py-2 text-[11px] font-extrabold uppercase tracking-wider">
                    <span
                      className={
                        ticket.status === 'ready'
                          ? 'text-[#D2DB76]'
                          : ticket.status === 'preparing'
                            ? 'text-sky-300'
                            : ticket.status === 'pending_approval'
                              ? 'text-amber-300'
                              : 'text-slate-300'
                      }
                    >
                      ●{' '}
                      {ticket.status === 'pending_approval'
                        ? 'Awaiting Confirm'
                        : ticket.status === 'approved_for_kitchen'
                          ? 'Queued for Chef'
                          : ticket.status === 'preparing'
                            ? 'Cooking Now'
                            : 'Ready for Pickup'}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        printKitchenKotTicket(ticket, business.name)
                      }
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800 px-2 py-1 text-[11px] font-bold text-slate-200 hover:bg-slate-700 cursor-pointer"
                    >
                      <Printer className="h-3 w-3" aria-hidden /> KOT
                    </button>
                  </div>

                  {/* Highlighted Kitchen Note */}
                  {ticket.kitchenNote && (
                    <div className="mx-4 mt-3 rounded-xl border border-amber-400/50 bg-amber-500/15 px-3 py-2 text-[13px] font-extrabold text-amber-200">
                      NOTE: {ticket.kitchenNote}
                    </div>
                  )}

                  {/* Oversized Itemized Dishes */}
                  <div className="p-4 space-y-2.5 flex-1">
                    {ticket.items.map((item, idx) => (
                      <div
                        key={`${ticket.id}-${idx}`}
                        className="rounded-xl bg-slate-800/80 px-3.5 py-2.5"
                      >
                        <div className="flex items-baseline gap-2.5">
                          <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-lg bg-[#D2DB76] px-1.5 text-[15px] font-black text-[#1E1B4B] tabular-nums">
                            {item.quantity}×
                          </span>
                          <span className="text-[16px] font-extrabold text-white leading-snug">
                            {item.name}
                          </span>
                        </div>
                        {item.notes && (
                          <p className="mt-1 pl-9 text-[12px] font-bold text-amber-300">
                            ↳ {item.notes}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Oversized Kitchen Touch Actions */}
                  <div className="p-3.5 pt-0 space-y-2">
                    {ticket.status === 'pending_approval' && (
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() =>
                          void handleAdvanceStatus(ticket.id, 'preparing')
                        }
                        className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-amber-400 text-[14px] font-black text-[#111827] hover:bg-amber-300 active:scale-[0.98] disabled:opacity-50 cursor-pointer"
                      >
                        <Flame className="h-4.5 w-4.5" aria-hidden />
                        Confirm &amp; Start Preparing
                      </button>
                    )}

                    {ticket.status === 'approved_for_kitchen' && (
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() =>
                          void handleAdvanceStatus(ticket.id, 'preparing')
                        }
                        className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#D2DB76] text-[14px] font-black text-[#1E1B4B] hover:brightness-95 active:scale-[0.98] disabled:opacity-50 cursor-pointer"
                      >
                        <Flame className="h-4.5 w-4.5" aria-hidden />
                        Start Preparing
                      </button>
                    )}

                    {ticket.status === 'preparing' && (
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() =>
                          void handleAdvanceStatus(ticket.id, 'ready')
                        }
                        className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 text-[14px] font-black text-slate-950 hover:bg-emerald-400 active:scale-[0.98] disabled:opacity-50 cursor-pointer"
                      >
                        <CheckCircle2 className="h-5 w-5" aria-hidden />
                        ✓ Mark Ready
                      </button>
                    )}

                    {ticket.status === 'ready' && (
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() =>
                          void handleAdvanceStatus(ticket.id, 'served')
                        }
                        className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl border-2 border-emerald-400/60 bg-emerald-500/20 text-[14px] font-black text-emerald-200 hover:bg-emerald-500 hover:text-slate-950 active:scale-[0.98] disabled:opacity-50 cursor-pointer"
                      >
                        <CheckCircle2 className="h-5 w-5" aria-hidden />
                        Handed Over / Served ✓
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
