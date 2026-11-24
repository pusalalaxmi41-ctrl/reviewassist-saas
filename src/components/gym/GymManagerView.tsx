import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import {
  Activity,
  AlertCircle,
  ArrowRight,
  Award,
  Bell,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Clock,
  Dumbbell,
  ExternalLink,
  Flame,
  IndianRupee,
  MessageCircle,
  Play,
  Plus,
  QrCode,
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
  GymNutritionMeal,
  GymOwnerDashboardPayload,
  GymWeeklyScheduleDay,
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
import {
  buildDefaultWeeklyScheduleForGoal,
  getNutritionPresetForGoal,
  GYM_NUTRITION_PRESETS,
  GYM_TRAINER_ROUTINE_PRESETS,
} from '../../utils/gymWorkoutEngine';
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
  onOpenEntranceQr?: () => void;
}

function toTitleCase(str: string | null | undefined): string {
  if (!str) return '';
  return str
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

function MemberAvatar({
  name,
  size = 'md',
}: {
  name: string;
  size?: 'sm' | 'md' | 'lg';
}) {
  const initial = (name.trim().charAt(0) || 'M').toUpperCase();
  const sizeClasses =
    size === 'sm'
      ? 'h-8 w-8 text-xs'
      : size === 'lg'
        ? 'h-11 w-11 text-base'
        : 'h-9.5 w-9.5 text-[13px]';
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full bg-[#0F1115] font-black text-[#C8F135] ring-2 ring-slate-100 shadow-sm ${sizeClasses}`}
      aria-hidden="true"
    >
      {initial}
    </span>
  );
}

function DaysLeftBar({ member }: { member: GymMember }) {
  const days = member.daysRemaining ?? 0;
  const total = member.durationDays > 0 ? member.durationDays : 30;
  const pct = Math.max(4, Math.min(100, Math.round((days / total) * 100)));
  const isExpiringSoon = days <= 3;
  const isWarning = days <= 10 && !isExpiringSoon;
  const barColor = isExpiringSoon
    ? 'bg-rose-500'
    : isWarning
      ? 'bg-amber-400'
      : 'bg-[#C8F135]';
  const textTone = isExpiringSoon
    ? 'text-rose-700 font-extrabold'
    : isWarning
      ? 'text-amber-800 font-bold'
      : 'text-emerald-700 font-bold';

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[11px]">
        <span className={`${textTone} tabular-nums`}>
          {days > 0 ? `${days}d left` : 'Expired'}
        </span>
        <span className="text-slate-400 tabular-nums">
          {member.endDate ? formatIsoDatePretty(member.endDate) : '—'}
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className={`h-full rounded-full transition-all duration-300 ${barColor}`}
          style={{ width: `${days > 0 ? pct : 0}%` }}
        />
      </div>
    </div>
  );
}

function formatCompactInr(paise: number): string {
  const rupees = Math.round(paise / 100);
  if (rupees === 0) return '0k';
  if (rupees >= 100000) {
    const l = rupees / 100000;
    return `${Number.isInteger(l) ? l : l.toFixed(1)}L`;
  }
  if (rupees >= 1000) {
    const k = rupees / 1000;
    return `${Number.isInteger(k) ? k : k.toFixed(0)}k`;
  }
  return `${rupees}`;
}

function formatMonthKeyLabel(monthKey: string): string {
  if (!monthKey || !monthKey.includes('-')) return monthKey;
  const [y, m] = monthKey.split('-').map((n) => Number.parseInt(n, 10));
  if (!y || !m) return monthKey;
  const dt = new Date(y, m - 1, 1);
  return dt.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
}

function AthleteIllustration({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 180 200"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <radialGradient
          id="athleteGlow"
          cx="0.5"
          cy="0.5"
          r="0.5"
          fx="0.5"
          fy="0.5"
        >
          <stop offset="0%" stopColor="#C8F135" stopOpacity="0.4" />
          <stop offset="60%" stopColor="#C8F135" stopOpacity="0.1" />
          <stop offset="100%" stopColor="#C8F135" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="athleteBodyGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#334155" />
          <stop offset="50%" stopColor="#1E293B" />
          <stop offset="100%" stopColor="#0F172A" />
        </linearGradient>
        <linearGradient id="athleteMetalGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#E2E8F0" />
          <stop offset="50%" stopColor="#94A3B8" />
          <stop offset="100%" stopColor="#475569" />
        </linearGradient>
      </defs>
      <circle cx="100" cy="110" r="85" fill="url(#athleteGlow)" />
      <circle
        cx="100"
        cy="110"
        r="72"
        stroke="#C8F135"
        strokeOpacity="0.18"
        strokeWidth="1.5"
        strokeDasharray="4 6"
      />
      <circle
        cx="100"
        cy="110"
        r="54"
        stroke="white"
        strokeOpacity="0.08"
        strokeWidth="1"
      />
      <circle
        cx="100"
        cy="46"
        r="16"
        fill="url(#athleteBodyGrad)"
        stroke="#475569"
        strokeWidth="1.5"
      />
      <path
        d="M80 62 C88 56, 112 56, 120 62 L142 80 C146 84, 144 94, 138 98 L130 102 L132 170 C132 175, 128 180, 122 180 L78 180 C72 180, 68 175, 68 170 L70 102 L62 98 C56 94, 54 84, 58 80 Z"
        fill="url(#athleteBodyGrad)"
        stroke="#475569"
        strokeWidth="1.5"
      />
      <path
        d="M100 64 L100 135"
        stroke="#C8F135"
        strokeOpacity="0.4"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M82 88 C92 94, 108 94, 118 88"
        stroke="#94A3B8"
        strokeOpacity="0.5"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M85 110 C93 114, 107 114, 115 110"
        stroke="#94A3B8"
        strokeOpacity="0.4"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M88 128 C94 131, 106 131, 112 128"
        stroke="#94A3B8"
        strokeOpacity="0.3"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
      <g transform="translate(118, 92)">
        <rect
          x="0"
          y="0"
          width="8"
          height="38"
          rx="3"
          fill="url(#athleteMetalGrad)"
          stroke="#334155"
          strokeWidth="1"
        />
        <rect
          x="2"
          y="4"
          width="4"
          height="30"
          rx="1"
          fill="#C8F135"
          fillOpacity="0.75"
        />
        <rect
          x="8"
          y="16"
          width="22"
          height="6"
          rx="1.5"
          fill="url(#athleteMetalGrad)"
          stroke="#1E293B"
          strokeWidth="0.8"
        />
        <path d="M13 13 C18 13, 20 15, 23 15 L23 25 C19 25, 17 23, 13 23 Z" fill="#64748B" />
        <rect
          x="30"
          y="0"
          width="8"
          height="38"
          rx="3"
          fill="url(#athleteMetalGrad)"
          stroke="#334155"
          strokeWidth="1"
        />
        <rect
          x="32"
          y="4"
          width="4"
          height="30"
          rx="1"
          fill="#C8F135"
          fillOpacity="0.75"
        />
      </g>
    </svg>
  );
}

export function GymManagerView({
  business,
  isBusinessLive,
  activeSection = 'dashboard',
  onSectionChange,
  onOpenEntranceQr,
}: Props) {
  const [dashboard, setDashboard] = useState<GymOwnerDashboardPayload | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
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

  // Member Progress Drawer (Attendance + Body Journal + Strength PRs + Coach Studio)
  const [progressMemberId, setProgressMemberId] = useState<string | null>(null);
  const [drawerTab, setDrawerTab] = useState<'progress' | 'coach_studio'>('progress');
  const [memberProgress, setMemberProgress] =
    useState<GymMemberProgressHistory | null>(null);
  const [workoutSummary, setWorkoutSummary] =
    useState<GymMemberWorkoutSummaryPayload | null>(null);
  const [loadingProgress, setLoadingProgress] = useState(false);
  const [notesDraft, setNotesDraft] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);

  // Coach Plan & Nutrition Studio state
  const [studioTrainerId, setStudioTrainerId] = useState('');
  const [studioPlanTitle, setStudioPlanTitle] = useState('Personalized Transformation Plan');
  const [studioScheduleMode, setStudioScheduleMode] = useState<'fixed_week' | 'rotation'>('fixed_week');
  const [studioWeeklySchedule, setStudioWeeklySchedule] = useState<GymWeeklyScheduleDay[]>([]);
  const [studioCalories, setStudioCalories] = useState('2200');
  const [studioProtein, setStudioProtein] = useState('140');
  const [studioCarbs, setStudioCarbs] = useState('230');
  const [studioFats, setStudioFats] = useState('65');
  const [studioWater, setStudioWater] = useState('3.5');
  const [studioMeals, setStudioMeals] = useState<GymNutritionMeal[]>([]);
  const [studioSupplements, setStudioSupplements] = useState('');
  const [studioApprovedAt, setStudioApprovedAt] = useState<string | null>(null);
  const [savingCoachPlan, setSavingCoachPlan] = useState(false);

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
    setDrawerTab('progress');
    setMemberProgress(null);
    setWorkoutSummary(null);
    setLoadingProgress(true);
    try {
      const [hist, summary, existingPlan] = await Promise.all([
        businessRepository.getGymMemberProgressHistory({
          businessId: business.id,
          memberId,
          monthKey: selectedMonthKey,
        }),
        businessRepository.getGymMemberWorkoutSummary({
          businessId: business.id,
          memberId,
        }),
        businessRepository.getGymMemberCoachPlanForOwner({
          businessId: business.id,
          memberId,
        }),
      ]);
      setMemberProgress(hist);
      setWorkoutSummary(summary);
      setNotesDraft(hist.member.trainerNotes ?? '');

      if (existingPlan) {
        setStudioTrainerId(existingPlan.trainerId ?? hist.member.ptTrainerId ?? '');
        setStudioPlanTitle(existingPlan.planTitle);
        setStudioScheduleMode(existingPlan.scheduleMode);
        setStudioWeeklySchedule(
          existingPlan.weeklySchedule.length > 0
            ? existingPlan.weeklySchedule
            : buildDefaultWeeklyScheduleForGoal(hist.member.fitnessGoal),
        );
        setStudioCalories(String(existingPlan.dailyCaloriesKcal));
        setStudioProtein(String(existingPlan.proteinGrams));
        setStudioCarbs(String(existingPlan.carbsGrams));
        setStudioFats(String(existingPlan.fatsGrams));
        setStudioWater(String(existingPlan.waterLiters));
        setStudioMeals(existingPlan.nutritionMeals);
        setStudioSupplements(existingPlan.supplementNotes ?? '');
        setStudioApprovedAt(existingPlan.approvedAt);
      } else {
        const preset = getNutritionPresetForGoal(hist.member.fitnessGoal);
        setStudioTrainerId(hist.member.ptTrainerId ?? '');
        setStudioPlanTitle(preset.planTitle);
        setStudioScheduleMode('fixed_week');
        setStudioWeeklySchedule(
          buildDefaultWeeklyScheduleForGoal(hist.member.fitnessGoal),
        );
        setStudioCalories(String(preset.dailyCaloriesKcal));
        setStudioProtein(String(preset.proteinGrams));
        setStudioCarbs(String(preset.carbsGrams));
        setStudioFats(String(preset.fatsGrams));
        setStudioWater(String(preset.waterLiters));
        setStudioMeals(preset.meals);
        setStudioSupplements(preset.supplementNotes);
        setStudioApprovedAt(null);
      }
    } catch (err) {
      setErrorMsg((err as Error).message);
      setProgressMemberId(null);
    } finally {
      setLoadingProgress(false);
    }
  }

  async function handleApproveAndPushCoachPlan(e: FormEvent) {
    e.preventDefault();
    if (!progressMemberId) return;
    setSavingCoachPlan(true);
    setErrorMsg(null);
    try {
      const assignedTrainer = (dashboard?.trainers ?? []).find(
        (t) => t.id === studioTrainerId,
      );
      const saved = await businessRepository.upsertAndApproveGymCoachPlan({
        businessId: business.id,
        memberId: progressMemberId,
        trainerId: studioTrainerId || null,
        planTitle: studioPlanTitle,
        scheduleMode: studioScheduleMode,
        weeklySchedule: studioWeeklySchedule,
        dailyCaloriesKcal: Number.parseInt(studioCalories, 10) || 2200,
        proteinGrams: Number.parseInt(studioProtein, 10) || 140,
        carbsGrams: Number.parseInt(studioCarbs, 10) || 230,
        fatsGrams: Number.parseInt(studioFats, 10) || 65,
        waterLiters: Number.parseFloat(studioWater) || 3.5,
        nutritionMeals: studioMeals,
        supplementNotes: studioSupplements,
        coachNotes: notesDraft,
        approvedBy: assignedTrainer?.trainerName ?? 'Head Coach',
      });
      setStudioApprovedAt(saved.approvedAt);
      flashStatus(
        `Coach Plan & Indian Diet approved and pushed to ${toTitleCase(memberProgress?.member.fullName)}'s phone app!`,
      );
      await loadDashboard();
    } catch (err) {
      setErrorMsg((err as Error).message);
    } finally {
      setSavingCoachPlan(false);
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

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadDashboard();
    } finally {
      window.setTimeout(() => setRefreshing(false), 600);
    }
  }, [loadDashboard]);

  if (loading && !dashboard) {
    return (
      <div className="py-16 text-center text-[13.5px] font-semibold text-slate-500">
        Loading GymOS Command Center…
      </div>
    );
  }

const totalPendingDuesPaise = dashboard?.totalBalanceDuePaise ?? 0;
  const renewalWindowDays = dashboard?.config.renewalAlertDays ?? 3;
  const weeklyBars =
    weeklyChart.length > 0
      ? weeklyChart
      : [1, 2, 3, 4].map((w) => ({
          weekIndex: w,
          label: `Week ${w}`,
          thisMonthPaise: 0,
          lastMonthPaise: 0,
        }));
  const thisMonthChartTotal = weeklyBars.reduce((s, b) => s + b.thisMonthPaise, 0);
  const lastMonthChartTotal = weeklyBars.reduce((s, b) => s + b.lastMonthPaise, 0);
  const revenueDeltaPct =
    lastMonthChartTotal > 0
      ? Math.round(
          ((thisMonthChartTotal - lastMonthChartTotal) / lastMonthChartTotal) * 100,
        )
      : null;
  const checkedInTodayCount = dashboard?.checkedInTodayCount ?? 0;
  const attendancePct =
    activeMembersCount > 0
      ? Math.round((checkedInTodayCount / activeMembersCount) * 100)
      : 0;
  const dueAndExpiringCount = balanceDueMembers.length + expiringSoon.length;
  const hasActionItems =
    pendingApprovals.length > 0 ||
    balanceDueMembers.length > 0 ||
    expiringSoon.length > 0;
  const directoryMembers = members
    .filter((m) => m.status === 'active')
    .slice(0, 6);
  const todaysAttendance = dashboard?.todaysAttendance ?? [];
  const chartTicks = [1, 0.75, 0.5, 0.25, 0] as const;
  const monthLabel = formatMonthKeyLabel(selectedMonthKey);

  const kpiCards: ReadonlyArray<{
    label: string;
    value: string;
    Icon: typeof Users;
    badgeTone: string;
    pill: string;
    pillTone: string;
    sub?: string;
  }> = [
    {
      label: 'Active Members',
      value: activeMembersCount.toLocaleString('en-IN'),
      Icon: Users,
      badgeTone: 'bg-[#0F1115] text-[#C8F135]',
      pill:
        pendingApprovals.length > 0
          ? `+${pendingApprovals.length} awaiting approval`
          : `${members.length} total on roster`,
      pillTone:
        pendingApprovals.length > 0
          ? 'bg-amber-50 text-amber-800'
          : 'bg-slate-100 text-slate-600',
    },
    {
      label: 'Monthly Revenue',
      value: formatPriceFromPaise(dashboard?.monthlyRevenuePaise ?? 0, 'INR'),
      Icon: IndianRupee,
      badgeTone: 'bg-[#C8F135] text-[#0F1115]',
      pill:
        revenueDeltaPct === null
          ? 'First tracked month'
          : `${revenueDeltaPct >= 0 ? '↑' : '↓'} ${Math.abs(revenueDeltaPct)}% vs last month`,
      pillTone:
        revenueDeltaPct !== null && revenueDeltaPct < 0
          ? 'bg-rose-50 text-rose-700'
          : 'bg-emerald-50 text-emerald-700',
      sub: `Plans ${formatPriceFromPaise(dashboard?.membershipRevenuePaise ?? 0, 'INR')} · Bar ${formatPriceFromPaise(dashboard?.retailRevenuePaise ?? 0, 'INR')}`,
    },
    {
      label: 'Checked In Today',
      value: checkedInTodayCount.toLocaleString('en-IN'),
      Icon: Activity,
      badgeTone: 'bg-indigo-50 text-indigo-600 ring-1 ring-inset ring-indigo-100',
      pill: `${attendancePct}% of active members`,
      pillTone: 'bg-indigo-50 text-indigo-700',
    },
    {
      label: `Due & Expiring ≤ ${renewalWindowDays}d`,
      value: dueAndExpiringCount.toLocaleString('en-IN'),
      Icon: Clock,
      badgeTone: 'bg-amber-50 text-amber-600 ring-1 ring-inset ring-amber-100',
      pill:
        totalPendingDuesPaise > 0
          ? `${formatPriceFromPaise(totalPendingDuesPaise, 'INR')} balance due`
          : 'No unpaid balances',
      pillTone:
        totalPendingDuesPaise > 0
          ? 'bg-amber-50 text-amber-800'
          : 'bg-emerald-50 text-emerald-700',
    },
  ];

  return (
    <div className="space-y-5">
      {/* SINGLE-ROW TOOLBAR: INSTANT SEARCH (⌘K) + MONTH + REFRESH + ADD DESK MEMBER */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative w-full lg:max-w-md">
          <Search
            className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
            aria-hidden
          />
          <input
            ref={searchInputRef}
            type="search"
            aria-label="Search members"
            placeholder="Search members, phone, GYM-001..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              if (e.target.value.trim() && activeSection === 'dashboard') {
                onSectionChange?.('members');
              }
            }}
            className="h-10.5 w-full rounded-xl border border-slate-200/80 bg-white pl-10 pr-14 text-[13px] text-[#0F1115] shadow-[0_1px_2px_rgba(15,17,21,0.04)] placeholder:text-slate-400 transition-[border-color,box-shadow] duration-150 focus:border-[#0F1115] focus:outline-none focus:ring-4 focus:ring-[#C8F135]/35"
          />
          <kbd className="pointer-events-none absolute right-2.5 top-1/2 inline-flex h-6 -translate-y-1/2 items-center rounded-md border border-slate-200 bg-slate-50 px-1.5 font-sans text-[10.5px] font-bold text-slate-500">
            ⌘K
          </kbd>
        </div>

        <div className="flex items-center gap-2.5 flex-nowrap overflow-x-auto lg:overflow-visible">
          <label className="relative inline-flex h-10 shrink-0 items-center gap-2 rounded-xl border border-slate-200/80 bg-white pl-3 pr-2 shadow-[0_1px_2px_rgba(15,17,21,0.04)]">
            <CalendarDays className="h-4 w-4 text-slate-400" aria-hidden />
            <input
              type="month"
              aria-label="Filter revenue month"
              value={selectedMonthKey}
              onChange={(e) => setSelectedMonthKey(e.target.value)}
              className="h-full bg-transparent text-[12.5px] font-semibold text-[#0F1115] tabular-nums focus:outline-none cursor-pointer"
            />
          </label>
          <button
            type="button"
            onClick={() => onSectionChange?.('dues')}
            className="gym-tactile relative inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200/80 bg-white text-[#0F1115] shadow-[0_1px_2px_rgba(15,17,21,0.04)] hover:bg-slate-50 cursor-pointer"
            title="Pending approvals, dues & renewals"
            aria-label={`${alertCount} alerts`}
          >
            <Bell className="h-4 w-4" aria-hidden />
            {alertCount > 0 && (
              <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-black text-white tabular-nums ring-2 ring-[#F8F9FA]">
                {alertCount}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => void handleRefresh()}
            disabled={refreshing}
            className="gym-tactile inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200/80 bg-white text-slate-600 shadow-[0_1px_2px_rgba(15,17,21,0.04)] hover:bg-slate-50 hover:text-[#0F1115] cursor-pointer"
            title="Refresh live data"
            aria-label="Refresh live data"
          >
            <RefreshCw
              className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`}
              aria-hidden
            />
          </button>
          <button
            type="button"
            onClick={() => setShowAddWalkIn(true)}
            className="gym-tactile inline-flex h-10 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl bg-[#C8F135] px-4 text-[13px] font-bold text-[#0F1115] shadow-[0_4px_14px_-4px_rgba(200,241,53,0.8)] hover:bg-[#bfe82c] cursor-pointer"
          >
            <Plus className="h-4 w-4" aria-hidden /> Add Desk Member
          </button>
        </div>
      </div>

      {/* FEEDBACK BANNERS */}
      {statusMsg && (
        <div
          role="status"
          className="gym-fade-up rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-[13px] font-semibold text-emerald-900 flex items-center justify-between gap-3"
        >
          <span className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden />
            {statusMsg}
          </span>
          <button
            type="button"
            onClick={() => setStatusMsg(null)}
            className="gym-tactile rounded-md p-1 text-emerald-700 hover:bg-emerald-100 cursor-pointer"
            aria-label="Dismiss"
          >
            <X className="h-3.5 w-3.5" aria-hidden />
          </button>
        </div>
      )}
      {errorMsg && (
        <div
          role="alert"
          className="gym-fade-up rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-[13px] font-medium text-rose-800 flex items-center justify-between gap-3"
        >
          <span className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" aria-hidden />
            {errorMsg}
          </span>
          <button
            type="button"
            onClick={() => setErrorMsg(null)}
            className="gym-tactile rounded-md p-1 text-rose-600 hover:bg-rose-100 cursor-pointer"
            aria-label="Dismiss"
          >
            <X className="h-3.5 w-3.5" aria-hidden />
          </button>
        </div>
      )}

      {/* ==================== SECTION 1: DASHBOARD COMMAND OVERVIEW ==================== */}
      {activeSection === 'dashboard' && (
        <div className="space-y-6">
          {/* PAGE HEADER */}
          <div className="gym-fade-up flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="text-[26px] font-black leading-tight tracking-tight text-[#0F1115]">
                Dashboard
              </h1>
              <p className="text-[13px] text-slate-500">
                Here&apos;s what&apos;s happening at{' '}
                <span className="font-semibold text-slate-700">{business.name}</span>{' '}
                today.
              </p>
            </div>
            <span className="inline-flex items-center gap-2 rounded-full border border-slate-200/80 bg-white px-3 py-1.5 text-[11.5px] font-semibold text-slate-600 shadow-[0_1px_2px_rgba(15,17,21,0.04)]">
              <span className="gym-pulse-dot h-2 w-2 rounded-full bg-emerald-500 text-emerald-500" />
              Live sync · {monthLabel}
            </span>
          </div>

          {/* SMART PROGRESSIVE DISCLOSURE: STATUS STRIP OR ACTION CARDS */}
          {!hasActionItems ? (
            <div
              role="status"
              className="gym-fade-up gym-stagger-1 flex items-center gap-3 rounded-2xl border border-emerald-200/80 bg-gradient-to-r from-emerald-50 via-emerald-50/60 to-white px-4 py-3"
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white shadow-[0_0_0_4px_rgba(16,185,129,0.15)]">
                <CheckCircle2 className="h-4 w-4" aria-hidden />
              </span>
              <p className="text-[13px] text-emerald-950">
                <strong className="font-extrabold">All caught up</strong> —{' '}
                <span className="tabular-nums">{pendingApprovals.length}</span>{' '}
                pending payment approvals •{' '}
                <span className="tabular-nums">{expiringSoon.length}</span>{' '}
                renewals due in ≤{' '}
                <span className="tabular-nums">{renewalWindowDays}</span> days
              </p>
            </div>
          ) : (
            <section className="gym-card gym-fade-up gym-stagger-1 overflow-hidden">
              <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-3.5">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-rose-50 text-rose-600 ring-1 ring-inset ring-rose-100">
                    <Bell className="h-4 w-4" aria-hidden />
                  </span>
                  <div>
                    <h2 className="text-[14.5px] font-extrabold text-[#0F1115]">
                      Action Required Today
                    </h2>
                    <p className="text-[11.5px] text-slate-500 tabular-nums">
                      {pendingApprovals.length} approvals ·{' '}
                      {balanceDueMembers.length} balances ·{' '}
                      {expiringSoon.length} renewals
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onSectionChange?.('members')}
                  className="gym-tactile inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[12px] font-bold text-slate-500 hover:bg-slate-50 hover:text-[#0F1115] cursor-pointer"
                >
                  All members <span className="tabular-nums">({members.length})</span>
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                </button>
              </div>

              <div className="divide-y divide-slate-100">
                {pendingApprovals.map((m) => (
                  <div
                    key={m.id}
                    className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 transition-colors hover:bg-slate-50/70"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <MemberAvatar name={m.fullName} />
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[13.5px] font-extrabold text-[#0F1115]">
                            {toTitleCase(m.fullName)}
                          </span>
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10.5px] font-bold text-amber-900">
                            Pending Payment
                          </span>
                        </div>
                        <p className="text-[12px] text-slate-500 tabular-nums">
                          {m.memberCode} · {m.planName} (
                          {formatPriceFromPaise(m.feePaise, 'INR')}) · {m.phone}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => openApprovalDialog(m, 'approve')}
                      className="gym-tactile h-9 rounded-xl bg-[#C8F135] px-3.5 text-[12px] font-bold text-[#0F1115] hover:bg-[#bfe82c] cursor-pointer"
                    >
                      Approve / Installment ✓
                    </button>
                  </div>
                ))}

                {balanceDueMembers.map((m) => (
                  <div
                    key={`due-${m.id}`}
                    className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 transition-colors hover:bg-slate-50/70"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <MemberAvatar name={m.fullName} />
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[13.5px] font-extrabold text-[#0F1115]">
                            {toTitleCase(m.fullName)}
                          </span>
                          <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10.5px] font-bold text-rose-800 tabular-nums">
                            Due {formatPriceFromPaise(m.balanceDuePaise ?? 0, 'INR')}
                          </span>
                        </div>
                        <p className="text-[12px] text-slate-500 tabular-nums">
                          Paid {formatPriceFromPaise(m.amountPaidPaise ?? 0, 'INR')} of{' '}
                          {formatPriceFromPaise(
                            m.totalPlanAmountPaise ?? m.feePaise,
                            'INR',
                          )}
                          {m.balanceDueDate
                            ? ` · Due ${formatIsoDatePretty(m.balanceDueDate)}`
                            : ''}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <a
                        href={getGymBalanceDueWhatsAppLink(business.name, m)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="gym-tactile inline-flex h-9 items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 text-[12px] font-bold text-emerald-700 hover:bg-emerald-50"
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
                        className="gym-tactile h-9 rounded-xl bg-[#0F1115] px-3.5 text-[12px] font-bold text-[#C8F135] hover:bg-[#1c2028] cursor-pointer"
                      >
                        Collect Balance ✓
                      </button>
                    </div>
                  </div>
                ))}

                {expiringSoon.map((m) => (
                  <div
                    key={`exp-${m.id}`}
                    className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 transition-colors hover:bg-slate-50/70"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <MemberAvatar name={m.fullName} />
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[13.5px] font-extrabold text-[#0F1115]">
                            {toTitleCase(m.fullName)}
                          </span>
                          <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[10.5px] font-bold text-orange-900 tabular-nums">
                            Expires in {m.daysRemaining}d
                          </span>
                        </div>
                        <p className="text-[12px] text-slate-500">
                          {m.planName} · Ends {formatIsoDatePretty(m.endDate)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <a
                        href={getGymRenewalWhatsAppLink(business.name, m)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="gym-tactile inline-flex h-9 items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 text-[12px] font-bold text-emerald-700 hover:bg-emerald-50"
                      >
                        <MessageCircle className="h-3.5 w-3.5" aria-hidden />
                        WhatsApp
                      </a>
                      <button
                        type="button"
                        onClick={() => openApprovalDialog(m, 'renew')}
                        className="gym-tactile h-9 rounded-xl bg-[#0F1115] px-3.5 text-[12px] font-bold text-[#C8F135] hover:bg-[#1c2028] cursor-pointer"
                      >
                        Renew Plan
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* 4 ICON-BADGED HERO KPI CARDS */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {kpiCards.map((kpi, idx) => (
              <div
                key={kpi.label}
                className={`gym-card gym-fade-up gym-stagger-${idx + 1} flex items-start gap-3.5 p-4`}
              >
                <span
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${kpi.badgeTone}`}
                >
                  <kpi.Icon className="h-5 w-5" aria-hidden />
                </span>
                <div className="min-w-0 space-y-1">
                  <p className="text-[10.5px] font-bold uppercase tracking-[0.08em] text-slate-500">
                    {kpi.label}
                  </p>
                  <p className="text-[24px] font-black leading-none text-[#0F1115] tabular-nums">
                    {kpi.value}
                  </p>
                  <span
                    className={`inline-flex max-w-full truncate rounded-full px-2 py-0.5 text-[10.5px] font-bold tabular-nums ${kpi.pillTone}`}
                  >
                    {kpi.pill}
                  </span>
                  {kpi.sub && (
                    <p className="truncate text-[11px] text-slate-400 tabular-nums">
                      {kpi.sub}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* MAIN ASYMMETRIC GRID */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            {/* LEFT 8 COLS: REVENUE OVERVIEW + ACTIVE MEMBER DIRECTORY */}
            <div className="space-y-6 lg:col-span-8">
              <section className="gym-card gym-fade-up gym-stagger-2 p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-[15.5px] font-extrabold text-[#0F1115]">
                      Revenue Overview
                    </h2>
                    <p className="text-[12px] text-slate-500">
                      {monthLabel} · Membership, PT &amp; Supplement Bar · Projected
                      next 30d{' '}
                      <strong className="font-bold text-[#0F1115] tabular-nums">
                        {formatPriceFromPaise(
                          dashboard?.projectedNextMonthRevenuePaise ?? 0,
                          'INR',
                        )}
                      </strong>
                    </p>
                  </div>
                  <div className="flex items-center gap-3 text-[11.5px] font-semibold">
                    <span className="inline-flex items-center gap-1.5 text-[#0F1115]">
                      <span className="h-2.5 w-2.5 rounded-full bg-[#C8F135] ring-1 ring-[#0F1115]/10" />
                      This Month
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-slate-500">
                      <span className="h-2.5 w-2.5 rounded-full bg-[#CBD5E1]" />
                      Last Month
                    </span>
                  </div>
                </div>

                <div className="mt-6 pl-12">
                  <div className="relative h-52">
                    {chartTicks.map((t) => (
                      <div
                        key={t}
                        className="absolute inset-x-0 border-t border-slate-100"
                        style={{ bottom: `${t * 100}%` }}
                      >
                        <span className="absolute -left-12 w-10 -translate-y-1/2 text-right text-[10.5px] font-semibold text-slate-400 tabular-nums">
                          {formatCompactInr(Math.round(maxWeeklyPaise * t))}
                        </span>
                      </div>
                    ))}
                    <div className="relative grid h-full grid-cols-4 gap-3 sm:gap-6">
                      {weeklyBars.map((wk, idx) => {
                        const thisPct = Math.max(
                          2,
                          Math.min(100, (wk.thisMonthPaise / maxWeeklyPaise) * 100),
                        );
                        const lastPct = Math.max(
                          2,
                          Math.min(100, (wk.lastMonthPaise / maxWeeklyPaise) * 100),
                        );
                        return (
                          <div
                            key={wk.weekIndex}
                            className="group relative flex h-full items-end justify-center gap-1.5 rounded-xl transition-colors hover:bg-slate-50/80 sm:gap-2.5"
                          >
                            <div
                              role="tooltip"
                              className="pointer-events-none absolute left-1/2 z-10 -translate-x-1/2 translate-y-1 whitespace-nowrap rounded-xl bg-[#0F1115] px-3 py-2 text-[11px] text-white opacity-0 shadow-xl transition-all duration-150 group-hover:translate-y-0 group-hover:opacity-100"
                              style={{
                                bottom: `calc(${Math.max(thisPct, lastPct)}% + 10px)`,
                              }}
                            >
                              <p className="font-bold text-slate-300">{wk.label}</p>
                              <p className="tabular-nums">
                                <span className="text-[#C8F135]">●</span> This{' '}
                                <strong>
                                  {formatPriceFromPaise(wk.thisMonthPaise, 'INR')}
                                </strong>
                              </p>
                              <p className="tabular-nums text-slate-300">
                                <span className="text-slate-400">●</span> Last{' '}
                                {formatPriceFromPaise(wk.lastMonthPaise, 'INR')}
                              </p>
                            </div>
                            <div
                              className="gym-bar-grow w-5 rounded-t-lg bg-[#C8F135] shadow-[inset_0_-1px_0_rgba(15,17,21,0.08)] transition-[filter] group-hover:brightness-95 sm:w-9"
                              style={{
                                height: `${thisPct}%`,
                                animationDelay: `${idx * 90}ms`,
                              }}
                            />
                            <div
                              className="gym-bar-grow w-5 rounded-t-lg bg-[#CBD5E1] sm:w-9"
                              style={{
                                height: `${lastPct}%`,
                                animationDelay: `${idx * 90 + 45}ms`,
                              }}
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <div className="mt-2.5 grid grid-cols-4 gap-3 text-center sm:gap-6">
                    {weeklyBars.map((wk) => (
                      <div key={wk.weekIndex}>
                        <p className="text-[11.5px] font-bold text-slate-600">
                          {wk.label}
                        </p>
                        <p className="text-[10.5px] font-semibold text-slate-400 tabular-nums">
                          {formatPriceFromPaise(wk.thisMonthPaise, 'INR')}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </section>

              {/* ACTIVE MEMBER DIRECTORY */}
              <section className="gym-card gym-fade-up gym-stagger-3 overflow-hidden">
                <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-3.5">
                  <div>
                    <h2 className="text-[15px] font-extrabold text-[#0F1115]">
                      Active Members
                    </h2>
                    <p className="text-[11.5px] text-slate-500 tabular-nums">
                      {activeMembersCount} active · sorted by priority
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onSectionChange?.('members')}
                    className="gym-tactile inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[12px] font-bold text-slate-500 hover:bg-slate-50 hover:text-[#0F1115] cursor-pointer"
                  >
                    View All <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                  </button>
                </div>

                {directoryMembers.length === 0 ? (
                  <div className="flex flex-col items-center gap-3 bg-gradient-to-b from-slate-50/80 to-white px-6 py-10 text-center">
                    <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#C8F135]/25 text-[#0F1115] ring-1 ring-inset ring-[#C8F135]/50">
                      <UserPlus className="h-5 w-5" aria-hidden />
                    </span>
                    <div>
                      <p className="text-[14px] font-extrabold text-[#0F1115]">
                        No active members yet
                      </p>
                      <p className="text-[12.5px] text-slate-500">
                        Approve your first QR signup or register a walk-in at the
                        front desk.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowAddWalkIn(true)}
                      className="gym-tactile inline-flex h-9.5 items-center gap-1.5 rounded-xl bg-[#0F1115] px-4 text-[12.5px] font-bold text-[#C8F135] cursor-pointer"
                    >
                      <Plus className="h-4 w-4" aria-hidden /> Add Desk Member
                    </button>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {directoryMembers.map((m) => {
                      const goal = getFitnessGoalMeta(m.fitnessGoal);
                      const visits = m.daysAttendedThisMonth ?? 0;
                      return (
                        <div
                          key={m.id}
                          className="flex flex-col gap-3 px-5 py-3.5 transition-colors hover:bg-slate-50/70 md:flex-row md:items-center"
                        >
                          <div className="flex min-w-0 flex-1 items-center gap-3">
                            <MemberAvatar name={m.fullName} />
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="truncate text-[13.5px] font-extrabold text-[#0F1115]">
                                  {toTitleCase(m.fullName)}
                                </span>
                                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10.5px] font-bold text-slate-700">
                                  {goal.emoji} {goal.label}
                                </span>
                                {m.checkedInToday && (
                                  <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10.5px] font-bold text-emerald-700">
                                    In today
                                  </span>
                                )}
                              </div>
                              <p className="text-[11.5px] text-slate-500 tabular-nums">
                                {m.memberCode} · {visits}{' '}
                                {visits === 1 ? 'visit' : 'visits'} this month · 🔥{' '}
                                {m.currentStreakDays ?? 0}d
                              </p>
                            </div>
                          </div>
                          <div className="w-full md:w-40">
                            <DaysLeftBar member={m} />
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            <button
                              type="button"
                              onClick={() => void handleOpenProgressDrawer(m.id)}
                              className="gym-tactile h-8.5 rounded-lg border border-slate-200 bg-white px-3 text-[12px] font-bold text-[#0F1115] hover:bg-slate-50 cursor-pointer"
                            >
                              Progress
                            </button>
                            <button
                              type="button"
                              onClick={() => openApprovalDialog(m, 'renew')}
                              className="gym-tactile h-8.5 whitespace-nowrap rounded-lg bg-[#0F1115] px-3 text-[12px] font-bold text-[#C8F135] hover:bg-[#1c2028] cursor-pointer tabular-nums"
                            >
                              +{m.durationDays}d Renew
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            </div>

            {/* RIGHT 4 COLS: LIVE ATTENDANCE + SUPPLEMENT POS + DARK STATIC QR PROMO */}
            <div className="space-y-6 lg:col-span-4 xl:sticky xl:top-4 xl:self-start">
              <section className="gym-card gym-fade-up gym-stagger-2 p-4">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <h2 className="text-[14.5px] font-extrabold text-[#0F1115]">
                      Today&apos;s Attendance
                    </h2>
                    <p className="text-[11.5px] text-slate-500 tabular-nums">
                      {todaysAttendance.length} checked in via Entrance QR
                    </p>
                  </div>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider text-emerald-700 ring-1 ring-inset ring-emerald-100">
                    <span className="gym-pulse-dot h-1.5 w-1.5 rounded-full bg-emerald-500 text-emerald-500" />
                    Live Floor
                  </span>
                </div>

                {todaysAttendance.length === 0 ? (
                  <div className="mt-3 flex items-center gap-3 rounded-xl bg-slate-50 px-3.5 py-3.5">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-slate-400 ring-1 ring-inset ring-slate-200">
                      <Dumbbell className="h-4 w-4" aria-hidden />
                    </span>
                    <p className="text-[12.5px] text-slate-500">
                      Waiting for today&apos;s first Entrance QR check-in.
                    </p>
                  </div>
                ) : (
                  <div className="mt-3 max-h-72 space-y-1.5 overflow-y-auto pr-0.5">
                    {todaysAttendance.slice(0, 10).map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => void handleOpenProgressDrawer(c.memberId)}
                        className="group flex w-full items-center gap-2.5 rounded-xl px-2 py-2 text-left transition-colors hover:bg-slate-50 cursor-pointer"
                      >
                        <MemberAvatar name={c.fullName} size="sm" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[12.5px] font-bold text-[#0F1115]">
                            {toTitleCase(c.fullName)}
                          </p>
                          <span className="inline-flex rounded-md bg-[#0F1115] px-1.5 py-0.5 text-[10px] font-bold text-[#C8F135]">
                            {getWorkoutFocusMeta(c.workoutFocus).dayLabel}
                          </span>
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-1">
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10.5px] font-bold text-slate-700 tabular-nums">
                            {formatCheckInTime12h(c.checkedInAt)}
                          </span>
                          <span className="inline-flex items-center gap-0.5 text-[10.5px] font-bold text-slate-400 transition-colors group-hover:text-[#0F1115]">
                            Inspect <ArrowRight className="h-3 w-3" aria-hidden />
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {leaderboard.length > 0 && (
                  <div className="mt-3 space-y-1.5 border-t border-slate-100 pt-3">
                    <p className="flex items-center gap-1 text-[10.5px] font-bold uppercase tracking-wider text-slate-400">
                      <Flame className="h-3.5 w-3.5 text-orange-500" aria-hidden />
                      Top Monthly Streaks
                    </p>
                    {leaderboard.slice(0, 3).map((lb) => (
                      <div
                        key={lb.memberCode}
                        className="flex items-center justify-between text-[12px]"
                      >
                        <span className="font-bold text-[#0F1115]">
                          <span className="tabular-nums text-slate-400">#{lb.rank}</span>{' '}
                          {toTitleCase(lb.displayName)}
                        </span>
                        <span className="font-bold text-orange-600 tabular-nums">
                          {lb.workoutsThisMonth}d · 🔥{lb.currentStreakDays}d
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* Quick Supplement & Protein Bar POS */}
              <section className="gym-card gym-fade-up gym-stagger-3 space-y-3 p-4">
                <div className="flex items-center justify-between">
                  <h2 className="flex items-center gap-1.5 text-[14px] font-extrabold text-[#0F1115]">
                    <ShoppingBag className="h-4 w-4 text-[#0F1115]" aria-hidden />
                    Quick Supplement Bar
                  </h2>
                  <div className="inline-flex rounded-lg bg-slate-100 p-0.5 text-[11px] font-bold">
                    {(['upi', 'cash'] as const).map((pm) => (
                      <button
                        key={pm}
                        type="button"
                        onClick={() => setRetailMethod(pm)}
                        className={`rounded-md px-2.5 py-1 uppercase transition-colors cursor-pointer ${retailMethod === pm ? 'bg-[#0F1115] text-[#C8F135] shadow-sm' : 'text-slate-500 hover:text-[#0F1115]'}`}
                      >
                        {pm}
                      </button>
                    ))}
                  </div>
                </div>

                {retailProducts.length === 0 ? (
                  <button
                    type="button"
                    onClick={() => void handleSeedSupplements()}
                    className="gym-tactile h-10 w-full rounded-xl bg-[#C8F135] text-[12.5px] font-bold text-[#0F1115] cursor-pointer"
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
                        className="gym-tactile rounded-xl border border-slate-200/80 bg-slate-50 p-2.5 text-left hover:border-[#0F1115]/30 hover:bg-[#C8F135]/20 disabled:opacity-50 cursor-pointer"
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
              </section>

              {/* DARK OBSIDIAN STATIC ENTRANCE QR PROMO CARD */}
              <section className="gym-obsidian-mesh gym-fade-up gym-stagger-4 relative min-h-[212px] overflow-hidden rounded-2xl border border-white/10 p-5 text-white">
                <AthleteIllustration className="pointer-events-none absolute -bottom-1 -right-3 h-[200px] w-[170px]" />
                <div className="relative max-w-[62%] space-y-2.5">
                  <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#C8F135]">
                    Static Entrance QR
                  </p>
                  <h3 className="text-[22px] font-black leading-[1.05] tracking-tight">
                    Build a <span className="text-[#C8F135]">Healthier</span>{' '}
                    Community
                  </h3>
                  <p className="text-[11.5px] leading-snug text-slate-300">
                    One printed wall QR — members join, check in &amp; log workouts.
                    ₹0 hardware.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      if (onOpenEntranceQr) onOpenEntranceQr();
                      else window.open(gymPortalUrl, '_blank', 'noopener,noreferrer');
                    }}
                    className="gym-tactile inline-flex h-9 items-center gap-1.5 rounded-xl bg-[#C8F135] px-3.5 text-[12px] font-bold text-[#0F1115] shadow-[0_6px_18px_-6px_rgba(200,241,53,0.9)] cursor-pointer"
                  >
                    <QrCode className="h-3.5 w-3.5" aria-hidden />
                    View Entrance QR <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                  </button>
                  {isBusinessLive && (
                    <a
                      href={gymPortalUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-1 inline-flex items-center gap-1 text-[11px] font-semibold text-slate-400 hover:text-white"
                    >
                      Member App <ExternalLink className="h-3 w-3" aria-hidden />
                    </a>
                  )}
                </div>
              </section>
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
                        {toTitleCase(t.trainerName)}{' '}
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
                    {approvalModal.action} Plan: {toTitleCase(approvalModal.member.fullName)}
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
                  Collect Balance: {toTitleCase(collectTarget.fullName)}
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
                    {toTitleCase(memberProgress?.member.fullName) || 'Member Progress'}
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
                  Loading attendance, Strength PRs &amp; Coach Studio…
                </p>
              ) : (
                <>
                  {/* 2-Tab Drawer Switcher */}
                  <div className="grid grid-cols-2 gap-1.5 rounded-xl bg-slate-100 p-1">
                    <button
                      type="button"
                      onClick={() => setDrawerTab('progress')}
                      className={`rounded-lg py-2 text-[12px] font-extrabold transition-colors cursor-pointer ${
                        drawerTab === 'progress'
                          ? 'bg-[#0F1115] text-[#C8F135]'
                          : 'text-slate-600 hover:text-[#0F1115]'
                      }`}
                    >
                      Progress &amp; PRs
                    </button>
                    <button
                      type="button"
                      onClick={() => setDrawerTab('coach_studio')}
                      className={`rounded-lg py-2 text-[12px] font-extrabold transition-colors cursor-pointer ${
                        drawerTab === 'coach_studio'
                          ? 'bg-[#0F1115] text-[#C8F135]'
                          : 'text-slate-600 hover:text-[#0F1115]'
                      }`}
                    >
                      Coach Plan &amp; Nutrition Studio
                    </button>
                  </div>

                  {drawerTab === 'coach_studio' ? (
                    <form
                      onSubmit={(e) => void handleApproveAndPushCoachPlan(e)}
                      className="space-y-4"
                    >
                      <div className="rounded-2xl bg-[#0F1115] p-4 text-white space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-[#C8F135]">
                            Coach Personalization Engine
                          </span>
                          {studioApprovedAt && (
                            <span className="rounded-full bg-[#C8F135]/20 px-2 py-0.5 text-[10px] font-extrabold text-[#C8F135]">
                              ✓ Live on Member App
                            </span>
                          )}
                        </div>
                        <p className="text-[12px] text-slate-300">
                          Customize weekly workout split + daily Indian diet macros and push directly to{' '}
                          <strong>{toTitleCase(memberProgress.member.fullName)}</strong>&apos;s Plan tab.
                        </p>
                      </div>

                      {/* Trainer & Plan Title */}
                      <div className="grid grid-cols-2 gap-2.5">
                        <div className="space-y-1">
                          <label className="text-[11px] font-bold text-slate-500">
                            Assigned Trainer
                          </label>
                          <select
                            value={studioTrainerId}
                            onChange={(e) => setStudioTrainerId(e.target.value)}
                            className="h-9.5 w-full rounded-xl border border-slate-300 px-2.5 text-[12.5px] font-semibold"
                          >
                            <option value="">Head Coach (Default)</option>
                            {(dashboard?.trainers ?? []).map((t) => (
                              <option key={t.id} value={t.id}>
                                {t.trainerName}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[11px] font-bold text-slate-500">
                            Schedule Mode
                          </label>
                          <select
                            value={studioScheduleMode}
                            onChange={(e) =>
                              setStudioScheduleMode(
                                e.target.value === 'rotation' ? 'rotation' : 'fixed_week',
                              )
                            }
                            className="h-9.5 w-full rounded-xl border border-slate-300 px-2.5 text-[12.5px] font-semibold"
                          >
                            <option value="fixed_week">Fixed Week (Mo–Su)</option>
                            <option value="rotation">Rotation Split</option>
                          </select>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-500">
                          Plan Title
                        </label>
                        <input
                          type="text"
                          required
                          value={studioPlanTitle}
                          onChange={(e) => setStudioPlanTitle(e.target.value)}
                          className="h-9.5 w-full rounded-xl border border-slate-300 px-3 text-[13px] font-semibold"
                        />
                      </div>

                      {/* 1-Tap Diet Presets */}
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                          1-Tap Indian Diet Presets
                        </label>
                        <div className="flex flex-wrap gap-1.5">
                          {GYM_NUTRITION_PRESETS.map((preset) => (
                            <button
                              key={preset.key}
                              type="button"
                              onClick={() => {
                                setStudioPlanTitle(preset.planTitle);
                                setStudioCalories(String(preset.dailyCaloriesKcal));
                                setStudioProtein(String(preset.proteinGrams));
                                setStudioCarbs(String(preset.carbsGrams));
                                setStudioFats(String(preset.fatsGrams));
                                setStudioWater(String(preset.waterLiters));
                                setStudioMeals(preset.meals);
                                setStudioSupplements(preset.supplementNotes);
                              }}
                              className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[11.5px] font-bold text-[#0F1115] hover:bg-[#C8F135]/30 cursor-pointer"
                            >
                              {preset.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Daily Macros */}
                      <div className="grid grid-cols-5 gap-1.5">
                        {[
                          { label: 'Kcal', val: studioCalories, set: setStudioCalories },
                          { label: 'Protein(g)', val: studioProtein, set: setStudioProtein },
                          { label: 'Carbs(g)', val: studioCarbs, set: setStudioCarbs },
                          { label: 'Fats(g)', val: studioFats, set: setStudioFats },
                          { label: 'Water(L)', val: studioWater, set: setStudioWater },
                        ].map((m) => (
                          <div key={m.label} className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-500">
                              {m.label}
                            </label>
                            <input
                              type="number"
                              step={m.label === 'Water(L)' ? '0.1' : '1'}
                              value={m.val}
                              onChange={(e) => m.set(e.target.value)}
                              className="h-9 w-full rounded-lg border border-slate-300 px-2 text-[12px] font-bold tabular-nums"
                            />
                          </div>
                        ))}
                      </div>

                      {/* 7-Day Weekly Split Editor */}
                      <div className="space-y-2">
                        <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                          7-Day Weekly Training Split (Mo–Su)
                        </label>
                        <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                          {studioWeeklySchedule.map((day, dIdx) => (
                            <div
                              key={day.dayKey}
                              className="rounded-xl border border-slate-200 bg-slate-50 p-2.5 flex items-center justify-between gap-2"
                            >
                              <div className="flex items-center gap-2 min-w-0 flex-1">
                                <span className="w-6 text-[12px] font-black text-[#0F1115]">
                                  {day.dayLabel}
                                </span>
                                <input
                                  type="text"
                                  value={day.focusTitle}
                                  disabled={day.isRestDay}
                                  onChange={(e) => {
                                    const next = [...studioWeeklySchedule];
                                    next[dIdx] = { ...day, focusTitle: e.target.value };
                                    setStudioWeeklySchedule(next);
                                  }}
                                  className="h-8 flex-1 rounded-lg border border-slate-200 bg-white px-2 text-[12px] font-bold disabled:opacity-50"
                                />
                              </div>
                              <label className="flex items-center gap-1 text-[11px] font-semibold text-slate-600 cursor-pointer shrink-0">
                                <input
                                  type="checkbox"
                                  checked={day.isRestDay}
                                  onChange={(e) => {
                                    const next = [...studioWeeklySchedule];
                                    next[dIdx] = {
                                      ...day,
                                      isRestDay: e.target.checked,
                                      focusTitle: e.target.checked ? 'Rest day' : 'Workout Day',
                                    };
                                    setStudioWeeklySchedule(next);
                                  }}
                                />
                                Rest
                              </label>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Meals Preview & Supplements */}
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                          Meals ({studioMeals.length} scheduled) &amp; Supplements
                        </label>
                        <input
                          type="text"
                          placeholder="Supplement & hydration notes..."
                          value={studioSupplements}
                          onChange={(e) => setStudioSupplements(e.target.value)}
                          className="h-9.5 w-full rounded-xl border border-slate-300 px-3 text-[12.5px]"
                        />
                        <textarea
                          rows={2}
                          value={notesDraft}
                          onChange={(e) => setNotesDraft(e.target.value)}
                          placeholder="Coach notes visible on member's Nutrition tab..."
                          className="w-full rounded-xl border border-slate-300 p-2.5 text-[12.5px]"
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={savingCoachPlan}
                        className="gym-tactile flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#0F1115] text-[13.5px] font-extrabold text-[#C8F135] hover:bg-slate-800 cursor-pointer"
                      >
                        {savingCoachPlan
                          ? 'Pushing Plan…'
                          : 'Approve & Push to Member App ✓'}
                      </button>
                    </form>
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
                </>
              )}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
