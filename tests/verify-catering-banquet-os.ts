/**
 * Verification Suite — Module 10: CateringOS & Banquet Hall Management System
 *   1. Multi-Industry Router, CateringOS Badges, /r/:slug/catering + ?embed=1 URLs & Public Portal PIN Stripping
 *   2. Mixed Veg (120 x ₹300) + Non-Veg (80 x ₹420) Package + Hall Add-On Pricing & 3-Stage Milestone Split (30/50/20)
 *   3. Banquet Hall Slot Conflict Prevention, Min Headcount, Blackout Dates & Advance Notice Guardrails
 *   4. Stage 1 Payment Collection, On-Site +50 Extra Plates Recalculation & Vessel Dispatch/Return Gate-Pass
 *   5. Restricted Head Chef PIN Portal: Exact Per-100-Plate Recipe-to-Grocery Scaling & Zero Financial/Phone Leak Audit
 *   6. Multi-Tenant Isolation, Dual-Mode Parity & Migration 034 SQL RLS / pg_catalog.substr Security Audit
 *
 * Run with: deno run --allow-read --allow-env tests/verify-catering-banquet-os.ts
 */

import { MockLocalStorageRepository } from '../src/services/storage/MockLocalStorageRepository.ts';
import { SupabaseBusinessRepository } from '../src/services/storage/SupabaseBusinessRepository.ts';
import {
  addDaysToIsoDate,
  getIndustryBadgeMeta,
  getIndustryWorkspaceType,
  getPrimaryCustomerQrUrlForBusiness,
  getTodayIsoDateKey,
} from '../src/utils/gymValidation.ts';
import {
  buildCateringWhatsAppQuoteLink,
  getCateringPortalUrl,
  isCateringCategory,
} from '../src/utils/cateringValidation.ts';

let passed = 0;
let failed = 0;

function assert(condition: unknown, message: string, detail?: unknown): void {
  if (condition) {
    passed += 1;
    console.log(`  [PASS] ${message}`);
  } else {
    failed += 1;
    console.error(`  [FAIL] ${message}`, detail ?? '');
  }
}

async function assertRejects(
  fn: () => Promise<unknown>,
  expectedPattern: RegExp,
  message: string,
): Promise<void> {
  try {
    await fn();
    failed += 1;
    console.error(`  [FAIL] ${message} (Resolved instead of rejecting)`);
  } catch (err) {
    const msg = (err as Error).message || String(err);
    if (expectedPattern.test(msg)) {
      passed += 1;
      console.log(`  [PASS] ${message}`);
    } else {
      failed += 1;
      console.error(
        `  [FAIL] ${message} (Expected ${expectedPattern}, got "${msg}")`,
      );
    }
  }
}

console.log('\n============================================================');
console.log(' MODULE 10: CATERINGOS & BANQUET HALL VERIFICATION SUITE');
console.log('============================================================\n');

const repo = new MockLocalStorageRepository();
const todayIso = getTodayIsoDateKey();

// Create a clean dedicated CateringOS tenant for deterministic arithmetic assertions
const cateringBiz = await repo.createBusiness({
  ownerId: 'owner-nizami-caterers-01',
  slug: 'nizami-grand-caterers',
  name: 'Nizami Grand Caterers & Banquets',
  category: 'catering',
  city: 'Hyderabad',
  googleReviewUrl: 'https://g.page/r/nizami-grand-caterers/review',
  googleReviewUrlIsPlaceholder: false,
  status: 'active',
  accountState: 'active',
});

// ---------------------------------------------------------------------------
// 1. Multi-Industry Router, URLs & Public Portal Security
// ---------------------------------------------------------------------------
console.log('1. Multi-Industry Router, Embed URLs & Public Portal Security');

assert(
  isCateringCategory(cateringBiz.category) &&
    getIndustryWorkspaceType(cateringBiz.category) === 'catering',
  'category === "catering" routes cleanly to CateringOS workspace',
);

const badge = getIndustryBadgeMeta('catering');
assert(
  badge.moduleName === 'CateringOS' && badge.workspace === 'catering',
  'Industry badge metadata resolves to CateringOS',
  badge,
);

assert(
  getCateringPortalUrl(cateringBiz.slug, 'https://vitaran.app') ===
    'https://vitaran.app/r/nizami-grand-caterers/catering' &&
    getCateringPortalUrl(cateringBiz.slug, 'https://vitaran.app', true) ===
      'https://vitaran.app/r/nizami-grand-caterers/catering?embed=1' &&
    getPrimaryCustomerQrUrlForBusiness(cateringBiz, 'https://vitaran.app') ===
      'https://vitaran.app/r/nizami-grand-caterers/catering',
  'Public Catering URL, ?embed=1 iframe URL & QR standee URL resolve accurately',
);

const publicPortal = await repo.getPublicCateringPortal(cateringBiz.slug);
assert(
  publicPortal !== null &&
    publicPortal.packages.length >= 3 &&
    publicPortal.dishes.length >= 6 &&
    !('chefStationPin' in publicPortal.config),
  'Public catering portal loads starter packages/dishes and strips chefStationPin',
);

// ---------------------------------------------------------------------------
// 2. Mixed Veg + Non-Veg Package, Hall Add-On & 3-Stage Milestone Math
// ---------------------------------------------------------------------------
console.log('\n2. Mixed Veg/Non-Veg Package + Hall Add-On & 3-Stage Payment Split');

const silverPkg = publicPortal!.packages.find(
  (p) => p.tierBadge === 'Silver',
)!;
const biryaniDish = publicPortal!.dishes.find((d) =>
  d.dishName.includes('Chicken Dum Biryani'),
)!;

const eventDate1 = addDaysToIsoDate(todayIso, 6);
const eveningSlot = publicPortal!.config.hallSlots[2];

// 120 Veg x ₹300 (₹36,000) + 80 Non-Veg x ₹420 (₹33,600) = ₹69,600 food
// + Banquet Hall Rental ₹25,000 + Drop-Off Transport ₹2,000 = ₹96,600 subtotal
// + 5% GST (₹4,830) = ₹1,01,430 total (10143000 paise)
const order1 = await repo.submitCateringOrder({
  businessSlug: cateringBiz.slug,
  intakeChannel: 'website_embed',
  customerName: 'Anirudh Varma',
  customerPhone: '+91 98480 55667',
  occasionType: 'Wedding / Reception Banquet',
  eventDate: eventDate1,
  deliveryTime: '07:30 PM',
  serviceMode: 'drop_off',
  usesBanquetHall: true,
  hallSlot: eveningSlot,
  packageId: silverPkg.id,
  vegPlates: 120,
  nonVegPlates: 80,
  selectedDishIds: [biryaniDish.id],
  selectedHallAddonIds: ['hall_rent'],
  gstRatePercent: 5,
  chefNotes: 'Separate Veg counter on East wing.',
});

assert(
  order1.subtotalPaise === 9660000 &&
    order1.gstPaise === 483000 &&
    order1.totalAmountPaise === 10143000,
  'Mixed 120 Veg (₹300) + 80 Non-Veg (₹420) + ₹25k Hall + ₹2k Transport + 5% GST = ₹1,01,430 exact',
  {
    subtotal: order1.subtotalPaise,
    gst: order1.gstPaise,
    total: order1.totalAmountPaise,
  },
);

assert(
  order1.stage1AdvancePaise === 3042900 &&
    order1.stage2PreeventPaise === 5071500 &&
    order1.stage3BalancePaise === 2028600 &&
    order1.stage1AdvancePaise +
      order1.stage2PreeventPaise +
      order1.stage3BalancePaise ===
      order1.totalAmountPaise,
  '3-Stage Milestone Split (30% Advance / 50% Pre-Event / 20% Balance) sums 100% to totalAmountPaise',
);

const waLink = buildCateringWhatsAppQuoteLink({
  phone: order1.customerPhone,
  template: publicPortal!.config.whatsappQuoteTemplate,
  customerName: order1.customerName,
  orderCode: order1.orderCode,
  eventDate: order1.eventDate,
  totalPlates: 200,
  totalAmountPaise: order1.totalAmountPaise,
  advanceAmountPaise: order1.stage1AdvancePaise,
});
assert(
  waLink.whatsappUrl.startsWith('https://wa.me/919848055667?text=') &&
    waLink.message.includes(order1.orderCode),
  'WhatsApp quote link normalizes Indian +91 number and interpolates order code & total',
);

// ---------------------------------------------------------------------------
// 3. Conflict Checks, Min Headcount, Blackout Dates & Advance Notice
// ---------------------------------------------------------------------------
console.log('\n3. Banquet Hall Double-Booking Conflict, Min Headcount & Blackout Guardrails');

await assertRejects(
  () =>
    repo.submitCateringOrder({
      businessSlug: cateringBiz.slug,
      customerName: 'Second Caller',
      customerPhone: '9988776655',
      eventDate: eventDate1,
      deliveryTime: '07:30 PM',
      serviceMode: 'self_pickup',
      usesBanquetHall: true,
      hallSlot: eveningSlot,
      packageId: silverPkg.id,
      vegPlates: 50,
      nonVegPlates: 50,
    }),
  /already booked/i,
  'Prevents double-booking the same Banquet Hall slot on the same event date',
);

await assertRejects(
  () =>
    repo.submitCateringOrder({
      businessSlug: cateringBiz.slug,
      customerName: 'Small Group',
      customerPhone: '9988776655',
      eventDate: addDaysToIsoDate(todayIso, 8),
      deliveryTime: '12:30 PM',
      serviceMode: 'self_pickup',
      packageId: silverPkg.id,
      vegPlates: 15,
      nonVegPlates: 5,
    }),
  /Minimum headcount/i,
  'Rejects online quote below configured minimum headcount (20 < 30)',
);

await assertRejects(
  () =>
    repo.submitCateringOrder({
      businessSlug: cateringBiz.slug,
      intakeChannel: 'online_link',
      customerName: 'Same Day Online Guest',
      customerPhone: '9988776655',
      eventDate: todayIso,
      deliveryTime: '07:30 PM',
      serviceMode: 'self_pickup',
      packageId: silverPkg.id,
      vegPlates: 40,
      nonVegPlates: 0,
    }),
  /advance notice/i,
  'Rejects same-day self-serve online booking violating 24h advance notice rule',
);

const blackoutDay = addDaysToIsoDate(todayIso, 10);
const ownerDashBefore = await repo.getCateringOwnerDashboard(cateringBiz.id, {
  actorOwnerId: cateringBiz.ownerId,
});
await repo.updateCateringConfig(
  cateringBiz.id,
  {
    ...ownerDashBefore.config,
    blackoutDates: [blackoutDay],
    chefStationPin: '7788',
  },
  { actorOwnerId: cateringBiz.ownerId },
);

await assertRejects(
  () =>
    repo.submitCateringOrder({
      businessSlug: cateringBiz.slug,
      customerName: 'Blocked Date Guest',
      customerPhone: '9988776655',
      eventDate: blackoutDay,
      deliveryTime: '12:30 PM',
      serviceMode: 'self_pickup',
      packageId: silverPkg.id,
      vegPlates: 60,
      nonVegPlates: 0,
    }),
  /blacked out/i,
  'Rejects booking on owner-configured blackout date',
);

// ---------------------------------------------------------------------------
// 4. Stage Payments, +Extra Plates & Vessel Gate-Pass Tracking
// ---------------------------------------------------------------------------
console.log('\n4. Stage 1 Payment, On-Site +50 Extra Plates & Vessel Return Gate-Pass');

const afterStage1 = await repo.recordCateringStagePayment({
  businessId: cateringBiz.id,
  orderId: order1.id,
  stage: 'stage_1',
  amountPaise: order1.stage1AdvancePaise,
  method: 'upi',
  note: 'Stage 1 booking advance',
  options: { actorOwnerId: cateringBiz.ownerId },
});

assert(
  afterStage1.orderStatus === 'advance_confirmed' &&
    afterStage1.amountPaidPaise === 3042900 &&
    afterStage1.balanceDuePaise === 10143000 - 3042900 &&
    afterStage1.paymentLedger.length === 1,
  'Stage 1 payment flips status quote_pending -> advance_confirmed and updates balanceDuePaise',
);

// Add +50 Extra Plates on-site (blended rate of 120x300 + 80x420 = ₹69,600 / 200 = ₹348/plate => 50 * ₹348 = ₹17,400 + 5% GST)
const afterExtra = await repo.addCateringExtraPlates({
  businessId: cateringBiz.id,
  orderId: order1.id,
  extraPlates: 50,
  options: { actorOwnerId: cateringBiz.ownerId },
});

assert(
  afterExtra.extraPlatesAdded === 50 &&
    afterExtra.subtotalPaise === 9660000 + 1740000 &&
    afterExtra.totalAmountPaise > afterStage1.totalAmountPaise &&
    afterExtra.balanceDuePaise ===
      afterExtra.totalAmountPaise - afterStage1.amountPaidPaise,
  'Adding +50 extra plates recalculates subtotal (+₹17,400), 5% GST, total & balance due',
);

const afterDispatchVessels = await repo.updateCateringKitchenAndVessels({
  businessId: cateringBiz.id,
  orderId: order1.id,
  vesselsDispatched: [
    { itemName: 'Copper Biryani Deg (30L)', qtySent: 3, qtyReturned: 1 },
  ],
  options: { actorOwnerId: cateringBiz.ownerId },
});

assert(
  afterDispatchVessels.vesselsAllReturned === false,
  'Partial vessel return marks vesselsAllReturned === false for return alert tracking',
);

const dashWithVesselAlert = await repo.getCateringOwnerDashboard(
  cateringBiz.id,
  { actorOwnerId: cateringBiz.ownerId },
);
assert(
  dashWithVesselAlert.kpis.unreturnedVesselAlertsCount === 1,
  'Owner KPI surfaces unreturnedVesselAlertsCount === 1',
);

// ---------------------------------------------------------------------------
// 5. Restricted Head Chef PIN Portal: Scaling Math & Zero Financial Leak Audit
// ---------------------------------------------------------------------------
console.log('\n5. Restricted Head Chef PIN Portal: Recipe Scaling & Zero Financial Visibility');

await assertRejects(
  () =>
    repo.getCateringChefKitchenPortal({
      businessId: cateringBiz.id,
      chefPin: '0000',
      dateFrom: todayIso,
      dateTo: addDaysToIsoDate(todayIso, 14),
    }),
  /Invalid Head Chef PIN/i,
  'Rejects wrong Head Chef PIN on kitchen portal',
);

const chefPortal = await repo.getCateringChefKitchenPortal({
  businessId: cateringBiz.id,
  chefPin: '7788',
  dateFrom: todayIso,
  dateTo: addDaysToIsoDate(todayIso, 14),
});

// 120 Veg + 80 Non-Veg + 50 Extra = 250 plates of Hyderabadi Chicken Dum Biryani
// Basmati Rice = 15 kg per 100 plates => 250 / 100 * 15 = 37.5 kg base, +5% wastage = 39.38 kg
const riceItem = chefPortal.groceryList.find(
  (g) => g.ingredientName === 'Basmati Rice',
);
assert(
  chefPortal.events.length === 1 &&
    chefPortal.events[0].totalPlates === 250 &&
    riceItem !== undefined &&
    riceItem.baseQty === 37.5 &&
    riceItem.totalQtyWithWastage === 39.38,
  'Recipe-to-Grocery calculator scales 250 plates x 15kg/100 = 37.5kg Rice (+5% wastage = 39.38kg)',
  riceItem,
);

const serializedChefPayload = JSON.stringify(chefPortal);
assert(
  !serializedChefPayload.includes('customerPhone') &&
    !serializedChefPayload.includes('9848055667') &&
    !serializedChefPayload.includes('totalAmountPaise') &&
    !serializedChefPayload.includes('subtotalPaise') &&
    !serializedChefPayload.includes('vegRatePaise') &&
    !serializedChefPayload.includes('nonVegRatePaise') &&
    !serializedChefPayload.includes('paymentLedger') &&
    !serializedChefPayload.includes('balanceDuePaise'),
  'Head Chef PIN portal payload contains ZERO customer phones, ₹ rates, totals, or payment ledgers',
);

// Chef completes vessel return & checklist via PIN
const chefUpdateRes = await repo.updateCateringKitchenAndVessels({
  businessId: cateringBiz.id,
  orderId: order1.id,
  chefPin: '7788',
  kitchenChecklist: {
    ingredientsProcured: true,
    prepCompleted: true,
    cookingCompleted: true,
    packedWithLabels: true,
    dispatched: true,
  },
  vesselsDispatched: [
    { itemName: 'Copper Biryani Deg (30L)', qtySent: 3, qtyReturned: 3 },
  ],
});

const serializedChefMutation = JSON.stringify(chefUpdateRes);
assert(
  chefUpdateRes.vesselsAllReturned === true &&
    !serializedChefMutation.includes('customerPhone') &&
    !serializedChefMutation.includes('totalAmountPaise'),
  'Chef PIN vessel return flips vesselsAllReturned -> true and returns strictly sanitized payload',
);

// ---------------------------------------------------------------------------
// 6. Multi-Tenant Isolation, Dual-Mode Parity & Migration 034 SQL Guardrails
// ---------------------------------------------------------------------------
console.log('\n6. Multi-Tenant Isolation, Dual-Mode Parity & Migration 034 SQL Security');

await assertRejects(
  () =>
    repo.getCateringOwnerDashboard(cateringBiz.id, {
      actorOwnerId: 'attacker-other-tenant',
    }),
  /Unauthorized/i,
  'Blocks cross-tenant owner access to getCateringOwnerDashboard',
);

await assertRejects(
  () =>
    repo.recordCateringStagePayment({
      businessId: cateringBiz.id,
      orderId: order1.id,
      stage: 'stage_2',
      amountPaise: 100000,
      method: 'cash',
      options: { actorOwnerId: 'attacker-other-tenant' },
    }),
  /Unauthorized/i,
  'Blocks cross-tenant payment mutation on recordCateringStagePayment',
);

const cateringMethods = [
  'getPublicCateringPortal',
  'submitCateringOrder',
  'getCateringOwnerDashboard',
  'updateCateringConfig',
  'upsertCateringPackage',
  'deleteCateringPackage',
  'upsertCateringDishAndRecipe',
  'deleteCateringDishAndRecipe',
  'recordCateringStagePayment',
  'addCateringExtraPlates',
  'updateCateringKitchenAndVessels',
  'getCateringChefKitchenPortal',
] as const;

const allPresentOnBoth = cateringMethods.every(
  (m) =>
    typeof (repo as Record<string, unknown>)[m] === 'function' &&
    typeof (SupabaseBusinessRepository.prototype as unknown as Record<string, unknown>)[
      m
    ] === 'function',
);
assert(
  allPresentOnBoth,
  '100% Dual-Mode method parity across MockLocalStorageRepository and SupabaseBusinessRepository (all 12 methods)',
);

const sqlText = await Deno.readTextFile(
  new URL(
    '../supabase/migrations/034_catering_and_banquet_hall_os.sql',
    import.meta.url,
  ),
);
const lowerSql = sqlText.toLowerCase();

assert(
  lowerSql.includes('enable row level security') &&
    lowerSql.includes('force row level security') &&
    lowerSql.includes('revoke all on table public.catering_orders from public, anon') &&
    lowerSql.includes('security definer') &&
    lowerSql.includes('set search_path = public, pg_temp') &&
    lowerSql.includes('pg_catalog.substr(') &&
    !/substring\s*\([^)]+\s+from\s+/i.test(sqlText),
  'Migration 034 enforces ENABLE + FORCE RLS, REVOKE public/anon, SECURITY DEFINER + search_path, and pg_catalog.substr()',
);

console.log('\n------------------------------------------------------------');
console.log(`CateringOS Suite Complete: ${passed} passed, ${failed} failed`);
console.log('------------------------------------------------------------\n');

if (failed > 0) {
  Deno.exit(1);
}
