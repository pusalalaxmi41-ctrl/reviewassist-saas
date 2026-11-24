import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from 'react';
import { Link, useParams } from 'react-router-dom';
import QRCode from 'qrcode';
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Award,
  BarChart3,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  Droplets,
  Dumbbell,
  Flame,
  Home,
  Loader2,
  Minus,
  Play,
  Plus,
  QrCode,
  Scale,
  Search,
  SearchX,
  Shield,
  Smartphone,
  Snowflake,
  Sparkles,
  Star,
  Timer,
  Trophy,
  Utensils,
  X,
} from 'lucide-react';
import type {
  GymCatalogExercise,
  GymFitnessGoal,
  GymLeaderboardEntry,
  GymMember,
  GymMemberAthleteHubPayload,
  GymMemberWorkoutPlanPayload,
  GymRoutineExerciseItem,
  GymWeeklyScheduleDay,
  GymWorkoutFocus,
  PublicGymPortalPayload,
} from '../types/gym';
import { businessRepository } from '../services/storage';
import {
  buildWeeklyActivityDays,
  encodeGymMemberPassQr,
  formatCheckInTime12h,
  formatIsoDatePretty,
  getFitnessGoalMeta,
  getWorkoutFocusMeta,
  GYM_FITNESS_GOAL_OPTIONS,
  GYM_WORKOUT_FOCUS_OPTIONS,
} from '../utils/gymValidation';
import {
  build12WeekActivityHeatmap,
  buildDefaultWeeklyScheduleForGoal,
  buildGymDataExportCsv,
  calculateBarbellPlates,
  getNutritionPresetForGoal,
} from '../utils/gymWorkoutEngine';
import { formatPriceFromPaise } from '../utils/restaurantValidation';
import { playNotificationChime } from '../utils/hospitalityHelpers';
import { GymMuscleMapSvg } from '../components/gym/GymMuscleMapSvg';
import { ExerciseAnimationPreview } from '../components/gym/ExerciseAnimationPreview';

type MemberTab = 'home' | 'plan' | 'stats' | 'exercises';
type PlanSubTab = 'schedule' | 'nutrition' | 'pass';
type StatsSubTab = 'overview' | 'body' | 'lifts' | 'effort';
type AuthScreenMode = 'splash' | 'join' | 'signin';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface ActiveSetRowState {
  setNumber: number;
  weightKg: number;
  reps: number;
  completed: boolean;
  isRecord: boolean;
}

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
    // Ignore private-mode storage errors
  }
}

function toTitleCase(str: string | null | undefined): string {
  if (!str) return '';
  return str
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

function formatTimerClock(totalSeconds: number): string {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function getTodayWeekKey(): GymWeeklyScheduleDay['dayKey'] {
  const jsDay = new Date().getDay(); // 0=Sun..6=Sat
  const map: GymWeeklyScheduleDay['dayKey'][] = [
    'sun',
    'mon',
    'tue',
    'wed',
    'thu',
    'fri',
    'sat',
  ];
  return map[jsDay] ?? 'mon';
}

function AthleteSplashIllustration() {
  return (
    <div className="relative mx-auto flex h-44 w-44 items-center justify-center">
      <div className="gym-glow-drift absolute inset-0 rounded-full bg-[#C8F135]/20 blur-2xl" />
      <svg
        viewBox="0 0 200 200"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="absolute inset-0 h-full w-full"
        aria-hidden="true"
      >
        <circle
          cx="100"
          cy="100"
          r="90"
          stroke="#C8F135"
          strokeOpacity="0.25"
          strokeWidth="1.5"
          strokeDasharray="6 6"
        />
        <circle
          cx="100"
          cy="100"
          r="72"
          stroke="white"
          strokeOpacity="0.1"
          strokeWidth="1"
        />
        <circle
          cx="100"
          cy="100"
          r="54"
          stroke="#C8F135"
          strokeOpacity="0.35"
          strokeWidth="1.5"
        />
      </svg>
      <div className="relative flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-[#1E293B] to-[#0F172A] border border-[#C8F135]/40 shadow-[0_0_30px_rgba(200,241,53,0.35)]">
        <Dumbbell className="h-10 w-10 text-[#C8F135]" aria-hidden="true" />
      </div>
    </div>
  );
}

export default function CustomerGymPage() {
  const { businessSlug = '' } = useParams<{ businessSlug: string }>();

  const [portal, setPortal] = useState<PublicGymPortalPayload | null>(null);
  const [todayFormatted] = useState(() =>
    new Date().toLocaleDateString('en-IN', {
      weekday: 'long',
      day: 'numeric',
      month: 'short',
    }),
  );
  const [loading, setLoading] = useState(true);
  const [authMode, setAuthMode] = useState<AuthScreenMode>('splash');
  const [activeTab, setActiveTab] = useState<MemberTab>('home');
  const [planSubTab, setPlanSubTab] = useState<PlanSubTab>('schedule');
  const [statsSubTab, setStatsSubTab] = useState<StatsSubTab>('overview');

  // Member & live training state
  const [memberPass, setMemberPass] = useState<GymMember | null>(null);
  const [workoutPlan, setWorkoutPlan] =
    useState<GymMemberWorkoutPlanPayload | null>(null);
  const [athleteHub, setAthleteHub] =
    useState<GymMemberAthleteHubPayload | null>(null);
  const [leaderboard, setLeaderboard] = useState<GymLeaderboardEntry[]>([]);

  // New Member Join form
  const [fullName, setFullName] = useState('');
  const [joinPhone, setJoinPhone] = useState('');
  const [selectedPlanId, setSelectedPlanId] = useState('3_months');
  const [fitnessGoal, setFitnessGoal] = useState<GymFitnessGoal>('muscle_gain');
  const [startingWeightInput, setStartingWeightInput] = useState('');
  const [targetWeightInput, setTargetWeightInput] = useState('');
  const [submittingJoin, setSubmittingJoin] = useState(false);

  // Returning Member Sign-In lookup
  const [lookupPhone, setLookupPhone] = useState(() =>
    businessSlug ? loadStoredPhone(businessSlug) : '',
  );
  const [lookingUp, setLookingUp] = useState(false);

  // Check-In modal/drawer state
  const [showCheckInModal, setShowCheckInModal] = useState(false);
  const [selectedWorkoutFocus, setSelectedWorkoutFocus] =
    useState<GymWorkoutFocus>('chest');
  const [memberWorkoutNote, setMemberWorkoutNote] = useState('');
  const [countAsPtSession, setCountAsPtSession] = useState(false);
  const [checkingIn, setCheckingIn] = useState(false);

  // Plan tab state
  const [scheduleModeView, setScheduleModeView] = useState<
    'fixed_week' | 'rotation'
  >('fixed_week');
  const [expandedDayKey, setExpandedDayKey] = useState<string | null>(
    getTodayWeekKey(),
  );

  // Focused 1-Exercise-at-a-Time Active Workout Session State
  const [sessionActive, setSessionActive] = useState(false);
  const [sessionDayTitle, setSessionDayTitle] = useState('Today Workout');
  const [sessionExercises, setSessionExercises] = useState<
    GymRoutineExerciseItem[]
  >([]);
  const [activeExIdx, setActiveExIdx] = useState(0);
  const [sessionElapsedSec, setSessionElapsedSec] = useState(0);
  const [sessionSetsByEx, setSessionSetsByEx] = useState<
    Record<string, ActiveSetRowState[]>
  >({});
  const [loggingSetKey, setLoggingSetKey] = useState<string | null>(null);
  const [restSecondsLeft, setRestSecondsLeft] = useState(0);
  const [plateCalcTargetKg, setPlateCalcTargetKg] = useState<number | null>(
    null,
  );
  const [plateBarKg, setPlateBarKg] = useState<20 | 10 | 0>(20);
  const [extraExercises, setExtraExercises] = useState<
    GymRoutineExerciseItem[]
  >([]);

  // Exercises Library Tab state
  const [exSearch, setExSearch] = useState('');
  const [exMuscleFilter, setExMuscleFilter] = useState<string>('all');
  const [selectedCatalogEx, setSelectedCatalogEx] =
    useState<GymCatalogExercise | null>(null);

  // Body Measurements form (Stats -> Body Tab)
  const [showMeasureForm, setShowMeasureForm] = useState(false);
  const [mWeight, setMWeight] = useState('');
  const [mHeightCm, setMHeightCm] = useState('');
  const [mWaist, setMWaist] = useState('');
  const [mChest, setMChest] = useState('');
  const [mBiceps, setMBiceps] = useState('');
  const [mNote, setMNote] = useState('');
  const [savingMeasure, setSavingMeasure] = useState(false);

  // Renewal plan selector (Plan -> Pass Tab)
  const [renewPlanId, setRenewPlanId] = useState('3_months');
  const [renewNotice, setRenewNotice] = useState<string | null>(null);

  // Save to Home Screen PWA prompt
  const [deferredInstallPrompt, setDeferredInstallPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [showHomeGuide, setShowHomeGuide] = useState(false);

  // Global status / error alerts
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const passQrCanvasRef = useRef<HTMLCanvasElement>(null);

  const hydrateMemberExtras = useCallback(
    async (slug: string, member: GymMember) => {
      const [planData, hubData, boardData] = await Promise.all([
        businessRepository.getGymMemberWorkoutPlan({
          businessSlug: slug,
          memberId: member.id,
        }),
        businessRepository.getGymMemberAthleteHub({
          businessSlug: slug,
          memberId: member.id,
        }),
        businessRepository.getGymMonthlyLeaderboard(slug),
      ]);
      if (planData) setWorkoutPlan(planData);
      if (hubData) {
        setAthleteHub(hubData);
        if (hubData.coachPlan?.scheduleMode) {
          setScheduleModeView(hubData.coachPlan.scheduleMode);
        }
      }
      setLeaderboard(boardData);
    },
    [],
  );

  const loadPortal = useCallback(async () => {
    if (!businessSlug) {
      setLoading(false);
      return;
    }
    try {
      const [data, boardData] = await Promise.all([
        businessRepository.getPublicGymPortal(businessSlug),
        businessRepository.getGymMonthlyLeaderboard(businessSlug),
      ]);
      setPortal(data);
      setLeaderboard(boardData);
      if (data && data.config.plans.length > 0) {
        const popular =
          data.config.plans.find((p) => p.durationDays === 90) ??
          data.config.plans[0];
        setSelectedPlanId((prev) =>
          data.config.plans.some((p) => p.id === prev) ? prev : popular.id,
        );
        setRenewPlanId((prev) =>
          data.config.plans.some((p) => p.id === prev) ? prev : popular.id,
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
            if (found.todayCheckIn?.workoutFocus) {
              setSelectedWorkoutFocus(found.todayCheckIn.workoutFocus);
              setMemberWorkoutNote(found.todayCheckIn.memberNote ?? '');
            }
            await hydrateMemberExtras(businessSlug, found);
          }
        } catch {
          // Non-blocking
        }
      }
    } finally {
      setLoading(false);
    }
  }, [businessSlug, hydrateMemberExtras]);

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

  // Capture PWA install prompt
  useEffect(() => {
    function onBeforeInstall(e: Event) {
      e.preventDefault();
      setDeferredInstallPrompt(e as BeforeInstallPromptEvent);
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
    };
  }, []);

  // Rest Timer 1-second ticker with subtle chime on finish
  useEffect(() => {
    if (restSecondsLeft <= 0) return;
    const id = window.setInterval(() => {
      setRestSecondsLeft((prev) => {
        if (prev <= 1) {
          playNotificationChime('order');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [restSecondsLeft]);

  // Active session elapsed clock
  useEffect(() => {
    if (!sessionActive) return;
    const id = window.setInterval(() => {
      setSessionElapsedSec((prev) => prev + 1);
    }, 1000);
    return () => window.clearInterval(id);
  }, [sessionActive]);

  // Render scannable Digital Membership Pass QR on Plan -> Pass tab
  useEffect(() => {
    if (
      activeTab !== 'plan' ||
      planSubTab !== 'pass' ||
      !businessSlug ||
      !memberPass ||
      !passQrCanvasRef.current
    ) {
      return;
    }
    const qrText = encodeGymMemberPassQr(
      businessSlug,
      memberPass.memberCode,
      memberPass.phone,
    );
    void QRCode.toCanvas(passQrCanvasRef.current, qrText, {
      width: 176,
      margin: 2,
      errorCorrectionLevel: 'M',
      color: { dark: '#0B0D10', light: '#FFFFFF' },
    });
  }, [activeTab, planSubTab, businessSlug, memberPass]);

  // Weekly Schedule (Coach Approved OR Smart Goal Default)
  const effectiveWeeklySchedule = useMemo<GymWeeklyScheduleDay[]>(() => {
    if (
      athleteHub?.coachPlan?.weeklySchedule &&
      athleteHub.coachPlan.weeklySchedule.length > 0
    ) {
      return athleteHub.coachPlan.weeklySchedule;
    }
    return buildDefaultWeeklyScheduleForGoal(memberPass?.fitnessGoal);
  }, [athleteHub?.coachPlan, memberPass?.fitnessGoal]);

  // Effective Nutrition Plan (Coach Approved OR Smart Goal Indian Diet Default)
  const effectiveNutrition = useMemo(() => {
    const coachPlan = athleteHub?.coachPlan;
    if (coachPlan) {
      return {
        isCoachApproved: coachPlan.approvalStatus === 'approved',
        trainerName: coachPlan.trainerName ?? coachPlan.approvedBy ?? 'Coach',
        planTitle: coachPlan.planTitle,
        dailyCaloriesKcal: coachPlan.dailyCaloriesKcal,
        proteinGrams: coachPlan.proteinGrams,
        carbsGrams: coachPlan.carbsGrams,
        fatsGrams: coachPlan.fatsGrams,
        waterLiters: coachPlan.waterLiters,
        meals: coachPlan.nutritionMeals,
        supplementNotes: coachPlan.supplementNotes,
        coachNotes: coachPlan.coachNotes,
      };
    }
    const preset = getNutritionPresetForGoal(memberPass?.fitnessGoal);
    return {
      isCoachApproved: false,
      trainerName: 'Smart Goal Plan',
      planTitle: preset.planTitle,
      dailyCaloriesKcal: preset.dailyCaloriesKcal,
      proteinGrams: preset.proteinGrams,
      carbsGrams: preset.carbsGrams,
      fatsGrams: preset.fatsGrams,
      waterLiters: preset.waterLiters,
      meals: preset.meals,
      supplementNotes: preset.supplementNotes,
      coachNotes: memberPass?.trainerNotes ?? null,
    };
  }, [athleteHub, memberPass]);

  const todayWeekKey = getTodayWeekKey();

  const todayScheduleDay = useMemo(() => {
    const found = effectiveWeeklySchedule.find((d) => d.dayKey === todayWeekKey);
    if (found && !found.isRestDay && found.exercises.length > 0) return found;
    // Fallback to next active workout day if today is marked Rest Day
    return (
      effectiveWeeklySchedule.find(
        (d) => !d.isRestDay && d.exercises.length > 0,
      ) ?? effectiveWeeklySchedule[0]
    );
  }, [effectiveWeeklySchedule, todayWeekKey]);

  const weeklyActivity = useMemo(
    () => buildWeeklyActivityDays(memberPass?.recentAttendanceLogs ?? []),
    [memberPass?.recentAttendanceLogs],
  );

  const heatmapDays = useMemo(
    () =>
      build12WeekActivityHeatmap(
        (memberPass?.recentAttendanceLogs ?? []).map((l) => l.checkInDate),
      ),
    [memberPass?.recentAttendanceLogs],
  );

  const plateBreakdown = useMemo(
    () =>
      plateCalcTargetKg != null
        ? calculateBarbellPlates(plateCalcTargetKg, plateBarKg)
        : null,
    [plateCalcTargetKg, plateBarKg],
  );

  const catalogExercises = useMemo(
    () =>
      athleteHub?.exerciseCatalog ??
      workoutPlan?.exerciseCatalog ??
      [],
    [athleteHub?.exerciseCatalog, workoutPlan?.exerciseCatalog],
  );

  const filteredExercises = useMemo(() => {
    const q = exSearch.trim().toLowerCase();
    return catalogExercises.filter((ex) => {
      const matchMuscle =
        exMuscleFilter === 'all' || ex.muscleGroup === exMuscleFilter;
      const matchSearch =
        !q ||
        ex.name.toLowerCase().includes(q) ||
        ex.muscleGroup.toLowerCase().includes(q) ||
        ex.equipment.toLowerCase().includes(q);
      return matchMuscle && matchSearch;
    });
  }, [catalogExercises, exSearch, exMuscleFilter]);

  function launchWorkoutSession(
    title: string,
    exercises: GymRoutineExerciseItem[],
  ) {
    const combined = [...exercises, ...extraExercises];
    const finalExercises =
      combined.length > 0
        ? combined
        : todayScheduleDay?.exercises ?? [];
    if (finalExercises.length === 0) {
      setErrorMsg('No exercises in this day yet. Pick a workout day from Plan!');
      return;
    }

    const initialSets: Record<string, ActiveSetRowState[]> = {};
    for (const ex of finalExercises) {
      const key = ex.name.toLowerCase();
      const last = athleteHub?.lastSessionByExercise?.[ex.name];
      const defaultWt = last ? last.bestWeightKg + 2.5 : 40;
      const defaultReps = last ? last.repsAtBest : 10;
      const todayLogged = (workoutPlan?.todaySets ?? []).filter(
        (s) => s.exerciseName.toLowerCase() === key,
      );
      const count = Math.max(ex.sets || 3, todayLogged.length);
      const rows: ActiveSetRowState[] = [];
      for (let i = 1; i <= count; i++) {
        const logged = todayLogged.find((s) => s.setNumber === i);
        rows.push({
          setNumber: i,
          weightKg: logged ? logged.weightKg : defaultWt,
          reps: logged ? logged.reps : defaultReps,
          completed: Boolean(logged),
          isRecord: Boolean(logged?.isPersonalRecord),
        });
      }
      initialSets[key] = rows;
    }

    setSessionDayTitle(title);
    setSessionExercises(finalExercises);
    setSessionSetsByEx(initialSets);
    setActiveExIdx(0);
    setSessionElapsedSec(0);
    setRestSecondsLeft(0);
    setSessionActive(true);
  }

  async function handleToggleActiveSetComplete(
    ex: GymRoutineExerciseItem,
    rowIndex: number,
  ) {
    if (!businessSlug || !memberPass) return;
    const key = ex.name.toLowerCase();
    const rows = sessionSetsByEx[key] ?? [];
    const target = rows[rowIndex];
    if (!target || target.completed) return;

    setLoggingSetKey(`${key}-${target.setNumber}`);
    setErrorMsg(null);
    try {
      const res = await businessRepository.logGymMemberWorkoutSet({
        businessSlug,
        memberId: memberPass.id,
        exerciseId: ex.exerciseId ?? null,
        exerciseName: ex.name,
        muscleGroup: ex.muscleGroup,
        setNumber: target.setNumber,
        weightKg: target.weightKg,
        reps: target.reps,
      });

      setSessionSetsByEx((prev) => {
        const current = [...(prev[key] ?? [])];
        current[rowIndex] = {
          ...current[rowIndex],
          completed: true,
          isRecord: res.isPersonalRecord,
        };
        return { ...prev, [key]: current };
      });

      setRestSecondsLeft(ex.restSeconds || 90);
      if (res.isPersonalRecord) {
        playNotificationChime('order');
      }
      await hydrateMemberExtras(businessSlug, memberPass);
    } catch (err) {
      setErrorMsg((err as Error).message);
    } finally {
      setLoggingSetKey(null);
    }
  }

  function adjustActiveSetField(
    exName: string,
    rowIndex: number,
    field: 'weightKg' | 'reps',
    delta: number,
  ) {
    const key = exName.toLowerCase();
    setSessionSetsByEx((prev) => {
      const rows = [...(prev[key] ?? [])];
      const row = rows[rowIndex];
      if (!row || row.completed) return prev;
      const nextVal =
        field === 'weightKg'
          ? Math.max(0, Math.round((row.weightKg + delta) * 2) / 2)
          : Math.max(1, Math.min(200, row.reps + delta));
      rows[rowIndex] = { ...row, [field]: nextVal };
      return { ...prev, [key]: rows };
    });
  }

  function addSetToActiveExercise(exName: string) {
    const key = exName.toLowerCase();
    setSessionSetsByEx((prev) => {
      const rows = [...(prev[key] ?? [])];
      const last = rows[rows.length - 1];
      rows.push({
        setNumber: rows.length + 1,
        weightKg: last ? last.weightKg : 40,
        reps: last ? last.reps : 10,
        completed: false,
        isRecord: false,
      });
      return { ...prev, [key]: rows };
    });
  }

  async function handleJoinSubmit(e: FormEvent) {
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
      saveStoredPhone(businessSlug, created.phone);
      setLookupPhone(created.phone);
      setMemberPass(created);
      setActiveTab('plan');
      setPlanSubTab('pass');
      setSuccessMsg(
        `Registration received (${created.memberCode})! Pay at reception to activate your pass.`,
      );
      await hydrateMemberExtras(businessSlug, created);
    } catch (err) {
      setErrorMsg((err as Error).message);
    } finally {
      setSubmittingJoin(false);
    }
  }

  async function handleLookupPass(e: FormEvent) {
    e.preventDefault();
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
        setErrorMsg(
          'No membership found for that mobile number. Tap "Get Started" to join in 10 seconds!',
        );
      } else {
        saveStoredPhone(businessSlug, found.phone);
        setMemberPass(found);
        setActiveTab('home');
        await hydrateMemberExtras(businessSlug, found);
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
        workoutFocus: selectedWorkoutFocus,
        memberNote: memberWorkoutNote.trim() || null,
        isPtSession: countAsPtSession,
      });
      playNotificationChime('order');
      setCountAsPtSession(false);
      setShowCheckInModal(false);
      const refreshed = await businessRepository.lookupGymMemberPass({
        businessSlug,
        phone: memberPass.phone,
      });
      if (refreshed) {
        setMemberPass(refreshed);
        await hydrateMemberExtras(businessSlug, refreshed);
      }
      setSuccessMsg(
        res.alreadyCheckedInToday
          ? `Updated today's split to ${getWorkoutFocusMeta(res.workoutFocus).dayLabel}!`
          : `Check-In Successful! ${res.currentStreakDays ?? 1}-Day Streak active.`,
      );
    } catch (err) {
      setErrorMsg((err as Error).message);
    } finally {
      setCheckingIn(false);
    }
  }

  async function handleSaveBodyMeasurement(e: FormEvent) {
    e.preventDefault();
    if (!businessSlug || !memberPass) return;
    const wt = Number.parseFloat(mWeight);
    if (!Number.isFinite(wt) || wt < 20 || wt > 300) {
      setErrorMsg('Enter your current weight between 20 and 300 kg.');
      return;
    }
    setSavingMeasure(true);
    setErrorMsg(null);
    try {
      await businessRepository.logGymBodyMeasurement({
        businessSlug,
        phone: memberPass.phone,
        weightKg: wt,
        heightCm: mHeightCm.trim() ? Number.parseFloat(mHeightCm) : null,
        waistInches: mWaist.trim() ? Number.parseFloat(mWaist) : null,
        chestInches: mChest.trim() ? Number.parseFloat(mChest) : null,
        bicepsInches: mBiceps.trim() ? Number.parseFloat(mBiceps) : null,
        note: mNote.trim() || null,
      });
      setShowMeasureForm(false);
      setMWeight('');
      setMWaist('');
      setMChest('');
      setMBiceps('');
      setMNote('');
      const refreshed = await businessRepository.lookupGymMemberPass({
        businessSlug,
        phone: memberPass.phone,
      });
      if (refreshed) {
        setMemberPass(refreshed);
        await hydrateMemberExtras(businessSlug, refreshed);
      }
      setSuccessMsg('30-Day Body Measurement logged!');
    } catch (err) {
      setErrorMsg((err as Error).message);
    } finally {
      setSavingMeasure(false);
    }
  }

  function handleExportCsv() {
    if (!memberPass) return;
    const csv = buildGymDataExportCsv({
      memberName: memberPass.fullName,
      workouts: memberPass.recentWorkouts ?? [],
      measurements: memberPass.bodyMeasurements ?? [],
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${memberPass.memberCode.toLowerCase()}-gymos-progress.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleSaveToHomeScreen() {
    if (deferredInstallPrompt) {
      await deferredInstallPrompt.prompt();
      await deferredInstallPrompt.userChoice;
      setDeferredInstallPrompt(null);
      return;
    }
    setShowHomeGuide((prev) => !prev);
  }

  function handleSwitchMember() {
    saveStoredPhone(businessSlug, '');
    setMemberPass(null);
    setWorkoutPlan(null);
    setAthleteHub(null);
    setSessionActive(false);
    setLookupPhone('');
    setAuthMode('signin');
    setSuccessMsg(null);
    setErrorMsg(null);
  }

  // =========================================================================
  // LOADING & PORTAL NOT FOUND
  // =========================================================================
  if (loading) {
    return (
      <div className="min-h-screen bg-[#0B0D10] flex flex-col items-center justify-center py-20 text-center space-y-3">
        <Loader2 className="h-8 w-8 animate-spin text-[#C8F135]" aria-hidden />
        <p className="text-[13.5px] font-medium text-slate-400">
          Loading GymOS Athlete Portal…
        </p>
      </div>
    );
  }

  if (!portal) {
    return (
      <div className="mx-auto max-w-md rounded-2xl border border-white/10 bg-[#14171D] p-8 text-center text-white space-y-3">
        <SearchX className="mx-auto h-10 w-10 text-slate-400" aria-hidden />
        <h1 className="text-[18px] font-bold">Gym Portal Not Found</h1>
        <p className="text-[13.5px] text-slate-400">
          This gym pass link is either inactive or awaiting platform approval.
        </p>
      </div>
    );
  }

  // =========================================================================
  // 1. ONBOARDING SPLASH / JOIN / SIGN-IN (WHEN NO MEMBER PASS LOADED)
  // =========================================================================
  if (!memberPass) {
    return (
      <div className="min-h-screen bg-[#0B0D10] px-4 py-6">
        <div className="mx-auto w-full max-w-md space-y-4">
          {authMode === 'splash' && (
            <div className="gym-obsidian-mesh gym-fade-up overflow-hidden rounded-3xl text-white shadow-2xl border border-white/10">
              <div className="relative px-6 pt-7 pb-8 space-y-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#C8F135] text-[#0B0D10] shadow-[0_0_15px_rgba(200,241,53,0.4)]">
                      <Dumbbell className="h-5 w-5" aria-hidden />
                    </span>
                    <div>
                      <p className="text-[16px] font-black tracking-tight text-white">
                        {portal.business.name}
                      </p>
                      <p className="text-[11.5px] font-medium text-slate-400">
                        {portal.business.city} ·{' '}
                        <span className="tabular-nums font-semibold">
                          {portal.activeMembersCount}
                        </span>{' '}
                        Active Members
                      </p>
                    </div>
                  </div>
                  <span className="rounded-full border border-[#C8F135]/40 bg-[#C8F135]/15 px-2.5 py-0.5 text-[11px] font-extrabold text-[#C8F135]">
                    Live Pass
                  </span>
                </div>

                <AthleteSplashIllustration />

                <div className="text-center space-y-2.5">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-[#C8F135]">
                    <Flame className="h-3.5 w-3.5 text-orange-400" aria-hidden />
                    <span className="tabular-nums font-extrabold">
                      {portal.checkedInTodayCount}
                    </span>{' '}
                    Trained Today
                  </span>
                  <h1 className="text-[34px] font-black leading-[1.08] tracking-tight text-white">
                    Stronger <br />
                    <span className="text-[#C8F135]">Than Yesterday</span>
                  </h1>
                  <p className="text-[13.5px] text-slate-300 font-medium max-w-xs mx-auto leading-relaxed">
                    Join. Train. Transform. Coach-approved workouts, Indian diet
                    plans &amp; 1-tap check-in — zero app install required.
                  </p>
                </div>

                <div className="space-y-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setErrorMsg(null);
                      setAuthMode('join');
                    }}
                    className="gym-tactile flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#C8F135] px-5 text-[15px] font-black text-[#0B0D10] shadow-[0_4px_20px_rgba(200,241,53,0.4)] hover:bg-[#b8e028] cursor-pointer"
                  >
                    <span>Get Started</span>
                    <ArrowRight className="h-4.5 w-4.5" aria-hidden />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setErrorMsg(null);
                      setAuthMode('signin');
                    }}
                    className="gym-tactile flex h-11 w-full items-center justify-center gap-1.5 rounded-2xl border border-white/15 bg-white/5 text-[13.5px] font-semibold text-slate-200 hover:bg-white/10 cursor-pointer"
                  >
                    Already a Member?{' '}
                    <span className="font-extrabold text-[#C8F135]">
                      Sign In
                    </span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {authMode === 'signin' && (
            <form
              onSubmit={(e) => void handleLookupPass(e)}
              className="gym-obsidian-mesh gym-fade-up rounded-3xl p-6 text-white shadow-2xl border border-white/10 space-y-5"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#C8F135] text-[#0B0D10]">
                    <Dumbbell className="h-4.5 w-4.5" aria-hidden />
                  </span>
                  <div>
                    <h1 className="text-[18px] font-extrabold">
                      Member Sign In
                    </h1>
                    <p className="text-[12px] text-slate-400">
                      {portal.business.name}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setAuthMode('splash')}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 cursor-pointer"
                >
                  <X className="h-4 w-4" aria-hidden />
                </button>
              </div>

              {errorMsg && (
                <div
                  role="alert"
                  className="rounded-xl border border-rose-500/40 bg-rose-500/15 p-3 text-[12.5px] font-medium text-rose-200"
                >
                  {errorMsg}
                </div>
              )}

              <div className="space-y-1.5">
                <label className="block text-[12px] font-bold text-slate-300">
                  Registered Mobile Number
                </label>
                <input
                  type="tel"
                  required
                  autoFocus
                  placeholder="Enter 10-digit phone number"
                  value={lookupPhone}
                  onChange={(e) => setLookupPhone(e.target.value)}
                  className="h-12 w-full rounded-xl border border-white/15 bg-[#161920] px-4 text-[15px] font-semibold text-white placeholder:text-slate-500 focus:border-[#C8F135] focus:outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={lookingUp}
                className="gym-tactile flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#C8F135] text-[14.5px] font-extrabold text-[#0B0D10] shadow-[0_4px_16px_rgba(200,241,53,0.35)] hover:bg-[#b8e028] disabled:opacity-60 cursor-pointer"
              >
                {lookingUp ? (
                  <Loader2 className="h-4.5 w-4.5 animate-spin" aria-hidden />
                ) : (
                  <QrCode className="h-4.5 w-4.5" aria-hidden />
                )}
                Open My Athlete Hub
              </button>

              <button
                type="button"
                onClick={() => {
                  setErrorMsg(null);
                  setAuthMode('join');
                }}
                className="w-full text-center text-[12.5px] font-semibold text-slate-400 hover:text-white cursor-pointer"
              >
                New to {portal.business.name}?{' '}
                <span className="text-[#C8F135]">Register in 10s →</span>
              </button>
            </form>
          )}

          {authMode === 'join' && (
            <form
              onSubmit={(e) => void handleJoinSubmit(e)}
              className="gym-obsidian-mesh gym-fade-up rounded-3xl p-6 text-white shadow-2xl border border-white/10 space-y-4"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-[19px] font-extrabold">
                    Join {portal.business.name}
                  </h1>
                  <p className="text-[12px] text-slate-400">
                    Pick your plan &amp; pay Cash/UPI at reception
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setAuthMode('splash')}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 cursor-pointer"
                >
                  <X className="h-4 w-4" aria-hidden />
                </button>
              </div>

              {errorMsg && (
                <div
                  role="alert"
                  className="rounded-xl border border-rose-500/40 bg-rose-500/15 p-3 text-[12.5px] font-medium text-rose-200"
                >
                  {errorMsg}
                </div>
              )}

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-[11.5px] font-bold text-slate-300">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Madhan Kumar"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="h-10.5 w-full rounded-xl border border-white/15 bg-[#161920] px-3 text-[13.5px] text-white focus:border-[#C8F135] focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11.5px] font-bold text-slate-300">
                    Mobile Number *
                  </label>
                  <input
                    type="tel"
                    required
                    placeholder="10-digit mobile"
                    value={joinPhone}
                    onChange={(e) => setJoinPhone(e.target.value)}
                    className="h-10.5 w-full rounded-xl border border-white/15 bg-[#161920] px-3 text-[13.5px] text-white focus:border-[#C8F135] focus:outline-none"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-[11.5px] font-bold uppercase tracking-wider text-slate-400">
                  Choose Your Plan
                </label>
                <div className="space-y-2">
                  {portal.config.plans.map((plan) => {
                    const selected = selectedPlanId === plan.id;
                    const isPopular =
                      plan.durationDays === 90 ||
                      (plan.badge ?? '').toLowerCase().includes('popular');
                    return (
                      <button
                        key={plan.id}
                        type="button"
                        onClick={() => setSelectedPlanId(plan.id)}
                        className={`relative flex w-full items-center justify-between rounded-2xl border p-3.5 text-left transition-all cursor-pointer ${
                          selected
                            ? 'border-2 border-[#C8F135] bg-[#C8F135]/15 text-white'
                            : 'border-white/15 bg-[#161920] text-slate-200 hover:border-white/30'
                        }`}
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-[14px] font-extrabold">
                              {plan.name}
                            </span>
                            {isPopular && (
                              <span className="rounded-full bg-[#C8F135] px-2 py-0.5 text-[10px] font-black text-[#0B0D10]">
                                Most Popular
                              </span>
                            )}
                          </div>
                          <p className="text-[11.5px] text-slate-400">
                            {plan.durationDays} days · Full Gym Access
                          </p>
                        </div>
                        <span className="text-[15px] font-black text-[#C8F135] tabular-nums">
                          {formatPriceFromPaise(plan.pricePaise, 'INR')}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-[11.5px] font-bold uppercase tracking-wider text-slate-400">
                  Fitness Goal
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {GYM_FITNESS_GOAL_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setFitnessGoal(opt.value)}
                      className={`rounded-xl border px-3 py-1.5 text-[12px] font-semibold transition-colors cursor-pointer ${
                        fitnessGoal === opt.value
                          ? 'border-[#C8F135] bg-[#C8F135] text-[#0B0D10]'
                          : 'border-white/15 bg-[#161920] text-slate-300'
                      }`}
                    >
                      {opt.emoji} {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <input
                  type="number"
                  step="0.5"
                  min="20"
                  max="300"
                  placeholder="Current Wt (kg)"
                  value={startingWeightInput}
                  onChange={(e) => setStartingWeightInput(e.target.value)}
                  className="h-10 rounded-xl border border-white/15 bg-[#161920] px-3 text-[13px] text-white placeholder:text-slate-500"
                />
                <input
                  type="number"
                  step="0.5"
                  min="20"
                  max="300"
                  placeholder="Target Wt (kg)"
                  value={targetWeightInput}
                  onChange={(e) => setTargetWeightInput(e.target.value)}
                  className="h-10 rounded-xl border border-white/15 bg-[#161920] px-3 text-[13px] text-white placeholder:text-slate-500"
                />
              </div>

              <button
                type="submit"
                disabled={submittingJoin}
                className="gym-tactile flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#C8F135] text-[15px] font-black text-[#0B0D10] shadow-[0_4px_16px_rgba(200,241,53,0.35)] hover:bg-[#b8e028] disabled:opacity-60 cursor-pointer"
              >
                {submittingJoin ? (
                  <Loader2 className="h-4.5 w-4.5 animate-spin" aria-hidden />
                ) : (
                  <Sparkles className="h-4.5 w-4.5" aria-hidden />
                )}
                Register &amp; Get Digital Pass →
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  // =========================================================================
  // 2. FOCUSED 1-EXERCISE-AT-A-TIME ACTIVE WORKOUT SESSION MODE
  // =========================================================================
  if (sessionActive) {
    const activeEx = sessionExercises[activeExIdx] ?? sessionExercises[0];
    const activeKey = activeEx ? activeEx.name.toLowerCase() : '';
    const activeRows = sessionSetsByEx[activeKey] ?? [];
    const totalSetsInSession = Object.values(sessionSetsByEx).reduce(
      (sum, arr) => sum + arr.length,
      0,
    );
    const completedSetsInSession = Object.values(sessionSetsByEx).reduce(
      (sum, arr) => sum + arr.filter((r) => r.completed).length,
      0,
    );
    const sessionProgressPct =
      totalSetsInSession > 0
        ? Math.round((completedSetsInSession / totalSetsInSession) * 100)
        : 0;
    const lastSession = activeEx
      ? athleteHub?.lastSessionByExercise?.[activeEx.name]
      : undefined;
    const currentBestDraftWt = activeRows.reduce(
      (max, r) => Math.max(max, r.weightKg),
      0,
    );
    const linearDeltaKg =
      lastSession && currentBestDraftWt > lastSession.bestWeightKg
        ? Math.round((currentBestDraftWt - lastSession.bestWeightKg) * 10) / 10
        : 0;

    return (
      <div className="min-h-screen bg-[#0B0D10] text-white px-4 pt-3 pb-36">
        <div className="mx-auto w-full max-w-md space-y-4">
          {/* Top Session Header */}
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setSessionActive(false)}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-[#14171D] border border-white/10 text-slate-300 hover:text-white cursor-pointer"
              aria-label="Minimize workout session"
            >
              <ChevronDown className="h-4.5 w-4.5" aria-hidden />
            </button>
            <div className="text-center">
              <p className="text-[15px] font-black tracking-tight text-white">
                {sessionDayTitle}
              </p>
              <p className="text-[11.5px] font-semibold text-slate-400 tabular-nums">
                {formatTimerClock(sessionElapsedSec)} ·{' '}
                {completedSetsInSession}/{totalSetsInSession} sets
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setSessionActive(false);
                setSuccessMsg(
                  `Great session! ${completedSetsInSession} sets completed in ${formatTimerClock(sessionElapsedSec)}.`,
                );
              }}
              className="gym-tactile rounded-full bg-[#C8F135] px-4 py-1.5 text-[12.5px] font-black text-[#0B0D10] cursor-pointer"
            >
              Finish
            </button>
          </div>

          {/* Slim Progress Bar */}
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#1E222B]">
            <div
              className="h-full rounded-full bg-[#C8F135] transition-all duration-300"
              style={{ width: `${Math.max(4, sessionProgressPct)}%` }}
            />
          </div>

          {/* Horizontal Numbered Exercise Stepper Circles (1 2 3 4 5) */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 overflow-x-auto py-1">
              {sessionExercises.map((ex, idx) => {
                const k = ex.name.toLowerCase();
                const rows = sessionSetsByEx[k] ?? [];
                const allDone =
                  rows.length > 0 && rows.every((r) => r.completed);
                const isCurrent = idx === activeExIdx;
                return (
                  <button
                    key={`${ex.name}-${idx}`}
                    type="button"
                    onClick={() => setActiveExIdx(idx)}
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[13px] font-black tabular-nums transition-all cursor-pointer ${
                      isCurrent
                        ? 'bg-[#C8F135] text-[#0B0D10] ring-4 ring-[#C8F135]/25'
                        : allDone
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                          : 'bg-[#14171D] text-slate-400 border border-white/10 hover:text-white'
                    }`}
                  >
                    {allDone && !isCurrent ? '✓' : idx + 1}
                  </button>
                );
              })}
            </div>
            {activeEx && (
              <GymMuscleMapSvg
                activeMuscles={[activeEx.muscleGroup]}
                compact
              />
            )}
          </div>

          {errorMsg && (
            <div
              role="alert"
              className="rounded-2xl border border-rose-500/40 bg-rose-500/15 px-4 py-2.5 text-[12.5px] text-rose-200"
            >
              {errorMsg}
            </div>
          )}

          {/* Focused 1-Exercise Card */}
          {activeEx && (
            <div className="rounded-3xl bg-[#14171D] border border-white/[0.08] p-4 space-y-4">
              <div className="flex items-start gap-3">
                <ExerciseAnimationPreview
                  animationKey={activeEx.animationKey}
                  animationGifUrl={activeEx.animationGifUrl}
                  exerciseName={activeEx.name}
                  muscleGroup={activeEx.muscleGroup}
                  variant="compact"
                />
                <div className="min-w-0 flex-1">
                  <h2 className="text-[18px] font-black leading-tight text-white">
                    {activeEx.name}
                  </h2>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px] font-bold">
                    <span className="rounded-md bg-[#1E222B] px-2 py-0.5 text-slate-300 capitalize">
                      {activeEx.muscleGroup}
                    </span>
                    <span className="rounded-md bg-[#1E222B] px-2 py-0.5 text-[#C8F135] tabular-nums">
                      Plan: {activeEx.sets} × {activeEx.reps}
                    </span>
                    {lastSession && (
                      <span className="rounded-md bg-[#1E222B] px-2 py-0.5 text-slate-400 tabular-nums">
                        Best: {lastSession.bestWeightKg} kg
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {lastSession ? (
                <div className="rounded-2xl bg-[#0B0D10]/70 border border-white/[0.06] px-3.5 py-2.5 space-y-1">
                  <p className="text-[11.5px] text-slate-400">
                    Last time:{' '}
                    <span className="text-slate-200 font-semibold tabular-nums">
                      {lastSession.summary}
                    </span>
                  </p>
                  {linearDeltaKg > 0 && (
                    <p className="text-[11.5px] font-bold text-[#C8F135]">
                      ↑ Linear progression · +{linearDeltaKg} kg more than last
                      time
                    </p>
                  )}
                </div>
              ) : (
                activeEx.formCues && (
                  <p className="rounded-2xl bg-[#0B0D10]/70 border border-white/[0.06] px-3.5 py-2.5 text-[11.5px] text-slate-300">
                    💡 Form cue: {activeEx.formCues}
                  </p>
                )
              )}

              {/* Set Table Header */}
              <div className="grid grid-cols-[28px_1fr_1fr_42px] gap-2 px-1 text-[10.5px] font-bold uppercase tracking-wider text-slate-500">
                <span>Set</span>
                <span className="text-center">Weight (kg)</span>
                <span className="text-center">Reps</span>
                <span className="text-center">Done</span>
              </div>

              {/* Tactile Stepper Rows */}
              <div className="space-y-2.5">
                {activeRows.map((row, rIdx) => {
                  const isBusy =
                    loggingSetKey === `${activeKey}-${row.setNumber}`;
                  return (
                    <div key={row.setNumber} className="space-y-1.5">
                      <div
                        className={`grid grid-cols-[28px_1fr_1fr_42px] items-center gap-2 rounded-2xl p-2 transition-colors ${
                          row.completed
                            ? 'bg-emerald-500/10 border border-emerald-500/30'
                            : 'bg-[#1E222B] border border-white/[0.06]'
                        }`}
                      >
                        <span
                          className={`flex h-7 w-7 items-center justify-center rounded-full text-[12px] font-black tabular-nums ${
                            row.completed
                              ? 'bg-[#C8F135] text-[#0B0D10]'
                              : 'bg-[#14171D] text-slate-300'
                          }`}
                        >
                          {row.setNumber}
                        </span>

                        {/* Weight -/+ Stepper */}
                        <div className="flex items-center justify-between rounded-xl bg-[#14171D] px-1.5 py-1">
                          <button
                            type="button"
                            disabled={row.completed}
                            onClick={() =>
                              adjustActiveSetField(
                                activeEx.name,
                                rIdx,
                                'weightKg',
                                -2.5,
                              )
                            }
                            className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-white/10 hover:text-white disabled:opacity-40 cursor-pointer"
                            aria-label="Decrease weight"
                          >
                            <Minus className="h-3.5 w-3.5" aria-hidden />
                          </button>
                          <span className="text-[14px] font-black tabular-nums text-white">
                            {row.weightKg}
                          </span>
                          <button
                            type="button"
                            disabled={row.completed}
                            onClick={() =>
                              adjustActiveSetField(
                                activeEx.name,
                                rIdx,
                                'weightKg',
                                2.5,
                              )
                            }
                            className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-white/10 hover:text-white disabled:opacity-40 cursor-pointer"
                            aria-label="Increase weight"
                          >
                            <Plus className="h-3.5 w-3.5" aria-hidden />
                          </button>
                        </div>

                        {/* Reps -/+ Stepper */}
                        <div className="flex items-center justify-between rounded-xl bg-[#14171D] px-1.5 py-1">
                          <button
                            type="button"
                            disabled={row.completed}
                            onClick={() =>
                              adjustActiveSetField(
                                activeEx.name,
                                rIdx,
                                'reps',
                                -1,
                              )
                            }
                            className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-white/10 hover:text-white disabled:opacity-40 cursor-pointer"
                            aria-label="Decrease reps"
                          >
                            <Minus className="h-3.5 w-3.5" aria-hidden />
                          </button>
                          <span className="text-[14px] font-black tabular-nums text-white">
                            {row.reps}
                          </span>
                          <button
                            type="button"
                            disabled={row.completed}
                            onClick={() =>
                              adjustActiveSetField(
                                activeEx.name,
                                rIdx,
                                'reps',
                                1,
                              )
                            }
                            className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-white/10 hover:text-white disabled:opacity-40 cursor-pointer"
                            aria-label="Increase reps"
                          >
                            <Plus className="h-3.5 w-3.5" aria-hidden />
                          </button>
                        </div>

                        {/* 1-Tap Completion Circle */}
                        <button
                          type="button"
                          disabled={row.completed || isBusy}
                          onClick={() =>
                            void handleToggleActiveSetComplete(activeEx, rIdx)
                          }
                          className={`gym-tactile flex h-9 w-9 items-center justify-center rounded-full border transition-all cursor-pointer ${
                            row.completed
                              ? 'border-[#C8F135] bg-[#C8F135] text-[#0B0D10]'
                              : 'border-white/25 bg-[#14171D] text-slate-400 hover:border-[#C8F135] hover:text-[#C8F135]'
                          }`}
                          aria-label={`Complete set ${row.setNumber}`}
                        >
                          {isBusy ? (
                            <Loader2
                              className="h-4 w-4 animate-spin"
                              aria-hidden
                            />
                          ) : (
                            <Check className="h-4 w-4 stroke-[3]" aria-hidden />
                          )}
                        </button>
                      </div>

                      {row.isRecord && (
                        <p className="px-2 text-[11.5px] font-extrabold text-[#C8F135]">
                          🏆 Record! Heaviest yet · New Personal Best
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* + Add Set & Plate Math */}
              <div className="flex items-center justify-between pt-1">
                <button
                  type="button"
                  onClick={() => addSetToActiveExercise(activeEx.name)}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-[#1E222B] px-3 py-1.5 text-[12px] font-bold text-[#C8F135] hover:bg-white/10 cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5" aria-hidden /> Add set
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setPlateCalcTargetKg(currentBestDraftWt || 60)
                  }
                  className="inline-flex items-center gap-1 rounded-xl border border-white/10 bg-[#1E222B] px-3 py-1.5 text-[12px] font-bold text-slate-300 hover:text-white cursor-pointer"
                >
                  Plate Math ({currentBestDraftWt || 60} kg)
                </button>
              </div>
            </div>
          )}

          {/* Prev / Next Exercise Navigation */}
          <div className="flex items-center justify-between px-2">
            <button
              type="button"
              disabled={activeExIdx === 0}
              onClick={() => setActiveExIdx((i) => Math.max(0, i - 1))}
              className="inline-flex items-center gap-1 text-[13px] font-bold text-slate-400 hover:text-white disabled:opacity-30 cursor-pointer"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden /> Prev
            </button>
            <span className="text-[11.5px] font-bold text-slate-500 tabular-nums">
              Exercise {activeExIdx + 1} of {sessionExercises.length}
            </span>
            <button
              type="button"
              disabled={activeExIdx >= sessionExercises.length - 1}
              onClick={() =>
                setActiveExIdx((i) =>
                  Math.min(sessionExercises.length - 1, i + 1),
                )
              }
              className="inline-flex items-center gap-1 text-[13px] font-bold text-[#C8F135] hover:opacity-90 disabled:opacity-30 cursor-pointer"
            >
              Next <ChevronRight className="h-4 w-4" aria-hidden />
            </button>
          </div>
        </div>

        {/* Sticky Bottom Rest Timer Bar */}
        <div className="fixed bottom-3 left-1/2 z-40 w-[calc(100%-1.5rem)] max-w-md -translate-x-1/2 rounded-2xl border border-white/15 bg-[#14171D]/95 px-4 py-3 text-white shadow-2xl backdrop-blur-md flex items-center justify-between gap-2">
          <div>
            <p className="text-[20px] font-black leading-none tabular-nums text-white">
              {restSecondsLeft > 0
                ? formatTimerClock(restSecondsLeft)
                : 'Ready'}
            </p>
            <p className="text-[10.5px] font-semibold text-slate-400 mt-0.5">
              Rest timer
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() =>
                setRestSecondsLeft((s) => Math.max(0, s - 15))
              }
              className="rounded-xl bg-[#1E222B] px-2.5 py-2 text-[12px] font-bold text-slate-300 hover:text-white cursor-pointer"
            >
              -15s
            </button>
            <button
              type="button"
              onClick={() => setRestSecondsLeft((s) => s + 15)}
              className="rounded-xl bg-[#1E222B] px-2.5 py-2 text-[12px] font-bold text-slate-300 hover:text-white cursor-pointer"
            >
              +15s
            </button>
            <button
              type="button"
              onClick={() => setRestSecondsLeft(0)}
              className="gym-tactile rounded-xl bg-[#C8F135] px-4 py-2 text-[12.5px] font-black text-[#0B0D10] cursor-pointer"
            >
              Skip
            </button>
          </div>
        </div>

        {/* Barbell Plate Math Modal */}
        {plateBreakdown && (
          <div
            role="dialog"
            aria-modal="true"
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs"
          >
            <div className="w-full max-w-sm rounded-3xl bg-[#14171D] border border-white/10 p-5 text-white shadow-2xl space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-[16px] font-extrabold">
                  Barbell Plate Calculator
                </h3>
                <button
                  type="button"
                  onClick={() => setPlateCalcTargetKg(null)}
                  className="rounded-lg p-1 text-slate-400 hover:bg-white/10 cursor-pointer"
                >
                  <X className="h-4 w-4" aria-hidden />
                </button>
              </div>
              <div className="flex gap-1.5">
                {([20, 10, 0] as const).map((b) => (
                  <button
                    key={b}
                    type="button"
                    onClick={() => setPlateBarKg(b)}
                    className={`flex-1 rounded-xl py-2 text-[12px] font-bold cursor-pointer ${
                      plateBarKg === b
                        ? 'bg-[#C8F135] text-[#0B0D10]'
                        : 'bg-[#1E222B] text-slate-300'
                    }`}
                  >
                    {b === 0 ? 'Machine (0kg)' : `${b} kg Bar`}
                  </button>
                ))}
              </div>
              <div className="rounded-2xl bg-[#0B0D10] p-4 text-center space-y-2 border border-white/10">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Load per side for {plateBreakdown.achievedTotalKg} kg
                </p>
                {plateBreakdown.platesPerSide.length === 0 ? (
                  <p className="text-[14px] font-bold text-white">
                    Empty Bar Only ({plateBarKg} kg)
                  </p>
                ) : (
                  <div className="flex flex-wrap justify-center gap-2 pt-1">
                    {plateBreakdown.platesPerSide.map((p) => (
                      <span
                        key={p.plateKg}
                        className="rounded-xl bg-[#C8F135] px-3 py-1.5 text-[13px] font-black text-[#0B0D10] tabular-nums"
                      >
                        {p.count} × {p.plateKg} kg
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // =========================================================================
  // 3. POST-LOGIN DARK OBSIDIAN 5-TAB ATHLETE APP
  // =========================================================================
  const firstName = memberPass.fullName.split(' ')[0] || memberPass.fullName;
  const currentStreak = memberPass.currentStreakDays ?? 0;
  const weekStreakCount =
    athleteHub?.weekStreakCount ??
    (currentStreak > 0 ? Math.max(1, Math.floor(currentStreak / 7)) : 0);
  const ptLeft = memberPass.ptRemainingSessions ?? 0;
  const balanceDue = memberPass.balanceDuePaise ?? 0;
  const isFrozen = Boolean(memberPass.isFrozen);
  const isCanTrain =
    memberPass.effectiveStatus === 'active' ||
    memberPass.effectiveStatus === 'expiring_soon';

  const workoutsThisMonth =
    athleteHub?.workoutsThisMonth ?? memberPass.daysAttendedThisMonth ?? 0;
  const monthlyWorkoutTarget = athleteHub?.monthlyWorkoutTarget ?? 16;
  const volumeThisMonthKg = athleteHub?.volumeThisMonthKg ?? 0;
  const monthlyVolumeTargetKg = athleteHub?.monthlyVolumeTargetKg ?? 25000;
  const weightCheckInsThisMonth =
    athleteHub?.weightCheckInsThisMonth ??
    (memberPass.bodyMeasurements ?? []).length;
  const totalVolumeLiftedKg = athleteHub?.totalVolumeLiftedKg ?? 0;
  const latestWeightKg =
    memberPass.bodyMeasurements?.[0]?.weightKg ??
    memberPass.startingWeightKg ??
    null;

  const workoutsThisWeekCount = weeklyActivity.filter((d) => d.trained).length;
  const weeklyTargetDays = effectiveWeeklySchedule.filter(
    (d) => !d.isRestDay,
  ).length;
  const remainingThisWeek = Math.max(0, weeklyTargetDays - workoutsThisWeekCount);

  const levelNumber = Math.max(
    1,
    Math.floor((memberPass.totalCheckIns || 0) / 10) + 1,
  );
  const levelProgressPct = ((memberPass.totalCheckIns || 0) % 10) * 10;

  return (
    <div className="min-h-screen bg-[#0B0D10] text-white px-4 pt-3 pb-28">
      <div className="mx-auto w-full max-w-md space-y-4">
        {/* Global Alerts */}
        {successMsg && (
          <div className="rounded-2xl border border-[#C8F135]/40 bg-[#C8F135]/10 px-4 py-3 text-[13px] font-semibold text-[#C8F135] flex items-center justify-between gap-2">
            <span>{successMsg}</span>
            <button
              type="button"
              onClick={() => setSuccessMsg(null)}
              className="text-[#C8F135] cursor-pointer"
            >
              <X className="h-3.5 w-3.5" aria-hidden />
            </button>
          </div>
        )}

        {errorMsg && (
          <div
            role="alert"
            className="rounded-2xl border border-rose-500/40 bg-rose-500/15 px-4 py-3 text-[13px] font-medium text-rose-200 flex items-center justify-between gap-2"
          >
            <span>{errorMsg}</span>
            <button
              type="button"
              onClick={() => setErrorMsg(null)}
              className="text-rose-300 cursor-pointer"
            >
              <X className="h-3.5 w-3.5" aria-hidden />
            </button>
          </div>
        )}

        {/* ==================== TAB 1: HOME (CLEAN DAILY COMMAND SCREEN) ==================== */}
        {activeTab === 'home' && (
          <div className="space-y-4 gym-fade-up">
            {/* Dark Athlete Header */}
            <div className="flex items-start justify-between gap-3">
              <div>
                <h1 className="text-[22px] font-black tracking-tight text-white">
                  {portal.business.name}
                </h1>
                <p className="text-[12.5px] font-medium text-slate-400">
                  {todayFormatted} · Hello, {toTitleCase(firstName)}
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleSwitchMember}
                  className="rounded-full border border-white/10 bg-[#14171D] px-2.5 py-1.5 text-[11px] font-semibold text-slate-300 hover:text-white tabular-nums cursor-pointer"
                  title="Switch Phone Number"
                >
                  +91 {memberPass.phone.slice(-4)} · Switch
                </button>
              </div>
            </div>

            {/* Reception Static QR Check-In Strip */}
            {isFrozen ? (
              <div className="rounded-2xl border border-sky-500/30 bg-sky-500/10 px-4 py-3 flex items-center gap-3 text-[12.5px] text-sky-200">
                <Snowflake className="h-4.5 w-4.5 text-sky-400 shrink-0" aria-hidden />
                <span>
                  Membership Frozen since{' '}
                  {formatIsoDatePretty(memberPass.frozenStartedAt)}. Ask reception
                  to resume.
                </span>
              </div>
            ) : !isCanTrain ? (
              <button
                type="button"
                onClick={() => {
                  setActiveTab('plan');
                  setPlanSubTab('pass');
                }}
                className="w-full rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 flex items-center justify-between gap-3 text-left cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <AlertTriangle
                    className="h-4.5 w-4.5 text-amber-400 shrink-0"
                    aria-hidden
                  />
                  <div>
                    <p className="text-[13px] font-extrabold text-amber-200">
                      {memberPass.effectiveStatus === 'pending_approval'
                        ? 'Awaiting Reception Approval'
                        : 'Plan Expired — Tap to Renew'}
                    </p>
                    <p className="text-[11px] text-amber-300/80">
                      Pass {memberPass.memberCode} · Open Pass &amp; Renew
                    </p>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-amber-300" aria-hidden />
              </button>
            ) : memberPass.checkedInToday ? (
              <div className="rounded-2xl border border-[#C8F135]/35 bg-[#14171D] px-4 py-3 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#C8F135] text-[#0B0D10]">
                    <Check className="h-4 w-4 stroke-[3]" aria-hidden />
                  </span>
                  <div>
                    <p className="text-[13px] font-extrabold text-white">
                      Checked In Today
                    </p>
                    <p className="text-[11px] text-slate-400 tabular-nums">
                      {formatCheckInTime12h(
                        memberPass.todayCheckIn?.checkedInAt ??
                          memberPass.lastCheckInAt,
                      )}{' '}
                      · 🔥 {Math.max(1, currentStreak)}d streak
                    </p>
                  </div>
                </div>
                <span className="rounded-full bg-[#C8F135]/15 px-2.5 py-0.5 text-[11px] font-bold text-[#C8F135]">
                  {memberPass.daysRemaining}d left
                </span>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowCheckInModal(true)}
                className="gym-tactile w-full rounded-2xl border border-[#C8F135]/40 bg-[#14171D] px-4 py-3 flex items-center justify-between gap-2 hover:border-[#C8F135] cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#C8F135] text-[#0B0D10]">
                    <QrCode className="h-4 w-4" aria-hidden />
                  </span>
                  <div className="text-left">
                    <p className="text-[13.5px] font-extrabold text-white">
                      Reception QR Check-In
                    </p>
                    <p className="text-[11px] text-slate-400">
                      Tap to log today&apos;s gym attendance
                    </p>
                  </div>
                </div>
                <span className="rounded-full bg-[#C8F135] px-3 py-1 text-[11.5px] font-black text-[#0B0D10]">
                  Check In
                </span>
              </button>
            )}

            {/* 7-Day Week Strip Card */}
            <div className="rounded-3xl bg-[#14171D] border border-white/[0.07] p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[12px] font-bold text-slate-400">
                  This week
                </span>
                <span className="text-[11.5px] font-semibold text-slate-400 tabular-nums">
                  {remainingThisWeek} of {weeklyTargetDays} left this week
                </span>
              </div>

              <div className="grid grid-cols-7 gap-1.5 text-center">
                {weeklyActivity.map((day) => {
                  const dtNum = Number.parseInt(day.isoDate.slice(8, 10), 10);
                  return (
                    <div
                      key={day.isoDate}
                      className="flex flex-col items-center gap-1"
                    >
                      <span className="text-[10.5px] font-bold text-slate-500">
                        {day.dayLabel.slice(0, 2)}
                      </span>
                      <span
                        className={`flex h-9 w-9 items-center justify-center rounded-full text-[13px] font-black tabular-nums ${
                          day.isToday
                            ? 'bg-[#C8F135] text-[#0B0D10] shadow-[0_0_16px_rgba(200,241,53,0.45)]'
                            : day.trained
                              ? 'bg-[#1E222B] text-white border border-emerald-500/40'
                              : 'text-slate-400'
                        }`}
                      >
                        {dtNum}
                      </span>
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${
                          day.trained ? 'bg-emerald-400' : 'bg-transparent'
                        }`}
                      />
                    </div>
                  );
                })}
              </div>

              {/* Today's Workout Card */}
              {todayScheduleDay && (
                <div className="rounded-2xl bg-[#1E222B] border border-white/[0.06] p-3.5 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#C8F135]/15 text-[#C8F135]">
                      <Dumbbell className="h-5 w-5" aria-hidden />
                    </span>
                    <div className="min-w-0">
                      <span className="inline-block rounded-md bg-[#C8F135]/15 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-[#C8F135]">
                        Today
                      </span>
                      <p className="mt-0.5 text-[16px] font-black text-white truncate">
                        {todayScheduleDay.focusTitle}
                      </p>
                      <p className="text-[11px] text-slate-400 tabular-nums">
                        {todayScheduleDay.exercises.length} exercises
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <GymMuscleMapSvg
                      activeMuscles={Array.from(
                        new Set(
                          todayScheduleDay.exercises.map((e) => e.muscleGroup),
                        ),
                      )}
                      compact
                    />
                    <button
                      type="button"
                      onClick={() =>
                        launchWorkoutSession(
                          todayScheduleDay.focusTitle,
                          todayScheduleDay.exercises,
                        )
                      }
                      className="gym-tactile rounded-xl bg-[#C8F135] px-3.5 py-2 text-[12.5px] font-black text-[#0B0D10] cursor-pointer"
                    >
                      Start →
                    </button>
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={() => {
                  setActiveTab('plan');
                  setPlanSubTab('schedule');
                }}
                className="w-full text-center text-[12px] font-semibold text-slate-400 hover:text-white cursor-pointer pt-0.5"
              >
                ⇄ Choose a different workout
              </button>
            </div>

            {/* Smart Recovery Insight Card */}
            <div className="rounded-3xl bg-[#14171D] border border-white/[0.07] p-4 flex items-center gap-3.5">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#C8F135]/15 text-[#C8F135]">
                <Sparkles className="h-5 w-5" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Recovery Insight
                </p>
                <p className="text-[13.5px] font-bold text-white leading-snug mt-0.5">
                  {athleteHub?.recoveryInsight?.message ??
                    "Your back hasn't had any work in 7 days. Today's plan takes care of that."}
                </p>
              </div>
            </div>

            {/* This Month's Challenges Card */}
            <div className="rounded-3xl bg-[#14171D] border border-white/[0.07] p-4 space-y-3.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/20 text-amber-400">
                    <Trophy className="h-4 w-4" aria-hidden />
                  </span>
                  <h2 className="text-[14.5px] font-extrabold text-white">
                    This month&apos;s challenges
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('stats')}
                  className="text-[11.5px] font-bold text-[#C8F135] cursor-pointer"
                >
                  Stats →
                </button>
              </div>

              {[
                {
                  label: `${monthlyWorkoutTarget} workouts this month`,
                  current: workoutsThisMonth,
                  target: monthlyWorkoutTarget,
                  suffix: '',
                },
                {
                  label: `Lift ${(monthlyVolumeTargetKg / 1000).toFixed(0)} t this month`,
                  current: volumeThisMonthKg,
                  target: monthlyVolumeTargetKg,
                  suffix: ' kg',
                },
                {
                  label: 'Log your weight 8 times',
                  current: weightCheckInsThisMonth,
                  target: 8,
                  suffix: '',
                },
              ].map((ch) => {
                const pct = Math.min(
                  100,
                  Math.round((ch.current / Math.max(1, ch.target)) * 100),
                );
                return (
                  <div key={ch.label} className="space-y-1.5">
                    <div className="flex items-center justify-between text-[12px]">
                      <span className="font-semibold text-slate-200">
                        {ch.label}
                      </span>
                      <span className="font-bold text-slate-400 tabular-nums">
                        {ch.current.toLocaleString('en-IN')} /{' '}
                        {ch.target.toLocaleString('en-IN')}
                        {ch.suffix}
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-[#1E222B]">
                      <div
                        className="h-full rounded-full bg-[#C8F135] transition-all duration-500"
                        style={{ width: `${Math.max(4, pct)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ==================== TAB 2: PLAN (SCHEDULE + NUTRITION & DIET + PASS) ==================== */}
        {activeTab === 'plan' && (
          <div className="space-y-4 gym-fade-up">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h1 className="text-[22px] font-black tracking-tight text-white">
                  Plan
                </h1>
                <p className="text-[12px] text-slate-400">
                  Your weekly routine &amp; nutrition
                </p>
              </div>
              <span
                className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-extrabold ${
                  effectiveNutrition.isCoachApproved
                    ? 'bg-[#C8F135]/15 border border-[#C8F135]/40 text-[#C8F135]'
                    : 'bg-[#14171D] border border-white/10 text-slate-300'
                }`}
              >
                <Sparkles className="h-3 w-3" aria-hidden />
                {effectiveNutrition.isCoachApproved
                  ? `Coach Approved · ${effectiveNutrition.trainerName}`
                  : 'Smart Goal Plan'}
              </span>
            </div>

            {/* Sub-Tabs */}
            <div className="grid grid-cols-3 gap-1.5 rounded-2xl bg-[#14171D] p-1 border border-white/[0.07]">
              {(
                [
                  { id: 'schedule', label: 'Schedule' },
                  { id: 'nutrition', label: 'Nutrition' },
                  { id: 'pass', label: 'Pass & Renew' },
                ] as const
              ).map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setPlanSubTab(t.id)}
                  className={`rounded-xl py-2 text-[12px] font-extrabold transition-colors cursor-pointer ${
                    planSubTab === t.id
                      ? 'bg-[#1E222B] text-[#C8F135]'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* SUB-TAB A: WEEKLY SCHEDULE */}
            {planSubTab === 'schedule' && (
              <div className="space-y-3">
                <div className="rounded-2xl bg-[#14171D] border border-white/[0.07] p-3.5 space-y-2.5">
                  <div className="flex items-center justify-between text-[12px] font-bold text-slate-300">
                    <span>How you train</span>
                    <span className="text-[11px] text-slate-500">
                      {effectiveNutrition.planTitle}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5 rounded-xl bg-[#0B0D10] p-1">
                    {(['fixed_week', 'rotation'] as const).map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setScheduleModeView(m)}
                        className={`rounded-lg py-1.5 text-[12px] font-bold cursor-pointer ${
                          scheduleModeView === m
                            ? 'bg-[#1E222B] text-white'
                            : 'text-slate-500'
                        }`}
                      >
                        {m === 'fixed_week' ? 'Fixed Week' : 'Rotation'}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  {effectiveWeeklySchedule.map((day) => {
                    const isExpanded = expandedDayKey === day.dayKey;
                    const isToday = day.dayKey === todayWeekKey;
                    return (
                      <div
                        key={day.dayKey}
                        className={`rounded-2xl bg-[#14171D] border transition-colors ${
                          isToday
                            ? 'border-[#C8F135]/40'
                            : 'border-white/[0.07]'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedDayKey(isExpanded ? null : day.dayKey)
                          }
                          className="w-full p-3.5 flex items-center justify-between gap-3 text-left cursor-pointer"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <span
                              className={`w-7 text-[13px] font-black ${
                                isToday ? 'text-[#C8F135]' : 'text-slate-400'
                              }`}
                            >
                              {day.dayLabel}
                            </span>
                            <span
                              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                                day.isRestDay
                                  ? 'bg-[#1E222B] text-slate-500'
                                  : 'bg-[#C8F135]/15 text-[#C8F135]'
                              }`}
                            >
                              {day.isRestDay ? (
                                <Snowflake className="h-4 w-4" aria-hidden />
                              ) : (
                                <Dumbbell className="h-4 w-4" aria-hidden />
                              )}
                            </span>
                            <div className="min-w-0">
                              <p className="text-[14px] font-extrabold text-white truncate">
                                {day.focusTitle}
                              </p>
                              <p className="text-[11px] text-slate-400">
                                {day.isRestDay
                                  ? 'Recovery & mobility day'
                                  : `${day.exercises.length} exercises`}
                              </p>
                            </div>
                          </div>
                          {!day.isRestDay && (
                            <GymMuscleMapSvg
                              activeMuscles={Array.from(
                                new Set(
                                  day.exercises.map((e) => e.muscleGroup),
                                ),
                              )}
                              compact
                            />
                          )}
                        </button>

                        {isExpanded && !day.isRestDay && (
                          <div className="border-t border-white/[0.06] px-3.5 pb-3.5 pt-2.5 space-y-2">
                            {day.exercises.map((ex, i) => (
                              <div
                                key={`${ex.name}-${i}`}
                                className="flex items-center justify-between rounded-xl bg-[#1E222B] px-3 py-2 text-[12px]"
                              >
                                <span className="font-bold text-white">
                                  {ex.name}
                                </span>
                                <span className="text-slate-400 tabular-nums">
                                  {ex.sets} × {ex.reps}
                                </span>
                              </div>
                            ))}
                            <button
                              type="button"
                              onClick={() =>
                                launchWorkoutSession(
                                  day.focusTitle,
                                  day.exercises,
                                )
                              }
                              className="gym-tactile mt-1 flex h-10 w-full items-center justify-center gap-1.5 rounded-xl bg-[#C8F135] text-[13px] font-black text-[#0B0D10] cursor-pointer"
                            >
                              <Play className="h-3.5 w-3.5 fill-current" aria-hidden />
                              Start {day.focusTitle}
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* SUB-TAB B: PERSONALIZED FOOD & NUTRITION PLAN */}
            {planSubTab === 'nutrition' && (
              <div className="space-y-3.5">
                <div className="rounded-3xl bg-[#14171D] border border-white/[0.07] p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-wider text-[#C8F135]">
                        Daily Macro Targets
                      </p>
                      <h2 className="text-[22px] font-black tabular-nums text-white">
                        {effectiveNutrition.dailyCaloriesKcal.toLocaleString(
                          'en-IN',
                        )}{' '}
                        kcal
                      </h2>
                    </div>
                    <span className="inline-flex items-center gap-1.5 rounded-xl bg-sky-500/15 border border-sky-500/30 px-3 py-1.5 text-[12px] font-extrabold text-sky-300 tabular-nums">
                      <Droplets className="h-3.5 w-3.5" aria-hidden />
                      {effectiveNutrition.waterLiters}L Water
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    {[
                      {
                        label: 'Protein',
                        grams: effectiveNutrition.proteinGrams,
                        color: 'bg-[#C8F135]',
                        text: 'text-[#C8F135]',
                      },
                      {
                        label: 'Carbs',
                        grams: effectiveNutrition.carbsGrams,
                        color: 'bg-sky-400',
                        text: 'text-sky-300',
                      },
                      {
                        label: 'Fats',
                        grams: effectiveNutrition.fatsGrams,
                        color: 'bg-amber-400',
                        text: 'text-amber-300',
                      },
                    ].map((macro) => (
                      <div
                        key={macro.label}
                        className="rounded-2xl bg-[#1E222B] p-3 space-y-1.5"
                      >
                        <p className="text-[11px] font-semibold text-slate-400">
                          {macro.label}
                        </p>
                        <p
                          className={`text-[17px] font-black tabular-nums ${macro.text}`}
                        >
                          {macro.grams}g
                        </p>
                        <div className="h-1.5 w-full rounded-full bg-[#0B0D10]">
                          <div
                            className={`h-full rounded-full ${macro.color}`}
                            style={{ width: '75%' }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Meal-by-Meal Schedule */}
                <div className="rounded-3xl bg-[#14171D] border border-white/[0.07] p-4 space-y-3">
                  <h3 className="text-[14.5px] font-extrabold text-white flex items-center gap-2">
                    <Utensils className="h-4 w-4 text-[#C8F135]" aria-hidden />
                    Meal-by-Meal Indian Diet Plan
                  </h3>
                  <div className="space-y-2.5">
                    {effectiveNutrition.meals.map((meal, idx) => (
                      <div
                        key={`${meal.mealTime}-${idx}`}
                        className="rounded-2xl bg-[#1E222B] border border-white/[0.05] p-3 space-y-1"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[12px] font-extrabold text-[#C8F135]">
                            {meal.mealTime}
                          </span>
                          <span className="text-[11px] font-bold text-slate-400 tabular-nums">
                            {meal.calories} kcal · {meal.protein}g P
                          </span>
                        </div>
                        <p className="text-[13px] font-medium text-slate-200 leading-snug">
                          {meal.items}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                {(effectiveNutrition.supplementNotes ||
                  effectiveNutrition.coachNotes) && (
                  <div className="rounded-2xl bg-[#14171D] border border-white/[0.07] p-4 space-y-2">
                    {effectiveNutrition.supplementNotes && (
                      <div>
                        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                          Supplements &amp; Hydration
                        </p>
                        <p className="text-[12.5px] text-slate-200 mt-0.5">
                          {effectiveNutrition.supplementNotes}
                        </p>
                      </div>
                    )}
                    {effectiveNutrition.coachNotes && (
                      <div className="pt-1 border-t border-white/[0.06]">
                        <p className="text-[11px] font-bold uppercase tracking-wider text-[#C8F135]">
                          Coach Notes
                        </p>
                        <p className="text-[12.5px] text-slate-200 mt-0.5">
                          {effectiveNutrition.coachNotes}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* SUB-TAB C: DIGITAL QR PASS, DUES & RENEWAL */}
            {planSubTab === 'pass' && (
              <div className="space-y-4">
                <div className="overflow-hidden rounded-3xl bg-[#14171D] text-white border border-white/10 shadow-lg">
                  <div className="p-5 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#C8F135] text-[#0B0D10]">
                          <Dumbbell className="h-4 w-4" aria-hidden />
                        </span>
                        <span className="text-[14px] font-extrabold">
                          {portal.business.name}
                        </span>
                      </div>
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[11px] font-extrabold ${
                          isFrozen
                            ? 'bg-sky-400/20 text-sky-300'
                            : memberPass.effectiveStatus === 'active'
                              ? 'bg-[#C8F135] text-[#0B0D10]'
                              : memberPass.effectiveStatus === 'expiring_soon'
                                ? 'bg-amber-400 text-[#0B0D10]'
                                : 'bg-rose-500/25 text-rose-200'
                        }`}
                      >
                        {isFrozen
                          ? 'Frozen'
                          : memberPass.effectiveStatus === 'expiring_soon'
                            ? 'Renew Soon'
                            : memberPass.effectiveStatus.replace('_', ' ')}
                      </span>
                    </div>

                    <div>
                      <p className="text-[20px] font-black">
                        {toTitleCase(memberPass.fullName)}
                      </p>
                      <p className="text-[12px] text-slate-400">
                        {memberPass.planName} · {memberPass.memberCode}
                        {ptLeft > 0 ? ` · ${ptLeft} PT Left` : ''}
                      </p>
                    </div>

                    <div className="flex items-center justify-between border-t border-white/10 pt-3">
                      <span className="flex items-center gap-1.5 text-[12px] text-slate-300">
                        <Calendar
                          className="h-3.5 w-3.5 text-[#C8F135]"
                          aria-hidden
                        />
                        {memberPass.endDate
                          ? formatIsoDatePretty(memberPass.endDate)
                          : 'Pending Approval'}
                      </span>
                      <span className="rounded-lg border border-[#C8F135]/40 bg-[#C8F135]/15 px-2.5 py-1 text-[12px] font-extrabold text-[#C8F135] tabular-nums">
                        {memberPass.daysRemaining} Days Left
                      </span>
                    </div>
                  </div>

                  <div className="bg-white p-5 text-center space-y-2">
                    <div className="inline-flex rounded-2xl border border-slate-200 p-2 bg-white">
                      <canvas ref={passQrCanvasRef} />
                    </div>
                    <p className="text-[12px] font-semibold text-slate-600">
                      Show this QR code at the front desk
                    </p>
                  </div>
                </div>

                {balanceDue > 0 && (
                  <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 flex items-start gap-3">
                    <AlertCircle
                      className="h-5 w-5 text-amber-400 shrink-0 mt-0.5"
                      aria-hidden
                    />
                    <div>
                      <p className="text-[14px] font-extrabold text-amber-200 tabular-nums">
                        Installment Balance Due:{' '}
                        {formatPriceFromPaise(balanceDue, 'INR')}
                      </p>
                      <p className="text-[12px] text-amber-300/80 mt-0.5">
                        {memberPass.balanceDueDate
                          ? `Settle by ${formatIsoDatePretty(memberPass.balanceDueDate)} via UPI or Cash at reception.`
                          : 'Settle via UPI or Cash at reception on your next visit.'}
                      </p>
                    </div>
                  </div>
                )}

                {/* Plan Renewal Selector */}
                <div className="rounded-3xl border border-white/[0.07] bg-[#14171D] p-4 space-y-3">
                  <div>
                    <h3 className="text-[15px] font-extrabold text-white">
                      Renew or Upgrade Plan
                    </h3>
                    <p className="text-[12px] text-slate-400">
                      Choose a plan and confirm payment at reception
                    </p>
                  </div>
                  <div className="space-y-2">
                    {portal.config.plans.map((plan) => {
                      const selected = renewPlanId === plan.id;
                      const isPopular =
                        plan.durationDays === 90 ||
                        (plan.badge ?? '').toLowerCase().includes('popular');
                      return (
                        <button
                          key={plan.id}
                          type="button"
                          onClick={() => {
                            setRenewPlanId(plan.id);
                            setRenewNotice(null);
                          }}
                          className={`flex w-full items-center justify-between rounded-2xl border p-3.5 text-left transition-all cursor-pointer ${
                            selected
                              ? 'border-2 border-[#C8F135] bg-[#C8F135]/10'
                              : 'border-white/10 bg-[#1E222B] hover:border-white/25'
                          }`}
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-[14px] font-extrabold text-white">
                                {plan.name}
                              </span>
                              {isPopular && (
                                <span className="rounded-full bg-[#C8F135] px-2 py-0.5 text-[10px] font-black text-[#0B0D10]">
                                  Most Popular
                                </span>
                              )}
                            </div>
                            <p className="text-[11.5px] text-slate-400">
                              {plan.durationDays} days · Full Gym &amp; Coach
                              Access
                            </p>
                          </div>
                          <span className="text-[15px] font-black text-[#C8F135] tabular-nums">
                            {formatPriceFromPaise(plan.pricePaise, 'INR')}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const chosen = portal.config.plans.find(
                        (p) => p.id === renewPlanId,
                      );
                      setRenewNotice(
                        `Selected ${chosen?.name ?? 'Plan'} (${formatPriceFromPaise(chosen?.pricePaise ?? 0, 'INR')}). Show pass ${memberPass.memberCode} at the front desk to pay via UPI/Cash & extend instantly!`,
                      );
                    }}
                    className="gym-tactile flex h-11.5 w-full items-center justify-center gap-2 rounded-2xl bg-[#C8F135] text-[14px] font-black text-[#0B0D10] cursor-pointer"
                  >
                    Proceed to Pay <ArrowRight className="h-4 w-4" aria-hidden />
                  </button>
                  {renewNotice && (
                    <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-[12px] font-semibold text-emerald-200">
                      {renewNotice}
                    </p>
                  )}
                </div>

                {/* Save to Home Screen + Google Review */}
                <div className="rounded-2xl border border-white/[0.07] bg-[#14171D] p-4 space-y-2.5">
                  <button
                    type="button"
                    onClick={() => void handleSaveToHomeScreen()}
                    className="gym-tactile flex h-10.5 w-full items-center justify-center gap-2 rounded-xl bg-[#1E222B] text-[13px] font-extrabold text-[#C8F135] cursor-pointer"
                  >
                    <Smartphone className="h-4 w-4" aria-hidden />
                    Save Gym Pass to Home Screen
                  </button>
                  {showHomeGuide && (
                    <div className="rounded-xl bg-[#0B0D10] p-3 text-[12px] text-slate-400 space-y-1">
                      <p>
                        <strong className="text-white">iPhone Safari:</strong>{' '}
                        Tap Share → Add to Home Screen.
                      </p>
                      <p>
                        <strong className="text-white">Android Chrome:</strong>{' '}
                        Tap ⋮ Menu → Add to Home screen.
                      </p>
                    </div>
                  )}
                  <Link
                    to={`/r/${businessSlug}`}
                    className="flex h-10 w-full items-center justify-center gap-1.5 rounded-xl border border-white/10 text-[12.5px] font-bold text-slate-300 hover:text-white"
                  >
                    <Star className="h-3.5 w-3.5 text-[#C8F135]" aria-hidden />{' '}
                    Leave a 10-second Google Review
                  </Link>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ==================== TAB 4: STATS (OVERVIEW | BODY | LIFTS | EFFORT) ==================== */}
        {activeTab === 'stats' && (
          <div className="space-y-4 gym-fade-up">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-[22px] font-black tracking-tight text-white">
                  Stats
                </h1>
                <p className="text-[12px] text-slate-400">
                  Progress &amp; history
                </p>
              </div>
              <button
                type="button"
                onClick={handleExportCsv}
                className="inline-flex h-8.5 items-center gap-1.5 rounded-xl border border-white/10 bg-[#14171D] px-3 text-[11.5px] font-bold text-slate-200 hover:text-white cursor-pointer"
              >
                <Download className="h-3.5 w-3.5" aria-hidden /> CSV
              </button>
            </div>

            {/* Sub-Tabs */}
            <div className="grid grid-cols-4 gap-1 rounded-2xl bg-[#14171D] p-1 border border-white/[0.07]">
              {(
                [
                  { id: 'overview', label: 'Overview' },
                  { id: 'body', label: 'Body' },
                  { id: 'lifts', label: 'Lifts' },
                  { id: 'effort', label: 'Effort' },
                ] as const
              ).map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setStatsSubTab(t.id)}
                  className={`rounded-xl py-2 text-[12px] font-extrabold transition-colors cursor-pointer ${
                    statsSubTab === t.id
                      ? 'bg-[#1E222B] text-[#C8F135]'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {statsSubTab === 'overview' && (
              <div className="space-y-4">
                <div className="rounded-3xl bg-[#14171D] border border-white/[0.07] p-4 space-y-4">
                  <div className="grid grid-cols-3 gap-2">
                    <div className="rounded-2xl bg-[#1E222B] p-3">
                      <p className="text-[11px] text-slate-400">Workouts</p>
                      <p className="mt-1 text-[20px] font-black tabular-nums text-white">
                        {memberPass.totalCheckIns}
                      </p>
                    </div>
                    <div className="rounded-2xl bg-[#1E222B] p-3">
                      <p className="text-[11px] text-slate-400">This month</p>
                      <p className="mt-1 text-[20px] font-black tabular-nums text-white">
                        {workoutsThisMonth}
                      </p>
                    </div>
                    <div className="rounded-2xl bg-[#1E222B] p-3">
                      <p className="text-[11px] text-slate-400">Weight</p>
                      <p className="mt-1 text-[18px] font-black tabular-nums text-[#C8F135]">
                        {latestWeightKg ? `${latestWeightKg} kg` : '—'}
                      </p>
                    </div>
                  </div>

                  <div className="border-t border-white/[0.06] pt-3">
                    <p className="text-[11.5px] font-semibold text-slate-400">
                      Lifted in total
                    </p>
                    <p className="text-[28px] font-black tracking-tight tabular-nums text-white">
                      {totalVolumeLiftedKg.toLocaleString('en-IN')} kg
                    </p>
                  </div>
                </div>

                {/* Week Streak & Milestone Shields */}
                <div className="rounded-3xl bg-[#14171D] border border-white/[0.07] p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                        Week streak
                      </p>
                      <p className="mt-0.5 text-[26px] font-black tabular-nums text-white">
                        🔥 {weekStreakCount}
                      </p>
                    </div>
                    <span className="rounded-xl bg-[#1E222B] px-3 py-1.5 text-[11.5px] font-bold text-slate-300 tabular-nums">
                      Best: {Math.max(1, Math.floor((memberPass.bestStreakDays ?? currentStreak) / 7))}w
                    </span>
                  </div>

                  <div className="grid grid-cols-5 gap-2">
                    {[4, 12, 26, 52, 104].map((milestone) => {
                      const unlocked = weekStreakCount >= milestone;
                      return (
                        <div
                          key={milestone}
                          className={`rounded-2xl p-2.5 text-center border ${
                            unlocked
                              ? 'bg-[#C8F135]/15 border-[#C8F135]/40 text-[#C8F135]'
                              : 'bg-[#1E222B] border-white/[0.06] text-slate-500'
                          }`}
                        >
                          <Shield className="mx-auto h-4 w-4" aria-hidden />
                          <p className="mt-1 text-[11.5px] font-black tabular-nums">
                            {milestone}
                          </p>
                        </div>
                      );
                    })}
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-[12px]">
                      <span className="font-extrabold text-amber-400">
                        Level {levelNumber}
                      </span>
                      <span className="text-slate-400 tabular-nums">
                        {10 - ((memberPass.totalCheckIns || 0) % 10)} workouts
                        to Level {levelNumber + 1}
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-[#1E222B]">
                      <div
                        className="h-full rounded-full bg-amber-400"
                        style={{ width: `${Math.max(10, levelProgressPct)}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Top-10 Monthly Streak Leaderboard */}
                <div className="rounded-3xl bg-[#14171D] border border-white/[0.07] p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-[14.5px] font-extrabold text-white flex items-center gap-1.5">
                      <Flame className="h-4 w-4 text-orange-400" aria-hidden />
                      Monthly Consistency Leaderboard
                    </h3>
                    <span className="text-[11px] font-bold text-slate-400">
                      Top 10
                    </span>
                  </div>
                  {leaderboard.length === 0 ? (
                    <p className="text-[12.5px] text-slate-400">
                      Check in today to take the #1 spot on this month&apos;s
                      leaderboard!
                    </p>
                  ) : (
                    <div className="space-y-1.5">
                      {leaderboard.map((row) => {
                        const isMe = row.memberCode === memberPass.memberCode;
                        const medal =
                          row.rank === 1
                            ? '🥇'
                            : row.rank === 2
                              ? '🥈'
                              : row.rank === 3
                                ? '🥉'
                                : `#${row.rank}`;
                        return (
                          <div
                            key={row.memberCode}
                            className={`flex items-center justify-between rounded-xl px-3 py-2.5 ${
                              isMe
                                ? 'bg-[#C8F135]/15 text-white border border-[#C8F135]/40'
                                : 'bg-[#1E222B] text-white'
                            }`}
                          >
                            <div className="flex items-center gap-2.5">
                              <span className="w-6 text-center text-[13px] font-black">
                                {medal}
                              </span>
                              <div>
                                <p className="text-[13px] font-bold">
                                  {toTitleCase(row.displayName)}{' '}
                                  {isMe && (
                                    <span className="text-[10.5px] text-[#C8F135]">
                                      (You)
                                    </span>
                                  )}
                                </p>
                                <p className="text-[11px] text-slate-400 tabular-nums">
                                  {row.workoutsThisMonth} workouts this month
                                </p>
                              </div>
                            </div>
                            <span className="rounded-lg bg-[#0B0D10] px-2 py-0.5 text-[11.5px] font-extrabold text-[#C8F135] tabular-nums">
                              🔥 {row.currentStreakDays}d
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}

            {statsSubTab === 'body' && (
              <div className="rounded-3xl bg-[#14171D] border border-white/[0.07] p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-[14.5px] font-extrabold text-white flex items-center gap-1.5">
                    <Scale className="h-4 w-4 text-[#C8F135]" aria-hidden />
                    30-Day Body Journal
                  </h3>
                  <button
                    type="button"
                    onClick={() => setShowMeasureForm((v) => !v)}
                    className="inline-flex h-8 items-center gap-1 rounded-lg bg-[#C8F135] px-2.5 text-[11.5px] font-black text-[#0B0D10] cursor-pointer"
                  >
                    <Plus className="h-3.5 w-3.5" aria-hidden /> Log Weight
                  </button>
                </div>

                {showMeasureForm && (
                  <form
                    onSubmit={(e) => void handleSaveBodyMeasurement(e)}
                    className="rounded-2xl border border-white/10 bg-[#1E222B] p-3 space-y-2.5"
                  >
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="number"
                        step="0.1"
                        required
                        placeholder="Weight (kg) *"
                        value={mWeight}
                        onChange={(e) => setMWeight(e.target.value)}
                        className="h-9.5 rounded-lg border border-white/10 bg-[#14171D] px-2.5 text-[12.5px] font-semibold text-white"
                      />
                      <input
                        type="number"
                        step="0.5"
                        placeholder="Height cm (BMI)"
                        value={mHeightCm}
                        onChange={(e) => setMHeightCm(e.target.value)}
                        className="h-9.5 rounded-lg border border-white/10 bg-[#14171D] px-2.5 text-[12.5px] text-white"
                      />
                      <input
                        type="number"
                        step="0.1"
                        placeholder="Waist (in)"
                        value={mWaist}
                        onChange={(e) => setMWaist(e.target.value)}
                        className="h-9.5 rounded-lg border border-white/10 bg-[#14171D] px-2.5 text-[12.5px] text-white"
                      />
                      <input
                        type="number"
                        step="0.1"
                        placeholder="Chest (in)"
                        value={mChest}
                        onChange={(e) => setMChest(e.target.value)}
                        className="h-9.5 rounded-lg border border-white/10 bg-[#14171D] px-2.5 text-[12.5px] text-white"
                      />
                      <input
                        type="number"
                        step="0.1"
                        placeholder="Biceps (in)"
                        value={mBiceps}
                        onChange={(e) => setMBiceps(e.target.value)}
                        className="h-9.5 rounded-lg border border-white/10 bg-[#14171D] px-2.5 text-[12.5px] text-white"
                      />
                      <input
                        type="text"
                        placeholder="Note (optional)"
                        value={mNote}
                        onChange={(e) => setMNote(e.target.value)}
                        className="h-9.5 rounded-lg border border-white/10 bg-[#14171D] px-2.5 text-[12.5px] text-white"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={savingMeasure}
                      className="h-9.5 w-full rounded-lg bg-[#C8F135] text-[12.5px] font-black text-[#0B0D10] cursor-pointer"
                    >
                      {savingMeasure ? 'Saving…' : 'Save Monthly Measurement ✓'}
                    </button>
                  </form>
                )}

                {(memberPass.bodyMeasurements ?? []).length === 0 ? (
                  <p className="text-[12.5px] text-slate-400">
                    Log your Weight, Waist, Chest &amp; Biceps every 30 days to
                    track your transformation!
                  </p>
                ) : (
                  <div className="space-y-2">
                    {(memberPass.bodyMeasurements ?? [])
                      .slice(0, 6)
                      .map((bm) => (
                        <div
                          key={bm.id}
                          className="rounded-xl bg-[#1E222B] px-3 py-2.5 flex items-center justify-between gap-2"
                        >
                          <div>
                            <p className="text-[13px] font-extrabold text-white tabular-nums">
                              {bm.weightKg} kg
                              {bm.bmi ? ` · BMI ${bm.bmi}` : ''}
                            </p>
                            <p className="text-[11px] text-slate-400">
                              {[
                                bm.waistInches
                                  ? `Waist ${bm.waistInches}"`
                                  : null,
                                bm.chestInches
                                  ? `Chest ${bm.chestInches}"`
                                  : null,
                                bm.bicepsInches
                                  ? `Biceps ${bm.bicepsInches}"`
                                  : null,
                              ]
                                .filter(Boolean)
                                .join(' · ') || 'Weight check-in'}
                            </p>
                          </div>
                          <span className="text-[11px] font-semibold text-slate-400">
                            {formatIsoDatePretty(bm.recordedDate)}
                          </span>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            )}

            {statsSubTab === 'lifts' && (
              <div className="space-y-4">
                <div className="rounded-3xl bg-[#14171D] border border-white/[0.07] p-4 space-y-2">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    12-Week Workout Heatmap
                  </p>
                  <div className="grid grid-cols-12 gap-1">
                    {heatmapDays.map((cell) => (
                      <div
                        key={cell.isoDate}
                        title={cell.isoDate}
                        className={`aspect-square rounded-[3px] ${
                          cell.trained
                            ? 'bg-[#C8F135]'
                            : cell.isToday
                              ? 'bg-white/30'
                              : 'bg-white/10'
                        }`}
                      />
                    ))}
                  </div>
                </div>

                <div className="rounded-3xl bg-[#14171D] border border-white/[0.07] p-4 space-y-3">
                  <h3 className="text-[14.5px] font-extrabold text-white flex items-center gap-1.5">
                    <Trophy className="h-4 w-4 text-amber-400" aria-hidden />
                    Personal Records Wall
                  </h3>
                  {(athleteHub?.personalRecords ?? workoutPlan?.personalRecords ?? [])
                    .length === 0 ? (
                    <p className="text-[12.5px] text-slate-400">
                      Tap the center ▶ Start button to log your first set —
                      GymOS automatically tracks your Estimated 1RM &amp; PRs!
                    </p>
                  ) : (
                    <div className="divide-y divide-white/[0.06]">
                      {(
                        athleteHub?.personalRecords ??
                        workoutPlan?.personalRecords ??
                        []
                      )
                        .slice(0, 10)
                        .map((pr) => (
                          <div
                            key={pr.exerciseName}
                            className="flex items-center justify-between py-2.5"
                          >
                            <div>
                              <p className="text-[13px] font-bold text-white">
                                {pr.exerciseName}
                              </p>
                              <p className="text-[11px] text-slate-400 uppercase tabular-nums">
                                {pr.muscleGroup} · Est 1RM {pr.best1rmKg} kg
                              </p>
                            </div>
                            <span className="rounded-lg bg-[#C8F135]/15 border border-[#C8F135]/40 px-2.5 py-1 text-[12.5px] font-black text-[#C8F135] tabular-nums">
                              {pr.bestWeightKg} kg
                            </span>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {statsSubTab === 'effort' && (
              <div className="rounded-3xl bg-[#14171D] border border-white/[0.07] p-4 space-y-3">
                <h3 className="text-[14.5px] font-extrabold text-white flex items-center gap-2">
                  <Award className="h-4 w-4 text-[#C8F135]" aria-hidden />
                  Goal &amp; Effort Profile
                </h3>
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="rounded-2xl bg-[#1E222B] p-3">
                    <p className="text-[11px] text-slate-400">Fitness Goal</p>
                    <p className="mt-1 text-[13px] font-extrabold text-white">
                      {getFitnessGoalMeta(memberPass.fitnessGoal).emoji}{' '}
                      {getFitnessGoalMeta(memberPass.fitnessGoal).label}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-[#1E222B] p-3">
                    <p className="text-[11px] text-slate-400">Weight Target</p>
                    <p className="mt-1 text-[13px] font-extrabold text-white tabular-nums">
                      {memberPass.startingWeightKg ?? '—'} →{' '}
                      {memberPass.targetWeightKg ?? '—'} kg
                    </p>
                  </div>
                </div>
                <p className="text-[12px] text-slate-400">
                  7-Day Volume Lifted:{' '}
                  <strong className="text-[#C8F135] tabular-nums">
                    {(workoutPlan?.weeklyVolumeKg ?? 0).toLocaleString('en-IN')}{' '}
                    kg
                  </strong>
                </p>
              </div>
            )}
          </div>
        )}

        {/* ==================== TAB 5: EXERCISES (ANIMATED EXERCISE FORM LIBRARY) ==================== */}
        {activeTab === 'exercises' && (
          <div className="space-y-4 gym-fade-up">
            <div>
              <h1 className="text-[22px] font-black tracking-tight text-white">
                Exercises
              </h1>
              <p className="text-[12px] text-slate-400">
                {catalogExercises.length} exercises with form demonstrations
              </p>
            </div>

            {/* Search Bar */}
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                aria-hidden
              />
              <input
                type="search"
                value={exSearch}
                onChange={(e) => setExSearch(e.target.value)}
                placeholder="Search bench, squat, lat pulldown..."
                className="h-11 w-full rounded-2xl border border-white/10 bg-[#14171D] pl-10 pr-4 text-[13.5px] text-white placeholder:text-slate-500 focus:border-[#C8F135] focus:outline-none"
              />
            </div>

            {/* Muscle Filter Pills */}
            <div className="flex gap-1.5 overflow-x-auto pb-1">
              {[
                { id: 'all', label: 'All' },
                { id: 'chest', label: 'Chest' },
                { id: 'back', label: 'Back' },
                { id: 'legs', label: 'Legs' },
                { id: 'shoulders', label: 'Shoulders' },
                { id: 'arms', label: 'Arms' },
                { id: 'core', label: 'Core' },
                { id: 'cardio', label: 'Cardio' },
              ].map((pill) => (
                <button
                  key={pill.id}
                  type="button"
                  onClick={() => setExMuscleFilter(pill.id)}
                  className={`shrink-0 rounded-xl px-3 py-1.5 text-[12px] font-bold cursor-pointer ${
                    exMuscleFilter === pill.id
                      ? 'bg-[#C8F135] text-[#0B0D10]'
                      : 'bg-[#14171D] border border-white/[0.07] text-slate-300'
                  }`}
                >
                  {pill.label}
                </button>
              ))}
            </div>

            {/* Exercise Cards with Looping Animations */}
            <div className="space-y-2.5">
              {filteredExercises.map((ex) => (
                <button
                  key={ex.id}
                  type="button"
                  onClick={() => setSelectedCatalogEx(ex)}
                  className="w-full rounded-2xl bg-[#14171D] border border-white/[0.07] p-3 flex items-center gap-3 text-left hover:border-[#C8F135]/40 transition-colors cursor-pointer"
                >
                  <ExerciseAnimationPreview
                    animationKey={ex.animationKey}
                    animationGifUrl={ex.animationGifUrl}
                    exerciseName={ex.name}
                    muscleGroup={ex.muscleGroup}
                    variant="compact"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] font-extrabold text-white truncate">
                      {ex.name}
                    </p>
                    <p className="text-[11.5px] text-slate-400 capitalize mt-0.5">
                      {ex.muscleGroup} · {ex.equipment.replace('_', ' ')} ·{' '}
                      <span className="tabular-nums">
                        {ex.defaultSets}×{ex.defaultReps}
                      </span>
                    </p>
                  </div>
                  <ChevronRight
                    className="h-4 w-4 text-slate-500 shrink-0"
                    aria-hidden
                  />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ==================== CHECK-IN MODAL ==================== */}
        {showCheckInModal && (
          <div
            role="dialog"
            aria-modal="true"
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs"
          >
            <div className="w-full max-w-sm rounded-3xl bg-[#14171D] border border-white/10 p-5 text-white shadow-2xl space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-[16px] font-extrabold">
                    Reception Entrance Check-In
                  </h3>
                  <p className="text-[12px] text-slate-400">
                    Pick today&apos;s muscle split &amp; tap Check In
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowCheckInModal(false)}
                  className="rounded-lg p-1 text-slate-400 hover:bg-white/10 cursor-pointer"
                >
                  <X className="h-4 w-4" aria-hidden />
                </button>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {GYM_WORKOUT_FOCUS_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setSelectedWorkoutFocus(opt.value)}
                    className={`rounded-xl border px-3 py-1.5 text-[12px] font-bold transition-colors cursor-pointer ${
                      selectedWorkoutFocus === opt.value
                        ? 'border-[#C8F135] bg-[#C8F135] text-[#0B0D10]'
                        : 'border-white/10 bg-[#1E222B] text-slate-300'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              {ptLeft > 0 && (
                <label className="flex items-center gap-2.5 rounded-xl border border-indigo-500/30 bg-indigo-500/10 px-3 py-2 text-[12.5px] font-semibold text-indigo-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={countAsPtSession}
                    onChange={(e) => setCountAsPtSession(e.target.checked)}
                    className="h-4 w-4 accent-[#C8F135]"
                  />
                  <span>
                    Count as PT Session (-1 PT ·{' '}
                    <strong>{ptLeft} left</strong>)
                  </span>
                </label>
              )}

              <button
                type="button"
                disabled={checkingIn}
                onClick={() => void handleDailyCheckIn()}
                className="gym-tactile flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#C8F135] text-[14.5px] font-black text-[#0B0D10] cursor-pointer"
              >
                {checkingIn ? (
                  <Loader2 className="h-4.5 w-4.5 animate-spin" aria-hidden />
                ) : (
                  <CheckCircle2 className="h-4.5 w-4.5" aria-hidden />
                )}
                Check In Now ✓
              </button>
            </div>
          </div>
        )}

        {/* ==================== EXERCISE DETAIL MODAL ==================== */}
        {selectedCatalogEx && (
          <div
            role="dialog"
            aria-modal="true"
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs"
          >
            <div className="w-full max-w-sm rounded-3xl bg-[#14171D] border border-white/10 p-5 text-white shadow-2xl space-y-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#C8F135]">
                    {selectedCatalogEx.muscleGroup} ·{' '}
                    {selectedCatalogEx.equipment.replace('_', ' ')}
                  </span>
                  <h3 className="text-[18px] font-black text-white">
                    {selectedCatalogEx.name}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedCatalogEx(null)}
                  className="rounded-lg p-1 text-slate-400 hover:bg-white/10 cursor-pointer"
                >
                  <X className="h-4 w-4" aria-hidden />
                </button>
              </div>

              <ExerciseAnimationPreview
                animationKey={selectedCatalogEx.animationKey}
                animationGifUrl={selectedCatalogEx.animationGifUrl}
                exerciseName={selectedCatalogEx.name}
                muscleGroup={selectedCatalogEx.muscleGroup}
                variant="stage"
              />

              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-xl bg-[#1E222B] p-2.5">
                  <p className="text-[10.5px] text-slate-400">Sets</p>
                  <p className="text-[14px] font-black tabular-nums">
                    {selectedCatalogEx.defaultSets}
                  </p>
                </div>
                <div className="rounded-xl bg-[#1E222B] p-2.5">
                  <p className="text-[10.5px] text-slate-400">Reps</p>
                  <p className="text-[14px] font-black tabular-nums">
                    {selectedCatalogEx.defaultReps}
                  </p>
                </div>
                <div className="rounded-xl bg-[#1E222B] p-2.5">
                  <p className="text-[10.5px] text-slate-400">Rest</p>
                  <p className="text-[14px] font-black tabular-nums">
                    {selectedCatalogEx.restSeconds}s
                  </p>
                </div>
              </div>

              {selectedCatalogEx.formCues && (
                <div className="rounded-2xl bg-[#0B0D10] border border-white/[0.06] p-3 text-[12.5px] text-slate-300">
                  <p className="text-[11px] font-bold uppercase text-[#C8F135] mb-1">
                    Form Cues
                  </p>
                  {selectedCatalogEx.formCues}
                </div>
              )}

              <button
                type="button"
                onClick={() => {
                  const exItem: GymRoutineExerciseItem = {
                    exerciseId: selectedCatalogEx.id,
                    name: selectedCatalogEx.name,
                    muscleGroup: selectedCatalogEx.muscleGroup,
                    dayLabel: todayScheduleDay?.focusTitle ?? 'Workout',
                    sets: selectedCatalogEx.defaultSets,
                    reps: selectedCatalogEx.defaultReps,
                    restSeconds: selectedCatalogEx.restSeconds,
                    animationKey: selectedCatalogEx.animationKey,
                    animationGifUrl: selectedCatalogEx.animationGifUrl,
                    formCues: selectedCatalogEx.formCues,
                  };
                  setExtraExercises((prev) =>
                    prev.some((e) => e.name === exItem.name)
                      ? prev
                      : [...prev, exItem],
                  );
                  setSelectedCatalogEx(null);
                  launchWorkoutSession(
                    todayScheduleDay?.focusTitle ?? 'Custom Session',
                    [...(todayScheduleDay?.exercises ?? []), exItem],
                  );
                }}
                className="gym-tactile flex h-11.5 w-full items-center justify-center gap-2 rounded-2xl bg-[#C8F135] text-[13.5px] font-black text-[#0B0D10] cursor-pointer"
              >
                <Plus className="h-4 w-4" aria-hidden /> Add to Today&apos;s
                Workout &amp; Start
              </button>
            </div>
          </div>
        )}

        {/* ==================== PERSISTENT 5-TAB BOTTOM NAVIGATION BAR ==================== */}
        <nav
          aria-label="Gym Member Navigation"
          className="fixed bottom-3 left-1/2 z-30 grid w-[calc(100%-1.5rem)] max-w-md -translate-x-1/2 grid-cols-5 items-center rounded-2xl border border-white/10 bg-[#14171D]/95 px-1.5 py-1.5 shadow-2xl backdrop-blur-md"
        >
          <button
            type="button"
            onClick={() => setActiveTab('home')}
            className={`gym-tactile flex flex-col items-center justify-center gap-0.5 rounded-xl py-1.5 text-[10.5px] font-bold cursor-pointer ${
              activeTab === 'home' ? 'text-[#C8F135]' : 'text-slate-400'
            }`}
          >
            <Home className="h-4.5 w-4.5" aria-hidden />
            <span>Home</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('plan')}
            className={`gym-tactile flex flex-col items-center justify-center gap-0.5 rounded-xl py-1.5 text-[10.5px] font-bold cursor-pointer ${
              activeTab === 'plan' ? 'text-[#C8F135]' : 'text-slate-400'
            }`}
          >
            <Calendar className="h-4.5 w-4.5" aria-hidden />
            <span>Plan</span>
          </button>

          {/* Center Floating Volt Lime ▶ Start Button */}
          <button
            type="button"
            onClick={() =>
              launchWorkoutSession(
                todayScheduleDay?.focusTitle ?? 'Workout Session',
                todayScheduleDay?.exercises ?? [],
              )
            }
            className="gym-tactile -mt-5 mx-auto flex flex-col items-center justify-center cursor-pointer"
            aria-label="Start Workout Session"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#C8F135] text-[#0B0D10] shadow-[0_6px_22px_rgba(200,241,53,0.45)] border-4 border-[#0B0D10]">
              <Play className="h-5 w-5 fill-current ml-0.5" aria-hidden />
            </span>
            <span className="mt-0.5 text-[10px] font-black text-[#C8F135]">
              Start
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('stats')}
            className={`gym-tactile flex flex-col items-center justify-center gap-0.5 rounded-xl py-1.5 text-[10.5px] font-bold cursor-pointer ${
              activeTab === 'stats' ? 'text-[#C8F135]' : 'text-slate-400'
            }`}
          >
            <BarChart3 className="h-4.5 w-4.5" aria-hidden />
            <span>Stats</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('exercises')}
            className={`gym-tactile flex flex-col items-center justify-center gap-0.5 rounded-xl py-1.5 text-[10.5px] font-bold cursor-pointer ${
              activeTab === 'exercises' ? 'text-[#C8F135]' : 'text-slate-400'
            }`}
          >
            <Timer className="h-4.5 w-4.5 hidden" aria-hidden />
            <Dumbbell className="h-4.5 w-4.5" aria-hidden />
            <span>Exercises</span>
          </button>
        </nav>
      </div>
    </div>
  );
}
