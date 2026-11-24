/**
 * Verification Suite #20 — GymOS Members Directory, Live Floor Status,
 * Community Chat, Auto PR Celebrations & Member Custom Exercise Creator (Migration 027)
 *
 * Run with: deno run --allow-read --allow-env tests/verify-gym-members-chat-and-anatomical-ui.ts
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
  '\n=== Suite #20 Verification: GymOS Members Directory, Live Chat & Custom Exercises (Migration 027) ===\n',
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
  value: { localStorage: storageShim, location: { origin: 'https://vitaran-ai-reviews.vercel.app' } },
  configurable: true,
});

const repo = new MockLocalStorageRepository();
const gymA = await repo.getBusinessById('biz-iron-pulse-4');
if (!gymA) throw new Error('Seeded Iron Pulse Fitness business not found');
const ownerAOpts = { actorOwnerId: gymA.ownerId };

// Ensure a second separate gym exists to test strict multi-tenant isolation
const gymB = await repo.createBusiness({
  name: 'Titan CrossFit Studio',
  slug: 'titan-crossfit-b',
  category: 'gym',
  city: 'Bengaluru',
  googleReviewUrl: 'https://g.page/r/titan-crossfit/review',
  ownerId: 'owner-titan-crossfit-b',
  status: 'active',
  accountState: 'active',
});
// Simulate Platform Admin approval on Gym B in mock storage
const rawBizList = JSON.parse(storageShim.getItem('reviewassist_mock_businesses_v2') || '[]') as Array<Record<string, unknown>>;
for (const b of rawBizList) {
  if (b.id === gymB.id) {
    b.status = 'active';
    b.accountState = 'active';
  }
}
storageShim.setItem('reviewassist_mock_businesses_v2', JSON.stringify(rawBizList));

// Register & approve 2 active members in Gym A
const m1 = await repo.submitGymMemberRegistration({
  businessSlug: gymA.slug,
  fullName: 'Madhan Kumar',
  phone: '9888001122',
  planId: '3_months',
  fitnessGoal: 'muscle_gain',
});
await repo.ownerApproveOrRenewGymMember({
  businessId: gymA.id,
  memberId: m1.id,
  action: 'approve',
  planId: '3_months',
  amountPaidPaise: 400000,
  options: ownerAOpts,
});
await repo.gymMemberDailyCheckIn({
  businessSlug: gymA.slug,
  phone: m1.phone,
  workoutFocus: 'chest',
});

const m2 = await repo.submitGymMemberRegistration({
  businessSlug: gymA.slug,
  fullName: 'Rohan Sharma',
  phone: '9888003344',
  planId: '1_month',
  fitnessGoal: 'weight_loss',
});
await repo.ownerApproveOrRenewGymMember({
  businessId: gymA.id,
  memberId: m2.id,
  action: 'approve',
  planId: '1_month',
  amountPaidPaise: 150000,
  options: ownerAOpts,
});

// Member in Gym B
const mB = await repo.submitGymMemberRegistration({
  businessSlug: gymB.slug,
  fullName: 'Kiran GymB',
  phone: '9777001122',
  planId: '1_month',
});
await repo.ownerApproveOrRenewGymMember({
  businessId: gymB.id,
  memberId: mB.id,
  action: 'approve',
  planId: '1_month',
  amountPaidPaise: 150000,
  options: { actorOwnerId: gymB.ownerId },
});

// 1. Live Floor Directory & Community Hub
console.log('1. Members Live Floor Directory & Community Chat');
const hubInitial = await repo.getGymMembersCommunityHub({
  businessSlug: gymA.slug,
  requesterMemberId: m1.id,
});

const checkedInEntry = hubInitial.membersDirectory.find((m) => m.id === m1.id);
assert(
  Boolean(checkedInEntry?.isCheckedInToday) &&
    checkedInEntry?.todayWorkoutFocus === 'chest' &&
    hubInitial.membersDirectory.every((m) => m.id !== mB.id),
  'getGymMembersCommunityHub shows Madhan Kumar ● ON FLOOR (Chest) & strictly isolates Gym B members',
);

// 2. Sending Member Community Chat + Multi-Tenant Isolation
console.log('\n2. Member Chat Messaging & Cross-Tenant Isolation');
const sentMsg = await repo.sendGymCommunityMessage({
  businessSlug: gymA.slug,
  memberId: m1.id,
  messageText: 'Anyone near Bench 2 for a spot on 80 kg?',
});

assert(
  sentMsg.senderName === 'Madhan Kumar' &&
    sentMsg.messageType === 'chat' &&
    sentMsg.businessId === gymA.id,
  'Member chat message stored with normalized sender name & member code',
);

await assertRejects(
  () =>
    repo.getGymMembersCommunityHub({
      businessSlug: gymA.slug,
      requesterMemberId: mB.id,
    }),
  'Unauthorized',
  'Gym B member cannot read Gym A community hub or chat messages',
);

await assertRejects(
  () =>
    repo.sendGymCommunityMessage({
      businessSlug: gymA.slug,
      memberId: mB.id,
      messageText: 'Trying to spam Gym A chat',
    }),
  'Active gym membership required',
  'Gym B member cannot post messages into Gym A community chat',
);

// 3. Auto PR Celebration Message on logGymMemberWorkoutSet
console.log('\n3. Automatic PR Celebration Post in Community Chat');
const prRes = await repo.logGymMemberWorkoutSet({
  businessSlug: gymA.slug,
  memberId: m1.id,
  exerciseId: 'ex-bench-press',
  exerciseName: 'Barbell Bench Press',
  muscleGroup: 'chest',
  setNumber: 1,
  weightKg: 80,
  reps: 8,
});
assert(prRes.isPersonalRecord, 'Set logged (80kg × 8) detected as new PR');

const hubAfterPr = await repo.getGymMembersCommunityHub({
  businessSlug: gymA.slug,
  requesterMemberId: m2.id,
});
const prFeedMsg = hubAfterPr.chatMessages.find(
  (c) =>
    c.messageType === 'pr_celebration' &&
    c.messageText.includes('80 kg') &&
    c.messageText.includes('Barbell Bench Press'),
);
assert(
  Boolean(prFeedMsg),
  'Automatic 🏆 PR Celebration card posted into Gym A community chat on PR hit',
);

// 4. Member Custom Exercise Creator & Owner Moderation
console.log('\n4. Custom Exercise Creator & Owner Community Moderation');
const customEx = await repo.memberCreateCustomGymExercise({
  businessSlug: gymA.slug,
  memberId: m1.id,
  name: '1 2 Stick Agility Drill',
  muscleGroup: 'legs',
  equipment: 'bodyweight',
  animationGifUrl: null,
});
assert(
  customEx.businessId === gymA.id &&
    customEx.animationKey === 'squat' &&
    customEx.name === '1 2 Stick Agility Drill',
  'memberCreateCustomGymExercise saves custom movement scoped to Gym A with anatomical animationKey',
);

const coachPost = await repo.ownerPostOrDeleteGymCommunityMessage({
  businessId: gymA.id,
  action: 'post',
  messageText: 'Sunday Open Deadlift Challenge at 10 AM!',
  senderName: 'Coach Ravi',
  options: ownerAOpts,
});
assert(
  'messageType' in coachPost && coachPost.messageType === 'coach_announcement',
  'Owner can post official 📢 Coach Announcement into Gym A community chat',
);

await repo.ownerPostOrDeleteGymCommunityMessage({
  businessId: gymA.id,
  action: 'delete',
  messageId: sentMsg.id,
  options: ownerAOpts,
});
const msgsAfterDelete = await repo.getGymCommunityMessagesForOwner({
  businessId: gymA.id,
  options: ownerAOpts,
});
assert(
  !msgsAfterDelete.some((m) => m.id === sentMsg.id),
  'Owner moderation cleanly deletes targeted community chat message',
);

// 5. Migration 027 Security & SQL Syntax Guardrails
console.log('\n5. Migration 027 SQL & RLS Guardrails');
const sql027 = await Deno.readTextFile(
  'supabase/migrations/027_gym_members_community_chat_and_custom_exercises.sql',
);
assert(
  sql027.includes('enable row level security') &&
    sql027.includes('force row level security') &&
    sql027.includes(
      'revoke all on table public.gym_community_messages from public, anon, authenticated',
    ),
  'Migration 027 enforces ENABLE + FORCE RLS and REVOKE ALL FROM public, anon, authenticated',
);

assert(
  sql027.includes('pg_catalog.substr(') &&
    !/pg_catalog\.substring\s*\(/i.test(sql027) &&
    !/\bsubstring\s*\(/i.test(sql027),
  'Migration 027 strictly obeys PostgreSQL SQL guardrail (pg_catalog.substr, zero substring())',
);

console.log(`\nSummary: ${passed} passed, ${failed} failed.`);
if (failed > 0) {
  Deno.exit(1);
}
