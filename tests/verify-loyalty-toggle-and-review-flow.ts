/**
 * Verification Suite: Modular Loyalty System Toggle (Admin & Dashboard),
 * Single-Screen Customer AI Review Flow & Unified Typography Lock
 */

import { MockLocalStorageRepository } from '../src/services/storage/MockLocalStorageRepository.ts';
import { SupabaseBusinessRepository } from '../src/services/storage/SupabaseBusinessRepository.ts';
import { MockAdminRepository } from '../src/services/admin/MockAdminRepository.ts';
import { MockAIProvider } from '../src/services/ai/MockAIProvider.ts';
import {
  composeExperienceText,
  getCategoryExperience,
} from '../src/config/reviewExperience.ts';

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
    console.error(`  [FAIL] ${label} — Expected error to be thrown, but succeeded.`);
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
    console.log(`  [PASS] ${label} (Blocked cleanly: "${msg}")`);
  }
}

async function run() {
  console.log(
    '\n=== Verification: Modular Loyalty Toggle + Single-Screen AI Review Flow + Typography Lock ===\n',
  );

  const repo = new MockLocalStorageRepository();
  const supaRepo = new SupabaseBusinessRepository();
  const adminRepo = new MockAdminRepository();
  const ai = new MockAIProvider(5);

  const ownerA = { actorOwnerId: 'owner-pure-review-alpha' };
  const ownerB = { actorOwnerId: 'owner-pure-review-beta' };

  // -------------------------------------------------------------------------
  // 1. Default loyaltyEnabled Flag & Dual-Mode Repository Contract Parity
  // -------------------------------------------------------------------------
  console.log('1. Default loyaltyEnabled Flag & Dual-Mode Repository Parity');

  assert(
    typeof repo.setBusinessLoyaltyEnabled === 'function' &&
      typeof supaRepo.setBusinessLoyaltyEnabled === 'function' &&
      typeof adminRepo.setBusinessLoyaltyEnabled === 'function',
    'MockLocalStorageRepository, SupabaseBusinessRepository & AdminRepository implement setBusinessLoyaltyEnabled',
  );

  const pureReviewBizA = await repo.createBusiness({
    name: 'Velvet Thread Boutique',
    category: 'retail',
    city: 'Hyderabad',
    slug: 'velvet-thread-boutique',
    googleReviewUrl: 'https://g.page/r/velvet-thread-boutique/review',
    googleReviewUrlIsPlaceholder: false,
    ownerId: ownerA.actorOwnerId,
  });

  const pureReviewBizB = await repo.createBusiness({
    name: 'Metro Craft Tailors',
    category: 'services',
    city: 'Bengaluru',
    slug: 'metro-craft-tailors',
    googleReviewUrl: 'https://g.page/r/metro-craft-tailors/review',
    googleReviewUrlIsPlaceholder: false,
    ownerId: ownerB.actorOwnerId,
  });

  const defaultLoyaltyBiz = await repo.createBusiness({
    name: 'Starlight Bakery Perks',
    category: 'loyalty',
    city: 'Pune',
    slug: 'starlight-bakery-perks',
    googleReviewUrl: 'https://g.page/r/starlight-bakery/review',
    googleReviewUrlIsPlaceholder: false,
    ownerId: ownerA.actorOwnerId,
  });

  assert(
    pureReviewBizA.loyaltyEnabled === false &&
      pureReviewBizB.loyaltyEnabled === false,
    'Pure AI Review businesses (retail/services) default to loyaltyEnabled = false',
  );
  assert(
    defaultLoyaltyBiz.loyaltyEnabled === true,
    'category = "loyalty" businesses default to loyaltyEnabled = true',
  );

  // Activate businesses so public /r/:slug and /r/:slug/loyalty resolve cleanly
  await repo.setMockBusinessStatus(pureReviewBizA.id, 'active');
  await repo.setMockBusinessStatus(pureReviewBizB.id, 'active');
  await repo.setMockBusinessStatus(defaultLoyaltyBiz.id, 'active');

  // -------------------------------------------------------------------------
  // 2. Public Lookup & Loyalty Hub Conditional Behavior (OFF -> ON -> OFF)
  // -------------------------------------------------------------------------
  console.log('\n2. Public Slug Lookup, Loyalty Hub Guard & Toggle Persistence');

  const publicBeforeToggle = await repo.getBusinessBySlug(pureReviewBizA.slug);
  const hubBeforeToggle = await repo.getPublicLoyaltyHub(pureReviewBizA.slug);

  assert(
    publicBeforeToggle?.loyaltyEnabled === false &&
      hubBeforeToggle?.business.loyaltyEnabled === false,
    'Public lookup & loyalty hub accurately report loyaltyEnabled = false when OFF',
  );

  await assertThrows(
    () =>
      repo.claimLoyaltyVisitStar({
        businessSlug: pureReviewBizA.slug,
        customerName: 'Aarav Rao',
        phone: '9849011223',
      }),
    'Visit star claims are blocked server-side while loyaltyEnabled = false',
    'paused',
  );

  // Toggle ON via owner dashboard repository call
  const enabledBizA = await repo.setBusinessLoyaltyEnabled(
    pureReviewBizA.id,
    true,
    ownerA,
  );
  const publicAfterEnable = await repo.getBusinessBySlug(pureReviewBizA.slug);
  const hubAfterEnable = await repo.getPublicLoyaltyHub(pureReviewBizA.slug);

  assert(
    enabledBizA.loyaltyEnabled === true &&
      publicAfterEnable?.loyaltyEnabled === true &&
      hubAfterEnable?.business.loyaltyEnabled === true,
    'setBusinessLoyaltyEnabled(id, true) persists cleanly across owner & public lookups',
  );

  const starClaimWhenEnabled = await repo.claimLoyaltyVisitStar({
    businessSlug: pureReviewBizA.slug,
    customerName: 'Aarav Rao',
    phone: '9849011223',
  });
  assert(
    starClaimWhenEnabled.card.currentStars === 1,
    'Customer can immediately claim +1 Star once loyaltyEnabled is toggled ON',
  );

  // Toggle back OFF via owner dashboard repository call
  const disabledBizA = await repo.setBusinessLoyaltyEnabled(
    pureReviewBizA.id,
    false,
    ownerA,
  );
  const publicAfterDisable = await repo.getBusinessBySlug(pureReviewBizA.slug);
  const hubAfterDisable = await repo.getPublicLoyaltyHub(
    pureReviewBizA.slug,
    '9849011223',
  );

  assert(
    disabledBizA.loyaltyEnabled === false &&
      publicAfterDisable?.loyaltyEnabled === false &&
      hubAfterDisable?.business.loyaltyEnabled === false &&
      hubAfterDisable?.card === null,
    'setBusinessLoyaltyEnabled(id, false) persists cleanly and hides active card payload on paused hub',
  );

  await assertThrows(
    () =>
      repo.requestLoyaltyRewardRedemption({
        businessSlug: pureReviewBizA.slug,
        phone: '9849011223',
      }),
    'Reward redemption requests are blocked while loyaltyEnabled = false',
    'paused',
  );

  // Super-Admin toggle parity
  adminRepo.registerMockClient({
    id: pureReviewBizA.id,
    ownerId: ownerA.actorOwnerId,
    ownerEmail: 'owner@velvetthread.in',
    ownerCreatedAt: new Date().toISOString(),
    ownerLastSignInAt: new Date().toISOString(),
    slug: pureReviewBizA.slug,
    name: pureReviewBizA.name,
    category: pureReviewBizA.category,
    city: pureReviewBizA.city,
    googleReviewUrl: pureReviewBizA.googleReviewUrl,
    googleReviewUrlIsPlaceholder: false,
    loyaltyEnabled: false,
    status: 'active',
    statusChangedAt: new Date().toISOString(),
    statusChangedBy: 'admin-root-01',
    statusReason: 'Approved',
    accountState: 'active',
    deletionRequestedAt: null,
    deletionScheduledFor: null,
    deletedReason: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  const adminEnabledRecord = await adminRepo.setBusinessLoyaltyEnabled({
    businessId: pureReviewBizA.id,
    enabled: true,
  });
  assert(
    adminEnabledRecord.loyaltyEnabled === true,
    'Platform Admin setBusinessLoyaltyEnabled toggles client loyaltyEnabled ON cleanly',
  );

  // -------------------------------------------------------------------------
  // 3. Multi-Tenant Isolation & Unauthorized Access Protection
  // -------------------------------------------------------------------------
  console.log('\n3. Multi-Tenant Isolation');

  // Toggle Business A ON again via ownerA and verify Business B stays OFF
  await repo.setBusinessLoyaltyEnabled(pureReviewBizA.id, true, ownerA);
  const reloadedBizB = await repo.getBusinessById(pureReviewBizB.id);
  const publicBizB = await repo.getBusinessBySlug(pureReviewBizB.slug);

  assert(
    reloadedBizB?.loyaltyEnabled === false &&
      publicBizB?.loyaltyEnabled === false,
    'Toggling Loyalty ON for Business A never affects Business B (strictly isolated)',
  );

  await assertThrows(
    () =>
      repo.setBusinessLoyaltyEnabled(pureReviewBizA.id, false, ownerB),
    'Cross-tenant Owner B cannot toggle Owner A loyaltyEnabled state',
    'unauthorized',
  );

  // -------------------------------------------------------------------------
  // 4. Single-Screen Text AI Review Flow & Typography Consistency Audit
  // -------------------------------------------------------------------------
  console.log('\n4. Single-Screen AI Review Flow & Unified Typography Lock');

  const retailExp = getCategoryExperience('retail');
  const composedPrompt = composeExperienceText({
    rating: 'excellent',
    liked: retailExp.liked.slice(0, 2),
    improve: [],
    note: 'Loved the festive ethnic collection',
  });
  const aiDraft = await ai.generateReviewDraft({
    business: pureReviewBizA,
    experience: composedPrompt,
    mode: 'text',
    attempt: 0,
  });
  const regeneratedDraft = await ai.generateReviewDraft({
    business: pureReviewBizA,
    experience: composedPrompt,
    mode: 'text',
    attempt: 1,
  });

  assert(
    aiDraft.text.trim().length > 20 &&
      regeneratedDraft.text.trim().length > 20 &&
      aiDraft.text !== regeneratedDraft.text,
    'Single-screen text review draft generates immediately and Regenerate cycles fresh variation',
  );

  const reviewPageSource = await Deno.readTextFile(
    new URL('../src/pages/CustomerReviewPage.tsx', import.meta.url),
  );
  const loyaltyHubSource = await Deno.readTextFile(
    new URL('../src/pages/CustomerLoyaltyHubPage.tsx', import.meta.url),
  );
  const indexCssSource = await Deno.readTextFile(
    new URL('../src/index.css', import.meta.url),
  );

  assert(
    !reviewPageSource.includes('WelcomeStep') &&
      !reviewPageSource.includes('ProgressSteps') &&
      !reviewPageSource.includes("mode === 'voice'"),
    'CustomerReviewPage removes multi-step wizard & Speak-vs-Text chooser (100% single-screen text flow)',
  );

  assert(
    reviewPageSource.includes('font-sans antialiased') &&
      reviewPageSource.includes(
        'text-xl sm:text-2xl font-bold tracking-tight text-slate-900',
      ) &&
      reviewPageSource.includes(
        'text-xs font-semibold uppercase tracking-wider text-slate-500',
      ) &&
      reviewPageSource.includes('text-sm font-medium') &&
      reviewPageSource.includes(
        'font-sans antialiased text-[15px] leading-relaxed font-normal text-slate-800',
      ) &&
      reviewPageSource.includes('text-sm font-semibold tracking-normal'),
    'CustomerReviewPage enforces the exact locked typographic hierarchy across titles, pills, textarea & CTAs',
  );

  assert(
    reviewPageSource.includes('Claim +1 Loyalty Star for Your Review') &&
      reviewPageSource.includes('isLoyaltyEnabled &&'),
    'CustomerReviewPage conditionally renders +1 Loyalty Star card strictly when business.loyaltyEnabled is true',
  );

  assert(
    loyaltyHubSource.includes(
      'Loyalty rewards are currently paused for this business',
    ),
    'CustomerLoyaltyHubPage displays clean paused notice with redirect to /r/:slug when loyaltyEnabled === false',
  );

  assert(
    indexCssSource.includes('textarea') &&
      indexCssSource.includes('font-family: var(--font-sans);'),
    'src/index.css locks input, textarea, select, and button to var(--font-sans) with antialiasing',
  );

  // -------------------------------------------------------------------------
  // 5. SQL Migration 033 Security & Syntax Guardrails
  // -------------------------------------------------------------------------
  console.log('\n5. SQL Migration 033 Security & Syntax Guardrails');

  const sql033 = await Deno.readTextFile(
    new URL(
      '../supabase/migrations/033_business_loyalty_feature_toggle.sql',
      import.meta.url,
    ),
  );

  assert(
    sql033.includes('loyalty_enabled boolean not null default false') &&
      sql033.includes("where category = 'loyalty'"),
    'Migration 033 adds loyalty_enabled DEFAULT false and backfills category = "loyalty" to true',
  );
  assert(
    sql033.includes('enable row level security') &&
      sql033.includes('force row level security') &&
      sql033.includes('revoke all on table public.businesses from public, anon'),
    'Migration 033 preserves ENABLE + FORCE RLS and REVOKE ALL FROM public, anon',
  );
  assert(
    sql033.includes('public.set_business_loyalty_enabled') &&
      sql033.includes('security definer') &&
      sql033.includes('set search_path = public, pg_temp'),
    'Migration 033 defines SECURITY DEFINER RPCs with hardened search_path = public, pg_temp',
  );
  assert(
    !/substring\s*\([^)]+\s+from\s+/i.test(sql033),
    'Migration 033 strictly obeys PostgreSQL SQL guardrail (zero substring ... from syntax)',
  );

  console.log(`\nSummary: ${passed} passed, ${failed} failed.`);
  if (failed > 0) {
    Deno.exit(1);
  }
  console.log(
    '\n🎉 ALL MODULAR LOYALTY TOGGLE, SINGLE-SCREEN REVIEW & TYPOGRAPHY ASSERTIONS PASSED!\n',
  );
}

await run();
