/**
 * Phase 2 — Automated Verification Suite for Customer Identity, Restaurant Games & Secure Game-Points Ledger
 *
 * Verifies:
 * 1. Lightweight Customer Accounts (instant guest token check-in, phone/email linking, cross-visit wallet persistence)
 * 2. Owner Game Configuration & Custom Restaurant Trivia validation
 * 3. Anti-Cheat Server-Side Challenge & Answer Verification (answers stripped from client payload; wrong answers or forged memory moves award 0 pts)
 * 4. Idempotency & Replay Prevention (re-submitting the same sessionId or idempotencyKey never double-awards points)
 * 5. Cooldown Enforcement (blocks replaying a game during its active cooldown window)
 * 6. Daily Point Cap Enforcement (caps points at max_points_per_day_per_customer and blocks new sessions once reached)
 * 7. Multi-Tenant Isolation (game points earned at Restaurant A never leak into Restaurant B; cross-owner config mutation blocked)
 */

import {
  validateRestaurantCustomerCheckInInput,
  validateRestaurantGameConfigInput,
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
  console.log('Phase 2: Customer Identity, Restaurant Games & Game-Points Ledger');
  console.log('===================================================================\n');

  const repo = new MockLocalStorageRepository();
  const businesses = await repo.getBusinesses();
  const restaurantA = businesses[0]; // The Urban Kitchen (active, owner-urban-1)

  // Create a second active restaurant for multi-tenant isolation tests
  const createdB = await repo.createBusiness({
    ownerId: 'owner-spice-2',
    slug: 'deccan-spice-house',
    name: 'Deccan Spice House',
    category: 'restaurant',
    city: 'Hyderabad',
    googleReviewUrl: 'https://g.page/r/deccan-spice-house/review',
    googleReviewUrlIsPlaceholder: false,
  });
  // Activate both restaurant profiles
  await repo.updateRestaurantProfile(restaurantA.id, {
    isEnabled: true,
    currencyCode: 'INR',
    gamesEnabled: true,
    loyaltyEnabled: true,
  });

  // ---------------------------------------------------------------------------
  // 1. Customer Check-In: Instant Guest -> Phone/Email Upgrade -> Resume
  // ---------------------------------------------------------------------------
  console.log('1. Lightweight Customer Accounts (Guest Token & Phone/Email Claim)');
  assert(
    !validateRestaurantCustomerCheckInInput({ displayName: '   ' }).ok,
    'Rejects empty customer display name',
  );

  const guestToken = 'guest-token-aarav-12345';
  const guestSession = await repo.registerOrResumeRestaurantCustomer({
    displayName: 'Aarav',
    guestTokenHash: guestToken,
    businessSlug: restaurantA.slug,
  });
  assert(
    guestSession.customer.displayName === 'Aarav' &&
      guestSession.customer.phoneOrEmail === null &&
      guestSession.gamePointsBalance === 0,
    'Created instant guest diner profile with 0 initial Game Points',
  );

  // Upgrade guest profile by linking phone/email
  const linkedSession = await repo.registerOrResumeRestaurantCustomer({
    displayName: 'Aarav Sharma',
    phoneOrEmail: 'aarav@example.com',
    guestTokenHash: guestToken,
    businessSlug: restaurantA.slug,
  });
  assert(
    linkedSession.customer.id === guestSession.customer.id &&
      linkedSession.customer.phoneOrEmail === 'aarav@example.com',
    'Linking phone/email upgrades existing guest profile while preserving customer ID',
  );

  // ---------------------------------------------------------------------------
  // 2. Owner Game Configuration & Custom Trivia Validation
  // ---------------------------------------------------------------------------
  console.log('\n2. Owner Game Configuration & Custom Restaurant Trivia');
  const defaultGames = await repo.getRestaurantGameConfigs(restaurantA.id);
  assert(
    defaultGames.length === 3 &&
      defaultGames.some((g) => g.gameSlug === 'dish-trivia') &&
      defaultGames.some((g) => g.gameSlug === 'memory-match') &&
      defaultGames.some((g) => g.gameSlug === 'table-word-chain'),
    'Initializes 3 default restaurant games (Solo Trivia, Memory Match, Same-Table Challenge)',
  );

  assert(
    !validateRestaurantGameConfigInput(restaurantA.id, {
      gameSlug: 'dish-trivia',
      isEnabled: true,
      pointsPerWin: -10,
      maxPointsPerDayPerCustomer: 50,
      cooldownMinutes: 5,
    }).ok,
    'Rejects negative pointsPerWin in game configuration',
  );

  assert(
    !validateRestaurantGameConfigInput(restaurantA.id, {
      gameSlug: 'dish-trivia',
      isEnabled: true,
      pointsPerWin: 10,
      maxPointsPerDayPerCustomer: 50,
      cooldownMinutes: 5,
      customQuestions: [
        {
          prompt: 'What is our signature spice?',
          options: ['Saffron', 'Cardamom'],
          correctIndex: 5, // out of bounds
        },
      ],
    }).ok,
    'Rejects custom trivia question with out-of-range correctIndex',
  );

  // Configure custom trivia with cooldown=0 first so we can test multiple rounds & caps, then test cooldown=10
  const customTriviaCfg = await repo.updateRestaurantGameConfig(
    restaurantA.id,
    {
      gameSlug: 'dish-trivia',
      title: "Urban Kitchen Chef's Trivia",
      category: 'solo',
      isEnabled: true,
      pointsPerWin: 15,
      maxPointsPerDayPerCustomer: 25,
      cooldownMinutes: 0,
      customQuestions: [
        {
          prompt: 'Which region inspired our Zafrani Dum Biryani?',
          options: ['Hyderabad', 'Jaipur', 'Kochi'],
          correctIndex: 0,
        },
        {
          prompt: 'How many hours do we slow-marinate our Malai Paneer?',
          options: ['1 hour', '8 hours', '10 minutes'],
          correctIndex: 1,
        },
      ],
    },
  );
  assert(
    customTriviaCfg.pointsPerWin === 15 &&
      customTriviaCfg.maxPointsPerDayPerCustomer === 25 &&
      customTriviaCfg.customQuestions?.length === 2,
    'Saved custom restaurant trivia questions and point rules (15 pts/win, 25 pts/day cap)',
  );

  // ---------------------------------------------------------------------------
  // 3. Anti-Cheat Challenge Sanitizing & Server-Side Answer Verification
  // ---------------------------------------------------------------------------
  console.log('\n3. Anti-Cheat Challenge Sanitizing & Server-Side Verification');
  const startedTrivia1 = await repo.startRestaurantGameSession({
    businessSlug: restaurantA.slug,
    customerId: linkedSession.customer.id,
    gameSlug: 'dish-trivia',
  });

  const rawClientJson = JSON.stringify(startedTrivia1.challenge);
  assert(
    !rawClientJson.includes('correctIndex') &&
      !rawClientJson.includes('expectedAnswers') &&
      startedTrivia1.challenge.questions?.length === 2,
    'Client challenge payload strips out correctIndex and expectedAnswers',
  );

  // Submit WRONG answers -> verify 0 points awarded
  const failedAttempt = await repo.completeRestaurantGameSession({
    sessionId: startedTrivia1.sessionId,
    customerId: linkedSession.customer.id,
    submission: { answers: [2, 2] },
    idempotencyKey: `idem-fail-${startedTrivia1.sessionId}`,
  });
  assert(
    failedAttempt.passed === false &&
      failedAttempt.pointsAwarded === 0 &&
      failedAttempt.newBalance === 0,
    'Wrong trivia answers result in passed=false and 0 Game Points awarded',
  );

  // Start second session and submit CORRECT answers ([0, 1]) -> verify +15 points awarded
  const startedTrivia2 = await repo.startRestaurantGameSession({
    businessSlug: restaurantA.slug,
    customerId: linkedSession.customer.id,
    gameSlug: 'dish-trivia',
  });
  const winningAttempt = await repo.completeRestaurantGameSession({
    sessionId: startedTrivia2.sessionId,
    customerId: linkedSession.customer.id,
    submission: { answers: [0, 1] },
    idempotencyKey: `idem-win-${startedTrivia2.sessionId}`,
  });
  assert(
    winningAttempt.passed === true &&
      winningAttempt.score === 2 &&
      winningAttempt.pointsAwarded === 15 &&
      winningAttempt.newBalance === 15 &&
      winningAttempt.transactionId !== null,
    'Correct trivia answers award +15 verified Game Points and update balance to 15',
  );

  // ---------------------------------------------------------------------------
  // 4. Idempotency & Duplicate Replay Prevention
  // ---------------------------------------------------------------------------
  console.log('\n4. Idempotency & Duplicate Replay Prevention');
  const duplicateReplaySameKey = await repo.completeRestaurantGameSession({
    sessionId: startedTrivia2.sessionId,
    customerId: linkedSession.customer.id,
    submission: { answers: [0, 1] },
    idempotencyKey: `idem-win-${startedTrivia2.sessionId}`,
  });
  assert(
    duplicateReplaySameKey.alreadyProcessed === true &&
      duplicateReplaySameKey.newBalance === 15 &&
      duplicateReplaySameKey.transactionId === winningAttempt.transactionId,
    'Re-submitting with the same idempotencyKey returns alreadyProcessed=true and never double-awards points',
  );

  const duplicateReplayNewKeySameSession =
    await repo.completeRestaurantGameSession({
      sessionId: startedTrivia2.sessionId,
      customerId: linkedSession.customer.id,
      submission: { answers: [0, 1] },
      idempotencyKey: `idem-different-key-${startedTrivia2.sessionId}`,
    });
  assert(
    duplicateReplayNewKeySameSession.alreadyProcessed === true &&
      duplicateReplayNewKeySameSession.newBalance === 15,
    'Re-submitting an already completed sessionId with a different idempotencyKey is also blocked from double-awarding',
  );

  // ---------------------------------------------------------------------------
  // 5. Daily Point Cap Enforcement (max_points_per_day_per_customer = 25)
  // ---------------------------------------------------------------------------
  console.log('\n5. Daily Point Cap Enforcement');
  // Customer currently has 15 pts today; daily cap on dish-trivia is 25 pts.
  // Winning another 15-pt game should clamp pointsAwarded to 10 pts (reaching 25 pts total).
  const startedTrivia3 = await repo.startRestaurantGameSession({
    businessSlug: restaurantA.slug,
    customerId: linkedSession.customer.id,
    gameSlug: 'dish-trivia',
  });
  const clampedWin = await repo.completeRestaurantGameSession({
    sessionId: startedTrivia3.sessionId,
    customerId: linkedSession.customer.id,
    submission: { answers: [0, 1] },
    idempotencyKey: `idem-clamp-${startedTrivia3.sessionId}`,
  });
  assert(
    clampedWin.passed === true &&
      clampedWin.pointsAwarded === 10 &&
      clampedWin.newBalance === 25,
    'Daily cap clamps second win from 15 pts to 10 pts so daily total never exceeds 25 pts',
  );

  // Now customer has reached 25/25 pts today -> starting another session must be blocked
  await assertThrows(
    () =>
      repo.startRestaurantGameSession({
        businessSlug: restaurantA.slug,
        customerId: linkedSession.customer.id,
        gameSlug: 'dish-trivia',
      }),
    'Starting another session after reaching daily point limit is blocked',
    'Daily game point limit',
  );

  // ---------------------------------------------------------------------------
  // 6. Cooldown Enforcement & Memory Match / Same-Table Games
  // ---------------------------------------------------------------------------
  console.log('\n6. Cooldown Enforcement & Memory Match Anti-Cheat');
  // Raise daily cap on memory-match to 100 pts with a 5-minute cooldown
  await repo.updateRestaurantGameConfig(restaurantA.id, {
    gameSlug: 'memory-match',
    title: 'Flavor Memory Match',
    category: 'solo',
    isEnabled: true,
    pointsPerWin: 10,
    maxPointsPerDayPerCustomer: 100,
    cooldownMinutes: 5,
  });

  const memorySession = await repo.startRestaurantGameSession({
    businessSlug: restaurantA.slug,
    customerId: linkedSession.customer.id,
    gameSlug: 'memory-match',
  });

  // Complete memory match legitimately (4 pairs in 8 moves)
  const memoryWin = await repo.completeRestaurantGameSession({
    sessionId: memorySession.sessionId,
    customerId: linkedSession.customer.id,
    submission: { matchedPairs: 4, movesTaken: 8 },
    idempotencyKey: `idem-mem-${memorySession.sessionId}`,
  });
  assert(
    memoryWin.passed === true &&
      memoryWin.pointsAwarded === 10 &&
      memoryWin.newBalance === 35,
    'Valid Memory Match completion awards +10 pts (updated balance: 35 pts)',
  );

  // Immediate replay of memory-match must be blocked by the 5-minute cooldown
  await assertThrows(
    () =>
      repo.startRestaurantGameSession({
        businessSlug: restaurantA.slug,
        customerId: linkedSession.customer.id,
        gameSlug: 'memory-match',
      }),
    'Replaying Memory Match within the 5-minute cooldown window is blocked',
    'Cooldown active',
  );

  // Check participation stats for Owner A
  const statsA = await repo.getRestaurantGameStats(restaurantA.id);
  assert(
    statsA.totalSessionsPlayed === 4 &&
      statsA.gamePointsIssuedToday === 35 &&
      statsA.totalGamePointsIssued === 35,
    'Owner participation stats accurately report 4 completed sessions and 35 Game Points issued today',
  );

  // ---------------------------------------------------------------------------
  // 7. Cross-Visit Wallet Persistence & Multi-Tenant Isolation
  // ---------------------------------------------------------------------------
  console.log('\n7. Cross-Visit Wallet Persistence & Multi-Tenant Isolation');
  const resumedByEmail = await repo.registerOrResumeRestaurantCustomer({
    displayName: 'Aarav Sharma',
    phoneOrEmail: 'aarav@example.com',
    businessSlug: restaurantA.slug,
  });
  assert(
    resumedByEmail.gamePointsBalance === 35 &&
      resumedByEmail.recentTransactions.length === 3,
    'Resuming customer profile by email restores 35 Game Points and all 3 ledger entries at Restaurant A',
  );

  // Check balance for the exact same customer at a different business
  const walletAtOtherRestaurant =
    await repo.registerOrResumeRestaurantCustomer({
      displayName: 'Aarav Sharma',
      phoneOrEmail: 'aarav@example.com',
      businessSlug: createdB.slug,
    });
  assert(
    walletAtOtherRestaurant.gamePointsBalance === 0 &&
      walletAtOtherRestaurant.recentTransactions.length === 0,
    'Game Points earned at Restaurant A are strictly isolated and show 0 balance at Restaurant B',
  );

  await assertThrows(
    () =>
      repo.updateRestaurantGameConfig(
        restaurantA.id,
        {
          gameSlug: 'dish-trivia',
          isEnabled: false,
          pointsPerWin: 0,
          maxPointsPerDayPerCustomer: 0,
          cooldownMinutes: 0,
        },
        { actorOwnerId: 'owner-spice-2' },
      ),
    'Owner B blocked from modifying Owner A game configurations',
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
