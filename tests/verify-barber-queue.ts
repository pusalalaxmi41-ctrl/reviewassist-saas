/**
 * Verification Suite — Module 4:
 *   Barber & Salon Live Queue Timer, Broadcast Delays,
 *   Individual Barber PIN Authentication, Shared Loyalty Star Credit & Multi-Tenant Isolation
 *
 * Run with: deno run --allow-read --allow-env tests/verify-barber-queue.ts
 */

import { MockLocalStorageRepository } from '../src/services/storage/MockLocalStorageRepository.ts';
import {
  DEFAULT_BARBER_SERVICES,
  getBarberQueueUrl,
  getBarberStaffUrl,
  isBarberOrSalonCategory,
  validateBarberDelayMinutes,
  validateBarberQueueConfigInput,
  validateJoinBarberQueueInput,
} from '../src/utils/barberQueueValidation.ts';
import {
  generateNextStaffCode,
  hashStaffPin,
  STAFF_ROLE_METADATA,
} from '../src/utils/restaurantValidation.ts';

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
  '\n=== Module 4 Verification: Barber & Salon Live Queue Timer, Broadcast Delays & Loyalty Integration ===\n',
);

// ---------------------------------------------------------------------------
// 1. Validation & Utility Unit Tests
// ---------------------------------------------------------------------------
console.log('1. Barber Queue Validation & Role Utilities');

assert(
  isBarberOrSalonCategory('barber') && isBarberOrSalonCategory('salon'),
  'isBarberOrSalonCategory recognizes both "barber" and "salon"',
);
assert(
  !isBarberOrSalonCategory('restaurant') && !isBarberOrSalonCategory('cafe'),
  'isBarberOrSalonCategory returns false for restaurant/cafe categories',
);
assert(
  getBarberQueueUrl('crown-cuts').endsWith('/r/crown-cuts/queue'),
  'getBarberQueueUrl generates /r/:slug/queue URL',
);
assert(
  getBarberStaffUrl('crown-cuts').endsWith('/r/crown-cuts/barber-staff'),
  'getBarberStaffUrl generates /r/:slug/barber-staff URL',
);
assert(
  STAFF_ROLE_METADATA.barber.codePrefix === 'BAR' &&
    generateNextStaffCode('barber', []) === 'BAR-01',
  'Barber staff role uses BAR-01 code prefix',
);
assert(
  validateBarberDelayMinutes(10).ok &&
    validateBarberDelayMinutes(5).ok &&
    validateBarberDelayMinutes(30).ok,
  'validateBarberDelayMinutes accepts allowed increments (5, 10, 15, 20, 30)',
);
assert(
  !validateBarberDelayMinutes(7).ok && !validateBarberDelayMinutes(-5).ok,
  'validateBarberDelayMinutes rejects arbitrary or negative delay values',
);
assert(
  validateBarberQueueConfigInput('biz-crown-cuts-3', {
    isQueueOpen: true,
    avgServiceMinutes: 20,
    maxQueueSize: 25,
    awardStarOnCompletion: true,
    services: DEFAULT_BARBER_SERVICES,
  }).ok,
  'validateBarberQueueConfigInput accepts valid default configuration',
);
assert(
  !validateJoinBarberQueueInput({
    businessSlug: 'crown-cuts',
    guestName: '   ',
    serviceName: 'Classic Haircut',
  }).ok,
  'validateJoinBarberQueueInput rejects blank guest name',
);

// ---------------------------------------------------------------------------
// 2. Barber Shop Setup, Individual Barber PIN Roster & Loyalty Reward
// ---------------------------------------------------------------------------
console.log('\n2. Barber Shop Setup, Barber PIN Roster & Loyalty Setup');

const repo = new MockLocalStorageRepository();
const businesses = await repo.getBusinesses();
const barberShop = businesses.find((b) => b.slug === 'crown-cuts-barber');
assert(
  Boolean(barberShop) &&
    barberShop?.status === 'active' &&
    barberShop?.category === 'barber',
  'Loaded active Barber Shop business (Crown Cuts Barbershop, category: barber)',
);
if (!barberShop) {
  throw new Error('Missing seed barber shop');
}

const ownerA = { actorOwnerId: barberShop.ownerId! };
const ownerB = { actorOwnerId: 'owner-other-tenant-77' };

// Verify newly created pending barber shop is gated from public queue until active
const pendingSalon = await repo.createBusiness({
  name: 'Pending Grooming Lounge',
  category: 'salon',
  city: 'Mumbai',
  slug: 'pending-grooming-lounge',
  googleReviewUrl: 'https://g.page/r/pending-grooming/review',
  googleReviewUrlIsPlaceholder: false,
  ownerId: 'owner-pending-salon',
});
const pendingPublicStatus = await repo.getPublicBarberQueueStatus(
  pendingSalon.slug,
);
assert(
  pendingPublicStatus === null,
  'Pending salon is hidden from public queue endpoint until approved',
);

// Configure barber queue settings & default services
const initialConfig = await repo.updateBarberQueueConfig(
  barberShop.id,
  {
    isQueueOpen: true,
    avgServiceMinutes: 20,
    maxQueueSize: 20,
    awardStarOnCompletion: true,
    services: [
      {
        id: 'haircut',
        name: 'Classic Haircut',
        durationMinutes: 20,
        pricePaise: 20000,
      },
      {
        id: 'beard',
        name: 'Beard Trim & Styling',
        durationMinutes: 15,
        pricePaise: 15000,
      },
      {
        id: 'combo',
        name: 'Haircut + Beard Combo',
        durationMinutes: 35,
        pricePaise: 30000,
      },
    ],
  },
  ownerA,
);
assert(
  initialConfig.isQueueOpen === true &&
    initialConfig.services.length === 3 &&
    initialConfig.awardStarOnCompletion === true,
  'Saved Barber Queue config with 3 services and automatic star completion enabled',
);

// Add a Loyalty Reward for the Barber Shop (shared rewards catalogue)
await repo.createRestaurantReward(
  barberShop.id,
  {
    title: 'Free Beard Trim',
    description: 'Redeem after 5 verified haircuts',
    starsRequired: 5,
    isActive: true,
    displayOrder: 1,
  },
  ownerA,
);

// Add Barber staff member Arjun (BAR-01, PIN 4321) without touching restaurant_profiles!
const arjunPinHash = await hashStaffPin(barberShop.slug, '4321');
const wrongPinHash = await hashStaffPin(barberShop.slug, '9999');

const arjunStaff = await repo.createRestaurantStaffMember(
  barberShop.id,
  {
    staffCode: 'BAR-01',
    fullName: 'Arjun',
    role: 'barber',
    pinHash: arjunPinHash,
    isActive: true,
  },
  ownerA,
);
assert(
  arjunStaff.staffCode === 'BAR-01' && arjunStaff.role === 'barber',
  'Created individual barber staff member Arjun (BAR-01) in shared roster',
);

// Public Barber Staff login directory works for Barber/Salon without enabling restaurant menu
const staffDir = await repo.getPublicStaffLoginDirectory(barberShop.slug);
assert(
  staffDir.length === 1 &&
    staffDir[0].staffCode === 'BAR-01' &&
    staffDir[0].role === 'barber',
  'getPublicStaffLoginDirectory lists Arjun (BAR-01) for Barber Shop out-of-the-box',
);

// Authenticate Arjun with BAR-01 + PIN 4321
const arjunAuth = await repo.verifyStaffMemberPin({
  businessSlug: barberShop.slug,
  staffCode: 'BAR-01',
  staffPinHash: arjunPinHash,
});
assert(
  arjunAuth.staffCode === 'BAR-01' &&
    arjunAuth.staffLabel === 'Arjun (BAR-01)' &&
    arjunAuth.role === 'barber',
  'verifyStaffMemberPin authenticates Arjun (BAR-01) with personal SHA-256 PIN',
);

await assertRejects(
  () =>
    repo.verifyStaffMemberPin({
      businessSlug: barberShop.slug,
      staffCode: 'BAR-01',
      staffPinHash: wrongPinHash,
    }),
  'invalid',
  'verifyStaffMemberPin rejects wrong Barber PIN',
);

// ---------------------------------------------------------------------------
// 3. Walk-In Queue Joining, Sequential Daily Tokens & Initial Wait Calculation
// ---------------------------------------------------------------------------
console.log('\n3. Queue Joining, Sequential Daily Tokens & Wait Calculation');

const join1 = await repo.joinBarberQueue({
  businessSlug: barberShop.slug,
  guestName: 'Vikram',
  phone: '+91 98765 43210',
  serviceName: 'Classic Haircut',
});
assert(
  join1.ticket.tokenNumber === 1 &&
    join1.position === 1 &&
    join1.estimatedWaitMinutes === 0 &&
    Boolean(join1.ticket.customerId),
  'Guest 1 (Vikram) assigned Token #1, Position 1, 0m wait & auto-linked Loyalty customer',
);

const join2 = await repo.joinBarberQueue({
  businessSlug: barberShop.slug,
  guestName: 'Rohan',
  phone: '+91 99001 12233',
  serviceName: 'Beard Trim & Styling',
});
assert(
  join2.ticket.tokenNumber === 2 &&
    join2.position === 2 &&
    join2.estimatedWaitMinutes === 20 &&
    join2.ticket.durationMinutes === 15,
  'Guest 2 (Rohan) assigned Token #2, Position 2, 20m wait (after Vikram 20m haircut)',
);

const join3 = await repo.joinBarberQueue({
  businessSlug: barberShop.slug,
  guestName: 'Kabir',
  serviceName: 'Haircut + Beard Combo',
});
assert(
  join3.ticket.tokenNumber === 3 &&
    join3.position === 3 &&
    join3.estimatedWaitMinutes === 35 &&
    join3.ticket.durationMinutes === 35 &&
    join3.ticket.customerId === null,
  'Guest 3 (Kabir, no phone) assigned Token #3, Position 3, 35m wait (20m + 15m)',
);

const statusBeforeDelay = await repo.getPublicBarberQueueStatus(
  barberShop.slug,
);
assert(
  statusBeforeDelay !== null &&
    statusBeforeDelay.waitingCount === 3 &&
    statusBeforeDelay.nowServing === null &&
    statusBeforeDelay.estimatedWaitForNewGuestMinutes === 70 &&
    statusBeforeDelay.rewards.length === 1 &&
    statusBeforeDelay.rewards[0].title === 'Free Beard Trim',
  'Public queue snapshot shows 3 waiting, 70m total wait for new guest, and active Loyalty Reward',
);

// ---------------------------------------------------------------------------
// 4. Broadcast Delay (+10 Mins) Propagation Across All Waiting Guests
// ---------------------------------------------------------------------------
console.log('\n4. Broadcast Delay (+10 Mins) Propagation');

await assertRejects(
  () =>
    repo.barberExtendQueueTimer({
      businessSlug: barberShop.slug,
      addMinutes: 7 as 10,
      staffPinHash: arjunPinHash,
    }),
  'extension minutes',
  'Rejects invalid delay increment (+7 mins)',
);

await assertRejects(
  () =>
    repo.barberExtendQueueTimer({
      businessSlug: barberShop.slug,
      addMinutes: 10,
      staffPinHash: wrongPinHash,
    }),
  'invalid staff pin',
  'Rejects broadcast delay with invalid Barber PIN',
);

const extendRes = await repo.barberExtendQueueTimer({
  businessSlug: barberShop.slug,
  addMinutes: 10,
  staffPinHash: arjunPinHash,
});
assert(
  extendRes.updatedCount === 3 &&
    extendRes.addedMinutes === 10 &&
    extendRes.staffLabel === 'Arjun (BAR-01)',
  'Arjun (BAR-01) broadcasted +10 mins to all 3 waiting guests',
);

const statusAfterDelay = await repo.getPublicBarberQueueStatus(barberShop.slug);
const t1After = statusAfterDelay?.waitingTickets.find(
  (t) => t.tokenNumber === 1,
);
const t2After = statusAfterDelay?.waitingTickets.find(
  (t) => t.tokenNumber === 2,
);
const t3After = statusAfterDelay?.waitingTickets.find(
  (t) => t.tokenNumber === 3,
);
assert(
  t1After?.estimatedWaitMinutes === 10 &&
    t1After?.extraDelayMinutes === 10 &&
    t2After?.estimatedWaitMinutes === 30 &&
    t2After?.extraDelayMinutes === 10 &&
    t3After?.estimatedWaitMinutes === 45 &&
    t3After?.extraDelayMinutes === 10,
  'Every waiting customer wait time increased by exactly +10m (#1: 0->10m, #2: 20->30m, #3: 35->45m)',
);

// ---------------------------------------------------------------------------
// 5. Chair Progression, Automatic +1 Loyalty Star & Completion Idempotency
// ---------------------------------------------------------------------------
console.log(
  '\n5. Chair Progression, Automatic +1 Loyalty Star & Idempotency',
);

const inChairRes = await repo.barberAdvanceQueueTicket({
  businessSlug: barberShop.slug,
  ticketId: join1.ticket.id,
  status: 'in_chair',
  staffPinHash: arjunPinHash,
});
assert(
  inChairRes.ticket.status === 'in_chair' &&
    inChairRes.ticket.assignedBarberLabel === 'Arjun (BAR-01)' &&
    Boolean(inChairRes.ticket.startedAt) &&
    inChairRes.starAwarded === false,
  'Token #1 (Vikram) moved to in_chair under Arjun (BAR-01); no star awarded before completion',
);

const statusInChair = await repo.getPublicBarberQueueStatus(barberShop.slug);
assert(
  statusInChair?.nowServing?.tokenNumber === 1 &&
    statusInChair?.waitingCount === 2,
  'Public queue now displays Token #1 as Now Serving and 2 waiting',
);

// Complete Token #1 -> automatic +1 Loyalty Star!
const completeRes = await repo.barberAdvanceQueueTicket({
  businessSlug: barberShop.slug,
  ticketId: join1.ticket.id,
  status: 'completed',
  staffPinHash: arjunPinHash,
});
assert(
  completeRes.ticket.status === 'completed' &&
    Boolean(completeRes.ticket.completedAt) &&
    completeRes.ticket.assignedBarberLabel === 'Arjun (BAR-01)' &&
    completeRes.starAwarded === true &&
    completeRes.starsAwarded === 1 &&
    completeRes.newLoyaltyStarsBalance === 1 &&
    completeRes.alreadyAwarded === false,
  'Completing Token #1 automatically credited +1 Loyalty Star to Vikram under Arjun (BAR-01)',
);

// Verify shared Loyalty Wallet reflects +1 Star and immutable ledger entry
const vikramWallet = await repo.registerOrResumeRestaurantCustomer({
  displayName: 'Vikram',
  phoneOrEmail: '+91 98765 43210',
  businessSlug: barberShop.slug,
});
assert(
  vikramWallet.loyaltyStarsBalance === 1 &&
    vikramWallet.recentStarTransactions.length === 1 &&
    vikramWallet.recentStarTransactions[0].verifiedByStaffLabel ===
      'Arjun (BAR-01)' &&
    vikramWallet.recentStarTransactions[0].idempotencyKey ===
      `barber-ticket-${join1.ticket.id}`,
  'Shared Loyalty Wallet & immutable star ledger record +1 Star audited to Arjun (BAR-01)',
);

// Duplicate completion MUST be idempotent (zero double stars!)
const duplicateCompleteRes = await repo.barberAdvanceQueueTicket({
  businessSlug: barberShop.slug,
  ticketId: join1.ticket.id,
  status: 'completed',
  staffPinHash: arjunPinHash,
});
assert(
  duplicateCompleteRes.alreadyAwarded === true &&
    duplicateCompleteRes.starAwarded === false &&
    duplicateCompleteRes.newLoyaltyStarsBalance === 1,
  'Duplicate completion on Token #1 is idempotent (alreadyAwarded: true, balance stays 1 Star)',
);

// Completing guest without phone (Kabir, Token #3) succeeds gracefully without awarding star
const completeNoPhone = await repo.barberAdvanceQueueTicket({
  businessSlug: barberShop.slug,
  ticketId: join3.ticket.id,
  status: 'completed',
  staffPinHash: arjunPinHash,
});
assert(
  completeNoPhone.ticket.status === 'completed' &&
    completeNoPhone.starAwarded === false &&
    completeNoPhone.starsAwarded === 0,
  'Completing guest without phone (Kabir) finishes cleanly without error or phantom star',
);

// ---------------------------------------------------------------------------
// 6. Guest Leave Queue, Pause/Capacity Guardrails & Multi-Tenant Isolation
// ---------------------------------------------------------------------------
console.log(
  '\n6. Leave Queue, Queue Pause/Capacity Guardrails & Multi-Tenant Isolation',
);

const leaveRes = await repo.leaveBarberQueueTicket({
  businessSlug: barberShop.slug,
  ticketId: join2.ticket.id,
});
assert(
  leaveRes.status === 'cancelled' && leaveRes.tokenNumber === 2,
  'Waiting guest (Rohan, Token #2) voluntarily left the queue (status: cancelled)',
);

const statusAfterLeave = await repo.getPublicBarberQueueStatus(barberShop.slug);
assert(
  statusAfterLeave?.waitingCount === 0 &&
    statusAfterLeave?.completedTodayCount === 2,
  'Queue snapshot shows 0 waiting and 2 completed cuts today',
);

// Pause queue -> block new joins
await repo.updateBarberQueueConfig(
  barberShop.id,
  {
    ...initialConfig,
    isQueueOpen: false,
  },
  ownerA,
);

await assertRejects(
  () =>
    repo.joinBarberQueue({
      businessSlug: barberShop.slug,
      guestName: 'Siddharth',
      serviceName: 'Classic Haircut',
    }),
  'paused',
  'Blocks joining queue when isQueueOpen = false',
);

// Re-open with maxQueueSize = 1 -> allow 1 guest, block 2nd
await repo.updateBarberQueueConfig(
  barberShop.id,
  {
    ...initialConfig,
    isQueueOpen: true,
    maxQueueSize: 1,
  },
  ownerA,
);

const join4 = await repo.joinBarberQueue({
  businessSlug: barberShop.slug,
  guestName: 'Dev',
  serviceName: 'Classic Haircut',
});
assert(
  join4.ticket.tokenNumber === 4,
  'Sequential daily token counter continues monotonically (#4 after #1–#3)',
);

await assertRejects(
  () =>
    repo.joinBarberQueue({
      businessSlug: barberShop.slug,
      guestName: 'Nikhil',
      serviceName: 'Classic Haircut',
    }),
  'full',
  'Blocks joining queue when active waiting count reaches maxQueueSize (1)',
);

// Strict Multi-Tenant Isolation (Owner B cannot touch Owner A's Barber Shop)
await assertRejects(
  () => repo.getBarberQueueConfig(barberShop.id, ownerB),
  'unauthorized',
  'Multi-tenant isolation: Owner B cannot read Owner A barber_queue_configs',
);

await assertRejects(
  () =>
    repo.updateBarberQueueConfig(
      barberShop.id,
      { ...initialConfig, isQueueOpen: false },
      ownerB,
    ),
  'unauthorized',
  'Multi-tenant isolation: Owner B cannot update Owner A barber_queue_configs',
);

await assertRejects(
  () =>
    repo.barberExtendQueueTimer({
      businessSlug: barberShop.slug,
      addMinutes: 15,
      options: ownerB,
    }),
  'unauthorized',
  'Multi-tenant isolation: Owner B cannot broadcast delays on Owner A queue',
);

await assertRejects(
  () =>
    repo.barberAdvanceQueueTicket({
      businessSlug: barberShop.slug,
      ticketId: join4.ticket.id,
      status: 'completed',
      options: ownerB,
    }),
  'unauthorized',
  'Multi-tenant isolation: Owner B cannot advance/complete Owner A queue tickets',
);

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------
console.log(
  `\n=== Module 4 Verification Complete: ${passed} passed, ${failed} failed ===\n`,
);

if (failed > 0) {
  Deno.exit(1);
}
