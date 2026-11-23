import type { BusinessCategory } from './business';

export type IndustryWorkspaceType = 'restaurant' | 'cafe' | 'barber' | 'gym';

export type GymMemberStatus =
  | 'pending_approval'
  | 'active'
  | 'expired'
  | 'suspended'
  | 'rejected';

export type GymEffectiveMemberStatus = GymMemberStatus | 'expiring_soon';

export type GymOwnerMemberAction = 'approve' | 'renew' | 'reject' | 'suspend';

export type GymFitnessGoal =
  | 'weight_loss'
  | 'muscle_gain'
  | 'weight_gain'
  | 'cardio_endurance'
  | 'general_fitness';

export type GymWorkoutFocus =
  | 'chest'
  | 'back'
  | 'legs'
  | 'shoulders_arms'
  | 'cardio_hiit'
  | 'abs_core'
  | 'full_body';

export interface GymPlan {
  id: string;
  name: string;
  durationDays: number;
  pricePaise: number;
  badge?: string;
}

export interface GymConfig {
  businessId: string;
  isRegistrationOpen: boolean;
  renewalAlertDays: number;
  plans: GymPlan[];
  createdAt?: string;
  updatedAt?: string;
}

export interface GymConfigInput {
  isRegistrationOpen: boolean;
  renewalAlertDays?: number;
  plans?: GymPlan[];
}

export interface GymAttendanceLog {
  id: string;
  businessId: string;
  memberId: string;
  checkInDate: string;
  checkedInAt: string;
  workoutFocus: GymWorkoutFocus;
  memberNote?: string | null;
}

export interface GymPaymentLog {
  id: string;
  businessId: string;
  memberId: string;
  paymentType: 'approval' | 'renewal';
  planId: string;
  planName: string;
  durationDays: number;
  amountPaise: number;
  paidDate: string;
  recordedByLabel: string;
  createdAt: string;
}

export interface GymMember {
  id: string;
  businessId: string;
  memberCode: string;
  fullName: string;
  phone: string;
  planId: string;
  planName: string;
  durationDays: number;
  feePaise: number;
  fitnessGoal?: GymFitnessGoal;
  startingWeightKg?: number | null;
  targetWeightKg?: number | null;
  trainerNotes?: string | null;
  status: GymMemberStatus;
  effectiveStatus: GymEffectiveMemberStatus;
  daysRemaining: number;
  startDate: string | null;
  endDate: string | null;
  totalCheckIns: number;
  daysAttendedThisMonth?: number;
  lastCheckInDate: string | null;
  lastCheckInAt?: string | null;
  checkedInToday: boolean;
  todayWorkoutFocus?: GymWorkoutFocus | null;
  todayCheckedInAt?: string | null;
  todayCheckIn?: GymAttendanceLog | null;
  recentAttendanceLogs?: GymAttendanceLog[];
  approvedByLabel?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface GymTodayAttendanceEntry {
  id: string;
  memberId: string;
  memberCode: string;
  fullName: string;
  phone: string;
  fitnessGoal: GymFitnessGoal;
  checkInDate: string;
  checkedInAt: string;
  workoutFocus: GymWorkoutFocus;
  memberNote?: string | null;
  daysAttendedThisMonth: number;
  totalCheckIns: number;
}

export interface GymInactiveAlertMember {
  memberId: string;
  memberCode: string;
  fullName: string;
  phone: string;
  fitnessGoal: GymFitnessGoal;
  daysSinceLastCheckIn: number;
  lastCheckInDate: string | null;
  daysRemaining: number;
}

export interface PublicGymPortalPayload {
  business: {
    id: string;
    slug: string;
    name: string;
    category: BusinessCategory;
    city: string;
    googleReviewUrl: string;
  };
  config: GymConfig;
  activeMembersCount: number;
  checkedInTodayCount: number;
}

export interface SubmitGymRegistrationInput {
  businessSlug: string;
  fullName: string;
  phone: string;
  planId: string;
  fitnessGoal?: GymFitnessGoal;
  startingWeightKg?: number | null;
  targetWeightKg?: number | null;
}

export interface GymDailyCheckInResult {
  memberId: string;
  memberCode: string;
  fullName: string;
  alreadyCheckedInToday: boolean;
  totalCheckIns: number;
  daysAttendedThisMonth: number;
  daysRemaining: number;
  checkedInDate: string;
  checkedInAt: string;
  workoutFocus: GymWorkoutFocus;
  memberNote?: string | null;
  todayLog: GymAttendanceLog;
}

export interface GymMemberProgressHistory {
  member: GymMember;
  monthKey: string;
  daysAttendedThisMonth: number;
  attendanceLogs: GymAttendanceLog[];
  workoutSplitCounts: Partial<Record<GymWorkoutFocus, number>>;
}

export interface GymOwnerDashboardPayload {
  config: GymConfig;
  monthKey: string;
  members: GymMember[];
  checkedInTodayCount: number;
  todaysAttendance: GymTodayAttendanceEntry[];
  monthlyRevenuePaise: number;
  projectedNextMonthRevenuePaise: number;
  inactiveAlertMembers: GymInactiveAlertMember[];
}
