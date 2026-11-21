/**
 * Phase 4 — Automated Verification Suite for Resto Daddy-Style Visual Table Floor Map,
 *           Staff Verification Mode & Owner Engagement Analytics
 *
 * Verifies:
 * 1. Staff PIN Validation, SHA-256 Hashing & PIN Verification Gate
 * 2. Table Call Alerts ("Call Waiter" & "Ready for Bill"), Spam Deduplication & Staff Acknowledge/Resolve
 * 3. Staff-Verified Paid Dining Visits (`staffAwardVisitStars` via Loyalty QR Token & Phone/Email)
 * 4. Idempotency & Duplicate Visit Cooldown Protection (`minHoursBetweenVisitStars`)
 * 5. 6-Character Reward Claim Ticket Verification & Staff Fulfillment (`staffFulfillRewardClaim`)
 * 6. Owner Engagement Funnel Analytics (Explicit Separation of Public QR Scans vs. Verified Paid Visits)
 * 7. Multi-Tenant Isolation Across Restaurants & Staff PINs
 */

import {
  buildCustomerLoyaltyQrToken,
  hashStaffPin,
  validateStaffPinFormat,
} from '../src/utils/restaurantValidation.ts';
import { MockLocalStorageRepository } from '../src/services/storage/MockLocalStorageRepository.ts';

let passed = 0;
let failed = 0;

function assert(condition: boolean, label: string, detail?: string): void {
  if (condition) {
    passed++;
    console.log(`  [PASS] ${label}`);
  } else {
    failed++;
    console.error(`  [FAIL] ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

async function assertThrows(
  fn: () => Promise<unknown>,
  label: string,
  expectedSubstring?: string,
): Promise<void> {
  try {
    await fn();
    failed++;
    console.error(
      `  [FAIL] ${label} — Expected error to be thrown, but succeeded.`,
    );
  } catch (err) {
    const msg = (err as Error).message || String(err);
    if (
      expectedSubstring &&
      !msg.toLowerCase().includes(expectedSubstring.toLowerCase())
    ) {
      failed++;
      console.error(
        `  [FAIL] ${label} — Threw "${msg}", expected substring "${expectedSubstring}"`,
      );
      return;
    }
    passed++;
    console.log(`  [PASS] ${label} (Blocked with: "${msg}")`);
  }
}

async function runTests() {
  console.log('===================================================================');
  console.log('Phase 4: Visual Table Floor Map, Staff Verification & Analytics');
  console.log('===================================================================\n');

  const repo = new MockLocalStorageRepository();
  const businesses = await repo.getBusinesses();
  const restaurantA = businesses[0]; // The Urban Kitchen (active, owner-urban-1)

  const restaurantB = await repo.createBusiness({
    ownerId: 'owner-nizam-2',
    slug: 'nizam-darbar',
    name: 'Nizam Darbar',
    category: 'restaurant',
    city: 'Hyderabad',
    googleReviewUrl: 'https://g.page/r/nizam-darbar/review',
    googleReviewUrlIsPlaceholder: false,
  });

  // ---------------------------------------------------------------------------
  // 1. Staff PIN Validation, SHA-256 Hashing & PIN Gate
  // ---------------------------------------------------------------------------
  console.log('1. Staff PIN Validation, SHA-256 Hashing & PIN Gate');
  assert(
    !validateStaffPinFormat('12').ok &&
      !validateStaffPinFormat('1234567').ok &&
      !validateStaffPinFormat('abcd').ok &&
      validateStaffPinFormat('2468').ok,
    'Staff PIN format validator accepts 4-6 digits and rejects letters or invalid lengths',
  );

  const validStaffPinHash = await hashStaffPin(restaurantA.slug, '2468');
  const wrongStaffPinHash = await hashStaffPin(restaurantA.slug, '9999');
  assert(
    /^[0-9a-f]{64}$/.test(validStaffPinHash) &&
      validStaffPinHash !== wrongStaffPinHash,
    'hashStaffPin generates deterministic 64-char SHA-256 hex digest salted by business slug',
  );

  await repo.updateRestaurantProfile(restaurantA.id, {
    isEnabled: true,
    currencyCode: 'INR',
    tagline: 'Fine Hyderabadi Dining',
    gamesEnabled: true,
    loyaltyEnabled: true,
    staffPinHash: validStaffPinHash,
    minHoursBetweenVisitStars: 4,
  });

  const pinAuthOk = await repo.verifyRestaurantStaffPin({
    businessSlug: restaurantA.slug,
    staffPinHash: validStaffPinHash,
  });
  assert(
    pinAuthOk.verified === true && pinAuthOk.businessId === restaurantA.id,
    'Correct Staff PIN hash unlocks Staff Verification Mode',
  );

  await assertThrows(
    () =>
      repo.verifyRestaurantStaffPin({
        businessSlug: restaurantA.slug,
        staffPinHash: wrongStaffPinHash,
      }),
    'Wrong Staff PIN hash is rejected',
    'Invalid Staff PIN',
  );

  // ---------------------------------------------------------------------------
  // 2. Table Call Alerts ("Call Waiter" / "Ready for Bill") & Spam Protection
  // ---------------------------------------------------------------------------
  console.log('\n2. Visual Floor Map Table Calls & Spam Protection');
  const table4 = await repo.createRestaurantTable(restaurantA.id, {
    tableNumber: 'Table 04',
    tableLabel: 'Window Corner',
  });
  await repo.createRestaurantTable(restaurantA.id, {
    tableNumber: 'Table 05',
    tableLabel: 'Patio',
  });

  const call1 = await repo.createRestaurantTableCall({
    businessSlug: restaurantA.slug,
    tableKey: table4.tableKey,
    callType: 'assistance',
  });
  assert(
    call1.status === 'open' &&
      call1.callType === 'assistance' &&
      call1.tableNumber === 'Table 04',
    'Guest at Table 04 triggers "Call Waiter" (assistance) alert',
  );

  // Spam protection: tapping "Call Waiter" again while call1 is still open returns the same call
  const call1Duplicate = await repo.createRestaurantTableCall({
    businessSlug: restaurantA.slug,
    tableKey: table4.tableKey,
    callType: 'assistance',
  });
  assert(
    call1Duplicate.id === call1.id,
    'Spam protection reuses existing open assistance call for Table 04 instead of creating duplicate alerts',
  );

  // Guest also taps "Ready for Bill"
  const billCall = await repo.createRestaurantTableCall({
    businessSlug: restaurantA.slug,
    tableKey: table4.tableKey,
    callType: 'ready_for_bill',
  });
  assert(
    billCall.id !== call1.id && billCall.callType === 'ready_for_bill',
    'Guest can trigger distinct "Ready for Bill" alert',
  );

  // Staff acknowledges call1 and resolves billCall using verified Staff PIN
  const ackedCall = await repo.updateRestaurantTableCallStatus({
    businessSlug: restaurantA.slug,
    callId: call1.id,
    status: 'acknowledged',
    staffPinHash: validStaffPinHash,
  });
  const resolvedBill = await repo.updateRestaurantTableCallStatus({
    businessSlug: restaurantA.slug,
    callId: billCall.id,
    status: 'resolved',
    staffPinHash: validStaffPinHash,
  });
  assert(
    ackedCall.status === 'acknowledged' &&
      resolvedBill.status === 'resolved' &&
      resolvedBill.resolvedAt !== null,
    'Staff acknowledged assistance call and resolved bill call on the floor map',
  );

  // ---------------------------------------------------------------------------
  // 3. Explicit Staff Verification of Paid Visits (+Loyalty Stars)
  // ---------------------------------------------------------------------------
  console.log('\n3. Staff Verification of Paid Dining Visits (+Loyalty Stars)');
  // Configure 2 Stars per verified visit and a 2-Star reward
  await repo.updateRestaurantLoyaltyRules(restaurantA.id, {
    starsPerVerifiedVisit: 2,
    pointsPerStarExchange: 100,
    allowPointExchange: true,
    maxStarsViaExchangePerWeek: 2,
  });
  const rewardBiryani = await repo.createRestaurantReward(restaurantA.id, {
    title: 'Complimentary Starter Platter',
    starsRequired: 2,
    isActive: true,
  });

  const diner = await repo.registerOrResumeRestaurantCustomer({
    displayName: 'Karthik Rao',
    phoneOrEmail: 'karthik@example.com',
    businessSlug: restaurantA.slug,
  });

  // Verify that simply scanning the QR code or checking in gives 0 Loyalty Stars
  assert(
    (diner.loyaltyStarsBalance ?? 0) === 0,
    'Checking in or scanning QR code awards 0 Loyalty Stars (never treats scan as purchase)',
  );

  const loyaltyQrToken = buildCustomerLoyaltyQrToken(
    restaurantA.slug,
    diner.customer.id,
  );

  // Unauthorized staff attempt with wrong PIN must be blocked
  await assertThrows(
    () =>
      repo.staffAwardVisitStars({
        businessSlug: restaurantA.slug,
        customerLookup: loyaltyQrToken,
        tableKey: table4.tableKey,
        staffLabel: 'Waiter Rahul',
        idempotencyKey: 'idem-visit-wrong-pin',
        staffPinHash: wrongStaffPinHash,
      }),
    'Blocks awarding visit stars when Staff PIN is invalid',
    'Invalid Staff PIN',
  );

  // Authorized staff verification using diner's personal Loyalty QR token
  const visitRes = await repo.staffAwardVisitStars({
    businessSlug: restaurantA.slug,
    customerLookup: loyaltyQrToken,
    tableKey: table4.tableKey,
    staffLabel: 'Waiter Rahul',
    idempotencyKey: 'idem-visit-karthik-1',
    staffPinHash: validStaffPinHash,
  });
  assert(
    visitRes.alreadyProcessed === false &&
      visitRes.customerName === 'Karthik Rao' &&
      visitRes.starsAwarded === 2 &&
      visitRes.newLoyaltyStarsBalance === 2 &&
      visitRes.verifiedByLabel === 'Waiter Rahul',
    'Staff verified paid visit via Loyalty QR pass and awarded +2 Loyalty Stars (balance: 2 ★)',
  );

  // Idempotency check: re-submitting same idempotencyKey never double-awards
  const visitIdem = await repo.staffAwardVisitStars({
    businessSlug: restaurantA.slug,
    customerLookup: loyaltyQrToken,
    tableKey: table4.tableKey,
    staffLabel: 'Waiter Rahul',
    idempotencyKey: 'idem-visit-karthik-1',
    staffPinHash: validStaffPinHash,
  });
  assert(
    visitIdem.alreadyProcessed === true &&
      visitIdem.newLoyaltyStarsBalance === 2,
    'Duplicate idempotencyKey on staff_award_visit_stars returns alreadyProcessed=true without double-awarding',
  );

  // Cooldown check: attempting to award a second visit star within the 4-hour cooldown is blocked
  await assertThrows(
    () =>
      repo.staffAwardVisitStars({
        businessSlug: restaurantA.slug,
        customerLookup: 'karthik@example.com',
        tableKey: table4.tableKey,
        staffLabel: 'Waiter Rahul',
        idempotencyKey: 'idem-visit-karthik-2-cooldown',
        staffPinHash: validStaffPinHash,
      }),
    'Visit Star cooldown (4 hours) blocks accidental duplicate visit star award on the same meal',
    'Visit Star cooldown active',
  );

  // ---------------------------------------------------------------------------
  // 4. 6-Character Reward Claim Ticket Verification & Staff Fulfillment
  // ---------------------------------------------------------------------------
  console.log('\n4. 6-Character Reward Claim Ticket Fulfillment by Staff');
  const claimTicket = await repo.claimRestaurantReward({
    businessSlug: restaurantA.slug,
    customerId: diner.customer.id,
    rewardId: rewardBiryani.id,
    idempotencyKey: 'idem-claim-platter-1',
  });
  assert(
    claimTicket.claim.status === 'pending_staff_verification' &&
      claimTicket.newLoyaltyStarsBalance === 0,
    `Diner claimed "Complimentary Starter Platter" and received pending 6-char ticket "${claimTicket.claim.claimCode}"`,
  );

  const fulfilledTicket = await repo.staffFulfillRewardClaim({
    businessSlug: restaurantA.slug,
    claimCode: claimTicket.claim.claimCode,
    staffLabel: 'Waiter Rahul',
    staffPinHash: validStaffPinHash,
  });
  assert(
    fulfilledTicket.status === 'fulfilled' &&
      fulfilledTicket.fulfilledBy === 'Waiter Rahul' &&
      fulfilledTicket.fulfilledAt !== null,
    `Staff verified and fulfilled 6-char claim ticket "${claimTicket.claim.claimCode}"`,
  );

  // Attempting to fulfill the same ticket a second time must be blocked
  await assertThrows(
    () =>
      repo.staffFulfillRewardClaim({
        businessSlug: restaurantA.slug,
        claimCode: claimTicket.claim.claimCode,
        staffLabel: 'Waiter Rahul',
        staffPinHash: validStaffPinHash,
      }),
    'Blocks fulfilling an already-fulfilled 6-character claim code a second time',
    'already been fulfilled',
  );

  // ---------------------------------------------------------------------------
  // 5. Owner Engagement Funnel Analytics (QR Scans vs. Verified Paid Visits)
  // ---------------------------------------------------------------------------
  console.log('\n5. Owner Engagement Funnel Analytics (Scans vs. Verified Visits)');
  // Record an extra public QR scan to prove QR scans do NOT inflate verifiedPaidVisits
  await repo.trackEvent({
    businessId: restaurantA.id,
    eventType: 'qr_scan',
    metadata: { source: 'table_qr' },
  });

  const floorAndAnalytics = await repo.getRestaurantFloorAndAnalytics({
    businessSlug: restaurantA.slug,
    staffPinHash: validStaffPinHash,
  });
  assert(
    floorAndAnalytics.activeTableCalls.length === 1 &&
      floorAndAnalytics.activeTableCalls[0].id === call1.id &&
      floorAndAnalytics.pendingRewardClaims.length === 0,
    'Floor payload returns 1 active (acknowledged) table call and 0 pending reward claims after fulfillment',
  );

  assert(
    floorAndAnalytics.analytics.qrScans >= 5 &&
      floorAndAnalytics.analytics.verifiedPaidVisits === 1 &&
      floorAndAnalytics.analytics.loyaltyStarsIssued === 2 &&
      floorAndAnalytics.analytics.rewardsClaimed === 1 &&
      floorAndAnalytics.analytics.rewardsFulfilled === 1,
    `Analytics strictly separates Public QR Scans (${floorAndAnalytics.analytics.qrScans}) from Verified Paid Visits (${floorAndAnalytics.analytics.verifiedPaidVisits})`,
  );

  // ---------------------------------------------------------------------------
  // 6. Multi-Tenant Isolation
  // ---------------------------------------------------------------------------
  console.log('\n6. Multi-Tenant Isolation Across Restaurants');
  const foreignToken = buildCustomerLoyaltyQrToken(
    restaurantB.slug,
    diner.customer.id,
  );
  await assertThrows(
    () =>
      repo.staffAwardVisitStars({
        businessSlug: restaurantA.slug,
        customerLookup: foreignToken,
        idempotencyKey: 'idem-foreign-token',
        staffPinHash: validStaffPinHash,
      }),
    'Blocks scanning a Loyalty QR Pass from Restaurant B at Restaurant A',
    'different restaurant',
  );

  await assertThrows(
    () =>
      repo.getRestaurantFloorAndAnalytics({
        businessSlug: restaurantA.slug,
        options: { actorOwnerId: 'owner-nizam-2' },
      }),
    'Owner B blocked from reading Restaurant A live floor map and analytics',
    'Unauthorized',
  );

  console.log('\n===================================================================');
  console.log(`Verification Summary: ${passed} passed, ${failed} failed`);
  console.log('===================================================================');

  if (failed > 0) {
    Deno.exit(1);
  }
}

await runTests();
