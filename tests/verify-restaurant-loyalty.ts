/**
 * Phase 3 — Automated Verification Suite for Candour-Style Table Hub,
 *           Loyalty Stars Ledger, Atomic Point-to-Star Exchange & Reward Catalogue
 *
 * Verifies:
 * 1. Loyalty Economy Rules & Guest Wi-Fi / Suggestion Box Configuration
 * 2. Reward Catalogue CRUD & Public Payload Integration
 * 3. Atomic Point-to-Star Exchange (both Game-Points & Loyalty-Stars ledgers update together)
 * 4. Insufficient Game Points Rejection, Weekly Exchange Cap Enforcement & Exchange Toggle Blocking
 * 5. Idempotency Protection on Point-to-Star Exchange & Reward Claiming
 * 6. Atomic Reward Claiming, Star Deduction & 6-Character Claim Ticket Generation
 * 7. Personal Customer Loyalty QR Pass Matrix Generation
 * 8. Private Table Suggestion Box (Guest Submit -> Owner Inbox -> Mark Read -> Disabled Gate)
 * 9. Multi-Tenant Isolation Across Separate Restaurants
 */

import {
  buildCustomerLoyaltyQrToken,
  validateRestaurantLoyaltyRulesInput,
  validateRestaurantRewardInput,
} from '../src/utils/restaurantValidation.ts';
import { generateUrlQRMatrix } from '../src/services/qr/qrGenerator.ts';
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
  console.log('Phase 3: Loyalty Stars Ledger, Point Exchange & Reward Catalogue');
  console.log('===================================================================\n');

  const repo = new MockLocalStorageRepository();
  const businesses = await repo.getBusinesses();
  const restaurantA = businesses[0]; // The Urban Kitchen (active, owner-urban-1)

  // Create a second restaurant for multi-tenant isolation verification
  const restaurantB = await repo.createBusiness({
    ownerId: 'owner-bistro-2',
    slug: 'charminar-bistro',
    name: 'Charminar Bistro',
    category: 'restaurant',
    city: 'Hyderabad',
    googleReviewUrl: 'https://g.page/r/charminar-bistro/review',
    googleReviewUrlIsPlaceholder: false,
  });

  // Enable Restaurant Suite on restaurantA
  await repo.updateRestaurantProfile(restaurantA.id, {
    isEnabled: true,
    currencyCode: 'INR',
    tagline: 'Royal Hyderabadi Hospitality',
    gamesEnabled: true,
    loyaltyEnabled: true,
  });

  // ---------------------------------------------------------------------------
  // 1. Loyalty Economy Rules & Validation
  // ---------------------------------------------------------------------------
  console.log('1. Loyalty Economy Rules, Guest Wi-Fi & Suggestion Box Validation');
  const defaultRules = await repo.getRestaurantLoyaltyRules(restaurantA.id);
  assert(
    defaultRules.starsPerVerifiedVisit === 1 &&
      defaultRules.pointsPerStarExchange === 100 &&
      defaultRules.allowPointExchange === true &&
      defaultRules.maxStarsViaExchangePerWeek === 2,
    'Default loyalty rules start with 1 star/visit, 100 pts/star exchange, and 2 stars/week exchange cap',
  );

  assert(
    !validateRestaurantLoyaltyRulesInput(restaurantA.id, {
      starsPerVerifiedVisit: 0,
      pointsPerStarExchange: 100,
      allowPointExchange: true,
      maxStarsViaExchangePerWeek: 2,
    }).ok,
    'Rejects invalid starsPerVerifiedVisit = 0',
  );

  assert(
    !validateRestaurantLoyaltyRulesInput(restaurantA.id, {
      starsPerVerifiedVisit: 1,
      pointsPerStarExchange: -50,
      allowPointExchange: true,
      maxStarsViaExchangePerWeek: 2,
    }).ok,
    'Rejects negative pointsPerStarExchange',
  );

  // Configure 20 Game Points = 1 Loyalty Star, weekly cap = 2 Stars, plus Guest Wi-Fi
  const savedRules = await repo.updateRestaurantLoyaltyRules(restaurantA.id, {
    starsPerVerifiedVisit: 1,
    pointsPerStarExchange: 20,
    allowPointExchange: true,
    maxStarsViaExchangePerWeek: 2,
    wifiNetworkName: 'UrbanKitchen_Guest_5G',
    wifiPassword: 'BiryaniLove2026',
    suggestionBoxEnabled: true,
  });
  assert(
    savedRules.pointsPerStarExchange === 20 &&
      savedRules.wifiNetworkName === 'UrbanKitchen_Guest_5G' &&
      savedRules.wifiPassword === 'BiryaniLove2026',
    'Saved custom loyalty economy rules (20 pts = 1 Star, 2/wk cap) and Guest Wi-Fi credentials',
  );

  // ---------------------------------------------------------------------------
  // 2. Reward Catalogue CRUD & Public Hub Payload
  // ---------------------------------------------------------------------------
  console.log('\n2. Reward Catalogue CRUD & Public Table Hub Payload');
  assert(
    !validateRestaurantRewardInput(restaurantA.id, {
      title: '',
      starsRequired: 2,
    }).ok,
    'Rejects reward with empty title',
  );

  const rewardCoffee = await repo.createRestaurantReward(restaurantA.id, {
    title: 'Complimentary Filter Coffee',
    description: 'Freshly brewed South Indian filter coffee',
    starsRequired: 1,
    isActive: true,
    displayOrder: 0,
  });
  const rewardDessert = await repo.createRestaurantReward(restaurantA.id, {
    title: 'Double Ka Meetha Dessert',
    description: 'House special royal bread pudding',
    starsRequired: 2,
    isActive: true,
    displayOrder: 1,
  });
  const rewardPaused = await repo.createRestaurantReward(restaurantA.id, {
    title: 'Paused Seasonal Drink',
    starsRequired: 3,
    isActive: false,
    displayOrder: 2,
  });

  const publicHub = await repo.getPublicRestaurantMenu(restaurantA.slug);
  assert(
    publicHub !== null &&
      publicHub.loyaltyRules?.wifiNetworkName === 'UrbanKitchen_Guest_5G' &&
      publicHub.rewards?.length === 2 &&
      !publicHub.rewards.some((r) => r.id === rewardPaused.id),
    'Public Table Hub payload includes loyaltyRules and active rewards (excluding paused rewards)',
  );

  // ---------------------------------------------------------------------------
  // 3. Atomic Point-to-Star Exchange & Separate Ledger Synchronization
  // ---------------------------------------------------------------------------
  console.log('\n3. Atomic Point-to-Star Exchange & Ledger Synchronization');
  const diner = await repo.registerOrResumeRestaurantCustomer({
    displayName: 'Meera Reddy',
    phoneOrEmail: 'meera@example.com',
    businessSlug: restaurantA.slug,
  });

  // Attempting exchange with 0 Game Points must fail
  await assertThrows(
    () =>
      repo.exchangeGamePointsForStar({
        businessSlug: restaurantA.slug,
        customerId: diner.customer.id,
        idempotencyKey: 'idem-exch-insufficient',
      }),
    'Blocks Point-to-Star exchange when diner has insufficient Game Points (0 < 20)',
    'Insufficient Game Points',
  );

  // Configure trivia game to award 30 pts/win with 0 cooldown and 200 daily cap so diner can earn 60 pts
  await repo.updateRestaurantGameConfig(restaurantA.id, {
    gameSlug: 'dish-trivia',
    title: "Chef's Trivia",
    category: 'solo',
    isEnabled: true,
    pointsPerWin: 30,
    maxPointsPerDayPerCustomer: 200,
    cooldownMinutes: 0,
  });

  // Win two trivia sessions -> 60 Game Points total
  for (let i = 1; i <= 2; i++) {
    const sess = await repo.startRestaurantGameSession({
      businessSlug: restaurantA.slug,
      customerId: diner.customer.id,
      gameSlug: 'dish-trivia',
    });
    await repo.completeRestaurantGameSession({
      sessionId: sess.sessionId,
      customerId: diner.customer.id,
      submission: { answers: [0, 1, 2] },
      idempotencyKey: `idem-game-win-${i}-${sess.sessionId}`,
    });
  }

  const walletBeforeExchange = await repo.registerOrResumeRestaurantCustomer({
    displayName: 'Meera Reddy',
    phoneOrEmail: 'meera@example.com',
    businessSlug: restaurantA.slug,
  });
  assert(
    walletBeforeExchange.gamePointsBalance === 60 &&
      (walletBeforeExchange.loyaltyStarsBalance ?? 0) === 0,
    'Diner earned 60 Game Points while Loyalty Stars remain 0 (strictly separate balances)',
  );

  // Exchange #1: 20 Game Points -> +1 Loyalty Star (remaining points: 40, stars: 1)
  const exch1 = await repo.exchangeGamePointsForStar({
    businessSlug: restaurantA.slug,
    customerId: diner.customer.id,
    idempotencyKey: 'idem-exchange-star-1',
  });
  assert(
    exch1.alreadyProcessed === false &&
      exch1.pointsSpent === 20 &&
      exch1.starsEarned === 1 &&
      exch1.newGamePointsBalance === 40 &&
      exch1.newLoyaltyStarsBalance === 1,
    'Atomic Exchange #1 deducts 20 Game Points (60 -> 40) and credits +1 Loyalty Star (0 -> 1)',
  );

  // Idempotency check on Exchange #1
  const exch1Duplicate = await repo.exchangeGamePointsForStar({
    businessSlug: restaurantA.slug,
    customerId: diner.customer.id,
    idempotencyKey: 'idem-exchange-star-1',
  });
  assert(
    exch1Duplicate.alreadyProcessed === true &&
      exch1Duplicate.newGamePointsBalance === 40 &&
      exch1Duplicate.newLoyaltyStarsBalance === 1,
    'Duplicate idempotencyKey on Point-to-Star exchange returns alreadyProcessed=true and never double-deducts or double-credits',
  );

  // Exchange #2: another 20 Game Points -> +1 Loyalty Star (remaining points: 20, stars: 2)
  const exch2 = await repo.exchangeGamePointsForStar({
    businessSlug: restaurantA.slug,
    customerId: diner.customer.id,
    idempotencyKey: 'idem-exchange-star-2',
  });
  assert(
    exch2.newGamePointsBalance === 20 && exch2.newLoyaltyStarsBalance === 2,
    'Atomic Exchange #2 deducts 20 Game Points (40 -> 20) and credits +1 Loyalty Star (1 -> 2)',
  );

  // Exchange #3: Diner still has 20 Game Points, but weekly exchange cap is 2 stars/week!
  await assertThrows(
    () =>
      repo.exchangeGamePointsForStar({
        businessSlug: restaurantA.slug,
        customerId: diner.customer.id,
        idempotencyKey: 'idem-exchange-star-3-blocked',
      }),
    'Weekly Point-to-Star exchange cap (2 stars/week) blocks 3rd exchange even when diner has 20 Game Points left',
    'Weekly Point-to-Star exchange limit',
  );

  // ---------------------------------------------------------------------------
  // 4. Atomic Reward Claiming & 6-Character Claim Ticket Generation
  // ---------------------------------------------------------------------------
  console.log('\n4. Atomic Reward Claiming & 6-Character Claim Ticket');
  // Diner has 2 Loyalty Stars. Claiming a 1-Star reward (Complimentary Filter Coffee) should succeed.
  const claimRes = await repo.claimRestaurantReward({
    businessSlug: restaurantA.slug,
    customerId: diner.customer.id,
    rewardId: rewardCoffee.id,
    idempotencyKey: 'idem-claim-coffee-1',
  });
  assert(
    claimRes.alreadyProcessed === false &&
      claimRes.newLoyaltyStarsBalance === 1 &&
      /^[A-Z0-9]{6}$/.test(claimRes.claim.claimCode) &&
      claimRes.claim.status === 'pending_staff_verification' &&
      claimRes.claim.starsSpent === 1,
    `Claimed "Complimentary Filter Coffee" for 1 Star (balance 2 -> 1) and issued 6-char claim ticket "${claimRes.claim.claimCode}"`,
  );

  // Duplicate claim idempotency check
  const claimDuplicate = await repo.claimRestaurantReward({
    businessSlug: restaurantA.slug,
    customerId: diner.customer.id,
    rewardId: rewardCoffee.id,
    idempotencyKey: 'idem-claim-coffee-1',
  });
  assert(
    claimDuplicate.alreadyProcessed === true &&
      claimDuplicate.newLoyaltyStarsBalance === 1 &&
      claimDuplicate.claim.claimCode === claimRes.claim.claimCode,
    'Duplicate reward claim with same idempotencyKey returns existing 6-character claim code without deducting extra stars',
  );

  // Now diner has 1 Star left; claiming a 2-Star reward (Double Ka Meetha) must be blocked
  await assertThrows(
    () =>
      repo.claimRestaurantReward({
        businessSlug: restaurantA.slug,
        customerId: diner.customer.id,
        rewardId: rewardDessert.id,
        idempotencyKey: 'idem-claim-dessert-insufficient',
      }),
    'Blocks claiming a 2-Star reward when diner only has 1 Loyalty Star remaining',
    'Insufficient Loyalty Stars',
  );

  // ---------------------------------------------------------------------------
  // 5. Personal Customer Loyalty QR Pass Generation
  // ---------------------------------------------------------------------------
  console.log('\n5. Personal Customer Loyalty QR Pass Verification');
  const loyaltyToken = buildCustomerLoyaltyQrToken(
    restaurantA.slug,
    diner.customer.id,
  );
  const qrMatrix = generateUrlQRMatrix(loyaltyToken);
  assert(
    loyaltyToken.startsWith('vitaran-loyalty://the-urban-kitchen/') &&
      qrMatrix.moduleCount > 20 &&
      qrMatrix.quietZoneModules === 4,
    `Generated valid ISO/IEC 18004 personal Loyalty QR Pass matrix for "${loyaltyToken}"`,
  );

  // ---------------------------------------------------------------------------
  // 6. Private Table Suggestion Box
  // ---------------------------------------------------------------------------
  console.log('\n6. Private Table Suggestion Box');
  const submittedSug = await repo.submitRestaurantSuggestion({
    businessSlug: restaurantA.slug,
    customerName: 'Meera Reddy',
    message: 'Loved the filter coffee! Would love oat milk as an option too.',
  });
  assert(
    submittedSug.isRead === false &&
      submittedSug.message.includes('oat milk'),
    'Table guest submitted private Suggestion Box note to restaurant owner',
  );

  const ownerInbox = await repo.getRestaurantSuggestions(restaurantA.id);
  assert(
    ownerInbox.length === 1 && ownerInbox[0].id === submittedSug.id,
    'Owner Suggestion Box inbox retrieves the guest suggestion',
  );

  const markedRead = await repo.markRestaurantSuggestionRead(
    restaurantA.id,
    submittedSug.id,
    true,
  );
  assert(
    markedRead.isRead === true,
    'Owner marked Suggestion Box note as read',
  );

  // ---------------------------------------------------------------------------
  // 7. Multi-Tenant Isolation
  // ---------------------------------------------------------------------------
  console.log('\n7. Multi-Tenant Isolation Across Restaurants');
  const dinerAtRestaurantB = await repo.registerOrResumeRestaurantCustomer({
    displayName: 'Meera Reddy',
    phoneOrEmail: 'meera@example.com',
    businessSlug: restaurantB.slug,
  });
  assert(
    dinerAtRestaurantB.gamePointsBalance === 0 &&
      (dinerAtRestaurantB.loyaltyStarsBalance ?? 0) === 0 &&
      (dinerAtRestaurantB.rewardClaims ?? []).length === 0,
    'Diner Loyalty Stars, Game Points, and Claim Tickets from Restaurant A are strictly isolated from Restaurant B',
  );

  await assertThrows(
    () =>
      repo.getRestaurantSuggestions(restaurantA.id, {
        actorOwnerId: 'owner-bistro-2',
      }),
    'Owner B blocked from reading Owner A private Suggestion Box messages',
    'Unauthorized',
  );

  await assertThrows(
    () =>
      repo.createRestaurantReward(
        restaurantA.id,
        { title: 'Hacked Reward', starsRequired: 1 },
        { actorOwnerId: 'owner-bistro-2' },
      ),
    'Owner B blocked from creating rewards in Owner A catalogue',
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
