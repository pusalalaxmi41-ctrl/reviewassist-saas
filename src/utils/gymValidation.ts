import type { BusinessCategory } from '../types/business';
import type {
  GymConfig,
  GymConfigInput,
  GymMember,
  GymOwnerMemberAction,
  GymPlan,
  IndustryWorkspaceType,
  SubmitGymRegistrationInput,
} from '../types/gym';
import { validateBusinessId } from './aiConfigValidation';
import { isBarberOrSalonCategory } from './barberQueueValidation';
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

export function isGymCategory(category?: BusinessCategory | string | null): boolean {
  return category === 'gym';
}

export function getIndustryWorkspaceType(
  category?: BusinessCategory | string | null,
): IndustryWorkspaceType {
  if (isGymCategory(category)) return 'gym';
  if (isBarberOrSalonCategory(category)) return 'barber';
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
  return {
    workspace: 'restaurant',
    emoji: '🍽️',
    label: category === 'cafe' ? 'Cafe / Bakery' : 'Restaurant / Bistro',
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

  return {
    ok: true,
    value: {
      businessSlug,
      fullName,
      phone,
      planId,
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
