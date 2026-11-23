/**
 * Verification Suite #17 — GymOS Flagship Upgrade (Migration 023):
 *   Part-Payment / Installment Balance Tracker & Collection,
 *   Personal Training (PT) Packages, Session Deduction & Trainer Commission Payouts,
 *   Membership Freeze / Resume (Auto-Extending Expiry + Check-In Block While Frozen),
 *   Daily Streak Calculation, 30-Day Body Transformation Journal & Top-10 Leaderboard,
 *   Front-Desk Supplement Bar POS, Weekly Revenue Comparison, Multi-Tenant Isolation & SQL Guardrails.
 *
 * Run with: deno run --allow-read --allow-env tests/verify-gym-flagship-os.ts
 */

import { MockLocalStorageRepository } from '../src/services/storage/MockLocalStorageRepository.ts';
import {
  addDaysToIsoDate,
  computeGymBmi,
  diffDaysBetweenIsoDates,
  formatPrivacySafeLeaderboardName,
  getTodayIsoDateKey,
} from '../src/utils/gymValidation.ts';

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
  '\n=== Suite #17 Verification: GymOS Flagship Operations (PT, Installments, Freeze, Body Journal, Leaderboard & Retail) ===\n',
);

const repo = new MockLocalStorageRepository();
const businesses = await repo.getBusinesses();
const gym = businesses.find((b) => b.slug === 'iron-pulse-gym')!;
const ownerA = { actorOwnerId: gym.ownerId };
const ownerB = { actorOwnerId: 'owner-other-gym-999' };

// ---------------------------------------------------------------------------
// 1. Utilities (BMI & Privacy-Safe Leaderboard Formatting)
// ---------------------------------------------------------------------------
console.log('1. Pure Flagship Utilities');

assert(
  computeGymBmi(75, 175) === 24.5 &&
    formatPrivacySafeLeaderboardName('Madhan Kumar') === 'Madhan K.',
  'BMI calculator and privacy-safe leaderboard formatter work accurately',
);

// ---------------------------------------------------------------------------
// 2. Part-Payment / Installments + Collect Balance Due
// ---------------------------------------------------------------------------
console.log('\n2. Installment Part-Payment Approval & Balance Due Collection');

const installmentMember = await repo.submitGymMemberRegistration({
  businessSlug: gym.slug,
  fullName: 'Madhan Kumar',
  phone: '9880011223',
  planId: '3_months',
  fitnessGoal: 'muscle_gain',
  startingWeightKg: 76,
  targetWeightKg: 82,
});

// 3-Month Plan is ₹4,000 (400000 paise); member pays ₹2,000 now, ₹2,000 due
const approvedInstallment = await repo.ownerApproveOrRenewGymMember({
  businessId: gym.id,
  memberId: installmentMember.id,
  action: 'approve',
  planId: '3_months',
  feePaise: 400000,
  amountPaidPaise: 200000,
  balanceDueDate: addDaysToIsoDate(getTodayIsoDateKey(), 14),
  paymentMethod: 'upi',
  options: ownerA,
});

assert(
  approvedInstallment.status === 'active' &&
    approvedInstallment.amountPaidPaise === 200000 &&
    approvedInstallment.balanceDuePaise === 200000 &&
    approvedInstallment.balanceDueDate !== null,
  'Part-payment approval activates ₹4,000 plan with ₹2,000 paid and ₹2,000 balance due',
);

const dashWithDue = await repo.getGymOwnerDashboard(gym.id, ownerA);
assert(
  (dashWithDue.totalBalanceDuePaise ?? 0) >= 200000 &&
    (dashWithDue.balanceDueMembersCount ?? 0) >= 1,
  'Owner Dashboard surfaces pending installment balance due totals accurately',
);

const afterCollect = await repo.collectGymBalanceDue({
  businessId: gym.id,
  memberId: installmentMember.id,
  collectedPaise: 200000,
  paymentMethod: 'cash',
  options: ownerA,
});
assert(
  afterCollect.amountPaidPaise === 400000 &&
    afterCollect.balanceDuePaise === 0 &&
    afterCollect.balanceDueDate === null,
  'collectGymBalanceDue clears ₹2,000 balance to ₹0 and clears due date',
);

await assertRejects(
  () =>
    repo.collectGymBalanceDue({
      businessId: gym.id,
      memberId: installmentMember.id,
      collectedPaise: 50000,
      options: ownerA,
    }),
  'no pending balance',
  'Rejects collecting balance when member has ₹0 pending due',
);

// ---------------------------------------------------------------------------
// 3. Personal Trainers (PT) Package, Session Deduction & Commission Payout
// ---------------------------------------------------------------------------
console.log('\n3. Personal Training (PT) Packages & Trainer Commission Payouts');

const coachRavi = await repo.createGymTrainer(
  gym.id,
  {
    trainerName: 'Coach Ravi',
    specialty: 'Hypertrophy & Strength',
    commissionPercent: 50,
  },
  ownerA,
);
assert(
  coachRavi.trainerName === 'Coach Ravi' && coachRavi.commissionPercent === 50,
  'Created Personal Trainer Coach Ravi at 50% commission share',
);

const ptMember = await repo.submitGymMemberRegistration({
  businessSlug: gym.slug,
  fullName: 'Sohan Verma',
  phone: '9880022334',
  planId: '1_month',
  fitnessGoal: 'weight_loss',
});

// Approve with 1 Month Plan (₹1,500) + 24 PT Sessions (₹8,000) paid in full
const approvedPt = await repo.ownerApproveOrRenewGymMember({
  businessId: gym.id,
  memberId: ptMember.id,
  action: 'approve',
  planId: '1_month',
  feePaise: 150000,
  ptTrainerId: coachRavi.id,
  ptPackageName: '24 PT Sessions',
  ptSessions: 24,
  ptFeePaise: 800000,
  options: ownerA,
});
assert(
  approvedPt.ptTrainerId === coachRavi.id &&
    approvedPt.ptTotalSessions === 24 &&
    approvedPt.ptRemainingSessions === 24 &&
    approvedPt.totalPlanAmountPaise === 950000,
  'Assigned 24 PT Sessions (₹8,000) to Sohan under Coach Ravi',
);

const ptCheckIn = await repo.gymMemberDailyCheckIn({
  businessSlug: gym.slug,
  phone: ptMember.phone,
  workoutFocus: 'chest',
  isPtSession: true,
});
assert(
  ptCheckIn.isPtSession === true &&
    ptCheckIn.ptRemainingSessions === 23 &&
    ptCheckIn.trainerId === coachRavi.id,
  'PT check-in atomically decrements remaining PT sessions (24 -> 23) and logs Coach Ravi',
);

const commissions = await repo.getGymTrainerCommissions(gym.id, undefined, ownerA);
const raviRow = commissions.find((c) => c.id === coachRavi.id);
assert(
  raviRow !== undefined &&
    raviRow.activePtClients === 1 &&
    raviRow.ptSessionsDeliveredThisMonth === 1 &&
    raviRow.ptPackageRevenuePaise === 800000 &&
    raviRow.commissionPayoutPaise === 400000,
  'getGymTrainerCommissions accurately computes 50% payout (₹4,000) & 1 PT session delivered',
);

// ---------------------------------------------------------------------------
// 4. Membership Freeze & Resume (Auto-Extends Expiry + Blocks Check-In)
// ---------------------------------------------------------------------------
console.log('\n4. Membership Freeze / Resume & Auto-Extension');

const endBeforeFreeze = afterCollect.endDate!;
const frozenPass = await repo.toggleGymMembershipFreeze({
  businessId: gym.id,
  memberId: installmentMember.id,
  action: 'freeze',
  options: ownerA,
});
assert(
  frozenPass.isFrozen === true && frozenPass.effectiveStatus === 'frozen',
  'Freezing membership marks pass as frozen',
);

await assertRejects(
  () =>
    repo.gymMemberDailyCheckIn({
      businessSlug: gym.slug,
      phone: installmentMember.phone,
      workoutFocus: 'legs',
    }),
  'paused',
  'Frozen member is blocked from checking in while paused',
);

const resumeDate7DaysLater = addDaysToIsoDate(getTodayIsoDateKey(), 7);
const resumedPass = await repo.toggleGymMembershipFreeze({
  businessId: gym.id,
  memberId: installmentMember.id,
  action: 'resume',
  resumeDateOverride: resumeDate7DaysLater,
  options: ownerA,
});
assert(
  resumedPass.isFrozen === false &&
    resumedPass.totalFrozenDays === 7 &&
    diffDaysBetweenIsoDates(resumedPass.endDate!, endBeforeFreeze) === 7,
  'Resuming membership after 7 paused days automatically extends endDate by +7 days',
);

// ---------------------------------------------------------------------------
// 5. Streak Math, 30-Day Body Journal & Top-10 Monthly Leaderboard
// ---------------------------------------------------------------------------
console.log('\n5. Daily Streaks, 30-Day Body Journal & Monthly Streak Leaderboard');

const today = getTodayIsoDateKey();
const dayMinus2 = addDaysToIsoDate(today, -2);
const dayMinus1 = addDaysToIsoDate(today, -1);

const ci1 = await repo.gymMemberDailyCheckIn({
  businessSlug: gym.slug,
  phone: installmentMember.phone,
  workoutFocus: 'chest',
  checkInDateOverride: dayMinus2,
});
const ci2 = await repo.gymMemberDailyCheckIn({
  businessSlug: gym.slug,
  phone: installmentMember.phone,
  workoutFocus: 'back',
  checkInDateOverride: dayMinus1,
});
const ci3 = await repo.gymMemberDailyCheckIn({
  businessSlug: gym.slug,
  phone: installmentMember.phone,
  workoutFocus: 'legs',
  checkInDateOverride: today,
});
assert(
  ci1.currentStreakDays === 1 &&
    ci2.currentStreakDays === 2 &&
    ci3.currentStreakDays === 3 &&
    ci3.bestStreakDays === 3,
  'Consecutive daily check-ins accurately build 1 -> 2 -> 3-day streak',
);

const bodyEntry = await repo.logGymBodyMeasurement({
  businessSlug: gym.slug,
  phone: installmentMember.phone,
  weightKg: 75.2,
  heightCm: 176,
  waistInches: 32.5,
  chestInches: 40.0,
  bicepsInches: 15.2,
  note: 'Month 1 lean bulk check',
});
assert(
  bodyEntry.weightKg === 75.2 &&
    bodyEntry.waistInches === 32.5 &&
    bodyEntry.bmi === 24.3,
  '30-day body measurement journal logs weight, waist, chest, biceps & auto-computed BMI',
);

const leaderboard = await repo.getGymMonthlyLeaderboard(gym.slug);
const madhanRow = leaderboard.find(
  (r) => r.memberCode === installmentMember.memberCode,
);
assert(
  leaderboard.length >= 2 &&
    madhanRow !== undefined &&
    madhanRow.displayName === 'Madhan K.' &&
    madhanRow.currentStreakDays === 3,
  'Monthly Consistency Leaderboard ranks members cleanly with privacy-safe display names',
);

// ---------------------------------------------------------------------------
// 6. Supplement Bar POS, Weekly Revenue Chart & Multi-Tenant Isolation
// ---------------------------------------------------------------------------
console.log('\n6. Supplement Bar POS, Weekly Chart, Tenant Isolation & SQL Guardrails');

const seededBar = await repo.seedGymRetailStarterProducts(gym.id, ownerA);
assert(
  seededBar.length === 4 &&
    seededBar.some((p) => p.productName.includes('Whey Protein')),
  '1-Tap Starter Pack seeds 4 Supplement Bar products (Whey, Pre-Workout, Water, Bar)',
);

const whey = seededBar.find((p) => p.productName.includes('Whey'))!;
const saleRes = await repo.recordGymRetailSale({
  businessId: gym.id,
  productId: whey.id,
  quantity: 2,
  paymentMethod: 'upi',
  memberName: 'Madhan Kumar',
  options: ownerA,
});
assert(
  saleRes.sale.totalPaise === 24000 && saleRes.product.stockQty === 58,
  'Supplement Bar POS records 2 × Whey Scoop (₹240) and decrements stock (60 -> 58)',
);

const finalDash = await repo.getGymOwnerDashboard(gym.id, ownerA);
assert(
  (finalDash.retailRevenuePaise ?? 0) >= 24000 &&
    finalDash.monthlyRevenuePaise ===
      (finalDash.membershipRevenuePaise ?? 0) +
        (finalDash.retailRevenuePaise ?? 0) &&
    (finalDash.weeklyRevenueComparison ?? []).length === 4,
  'Owner Dashboard combines Membership + PT + Supplement Bar revenue & builds Week 1-4 comparison',
);

// Multi-tenant isolation checks
await assertRejects(
  () =>
    repo.collectGymBalanceDue({
      businessId: gym.id,
      memberId: installmentMember.id,
      collectedPaise: 10000,
      options: ownerB,
    }),
  'unauthorized',
  'Multi-tenant isolation: Other gym owner cannot collect balance dues',
);

await assertRejects(
  () =>
    repo.toggleGymMembershipFreeze({
      businessId: gym.id,
      memberId: installmentMember.id,
      action: 'freeze',
      options: ownerB,
    }),
  'unauthorized',
  'Multi-tenant isolation: Other gym owner cannot freeze/resume memberships',
);

await assertRejects(
  () =>
    repo.recordGymRetailSale({
      businessId: gym.id,
      productId: whey.id,
      quantity: 1,
      options: ownerB,
    }),
  'unauthorized',
  'Multi-tenant isolation: Other gym owner cannot log Supplement Bar sales',
);

// Migration 023 SQL Guardrails
const sql023 = await Deno.readTextFile(
  new URL(
    '../supabase/migrations/023_gym_flagship_pt_installments_freeze_leaderboard_retail.sql',
    import.meta.url,
  ),
);
const sqlLower = sql023.toLowerCase();
const flagshipTables = [
  'gym_trainers',
  'gym_body_measurements',
  'gym_retail_products',
  'gym_retail_sales',
  'gym_workout_sessions',
  'gym_exercises',
  'gym_workout_routines',
  'gym_workout_set_logs',
];
assert(
  flagshipTables.every(
    (t) =>
      sqlLower.includes(`alter table public.${t} enable row level security`) &&
      sqlLower.includes(`alter table public.${t} force row level security`) &&
      sqlLower.includes(`revoke all on table public.${t} from public, anon`),
  ),
  'Migration 023 enforces ENABLE + FORCE RLS and REVOKE ALL FROM public, anon on all 8 new tables',
);

assert(
  !sqlLower.includes('substring(') && sqlLower.includes('pg_catalog.substr('),
  'Migration 023 strictly obeys PostgreSQL SQL guardrail (pg_catalog.substr, zero substring())',
);

console.log(`\nSummary: ${passed} passed, ${failed} failed.\n`);
if (failed > 0) Deno.exit(1);
