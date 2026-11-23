/**
 * Verification Suite #16 — Module 7: Dedicated CafeOS
 *   Clean Cafe Detachment from Restaurant (BistroOS),
 *   Wallet-Style Digital Coffee Stamp Card + Automatic Birthday Free Coffee,
 *   30-Second Anti-Fraud Rotating Counter QR + 3-Hour Cooldown,
 *   Raw Ingredient Cafe Inventory (Beans, Milk, Syrups, Cups) + Low-Stock Alerts & Audit Logs,
 *   Counter Quick Order (#C-01), Multi-Tenant Isolation & Migration 022 SQL Guardrails
 *
 * Run with: deno run --allow-read --allow-env tests/verify-cafe-os.ts
 */

import { MockLocalStorageRepository } from '../src/services/storage/MockLocalStorageRepository.ts';
import {
  buildCafeRotatingCounterQrUrl,
  CAFE_INVENTORY_STARTER_PACK,
  computeCafeCounterTokenSig,
  getCafeHubUrl,
  getCafeMorningGreetingBanner,
  getCafeRotatingTimeBucket,
  isBirthdayTodayForPass,
  isCafeCategory,
  normalizeCafePhone,
  validateCafeConfigInput,
  validateCafeInventoryAction,
  validateCafeInventoryItemInput,
} from '../src/utils/cafeValidation.ts';
import {
  getIndustryBadgeMeta,
  getIndustryWorkspaceType,
  getPrimaryCustomerQrUrlForBusiness,
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
  '\n=== Module 7 Verification: Dedicated CafeOS (Stamp Pass, Birthday Coffee, Inventory & Counter Order) ===\n',
);

// ---------------------------------------------------------------------------
// 1. Clean Multi-Industry Detachment (CafeOS vs BistroOS / BarberOS / GymOS)
// ---------------------------------------------------------------------------
console.log('1. Clean Multi-Industry Routing & Cafe Validation Utilities');

assert(
  getIndustryWorkspaceType('cafe') === 'cafe' &&
    getIndustryWorkspaceType('restaurant') === 'restaurant' &&
    getIndustryWorkspaceType('hotel') === 'restaurant' &&
    getIndustryWorkspaceType('barber') === 'barber' &&
    getIndustryWorkspaceType('gym') === 'gym' &&
    isCafeCategory('cafe') &&
    !isCafeCategory('restaurant'),
  'Cafe category cleanly detaches into dedicated CafeOS workspace (separate from BistroOS)',
);

assert(
  getIndustryBadgeMeta('cafe').moduleName === 'CafeOS' &&
    getIndustryBadgeMeta('cafe').emoji === '☕' &&
    getIndustryBadgeMeta('restaurant').moduleName === 'BistroOS',
  'Admin Industry Badge differentiates CafeOS (☕) from BistroOS (🍽️)',
);

assert(
  getPrimaryCustomerQrUrlForBusiness({
    slug: 'brew-bloom-cafe',
    category: 'cafe',
  }).endsWith('/r/brew-bloom-cafe/cafe') &&
    getPrimaryCustomerQrUrlForBusiness({
      slug: 'urban-kitchen',
      category: 'restaurant',
    }).endsWith('/r/urban-kitchen/menu') &&
    getCafeHubUrl('brew-bloom-cafe').endsWith('/r/brew-bloom-cafe/cafe'),
  'Primary Customer QR router sends cafes to /r/:slug/cafe and restaurants to /r/:slug/menu',
);

assert(
  normalizeCafePhone('+91 98765-43210') === '9876543210' &&
    normalizeCafePhone('09876543210') === '9876543210' &&
    getCafeMorningGreetingBanner(new Date(2026, 5, 1, 9, 0)).title.includes(
      'Morning',
    ),
  'Cafe phone normalization and morning re-engagement banner work cleanly',
);

assert(
  validateCafeConfigInput('biz-cafe-1', {
    stampsRequired: 8,
    rewardDrinkName: 'Free Cappuccino',
    birthdayFreeCoffeeEnabled: true,
    birthdayDrinkName: 'Birthday Signature Latte',
  }).ok &&
    !validateCafeConfigInput('biz-cafe-1', {
      stampsRequired: 2,
      rewardDrinkName: 'Free Coffee',
      birthdayFreeCoffeeEnabled: true,
      birthdayDrinkName: 'Birthday Coffee',
    }).ok &&
    !validateCafeInventoryItemInput('biz-cafe-1', {
      itemName: 'Beans',
      category: 'beans',
      unit: 'kg',
      currentStock: -1,
      lowStockThreshold: 2,
      unitCostPaise: 90000,
    }).ok &&
    !validateCafeInventoryAction('usage', 0).ok,
  'Cafe config, inventory item, and stock action validators reject invalid bounds',
);

// ---------------------------------------------------------------------------
// 2. Setup Two Isolated Cafes + Platform Admin Approval Flow
// ---------------------------------------------------------------------------
console.log('\n2. Cafe Setup, Admin Approval, Public Hub Sanitization & 30s Anti-Fraud Rotating QR');

// Provide shared localStorage in Deno so MockLocalStorageRepository & MockAdminRepository share tenant state
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

const cafeA = await repo.createBusiness({
  name: 'Brew & Bloom Coffee',
  slug: 'brew-bloom-cafe',
  category: 'cafe',
  city: 'Bengaluru',
  googleReviewUrl: 'https://g.page/r/brew-bloom-test/review',
  ownerId: 'owner-cafe-a',
  status: 'pending',
  accountState: 'active',
});
const cafeB = await repo.createBusiness({
  name: 'Roast House Espresso',
  slug: 'roast-house-cafe',
  category: 'cafe',
  city: 'Mumbai',
  googleReviewUrl: 'https://g.page/r/roast-house-test/review',
  ownerId: 'owner-cafe-b',
  status: 'pending',
  accountState: 'active',
});

// Pending cafe is kept offline publicly until Platform Admin approves
const pendingHubCheck = await repo.getPublicCafeHub(cafeA.slug);
assert(
  pendingHubCheck === null,
  'Pending cafe stays offline on /r/:slug/cafe until Platform Admin approves it',
);

// Simulate Platform Admin approval on cafeA & cafeB in mock storage
const storedBizRaw = storageShim.getItem('reviewassist_mock_businesses_v2');
const storedBiz = storedBizRaw
  ? (JSON.parse(storedBizRaw) as Array<Record<string, unknown>>)
  : [];
for (const b of storedBiz) {
  if (b.id === cafeA.id || b.id === cafeB.id) {
    b.status = 'active';
    b.accountState = 'active';
  }
}
storageShim.setItem(
  'reviewassist_mock_businesses_v2',
  JSON.stringify(storedBiz),
);

// Configure Cafe A to unlock a free drink every 3 stamps for fast end-to-end verification
const updatedCfg = await repo.updateCafeConfig(
  cafeA.id,
  {
    stampsRequired: 3,
    rewardDrinkName: 'Any Classic Cappuccino or Cold Coffee',
    birthdayFreeCoffeeEnabled: true,
    birthdayDrinkName: 'Free Birthday Hazelnut Latte',
    upiId: 'brewbloom@upi',
  },
  { actorOwnerId: 'owner-cafe-a' },
);
assert(
  updatedCfg.stampsRequired === 3 &&
    updatedCfg.counterQrSecret.length >= 16 &&
    updatedCfg.upiId === 'brewbloom@upi',
  'Owner updated CafeOS stamp threshold (3 stamps), birthday rule, and UPI ID',
);

const publicHubBefore = await repo.getPublicCafeHub(cafeA.slug);
assert(
  publicHubBefore !== null &&
    publicHubBefore.business.slug === cafeA.slug &&
    publicHubBefore.config.stampsRequired === 3 &&
    !('counterQrSecret' in publicHubBefore.config),
  'Public Cafe Hub returns sanitized config and never exposes counterQrSecret',
);

// Rotating Counter QR Security Checks
const nowBucket = getCafeRotatingTimeBucket();
const expiredBucket = nowBucket - 5;
const expiredSig = await computeCafeCounterTokenSig(
  updatedCfg.counterQrSecret,
  expiredBucket,
);

await assertRejects(
  () =>
    repo.claimCafeCounterStamp({
      businessSlug: cafeA.slug,
      customerName: 'Aarav Mehta',
      phone: '9876500101',
      timeBucket: expiredBucket,
      tokenSig: expiredSig,
    }),
  'expired',
  'Expired 30-second rotating Counter QR (>60s old) is rejected',
);

await assertRejects(
  () =>
    repo.claimCafeCounterStamp({
      businessSlug: cafeA.slug,
      customerName: 'Aarav Mehta',
      phone: '9876500101',
      timeBucket: nowBucket,
      tokenSig: '0000000000000000',
    }),
  'invalid',
  'Tampered/forged Counter QR signature is rejected',
);

// ---------------------------------------------------------------------------
// 3. Digital Coffee Stamp Card + 3-Hour Cooldown + Free Drink + Birthday Perk
// ---------------------------------------------------------------------------
console.log('\n3. Digital Coffee Stamp Card, Free Drink Rollover & Automatic Birthday Coffee');

const today = new Date();
const todayMonth = today.getMonth() + 1;
const todayDay = today.getDate();

const liveQr1 = await buildCafeRotatingCounterQrUrl(
  cafeA.slug,
  updatedCfg.counterQrSecret,
);
assert(
  liveQr1.url.includes(`/r/${cafeA.slug}/cafe?tb=${liveQr1.timeBucket}&sig=${liveQr1.tokenSig}`),
  'buildCafeRotatingCounterQrUrl generates valid signed /r/:slug/cafe?tb=...&sig=... URL',
);

// Stamp 1 (creates pass BREW-001 with Birthday = Today!)
const stamp1 = await repo.claimCafeCounterStamp({
  businessSlug: cafeA.slug,
  customerName: 'Aarav Mehta',
  phone: '+91 98765-00101',
  birthMonth: todayMonth,
  birthDay: todayDay,
  timeBucket: liveQr1.timeBucket,
  tokenSig: liveQr1.tokenSig,
});
assert(
  stamp1.pass.passCode === 'BREW-001' &&
    stamp1.pass.currentStamps === 1 &&
    stamp1.pass.lifetimeStamps === 1 &&
    stamp1.pass.freeDrinksAvailable === 0 &&
    stamp1.pass.isBirthdayToday === true &&
    !stamp1.justUnlockedFreeDrink,
  'First counter scan creates pass BREW-001 (1/3 stamps) and automatically detects Birthday Today',
);

// Immediate duplicate scan must be blocked by 3-hour cooldown
await assertRejects(
  () =>
    repo.claimCafeCounterStamp({
      businessSlug: cafeA.slug,
      customerName: 'Aarav Mehta',
      phone: '9876500101',
      timeBucket: liveQr1.timeBucket,
      tokenSig: liveQr1.tokenSig,
    }),
  '3 hours',
  'Duplicate rapid stamp scan is blocked by 3-hour anti-abuse cooldown',
);

// Stamp 2 & Stamp 3 (simulating visits on later days) -> unlocks 1 Free Drink & resets stamps to 0/3!
const stamp2 = await repo.claimCafeCounterStamp({
  businessSlug: cafeA.slug,
  customerName: 'Aarav Mehta',
  phone: '9876500101',
  timeBucket: liveQr1.timeBucket,
  tokenSig: liveQr1.tokenSig,
  bypassCooldownForTest: true,
});
const stamp3 = await repo.claimCafeCounterStamp({
  businessSlug: cafeA.slug,
  customerName: 'Aarav Mehta',
  phone: '9876500101',
  timeBucket: liveQr1.timeBucket,
  tokenSig: liveQr1.tokenSig,
  bypassCooldownForTest: true,
});
assert(
  stamp2.pass.currentStamps === 2 &&
    stamp3.justUnlockedFreeDrink === true &&
    stamp3.pass.currentStamps === 0 &&
    stamp3.pass.lifetimeStamps === 3 &&
    stamp3.pass.freeDrinksAvailable === 1,
  'Reaching stampsRequired (3/3) automatically unlocks +1 Free Drink and rolls card back to 0/3',
);

// Public Hub lookup by phone returns pass + birthday voucher active
const publicHubReturning = await repo.getPublicCafeHub(
  cafeA.slug,
  '9876500101',
);
assert(
  publicHubReturning?.pass?.passCode === 'BREW-001' &&
    publicHubReturning.pass.freeDrinksAvailable === 1 &&
    publicHubReturning.pass.isBirthdayToday === true,
  'Returning customer lookup loads saved pass, 1 free drink ready, and active Birthday Free Coffee banner',
);

// Owner redeems 1 Stamp Free Drink -> freeDrinksAvailable drops 1 -> 0
const afterStampRedeem = await repo.redeemCafePassReward({
  businessId: cafeA.id,
  passId: stamp3.pass.id,
  rewardType: 'stamp_free_drink',
  options: { actorOwnerId: 'owner-cafe-a' },
});
assert(
  afterStampRedeem.freeDrinksAvailable === 0,
  'Owner redeemed Stamp Free Drink (freeDrinksAvailable decremented 1 -> 0)',
);

await assertRejects(
  () =>
    repo.redeemCafePassReward({
      businessId: cafeA.id,
      passId: stamp3.pass.id,
      rewardType: 'stamp_free_drink',
      options: { actorOwnerId: 'owner-cafe-a' },
    }),
  'no free stamp drinks',
  'Double-redemption of Stamp Free Drink when balance is 0 is blocked',
);

// Owner redeems Automatic Birthday Free Coffee (once per year!)
const afterBdayRedeem = await repo.redeemCafePassReward({
  businessId: cafeA.id,
  passId: stamp3.pass.id,
  rewardType: 'birthday_free_coffee',
  options: { actorOwnerId: 'owner-cafe-a' },
});
assert(
  afterBdayRedeem.lastBirthdayRedeemedYear === today.getFullYear() &&
    afterBdayRedeem.isBirthdayToday === false &&
    !isBirthdayTodayForPass({
      birthMonth: afterBdayRedeem.birthMonth,
      birthDay: afterBdayRedeem.birthDay,
      lastBirthdayRedeemedYear: afterBdayRedeem.lastBirthdayRedeemedYear,
      birthdayEnabled: true,
      now: today,
    }),
  'Owner redeemed Birthday Free Coffee; pass records redeemed year and locks out re-use this year',
);

await assertRejects(
  () =>
    repo.redeemCafePassReward({
      businessId: cafeA.id,
      passId: stamp3.pass.id,
      rewardType: 'birthday_free_coffee',
      options: { actorOwnerId: 'owner-cafe-a' },
    }),
  'already been redeemed',
  'Second Birthday Free Coffee redemption in the same calendar year is blocked',
);

// ---------------------------------------------------------------------------
// 4. Raw Ingredient Cafe Inventory + Low-Stock Alerts + Audit Trail
// ---------------------------------------------------------------------------
console.log('\n4. Cafe Raw Ingredient Inventory (Beans, Milk, Syrups, Cups) & Audit Trail');

const starterLoaded = await repo.seedCafeInventoryStarterPack(cafeA.id, {
  actorOwnerId: 'owner-cafe-a',
});
assert(
  starterLoaded.length === CAFE_INVENTORY_STARTER_PACK.length &&
    starterLoaded.some((i) => i.itemName.includes('Espresso Beans')) &&
    starterLoaded.some((i) => i.itemName.includes('Oat Milk')),
  `1-Tap Cafe Inventory Starter Pack loads all ${CAFE_INVENTORY_STARTER_PACK.length} core coffee ingredients`,
);

// Custom ingredient + usage -> low-stock trigger -> restock -> wastage
const beansItem = starterLoaded.find((i) => i.category === 'beans')!;
const afterUsage = await repo.adjustCafeInventoryStock({
  businessId: cafeA.id,
  itemId: beansItem.id,
  actionType: 'usage',
  quantity: 4.5, // 6 kg - 4.5 kg = 1.5 kg (<= 2 kg threshold -> LOW STOCK!)
  note: 'Morning espresso hopper refill',
  loggedBy: 'Barista Priya',
  options: { actorOwnerId: 'owner-cafe-a' },
});
assert(
  afterUsage.item.currentStock === 1.5 &&
    afterUsage.log.quantityDelta === -4.5 &&
    afterUsage.log.actionType === 'usage',
  'Usage adjustment deducts Arabica Espresso Beans (6 -> 1.5 kg) and writes audit log',
);

const dashAfterUsage = await repo.getCafeOwnerDashboard(cafeA.id, {
  actorOwnerId: 'owner-cafe-a',
});
assert(
  dashAfterUsage.stats.lowStockCount >= 2 &&
    dashAfterUsage.inventoryLogs.length >= 1,
  'Low-stock radar flags Arabica Beans (1.5 <= 2 kg) & Oat Milk (2 <= 3 L) automatically',
);

const afterRestock = await repo.adjustCafeInventoryStock({
  businessId: cafeA.id,
  itemId: beansItem.id,
  actionType: 'restock',
  quantity: 5, // 1.5 + 5 = 6.5 kg
  costPaise: 475000,
  note: 'Roastery invoice #88',
  options: { actorOwnerId: 'owner-cafe-a' },
});
const afterWastage = await repo.adjustCafeInventoryStock({
  businessId: cafeA.id,
  itemId: beansItem.id,
  actionType: 'wastage',
  quantity: 0.5, // 6.5 - 0.5 = 6.0 kg
  note: 'Dial-in grinder purge',
  options: { actorOwnerId: 'owner-cafe-a' },
});
assert(
  afterRestock.item.currentStock === 6.5 &&
    afterRestock.log.costPaise === 475000 &&
    afterWastage.item.currentStock === 6 &&
    afterWastage.log.actionType === 'wastage',
  'Restock (+5 kg w/ cost) and Wastage (-0.5 kg) update stock accurately and append immutable audit logs',
);

const customSyrup = await repo.createCafeInventoryItem(
  cafeA.id,
  {
    itemName: 'Caramel Drizzle Sauce',
    category: 'syrups_flavors',
    unit: 'bottles',
    currentStock: 3,
    lowStockThreshold: 1,
    unitCostPaise: 52000,
  },
  { actorOwnerId: 'owner-cafe-a' },
);
await repo.deleteCafeInventoryItem(cafeA.id, customSyrup.id, {
  actorOwnerId: 'owner-cafe-a',
});
const dashAfterDel = await repo.getCafeOwnerDashboard(cafeA.id, {
  actorOwnerId: 'owner-cafe-a',
});
assert(
  !dashAfterDel.inventoryItems.some((i) => i.id === customSyrup.id),
  'Custom inventory ingredient creation and deletion work cleanly',
);

// ---------------------------------------------------------------------------
// 5. Counter Quick Order (#C-01) & Lifecycle
// ---------------------------------------------------------------------------
console.log('\n5. Counter Quick Order (#C-01 -> Preparing -> Ready -> Picked Up)');

const catEspresso = await repo.createRestaurantMenuCategory(
  cafeA.id,
  { name: 'Espresso Bar', sortOrder: 1 },
  { actorOwnerId: 'owner-cafe-a' },
);
const itemCappuccino = await repo.createRestaurantMenuItem(
  cafeA.id,
  {
    categoryId: catEspresso.id,
    name: 'Classic Cappuccino',
    pricePaise: 18000,
    isAvailable: true,
    dietaryTag: 'veg',
  },
  { actorOwnerId: 'owner-cafe-a' },
);

const counterOrder = await repo.submitCafeCounterOrder({
  businessSlug: cafeA.slug,
  customerName: 'Aarav Mehta',
  phone: '9876500101',
  items: [{ itemId: itemCappuccino.id, quantity: 2 }],
  orderNote: 'Oat milk, less foam',
});
assert(
  counterOrder.tokenCode === '#C-01' &&
    counterOrder.subtotalPaise === 36000 &&
    counterOrder.status === 'queued' &&
    counterOrder.orderNote === 'Oat milk, less foam',
  'Customer Quick Order creates #C-01 with canonical catalog price (2 × ₹180 = ₹360)',
);

const preparingOrd = await repo.updateCafeCounterOrderStatus({
  businessId: cafeA.id,
  orderId: counterOrder.id,
  status: 'preparing',
  options: { actorOwnerId: 'owner-cafe-a' },
});
const readyOrd = await repo.updateCafeCounterOrderStatus({
  businessId: cafeA.id,
  orderId: counterOrder.id,
  status: 'ready',
  options: { actorOwnerId: 'owner-cafe-a' },
});
const pickedUpOrd = await repo.updateCafeCounterOrderStatus({
  businessId: cafeA.id,
  orderId: counterOrder.id,
  status: 'picked_up',
  options: { actorOwnerId: 'owner-cafe-a' },
});
assert(
  preparingOrd.status === 'preparing' &&
    readyOrd.status === 'ready' &&
    pickedUpOrd.status === 'picked_up',
  'Barista advances Counter Order #C-01 through queued -> preparing -> ready -> picked_up',
);

// ---------------------------------------------------------------------------
// 6. Multi-Tenant Isolation & Migration 022 SQL Security Guardrails
// ---------------------------------------------------------------------------
console.log('\n6. Multi-Tenant Isolation & Migration 022 SQL Guardrails');

await assertRejects(
  () =>
    repo.getCafeOwnerDashboard(cafeA.id, {
      actorOwnerId: 'owner-cafe-b',
    }),
  'unauthorized',
  'Cafe B owner cannot read Cafe A owner dashboard, passes, or stock',
);

await assertRejects(
  () =>
    repo.adjustCafeInventoryStock({
      businessId: cafeA.id,
      itemId: beansItem.id,
      actionType: 'usage',
      quantity: 1,
      options: { actorOwnerId: 'owner-cafe-b' },
    }),
  'unauthorized',
  'Cafe B owner cannot mutate Cafe A raw ingredient stock',
);

await assertRejects(
  () =>
    repo.redeemCafePassReward({
      businessId: cafeA.id,
      passId: stamp3.pass.id,
      rewardType: 'stamp_free_drink',
      options: { actorOwnerId: 'owner-cafe-b' },
    }),
  'unauthorized',
  'Cafe B owner cannot redeem rewards on Cafe A customer passes',
);

const cafeBDash = await repo.getCafeOwnerDashboard(cafeB.id, {
  actorOwnerId: 'owner-cafe-b',
});
assert(
  cafeBDash.passes.length === 0 &&
    cafeBDash.inventoryItems.length === 0 &&
    cafeBDash.counterOrders.length === 0,
  'Cafe B workspace is 100% isolated with zero data bleed from Cafe A',
);

// Verify Migration 022 SQL Safety Guardrails
const sql022 = await Deno.readTextFile(
  new URL(
    '../supabase/migrations/022_cafe_os_inventory_and_stamp_pass.sql',
    import.meta.url,
  ),
);
const sql022Lower = sql022.toLowerCase();
const expectedTables = [
  'cafe_configs',
  'cafe_stamp_passes',
  'cafe_inventory_items',
  'cafe_inventory_logs',
  'cafe_counter_orders',
];
const allTablesForcedRls = expectedTables.every(
  (tbl) =>
    sql022Lower.includes(`alter table public.${tbl} enable row level security`) &&
    sql022Lower.includes(`alter table public.${tbl} force row level security`) &&
    sql022Lower.includes(`revoke all on table public.${tbl} from public, anon`),
);
assert(
  allTablesForcedRls,
  'Migration 022 enforces ENABLE + FORCE ROW LEVEL SECURITY and REVOKE ALL FROM public, anon on all 5 CafeOS tables',
);

assert(
  !sql022Lower.includes('substring(') &&
    sql022Lower.includes('pg_catalog.substr('),
  'Migration 022 obeys PostgreSQL SQL guardrail (uses pg_catalog.substr, zero substring() syntax)',
);

assert(
  sql022Lower.includes('function public.get_public_cafe_hub') &&
    sql022Lower.includes('function public.claim_cafe_counter_stamp') &&
    sql022Lower.includes('function public.redeem_cafe_pass_reward') &&
    sql022Lower.includes('function public.adjust_cafe_inventory_stock') &&
    sql022Lower.includes('function public.submit_cafe_counter_order') &&
    sql022Lower.includes('set search_path = pg_catalog, public, pg_temp'),
  'Migration 022 defines all 5 hardened SECURITY DEFINER CafeOS RPCs with locked search_path',
);

console.log(`\nSummary: ${passed} passed, ${failed} failed.\n`);
if (failed > 0) {
  Deno.exit(1);
}
