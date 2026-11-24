import type { BusinessCategory } from '../types/business';
import type {
  GymCheckInShift,
  GymConfig,
  GymConfigInput,
  GymFitnessGoal,
  GymMember,
  GymOwnerMemberAction,
  GymPlan,
  GymPreferredShift,
  GymThemePreset,
  GymWorkoutFocus,
  IndustryWorkspaceType,
  SubmitGymRegistrationInput,
} from '../types/gym';
import { validateBusinessId } from './aiConfigValidation';
import { isBarberOrSalonCategory } from './barberQueueValidation';
import { isCafeCategory } from './cafeValidation';
import { formatPriceFromPaise } from './restaurantValidation';

// eslint-disable-next-line no-control-regex
const CONTROL_CHARS_RE = /[\u0000-\u001F\u007F]/g;

function stripControlChars(value: string): string {
  return value.replace(CONTROL_CHARS_RE, '').trim();
}

export const DEFAULT_GYM_PLANS: GymPlan[] = [
  {
    id: '1_month',
    name: '1 Month Plan',
    durationDays: 30,
    pricePaise: 150000,
    badge: 'Popular',
  },
  {
    id: '3_months',
    name: '3 Months Plan',
    durationDays: 90,
    pricePaise: 400000,
    badge: 'Save 11%',
  },
  {
    id: '6_months',
    name: '6 Months Plan',
    durationDays: 180,
    pricePaise: 720000,
    badge: 'Best Value',
  },
  {
    id: '1_year',
    name: '1 Year Transformation',
    durationDays: 365,
    pricePaise: 1250000,
    badge: 'Pro',
  },
];

export const ALLOWED_GYM_OWNER_ACTIONS: readonly GymOwnerMemberAction[] = [
  'approve',
  'renew',
  'reject',
  'suspend',
];

export const GYM_FITNESS_GOAL_OPTIONS: ReadonlyArray<{
  value: GymFitnessGoal;
  emoji: string;
  label: string;
  shortLabel: string;
  badgeClass: string;
}> = [
  {
    value: 'weight_loss',
    emoji: '🔥',
    label: 'Weight Loss',
    shortLabel: 'Weight Loss',
    badgeClass: 'bg-orange-100 text-orange-900 border-orange-200',
  },
  {
    value: 'muscle_gain',
    emoji: '💪',
    label: 'Muscle Building',
    shortLabel: 'Muscle Gain',
    badgeClass: 'bg-indigo-100 text-indigo-950 border-indigo-200',
  },
  {
    value: 'weight_gain',
    emoji: '⚖️',
    label: 'Weight Gain',
    shortLabel: 'Weight Gain',
    badgeClass: 'bg-emerald-100 text-emerald-900 border-emerald-200',
  },
  {
    value: 'cardio_endurance',
    emoji: '🏃',
    label: 'Cardio & Stamina',
    shortLabel: 'Cardio',
    badgeClass: 'bg-sky-100 text-sky-900 border-sky-200',
  },
  {
    value: 'general_fitness',
    emoji: '✨',
    label: 'General Fitness',
    shortLabel: 'General Fit',
    badgeClass: 'bg-slate-100 text-slate-800 border-slate-200',
  },
];

export const GYM_WORKOUT_FOCUS_OPTIONS: ReadonlyArray<{
  value: GymWorkoutFocus;
  label: string;
  dayLabel: string;
  barColor: string;
}> = [
  { value: 'chest', label: 'Chest', dayLabel: 'Chest Day', barColor: 'bg-[#1E1B4B]' },
  { value: 'back', label: 'Back', dayLabel: 'Back Day', barColor: 'bg-indigo-600' },
  { value: 'legs', label: 'Legs', dayLabel: 'Leg Day', barColor: 'bg-emerald-600' },
  { value: 'shoulders_arms', label: 'Shoulders & Arms', dayLabel: 'Shoulders & Arms', barColor: 'bg-amber-600' },
  { value: 'cardio_hiit', label: 'Cardio / HIIT', dayLabel: 'Cardio / HIIT', barColor: 'bg-rose-600' },
  { value: 'abs_core', label: 'Abs & Core', dayLabel: 'Abs & Core', barColor: 'bg-teal-600' },
  { value: 'full_body', label: 'Full Body', dayLabel: 'Full Body', barColor: 'bg-slate-700' },
];

export const GYM_THEME_PRESETS: ReadonlyArray<{
  key: GymThemePreset;
  label: string;
  tagline: string;
  accentColor: string;
  inkOnAccent: string;
}> = [
  {
    key: 'volt_obsidian',
    label: 'Volt Obsidian',
    tagline: 'Signature Electric Lime & Obsidian',
    accentColor: '#C8F135',
    inkOnAccent: '#0B0D10',
  },
  {
    key: 'crimson_iron',
    label: 'Crimson Iron',
    tagline: 'Powerlifting Red & Charcoal',
    accentColor: '#EF4444',
    inkOnAccent: '#FFFFFF',
  },
  {
    key: 'cyber_cyan',
    label: 'Cyber Cyan',
    tagline: 'High-Energy Neon Ice',
    accentColor: '#22D3EE',
    inkOnAccent: '#0B0D10',
  },
  {
    key: 'solar_gold',
    label: 'Solar Gold',
    tagline: 'Championship Amber Gold',
    accentColor: '#F59E0B',
    inkOnAccent: '#0B0D10',
  },
  {
    key: 'emerald_pulse',
    label: 'Emerald Pulse',
    tagline: 'Fresh Athletic Emerald',
    accentColor: '#10B981',
    inkOnAccent: '#0B0D10',
  },
];

export const GYM_SHIFT_OPTIONS: ReadonlyArray<{
  value: GymPreferredShift;
  emoji: string;
  label: string;
  windowLabel: string;
}> = [
  {
    value: 'morning',
    emoji: '🌅',
    label: 'Morning',
    windowLabel: '5 AM – 11 AM',
  },
  {
    value: 'evening',
    emoji: '🌆',
    label: 'Evening',
    windowLabel: '4 PM – 10 PM',
  },
  {
    value: 'flexible',
    emoji: '⏰',
    label: 'Flexible',
    windowLabel: 'Anytime',
  },
];

export function normalizeGymPreferredShift(
  raw?: string | null,
): GymPreferredShift {
  const clean = typeof raw === 'string' ? stripControlChars(raw).toLowerCase() : '';
  if (clean === 'evening') return 'evening';
  if (clean === 'flexible') return 'flexible';
  return 'morning';
}

export function inferGymCheckInShiftFromHour(hour?: number): GymCheckInShift {
  const h = typeof hour === 'number' && Number.isFinite(hour) ? hour : new Date().getHours();
  return h < 14 ? 'morning' : 'evening';
}

export function normalizeGymAccentColor(raw?: string | null): string {
  const clean = typeof raw === 'string' ? stripControlChars(raw) : '';
  return /^#[0-9A-Fa-f]{6}$/.test(clean) ? clean.toUpperCase() : '#C8F135';
}

export function normalizeGymThemePreset(raw?: string | null): GymThemePreset {
  const clean = typeof raw === 'string' ? stripControlChars(raw).toLowerCase() : '';
  const match = GYM_THEME_PRESETS.find((t) => t.key === clean);
  return match ? match.key : 'volt_obsidian';
}

export function normalizeGymFitnessGoal(
  raw?: string | null,
): GymFitnessGoal {
  const clean = typeof raw === 'string' ? stripControlChars(raw).toLowerCase() : '';
  const match = GYM_FITNESS_GOAL_OPTIONS.find((g) => g.value === clean);
  return match ? match.value : 'general_fitness';
}

export function normalizeGymWorkoutFocus(
  raw?: string | null,
): GymWorkoutFocus {
  const clean = typeof raw === 'string' ? stripControlChars(raw).toLowerCase() : '';
  const match = GYM_WORKOUT_FOCUS_OPTIONS.find((w) => w.value === clean);
  return match ? match.value : 'full_body';
}

export function getFitnessGoalMeta(goal?: GymFitnessGoal | string | null) {
  const norm = normalizeGymFitnessGoal(goal);
  return (
    GYM_FITNESS_GOAL_OPTIONS.find((g) => g.value === norm) ??
    GYM_FITNESS_GOAL_OPTIONS[GYM_FITNESS_GOAL_OPTIONS.length - 1]
  );
}

export function getWorkoutFocusMeta(focus?: GymWorkoutFocus | string | null) {
  const norm = normalizeGymWorkoutFocus(focus);
  return (
    GYM_WORKOUT_FOCUS_OPTIONS.find((w) => w.value === norm) ??
    GYM_WORKOUT_FOCUS_OPTIONS[GYM_WORKOUT_FOCUS_OPTIONS.length - 1]
  );
}

export function validateGymWeightKg(
  raw: unknown,
): { ok: true; value: number | null } | { ok: false; error: string } {
  if (raw === undefined || raw === null || raw === '') {
    return { ok: true, value: null };
  }
  const num = typeof raw === 'number' ? raw : Number.parseFloat(String(raw));
  if (!Number.isFinite(num) || num < 20 || num > 300) {
    return { ok: false, error: 'Weight must be between 20 and 300 kg.' };
  }
  return { ok: true, value: Math.round(num * 10) / 10 };
}

export function formatCheckInTime12h(isoTimestamp: string | null | undefined): string {
  if (!isoTimestamp) return '';
  const dt = new Date(isoTimestamp);
  if (Number.isNaN(dt.getTime())) return '';
  return dt.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

export function isGymCategory(category?: BusinessCategory | string | null): boolean {
  return category === 'gym';
}

export function getIndustryWorkspaceType(
  category?: BusinessCategory | string | null,
): IndustryWorkspaceType {
  if (isGymCategory(category)) return 'gym';
  if (isBarberOrSalonCategory(category)) return 'barber';
  if (isCafeCategory(category)) return 'cafe';
  return 'restaurant';
}

export function getIndustryBadgeMeta(
  category?: BusinessCategory | string | null,
): {
  workspace: IndustryWorkspaceType;
  emoji: string;
  label: string;
  moduleName: string;
  badgeClass: string;
} {
  if (isGymCategory(category)) {
    return {
      workspace: 'gym',
      emoji: '🏋️',
      label: 'Gym & Fitness',
      moduleName: 'GymOS',
      badgeClass: 'bg-lime-100 text-slate-900 border-lime-300',
    };
  }
  if (isBarberOrSalonCategory(category)) {
    return {
      workspace: 'barber',
      emoji: '✂️',
      label: 'Barber / Salon',
      moduleName: 'BarberOS',
      badgeClass: 'bg-amber-100 text-amber-950 border-amber-300',
    };
  }
  if (isCafeCategory(category)) {
    return {
      workspace: 'cafe',
      emoji: '☕',
      label: 'Cafe & Coffee Shop',
      moduleName: 'CafeOS',
      badgeClass: 'bg-amber-50 text-amber-950 border-amber-300',
    };
  }
  return {
    workspace: 'restaurant',
    emoji: '🍽️',
    label: 'Restaurant / Bistro',
    moduleName: 'BistroOS',
    badgeClass: 'bg-indigo-50 text-indigo-900 border-indigo-200',
  };
}

export function getGymPortalUrl(
  businessSlug: string,
  baseOrigin?: string,
): string {
  const cleanSlug = stripControlChars(businessSlug).toLowerCase();
  if (!cleanSlug || !/^[a-z0-9-]{3,80}$/.test(cleanSlug)) {
    throw new Error('A valid business slug is required to generate a Gym Portal URL.');
  }
  const host = (
    baseOrigin ??
    (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173')
  ).replace(/\/+$/, '');
  return `${host}/r/${cleanSlug}/gym`;
}

export function getPrimaryCustomerQrUrlForBusiness(
  business: { slug: string; category: BusinessCategory },
  baseOrigin?: string,
): string {
  const host = (
    baseOrigin ??
    (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173')
  ).replace(/\/+$/, '');
  const slug = stripControlChars(business.slug).toLowerCase();
  if (isGymCategory(business.category)) {
    return `${host}/r/${slug}/gym`;
  }
  if (isBarberOrSalonCategory(business.category)) {
    return `${host}/r/${slug}/queue`;
  }
  if (isCafeCategory(business.category)) {
    return `${host}/r/${slug}/cafe`;
  }
  return `${host}/r/${slug}/menu`;
}

export function normalizeGymPhone(rawPhone: string): string {
  let digits = stripControlChars(rawPhone).replace(/[^0-9]/g, '');
  if (digits.length === 12 && digits.startsWith('91')) {
    digits = digits.slice(2);
  } else if (digits.length === 11 && digits.startsWith('0')) {
    digits = digits.slice(1);
  }
  return digits.slice(0, 20);
}

export function getTodayIsoDateKey(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function addDaysToIsoDate(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split('-').map((n) => Number.parseInt(n, 10));
  const dt = new Date(Date.UTC(y, (m || 1) - 1, (d || 1) + days));
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(dt.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

export function diffDaysBetweenIsoDates(
  laterIso: string,
  earlierIso: string,
): number {
  const [y1, m1, d1] = laterIso.split('-').map((n) => Number.parseInt(n, 10));
  const [y2, m2, d2] = earlierIso.split('-').map((n) => Number.parseInt(n, 10));
  const t1 = Date.UTC(y1, (m1 || 1) - 1, d1 || 1);
  const t2 = Date.UTC(y2, (m2 || 1) - 1, d2 || 1);
  return Math.round((t1 - t2) / (1000 * 60 * 60 * 24));
}

export function formatIsoDatePretty(isoDate: string | null | undefined): string {
  if (!isoDate) return '—';
  const [y, m, d] = isoDate.split('-').map((n) => Number.parseInt(n, 10));
  if (!y || !m || !d) return isoDate;
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function normalizeGymPlans(
  rawPlans?: ReadonlyArray<Partial<GymPlan>> | null,
): GymPlan[] {
  if (!Array.isArray(rawPlans) || rawPlans.length === 0) {
    return DEFAULT_GYM_PLANS.map((p) => ({ ...p }));
  }

  const out: GymPlan[] = [];
  rawPlans.slice(0, 12).forEach((plan, idx) => {
    const name =
      typeof plan?.name === 'string'
        ? stripControlChars(plan.name).replace(/\s+/g, ' ').slice(0, 80)
        : '';
    if (!name) return;
    const rawId =
      typeof plan?.id === 'string' && stripControlChars(plan.id)
        ? stripControlChars(plan.id).toLowerCase().replace(/[^a-z0-9-_]/g, '_')
        : `plan_${idx + 1}`;
    const durationDays =
      typeof plan?.durationDays === 'number' &&
      Number.isInteger(plan.durationDays) &&
      plan.durationDays >= 1 &&
      plan.durationDays <= 1095
        ? plan.durationDays
        : 30;
    const pricePaise =
      typeof plan?.pricePaise === 'number' &&
      Number.isInteger(plan.pricePaise) &&
      plan.pricePaise >= 0 &&
      plan.pricePaise <= 100_000_000
        ? plan.pricePaise
        : 150000;
    const badge =
      typeof plan?.badge === 'string' && stripControlChars(plan.badge)
        ? stripControlChars(plan.badge).slice(0, 24)
        : undefined;
    out.push({ id: rawId, name, durationDays, pricePaise, badge });
  });

  return out.length > 0 ? out : DEFAULT_GYM_PLANS.map((p) => ({ ...p }));
}

export function normalizeGymConfig(
  businessId: string,
  partial?: Partial<GymConfig & GymConfigInput> | null,
): GymConfig {
  const renewalAlertDays =
    typeof partial?.renewalAlertDays === 'number' &&
    Number.isInteger(partial.renewalAlertDays) &&
    partial.renewalAlertDays >= 1 &&
    partial.renewalAlertDays <= 30
      ? partial.renewalAlertDays
      : 3;

  return {
    businessId: businessId.trim(),
    isRegistrationOpen:
      typeof partial?.isRegistrationOpen === 'boolean'
        ? partial.isRegistrationOpen
        : true,
    renewalAlertDays,
    plans: normalizeGymPlans(partial?.plans),
    logoUrl: typeof partial?.logoUrl === 'string' && partial.logoUrl.trim() ? partial.logoUrl.trim() : null,
    accentColor: normalizeGymAccentColor(partial?.accentColor),
    themePreset: normalizeGymThemePreset(partial?.themePreset),
    createdAt: partial?.createdAt ?? new Date().toISOString(),
    updatedAt: partial?.updatedAt ?? new Date().toISOString(),
  };
}

export function validateGymConfigInput(
  businessId: unknown,
  input: unknown,
):
  | {
      ok: true;
      value: {
        isRegistrationOpen: boolean;
        renewalAlertDays: number;
        plans: GymPlan[];
      };
    }
  | { ok: false; error: string } {
  const idErr = validateBusinessId(businessId);
  if (idErr) return { ok: false, error: idErr };

  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { ok: false, error: 'Gym configuration input must be an object.' };
  }
  const rec = input as Partial<GymConfigInput> & Record<string, unknown>;
  if (typeof rec.isRegistrationOpen !== 'boolean') {
    return { ok: false, error: 'isRegistrationOpen must be a boolean.' };
  }
  const renewalAlertDays =
    rec.renewalAlertDays === undefined ? 3 : rec.renewalAlertDays;
  if (
    typeof renewalAlertDays !== 'number' ||
    !Number.isInteger(renewalAlertDays) ||
    renewalAlertDays < 1 ||
    renewalAlertDays > 30
  ) {
    return {
      ok: false,
      error: 'Renewal alert window must be an integer between 1 and 30 days.',
    };
  }

  const plans = normalizeGymPlans(
    Array.isArray(rec.plans) ? (rec.plans as GymPlan[]) : undefined,
  );
  return {
    ok: true,
    value: {
      isRegistrationOpen: rec.isRegistrationOpen,
      renewalAlertDays,
      plans,
    },
  };
}

export function validateGymRegistrationInput(
  input: unknown,
):
  | {
      ok: true;
      value: SubmitGymRegistrationInput;
    }
  | { ok: false; error: string } {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { ok: false, error: 'Registration payload is required.' };
  }
  const rec = input as Partial<SubmitGymRegistrationInput>;
  const businessSlug =
    typeof rec.businessSlug === 'string'
      ? stripControlChars(rec.businessSlug).toLowerCase()
      : '';
  if (!/^[a-z0-9-]{3,80}$/.test(businessSlug)) {
    return { ok: false, error: 'Invalid gym shop slug.' };
  }
  const fullName =
    typeof rec.fullName === 'string'
      ? stripControlChars(rec.fullName).replace(/\s+/g, ' ')
      : '';
  if (fullName.length < 2 || fullName.length > 80) {
    return {
      ok: false,
      error: 'Please enter your full name (2 to 80 characters).',
    };
  }
  const phone =
    typeof rec.phone === 'string' ? normalizeGymPhone(rec.phone) : '';
  if (phone.length < 8) {
    return {
      ok: false,
      error: 'Please enter a valid 10-digit mobile number.',
    };
  }
  const planId =
    typeof rec.planId === 'string' && stripControlChars(rec.planId)
      ? stripControlChars(rec.planId).toLowerCase()
      : '1_month';

  const fitnessGoal = normalizeGymFitnessGoal(rec.fitnessGoal);
  const startWtCheck = validateGymWeightKg(rec.startingWeightKg);
  if (!startWtCheck.ok) {
    return { ok: false, error: `Starting weight: ${startWtCheck.error}` };
  }
  const targetWtCheck = validateGymWeightKg(rec.targetWeightKg);
  if (!targetWtCheck.ok) {
    return { ok: false, error: `Target weight: ${targetWtCheck.error}` };
  }

  return {
    ok: true,
    value: {
      businessSlug,
      fullName,
      phone,
      planId,
      preferredShift: normalizeGymPreferredShift(rec.preferredShift),
      fitnessGoal,
      startingWeightKg: startWtCheck.value,
      targetWeightKg: targetWtCheck.value,
    },
  };
}

export function validateGymOwnerAction(
  action: unknown,
):
  | { ok: true; value: GymOwnerMemberAction }
  | { ok: false; error: string } {
  if (
    typeof action !== 'string' ||
    !ALLOWED_GYM_OWNER_ACTIONS.includes(action.trim() as GymOwnerMemberAction)
  ) {
    return {
      ok: false,
      error: `Action must be one of: ${ALLOWED_GYM_OWNER_ACTIONS.join(', ')}.`,
    };
  }
  return { ok: true, value: action.trim() as GymOwnerMemberAction };
}

export function encodeGymMemberPassQr(
  businessSlug: string,
  memberCode: string,
  phone: string,
): string {
  return `vitaran-gym://${stripControlChars(businessSlug).toLowerCase()}/${stripControlChars(memberCode).toUpperCase()}?p=${normalizeGymPhone(phone)}`;
}

export function buildGymRenewalWhatsAppMessage(
  gymName: string,
  member: Pick<
    GymMember,
    'fullName' | 'planName' | 'daysRemaining' | 'endDate' | 'feePaise' | 'effectiveStatus'
  >,
): string {
  const formattedFee = formatPriceFromPaise(member.feePaise, 'INR');
  const formattedEnd = formatIsoDatePretty(member.endDate);
  if (member.effectiveStatus === 'expired' || member.daysRemaining <= 0) {
    return `Hi ${member.fullName}! Your ${gymName} membership (${member.planName}) expired on ${formattedEnd}. Renew today (${formattedFee}) at the front desk to keep your streak going! 💪`;
  }
  const dayWord = member.daysRemaining === 1 ? 'day' : 'days';
  return `Hi ${member.fullName}! Friendly reminder from ${gymName}: your ${member.planName} expires in ${member.daysRemaining} ${dayWord} (${formattedEnd}). Renew early (${formattedFee}) at the front desk so your workouts stay uninterrupted! 🏋️‍♂️`;
}

export function getGymRenewalWhatsAppLink(
  gymName: string,
  member: Pick<
    GymMember,
    'fullName' | 'phone' | 'planName' | 'daysRemaining' | 'endDate' | 'feePaise' | 'effectiveStatus'
  >,
): string {
  const msg = buildGymRenewalWhatsAppMessage(gymName, member);
  const digits = normalizeGymPhone(member.phone);
  const waPhone = digits.length === 10 ? `91${digits}` : digits;
  return `https://wa.me/${waPhone}?text=${encodeURIComponent(msg)}`;
}

// ---------------------------------------------------------------------------
// GymOS Flagship Utilities (PT, Installments, Freeze, Measurements, Retail)
// ---------------------------------------------------------------------------

export const GYM_RETAIL_STARTER_PRODUCTS: ReadonlyArray<{
  productName: string;
  pricePaise: number;
  stockQty: number;
}> = [
  { productName: 'Whey Protein Scoop', pricePaise: 12000, stockQty: 60 },
  { productName: 'Pre-Workout Shot', pricePaise: 15000, stockQty: 40 },
  { productName: 'Mineral Water 1L', pricePaise: 2000, stockQty: 120 },
  { productName: 'High-Protein Bar', pricePaise: 10000, stockQty: 50 },
];

export function computeGymBmi(
  weightKg: number,
  heightCm?: number | null,
): number | null {
  if (!Number.isFinite(weightKg) || weightKg < 20 || weightKg > 300) return null;
  if (!heightCm || !Number.isFinite(heightCm) || heightCm < 100 || heightCm > 250) {
    return null;
  }
  const heightM = heightCm / 100;
  return Math.round((weightKg / (heightM * heightM)) * 10) / 10;
}

export function formatPrivacySafeLeaderboardName(fullName: string): string {
  const clean = stripControlChars(fullName).replace(/\s+/g, ' ');
  if (!clean) return 'Member';
  const parts = clean.split(' ');
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[1].charAt(0).toUpperCase()}.`;
}

export function buildWeeklyActivityDays(
  recentLogs: ReadonlyArray<{ checkInDate: string }> = [],
  now: Date = new Date(),
): Array<{ dayLabel: string; isoDate: string; trained: boolean; isToday: boolean }> {
  const trainedSet = new Set(recentLogs.map((l) => l.checkInDate));
  const todayIso = getTodayIsoDateKey(now);
  // Start on Monday of the current week
  const jsDay = now.getDay(); // 0=Sun..6=Sat
  const offsetFromMon = jsDay === 0 ? 6 : jsDay - 1;
  const monDate = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() - offsetFromMon,
  );
  const labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  return labels.map((dayLabel, i) => {
    const dt = new Date(
      monDate.getFullYear(),
      monDate.getMonth(),
      monDate.getDate() + i,
    );
    const isoDate = getTodayIsoDateKey(dt);
    return {
      dayLabel,
      isoDate,
      trained: trainedSet.has(isoDate),
      isToday: isoDate === todayIso,
    };
  });
}

export function validateGymTrainerInput(
  businessId: unknown,
  input: unknown,
):
  | {
      ok: true;
      value: {
        trainerName: string;
        specialty: string;
        commissionPercent: number;
        isActive: boolean;
      };
    }
  | { ok: false; error: string } {
  const idErr = validateBusinessId(businessId);
  if (idErr) return { ok: false, error: idErr };
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { ok: false, error: 'Trainer details are required.' };
  }
  const rec = input as Record<string, unknown>;
  const trainerName = stripControlChars(String(rec.trainerName ?? '')).slice(0, 80);
  if (trainerName.length < 2) {
    return { ok: false, error: 'Trainer name must be at least 2 characters.' };
  }
  const specialty =
    stripControlChars(String(rec.specialty ?? '')).slice(0, 120) ||
    'Strength & Conditioning';
  const commissionPercent = Number(rec.commissionPercent ?? 50);
  if (
    !Number.isFinite(commissionPercent) ||
    commissionPercent < 0 ||
    commissionPercent > 100
  ) {
    return { ok: false, error: 'Commission percentage must be between 0 and 100.' };
  }
  return {
    ok: true,
    value: {
      trainerName,
      specialty,
      commissionPercent: Math.round(commissionPercent * 100) / 100,
      isActive: rec.isActive !== false,
    },
  };
}

export function validateGymRetailProductInput(
  businessId: unknown,
  input: unknown,
):
  | {
      ok: true;
      value: { productName: string; pricePaise: number; stockQty: number };
    }
  | { ok: false; error: string } {
  const idErr = validateBusinessId(businessId);
  if (idErr) return { ok: false, error: idErr };
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { ok: false, error: 'Product details are required.' };
  }
  const rec = input as Record<string, unknown>;
  const productName = stripControlChars(String(rec.productName ?? '')).slice(0, 100);
  if (productName.length < 2) {
    return { ok: false, error: 'Product name must be at least 2 characters.' };
  }
  const pricePaise = Math.round(Number(rec.pricePaise ?? 0));
  if (!Number.isFinite(pricePaise) || pricePaise < 0 || pricePaise > 10_000_000) {
    return { ok: false, error: 'Product price must be 0 or greater.' };
  }
  const stockQty = Math.round(Number(rec.stockQty ?? 50));
  if (!Number.isFinite(stockQty) || stockQty < 0 || stockQty > 100_000) {
    return { ok: false, error: 'Stock quantity cannot be negative.' };
  }
  return {
    ok: true,
    value: { productName, pricePaise, stockQty },
  };
}

export function validateGymBodyMeasurementInput(input: unknown):
  | {
      ok: true;
      value: {
        businessSlug: string;
        phone: string;
        weightKg: number;
        waistInches: number | null;
        chestInches: number | null;
        bicepsInches: number | null;
        bmi: number | null;
        note: string | null;
      };
    }
  | { ok: false; error: string } {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { ok: false, error: 'Measurement data is required.' };
  }
  const rec = input as Record<string, unknown>;
  const businessSlug = stripControlChars(String(rec.businessSlug ?? '')).toLowerCase();
  if (!/^[a-z0-9-]{3,80}$/.test(businessSlug)) {
    return { ok: false, error: 'Invalid gym slug.' };
  }
  const phone = normalizeGymPhone(String(rec.phone ?? ''));
  if (phone.length < 8) {
    return { ok: false, error: 'Valid phone number is required.' };
  }
  const wtCheck = validateGymWeightKg(rec.weightKg);
  if (!wtCheck.ok || wtCheck.value === null) {
    return { ok: false, error: 'Weight (20–300 kg) is required.' };
  }

  const parseOpt = (raw: unknown, min: number, max: number, label: string) => {
    if (raw === undefined || raw === null || raw === '') return { ok: true as const, value: null };
    const n = Number(raw);
    if (!Number.isFinite(n) || n < min || n > max) {
      return { ok: false as const, error: `${label} must be between ${min} and ${max}.` };
    }
    return { ok: true as const, value: Math.round(n * 10) / 10 };
  };

  const waist = parseOpt(rec.waistInches, 15, 80, 'Waist');
  if (!waist.ok) return waist;
  const chest = parseOpt(rec.chestInches, 20, 80, 'Chest');
  if (!chest.ok) return chest;
  const biceps = parseOpt(rec.bicepsInches, 6, 35, 'Biceps');
  if (!biceps.ok) return biceps;

  let bmi: number | null = null;
  if (rec.bmi !== undefined && rec.bmi !== null && rec.bmi !== '') {
    const bmiCheck = parseOpt(rec.bmi, 10, 70, 'BMI');
    if (!bmiCheck.ok) return bmiCheck;
    bmi = bmiCheck.value;
  } else if (rec.heightCm !== undefined && rec.heightCm !== null && rec.heightCm !== '') {
    bmi = computeGymBmi(wtCheck.value, Number(rec.heightCm));
  }

  const note = stripControlChars(String(rec.note ?? '')).slice(0, 280) || null;
  return {
    ok: true,
    value: {
      businessSlug,
      phone,
      weightKg: wtCheck.value,
      waistInches: waist.value,
      chestInches: chest.value,
      bicepsInches: biceps.value,
      bmi,
      note,
    },
  };
}

export function getGymBalanceDueWhatsAppLink(
  gymName: string,
  member: Pick<GymMember, 'fullName' | 'phone' | 'balanceDuePaise' | 'balanceDueDate'>,
): string {
  const due = formatPriceFromPaise(member.balanceDuePaise ?? 0, 'INR');
  const dueDate = member.balanceDueDate
    ? ` (due by ${formatIsoDatePretty(member.balanceDueDate)})`
    : '';
  const msg = `Hi ${member.fullName}! Friendly reminder from ${gymName}: your pending installment balance is ${due}${dueDate}. You can pay via UPI or Cash at the reception desk on your next workout! 💪`;
  const digits = normalizeGymPhone(member.phone);
  const waPhone = digits.length === 10 ? `91${digits}` : digits;
  return `https://wa.me/${waPhone}?text=${encodeURIComponent(msg)}`;
}
