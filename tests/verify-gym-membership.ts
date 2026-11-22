/**
 * Verification Suite — Module 5 & Multi-Industry Architecture:
 *   Clean Multi-Industry Routing (BistroOS / BarberOS / GymOS),
 *   Barber Personal Token QR Roundtrip,
 *   GymOS Front-Desk Signup, Payment Approval, 3-Day Automatic Expiry Radar,
 *   Daily Check-In Idempotency, WhatsApp Reminders & Multi-Tenant Isolation
 *
 * Run with: deno run --allow-read --allow-env tests/verify-gym-membership.ts
 */

import { MockLocalStorageRepository } from '../src/services/storage/MockLocalStorageRepository.ts';
import {
  encodeBarberQueueTicketQr,
  parseBarberQueueTicketQr,
} from '../src/utils/barberQueueValidation.ts';
import {
  addDaysToIsoDate,
  buildGymRenewalWhatsAppMessage,
  getGymPortalUrl,
  getGymRenewalWhatsAppLink,
  getIndustryBadgeMeta,
  getIndustryWorkspaceType,
  getPrimaryCustomerQrUrlForBusiness,
  getTodayIsoDateKey,
  isGymCategory,
  normalizeGymPhone,
  validateGymConfigInput,
  validateGymRegistrationInput,
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
  '\n=== Module 5 Verification: Multi-Industry Routing + GymOS Membership & 3-Day Expiry Tracker ===\n',
);

// ---------------------------------------------------------------------------
// 1. Multi-Industry Router, QR Standee Router & Barber Token QR Utilities
// ---------------------------------------------------------------------------
console.log('1. Multi-Industry Router, Standee Router & Barber Token QR');

assert(
  getIndustryWorkspaceType('restaurant') === 'restaurant' &&
    getIndustryWorkspaceType('cafe') === 'restaurant' &&
    getIndustryWorkspaceType('barber') === 'barber' &&
    getIndustryWorkspaceType('salon') === 'barber' &&
    getIndustryWorkspaceType('gym') === 'gym' &&
    isGymCategory('gym') &&
    !isGymCategory('barber'),
  'getIndustryWorkspaceType locks restaurant/cafe -> BistroOS, barber/salon -> BarberOS, gym -> GymOS',
);

assert(
  getIndustryBadgeMeta('restaurant').moduleName === 'BistroOS' &&
    getIndustryBadgeMeta('barber').moduleName === 'BarberOS' &&
    getIndustryBadgeMeta('gym').moduleName === 'GymOS',
  'Admin Industry Badges cleanly identify BistroOS, BarberOS, and GymOS',
);

assert(
  getPrimaryCustomerQrUrlForBusiness({
    slug: 'urban-kitchen',
    category: 'restaurant',
  }).endsWith('/r/urban-kitchen/menu') &&
    getPrimaryCustomerQrUrlForBusiness({
      slug: 'crown-cuts',
      category: 'barber',
    }).endsWith('/r/crown-cuts/queue') &&
    getPrimaryCustomerQrUrlForBusiness({
      slug: 'iron-pulse',
      category: 'gym',
    }).endsWith('/r/iron-pulse/gym'),
  'Smart Customer QR Standee Router points restaurant -> /menu, barber -> /queue, gym -> /gym',
);

const encodedTokenQr = encodeBarberQueueTicketQr(
  'crown-cuts-barber',
  'bqt-123456',
  4,
);
const parsedQr = parseBarberQueueTicketQr(encodedTokenQr);
const parsedManual = parseBarberQueueTicketQr('#4');
assert(
  parsedQr?.businessSlug === 'crown-cuts-barber' &&
    parsedQr?.ticketId === 'bqt-123456' &&
    parsedQr?.tokenNumber === 4 &&
    parsedManual?.tokenNumber === 4,
  'Barber Customer Personal Token QR encodes and parses both QR payload and manual #token',
);

assert(
  normalizeGymPhone('+91 98765-43210') === '9876543210' &&
    normalizeGymPhone('09876543210') === '9876543210' &&
    getGymPortalUrl('iron-pulse-gym').endsWith('/r/iron-pulse-gym/gym'),
  'Gym phone normalization and portal URL generator work cleanly',
);

assert(
  validateGymConfigInput('biz-iron-pulse-4', {
    isRegistrationOpen: true,
    renewalAlertDays: 3,
  }).ok &&
    !validateGymRegistrationInput({
      businessSlug: 'iron-pulse-gym',
      fullName: 'A',
      phone: '123',
      planId: '1_month',
    }).ok,
  'Gym config and registration validators enforce bounds and required fields',
);

// ---------------------------------------------------------------------------
// 2. Public Gym Portal & 10-Second New Member Registration
// ---------------------------------------------------------------------------
console.log('\n2. Public Gym Portal & Pending Desk Payment Signup');

const repo = new MockLocalStorageRepository();
const businesses = await repo.getBusinesses();
const gym = businesses.find((b) => b.slug === 'iron-pulse-gym');
assert(
  Boolean(gym) && gym?.category === 'gym' && gym?.status === 'active',
  'Loaded active Gym business (Iron Pulse Fitness, category: gym)',
);
if (!gym) throw new Error('Missing seed gym');

const ownerA = { actorOwnerId: gym.ownerId! };
const ownerB = { actorOwnerId: 'owner-other-tenant-77' };

// Newly created pending gym is hidden from public portal until approved
const pendingGym = await repo.createBusiness({
  name: 'Pending Muscle Lab',
  category: 'gym',
  city: 'Pune',
  slug: 'pending-muscle-lab',
  googleReviewUrl: 'https://g.page/r/pending-muscle/review',
  googleReviewUrlIsPlaceholder: false,
  ownerId: 'owner-pending-gym',
});
assert(
  (await repo.getPublicGymPortal(pendingGym.slug)) === null,
  'Pending gym is hidden from public /r/:slug/gym portal until admin approval',
);

const portal = await repo.getPublicGymPortal(gym.slug);
assert(
  portal !== null &&
    portal.config.plans.length === 4 &&
    portal.config.renewalAlertDays === 3,
  'getPublicGymPortal loads 4 default plans (1M/3M/6M/1Y) and 3-day expiry radar config',
);

const newSignup = await repo.submitGymMemberRegistration({
  businessSlug: gym.slug,
  fullName: 'Ananya Verma',
  phone: '+91 90000 11223',
  planId: '3_months',
});
assert(
  newSignup.status === 'pending_approval' &&
    newSignup.effectiveStatus === 'pending_approval' &&
    newSignup.memberCode.startsWith('GYM-') &&
    newSignup.durationDays === 90 &&
    newSignup.feePaise === 400000 &&
    newSignup.phone === '9000011223',
  'New member registration (Ananya Verma, 3 Months ₹4,000) saved as pending_approval',
);

// Pending member cannot check in before payment is approved
await assertRejects(
  () =>
    repo.gymMemberDailyCheckIn({
      businessSlug: gym.slug,
      phone: '9000011223',
    }),
  'pending payment',
  'Blocks daily check-in for pending_approval member before desk payment',
);

// ---------------------------------------------------------------------------
// 3. Owner Desk Payment Approval, End-Date Calculation & Daily Check-In
// ---------------------------------------------------------------------------
console.log('\n3. Payment Approval, Auto End-Date Math & Daily Check-In');

const today = getTodayIsoDateKey();
const approvedAnanya = await repo.ownerApproveOrRenewGymMember({
  businessId: gym.id,
  memberId: newSignup.id,
  action: 'approve',
  staffLabel: 'Owner Desk',
  options: ownerA,
});
assert(
  approvedAnanya.status === 'active' &&
    approvedAnanya.effectiveStatus === 'active' &&
    approvedAnanya.startDate === today &&
    approvedAnanya.endDate === addDaysToIsoDate(today, 90) &&
    approvedAnanya.daysRemaining === 90,
  'Approve Payment automatically calculates endDate = today + 90 days and activates pass',
);

const lookedUpPass = await repo.lookupGymMemberPass({
  businessSlug: gym.slug,
  phone: '+91 90000-11223',
});
assert(
  lookedUpPass !== null &&
    lookedUpPass.id === approvedAnanya.id &&
    lookedUpPass.daysRemaining === 90 &&
    lookedUpPass.checkedInToday === false,
  'Returning member pass lookup matches normalized phone and reports 90 days remaining',
);

const checkIn1 = await repo.gymMemberDailyCheckIn({
  businessSlug: gym.slug,
  phone: '9000011223',
});
assert(
  checkIn1.alreadyCheckedInToday === false &&
    checkIn1.totalCheckIns === 1 &&
    checkIn1.daysRemaining === 90,
  '1-tap Daily Check-In logs attendance and increments totalCheckIns to 1',
);

const checkIn2 = await repo.gymMemberDailyCheckIn({
  businessSlug: gym.slug,
  phone: '9000011223',
});
assert(
  checkIn2.alreadyCheckedInToday === true && checkIn2.totalCheckIns === 1,
  'Repeat Daily Check-In on same day is idempotent (alreadyCheckedInToday: true, count stays 1)',
);

await assertRejects(
  () =>
    repo.submitGymMemberRegistration({
      businessSlug: gym.slug,
      fullName: 'Ananya Verma',
      phone: '9000011223',
      planId: '1_month',
    }),
  'already exists',
  'Blocks duplicate registration for already-active member phone',
);

// ---------------------------------------------------------------------------
// 4. Automatic 3-Day Renewal Radar, Expired Protection & 1-Tap Renewal
// ---------------------------------------------------------------------------
console.log('\n4. Automatic 3-Day Renewal Radar, Expired Guard & Renewals');

const dash = await repo.getGymOwnerDashboard(gym.id, ownerA);
const pendingList = dash.members.filter(
  (m) => m.effectiveStatus === 'pending_approval',
);
const expiringSoonList = dash.members.filter(
  (m) => m.effectiveStatus === 'expiring_soon',
);
const expiredList = dash.members.filter((m) => m.effectiveStatus === 'expired');

assert(
  pendingList.some((m) => m.fullName === 'Rahul Sharma') &&
    expiringSoonList.some(
      (m) => m.fullName === 'Priya Nair' && m.daysRemaining === 2,
    ) &&
    expiredList.some((m) => m.fullName === 'Arjun Mehta'),
  'Owner Renewal Radar cleanly separates Pending (Rahul), Urgent <=3d (Priya: 2d), and Expired (Arjun)',
);

const priya = expiringSoonList.find((m) => m.fullName === 'Priya Nair')!;
const arjun = expiredList.find((m) => m.fullName === 'Arjun Mehta')!;

const reminderText = buildGymRenewalWhatsAppMessage(gym.name, priya);
const waLink = getGymRenewalWhatsAppLink(gym.name, priya);
assert(
  reminderText.includes('Priya Nair') &&
    reminderText.includes('2 days') &&
    waLink.startsWith('https://wa.me/919876500002?text='),
  'WhatsApp renewal reminder & wa.me link format accurately for urgent members',
);

// Expired member CANNOT check in until renewed!
await assertRejects(
  () =>
    repo.gymMemberDailyCheckIn({
      businessSlug: gym.slug,
      phone: arjun.phone,
    }),
  'expired',
  'Expired member (Arjun Mehta) is blocked from checking in until renewed',
);

// Renew Priya (+30 days stacks cleanly on her remaining 2 days => 32 days remaining)
const renewedPriya = await repo.ownerApproveOrRenewGymMember({
  businessId: gym.id,
  memberId: priya.id,
  action: 'renew',
  durationDays: 30,
  options: ownerA,
});
assert(
  renewedPriya.effectiveStatus === 'active' &&
    renewedPriya.daysRemaining === 32,
  '1-tap Renew (+30 Days) stacks on remaining days for urgent member (2d -> 32d active)',
);

// Renew Expired Arjun (+30 days starts fresh from today => 30 days remaining)
const renewedArjun = await repo.ownerApproveOrRenewGymMember({
  businessId: gym.id,
  memberId: arjun.id,
  action: 'renew',
  durationDays: 30,
  options: ownerA,
});
assert(
  renewedArjun.effectiveStatus === 'active' &&
    renewedArjun.daysRemaining === 30,
  'Renewing expired member starts fresh from today (+30 days active)',
);

const arjunCheckIn = await repo.gymMemberDailyCheckIn({
  businessSlug: gym.slug,
  phone: arjun.phone,
});
assert(
  arjunCheckIn.alreadyCheckedInToday === false &&
    arjunCheckIn.daysRemaining === 30,
  'Previously expired member can immediately check in after owner renewal',
);

// ---------------------------------------------------------------------------
// 5. Pause Registrations & Strict Multi-Tenant Isolation
// ---------------------------------------------------------------------------
console.log('\n5. Registration Pause Guard & Multi-Tenant Isolation');

await repo.updateGymConfig(
  gym.id,
  {
    isRegistrationOpen: false,
    renewalAlertDays: 5,
  },
  ownerA,
);

await assertRejects(
  () =>
    repo.submitGymMemberRegistration({
      businessSlug: gym.slug,
      fullName: 'Paused Guest',
      phone: '9111122222',
      planId: '1_month',
    }),
  'paused',
  'Blocks new member registrations when isRegistrationOpen = false',
);

await assertRejects(
  () => repo.getGymConfig(gym.id, ownerB),
  'unauthorized',
  'Multi-tenant isolation: Owner B cannot read Owner A gym_configs',
);

await assertRejects(
  () =>
    repo.updateGymConfig(
      gym.id,
      { isRegistrationOpen: true, renewalAlertDays: 3 },
      ownerB,
    ),
  'unauthorized',
  'Multi-tenant isolation: Owner B cannot update Owner A gym_configs',
);

await assertRejects(
  () => repo.getGymOwnerDashboard(gym.id, ownerB),
  'unauthorized',
  'Multi-tenant isolation: Owner B cannot read Owner A gym member dashboard',
);

await assertRejects(
  () =>
    repo.ownerApproveOrRenewGymMember({
      businessId: gym.id,
      memberId: priya.id,
      action: 'suspend',
      options: ownerB,
    }),
  'unauthorized',
  'Multi-tenant isolation: Owner B cannot approve/renew/suspend Owner A gym members',
);

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------
console.log(
  `\n=== Module 5 Verification Complete: ${passed} passed, ${failed} failed ===\n`,
);

if (failed > 0) {
  Deno.exit(1);
}
