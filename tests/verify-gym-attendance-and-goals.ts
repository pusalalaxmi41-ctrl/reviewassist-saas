/**
 * Verification Suite — Module 5B (Migration 018):
 *   GymOS Daily QR Attendance Logs, Fitness Goals & Weight Targets,
 *   Workout Split Tracking, Same-Day Duplicate Prevention,
 *   Individual Member Progress History, Trainer Notes,
 *   Monthly Collected Revenue + Next-30-Day Projected Renewals & Multi-Tenant Isolation
 *
 * Run with: deno run --allow-read --allow-env tests/verify-gym-attendance-and-goals.ts
 */

import { MockLocalStorageRepository } from '../src/services/storage/MockLocalStorageRepository.ts';
import {
  formatCheckInTime12h,
  getTodayIsoDateKey,
  GYM_FITNESS_GOAL_OPTIONS,
  GYM_WORKOUT_FOCUS_OPTIONS,
  normalizeGymFitnessGoal,
  normalizeGymWorkoutFocus,
  validateGymRegistrationInput,
  validateGymWeightKg,
} from '../src/utils/gymValidation.ts';

let passed = 0;
let failed = 0;

function pass(message: string) {
  passed++;
  console.log(`  [PASS] ${message}`);
}

function fail(message: string, detail?: unknown) {
  failed++;
  console.error(`  [FAIL] ${message}`, detail ?? '');
}

function assert(condition: unknown, message: string, detail?: unknown) {
  if (condition) {
    pass(message);
  } else {
    fail(message, detail);
  }
}

async function assertRejects(
  fn: () => Promise<unknown>,
  expectedSubstring: string,
  message: string,
) {
  try {
    await fn();
    fail(`${message} (Expected rejection containing "${expectedSubstring}")`);
  } catch (err) {
    const msg = (err as Error).message || String(err);
    if (msg.toLowerCase().includes(expectedSubstring.toLowerCase())) {
      pass(`${message} (Blocked with: "${msg}")`);
    } else {
      fail(
        `${message} (Rejected, but expected "${expectedSubstring}", got "${msg}")`,
      );
    }
  }
}

console.log(
  '\n=== Module 5B Verification: GymOS Daily QR Attendance, Fitness Targets, Workout Splits & Revenue Forecast ===\n',
);

// ---------------------------------------------------------------------------
// 1. Fitness Goals, Workout Focus & Weight Validators
// ---------------------------------------------------------------------------
console.log('1. Fitness Targets, Workout Split & Weight Validators');

assert(
  GYM_FITNESS_GOAL_OPTIONS.length === 5 &&
    GYM_WORKOUT_FOCUS_OPTIONS.length === 7,
  'Exposes 5 fitness target pills and 7 workout split focus chips',
);

assert(
  normalizeGymFitnessGoal('muscle_gain') === 'muscle_gain' &&
    normalizeGymFitnessGoal('unknown_goal') === 'general_fitness' &&
    normalizeGymWorkoutFocus('chest') === 'chest' &&
    normalizeGymWorkoutFocus('bad_split') === 'full_body',
  'Goal and workout focus normalizers default safely on invalid values',
);

assert(
  validateGymWeightKg(68.5).ok &&
    validateGymWeightKg(null).ok &&
    !validateGymWeightKg(12).ok &&
    !validateGymWeightKg(450).ok,
  'Weight validator accepts valid kg (20–300) or null and rejects out-of-range values',
);

assert(
  validateGymRegistrationInput({
    businessSlug: 'iron-pulse-gym',
    fullName: 'Madhan Kumar',
    phone: '+91 98888 77766',
    planId: '1_month',
    fitnessGoal: 'muscle_gain',
    startingWeightKg: 68,
    targetWeightKg: 75,
  }).ok &&
    !validateGymRegistrationInput({
      businessSlug: 'iron-pulse-gym',
      fullName: 'Madhan Kumar',
      phone: '+91 98888 77766',
      planId: '1_month',
      fitnessGoal: 'muscle_gain',
      startingWeightKg: 500,
    }).ok,
  'Registration validator accepts fitnessGoal + weights and rejects invalid weights',
);

assert(
  formatCheckInTime12h('2026-11-23T07:15:00.000Z').length > 0 &&
    formatCheckInTime12h('invalid') === '',
  'formatCheckInTime12h formats valid ISO timestamps and handles invalid strings safely',
);

// ---------------------------------------------------------------------------
// 2. Member Registration with Fitness Goal & Target Weight + Payment Approval
// ---------------------------------------------------------------------------
console.log('\n2. Member Registration with Fitness Goal & Target Weight');

const repo = new MockLocalStorageRepository();
const businesses = await repo.getBusinesses();
const gym = businesses.find((b) => b.slug === 'iron-pulse-gym');
assert(
  Boolean(gym) && gym?.category === 'gym',
  'Loaded active GymOS shop (iron-pulse-gym)',
);
if (!gym) throw new Error('Missing seed gym');

const ownerA = { actorOwnerId: gym.ownerId! };
const ownerB = { actorOwnerId: 'owner-other-tenant-77' };

const todayKey = getTodayIsoDateKey();
const currentMonthKey = todayKey.slice(0, 7);

const baselineDash = await repo.getGymOwnerDashboard(
  gym.id,
  ownerA,
  currentMonthKey,
);
const baselineMonthRev = baselineDash.monthlyRevenuePaise;
const baselineProjectedRev = baselineDash.projectedNextMonthRevenuePaise;

const madhanSignup = await repo.submitGymMemberRegistration({
  businessSlug: gym.slug,
  fullName: 'Madhan Kumar',
  phone: '+91 98888 77766',
  planId: '1_month',
  fitnessGoal: 'muscle_gain',
  startingWeightKg: 68,
  targetWeightKg: 75,
});

assert(
  madhanSignup.status === 'pending_approval' &&
    madhanSignup.fitnessGoal === 'muscle_gain' &&
    madhanSignup.startingWeightKg === 68 &&
    madhanSignup.targetWeightKg === 75 &&
    madhanSignup.feePaise === 150000,
  'Registered Madhan Kumar with fitnessGoal=muscle_gain, 68kg -> 75kg, 1 Month (₹1,500)',
);

const madhanActive = await repo.ownerApproveOrRenewGymMember({
  businessId: gym.id,
  memberId: madhanSignup.id,
  action: 'approve',
  staffLabel: 'Owner Desk',
  options: ownerA,
});
assert(
  madhanActive.status === 'active' &&
    madhanActive.daysRemaining === 30 &&
    madhanActive.fitnessGoal === 'muscle_gain',
  'Owner payment approval activates 30-day plan and preserves fitness goal & weights',
);

// ---------------------------------------------------------------------------
// 3. Daily QR Attendance Logging, Workout Focus & Same-Day Duplicate Guard
// ---------------------------------------------------------------------------
console.log('\n3. Daily QR Attendance, Timestamps & Same-Day Duplicate Prevention');

const ciToday1 = await repo.gymMemberDailyCheckIn({
  businessSlug: gym.slug,
  phone: madhanActive.phone,
  workoutFocus: 'chest',
  memberNote: 'Bench press PR 80kg',
});

assert(
  ciToday1.alreadyCheckedInToday === false &&
    ciToday1.totalCheckIns === 1 &&
    ciToday1.daysAttendedThisMonth === 1 &&
    ciToday1.workoutFocus === 'chest' &&
    ciToday1.memberNote === 'Bench press PR 80kg' &&
    !Number.isNaN(new Date(ciToday1.checkedInAt).getTime()),
  'First check-in today logs exact timestamp, workoutFocus=chest, note & increments monthly count to 1',
);

// Repeat check-in on SAME day switching workout focus -> NO double counting!
const ciToday2 = await repo.gymMemberDailyCheckIn({
  businessSlug: gym.slug,
  phone: madhanActive.phone,
  workoutFocus: 'shoulders_arms',
});

assert(
  ciToday2.alreadyCheckedInToday === true &&
    ciToday2.totalCheckIns === 1 &&
    ciToday2.daysAttendedThisMonth === 1 &&
    ciToday2.workoutFocus === 'shoulders_arms',
  'Same-day repeat check-in prevents duplicate count (stays 1) while updating workoutFocus cleanly',
);

// Switch back to chest so chest is recorded for today
await repo.gymMemberDailyCheckIn({
  businessSlug: gym.slug,
  phone: madhanActive.phone,
  workoutFocus: 'chest',
});

// Log 2 deterministic earlier/other dates inside the exact same YYYY-MM month
const todayDay = Number.parseInt(todayKey.slice(8, 10), 10);
const altDays =
  todayDay >= 3
    ? ['01', '02']
    : todayDay === 2
      ? ['01', '03']
      : ['02', '03'];
const sameMonthDayA = `${currentMonthKey}-${altDays[0]}`;
const sameMonthDayB = `${currentMonthKey}-${altDays[1]}`;

await repo.gymMemberDailyCheckIn({
  businessSlug: gym.slug,
  phone: madhanActive.phone,
  workoutFocus: 'legs',
  checkInDateOverride: sameMonthDayA,
});
await repo.gymMemberDailyCheckIn({
  businessSlug: gym.slug,
  phone: madhanActive.phone,
  workoutFocus: 'cardio_hiit',
  checkInDateOverride: sameMonthDayB,
});

const lookedUpPass = await repo.lookupGymMemberPass({
  businessSlug: gym.slug,
  phone: madhanActive.phone,
});
assert(
  lookedUpPass !== null &&
    lookedUpPass.checkedInToday === true &&
    lookedUpPass.daysAttendedThisMonth === 3 &&
    lookedUpPass.totalCheckIns === 3 &&
    lookedUpPass.todayCheckIn?.workoutFocus === 'chest' &&
    (lookedUpPass.recentAttendanceLogs?.length ?? 0) === 3,
  'Digital Pass lookup returns 3 daysAttendedThisMonth, todayCheckIn=chest, and 3 recent logs',
);

// ---------------------------------------------------------------------------
// 4. Individual Member Progress History & Editable Trainer Notes
// ---------------------------------------------------------------------------
console.log('\n4. Member Progress History, Workout Split Breakdown & Trainer Notes');

const history1 = await repo.getGymMemberProgressHistory({
  businessId: gym.id,
  memberId: madhanActive.id,
  monthKey: currentMonthKey,
  options: ownerA,
});

assert(
  history1.daysAttendedThisMonth === 3 &&
    history1.attendanceLogs.length === 3 &&
    history1.workoutSplitCounts.chest === 1 &&
    history1.workoutSplitCounts.legs === 1 &&
    history1.workoutSplitCounts.cardio_hiit === 1,
  'getGymMemberProgressHistory returns chronological logs & exact workout split breakdown (chest:1, legs:1, cardio_hiit:1)',
  history1.workoutSplitCounts,
);

const updatedProfile = await repo.ownerUpdateGymMemberProfile({
  businessId: gym.id,
  memberId: madhanActive.id,
  trainerNotes: 'Increase protein to 130g/day, progressive overload on bench.',
  targetWeightKg: 76,
  options: ownerA,
});

assert(
  updatedProfile.trainerNotes ===
    'Increase protein to 130g/day, progressive overload on bench.' &&
    updatedProfile.targetWeightKg === 76,
  'ownerUpdateGymMemberProfile saves trainerNotes and updated targetWeightKg cleanly',
);

const history2 = await repo.getGymMemberProgressHistory({
  businessId: gym.id,
  memberId: madhanActive.id,
  monthKey: currentMonthKey,
  options: ownerA,
});
assert(
  history2.member.trainerNotes ===
    'Increase protein to 130g/day, progressive overload on bench.' &&
    history2.member.targetWeightKg === 76,
  'Persisted trainer notes and target weight appear in subsequent progress history reads',
);

// ---------------------------------------------------------------------------
// 5. Revenue Accounting (Monthly Collected + Next-30d Projected) & Today's Feed
// ---------------------------------------------------------------------------
console.log('\n5. Executive Dashboard: Attendance Feed, Monthly Revenue & 30-Day Forecast');

// Approve a 2nd member on a 3-Month Plan (₹4,000, expires in 90d -> NOT in next-30d projection!)
const snehaSignup = await repo.submitGymMemberRegistration({
  businessSlug: gym.slug,
  fullName: 'Sneha Reddy',
  phone: '9888811122',
  planId: '3_months',
  fitnessGoal: 'weight_loss',
  startingWeightKg: 70,
  targetWeightKg: 60,
});
await repo.ownerApproveOrRenewGymMember({
  businessId: gym.id,
  memberId: snehaSignup.id,
  action: 'approve',
  staffLabel: 'Owner Desk',
  options: ownerA,
});

const dashNow = await repo.getGymOwnerDashboard(
  gym.id,
  ownerA,
  currentMonthKey,
);

const madhanFeedEntry = dashNow.todaysAttendance.find(
  (a) => a.memberId === madhanActive.id,
);
assert(
  Boolean(madhanFeedEntry) &&
    madhanFeedEntry?.workoutFocus === 'chest' &&
    madhanFeedEntry?.fitnessGoal === 'muscle_gain' &&
    madhanFeedEntry?.daysAttendedThisMonth === 3,
  'todaysAttendance feed shows Madhan with exact workoutFocus=chest, goal=muscle_gain, 3 visits this month',
);

// Monthly revenue must increase by exactly ₹1,500 (Madhan) + ₹4,000 (Sneha) = ₹5,500 (550000p)
const expectedMonthRev = baselineMonthRev + 150000 + 400000;
assert(
  dashNow.monthlyRevenuePaise === expectedMonthRev,
  `monthlyRevenuePaise accurately sums approvals in ${currentMonthKey} (+₹5,500 => ${dashNow.monthlyRevenuePaise}p)`,
  { got: dashNow.monthlyRevenuePaise, expected: expectedMonthRev },
);

// Projected next-30-day revenue must increase by ONLY Madhan's ₹1,500 (30d <= 30d),
// NOT Sneha's ₹4,000 (90d > 30d)!
const expectedProjectedRev = baselineProjectedRev + 150000;
assert(
  dashNow.projectedNextMonthRevenuePaise === expectedProjectedRev,
  `projectedNextMonthRevenuePaise includes 30d renewal (+₹1,500) and excludes 90d plan (${dashNow.projectedNextMonthRevenuePaise}p)`,
  { got: dashNow.projectedNextMonthRevenuePaise, expected: expectedProjectedRev },
);

// Historical empty month query has zero current-month leakage
const emptyMonthDash = await repo.getGymOwnerDashboard(
  gym.id,
  ownerA,
  '2025-01',
);
assert(
  emptyMonthDash.monthlyRevenuePaise === 0 &&
    emptyMonthDash.monthKey === '2025-01',
  'Historical month query (2025-01) isolates 0 revenue with zero cross-month leakage',
);

// ---------------------------------------------------------------------------
// 6. Strict Multi-Tenant Isolation
// ---------------------------------------------------------------------------
console.log('\n6. Strict Multi-Tenant Isolation');

await assertRejects(
  () =>
    repo.getGymMemberProgressHistory({
      businessId: gym.id,
      memberId: madhanActive.id,
      monthKey: currentMonthKey,
      options: ownerB,
    }),
  'unauthorized',
  'Multi-tenant isolation: Owner B cannot read Owner A member progress history',
);

await assertRejects(
  () =>
    repo.ownerUpdateGymMemberProfile({
      businessId: gym.id,
      memberId: madhanActive.id,
      trainerNotes: 'Unauthorized spoof note',
      options: ownerB,
    }),
  'unauthorized',
  'Multi-tenant isolation: Owner B cannot edit Owner A member trainer notes or goals',
);

await assertRejects(
  () => repo.getGymOwnerDashboard(gym.id, ownerB, currentMonthKey),
  'unauthorized',
  'Multi-tenant isolation: Owner B cannot read Owner A gym revenue & attendance dashboard',
);

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------
console.log(
  `\n=== Module 5B Verification Complete: ${passed} passed, ${failed} failed ===\n`,
);

if (failed > 0) {
  Deno.exit(1);
}
