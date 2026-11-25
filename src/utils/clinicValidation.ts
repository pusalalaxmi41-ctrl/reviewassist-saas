import type { BusinessCategory } from '../types/business';
import type {
  ClinicConfig,
  ClinicConfigInput,
  ClinicDoctorInput,
  ClinicPaymentMethod,
  ClinicPrescriptionItem,
  ClinicVisitStatus,
  ClinicVisitType,
  ClinicVitals,
} from '../types/clinic';
import { validateBusinessId } from './aiConfigValidation';

// eslint-disable-next-line no-control-regex
const CONTROL_CHARS_RE = /[\u0000-\u001F\u007F]/g;

function stripControlChars(value: string): string {
  return value.replace(CONTROL_CHARS_RE, '').trim();
}

export const CLINIC_SPECIALTY_PRESETS: string[] = [
  'General Physician & Diabetology',
  'Dental & Implantology',
  'Dermatology & Laser',
  'Orthopedics & Physiotherapy',
  'Pediatrics & Child Care',
  'ENT & Diagnostics',
];

export const CLINIC_TREATMENT_PACKAGE_PRESETS: Array<{
  id: string;
  name: string;
  sessionsTotal: number;
  feePaise: number;
  defaultFollowupReason: string;
}> = [
  {
    id: 'ortho_physio_10',
    name: '10-Session Ortho Physio Pack',
    sessionsTotal: 10,
    feePaise: 850000,
    defaultFollowupReason: 'Next Physio Rehab Session',
  },
  {
    id: 'dental_rct_crown',
    name: 'Root Canal + Zirconia Crown (3 Visits)',
    sessionsTotal: 3,
    feePaise: 1200000,
    defaultFollowupReason: 'Crown Trial & Final Cementation',
  },
  {
    id: 'derma_laser_6',
    name: '6-Session Derma Laser & Peel Pack',
    sessionsTotal: 6,
    feePaise: 1800000,
    defaultFollowupReason: '4-Week Laser Session Follow-Up',
  },
  {
    id: 'post_op_care_4',
    name: '4-Visit Post-Op Dressing & Review Pack',
    sessionsTotal: 4,
    feePaise: 320000,
    defaultFollowupReason: 'Post-Op Suture & Healing Check',
  },
];

export const CLINIC_DOSAGE_PRESETS: string[] = [
  '1-0-1 After Food',
  '1-1-1 After Food',
  '0-0-1 At Bedtime',
  '1-0-0 Empty Stomach',
  'SOS (When Needed)',
  'Twice Daily Topical',
];

export function isClinicCategory(
  category?: BusinessCategory | string | null,
): boolean {
  return category === 'clinic';
}

export function normalizeClinicPhone(rawPhone: string | null | undefined): string {
  let digits = stripControlChars(rawPhone ?? '').replace(/[^0-9]/g, '');
  if (digits.length === 12 && digits.startsWith('91')) {
    digits = digits.slice(2);
  } else if (digits.length === 11 && digits.startsWith('0')) {
    digits = digits.slice(1);
  }
  return digits.slice(0, 20);
}

export function getClinicPortalUrl(
  businessSlug: string,
  baseOrigin?: string,
): string {
  const cleanSlug = stripControlChars(businessSlug).toLowerCase();
  if (!cleanSlug || !/^[a-z0-9-]{3,80}$/.test(cleanSlug)) {
    throw new Error(
      'A valid business slug is required to generate a Clinic Portal URL.',
    );
  }
  const host = (
    baseOrigin ??
    (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173')
  ).replace(/\/+$/, '');
  return `${host}/r/${cleanSlug}/clinic`;
}

export function createDefaultClinicConfig(businessId: string): ClinicConfig {
  const now = new Date().toISOString();
  return {
    businessId,
    clinicTagline: 'Multi-Specialty Care, Live OPD Queue & Digital Prescriptions',
    logoUrl: null,
    accentColor: '#0D9488',
    isQueueOpen: true,
    recallWindowDays: 3,
    createdAt: now,
    updatedAt: now,
  };
}

export function validateClinicConfigInput(
  businessId: string,
  input: ClinicConfigInput,
): ClinicConfig {
  const idErr = validateBusinessId(businessId);
  if (idErr) throw new Error(idErr);
  const cleanId = businessId.trim();

  const tagline =
    stripControlChars(input.clinicTagline ?? '').slice(0, 140) ||
    'Multi-Specialty Care, Live OPD Queue & Digital Prescriptions';

  const rawHex = stripControlChars(input.accentColor ?? '#0D9488');
  const accentColor = /^#[0-9a-fA-F]{6}$/.test(rawHex) ? rawHex : '#0D9488';

  const rawWindow = input.recallWindowDays ?? 3;
  const recallWindowDays = Math.max(1, Math.min(30, Math.round(Number(rawWindow) || 3)));

  const logoUrl =
    typeof input.logoUrl === 'string' && input.logoUrl.trim()
      ? input.logoUrl.trim()
      : null;

  return {
    businessId: cleanId,
    clinicTagline: tagline,
    logoUrl,
    accentColor,
    isQueueOpen: input.isQueueOpen ?? true,
    recallWindowDays,
    updatedAt: new Date().toISOString(),
  };
}

export function validateClinicDoctorInput(
  businessId: string,
  input: ClinicDoctorInput,
): {
  id?: string;
  businessId: string;
  doctorName: string;
  specialty: string;
  cabinLabel: string;
  consultationFeePaise: number;
  avgConsultMinutes: number;
  commissionPercent: number;
  isAvailable: boolean;
} {
  const idErr = validateBusinessId(businessId);
  if (idErr) throw new Error(idErr);
  const doctorName = stripControlChars(input.doctorName).slice(0, 80);
  if (doctorName.length < 2) {
    throw new Error('Please enter a valid doctor name (e.g., Dr. Ananya Sharma).');
  }
  const specialty =
    stripControlChars(input.specialty).slice(0, 80) || 'General Physician';
  const cabinLabel =
    stripControlChars(input.cabinLabel).slice(0, 40) || 'Room 1';

  const feePaise = Math.max(0, Math.round(Number(input.consultationFeePaise) || 0));
  const avgMins = Math.round(Number(input.avgConsultMinutes) || 15);
  if (avgMins < 5 || avgMins > 120) {
    throw new Error('Average consultation duration must be between 5 and 120 minutes.');
  }
  const comm = Number(input.commissionPercent ?? 50);
  if (!Number.isFinite(comm) || comm < 0 || comm > 100) {
    throw new Error('Doctor commission percentage must be between 0 and 100.');
  }

  return {
    id: input.id?.trim() || undefined,
    businessId: businessId.trim(),
    doctorName,
    specialty,
    cabinLabel,
    consultationFeePaise: feePaise,
    avgConsultMinutes: avgMins,
    commissionPercent: Math.round(comm * 100) / 100,
    isAvailable: input.isAvailable ?? true,
  };
}

export function calculateClinicEstimatedWaitMinutes(params: {
  patientsAhead: number;
  avgConsultMinutes?: number | null;
  extraDelayMinutes?: number | null;
  status?: ClinicVisitStatus;
}): number {
  if (params.status === 'in_consultation' || params.status === 'completed' || params.status === 'no_show') {
    return 0;
  }
  const avg = Math.max(5, Math.min(120, Number(params.avgConsultMinutes ?? 15) || 15));
  const delay = Number(params.extraDelayMinutes ?? 0) || 0;
  const ahead = Math.max(0, Math.floor(params.patientsAhead));
  return Math.max(0, ahead * avg + delay);
}

export function calculateDoctorCommissionPaise(
  feeChargedPaise: number,
  commissionPercent: number,
): number {
  const cleanFee = Math.max(0, Math.round(Number(feeChargedPaise) || 0));
  const cleanPct = Math.max(0, Math.min(100, Number(commissionPercent) || 0));
  return Math.round((cleanFee * cleanPct) / 100);
}

export function sanitizeClinicVitals(raw?: ClinicVitals | null): ClinicVitals {
  if (!raw || typeof raw !== 'object') return {};
  const next: ClinicVitals = {};
  if (raw.bp && stripControlChars(String(raw.bp))) {
    next.bp = stripControlChars(String(raw.bp)).slice(0, 20);
  }
  if (raw.pulse && stripControlChars(String(raw.pulse))) {
    next.pulse = stripControlChars(String(raw.pulse)).slice(0, 12);
  }
  if (raw.tempF && stripControlChars(String(raw.tempF))) {
    next.tempF = stripControlChars(String(raw.tempF)).slice(0, 12);
  }
  if (raw.weightKg && stripControlChars(String(raw.weightKg))) {
    next.weightKg = stripControlChars(String(raw.weightKg)).slice(0, 12);
  }
  return next;
}

export function sanitizePrescriptionItems(
  items?: ClinicPrescriptionItem[] | null,
): ClinicPrescriptionItem[] {
  if (!Array.isArray(items)) return [];
  return items
    .map((item) => ({
      medicineName: stripControlChars(item.medicineName ?? '').slice(0, 120),
      dosage: stripControlChars(item.dosage ?? '1-0-1 After Food').slice(0, 80) || '1-0-1 After Food',
      days: Math.max(1, Math.min(365, Math.round(Number(item.days) || 5))),
      instruction: stripControlChars(item.instruction ?? '').slice(0, 160) || undefined,
    }))
    .filter((item) => item.medicineName.length >= 2);
}

export function isValidClinicVisitType(val: unknown): val is ClinicVisitType {
  return (
    val === 'walk_in' ||
    val === 'appointment' ||
    val === 'package_session' ||
    val === 'followup'
  );
}

export function isValidClinicVisitStatus(val: unknown): val is ClinicVisitStatus {
  return (
    val === 'waiting' ||
    val === 'vitals_done' ||
    val === 'in_consultation' ||
    val === 'completed' ||
    val === 'no_show'
  );
}

export function isValidClinicPaymentMethod(val: unknown): val is ClinicPaymentMethod {
  return (
    val === 'cash' ||
    val === 'upi' ||
    val === 'card' ||
    val === 'package_credit'
  );
}

export function formatRupeesCompactFromPaise(paise: number): string {
  const rupees = (Number(paise) || 0) / 100;
  return `₹${rupees.toLocaleString('en-IN', {
    minimumFractionDigits: Number.isInteger(rupees) ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

export function buildClinicYoureNextWhatsAppLink(params: {
  phone: string;
  patientName: string;
  tokenNumber: string;
  clinicName: string;
  doctorName?: string | null;
  cabinLabel?: string | null;
  businessSlug: string;
}): string {
  const digits = normalizeClinicPhone(params.phone);
  const intlPhone = digits.length === 10 ? `91${digits}` : digits;
  const portalUrl = getClinicPortalUrl(params.businessSlug);
  const docPart = params.doctorName
    ? ` with ${params.doctorName}${params.cabinLabel ? ` (${params.cabinLabel})` : ''}`
    : '';
  const msg = `Hello ${params.patientName}, your token ${params.tokenNumber} at ${params.clinicName} is NEXT${docPart}. Please proceed to reception/consultation cabin. Live pass: ${portalUrl}`;
  return `https://wa.me/${intlPhone}?text=${encodeURIComponent(msg)}`;
}

export function buildClinicRecallWhatsAppLink(params: {
  phone: string;
  patientName: string;
  clinicName: string;
  followupDate?: string | null;
  followupReason?: string | null;
  balanceDuePaise?: number;
  businessSlug: string;
}): string {
  const digits = normalizeClinicPhone(params.phone);
  const intlPhone = digits.length === 10 ? `91${digits}` : digits;
  const portalUrl = getClinicPortalUrl(params.businessSlug);
  const reasonText = params.followupReason
    ? ` for "${params.followupReason}"`
    : ' for your scheduled follow-up';
  const dateText = params.followupDate ? ` on ${params.followupDate}` : '';
  const dueText =
    params.balanceDuePaise && params.balanceDuePaise > 0
      ? ` (Pending balance: ${formatRupeesCompactFromPaise(params.balanceDuePaise)})`
      : '';
  const msg = `Care Reminder from ${params.clinicName}: Hello ${params.patientName}, we look forward to seeing you${reasonText}${dateText}${dueText}. Check live OPD wait times & your Digital Rx pass here: ${portalUrl}`;
  return `https://wa.me/${intlPhone}?text=${encodeURIComponent(msg)}`;
}
