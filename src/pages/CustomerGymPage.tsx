import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
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
  Download,
  Dumbbell,
  Flame,
  Gift,
  Home,
  Loader2,
  Plus,
  QrCode,
  Scale,
  SearchX,
  Smartphone,
  Snowflake,
  Sparkles,
  Star,
  Timer,
  Trophy,
  User,
  X,
} from 'lucide-react';
import type {
  GymFitnessGoal,
  GymLeaderboardEntry,
  GymMember,
  GymMemberWorkoutPlanPayload,
  GymRoutineExerciseItem,
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
  buildGymDataExportCsv,
  calculateBarbellPlates,
  GYM_TRAINER_ROUTINE_PRESETS,
} from '../utils/gymWorkoutEngine';
import { formatPriceFromPaise } from '../utils/restaurantValidation';
import { playNotificationChime } from '../utils/hospitalityHelpers';
import { GymMuscleMapSvg } from '../components/gym/GymMuscleMapSvg';

type MemberTab = 'home' | 'progress' | 'rewards' | 'profile';
type AuthScreenMode = 'splash' | 'join' | 'signin';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
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
  const [loading, setLoading] = useState(true);
  const [authMode, setAuthMode] = useState<AuthScreenMode>('splash');
  const [activeTab, setActiveTab] = useState<MemberTab>('home');

  // Member & live training state
  const [memberPass, setMemberPass] = useState<GymMember | null>(null);
  const [workoutPlan, setWorkoutPlan] =
    useState<GymMemberWorkoutPlanPayload | null>(null);
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

  // Check-In state
  const [selectedWorkoutFocus, setSelectedWorkoutFocus] =
    useState<GymWorkoutFocus>('chest');
  const [memberWorkoutNote, setMemberWorkoutNote] = useState('');
  const [countAsPtSession, setCountAsPtSession] = useState(false);
  const [checkingIn, setCheckingIn] = useState(false);

  // Workout Logger, Day Selector, Rest Timer & Plate Calculator
  const [selectedDayLabel, setSelectedDayLabel] = useState<string>('');
  const [setDrafts, setSetDrafts] = useState<
    Record<string, { weight: string; reps: string }>
  >({});
  const [loggingExerciseKey, setLoggingExerciseKey] = useState<string | null>(
    null,
  );
  const [showAddExercisePicker, setShowAddExercisePicker] = useState(false);
  const [extraExercises, setExtraExercises] = useState<GymRoutineExerciseItem[]>(
    [],
  );
  const [prBanner, setPrBanner] = useState<string | null>(null);
  const [restSecondsLeft, setRestSecondsLeft] = useState<number>(0);
  const [plateCalcTargetKg, setPlateCalcTargetKg] = useState<number | null>(
    null,
  );
  const [plateBarKg, setPlateBarKg] = useState<20 | 10 | 0>(20);

  // Body Measurements form (Progress Tab)
  const [showMeasureForm, setShowMeasureForm] = useState(false);
  const [mWeight, setMWeight] = useState('');
  const [mHeightCm, setMHeightCm] = useState('');
  const [mWaist, setMWaist] = useState('');
  const [mChest, setMChest] = useState('');
  const [mBiceps, setMBiceps] = useState('');
  const [mNote, setMNote] = useState('');
  const [savingMeasure, setSavingMeasure] = useState(false);

  // Renewal plan selector (Rewards Tab)
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
      const [planData, boardData] = await Promise.all([
        businessRepository.getGymMemberWorkoutPlan({
          businessSlug: slug,
          memberId: member.id,
        }),
        businessRepository.getGymMonthlyLeaderboard(slug),
      ]);
      if (planData) setWorkoutPlan(planData);
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

  // Render scannable Digital Membership Pass QR on Rewards tab
  useEffect(() => {
    if (
      activeTab !== 'rewards' ||
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
      color: { dark: '#0F1115', light: '#FFFFFF' },
    });
  }, [activeTab, businessSlug, memberPass]);

  // Effective routine exercises (assigned trainer routine OR smart goal-matched starter preset)
  const effectiveRoutine = useMemo(() => {
    if (
      workoutPlan?.assignedRoutine &&
      workoutPlan.assignedRoutine.exercises.length > 0
    ) {
      return {
        name: workoutPlan.assignedRoutine.routineName,
        isAssigned: true,
        exercises: workoutPlan.assignedRoutine.exercises,
      };
    }
    const goal = memberPass?.fitnessGoal ?? 'muscle_gain';
    const preset =
      goal === 'weight_loss' || goal === 'cardio_endurance'
        ? GYM_TRAINER_ROUTINE_PRESETS[1]
        : goal === 'general_fitness'
          ? GYM_TRAINER_ROUTINE_PRESETS[2]
          : GYM_TRAINER_ROUTINE_PRESETS[0];
    return {
      name: preset.routineName,
      isAssigned: false,
      exercises: preset.exercises,
    };
  }, [workoutPlan, memberPass?.fitnessGoal]);

  const routineDayLabels = useMemo(() => {
    const labels: string[] = [];
    for (const ex of effectiveRoutine.exercises) {
      if (ex.dayLabel && !labels.includes(ex.dayLabel)) {
        labels.push(ex.dayLabel);
      }
    }
    return labels.length > 0 ? labels : ['Workout Day'];
  }, [effectiveRoutine]);

  const activeDayLabel = routineDayLabels.includes(selectedDayLabel)
    ? selectedDayLabel
    : routineDayLabels[0];

  const activeDayExercises = useMemo(() => {
    const base = effectiveRoutine.exercises.filter(
      (e) => e.dayLabel === activeDayLabel,
    );
    return [...base, ...extraExercises];
  }, [effectiveRoutine, activeDayLabel, extraExercises]);

  const activeTargetMuscles = useMemo(
    () => Array.from(new Set(activeDayExercises.map((e) => e.muscleGroup))),
    [activeDayExercises],
  );

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
      setActiveTab('rewards');
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

  async function handleLogExerciseSet(
    ex: GymRoutineExerciseItem,
    nextSetNumber: number,
  ) {
    if (!businessSlug || !memberPass) return;
    const key = ex.name.toLowerCase();
    const draft = setDrafts[key] ?? { weight: '40', reps: '10' };
    const weightKg = Number.parseFloat(draft.weight);
    const reps = Number.parseInt(draft.reps, 10);
    if (!Number.isFinite(weightKg) || weightKg < 0) {
      setErrorMsg('Enter a valid weight in kg (0 for bodyweight).');
      return;
    }
    if (!Number.isInteger(reps) || reps < 1 || reps > 200) {
      setErrorMsg('Enter reps between 1 and 200.');
      return;
    }

    setErrorMsg(null);
    setLoggingExerciseKey(key);
    try {
      const res = await businessRepository.logGymMemberWorkoutSet({
        businessSlug,
        memberId: memberPass.id,
        exerciseId: ex.exerciseId ?? null,
        exerciseName: ex.name,
        muscleGroup: ex.muscleGroup,
        setNumber: nextSetNumber,
        weightKg,
        reps,
      });
      setRestSecondsLeft(ex.restSeconds || 60);
      if (res.isPersonalRecord) {
        playNotificationChime('order');
        setPrBanner(
          `🏆 NEW PERSONAL RECORD! ${ex.name} — ${weightKg} kg × ${reps} (Est 1RM: ${res.setLog.estimated1rmKg} kg)`,
        );
        window.setTimeout(() => setPrBanner(null), 6500);
      }
      await hydrateMemberExtras(businessSlug, memberPass);
    } catch (err) {
      setErrorMsg((err as Error).message);
    } finally {
      setLoggingExerciseKey(null);
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
      if (refreshed) setMemberPass(refreshed);
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
    a.download = `${memberPass.memberCode.toLowerCase()}-training-journal.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  function handleSwitchMember() {
    saveStoredPhone(businessSlug, '');
    setMemberPass(null);
    setWorkoutPlan(null);
    setLookupPhone('');
    setAuthMode('signin');
    setSuccessMsg(null);
    setErrorMsg(null);
  }

  async function handleSaveToHomeScreen() {
    if (deferredInstallPrompt) {
      await deferredInstallPrompt.prompt();
      setDeferredInstallPrompt(null);
      return;
    }
    setShowHomeGuide((v) => !v);
  }

  if (loading) {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center gap-3 text-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#0F1115]" aria-hidden />
        <p className="text-[13.5px] font-semibold text-slate-600">
          Loading GymOS Member Pass…
        </p>
      </div>
    );
  }

  if (!portal) {
    return (
      <div className="mx-auto w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center space-y-3">
        <SearchX className="mx-auto h-10 w-10 text-slate-400" aria-hidden />
        <h1 className="text-[20px] font-extrabold text-[#0F1115]">
          Gym Portal Unavailable
        </h1>
        <p className="text-[13.5px] text-slate-500">
          This gym check-in link is currently inactive. Please check with the
          reception desk.
        </p>
      </div>
    );
  }

  // =========================================================================
  // 1. ONBOARDING SPLASH / JOIN / SIGN-IN (WHEN NO MEMBER PASS LOADED)
  // =========================================================================
  if (!memberPass) {
    return (
      <div className="mx-auto w-full max-w-md space-y-4">
        {authMode === 'splash' && (
          <div className="gym-obsidian-mesh gym-fade-up overflow-hidden rounded-3xl text-white shadow-2xl border border-white/10">
            <div className="relative px-6 pt-7 pb-8 space-y-6">
              {/* Top Gym Brand Emblem */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#C8F135] text-[#0F1115] shadow-[0_0_15px_rgba(200,241,53,0.4)]">
                    <Dumbbell className="h-5 w-5" aria-hidden />
                  </span>
                  <div>
                    <p className="text-[16px] font-black tracking-tight text-white">
                      {portal.business.name}
                    </p>
                    <p className="text-[11.5px] font-medium text-slate-400">
                      {portal.business.city} · <span className="tabular-nums font-semibold">{portal.activeMembersCount}</span> Active Members
                    </p>
                  </div>
                </div>
                <span className="rounded-full border border-[#C8F135]/40 bg-[#C8F135]/15 px-2.5 py-0.5 text-[11px] font-extrabold text-[#C8F135]">
                  Live Pass
                </span>
              </div>

              {/* Athletic Vector Emblem with Neon Volt Glow */}
              <AthleteSplashIllustration />

              {/* Athletic Hero Display Copy */}
              <div className="text-center space-y-2.5">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-[#C8F135]">
                  <Flame className="h-3.5 w-3.5 text-orange-400" aria-hidden />
                  <span className="tabular-nums font-extrabold">{portal.checkedInTodayCount}</span> Trained Today
                </span>
                <h1 className="text-[34px] font-black leading-[1.08] tracking-tight text-white">
                  Stronger <br />
                  <span className="text-[#C8F135]">Than Yesterday</span>
                </h1>
                <p className="text-[13.5px] text-slate-300 font-medium max-w-xs mx-auto leading-relaxed">
                  Join. Train. Transform. Track workouts, hit PRs, build your
                  streak &amp; check in with 1 tap — zero app install required.
                </p>
              </div>

              {/* Primary Volt Lime CTA + Sign In */}
              <div className="space-y-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setErrorMsg(null);
                    setAuthMode('join');
                  }}
                  className="gym-tactile flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#C8F135] px-5 text-[15px] font-black text-[#0F1115] shadow-[0_4px_20px_rgba(200,241,53,0.4)] hover:bg-[#b8e028] cursor-pointer"
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
                  <span className="font-extrabold text-[#C8F135]">Sign In</span>
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
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#C8F135] text-[#0F1115]">
                  <Dumbbell className="h-4.5 w-4.5" aria-hidden />
                </span>
                <div>
                  <h1 className="text-[18px] font-extrabold">Member Sign In</h1>
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
              className="gym-tactile flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#C8F135] text-[14.5px] font-extrabold text-[#0F1115] shadow-[0_4px_16px_rgba(200,241,53,0.35)] hover:bg-[#b8e028] disabled:opacity-60 cursor-pointer"
            >
              {lookingUp ? (
                <Loader2 className="h-4.5 w-4.5 animate-spin" aria-hidden />
              ) : (
                <QrCode className="h-4.5 w-4.5" aria-hidden />
              )}
              Open My Digital Pass
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

            {/* Choose Plan Cards (Mockup Screen #4 style) */}
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
                            <span className="rounded-full bg-[#C8F135] px-2 py-0.5 text-[10px] font-black text-[#0F1115]">
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

            {/* Fitness Goal Pills */}
            <div className="space-y-1.5">
              <label className="block text-[11.5px] font-bold uppercase tracking-wider text-slate-400">
                Your Primary Goal
              </label>
              <div className="flex flex-wrap gap-1.5">
                {GYM_FITNESS_GOAL_OPTIONS.map((g) => (
                  <button
                    key={g.value}
                    type="button"
                    onClick={() => setFitnessGoal(g.value)}
                    className={`rounded-xl border px-2.5 py-1.5 text-[11.5px] font-bold cursor-pointer ${
                      fitnessGoal === g.value
                        ? 'border-[#C8F135] bg-[#C8F135] text-[#0F1115]'
                        : 'border-white/15 bg-[#161920] text-slate-300'
                    }`}
                  >
                    {g.emoji} {g.shortLabel}
                  </button>
                ))}
              </div>
            </div>

            {/* Optional Starting / Target Weight */}
            <div className="grid grid-cols-2 gap-2.5">
              <input
                type="number"
                step="0.5"
                placeholder="Current Weight (kg)"
                value={startingWeightInput}
                onChange={(e) => setStartingWeightInput(e.target.value)}
                className="h-10 rounded-xl border border-white/15 bg-[#161920] px-3 text-[12.5px] text-white placeholder:text-slate-500"
              />
              <input
                type="number"
                step="0.5"
                placeholder="Target Weight (kg)"
                value={targetWeightInput}
                onChange={(e) => setTargetWeightInput(e.target.value)}
                className="h-10 rounded-xl border border-white/15 bg-[#161920] px-3 text-[12.5px] text-white placeholder:text-slate-500"
              />
            </div>

            <button
              type="submit"
              disabled={submittingJoin}
              className="gym-tactile flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#C8F135] text-[14.5px] font-extrabold text-[#0F1115] shadow-[0_4px_16px_rgba(200,241,53,0.35)] hover:bg-[#b8e028] disabled:opacity-60 cursor-pointer"
            >
              {submittingJoin ? (
                <Loader2 className="h-4.5 w-4.5 animate-spin" aria-hidden />
              ) : (
                <ArrowRight className="h-4.5 w-4.5" aria-hidden />
              )}
              Register &amp; Get Digital Pass
            </button>
          </form>
        )}
      </div>
    );
  }

  // =========================================================================
  // 2. ACTIVE 4-TAB MEMBER APP (Home | Progress | Rewards | Profile)
  // =========================================================================
  const firstName = memberPass.fullName.split(' ')[0] || memberPass.fullName;
  const currentStreak = memberPass.currentStreakDays ?? 0;
  const ptLeft = memberPass.ptRemainingSessions ?? 0;
  const balanceDue = memberPass.balanceDuePaise ?? 0;
  const isFrozen = Boolean(memberPass.isFrozen) || memberPass.effectiveStatus === 'frozen';
  const isCanTrain =
    memberPass.effectiveStatus === 'active' ||
    memberPass.effectiveStatus === 'expiring_soon';
  const todaySets = workoutPlan?.todaySets ?? [];
  const personalRecords = workoutPlan?.personalRecords ?? [];
  const weeklyVolumeKg = workoutPlan?.weeklyVolumeKg ?? 0;
  const prByExercise = new Map(
    personalRecords.map((p) => [p.exerciseName.toLowerCase(), p]),
  );

  return (
    <div className="mx-auto w-full max-w-md pb-24 space-y-4">
      {/* COMPACT TOP HEADER SWITCHER */}
      <div className="gym-fade-up flex items-center justify-between rounded-2xl border border-slate-200/80 bg-white px-4 py-2.5 shadow-sm text-[12.5px]">
        <div className="flex items-center gap-2 text-slate-700 min-w-0">
          <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#0F1115] text-[#C8F135] text-[11px] font-black">
            📱
          </span>
          <span className="font-extrabold text-[#0F1115] truncate">
            {toTitleCase(memberPass.fullName)}
          </span>
          <span className="text-slate-400 font-mono text-[11px] tabular-nums">
            (+91 {memberPass.phone})
          </span>
        </div>
        <button
          type="button"
          onClick={handleSwitchMember}
          className="gym-tactile ml-2 shrink-0 rounded-lg px-2.5 py-1 text-[11.5px] font-bold text-slate-500 hover:bg-slate-100 hover:text-[#0F1115] cursor-pointer"
        >
          Switch
        </button>
      </div>

      {/* PR CELEBRATION BANNER */}
      {prBanner && (
        <div
          role="status"
          className="rounded-2xl border-2 border-[#C8F135] bg-[#0F1115] px-4 py-3 text-[#C8F135] font-extrabold text-[13px] flex items-center justify-between gap-2 shadow-lg"
        >
          <span>{prBanner}</span>
          <button
            type="button"
            onClick={() => setPrBanner(null)}
            className="text-slate-400 hover:text-white cursor-pointer"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
      )}

      {/* FEEDBACK ALERTS */}
      {successMsg && (
        <div
          role="status"
          className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-[13px] font-semibold text-emerald-900 flex items-center justify-between gap-2"
        >
          <span className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden />
            {successMsg}
          </span>
          <button
            type="button"
            onClick={() => setSuccessMsg(null)}
            className="text-emerald-700 cursor-pointer"
          >
            <X className="h-3.5 w-3.5" aria-hidden />
          </button>
        </div>
      )}

      {errorMsg && (
        <div
          role="alert"
          className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-[13px] font-medium text-rose-800 flex items-center justify-between gap-2"
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

      {/* ==================== TAB 1: HOME (ACTIVITY, STATIC QR CHECK-IN & WORKOUT LOGGER) ==================== */}
      {activeTab === 'home' && (
        <div className="space-y-4">
          {/* Dark Obsidian Hero Greeting Card (Mockup Screen #3) */}
          <div className="overflow-hidden rounded-3xl bg-[#0F1115] p-5 text-white border border-white/10 shadow-md space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[20px] font-black tracking-tight">
                  Hello, {toTitleCase(firstName)} 👋
                </p>
                <p className="text-[12px] text-slate-400">
                  Keep pushing your limits · {portal.business.name}
                </p>
              </div>
              <span className="flex h-10 w-10 items-center justify-center rounded-full border border-[#C8F135]/40 bg-[#161920] font-black text-[13px] text-[#C8F135]">
                {firstName.slice(0, 2).toUpperCase()}
              </span>
            </div>

            <div className="flex items-center justify-between gap-3 rounded-2xl bg-[#161920] border border-white/10 p-4">
              <div className="space-y-1">
                <p className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400">
                  Next Workout · {activeDayLabel}
                </p>
                <p className="text-[17px] font-extrabold text-white">
                  Push Your Limits
                </p>
                <button
                  type="button"
                  onClick={() => setActiveTab('rewards')}
                  className="mt-1 inline-flex h-8 items-center gap-1 rounded-full bg-[#C8F135] px-3.5 text-[12px] font-extrabold text-[#0F1115] hover:bg-[#b8e028] cursor-pointer"
                >
                  View Pass <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                </button>
              </div>
              <GymMuscleMapSvg activeMuscles={activeTargetMuscles} compact />
            </div>

            {/* 3 Stat Tiles (Workouts | Days Streak | PT Left) */}
            <div className="grid grid-cols-3 gap-2.5">
              <div className="rounded-2xl bg-[#161920] border border-white/10 p-3 text-center">
                <Dumbbell
                  className="mx-auto h-4 w-4 text-[#C8F135]"
                  aria-hidden
                />
                <p className="mt-1.5 text-[18px] font-black tabular-nums">
                  {memberPass.daysAttendedThisMonth ?? 0}
                </p>
                <p className="text-[10.5px] font-medium text-slate-400">
                  Workouts
                </p>
              </div>
              <div className="rounded-2xl bg-[#161920] border border-white/10 p-3 text-center">
                <Flame className="mx-auto h-4 w-4 text-amber-400" aria-hidden />
                <p className="mt-1.5 text-[18px] font-black tabular-nums">
                  {currentStreak}
                </p>
                <p className="text-[10.5px] font-medium text-slate-400">
                  Days Streak
                </p>
              </div>
              <div className="rounded-2xl bg-[#161920] border border-white/10 p-3 text-center">
                <Award className="mx-auto h-4 w-4 text-sky-400" aria-hidden />
                <p className="mt-1.5 text-[18px] font-black tabular-nums">
                  {ptLeft > 0 ? ptLeft : memberPass.totalCheckIns}
                </p>
                <p className="text-[10.5px] font-medium text-slate-400">
                  {ptLeft > 0 ? 'PT Left' : 'All-Time'}
                </p>
              </div>
            </div>
          </div>

          {/* 7-Day Activity Bar Chart (Mon - Sun) */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-[14px] font-extrabold text-[#0F1115]">
                Your Activity
              </h2>
              <button
                type="button"
                onClick={() => setActiveTab('progress')}
                className="text-[12px] font-bold text-slate-500 hover:text-[#0F1115] cursor-pointer"
              >
                View All →
              </button>
            </div>
            <div className="grid grid-cols-7 gap-2 items-end h-20 pt-2">
              {weeklyActivity.map((day) => (
                <div
                  key={day.isoDate}
                  className="flex flex-col items-center gap-1.5 h-full justify-end"
                >
                  <div
                    className={`w-full max-w-[22px] rounded-full gym-bar-grow transition-all ${
                      day.trained
                        ? 'bg-[#C8F135] border border-[#0F1115]/15 h-12 shadow-[0_2px_8px_rgba(200,241,53,0.5)]' : 
                      day.trained
                        ? 'bg-[#C8F135] border border-[#0F1115]/15 h-12'
                        : day.isToday
                          ? 'bg-slate-300 ring-2 ring-[#C8F135] h-6'
                          : 'bg-slate-100 h-3'
                    }`}
                    title={`${day.dayLabel}: ${day.trained ? 'Trained' : 'Rest'}`}
                  />
                  <span
                    className={`text-[10.5px] font-bold ${
                      day.isToday ? 'text-[#0F1115]' : 'text-slate-400'
                    }`}
                  >
                    {day.dayLabel}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* STATIC ENTRANCE QR CHECK-IN CARD */}
          {isFrozen ? (
            <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4 flex items-start gap-3">
              <Snowflake className="h-5 w-5 text-sky-600 shrink-0 mt-0.5" aria-hidden />
              <div>
                <p className="text-[14px] font-extrabold text-sky-950">
                  Membership Paused (Frozen)
                </p>
                <p className="text-[12.5px] text-sky-800 mt-0.5">
                  Your expiry date is safely paused since{' '}
                  {formatIsoDatePretty(memberPass.frozenStartedAt)}. Ask the
                  front desk to resume whenever you&apos;re ready to train!
                </p>
              </div>
            </div>
          ) : !isCanTrain ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" aria-hidden />
              <div className="space-y-1">
                <p className="text-[14px] font-extrabold text-amber-950">
                  {memberPass.effectiveStatus === 'pending_approval'
                    ? 'Awaiting Reception Payment Approval'
                    : 'Membership Plan Expired'}
                </p>
                <p className="text-[12.5px] text-amber-800">
                  {memberPass.effectiveStatus === 'pending_approval'
                    ? `Show pass code ${memberPass.memberCode} at reception to activate.`
                    : 'Open the Rewards tab to pick a renewal plan and unlock daily check-in.'}
                </p>
              </div>
            </div>
          ) : memberPass.checkedInToday ? (
            /* Dark Check-In Celebration Card (Mockup Screen #5) */
            <div className="gym-fade-up gym-obsidian-mesh rounded-3xl p-5 text-white border border-[#C8F135]/40 shadow-[0_4px_24px_rgba(200,241,53,0.18)] space-y-3.5">
              <div className="flex items-center gap-3">
                <span className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#C8F135] text-[#0F1115] shadow-[0_0_20px_rgba(200,241,53,0.5)]">
                  <svg
                    className="h-6 w-6"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <polyline className="gym-check-draw" points="20 6 9 17 4 12" />
                  </svg>
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-[16px] font-black text-white">
                      Check-In Successful!
                    </p>
                    <span className="gym-pulse-dot inline-block h-2 w-2 rounded-full bg-[#C8F135]" />
                  </div>
                  <p className="text-[12px] text-slate-300">
                    Today ·{' '}
                    <span className="tabular-nums font-semibold">
                      {formatCheckInTime12h(
                        memberPass.todayCheckIn?.checkedInAt ??
                          memberPass.lastCheckInAt,
                      )}
                    </span>{' '}
                    ·{' '}
                    <span className="text-[#C8F135] font-extrabold">
                      {
                        getWorkoutFocusMeta(
                          memberPass.todayCheckIn?.workoutFocus ??
                            selectedWorkoutFocus,
                        ).dayLabel
                      }
                    </span>
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-between rounded-2xl bg-[#161920] border border-white/10 px-4 py-2.5 text-[12.5px]">
                <span className="flex items-center gap-2 font-black text-[#C8F135]">
                  <Trophy className="h-4 w-4" aria-hidden />
                  Great workout! Keep going 💪
                </span>
                <span className="font-mono font-bold text-slate-300 tabular-nums">
                  🔥 {Math.max(1, currentStreak)}d streak
                </span>
              </div>
            </div>
          ) : (
            /* 1-Tap Static QR Check-In Card */
            <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-[15px] font-extrabold text-[#0F1115]">
                    Daily Entrance Check-In
                  </h2>
                  <p className="text-[12px] text-slate-500">
                    Pick today&apos;s muscle split &amp; tap Check In Now
                  </p>
                </div>
                <span className="rounded-lg bg-[#0F1115] px-2 py-1 text-[11px] font-bold text-[#C8F135]">
                  {memberPass.daysRemaining}d left
                </span>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {GYM_WORKOUT_FOCUS_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setSelectedWorkoutFocus(opt.value)}
                    className={`rounded-xl border px-3 py-1.5 text-[12px] font-bold transition-colors cursor-pointer ${
                      selectedWorkoutFocus === opt.value
                        ? 'border-[#0F1115] bg-[#0F1115] text-[#C8F135]'
                        : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              {ptLeft > 0 && (
                <label className="flex items-center gap-2.5 rounded-xl border border-indigo-200 bg-indigo-50/70 px-3 py-2 text-[12.5px] font-semibold text-indigo-950 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={countAsPtSession}
                    onChange={(e) => setCountAsPtSession(e.target.checked)}
                    className="h-4 w-4 accent-[#0F1115]"
                  />
                  <span>
                    Count as Personal Training Session (-1 PT ·{' '}
                    <strong>{ptLeft} left</strong>
                    {memberPass.ptTrainerName
                      ? ` with ${memberPass.ptTrainerName}`
                      : ''}
                    )
                  </span>
                </label>
              )}

              <button
                type="button"
                disabled={checkingIn}
                onClick={() => void handleDailyCheckIn()}
                className="gym-tactile flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#C8F135] text-[14.5px] font-extrabold text-[#0F1115] shadow-[0_4px_16px_rgba(200,241,53,0.35)] hover:bg-[#b8e028] disabled:opacity-60 cursor-pointer"
              >
                {checkingIn ? (
                  <Loader2 className="h-4.5 w-4.5 animate-spin" aria-hidden />
                ) : (
                  <CheckCircle2 className="h-4.5 w-4.5" aria-hidden />
                )}
                Check In Now ✓
              </button>
            </div>
          )}

          {/* TODAY'S WORKOUT PLAN & LIVE SET/REP LOGGER (INSPIRED BY OPENGYM) */}
          {isCanTrain && !isFrozen && (
            <section className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3.5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wider text-slate-700">
                    {effectiveRoutine.isAssigned
                      ? 'Coach Assigned Plan'
                      : 'Smart Goal Plan'}
                  </span>
                  <h2 className="mt-1 text-[15.5px] font-extrabold text-[#0F1115]">
                    {effectiveRoutine.name}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAddExercisePicker((v) => !v)}
                  className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 px-2.5 text-[11.5px] font-bold text-[#0F1115] hover:bg-slate-50 cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5" aria-hidden /> Exercise
                </button>
              </div>

              {/* Day / Split Switcher */}
              <div className="flex gap-1.5 overflow-x-auto pb-1">
                {routineDayLabels.map((day) => (
                  <button
                    key={day}
                    type="button"
                    onClick={() => setSelectedDayLabel(day)}
                    className={`shrink-0 rounded-xl px-3 py-1.5 text-[12px] font-bold cursor-pointer ${
                      activeDayLabel === day
                        ? 'bg-[#0F1115] text-[#C8F135]'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {day}
                  </button>
                ))}
              </div>

              {/* Optional Exercise Library Picker */}
              {showAddExercisePicker && (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2 max-h-52 overflow-y-auto">
                  <p className="text-[11.5px] font-bold text-slate-600">
                    Add from {(workoutPlan?.exerciseCatalog ?? []).length} Gym
                    Exercises:
                  </p>
                  <div className="grid gap-1.5">
                    {(workoutPlan?.exerciseCatalog ?? []).map((catEx) => (
                      <button
                        key={catEx.id}
                        type="button"
                        onClick={() => {
                          setExtraExercises((prev) =>
                            prev.some((x) => x.name === catEx.name)
                              ? prev
                              : [
                                  ...prev,
                                  {
                                    exerciseId: catEx.id,
                                    name: catEx.name,
                                    muscleGroup: catEx.muscleGroup,
                                    dayLabel: activeDayLabel,
                                    sets: catEx.defaultSets,
                                    reps: catEx.defaultReps,
                                    restSeconds: catEx.restSeconds,
                                  },
                                ],
                          );
                          setShowAddExercisePicker(false);
                        }}
                        className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-[12px] font-semibold text-[#0F1115] hover:border-[#0F1115] cursor-pointer"
                      >
                        <span>{catEx.name}</span>
                        <span className="text-[10.5px] uppercase text-slate-400">
                          {catEx.muscleGroup}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Exercise Set Logger Cards */}
              <div className="space-y-3">
                {activeDayExercises.map((ex) => {
                  const exKey = ex.name.toLowerCase();
                  const loggedForEx = todaySets.filter(
                    (s) => s.exerciseName.toLowerCase() === exKey,
                  );
                  const prevPr = prByExercise.get(exKey);
                  const draft = setDrafts[exKey] ?? {
                    weight: prevPr ? String(prevPr.bestWeightKg) : '40',
                    reps: '10',
                  };
                  const isBusy = loggingExerciseKey === exKey;

                  return (
                    <div
                      key={`${ex.dayLabel}-${ex.name}`}
                      className="rounded-xl border border-slate-200 bg-[#F8F9FA] p-3 space-y-2.5"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-[13.5px] font-extrabold text-[#0F1115]">
                            {ex.name}
                          </p>
                          <p className="text-[11.5px] text-slate-500">
                            Target: <strong>{ex.sets} sets × {ex.reps}</strong> ·
                            Rest {ex.restSeconds}s
                            {prevPr && (
                              <span className="ml-1.5 font-bold text-emerald-700">
                                · Best: {prevPr.bestWeightKg} kg
                              </span>
                            )}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            setPlateCalcTargetKg(
                              Number.parseFloat(draft.weight) || 60,
                            )
                          }
                          className="shrink-0 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[10.5px] font-bold text-slate-600 hover:text-[#0F1115] cursor-pointer"
                          title="Calculate barbell plates per side"
                        >
                          Plates
                        </button>
                      </div>

                      {/* Logged sets pills today */}
                      {loggedForEx.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {loggedForEx.map((s) => (
                            <span
                              key={s.id}
                              className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-bold tabular-nums ${
                                s.isPersonalRecord
                                  ? 'bg-[#0F1115] text-[#C8F135]'
                                  : 'bg-emerald-100 text-emerald-900'
                              }`}
                            >
                              Set {s.setNumber}: {s.weightKg}kg × {s.reps}
                              {s.isPersonalRecord ? ' 🏆' : ' ✓'}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Fast Weight (kg) x Reps Logger Row */}
                      <div className="flex items-center gap-2">
                        <div className="relative flex-1">
                          <input
                            type="number"
                            step="2.5"
                            min={0}
                            aria-label={`${ex.name} weight kg`}
                            value={draft.weight}
                            onChange={(e) =>
                              setSetDrafts((prev) => ({
                                ...prev,
                                [exKey]: { ...draft, weight: e.target.value },
                              }))
                            }
                            className="h-9.5 w-full rounded-lg border border-slate-300 bg-white px-2.5 pr-8 text-[13px] font-bold text-[#0F1115] tabular-nums"
                          />
                          <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] font-bold text-slate-400">
                            kg
                          </span>
                        </div>
                        <span className="text-[12px] font-bold text-slate-400">
                          ×
                        </span>
                        <div className="relative w-20">
                          <input
                            type="number"
                            min={1}
                            max={200}
                            aria-label={`${ex.name} reps`}
                            value={draft.reps}
                            onChange={(e) =>
                              setSetDrafts((prev) => ({
                                ...prev,
                                [exKey]: { ...draft, reps: e.target.value },
                              }))
                            }
                            className="h-9.5 w-full rounded-lg border border-slate-300 bg-white px-2.5 pr-9 text-[13px] font-bold text-[#0F1115] tabular-nums"
                          />
                          <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10.5px] font-bold text-slate-400">
                            reps
                          </span>
                        </div>
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() =>
                            void handleLogExerciseSet(
                              ex,
                              loggedForEx.length + 1,
                            )
                          }
                          className="inline-flex h-9.5 shrink-0 items-center gap-1 rounded-lg bg-[#0F1115] px-3 text-[12px] font-extrabold text-[#C8F135] hover:bg-slate-800 disabled:opacity-60 cursor-pointer"
                        >
                          {isBusy ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                          ) : (
                            <Check className="h-3.5 w-3.5" aria-hidden />
                          )}
                          Log Set
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </div>
      )}

      {/* ==================== TAB 2: PROGRESS (PR WALL, VOLUME, BODY JOURNAL & LEADERBOARD) ==================== */}
      {activeTab === 'progress' && (
        <div className="space-y-4">
          {/* Volume + PR Header Card */}
          <div className="rounded-3xl bg-[#0F1115] p-5 text-white border border-white/10 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-[#C8F135]">
                  Strength &amp; Consistency
                </p>
                <h2 className="text-[20px] font-black">Your Progress Hub</h2>
              </div>
              <button
                type="button"
                onClick={handleExportCsv}
                className="inline-flex h-8.5 items-center gap-1.5 rounded-xl border border-white/15 bg-white/5 px-3 text-[11.5px] font-bold text-slate-200 hover:bg-white/10 cursor-pointer"
              >
                <Download className="h-3.5 w-3.5" aria-hidden /> CSV
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div className="rounded-2xl bg-[#161920] border border-white/10 p-3.5">
                <p className="text-[11px] font-semibold text-slate-400">
                  7-Day Volume Lifted
                </p>
                <p className="mt-1 text-[22px] font-black text-[#C8F135] tabular-nums">
                  {weeklyVolumeKg.toLocaleString('en-IN')} kg
                </p>
              </div>
              <div className="rounded-2xl bg-[#161920] border border-white/10 p-3.5">
                <p className="text-[11px] font-semibold text-slate-400">
                  Best Streak
                </p>
                <p className="mt-1 text-[22px] font-black text-white tabular-nums">
                  🔥 {memberPass.bestStreakDays ?? currentStreak} days
                </p>
              </div>
            </div>

            {/* 12-Week Consistency Heatmap */}
            <div className="space-y-1.5">
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
          </div>

          {/* Personal Records (PR) Wall */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
            <h3 className="text-[14.5px] font-extrabold text-[#0F1115] flex items-center gap-1.5">
              <Trophy className="h-4 w-4 text-amber-500" aria-hidden />
              Personal Records Wall
            </h3>
            {personalRecords.length === 0 ? (
              <p className="text-[12.5px] text-slate-500">
                Log your first exercise set in the Home tab — GymOS
                automatically computes your Estimated 1RM and tracks PRs here!
              </p>
            ) : (
              <div className="divide-y divide-slate-100">
                {personalRecords.slice(0, 8).map((pr) => (
                  <div
                    key={pr.exerciseName}
                    className="flex items-center justify-between py-2.5"
                  >
                    <div>
                      <p className="text-[13px] font-bold text-[#0F1115]">
                        {pr.exerciseName}
                      </p>
                      <p className="text-[11px] text-slate-400 uppercase">
                        {pr.muscleGroup} · Est 1RM {pr.best1rmKg} kg
                      </p>
                    </div>
                    <span className="rounded-lg bg-[#0F1115] px-2.5 py-1 text-[12.5px] font-black text-[#C8F135] tabular-nums">
                      {pr.bestWeightKg} kg
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 30-Day Body Transformation Journal */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-[14.5px] font-extrabold text-[#0F1115] flex items-center gap-1.5">
                <Scale className="h-4 w-4 text-[#0F1115]" aria-hidden />
                30-Day Body Journal
              </h3>
              <button
                type="button"
                onClick={() => setShowMeasureForm((v) => !v)}
                className="inline-flex h-8 items-center gap-1 rounded-lg bg-[#0F1115] px-2.5 text-[11.5px] font-bold text-[#C8F135] cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" aria-hidden /> Log Measurements
              </button>
            </div>

            {showMeasureForm && (
              <form
                onSubmit={(e) => void handleSaveBodyMeasurement(e)}
                className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2.5"
              >
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="number"
                    step="0.1"
                    required
                    placeholder="Weight (kg) *"
                    value={mWeight}
                    onChange={(e) => setMWeight(e.target.value)}
                    className="h-9.5 rounded-lg border border-slate-300 bg-white px-2.5 text-[12.5px] font-semibold"
                  />
                  <input
                    type="number"
                    step="0.5"
                    placeholder="Height cm (for BMI)"
                    value={mHeightCm}
                    onChange={(e) => setMHeightCm(e.target.value)}
                    className="h-9.5 rounded-lg border border-slate-300 bg-white px-2.5 text-[12.5px]"
                  />
                  <input
                    type="number"
                    step="0.1"
                    placeholder="Waist (in)"
                    value={mWaist}
                    onChange={(e) => setMWaist(e.target.value)}
                    className="h-9.5 rounded-lg border border-slate-300 bg-white px-2.5 text-[12.5px]"
                  />
                  <input
                    type="number"
                    step="0.1"
                    placeholder="Chest (in)"
                    value={mChest}
                    onChange={(e) => setMChest(e.target.value)}
                    className="h-9.5 rounded-lg border border-slate-300 bg-white px-2.5 text-[12.5px]"
                  />
                  <input
                    type="number"
                    step="0.1"
                    placeholder="Biceps (in)"
                    value={mBiceps}
                    onChange={(e) => setMBiceps(e.target.value)}
                    className="h-9.5 rounded-lg border border-slate-300 bg-white px-2.5 text-[12.5px]"
                  />
                  <input
                    type="text"
                    placeholder="Note (optional)"
                    value={mNote}
                    onChange={(e) => setMNote(e.target.value)}
                    className="h-9.5 rounded-lg border border-slate-300 bg-white px-2.5 text-[12.5px]"
                  />
                </div>
                <button
                  type="submit"
                  disabled={savingMeasure}
                  className="h-9.5 w-full rounded-lg bg-[#C8F135] text-[12.5px] font-extrabold text-[#0F1115] cursor-pointer"
                >
                  {savingMeasure ? 'Saving…' : 'Save Monthly Measurement ✓'}
                </button>
              </form>
            )}

            {(memberPass.bodyMeasurements ?? []).length === 0 ? (
              <p className="text-[12.5px] text-slate-500">
                Log your Weight, Waist, Chest &amp; Biceps every 30 days to track
                your transformation!
              </p>
            ) : (
              <div className="space-y-2">
                {(memberPass.bodyMeasurements ?? []).slice(0, 5).map((bm) => (
                  <div
                    key={bm.id}
                    className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 flex items-center justify-between gap-2"
                  >
                    <div>
                      <p className="text-[13px] font-extrabold text-[#0F1115] tabular-nums">
                        {bm.weightKg} kg
                        {bm.bmi ? ` · BMI ${bm.bmi}` : ''}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        {[
                          bm.waistInches ? `Waist ${bm.waistInches}"` : null,
                          bm.chestInches ? `Chest ${bm.chestInches}"` : null,
                          bm.bicepsInches ? `Biceps ${bm.bicepsInches}"` : null,
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

          {/* TOP-10 MONTHLY STREAK LEADERBOARD */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-[14.5px] font-extrabold text-[#0F1115] flex items-center gap-1.5">
                <Flame className="h-4 w-4 text-orange-500" aria-hidden />
                Monthly Consistency Leaderboard
              </h3>
              <span className="text-[11px] font-bold text-slate-400">
                Top 10
              </span>
            </div>
            {leaderboard.length === 0 ? (
              <p className="text-[12.5px] text-slate-500">
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
                          ? 'bg-[#0F1115] text-white border border-[#C8F135]'
                          : 'bg-slate-50 text-[#0F1115]'
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
                          <p
                            className={`text-[11px] ${isMe ? 'text-slate-400' : 'text-slate-500'}`}
                          >
                            {row.workoutsThisMonth} workouts this month
                          </p>
                        </div>
                      </div>
                      <span
                        className={`rounded-lg px-2 py-0.5 text-[11.5px] font-extrabold tabular-nums ${
                          isMe
                            ? 'bg-[#C8F135] text-[#0F1115]'
                            : 'bg-white border border-slate-200 text-slate-700'
                        }`}
                      >
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

      {/* ==================== TAB 3: REWARDS (DIGITAL QR PASS, DUES, PLANS & GOOGLE REVIEW) ==================== */}
      {activeTab === 'rewards' && (
        <div className="space-y-4">
          {/* Dark Digital Membership QR Pass Card (Mockup Screen #2) */}
          <div className="overflow-hidden rounded-3xl bg-[#0F1115] text-white border border-white/10 shadow-lg">
            <div className="p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#C8F135] text-[#0F1115]">
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
                        ? 'bg-[#C8F135] text-[#0F1115]'
                        : memberPass.effectiveStatus === 'expiring_soon'
                          ? 'bg-amber-400 text-[#0F1115]'
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
                <p className="text-[20px] font-black">{toTitleCase(memberPass.fullName)}</p>
                <p className="text-[12px] text-slate-400">
                  {memberPass.planName} · {memberPass.memberCode}
                </p>
              </div>

              <div className="flex items-center justify-between border-t border-white/10 pt-3">
                <span className="flex items-center gap-1.5 text-[12px] text-slate-300">
                  <Calendar className="h-3.5 w-3.5 text-[#C8F135]" aria-hidden />
                  {memberPass.endDate
                    ? formatIsoDatePretty(memberPass.endDate)
                    : 'Pending Approval'}
                </span>
                <span className="rounded-lg border border-[#C8F135]/40 bg-[#C8F135]/15 px-2.5 py-1 text-[12px] font-extrabold text-[#C8F135] tabular-nums">
                  {memberPass.daysRemaining} Days Left
                </span>
              </div>
            </div>

            {/* White QR Container */}
            <div className="bg-white p-5 text-center space-y-2">
              <div className="inline-flex rounded-2xl border border-slate-200 p-2 bg-white">
                <canvas ref={passQrCanvasRef} />
              </div>
              <p className="text-[12px] font-semibold text-slate-500">
                Show this QR code at the front desk
              </p>
            </div>
          </div>

          {/* Installment Balance Due Reminder */}
          {balanceDue > 0 && (
            <div className="rounded-2xl border-2 border-amber-300 bg-amber-50 p-4 flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-amber-700 shrink-0 mt-0.5" aria-hidden />
              <div>
                <p className="text-[14px] font-extrabold text-amber-950">
                  Installment Balance Due:{' '}
                  {formatPriceFromPaise(balanceDue, 'INR')}
                </p>
                <p className="text-[12px] text-amber-800 mt-0.5">
                  {memberPass.balanceDueDate
                    ? `Please settle by ${formatIsoDatePretty(memberPass.balanceDueDate)} via UPI or Cash at reception.`
                    : 'Settle via UPI or Cash at the reception desk on your next visit.'}
                </p>
              </div>
            </div>
          )}

          {/* Choose Your Plan / Renewal Selector (Mockup Screen #4) */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
            <div>
              <h3 className="text-[15px] font-extrabold text-[#0F1115]">
                Renew or Upgrade Plan
              </h3>
              <p className="text-[12px] text-slate-500">
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
                        ? 'border-2 border-[#0F1115] bg-[#C8F135]/20'
                        : 'border-slate-200 bg-slate-50 hover:border-slate-300'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[14px] font-extrabold text-[#0F1115]">
                          {plan.name}
                        </span>
                        {isPopular && (
                          <span className="rounded-full bg-[#0F1115] px-2 py-0.5 text-[10px] font-bold text-[#C8F135]">
                            Most Popular
                          </span>
                        )}
                      </div>
                      <p className="text-[11.5px] text-slate-500">
                        {plan.durationDays} days · Full Gym &amp; Tracker Access
                      </p>
                    </div>
                    <span className="text-[15px] font-black text-[#0F1115] tabular-nums">
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
              className="flex h-11.5 w-full items-center justify-center gap-2 rounded-2xl bg-[#C8F135] text-[14px] font-extrabold text-[#0F1115] hover:bg-[#b8e028] cursor-pointer"
            >
              Proceed to Pay <ArrowRight className="h-4 w-4" aria-hidden />
            </button>
            {renewNotice && (
              <p className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-[12px] font-semibold text-emerald-900">
                {renewNotice}
              </p>
            )}
          </div>

          {/* 1-Tap AI Google Review CTA */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#0F1115] text-[#C8F135]">
                <Sparkles className="h-5 w-5" aria-hidden />
              </span>
              <div>
                <p className="text-[13.5px] font-extrabold text-[#0F1115]">
                  Loving {portal.business.name}?
                </p>
                <p className="text-[12px] text-slate-500">
                  Write a 10-second AI-assisted Google Review
                </p>
              </div>
            </div>
            <Link
              to={`/r/${businessSlug}`}
              className="inline-flex h-9 shrink-0 items-center gap-1 rounded-xl bg-[#0F1115] px-3 text-[12px] font-bold text-[#C8F135]"
            >
              <Star className="h-3.5 w-3.5" aria-hidden /> Review
            </Link>
          </div>
        </div>
      )}

      {/* ==================== TAB 4: PROFILE (GOAL, COACH NOTES & SAVE TO HOME SCREEN) ==================== */}
      {activeTab === 'profile' && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
            <div className="flex items-center gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#0F1115] text-[16px] font-black text-[#C8F135]">
                {firstName.slice(0, 2).toUpperCase()}
              </span>
              <div>
                <h2 className="text-[17px] font-extrabold text-[#0F1115]">
                  {toTitleCase(memberPass.fullName)}
                </h2>
                <p className="text-[12.5px] text-slate-500">
                  {memberPass.memberCode} · +91 {memberPass.phone}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5 border-t border-slate-100 pt-3">
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-[11px] font-semibold text-slate-400">
                  Fitness Goal
                </p>
                <p className="mt-0.5 text-[13px] font-extrabold text-[#0F1115]">
                  {getFitnessGoalMeta(memberPass.fitnessGoal).emoji}{' '}
                  {getFitnessGoalMeta(memberPass.fitnessGoal).label}
                </p>
              </div>
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-[11px] font-semibold text-slate-400">
                  Weight Target
                </p>
                <p className="mt-0.5 text-[13px] font-extrabold text-[#0F1115] tabular-nums">
                  {memberPass.startingWeightKg ?? '—'} →{' '}
                  {memberPass.targetWeightKg ?? '—'} kg
                </p>
              </div>
            </div>

            {memberPass.trainerNotes && (
              <div className="rounded-xl border border-indigo-200 bg-indigo-50/70 p-3">
                <p className="text-[11px] font-bold uppercase tracking-wider text-indigo-800">
                  Coach Notes
                </p>
                <p className="mt-1 text-[12.5px] text-indigo-950">
                  {memberPass.trainerNotes}
                </p>
              </div>
            )}

            <button
              type="button"
              onClick={() => void handleSaveToHomeScreen()}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#C8F135] text-[13.5px] font-extrabold text-[#0F1115] cursor-pointer"
            >
              <Smartphone className="h-4 w-4" aria-hidden />
              Save Gym Pass to Home Screen
            </button>

            {showHomeGuide && (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-[12px] text-slate-600 space-y-1">
                <p>
                  <strong>iPhone Safari:</strong> Tap Share →{' '}
                  <strong>Add to Home Screen</strong>.
                </p>
                <p>
                  <strong>Android Chrome:</strong> Tap ⋮ Menu →{' '}
                  <strong>Add to Home screen</strong>.
                </p>
              </div>
            )}

            <button
              type="button"
              onClick={handleSwitchMember}
              className="flex h-10 w-full items-center justify-center rounded-xl border border-slate-200 text-[12.5px] font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
            >
              Switch Phone Number / Sign Out
            </button>
          </div>
        </div>
      )}

      {/* FLOATING REST COUNTDOWN BAR (ABOVE 4-TAB NAV) */}
      {restSecondsLeft > 0 && (
        <div
          role="status"
          className="fixed bottom-19 left-1/2 z-40 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 rounded-2xl border border-[#C8F135] bg-[#0F1115] px-4 py-3 text-white shadow-2xl flex items-center justify-between gap-3"
        >
          <div className="flex items-center gap-2.5">
            <Timer className="h-5 w-5 text-[#C8F135]" aria-hidden />
            <div>
              <p className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400">
                Rest Timer
              </p>
              <p className="font-mono text-[18px] font-black text-[#C8F135] tabular-nums">
                {String(Math.floor(restSecondsLeft / 60)).padStart(2, '0')}:
                {String(restSecondsLeft % 60).padStart(2, '0')}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setRestSecondsLeft((s) => s + 15)}
              className="rounded-lg border border-white/15 bg-white/10 px-2.5 py-1.5 text-[11.5px] font-bold text-white cursor-pointer"
            >
              +15s
            </button>
            <button
              type="button"
              onClick={() => setRestSecondsLeft(0)}
              className="rounded-lg bg-[#C8F135] px-3 py-1.5 text-[11.5px] font-extrabold text-[#0F1115] cursor-pointer"
            >
              Skip
            </button>
          </div>
        </div>
      )}

      {/* BARBELL PLATE CALCULATOR MODAL */}
      {plateCalcTargetKg !== null && plateBreakdown && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Barbell Plate Calculator"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-[2px]"
        >
          <div className="w-full max-w-sm rounded-3xl bg-[#0F1115] p-5 text-white border border-white/15 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-[16px] font-extrabold flex items-center gap-2">
                <Dumbbell className="h-4.5 w-4.5 text-[#C8F135]" aria-hidden />
                Barbell Plate Math
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
              {(
                [
                  { kg: 20, label: 'Olympic 20kg' },
                  { kg: 10, label: 'EZ Bar 10kg' },
                  { kg: 0, label: 'Smith 0kg' },
                ] as const
              ).map((b) => (
                <button
                  key={b.kg}
                  type="button"
                  onClick={() => setPlateBarKg(b.kg)}
                  className={`flex-1 rounded-xl py-2 text-[11.5px] font-bold cursor-pointer ${
                    plateBarKg === b.kg
                      ? 'bg-[#C8F135] text-[#0F1115]'
                      : 'bg-[#161920] text-slate-300 border border-white/10'
                  }`}
                >
                  {b.label}
                </button>
              ))}
            </div>

            <div className="rounded-2xl bg-[#161920] p-4 text-center space-y-2">
              <p className="text-[11.5px] text-slate-400">
                Target Total:{' '}
                <strong className="text-white">{plateCalcTargetKg} kg</strong> (
                {plateBreakdown.perSideKg} kg per side)
              </p>
              {plateBreakdown.platesPerSide.length === 0 ? (
                <p className="text-[13px] font-bold text-[#C8F135]">
                  Empty bar ({plateBarKg} kg) — no plates needed!
                </p>
              ) : (
                <div className="flex flex-wrap justify-center gap-2 pt-1">
                  {plateBreakdown.platesPerSide.map((p) => (
                    <span
                      key={p.plateKg}
                      className="rounded-xl bg-[#C8F135] px-3 py-1.5 text-[13px] font-black text-[#0F1115] tabular-nums"
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

      {/* PERSISTENT 4-TAB BOTTOM NAVIGATION BAR */}
      <nav
        aria-label="Gym Member Navigation"
        className="fixed bottom-3 left-1/2 z-30 grid w-[calc(100%-1.5rem)] max-w-md -translate-x-1/2 grid-cols-4 rounded-2xl border border-white/10 bg-[#0F1115]/95 p-1.5 shadow-2xl backdrop-blur-md"
      >
        {(
          [
            { id: 'home', label: 'Home', Icon: Home },
            { id: 'progress', label: 'Progress', Icon: BarChart3 },
            { id: 'rewards', label: 'Rewards', Icon: Gift },
            { id: 'profile', label: 'Profile', Icon: User },
          ] as const
        ).map(({ id, label, Icon }) => {
          const active = activeTab === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setActiveTab(id)}
              className={`gym-tactile flex flex-col items-center justify-center gap-0.5 rounded-xl py-2 text-[11px] font-bold transition-all cursor-pointer ${
                active
                  ? 'bg-[#1C2028] text-[#C8F135] shadow-[0_0_12px_rgba(200,241,53,0.25)]'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              <span>{label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
