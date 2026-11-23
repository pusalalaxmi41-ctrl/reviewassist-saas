/**
 * Verification Suite #18 — GymOS Workout Engine (Inspired by openGym, Migration 023):
 *   24-Exercise Built-In Catalog + Custom Gym Exercise Creation,
 *   Trainer Reusable Workout Routine Templates + Member Routine Assignment,
 *   Live Set/Rep Logger with Epley 1RM Estimation & Automatic 🏆 PR Detection,
 *   Weekly & Daily Volume Lifted (kg), Owner Progress Summary,
 *   Barbell Plate Math Calculator, CSV Export & Multi-Tenant Isolation.
 *
 * Run with: deno run --allow-read --allow-env tests/verify-gym-workout-engine.ts
 */

import { MockLocalStorageRepository } from '../src/services/storage/MockLocalStorageRepository.ts';
import {
  buildGymDataExportCsv,
  calculateBarbellPlates,
  calculateEpley1RM,
  GYM_TRAINER_ROUTINE_PRESETS,
} from '../src/utils/gymWorkoutEngine.ts';

let passed = 0;
let failed = 0;

function pass(msg: string) {
  passed++;
  console.log(`  [PASS] ${msg}`);
}

function fail(msg: string, detail?: unknown) {
  failed++;
  console.error(`  [FAIL] ${msg}`, detail ?? '');
}

function assert(cond: unknown, msg: string, detail?: unknown) {
  if (cond) pass(msg);
  else fail(msg, detail);
}

async function assertRejects(
  fn: () => Promise<unknown>,
  expected: string,
  msg: string,
) {
  try {
    await fn();
    fail(`${msg} (Expected rejection containing "${expected}")`);
  } catch (err) {
    const text = (err as Error).message || String(err);
    if (text.toLowerCase().includes(expected.toLowerCase())) {
      pass(`${msg} (Blocked with: "${text}")`);
    } else {
      fail(`${msg} (Expected "${expected}", got "${text}")`);
    }
  }
}

console.log(
  '\n=== Suite #18 Verification: GymOS Workout Engine (Catalog, Routines, Set/PR Logger & Plate Math) ===\n',
);

const repo = new MockLocalStorageRepository();
const businesses = await repo.getBusinesses();
const gymA = businesses.find((b) => b.slug === 'iron-pulse-gym')!;
const ownerA = { actorOwnerId: gymA.ownerId };

// Create a second gym for strict multi-tenant isolation checks
const gymB = await repo.createBusiness({
  name: 'Titan Strength Club',
  slug: 'titan-strength-gym',
  category: 'gym',
  city: 'Pune',
  googleReviewUrl: 'https://g.page/r/titan-strength/review',
  ownerId: 'owner-titan-gym-b',
  status: 'pending',
  accountState: 'active',
});
const ownerB = { actorOwnerId: 'owner-titan-gym-b' };

// ---------------------------------------------------------------------------
// 1. Built-In Exercise Catalog + Custom Gym Exercise
// ---------------------------------------------------------------------------
console.log('1. Exercise Catalog & Custom Gym Exercises');

const catalogBefore = await repo.getGymExerciseCatalog(gymA.id, ownerA);
assert(
  catalogBefore.length === 24 &&
    catalogBefore.some((e) => e.name === 'Barbell Bench Press') &&
    catalogBefore.some((e) => e.name === 'Barbell Back Squat'),
  'Built-in catalog returns all 24 seeded Indian gym exercises out of the box',
);

const customEx = await repo.createGymCustomExercise(
  gymA.id,
  {
    name: 'Pendulum Hack Squat',
    muscleGroup: 'legs',
    equipment: 'machine',
    defaultSets: 4,
    defaultReps: '10',
    restSeconds: 90,
  },
  ownerA,
);
const catalogAfter = await repo.getGymExerciseCatalog(gymA.id, ownerA);
const catalogGymB = await repo.getGymExerciseCatalog(gymB.id, ownerB);
assert(
  catalogAfter.length === 25 &&
    catalogAfter.some((e) => e.id === customEx.id) &&
    catalogGymB.length === 24 &&
    !catalogGymB.some((e) => e.id === customEx.id),
  'Custom gym exercise is visible to Gym A and strictly isolated from Gym B',
);

// ---------------------------------------------------------------------------
// 2. Trainer Routine Creation & Assignment to Active Member
// ---------------------------------------------------------------------------
console.log('\n2. Reusable Workout Routines & Member Assignment');

const member = await repo.submitGymMemberRegistration({
  businessSlug: gymA.slug,
  fullName: 'Karthik Rao',
  phone: '9880055667',
  planId: '3_months',
  fitnessGoal: 'muscle_gain',
});
await repo.ownerApproveOrRenewGymMember({
  businessId: gymA.id,
  memberId: member.id,
  action: 'approve',
  options: ownerA,
});

const pplPreset = GYM_TRAINER_ROUTINE_PRESETS[0];
const createdRoutine = await repo.createOrAssignGymRoutine({
  businessId: gymA.id,
  routineName: pplPreset.routineName,
  targetGoal: pplPreset.targetGoal,
  exercises: pplPreset.exercises,
  assignToMemberId: member.id,
  createdBy: 'Coach Ravi',
  options: ownerA,
});

const memberPlan = await repo.getGymMemberWorkoutPlan({
  businessSlug: gymA.slug,
  memberId: member.id,
});
assert(
  memberPlan !== null &&
    memberPlan.assignedRoutine?.id === createdRoutine.id &&
    memberPlan.assignedRoutine.exercises.length === pplPreset.exercises.length &&
    memberPlan.exerciseCatalog.length === 25,
  'Member workout plan returns trainer-assigned Push/Pull/Legs routine & 25-exercise catalog',
);

// ---------------------------------------------------------------------------
// 3. Live Set/Rep Logger, Automatic Epley 1RM & 🏆 PR Detection
// ---------------------------------------------------------------------------
console.log('\n3. Live Set/Rep Logger, Epley 1RM & Automatic Personal Record Detection');

// Set 1: Barbell Bench Press 60 kg x 10 -> Est 1RM = 80.0 kg -> First set = PR!
const set1 = await repo.logGymMemberWorkoutSet({
  businessSlug: gymA.slug,
  memberId: member.id,
  exerciseName: 'Barbell Bench Press',
  muscleGroup: 'chest',
  setNumber: 1,
  weightKg: 60,
  reps: 10,
});
assert(
  set1.isPersonalRecord === true &&
    set1.setLog.estimated1rmKg === calculateEpley1RM(60, 10) &&
    set1.setLog.estimated1rmKg === 80 &&
    set1.totalVolumeTodayKg === 600,
  'Set 1 (60kg × 10) computes Epley 1RM = 80 kg, marks 🏆 PR, and tracks 600 kg daily volume',
);

// Set 2: Lighter backoff set 50 kg x 10 -> NOT a PR! Total volume = 600 + 500 = 1100 kg
const set2 = await repo.logGymMemberWorkoutSet({
  businessSlug: gymA.slug,
  memberId: member.id,
  exerciseName: 'Barbell Bench Press',
  muscleGroup: 'chest',
  setNumber: 2,
  weightKg: 50,
  reps: 10,
});
assert(
  set2.isPersonalRecord === false && set2.totalVolumeTodayKg === 1100,
  'Lighter backoff set (50kg × 10) does NOT false-trigger PR and accumulates 1,100 kg volume',
);

// Set 3: Heavier top set 75 kg x 8 -> Est 1RM = 95 kg -> NEW 🏆 PR! Total volume = 1100 + 600 = 1700 kg
const set3 = await repo.logGymMemberWorkoutSet({
  businessSlug: gymA.slug,
  memberId: member.id,
  exerciseName: 'Barbell Bench Press',
  muscleGroup: 'chest',
  setNumber: 3,
  weightKg: 75,
  reps: 8,
});
assert(
  set3.isPersonalRecord === true &&
    set3.setLog.weightKg === 75 &&
    set3.setLog.estimated1rmKg === 95 &&
    set3.totalVolumeTodayKg === 1700,
  'Beating previous best (75kg × 8, Est 1RM 95kg) triggers 🏆 NEW PR and updates volume to 1,700 kg',
);

// ---------------------------------------------------------------------------
// 4. Owner Progress Summary, Plate Math Calculator & CSV Export
// ---------------------------------------------------------------------------
console.log('\n4. Trainer Progress Summary, Barbell Plate Math & Multi-Tenant Isolation');

const summary = await repo.getGymMemberWorkoutSummary({
  businessId: gymA.id,
  memberId: member.id,
  options: ownerA,
});
assert(
  summary.totalVolumeKg === 1700 &&
    summary.recentSets.length === 3 &&
    summary.personalRecords.length === 1 &&
    summary.personalRecords[0].bestWeightKg === 75 &&
    summary.personalRecords[0].best1rmKg === 95,
  'Owner/Trainer Progress Summary shows exact 1,700 kg total volume, 3 sets & 75 kg Bench PR',
);

const plates100 = calculateBarbellPlates(100, 20);
assert(
  plates100.perSideKg === 40 &&
    plates100.achievedTotalKg === 100 &&
    plates100.platesPerSide.length >= 1,
  'Barbell Plate Math calculator accurately computes per-side metric plates for 100 kg Olympic bar',
);

const csvOut = buildGymDataExportCsv({
  memberName: member.fullName,
  workouts: [],
  measurements: [],
});
assert(
  csvOut.startsWith('Type,Date,Routine_Or_Metric'),
  'Portable CSV workout & body journal exporter produces valid headers',
);

// Strict Multi-Tenant Isolation
await assertRejects(
  () =>
    repo.getGymMemberWorkoutSummary({
      businessId: gymA.id,
      memberId: member.id,
      options: ownerB,
    }),
  'unauthorized',
  'Multi-tenant isolation: Gym B owner cannot inspect Gym A member workout logs or PRs',
);

await assertRejects(
  () =>
    repo.createOrAssignGymRoutine({
      businessId: gymA.id,
      routineName: 'Spoofed Plan',
      exercises: [],
      options: ownerB,
    }),
  'unauthorized',
  'Multi-tenant isolation: Gym B owner cannot create or assign routines in Gym A',
);

console.log(`\nSummary: ${passed} passed, ${failed} failed.\n`);
if (failed > 0) Deno.exit(1);
