import type { BusinessCategory } from './business';

export type IndustryWorkspaceType = 'restaurant' | 'cafe' | 'barber' | 'gym';

export type GymMemberStatus =
  | 'pending_approval'
  | 'active'
  | 'expired'
  | 'suspended'
  | 'rejected';

export type GymEffectiveMemberStatus =
  | GymMemberStatus
  | 'expiring_soon'
  | 'frozen';

export type GymOwnerMemberAction = 'approve' | 'renew' | 'reject' | 'suspend';

export type GymPaymentMethod = 'cash' | 'upi';

export type GymFreezeAction = 'freeze' | 'resume';

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
  isPtSession?: boolean;
  trainerId?: string | null;
}

export interface GymPaymentLog {
  id: string;
  businessId: string;
  memberId: string;
  paymentType: 'approval' | 'renewal' | 'balance_due';
  paymentMethod?: GymPaymentMethod;
  planId: string;
  planName: string;
  durationDays: number;
  amountPaise: number;
  ptTrainerId?: string | null;
  ptFeePaise?: number;
  paidDate: string;
  recordedByLabel: string;
  createdAt: string;
}

export interface GymTrainer {
  id: string;
  businessId: string;
  trainerName: string;
  specialty: string;
  commissionPercent: number;
  isActive: boolean;
  createdAt: string;
}

export interface GymTrainerInput {
  trainerName: string;
  specialty?: string;
  commissionPercent: number;
  isActive?: boolean;
}

export interface GymTrainerCommissionRow extends GymTrainer {
  activePtClients: number;
  ptSessionsDeliveredThisMonth: number;
  ptPackageRevenuePaise: number;
  commissionPayoutPaise: number;
}

export interface GymBodyMeasurement {
  id: string;
  businessId: string;
  memberId: string;
  recordedDate: string;
  weightKg: number;
  waistInches: number | null;
  chestInches: number | null;
  bicepsInches: number | null;
  bmi: number | null;
  note: string | null;
  createdAt: string;
}

export interface GymBodyMeasurementInput {
  businessSlug: string;
  phone: string;
  weightKg: number;
  waistInches?: number | null;
  chestInches?: number | null;
  bicepsInches?: number | null;
  heightCm?: number | null;
  bmi?: number | null;
  note?: string | null;
}

export interface GymLeaderboardEntry {
  rank: number;
  memberCode: string;
  displayName: string;
  workoutsThisMonth: number;
  currentStreakDays: number;
  bestStreakDays: number;
}

export interface GymRetailProduct {
  id: string;
  businessId: string;
  productName: string;
  pricePaise: number;
  stockQty: number;
  isActive: boolean;
}

export interface GymRetailProductInput {
  productName: string;
  pricePaise: number;
  stockQty?: number;
}

export interface GymRetailSale {
  id: string;
  businessId: string;
  productId: string | null;
  productName: string;
  quantity: number;
  totalPaise: number;
  paymentMethod: GymPaymentMethod;
  memberName: string | null;
  soldAt: string;
}

export type GymMuscleGroup =
  | 'chest'
  | 'back'
  | 'shoulders'
  | 'biceps'
  | 'triceps'
  | 'quads'
  | 'hamstrings'
  | 'glutes'
  | 'calves'
  | 'core';

export type GymEquipmentType =
  | 'barbell'
  | 'dumbbell'
  | 'cable'
  | 'machine'
  | 'bodyweight';

export type GymSetType = 'warmup' | 'working' | 'drop';

export interface GymWorkoutSetLog {
  setNumber: number;
  weightKg: number;
  reps: number;
  setType: GymSetType;
  rpe?: number | null; // 6..10 effort rating (RPE)
  completed: boolean;
}

export interface GymWorkoutExerciseLog {
  exerciseId: string;
  exerciseName: string;
  primaryMuscle: GymMuscleGroup;
  equipment: GymEquipmentType;
  restSeconds: number;
  sets: GymWorkoutSetLog[];
}

export interface GymWorkoutSession {
  id: string;
  businessId: string;
  memberId: string;
  sessionDate: string;
  planId: string;
  routineName: string;
  workoutFocus: GymWorkoutFocus;
  durationMinutes: number;
  totalVolumeKg: number;
  totalSets: number;
  prsHitCount: number;
  musclesTrained: GymMuscleGroup[];
  exercises: GymWorkoutExerciseLog[];
  createdAt: string;
}

export interface LogGymWorkoutSessionInput {
  businessSlug: string;
  phone: string;
  planId: string;
  routineName: string;
  workoutFocus: GymWorkoutFocus;
  durationMinutes: number;
  totalVolumeKg: number;
  totalSets: number;
  prsHitCount: number;
  musclesTrained: GymMuscleGroup[];
  exercises: GymWorkoutExerciseLog[];
}

export type GymCatalogMuscleGroup =
  | 'chest'
  | 'back'
  | 'legs'
  | 'shoulders'
  | 'arms'
  | 'core'
  | 'cardio'
  | 'full_body';

export type GymCatalogEquipment =
  | 'barbell'
  | 'dumbbell'
  | 'machine'
  | 'cable'
  | 'bodyweight'
  | 'cardio_machine';

export interface GymCatalogExercise {
  id: string;
  businessId: string | null;
  name: string;
  muscleGroup: GymCatalogMuscleGroup;
  equipment: GymCatalogEquipment;
  defaultSets: number;
  defaultReps: string;
  restSeconds: number;
}

export interface GymCatalogExerciseInput {
  name: string;
  muscleGroup: GymCatalogMuscleGroup;
  equipment: GymCatalogEquipment;
  defaultSets?: number;
  defaultReps?: string;
  restSeconds?: number;
}

export interface GymRoutineExerciseItem {
  exerciseId?: string | null;
  name: string;
  muscleGroup: GymCatalogMuscleGroup;
  dayLabel: string;
  sets: number;
  reps: string;
  restSeconds: number;
}

export interface GymWorkoutRoutine {
  id: string;
  businessId: string;
  routineName: string;
  targetGoal: string;
  exercises: GymRoutineExerciseItem[];
  createdBy?: string | null;
  createdAt: string;
}

export interface GymWorkoutSetRecord {
  id: string;
  businessId: string;
  memberId: string;
  exerciseId: string | null;
  exerciseName: string;
  muscleGroup: GymCatalogMuscleGroup;
  workoutDate: string;
  setNumber: number;
  weightKg: number;
  reps: number;
  estimated1rmKg: number;
  isPersonalRecord: boolean;
  loggedAt: string;
}

export interface GymPersonalRecordRow {
  exerciseName: string;
  muscleGroup: GymCatalogMuscleGroup;
  bestWeightKg: number;
  best1rmKg: number;
  lastDate: string;
}

export interface GymMemberWorkoutPlanPayload {
  assignedRoutine: GymWorkoutRoutine | null;
  exerciseCatalog: GymCatalogExercise[];
  todaySets: GymWorkoutSetRecord[];
  personalRecords: GymPersonalRecordRow[];
  weeklyVolumeKg: number;
}

export interface GymLogSetResult {
  setLog: GymWorkoutSetRecord;
  isPersonalRecord: boolean;
  totalVolumeTodayKg: number;
}

export interface GymMemberWorkoutSummaryPayload {
  memberId: string;
  assignedRoutineId: string | null;
  totalVolumeKg: number;
  personalRecords: GymPersonalRecordRow[];
  recentSets: GymWorkoutSetRecord[];
}

export interface GymWeeklyRevenueBucket {
  weekIndex: number;
  label: string;
  thisMonthPaise: number;
  lastMonthPaise: number;
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
  totalPlanAmountPaise?: number;
  amountPaidPaise?: number;
  balanceDuePaise?: number;
  balanceDueDate?: string | null;
  ptTrainerId?: string | null;
  ptTrainerName?: string | null;
  ptPackageName?: string | null;
  ptPackageFeePaise?: number;
  ptTotalSessions?: number;
  ptRemainingSessions?: number;
  isFrozen?: boolean;
  frozenStartedAt?: string | null;
  totalFrozenDays?: number;
  currentStreakDays?: number;
  bestStreakDays?: number;
  assignedRoutineId?: string | null;
  assignedRoutineName?: string | null;
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
  bodyMeasurements?: GymBodyMeasurement[];
  recentWorkouts?: GymWorkoutSession[];
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
  currentStreakDays?: number;
  bestStreakDays?: number;
  ptRemainingSessions?: number;
  isPtSession?: boolean;
  trainerId?: string | null;
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
  bodyMeasurements?: GymBodyMeasurement[];
  recentWorkouts?: GymWorkoutSession[];
}

export interface GymOwnerDashboardPayload {
  config: GymConfig;
  monthKey: string;
  members: GymMember[];
  checkedInTodayCount: number;
  todaysAttendance: GymTodayAttendanceEntry[];
  monthlyRevenuePaise: number;
  membershipRevenuePaise?: number;
  retailRevenuePaise?: number;
  projectedNextMonthRevenuePaise: number;
  totalBalanceDuePaise?: number;
  balanceDueMembersCount?: number;
  weeklyRevenueComparison?: GymWeeklyRevenueBucket[];
  inactiveAlertMembers: GymInactiveAlertMember[];
  trainers?: GymTrainerCommissionRow[];
  retailProducts?: GymRetailProduct[];
  recentRetailSales?: GymRetailSale[];
  monthlyLeaderboard?: GymLeaderboardEntry[];
  routines?: GymWorkoutRoutine[];
  exerciseCatalog?: GymCatalogExercise[];
}
