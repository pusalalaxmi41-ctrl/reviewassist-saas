/**
 * Verification Suite #19 — GymOS Coach Personalization, Nutrition & Athlete Hub (Migration 026):
 *   Owner/Trainer 7-Day Weekly Split + Indian Diet Plan Approval,
 *   Full Athlete Hub Payload (Monthly Challenges, Recovery Insight, Animated Catalog),
 *   Focused Set Logger + PR Detection + Total Volume Tracking,
 *   Multi-Tenant Isolation & Migration 026 SQL/RLS Guardrails.
 *
 * Run with: deno run --allow-read --allow-env tests/verify-gym-coach-nutrition-and-session.ts
 */

import { MockLocalStorageRepository } from '../src/services/storage/MockLocalStorageRepository.ts';
import {
  buildDefaultWeeklyScheduleForGoal,
  getNutritionPresetForGoal,
  inferGymAnimationKey,
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
  '\n=== Suite #19 Verification: GymOS Coach Personalization, Nutrition & Athlete Hub (Migration 026) ===\n',
);

const repo = new MockLocalStorageRepository();
const gymBiz = await repo.getBusinessById('biz-iron-pulse-4');
if (!gymBiz) throw new Error('Seeded Iron Pulse Fitness business not found');
const ownerOpts = { actorOwnerId: gymBiz.ownerId };

// Ensure a clean active member
const member = await repo.submitGymMemberRegistration({
  businessSlug: gymBiz.slug,
  fullName: 'Vikram Rathore',
  phone: '9876500112',
  planId: '3_months',
  fitnessGoal: 'muscle_gain',
  startingWeightKg: 72,
  targetWeightKg: 78,
});

await repo.ownerApproveOrRenewGymMember({
  businessId: gymBiz.id,
  memberId: member.id,
  action: 'approve',
  planId: '3_months',
  amountPaidPaise: 400000,
  options: ownerOpts,
});

// 1. Trainer & Coach Plan + Nutrition Approval
console.log('1. Coach Plan & Indian Nutrition Approval');
const trainer = await repo.createGymTrainer(
  gymBiz.id,
  { trainerName: 'Coach Vikram', specialty: 'Hypertrophy', commissionPercent: 50 },
  ownerOpts,
);
const presetDiet = getNutritionPresetForGoal('muscle_gain');
const weeklySplit = buildDefaultWeeklyScheduleForGoal('muscle_gain');

const approvedPlan = await repo.upsertAndApproveGymCoachPlan(
  {
    businessId: gymBiz.id,
    memberId: member.id,
    trainerId: trainer.id,
    planTitle: 'Lean Mass 6-Month Protocol',
    scheduleMode: 'fixed_week',
    weeklySchedule: weeklySplit,
    dailyCaloriesKcal: presetDiet.dailyCaloriesKcal,
    proteinGrams: presetDiet.proteinGrams,
    carbsGrams: presetDiet.carbsGrams,
    fatsGrams: presetDiet.fatsGrams,
    waterLiters: presetDiet.waterLiters,
    nutritionMeals: presetDiet.meals,
    supplementNotes: presetDiet.supplementNotes,
    coachNotes: 'Progressive overload on Bench & Squat.',
    approvedBy: trainer.trainerName,
  },
  ownerOpts,
);

assert(
  approvedPlan.approvalStatus === 'approved' &&
    approvedPlan.trainerName === 'Coach Vikram' &&
    approvedPlan.weeklySchedule.length === 7 &&
    approvedPlan.nutritionMeals.length === 6,
  'Owner/Trainer approved 7-day weekly split + 6-meal Indian nutrition plan pushed to member',
);

const fetchedForOwner = await repo.getGymMemberCoachPlanForOwner({
  businessId: gymBiz.id,
  memberId: member.id,
  options: ownerOpts,
});
assert(
  fetchedForOwner?.id === approvedPlan.id &&
    fetchedForOwner.dailyCaloriesKcal === 2650 &&
    fetchedForOwner.proteinGrams === 165,
  'getGymMemberCoachPlanForOwner returns exact macro & meal targets',
);

// 2. Full Athlete Hub & Animated Exercise Library
console.log('\n2. Full Athlete Hub Payload & Animated Exercise Catalog');
const hubBefore = await repo.getGymMemberAthleteHub({
  businessSlug: gymBiz.slug,
  memberId: member.id,
});

assert(
  hubBefore !== null &&
    hubBefore.coachPlan?.approvalStatus === 'approved' &&
    hubBefore.coachPlan.planTitle === 'Lean Mass 6-Month Protocol',
  'getGymMemberAthleteHub returns Coach-Approved plan on member phone',
);

assert(
  Boolean(hubBefore?.recoveryInsight?.message) &&
    (hubBefore?.exerciseCatalog.length ?? 0) >= 24 &&
    hubBefore?.exerciseCatalog.every((ex) => Boolean(ex.animationKey) && Boolean(ex.formCues)),
  'Athlete Hub includes smart recovery insight + 24+ animated exercises with form cues',
);

assert(
  inferGymAnimationKey('Barbell Bench Press', 'chest') === 'bench_press' &&
    inferGymAnimationKey('Wide-Grip Lat Pulldown', 'back') === 'lat_pulldown' &&
    inferGymAnimationKey('Barbell Back Squat', 'legs') === 'squat',
  'inferGymAnimationKey accurately maps exercise names to biomechanical SVG animations',
);

// 3. Focused Set Logger, PR Detection & Volume Rollup
console.log('\n3. Focused Set Logger, PR Detection & Volume Rollup');
const set1 = await repo.logGymMemberWorkoutSet({
  businessSlug: gymBiz.slug,
  memberId: member.id,
  exerciseId: 'ex-bench-press',
  exerciseName: 'Barbell Bench Press',
  muscleGroup: 'chest',
  setNumber: 1,
  weightKg: 70,
  reps: 10,
});
assert(
  set1.isPersonalRecord && set1.totalVolumeTodayKg === 700,
  'Set 1 (70kg × 10) triggers 🏆 Record & logs 700 kg daily volume',
);

const set2 = await repo.logGymMemberWorkoutSet({
  businessSlug: gymBiz.slug,
  memberId: member.id,
  exerciseId: 'ex-bench-press',
  exerciseName: 'Barbell Bench Press',
  muscleGroup: 'chest',
  setNumber: 2,
  weightKg: 75,
  reps: 8,
});
assert(
  set2.isPersonalRecord && set2.totalVolumeTodayKg === 1300,
  'Set 2 (75kg × 8) beats previous best, triggers 🏆 Record & updates daily volume to 1,300 kg',
);

const hubAfter = await repo.getGymMemberAthleteHub({
  businessSlug: gymBiz.slug,
  memberId: member.id,
});
assert(
  hubAfter?.totalVolumeLiftedKg === 1300 &&
    hubAfter.volumeThisMonthKg === 1300 &&
    hubAfter.personalRecords[0]?.bestWeightKg === 75,
  'Athlete Hub reflects updated totalVolumeLiftedKg (1,300 kg) and Bench PR (75 kg)',
);

// 4. Multi-Tenant Isolation & Migration 026 Guardrails
console.log('\n4. Multi-Tenant Isolation & Migration 026 SQL/RLS Guardrails');
await assertRejects(
  () =>
    repo.upsertAndApproveGymCoachPlan(
      {
        businessId: gymBiz.id,
        memberId: member.id,
        planTitle: 'Hijacked Plan',
        scheduleMode: 'fixed_week',
        weeklySchedule: weeklySplit,
        dailyCaloriesKcal: 2000,
        proteinGrams: 120,
        carbsGrams: 200,
        fatsGrams: 60,
        waterLiters: 3.0,
        nutritionMeals: [],
      },
      { actorOwnerId: 'owner-other-gym-999' },
    ),
  'Unauthorized',
  'Other gym owner cannot overwrite or approve coach plans in Gym A',
);

await assertRejects(
  () =>
    repo.getGymMemberCoachPlanForOwner({
      businessId: gymBiz.id,
      memberId: member.id,
      options: { actorOwnerId: 'owner-other-gym-999' },
    }),
  'Unauthorized',
  'Other gym owner cannot read coach plans from Gym A',
);

const sql026 = await Deno.readTextFile(
  'supabase/migrations/026_gym_coach_nutrition_and_weekly_plans.sql',
);
assert(
  sql026.includes('enable row level security') &&
    sql026.includes('force row level security') &&
    sql026.includes('revoke all on table public.gym_member_coach_plans from public, anon, authenticated'),
  'Migration 026 enforces ENABLE + FORCE RLS and REVOKE ALL FROM public, anon, authenticated',
);

assert(
  sql026.includes('pg_catalog.substr(') &&
    !/pg_catalog\.substring\s*\(/i.test(sql026) &&
    !/\bsubstring\s*\(/i.test(sql026),
  'Migration 026 strictly obeys PostgreSQL SQL guardrail (pg_catalog.substr, zero substring())',
);

console.log(`\nSummary: ${passed} passed, ${failed} failed.`);
if (failed > 0) {
  Deno.exit(1);
}
