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
  Bell,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  Droplets,
  Dumbbell,
  Flame,
  Home,
  Loader2,
  MessageCircle,
  Minus,
  Pencil,
  Play,
  Plus,
  QrCode,
  Scale,
  Search,
  SearchX,
  Send,
  Shield,
  Smartphone,
  Snowflake,
  Sparkles,
  Star,
  Trash2,
  Trophy,
  Upload,
  Users,
  Utensils,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import type {
  GymCatalogEquipment,
  GymCatalogExercise,
  GymCatalogMuscleGroup,
  GymFitnessGoal,
  GymLeaderboardEntry,
  GymMember,
  GymMemberAthleteHubPayload,
  GymMembersCommunityHubPayload,
  GymMemberWorkoutPlanPayload,
  GymPreferredShift,
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
  GYM_SHIFT_OPTIONS,
  GYM_WORKOUT_FOCUS_OPTIONS,
  normalizeGymAccentColor,
  normalizeGymPreferredShift,
  readExerciseMediaFileAsDataUrl,
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

type MemberTab = 'home' | 'plan' | 'members' | 'stats';
type PlanSubTab = 'schedule' | 'nutrition' | 'pass';
type MembersSubTab = 'chat' | 'directory';
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
  rir: number | null;
  completed: boolean;
  isRecord: boolean;
}

interface WorkoutSummaryCompletion {
  durationSec: number;
  totalVolumeKg: number;
  completedSets: number;
  totalSets: number;
  prsCount: number;
  muscles: string[];
  dayTitle: string;
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

function formatShortMessageTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

function getTodayWeekKey(): GymWeeklyScheduleDay['dayKey'] {
  const jsDay = new Date().getDay();
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

function classifyStrengthLevel(multiplier: number): string {
  if (multiplier >= 1.5) return 'Advanced lifter';
  if (multiplier >= 1.0) return 'Intermediate lifter';
  if (multiplier >= 0.6) return 'Novice lifter';
  return 'Beginner lifter';
}

function getContrastInkForHex(hex: string): '#0B0D10' | '#FFFFFF' {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return '#0B0D10';
  const r = Number.parseInt(clean.slice(0, 2), 16);
  const g = Number.parseInt(clean.slice(2, 4), 16);
  const b = Number.parseInt(clean.slice(4, 6), 16);
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 145 ? '#0B0D10' : '#FFFFFF';
}

function GymBrandMark({
  logoUrl,
  name,
  accentColor,
  inkColor,
  size = 'md',
}: {
  logoUrl?: string | null;
  name: string;
  accentColor: string;
  inkColor: string;
  size?: 'sm' | 'md' | 'lg';
}) {
  const [imgErr, setImgErr] = useState(false);
  const boxCls =
    size === 'lg'
      ? 'h-16 w-16 rounded-2xl'
      : size === 'sm'
        ? 'h-9 w-9 rounded-xl'
        : 'h-10 w-10 rounded-xl';
  if (logoUrl && !imgErr) {
    return (
      <img
        src={logoUrl}
        alt={`${name} logo`}
        onError={() => setImgErr(true)}
        className={`${boxCls} shrink-0 object-cover border border-white/15 bg-[#14171D] shadow-sm`}
      />
    );
  }
  return (
    <span
      className={`flex ${boxCls} shrink-0 items-center justify-center shadow-sm`}
      style={{
        backgroundColor: accentColor,
        color: inkColor,
        boxShadow: `0 0 18px ${accentColor}55`,
      }}
    >
      <Dumbbell
        className={size === 'lg' ? 'h-8 w-8' : 'h-5 w-5'}
        aria-hidden
      />
    </span>
  );
}

function AthleteSplashIllustration({
  accentColor = '#C8F135',
  logoUrl,
  gymName = 'Gym',
}: {
  accentColor?: string;
  logoUrl?: string | null;
  gymName?: string;
}) {
  const [logoErr, setLogoErr] = useState(false);
  return (
    <div className="relative mx-auto flex h-44 w-44 items-center justify-center">
      <div
        className="gym-glow-drift absolute inset-0 rounded-full blur-2xl opacity-25"
        style={{ backgroundColor: accentColor }}
      />
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
          stroke={accentColor}
          strokeOpacity="0.28"
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
          stroke={accentColor}
          strokeOpacity="0.38"
          strokeWidth="1.5"
        />
      </svg>
      <div
        className="relative flex h-20 w-20 items-center justify-center overflow-hidden rounded-3xl bg-gradient-to-br from-[#1E293B] to-[#0F172A]"
        style={{
          border: `1.5px solid ${accentColor}66`,
          boxShadow: `0 0 28px ${accentColor}55`,
        }}
      >
        {logoUrl && !logoErr ? (
          <img
            src={logoUrl}
            alt={gymName}
            onError={() => setLogoErr(true)}
            className="h-full w-full object-cover"
          />
        ) : (
          <Dumbbell
            className="h-10 w-10"
            style={{ color: accentColor }}
            aria-hidden="true"
          />
        )}
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
  const [membersSubTab, setMembersSubTab] = useState<MembersSubTab>('chat');
  const [statsSubTab, setStatsSubTab] = useState<StatsSubTab>('overview');

  // Member & live training state
  const [memberPass, setMemberPass] = useState<GymMember | null>(null);
  const [workoutPlan, setWorkoutPlan] =
    useState<GymMemberWorkoutPlanPayload | null>(null);
  const [athleteHub, setAthleteHub] =
    useState<GymMemberAthleteHubPayload | null>(null);
  const [communityHub, setCommunityHub] =
    useState<GymMembersCommunityHubPayload | null>(null);
  const [leaderboard, setLeaderboard] = useState<GymLeaderboardEntry[]>([]);

  // New Member Join form
  const [fullName, setFullName] = useState('');
  const [joinPhone, setJoinPhone] = useState('');
  const [selectedPlanId, setSelectedPlanId] = useState('3_months');
  const [fitnessGoal, setFitnessGoal] = useState<GymFitnessGoal>('muscle_gain');
  const [preferredShift, setPreferredShift] =
    useState<GymPreferredShift>('morning');
  const [updatingShift, setUpdatingShift] = useState(false);
  const [startingWeightInput, setStartingWeightInput] = useState('');
  const [targetWeightInput, setTargetWeightInput] = useState('');
  const [submittingJoin, setSubmittingJoin] = useState(false);

  // Notification Bell, Sound Chime & Self-Plan Split Editor State
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => {
    try {
      return window.localStorage.getItem('reviewassist_gym_sound_v1') !== 'off';
    } catch {
      return true;
    }
  });
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const [notifBanner, setNotifBanner] = useState<{
    sender: string;
    text: string;
  } | null>(null);
  const [showNotifPopover, setShowNotifPopover] = useState(false);
  const lastSeenMsgIdRef = useRef<string | null>(null);

  const [editingDayKey, setEditingDayKey] = useState<string | null>(null);
  const [editDayFocusTitle, setEditDayFocusTitle] = useState('');
  const [editDayIsRest, setEditDayIsRest] = useState(false);
  const [editDayExercises, setEditDayExercises] = useState<
    GymRoutineExerciseItem[]
  >([]);
  const [editDayAddExSearch, setEditDayAddExSearch] = useState('');
  const [savingSelfPlan, setSavingSelfPlan] = useState(false);

  // Returning Member Sign-In lookup
  const [lookupPhone, setLookupPhone] = useState(() =>
    businessSlug ? loadStoredPhone(businessSlug) : '',
  );
  const [lookingUp, setLookingUp] = useState(false);

  // Check-In modal state
  const [showCheckInModal, setShowCheckInModal] = useState(false);
  const [selectedWorkoutFocus, setSelectedWorkoutFocus] =
    useState<GymWorkoutFocus>('chest');
  const [memberWorkoutNote, setMemberWorkoutNote] = useState('');
  const [countAsPtSession, setCountAsPtSession] = useState(false);
  const [checkingIn, setCheckingIn] = useState(false);

  // Plan tab & Day Swapper modal
  const [scheduleModeView, setScheduleModeView] = useState<
    'fixed_week' | 'rotation'
  >('fixed_week');
  const [expandedDayKey, setExpandedDayKey] = useState<string | null>(
    getTodayWeekKey(),
  );
  const [showSwapDayModal, setShowSwapDayModal] = useState(false);
  const [customSelectedDayKey, setCustomSelectedDayKey] = useState<
    string | null
  >(null);

  // Focused 1-Exercise-at-a-Time Active Workout Session State
  const [sessionActive, setSessionActive] = useState(false);
  const [sessionMinimized, setSessionMinimized] = useState(false);
  const [stageAnimMinimized, setStageAnimMinimized] = useState(false);
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
  const [workoutCompleteSummary, setWorkoutCompleteSummary] =
    useState<WorkoutSummaryCompletion | null>(null);

  // Exercises Library Drawer + Custom Exercise Creator
  const [showExerciseLibraryDrawer, setShowExerciseLibraryDrawer] =
    useState(false);
  const [exSearch, setExSearch] = useState('');
  const [exMuscleFilter, setExMuscleFilter] = useState<string>('all');
  const [selectedCatalogEx, setSelectedCatalogEx] =
    useState<GymCatalogExercise | null>(null);
  const [showCreateCustomExForm, setShowCreateCustomExForm] = useState(false);
  const [newExName, setNewExName] = useState('');
  const [newExMuscle, setNewExMuscle] =
    useState<GymCatalogMuscleGroup>('chest');
  const [newExEquip, setNewExEquip] =
    useState<GymCatalogEquipment>('dumbbell');
  const [newExGifUrl, setNewExGifUrl] = useState('');
  const [creatingCustomEx, setCreatingCustomEx] = useState(false);

  // Members Directory & Live Chat state
  const [memberDirSearch, setMemberDirSearch] = useState('');
  const [chatDraft, setChatDraft] = useState('');
  const [sendingChat, setSendingChat] = useState(false);

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
      const [planData, hubData, boardData, commData] = await Promise.all([
        businessRepository.getGymMemberWorkoutPlan({
          businessSlug: slug,
          memberId: member.id,
        }),
        businessRepository.getGymMemberAthleteHub({
          businessSlug: slug,
          memberId: member.id,
        }),
        businessRepository.getGymMonthlyLeaderboard(slug),
        businessRepository
          .getGymMembersCommunityHub({
            businessSlug: slug,
            requesterMemberId: member.id,
          })
          .catch(() => ({ membersDirectory: [], chatMessages: [] })),
      ]);
      if (planData) setWorkoutPlan(planData);
      if (hubData) {
        setAthleteHub(hubData);
        if (hubData.coachPlan?.scheduleMode) {
          setScheduleModeView(hubData.coachPlan.scheduleMode);
        }
      }
      setLeaderboard(boardData);
      setCommunityHub(commData);
      const msgs = commData.chatMessages ?? [];
      if (msgs.length > 0 && !lastSeenMsgIdRef.current) {
        lastSeenMsgIdRef.current = msgs[msgs.length - 1].id;
      }
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

  // Active session elapsed clock (keeps running even while minimized!)
  useEffect(() => {
    if (!sessionActive) return;
    const id = window.setInterval(() => {
      setSessionElapsedSec((prev) => prev + 1);
    }, 1000);
    return () => window.clearInterval(id);
  }, [sessionActive]);

  // Live Notification Polling across Members Community Chat (chimes + bell badge)
  useEffect(() => {
    if (!businessSlug || !memberPass) return;
    const intervalMs = activeTab === 'members' ? 8000 : 15000;
    const id = window.setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      void businessRepository
        .getGymMembersCommunityHub({
          businessSlug,
          requesterMemberId: memberPass.id,
        })
        .then((commData) => {
          setCommunityHub(commData);
          const msgs = commData.chatMessages ?? [];
          if (msgs.length === 0) return;
          const newest = msgs[msgs.length - 1];
          if (!lastSeenMsgIdRef.current) {
            lastSeenMsgIdRef.current = newest.id;
            return;
          }
          if (newest.id !== lastSeenMsgIdRef.current) {
            lastSeenMsgIdRef.current = newest.id;
            if (newest.memberId !== memberPass.id) {
              if (soundEnabled) {
                playNotificationChime('order');
              }
              if (!(activeTab === 'members' && membersSubTab === 'chat')) {
                setUnreadChatCount((c) => Math.min(99, c + 1));
                setNotifBanner({
                  sender: newest.senderName,
                  text: newest.messageText.slice(0, 90),
                });
              }
            }
          }
        })
        .catch(() => {});
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [activeTab, membersSubTab, businessSlug, memberPass, soundEnabled]);

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
    if (customSelectedDayKey) {
      const picked = effectiveWeeklySchedule.find(
        (d) => d.dayKey === customSelectedDayKey,
      );
      if (picked && !picked.isRestDay && picked.exercises.length > 0) {
        return picked;
      }
    }
    const found = effectiveWeeklySchedule.find(
      (d) => d.dayKey === todayWeekKey,
    );
    if (found && !found.isRestDay && found.exercises.length > 0) return found;
    return (
      effectiveWeeklySchedule.find(
        (d) => !d.isRestDay && d.exercises.length > 0,
      ) ?? effectiveWeeklySchedule[0]
    );
  }, [effectiveWeeklySchedule, todayWeekKey, customSelectedDayKey]);

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
      athleteHub?.exerciseCatalog ?? workoutPlan?.exerciseCatalog ?? [],
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

  const filteredDirectoryMembers = useMemo(() => {
    const all = communityHub?.membersDirectory ?? [];
    const q = memberDirSearch.trim().toLowerCase();
    if (!q) return all;
    return all.filter(
      (m) =>
        m.fullName.toLowerCase().includes(q) ||
        m.memberCode.toLowerCase().includes(q),
    );
  }, [communityHub?.membersDirectory, memberDirSearch]);

  function launchWorkoutSession(
    title: string,
    exercises: GymRoutineExerciseItem[],
  ) {
    // If already running & minimized, resume right where user left off
    if (sessionActive && sessionMinimized && sessionExercises.length > 0) {
      setSessionMinimized(false);
      return;
    }

    const combined = [...exercises, ...extraExercises];
    const finalExercises =
      combined.length > 0 ? combined : todayScheduleDay?.exercises ?? [];
    if (finalExercises.length === 0) {
      setErrorMsg(
        'No exercises in this day yet. Pick a workout day from Plan!',
      );
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
          rir: logged ? 2 : null,
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
    setSessionMinimized(false);
    setStageAnimMinimized(false);
    setSessionActive(true);
  }

  function handleFinishActiveWorkout() {
    const allRows = Object.values(sessionSetsByEx).flat();
    const completed = allRows.filter((r) => r.completed);
    const totalVol = Math.round(
      completed.reduce((sum, r) => sum + r.weightKg * r.reps, 0),
    );
    const prsCount = completed.filter((r) => r.isRecord).length;
    const muscles = Array.from(
      new Set(sessionExercises.map((e) => e.muscleGroup)),
    );

    setWorkoutCompleteSummary({
      durationSec: sessionElapsedSec,
      totalVolumeKg: totalVol,
      completedSets: completed.length,
      totalSets: allRows.length,
      prsCount,
      muscles,
      dayTitle: sessionDayTitle,
    });
    setSessionActive(false);
    setSessionMinimized(false);
    setRestSecondsLeft(0);
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

  function cycleSetRir(exName: string, rowIndex: number) {
    const key = exName.toLowerCase();
    setSessionSetsByEx((prev) => {
      const rows = [...(prev[key] ?? [])];
      const row = rows[rowIndex];
      if (!row) return prev;
      const cycle = [null, 3, 2, 1, 0];
      const nextIdx = (cycle.indexOf(row.rir) + 1) % cycle.length;
      rows[rowIndex] = { ...row, rir: cycle[nextIdx] };
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
        rir: null,
        completed: false,
        isRecord: false,
      });
      return { ...prev, [key]: rows };
    });
  }

  function appendExerciseToSessionOrToday(ex: GymCatalogExercise) {
    const item: GymRoutineExerciseItem = {
      exerciseId: ex.id,
      name: ex.name,
      muscleGroup: ex.muscleGroup,
      dayLabel: todayScheduleDay?.focusTitle ?? 'Workout',
      sets: ex.defaultSets,
      reps: ex.defaultReps,
      restSeconds: ex.restSeconds,
      animationKey: ex.animationKey,
      animationGifUrl: ex.animationGifUrl,
      formCues: ex.formCues,
    };

    if (sessionActive) {
      const key = item.name.toLowerCase();
      setSessionExercises((prev) =>
        prev.some((e) => e.name.toLowerCase() === key)
          ? prev
          : [...prev, item],
      );
      setSessionSetsByEx((prev) => {
        if (prev[key]) return prev;
        return {
          ...prev,
          [key]: Array.from({ length: item.sets || 3 }, (_, i) => ({
            setNumber: i + 1,
            weightKg: 40,
            reps: 10,
            rir: null,
            completed: false,
            isRecord: false,
          })),
        };
      });
      setShowExerciseLibraryDrawer(false);
      setSessionMinimized(false);
    } else {
      setExtraExercises((prev) =>
        prev.some((e) => e.name === item.name) ? prev : [...prev, item],
      );
      setShowExerciseLibraryDrawer(false);
      launchWorkoutSession(todayScheduleDay?.focusTitle ?? 'Custom Session', [
        ...(todayScheduleDay?.exercises ?? []),
        item,
      ]);
    }
  }

  async function handleCreateCustomExercise(e: FormEvent) {
    e.preventDefault();
    if (!businessSlug || !memberPass) return;
    setCreatingCustomEx(true);
    setErrorMsg(null);
    try {
      const created = await businessRepository.memberCreateCustomGymExercise({
        businessSlug,
        memberId: memberPass.id,
        name: newExName,
        muscleGroup: newExMuscle,
        equipment: newExEquip,
        animationGifUrl: newExGifUrl.trim() || null,
      });
      setShowCreateCustomExForm(false);
      setNewExName('');
      setNewExGifUrl('');
      setSuccessMsg(`Created "${created.name}" & added to your gym library!`);
      await hydrateMemberExtras(businessSlug, memberPass);
    } catch (err) {
      setErrorMsg((err as Error).message);
    } finally {
      setCreatingCustomEx(false);
    }
  }

  async function handleSendChatMessage(textOverride?: string) {
    if (!businessSlug || !memberPass) return;
    const text = (textOverride ?? chatDraft).trim();
    if (!text) return;
    setSendingChat(true);
    setErrorMsg(null);
    try {
      await businessRepository.sendGymCommunityMessage({
        businessSlug,
        memberId: memberPass.id,
        messageText: text,
        messageType: 'chat',
      });
      if (!textOverride) setChatDraft('');
      const commData = await businessRepository.getGymMembersCommunityHub({
        businessSlug,
        requesterMemberId: memberPass.id,
      });
      setCommunityHub(commData);
      const msgs = commData.chatMessages ?? [];
      if (msgs.length > 0) {
        lastSeenMsgIdRef.current = msgs[msgs.length - 1].id;
      }
    } catch (err) {
      setErrorMsg((err as Error).message);
    } finally {
      setSendingChat(false);
    }
  }

  function handleToggleSound() {
    setSoundEnabled((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(
          'reviewassist_gym_sound_v1',
          next ? 'on' : 'off',
        );
      } catch {
        // Ignore storage error
      }
      if (next) {
        playNotificationChime('order');
      }
      return next;
    });
  }

  async function handleChangeMemberShift(nextShift: GymPreferredShift) {
    if (!businessSlug || !memberPass) return;
    setUpdatingShift(true);
    setErrorMsg(null);
    try {
      const updated = await businessRepository.updateGymMemberPreferredShift({
        businessSlug,
        memberId: memberPass.id,
        preferredShift: nextShift,
      });
      setMemberPass((prev) =>
        prev
          ? {
              ...prev,
              preferredShift: updated.preferredShift ?? nextShift,
            }
          : prev,
      );
      setAthleteHub((prev) =>
        prev
          ? { ...prev, preferredShift: updated.preferredShift ?? nextShift }
          : prev,
      );
      setSuccessMsg(
        `Switched batch to ${
          nextShift === 'morning'
            ? '🌅 Morning Batch'
            : nextShift === 'evening'
              ? '🌆 Evening Batch'
              : '⏰ Flexible Batch'
        }`,
      );
    } catch (err) {
      setErrorMsg((err as Error).message);
    } finally {
      setUpdatingShift(false);
    }
  }

  function openDaySplitEditor(day: GymWeeklyScheduleDay) {
    setEditingDayKey(day.dayKey);
    setEditDayFocusTitle(day.focusTitle);
    setEditDayIsRest(Boolean(day.isRestDay));
    setEditDayExercises(day.exercises.map((e) => ({ ...e })));
    setEditDayAddExSearch('');
  }

  async function handleSaveDaySplitEdit(e: FormEvent) {
    e.preventDefault();
    if (!businessSlug || !memberPass || !editingDayKey) return;
    setSavingSelfPlan(true);
    setErrorMsg(null);
    try {
      const baseDays =
        effectiveWeeklySchedule.length > 0
          ? effectiveWeeklySchedule
          : buildDefaultWeeklyScheduleForGoal(memberPass.fitnessGoal);
      const cleanTitle =
        editDayFocusTitle.trim() ||
        (editDayIsRest ? 'Rest & Recovery' : 'Custom Workout');
      const nextSchedule = baseDays.map((d) =>
        d.dayKey === editingDayKey
          ? {
              ...d,
              focusTitle: cleanTitle.slice(0, 60),
              isRestDay: editDayIsRest,
              exercises: editDayIsRest ? [] : editDayExercises,
            }
          : d,
      );
      const savedPlan = await businessRepository.updateGymMemberSelfPlan({
        businessSlug,
        memberId: memberPass.id,
        scheduleMode: scheduleModeView,
        planTitle: effectiveNutrition.planTitle,
        weeklySchedule: nextSchedule,
      });
      setAthleteHub((prev) =>
        prev ? { ...prev, coachPlan: savedPlan } : prev,
      );
      setEditingDayKey(null);
      setSuccessMsg(`Saved "${cleanTitle}" split directly to your app!`);
    } catch (err) {
      setErrorMsg((err as Error).message);
    } finally {
      setSavingSelfPlan(false);
    }
  }

  async function handlePersistScheduleMode(mode: 'fixed_week' | 'rotation') {
    setScheduleModeView(mode);
    if (!businessSlug || !memberPass) return;
    try {
      const savedPlan = await businessRepository.updateGymMemberSelfPlan({
        businessSlug,
        memberId: memberPass.id,
        scheduleMode: mode,
        planTitle: effectiveNutrition.planTitle,
        weeklySchedule: effectiveWeeklySchedule,
      });
      setAthleteHub((prev) =>
        prev ? { ...prev, coachPlan: savedPlan } : prev,
      );
    } catch {
      // Non-fatal mode preference fallback
    }
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
        preferredShift,
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
    setCommunityHub(null);
    setSessionActive(false);
    setSessionMinimized(false);
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
      <div className="min-h-screen bg-[#0B0D10] flex items-center justify-center p-4">
        <div className="mx-auto w-full max-w-md rounded-2xl border border-white/10 bg-[#14171D] p-8 text-center text-white space-y-3">
          <SearchX className="mx-auto h-10 w-10 text-slate-400" aria-hidden />
          <h1 className="text-[18px] font-bold">Gym Portal Not Found</h1>
          <p className="text-[13.5px] text-slate-400">
            This gym pass link is either inactive or awaiting platform approval.
          </p>
        </div>
      </div>
    );
  }

  const brandAccent = normalizeGymAccentColor(portal.config.accentColor);
  const brandInk = getContrastInkForHex(brandAccent);
  const brandLogoUrl = portal.config.logoUrl ?? null;

  // =========================================================================
  // 1. ONBOARDING SPLASH / JOIN / SIGN-IN (WHEN NO MEMBER PASS LOADED)
  // =========================================================================
  if (!memberPass) {
    return (
      <div className="min-h-screen w-full overflow-x-hidden bg-[#0B0D10] px-4 py-6">
        <div className="mx-auto w-full max-w-md space-y-4">
          {authMode === 'splash' && (
            <div className="gym-obsidian-mesh gym-fade-up overflow-hidden rounded-3xl text-white shadow-2xl border border-white/10">
              <div className="relative px-6 pt-7 pb-8 space-y-6">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <GymBrandMark
                      logoUrl={brandLogoUrl}
                      name={portal.business.name}
                      accentColor={brandAccent}
                      inkColor={brandInk}
                    />
                    <div className="min-w-0">
                      <p className="text-[16px] font-black tracking-tight text-white truncate">
                        {portal.business.name}
                      </p>
                      <p className="text-[11.5px] font-medium text-slate-400 truncate">
                        {portal.business.city} ·{' '}
                        <span className="tabular-nums font-semibold">
                          {portal.activeMembersCount}
                        </span>{' '}
                        Active Members
                      </p>
                    </div>
                  </div>
                  <span
                    className="shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-extrabold whitespace-nowrap"
                    style={{
                      backgroundColor: `${brandAccent}24`,
                      border: `1px solid ${brandAccent}66`,
                      color: brandAccent,
                    }}
                  >
                    Live Pass
                  </span>
                </div>

                <AthleteSplashIllustration
                  accentColor={brandAccent}
                  logoUrl={brandLogoUrl}
                  gymName={portal.business.name}
                />

                <div className="text-center space-y-2.5">
                  <span
                    className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wider"
                    style={{ color: brandAccent }}
                  >
                    <Flame className="h-3.5 w-3.5 text-orange-400" aria-hidden />
                    <span className="tabular-nums font-extrabold">
                      {portal.checkedInTodayCount}
                    </span>{' '}
                    Trained Today
                  </span>
                  <h1 className="text-[34px] font-black leading-[1.08] tracking-tight text-white">
                    Stronger <br />
                    <span style={{ color: brandAccent }}>Than Yesterday</span>
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
                    className="gym-tactile flex h-12 w-full items-center justify-center gap-2 rounded-2xl px-5 text-[15px] font-black cursor-pointer"
                    style={{
                      backgroundColor: brandAccent,
                      color: brandInk,
                      boxShadow: `0 4px 20px ${brandAccent}55`,
                    }}
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
                    <span
                      className="font-extrabold"
                      style={{ color: brandAccent }}
                    >
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

              <div className="space-y-1.5">
                <label className="block text-[11.5px] font-bold uppercase tracking-wider text-slate-400">
                  Preferred Training Batch
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {GYM_SHIFT_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setPreferredShift(opt.value)}
                      className={`rounded-xl border px-2.5 py-2 text-left transition-colors cursor-pointer ${
                        preferredShift === opt.value
                          ? 'text-[#0B0D10]'
                          : 'border-white/15 bg-[#161920] text-slate-300'
                      }`}
                      style={
                        preferredShift === opt.value
                          ? {
                              borderColor: brandAccent,
                              backgroundColor: brandAccent,
                              color: brandInk,
                            }
                          : undefined
                      }
                    >
                      <p className="text-[12px] font-extrabold leading-tight">
                        {opt.emoji} {opt.label}
                      </p>
                      <p
                        className={`text-[10px] mt-0.5 ${
                          preferredShift === opt.value
                            ? 'opacity-80'
                            : 'text-slate-500'
                        }`}
                      >
                        {opt.windowLabel}
                      </p>
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
                className="gym-tactile flex h-12 w-full items-center justify-center gap-2 rounded-2xl text-[15px] font-black disabled:opacity-60 cursor-pointer"
                style={{
                  backgroundColor: brandAccent,
                  color: brandInk,
                  boxShadow: `0 4px 16px ${brandAccent}55`,
                }}
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
  if (sessionActive && !sessionMinimized) {
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
              onClick={() => setSessionMinimized(true)}
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
              onClick={handleFinishActiveWorkout}
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

          {/* Large Studio White-Stage Anatomical Exercise Demonstration + Controls */}
          {activeEx && (
            <div className="space-y-3">
              {!stageAnimMinimized ? (
                <ExerciseAnimationPreview
                  animationKey={activeEx.animationKey}
                  animationGifUrl={activeEx.animationGifUrl}
                  exerciseName={activeEx.name}
                  muscleGroup={activeEx.muscleGroup}
                  variant="stage"
                  onMinimize={() => setStageAnimMinimized(true)}
                />
              ) : (
                <button
                  type="button"
                  onClick={() => setStageAnimMinimized(false)}
                  className="w-full rounded-2xl bg-[#14171D] border border-white/[0.08] px-4 py-2.5 flex items-center justify-between text-[12px] font-bold text-[#C8F135] cursor-pointer"
                >
                  <span>Show anatomical form demo</span>
                  <ChevronDown className="h-4 w-4" aria-hidden />
                </button>
              )}

              <div className="rounded-3xl bg-[#14171D] border border-white/[0.08] p-4 space-y-4">
                <div>
                  <h2 className="text-[19px] font-black leading-tight text-white">
                    {activeEx.name}
                  </h2>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] font-bold">
                    <span className="rounded-md bg-[#1E222B] px-2.5 py-0.5 text-slate-300 capitalize">
                      {activeEx.muscleGroup}
                    </span>
                    <span className="rounded-md bg-[#1E222B] px-2.5 py-0.5 text-[#C8F135] tabular-nums">
                      Plan: {activeEx.sets} × {activeEx.reps}
                    </span>
                    {lastSession && (
                      <span className="rounded-md bg-[#1E222B] px-2.5 py-0.5 text-slate-400 tabular-nums">
                        Best: {lastSession.bestWeightKg} kg
                      </span>
                    )}
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
                        ↑ Linear progression · +{linearDeltaKg} kg more than
                        last time
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
                <div className="grid grid-cols-[26px_1fr_1fr_44px_38px] gap-1.5 px-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  <span>Set</span>
                  <span className="text-center">Weight (kg)</span>
                  <span className="text-center">Reps</span>
                  <span className="text-center">RIR</span>
                  <span className="text-center">✓</span>
                </div>

                {/* Tactile Stepper Rows + RIR Selector */}
                <div className="space-y-2.5">
                  {activeRows.map((row, rIdx) => {
                    const isBusy =
                      loggingSetKey === `${activeKey}-${row.setNumber}`;
                    return (
                      <div key={row.setNumber} className="space-y-1.5">
                        <div
                          className={`grid grid-cols-[26px_1fr_1fr_44px_38px] items-center gap-1.5 rounded-2xl p-1.5 transition-colors ${
                            row.completed
                              ? 'bg-emerald-500/10 border border-emerald-500/30'
                              : 'bg-[#1E222B] border border-white/[0.06]'
                          }`}
                        >
                          <span
                            className={`flex h-6.5 w-6.5 items-center justify-center rounded-full text-[11.5px] font-black tabular-nums ${
                              row.completed
                                ? 'bg-[#C8F135] text-[#0B0D10]'
                                : 'bg-[#14171D] text-slate-300'
                            }`}
                          >
                            {row.setNumber}
                          </span>

                          {/* Weight -/+ Stepper */}
                          <div className="flex items-center justify-between rounded-xl bg-[#14171D] px-1 py-1">
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
                              className="flex h-6.5 w-6 items-center justify-center rounded-lg text-slate-400 hover:bg-white/10 hover:text-white disabled:opacity-40 cursor-pointer"
                              aria-label="Decrease weight"
                            >
                              <Minus className="h-3 w-3" aria-hidden />
                            </button>
                            <span className="text-[13px] font-black tabular-nums text-white">
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
                              className="flex h-6.5 w-6 items-center justify-center rounded-lg text-slate-400 hover:bg-white/10 hover:text-white disabled:opacity-40 cursor-pointer"
                              aria-label="Increase weight"
                            >
                              <Plus className="h-3 w-3" aria-hidden />
                            </button>
                          </div>

                          {/* Reps -/+ Stepper */}
                          <div className="flex items-center justify-between rounded-xl bg-[#14171D] px-1 py-1">
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
                              className="flex h-6.5 w-6 items-center justify-center rounded-lg text-slate-400 hover:bg-white/10 hover:text-white disabled:opacity-40 cursor-pointer"
                              aria-label="Decrease reps"
                            >
                              <Minus className="h-3 w-3" aria-hidden />
                            </button>
                            <span className="text-[13px] font-black tabular-nums text-white">
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
                              className="flex h-6.5 w-6 items-center justify-center rounded-lg text-slate-400 hover:bg-white/10 hover:text-white disabled:opacity-40 cursor-pointer"
                              aria-label="Increase reps"
                            >
                              <Plus className="h-3 w-3" aria-hidden />
                            </button>
                          </div>

                          {/* RIR Selector Pill */}
                          <button
                            type="button"
                            onClick={() => cycleSetRir(activeEx.name, rIdx)}
                            className="flex h-8.5 items-center justify-center rounded-xl bg-[#14171D] text-[11px] font-bold text-slate-300 hover:text-[#C8F135] tabular-nums cursor-pointer"
                          >
                            {row.rir !== null ? row.rir : 'RIR'}
                          </button>

                          {/* 1-Tap Completion Circle */}
                          <button
                            type="button"
                            disabled={row.completed || isBusy}
                            onClick={() =>
                              void handleToggleActiveSetComplete(activeEx, rIdx)
                            }
                            className={`gym-tactile flex h-8.5 w-8.5 items-center justify-center rounded-full border transition-all cursor-pointer ${
                              row.completed
                                ? 'border-[#C8F135] bg-[#C8F135] text-[#0B0D10]'
                                : 'border-white/25 bg-[#14171D] text-slate-400 hover:border-[#C8F135] hover:text-[#C8F135]'
                            }`}
                            aria-label={`Complete set ${row.setNumber}`}
                          >
                            {isBusy ? (
                              <Loader2
                                className="h-3.5 w-3.5 animate-spin"
                                aria-hidden
                              />
                            ) : (
                              <Check
                                className="h-4 w-4 stroke-[3]"
                                aria-hidden
                              />
                            )}
                          </button>
                        </div>

                        {row.isRecord && (
                          <p className="px-2 text-[11.5px] font-extrabold text-[#C8F135]">
                            🏆 Record! Heaviest yet · Beats your best e1RM
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
                    Plates ({currentBestDraftWt || 60} kg)
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Prev / Next + Add Exercise Action */}
          <div className="flex items-center justify-between px-2">
            <button
              type="button"
              disabled={activeExIdx === 0}
              onClick={() => setActiveExIdx((i) => Math.max(0, i - 1))}
              className="inline-flex items-center gap-1 text-[13px] font-bold text-slate-400 hover:text-white disabled:opacity-30 cursor-pointer"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden /> Prev
            </button>
            <button
              type="button"
              onClick={() => setShowExerciseLibraryDrawer(true)}
              className="inline-flex items-center gap-1 rounded-xl border border-[#C8F135]/40 bg-[#C8F135]/10 px-3 py-1 text-[12px] font-bold text-[#C8F135] cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden /> Add exercise
            </button>
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
              onClick={() => setRestSecondsLeft((s) => Math.max(0, s - 15))}
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
  const weeklyTargetDays = Math.max(
    1,
    effectiveWeeklySchedule.filter((d) => !d.isRestDay).length,
  );
  const remainingThisWeek = Math.max(
    0,
    weeklyTargetDays - workoutsThisWeekCount,
  );

  const levelNumber = Math.max(
    1,
    Math.floor((memberPass.totalCheckIns || 0) / 10) + 1,
  );
  const levelProgressPct = ((memberPass.totalCheckIns || 0) % 10) * 10;

  // Body weight SVG chart data (Stats -> Body tab)
  const sortedWeights = [...(memberPass.bodyMeasurements ?? [])]
    .sort((a, b) => a.recordedDate.localeCompare(b.recordedDate))
    .slice(-12);

  const activeShift: GymPreferredShift = normalizeGymPreferredShift(
    athleteHub?.preferredShift ?? memberPass.preferredShift,
  );
  const ptTrainerDisplayName =
    athleteHub?.ptTrainerName ??
    memberPass.ptTrainerName ??
    athleteHub?.coachPlan?.trainerName ??
    null;
  const ptTrainerSpecialtyDisplay =
    athleteHub?.ptTrainerSpecialty ?? null;
  const ptSessionsLeft =
    athleteHub?.ptRemainingSessions ?? memberPass.ptRemainingSessions ?? 0;
  const ptSessionsTotal =
    athleteHub?.ptTotalSessions ?? memberPass.ptTotalSessions ?? 0;

  return (
    <div
      className="min-h-screen w-full overflow-x-hidden bg-[#0B0D10] text-white px-4 pt-3 pb-[calc(6.5rem+env(safe-area-inset-bottom))]"
      style={
        {
          ['--gym-accent' as string]: brandAccent,
          ['--gym-ink' as string]: brandInk,
        }
      }
    >
      <div className="mx-auto w-full max-w-md space-y-4">
        {/* Live Community / Coach Notification Banner */}
        {notifBanner && (
          <div className="flex items-center justify-between gap-2.5 rounded-2xl border border-white/15 bg-[#14171D] px-3.5 py-2.5 shadow-xl">
            <button
              type="button"
              onClick={() => {
                setNotifBanner(null);
                setUnreadChatCount(0);
                setActiveTab('members');
                setMembersSubTab('chat');
              }}
              className="flex min-w-0 flex-1 items-center gap-2.5 text-left cursor-pointer"
            >
              <span
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl"
                style={{ backgroundColor: `${brandAccent}24`, color: brandAccent }}
              >
                <Bell className="h-4 w-4" aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="text-[11.5px] font-extrabold text-white truncate">
                  💬 {notifBanner.sender}
                </p>
                <p className="text-[11px] text-slate-300 truncate">
                  {notifBanner.text}
                </p>
              </div>
            </button>
            <button
              type="button"
              onClick={() => setNotifBanner(null)}
              className="shrink-0 p-1 text-slate-400 hover:text-white cursor-pointer"
              aria-label="Dismiss notification"
            >
              <X className="h-3.5 w-3.5" aria-hidden />
            </button>
          </div>
        )}

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

        {/* ==================== TAB 1: HOME (DAILY GYM-COMER PRIORITY FLOW) ==================== */}
        {activeTab === 'home' && (
          <div className="space-y-4 gym-fade-up">
            {/* Header with Custom Brand Logo, Bell Notifications & Batch Pill */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <GymBrandMark
                    logoUrl={brandLogoUrl}
                    name={portal.business.name}
                    accentColor={brandAccent}
                    inkColor={brandInk}
                    size="sm"
                  />
                  <div className="min-w-0">
                    <h1 className="text-[19px] font-black tracking-tight text-white truncate">
                      {portal.business.name}
                    </h1>
                    <p className="text-[11.5px] font-medium text-slate-400 truncate">
                      {todayFormatted} · Hi, {toTitleCase(firstName)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0 relative">
                  <button
                    type="button"
                    onClick={() => {
                      setShowNotifPopover((p) => !p);
                      setUnreadChatCount(0);
                    }}
                    className="relative flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-[#14171D] text-slate-200 hover:text-white cursor-pointer"
                    aria-label="Gym Notifications & Sound Settings"
                    title="Notifications & Sound"
                  >
                    <Bell className="h-4 w-4" aria-hidden />
                    {unreadChatCount > 0 && (
                      <span
                        className="absolute -top-0.5 -right-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[9.5px] font-black"
                        style={{ backgroundColor: brandAccent, color: brandInk }}
                      >
                        {unreadChatCount}
                      </span>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={handleSwitchMember}
                    className="whitespace-nowrap rounded-full border border-white/10 bg-[#14171D] px-2.5 py-1.5 text-[11px] font-semibold text-slate-300 hover:text-white tabular-nums cursor-pointer"
                    title="Switch Phone Number"
                  >
                    •••• {memberPass.phone.slice(-4)} · Switch
                  </button>

                  {showNotifPopover && (
                    <div className="absolute right-0 top-11 z-40 w-64 rounded-2xl border border-white/15 bg-[#14171D] p-3 shadow-2xl space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[12px] font-extrabold text-white">
                          Alerts &amp; Chat Chime
                        </span>
                        <button
                          type="button"
                          onClick={() => setShowNotifPopover(false)}
                          className="text-slate-400 hover:text-white cursor-pointer"
                        >
                          <X className="h-3.5 w-3.5" aria-hidden />
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={handleToggleSound}
                        className="flex w-full items-center justify-between rounded-xl bg-[#1E222B] px-3 py-2 text-[12px] font-bold text-slate-200 hover:bg-white/10 cursor-pointer"
                      >
                        <span className="flex items-center gap-2">
                          {soundEnabled ? (
                            <Volume2
                              className="h-4 w-4"
                              style={{ color: brandAccent }}
                              aria-hidden
                            />
                          ) : (
                            <VolumeX
                              className="h-4 w-4 text-slate-500"
                              aria-hidden
                            />
                          )}
                          Chat &amp; Timer Ringtone
                        </span>
                        <span
                          className="rounded-md px-2 py-0.5 text-[10.5px] font-black"
                          style={
                            soundEnabled
                              ? { backgroundColor: brandAccent, color: brandInk }
                              : { backgroundColor: '#2A303C', color: '#94A3B8' }
                          }
                        >
                          {soundEnabled ? 'ON' : 'MUTED'}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowNotifPopover(false);
                          setActiveTab('members');
                          setMembersSubTab('chat');
                        }}
                        className="w-full rounded-xl border border-white/10 px-3 py-1.5 text-[11.5px] font-bold text-slate-300 hover:text-white cursor-pointer"
                      >
                        Open Live Gym Chat →
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Morning vs Evening Batch Selector Bar */}
              <div className="flex items-center justify-between gap-2 rounded-2xl border border-white/[0.07] bg-[#14171D] px-3 py-2">
                <span className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400 whitespace-nowrap">
                  <Clock className="h-3.5 w-3.5 text-slate-400" aria-hidden />
                  Batch:
                </span>
                <div className="flex items-center gap-1">
                  {GYM_SHIFT_OPTIONS.map((opt) => {
                    const active = activeShift === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        disabled={updatingShift}
                        onClick={() => void handleChangeMemberShift(opt.value)}
                        className={`whitespace-nowrap rounded-lg px-2 py-1 text-[11px] font-extrabold transition-colors cursor-pointer ${
                          active
                            ? ''
                            : 'bg-[#1E222B] text-slate-400 hover:text-white'
                        }`}
                        style={
                          active
                            ? { backgroundColor: brandAccent, color: brandInk }
                            : undefined
                        }
                      >
                        {opt.emoji} {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* STEP 1 — HIGHLIGHTED RECEPTION QR ATTENDANCE CHECK-IN HERO */}
            {isFrozen ? (
              <div className="rounded-2xl border border-sky-500/30 bg-sky-500/10 px-4 py-3 flex items-center gap-3 text-[12.5px] text-sky-200">
                <Snowflake
                  className="h-4.5 w-4.5 text-sky-400 shrink-0"
                  aria-hidden
                />
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
                className="w-full rounded-2xl border border-amber-500/40 bg-amber-500/15 px-4 py-3.5 flex items-center justify-between gap-3 text-left cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <AlertTriangle
                    className="h-5 w-5 text-amber-400 shrink-0"
                    aria-hidden
                  />
                  <div>
                    <p className="text-[13.5px] font-extrabold text-amber-200">
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
              <div className="rounded-2xl border border-emerald-500/40 bg-emerald-950/50 px-4 py-3.5 flex items-center justify-between gap-2">
                <div className="flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-400 text-[#0B0D10]">
                    <Check className="h-4.5 w-4.5 stroke-[3]" aria-hidden />
                  </span>
                  <div>
                    <p className="text-[13.5px] font-black text-white">
                      ✓ Checked In Today at{' '}
                      <span className="tabular-nums">
                        {formatCheckInTime12h(
                          memberPass.todayCheckIn?.checkedInAt ??
                            memberPass.lastCheckInAt,
                        )}
                      </span>
                    </p>
                    <p className="text-[11.5px] font-semibold text-emerald-300">
                      {
                        getWorkoutFocusMeta(
                          memberPass.todayCheckIn?.workoutFocus ??
                            selectedWorkoutFocus,
                        ).dayLabel
                      }{' '}
                      · 🔥 {Math.max(1, currentStreak)}d daily streak
                    </p>
                  </div>
                </div>
                <span className="shrink-0 whitespace-nowrap rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-[11px] font-extrabold text-emerald-300 tabular-nums">
                  {memberPass.daysRemaining}d left
                </span>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowCheckInModal(true)}
                className="gym-tactile w-full rounded-3xl p-4 flex items-center justify-between gap-3 text-left cursor-pointer"
                style={{
                  background: `linear-gradient(135deg, ${brandAccent}, ${brandAccent}DD)`,
                  color: brandInk,
                  boxShadow: `0 0 26px ${brandAccent}44`,
                }}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#0B0D10]"
                    style={{ color: brandAccent }}
                  >
                    <QrCode className="h-5.5 w-5.5" aria-hidden />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[15px] font-black leading-tight truncate">
                      Mark Today&apos;s Attendance
                    </p>
                    <p className="text-[11px] font-bold opacity-80 mt-0.5 truncate">
                      Tap to log reception check-in ({activeShift} batch)
                    </p>
                  </div>
                </div>
                <span
                  className="shrink-0 whitespace-nowrap rounded-full bg-[#0B0D10] px-3 py-2 text-[11.5px] font-black"
                  style={{ color: brandAccent }}
                >
                  Check In →
                </span>
              </button>
            )}

            {/* Personal Training Coach Card (When PT Assigned or Coach Approved) */}
            {(ptTrainerDisplayName || ptSessionsLeft > 0) && (
              <div
                className="rounded-3xl bg-[#14171D] p-3.5 flex items-center justify-between gap-3"
                style={{ border: `1px solid ${brandAccent}3A` }}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl font-black"
                    style={{
                      backgroundColor: `${brandAccent}22`,
                      color: brandAccent,
                    }}
                  >
                    <Award className="h-5 w-5" aria-hidden />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[10.5px] font-extrabold uppercase tracking-wider text-slate-400">
                      Personal Coach {ptTrainerSpecialtyDisplay ? `· ${ptTrainerSpecialtyDisplay}` : ''}
                    </p>
                    <p className="text-[14px] font-black text-white truncate">
                      {ptTrainerDisplayName ?? 'Head Trainer'}
                    </p>
                    {effectiveNutrition.coachNotes && (
                      <p className="text-[11px] text-slate-400 truncate">
                        “{effectiveNutrition.coachNotes}”
                      </p>
                    )}
                  </div>
                </div>
                <div className="shrink-0 text-right space-y-1">
                  {ptSessionsTotal > 0 || ptSessionsLeft > 0 ? (
                    <span
                      className="inline-block whitespace-nowrap rounded-xl px-2.5 py-1 text-[11px] font-black tabular-nums"
                      style={{
                        backgroundColor: `${brandAccent}22`,
                        color: brandAccent,
                      }}
                    >
                      {ptSessionsLeft}
                      {ptSessionsTotal > 0 ? `/${ptSessionsTotal}` : ''} PT Left
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setActiveTab('plan')}
                      className="whitespace-nowrap rounded-xl bg-[#1E222B] px-2.5 py-1 text-[11px] font-bold text-white cursor-pointer"
                    >
                      View Plan →
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* STEP 2 — PROMINENT WEEK STREAK 🔥 & THIS WEEK CONSISTENCY CARD */}
            <div className="rounded-3xl bg-[#14171D] border border-white/[0.07] p-4 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-orange-500/15 text-[22px]">
                    🔥
                  </span>
                  <div>
                    <p className="text-[17px] font-black tabular-nums text-white leading-tight">
                      {weekStreakCount} Week Streak
                    </p>
                    <p className="text-[11.5px] font-semibold text-slate-400 tabular-nums">
                      {workoutsThisWeekCount} / {weeklyTargetDays} this week ·{' '}
                      {memberPass.totalCheckIns} workouts total
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="rounded-lg bg-[#1E222B] px-2.5 py-1 text-[11px] font-extrabold text-slate-300 tabular-nums">
                    Best: {Math.max(1, Math.floor((memberPass.bestStreakDays ?? currentStreak) / 7))}w
                  </span>
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-sky-500/15 text-sky-400" title="Streak Freeze Active">
                    <Snowflake className="h-3.5 w-3.5" aria-hidden />
                  </span>
                </div>
              </div>

              <div className="border-t border-white/[0.06] pt-3 space-y-2.5">
                <div className="flex items-center justify-between text-[11.5px]">
                  <span className="font-bold text-slate-400">This week</span>
                  <span className="font-semibold text-slate-400 tabular-nums">
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
                          className={`flex h-8.5 w-8.5 items-center justify-center rounded-full text-[12.5px] font-black tabular-nums ${
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
              </div>
            </div>

            {/* STEP 3 — TODAY'S WORKOUT CARD (ZERO OVERLAP MOBILE LAYOUT) + SWAPPER + LIBRARY */}
            {todayScheduleDay && (
              <div className="rounded-3xl bg-[#14171D] border border-white/[0.07] p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <span
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                      style={{
                        backgroundColor: `${brandAccent}22`,
                        color: brandAccent,
                      }}
                    >
                      <Dumbbell className="h-5 w-5" aria-hidden />
                    </span>
                    <div className="min-w-0">
                      <span
                        className="inline-block rounded-md px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider"
                        style={{
                          backgroundColor: `${brandAccent}22`,
                          color: brandAccent,
                        }}
                      >
                        Today · {todayScheduleDay.dayLabel}
                      </span>
                      <p className="mt-0.5 text-[16px] font-black text-white truncate">
                        {todayScheduleDay.focusTitle}
                      </p>
                      <p className="text-[11px] text-slate-400 tabular-nums">
                        {todayScheduleDay.exercises.length} exercises
                      </p>
                    </div>
                  </div>
                  <div className="shrink-0">
                    <GymMuscleMapSvg
                      activeMuscles={Array.from(
                        new Set(
                          todayScheduleDay.exercises.map((e) => e.muscleGroup),
                        ),
                      )}
                      accentColor={brandAccent}
                      compact
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    launchWorkoutSession(
                      todayScheduleDay.focusTitle,
                      todayScheduleDay.exercises,
                    )
                  }
                  className="gym-tactile flex h-11 w-full items-center justify-center gap-2 rounded-2xl text-[13.5px] font-black cursor-pointer"
                  style={{
                    backgroundColor: brandAccent,
                    color: brandInk,
                    boxShadow: `0 4px 16px ${brandAccent}40`,
                  }}
                >
                  <Play className="h-4 w-4 fill-current" aria-hidden />
                  Start {todayScheduleDay.focusTitle} →
                </button>

                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.06] pt-2.5 text-[11.5px]">
                  <button
                    type="button"
                    onClick={() => setShowSwapDayModal(true)}
                    className="whitespace-nowrap font-bold text-slate-400 hover:text-white cursor-pointer"
                  >
                    ⇄ Swap Split Day
                  </button>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setActiveTab('plan');
                        setPlanSubTab('schedule');
                        openDaySplitEditor(todayScheduleDay);
                      }}
                      className="whitespace-nowrap inline-flex items-center gap-1 rounded-lg bg-[#1E222B] px-2.5 py-1 font-bold text-slate-200 hover:bg-white/10 cursor-pointer"
                    >
                      <Pencil className="h-3 w-3" aria-hidden />
                      Edit Split
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowExerciseLibraryDrawer(true)}
                      className="whitespace-nowrap inline-flex items-center gap-1 rounded-lg bg-[#1E222B] px-2.5 py-1 font-bold hover:bg-white/10 cursor-pointer"
                      style={{ color: brandAccent }}
                    >
                      <Dumbbell className="h-3.5 w-3.5" aria-hidden />
                      Library
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 4 — REDESIGNED HIGH-CRAFT THIS MONTH'S CHALLENGES */}
            <div className="rounded-3xl bg-[#14171D] border border-white/[0.07] p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <span
                    className="flex h-8 w-8 items-center justify-center rounded-xl"
                    style={{
                      backgroundColor: `${brandAccent}22`,
                      color: brandAccent,
                    }}
                  >
                    <Trophy className="h-4 w-4" aria-hidden />
                  </span>
                  <div>
                    <h2 className="text-[14.5px] font-black text-white leading-tight">
                      This month&apos;s challenges
                    </h2>
                    <p className="text-[10.5px] text-slate-400 font-medium">
                      Hit all 3 badges to boost your gym rank
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('stats')}
                  className="whitespace-nowrap text-[11.5px] font-extrabold cursor-pointer"
                  style={{ color: brandAccent }}
                >
                  Stats →
                </button>
              </div>

              <div className="space-y-2.5">
                {[
                  {
                    label: `${monthlyWorkoutTarget} workouts this month`,
                    current: workoutsThisMonth,
                    target: monthlyWorkoutTarget,
                    suffix: '',
                    icon: Flame,
                    iconBg: 'bg-orange-500/15 text-orange-400',
                  },
                  {
                    label: `Lift ${(monthlyVolumeTargetKg / 1000).toFixed(0)} t this month`,
                    current: volumeThisMonthKg,
                    target: monthlyVolumeTargetKg,
                    suffix: ' kg',
                    icon: Dumbbell,
                    iconBg: 'bg-sky-500/15 text-sky-400',
                  },
                  {
                    label: 'Log your weight 8 times',
                    current: weightCheckInsThisMonth,
                    target: 8,
                    suffix: '',
                    icon: Scale,
                    iconBg: 'bg-emerald-500/15 text-emerald-400',
                  },
                ].map((ch) => {
                  const pct = Math.min(
                    100,
                    Math.round((ch.current / Math.max(1, ch.target)) * 100),
                  );
                  const completed = pct >= 100;
                  const ChIcon = ch.icon;
                  return (
                    <div
                      key={ch.label}
                      className="rounded-2xl border border-white/[0.06] bg-[#1A1E26] p-3 space-y-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span
                            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${ch.iconBg}`}
                          >
                            <ChIcon className="h-3.5 w-3.5" aria-hidden />
                          </span>
                          <div className="min-w-0">
                            <p className="text-[12px] font-bold text-slate-100 truncate">
                              {ch.label}
                            </p>
                            <p className="text-[10.5px] font-semibold text-slate-400 tabular-nums">
                              {ch.current.toLocaleString('en-IN')} /{' '}
                              {ch.target.toLocaleString('en-IN')}
                              {ch.suffix}
                            </p>
                          </div>
                        </div>
                        <span
                          className="shrink-0 whitespace-nowrap rounded-full px-2 py-0.5 text-[10.5px] font-black tabular-nums"
                          style={
                            completed
                              ? { backgroundColor: '#10B98126', color: '#34D399' }
                              : {
                                  backgroundColor: `${brandAccent}1F`,
                                  color: brandAccent,
                                }
                          }
                        >
                          {completed ? '✓ Done' : `${pct}%`}
                        </span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-[#0B0D10]">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${Math.max(4, pct)}%`,
                            backgroundColor: completed ? '#10B981' : brandAccent,
                            boxShadow: completed
                              ? '0 0 8px rgba(16,185,129,0.5)'
                              : `0 0 8px ${brandAccent}66`,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
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
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setShowExerciseLibraryDrawer(true)}
                  className="rounded-full bg-[#14171D] border border-white/10 px-2.5 py-1 text-[11px] font-bold text-slate-200 hover:text-[#C8F135] cursor-pointer"
                >
                  🏋️ Library
                </button>
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-extrabold ${
                    effectiveNutrition.isCoachApproved
                      ? 'bg-[#C8F135]/15 border border-[#C8F135]/40 text-[#C8F135]'
                      : 'bg-[#14171D] border border-white/10 text-slate-300'
                  }`}
                >
                  <Sparkles className="h-3 w-3" aria-hidden />
                  {effectiveNutrition.isCoachApproved
                    ? effectiveNutrition.trainerName
                    : 'Smart Goal'}
                </span>
              </div>
            </div>

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
                        onClick={() => void handlePersistScheduleMode(m)}
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
                        className="rounded-2xl bg-[#14171D] border transition-colors"
                        style={{
                          borderColor: isToday
                            ? `${brandAccent}66`
                            : 'rgba(255,255,255,0.07)',
                        }}
                      >
                        <div className="w-full p-3.5 flex items-center justify-between gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedDayKey(isExpanded ? null : day.dayKey)
                            }
                            className="flex flex-1 items-center gap-3 min-w-0 text-left cursor-pointer"
                          >
                            <span
                              className="w-7 text-[13px] font-black shrink-0"
                              style={{
                                color: isToday ? brandAccent : '#94A3B8',
                              }}
                            >
                              {day.dayLabel}
                            </span>
                            <span
                              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                              style={
                                day.isRestDay
                                  ? {
                                      backgroundColor: '#1E222B',
                                      color: '#64748B',
                                    }
                                  : {
                                      backgroundColor: `${brandAccent}22`,
                                      color: brandAccent,
                                    }
                              }
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
                          </button>

                          <div className="flex items-center gap-2 shrink-0">
                            {!day.isRestDay && (
                              <GymMuscleMapSvg
                                activeMuscles={Array.from(
                                  new Set(
                                    day.exercises.map((e) => e.muscleGroup),
                                  ),
                                )}
                                accentColor={brandAccent}
                                compact
                              />
                            )}
                            <button
                              type="button"
                              onClick={() => openDaySplitEditor(day)}
                              className="flex h-8 items-center gap-1 rounded-xl border border-white/10 bg-[#1E222B] px-2.5 text-[11px] font-bold text-slate-200 hover:border-white/25 cursor-pointer"
                              aria-label={`Edit ${day.dayLabel} split`}
                            >
                              <Pencil className="h-3 w-3" aria-hidden />
                              Edit
                            </button>
                          </div>
                        </div>

                        {isExpanded && !day.isRestDay && (
                          <div className="border-t border-white/[0.06] px-3.5 pb-3.5 pt-2.5 space-y-2">
                            {day.exercises.map((ex, i) => (
                              <div
                                key={`${ex.name}-${i}`}
                                className="flex items-center justify-between gap-2 rounded-xl bg-[#1E222B] p-2 text-[12px]"
                              >
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <ExerciseAnimationPreview
                                    animationKey={ex.animationKey}
                                    animationGifUrl={ex.animationGifUrl}
                                    exerciseName={ex.name}
                                    muscleGroup={ex.muscleGroup}
                                    variant="compact"
                                  />
                                  <span className="font-bold text-white truncate">
                                    {ex.name}
                                  </span>
                                </div>
                                <span className="text-slate-400 tabular-nums shrink-0 pr-1">
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
                              className="gym-tactile mt-1 flex h-10 w-full items-center justify-center gap-1.5 rounded-xl text-[13px] font-black cursor-pointer"
                              style={{
                                backgroundColor: brandAccent,
                                color: brandInk,
                              }}
                            >
                              <Play
                                className="h-3.5 w-3.5 fill-current"
                                aria-hidden
                              />
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

        {/* ==================== TAB 4: MEMBERS (LIVE FLOOR DIRECTORY + COMMUNITY CHAT) ==================== */}
        {activeTab === 'members' && (
          <div className="space-y-4 gym-fade-up">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h1 className="text-[22px] font-black tracking-tight text-white">
                  Members
                </h1>
                <p className="text-[12px] text-slate-400">
                  {
                    (communityHub?.membersDirectory ?? []).filter(
                      (m) => m.isCheckedInToday,
                    ).length
                  }{' '}
                  on the floor today · {portal.activeMembersCount} active
                </p>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 px-3 py-1 text-[11px] font-extrabold text-emerald-300">
                <span className="gym-pulse-dot h-2 w-2 rounded-full bg-emerald-400" />
                Live Gym
              </span>
            </div>

            {/* Sub-Tabs: Gym Chat vs Members Live Floor Directory */}
            <div className="grid grid-cols-2 gap-1.5 rounded-2xl bg-[#14171D] p-1 border border-white/[0.07]">
              <button
                type="button"
                onClick={() => {
                  setMembersSubTab('chat');
                  setUnreadChatCount(0);
                  setNotifBanner(null);
                }}
                className={`rounded-xl py-2 text-[12px] font-extrabold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                  membersSubTab === 'chat'
                    ? 'bg-[#1E222B] text-[#C8F135]'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <MessageCircle className="h-3.5 w-3.5" aria-hidden /> Gym Chat
              </button>
              <button
                type="button"
                onClick={() => setMembersSubTab('directory')}
                className={`rounded-xl py-2 text-[12px] font-extrabold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                  membersSubTab === 'directory'
                    ? 'bg-[#1E222B] text-[#C8F135]'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Users className="h-3.5 w-3.5" aria-hidden /> Members (Live
                Floor)
              </button>
            </div>

            {membersSubTab === 'chat' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between px-1">
                  <span className="text-[11px] font-bold text-slate-400">
                    Real-time gym lounge &amp; spotter finder
                  </span>
                  <button
                    type="button"
                    onClick={handleToggleSound}
                    className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-[#14171D] px-2.5 py-1 text-[11px] font-bold text-slate-300 hover:text-white cursor-pointer"
                  >
                    {soundEnabled ? (
                      <>
                        <Volume2
                          className="h-3.5 w-3.5"
                          style={{ color: brandAccent }}
                          aria-hidden
                        />
                        Chime On
                      </>
                    ) : (
                      <>
                        <VolumeX
                          className="h-3.5 w-3.5 text-slate-500"
                          aria-hidden
                        />
                        Muted
                      </>
                    )}
                  </button>
                </div>
                {/* Chat Feed */}
                <div className="rounded-3xl bg-[#14171D] border border-white/[0.07] p-3.5 space-y-2.5 max-h-[380px] overflow-y-auto">
                  {(communityHub?.chatMessages ?? []).length === 0 ? (
                    <div className="py-10 text-center space-y-2">
                      <MessageCircle
                        className="mx-auto h-8 w-8 text-slate-600"
                        aria-hidden
                      />
                      <p className="text-[13px] font-bold text-slate-300">
                        Start the conversation!
                      </p>
                      <p className="text-[11.5px] text-slate-500">
                        Find a spotter, celebrate PRs &amp; hype your gym crew.
                      </p>
                    </div>
                  ) : (
                    (communityHub?.chatMessages ?? []).map((msg) => {
                      const isMe = msg.memberId === memberPass.id;
                      const isPr = msg.messageType === 'pr_celebration';
                      const isCoach = msg.messageType === 'coach_announcement';
                      return (
                        <div
                          key={msg.id}
                          className={`rounded-2xl p-3 space-y-1 ${
                            isPr
                              ? 'bg-[#C8F135]/15 border border-[#C8F135]/40'
                              : isCoach
                                ? 'bg-indigo-500/15 border border-indigo-400/40'
                                : isMe
                                  ? 'bg-[#1E222B] border border-white/15 ml-6'
                                  : 'bg-[#1E222B]/80 border border-white/[0.06] mr-6'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2 text-[11px]">
                            <span
                              className={`font-extrabold ${
                                isPr || isCoach
                                  ? 'text-[#C8F135]'
                                  : isMe
                                    ? 'text-[#C8F135]'
                                    : 'text-slate-200'
                              }`}
                            >
                              {isCoach ? '📢 ' : ''}
                              {msg.senderName}
                              {msg.senderCode ? ` · ${msg.senderCode}` : ''}
                            </span>
                            <span className="text-slate-500 tabular-nums">
                              {formatShortMessageTime(msg.createdAt)}
                            </span>
                          </div>
                          <p className="text-[13px] text-white leading-snug">
                            {msg.messageText}
                          </p>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Quick Motivational Chips */}
                <div className="flex gap-1.5 overflow-x-auto pb-1">
                  {["💪 Let's go!", 'Spot needed on Bench!', 'Great lift 🔥'].map(
                    (chip) => (
                      <button
                        key={chip}
                        type="button"
                        disabled={sendingChat}
                        onClick={() => void handleSendChatMessage(chip)}
                        className="shrink-0 rounded-full border border-white/10 bg-[#14171D] px-3 py-1.5 text-[11.5px] font-bold text-slate-300 hover:border-[#C8F135] hover:text-[#C8F135] cursor-pointer"
                      >
                        {chip}
                      </button>
                    ),
                  )}
                </div>

                {/* Chat Message Input */}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void handleSendChatMessage();
                  }}
                  className="flex items-center gap-2"
                >
                  <input
                    type="text"
                    placeholder="Message gym members..."
                    value={chatDraft}
                    onChange={(e) => setChatDraft(e.target.value)}
                    className="h-11 flex-1 rounded-2xl border border-white/10 bg-[#14171D] px-4 text-[13.5px] text-white placeholder:text-slate-500 focus:border-[#C8F135] focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={sendingChat || !chatDraft.trim()}
                    className="gym-tactile flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#C8F135] text-[#0B0D10] disabled:opacity-40 cursor-pointer"
                    aria-label="Send message"
                  >
                    <Send className="h-4.5 w-4.5" aria-hidden />
                  </button>
                </form>
              </div>
            )}

            {membersSubTab === 'directory' && (
              <div className="space-y-3">
                <div className="relative">
                  <Search
                    className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                    aria-hidden
                  />
                  <input
                    type="search"
                    value={memberDirSearch}
                    onChange={(e) => setMemberDirSearch(e.target.value)}
                    placeholder="Search active gym members..."
                    className="h-10.5 w-full rounded-2xl border border-white/10 bg-[#14171D] pl-10 pr-4 text-[13px] text-white placeholder:text-slate-500 focus:border-[#C8F135] focus:outline-none"
                  />
                </div>

                <div className="space-y-2">
                  {filteredDirectoryMembers.map((m, idx) => (
                    <div
                      key={m.id}
                      className="rounded-2xl bg-[#14171D] border border-white/[0.07] p-3.5 flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#1E222B] text-[13px] font-black text-[#C8F135]">
                          {m.fullName.slice(0, 2).toUpperCase()}
                        </span>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[11px] font-black text-slate-500">
                              #{idx + 1}
                            </span>
                            <p className="text-[14px] font-extrabold text-white truncate">
                              {toTitleCase(m.fullName)}
                            </p>
                          </div>
                          <p className="text-[11px] text-slate-400 tabular-nums">
                            {m.workoutsThisMonth} workouts this month
                            {m.todayWorkoutFocus
                              ? ` · ${getWorkoutFocusMeta(m.todayWorkoutFocus).dayLabel}`
                              : ''}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {m.isCheckedInToday && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-extrabold text-emerald-300">
                            ● ON FLOOR
                          </span>
                        )}
                        <span className="rounded-lg bg-[#1E222B] px-2 py-0.5 text-[11px] font-bold text-[#C8F135] tabular-nums">
                          🔥 {m.currentStreakDays}d
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ==================== TAB 5: STATS (OVERVIEW | BODY TREND | LIFTS MULTIPLIERS | EFFORT) ==================== */}
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

                {/* Top-10 Leaderboard */}
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
              </div>
            )}

            {/* BODY TAB: Interactive Body Weight SVG Trend Chart + Dashed Goal Line */}
            {statsSubTab === 'body' && (
              <div className="space-y-4">
                <div className="rounded-3xl bg-[#14171D] border border-white/[0.07] p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[12px] font-bold text-slate-400 flex items-center gap-1.5">
                        <Scale className="h-3.5 w-3.5 text-sky-400" aria-hidden />
                        Body weight
                      </p>
                      <p className="text-[26px] font-black tabular-nums text-white">
                        {latestWeightKg ? `${latestWeightKg} kg` : '—'}
                      </p>
                      {memberPass.targetWeightKg && latestWeightKg && (
                        <p className="text-[11.5px] font-bold text-[#C8F135] tabular-nums">
                          Goal {memberPass.targetWeightKg} kg ·{' '}
                          {Math.abs(
                            Math.round(
                              (latestWeightKg - memberPass.targetWeightKg) * 10,
                            ) / 10,
                          )}{' '}
                          kg to{' '}
                          {latestWeightKg > memberPass.targetWeightKg
                            ? 'lose'
                            : 'gain'}
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowMeasureForm((v) => !v)}
                      className="inline-flex h-8.5 items-center gap-1 rounded-xl bg-[#C8F135] px-3 text-[12px] font-black text-[#0B0D10] cursor-pointer"
                    >
                      <Plus className="h-3.5 w-3.5" aria-hidden /> Log
                    </button>
                  </div>

                  {/* Interactive SVG Weight Area Chart with Dashed Goal Line */}
                  {sortedWeights.length >= 2 && (
                    <div className="rounded-2xl bg-[#0B0D10] p-3 border border-white/[0.06]">
                      {(() => {
                        const weights = sortedWeights.map((b) => b.weightKg);
                        const goal = memberPass.targetWeightKg ?? weights[0];
                        const minW = Math.min(...weights, goal) - 2;
                        const maxW = Math.max(...weights, goal) + 2;
                        const span = Math.max(1, maxW - minW);
                        const points = sortedWeights
                          .map((b, i) => {
                            const x =
                              (i / Math.max(1, sortedWeights.length - 1)) * 280 +
                              10;
                            const y =
                              90 - ((b.weightKg - minW) / span) * 76 + 6;
                            return `${x},${y}`;
                          })
                          .join(' ');
                        const goalY = 90 - ((goal - minW) / span) * 76 + 6;
                        return (
                          <svg viewBox="0 0 300 105" className="w-full h-28">
                            <line
                              x1="10"
                              y1={goalY}
                              x2="290"
                              y2={goalY}
                              stroke="#FACC15"
                              strokeWidth="1.5"
                              strokeDasharray="4 4"
                            />
                            <polyline
                              fill="none"
                              stroke="#C8F135"
                              strokeWidth="2.5"
                              points={points}
                            />
                            <text
                              x="265"
                              y={goalY - 4}
                              fill="#FACC15"
                              fontSize="9"
                              fontWeight="bold"
                            >
                              {goal} kg
                            </text>
                          </svg>
                        );
                      })()}
                    </div>
                  )}

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

                  {(memberPass.bodyMeasurements ?? []).length > 0 && (
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
              </div>
            )}

            {/* LIFTS TAB: Strength Level Multipliers (1.21x) + 12-Week Heatmap + PRs */}
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
                  <div className="flex items-center justify-between">
                    <h3 className="text-[14.5px] font-extrabold text-white flex items-center gap-1.5">
                      <Trophy className="h-4 w-4 text-amber-400" aria-hidden />
                      Strength Levels &amp; PRs
                    </h3>
                    <span className="text-[11px] font-bold text-[#C8F135] tabular-nums">
                      BW: {latestWeightKg ?? 70} kg
                    </span>
                  </div>
                  {(athleteHub?.personalRecords ?? workoutPlan?.personalRecords ?? [])
                    .length === 0 ? (
                    <p className="text-[12.5px] text-slate-400">
                      Tap the center ▶ Start button to log your first set —
                      GymOS automatically computes Strength Multipliers &amp; PRs!
                    </p>
                  ) : (
                    <div className="divide-y divide-white/[0.06]">
                      {(
                        athleteHub?.personalRecords ??
                        workoutPlan?.personalRecords ??
                        []
                      )
                        .slice(0, 10)
                        .map((pr) => {
                          const bw = latestWeightKg ?? 70;
                          const mult =
                            Math.round((pr.best1rmKg / Math.max(40, bw)) * 100) /
                            100;
                          return (
                            <div
                              key={pr.exerciseName}
                              className="flex items-center justify-between py-2.5"
                            >
                              <div>
                                <p className="text-[13px] font-bold text-white">
                                  {pr.exerciseName}
                                </p>
                                <p className="text-[11px] text-slate-400 tabular-nums">
                                  {classifyStrengthLevel(mult)} · {mult}x BW
                                </p>
                              </div>
                              <span className="rounded-lg bg-[#C8F135]/15 border border-[#C8F135]/40 px-2.5 py-1 text-[12.5px] font-black text-[#C8F135] tabular-nums">
                                {pr.bestWeightKg} kg
                              </span>
                            </div>
                          );
                        })}
                    </div>
                  )}
                </div>
              </div>
            )}

            {statsSubTab === 'effort' && (
              <div className="rounded-3xl bg-[#14171D] border border-white/[0.07] p-4 space-y-3">
                <h3 className="text-[14.5px] font-extrabold text-white flex items-center gap-2">
                  <Award className="h-4 w-4 text-[#C8F135]" aria-hidden />
                  RIR Effort &amp; Muscle Volume
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
                    <p className="text-[11px] text-slate-400">7-Day Volume</p>
                    <p className="mt-1 text-[13px] font-extrabold text-[#C8F135] tabular-nums">
                      {(workoutPlan?.weeklyVolumeKg ?? 0).toLocaleString(
                        'en-IN',
                      )}{' '}
                      kg
                    </p>
                  </div>
                </div>
                <p className="text-[12px] text-slate-400">
                  Tip: Tap the <strong className="text-white">RIR</strong> pill
                  during sets in ▶ Start mode to track how many reps you kept in
                  reserve!
                </p>
              </div>
            )}
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

        {/* ==================== CHOOSE DIFFERENT WORKOUT SHEET (101740.png) ==================== */}
        {showSwapDayModal && (
          <div
            role="dialog"
            aria-modal="true"
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 p-4 backdrop-blur-xs"
          >
            <div className="w-full max-w-md rounded-3xl bg-[#14171D] border border-white/10 p-5 text-white shadow-2xl space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-[16px] font-black">
                    Pick what to train today
                  </h3>
                  <p className="text-[12px] text-slate-400">
                    Missed a day or want a different session?
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowSwapDayModal(false)}
                  className="rounded-lg p-1 text-slate-400 hover:bg-white/10 cursor-pointer"
                >
                  <X className="h-4 w-4" aria-hidden />
                </button>
              </div>
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {effectiveWeeklySchedule
                  .filter((d) => !d.isRestDay && d.exercises.length > 0)
                  .map((day) => {
                    const selected = todayScheduleDay?.dayKey === day.dayKey;
                    return (
                      <button
                        key={day.dayKey}
                        type="button"
                        onClick={() => {
                          setCustomSelectedDayKey(day.dayKey);
                          setShowSwapDayModal(false);
                        }}
                        className={`w-full rounded-2xl p-3 flex items-center justify-between text-left border cursor-pointer ${
                          selected
                            ? 'bg-[#C8F135]/15 border-[#C8F135]'
                            : 'bg-[#1E222B] border-white/[0.06]'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#C8F135] text-[#0B0D10] font-black text-[12px]">
                            {day.dayLabel}
                          </span>
                          <div>
                            <p className="text-[14px] font-extrabold text-white">
                              {day.focusTitle}
                            </p>
                            <p className="text-[11px] text-slate-400">
                              {day.exercises.length} exercises
                            </p>
                          </div>
                        </div>
                        {selected && (
                          <Check className="h-4 w-4 text-[#C8F135]" aria-hidden />
                        )}
                      </button>
                    );
                  })}
              </div>
            </div>
          </div>
        )}

        {/* ==================== EXERCISES LIBRARY DRAWER (101508.png) ==================== */}
        {showExerciseLibraryDrawer && (
          <div
            role="dialog"
            aria-modal="true"
            className="fixed inset-0 z-50 bg-[#0B0D10] overflow-y-auto px-4 pt-4 pb-20"
          >
            <div className="mx-auto w-full max-w-md space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-[20px] font-black text-white">
                    Exercises
                  </h2>
                  <p className="text-[11.5px] text-slate-400">
                    {catalogExercises.length} exercises · Anatomical form library
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowExerciseLibraryDrawer(false)}
                  className="rounded-full bg-[#14171D] border border-white/10 p-2 text-slate-300 hover:text-white cursor-pointer"
                >
                  <X className="h-4.5 w-4.5" aria-hidden />
                </button>
              </div>

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

              {/* Create Your Own Exercise Card */}
              <div className="rounded-2xl bg-[#14171D] border border-white/[0.08] p-3.5 space-y-2.5">
                <button
                  type="button"
                  onClick={() => setShowCreateCustomExForm((v) => !v)}
                  className="w-full flex items-center justify-between text-left cursor-pointer"
                >
                  <div>
                    <p className="text-[13.5px] font-extrabold text-[#C8F135]">
                      + Create your own exercise
                    </p>
                    <p className="text-[11px] text-slate-400">
                      Add a custom movement or machine to your gym library
                    </p>
                  </div>
                  <Plus className="h-4.5 w-4.5 text-[#C8F135]" aria-hidden />
                </button>

                {showCreateCustomExForm && (
                  <form
                    onSubmit={(e) => void handleCreateCustomExercise(e)}
                    className="space-y-2 border-t border-white/[0.06] pt-2.5"
                  >
                    <input
                      type="text"
                      required
                      placeholder="Exercise Name (e.g. Pec Deck Fly)"
                      value={newExName}
                      onChange={(e) => setNewExName(e.target.value)}
                      className="h-9.5 w-full rounded-xl border border-white/10 bg-[#1E222B] px-3 text-[13px] text-white"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <select
                        value={newExMuscle}
                        onChange={(e) =>
                          setNewExMuscle(e.target.value as GymCatalogMuscleGroup)
                        }
                        className="h-9.5 rounded-xl border border-white/10 bg-[#1E222B] px-2.5 text-[12px] font-bold text-white"
                      >
                        <option value="chest">Chest</option>
                        <option value="back">Back</option>
                        <option value="legs">Legs</option>
                        <option value="shoulders">Shoulders</option>
                        <option value="arms">Arms</option>
                        <option value="core">Core</option>
                        <option value="cardio">Cardio</option>
                      </select>
                      <select
                        value={newExEquip}
                        onChange={(e) =>
                          setNewExEquip(e.target.value as GymCatalogEquipment)
                        }
                        className="h-9.5 rounded-xl border border-white/10 bg-[#1E222B] px-2.5 text-[12px] font-bold text-white"
                      >
                        <option value="dumbbell">Dumbbell</option>
                        <option value="barbell">Barbell</option>
                        <option value="cable">Cable</option>
                        <option value="machine">Machine</option>
                        <option value="bodyweight">Bodyweight</option>
                      </select>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="Optional GIF/Video URL or upload"
                        value={newExGifUrl}
                        onChange={(e) => setNewExGifUrl(e.target.value)}
                        className="h-9.5 flex-1 min-w-0 rounded-xl border border-white/10 bg-[#1E222B] px-3 text-[12px] text-white"
                      />
                      <label className="inline-flex h-9.5 shrink-0 items-center gap-1 rounded-xl border border-white/15 bg-[#1E222B] px-2.5 text-[11px] font-bold text-slate-200 hover:bg-white/10 cursor-pointer">
                        <Upload className="h-3.5 w-3.5" aria-hidden />
                        .GIF
                        <input
                          type="file"
                          accept="image/gif,image/webp,image/png,image/jpeg"
                          className="sr-only"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            void readExerciseMediaFileAsDataUrl(file)
                              .then((dataUrl) => setNewExGifUrl(dataUrl))
                              .catch((err) => setErrorMsg((err as Error).message));
                          }}
                        />
                      </label>
                    </div>
                    <button
                      type="submit"
                      disabled={creatingCustomEx}
                      className="h-9.5 w-full rounded-xl bg-[#C8F135] text-[12.5px] font-black text-[#0B0D10] cursor-pointer"
                    >
                      {creatingCustomEx ? 'Saving…' : 'Save Custom Exercise ✓'}
                    </button>
                  </form>
                )}
              </div>

              <div className="space-y-2">
                {filteredExercises.map((ex) => (
                  <div
                    key={ex.id}
                    className="rounded-2xl bg-[#14171D] border border-white/[0.07] p-2.5 flex items-center justify-between gap-3"
                  >
                    <button
                      type="button"
                      onClick={() => setSelectedCatalogEx(ex)}
                      className="flex items-center gap-3 min-w-0 flex-1 text-left cursor-pointer"
                    >
                      <ExerciseAnimationPreview
                        animationKey={ex.animationKey}
                        animationGifUrl={ex.animationGifUrl}
                        exerciseName={ex.name}
                        muscleGroup={ex.muscleGroup}
                        variant="compact"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-[13.5px] font-extrabold text-white truncate">
                          {ex.name}
                        </p>
                        <p className="text-[11px] text-slate-400 capitalize mt-0.5">
                          {ex.muscleGroup} · {ex.equipment.replace('_', ' ')} ·{' '}
                          <span className="tabular-nums">
                            {ex.defaultSets}×{ex.defaultReps}
                          </span>
                        </p>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => appendExerciseToSessionOrToday(ex)}
                      className="flex h-8.5 w-8.5 shrink-0 items-center justify-center rounded-xl bg-[#1E222B] text-[#C8F135] hover:bg-[#C8F135] hover:text-[#0B0D10] cursor-pointer"
                      aria-label={`Add ${ex.name} to workout`}
                    >
                      <Plus className="h-4 w-4" aria-hidden />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ==================== EXERCISE DETAIL MODAL ==================== */}
        {selectedCatalogEx && (
          <div
            role="dialog"
            aria-modal="true"
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4 backdrop-blur-xs"
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
                  const target = selectedCatalogEx;
                  setSelectedCatalogEx(null);
                  appendExerciseToSessionOrToday(target);
                }}
                className="gym-tactile flex h-11.5 w-full items-center justify-center gap-2 rounded-2xl bg-[#C8F135] text-[13.5px] font-black text-[#0B0D10] cursor-pointer"
              >
                <Plus className="h-4 w-4" aria-hidden /> Add to Today&apos;s
                Workout &amp; Start
              </button>
            </div>
          </div>
        )}

        {/* ==================== WORKOUT COMPLETE CELEBRATION MODAL (101618.png) ==================== */}
        {workoutCompleteSummary && (
          <div
            role="dialog"
            aria-modal="true"
            className="fixed inset-0 z-[70] flex items-center justify-center bg-black/85 p-4 backdrop-blur-xs"
          >
            <div className="w-full max-w-sm rounded-3xl bg-[#14171D] border border-white/10 p-6 text-white shadow-2xl space-y-4 text-center">
              <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#C8F135]/15 text-[#C8F135]">
                <Trophy className="h-8 w-8" aria-hidden />
              </span>
              <div>
                <h3 className="text-[22px] font-black text-white">
                  Workout complete!
                </h3>
                <p className="text-[12.5px] text-slate-400">
                  {workoutCompleteSummary.dayTitle}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2.5 text-left">
                <div className="rounded-2xl bg-[#1E222B] p-3">
                  <p className="text-[11px] text-slate-400">Duration</p>
                  <p className="text-[16px] font-black tabular-nums">
                    {Math.max(1, Math.round(workoutCompleteSummary.durationSec / 60))}{' '}
                    min
                  </p>
                </div>
                <div className="rounded-2xl bg-[#1E222B] p-3">
                  <p className="text-[11px] text-slate-400">Volume</p>
                  <p className="text-[16px] font-black tabular-nums">
                    {workoutCompleteSummary.totalVolumeKg.toLocaleString('en-IN')}{' '}
                    kg
                  </p>
                </div>
                <div className="rounded-2xl bg-[#1E222B] p-3">
                  <p className="text-[11px] text-slate-400">Sets</p>
                  <p className="text-[16px] font-black tabular-nums">
                    {workoutCompleteSummary.completedSets} /{' '}
                    {workoutCompleteSummary.totalSets}
                  </p>
                </div>
                <div className="rounded-2xl bg-[#1E222B] p-3">
                  <p className="text-[11px] text-slate-400">PRs</p>
                  <p className="text-[16px] font-black text-[#C8F135] tabular-nums">
                    {workoutCompleteSummary.prsCount > 0
                      ? `🏆 ${workoutCompleteSummary.prsCount}`
                      : '—'}
                  </p>
                </div>
              </div>

              <div className="rounded-2xl bg-[#0B0D10] border border-white/[0.06] p-3 space-y-2">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 text-left">
                  What you just trained
                </p>
                <div className="flex justify-center">
                  <GymMuscleMapSvg
                    activeMuscles={workoutCompleteSummary.muscles}
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={() => setWorkoutCompleteSummary(null)}
                className="gym-tactile h-12 w-full rounded-2xl bg-[#C8F135] text-[15px] font-black text-[#0B0D10] cursor-pointer"
              >
                Nice!
              </button>
            </div>
          </div>
        )}

        {/* ==================== SELF-PLAN DAY SPLIT EDITOR MODAL ==================== */}
        {editingDayKey && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 p-3 backdrop-blur-xs">
            <form
              onSubmit={(e) => void handleSaveDaySplitEdit(e)}
              className="w-full max-w-md max-h-[88vh] flex flex-col rounded-3xl border border-white/15 bg-[#14171D] p-5 shadow-2xl space-y-4 overflow-hidden"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10.5px] font-extrabold uppercase tracking-wider text-slate-400">
                    Customize Weekday Split
                  </p>
                  <h2 className="text-[18px] font-black text-white">
                    {effectiveWeeklySchedule.find((d) => d.dayKey === editingDayKey)?.dayLabel ?? editingDayKey.toUpperCase()} Routine
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingDayKey(null)}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 cursor-pointer"
                >
                  <X className="h-4 w-4" aria-hidden />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-1.5 rounded-xl bg-[#0B0D10] p-1">
                <button
                  type="button"
                  onClick={() => {
                    setEditDayIsRest(false);
                    if (editDayFocusTitle.toLowerCase().includes('rest')) {
                      setEditDayFocusTitle('Push Day');
                    }
                  }}
                  className={`rounded-lg py-2 text-[12px] font-extrabold cursor-pointer ${
                    !editDayIsRest ? 'bg-[#1E222B] text-white' : 'text-slate-500'
                  }`}
                >
                  🏋️ Workout Day
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditDayIsRest(true);
                    setEditDayFocusTitle('Rest & Recovery');
                  }}
                  className={`rounded-lg py-2 text-[12px] font-extrabold cursor-pointer ${
                    editDayIsRest ? 'bg-[#1E222B] text-white' : 'text-slate-500'
                  }`}
                >
                  🧊 Rest Day
                </button>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Day Focus Title
                </label>
                <input
                  type="text"
                  required
                  value={editDayFocusTitle}
                  onChange={(e) => setEditDayFocusTitle(e.target.value)}
                  placeholder="e.g. Push Day (Chest + Shoulders)"
                  className="h-10.5 w-full rounded-xl border border-white/15 bg-[#0B0D10] px-3 text-[13.5px] font-bold text-white focus:outline-none"
                />
              </div>

              {!editDayIsRest && (
                <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                        Exercises ({editDayExercises.length})
                      </span>
                    </div>
                    {editDayExercises.length === 0 ? (
                      <p className="rounded-xl border border-dashed border-white/15 p-3 text-center text-[12px] text-slate-400">
                        Add exercises below from your gym library.
                      </p>
                    ) : (
                      editDayExercises.map((ex, idx) => (
                        <div
                          key={`${ex.name}-${idx}`}
                          className="rounded-2xl bg-[#1E222B] p-2.5 flex items-center justify-between gap-2"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="text-[12.5px] font-extrabold text-white truncate">
                              {ex.name}
                            </p>
                            <div className="mt-1 flex items-center gap-2">
                              <input
                                type="number"
                                min={1}
                                max={12}
                                value={ex.sets}
                                onChange={(e) => {
                                  const val = Math.max(
                                    1,
                                    Math.min(12, Number(e.target.value) || 3),
                                  );
                                  setEditDayExercises((prev) =>
                                    prev.map((row, rIdx) =>
                                      rIdx === idx ? { ...row, sets: val } : row,
                                    ),
                                  );
                                }}
                                aria-label="Sets"
                                className="h-7 w-12 rounded-lg bg-[#0B0D10] px-1.5 text-center text-[11.5px] font-bold text-white tabular-nums"
                              />
                              <span className="text-[11px] text-slate-400">sets ×</span>
                              <input
                                type="text"
                                value={ex.reps}
                                onChange={(e) => {
                                  const val = e.target.value.slice(0, 16);
                                  setEditDayExercises((prev) =>
                                    prev.map((row, rIdx) =>
                                      rIdx === idx ? { ...row, reps: val } : row,
                                    ),
                                  );
                                }}
                                aria-label="Reps"
                                className="h-7 w-16 rounded-lg bg-[#0B0D10] px-2 text-center text-[11.5px] font-bold text-white tabular-nums"
                              />
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              setEditDayExercises((prev) =>
                                prev.filter((_, rIdx) => rIdx !== idx),
                              )
                            }
                            className="rounded-lg p-1.5 text-rose-400 hover:bg-rose-500/15 cursor-pointer"
                            aria-label={`Remove ${ex.name}`}
                          >
                            <Trash2 className="h-4 w-4" aria-hidden />
                          </button>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Quick Add From Catalog */}
                  <div className="rounded-2xl border border-white/10 bg-[#0B0D10] p-3 space-y-2">
                    <p className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                      ➕ Add Exercise from Library
                    </p>
                    <input
                      type="search"
                      placeholder="Search Bench, Squat, Lat Pulldown..."
                      value={editDayAddExSearch}
                      onChange={(e) => setEditDayAddExSearch(e.target.value)}
                      className="h-9 w-full rounded-xl border border-white/10 bg-[#14171D] px-3 text-[12px] text-white placeholder:text-slate-500 focus:outline-none"
                    />
                    <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto pt-1">
                      {catalogExercises
                        .filter((ce) =>
                          !editDayAddExSearch.trim()
                            ? true
                            : ce.name
                                .toLowerCase()
                                .includes(editDayAddExSearch.trim().toLowerCase()) ||
                              ce.muscleGroup
                                .toLowerCase()
                                .includes(editDayAddExSearch.trim().toLowerCase()),
                        )
                        .slice(0, 14)
                        .map((ce) => (
                          <button
                            key={ce.id}
                            type="button"
                            onClick={() =>
                              setEditDayExercises((prev) => [
                                ...prev,
                                {
                                  exerciseId: ce.id,
                                  dayLabel:
                                    editDayFocusTitle.trim() || 'Workout',
                                  name: ce.name,
                                  muscleGroup: ce.muscleGroup,
                                  sets: ce.defaultSets,
                                  reps: ce.defaultReps,
                                  restSeconds: ce.restSeconds,
                                  animationKey: ce.animationKey,
                                  animationGifUrl: ce.animationGifUrl ?? null,
                                },
                              ])
                            }
                            className="rounded-lg border border-white/10 bg-[#1E222B] px-2.5 py-1 text-[11px] font-bold text-slate-200 hover:border-white/30 cursor-pointer"
                          >
                            + {ce.name}
                          </button>
                        ))}
                    </div>
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={savingSelfPlan}
                className="gym-tactile flex h-11 w-full items-center justify-center gap-2 rounded-2xl text-[14px] font-black disabled:opacity-60 cursor-pointer"
                style={{ backgroundColor: brandAccent, color: brandInk }}
              >
                {savingSelfPlan ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                ) : (
                  <Check className="h-4 w-4 stroke-[3]" aria-hidden />
                )}
                Save My Split Changes
              </button>
            </form>
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
            className="gym-tactile flex flex-col items-center justify-center gap-0.5 rounded-xl py-1.5 text-[10.5px] font-bold cursor-pointer"
            style={{ color: activeTab === 'home' ? brandAccent : '#94A3B8' }}
          >
            <Home className="h-4.5 w-4.5" aria-hidden />
            <span>Home</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('plan')}
            className="gym-tactile flex flex-col items-center justify-center gap-0.5 rounded-xl py-1.5 text-[10.5px] font-bold cursor-pointer"
            style={{ color: activeTab === 'plan' ? brandAccent : '#94A3B8' }}
          >
            <Calendar className="h-4.5 w-4.5" aria-hidden />
            <span>Plan</span>
          </button>

          {/* Center Floating ▶ Start Button (Turns glowing Amber with timer when workout is minimized) */}
          <button
            type="button"
            onClick={() =>
              launchWorkoutSession(
                todayScheduleDay?.focusTitle ?? 'Workout Session',
                todayScheduleDay?.exercises ?? [],
              )
            }
            className="gym-tactile -mt-5 mx-auto flex flex-col items-center justify-center cursor-pointer"
            aria-label="Start or Resume Workout Session"
          >
            <span
              className="flex h-12 w-12 items-center justify-center rounded-full border-4 border-[#0B0D10] transition-colors"
              style={
                sessionActive && sessionMinimized
                  ? {
                      backgroundColor: '#F59E0B',
                      color: '#0B0D10',
                      boxShadow: '0 6px 22px rgba(245,158,11,0.55)',
                    }
                  : {
                      backgroundColor: brandAccent,
                      color: brandInk,
                      boxShadow: `0 6px 22px ${brandAccent}73`,
                    }
              }
            >
              <Play className="h-5 w-5 fill-current ml-0.5" aria-hidden />
            </span>
            <span
              className="mt-0.5 text-[10px] font-black tabular-nums"
              style={{
                color:
                  sessionActive && sessionMinimized ? '#FBBF24' : brandAccent,
              }}
            >
              {sessionActive && sessionMinimized
                ? formatTimerClock(sessionElapsedSec)
                : 'Start'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('members');
              setUnreadChatCount(0);
              setNotifBanner(null);
            }}
            className="gym-tactile relative flex flex-col items-center justify-center gap-0.5 rounded-xl py-1.5 text-[10.5px] font-bold cursor-pointer"
            style={{
              color: activeTab === 'members' ? brandAccent : '#94A3B8',
            }}
          >
            <Users className="h-4.5 w-4.5" aria-hidden />
            {unreadChatCount > 0 && (
              <span
                className="absolute top-1 right-4 h-2 w-2 rounded-full"
                style={{ backgroundColor: brandAccent }}
              />
            )}
            <span>Members</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('stats')}
            className="gym-tactile flex flex-col items-center justify-center gap-0.5 rounded-xl py-1.5 text-[10.5px] font-bold cursor-pointer"
            style={{ color: activeTab === 'stats' ? brandAccent : '#94A3B8' }}
          >
            <BarChart3 className="h-4.5 w-4.5" aria-hidden />
            <span>Stats</span>
          </button>
        </nav>
      </div>
    </div>
  );
}
