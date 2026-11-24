/**
 * Verification Suite — Module 8:
 *   Standalone Loyalty & AI Google Review OS (LoyaltyOS)
 *   - Static QR/NFC visit star claim & cooldown anti-fraud lock
 *   - 4-Digit Counter PIN verification & Cashier Live Approval queue
 *   - Automatic 5-star reward conversion & 4-digit in-store counter lock redemption
 *   - Walk-in manual Desk Star issuer
 *   - AI Google Review bonus single-claim guard
 *   - Multi-tenant owner isolation + Migration 031 RLS & pg_catalog.substr SQL check
 *
 * Run with: deno run --allow-read --allow-env tests/verify-loyalty-ai-review-os.ts
 */

import { MockLocalStorageRepository } from '../src/services/storage/MockLocalStorageRepository.ts';
import {
  getIndustryBadgeMeta,
  getIndustryWorkspaceType,
  getPrimaryCustomerQrUrlForBusiness,
} from '../src/utils/gymValidation.ts';
import {
  getLoyaltyPortalUrl,
  isLoyaltyCategory,
  normalizeLoyaltyPhone,
} from '../src/utils/loyaltyValidation.ts';

let passed = 0;

function assert(condition: unknown, message: string, detail?: unknown) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`, detail ?? '');
    Deno.exit(1);
  }
  console.log(`  [PASS] ${message}`);
  passed++;
}

async function assertRejects(
  fn: () => Promise<unknown>,
  expectedPattern: RegExp,
  message: string,
) {
  try {
    await fn();
    console.error(`❌ FAIL (expected rejection): ${message}`);
    Deno.exit(1);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!expectedPattern.test(msg)) {
      console.error(
        `❌ FAIL (unexpected error message): ${message} — got "${msg}"`,
      );
      Deno.exit(1);
    }
    console.log(`  [PASS] ${message} (Blocked cleanly: "${msg}")`);
    passed++;
  }
}

async function runTests() {
  console.log('\n=== Module 8 Verification: LoyaltyOS & AI Google Review OS ===\n');

  // 1. Multi-Industry Router & URL helpers
  console.log('1. Industry Router & URL Utilities');
  assert(
    isLoyaltyCategory('loyalty') && !isLoyaltyCategory('cafe'),
    'isLoyaltyCategory isolates category = loyalty cleanly',
  );
  assert(
    getIndustryWorkspaceType('loyalty') === 'loyalty',
    'getIndustryWorkspaceType routes loyalty to dedicated LoyaltyOS workspace',
  );
  assert(
    getIndustryBadgeMeta('loyalty').moduleName === 'LoyaltyOS',
    'getIndustryBadgeMeta returns LoyaltyOS badge metadata',
  );
  assert(
    getLoyaltyPortalUrl('glow-boutique-rewards', 'https://example.com') ===
      'https://example.com/r/glow-boutique-rewards/loyalty',
    'getLoyaltyPortalUrl builds /r/:slug/loyalty URL',
  );
  assert(
    getPrimaryCustomerQrUrlForBusiness(
      { slug: 'glow-boutique-rewards', category: 'loyalty' },
      'https://example.com',
    ) === 'https://example.com/r/glow-boutique-rewards/loyalty',
    'Primary customer QR resolves to /r/:slug/loyalty for loyalty shops',
  );
  assert(
    normalizeLoyaltyPhone('+91 98765-43210') === '9876543210',
    'normalizeLoyaltyPhone strips +91 & punctuation cleanly',
  );

  // 2. Demo Store & Static QR/NFC Star Claim + Cooldown Shield
  console.log('\n2. Static QR/NFC Star Claim & Server Cooldown Shield');
  const repo = new MockLocalStorageRepository();
  const businesses = await repo.getBusinesses();
  const storeA = businesses.find((b) => b.slug === 'glow-boutique-rewards');
  assert(Boolean(storeA), 'Seeded active LoyaltyOS store loaded (glow-boutique-rewards)');
  const ownerAOpts = { actorOwnerId: storeA!.ownerId };
  const ownerBOpts = { actorOwnerId: 'owner-attacker-999' };

  const initialHub = await repo.getPublicLoyaltyHub(storeA!.slug, null);
  assert(
    initialHub !== null &&
      initialHub.config.starsRequired === 5 &&
      !('counterSecretPin' in initialHub.config),
    'getPublicLoyaltyHub returns config & never exposes counterSecretPin publicly',
  );

  const claim1 = await repo.claimLoyaltyVisitStar({
    businessSlug: storeA!.slug,
    customerName: 'Rahul Sharma',
    phone: '9876500001',
    sourceChannel: 'qr_nfc',
  });
  assert(
    !claim1.pendingApproval &&
      claim1.card.memberCode === 'STAR-001' &&
      claim1.card.currentStars === 1,
    'First QR/NFC visit registers STAR-001 & credits +1 Star immediately',
  );

  await assertRejects(
    () =>
      repo.claimLoyaltyVisitStar({
        businessSlug: storeA!.slug,
        customerName: 'Rahul Sharma',
        phone: '+91 98765 00001',
      }),
    /Cooldown active/i,
    'Repeat scan inside 12h cooldown is blocked server-side',
  );

  // 3. 4-Digit Counter PIN Verification Mode
  console.log('\n3. 4-Digit Counter PIN Anti-Fraud Mode');
  await repo.updateLoyaltyProgramConfig(
    storeA!.id,
    {
      starsRequired: 5,
      rewardTitle: 'Flat 20% OFF Storewide',
      verificationMode: 'counter_pin',
      counterSecretPin: '4821',
      scanCooldownHours: 12,
      googleReviewBonusEnabled: true,
      googleReviewBonusStars: 1,
      brandAccentHex: '#C8F135',
    },
    ownerAOpts,
  );

  await assertRejects(
    () =>
      repo.claimLoyaltyVisitStar({
        businessSlug: storeA!.slug,
        customerName: 'Ananya',
        phone: '9876500002',
        counterPin: '0000',
      }),
    /Invalid Counter PIN/i,
    'Counter PIN mode rejects wrong counter code',
  );

  const pinClaim = await repo.claimLoyaltyVisitStar({
    businessSlug: storeA!.slug,
    customerName: 'Ananya',
    phone: '9876500002',
    counterPin: '4821',
  });
  assert(
    pinClaim.card.memberCode === 'STAR-002' && pinClaim.card.currentStars === 1,
    'Valid Counter PIN 4821 credits visit star for STAR-002',
  );

  // 4. Cashier Live Approval Mode
  console.log('\n4. Cashier Live Approval Mode');
  await repo.updateLoyaltyProgramConfig(
    storeA!.id,
    {
      starsRequired: 5,
      rewardTitle: 'Flat 20% OFF Storewide',
      verificationMode: 'cashier_approval',
      scanCooldownHours: 12,
      googleReviewBonusEnabled: true,
      googleReviewBonusStars: 1,
    },
    ownerAOpts,
  );

  const pendingReq = await repo.claimLoyaltyVisitStar({
    businessSlug: storeA!.slug,
    customerName: 'Vikram',
    phone: '9876500003',
  });
  assert(
    pendingReq.pendingApproval === true &&
      pendingReq.card.currentStars === 0 &&
      Boolean(pendingReq.eventId),
    'Cashier Approval mode queues pending request without crediting star prematurely',
  );

  await assertRejects(
    () =>
      repo.claimLoyaltyVisitStar({
        businessSlug: storeA!.slug,
        customerName: 'Vikram',
        phone: '9876500003',
      }),
    /waiting for cashier approval/i,
    'Duplicate pending request blocked until cashier resolves',
  );

  await repo.approvePendingLoyaltyStar({
    businessId: storeA!.id,
    eventId: pendingReq.eventId!,
    decision: 'approved',
    options: ownerAOpts,
  });

  const vikramAfter = await repo.getPublicLoyaltyHub(storeA!.slug, '9876500003');
  assert(
    vikramAfter?.card?.currentStars === 1,
    'Owner approving pending request credits +1 ★ cleanly',
  );

  // 5. Star-to-Reward Rollover, In-Store 4-Digit Lock & Desk Star Issuer
  console.log('\n5. 5-Star Reward Conversion & 4-Digit Counter Lock Redemption');
  await repo.updateLoyaltyProgramConfig(
    storeA!.id,
    {
      starsRequired: 5,
      rewardTitle: 'Flat 20% OFF Storewide',
      verificationMode: 'cooldown_only',
      scanCooldownHours: 12,
      googleReviewBonusEnabled: true,
      googleReviewBonusStars: 1,
    },
    ownerAOpts,
  );

  // Rahul currently has 1 star; award 4 more visits using deterministic test bypass -> 5/5 resets to 0 & unlocks 1 reward
  for (let i = 0; i < 3; i++) {
    await repo.claimLoyaltyVisitStar({
      businessSlug: storeA!.slug,
      customerName: 'Rahul Sharma',
      phone: '9876500001',
      bypassCooldownForTest: true,
    });
  }
  const fifthVisit = await repo.claimLoyaltyVisitStar({
    businessSlug: storeA!.slug,
    customerName: 'Rahul Sharma',
    phone: '9876500001',
    bypassCooldownForTest: true,
  });
  assert(
    fifthVisit.justUnlockedReward === true &&
      fifthVisit.card.currentStars === 0 &&
      fifthVisit.card.rewardsUnlocked === 1 &&
      fifthVisit.card.lifetimeStars === 5,
    '5th star converts automatically to 1 unlocked reward & resets cycle to 0/5',
  );

  const lockCard = await repo.requestLoyaltyRewardRedemption({
    businessSlug: storeA!.slug,
    phone: '9876500001',
  });
  assert(
    typeof lockCard.pendingRedemptionCode === 'string' &&
      /^\d{4}$/.test(lockCard.pendingRedemptionCode),
    'Customer claiming reward generates 4-digit in-store counter verification code',
  );

  const confirmed = await repo.confirmLoyaltyRewardRedemption({
    businessId: storeA!.id,
    cardId: lockCard.id,
    options: ownerAOpts,
  });
  assert(
    confirmed.rewardsUnlocked === 0 &&
      confirmed.rewardsRedeemed === 1 &&
      confirmed.pendingRedemptionCode === null,
    'Owner confirming counter code decrements unlocked rewards & increments redeemed count',
  );

  await assertRejects(
    () =>
      repo.confirmLoyaltyRewardRedemption({
        businessId: storeA!.id,
        cardId: lockCard.id,
        options: ownerAOpts,
      }),
    /No unlocked reward/i,
    'Double redemption of already-confirmed reward is blocked',
  );

  const deskCard = await repo.issueLoyaltyDeskStar({
    businessId: storeA!.id,
    customerName: 'Walk-In Desk Guest',
    phone: '9876500099',
    note: 'Walk-in checkout',
    options: ownerAOpts,
  });
  assert(
    deskCard.currentStars === 1 && deskCard.customerName === 'Walk-In Desk Guest',
    'Owner issues +1 manual Desk Star to walk-in customer cleanly',
  );

  // 6. Google Review Bonus Single-Claim & Owner KPIs
  console.log('\n6. Bonus Claim Single-Use & Dashboard KPIs');
  const bonus = await repo.claimLoyaltyGoogleReviewBonus({
    businessSlug: storeA!.slug,
    phone: '9876500001',
  });
  assert(
    bonus.card.googleReviewBonusClaimed === true && bonus.card.currentStars === 1,
    'Review bonus credits once per card',
  );
  await assertRejects(
    () =>
      repo.claimLoyaltyGoogleReviewBonus({
        businessSlug: storeA!.slug,
        phone: '9876500001',
      }),
    /already claimed/i,
    'Duplicate Google review bonus claim is rejected',
  );

  const dash = await repo.getLoyaltyOwnerDashboard(storeA!.id, ownerAOpts);
  assert(
    dash.kpis.totalMembers === 4 &&
      dash.kpis.rewardsRedeemed === 1 &&
      dash.kpis.aiReviewsGenerated === 1 &&
      dash.kpis.starsIssuedThisMonth >= 8,
    'Owner dashboard aggregates real KPIs, members & activity feed accurately',
  );

  // 7. Strict Multi-Tenant Owner Isolation
  console.log('\n7. Multi-Tenant Isolation & Migration 031 Security Audit');
  await assertRejects(
    () => repo.getLoyaltyOwnerDashboard(storeA!.id, ownerBOpts),
    /Unauthorized/i,
    'Cross-tenant owner cannot read store loyalty dashboard',
  );
  await assertRejects(
    () =>
      repo.updateLoyaltyProgramConfig(
        storeA!.id,
        {
          starsRequired: 3,
          rewardTitle: 'Hijacked',
          verificationMode: 'cooldown_only',
          scanCooldownHours: 1,
          googleReviewBonusEnabled: false,
          googleReviewBonusStars: 1,
        },
        ownerBOpts,
      ),
    /Unauthorized/i,
    'Cross-tenant owner cannot modify store loyalty config or PIN',
  );
  await assertRejects(
    () =>
      repo.issueLoyaltyDeskStar({
        businessId: storeA!.id,
        customerName: 'Fake',
        phone: '9876500088',
        options: ownerBOpts,
      }),
    /Unauthorized/i,
    'Cross-tenant owner cannot issue desk stars',
  );

  // Static audit of Migration 031
  const sql = await Deno.readTextFile(
    'supabase/migrations/031_standalone_loyalty_and_ai_review_os.sql',
  );
  assert(
    sql.includes('enable row level security') &&
      sql.includes('force row level security') &&
      sql.includes('revoke all on table public.loyalty_program_configs from public, anon') &&
      sql.includes('revoke all on table public.loyalty_member_cards from public, anon') &&
      sql.includes('revoke all on table public.loyalty_star_events from public, anon'),
    'Migration 031 enforces ENABLE + FORCE RLS and REVOKE ALL FROM public, anon on all 3 tables',
  );
  assert(
    sql.includes('pg_catalog.substr(') &&
      !/pg_catalog\.substring\s*\([^)]*\bfrom\b/i.test(sql) &&
      !/\bsubstring\s*\([^)]*\bfrom\b/i.test(sql),
    'Migration 031 strictly uses pg_catalog.substr() (zero substring ... from syntax)',
  );

  console.log(`\n🎉 ALL ${passed} MODULE 8 (LOYALTYOS) ASSERTIONS PASSED!\n`);
}

void runTests();
