import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import {
  Activity,
  AlertCircle,
  Award,
  Bell,
  CheckCircle2,
  ClipboardList,
  ExternalLink,
  Flame,
  IndianRupee,
  MessageCircle,
  Play,
  RefreshCw,
  Scale,
  Search,
  ShoppingBag,
  Snowflake,
  Trash2,
  Trophy,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import type { Business } from '../../types/business';
import type {
  GymCatalogEquipment,
  GymCatalogMuscleGroup,
  GymFitnessGoal,
  GymMember,
  GymMemberProgressHistory,
  GymMemberWorkoutSummaryPayload,
  GymOwnerDashboardPayload,
  GymPaymentMethod,
} from '../../types/gym';
import { businessRepository } from '../../services/storage';
import {
  formatCheckInTime12h,
  formatIsoDatePretty,
  getFitnessGoalMeta,
  getGymBalanceDueWhatsAppLink,
  getGymPortalUrl,
  getGymRenewalWhatsAppLink,
  getTodayIsoDateKey,
  getWorkoutFocusMeta,
  GYM_FITNESS_GOAL_OPTIONS,
} from '../../utils/gymValidation';
import { GYM_TRAINER_ROUTINE_PRESETS } from '../../utils/gymWorkoutEngine';
import { formatPriceFromPaise } from '../../utils/restaurantValidation';

export type GymCommandSection =
  | 'dashboard'
  | 'members'
  | 'trainers'
  | 'dues'
  | 'supplements'
  | 'workouts';

interface Props {
  business: Business;
  isBusinessLive: boolean;
  activeSection?: GymCommandSection;
  onSectionChange?: (section: GymCommandSection) => void;
}

export function GymManagerView({
  business,
  isBusinessLive,
  activeSection = 'dashboard',
  onSectionChange,
}: Props) {
  const [dashboard, setDashboard] = useState<GymOwnerDashboardPayload | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [selectedMonthKey, setSelectedMonthKey] = useState<string>(() =>
    getTodayIsoDateKey().slice(0, 7),
  );
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [busyId, setBusyId] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Walk-In Add Member Modal
  const [showAddWalkIn, setShowAddWalkIn] = useState(false);
  const [walkInName, setWalkInName] = useState('');
  const [walkInPhone, setWalkInPhone] = useState('');
  const [walkInPlanId, setWalkInPlanId] = useState('3_months');
  const [walkInGoal, setWalkInGoal] = useState<GymFitnessGoal>('muscle_gain');
  const [addingWalkIn, setAddingWalkIn] = useState(false);

  // Approve / Renew Modal (Full OR Installment + Optional PT Package)
  const [approvalModal, setApprovalModal] = useState<{
    member: GymMember;
    action: 'approve' | 'renew';
  } | null>(null);
  const [appPlanId, setAppPlanId] = useState('3_months');
  const [appPaidRupees, setAppPaidRupees] = useState('');
  const [appDueDate, setAppDueDate] = useState('');
  const [appPayMethod, setAppPayMethod] = useState<GymPaymentMethod>('upi');
  const [appPtTrainerId, setAppPtTrainerId] = useState('');
  const [appPtSessions, setAppPtSessions] = useState('0');
  const [appPtFeeRupees, setAppPtFeeRupees] = useState('0');
  const [submittingApproval, setSubmittingApproval] = useState(false);

  // Collect Balance Due Modal
  const [collectTarget, setCollectTarget] = useState<GymMember | null>(null);
  const [collectRupees, setCollectRupees] = useState('');
  const [collectMethod, setCollectMethod] = useState<GymPaymentMethod>('upi');

  // Add Trainer Form
  const [trainerName, setTrainerName] = useState('');
  const [trainerSpecialty, setTrainerSpecialty] = useState(
    'Strength & Conditioning',
  );
  const [trainerCommission, setTrainerCommission] = useState('50');
  const [savingTrainer, setSavingTrainer] = useState(false);

  // Add Supplement Product Form
  const [prodName, setProdName] = useState('');
  const [prodPriceRupees, setProdPriceRupees] = useState('120');
  const [prodStock, setProdStock] = useState('50');
  const [retailMethod, setRetailMethod] = useState<GymPaymentMethod>('upi');

  // Add Custom Exercise & Routine Builder State
  const [customExName, setCustomExName] = useState('');
  const [customExMuscle, setCustomExMuscle] =
    useState<GymCatalogMuscleGroup>('chest');
  const [customExEquip, setCustomExEquip] =
    useState<GymCatalogEquipment>('dumbbell');
  const [routineAssignMemberId, setRoutineAssignMemberId] = useState('');

  // Member Progress Drawer (Attendance + Body Journal + Strength PRs + Coach Notes)
  const [progressMemberId, setProgressMemberId] = useState<string | null>(null);
  const [memberProgress, setMemberProgress] =
    useState<GymMemberProgressHistory | null>(null);
  const [workoutSummary, setWorkoutSummary] =
    useState<GymMemberWorkoutSummaryPayload | null>(null);
  const [loadingProgress, setLoadingProgress] = useState(false);
  const [notesDraft, setNotesDraft] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);

  const gymPortalUrl = getGymPortalUrl(business.slug);

  function flashStatus(msg: string) {
    setErrorMsg(null);
    setStatusMsg(msg);
    window.setTimeout(() => {
      setStatusMsg((prev) => (prev === msg ? null : prev));
    }, 4500);
  }

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
      setErrorMsg((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [business.id, selectedMonthKey]);

  useEffect(() => {
    let active = true;
    const init = window.setTimeout(() => {
      if (active) void loadDashboard();
    }, 0);
    const poll = window.setInterval(() => {
      if (active) void loadDashboard();
    }, 15000);
    return () => {
      active = false;
      window.clearTimeout(init);
      window.clearInterval(poll);
    };
  }, [loadDashboard]);

  // Global Ctrl+K / Cmd+K Member Search Shortcut
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const members = useMemo(() => dashboard?.members ?? [], [dashboard]);
  const trainers = useMemo(() => dashboard?.trainers ?? [], [dashboard]);
  const retailProducts = useMemo(
    () => dashboard?.retailProducts ?? [],
    [dashboard],
  );
  const recentRetailSales = useMemo(
    () => dashboard?.recentRetailSales ?? [],
    [dashboard],
  );
  const weeklyChart = useMemo(
    () => dashboard?.weeklyRevenueComparison ?? [],
    [dashboard],
  );
  const leaderboard = useMemo(
    () => dashboard?.monthlyLeaderboard ?? [],
    [dashboard],
  );
  const routines = useMemo(() => dashboard?.routines ?? [], [dashboard]);
  const exerciseCatalog = useMemo(
    () => dashboard?.exerciseCatalog ?? [],
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
  const balanceDueMembers = useMemo(
    () => members.filter((m) => (m.balanceDuePaise ?? 0) > 0),
    [members],
  );
  const activeMembersCount = useMemo(
    () =>
      members.filter(
        (m) =>
          m.effectiveStatus === 'active' ||
          m.effectiveStatus === 'expiring_soon' ||
          m.effectiveStatus === 'frozen',
      ).length,
    [members],
  );

  const filteredMembers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return members;
    return members.filter(
      (m) =>
        m.fullName.toLowerCase().includes(q) ||
        m.phone.includes(q) ||
        m.memberCode.toLowerCase().includes(q) ||
        (m.ptTrainerName ?? '').toLowerCase().includes(q),
    );
  }, [members, searchQuery]);

  const maxWeeklyPaise = useMemo(() => {
    const maxVal = weeklyChart.reduce(
      (mx, b) => Math.max(mx, b.thisMonthPaise, b.lastMonthPaise),
      0,
    );
    return Math.max(100000, maxVal);
  }, [weeklyChart]);

  const alertCount =
    pendingApprovals.length + balanceDueMembers.length + expiringSoon.length;

  function openApprovalDialog(member: GymMember, action: 'approve' | 'renew') {
    const plan =
      dashboard?.config.plans.find((p) => p.id === member.planId) ??
      dashboard?.config.plans[0];
    setAppPlanId(plan?.id ?? member.planId);
    setAppPaidRupees(String(Math.round((plan?.pricePaise ?? member.feePaise) / 100)));
    setAppDueDate('');
    setAppPayMethod('upi');
    setAppPtTrainerId(member.ptTrainerId ?? '');
    setAppPtSessions('0');
    setAppPtFeeRupees('0');
    setApprovalModal({ member, action });
  }

  async function handleConfirmApproval(e: FormEvent) {
    e.preventDefault();
    if (!approvalModal || !dashboard) return;
    setSubmittingApproval(true);
    setErrorMsg(null);
    try {
      const selectedPlan = dashboard.config.plans.find((p) => p.id === appPlanId);
      const planFeePaise = selectedPlan?.pricePaise ?? approvalModal.member.feePaise;
      const ptFeePaise = Math.max(
        0,
        Math.round((Number.parseFloat(appPtFeeRupees) || 0) * 100),
      );
      const ptSessions = Math.max(0, Number.parseInt(appPtSessions, 10) || 0);
      const paidPaise = Math.max(
        0,
        Math.round((Number.parseFloat(appPaidRupees) || 0) * 100),
      );

      await businessRepository.ownerApproveOrRenewGymMember({
        businessId: business.id,
        memberId: approvalModal.member.id,
        action: approvalModal.action,
        planId: appPlanId,
        feePaise: planFeePaise,
        amountPaidPaise: paidPaise,
        balanceDueDate: appDueDate || null,
        ptTrainerId: appPtTrainerId || null,
        ptSessions,
        ptFeePaise,
        paymentMethod: appPayMethod,
      });

      const dueAfter = Math.max(0, planFeePaise + ptFeePaise - paidPaise);
      flashStatus(
        `${approvalModal.action === 'approve' ? 'Activated' : 'Renewed'} ${approvalModal.member.fullName}${dueAfter > 0 ? ` (Balance due: ${formatPriceFromPaise(dueAfter, 'INR')})` : ' — Paid in Full ✓'}`,
      );
      setApprovalModal(null);
      await loadDashboard();
    } catch (err) {
      setErrorMsg((err as Error).message);
    } finally {
      setSubmittingApproval(false);
    }
  }

  async function handleCollectBalance(e: FormEvent) {
    e.preventDefault();
    if (!collectTarget) return;
    const paise = Math.round((Number.parseFloat(collectRupees) || 0) * 100);
    if (paise <= 0) {
      setErrorMsg('Enter an amount greater than ₹0.');
      return;
    }
    setBusyId(collectTarget.id);
    try {
      const updated = await businessRepository.collectGymBalanceDue({
        businessId: business.id,
        memberId: collectTarget.id,
        collectedPaise: paise,
        paymentMethod: collectMethod,
      });
      flashStatus(
        `Collected ${formatPriceFromPaise(paise, 'INR')} from ${updated.fullName}. Remaining balance: ${formatPriceFromPaise(updated.balanceDuePaise ?? 0, 'INR')}.`,
      );
      setCollectTarget(null);
      await loadDashboard();
    } catch (err) {
      setErrorMsg((err as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  async function handleToggleFreeze(member: GymMember) {
    setBusyId(member.id);
    try {
      const action = member.isFrozen ? 'resume' : 'freeze';
      const updated = await businessRepository.toggleGymMembershipFreeze({
        businessId: business.id,
        memberId: member.id,
        action,
      });
      flashStatus(
        action === 'freeze'
          ? `Paused ${updated.fullName}'s membership. Expiry date safely frozen.`
          : `Resumed ${updated.fullName}'s membership! Expiry extended to ${formatIsoDatePretty(updated.endDate)}.`,
      );
      await loadDashboard();
    } catch (err) {
      setErrorMsg((err as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  async function handleAddWalkIn(e: FormEvent) {
    e.preventDefault();
    setAddingWalkIn(true);
    setErrorMsg(null);
    try {
      const created = await businessRepository.submitGymMemberRegistration({
        businessSlug: business.slug,
        fullName: walkInName,
        phone: walkInPhone,
        planId: walkInPlanId,
        fitnessGoal: walkInGoal,
      });
      setShowAddWalkIn(false);
      setWalkInName('');
      setWalkInPhone('');
      await loadDashboard();
      openApprovalDialog(created, 'approve');
    } catch (err) {
      setErrorMsg((err as Error).message);
    } finally {
      setAddingWalkIn(false);
    }
  }

  async function handleAddTrainer(e: FormEvent) {
    e.preventDefault();
    setSavingTrainer(true);
    setErrorMsg(null);
    try {
      const created = await businessRepository.createGymTrainer(business.id, {
        trainerName,
        specialty: trainerSpecialty,
        commissionPercent: Number.parseFloat(trainerCommission) || 50,
      });
      setTrainerName('');
      flashStatus(
        `Added Coach ${created.trainerName} (${created.commissionPercent}% commission).`,
      );
      await loadDashboard();
    } catch (err) {
      setErrorMsg((err as Error).message);
    } finally {
      setSavingTrainer(false);
    }
  }

  async function handleQuickRetailSale(productId: string) {
    setBusyId(productId);
    try {
      const res = await businessRepository.recordGymRetailSale({
        businessId: business.id,
        productId,
        quantity: 1,
        paymentMethod: retailMethod,
      });
      flashStatus(
        `Sold 1× ${res.sale.productName} (${formatPriceFromPaise(res.sale.totalPaise, 'INR')} ${res.sale.paymentMethod.toUpperCase()}) · ${res.product.stockQty} left`,
      );
      await loadDashboard();
    } catch (err) {
      setErrorMsg((err as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  async function handleAddRetailProduct(e: FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    try {
      await businessRepository.createGymRetailProduct(business.id, {
        productName: prodName,
        pricePaise: Math.round((Number.parseFloat(prodPriceRupees) || 0) * 100),
        stockQty: Number.parseInt(prodStock, 10) || 50,
      });
      setProdName('');
      flashStatus('Added product to Supplement Bar POS.');
      await loadDashboard();
    } catch (err) {
      setErrorMsg((err as Error).message);
    }
  }

  async function handleSeedSupplements() {
    setBusyId('seed-retail');
    try {
      await businessRepository.seedGymRetailStarterProducts(business.id);
      flashStatus('Loaded 4 starter Supplement Bar products!');
      await loadDashboard();
    } catch (err) {
      setErrorMsg((err as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  async function handleClonePresetRoutine(presetKey: string) {
    const preset = GYM_TRAINER_ROUTINE_PRESETS.find((p) => p.key === presetKey);
    if (!preset) return;
    setBusyId(`preset-${presetKey}`);
    try {
      const saved = await businessRepository.createOrAssignGymRoutine({
        businessId: business.id,
        routineName: preset.routineName,
        targetGoal: preset.targetGoal,
        exercises: preset.exercises,
        assignToMemberId: routineAssignMemberId || null,
      });
      flashStatus(
        `Saved routine "${saved.routineName}"${routineAssignMemberId ? ' and assigned to member!' : '!'}`,
      );
      await loadDashboard();
    } catch (err) {
      setErrorMsg((err as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  async function handleAssignRoutine(memberId: string, routineId: string) {
    setBusyId(memberId);
    try {
      await businessRepository.assignGymRoutineToMember({
        businessId: business.id,
        memberId,
        routineId: routineId || null,
      });
      flashStatus('Updated member workout routine assignment.');
      await loadDashboard();
    } catch (err) {
      setErrorMsg((err as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  async function handleAddCustomExercise(e: FormEvent) {
    e.preventDefault();
    try {
      const created = await businessRepository.createGymCustomExercise(
        business.id,
        {
          name: customExName,
          muscleGroup: customExMuscle,
          equipment: customExEquip,
        },
      );
      setCustomExName('');
      flashStatus(`Added custom exercise "${created.name}" to gym catalog.`);
      await loadDashboard();
    } catch (err) {
      setErrorMsg((err as Error).message);
    }
  }

  async function handleOpenProgressDrawer(memberId: string) {
    setProgressMemberId(memberId);
    setMemberProgress(null);
    setWorkoutSummary(null);
    setLoadingProgress(true);
    try {
      const [hist, summary] = await Promise.all([
        businessRepository.getGymMemberProgressHistory({
          businessId: business.id,
          memberId,
          monthKey: selectedMonthKey,
        }),
        businessRepository.getGymMemberWorkoutSummary({
          businessId: business.id,
          memberId,
        }),
      ]);
      setMemberProgress(hist);
      setWorkoutSummary(summary);
      setNotesDraft(hist.member.trainerNotes ?? '');
    } catch (err) {
      setErrorMsg((err as Error).message);
      setProgressMemberId(null);
    } finally {
      setLoadingProgress(false);
    }
  }

  async function handleSaveCoachNotes(e: FormEvent) {
    e.preventDefault();
    if (!progressMemberId) return;
    setSavingNotes(true);
    try {
      await businessRepository.ownerUpdateGymMemberProfile({
        businessId: business.id,
        memberId: progressMemberId,
        trainerNotes: notesDraft,
      });
      flashStatus('Saved trainer notes.');
      await handleOpenProgressDrawer(progressMemberId);
      await loadDashboard();
    } catch (err) {
      setErrorMsg((err as Error).message);
    } finally {
      setSavingNotes(false);
    }
  }

  if (loading && !dashboard) {
    return (
      <div className="py-16 text-center text-[13.5px] font-semibold text-slate-500">
        Loading GymOS Command Center…
      </div>
    );
  }

  const totalPendingDuesPaise = dashboard?.totalBalanceDuePaise ?? 0;

  return (
    <div className="space-y-5">
      {/* TOP GLOBAL SEARCH (CTRL+K), ALERT BELL & MONTH BAR */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 pb-4">
        <div className="relative flex-1 max-w-md">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
            aria-hidden
          />
          <input
            ref={searchInputRef}
            type="search"
            placeholder="Search members, phone, code, or trainer... (Ctrl+K)"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              if (e.target.value.trim() && activeSection === 'dashboard') {
                onSectionChange?.('members');
              }
            }}
            className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-[13px] text-[#0F1115] placeholder:text-slate-400 focus:border-[#0F1115] focus:outline-none"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            type="month"
            aria-label="Filter revenue month"
            value={selectedMonthKey}
            onChange={(e) => setSelectedMonthKey(e.target.value)}
            className="h-9.5 rounded-xl border border-slate-200 bg-white px-3 text-[12.5px] font-semibold text-[#0F1115]"
          />
          <button
            type="button"
            onClick={() => onSectionChange?.('dues')}
            className="relative inline-flex h-9.5 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-[12.5px] font-semibold text-[#0F1115] hover:bg-slate-50 cursor-pointer"
            title="Pending Approvals, Dues & Renewals"
          >
            <Bell className="h-4 w-4" aria-hidden />
            {alertCount > 0 && (
              <span className="rounded-full bg-rose-600 px-1.5 py-0.5 text-[10px] font-black text-white tabular-nums">
                {alertCount}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setShowAddWalkIn(true)}
            className="inline-flex h-9.5 items-center gap-1.5 rounded-xl bg-[#0F1115] px-3.5 text-[12.5px] font-bold text-[#C8F135] hover:bg-slate-800 cursor-pointer"
          >
            <UserPlus className="h-3.5 w-3.5" aria-hidden /> Add Member
          </button>
          <button
            type="button"
            onClick={() => void loadDashboard()}
            className="inline-flex h-9.5 w-9.5 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 cursor-pointer"
            title="Refresh live data"
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden />
          </button>
        </div>
      </div>

      {/* FEEDBACK BANNERS */}
      {statusMsg && (
        <div
          role="status"
          className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-[13px] font-semibold text-emerald-900 flex items-center justify-between"
        >
          <span className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden />
            {statusMsg}
          </span>
          <button
            type="button"
            onClick={() => setStatusMsg(null)}
            className="text-emerald-700 cursor-pointer"
          >
            <X className="h-3.5 w-3.5" aria-hidden />
          </button>
        </div>
      )}
      {errorMsg && (
        <div
          role="alert"
          className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-[13px] font-medium text-rose-800 flex items-center justify-between"
        >
          <span>{errorMsg}</span>
          <button
            type="button"
            onClick={() => setErrorMsg(null)}
            className="text-rose-600 cursor-pointer"
          >
            <X className="h-3.5 w-3.5" aria-hidden />
          </button>
        </div>
      )}

      {/* ==================== SECTION 1: DASHBOARD COMMAND OVERVIEW ==================== */}
      {activeSection === 'dashboard' && (
        <div className="space-y-5">
          {/* 4 ICON-BADGED HERO KPI CARDS (MATCHING REFERENCE MOCKUP) */}
          <div className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 flex items-center gap-3.5">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#0F1115] text-[#C8F135]">
                <Users className="h-5 w-5" aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="text-[11.5px] font-semibold text-slate-500">
                  Active Members
                </p>
                <p className="text-[22px] font-black text-[#0F1115] tabular-nums">
                  {activeMembersCount}
                </p>
                <p className="text-[11px] font-semibold text-emerald-600">
                  {pendingApprovals.length} pending approval
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-lime-200 bg-lime-50/40 p-4 flex items-center gap-3.5">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#C8F135] text-[#0F1115]">
                <IndianRupee className="h-5 w-5" aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="text-[11.5px] font-semibold text-slate-600">
                  Monthly Revenue
                </p>
                <p className="text-[22px] font-black text-[#0F1115] tabular-nums">
                  {formatPriceFromPaise(
                    dashboard?.monthlyRevenuePaise ?? 0,
                    'INR',
                  )}
                </p>
                <p className="text-[11px] font-medium text-slate-500 truncate">
                  Plans{' '}
                  {formatPriceFromPaise(
                    dashboard?.membershipRevenuePaise ?? 0,
                    'INR',
                  )}{' '}
                  · Bar{' '}
                  {formatPriceFromPaise(
                    dashboard?.retailRevenuePaise ?? 0,
                    'INR',
                  )}
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-indigo-200/70 bg-indigo-50/40 p-4 flex items-center gap-3.5">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white">
                <Activity className="h-5 w-5" aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="text-[11.5px] font-semibold text-slate-600">
                  Attendance Today
                </p>
                <p className="text-[22px] font-black text-[#0F1115] tabular-nums">
                  {dashboard?.checkedInTodayCount ?? 0}
                </p>
                <p className="text-[11px] font-medium text-indigo-700">
                  Single static Entrance QR
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-4 flex items-center gap-3.5">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-500 text-white">
                <AlertCircle className="h-5 w-5" aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="text-[11.5px] font-semibold text-slate-600">
                  Pending Dues &amp; Renewals
                </p>
                <p className="text-[22px] font-black text-[#0F1115] tabular-nums">
                  {formatPriceFromPaise(totalPendingDuesPaise, 'INR')}
                </p>
                <p className="text-[11px] font-semibold text-amber-800">
                  {balanceDueMembers.length} dues · {expiringSoon.length} renew
                  ≤3d
                </p>
              </div>
            </div>
          </div>

          {/* MAIN TWO-COLUMN COMMAND GRID */}
          <div className="grid gap-5 lg:grid-cols-12">
            {/* LEFT 8 COLS: REVENUE OVERVIEW BAR CHART + ACTION QUEUES */}
            <div className="lg:col-span-8 space-y-5">
              {/* WEEK 1 - 4 REVENUE COMPARISON GROUPED BAR CHART */}
              <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h2 className="text-[15.5px] font-extrabold text-[#0F1115]">
                      Revenue Overview ({selectedMonthKey})
                    </h2>
                    <p className="text-[12px] text-slate-500">
                      Combined Membership, PT &amp; Supplement Bar collections ·
                      Projected next 30d:{' '}
                      <strong className="text-[#0F1115]">
                        {formatPriceFromPaise(
                          dashboard?.projectedNextMonthRevenuePaise ?? 0,
                          'INR',
                        )}
                      </strong>
                    </p>
                  </div>
                  <div className="flex items-center gap-3 text-[11.5px] font-bold">
                    <span className="inline-flex items-center gap-1.5 text-[#0F1115]">
                      <span className="h-2.5 w-2.5 rounded-full bg-[#C8F135] border border-[#0F1115]/20" />
                      This Month
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-slate-500">
                      <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
                      Last Month
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-4 items-end h-44 pt-4 border-t border-slate-100">
                  {(weeklyChart.length > 0
                    ? weeklyChart
                    : [1, 2, 3, 4].map((w) => ({
                        weekIndex: w,
                        label: `Week ${w}`,
                        thisMonthPaise: 0,
                        lastMonthPaise: 0,
                      }))
                  ).map((wk) => {
                    const thisPct = Math.max(
                      6,
                      Math.round((wk.thisMonthPaise / maxWeeklyPaise) * 100),
                    );
                    const lastPct = Math.max(
                      6,
                      Math.round((wk.lastMonthPaise / maxWeeklyPaise) * 100),
                    );
                    return (
                      <div
                        key={wk.weekIndex}
                        className="flex flex-col items-center gap-2 h-full justify-end"
                      >
                        <div className="flex items-end justify-center gap-2 w-full h-32">
                          <div
                            className="w-6 sm:w-8 rounded-t-lg bg-[#C8F135] border border-[#0F1115]/15 transition-all"
                            style={{ height: `${thisPct}%` }}
                            title={`This Month ${wk.label}: ${formatPriceFromPaise(wk.thisMonthPaise, 'INR')}`}
                          />
                          <div
                            className="w-6 sm:w-8 rounded-t-lg bg-slate-200 transition-all"
                            style={{ height: `${lastPct}%` }}
                            title={`Last Month ${wk.label}: ${formatPriceFromPaise(wk.lastMonthPaise, 'INR')}`}
                          />
                        </div>
                        <div className="text-center">
                          <p className="text-[11.5px] font-bold text-slate-600">
                            {wk.label}
                          </p>
                          <p className="text-[10.5px] font-semibold text-slate-400 tabular-nums">
                            {formatPriceFromPaise(wk.thisMonthPaise, 'INR')}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* PENDING APPROVALS + INSTALLMENT DUES + 3-DAY RENEWAL RADAR */}
              <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
                <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
                  <h2 className="text-[14.5px] font-extrabold text-[#0F1115]">
                    Action Required Today
                  </h2>
                  <button
                    type="button"
                    onClick={() => onSectionChange?.('members')}
                    className="text-[12px] font-bold text-slate-500 hover:text-[#0F1115] cursor-pointer"
                  >
                    View All Members ({members.length}) →
                  </button>
                </div>

                {pendingApprovals.length === 0 &&
                balanceDueMembers.length === 0 &&
                expiringSoon.length === 0 ? (
                  <div className="p-8 text-center text-[13px] text-slate-500">
                    All approvals, installment balances, and 3-day renewals are
                    caught up!
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {pendingApprovals.map((m) => (
                      <div
                        key={m.id}
                        className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-[13.5px] font-extrabold text-[#0F1115]">
                              {m.fullName}
                            </span>
                            <span className="rounded-md bg-amber-100 px-2 py-0.5 text-[10.5px] font-bold text-amber-900">
                              Pending Payment
                            </span>
                          </div>
                          <p className="text-[12px] text-slate-500">
                            {m.memberCode} · {m.planName} (
                            {formatPriceFromPaise(m.feePaise, 'INR')}) ·{' '}
                            {m.phone}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => openApprovalDialog(m, 'approve')}
                          className="h-8.5 rounded-xl bg-[#C8F135] px-3.5 text-[12px] font-extrabold text-[#0F1115] hover:bg-[#b8e028] cursor-pointer"
                        >
                          Approve / Installment ✓
                        </button>
                      </div>
                    ))}

                    {balanceDueMembers.map((m) => (
                      <div
                        key={`due-${m.id}`}
                        className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 bg-amber-50/30"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-[13.5px] font-extrabold text-[#0F1115]">
                              {m.fullName}
                            </span>
                            <span className="rounded-md bg-rose-100 px-2 py-0.5 text-[10.5px] font-bold text-rose-800">
                              Due:{' '}
                              {formatPriceFromPaise(
                                m.balanceDuePaise ?? 0,
                                'INR',
                              )}
                            </span>
                          </div>
                          <p className="text-[12px] text-slate-500">
                            Paid{' '}
                            {formatPriceFromPaise(m.amountPaidPaise ?? 0, 'INR')}{' '}
                            of{' '}
                            {formatPriceFromPaise(
                              m.totalPlanAmountPaise ?? m.feePaise,
                              'INR',
                            )}
                            {m.balanceDueDate
                              ? ` · Due ${formatIsoDatePretty(m.balanceDueDate)}`
                              : ''}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <a
                            href={getGymBalanceDueWhatsAppLink(business.name, m)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex h-8.5 items-center gap-1 rounded-xl border border-slate-200 bg-white px-2.5 text-[11.5px] font-bold text-emerald-700 hover:bg-emerald-50"
                          >
                            <MessageCircle className="h-3.5 w-3.5" aria-hidden />
                            Remind
                          </a>
                          <button
                            type="button"
                            onClick={() => {
                              setCollectTarget(m);
                              setCollectRupees(
                                String(Math.round((m.balanceDuePaise ?? 0) / 100)),
                              );
                            }}
                            className="h-8.5 rounded-xl bg-[#0F1115] px-3 text-[12px] font-bold text-[#C8F135] cursor-pointer"
                          >
                            Collect Balance ✓
                          </button>
                        </div>
                      </div>
                    ))}

                    {expiringSoon.map((m) => (
                      <div
                        key={`exp-${m.id}`}
                        className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-[13.5px] font-extrabold text-[#0F1115]">
                              {m.fullName}
                            </span>
                            <span className="rounded-md bg-orange-100 px-2 py-0.5 text-[10.5px] font-bold text-orange-900">
                              Expires in {m.daysRemaining}d
                            </span>
                          </div>
                          <p className="text-[12px] text-slate-500">
                            {m.planName} · Ends {formatIsoDatePretty(m.endDate)}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <a
                            href={getGymRenewalWhatsAppLink(business.name, m)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex h-8.5 items-center gap-1 rounded-xl border border-slate-200 bg-white px-2.5 text-[11.5px] font-bold text-emerald-700"
                          >
                            <MessageCircle className="h-3.5 w-3.5" aria-hidden />
                            WhatsApp
                          </a>
                          <button
                            type="button"
                            onClick={() => openApprovalDialog(m, 'renew')}
                            className="h-8.5 rounded-xl bg-[#0F1115] px-3 text-[12px] font-bold text-[#C8F135] cursor-pointer"
                          >
                            Renew Plan
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* RIGHT 4 COLS: 2-SECOND SUPPLEMENT BAR POS + TODAY'S CHECK-INS & STREAKS */}
            <div className="lg:col-span-4 space-y-5">
              {/* Quick Supplement & Protein Bar POS */}
              <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-[14px] font-extrabold text-[#0F1115] flex items-center gap-1.5">
                    <ShoppingBag className="h-4 w-4 text-[#0F1115]" aria-hidden />
                    Quick Supplement Bar
                  </h2>
                  <div className="inline-flex rounded-lg border border-slate-200 p-0.5 text-[11px] font-bold">
                    <button
                      type="button"
                      onClick={() => setRetailMethod('upi')}
                      className={`rounded-md px-2 py-0.5 cursor-pointer ${retailMethod === 'upi' ? 'bg-[#0F1115] text-[#C8F135]' : 'text-slate-500'}`}
                    >
                      UPI
                    </button>
                    <button
                      type="button"
                      onClick={() => setRetailMethod('cash')}
                      className={`rounded-md px-2 py-0.5 cursor-pointer ${retailMethod === 'cash' ? 'bg-[#0F1115] text-[#C8F135]' : 'text-slate-500'}`}
                    >
                      Cash
                    </button>
                  </div>
                </div>

                {retailProducts.length === 0 ? (
                  <button
                    type="button"
                    onClick={() => void handleSeedSupplements()}
                    className="h-10 w-full rounded-xl bg-[#C8F135] text-[12.5px] font-extrabold text-[#0F1115] cursor-pointer"
                  >
                    + Load 4 Starter Products (Whey, Water, Bars)
                  </button>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    {retailProducts.slice(0, 6).map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        disabled={busyId === p.id || p.stockQty <= 0}
                        onClick={() => void handleQuickRetailSale(p.id)}
                        className="rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-left hover:border-[#0F1115] hover:bg-[#C8F135]/20 transition-colors disabled:opacity-50 cursor-pointer"
                      >
                        <p className="truncate text-[12px] font-extrabold text-[#0F1115]">
                          + {p.productName}
                        </p>
                        <div className="mt-1 flex items-center justify-between text-[11px]">
                          <span className="font-black text-emerald-700 tabular-nums">
                            {formatPriceFromPaise(p.pricePaise, 'INR')}
                          </span>
                          <span className="text-slate-400 tabular-nums">
                            {p.stockQty} left
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Today's Live Check-Ins & Top Streaks */}
              <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-[14px] font-extrabold text-[#0F1115]">
                    Checked In Today ({dashboard?.todaysAttendance.length ?? 0})
                  </h2>
                  {isBusinessLive && (
                    <a
                      href={gymPortalUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[11.5px] font-bold text-slate-500 hover:text-[#0F1115]"
                    >
                      Member App <ExternalLink className="h-3 w-3" aria-hidden />
                    </a>
                  )}
                </div>

                {(dashboard?.todaysAttendance ?? []).length === 0 ? (
                  <p className="text-[12.5px] text-slate-500">
                    Waiting for today&apos;s first Entrance QR check-in.
                  </p>
                ) : (
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {(dashboard?.todaysAttendance ?? []).slice(0, 8).map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => void handleOpenProgressDrawer(c.memberId)}
                        className="flex w-full items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-left hover:bg-slate-100 cursor-pointer"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-[12.5px] font-bold text-[#0F1115]">
                            {c.fullName}
                          </p>
                          <p className="text-[11px] text-slate-500">
                            {getWorkoutFocusMeta(c.workoutFocus).dayLabel} ·{' '}
                            {formatCheckInTime12h(c.checkedInAt)}
                          </p>
                        </div>
                        <span className="rounded-md bg-[#0F1115] px-2 py-0.5 text-[10.5px] font-bold text-[#C8F135]">
                          {c.daysAttendedThisMonth}d/mo
                        </span>
                      </button>
                    ))}
                  </div>
                )}

                {leaderboard.length > 0 && (
                  <div className="border-t border-slate-100 pt-3 space-y-1.5">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                      <Flame className="h-3.5 w-3.5 text-orange-500" aria-hidden />
                      Top Monthly Streaks
                    </p>
                    {leaderboard.slice(0, 3).map((lb) => (
                      <div
                        key={lb.memberCode}
                        className="flex items-center justify-between text-[12px]"
                      >
                        <span className="font-bold text-[#0F1115]">
                          #{lb.rank} {lb.displayName}
                        </span>
                        <span className="font-bold text-orange-600 tabular-nums">
                          {lb.workoutsThisMonth}d · 🔥{lb.currentStreakDays}d
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================== SECTION 2: FULL MEMBERS DIRECTORY ==================== */}
      {activeSection === 'members' && (
        <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-5 py-3.5">
            <div>
              <h2 className="text-[16px] font-extrabold text-[#0F1115]">
                All Gym Members ({filteredMembers.length})
              </h2>
              <p className="text-[12px] text-slate-500">
                Approve plans with installments/PT, freeze memberships, assign
                workout routines, and inspect Strength PRs.
              </p>
            </div>
          </div>

          <div className="divide-y divide-slate-100">
            {filteredMembers.map((m) => {
              const due = m.balanceDuePaise ?? 0;
              const isFrozen = Boolean(m.isFrozen);
              return (
                <div
                  key={m.id}
                  className="flex flex-col gap-3 px-5 py-4 lg:flex-row lg:items-center lg:justify-between hover:bg-slate-50/70"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[14px] font-extrabold text-[#0F1115]">
                        {m.fullName}
                      </span>
                      <span className="font-mono text-[11px] font-bold text-slate-400">
                        {m.memberCode}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10.5px] font-bold ${
                          isFrozen
                            ? 'bg-sky-100 text-sky-900'
                            : m.effectiveStatus === 'active'
                              ? 'bg-emerald-100 text-emerald-900'
                              : m.effectiveStatus === 'expiring_soon'
                                ? 'bg-orange-100 text-orange-900'
                                : m.effectiveStatus === 'pending_approval'
                                  ? 'bg-amber-100 text-amber-900'
                                  : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {isFrozen ? 'Frozen' : m.effectiveStatus.replace('_', ' ')}
                      </span>
                      {due > 0 && (
                        <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10.5px] font-bold text-rose-800">
                          Due {formatPriceFromPaise(due, 'INR')}
                        </span>
                      )}
                      {(m.ptRemainingSessions ?? 0) > 0 && (
                        <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10.5px] font-bold text-indigo-900">
                          PT: {m.ptRemainingSessions} left
                          {m.ptTrainerName ? ` (${m.ptTrainerName})` : ''}
                        </span>
                      )}
                    </div>
                    <p className="text-[12px] text-slate-500">
                      {m.phone} · {m.planName} ·{' '}
                      {m.endDate
                        ? `Ends ${formatIsoDatePretty(m.endDate)} (${m.daysRemaining}d left)`
                        : 'Not started'}{' '}
                      · 🔥 {m.currentStreakDays ?? 0}d streak
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    {routines.length > 0 && m.status === 'active' && (
                      <select
                        aria-label={`Assign workout routine for ${m.fullName}`}
                        value={m.assignedRoutineId ?? ''}
                        onChange={(e) =>
                          void handleAssignRoutine(m.id, e.target.value)
                        }
                        className="h-8.5 rounded-lg border border-slate-200 bg-white px-2 text-[11.5px] font-semibold text-slate-700"
                      >
                        <option value="">Assign Routine…</option>
                        {routines.map((rt) => (
                          <option key={rt.id} value={rt.id}>
                            {rt.routineName}
                          </option>
                        ))}
                      </select>
                    )}

                    {m.status === 'pending_approval' ? (
                      <button
                        type="button"
                        onClick={() => openApprovalDialog(m, 'approve')}
                        className="h-8.5 rounded-lg bg-[#C8F135] px-3 text-[12px] font-extrabold text-[#0F1115] cursor-pointer"
                      >
                        Approve ✓
                      </button>
                    ) : (
                      <>
                        {due > 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              setCollectTarget(m);
                              setCollectRupees(String(Math.round(due / 100)));
                            }}
                            className="h-8.5 rounded-lg bg-amber-500 px-2.5 text-[11.5px] font-bold text-white cursor-pointer"
                          >
                            Collect Due
                          </button>
                        )}
                        {m.status === 'active' && (
                          <button
                            type="button"
                            disabled={busyId === m.id}
                            onClick={() => void handleToggleFreeze(m)}
                            className="inline-flex h-8.5 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 text-[11.5px] font-bold text-slate-700 hover:bg-slate-100 cursor-pointer"
                          >
                            {isFrozen ? (
                              <>
                                <Play className="h-3 w-3 text-emerald-600" aria-hidden />
                                Resume
                              </>
                            ) : (
                              <>
                                <Snowflake className="h-3 w-3 text-sky-600" aria-hidden />
                                Freeze
                              </>
                            )}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => openApprovalDialog(m, 'renew')}
                          className="h-8.5 rounded-lg bg-[#0F1115] px-2.5 text-[11.5px] font-bold text-[#C8F135] cursor-pointer"
                        >
                          Renew / PT
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleOpenProgressDrawer(m.id)}
                          className="h-8.5 rounded-lg border border-slate-200 bg-white px-2.5 text-[11.5px] font-bold text-[#0F1115] hover:bg-slate-100 cursor-pointer"
                        >
                          Progress
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ==================== SECTION 3: PT & TRAINER COMMISSIONS ==================== */}
      {activeSection === 'trainers' && (
        <div className="grid gap-5 lg:grid-cols-12">
          <form
            onSubmit={(e) => void handleAddTrainer(e)}
            className="lg:col-span-4 rounded-2xl border border-slate-200 bg-white p-5 space-y-3 h-fit"
          >
            <h2 className="text-[15.5px] font-extrabold text-[#0F1115] flex items-center gap-2">
              <Award className="h-4.5 w-4.5 text-[#0F1115]" aria-hidden />
              Add Personal Trainer
            </h2>
            <div className="space-y-1">
              <label className="text-[12px] font-bold text-slate-700">
                Trainer Name *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Coach Ravi"
                value={trainerName}
                onChange={(e) => setTrainerName(e.target.value)}
                className="h-10 w-full rounded-xl border border-slate-300 px-3 text-[13px]"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[12px] font-bold text-slate-700">
                Specialty
              </label>
              <input
                type="text"
                value={trainerSpecialty}
                onChange={(e) => setTrainerSpecialty(e.target.value)}
                className="h-10 w-full rounded-xl border border-slate-300 px-3 text-[13px]"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[12px] font-bold text-slate-700">
                Commission % (0–100)
              </label>
              <input
                type="number"
                min={0}
                max={100}
                step="1"
                value={trainerCommission}
                onChange={(e) => setTrainerCommission(e.target.value)}
                className="h-10 w-full rounded-xl border border-slate-300 px-3 text-[13px] font-bold"
              />
            </div>
            <button
              type="submit"
              disabled={savingTrainer}
              className="h-10 w-full rounded-xl bg-[#0F1115] text-[13px] font-extrabold text-[#C8F135] cursor-pointer"
            >
              {savingTrainer ? 'Saving…' : '+ Add Personal Trainer'}
            </button>
          </form>

          <div className="lg:col-span-8 rounded-2xl border border-slate-200 bg-white overflow-hidden">
            <div className="border-b border-slate-100 px-5 py-3.5">
              <h2 className="text-[15.5px] font-extrabold text-[#0F1115]">
                Trainer PT Sessions &amp; Commission Payouts ({selectedMonthKey})
              </h2>
            </div>
            {trainers.length === 0 ? (
              <div className="p-10 text-center text-[13px] text-slate-500">
                Add your Personal Trainers on the left to track PT clients,
                session deductions, and monthly commission payouts.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {trainers.map((t) => (
                  <div
                    key={t.id}
                    className="flex flex-wrap items-center justify-between gap-4 px-5 py-4"
                  >
                    <div>
                      <p className="text-[14.5px] font-extrabold text-[#0F1115]">
                        {t.trainerName}{' '}
                        <span className="ml-1 rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-600">
                          {t.commissionPercent}% Share
                        </span>
                      </p>
                      <p className="text-[12px] text-slate-500">
                        {t.specialty} · {t.activePtClients} active PT clients ·{' '}
                        <strong>{t.ptSessionsDeliveredThisMonth}</strong> PT
                        sessions this month
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="text-[11px] font-semibold text-slate-400">
                          Commission Payout
                        </p>
                        <p className="text-[16px] font-black text-emerald-700 tabular-nums">
                          {formatPriceFromPaise(t.commissionPayoutPaise, 'INR')}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={async () => {
                          await businessRepository.deleteGymTrainer(
                            business.id,
                            t.id,
                          );
                          await loadDashboard();
                        }}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 cursor-pointer"
                        title="Remove trainer"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==================== SECTION 4: PAYMENTS & DUES ==================== */}
      {activeSection === 'dues' && (
        <div className="space-y-5">
          <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
            <div className="border-b border-slate-100 px-5 py-3.5 flex items-center justify-between">
              <h2 className="text-[15.5px] font-extrabold text-[#0F1115]">
                Pending Installment Balance Dues ({balanceDueMembers.length})
              </h2>
              <span className="text-[14px] font-black text-rose-700 tabular-nums">
                Total Due: {formatPriceFromPaise(totalPendingDuesPaise, 'INR')}
              </span>
            </div>
            {balanceDueMembers.length === 0 ? (
              <p className="p-8 text-center text-[13px] text-slate-500">
                Zero unpaid installment balances!
              </p>
            ) : (
              <div className="divide-y divide-slate-100">
                {balanceDueMembers.map((m) => (
                  <div
                    key={m.id}
                    className="flex flex-wrap items-center justify-between gap-3 px-5 py-4"
                  >
                    <div>
                      <p className="text-[14px] font-extrabold text-[#0F1115]">
                        {m.fullName} ({m.memberCode})
                      </p>
                      <p className="text-[12px] text-slate-500">
                        Paid {formatPriceFromPaise(m.amountPaidPaise ?? 0, 'INR')}{' '}
                        · Remaining{' '}
                        <strong className="text-rose-700">
                          {formatPriceFromPaise(m.balanceDuePaise ?? 0, 'INR')}
                        </strong>
                        {m.balanceDueDate
                          ? ` · Due ${formatIsoDatePretty(m.balanceDueDate)}`
                          : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <a
                        href={getGymBalanceDueWhatsAppLink(business.name, m)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex h-9 items-center gap-1 rounded-xl border border-slate-200 px-3 text-[12px] font-bold text-emerald-700"
                      >
                        <MessageCircle className="h-3.5 w-3.5" aria-hidden />
                        WhatsApp
                      </a>
                      <button
                        type="button"
                        onClick={() => {
                          setCollectTarget(m);
                          setCollectRupees(
                            String(Math.round((m.balanceDuePaise ?? 0) / 100)),
                          );
                        }}
                        className="h-9 rounded-xl bg-[#C8F135] px-3.5 text-[12px] font-extrabold text-[#0F1115] cursor-pointer"
                      >
                        Collect Balance ✓
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==================== SECTION 5: SUPPLEMENT BAR POS ==================== */}
      {activeSection === 'supplements' && (
        <div className="grid gap-5 lg:grid-cols-12">
          <div className="lg:col-span-5 space-y-4">
            <form
              onSubmit={(e) => void handleAddRetailProduct(e)}
              className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-[15px] font-extrabold text-[#0F1115]">
                  Add Supplement / Drink
                </h2>
                <button
                  type="button"
                  onClick={() => void handleSeedSupplements()}
                  className="text-[11.5px] font-bold text-indigo-700 hover:underline cursor-pointer"
                >
                  + Load 4 Starters
                </button>
              </div>
              <input
                type="text"
                required
                placeholder="Product Name (e.g. Whey Scoop)"
                value={prodName}
                onChange={(e) => setProdName(e.target.value)}
                className="h-10 w-full rounded-xl border border-slate-300 px-3 text-[13px]"
              />
              <div className="grid grid-cols-2 gap-2.5">
                <input
                  type="number"
                  required
                  placeholder="Price (₹)"
                  value={prodPriceRupees}
                  onChange={(e) => setProdPriceRupees(e.target.value)}
                  className="h-10 rounded-xl border border-slate-300 px-3 text-[13px] font-bold"
                />
                <input
                  type="number"
                  required
                  placeholder="Stock Qty"
                  value={prodStock}
                  onChange={(e) => setProdStock(e.target.value)}
                  className="h-10 rounded-xl border border-slate-300 px-3 text-[13px] font-bold"
                />
              </div>
              <button
                type="submit"
                className="h-10 w-full rounded-xl bg-[#0F1115] text-[13px] font-extrabold text-[#C8F135] cursor-pointer"
              >
                + Save Product
              </button>
            </form>
          </div>

          <div className="lg:col-span-7 space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3">
              <h2 className="text-[15px] font-extrabold text-[#0F1115]">
                1-Tap Counter Sales ({retailProducts.length} items)
              </h2>
              <div className="grid gap-2.5 sm:grid-cols-2">
                {retailProducts.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-3"
                  >
                    <div>
                      <p className="text-[13px] font-extrabold text-[#0F1115]">
                        {p.productName}
                      </p>
                      <p className="text-[11.5px] text-slate-500">
                        {formatPriceFromPaise(p.pricePaise, 'INR')} ·{' '}
                        {p.stockQty} in stock
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={busyId === p.id || p.stockQty <= 0}
                      onClick={() => void handleQuickRetailSale(p.id)}
                      className="h-8.5 rounded-lg bg-[#C8F135] px-3 text-[12px] font-extrabold text-[#0F1115] cursor-pointer"
                    >
                      Sell 1 ✓
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
              <div className="border-b border-slate-100 px-5 py-3">
                <h3 className="text-[14px] font-extrabold text-[#0F1115]">
                  Recent Supplement Bar Sales
                </h3>
              </div>
              <div className="divide-y divide-slate-100 max-h-60 overflow-y-auto">
                {recentRetailSales.map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center justify-between px-5 py-2.5 text-[12.5px]"
                  >
                    <span className="font-bold text-[#0F1115]">
                      {s.quantity}× {s.productName}{' '}
                      <span className="text-slate-400 uppercase text-[10.5px]">
                        ({s.paymentMethod})
                      </span>
                    </span>
                    <span className="font-black text-emerald-700 tabular-nums">
                      {formatPriceFromPaise(s.totalPaise, 'INR')}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================== SECTION 6: WORKOUT PLANS & EXERCISE CATALOG ==================== */}
      {activeSection === 'workouts' && (
        <div className="space-y-5">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-[16px] font-extrabold text-[#0F1115] flex items-center gap-2">
                  <ClipboardList className="h-5 w-5 text-[#0F1115]" aria-hidden />
                  1-Tap Trainer Routine Templates
                </h2>
                <p className="text-[12.5px] text-slate-500">
                  Replace lost paper workout cards — save a template and assign
                  it directly to a member&apos;s phone pass.
                </p>
              </div>
              <select
                aria-label="Optionally assign new template to a member"
                value={routineAssignMemberId}
                onChange={(e) => setRoutineAssignMemberId(e.target.value)}
                className="h-9.5 rounded-xl border border-slate-300 bg-white px-3 text-[12.5px] font-semibold"
              >
                <option value="">Save to Library Only</option>
                {members
                  .filter((m) => m.status === 'active')
                  .map((m) => (
                    <option key={m.id} value={m.id}>
                      Assign to: {m.fullName} ({m.memberCode})
                    </option>
                  ))}
              </select>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              {GYM_TRAINER_ROUTINE_PRESETS.map((preset) => (
                <div
                  key={preset.key}
                  className="rounded-2xl border border-slate-200 bg-[#F8F9FA] p-4 flex flex-col justify-between gap-3"
                >
                  <div>
                    <p className="text-[14px] font-extrabold text-[#0F1115]">
                      {preset.routineName}
                    </p>
                    <p className="mt-1 text-[12px] text-slate-500">
                      {preset.description}
                    </p>
                    <p className="mt-2 text-[11px] font-bold text-slate-600">
                      {preset.exercises.length} exercises across splits
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={busyId === `preset-${preset.key}`}
                    onClick={() => void handleClonePresetRoutine(preset.key)}
                    className="h-9.5 w-full rounded-xl bg-[#0F1115] text-[12px] font-extrabold text-[#C8F135] hover:bg-slate-800 cursor-pointer"
                  >
                    {routineAssignMemberId
                      ? 'Clone & Assign to Member ✓'
                      : '+ Clone Template'}
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-5 lg:grid-cols-12">
            <form
              onSubmit={(e) => void handleAddCustomExercise(e)}
              className="lg:col-span-4 rounded-2xl border border-slate-200 bg-white p-5 space-y-3 h-fit"
            >
              <h3 className="text-[14.5px] font-extrabold text-[#0F1115]">
                Add Custom Gym Exercise
              </h3>
              <input
                type="text"
                required
                placeholder="e.g. Hack Squat Machine"
                value={customExName}
                onChange={(e) => setCustomExName(e.target.value)}
                className="h-9.5 w-full rounded-xl border border-slate-300 px-3 text-[13px]"
              />
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={customExMuscle}
                  onChange={(e) =>
                    setCustomExMuscle(e.target.value as GymCatalogMuscleGroup)
                  }
                  className="h-9.5 rounded-xl border border-slate-300 px-2.5 text-[12.5px] font-semibold"
                >
                  <option value="chest">Chest</option>
                  <option value="back">Back</option>
                  <option value="legs">Legs</option>
                  <option value="shoulders">Shoulders</option>
                  <option value="arms">Arms</option>
                  <option value="core">Core</option>
                  <option value="cardio">Cardio</option>
                  <option value="full_body">Full Body</option>
                </select>
                <select
                  value={customExEquip}
                  onChange={(e) =>
                    setCustomExEquip(e.target.value as GymCatalogEquipment)
                  }
                  className="h-9.5 rounded-xl border border-slate-300 px-2.5 text-[12.5px] font-semibold"
                >
                  <option value="barbell">Barbell</option>
                  <option value="dumbbell">Dumbbell</option>
                  <option value="machine">Machine</option>
                  <option value="cable">Cable</option>
                  <option value="bodyweight">Bodyweight</option>
                  <option value="cardio_machine">Cardio Machine</option>
                </select>
              </div>
              <button
                type="submit"
                className="h-9.5 w-full rounded-xl bg-[#C8F135] text-[12.5px] font-extrabold text-[#0F1115] cursor-pointer"
              >
                + Add to Exercise Catalog
              </button>
            </form>

            <div className="lg:col-span-8 rounded-2xl border border-slate-200 bg-white p-5 space-y-3">
              <h3 className="text-[14.5px] font-extrabold text-[#0F1115]">
                Active Exercise Catalog ({exerciseCatalog.length} Exercises) &amp;
                Saved Routines ({routines.length})
              </h3>
              <div className="flex flex-wrap gap-1.5 max-h-56 overflow-y-auto">
                {exerciseCatalog.map((ex) => (
                  <span
                    key={ex.id}
                    className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11.5px] font-semibold text-[#0F1115]"
                  >
                    {ex.name}{' '}
                    <span className="text-[10px] uppercase text-slate-400">
                      · {ex.muscleGroup}
                    </span>
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PORTALED MODAL: APPROVE / RENEW WITH INSTALLMENTS & OPTIONAL PT PACKAGE */}
      {approvalModal &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-[2px]"
          >
            <form
              onSubmit={(e) => void handleConfirmApproval(e)}
              className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h2 className="text-[16px] font-extrabold text-[#0F1115] capitalize">
                    {approvalModal.action} Plan: {approvalModal.member.fullName}
                  </h2>
                  <p className="text-[12px] text-slate-500">
                    Supports Full Payment, Part-Payment Installments &amp; PT
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setApprovalModal(null)}
                  className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 cursor-pointer"
                >
                  <X className="h-4 w-4" aria-hidden />
                </button>
              </div>

              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-[12px] font-bold text-slate-700">
                    Membership Plan
                  </label>
                  <select
                    value={appPlanId}
                    onChange={(e) => {
                      setAppPlanId(e.target.value);
                      const p = dashboard?.config.plans.find(
                        (x) => x.id === e.target.value,
                      );
                      if (p) setAppPaidRupees(String(Math.round(p.pricePaise / 100)));
                    }}
                    className="h-10 w-full rounded-xl border border-slate-300 px-3 text-[13px] font-semibold"
                  >
                    {(dashboard?.config.plans ?? []).map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} — {formatPriceFromPaise(p.pricePaise, 'INR')} (
                        {p.durationDays}d)
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div className="space-y-1">
                    <label className="text-[12px] font-bold text-slate-700">
                      Amount Paid Today (₹)
                    </label>
                    <input
                      type="number"
                      min={0}
                      required
                      value={appPaidRupees}
                      onChange={(e) => setAppPaidRupees(e.target.value)}
                      className="h-10 w-full rounded-xl border border-slate-300 px-3 text-[13.5px] font-extrabold"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[12px] font-bold text-slate-700">
                      Balance Due Date
                    </label>
                    <input
                      type="date"
                      value={appDueDate}
                      onChange={(e) => setAppDueDate(e.target.value)}
                      className="h-10 w-full rounded-xl border border-slate-300 px-3 text-[12.5px]"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {(['upi', 'cash'] as const).map((pm) => (
                    <button
                      key={pm}
                      type="button"
                      onClick={() => setAppPayMethod(pm)}
                      className={`flex-1 h-9 rounded-xl border text-[12px] font-bold uppercase cursor-pointer ${
                        appPayMethod === pm
                          ? 'border-[#0F1115] bg-[#0F1115] text-[#C8F135]'
                          : 'border-slate-200 bg-slate-50 text-slate-600'
                      }`}
                    >
                      {pm}
                    </button>
                  ))}
                </div>

                {/* Optional PT Assignment */}
                {trainers.length > 0 && (
                  <div className="rounded-xl border border-indigo-200 bg-indigo-50/50 p-3 space-y-2.5">
                    <p className="text-[11.5px] font-extrabold uppercase tracking-wider text-indigo-900">
                      Optional Personal Training (PT) Add-On
                    </p>
                    <select
                      value={appPtTrainerId}
                      onChange={(e) => setAppPtTrainerId(e.target.value)}
                      className="h-9.5 w-full rounded-lg border border-indigo-200 bg-white px-2.5 text-[12.5px] font-semibold"
                    >
                      <option value="">No Personal Trainer</option>
                      {trainers.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.trainerName} ({t.commissionPercent}% share)
                        </option>
                      ))}
                    </select>
                    {appPtTrainerId && (
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="number"
                          min={0}
                          placeholder="PT Sessions (e.g. 24)"
                          value={appPtSessions}
                          onChange={(e) => setAppPtSessions(e.target.value)}
                          className="h-9 rounded-lg border border-indigo-200 bg-white px-2.5 text-[12.5px] font-bold"
                        />
                        <input
                          type="number"
                          min={0}
                          placeholder="PT Fee ₹ (e.g. 8000)"
                          value={appPtFeeRupees}
                          onChange={(e) => setAppPtFeeRupees(e.target.value)}
                          className="h-9 rounded-lg border border-indigo-200 bg-white px-2.5 text-[12.5px] font-bold"
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
                <button
                  type="button"
                  onClick={() => setApprovalModal(null)}
                  className="h-10 rounded-xl border border-slate-200 px-4 text-[13px] font-bold text-slate-600 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingApproval}
                  className="h-10 rounded-xl bg-[#C8F135] px-5 text-[13px] font-extrabold text-[#0F1115] cursor-pointer"
                >
                  {submittingApproval ? 'Saving…' : 'Confirm & Activate ✓'}
                </button>
              </div>
            </form>
          </div>,
          document.body,
        )}

      {/* PORTALED MODAL: COLLECT BALANCE DUE */}
      {collectTarget &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-[2px]"
          >
            <form
              onSubmit={(e) => void handleCollectBalance(e)}
              className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-[16px] font-extrabold text-[#0F1115]">
                  Collect Balance: {collectTarget.fullName}
                </h2>
                <button
                  type="button"
                  onClick={() => setCollectTarget(null)}
                  className="rounded-lg p-1 text-slate-400 cursor-pointer"
                >
                  <X className="h-4 w-4" aria-hidden />
                </button>
              </div>
              <p className="text-[12.5px] text-slate-500">
                Pending Balance:{' '}
                <strong className="text-rose-700">
                  {formatPriceFromPaise(
                    collectTarget.balanceDuePaise ?? 0,
                    'INR',
                  )}
                </strong>
              </p>
              <input
                type="number"
                required
                min={1}
                value={collectRupees}
                onChange={(e) => setCollectRupees(e.target.value)}
                className="h-11 w-full rounded-xl border border-slate-300 px-3 text-[15px] font-black"
              />
              <div className="flex gap-2">
                {(['upi', 'cash'] as const).map((pm) => (
                  <button
                    key={pm}
                    type="button"
                    onClick={() => setCollectMethod(pm)}
                    className={`flex-1 h-9 rounded-xl border text-[12px] font-bold uppercase cursor-pointer ${
                      collectMethod === pm
                        ? 'border-[#0F1115] bg-[#0F1115] text-[#C8F135]'
                        : 'border-slate-200 text-slate-600'
                    }`}
                  >
                    {pm}
                  </button>
                ))}
              </div>
              <button
                type="submit"
                className="h-10.5 w-full rounded-xl bg-[#C8F135] text-[13.5px] font-extrabold text-[#0F1115] cursor-pointer"
              >
                Confirm Payment Received ✓
              </button>
            </form>
          </div>,
          document.body,
        )}

      {/* PORTALED MODAL: ADD WALK-IN MEMBER */}
      {showAddWalkIn &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-[2px]"
          >
            <form
              onSubmit={(e) => void handleAddWalkIn(e)}
              className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl space-y-3.5"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-[16px] font-extrabold text-[#0F1115]">
                  Register Front-Desk Walk-In
                </h2>
                <button
                  type="button"
                  onClick={() => setShowAddWalkIn(false)}
                  className="rounded-lg p-1 text-slate-400 cursor-pointer"
                >
                  <X className="h-4 w-4" aria-hidden />
                </button>
              </div>
              <input
                type="text"
                required
                placeholder="Member Full Name *"
                value={walkInName}
                onChange={(e) => setWalkInName(e.target.value)}
                className="h-10 w-full rounded-xl border border-slate-300 px-3 text-[13px]"
              />
              <input
                type="tel"
                required
                placeholder="10-Digit Mobile Number *"
                value={walkInPhone}
                onChange={(e) => setWalkInPhone(e.target.value)}
                className="h-10 w-full rounded-xl border border-slate-300 px-3 text-[13px]"
              />
              <select
                value={walkInPlanId}
                onChange={(e) => setWalkInPlanId(e.target.value)}
                className="h-10 w-full rounded-xl border border-slate-300 px-3 text-[13px] font-semibold"
              >
                {(dashboard?.config.plans ?? []).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({formatPriceFromPaise(p.pricePaise, 'INR')})
                  </option>
                ))}
              </select>
              <select
                value={walkInGoal}
                onChange={(e) => setWalkInGoal(e.target.value as GymFitnessGoal)}
                className="h-10 w-full rounded-xl border border-slate-300 px-3 text-[13px] font-semibold"
              >
                {GYM_FITNESS_GOAL_OPTIONS.map((g) => (
                  <option key={g.value} value={g.value}>
                    {g.emoji} {g.label}
                  </option>
                ))}
              </select>
              <button
                type="submit"
                disabled={addingWalkIn}
                className="h-10.5 w-full rounded-xl bg-[#0F1115] text-[13.5px] font-extrabold text-[#C8F135] cursor-pointer"
              >
                {addingWalkIn ? 'Creating…' : 'Create & Proceed to Payment →'}
              </button>
            </form>
          </div>,
          document.body,
        )}

      {/* PORTALED DRAWER: MEMBER PROGRESS + STRENGTH PRs + BODY JOURNAL + COACH NOTES */}
      {progressMemberId &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            className="fixed inset-0 z-[100] flex items-center justify-end bg-slate-950/60 backdrop-blur-[2px]"
          >
            <div className="h-full w-full max-w-lg overflow-y-auto bg-white p-6 shadow-2xl space-y-5">
              <div className="flex items-center justify-between border-b border-slate-200 pb-4">
                <div>
                  <h2 className="text-[18px] font-extrabold text-[#0F1115]">
                    {memberProgress?.member.fullName ?? 'Member Progress'}
                  </h2>
                  <p className="text-[12px] text-slate-500">
                    {memberProgress?.member.memberCode} ·{' '}
                    {getFitnessGoalMeta(memberProgress?.member.fitnessGoal).label}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setProgressMemberId(null)}
                  className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 cursor-pointer"
                >
                  <X className="h-5 w-5" aria-hidden />
                </button>
              </div>

              {loadingProgress || !memberProgress ? (
                <p className="py-12 text-center text-[13px] text-slate-500">
                  Loading attendance, Strength PRs &amp; measurements…
                </p>
              ) : (
                <>
                  {/* Strength & Workout Summary (OpenGym Engine) */}
                  <div className="rounded-2xl bg-[#0F1115] p-4 text-white space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[12px] font-bold uppercase tracking-wider text-[#C8F135] flex items-center gap-1.5">
                        <Trophy className="h-4 w-4" aria-hidden />
                        Strength &amp; Workout Logs
                      </span>
                      <span className="text-[13px] font-black text-white tabular-nums">
                        {(workoutSummary?.totalVolumeKg ?? 0).toLocaleString(
                          'en-IN',
                        )}{' '}
                        kg lifted
                      </span>
                    </div>

                    {(workoutSummary?.personalRecords ?? []).length === 0 ? (
                      <p className="text-[12px] text-slate-400">
                        No exercise sets logged yet on their phone pass.
                      </p>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {(workoutSummary?.personalRecords ?? [])
                          .slice(0, 6)
                          .map((pr) => (
                            <span
                              key={pr.exerciseName}
                              className="rounded-lg bg-[#161920] border border-[#C8F135]/30 px-2.5 py-1 text-[11.5px] font-bold text-[#C8F135]"
                            >
                              🏆 {pr.exerciseName}: {pr.bestWeightKg} kg
                            </span>
                          ))}
                      </div>
                    )}
                  </div>

                  {/* Body Measurements */}
                  {(memberProgress.bodyMeasurements ?? []).length > 0 && (
                    <div className="rounded-2xl border border-slate-200 p-4 space-y-2">
                      <h3 className="text-[13.5px] font-extrabold text-[#0F1115] flex items-center gap-1.5">
                        <Scale className="h-4 w-4" aria-hidden />
                        30-Day Body Journal
                      </h3>
                      {(memberProgress.bodyMeasurements ?? [])
                        .slice(0, 4)
                        .map((bm) => (
                          <div
                            key={bm.id}
                            className="flex items-center justify-between text-[12px] bg-slate-50 rounded-lg px-3 py-2"
                          >
                            <span className="font-bold text-[#0F1115]">
                              {bm.weightKg} kg
                              {bm.waistInches ? ` · Waist ${bm.waistInches}"` : ''}
                              {bm.chestInches ? ` · Chest ${bm.chestInches}"` : ''}
                            </span>
                            <span className="text-slate-400">
                              {formatIsoDatePretty(bm.recordedDate)}
                            </span>
                          </div>
                        ))}
                    </div>
                  )}

                  {/* Coach Notes */}
                  <form
                    onSubmit={(e) => void handleSaveCoachNotes(e)}
                    className="space-y-2"
                  >
                    <label className="text-[12.5px] font-extrabold text-[#0F1115]">
                      Trainer / Coach Notes
                    </label>
                    <textarea
                      rows={3}
                      value={notesDraft}
                      onChange={(e) => setNotesDraft(e.target.value)}
                      placeholder="Write diet cues, injury precautions, or progressive overload targets…"
                      className="w-full rounded-xl border border-slate-300 p-3 text-[13px]"
                    />
                    <button
                      type="submit"
                      disabled={savingNotes}
                      className="h-9.5 rounded-xl bg-[#0F1115] px-4 text-[12.5px] font-bold text-[#C8F135] cursor-pointer"
                    >
                      {savingNotes ? 'Saving…' : 'Save Coach Notes ✓'}
                    </button>
                  </form>
                </>
              )}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
