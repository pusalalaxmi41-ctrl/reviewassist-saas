import type { BusinessCategory } from './business';

export type ClinicVisitType =
  | 'walk_in'
  | 'appointment'
  | 'package_session'
  | 'followup';

export type ClinicVisitStatus =
  | 'waiting'
  | 'vitals_done'
  | 'in_consultation'
  | 'completed'
  | 'no_show';

export type ClinicPaymentMethod =
  | 'cash'
  | 'upi'
  | 'card'
  | 'package_credit';

export type ClinicPatientGender = 'male' | 'female' | 'other';

export interface ClinicConfig {
  businessId: string;
  clinicTagline: string;
  logoUrl: string | null;
  accentColor: string;
  isQueueOpen: boolean;
  recallWindowDays: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface ClinicConfigInput {
  clinicTagline?: string;
  logoUrl?: string | null;
  accentColor?: string;
  isQueueOpen?: boolean;
  recallWindowDays?: number;
}

export interface ClinicDoctor {
  id: string;
  businessId: string;
  doctorName: string;
  specialty: string;
  cabinLabel: string;
  consultationFeePaise: number;
  avgConsultMinutes: number;
  extraDelayMinutes: number;
  commissionPercent: number;
  isAvailable: boolean;
  createdAt: string;
}

export interface ClinicDoctorInput {
  id?: string;
  doctorName: string;
  specialty: string;
  cabinLabel: string;
  consultationFeePaise: number;
  avgConsultMinutes: number;
  commissionPercent: number;
  isAvailable?: boolean;
}

export interface ClinicDoctorLiveCard extends ClinicDoctor {
  waitingCount: number;
  inConsultationTokenNumber: string | null;
  inConsultationPatientName: string | null;
  estimatedWaitMinutes: number;
}

export interface ClinicPatient {
  id: string;
  businessId: string;
  patientCode: string;
  fullName: string;
  phone: string;
  age: number | null;
  gender: ClinicPatientGender | null;
  bloodGroup: string | null;
  allergies: string | null;
  activePackageName: string | null;
  packageSessionsTotal: number;
  packageSessionsRemaining: number;
  totalBilledPaise: number;
  amountPaidPaise: number;
  balanceDuePaise: number;
  nextFollowupDate: string | null;
  followupReason: string | null;
  totalVisits: number;
  createdAt: string;
  updatedAt: string;
}

export interface ClinicRecallEntry extends ClinicPatient {
  daysUntilFollowup: number;
}

export interface ClinicVitals {
  bp?: string;
  pulse?: string;
  tempF?: string;
  weightKg?: string;
}

export interface ClinicPrescriptionItem {
  medicineName: string;
  dosage: string;
  days: number;
  instruction?: string;
}

export interface ClinicVisitAndQueue {
  id: string;
  businessId: string;
  patientId: string;
  patientCode?: string;
  patientName?: string;
  patientPhone?: string;
  patientAge?: number | null;
  patientGender?: ClinicPatientGender | null;
  patientAllergies?: string | null;
  patientPackageName?: string | null;
  patientPackageRemaining?: number;
  patientPackageTotal?: number;
  doctorId: string | null;
  doctorName?: string | null;
  doctorSpecialty?: string | null;
  cabinLabel?: string | null;
  visitDate: string;
  tokenNumber: string;
  visitType: ClinicVisitType;
  scheduledSlot: string | null;
  chiefComplaint: string | null;
  status: ClinicVisitStatus;
  vitalsJson: ClinicVitals;
  diagnosisNotes: string | null;
  prescriptionItems: ClinicPrescriptionItem[];
  rxAttachmentUrl: string | null;
  feeChargedPaise: number;
  amountCollectedPaise: number;
  paymentMethod: ClinicPaymentMethod | null;
  doctorCommissionPaise: number;
  patientsAhead?: number;
  estimatedWaitMinutes?: number;
  checkedInAt: string;
  completedAt: string | null;
}

export interface ClinicDoctorCommissionRow {
  doctorId: string;
  doctorName: string;
  specialty: string;
  cabinLabel: string;
  commissionPercent: number;
  consultationsToday: number;
  grossFeesTodayPaise: number;
  commissionTodayPaise: number;
  consultationsThisMonth: number;
  grossFeesThisMonthPaise: number;
  commissionThisMonthPaise: number;
}

export interface ClinicDashboardKpis {
  patientsInQueueNow: number;
  patientsTodayTotal: number;
  completedTodayCount: number;
  todayRevenuePaise: number;
  todayConsultationRevenuePaise: number;
  todayProceduresRevenuePaise: number;
  recallsDueCount: number;
  pendingBalanceDuePaise: number;
  totalDoctorCommissionsTodayPaise: number;
}

export interface ClinicOwnerDashboardPayload {
  config: ClinicConfig;
  kpis: ClinicDashboardKpis;
  doctors: ClinicDoctorLiveCard[];
  activeQueue: ClinicVisitAndQueue[];
  todayCompletedVisits: ClinicVisitAndQueue[];
  recallRadarPatients: ClinicRecallEntry[];
  balanceDuePatients: ClinicPatient[];
  patients: ClinicPatient[];
  recentPrescriptions: ClinicVisitAndQueue[];
  doctorCommissionSummary: ClinicDoctorCommissionRow[];
}

export interface PublicClinicHubPayload {
  business: {
    id: string;
    name: string;
    slug: string;
    city: string;
    category: BusinessCategory;
    googleReviewUrl: string;
  };
  config: ClinicConfig;
  doctors: ClinicDoctorLiveCard[];
  patient: ClinicPatient | null;
  activeVisit: (ClinicVisitAndQueue & {
    patientsAhead: number;
    estimatedWaitMinutes: number;
  }) | null;
  visitHistory: ClinicVisitAndQueue[];
}

export interface CheckinClinicTokenInput {
  businessSlug: string;
  fullName: string;
  phone: string;
  doctorId?: string | null;
  visitType?: ClinicVisitType;
  chiefComplaint?: string | null;
  age?: number | null;
  gender?: ClinicPatientGender | null;
  bloodGroup?: string | null;
  allergies?: string | null;
  scheduledSlot?: string | null;
}

export interface CheckinClinicTokenResult {
  tokenNumber: string;
  patientsAhead: number;
  estimatedWaitMinutes: number;
  visitId: string;
  patientId: string;
  patientCode: string;
  doctorName: string | null;
  cabinLabel: string | null;
  status: ClinicVisitStatus;
}

export interface CompleteClinicConsultationInput {
  businessId: string;
  visitId: string;
  diagnosisNotes?: string | null;
  prescriptionItems: ClinicPrescriptionItem[];
  rxAttachmentUrl?: string | null;
  feeChargedPaise: number;
  amountCollectedPaise: number;
  paymentMethod: ClinicPaymentMethod;
  deductPackageSession: boolean;
  nextFollowupDate?: string | null;
  followupReason?: string | null;
}

export interface CompleteClinicConsultationResult {
  visit: ClinicVisitAndQueue;
  patient: ClinicPatient;
}

export interface AssignClinicPackageInput {
  businessId: string;
  patientId: string;
  packageName: string;
  sessionsTotal: number;
  packageFeePaise: number;
  amountPaidNowPaise: number;
  nextFollowupDate?: string | null;
  followupReason?: string | null;
}
