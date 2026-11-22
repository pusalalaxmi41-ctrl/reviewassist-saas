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
  Target,
  Scale,
  Activity,
} from 'lucide-react';
import type {
  GymFitnessGoal,
  GymMember,
  GymWorkoutFocus,
  PublicGymPortalPayload,
} from '../types/gym';
import { businessRepository } from '../services/storage';
import {
  encodeGymMemberPassQr,
  formatCheckInTime12h,
  formatIsoDatePretty,
  getFitnessGoalMeta,
  getWorkoutFocusMeta,
  GYM_FITNESS_GOAL_OPTIONS,
  GYM_WORKOUT_FOCUS_OPTIONS,
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

  // Tab 1: New Member Join Form (with Fitness Goal & Optional Weights)
  const [fullName, setFullName] = useState('');
  const [joinPhone, setJoinPhone] = useState('');
  const [selectedPlanId, setSelectedPlanId] = useState('1_month');
  const [fitnessGoal, setFitnessGoal] =
    useState<GymFitnessGoal>('muscle_gain');
  const [startingWeightInput, setStartingWeightInput] = useState('');
  const [targetWeightInput, setTargetWeightInput] = useState('');
  const [submittingJoin, setSubmittingJoin] = useState(false);

  // Tab 2: Live Digital Pass, Daily QR Attendance & Workout Split Selector
  const [lookupPhone, setLookupPhone] = useState(() =>
    businessSlug ? loadStoredPhone(businessSlug) : '',
  );
  const [memberPass, setMemberPass] = useState<GymMember | null>(null);
  const [lookingUp, setLookingUp] = useState(false);
  const [selectedWorkoutFocus, setSelectedWorkoutFocus] =
    useState<GymWorkoutFocus>('chest');
  const [memberWorkoutNote, setMemberWorkoutNote] = useState('');
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

      // Smart Auto-Detect: saved phone -> load pass directly for 2-second daily check-in
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
            if (found.todayCheckIn?.workoutFocus) {
              setSelectedWorkoutFocus(found.todayCheckIn.workoutFocus);
              setMemberWorkoutNote(found.todayCheckIn.memberNote ?? '');
            }
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

  // Render scannable Digital Gym Pass QR whenever a pass is active/pending
  useEffect(() => {
    if (!businessSlug || !memberPass || !passQrCanvasRef.current) return;
    const qrText = encodeGymMemberPassQr(
      businessSlug,
      memberPass.memberCode,
      memberPass.phone,
    );
    void QRCode.toCanvas(passQrCanvasRef.current, qrText, {
      width: 156,
      margin: 2,
      errorCorrectionLevel: 'M',
      color: { dark: '#1E1B4B', light: '#FFFFFF' },
    });
  }, [businessSlug, memberPass]);

  async function handleJoinSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!businessSlug) return;
    setErrorMsg(null);
    setSuccessMsg(null);
    setSubmittingJoin(true);
    try {
      const startWt = startingWeightInput.trim()
        ? Number.parseFloat(startingWeightInput)
        : null;
      const targetWt = targetWeightInput.trim()
        ? Number.parseFloat(targetWeightInput)
        : null;

      const created = await businessRepository.submitGymMemberRegistration({
        businessSlug,
        fullName,
        phone: joinPhone,
        planId: selectedPlanId,
        fitnessGoal,
        startingWeightKg: startWt,
        targetWeightKg: targetWt,
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
      setStartingWeightInput('');
      setTargetWeightInput('');
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
        if (found.todayCheckIn?.workoutFocus) {
          setSelectedWorkoutFocus(found.todayCheckIn.workoutFocus);
          setMemberWorkoutNote(found.todayCheckIn.memberNote ?? '');
        }
      }
    } catch (err) {
      setErrorMsg((err as Error).message);
    } finally {
      setLookingUp(false);
    }
  }

  async function handleDailyCheckIn(focusOverride?: GymWorkoutFocus) {
    if (!businessSlug || !memberPass) return;
    const focusToSave = focusOverride ?? selectedWorkoutFocus;
    setErrorMsg(null);
    setSuccessMsg(null);
    setCheckingIn(true);
    try {
      const res = await businessRepository.gymMemberDailyCheckIn({
        businessSlug,
        phone: memberPass.phone,
        workoutFocus: focusToSave,
        memberNote: memberWorkoutNote.trim() || null,
      });
      setSelectedWorkoutFocus(res.workoutFocus);

      const refreshed = await businessRepository.lookupGymMemberPass({
        businessSlug,
        phone: memberPass.phone,
      });
      if (refreshed) {
        setMemberPass(refreshed);
      } else {
        setMemberPass((prev) =>
          prev
            ? {
                ...prev,
                checkedInToday: true,
                totalCheckIns: res.totalCheckIns,
                daysAttendedThisMonth: res.daysAttendedThisMonth,
                lastCheckInDate: res.checkedInDate,
                lastCheckInAt: res.checkedInAt,
                todayWorkoutFocus: res.workoutFocus,
                todayCheckedInAt: res.checkedInAt,
                todayCheckIn: res.todayLog,
              }
            : prev,
        );
      }

      const focusMeta = getWorkoutFocusMeta(res.workoutFocus);
      const timeStr = formatCheckInTime12h(res.checkedInAt);
      setSuccessMsg(
        res.alreadyCheckedInToday
          ? `Updated today's workout focus to ${focusMeta.dayLabel}${timeStr ? ` (Checked in at ${timeStr})` : ''}! 💪`
          : `Checked In Today${timeStr ? ` at ${timeStr}` : ''} • ${focusMeta.dayLabel}! (${res.daysAttendedThisMonth} days this month)`,
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
          className="mx-auto h-7 w-7 animate-spin text-[#1E1B4B]"
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
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#1E1B4B] text-[#D2DB76]">
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
            className="inline-flex h-11 items-center justify-center rounded-xl bg-[#1E1B4B] px-4 text-[14px] font-extrabold text-[#D2DB76] hover:bg-[#2E2A6E]"
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
  const memberGoalMeta = memberPass
    ? getFitnessGoalMeta(memberPass.fitnessGoal)
    : null;
  const todayFocusMeta = memberPass?.todayCheckIn
    ? getWorkoutFocusMeta(memberPass.todayCheckIn.workoutFocus)
    : memberPass?.todayWorkoutFocus
      ? getWorkoutFocusMeta(memberPass.todayWorkoutFocus)
      : null;
  const todayCheckInTimeLabel = formatCheckInTime12h(
    memberPass?.todayCheckIn?.checkedInAt ?? memberPass?.todayCheckedInAt,
  );
  const recentLogs = (memberPass?.recentAttendanceLogs ?? []).slice(0, 7);

  return (
    <div className="mx-auto w-full max-w-md pb-12 space-y-4 animate-fadeSlideUp">
      {/* 1. GYMOS ENTRANCE QR HEADER (Midnight Navy #1E1B4B + Champagne Gold #D2DB76 + Volt Accent) */}
      <header className="overflow-hidden rounded-3xl border border-[#1E1B4B]/20 bg-[#1E1B4B] text-white shadow-lg">
        <div className="h-1.5 w-full bg-gradient-to-r from-[#D2DB76] via-[#A3E635] to-[#D2DB76]" />
        <div className="p-5 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#D2DB76] text-[#1E1B4B] shadow-sm">
                <Dumbbell className="h-6 w-6" aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-[#D2DB76]">
                  GYMOS ATTENDANCE &amp; PASS
                </p>
                <h1 className="truncate text-[21px] font-black tracking-tight text-white">
                  {business.name}
                </h1>
                <p className="truncate text-[12px] font-medium text-indigo-200/80">
                  {business.city} • Daily QR Attendance &amp; Plans
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => void loadPortal()}
              aria-label="Refresh gym pass"
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/15 bg-white/5 text-[#D2DB76] hover:bg-white/10 cursor-pointer"
            >
              <RefreshCw className="h-4 w-4" aria-hidden />
            </button>
          </div>

          {/* 2-Tab Mode Pill */}
          <div className="grid grid-cols-2 gap-1.5 rounded-2xl bg-black/25 p-1 border border-white/10">
            <button
              type="button"
              onClick={() => {
                setActiveTab('pass');
                setErrorMsg(null);
              }}
              className={`h-10 rounded-xl text-[13px] font-extrabold transition-all cursor-pointer ${
                activeTab === 'pass'
                  ? 'bg-[#D2DB76] text-[#1E1B4B] shadow-sm'
                  : 'text-indigo-100/80 hover:text-white'
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
                  ? 'bg-[#D2DB76] text-[#1E1B4B] shadow-sm'
                  : 'text-indigo-100/80 hover:text-white'
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

      {/* TAB 2: LIVE DIGITAL PASS + DAILY QR ATTENDANCE & WORKOUT SPLIT LOGGING */}
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
              Registered Mobile Number
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
                  className="h-11 w-full rounded-xl border border-slate-300 bg-[#F8F9FA] pl-10 pr-3 text-[14px] font-bold text-slate-900 focus:border-[#1E1B4B] focus:bg-white focus:outline-none"
                />
              </div>
              <button
                type="submit"
                disabled={lookingUp}
                className="h-11 shrink-0 rounded-xl bg-[#1E1B4B] px-4 text-[13px] font-extrabold text-[#D2DB76] hover:bg-[#2E2A6E] disabled:opacity-60 cursor-pointer"
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
                      : 'border-[#1E1B4B] bg-white text-slate-900'
              }`}
            >
              {/* Status Banners */}
              {memberPass.effectiveStatus === 'pending_approval' && (
                <div className="flex items-center gap-2.5 rounded-2xl bg-amber-100 border border-amber-300 px-4 py-3 text-[13px] font-bold text-amber-950">
                  <Clock
                    className="h-4.5 w-4.5 shrink-0 text-amber-700"
                    aria-hidden
                  />
                  <span>
                    Pending Payment Approval — Pay{' '}
                    <strong>
                      {formatPriceFromPaise(memberPass.feePaise, 'INR')}
                    </strong>{' '}
                    (Cash/UPI) at the desk to activate!
                  </span>
                </div>
              )}

              {memberPass.effectiveStatus === 'expiring_soon' && (
                <div className="flex items-center gap-2.5 rounded-2xl bg-red-600 px-4 py-3 text-[13px] font-extrabold text-white shadow-sm">
                  <AlertTriangle className="h-4.5 w-4.5 shrink-0" aria-hidden />
                  <span>
                    Plan expires in {memberPass.daysRemaining}{' '}
                    {memberPass.daysRemaining === 1 ? 'day' : 'days'}! Renew at
                    the desk to keep your streak going.
                  </span>
                </div>
              )}

              {memberPass.effectiveStatus === 'expired' && (
                <div className="rounded-2xl bg-slate-900 px-4 py-3.5 text-white space-y-2.5">
                  <div className="flex items-center gap-2.5 text-[13px] font-extrabold">
                    <AlertCircle
                      className="h-4.5 w-4.5 shrink-0 text-red-400"
                      aria-hidden
                    />
                    <span>
                      Membership expired on{' '}
                      {formatIsoDatePretty(memberPass.endDate)}. Renew at the
                      front desk to unlock daily check-in.
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setFullName(memberPass.fullName);
                      setJoinPhone(memberPass.phone);
                      setSelectedPlanId(memberPass.planId);
                      setFitnessGoal(
                        memberPass.fitnessGoal ?? 'general_fitness',
                      );
                      setActiveTab('join');
                      setErrorMsg(null);
                      setSuccessMsg(null);
                    }}
                    className="inline-flex h-10 w-full items-center justify-center rounded-xl bg-[#D2DB76] px-4 text-[13px] font-black text-[#1E1B4B] hover:bg-lime-300 cursor-pointer"
                  >
                    Tap to Request Plan Renewal →
                  </button>
                </div>
              )}

              {/* Member Identity + Goal Badge + Days Remaining Countdown */}
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="inline-flex rounded-full bg-[#1E1B4B] px-2.5 py-0.5 font-mono text-[11px] font-extrabold text-[#D2DB76]">
                      {memberPass.memberCode}
                    </span>
                    {memberGoalMeta && (
                      <span
                        className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-extrabold ${memberGoalMeta.badgeClass}`}
                      >
                        <span>{memberGoalMeta.emoji}</span>
                        <span>{memberGoalMeta.label}</span>
                      </span>
                    )}
                  </div>
                  <h2 className="truncate text-[22px] font-black text-slate-900">
                    {memberPass.fullName}
                  </h2>
                  <p className="text-[12.5px] font-bold text-slate-600">
                    {memberPass.planName} •{' '}
                    {formatPriceFromPaise(memberPass.feePaise, 'INR')}
                  </p>
                  {(memberPass.startingWeightKg ||
                    memberPass.targetWeightKg) && (
                    <p className="text-[11.5px] font-bold text-[#1E1B4B] flex items-center gap-1">
                      <Scale className="h-3.5 w-3.5" aria-hidden />
                      <span>
                        {memberPass.startingWeightKg
                          ? `${memberPass.startingWeightKg} kg`
                          : '—'}{' '}
                        → Target:{' '}
                        {memberPass.targetWeightKg
                          ? `${memberPass.targetWeightKg} kg`
                          : '—'}
                      </span>
                    </p>
                  )}
                </div>

                {(memberPass.effectiveStatus === 'active' ||
                  memberPass.effectiveStatus === 'expiring_soon') && (
                  <div
                    className={`rounded-2xl p-3.5 text-center min-w-[104px] shadow-sm ${
                      memberPass.effectiveStatus === 'expiring_soon'
                        ? 'bg-red-600 text-white'
                        : 'bg-[#1E1B4B] text-white'
                    }`}
                  >
                    <p
                      data-testid="gym-days-remaining"
                      className={`text-[30px] leading-none font-black tabular-nums ${
                        memberPass.effectiveStatus === 'expiring_soon'
                          ? 'text-white'
                          : 'text-[#D2DB76]'
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

              {/* Monthly Attendance & Plan Expiry Strip */}
              {memberPass.endDate && (
                <div className="grid grid-cols-2 gap-2.5 text-[12px]">
                  <div className="rounded-xl border border-slate-200 bg-[#F8F9FA] px-3 py-2.5">
                    <p className="font-bold uppercase tracking-wider text-slate-400 text-[10px] flex items-center gap-1">
                      <Flame className="h-3 w-3 text-orange-500" aria-hidden />
                      This Month
                    </p>
                    <p
                      data-testid="gym-month-attendance"
                      className="mt-0.5 font-extrabold text-slate-900 tabular-nums"
                    >
                      {memberPass.daysAttendedThisMonth ?? 0} Days Attended
                    </p>
                    <p className="text-[10.5px] font-semibold text-slate-500">
                      {memberPass.totalCheckIns} total visits
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-[#F8F9FA] px-3 py-2.5">
                    <p className="font-bold uppercase tracking-wider text-slate-400 text-[10px] flex items-center gap-1">
                      <Calendar className="h-3 w-3" aria-hidden /> Valid Until
                    </p>
                    <p className="mt-0.5 font-extrabold text-slate-900">
                      {formatIsoDatePretty(memberPass.endDate)}
                    </p>
                    <p className="text-[10.5px] font-semibold text-slate-500">
                      {memberPass.durationDays}d plan
                    </p>
                  </div>
                </div>
              )}

              {/* TODAY'S ATTENDANCE & WORKOUT SPLIT SELECTOR (Active / Expiring Soon) */}
              {(memberPass.effectiveStatus === 'active' ||
                memberPass.effectiveStatus === 'expiring_soon') && (
                <div className="rounded-2xl border border-[#1E1B4B]/15 bg-[#F8F9FA] p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[11.5px] font-extrabold uppercase tracking-wider text-[#1E1B4B] flex items-center gap-1.5">
                      <Activity className="h-3.5 w-3.5" aria-hidden />
                      What Are You Training Today?
                    </p>
                    {memberPass.checkedInToday && todayCheckInTimeLabel && (
                      <span className="text-[11px] font-bold text-emerald-700">
                        {todayCheckInTimeLabel}
                      </span>
                    )}
                  </div>

                  {/* Interactive Workout Split Chips */}
                  <div className="flex flex-wrap gap-1.5">
                    {GYM_WORKOUT_FOCUS_OPTIONS.map((opt) => {
                      const active = selectedWorkoutFocus === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setSelectedWorkoutFocus(opt.value)}
                          className={`rounded-xl px-3 py-1.5 text-[12px] font-extrabold transition-all cursor-pointer ${
                            active
                              ? 'bg-[#1E1B4B] text-[#D2DB76] shadow-xs'
                              : 'border border-slate-200 bg-white text-slate-700 hover:border-[#1E1B4B]'
                          }`}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>

                  {/* Optional 1-line workout note */}
                  <input
                    type="text"
                    maxLength={140}
                    placeholder="Optional note (e.g. Bench PR, 5km run)…"
                    value={memberWorkoutNote}
                    onChange={(e) => setMemberWorkoutNote(e.target.value)}
                    className="h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-[12.5px] font-medium text-slate-800 focus:border-[#1E1B4B] focus:outline-none"
                  />

                  {/* Checked-in Emerald Banner vs Primary Midnight Navy Action Button */}
                  {memberPass.checkedInToday ? (
                    <div className="space-y-2">
                      <div
                        data-testid="gym-checked-in-badge"
                        className="flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3 text-center text-[13.5px] font-black text-white shadow-sm"
                      >
                        <CheckCircle2 className="h-4.5 w-4.5 shrink-0" aria-hidden />
                        <span>
                          ✓ Checked In Today
                          {todayCheckInTimeLabel
                            ? ` at ${todayCheckInTimeLabel}`
                            : ''}
                          {todayFocusMeta
                            ? ` • ${todayFocusMeta.dayLabel}`
                            : ''}
                        </span>
                      </div>
                      {selectedWorkoutFocus !==
                        (memberPass.todayCheckIn?.workoutFocus ??
                          memberPass.todayWorkoutFocus) && (
                        <button
                          type="button"
                          disabled={checkingIn}
                          onClick={() => void handleDailyCheckIn()}
                          className="flex h-10 w-full items-center justify-center rounded-xl border border-[#1E1B4B] bg-white px-4 text-[12.5px] font-extrabold text-[#1E1B4B] hover:bg-[#1E1B4B] hover:text-[#D2DB76] transition-colors cursor-pointer"
                        >
                          {checkingIn
                            ? 'Updating Workout…'
                            : `Switch Today's Focus to ${getWorkoutFocusMeta(selectedWorkoutFocus).dayLabel}`}
                        </button>
                      )}
                    </div>
                  ) : (
                    <button
                      type="button"
                      disabled={checkingIn}
                      onClick={() => void handleDailyCheckIn()}
                      className="flex min-h-13 w-full items-center justify-center gap-2 rounded-2xl bg-[#1E1B4B] px-5 py-3 text-[15px] font-black text-[#D2DB76] shadow-md hover:bg-[#2E2A6E] active:scale-[0.98] disabled:opacity-60 transition-all cursor-pointer"
                    >
                      <CheckCircle2 className="h-5 w-5" aria-hidden />
                      {checkingIn
                        ? 'Recording Attendance…'
                        : "Mark Today's Attendance ✓"}
                    </button>
                  )}
                </div>
              )}

              {/* Recent 7-Day Attendance Strip */}
              {recentLogs.length > 0 && (
                <div className="rounded-2xl border border-slate-200 bg-white p-3.5 space-y-2">
                  <p className="text-[10.5px] font-extrabold uppercase tracking-wider text-slate-500">
                    Recent Attendance Streak ({recentLogs.length})
                  </p>
                  <div className="space-y-1.5">
                    {recentLogs.map((log) => {
                      const fm = getWorkoutFocusMeta(log.workoutFocus);
                      const timeText = formatCheckInTime12h(log.checkedInAt);
                      return (
                        <div
                          key={log.id}
                          className="flex items-center justify-between gap-2 rounded-xl bg-[#F8F9FA] px-3 py-2 text-[12px]"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
                            <span className="font-bold text-slate-800 truncate">
                              {formatIsoDatePretty(log.checkInDate)}
                            </span>
                            {timeText && (
                              <span className="text-[11px] font-semibold text-slate-500 tabular-nums">
                                {timeText}
                              </span>
                            )}
                          </div>
                          <span className="shrink-0 rounded-full bg-[#1E1B4B]/8 px-2.5 py-0.5 text-[11px] font-extrabold text-[#1E1B4B]">
                            {fm.dayLabel}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Personal Gym Member QR Pass */}
              <div className="rounded-2xl border border-slate-200 bg-white p-4 text-center space-y-2">
                <div className="inline-flex items-center gap-1.5 rounded-full bg-[#1E1B4B] px-3 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-[#D2DB76]">
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

      {/* TAB 1: NEW MEMBER REGISTRATION + FITNESS TARGETS */}
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
                  10-second signup — set your fitness goal, pick a plan, then
                  pay Cash or UPI at the desk to unlock daily QR attendance.
                </p>
              </div>

              <div className="space-y-3.5">
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
                      placeholder="e.g. Madhan Kumar"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="h-11 w-full rounded-xl border border-slate-300 bg-[#F8F9FA] pl-10 pr-3.5 text-[14px] font-semibold text-slate-900 focus:border-[#1E1B4B] focus:bg-white focus:outline-none"
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
                      className="h-11 w-full rounded-xl border border-slate-300 bg-[#F8F9FA] pl-10 pr-3.5 text-[14px] font-semibold text-slate-900 focus:border-[#1E1B4B] focus:bg-white focus:outline-none"
                    />
                  </div>
                </div>

                {/* Fitness Target Pills */}
                <div className="space-y-1.5">
                  <span className="flex items-center gap-1 text-[11.5px] font-extrabold uppercase tracking-wider text-slate-500">
                    <Target className="h-3.5 w-3.5 text-[#1E1B4B]" aria-hidden />
                    Your Primary Fitness Goal
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {GYM_FITNESS_GOAL_OPTIONS.map((goalOpt) => {
                      const active = fitnessGoal === goalOpt.value;
                      return (
                        <button
                          key={goalOpt.value}
                          type="button"
                          onClick={() => setFitnessGoal(goalOpt.value)}
                          className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-[12.5px] font-extrabold transition-all cursor-pointer ${
                            active
                              ? 'border-[#1E1B4B] bg-[#1E1B4B] text-[#D2DB76] shadow-xs'
                              : 'border-slate-200 bg-[#F8F9FA] text-slate-800 hover:border-[#1E1B4B]'
                          }`}
                        >
                          <span>{goalOpt.emoji}</span>
                          <span>{goalOpt.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Optional Current & Target Weight (kg) */}
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="space-y-1">
                    <label
                      htmlFor="gymStartWeight"
                      className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-500"
                    >
                      Current Weight (kg)
                    </label>
                    <input
                      id="gymStartWeight"
                      type="number"
                      step="0.5"
                      min={20}
                      max={300}
                      placeholder="Optional (e.g. 72)"
                      value={startingWeightInput}
                      onChange={(e) => setStartingWeightInput(e.target.value)}
                      className="h-10 w-full rounded-xl border border-slate-300 bg-[#F8F9FA] px-3 text-[13.5px] font-semibold text-slate-900 focus:border-[#1E1B4B] focus:bg-white focus:outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label
                      htmlFor="gymTargetWeight"
                      className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-500"
                    >
                      Target Weight (kg)
                    </label>
                    <input
                      id="gymTargetWeight"
                      type="number"
                      step="0.5"
                      min={20}
                      max={300}
                      placeholder="Optional (e.g. 66)"
                      value={targetWeightInput}
                      onChange={(e) => setTargetWeightInput(e.target.value)}
                      className="h-10 w-full rounded-xl border border-slate-300 bg-[#F8F9FA] px-3 text-[13.5px] font-semibold text-slate-900 focus:border-[#1E1B4B] focus:bg-white focus:outline-none"
                    />
                  </div>
                </div>

                {/* Membership Plan Selector */}
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
                              ? 'border-2 border-[#1E1B4B] bg-[#1E1B4B] text-white shadow-sm'
                              : 'border-slate-200 bg-[#F8F9FA] text-slate-900 hover:border-[#1E1B4B]'
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
                                      ? 'bg-[#D2DB76] text-[#1E1B4B]'
                                      : 'bg-indigo-100 text-[#1E1B4B]'
                                  }`}
                                >
                                  {plan.badge}
                                </span>
                              )}
                            </div>
                            <p
                              className={`text-[11.5px] font-semibold ${
                                active ? 'text-indigo-200' : 'text-slate-500'
                              }`}
                            >
                              {plan.durationDays} days full gym access
                            </p>
                          </div>
                          <span
                            className={`shrink-0 rounded-full px-3 py-1 text-[13px] font-black tabular-nums ${
                              active
                                ? 'bg-[#D2DB76] text-[#1E1B4B]'
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
                className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#1E1B4B] px-5 py-3 text-[15px] font-black text-[#D2DB76] shadow-md hover:bg-[#2E2A6E] active:scale-[0.98] disabled:opacity-60 transition-all cursor-pointer"
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
        className="flex items-center justify-between gap-3 rounded-3xl border border-slate-200 bg-white px-5 py-4 text-slate-900 shadow-2xs hover:border-[#1E1B4B] transition-colors"
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
