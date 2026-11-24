/**
 * Verification Suite #21 — GymOS Member Self-Plan Split Customization,
 * Morning vs Evening Batch Shifts, Per-Gym Video/GIF Exercise Media Overrides,
 * Dynamic Gym Branding/Logo & Migration 028 SQL Guardrails
 *
 * Run with: deno run --allow-read --allow-env tests/verify-gym-self-plan-shifts-branding.ts
 */

import { MockLocalStorageRepository } from '../src/services/storage/MockLocalStorageRepository.ts';

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
  '\n=== Suite #21 Verification: Self-Plan, Shifts, Exercise Media & Branding (Migration 028) ===\n',
);

const memStorage = new Map<string, string>();
const storageShim = {
  getItem: (k: string) => memStorage.get(k) ?? null,
  setItem: (k: string, v: string) => {
    memStorage.set(k, v);
  },
  removeItem: (k: string) => {
    memStorage.delete(k);
  },
  clear: () => {
    memStorage.clear();
  },
  key: (i: number) => Array.from(memStorage.keys())[i] ?? null,
  get length() {
    return memStorage.size;
  },
};
Object.defineProperty(globalThis, 'localStorage', {
  value: storageShim,
  configurable: true,
});
Object.defineProperty(globalThis, 'window', {
  value: {
    localStorage: storageShim,
    location: { origin: 'https://vitaran-ai-reviews.vercel.app' },
  },
  configurable: true,
});

const repo = new MockLocalStorageRepository();
const gymA = await repo.getBusinessById('biz-iron-pulse-4');
if (!gymA) throw new Error('Seeded Iron Pulse Fitness business not found');
const ownerAOpts = { actorOwnerId: gymA.ownerId };

const gymB = await repo.createBusiness({
  name: 'Metro Barbell Club',
  slug: 'metro-barbell-b',
  category: 'gym',
  city: 'Hyderabad',
  googleReviewUrl: 'https://g.page/r/metro-barbell/review',
  ownerId: 'owner-metro-barbell-b',
  status: 'active',
  accountState: 'active',
});
// Simulate Platform Admin approval on Gym B in mock storage
const rawBizList = JSON.parse(
  storageShim.getItem('reviewassist_mock_businesses_v2') || '[]',
) as Array<Record<string, unknown>>;
for (const b of rawBizList) {
  if (b.id === gymB.id) {
    b.status = 'active';
    b.accountState = 'active';
  }
}
storageShim.setItem(
  'reviewassist_mock_businesses_v2',
  JSON.stringify(rawBizList),
);
const ownerBOpts = { actorOwnerId: gymB.ownerId };

// 1. Register two members in Gym A with Morning & Evening preferred batches
console.log('1. Testing Morning vs Evening Batch Registration & Shift Tracking...');
const morningMem = await repo.submitGymMemberRegistration({
  businessSlug: gymA.slug,
  fullName: 'Kiran Morning',
  phone: '9888000011',
  planId: '3_months',
  fitnessGoal: 'muscle_gain',
  preferredShift: 'morning',
  startingWeightKg: 72,
  targetWeightKg: 78,
});
assert(
  morningMem.preferredShift === 'morning',
  'Registration persists preferredShift = morning',
  morningMem.preferredShift,
);

const eveningMem = await repo.submitGymMemberRegistration({
  businessSlug: gymA.slug,
  fullName: 'Rohan Evening',
  phone: '9888000022',
  planId: '1_month',
  fitnessGoal: 'weight_loss',
  preferredShift: 'evening',
});
assert(
  eveningMem.preferredShift === 'evening',
  'Registration persists preferredShift = evening',
  eveningMem.preferredShift,
);

// Pending member blocked from self-plan edit
await assertRejects(
  () =>
    repo.updateGymMemberSelfPlan({
      businessSlug: gymA.slug,
      memberId: morningMem.id,
      scheduleMode: 'fixed_week',
      weeklySchedule: [],
    }),
  'active gym membership required',
  'Pending member blocked from customizing workout split before approval',
);

// Approve both members (with PT trainer on morningMem)
const dashBefore = await repo.getGymOwnerDashboard(gymA.id, ownerAOpts);
const seededTrainer =
  dashBefore.trainers[0] ??
  (await repo.createGymTrainer(
    gymA.id,
    { trainerName: 'Coach Vikram', specialty: 'Strength & Hypertrophy', defaultCommissionPct: 50 },
    ownerAOpts,
  ));
const trainerId = seededTrainer.id;

const activeMorning = await repo.ownerApproveOrRenewGymMember({
  businessId: gymA.id,
  memberId: morningMem.id,
  action: 'approve',
  planId: '3_months',
  feePaise: 400000,
  amountPaidPaise: 400000,
  ptTrainerId: trainerId,
  ptSessions: 12,
  ptFeePaise: 600000,
  ...ownerAOpts,
});
const activeEvening = await repo.ownerApproveOrRenewGymMember({
  businessId: gymA.id,
  memberId: eveningMem.id,
  action: 'approve',
  planId: '1_month',
  feePaise: 150000,
  amountPaidPaise: 150000,
  ...ownerAOpts,
});

// Perform daily check-ins for both members
const ciMorning = await repo.gymMemberDailyCheckIn({
  businessSlug: gymA.slug,
  phone: activeMorning.phone,
  workoutFocus: 'chest',
  isPtSession: Boolean(trainerId),
});
assert(
  ciMorning.checkInShift === 'morning',
  'Morning member daily check-in records checkInShift = morning',
  ciMorning,
);

const ciEvening = await repo.gymMemberDailyCheckIn({
  businessSlug: gymA.slug,
  phone: activeEvening.phone,
  workoutFocus: 'back',
});
assert(
  ciEvening.checkInShift === 'evening',
  'Evening member daily check-in records checkInShift = evening',
  ciEvening,
);

// Switch activeMorning to flexible
const updatedShiftMember = await repo.updateGymMemberPreferredShift({
  businessSlug: gymA.slug,
  memberId: activeMorning.id,
  preferredShift: 'flexible',
});
assert(
  updatedShiftMember.preferredShift === 'flexible',
  'updateGymMemberPreferredShift updates shift to flexible',
  updatedShiftMember.preferredShift,
);

const dashAfterCheckIns = await repo.getGymOwnerDashboard(gymA.id, ownerAOpts);
assert(
  dashAfterCheckIns.batchStats &&
    dashAfterCheckIns.batchStats.morningCheckedIn >= 1 &&
    dashAfterCheckIns.batchStats.eveningCheckedIn >= 1,
  'Owner Dashboard computes Morning vs Evening checked-in batchStats',
  dashAfterCheckIns.batchStats,
);

// 2. Test Member Self-Plan Split Customization
console.log('\n2. Testing Member Self-Plan Split Customization...');
const customPlan = await repo.updateGymMemberSelfPlan({
  businessSlug: gymA.slug,
  memberId: activeMorning.id,
  planTitle: 'Kiran Custom Push Pull Split',
  scheduleMode: 'rotation',
  weeklySchedule: [
    {
      dayKey: 'mon',
      dayLabel: 'Mo',
      focusTitle: 'Heavy Chest & Triceps',
      isRestDay: false,
      exercises: [
        {
          name: 'Barbell Bench Press',
          muscleGroup: 'chest',
          sets: 4,
          reps: '6-8',
          restSeconds: 90,
        },
        {
          name: 'Cable Flyes',
          muscleGroup: 'chest',
          sets: 3,
          reps: '12-15',
          restSeconds: 60,
        },
      ],
    },
    {
      dayKey: 'tue',
      dayLabel: 'Tu',
      focusTitle: 'Active Recovery Walk',
      isRestDay: true,
      exercises: [],
    },
  ],
});

assert(
  customPlan.scheduleMode === 'rotation' &&
    customPlan.weeklySchedule.length === 2 &&
    customPlan.weeklySchedule[0].focusTitle === 'Heavy Chest & Triceps',
  'Member self-plan saves rotation mode & custom weekday exercises',
  customPlan,
);

// 3. Test Owner Per-Exercise Real-Person Video/GIF Overrides + Isolation
console.log('\n3. Testing Real-Person Exercise Video/GIF Media & Tenant Isolation...');
const mp4Url = 'https://cdn.example.com/workouts/barbell-bench-press-real.mp4';
const mediaRes = await repo.ownerUpsertGymExerciseMedia(
  {
    businessId: gymA.id,
    exerciseKey: 'Barbell Bench Press',
    mediaUrl: mp4Url,
  },
  ownerAOpts,
);
assert(
  mediaRes.mediaUrl === mp4Url && mediaRes.mediaType === 'video',
  'ownerUpsertGymExerciseMedia detects video URL for Barbell Bench Press',
  mediaRes,
);

// Unauthorized owner blocked from modifying Gym A media
await assertRejects(
  () =>
    repo.ownerUpsertGymExerciseMedia(
      {
        businessId: gymA.id,
        exerciseKey: 'Barbell Bench Press',
        mediaUrl: 'https://evil.example.com/hijack.mp4',
      },
      ownerBOpts,
    ),
  'Unauthorized',
  'Cross-tenant owner blocked from altering Gym A exercise video/GIF',
);

const hubA = await repo.getGymMemberAthleteHub({
  businessSlug: gymA.slug,
  memberId: activeMorning.id,
});
const benchA = hubA?.exerciseCatalog.find(
  (e) => e.name.toLowerCase() === 'barbell bench press',
);
assert(
  benchA?.animationGifUrl === mp4Url,
  'Gym A Athlete Hub returns custom real-person video URL for Barbell Bench Press',
  benchA,
);
assert(
  hubA?.coachPlan?.planTitle === 'Kiran Custom Push Pull Split' &&
    hubA?.preferredShift === 'flexible' &&
    (hubA?.ptRemainingSessions ?? 0) >= 0,
  'Athlete Hub hydrates custom plan, preferredShift, and PT info together',
  {
    planTitle: hubA?.coachPlan?.planTitle,
    shift: hubA?.preferredShift,
    ptTrainerName: hubA?.ptTrainerName,
    ptRem: hubA?.ptRemainingSessions,
  },
);

const catB = await repo.getGymExerciseCatalog(gymB.id, ownerBOpts);
const benchB = catB.find((e) => e.name.toLowerCase() === 'barbell bench press');
assert(
  !benchB?.animationGifUrl,
  'Gym B global exercise catalog remains cleanly isolated without Gym A video override',
  benchB,
);

// 4. Test Dynamic Gym Branding, Custom Theme Color & Gym Logo
console.log('\n4. Testing Gym Branding Theme Presets, Hex Accent & Custom Logo...');
const brandedA = await repo.ownerUpdateGymBranding(
  {
    businessId: gymA.id,
    themePreset: 'crimson_iron',
    accentColor: '#ef4444',
    logoUrl: 'https://cdn.example.com/logos/iron-pulse-logo.png',
  },
  ownerAOpts,
);
assert(
  brandedA.themePreset === 'crimson_iron' &&
    brandedA.accentColor === '#EF4444' &&
    brandedA.logoUrl === 'https://cdn.example.com/logos/iron-pulse-logo.png',
  'ownerUpdateGymBranding persists normalized theme preset, uppercase hex & logo URL',
  brandedA,
);

const publicA = await repo.getPublicGymPortal(gymA.slug);
const publicB = await repo.getPublicGymPortal(gymB.slug);
assert(
  publicA?.config.accentColor === '#EF4444' &&
    publicA?.config.logoUrl === 'https://cdn.example.com/logos/iron-pulse-logo.png',
  'Public Gym A portal exposes custom branding color and logo URL',
  publicA?.config,
);
assert(
  publicB?.config.accentColor === '#C8F135' && !publicB?.config.logoUrl,
  'Gym B keeps independent default Volt Lime theme & no cross-tenant logo leak',
  publicB?.config,
);

await assertRejects(
  () =>
    repo.ownerUpdateGymBranding(
      {
        businessId: gymA.id,
        themePreset: 'solar_gold',
        accentColor: '#F59E0B',
      },
      ownerBOpts,
    ),
  'Unauthorized',
  'Cross-tenant owner blocked from updating Gym A branding theme',
);

// 5. Audit Migration 028 SQL Guardrails
console.log('\n5. Auditing Migration 028 PostgreSQL Security & SQL Guardrails...');
const sqlText = await Deno.readTextFile(
  './supabase/migrations/028_gym_self_plan_shift_batches_and_media.sql',
);
assert(
  sqlText.includes('pg_catalog.substr(') &&
    !/\bsubstring\s*\(/i.test(sqlText),
  'Migration 028 uses pg_catalog.substr strictly and avoids substring()',
);
assert(
  sqlText.includes('enable row level security') &&
    sqlText.includes('force row level security') &&
    sqlText.includes('revoke all on table public.gym_exercise_media_overrides from public, anon, authenticated'),
  'Migration 028 enables & forces RLS and revokes blanket table privileges',
);
assert(
  sqlText.includes('set search_path = pg_catalog, public, pg_temp') &&
    sqlText.includes(
      'revoke all on function public.owner_update_gym_branding(uuid, text, text, text) from public, anon',
    ) &&
    sqlText.includes(
      'revoke all on function public.owner_upsert_gym_exercise_media(uuid, text, text, text) from public, anon',
    ) &&
    sqlText.includes(
      'revoke all on function public.get_gym_members_batch_stats(uuid) from public, anon',
    ),
  'Migration 028 sets hardened search_path & revokes anon execution on owner RPCs',
);

console.log(
  `\n=== Suite #21 Complete: ${passed} passed, ${failed} failed ===\n`,
);
if (failed > 0) Deno.exit(1);
