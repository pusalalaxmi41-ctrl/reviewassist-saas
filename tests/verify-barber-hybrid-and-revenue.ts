/**
 * Verification Suite — Module 4B (Migration 017):
 *   BarberOS Hybrid Walk-In + Online/Phone Appointment Queue,
 *   Daily #1 Token Reset, Fair Slot-Weaving Merge Algorithm,
 *   Double-Booking Guard, Daily & Monthly Service Revenue Ledger & Multi-Tenant Isolation
 *
 * Run with: deno run --allow-read --allow-env tests/verify-barber-hybrid-and-revenue.ts
 */

import { MockLocalStorageRepository } from '../src/services/storage/MockLocalStorageRepository.ts';
import {
  formatTicketDisplayCode,
  formatTimeSlot12h,
  generateBookableTimeSlots,
  getTodayQueueDateKey,
  parseBarberQueueTicketQr,
  validateJoinBarberQueueInput,
} from '../src/utils/barberQueueValidation.ts';

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
  '\n=== Module 4B Verification: Hybrid Walk-In + Appointment Queue, Daily #1 Reset & Revenue Ledger ===\n',
);

// ---------------------------------------------------------------------------
// 1. Display Code, Time-Slot Formatting & Hybrid Validation Unit Tests
// ---------------------------------------------------------------------------
console.log('1. Hybrid Display Codes, Time Slots & Validation');

assert(
  formatTicketDisplayCode({ bookingType: 'walk_in', tokenNumber: 1 }) ===
    'W-01' &&
    formatTicketDisplayCode({ bookingType: 'appointment', tokenNumber: 12 }) ===
      'B-12',
  'formatTicketDisplayCode formats walk-ins as W-01 and appointments as B-12',
);

assert(
  formatTimeSlot12h('09:00') === '9:00 AM' &&
    formatTimeSlot12h('12:30') === '12:30 PM' &&
    formatTimeSlot12h('16:30') === '4:30 PM' &&
    formatTimeSlot12h('invalid') === '',
  'formatTimeSlot12h converts 24h HH:MM slots cleanly to 12h AM/PM',
);

const bookableSlots = generateBookableTimeSlots();
assert(
  bookableSlots.length === 26 &&
    bookableSlots[0].value === '09:00' &&
    bookableSlots[bookableSlots.length - 1].value === '21:30',
  'generateBookableTimeSlots generates 26 half-hour slots (09:00 AM to 09:30 PM)',
);

assert(
  parseBarberQueueTicketQr('W-04')?.tokenNumber === 4 &&
    parseBarberQueueTicketQr('B-02')?.tokenNumber === 2 &&
    parseBarberQueueTicketQr('#9')?.tokenNumber === 9,
  'parseBarberQueueTicketQr parses W-04, B-02, and #9 display codes cleanly',
);

assert(
  validateJoinBarberQueueInput({
    businessSlug: 'crown-cuts-barber',
    guestName: 'Vikram',
    serviceName: 'Beard Trim & Styling',
    bookingType: 'appointment',
    scheduledTime: '16:30',
  }).ok,
  'validateJoinBarberQueueInput accepts valid appointment payload with HH:MM slot',
);

assert(
  !validateJoinBarberQueueInput({
    businessSlug: 'crown-cuts-barber',
    guestName: 'Vikram',
    serviceName: 'Beard Trim & Styling',
    bookingType: 'appointment',
    scheduledTime: '',
  }).ok,
  'validateJoinBarberQueueInput rejects appointment without a valid HH:MM time slot',
);

assert(
  !validateJoinBarberQueueInput({
    businessSlug: 'crown-cuts-barber',
    guestName: 'Vikram',
    serviceName: 'Classic Haircut',
    bookingType: 'vip_skip',
  }).ok,
  'validateJoinBarberQueueInput rejects unsupported bookingType values',
);

// ---------------------------------------------------------------------------
// 2. Daily #1 Token Reset & Historical Multi-Day / Past-Month Setup
// ---------------------------------------------------------------------------
console.log('\n2. Daily #1 Token Reset & Multi-Day Ledger Seeding');

const repo = new MockLocalStorageRepository();
const businesses = await repo.getBusinesses();
const barberShop = businesses.find((b) => b.slug === 'crown-cuts-barber');
assert(
  Boolean(barberShop) && barberShop?.category === 'barber',
  'Loaded active BarberOS shop (crown-cuts-barber)',
);
if (!barberShop) {
  throw new Error('Missing seed barber shop');
}

const ownerA = { actorOwnerId: barberShop.ownerId! };
const ownerB = { actorOwnerId: 'owner-other-tenant-77' };

// Configure predictable 3 services with exact fixed prices
await repo.updateBarberQueueConfig(
  barberShop.id,
  {
    isQueueOpen: true,
    avgServiceMinutes: 20,
    maxQueueSize: 25,
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

const todayKey = getTodayQueueDateKey();
const currentMonthKey = todayKey.slice(0, 7);
const todayDay = Number.parseInt(todayKey.slice(8, 10), 10);
// Guaranteed different day in the exact same YYYY-MM month (deterministic on day 1 too)
const otherDaySameMonth = `${currentMonthKey}-${todayDay === 1 ? '02' : '01'}`;
const pastMonthDate = '2025-09-15';
const pastMonthKey = '2025-09';

// Day A (same month, different day): 2 completed cuts (#1 and #2)
const hist1 = await repo.joinBarberQueue({
  businessSlug: barberShop.slug,
  guestName: 'Amit (Earlier This Month)',
  serviceName: 'Classic Haircut',
  bookingType: 'walk_in',
  queueDateOverride: otherDaySameMonth,
});
const hist2 = await repo.joinBarberQueue({
  businessSlug: barberShop.slug,
  guestName: 'Deepak (Earlier This Month)',
  serviceName: 'Beard Trim & Styling',
  bookingType: 'walk_in',
  queueDateOverride: otherDaySameMonth,
});
assert(
  hist1.ticket.tokenNumber === 1 &&
    hist1.ticket.displayCode === 'W-01' &&
    hist2.ticket.tokenNumber === 2 &&
    hist2.ticket.displayCode === 'W-02',
  `Earlier day (${otherDaySameMonth}) issued sequential W-01 and W-02 tokens`,
);

await repo.barberAdvanceQueueTicket({
  businessSlug: barberShop.slug,
  ticketId: hist1.ticket.id,
  status: 'completed',
  options: ownerA,
});
await repo.barberAdvanceQueueTicket({
  businessSlug: barberShop.slug,
  ticketId: hist2.ticket.id,
  status: 'completed',
  options: ownerA,
});

// Past Month (2025-09-15): 1 completed Combo cut (₹300) — must NOT leak into current month
const pastCut = await repo.joinBarberQueue({
  businessSlug: barberShop.slug,
  guestName: 'Old Month Guest',
  serviceName: 'Haircut + Beard Combo',
  bookingType: 'walk_in',
  queueDateOverride: pastMonthDate,
});
assert(
  pastCut.ticket.tokenNumber === 1 && pastCut.ticket.displayCode === 'W-01',
  `Past month date (${pastMonthDate}) also started cleanly at W-01`,
);
await repo.barberAdvanceQueueTicket({
  businessSlug: barberShop.slug,
  ticketId: pastCut.ticket.id,
  status: 'completed',
  options: ownerA,
});

// ---------------------------------------------------------------------------
// 3. Today's Hybrid Queue: Daily #1 Reset, Fair Slot-Weaving & Collision Guard
// ---------------------------------------------------------------------------
console.log('\n3. Hybrid Walk-In + Appointment Queue & Fair Slot-Weaving Merge');

const nowMs = Date.now();
const apptIn25MinIso = new Date(nowMs + 25 * 60_000).toISOString();
const apptIn30MinIso = new Date(nowMs + 30 * 60_000).toISOString();

// Walk-In #1 on Today -> MUST reset to tokenNumber === 1 (W-01)
const walkIn1 = await repo.joinBarberQueue({
  businessSlug: barberShop.slug,
  guestName: 'Rahul (Walk-In)',
  phone: '+91 98765 11111',
  serviceName: 'Classic Haircut',
  bookingType: 'walk_in',
});
assert(
  walkIn1.ticket.tokenNumber === 1 &&
    walkIn1.ticket.displayCode === 'W-01' &&
    walkIn1.ticket.bookingType === 'walk_in' &&
    walkIn1.ticket.pricePaise === 20000,
  'Daily #1 Reset: First guest today receives W-01 (tokenNumber=1, ₹200 snapshot)',
);

// Online/Phone Appointment booked 25 minutes from now -> B-01 (token #2)
const bookedAppt = await repo.joinBarberQueue({
  businessSlug: barberShop.slug,
  guestName: 'Vikram (Phone Booking)',
  phone: '+91 98765 22222',
  serviceName: 'Beard Trim & Styling',
  bookingType: 'appointment',
  scheduledTime: '16:30',
  scheduledAtOverride: apptIn25MinIso,
});
assert(
  bookedAppt.ticket.tokenNumber === 2 &&
    bookedAppt.ticket.displayCode === 'B-01' &&
    bookedAppt.ticket.bookingType === 'appointment' &&
    bookedAppt.ticket.scheduledTime === '16:30' &&
    bookedAppt.ticket.pricePaise === 15000,
  'Phone/Online appointment receives B-01 (tokenNumber=2) with 16:30 slot and ₹150 snapshot',
);

// Double-booking guard: exact same slot & within 15 minutes MUST be blocked
await assertRejects(
  () =>
    repo.joinBarberQueue({
      businessSlug: barberShop.slug,
      guestName: 'Duplicate Caller',
      serviceName: 'Classic Haircut',
      bookingType: 'appointment',
      scheduledTime: '16:30',
      scheduledAtOverride: apptIn25MinIso,
    }),
  'already reserved',
  'Double-booking guard blocks reserving exact same 16:30 slot twice',
);

await assertRejects(
  () =>
    repo.joinBarberQueue({
      businessSlug: barberShop.slug,
      guestName: 'Near-Collision Caller',
      serviceName: 'Classic Haircut',
      bookingType: 'appointment',
      scheduledTime: '16:35',
      scheduledAtOverride: apptIn30MinIso,
    }),
  'already reserved',
  'Double-booking guard blocks colliding booking within 15 minutes of reserved slot',
);

// Walk-In #2 (35-min Combo, token #3) joins -> cannot finish before B-01's 25-min slot,
// so Fair Slot-Weaving places W-02 cleanly AFTER B-01 with honest ~40m ETA!
const walkIn2 = await repo.joinBarberQueue({
  businessSlug: barberShop.slug,
  guestName: 'Suresh (Walk-In)',
  phone: '+91 98765 33333',
  serviceName: 'Haircut + Beard Combo',
  bookingType: 'walk_in',
});
assert(
  walkIn2.ticket.tokenNumber === 3 &&
    walkIn2.ticket.displayCode === 'W-02' &&
    walkIn2.ticket.pricePaise === 30000,
  'Second walk-in receives W-02 (tokenNumber=3, ₹300 snapshot)',
);

const mergedStatus = await repo.getPublicBarberQueueStatus(barberShop.slug);
assert(
  Boolean(mergedStatus) && mergedStatus!.waitingTickets.length === 3,
  'Public queue returns all 3 waiting tickets in unified hybrid timeline',
);

const codesInOrder = mergedStatus!.waitingTickets.map((t) => t.displayCode);
assert(
  codesInOrder[0] === 'W-01' &&
    codesInOrder[1] === 'B-01' &&
    codesInOrder[2] === 'W-02',
  `Fair Slot-Weaving order is [W-01, B-01, W-02] (got [${codesInOrder.join(', ')}])`,
);

const w1Eta = mergedStatus!.waitingTickets[0].estimatedWaitMinutes ?? -1;
const b1Eta = mergedStatus!.waitingTickets[1].estimatedWaitMinutes ?? -1;
const w2Eta = mergedStatus!.waitingTickets[2].estimatedWaitMinutes ?? -1;

assert(
  w1Eta === 0,
  `W-01 (20m) fits cleanly before B-01 (25m) with 0m wait (got ${w1Eta}m)`,
);
assert(
  b1Eta >= 23 && b1Eta <= 27,
  `B-01 holds its reserved ~25m appointment slot (got ${b1Eta}m)`,
);
assert(
  w2Eta >= 38 && w2Eta <= 42,
  `W-02 (35m) receives honest post-appointment ~40m wait up front without unfair bumping (got ${w2Eta}m)`,
);
assert(
  mergedStatus!.bookedSlotsToday.includes('16:30'),
  'Public status exposes bookedSlotsToday containing "16:30" so UI disables taken slots',
);

// ---------------------------------------------------------------------------
// 4. Broadcast +10m Delay Updates Both Walk-Ins AND Booked Appointments
// ---------------------------------------------------------------------------
console.log('\n4. Broadcast Delay Sync Across Walk-Ins & Booked Appointments');

const delayRes = await repo.barberExtendQueueTimer({
  businessSlug: barberShop.slug,
  addMinutes: 10,
  options: ownerA,
});
assert(
  delayRes.updatedCount === 3,
  `Broadcast +10m delay updated all 3 active tickets (got ${delayRes.updatedCount})`,
);

const delayedStatus = await repo.getPublicBarberQueueStatus(barberShop.slug);
const delayedW1 = delayedStatus!.waitingTickets.find(
  (t) => t.id === walkIn1.ticket.id,
);
const delayedB1 = delayedStatus!.waitingTickets.find(
  (t) => t.id === bookedAppt.ticket.id,
);
const delayedW2 = delayedStatus!.waitingTickets.find(
  (t) => t.id === walkIn2.ticket.id,
);
assert(
  delayedW1?.estimatedWaitMinutes === 10 &&
    delayedB1?.extraDelayMinutes === 10 &&
    (delayedB1?.estimatedWaitMinutes ?? 0) >= 33 &&
    delayedW2?.extraDelayMinutes === 10 &&
    (delayedW2?.estimatedWaitMinutes ?? 0) >= 48,
  'Walk-ins (W-01, W-02) and booked appointment (B-01) all reflect +10m broadcast delay',
);

// ---------------------------------------------------------------------------
// 5. Complete Cuts & Verify Daily + Monthly Haircut & Service Revenue Ledger
// ---------------------------------------------------------------------------
console.log('\n5. Daily & Monthly Haircut & Service Revenue Ledger');

await repo.barberAdvanceQueueTicket({
  businessSlug: barberShop.slug,
  ticketId: walkIn1.ticket.id,
  status: 'completed',
  options: ownerA,
});
await repo.barberAdvanceQueueTicket({
  businessSlug: barberShop.slug,
  ticketId: bookedAppt.ticket.id,
  status: 'completed',
  options: ownerA,
});
await repo.barberAdvanceQueueTicket({
  businessSlug: barberShop.slug,
  ticketId: walkIn2.ticket.id,
  status: 'completed',
  options: ownerA,
});

// Add a No-Show ticket to prove uncompleted tickets NEVER inflate revenue
const noShowGuest = await repo.joinBarberQueue({
  businessSlug: barberShop.slug,
  guestName: 'Skipped Guest',
  serviceName: 'Haircut + Beard Combo',
  bookingType: 'walk_in',
});
await repo.barberAdvanceQueueTicket({
  businessSlug: barberShop.slug,
  ticketId: noShowGuest.ticket.id,
  status: 'no_show',
  options: ownerA,
});

const summary = await repo.getBarberRevenueAndServiceSummary(
  barberShop.id,
  currentMonthKey,
  ownerA,
);

assert(
  summary.todayTotalCuts === 3 &&
    summary.todayRevenuePaise === 65000 &&
    summary.todayWalkIns === 2 &&
    summary.todayAppointments === 1,
  `Today ledger exact: 3 cuts (2 walk-ins, 1 booked), ₹650 (65000p); no-show excluded`,
  summary,
);

assert(
  summary.monthTotalCuts === 5 &&
    summary.monthRevenuePaise === 100000 &&
    summary.monthWalkIns === 4 &&
    summary.monthAppointments === 1,
  `Monthly ledger (${currentMonthKey}) exact: 5 cuts (today 3 + earlier-same-month 2), ₹1,000 (100000p); past month 2025-09 excluded`,
  summary,
);

const haircutRow = summary.serviceBreakdown.find(
  (r) => r.serviceName === 'Classic Haircut',
);
const beardRow = summary.serviceBreakdown.find(
  (r) => r.serviceName === 'Beard Trim & Styling',
);
const comboRow = summary.serviceBreakdown.find(
  (r) => r.serviceName === 'Haircut + Beard Combo',
);

assert(
  haircutRow?.countToday === 1 &&
    haircutRow?.revenueTodayPaise === 20000 &&
    haircutRow?.countMonth === 2 &&
    haircutRow?.revenueMonthPaise === 40000,
  'Service breakdown exact for Classic Haircut (Today: 1 / ₹200, Month: 2 / ₹400)',
  haircutRow,
);
assert(
  beardRow?.countToday === 1 &&
    beardRow?.revenueTodayPaise === 15000 &&
    beardRow?.countMonth === 2 &&
    beardRow?.revenueMonthPaise === 30000,
  'Service breakdown exact for Beard Trim & Styling (Today: 1 / ₹150, Month: 2 / ₹300)',
  beardRow,
);
assert(
  comboRow?.countToday === 1 &&
    comboRow?.revenueTodayPaise === 30000 &&
    comboRow?.countMonth === 1 &&
    comboRow?.revenueMonthPaise === 30000,
  'Service breakdown exact for Haircut + Beard Combo (Today: 1 / ₹300, Month: 1 / ₹300)',
  comboRow,
);

// Query historical month (2025-09)
const pastSummary = await repo.getBarberRevenueAndServiceSummary(
  barberShop.id,
  pastMonthKey,
  ownerA,
);
assert(
  pastSummary.monthKey === pastMonthKey &&
    pastSummary.monthTotalCuts === 1 &&
    pastSummary.monthRevenuePaise === 30000 &&
    pastSummary.todayTotalCuts === 3,
  'Historical month query (2025-09) isolates 1 cut / ₹300 while keeping Today at 3 cuts',
  pastSummary,
);

// ---------------------------------------------------------------------------
// 6. Strict Multi-Tenant Isolation on Revenue Ledger
// ---------------------------------------------------------------------------
console.log('\n6. Strict Multi-Tenant Isolation');

await assertRejects(
  () =>
    repo.getBarberRevenueAndServiceSummary(
      barberShop.id,
      currentMonthKey,
      ownerB,
    ),
  'unauthorized',
  'Multi-tenant isolation: Owner B cannot read Owner A barber revenue & service ledger',
);

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------
console.log(
  `\n=== Module 4B Verification Complete: ${passed} passed, ${failed} failed ===\n`,
);

if (failed > 0) {
  Deno.exit(1);
}
