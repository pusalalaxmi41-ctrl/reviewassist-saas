import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import QRCode from 'qrcode';
import {
  Dumbbell,
  CheckCircle2,
  Clock,
  AlertTriangle,
  AlertCircle,
  Loader2,
  SearchX,
  Phone,
  User,
  Calendar,
  Flame,
  QrCode,
  MessageSquareHeart,
  Sparkles,
  RefreshCw,
} from 'lucide-react';
import type { GymMember, PublicGymPortalPayload } from '../types/gym';
import { businessRepository } from '../services/storage';
import {
  encodeGymMemberPassQr,
  formatIsoDatePretty,
  normalizeGymPhone,
} from '../utils/gymValidation';
import { formatPriceFromPaise } from '../utils/restaurantValidation';

function getStoredPhoneKey(slug: string): string {
  return `vitaran_gym_phone_v1:${slug.trim().toLowerCase()}`;
}

function loadStoredPhone(slug: string): string {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return '';
    return window.localStorage.getItem(getStoredPhoneKey(slug)) ?? '';
  } catch {
    return '';
  }
}

function saveStoredPhone(slug: string, phone: string): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    if (phone) {
      window.localStorage.setItem(getStoredPhoneKey(slug), phone);
    } else {
      window.localStorage.removeItem(getStoredPhoneKey(slug));
    }
  } catch {
    // ignore storage quota errors
  }
}

export default function CustomerGymPage() {
  const { businessSlug } = useParams<{ businessSlug: string }>();

  const [portal, setPortal] = useState<PublicGymPortalPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'pass' | 'join'>(() =>
    businessSlug && loadStoredPhone(businessSlug) ? 'pass' : 'join',
  );

  // Join form
  const [fullName, setFullName] = useState('');
  const [joinPhone, setJoinPhone] = useState('');
  const [selectedPlanId, setSelectedPlanId] = useState('1_month');
  const [submittingJoin, setSubmittingJoin] = useState(false);

  // Pass lookup & daily check-in
  const [lookupPhone, setLookupPhone] = useState(() =>
    businessSlug ? loadStoredPhone(businessSlug) : '',
  );
  const [memberPass, setMemberPass] = useState<GymMember | null>(null);
  const [lookingUp, setLookingUp] = useState(false);
  const [checkingIn, setCheckingIn] = useState(false);

  // Feedback banners
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const passQrCanvasRef = useRef<HTMLCanvasElement>(null);

  const loadPortal = useCallback(async () => {
    if (!businessSlug) {
      setLoading(false);
      return;
    }
    try {
      const data = await businessRepository.getPublicGymPortal(businessSlug);
      setPortal(data);
      if (data && data.config.plans.length > 0) {
        setSelectedPlanId((prev) =>
          data.config.plans.some((p) => p.id === prev)
            ? prev
            : data.config.plans[0].id,
        );
      }

      const savedPhone = loadStoredPhone(businessSlug);
      if (data && savedPhone) {
        try {
          const found = await businessRepository.lookupGymMemberPass({
            businessSlug,
            phone: savedPhone,
          });
          if (found) {
            setMemberPass(found);
            setActiveTab('pass');
          }
        } catch {
          // ignore silent lookup failure
        }
      }
    } finally {
      setLoading(false);
    }
  }, [businessSlug]);

  useEffect(() => {
    let active = true;
    const t = window.setTimeout(() => {
      if (active) void loadPortal();
    }, 0);
    return () => {
      active = false;
      window.clearTimeout(t);
    };
  }, [loadPortal]);

  // Render scannable Digital Gym Pass QR whenever an active/pending pass is shown
  useEffect(() => {
    if (!businessSlug || !memberPass || !passQrCanvasRef.current) return;
    const qrText = encodeGymMemberPassQr(
      businessSlug,
      memberPass.memberCode,
      memberPass.phone,
    );
    void QRCode.toCanvas(passQrCanvasRef.current, qrText, {
      width: 164,
      margin: 2,
      errorCorrectionLevel: 'M',
      color: { dark: '#0F172A', light: '#FFFFFF' },
    });
  }, [businessSlug, memberPass]);

  async function handleJoinSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!businessSlug) return;
    setErrorMsg(null);
    setSuccessMsg(null);
    setSubmittingJoin(true);
    try {
      const created = await businessRepository.submitGymMemberRegistration({
        businessSlug,
        fullName,
        phone: joinPhone,
        planId: selectedPlanId,
      });
      const norm = normalizeGymPhone(created.phone);
      saveStoredPhone(businessSlug, norm);
      setLookupPhone(norm);
      setMemberPass(created);
      setActiveTab('pass');
      setSuccessMsg(
        'Registration sent! Pay Cash/UPI at the front desk to activate your pass immediately.',
      );
      setFullName('');
    } catch (err) {
      setErrorMsg((err as Error).message);
    } finally {
      setSubmittingJoin(false);
    }
  }

  async function handleLookupPass(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!businessSlug) return;
    setErrorMsg(null);
    setSuccessMsg(null);
    setLookingUp(true);
    try {
      const found = await businessRepository.lookupGymMemberPass({
        businessSlug,
        phone: lookupPhone,
      });
      if (!found) {
        setMemberPass(null);
        setErrorMsg(
          'No membership found for this phone number. Switch to "New Member Join" to register in 10 seconds!',
        );
      } else {
        saveStoredPhone(businessSlug, found.phone);
        setMemberPass(found);
      }
    } catch (err) {
      setErrorMsg((err as Error).message);
    } finally {
      setLookingUp(false);
    }
  }

  async function handleDailyCheckIn() {
    if (!businessSlug || !memberPass) return;
    setErrorMsg(null);
    setSuccessMsg(null);
    setCheckingIn(true);
    try {
      const res = await businessRepository.gymMemberDailyCheckIn({
        businessSlug,
        phone: memberPass.phone,
      });
      setMemberPass((prev) =>
        prev
          ? {
              ...prev,
              checkedInToday: true,
              totalCheckIns: res.totalCheckIns,
              lastCheckInDate: res.checkedInDate,
            }
          : prev,
      );
      setSuccessMsg(
        res.alreadyCheckedInToday
          ? 'Already checked in for today! Crush your workout 💪'
          : `Daily Check-In confirmed! (${res.totalCheckIns} total visits · ${res.daysRemaining} days remaining)`,
      );
    } catch (err) {
      setErrorMsg((err as Error).message);
    } finally {
      setCheckingIn(false);
    }
  }

  if (loading) {
    return (
      <div
        role="status"
        className="mx-auto max-w-md rounded-3xl border border-slate-200 bg-white p-12 text-center shadow-sm"
      >
        <Loader2
          className="mx-auto h-7 w-7 animate-spin text-slate-900"
          aria-hidden
        />
        <p className="mt-3 text-[15px] font-semibold text-slate-600">
          Loading GymOS Digital Pass…
        </p>
      </div>
    );
  }

  if (!portal) {
    return (
      <div
        role="alert"
        className="mx-auto max-w-md rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm space-y-4"
      >
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900 text-lime-400">
          <SearchX className="h-6 w-6" aria-hidden />
        </div>
        <h1 className="text-[22px] font-black text-slate-900">
          Gym portal unavailable
        </h1>
        <p className="text-[14px] text-slate-600 leading-relaxed">
          No active gym matched{' '}
          <span className="font-mono font-bold text-slate-900">
            /r/{businessSlug || '(empty)'}/gym
          </span>
          . Approve your gym under <strong>Gyms &amp; Fitness</strong> in Admin
          Panel or preview the demo gym below.
        </p>
        <div className="flex flex-col gap-2 pt-2">
          <Link
            to="/gym/dashboard"
            className="inline-flex h-11 items-center justify-center rounded-xl bg-slate-900 px-4 text-[14px] font-extrabold text-lime-400 hover:bg-slate-800"
          >
            Open GymOS Owner Studio
          </Link>
          <Link
            to="/r/iron-pulse-gym/gym"
            className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-300 bg-white px-4 text-[13px] font-bold text-slate-900 hover:bg-slate-50"
          >
            Try Demo Gym Pass (Iron Pulse Fitness)
          </Link>
        </div>
      </div>
    );
  }

  const { business, config } = portal;

  return (
    <div className="mx-auto w-full max-w-md pb-12 space-y-4 animate-fadeSlideUp">
      {/* 1. ATHLETIC GYMOS HEADER (Deep Slate #0F172A + Volt Electric Lime #A3E635) */}
      <header className="overflow-hidden rounded-3xl border border-slate-800 bg-[#0F172A] text-white shadow-lg">
        <div className="h-1.5 w-full bg-gradient-to-r from-[#A3E635] via-[#BEF264] to-[#22C55E]" />
        <div className="p-5 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#A3E635] text-[#0F172A] shadow-sm">
                <Dumbbell className="h-6 w-6" aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-[#A3E635]">
                  GYMOS DIGITAL PASS
                </p>
                <h1 className="truncate text-[21px] font-black tracking-tight text-white">
                  {business.name}
                </h1>
                <p className="truncate text-[12px] font-medium text-slate-400">
                  {business.city} • Front-Desk Check-In &amp; Plans
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => void loadPortal()}
              aria-label="Refresh gym pass"
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/15 bg-white/5 text-[#A3E635] hover:bg-white/10 cursor-pointer"
            >
              <RefreshCw className="h-4 w-4" aria-hidden />
            </button>
          </div>

          {/* 2-Tab Mode Pill */}
          <div className="grid grid-cols-2 gap-1.5 rounded-2xl bg-slate-900/90 p-1 border border-white/10">
            <button
              type="button"
              onClick={() => {
                setActiveTab('pass');
                setErrorMsg(null);
              }}
              className={`h-10 rounded-xl text-[13px] font-extrabold transition-all cursor-pointer ${
                activeTab === 'pass'
                  ? 'bg-[#A3E635] text-[#0F172A] shadow-sm'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              My Digital Pass
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('join');
                setErrorMsg(null);
              }}
              className={`h-10 rounded-xl text-[13px] font-extrabold transition-all cursor-pointer ${
                activeTab === 'join'
                  ? 'bg-[#A3E635] text-[#0F172A] shadow-sm'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              New Member Join
            </button>
          </div>
        </div>
      </header>

      {successMsg && (
        <div
          role="status"
          className="flex items-center gap-2.5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-[13px] font-bold text-emerald-800"
        >
          <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div
          role="alert"
          className="flex items-center gap-2.5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] font-semibold text-red-900"
        >
          <AlertCircle className="h-4 w-4 shrink-0 text-red-700" aria-hidden />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* TAB 1: RETURNING MEMBER DIGITAL PASS + 1-TAP DAILY CHECK-IN */}
      {activeTab === 'pass' && (
        <div className="space-y-4">
          <form
            onSubmit={(e) => void handleLookupPass(e)}
            className="rounded-3xl border border-slate-200 bg-white p-5 shadow-xs space-y-3"
          >
            <label
              htmlFor="gymPassPhone"
              className="block text-[11.5px] font-extrabold uppercase tracking-wider text-slate-500"
            >
              Enter Registered Phone Number
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1 flex items-center">
                <Phone
                  className="pointer-events-none absolute left-3.5 h-4 w-4 text-slate-400"
                  aria-hidden
                />
                <input
                  id="gymPassPhone"
                  type="tel"
                  required
                  placeholder="e.g. 9876543210"
                  value={lookupPhone}
                  onChange={(e) => setLookupPhone(e.target.value)}
                  className="h-11 w-full rounded-xl border border-slate-300 bg-slate-50 pl-10 pr-3 text-[14px] font-bold text-slate-900 focus:border-slate-900 focus:bg-white focus:outline-none"
                />
              </div>
              <button
                type="submit"
                disabled={lookingUp}
                className="h-11 shrink-0 rounded-xl bg-[#0F172A] px-4 text-[13px] font-extrabold text-[#A3E635] hover:bg-slate-800 disabled:opacity-60 cursor-pointer"
              >
                {lookingUp ? 'Finding…' : 'Show Pass'}
              </button>
            </div>
          </form>

          {memberPass && (
            <section
              aria-label="Member Digital Gym Pass"
              className={`rounded-3xl border-2 p-5 sm:p-6 shadow-md space-y-4 ${
                memberPass.effectiveStatus === 'expired'
                  ? 'border-slate-900 bg-slate-100 text-slate-900'
                  : memberPass.effectiveStatus === 'expiring_soon'
                    ? 'border-red-400 bg-red-50/70 text-slate-900'
                    : memberPass.effectiveStatus === 'pending_approval'
                      ? 'border-amber-300 bg-amber-50/70 text-slate-900'
                      : 'border-[#0F172A] bg-white text-slate-900'
              }`}
            >
              {/* Status Banner */}
              {memberPass.effectiveStatus === 'pending_approval' && (
                <div className="flex items-center gap-2.5 rounded-2xl bg-amber-100 border border-amber-300 px-4 py-3 text-[13px] font-bold text-amber-950">
                  <Clock className="h-4.5 w-4.5 shrink-0 text-amber-700" aria-hidden />
                  <span>
                    Pending Payment Approval — Pay{' '}
                    <strong>{formatPriceFromPaise(memberPass.feePaise, 'INR')}</strong>{' '}
                    (Cash/UPI) at the desk to activate!
                  </span>
                </div>
              )}

              {memberPass.effectiveStatus === 'expiring_soon' && (
                <div className="flex items-center gap-2.5 rounded-2xl bg-red-600 px-4 py-3 text-[13px] font-extrabold text-white shadow-sm">
                  <AlertTriangle className="h-4.5 w-4.5 shrink-0" aria-hidden />
                  <span>
                    Plan expires in {memberPass.daysRemaining}{' '}
                    {memberPass.daysRemaining === 1 ? 'day' : 'days'}! Renew at the desk to avoid interruption.
                  </span>
                </div>
              )}

              {memberPass.effectiveStatus === 'expired' && (
                <div className="flex items-center gap-2.5 rounded-2xl bg-slate-900 px-4 py-3 text-[13px] font-extrabold text-white">
                  <AlertCircle className="h-4.5 w-4.5 shrink-0 text-red-400" aria-hidden />
                  <span>
                    Membership expired on {formatIsoDatePretty(memberPass.endDate)}. Please renew at the front desk.
                  </span>
                </div>
              )}

              {/* Member Identity + Big Days Remaining Countdown */}
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <span className="inline-flex rounded-full bg-slate-900 px-2.5 py-0.5 font-mono text-[11px] font-extrabold text-[#A3E635]">
                    {memberPass.memberCode}
                  </span>
                  <h2 className="mt-1.5 truncate text-[22px] font-black text-slate-900">
                    {memberPass.fullName}
                  </h2>
                  <p className="text-[13px] font-bold text-slate-600">
                    {memberPass.planName} •{' '}
                    {formatPriceFromPaise(memberPass.feePaise, 'INR')}
                  </p>
                </div>

                {(memberPass.effectiveStatus === 'active' ||
                  memberPass.effectiveStatus === 'expiring_soon') && (
                  <div
                    className={`rounded-2xl p-3.5 text-center min-w-[110px] shadow-sm ${
                      memberPass.effectiveStatus === 'expiring_soon'
                        ? 'bg-red-600 text-white'
                        : 'bg-[#0F172A] text-white'
                    }`}
                  >
                    <p
                      data-testid="gym-days-remaining"
                      className={`text-[30px] leading-none font-black tabular-nums ${
                        memberPass.effectiveStatus === 'expiring_soon'
                          ? 'text-white'
                          : 'text-[#A3E635]'
                      }`}
                    >
                      {memberPass.daysRemaining}
                    </p>
                    <p className="mt-1 text-[10px] font-extrabold uppercase tracking-wider opacity-90">
                      {memberPass.daysRemaining === 1 ? 'Day Left' : 'Days Left'}
                    </p>
                  </div>
                )}
              </div>

              {/* Plan Dates & Check-In Stats */}
              {memberPass.endDate && (
                <div className="grid grid-cols-2 gap-2.5 text-[12px]">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                    <p className="font-bold uppercase tracking-wider text-slate-400 text-[10px] flex items-center gap-1">
                      <Calendar className="h-3 w-3" aria-hidden /> Valid Until
                    </p>
                    <p className="mt-0.5 font-extrabold text-slate-900">
                      {formatIsoDatePretty(memberPass.endDate)}
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                    <p className="font-bold uppercase tracking-wider text-slate-400 text-[10px] flex items-center gap-1">
                      <Flame className="h-3 w-3 text-orange-500" aria-hidden /> Check-Ins
                    </p>
                    <p className="mt-0.5 font-extrabold text-slate-900 tabular-nums">
                      {memberPass.totalCheckIns} Workouts
                    </p>
                  </div>
                </div>
              )}

              {/* 1-Tap Daily Check-In Button (Active / Expiring Soon) */}
              {(memberPass.effectiveStatus === 'active' ||
                memberPass.effectiveStatus === 'expiring_soon') && (
                <button
                  type="button"
                  disabled={checkingIn || memberPass.checkedInToday}
                  onClick={() => void handleDailyCheckIn()}
                  className={`flex min-h-13 w-full items-center justify-center gap-2 rounded-2xl px-5 py-3 text-[15px] font-black shadow-md transition-all cursor-pointer ${
                    memberPass.checkedInToday
                      ? 'bg-emerald-600 text-white cursor-default'
                      : 'bg-[#0F172A] text-[#A3E635] hover:bg-slate-800 active:scale-[0.98]'
                  }`}
                >
                  <CheckCircle2 className="h-5 w-5" aria-hidden />
                  {memberPass.checkedInToday
                    ? 'Checked In Today! 🔥'
                    : checkingIn
                      ? 'Checking In…'
                      : 'Daily Check-In ✓'}
                </button>
              )}

              {/* Personal Gym Member QR Pass */}
              <div className="rounded-2xl border border-slate-200 bg-white p-4 text-center space-y-2">
                <div className="inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-3 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-[#A3E635]">
                  <QrCode className="h-3 w-3" aria-hidden />
                  Digital Gym Member Pass
                </div>
                <div className="flex justify-center">
                  <canvas
                    ref={passQrCanvasRef}
                    aria-label={`Digital Gym Pass QR for ${memberPass.fullName}`}
                    className="rounded-xl border border-slate-100 p-1"
                  />
                </div>
                <p className="text-[11.5px] font-semibold text-slate-500">
                  Show this pass at the front desk for instant verification
                </p>
              </div>
            </section>
          )}
        </div>
      )}

      {/* TAB 2: 10-SECOND NEW MEMBER SIGNUP CARD */}
      {activeTab === 'join' && (
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xs space-y-5">
          {!config.isRegistrationOpen ? (
            <div className="py-4 text-center space-y-2">
              <Clock className="mx-auto h-9 w-9 text-amber-500" aria-hidden />
              <h2 className="text-[18px] font-extrabold text-slate-900">
                Registrations Temporarily Paused
              </h2>
              <p className="text-[13px] text-slate-600">
                Please speak directly with the gym front desk to enroll.
              </p>
            </div>
          ) : (
            <form
              onSubmit={(e) => void handleJoinSubmit(e)}
              className="space-y-4"
            >
              <div>
                <h2 className="text-[19px] font-black text-slate-900">
                  Start Your Gym Membership
                </h2>
                <p className="mt-0.5 text-[13px] text-slate-500">
                  10-second signup — pick your plan, then pay Cash or UPI at the desk to activate your Digital Pass.
                </p>
              </div>

              <div className="space-y-3">
                <div className="space-y-1">
                  <label
                    htmlFor="gymJoinName"
                    className="block text-[11.5px] font-extrabold uppercase tracking-wider text-slate-500"
                  >
                    Full Name
                  </label>
                  <div className="relative flex items-center">
                    <User
                      className="pointer-events-none absolute left-3.5 h-4 w-4 text-slate-400"
                      aria-hidden
                    />
                    <input
                      id="gymJoinName"
                      type="text"
                      required
                      maxLength={80}
                      placeholder="e.g. Rahul Sharma"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="h-11 w-full rounded-xl border border-slate-300 bg-slate-50 pl-10 pr-3.5 text-[14px] font-semibold text-slate-900 focus:border-slate-900 focus:bg-white focus:outline-none"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label
                    htmlFor="gymJoinPhone"
                    className="block text-[11.5px] font-extrabold uppercase tracking-wider text-slate-500"
                  >
                    WhatsApp / Mobile Number
                  </label>
                  <div className="relative flex items-center">
                    <Phone
                      className="pointer-events-none absolute left-3.5 h-4 w-4 text-slate-400"
                      aria-hidden
                    />
                    <input
                      id="gymJoinPhone"
                      type="tel"
                      required
                      maxLength={30}
                      placeholder="e.g. 98765 43210"
                      value={joinPhone}
                      onChange={(e) => setJoinPhone(e.target.value)}
                      className="h-11 w-full rounded-xl border border-slate-300 bg-slate-50 pl-10 pr-3.5 text-[14px] font-semibold text-slate-900 focus:border-slate-900 focus:bg-white focus:outline-none"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <span className="block text-[11.5px] font-extrabold uppercase tracking-wider text-slate-500">
                    Choose Membership Plan
                  </span>
                  <div className="grid gap-2">
                    {config.plans.map((plan) => {
                      const active = selectedPlanId === plan.id;
                      return (
                        <button
                          key={plan.id}
                          type="button"
                          onClick={() => setSelectedPlanId(plan.id)}
                          className={`flex items-center justify-between gap-3 rounded-2xl border p-3.5 text-left transition-all active:scale-[0.98] cursor-pointer ${
                            active
                              ? 'border-2 border-[#0F172A] bg-[#0F172A] text-white shadow-sm'
                              : 'border-slate-200 bg-slate-50 text-slate-900 hover:border-slate-400'
                          }`}
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-[14.5px] font-extrabold truncate">
                                {plan.name}
                              </p>
                              {plan.badge && (
                                <span
                                  className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase ${
                                    active
                                      ? 'bg-[#A3E635] text-[#0F172A]'
                                      : 'bg-lime-100 text-slate-900'
                                  }`}
                                >
                                  {plan.badge}
                                </span>
                              )}
                            </div>
                            <p
                              className={`text-[11.5px] font-semibold ${
                                active ? 'text-slate-300' : 'text-slate-500'
                              }`}
                            >
                              {plan.durationDays} days full gym access
                            </p>
                          </div>
                          <span
                            className={`shrink-0 rounded-full px-3 py-1 text-[13px] font-black tabular-nums ${
                              active
                                ? 'bg-[#A3E635] text-[#0F172A]'
                                : 'bg-white border border-slate-200 text-slate-900'
                            }`}
                          >
                            {formatPriceFromPaise(plan.pricePaise, 'INR')}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={submittingJoin}
                className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#0F172A] px-5 py-3 text-[15px] font-black text-[#A3E635] shadow-md hover:bg-slate-800 active:scale-[0.98] disabled:opacity-60 transition-all cursor-pointer"
              >
                <Sparkles className="h-4 w-4" aria-hidden />
                {submittingJoin
                  ? 'Submitting…'
                  : 'Submit & Pay at Front Desk →'}
              </button>
            </form>
          )}
        </section>
      )}

      {/* GOOGLE REVIEW FOOTER */}
      <Link
        to={`/r/${business.slug}`}
        className="flex items-center justify-between gap-3 rounded-3xl border border-slate-200 bg-white px-5 py-4 text-slate-900 shadow-2xs hover:border-slate-400 transition-colors"
      >
        <div className="flex items-center gap-3">
          <MessageSquareHeart
            className="h-5 w-5 text-emerald-600 shrink-0"
            aria-hidden
          />
          <div>
            <p className="text-[13.5px] font-extrabold">
              Loving your workouts at {business.name}?
            </p>
            <p className="text-[11.5px] text-slate-500">
              Leave a 30-second Google Review
            </p>
          </div>
        </div>
        <span className="text-[13px] font-black text-slate-900">→</span>
      </Link>
    </div>
  );
}
