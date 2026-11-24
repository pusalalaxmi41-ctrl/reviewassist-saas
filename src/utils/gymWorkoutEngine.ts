import type {
  GymAnimationKey,
  GymBodyMeasurement,
  GymCatalogExercise,
  GymEquipmentType,
  GymFitnessGoal,
  GymMuscleGroup,
  GymNutritionMeal,
  GymRoutineExerciseItem,
  GymWeeklyScheduleDay,
  GymWorkoutExerciseLog,
  GymWorkoutFocus,
  GymWorkoutSession,
} from '../types/gym';
import { getTodayIsoDateKey } from './gymValidation';

export interface GymExerciseDefinition {
  id: string;
  name: string;
  primaryMuscle: GymMuscleGroup;
  secondaryMuscles: GymMuscleGroup[];
  equipment: GymEquipmentType;
  defaultSets: number;
  defaultReps: number;
  defaultRestSec: number;
  isBodyweight?: boolean;
  backupIds: string[];
}

export interface GymRoutineDayTemplate {
  id: string;
  code: string; // e.g., 'A', 'B', 'C' or 'Push', 'Pull', 'Legs'
  name: string;
  workoutFocus: GymWorkoutFocus;
  targetMuscles: GymMuscleGroup[];
  exerciseIds: string[];
}

export interface GymStarterPlan {
  id: string;
  name: string;
  subtitle: string;
  daysPerWeek: number;
  mode: 'rotation' | 'weekday';
  routines: GymRoutineDayTemplate[];
}

export const GYM_MUSCLE_LABELS: Record<GymMuscleGroup, string> = {
  chest: 'Chest',
  back: 'Back',
  shoulders: 'Shoulders',
  biceps: 'Biceps',
  triceps: 'Triceps',
  quads: 'Quads',
  hamstrings: 'Hamstrings',
  glutes: 'Glutes',
  calves: 'Calves',
  core: 'Abs & Core',
};

export const GYM_RPE_OPTIONS: ReadonlyArray<{
  rpe: number;
  rir: number;
  label: string;
  colorClass: string;
}> = [
  {
    rpe: 6,
    rir: 4,
    label: 'Easy (4 reps left)',
    colorClass: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
  },
  {
    rpe: 7,
    rir: 3,
    label: 'Moderate (3 reps left)',
    colorClass: 'bg-sky-500/20 text-sky-300 border-sky-500/40',
  },
  {
    rpe: 8,
    rir: 2,
    label: 'Hard (2 reps left)',
    colorClass: 'bg-[#C8F135]/20 text-[#C8F135] border-[#C8F135]/40',
  },
  {
    rpe: 9,
    rir: 1,
    label: 'Very Hard (1 rep left)',
    colorClass: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
  },
  {
    rpe: 10,
    rir: 0,
    label: 'Max Effort (Failure)',
    colorClass: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
  },
];

export const GYM_EXERCISE_LIBRARY: ReadonlyArray<GymExerciseDefinition> = [
  // Chest
  {
    id: 'barbell_bench_press',
    name: 'Barbell Bench Press',
    primaryMuscle: 'chest',
    secondaryMuscles: ['triceps', 'shoulders'],
    equipment: 'barbell',
    defaultSets: 4,
    defaultReps: 8,
    defaultRestSec: 120,
    backupIds: ['db_bench_press', 'machine_chest_press'],
  },
  {
    id: 'incline_db_press',
    name: 'Incline Dumbbell Press',
    primaryMuscle: 'chest',
    secondaryMuscles: ['shoulders', 'triceps'],
    equipment: 'dumbbell',
    defaultSets: 3,
    defaultReps: 10,
    defaultRestSec: 90,
    backupIds: ['machine_chest_press', 'barbell_bench_press'],
  },
  {
    id: 'db_bench_press',
    name: 'Flat Dumbbell Press',
    primaryMuscle: 'chest',
    secondaryMuscles: ['triceps', 'shoulders'],
    equipment: 'dumbbell',
    defaultSets: 3,
    defaultReps: 10,
    defaultRestSec: 90,
    backupIds: ['machine_chest_press', 'barbell_bench_press'],
  },
  {
    id: 'machine_chest_press',
    name: 'Chest Press Machine',
    primaryMuscle: 'chest',
    secondaryMuscles: ['triceps'],
    equipment: 'machine',
    defaultSets: 3,
    defaultReps: 12,
    defaultRestSec: 90,
    backupIds: ['db_bench_press', 'cable_chest_fly'],
  },
  {
    id: 'cable_chest_fly',
    name: 'Cable Chest Fly',
    primaryMuscle: 'chest',
    secondaryMuscles: ['shoulders'],
    equipment: 'cable',
    defaultSets: 3,
    defaultReps: 12,
    defaultRestSec: 60,
    backupIds: ['pec_deck_fly', 'push_ups'],
  },
  {
    id: 'pec_deck_fly',
    name: 'Pec Deck Machine Fly',
    primaryMuscle: 'chest',
    secondaryMuscles: [],
    equipment: 'machine',
    defaultSets: 3,
    defaultReps: 15,
    defaultRestSec: 60,
    backupIds: ['cable_chest_fly', 'push_ups'],
  },
  {
    id: 'push_ups',
    name: 'Weighted / Classic Push-Ups',
    primaryMuscle: 'chest',
    secondaryMuscles: ['triceps', 'core'],
    equipment: 'bodyweight',
    defaultSets: 3,
    defaultReps: 15,
    defaultRestSec: 60,
    isBodyweight: true,
    backupIds: ['machine_chest_press', 'db_bench_press'],
  },

  // Back
  {
    id: 'barbell_deadlift',
    name: 'Barbell Deadlift',
    primaryMuscle: 'back',
    secondaryMuscles: ['hamstrings', 'glutes', 'core'],
    equipment: 'barbell',
    defaultSets: 3,
    defaultReps: 5,
    defaultRestSec: 180,
    backupIds: ['romanian_deadlift', 'barbell_row'],
  },
  {
    id: 'lat_pulldown',
    name: 'Wide-Grip Lat Pulldown',
    primaryMuscle: 'back',
    secondaryMuscles: ['biceps'],
    equipment: 'cable',
    defaultSets: 4,
    defaultReps: 10,
    defaultRestSec: 90,
    backupIds: ['pull_ups', 'seated_cable_row'],
  },
  {
    id: 'pull_ups',
    name: 'Pull-Ups (Bodyweight / Assisted)',
    primaryMuscle: 'back',
    secondaryMuscles: ['biceps', 'core'],
    equipment: 'bodyweight',
    defaultSets: 3,
    defaultReps: 8,
    defaultRestSec: 120,
    isBodyweight: true,
    backupIds: ['lat_pulldown', 'seated_cable_row'],
  },
  {
    id: 'barbell_row',
    name: 'Bent-Over Barbell Row',
    primaryMuscle: 'back',
    secondaryMuscles: ['biceps', 'core'],
    equipment: 'barbell',
    defaultSets: 4,
    defaultReps: 8,
    defaultRestSec: 120,
    backupIds: ['seated_cable_row', 'one_arm_db_row'],
  },
  {
    id: 'seated_cable_row',
    name: 'Seated Cable Row',
    primaryMuscle: 'back',
    secondaryMuscles: ['biceps'],
    equipment: 'cable',
    defaultSets: 3,
    defaultReps: 12,
    defaultRestSec: 90,
    backupIds: ['one_arm_db_row', 'barbell_row'],
  },
  {
    id: 'one_arm_db_row',
    name: 'Single-Arm Dumbbell Row',
    primaryMuscle: 'back',
    secondaryMuscles: ['biceps'],
    equipment: 'dumbbell',
    defaultSets: 3,
    defaultReps: 10,
    defaultRestSec: 75,
    backupIds: ['seated_cable_row', 'barbell_row'],
  },
  {
    id: 'face_pulls',
    name: 'Cable Face Pulls',
    primaryMuscle: 'back',
    secondaryMuscles: ['shoulders'],
    equipment: 'cable',
    defaultSets: 3,
    defaultReps: 15,
    defaultRestSec: 60,
    backupIds: ['rear_delt_fly', 'seated_cable_row'],
  },

  // Shoulders
  {
    id: 'overhead_barbell_press',
    name: 'Overhead Barbell Press (OHP)',
    primaryMuscle: 'shoulders',
    secondaryMuscles: ['triceps', 'core'],
    equipment: 'barbell',
    defaultSets: 4,
    defaultReps: 6,
    defaultRestSec: 120,
    backupIds: ['db_shoulder_press', 'machine_shoulder_press'],
  },
  {
    id: 'db_shoulder_press',
    name: 'Seated Dumbbell Shoulder Press',
    primaryMuscle: 'shoulders',
    secondaryMuscles: ['triceps'],
    equipment: 'dumbbell',
    defaultSets: 3,
    defaultReps: 10,
    defaultRestSec: 90,
    backupIds: ['machine_shoulder_press', 'overhead_barbell_press'],
  },
  {
    id: 'machine_shoulder_press',
    name: 'Machine Shoulder Press',
    primaryMuscle: 'shoulders',
    secondaryMuscles: ['triceps'],
    equipment: 'machine',
    defaultSets: 3,
    defaultReps: 12,
    defaultRestSec: 90,
    backupIds: ['db_shoulder_press', 'lateral_raises'],
  },
  {
    id: 'lateral_raises',
    name: 'Dumbbell Lateral Raises',
    primaryMuscle: 'shoulders',
    secondaryMuscles: [],
    equipment: 'dumbbell',
    defaultSets: 4,
    defaultReps: 15,
    defaultRestSec: 60,
    backupIds: ['cable_lateral_raise', 'machine_shoulder_press'],
  },
  {
    id: 'cable_lateral_raise',
    name: 'Cable Lateral Raise',
    primaryMuscle: 'shoulders',
    secondaryMuscles: [],
    equipment: 'cable',
    defaultSets: 3,
    defaultReps: 15,
    defaultRestSec: 60,
    backupIds: ['lateral_raises'],
  },
  {
    id: 'rear_delt_fly',
    name: 'Reverse Pec Deck / Rear Delt Fly',
    primaryMuscle: 'shoulders',
    secondaryMuscles: ['back'],
    equipment: 'machine',
    defaultSets: 3,
    defaultReps: 15,
    defaultRestSec: 60,
    backupIds: ['face_pulls'],
  },

  // Biceps & Triceps
  {
    id: 'ez_bar_curl',
    name: 'EZ-Bar Bicep Curl',
    primaryMuscle: 'biceps',
    secondaryMuscles: [],
    equipment: 'barbell',
    defaultSets: 3,
    defaultReps: 12,
    defaultRestSec: 60,
    backupIds: ['db_hammer_curl', 'cable_bicep_curl'],
  },
  {
    id: 'db_hammer_curl',
    name: 'Dumbbell Hammer Curl',
    primaryMuscle: 'biceps',
    secondaryMuscles: [],
    equipment: 'dumbbell',
    defaultSets: 3,
    defaultReps: 12,
    defaultRestSec: 60,
    backupIds: ['ez_bar_curl', 'cable_bicep_curl'],
  },
  {
    id: 'cable_bicep_curl',
    name: 'Cable Rope / Bar Curl',
    primaryMuscle: 'biceps',
    secondaryMuscles: [],
    equipment: 'cable',
    defaultSets: 3,
    defaultReps: 12,
    defaultRestSec: 60,
    backupIds: ['ez_bar_curl', 'db_hammer_curl'],
  },
  {
    id: 'tricep_rope_pushdown',
    name: 'Tricep Rope Pushdown',
    primaryMuscle: 'triceps',
    secondaryMuscles: [],
    equipment: 'cable',
    defaultSets: 3,
    defaultReps: 12,
    defaultRestSec: 60,
    backupIds: ['overhead_tricep_ext', 'tricep_dips'],
  },
  {
    id: 'overhead_tricep_ext',
    name: 'Overhead Cable / DB Tricep Extension',
    primaryMuscle: 'triceps',
    secondaryMuscles: [],
    equipment: 'cable',
    defaultSets: 3,
    defaultReps: 12,
    defaultRestSec: 60,
    backupIds: ['tricep_rope_pushdown', 'tricep_dips'],
  },
  {
    id: 'tricep_dips',
    name: 'Parallel Bar Dips',
    primaryMuscle: 'triceps',
    secondaryMuscles: ['chest', 'shoulders'],
    equipment: 'bodyweight',
    defaultSets: 3,
    defaultReps: 10,
    defaultRestSec: 90,
    isBodyweight: true,
    backupIds: ['tricep_rope_pushdown', 'overhead_tricep_ext'],
  },

  // Legs (Quads, Hamstrings, Glutes, Calves)
  {
    id: 'barbell_back_squat',
    name: 'Barbell Back Squat',
    primaryMuscle: 'quads',
    secondaryMuscles: ['glutes', 'hamstrings', 'core'],
    equipment: 'barbell',
    defaultSets: 4,
    defaultReps: 6,
    defaultRestSec: 150,
    backupIds: ['leg_press', 'goblet_squat'],
  },
  {
    id: 'leg_press',
    name: '45° Leg Press Machine',
    primaryMuscle: 'quads',
    secondaryMuscles: ['glutes'],
    equipment: 'machine',
    defaultSets: 4,
    defaultReps: 10,
    defaultRestSec: 120,
    backupIds: ['barbell_back_squat', 'bulgarian_split_squat'],
  },
  {
    id: 'goblet_squat',
    name: 'Dumbbell Goblet Squat',
    primaryMuscle: 'quads',
    secondaryMuscles: ['glutes', 'core'],
    equipment: 'dumbbell',
    defaultSets: 3,
    defaultReps: 12,
    defaultRestSec: 90,
    backupIds: ['leg_press', 'bulgarian_split_squat'],
  },
  {
    id: 'bulgarian_split_squat',
    name: 'Bulgarian Split Squat',
    primaryMuscle: 'quads',
    secondaryMuscles: ['glutes', 'hamstrings'],
    equipment: 'dumbbell',
    defaultSets: 3,
    defaultReps: 10,
    defaultRestSec: 90,
    backupIds: ['leg_press', 'leg_extension'],
  },
  {
    id: 'leg_extension',
    name: 'Seated Leg Extension',
    primaryMuscle: 'quads',
    secondaryMuscles: [],
    equipment: 'machine',
    defaultSets: 3,
    defaultReps: 15,
    defaultRestSec: 60,
    backupIds: ['goblet_squat', 'bulgarian_split_squat'],
  },
  {
    id: 'romanian_deadlift',
    name: 'Romanian Deadlift (RDL)',
    primaryMuscle: 'hamstrings',
    secondaryMuscles: ['glutes', 'back'],
    equipment: 'barbell',
    defaultSets: 3,
    defaultReps: 10,
    defaultRestSec: 120,
    backupIds: ['lying_leg_curl', 'hip_thrust'],
  },
  {
    id: 'lying_leg_curl',
    name: 'Lying / Seated Leg Curl',
    primaryMuscle: 'hamstrings',
    secondaryMuscles: [],
    equipment: 'machine',
    defaultSets: 3,
    defaultReps: 12,
    defaultRestSec: 75,
    backupIds: ['romanian_deadlift'],
  },
  {
    id: 'hip_thrust',
    name: 'Barbell Hip Thrust',
    primaryMuscle: 'glutes',
    secondaryMuscles: ['hamstrings'],
    equipment: 'barbell',
    defaultSets: 3,
    defaultReps: 10,
    defaultRestSec: 90,
    backupIds: ['romanian_deadlift', 'bulgarian_split_squat'],
  },
  {
    id: 'standing_calf_raise',
    name: 'Standing Calf Raise',
    primaryMuscle: 'calves',
    secondaryMuscles: [],
    equipment: 'machine',
    defaultSets: 4,
    defaultReps: 15,
    defaultRestSec: 60,
    backupIds: ['leg_press'],
  },

  // Core
  {
    id: 'hanging_leg_raise',
    name: 'Hanging Leg Raises',
    primaryMuscle: 'core',
    secondaryMuscles: [],
    equipment: 'bodyweight',
    defaultSets: 3,
    defaultReps: 12,
    defaultRestSec: 60,
    isBodyweight: true,
    backupIds: ['cable_crunch', 'weighted_plank'],
  },
  {
    id: 'cable_crunch',
    name: 'Kneeling Cable Crunch',
    primaryMuscle: 'core',
    secondaryMuscles: [],
    equipment: 'cable',
    defaultSets: 3,
    defaultReps: 15,
    defaultRestSec: 60,
    backupIds: ['hanging_leg_raise', 'weighted_plank'],
  },
  {
    id: 'weighted_plank',
    name: 'Plank Hold (sec)',
    primaryMuscle: 'core',
    secondaryMuscles: ['shoulders'],
    equipment: 'bodyweight',
    defaultSets: 3,
    defaultReps: 60,
    defaultRestSec: 60,
    isBodyweight: true,
    backupIds: ['cable_crunch', 'hanging_leg_raise'],
  },
];

export const GYM_STARTER_PLANS: ReadonlyArray<GymStarterPlan> = [
  {
    id: 'ppl',
    name: 'Push / Pull / Legs (PPL)',
    subtitle: 'Classic 3-6 day hypertrophy split — rotates A → B → C seamlessly',
    daysPerWeek: 6,
    mode: 'rotation',
    routines: [
      {
        id: 'ppl_push',
        code: 'A · Push',
        name: 'Push Day (Chest, Shoulders & Triceps)',
        workoutFocus: 'chest',
        targetMuscles: ['chest', 'shoulders', 'triceps'],
        exerciseIds: [
          'barbell_bench_press',
          'incline_db_press',
          'db_shoulder_press',
          'lateral_raises',
          'tricep_rope_pushdown',
        ],
      },
      {
        id: 'ppl_pull',
        code: 'B · Pull',
        name: 'Pull Day (Back, Rear Delts & Biceps)',
        workoutFocus: 'back',
        targetMuscles: ['back', 'biceps', 'shoulders'],
        exerciseIds: [
          'lat_pulldown',
          'barbell_row',
          'seated_cable_row',
          'face_pulls',
          'ez_bar_curl',
          'db_hammer_curl',
        ],
      },
      {
        id: 'ppl_legs',
        code: 'C · Legs',
        name: 'Leg & Core Day (Quads, Hams & Glutes)',
        workoutFocus: 'legs',
        targetMuscles: ['quads', 'hamstrings', 'glutes', 'calves', 'core'],
        exerciseIds: [
          'barbell_back_squat',
          'romanian_deadlift',
          'leg_press',
          'lying_leg_curl',
          'standing_calf_raise',
          'hanging_leg_raise',
        ],
      },
    ],
  },
  {
    id: 'upper_lower',
    name: 'Upper / Lower (4-Day)',
    subtitle: 'Balanced 4-day strength & muscle builder with high recovery',
    daysPerWeek: 4,
    mode: 'rotation',
    routines: [
      {
        id: 'ul_upper_a',
        code: 'A · Upper',
        name: 'Upper Body Power',
        workoutFocus: 'chest',
        targetMuscles: ['chest', 'back', 'shoulders', 'biceps', 'triceps'],
        exerciseIds: [
          'barbell_bench_press',
          'barbell_row',
          'overhead_barbell_press',
          'lat_pulldown',
          'ez_bar_curl',
          'tricep_rope_pushdown',
        ],
      },
      {
        id: 'ul_lower_a',
        code: 'B · Lower',
        name: 'Lower Body Strength',
        workoutFocus: 'legs',
        targetMuscles: ['quads', 'hamstrings', 'glutes', 'calves', 'core'],
        exerciseIds: [
          'barbell_back_squat',
          'romanian_deadlift',
          'bulgarian_split_squat',
          'leg_extension',
          'standing_calf_raise',
          'cable_crunch',
        ],
      },
    ],
  },
  {
    id: 'full_body',
    name: 'Full Body (3-Day)',
    subtitle: 'Maximum results in 3 sessions/week — ideal for busy schedules',
    daysPerWeek: 3,
    mode: 'rotation',
    routines: [
      {
        id: 'fb_a',
        code: 'A · Full',
        name: 'Full Body A (Squat + Bench + Row)',
        workoutFocus: 'full_body',
        targetMuscles: ['quads', 'chest', 'back', 'shoulders', 'core'],
        exerciseIds: [
          'barbell_back_squat',
          'barbell_bench_press',
          'seated_cable_row',
          'lateral_raises',
          'cable_crunch',
        ],
      },
      {
        id: 'fb_b',
        code: 'B · Full',
        name: 'Full Body B (Deadlift + OHP + Pulldown)',
        workoutFocus: 'full_body',
        targetMuscles: ['back', 'hamstrings', 'shoulders', 'biceps', 'triceps'],
        exerciseIds: [
          'barbell_deadlift',
          'overhead_barbell_press',
          'lat_pulldown',
          'db_bench_press',
          'db_hammer_curl',
        ],
      },
    ],
  },
  {
    id: 'strength_5x5',
    name: 'Strength 5×5 (Barbell LP)',
    subtitle: 'Classic compound linear progression — add 2.5 kg every clean session',
    daysPerWeek: 3,
    mode: 'rotation',
    routines: [
      {
        id: 's55_a',
        code: 'Workout A',
        name: '5×5 A (Squat · Bench · Row)',
        workoutFocus: 'full_body',
        targetMuscles: ['quads', 'glutes', 'chest', 'back', 'triceps'],
        exerciseIds: ['barbell_back_squat', 'barbell_bench_press', 'barbell_row'],
      },
      {
        id: 's55_b',
        code: 'Workout B',
        name: '5×5 B (Squat · OHP · Deadlift)',
        workoutFocus: 'full_body',
        targetMuscles: ['quads', 'shoulders', 'back', 'hamstrings', 'core'],
        exerciseIds: [
          'barbell_back_squat',
          'overhead_barbell_press',
          'barbell_deadlift',
        ],
      },
    ],
  },
];

export function getExerciseById(id: string): GymExerciseDefinition | undefined {
  return GYM_EXERCISE_LIBRARY.find((e) => e.id === id);
}

/** Epley 1-Rep Max estimation formula: weight * (1 + reps / 30). */
export function calculateEpley1RM(weightKg: number, reps: number): number {
  if (!Number.isFinite(weightKg) || weightKg <= 0 || !Number.isFinite(reps) || reps <= 0) {
    return 0;
  }
  if (reps === 1) return Math.round(weightKg * 10) / 10;
  return Math.round(weightKg * (1 + reps / 30) * 10) / 10;
}

/** Computes total lifted volume in kg across completed working/drop sets. */
export function calculateSessionVolumeKg(
  exercises: ReadonlyArray<GymWorkoutExerciseLog>,
): { totalVolumeKg: number; totalSets: number } {
  let vol = 0;
  let sets = 0;
  for (const ex of exercises) {
    for (const s of ex.sets) {
      if (!s.completed) continue;
      sets += 1;
      if (s.weightKg > 0 && s.reps > 0) {
        vol += s.weightKg * s.reps;
      }
    }
  }
  return {
    totalVolumeKg: Math.round(vol * 10) / 10,
    totalSets: sets,
  };
}

/**
 * Barbell Plate Math Calculator (inspired by openGym).
 * Returns exact plates to load on EACH side of the bar using standard metric gym plates.
 */
export function calculateBarbellPlates(
  targetTotalKg: number,
  barWeightKg: 20 | 15 | 10 | 0 = 20,
  availablePlates: readonly number[] = [25, 20, 15, 10, 5, 2.5, 1.25],
): {
  barWeightKg: number;
  perSideKg: number;
  platesPerSide: Array<{ plateKg: number; count: number }>;
  achievedTotalKg: number;
  remainderKg: number;
} {
  if (!Number.isFinite(targetTotalKg) || targetTotalKg <= barWeightKg) {
    return {
      barWeightKg,
      perSideKg: 0,
      platesPerSide: [],
      achievedTotalKg: barWeightKg,
      remainderKg: 0,
    };
  }
  const perSideTarget = (targetTotalKg - barWeightKg) / 2;
  let rem = Math.round(perSideTarget * 100) / 100;
  const platesPerSide: Array<{ plateKg: number; count: number }> = [];
  for (const p of [...availablePlates].sort((a, b) => b - a)) {
    if (p <= 0) continue;
    const count = Math.floor(rem / p + 1e-6);
    if (count > 0) {
      platesPerSide.push({ plateKg: p, count });
      rem = Math.round((rem - count * p) * 100) / 100;
    }
  }
  const loadedPerSide = platesPerSide.reduce(
    (sum, item) => sum + item.plateKg * item.count,
    0,
  );
  const achievedTotalKg = Math.round((barWeightKg + loadedPerSide * 2) * 100) / 100;
  return {
    barWeightKg,
    perSideKg: Math.round(loadedPerSide * 100) / 100,
    platesPerSide,
    achievedTotalKg,
    remainderKg: Math.round((targetTotalKg - achievedTotalKg) * 100) / 100,
  };
}

/** Extracts best estimated 1RM and best lifted weight per exercise from historical sessions. */
export function extractPersonalRecords(
  history: ReadonlyArray<GymWorkoutSession>,
): Map<string, { exerciseName: string; bestWeightKg: number; bestReps: number; bestEst1RM: number; date: string }> {
  const best = new Map<
    string,
    { exerciseName: string; bestWeightKg: number; bestReps: number; bestEst1RM: number; date: string }
  >();
  for (const session of history) {
    for (const ex of session.exercises ?? []) {
      for (const s of ex.sets ?? []) {
        if (!s.completed || s.weightKg <= 0 || s.reps <= 0) continue;
        const est = calculateEpley1RM(s.weightKg, s.reps);
        const curr = best.get(ex.exerciseId);
        if (!curr || est > curr.bestEst1RM) {
          best.set(ex.exerciseId, {
            exerciseName: ex.exerciseName,
            bestWeightKg: s.weightKg,
            bestReps: s.reps,
            bestEst1RM: est,
            date: session.sessionDate,
          });
        }
      }
    }
  }
  return best;
}

/** Detects how many new PRs were achieved in a session compared to prior workout history. */
export function detectSessionPRs(
  currentExercises: ReadonlyArray<GymWorkoutExerciseLog>,
  priorHistory: ReadonlyArray<GymWorkoutSession>,
): Array<{ exerciseId: string; exerciseName: string; newEst1RM: number; weightKg: number; reps: number }> {
  const priorPRs = extractPersonalRecords(priorHistory);
  const hits: Array<{
    exerciseId: string;
    exerciseName: string;
    newEst1RM: number;
    weightKg: number;
    reps: number;
  }> = [];

  for (const ex of currentExercises) {
    let sessionBestEst = 0;
    let sessionBestW = 0;
    let sessionBestR = 0;
    for (const s of ex.sets) {
      if (!s.completed || s.setType === 'warmup' || s.weightKg <= 0 || s.reps <= 0) continue;
      const est = calculateEpley1RM(s.weightKg, s.reps);
      if (est > sessionBestEst) {
        sessionBestEst = est;
        sessionBestW = s.weightKg;
        sessionBestR = s.reps;
      }
    }
    if (sessionBestEst > 0) {
      const prev = priorPRs.get(ex.exerciseId);
      if (!prev || sessionBestEst > prev.bestEst1RM) {
        hits.push({
          exerciseId: ex.exerciseId,
          exerciseName: ex.exerciseName,
          newEst1RM: sessionBestEst,
          weightKg: sessionBestW,
          reps: sessionBestR,
        });
      }
    }
  }
  return hits;
}

/**
 * 3-Mode Muscle Map analyzer (inspired by openGym):
 * - 'volume': sets per muscle over the past 7 days
 * - 'recovering': muscles trained in the last 48 hours (need recovery)
 * - 'untrained': muscles with 0 sets over the past 7 days
 */
export function computeMuscleMapStatus(
  sessions: ReadonlyArray<GymWorkoutSession>,
  now: Date = new Date(),
): Record<
  GymMuscleGroup,
  { setsLast7Days: number; hoursSinceTrained: number | null; status: 'recovering' | 'trained' | 'untrained' }
> {
  const allMuscles: GymMuscleGroup[] = [
    'chest',
    'back',
    'shoulders',
    'biceps',
    'triceps',
    'quads',
    'hamstrings',
    'glutes',
    'calves',
    'core',
  ];
  const result = {} as Record<
    GymMuscleGroup,
    { setsLast7Days: number; hoursSinceTrained: number | null; status: 'recovering' | 'trained' | 'untrained' }
  >;
  for (const m of allMuscles) {
    result[m] = { setsLast7Days: 0, hoursSinceTrained: null, status: 'untrained' };
  }

  const nowMs = now.getTime();
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

  for (const sess of sessions) {
    const ts = new Date(sess.createdAt || `${sess.sessionDate}T12:00:00Z`).getTime();
    if (Number.isNaN(ts)) continue;
    const ageMs = Math.max(0, nowMs - ts);
    const ageHours = Math.round(ageMs / (1000 * 60 * 60));

    const touchedMuscles = new Set<GymMuscleGroup>(sess.musclesTrained ?? []);
    for (const ex of sess.exercises ?? []) {
      const doneSets = ex.sets.filter((s) => s.completed).length;
      if (doneSets > 0 && result[ex.primaryMuscle]) {
        touchedMuscles.add(ex.primaryMuscle);
        if (ageMs <= sevenDaysMs) {
          result[ex.primaryMuscle].setsLast7Days += doneSets;
        }
      }
    }

    for (const m of touchedMuscles) {
      if (!result[m]) continue;
      if (result[m].hoursSinceTrained === null || ageHours < result[m].hoursSinceTrained!) {
        result[m].hoursSinceTrained = ageHours;
      }
      if (ageMs <= sevenDaysMs && result[m].setsLast7Days === 0) {
        result[m].setsLast7Days = 3;
      }
    }
  }

  for (const m of allMuscles) {
    const info = result[m];
    if (info.hoursSinceTrained !== null && info.hoursSinceTrained <= 48) {
      info.status = 'recovering';
    } else if (info.setsLast7Days > 0) {
      info.status = 'trained';
    } else {
      info.status = 'untrained';
    }
  }

  return result;
}

/** Suggests the next routine in A -> B -> C rotation based on last completed workout. */
export function getNextRotationRoutine(
  plan: GymStarterPlan,
  recentWorkouts: ReadonlyArray<GymWorkoutSession>,
): GymRoutineDayTemplate {
  const lastInPlan = recentWorkouts.find((w) => w.planId === plan.id);
  if (!lastInPlan) return plan.routines[0];
  const lastIdx = plan.routines.findIndex(
    (r) => r.name === lastInPlan.routineName || r.workoutFocus === lastInPlan.workoutFocus,
  );
  if (lastIdx === -1) return plan.routines[0];
  return plan.routines[(lastIdx + 1) % plan.routines.length];
}

/** Builds a 12-week (84-day) GitHub/openGym-style consistency heatmap grid. */
export function build12WeekActivityHeatmap(
  attendanceDates: ReadonlyArray<string>,
  now: Date = new Date(),
): Array<{ isoDate: string; trained: boolean; isToday: boolean }> {
  const dateSet = new Set(attendanceDates);
  const todayIso = getTodayIsoDateKey(now);
  const out: Array<{ isoDate: string; trained: boolean; isToday: boolean }> = [];
  for (let offset = 83; offset >= 0; offset--) {
    const dt = new Date(now.getFullYear(), now.getMonth(), now.getDate() - offset);
    const iso = getTodayIsoDateKey(dt);
    out.push({
      isoDate: iso,
      trained: dateSet.has(iso),
      isToday: iso === todayIso,
    });
  }
  return out;
}

/** Builds clean CSV export of a member's workouts & 30-day body journal (openGym portable data). */
export function buildGymDataExportCsv(params: {
  memberName: string;
  workouts: ReadonlyArray<GymWorkoutSession>;
  measurements: ReadonlyArray<GymBodyMeasurement>;
}): string {
  const lines: string[] = [
    'Type,Date,Routine_Or_Metric,Exercise_Or_WeightKg,Sets_Or_WaistIn,VolumeKg_Or_ChestIn,PRs_Or_BicepsIn,BMI_Or_Notes',
  ];
  for (const w of params.workouts) {
    const exSummary = w.exercises.map((e) => e.exerciseName).join(' | ');
    lines.push(
      `Workout,${w.sessionDate},"${w.routineName.replace(/"/g, '""')}","${exSummary.replace(/"/g, '""')}",${w.totalSets},${w.totalVolumeKg},${w.prsHitCount},"${w.durationMinutes} min"`,
    );
  }
  for (const m of params.measurements) {
    lines.push(
      `Measurement,${m.recordedDate},Body Journal,${m.weightKg},${m.waistInches ?? ''},${m.chestInches ?? ''},${m.bicepsInches ?? ''},"BMI:${m.bmi ?? ''} ${(m.note ?? '').replace(/"/g, '""')}"`,
    );
  }
  return lines.join('\n');
}

/** Infers the matching looping SVG biomechanical animation key for any exercise. */
export function inferGymAnimationKey(
  name: string,
  muscleGroup?: string,
): GymAnimationKey {
  const n = name.toLowerCase();
  if (n.includes('incline')) return 'incline_press';
  if (n.includes('bench') || n.includes('push-up') || n.includes('fly') || n.includes('pec')) {
    return 'bench_press';
  }
  if (n.includes('pulldown') || n.includes('pull-up')) return 'lat_pulldown';
  if (n.includes('row') || n.includes('deadlift')) return 'cable_row';
  if (n.includes('leg press') || n.includes('leg curl') || n.includes('leg ext')) {
    return 'leg_press';
  }
  if (n.includes('squat') || n.includes('lunge') || n.includes('calf')) return 'squat';
  if (n.includes('shoulder') || n.includes('overhead') || n.includes('raise') || n.includes('face pull')) {
    return 'shoulder_press';
  }
  if (n.includes('tricep') || n.includes('pushdown') || n.includes('dip')) {
    return 'tricep_pushdown';
  }
  if (n.includes('curl')) return 'bicep_curl';
  if (muscleGroup === 'core' || n.includes('crunch') || n.includes('plank') || n.includes('leg raise')) {
    return 'core_plank';
  }
  if (muscleGroup === 'cardio' || n.includes('treadmill') || n.includes('hiit') || n.includes('cycle')) {
    return 'cardio_hiit';
  }
  if (muscleGroup === 'back') return 'lat_pulldown';
  if (muscleGroup === 'legs') return 'squat';
  if (muscleGroup === 'shoulders') return 'shoulder_press';
  if (muscleGroup === 'arms') return 'bicep_curl';
  return 'bench_press';
}

/** 24 built-in global gym exercises matching the Migration 023 + 026 SQL seed. */
export const BUILTIN_GYM_CATALOG_EXERCISES: ReadonlyArray<GymCatalogExercise> = [
  { id: 'ex-bench-press', businessId: null, name: 'Barbell Bench Press', muscleGroup: 'chest', equipment: 'barbell', defaultSets: 4, defaultReps: '8-10', restSeconds: 90, animationKey: 'bench_press', animationGifUrl: '/exercises/barbell-bench-press.gif', formCues: 'Retract shoulder blades, tuck elbows at 45°, lower bar to mid-chest in 2s.' },
  { id: 'ex-incline-db', businessId: null, name: 'Incline Dumbbell Press', muscleGroup: 'chest', equipment: 'dumbbell', defaultSets: 3, defaultReps: '10-12', restSeconds: 75, animationKey: 'incline_press', animationGifUrl: '/exercises/incline-dumbbell-press.gif', formCues: 'Set bench to 30°, press dumbbells smoothly without locking elbows.' },
  { id: 'ex-cable-fly', businessId: null, name: 'Cable Chest Fly', muscleGroup: 'chest', equipment: 'cable', defaultSets: 3, defaultReps: '12-15', restSeconds: 60, animationKey: 'bench_press', animationGifUrl: '/exercises/cable-chest-fly.gif', formCues: 'Keep a soft bend in elbows and squeeze chest at centerline.' },
  { id: 'ex-pec-deck', businessId: null, name: 'Pec Deck Machine Fly', muscleGroup: 'chest', equipment: 'machine', defaultSets: 3, defaultReps: '12-15', restSeconds: 60, animationKey: 'bench_press', animationGifUrl: '/exercises/pec-deck-machine-fly.gif', formCues: 'Keep chest proud, bring pads together with controlled eccentric.' },
  { id: 'ex-lat-pulldown', businessId: null, name: 'Wide-Grip Lat Pulldown', muscleGroup: 'back', equipment: 'cable', defaultSets: 4, defaultReps: '10-12', restSeconds: 75, animationKey: 'lat_pulldown', animationGifUrl: '/exercises/wide-grip-lat-pulldown.gif', formCues: 'Drive elbows down toward hips, pause 1s at upper chest, avoid swinging.' },
  { id: 'ex-barbell-row', businessId: null, name: 'Bent-Over Barbell Row', muscleGroup: 'back', equipment: 'barbell', defaultSets: 4, defaultReps: '8-10', restSeconds: 90, animationKey: 'cable_row', animationGifUrl: '/exercises/bent-over-barbell-row.gif', formCues: 'Hinge at 45°, brace core, row barbell toward lower ribs.' },
  { id: 'ex-cable-row', businessId: null, name: 'Seated Cable Row', muscleGroup: 'back', equipment: 'cable', defaultSets: 3, defaultReps: '10-12', restSeconds: 75, animationKey: 'cable_row', animationGifUrl: '/exercises/seated-cable-row.gif', formCues: 'Keep torso tall, pull handle to navel and squeeze shoulder blades.' },
  { id: 'ex-deadlift', businessId: null, name: 'Barbell Deadlift', muscleGroup: 'back', equipment: 'barbell', defaultSets: 3, defaultReps: '5-6', restSeconds: 150, animationKey: 'cable_row', animationGifUrl: '/exercises/barbell-deadlift.gif', formCues: 'Bar over mid-foot, flat back, push the floor away with legs.' },
  { id: 'ex-squat', businessId: null, name: 'Barbell Back Squat', muscleGroup: 'legs', equipment: 'barbell', defaultSets: 4, defaultReps: '6-8', restSeconds: 120, animationKey: 'squat', animationGifUrl: '/exercises/barbell-back-squat.gif', formCues: 'Brace core, sit hips back and down, knees track over toes.' },
  { id: 'ex-leg-press', businessId: null, name: '45° Leg Press Machine', muscleGroup: 'legs', equipment: 'machine', defaultSets: 4, defaultReps: '10-12', restSeconds: 90, animationKey: 'leg_press', animationGifUrl: '/exercises/leg-press-machine.gif', formCues: 'Lower sled until knees reach 90°, keep lower back flat on pad.' },
  { id: 'ex-rdl', businessId: null, name: 'Romanian Deadlift (RDL)', muscleGroup: 'legs', equipment: 'barbell', defaultSets: 3, defaultReps: '10-12', restSeconds: 90, animationKey: 'cable_row', animationGifUrl: '/exercises/romanian-deadlift.gif', formCues: 'Soft knees, push hips straight back until hamstrings stretch.' },
  { id: 'ex-leg-curl', businessId: null, name: 'Seated Leg Curl', muscleGroup: 'legs', equipment: 'machine', defaultSets: 3, defaultReps: '12-15', restSeconds: 60, animationKey: 'leg_press', animationGifUrl: '/exercises/seated-leg-curl.gif', formCues: 'Curl pad smoothly under seat and hold 1s peak contraction.' },
  { id: 'ex-calf-raise', businessId: null, name: 'Standing Calf Raise', muscleGroup: 'legs', equipment: 'machine', defaultSets: 4, defaultReps: '15-20', restSeconds: 45, animationKey: 'squat', animationGifUrl: '/exercises/standing-calf-raise.gif', formCues: 'Full stretch at bottom for 1s, drive high onto big toe.' },
  { id: 'ex-ohp', businessId: null, name: 'Overhead Barbell Press (OHP)', muscleGroup: 'shoulders', equipment: 'barbell', defaultSets: 4, defaultReps: '6-8', restSeconds: 90, animationKey: 'shoulder_press', animationGifUrl: '/exercises/overhead-barbell-press.gif', formCues: 'Squeeze glutes & abs, press straight overhead without arching back.' },
  { id: 'ex-db-shoulder', businessId: null, name: 'Seated Dumbbell Shoulder Press', muscleGroup: 'shoulders', equipment: 'dumbbell', defaultSets: 3, defaultReps: '10-12', restSeconds: 75, animationKey: 'shoulder_press', animationGifUrl: '/exercises/seated-dumbbell-shoulder-press.gif', formCues: 'Keep elbows slightly forward of torso, lower to ear level.' },
  { id: 'ex-lat-raise', businessId: null, name: 'Dumbbell Lateral Raises', muscleGroup: 'shoulders', equipment: 'dumbbell', defaultSets: 4, defaultReps: '12-15', restSeconds: 60, animationKey: 'shoulder_press', animationGifUrl: '/exercises/dumbbell-lateral-raises.gif', formCues: 'Lead with elbows to shoulder height, control the descent.' },
  { id: 'ex-face-pull', businessId: null, name: 'Cable Face Pulls', muscleGroup: 'shoulders', equipment: 'cable', defaultSets: 3, defaultReps: '15', restSeconds: 60, animationKey: 'cable_row', animationGifUrl: '/exercises/cable-face-pulls.gif', formCues: 'Pull rope toward forehead with high elbows and external rotation.' },
  { id: 'ex-ez-curl', businessId: null, name: 'EZ-Bar Bicep Curl', muscleGroup: 'arms', equipment: 'barbell', defaultSets: 3, defaultReps: '10-12', restSeconds: 60, animationKey: 'bicep_curl', animationGifUrl: '/exercises/ez-bar-bicep-curl.gif', formCues: 'Pin elbows to ribs, curl cleanly without leaning back.' },
  { id: 'ex-hammer-curl', businessId: null, name: 'Dumbbell Hammer Curl', muscleGroup: 'arms', equipment: 'dumbbell', defaultSets: 3, defaultReps: '12', restSeconds: 60, animationKey: 'bicep_curl', animationGifUrl: '/exercises/dumbbell-hammer-curl.gif', formCues: 'Neutral palms facing each other, controlled 2s lowering.' },
  { id: 'ex-tricep-pushdown', businessId: null, name: 'Tricep Rope Pushdown', muscleGroup: 'arms', equipment: 'cable', defaultSets: 3, defaultReps: '12-15', restSeconds: 60, animationKey: 'tricep_pushdown', animationGifUrl: '/exercises/tricep-rope-pushdown.gif', formCues: 'Keep upper arms locked at sides, split rope at full extension.' },
  { id: 'ex-leg-raise', businessId: null, name: 'Hanging Leg Raises', muscleGroup: 'core', equipment: 'bodyweight', defaultSets: 3, defaultReps: '12-15', restSeconds: 60, animationKey: 'core_plank', animationGifUrl: '/exercises/hanging-leg-raises.gif', formCues: 'Curl pelvis upward toward ribs, avoid swinging legs.' },
  { id: 'ex-cable-crunch', businessId: null, name: 'Kneeling Cable Crunch', muscleGroup: 'core', equipment: 'cable', defaultSets: 3, defaultReps: '15', restSeconds: 60, animationKey: 'core_plank', animationGifUrl: '/exercises/kneeling-cable-crunch.gif', formCues: 'Flex spine forward keeping hips stationary.' },
  { id: 'ex-treadmill-hiit', businessId: null, name: 'Treadmill HIIT Intervals', muscleGroup: 'cardio', equipment: 'cardio_machine', defaultSets: 1, defaultReps: '15 min', restSeconds: 60, animationKey: 'cardio_hiit', animationGifUrl: '/exercises/treadmill-hiit-intervals.gif', formCues: '30s fast sprint / 60s brisk walk recovery for 10 rounds.' },
  { id: 'ex-pushups', businessId: null, name: 'Weighted / Classic Push-Ups', muscleGroup: 'full_body', equipment: 'bodyweight', defaultSets: 3, defaultReps: '15', restSeconds: 60, animationKey: 'bench_press', animationGifUrl: '/exercises/push-ups.gif', formCues: 'Straight line head to heels, lower chest 1 inch from floor.' },
];

export const GYM_TRAINER_ROUTINE_PRESETS: ReadonlyArray<{
  key: string;
  routineName: string;
  targetGoal: string;
  description: string;
  exercises: GymRoutineExerciseItem[];
}> = [
  {
    key: 'ppl',
    routineName: 'Push / Pull / Legs (Hypertrophy)',
    targetGoal: 'muscle_gain',
    description: '3-day rotating split for lean muscle mass & progressive overload.',
    exercises: [
      { exerciseId: 'ex-bench-press', name: 'Barbell Bench Press', muscleGroup: 'chest', dayLabel: 'Push Day', sets: 4, reps: '8-10', restSeconds: 90 },
      { exerciseId: 'ex-incline-db', name: 'Incline Dumbbell Press', muscleGroup: 'chest', dayLabel: 'Push Day', sets: 3, reps: '10-12', restSeconds: 75 },
      { exerciseId: 'ex-db-shoulder', name: 'Seated Dumbbell Shoulder Press', muscleGroup: 'shoulders', dayLabel: 'Push Day', sets: 3, reps: '10-12', restSeconds: 75 },
      { exerciseId: 'ex-tricep-pushdown', name: 'Tricep Rope Pushdown', muscleGroup: 'arms', dayLabel: 'Push Day', sets: 3, reps: '12-15', restSeconds: 60 },
      { exerciseId: 'ex-lat-pulldown', name: 'Wide-Grip Lat Pulldown', muscleGroup: 'back', dayLabel: 'Pull Day', sets: 4, reps: '10-12', restSeconds: 75 },
      { exerciseId: 'ex-barbell-row', name: 'Bent-Over Barbell Row', muscleGroup: 'back', dayLabel: 'Pull Day', sets: 4, reps: '8-10', restSeconds: 90 },
      { exerciseId: 'ex-ez-curl', name: 'EZ-Bar Bicep Curl', muscleGroup: 'arms', dayLabel: 'Pull Day', sets: 3, reps: '10-12', restSeconds: 60 },
      { exerciseId: 'ex-squat', name: 'Barbell Back Squat', muscleGroup: 'legs', dayLabel: 'Leg Day', sets: 4, reps: '6-8', restSeconds: 120 },
      { exerciseId: 'ex-rdl', name: 'Romanian Deadlift (RDL)', muscleGroup: 'legs', dayLabel: 'Leg Day', sets: 3, reps: '10-12', restSeconds: 90 },
      { exerciseId: 'ex-leg-press', name: '45° Leg Press Machine', muscleGroup: 'legs', dayLabel: 'Leg Day', sets: 3, reps: '12', restSeconds: 90 },
    ],
  },
  {
    key: 'fat_loss',
    routineName: 'Beginner Fat Loss 4-Day',
    targetGoal: 'weight_loss',
    description: 'High-calorie burn compound strength + HIIT cardio finisher.',
    exercises: [
      { exerciseId: 'ex-pushups', name: 'Weighted / Classic Push-Ups', muscleGroup: 'full_body', dayLabel: 'Upper & Core', sets: 3, reps: '15', restSeconds: 60 },
      { exerciseId: 'ex-lat-pulldown', name: 'Wide-Grip Lat Pulldown', muscleGroup: 'back', dayLabel: 'Upper & Core', sets: 3, reps: '12', restSeconds: 60 },
      { exerciseId: 'ex-lat-raise', name: 'Dumbbell Lateral Raises', muscleGroup: 'shoulders', dayLabel: 'Upper & Core', sets: 3, reps: '15', restSeconds: 45 },
      { exerciseId: 'ex-cable-crunch', name: 'Kneeling Cable Crunch', muscleGroup: 'core', dayLabel: 'Upper & Core', sets: 3, reps: '15', restSeconds: 45 },
      { exerciseId: 'ex-leg-press', name: '45° Leg Press Machine', muscleGroup: 'legs', dayLabel: 'Lower & HIIT', sets: 4, reps: '12-15', restSeconds: 60 },
      { exerciseId: 'ex-leg-curl', name: 'Seated Leg Curl', muscleGroup: 'legs', dayLabel: 'Lower & HIIT', sets: 3, reps: '15', restSeconds: 60 },
      { exerciseId: 'ex-treadmill-hiit', name: 'Treadmill HIIT Intervals', muscleGroup: 'cardio', dayLabel: 'Lower & HIIT', sets: 1, reps: '15 min', restSeconds: 60 },
    ],
  },
  {
    key: 'upper_lower',
    routineName: 'Strength Foundation (Upper / Lower)',
    targetGoal: 'general_fitness',
    description: '4-day classic strength routine focused on compound lifts.',
    exercises: [
      { exerciseId: 'ex-bench-press', name: 'Barbell Bench Press', muscleGroup: 'chest', dayLabel: 'Upper Day', sets: 4, reps: '6-8', restSeconds: 120 },
      { exerciseId: 'ex-barbell-row', name: 'Bent-Over Barbell Row', muscleGroup: 'back', dayLabel: 'Upper Day', sets: 4, reps: '8', restSeconds: 90 },
      { exerciseId: 'ex-ohp', name: 'Overhead Barbell Press (OHP)', muscleGroup: 'shoulders', dayLabel: 'Upper Day', sets: 3, reps: '8', restSeconds: 90 },
      { exerciseId: 'ex-hammer-curl', name: 'Dumbbell Hammer Curl', muscleGroup: 'arms', dayLabel: 'Upper Day', sets: 3, reps: '12', restSeconds: 60 },
      { exerciseId: 'ex-squat', name: 'Barbell Back Squat', muscleGroup: 'legs', dayLabel: 'Lower Day', sets: 4, reps: '6-8', restSeconds: 120 },
      { exerciseId: 'ex-deadlift', name: 'Barbell Deadlift', muscleGroup: 'back', dayLabel: 'Lower Day', sets: 3, reps: '5', restSeconds: 150 },
      { exerciseId: 'ex-calf-raise', name: 'Standing Calf Raise', muscleGroup: 'legs', dayLabel: 'Lower Day', sets: 4, reps: '15', restSeconds: 45 },
      { exerciseId: 'ex-leg-raise', name: 'Hanging Leg Raises', muscleGroup: 'core', dayLabel: 'Lower Day', sets: 3, reps: '12', restSeconds: 60 },
    ],
  },
];

export interface GymNutritionPreset {
  key: 'fat_loss' | 'lean_muscle' | 'athletic_maintenance';
  label: string;
  planTitle: string;
  dailyCaloriesKcal: number;
  proteinGrams: number;
  carbsGrams: number;
  fatsGrams: number;
  waterLiters: number;
  supplementNotes: string;
  meals: GymNutritionMeal[];
}

export const GYM_NUTRITION_PRESETS: ReadonlyArray<GymNutritionPreset> = [
  {
    key: 'fat_loss',
    label: 'Fat Loss Indian Diet',
    planTitle: 'Shred & Fat Loss Protocol',
    dailyCaloriesKcal: 1750,
    proteinGrams: 135,
    carbsGrams: 165,
    fatsGrams: 55,
    waterLiters: 4.0,
    supplementNotes: '1 scoop Whey Isolate in water post-workout • Black coffee pre-workout • Multivitamin daily',
    meals: [
      { mealTime: 'Morning (7:00 AM)', items: 'Warm Lemon Water + 5 Soaked Almonds + Black Coffee', calories: 55, protein: 2 },
      { mealTime: 'Breakfast (9:00 AM)', items: '4 Egg Whites + 1 Whole Egg Bhurji OR 150g Paneer + 2 Besan Chilla', calories: 380, protein: 32 },
      { mealTime: 'Lunch (1:30 PM)', items: '150g Grilled Chicken / Soya Chunks + 1 Phulka + Big Cucumber Salad + Dal', calories: 520, protein: 42 },
      { mealTime: 'Pre-Workout (5:00 PM)', items: '1 Medium Banana + 1 tbsp Peanut Butter', calories: 195, protein: 5 },
      { mealTime: 'Post-Workout (7:00 PM)', items: '1 Scoop Whey Isolate in Cold Water', calories: 120, protein: 25 },
      { mealTime: 'Dinner (8:30 PM)', items: '150g Tandoori Chicken / Tofu Stir-Fry + Steamed Veggies + Mint Chutney', calories: 480, protein: 29 },
    ],
  },
  {
    key: 'lean_muscle',
    label: 'Lean Muscle Gain',
    planTitle: 'Lean Hypertrophy & Strength Plan',
    dailyCaloriesKcal: 2650,
    proteinGrams: 165,
    carbsGrams: 330,
    fatsGrams: 72,
    waterLiters: 4.0,
    supplementNotes: '1 scoop Whey Protein post-workout • 5g Creatine Monohydrate daily • Omega-3 Fish Oil',
    meals: [
      { mealTime: 'Morning (7:30 AM)', items: '1 Banana + 6 Soaked Almonds + 2 Whole Eggs', calories: 280, protein: 15 },
      { mealTime: 'Breakfast (9:00 AM)', items: '60g Rolled Oats + 250ml Milk + 1 Scoop Whey + 1 tbsp Peanut Butter', calories: 590, protein: 42 },
      { mealTime: 'Lunch (1:30 PM)', items: '200g Chicken Breast / Paneer + 200g Cooked Rice + Rajma/Dal + Curd', calories: 740, protein: 48 },
      { mealTime: 'Pre-Workout (5:00 PM)', items: '2 Brown Bread Slices + 150g Boiled Sweet Potato + Black Coffee', calories: 310, protein: 8 },
      { mealTime: 'Post-Workout (7:15 PM)', items: '1 Scoop Whey Isolate + 5g Creatine + 1 Banana', calories: 230, protein: 26 },
      { mealTime: 'Dinner (9:00 PM)', items: '180g Chicken / 150g Paneer + 2 Whole Wheat Roti + Sautéed Vegetables', calories: 500, protein: 26 },
    ],
  },
  {
    key: 'athletic_maintenance',
    label: 'Athletic Maintenance',
    planTitle: 'Balanced Athletic Performance',
    dailyCaloriesKcal: 2200,
    proteinGrams: 145,
    carbsGrams: 245,
    fatsGrams: 68,
    waterLiters: 3.5,
    supplementNotes: '1 scoop Whey post-workout • Electrolytes during training',
    meals: [
      { mealTime: 'Morning (7:30 AM)', items: 'Warm Water + 4 Almonds + 2 Walnuts', calories: 110, protein: 3 },
      { mealTime: 'Breakfast (8:45 AM)', items: '3 Egg Omelette / Moong Dal Chilla + 2 Multigrain Toast', calories: 450, protein: 28 },
      { mealTime: 'Lunch (1:30 PM)', items: '160g Chicken / Paneer + 2 Roti + 1 Bowl Dal + Salad + Buttermilk', calories: 640, protein: 42 },
      { mealTime: 'Pre-Workout (5:00 PM)', items: '1 Apple + 15g Roasted Makhana / Chana', calories: 180, protein: 4 },
      { mealTime: 'Post-Workout (7:00 PM)', items: '1 Scoop Whey Protein in Water', calories: 125, protein: 25 },
      { mealTime: 'Dinner (8:45 PM)', items: '150g Grilled Fish / Chicken / Tofu + 150g Rice + Stir-Fried Greens', calories: 695, protein: 43 },
    ],
  },
];

export function getNutritionPresetForGoal(goal?: GymFitnessGoal | null): GymNutritionPreset {
  if (goal === 'weight_loss') return GYM_NUTRITION_PRESETS[0];
  if (goal === 'muscle_gain' || goal === 'weight_gain') return GYM_NUTRITION_PRESETS[1];
  return GYM_NUTRITION_PRESETS[2];
}

export function buildDefaultWeeklyScheduleForGoal(
  goal?: GymFitnessGoal | null,
): GymWeeklyScheduleDay[] {
  const mapEx = (id: string, dayLabel: string): GymRoutineExerciseItem => {
    const found = BUILTIN_GYM_CATALOG_EXERCISES.find((e) => e.id === id) ?? BUILTIN_GYM_CATALOG_EXERCISES[0];
    return {
      exerciseId: found.id,
      name: found.name,
      muscleGroup: found.muscleGroup,
      dayLabel,
      sets: found.defaultSets,
      reps: found.defaultReps,
      restSeconds: found.restSeconds,
      animationKey: found.animationKey,
      animationGifUrl: found.animationGifUrl ?? null,
      formCues: found.formCues,
    };
  };

  if (goal === 'weight_loss' || goal === 'cardio_endurance') {
    return [
      { dayKey: 'mon', dayLabel: 'Mo', focusTitle: 'Upper & Core', isRestDay: false, exercises: [mapEx('ex-pushups', 'Upper & Core'), mapEx('ex-lat-pulldown', 'Upper & Core'), mapEx('ex-lat-raise', 'Upper & Core'), mapEx('ex-cable-crunch', 'Upper & Core')] },
      { dayKey: 'tue', dayLabel: 'Tu', focusTitle: 'Rest day', isRestDay: true, exercises: [] },
      { dayKey: 'wed', dayLabel: 'We', focusTitle: 'Lower & HIIT', isRestDay: false, exercises: [mapEx('ex-leg-press', 'Lower & HIIT'), mapEx('ex-leg-curl', 'Lower & HIIT'), mapEx('ex-calf-raise', 'Lower & HIIT'), mapEx('ex-treadmill-hiit', 'Lower & HIIT')] },
      { dayKey: 'thu', dayLabel: 'Th', focusTitle: 'Rest day', isRestDay: true, exercises: [] },
      { dayKey: 'fri', dayLabel: 'Fr', focusTitle: 'Full Body Burn', isRestDay: false, exercises: [mapEx('ex-bench-press', 'Full Body Burn'), mapEx('ex-cable-row', 'Full Body Burn'), mapEx('ex-squat', 'Full Body Burn'), mapEx('ex-leg-raise', 'Full Body Burn')] },
      { dayKey: 'sat', dayLabel: 'Sa', focusTitle: 'Cardio & Core', isRestDay: false, exercises: [mapEx('ex-treadmill-hiit', 'Cardio & Core'), mapEx('ex-cable-crunch', 'Cardio & Core'), mapEx('ex-leg-raise', 'Cardio & Core')] },
      { dayKey: 'sun', dayLabel: 'Su', focusTitle: 'Rest day', isRestDay: true, exercises: [] },
    ];
  }

  return [
    { dayKey: 'mon', dayLabel: 'Mo', focusTitle: 'Push Day', isRestDay: false, exercises: [mapEx('ex-bench-press', 'Push Day'), mapEx('ex-incline-db', 'Push Day'), mapEx('ex-db-shoulder', 'Push Day'), mapEx('ex-lat-raise', 'Push Day'), mapEx('ex-tricep-pushdown', 'Push Day')] },
    { dayKey: 'tue', dayLabel: 'Tu', focusTitle: 'Rest day', isRestDay: true, exercises: [] },
    { dayKey: 'wed', dayLabel: 'We', focusTitle: 'Pull Day', isRestDay: false, exercises: [mapEx('ex-lat-pulldown', 'Pull Day'), mapEx('ex-barbell-row', 'Pull Day'), mapEx('ex-cable-row', 'Pull Day'), mapEx('ex-face-pull', 'Pull Day'), mapEx('ex-ez-curl', 'Pull Day')] },
    { dayKey: 'thu', dayLabel: 'Th', focusTitle: 'Rest day', isRestDay: true, exercises: [] },
    { dayKey: 'fri', dayLabel: 'Fr', focusTitle: 'Leg Day', isRestDay: false, exercises: [mapEx('ex-squat', 'Leg Day'), mapEx('ex-leg-press', 'Leg Day'), mapEx('ex-rdl', 'Leg Day'), mapEx('ex-leg-curl', 'Leg Day'), mapEx('ex-calf-raise', 'Leg Day')] },
    { dayKey: 'sat', dayLabel: 'Sa', focusTitle: 'Upper Pump & Core', isRestDay: false, exercises: [mapEx('ex-ohp', 'Upper Pump & Core'), mapEx('ex-hammer-curl', 'Upper Pump & Core'), mapEx('ex-tricep-pushdown', 'Upper Pump & Core'), mapEx('ex-leg-raise', 'Upper Pump & Core')] },
    { dayKey: 'sun', dayLabel: 'Su', focusTitle: 'Rest day', isRestDay: true, exercises: [] },
  ];
}
