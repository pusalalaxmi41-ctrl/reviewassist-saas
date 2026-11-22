import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Clock,
  RefreshCw,
  Copy,
  Check,
  MessageCircle,
  UserPlus,
  Search,
  Flame,
  ExternalLink,
  XCircle,
  Users,
  IndianRupee,
  TrendingUp,
  Activity,
  X,
  ClipboardList,
  Scale,
  Calendar,
  ChevronRight,
  UserX,
} from 'lucide-react';
import type { Business } from '../../types/business';
import type {
  GymFitnessGoal,
  GymMember,
  GymMemberProgressHistory,
  GymOwnerDashboardPayload,
  GymOwnerMemberAction,
} from '../../types/gym';
import { businessRepository } from '../../services/storage';
import {
  buildGymRenewalWhatsAppMessage,
  formatCheckInTime12h,
  formatIsoDatePretty,
  getFitnessGoalMeta,
  getGymPortalUrl,
  getGymRenewalWhatsAppLink,
  getTodayIsoDateKey,
  getWorkoutFocusMeta,
  GYM_FITNESS_GOAL_OPTIONS,
  GYM_WORKOUT_FOCUS_OPTIONS,
  normalizeGymPhone,
} from '../../utils/gymValidation';
import { formatPriceFromPaise } from '../../utils/restaurantValidation';
import { copyText } from '../../utils/clipboard';

interface Props {
  business: Business;
  isBusinessLive: boolean;
}

export function GymManagerView({ business, isBusinessLive }: Props) {
  const [dashboard, setDashboard] = useState<GymOwnerDashboardPayload | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [selectedMonthKey, setSelectedMonthKey] = useState<string>(() =>
    getTodayIsoDateKey().slice(0, 7),
  );
  const [busyMemberId, setBusyMemberId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Filter & Manual Desk Walk-In Registration (with Fitness Goal & Weights)
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddWalkIn, setShowAddWalkIn] = useState(false);
  const [walkInName, setWalkInName] = useState('');
  const [walkInPhone, setWalkInPhone] = useState('');
  const [walkInPlanId, setWalkInPlanId] = useState('1_month');
  const [walkInGoal, setWalkInGoal] = useState<GymFitnessGoal>('muscle_gain');
  const [walkInStartWt, setWalkInStartWt] = useState('');
  const [walkInTargetWt, setWalkInTargetWt] = useState('');
  const [addingWalkIn, setAddingWalkIn] = useState(false);

  // Member Progress & Attendance Modal + Trainer Notes State
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [memberProgress, setMemberProgress] =
    useState<GymMemberProgressHistory | null>(null);
  const [loadingProgress, setLoadingProgress] = useState(false);
  const [trainerNotesDraft, setTrainerNotesDraft] = useState('');
  const [goalDraft, setGoalDraft] = useState<GymFitnessGoal>('general_fitness');
  const [startWtDraft, setStartWtDraft] = useState('');
  const [targetWtDraft, setTargetWtDraft] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);

  const gymPortalUrl = getGymPortalUrl(business.slug);

  const loadDashboard = useCallback(async () => {
    try {
      const data = await businessRepository.getGymOwnerDashboard(
        business.id,
        undefined,
        selectedMonthKey,
      );
      setDashboard(data);
      if (data.config.plans.length > 0) {
        setWalkInPlanId((prev) =>
          data.config.plans.some((p) => p.id === prev)
            ? prev
            : data.config.plans[0].id,
        );
      }
    } catch (err) {
      setErrorMessage((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [business.id, selectedMonthKey]);

  useEffect(() => {
    let active = true;
    const init = window.setTimeout(() => {
      if (active) void loadDashboard();
    }, 0);
    const interval = window.setInterval(() => {
      void loadDashboard();
    }, 15000);
    return () => {
      active = false;
      window.clearTimeout(init);
      window.clearInterval(interval);
    };
  }, [loadDashboard]);

  function flashStatus(msg: string) {
    setErrorMessage(null);
    setStatusMessage(msg);
    window.setTimeout(() => setStatusMessage(null), 5000);
  }

  async function handleOpenMemberProgress(memberId: string) {
    setSelectedMemberId(memberId);
    setMemberProgress(null);
    setLoadingProgress(true);
    try {
      const hist = await businessRepository.getGymMemberProgressHistory({
        businessId: business.id,
        memberId,
        monthKey: selectedMonthKey,
      });
      setMemberProgress(hist);
      setTrainerNotesDraft(hist.member.trainerNotes ?? '');
      setGoalDraft(hist.member.fitnessGoal ?? 'general_fitness');
      setStartWtDraft(
        hist.member.startingWeightKg != null
          ? String(hist.member.startingWeightKg)
          : '',
      );
      setTargetWtDraft(
        hist.member.targetWeightKg != null
          ? String(hist.member.targetWeightKg)
          : '',
      );
    } catch (err) {
      setErrorMessage((err as Error).message);
      setSelectedMemberId(null);
    } finally {
      setLoadingProgress(false);
    }
  }

  async function handleSaveTrainerNotes(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedMemberId) return;
    setSavingNotes(true);
    setErrorMessage(null);
    try {
      await businessRepository.ownerUpdateGymMemberProfile({
        businessId: business.id,
        memberId: selectedMemberId,
        trainerNotes: trainerNotesDraft,
        fitnessGoal: goalDraft,
        startingWeightKg: startWtDraft.trim()
          ? Number.parseFloat(startWtDraft)
          : null,
        targetWeightKg: targetWtDraft.trim()
          ? Number.parseFloat(targetWtDraft)
          : null,
      });
      flashStatus('Saved trainer notes & fitness target!');
      await Promise.all([
        loadDashboard(),
        handleOpenMemberProgress(selectedMemberId),
      ]);
    } catch (err) {
      setErrorMessage((err as Error).message);
    } finally {
      setSavingNotes(false);
    }
  }

  async function handleMemberAction(
    member: GymMember,
    action: GymOwnerMemberAction,
    overrideDurationDays?: number,
  ) {
    setBusyMemberId(member.id);
    setErrorMessage(null);
    try {
      const updated = await businessRepository.ownerApproveOrRenewGymMember({
        businessId: business.id,
        memberId: member.id,
        action,
        durationDays: overrideDurationDays ?? null,
        staffLabel: 'Owner',
      });
      if (action === 'approve') {
        flashStatus(
          `Approved ${updated.fullName} — ${updated.planName} active until ${formatIsoDatePretty(updated.endDate)}!`,
        );
      } else if (action === 'renew') {
        flashStatus(
          `Renewed ${updated.fullName} (+${overrideDurationDays ?? updated.durationDays} days) — valid until ${formatIsoDatePretty(updated.endDate)}!`,
        );
      } else if (action === 'reject') {
        flashStatus(`Rejected pending signup for ${updated.fullName}.`);
      } else {
        flashStatus(`Suspended membership for ${updated.fullName}.`);
      }
      await loadDashboard();
    } catch (err) {
      setErrorMessage((err as Error).message);
    } finally {
      setBusyMemberId(null);
    }
  }

  async function handleCopyReminder(member: GymMember) {
    const msg = buildGymRenewalWhatsAppMessage(business.name, member);
    const ok = await copyText(msg);
    if (ok) {
      setCopiedId(member.id);
      flashStatus(`Copied WhatsApp renewal reminder for ${member.fullName}!`);
      window.setTimeout(() => setCopiedId(null), 2500);
    }
  }

  async function handleAddWalkInMember(e: React.FormEvent) {
    e.preventDefault();
    setAddingWalkIn(true);
    setErrorMessage(null);
    try {
      const created = await businessRepository.submitGymMemberRegistration({
        businessSlug: business.slug,
        fullName: walkInName,
        phone: walkInPhone,
        planId: walkInPlanId,
        fitnessGoal: walkInGoal,
        startingWeightKg: walkInStartWt.trim()
          ? Number.parseFloat(walkInStartWt)
          : null,
        targetWeightKg: walkInTargetWt.trim()
          ? Number.parseFloat(walkInTargetWt)
          : null,
      });
      const active = await businessRepository.ownerApproveOrRenewGymMember({
        businessId: business.id,
        memberId: created.id,
        action: 'approve',
        staffLabel: 'Owner Desk',
      });
      setWalkInName('');
      setWalkInPhone('');
      setWalkInStartWt('');
      setWalkInTargetWt('');
      setShowAddWalkIn(false);
      flashStatus(
        `Registered & activated ${active.fullName} (${active.memberCode}) until ${formatIsoDatePretty(active.endDate)}!`,
      );
      await loadDashboard();
    } catch (err) {
      setErrorMessage((err as Error).message);
    } finally {
      setAddingWalkIn(false);
    }
  }

  const members = useMemo(() => dashboard?.members ?? [], [dashboard]);
  const todaysAttendance = useMemo(
    () => dashboard?.todaysAttendance ?? [],
    [dashboard],
  );
  const inactiveAlertMembers = useMemo(
    () => dashboard?.inactiveAlertMembers ?? [],
    [dashboard],
  );
  const pendingApprovals = useMemo(
    () => members.filter((m) => m.effectiveStatus === 'pending_approval'),
    [members],
  );
  const expiringSoon = useMemo(
    () => members.filter((m) => m.effectiveStatus === 'expiring_soon'),
    [members],
  );
  const expiredMembers = useMemo(
    () => members.filter((m) => m.effectiveStatus === 'expired'),
    [members],
  );
  const activeMembers = useMemo(
    () =>
      members.filter(
        (m) =>
          m.effectiveStatus === 'active' ||
          m.effectiveStatus === 'expiring_soon',
      ),
    [members],
  );

  const filteredActiveMembers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return activeMembers;
    return activeMembers.filter((m) => {
      const goalMeta = getFitnessGoalMeta(m.fitnessGoal);
      return (
        m.fullName.toLowerCase().includes(q) ||
        m.phone.includes(q) ||
        m.memberCode.toLowerCase().includes(q) ||
        m.planName.toLowerCase().includes(q) ||
        goalMeta.label.toLowerCase().includes(q)
      );
    });
  }, [activeMembers, searchQuery]);

  if (loading) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-12 text-center">
        <div className="inline-block h-7 w-7 animate-spin rounded-full border-4 border-[#1E1B4B] border-r-transparent" />
        <p className="mt-3 text-[14px] font-semibold text-slate-500">
          Loading GymOS Executive Command Center…
        </p>
      </div>
    );
  }

  const alertWindowDays = dashboard?.config.renewalAlertDays ?? 3;
  const monthlyRevenuePaise = dashboard?.monthlyRevenuePaise ?? 0;
  const projectedNextMonthRevenuePaise =
    dashboard?.projectedNextMonthRevenuePaise ?? 0;

  // Compute workout split breakdown rows for the modal chart
  const splitRows = memberProgress
    ? (() => {
        const counts = memberProgress.workoutSplitCounts ?? {};
        const total = Object.values(counts).reduce((a, b) => a + (b ?? 0), 0);
        return GYM_WORKOUT_FOCUS_OPTIONS.map((opt) => {
          const count = counts[opt.value] ?? 0;
          const pct = total > 0 ? Math.round((count / total) * 100) : 0;
          return { ...opt, count, pct };
        })
          .filter((r) => r.count > 0)
          .sort((a, b) => b.count - a.count);
      })()
    : [];

  return (
    <div className="space-y-6 animate-fadeSlideUp">
      {/* Header Row */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-[26px] sm:text-[31px] font-black tracking-tight text-[#1E1B4B]">
              Renewal Radar &amp; Attendance
            </h1>
            <span className="rounded-full bg-[#1E1B4B] px-3 py-0.5 text-[11px] font-extrabold uppercase tracking-wider text-[#D2DB76]">
              {alertWindowDays}-Day Alert Active
            </span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-3 text-[13px] font-semibold text-slate-500">
            <span>{business.name}</span>
            {isBusinessLive && (
              <a
                href={gymPortalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[#1E1B4B] hover:underline"
              >
                Entrance QR Hub{' '}
                <ExternalLink className="h-3.5 w-3.5" aria-hidden />
              </a>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            type="month"
            aria-label="Filter revenue and attendance month"
            value={selectedMonthKey}
            onChange={(e) => {
              if (e.target.value) setSelectedMonthKey(e.target.value);
            }}
            className="h-10 rounded-xl border border-[#1E1B4B]/20 bg-white px-3 text-[12.5px] font-extrabold text-[#1E1B4B] focus:border-[#1E1B4B] focus:outline-none"
          />
          <button
            type="button"
            onClick={() => setShowAddWalkIn((v) => !v)}
            className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-[#1E1B4B] px-4 text-[13px] font-extrabold text-[#D2DB76] hover:bg-[#2E2A6E] cursor-pointer"
          >
            <UserPlus className="h-4 w-4" aria-hidden />
            {showAddWalkIn ? 'Close Walk-In' : '+ Add Desk Member'}
          </button>
          <button
            type="button"
            onClick={() => void loadDashboard()}
            aria-label="Refresh gym dashboard"
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-[#1E1B4B] hover:bg-[#F8F9FA] cursor-pointer"
          >
            <RefreshCw className="h-4 w-4" aria-hidden />
          </button>
        </div>
      </div>

      {statusMessage && (
        <div
          role="status"
          className="flex items-center gap-2.5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-[13px] font-bold text-emerald-800"
        >
          <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden />
          <span>{statusMessage}</span>
        </div>
      )}
      {errorMessage && (
        <div
          role="alert"
          className="flex items-center gap-2.5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] font-semibold text-red-900"
        >
          <AlertCircle className="h-4 w-4 shrink-0 text-red-700" aria-hidden />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* 4 EXECUTIVE HERO KPI CARDS (Milk #F8F9FA, Midnight Navy #1E1B4B, Champagne Gold #D2DB76) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4">
          <p className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-800 flex items-center gap-1">
            <Flame className="h-3.5 w-3.5 text-emerald-600" aria-hidden />{' '}
            Checked In Today
          </p>
          <p className="mt-1.5 text-[28px] leading-none font-black text-slate-900 tabular-nums">
            {dashboard?.checkedInTodayCount ?? 0}
          </p>
          <p className="mt-1 text-[11.5px] font-semibold text-emerald-900/80">
            {activeMembers.length} active members total
          </p>
        </div>

        <div className="rounded-2xl border border-red-200 bg-red-50/80 p-4">
          <p className="text-[11px] font-extrabold uppercase tracking-wider text-red-700 flex items-center gap-1">
            <AlertTriangle className="h-3.5 w-3.5" aria-hidden /> Expiring ≤{' '}
            {alertWindowDays} Days
          </p>
          <p className="mt-1.5 text-[28px] leading-none font-black text-red-700 tabular-nums">
            {expiringSoon.length}
          </p>
          <p className="mt-1 text-[11.5px] font-semibold text-red-900/80">
            {pendingApprovals.length} pending • {expiredMembers.length} expired
          </p>
        </div>

        <div className="rounded-2xl border border-[#1E1B4B] bg-[#1E1B4B] p-4 text-white shadow-sm">
          <p className="text-[11px] font-extrabold uppercase tracking-wider text-[#D2DB76] flex items-center gap-1">
            <IndianRupee className="h-3.5 w-3.5" aria-hidden /> This Month
            Revenue
          </p>
          <p className="mt-1.5 text-[26px] leading-none font-black text-white tabular-nums">
            {formatPriceFromPaise(monthlyRevenuePaise, 'INR')}
          </p>
          <p className="mt-1 text-[11.5px] font-semibold text-indigo-200/85">
            Collected in {selectedMonthKey}
          </p>
        </div>

        <div className="rounded-2xl border border-[#1E1B4B]/15 bg-white p-4 shadow-2xs">
          <p className="text-[11px] font-extrabold uppercase tracking-wider text-[#1E1B4B] flex items-center gap-1">
            <TrendingUp className="h-3.5 w-3.5 text-emerald-600" aria-hidden />{' '}
            Next Month Projected
          </p>
          <p className="mt-1.5 text-[26px] leading-none font-black text-[#1E1B4B] tabular-nums">
            {formatPriceFromPaise(projectedNextMonthRevenuePaise, 'INR')}
          </p>
          <p className="mt-1 text-[11.5px] font-semibold text-slate-500">
            Renewals due in next 30d
          </p>
        </div>
      </div>

      {/* OPTIONAL DESK WALK-IN REGISTRATION DRAWER */}
      {showAddWalkIn && (
        <form
          onSubmit={(e) => void handleAddWalkInMember(e)}
          className="rounded-3xl border border-[#1E1B4B]/20 bg-[#F8F9FA] p-5 space-y-4 animate-fadeSlideUp"
        >
          <div>
            <h2 className="text-[16px] font-extrabold text-[#1E1B4B]">
              Instant Desk Registration &amp; Activation
            </h2>
            <p className="text-[12.5px] text-slate-600">
              For walk-ins who paid Cash/UPI right at the desk — logs revenue &amp; activates their pass immediately!
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <input
              type="text"
              required
              placeholder="Member Full Name"
              value={walkInName}
              onChange={(e) => setWalkInName(e.target.value)}
              className="h-11 rounded-xl border border-slate-300 bg-white px-3.5 text-[13.5px] font-semibold text-slate-900"
            />
            <input
              type="tel"
              required
              placeholder="10-Digit Phone Number"
              value={walkInPhone}
              onChange={(e) => setWalkInPhone(e.target.value)}
              className="h-11 rounded-xl border border-slate-300 bg-white px-3.5 text-[13.5px] font-semibold text-slate-900"
            />
            <select
              value={walkInPlanId}
              onChange={(e) => setWalkInPlanId(e.target.value)}
              className="h-11 rounded-xl border border-slate-300 bg-white px-3.5 text-[13.5px] font-semibold text-slate-900"
            >
              {(dashboard?.config.plans ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} — {formatPriceFromPaise(p.pricePaise, 'INR')} (
                  {p.durationDays}d)
                </option>
              ))}
            </select>
            <select
              aria-label="Member Fitness Goal"
              value={walkInGoal}
              onChange={(e) =>
                setWalkInGoal(e.target.value as GymFitnessGoal)
              }
              className="h-11 rounded-xl border border-slate-300 bg-white px-3.5 text-[13.5px] font-semibold text-slate-900"
            >
              {GYM_FITNESS_GOAL_OPTIONS.map((g) => (
                <option key={g.value} value={g.value}>
                  {g.emoji} Goal: {g.label}
                </option>
              ))}
            </select>
            <input
              type="number"
              step="0.5"
              min={20}
              max={300}
              placeholder="Current Weight kg (Optional)"
              value={walkInStartWt}
              onChange={(e) => setWalkInStartWt(e.target.value)}
              className="h-11 rounded-xl border border-slate-300 bg-white px-3.5 text-[13.5px] font-semibold text-slate-900"
            />
            <input
              type="number"
              step="0.5"
              min={20}
              max={300}
              placeholder="Target Weight kg (Optional)"
              value={walkInTargetWt}
              onChange={(e) => setWalkInTargetWt(e.target.value)}
              className="h-11 rounded-xl border border-slate-300 bg-white px-3.5 text-[13.5px] font-semibold text-slate-900"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={addingWalkIn}
              className="h-10 rounded-xl bg-[#1E1B4B] px-5 text-[13px] font-extrabold text-[#D2DB76] hover:bg-[#2E2A6E] cursor-pointer"
            >
              {addingWalkIn
                ? 'Activating…'
                : 'Confirm Payment & Activate Pass ✓'}
            </button>
          </div>
        </form>
      )}

      {/* 1. LIVE TODAY'S ATTENDANCE FEED */}
      <section className="rounded-3xl border border-[#1E1B4B]/15 bg-white p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-[18px] font-black text-[#1E1B4B] flex items-center gap-2">
              <Activity className="h-5 w-5 text-emerald-600" aria-hidden />
              Live Today&apos;s Attendance Feed ({todaysAttendance.length})
            </h2>
            <p className="text-[12.5px] text-slate-500 mt-0.5">
              Exact check-in timestamps and workout splits logged via your Entrance QR today. Tap any member to inspect history &amp; trainer notes.
            </p>
          </div>
        </div>

        {todaysAttendance.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-slate-200 bg-[#F8F9FA] p-5 text-center text-[13px] font-semibold text-slate-500">
            No QR check-ins logged yet today. When members scan at the entrance, they appear here in real time.
          </p>
        ) : (
          <div className="space-y-2.5">
            {todaysAttendance.map((entry) => {
              const goalMeta = getFitnessGoalMeta(entry.fitnessGoal);
              const focusMeta = getWorkoutFocusMeta(entry.workoutFocus);
              const timeStr = formatCheckInTime12h(entry.checkedInAt);
              return (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => void handleOpenMemberProgress(entry.memberId)}
                  className="w-full text-left flex flex-col gap-2 rounded-2xl border border-emerald-200/80 bg-emerald-50/40 px-4 py-3.5 hover:border-[#1E1B4B] hover:bg-emerald-50/70 transition-all sm:flex-row sm:items-center sm:justify-between cursor-pointer"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-md bg-[#1E1B4B] px-2 py-0.5 font-mono text-[11px] font-extrabold text-[#D2DB76]">
                        {entry.memberCode}
                      </span>
                      <span className="text-[15px] font-black text-slate-900">
                        {entry.fullName}
                      </span>
                      {timeStr && (
                        <span className="rounded-full bg-white border border-emerald-200 px-2.5 py-0.5 text-[11px] font-extrabold text-emerald-800 tabular-nums">
                          {timeStr}
                        </span>
                      )}
                      <span
                        className={`rounded-full border px-2.5 py-0.5 text-[11px] font-extrabold ${goalMeta.badgeClass}`}
                      >
                        {goalMeta.emoji} {goalMeta.shortLabel}
                      </span>
                    </div>
                    <p className="text-[12.5px] font-semibold text-slate-700">
                      Today:{' '}
                      <strong className="text-[#1E1B4B]">
                        {focusMeta.dayLabel}
                      </strong>
                      {entry.memberNote ? ` — "${entry.memberNote}"` : ''} •{' '}
                      <span className="text-emerald-800 font-bold">
                        {entry.daysAttendedThisMonth}{' '}
                        {entry.daysAttendedThisMonth === 1 ? 'visit' : 'visits'}{' '}
                        this month
                      </span>
                    </p>
                  </div>
                  <span className="inline-flex items-center gap-1 text-[12px] font-extrabold text-[#1E1B4B] shrink-0">
                    Progress <ChevronRight className="h-4 w-4" aria-hidden />
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* INACTIVE MEMBER FOLLOW-UP RADAR (>= 5 DAYS ABSENT) */}
      {inactiveAlertMembers.length > 0 && (
        <section className="rounded-3xl border border-amber-300/80 bg-amber-50/50 p-5 space-y-3">
          <div className="flex items-center gap-2">
            <UserX className="h-5 w-5 text-amber-700" aria-hidden />
            <div>
              <h2 className="text-[16px] font-black text-slate-900">
                Inactive Members Follow-Up ({inactiveAlertMembers.length})
              </h2>
              <p className="text-[12px] font-medium text-amber-900/80">
                Active members who haven&apos;t checked in for 5+ days — a quick trainer nudge keeps retention high!
              </p>
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {inactiveAlertMembers.map((im) => {
              const goalMeta = getFitnessGoalMeta(im.fitnessGoal);
              const digits = normalizeGymPhone(im.phone);
              const waPhone = digits.length === 10 ? `91${digits}` : digits;
              const nudgeMsg = `Hey ${im.fullName}! Missed you at ${business.name} over the last ${im.daysSinceLastCheckIn} days 💪 Let's get back on track with your ${goalMeta.label} goal this week!`;
              return (
                <div
                  key={im.memberId}
                  className="flex items-center justify-between gap-2 rounded-2xl border border-amber-200 bg-white px-3.5 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-[13.5px] font-black text-slate-900">
                      {im.fullName}{' '}
                      <span className="font-mono text-[11px] text-slate-500">
                        ({im.memberCode})
                      </span>
                    </p>
                    <p className="text-[11.5px] font-semibold text-amber-800">
                      {im.daysSinceLastCheckIn}d absent • {goalMeta.emoji}{' '}
                      {goalMeta.shortLabel}
                    </p>
                  </div>
                  <a
                    href={`https://wa.me/${waPhone}?text=${encodeURIComponent(nudgeMsg)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-8 shrink-0 items-center gap-1 rounded-lg bg-emerald-600 px-2.5 text-[11.5px] font-extrabold text-white hover:bg-emerald-700"
                  >
                    <MessageCircle className="h-3.5 w-3.5" aria-hidden /> Nudge
                  </a>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* 2. PENDING PAYMENT APPROVALS (Cash / UPI Handover at Desk) */}
      <section className="rounded-3xl border border-amber-300 bg-white p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="text-[18px] font-black text-slate-900 flex items-center gap-2">
              <Clock className="h-5 w-5 text-amber-600" aria-hidden />
              Pending Payment Approvals ({pendingApprovals.length})
            </h2>
            <p className="text-[12.5px] text-slate-500 mt-0.5">
              Members who scanned your Front-Desk QR — collect Cash/UPI and tap
              Approve to start their countdown &amp; log revenue.
            </p>
          </div>
        </div>

        {pendingApprovals.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-slate-200 bg-[#F8F9FA] p-5 text-center text-[13px] font-semibold text-slate-500">
            No pending signups waiting for payment right now.
          </p>
        ) : (
          <div className="space-y-2.5">
            {pendingApprovals.map((m) => {
              const goalMeta = getFitnessGoalMeta(m.fitnessGoal);
              return (
                <div
                  key={m.id}
                  className="flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50/50 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-md bg-[#1E1B4B] px-2 py-0.5 font-mono text-[11px] font-extrabold text-[#D2DB76]">
                        {m.memberCode}
                      </span>
                      <p className="text-[15px] font-black text-slate-900">
                        {m.fullName}
                      </p>
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[10.5px] font-extrabold ${goalMeta.badgeClass}`}
                      >
                        {goalMeta.emoji} {goalMeta.shortLabel}
                      </span>
                      <span className="text-[12px] font-mono text-slate-600">
                        {m.phone}
                      </span>
                    </div>
                    <p className="text-[13px] font-bold text-amber-900">
                      {m.planName} ({m.durationDays} days) —{' '}
                      <span className="text-slate-900 font-black">
                        {formatPriceFromPaise(m.feePaise, 'INR')}
                      </span>
                      {(m.startingWeightKg || m.targetWeightKg) && (
                        <span className="ml-2 text-[12px] font-semibold text-slate-600">
                          • {m.startingWeightKg ?? '—'}kg →{' '}
                          {m.targetWeightKg ?? '—'}kg
                        </span>
                      )}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <button
                      type="button"
                      disabled={busyMemberId === m.id}
                      onClick={() => void handleMemberAction(m, 'approve')}
                      className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-emerald-600 px-4 text-[12.5px] font-extrabold text-white shadow-sm hover:bg-emerald-700 cursor-pointer disabled:opacity-50"
                    >
                      <CheckCircle2 className="h-4 w-4" aria-hidden />
                      {busyMemberId === m.id
                        ? 'Activating…'
                        : 'Approve Payment & Activate ✓'}
                    </button>
                    <button
                      type="button"
                      disabled={busyMemberId === m.id}
                      onClick={() => void handleMemberAction(m, 'reject')}
                      className="inline-flex h-10 items-center gap-1 rounded-xl border border-red-200 bg-white px-3 text-[12px] font-bold text-red-700 hover:bg-red-50 cursor-pointer"
                    >
                      <XCircle className="h-3.5 w-3.5" aria-hidden /> Reject
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* 3. 🔴 AUTOMATIC 3-DAY RENEWAL RADAR */}
      <section className="rounded-3xl border-2 border-red-300 bg-white p-5 sm:p-6 shadow-xs space-y-4">
        <div>
          <h2 className="text-[18px] font-black text-red-700 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" aria-hidden />
            🔴 Expiring in ≤ {alertWindowDays} Days — Urgent Renewals (
            {expiringSoon.length})
          </h2>
          <p className="text-[12.5px] text-slate-600 mt-0.5">
            Automatically calculated on every load. Send a 1-tap WhatsApp
            reminder or renew right away!
          </p>
        </div>

        {expiringSoon.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-emerald-200 bg-emerald-50/40 p-5 text-center text-[13px] font-semibold text-emerald-800">
            All active members have more than {alertWindowDays} days remaining!
          </p>
        ) : (
          <div className="space-y-3">
            {expiringSoon.map((m) => {
              const goalMeta = getFitnessGoalMeta(m.fitnessGoal);
              return (
                <div
                  key={m.id}
                  className="flex flex-col gap-3 rounded-2xl border border-red-200 bg-red-50/60 p-4 lg:flex-row lg:items-center lg:justify-between"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-red-600 px-2.5 py-0.5 text-[11px] font-black text-white tabular-nums">
                        {m.daysRemaining === 0
                          ? 'EXPIRES TODAY'
                          : `${m.daysRemaining} ${m.daysRemaining === 1 ? 'DAY' : 'DAYS'} LEFT`}
                      </span>
                      <button
                        type="button"
                        onClick={() => void handleOpenMemberProgress(m.id)}
                        className="text-[15.5px] font-black text-slate-900 hover:underline cursor-pointer"
                      >
                        {m.fullName}
                      </button>
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[10.5px] font-extrabold ${goalMeta.badgeClass}`}
                      >
                        {goalMeta.emoji} {goalMeta.shortLabel}
                      </span>
                    </div>
                    <p className="text-[12.5px] font-semibold text-slate-700">
                      {m.planName} ({formatPriceFromPaise(m.feePaise, 'INR')}) •
                      Ends <strong>{formatIsoDatePretty(m.endDate)}</strong> •{' '}
                      {m.daysAttendedThisMonth ?? 0} days this month
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <button
                      type="button"
                      disabled={busyMemberId === m.id}
                      onClick={() => void handleMemberAction(m, 'renew', 30)}
                      className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-[#1E1B4B] px-3.5 text-[12.5px] font-extrabold text-[#D2DB76] hover:bg-[#2E2A6E] cursor-pointer"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                      Renew +30d
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleCopyReminder(m)}
                      className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 text-[12px] font-bold text-slate-900 hover:bg-slate-50 cursor-pointer"
                    >
                      {copiedId === m.id ? (
                        <Check
                          className="h-3.5 w-3.5 text-emerald-600"
                          aria-hidden
                        />
                      ) : (
                        <Copy className="h-3.5 w-3.5" aria-hidden />
                      )}
                      {copiedId === m.id ? 'Copied!' : 'Copy WhatsApp Reminder'}
                    </button>
                    <a
                      href={getGymRenewalWhatsAppLink(business.name, m)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex h-10 items-center gap-1 rounded-xl bg-emerald-600 px-3 text-[12px] font-extrabold text-white hover:bg-emerald-700"
                    >
                      <MessageCircle className="h-3.5 w-3.5" aria-hidden />
                      WhatsApp
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* 4. ⚫ EXPIRED MEMBERS */}
      {expiredMembers.length > 0 && (
        <section className="rounded-3xl border border-slate-800 bg-slate-900 p-5 sm:p-6 text-white shadow-sm space-y-4">
          <div>
            <h2 className="text-[18px] font-black text-white flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-red-400" aria-hidden />
              ⚫ Expired Members ({expiredMembers.length})
            </h2>
            <p className="text-[12.5px] text-slate-400 mt-0.5">
              Daily QR check-in is locked automatically for expired passes until
              renewed here.
            </p>
          </div>

          <div className="space-y-2.5">
            {expiredMembers.map((m) => (
              <div
                key={m.id}
                className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-slate-800/70 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="space-y-0.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-red-500/20 border border-red-400/40 px-2.5 py-0.5 text-[10.5px] font-extrabold uppercase text-red-300">
                      EXPIRED {formatIsoDatePretty(m.endDate)}
                    </span>
                    <button
                      type="button"
                      onClick={() => void handleOpenMemberProgress(m.id)}
                      className="text-[15px] font-extrabold text-white hover:underline cursor-pointer"
                    >
                      {m.fullName}
                    </button>
                    <span className="font-mono text-[12px] text-slate-400">
                      {m.phone}
                    </span>
                  </div>
                  <p className="text-[12px] text-slate-300">
                    Last plan: {m.planName} (
                    {formatPriceFromPaise(m.feePaise, 'INR')})
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    type="button"
                    disabled={busyMemberId === m.id}
                    onClick={() =>
                      void handleMemberAction(m, 'renew', m.durationDays)
                    }
                    className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-[#D2DB76] px-3.5 text-[12px] font-black text-[#1E1B4B] hover:bg-lime-300 cursor-pointer"
                  >
                    Renew (+{m.durationDays}d) ✓
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleCopyReminder(m)}
                    className="inline-flex h-9 items-center gap-1 rounded-xl border border-white/20 bg-white/5 px-3 text-[12px] font-bold text-white hover:bg-white/10 cursor-pointer"
                  >
                    <Copy className="h-3.5 w-3.5" aria-hidden /> Copy Reminder
                  </button>
                  <a
                    href={getGymRenewalWhatsAppLink(business.name, m)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-9 items-center gap-1 rounded-xl bg-emerald-600 px-3 text-[12px] font-extrabold text-white hover:bg-emerald-500"
                  >
                    <MessageCircle className="h-3.5 w-3.5" aria-hidden />{' '}
                    WhatsApp
                  </a>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 5. INTERACTIVE ACTIVE MEMBER DIRECTORY */}
      <section className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-[#1E1B4B]" aria-hidden />
              <h2 className="text-[18px] font-black text-[#1E1B4B]">
                Active Member Directory ({activeMembers.length})
              </h2>
            </div>
            <p className="text-[12px] text-slate-500 mt-0.5">
              Click any member to open their full attendance log, workout split chart, and trainer notes.
            </p>
          </div>
          <div className="relative w-full sm:w-64">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
              aria-hidden
            />
            <input
              type="search"
              placeholder="Search name, goal, GYM-001…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-10 w-full rounded-xl border border-slate-200 bg-[#F8F9FA] pl-9 pr-3 text-[13px] font-semibold text-slate-900 focus:border-[#1E1B4B] focus:bg-white focus:outline-none"
            />
          </div>
        </div>

        {filteredActiveMembers.length === 0 ? (
          <p className="py-6 text-center text-[13px] font-semibold text-slate-500">
            No active members match your search.
          </p>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredActiveMembers.map((m) => {
              const goalMeta = getFitnessGoalMeta(m.fitnessGoal);
              return (
                <div
                  key={m.id}
                  className="py-3.5 flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between"
                >
                  <button
                    type="button"
                    onClick={() => void handleOpenMemberProgress(m.id)}
                    className="space-y-1 min-w-0 text-left group cursor-pointer"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded bg-[#1E1B4B]/8 px-2 py-0.5 font-mono text-[11px] font-bold text-[#1E1B4B]">
                        {m.memberCode}
                      </span>
                      <p className="text-[14.5px] font-black text-slate-900 group-hover:text-[#1E1B4B] group-hover:underline">
                        {m.fullName}
                      </p>
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[10.5px] font-extrabold ${goalMeta.badgeClass}`}
                      >
                        {goalMeta.emoji} {goalMeta.shortLabel}
                      </span>
                      {m.checkedInToday && (
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10.5px] font-extrabold text-emerald-800">
                          ✓ In Today
                          {m.todayWorkoutFocus
                            ? ` • ${getWorkoutFocusMeta(m.todayWorkoutFocus).label}`
                            : ''}
                        </span>
                      )}
                    </div>
                    <p className="text-[12.5px] text-slate-500">
                      {m.phone} • {m.planName} • Expires{' '}
                      <strong className="text-slate-800">
                        {formatIsoDatePretty(m.endDate)}
                      </strong>{' '}
                      •{' '}
                      <strong className="text-[#1E1B4B]">
                        {m.daysAttendedThisMonth ?? 0} days this month
                      </strong>{' '}
                      ({m.totalCheckIns} total)
                    </p>
                  </button>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <span
                      className={`rounded-full px-3 py-1 text-[12px] font-black tabular-nums ${
                        m.effectiveStatus === 'expiring_soon'
                          ? 'bg-red-100 text-red-700'
                          : 'bg-[#D2DB76]/60 text-[#1E1B4B]'
                      }`}
                    >
                      {m.daysRemaining}d left
                    </span>
                    <button
                      type="button"
                      onClick={() => void handleOpenMemberProgress(m.id)}
                      className="inline-flex h-9 items-center gap-1 rounded-xl border border-[#1E1B4B]/20 bg-white px-3 text-[12px] font-bold text-[#1E1B4B] hover:bg-[#1E1B4B] hover:text-[#D2DB76] transition-colors cursor-pointer"
                    >
                      <ClipboardList className="h-3.5 w-3.5" aria-hidden />
                      Progress
                    </button>
                    <button
                      type="button"
                      disabled={busyMemberId === m.id}
                      onClick={() => void handleMemberAction(m, 'renew', 30)}
                      className="h-9 rounded-xl border border-slate-200 bg-[#F8F9FA] px-3 text-[12px] font-bold text-slate-900 hover:bg-[#1E1B4B] hover:text-[#D2DB76] transition-colors cursor-pointer"
                    >
                      +30d Renew
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* MEMBER PROGRESS, ATTENDANCE TIMELINE & TRAINER NOTES MODAL */}
      {selectedMemberId && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Member Progress & Attendance History"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs"
        >
          <div className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-[#1E1B4B]/20 bg-white shadow-2xl">
            {/* Modal Header */}
            <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-slate-100 bg-[#1E1B4B] px-6 py-4 text-white">
              <div className="min-w-0">
                <p className="text-[10.5px] font-extrabold uppercase tracking-[0.18em] text-[#D2DB76]">
                  MEMBER PROGRESS &amp; ATTENDANCE LOG
                </p>
                <h2 className="truncate text-[20px] font-black">
                  {memberProgress
                    ? `${memberProgress.member.fullName} (${memberProgress.member.memberCode})`
                    : 'Loading Member History…'}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedMemberId(null);
                  setMemberProgress(null);
                }}
                aria-label="Close member progress modal"
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 text-white hover:bg-white/20 cursor-pointer"
              >
                <X className="h-5 w-5" aria-hidden />
              </button>
            </div>

            {loadingProgress || !memberProgress ? (
              <div className="p-12 text-center">
                <div className="inline-block h-7 w-7 animate-spin rounded-full border-4 border-[#1E1B4B] border-r-transparent" />
                <p className="mt-3 text-[13.5px] font-semibold text-slate-500">
                  Loading attendance &amp; workout split analytics…
                </p>
              </div>
            ) : (
              <div className="p-6 space-y-6">
                {/* Snapshot Stats */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="rounded-2xl bg-[#F8F9FA] border border-slate-200 p-3">
                    <p className="text-[10px] font-extrabold uppercase text-slate-500">
                      Month Attendance
                    </p>
                    <p className="mt-1 text-[22px] font-black text-[#1E1B4B] tabular-nums">
                      {memberProgress.daysAttendedThisMonth}d
                    </p>
                    <p className="text-[11px] font-semibold text-slate-500">
                      in {memberProgress.monthKey}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-[#F8F9FA] border border-slate-200 p-3">
                    <p className="text-[10px] font-extrabold uppercase text-slate-500">
                      Total Visits
                    </p>
                    <p className="mt-1 text-[22px] font-black text-slate-900 tabular-nums">
                      {memberProgress.member.totalCheckIns}
                    </p>
                    <p className="text-[11px] font-semibold text-slate-500">
                      all time
                    </p>
                  </div>
                  <div className="rounded-2xl bg-[#F8F9FA] border border-slate-200 p-3">
                    <p className="text-[10px] font-extrabold uppercase text-slate-500">
                      Plan Left
                    </p>
                    <p className="mt-1 text-[22px] font-black text-emerald-700 tabular-nums">
                      {memberProgress.member.daysRemaining}d
                    </p>
                    <p className="text-[11px] font-semibold text-slate-500">
                      ends {formatIsoDatePretty(memberProgress.member.endDate)}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-[#F8F9FA] border border-slate-200 p-3">
                    <p className="text-[10px] font-extrabold uppercase text-slate-500 flex items-center gap-1">
                      <Scale className="h-3 w-3" aria-hidden /> Weight Target
                    </p>
                    <p className="mt-1 text-[16px] font-black text-[#1E1B4B] tabular-nums">
                      {memberProgress.member.startingWeightKg != null
                        ? `${memberProgress.member.startingWeightKg}kg`
                        : '—'}{' '}
                      →{' '}
                      {memberProgress.member.targetWeightKg != null
                        ? `${memberProgress.member.targetWeightKg}kg`
                        : '—'}
                    </p>
                    <p className="text-[11px] font-semibold text-slate-500 truncate">
                      {getFitnessGoalMeta(memberProgress.member.fitnessGoal).label}
                    </p>
                  </div>
                </div>

                {/* Workout Split Breakdown Chart */}
                <div className="rounded-2xl border border-slate-200 bg-[#F8F9FA] p-4 space-y-3">
                  <p className="text-[12px] font-extrabold uppercase tracking-wider text-[#1E1B4B]">
                    Workout Split Breakdown ({memberProgress.attendanceLogs.length}{' '}
                    logged sessions)
                  </p>
                  {splitRows.length === 0 ? (
                    <p className="text-[12.5px] font-medium text-slate-500">
                      No workout splits logged yet.
                    </p>
                  ) : (
                    <div className="space-y-2.5">
                      {splitRows.map((row) => (
                        <div key={row.value} className="space-y-1">
                          <div className="flex items-center justify-between text-[12.5px] font-bold text-slate-800">
                            <span>{row.dayLabel}</span>
                            <span className="tabular-nums text-[#1E1B4B]">
                              {row.count} {row.count === 1 ? 'session' : 'sessions'}{' '}
                              ({row.pct}%)
                            </span>
                          </div>
                          <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-200">
                            <div
                              className={`h-full rounded-full ${row.barColor}`}
                              style={{ width: `${Math.max(8, row.pct)}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Editable Trainer Notes & Fitness Goal Form */}
                <form
                  onSubmit={(e) => void handleSaveTrainerNotes(e)}
                  className="rounded-2xl border border-[#1E1B4B]/15 bg-white p-4 space-y-3"
                >
                  <p className="text-[12px] font-extrabold uppercase tracking-wider text-[#1E1B4B]">
                    Trainer Notes &amp; Member Fitness Target
                  </p>
                  <div className="grid gap-2.5 sm:grid-cols-3">
                    <select
                      aria-label="Edit Fitness Goal"
                      value={goalDraft}
                      onChange={(e) =>
                        setGoalDraft(e.target.value as GymFitnessGoal)
                      }
                      className="h-10 rounded-xl border border-slate-300 bg-[#F8F9FA] px-3 text-[12.5px] font-bold text-slate-900"
                    >
                      {GYM_FITNESS_GOAL_OPTIONS.map((g) => (
                        <option key={g.value} value={g.value}>
                          {g.emoji} {g.label}
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      step="0.5"
                      min={20}
                      max={300}
                      placeholder="Current kg"
                      value={startWtDraft}
                      onChange={(e) => setStartWtDraft(e.target.value)}
                      className="h-10 rounded-xl border border-slate-300 bg-[#F8F9FA] px-3 text-[12.5px] font-bold text-slate-900"
                    />
                    <input
                      type="number"
                      step="0.5"
                      min={20}
                      max={300}
                      placeholder="Target kg"
                      value={targetWtDraft}
                      onChange={(e) => setTargetWtDraft(e.target.value)}
                      className="h-10 rounded-xl border border-slate-300 bg-[#F8F9FA] px-3 text-[12.5px] font-bold text-slate-900"
                    />
                  </div>
                  <textarea
                    rows={3}
                    maxLength={1000}
                    placeholder="Add trainer notes (e.g. Left knee sensitivity — swap barbell squats for leg press; aim for 120g protein/day)…"
                    value={trainerNotesDraft}
                    onChange={(e) => setTrainerNotesDraft(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-[#F8F9FA] p-3 text-[13px] font-medium text-slate-900 focus:border-[#1E1B4B] focus:bg-white focus:outline-none"
                  />
                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={savingNotes}
                      className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-[#1E1B4B] px-4 text-[12.5px] font-extrabold text-[#D2DB76] hover:bg-[#2E2A6E] disabled:opacity-60 cursor-pointer"
                    >
                      <CheckCircle2 className="h-4 w-4" aria-hidden />
                      {savingNotes ? 'Saving…' : 'Save Trainer Notes ✓'}
                    </button>
                  </div>
                </form>

                {/* Date-by-Date Timestamped Attendance History */}
                <div className="space-y-2.5">
                  <p className="text-[12px] font-extrabold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5" aria-hidden />
                    Date-by-Date Check-In History (
                    {memberProgress.attendanceLogs.length})
                  </p>
                  {memberProgress.attendanceLogs.length === 0 ? (
                    <p className="rounded-2xl border border-dashed border-slate-200 bg-[#F8F9FA] p-5 text-center text-[13px] font-semibold text-slate-500">
                      No attendance check-ins recorded for this member yet.
                    </p>
                  ) : (
                    <div className="max-h-60 overflow-y-auto divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white">
                      {memberProgress.attendanceLogs.map((log) => {
                        const fm = getWorkoutFocusMeta(log.workoutFocus);
                        const timeStr = formatCheckInTime12h(log.checkedInAt);
                        return (
                          <div
                            key={log.id}
                            className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-[12.5px]"
                          >
                            <div className="min-w-0">
                              <span className="font-extrabold text-slate-900">
                                {formatIsoDatePretty(log.checkInDate)}
                              </span>
                              {timeStr && (
                                <span className="ml-2 font-mono text-[11.5px] font-semibold text-slate-500">
                                  {timeStr}
                                </span>
                              )}
                              {log.memberNote && (
                                <p className="text-[11.5px] text-slate-600 truncate">
                                  Note: {log.memberNote}
                                </p>
                              )}
                            </div>
                            <span className="rounded-full bg-[#1E1B4B]/8 px-2.5 py-0.5 text-[11px] font-extrabold text-[#1E1B4B]">
                              {fm.dayLabel}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
