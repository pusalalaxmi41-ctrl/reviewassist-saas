/**
 * Verification Suite — Master Upgrade II:
 *   Individual Staff & Waiter Roster (Per-Waiter ID & PIN),
 *   Cafe/Restaurant Business Mode, Monthly Stock & Expenses Ledger,
 *   Per-Waiter Dual-Approval Audit Trail & Multi-Tenant Isolation
 *
 * Run with: deno run tests/verify-staff-roster-and-inventory.ts
 */

import { MockLocalStorageRepository } from '../src/services/storage/MockLocalStorageRepository.ts';
import {
  formatStaffAuditLabel,
  generateNextStaffCode,
  hashStaffPin,
  validateMonthlyInventoryInput,
  validateStaffMemberInput,
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
  '\n=== Master Upgrade II Verification: Individual Staff Roster, Monthly Inventory & Dual-Approval Audit ===\n',
);

const repo = new MockLocalStorageRepository();
const businesses = await repo.getBusinesses();
const bizA = businesses.find((b) => b.slug === 'the-urban-kitchen');
assert(Boolean(bizA), 'Loaded primary restaurant (The Urban Kitchen)');
if (!bizA) {
  throw new Error('Missing seed restaurant');
}

const ownerA = { actorOwnerId: bizA.ownerId! };
const ownerB = { actorOwnerId: 'owner-other-tenant-77' };

// Enable restaurant profile with legacy shared PIN (1111) + phone ordering ON
const legacyPinHash = await hashStaffPin(bizA.slug, '1111');
await repo.updateRestaurantProfile(
  bizA.id,
  {
    isEnabled: true,
    currencyCode: 'INR',
    gamesEnabled: true,
    loyaltyEnabled: true,
    tableOrderingEnabled: true,
    menuThemeTemplate: 'masala',
    businessMode: 'restaurant',
    staffPinHash: legacyPinHash,
    minHoursBetweenVisitStars: 0,
  },
  ownerA,
);

// ---------------------------------------------------------------------------
// 1. Individual Staff & Waiter Roster (Per-Waiter ID & Personal PIN)
// ---------------------------------------------------------------------------
console.log('1. Individual Staff & Waiter Roster (Unique IDs & Personal PINs)');

const invalidStaff = validateStaffMemberInput(bizA.id, {
  fullName: 'Test',
  role: 'waiter',
  pinHash: 'short',
});
assert(
  !invalidStaff.ok,
  'Validator rejects malformed non-SHA256 PIN hash on staff creation',
);

const raviPinHash = await hashStaffPin(bizA.slug, '2468');
const ananyaPinHash = await hashStaffPin(bizA.slug, '3579');
const chefPinHash = await hashStaffPin(bizA.slug, '4680');

const ravi = await repo.createRestaurantStaffMember(
  bizA.id,
  {
    fullName: 'Ravi Kumar',
    role: 'waiter',
    pinHash: raviPinHash,
  },
  ownerA,
);
assert(
  ravi.staffCode === 'WTR-01' && ravi.role === 'waiter' && ravi.isActive,
  `Created waiter Ravi Kumar with auto-generated Staff ID "${ravi.staffCode}"`,
);

const priya = await repo.createRestaurantStaffMember(
  bizA.id,
  {
    fullName: 'Priya Nair',
    role: 'waiter',
    pinHash: await hashStaffPin(bizA.slug, '9876'),
  },
  ownerA,
);
assert(
  priya.staffCode === 'WTR-02',
  `Second waiter auto-increments Staff ID cleanly to "${priya.staffCode}"`,
);

const ananya = await repo.createRestaurantStaffMember(
  bizA.id,
  {
    fullName: 'Ananya Sharma',
    role: 'cashier',
    pinHash: ananyaPinHash,
  },
  ownerA,
);
assert(
  ananya.staffCode === 'CSH-01' && ananya.role === 'cashier',
  `Created cashier Ananya Sharma with role-prefixed ID "${ananya.staffCode}"`,
);

const chefArjun = await repo.createRestaurantStaffMember(
  bizA.id,
  {
    fullName: 'Chef Arjun',
    role: 'chef',
    pinHash: chefPinHash,
  },
  ownerA,
);
assert(
  chefArjun.staffCode === 'CHF-01' &&
    generateNextStaffCode('chef', [chefArjun.staffCode]) === 'CHF-02',
  `Created chef account "${chefArjun.staffCode}" and next code helper predicts CHF-02`,
);

await assertRejects(
  () =>
    repo.createRestaurantStaffMember(
      bizA.id,
      {
        fullName: 'Duplicate Code',
        role: 'waiter',
        staffCode: 'WTR-01',
        pinHash: raviPinHash,
      },
      ownerA,
    ),
  'already assigned',
  'Rejects duplicate Staff ID ("WTR-01") within the same restaurant',
);

// Public login directory exposes names/codes/roles but NEVER pinHash
const publicDirectory = await repo.getPublicStaffLoginDirectory(bizA.slug);
assert(
  publicDirectory.length === 4 &&
    publicDirectory.every((entry) => !('pinHash' in entry)),
  'Public staff login directory lists all 4 active members without exposing pinHash',
);

// ---------------------------------------------------------------------------
// 2. Personal Waiter PIN Login, Legacy Fallback, Deactivation & Reset PIN
// ---------------------------------------------------------------------------
console.log(
  '\n2. Personal Waiter PIN Authentication, Reset PIN & Legacy Compatibility',
);

const raviSession = await repo.verifyStaffMemberPin({
  businessSlug: bizA.slug,
  staffCode: 'WTR-01',
  staffPinHash: raviPinHash,
});
assert(
  raviSession.verified &&
    raviSession.staffId === ravi.id &&
    raviSession.staffCode === 'WTR-01' &&
    raviSession.fullName === 'Ravi Kumar' &&
    raviSession.role === 'waiter' &&
    raviSession.staffLabel === 'Ravi Kumar (WTR-01)',
  `Personal login verified as "${raviSession.staffLabel}" (${raviSession.role})`,
);

await assertRejects(
  () =>
    repo.verifyStaffMemberPin({
      businessSlug: bizA.slug,
      staffCode: 'WTR-01',
      staffPinHash: ananyaPinHash,
    }),
  'Invalid Staff ID or PIN',
  'Rejects mismatched Staff ID + wrong personal PIN',
);

// Legacy shared PIN still works when no staffCode is passed
const legacySession = await repo.verifyStaffMemberPin({
  businessSlug: bizA.slug,
  staffPinHash: legacyPinHash,
});
assert(
  legacySession.verified && legacySession.staffCode === 'STAFF',
  'Legacy restaurant-level shared Staff PIN remains backwards compatible',
);

// Reset Priya's PIN and verify old PIN is rejected while new PIN succeeds
const priyaNewPinHash = await hashStaffPin(bizA.slug, '5544');
await repo.updateRestaurantStaffMember(
  bizA.id,
  priya.id,
  {
    fullName: priya.fullName,
    role: priya.role,
    staffCode: priya.staffCode,
    pinHash: priyaNewPinHash,
    isActive: true,
  },
  ownerA,
);
await assertRejects(
  async () =>
    repo.verifyStaffMemberPin({
      businessSlug: bizA.slug,
      staffCode: 'WTR-02',
      staffPinHash: await hashStaffPin(bizA.slug, '9876'),
    }),
  'Invalid Staff ID or PIN',
  'Old personal PIN stops working immediately after Reset PIN',
);
const priyaSession = await repo.verifyStaffMemberPin({
  businessSlug: bizA.slug,
  staffCode: 'WTR-02',
  staffPinHash: priyaNewPinHash,
});
assert(
  priyaSession.verified && priyaSession.staffCode === 'WTR-02',
  'New personal PIN unlocks Waiter Floor App immediately after Reset PIN',
);

// Deactivating a waiter blocks login & hides them from public login picker
await repo.updateRestaurantStaffMember(
  bizA.id,
  priya.id,
  {
    fullName: priya.fullName,
    role: priya.role,
    staffCode: priya.staffCode,
    isActive: false,
  },
  ownerA,
);
const dirAfterDisable = await repo.getPublicStaffLoginDirectory(bizA.slug);
assert(
  dirAfterDisable.length === 3 &&
    !dirAfterDisable.some((m) => m.staffCode === 'WTR-02'),
  'Inactive staff member is hidden from public Waiter Login picker',
);
await assertRejects(
  () =>
    repo.verifyStaffMemberPin({
      businessSlug: bizA.slug,
      staffCode: 'WTR-02',
      staffPinHash: priyaNewPinHash,
    }),
  'Invalid Staff ID or PIN',
  'Inactive staff member is blocked from unlocking Waiter Floor App',
);

// ---------------------------------------------------------------------------
// 3. Per-Waiter Audit Logging (Approval 1: Order -> Chef & Approval 2: Bill -> Star)
// ---------------------------------------------------------------------------
console.log(
  '\n3. Dual-Approval Flow & Per-Waiter Audit Trail (Order Approval + Loyalty Stars)',
);

// Seed preset menu + table + diner
await repo.applyRestaurantMenuPreset(bizA.id, 'masala_indian', ownerA);
const menuItems = await repo.getRestaurantMenuItems(bizA.id, ownerA);
const table4 = await repo.createRestaurantTable(
  bizA.id,
  { tableNumber: 'Table 04', tableLabel: 'Window', isActive: true },
  ownerA,
);
const dinerWallet = await repo.registerOrResumeRestaurantCustomer({
  displayName: 'Vikram Rao',
  phoneOrEmail: '+919900112233',
  businessSlug: bizA.slug,
});

// Approval 1: Guest submits table order -> Waiter Ravi approves with personal PIN
const order = await repo.submitCustomerTableOrder({
  businessSlug: bizA.slug,
  tableKey: table4.tableKey,
  customerId: dinerWallet.customer.id,
  guestName: 'Vikram Rao',
  items: [{ itemId: menuItems[0].id, quantity: 2 }],
});
const approvedOrder = await repo.updateTableOrderStatus({
  businessSlug: bizA.slug,
  orderId: order.id,
  status: 'approved_for_kitchen',
  staffPinHash: raviPinHash,
});
assert(
  approvedOrder.status === 'approved_for_kitchen' &&
    approvedOrder.approvedBy === formatStaffAuditLabel('Ravi Kumar', 'WTR-01'),
  `Approval 1 logged exact waiter "${approvedOrder.approvedBy}" on Order → Chef approval`,
);

// Approval 2: Waiter Ravi verifies guest's Loyalty QR Pass -> logs "Ravi Kumar (WTR-01)"
const visitRes = await repo.staffAwardVisitStars({
  businessSlug: bizA.slug,
  customerLookup: `vitaran-loyalty://${bizA.slug}/${dinerWallet.customer.id}`,
  tableKey: table4.tableKey,
  idempotencyKey: 'visit-ravi-audit-1',
  staffPinHash: raviPinHash,
});
assert(
  visitRes.verifiedByLabel === 'Ravi Kumar (WTR-01)' &&
    visitRes.newLoyaltyStarsBalance >= 1,
  `Approval 2 logged exact waiter "${visitRes.verifiedByLabel}" on Loyalty Star award`,
);

// Award a second visit star so diner can claim a 2-star reward, then Cashier Ananya fulfills it
await repo.staffAwardVisitStars({
  businessSlug: bizA.slug,
  customerLookup: '+919900112233',
  tableKey: table4.tableKey,
  idempotencyKey: 'visit-ravi-audit-2',
  staffPinHash: raviPinHash,
});
const rewards = await repo.getRestaurantRewards(bizA.id, ownerA);
const twoStarReward = rewards.find((r) => r.starsRequired <= 2) ?? rewards[0];
const claimRes = await repo.claimRestaurantReward({
  businessSlug: bizA.slug,
  customerId: dinerWallet.customer.id,
  rewardId: twoStarReward.id,
  idempotencyKey: 'claim-audit-ananya-1',
});
const fulfilledClaim = await repo.staffFulfillRewardClaim({
  businessSlug: bizA.slug,
  claimCode: claimRes.claim.claimCode,
  staffPinHash: ananyaPinHash,
});
assert(
  fulfilledClaim.status === 'fulfilled' &&
    fulfilledClaim.fulfilledBy === 'Ananya Sharma (CSH-01)',
  `Reward fulfillment recorded exact cashier "${fulfilledClaim.fulfilledBy}"`,
);

// Verify today's per-waiter QR verification counts in Floor Analytics
const floorPayload = await repo.getRestaurantFloorAndAnalytics({
  businessSlug: bizA.slug,
  options: ownerA,
});
assert(
  (floorPayload.staffVerificationCountsToday?.['Ravi Kumar (WTR-01)'] ?? 0) ===
    2,
  `Live Staff Analytics reports Ravi Kumar (WTR-01) verified 2 Loyalty QRs today`,
);

// ---------------------------------------------------------------------------
// 4. Cafe vs Restaurant Business Mode & Monthly Inventory / Expenses Ledger
// ---------------------------------------------------------------------------
console.log(
  '\n4. Cafe vs Restaurant Mode & Monthly Stock / Expenses Ledger',
);

const cafeProfile = await repo.updateRestaurantProfile(
  bizA.id,
  {
    isEnabled: true,
    currencyCode: 'INR',
    gamesEnabled: true,
    loyaltyEnabled: true,
    tableOrderingEnabled: true,
    menuThemeTemplate: 'prakriti',
    businessMode: 'cafe',
  },
  ownerA,
);
assert(
  cafeProfile.businessMode === 'cafe',
  'Switched and persisted businessMode = "cafe"',
);

const publicCafePayload = await repo.getPublicRestaurantMenu(bizA.slug);
assert(
  publicCafePayload?.profile.businessMode === 'cafe',
  'Public menu payload exposes businessMode = "cafe"',
);

const invalidInv = validateMonthlyInventoryInput(bizA.id, {
  monthKey: 'invalid-month',
  entryType: 'stock_purchase',
  category: 'Dairy & Milk',
  itemName: 'Milk',
  amountPaise: 50000,
});
assert(
  !invalidInv.ok,
  'Inventory validator rejects invalid monthKey format (must be YYYY-MM)',
);

const milkEntry = await repo.createRestaurantMonthlyInventoryItem(
  bizA.id,
  {
    monthKey: '2026-11',
    entryType: 'stock_purchase',
    category: 'Dairy & Milk',
    itemName: 'Full Cream Milk',
    quantityLabel: '30 Liters',
    amountPaise: 195000,
    lowStockAlert: false,
    notes: 'Fresh Dairy Vendor',
  },
  ownerA,
);
const coffeeEntry = await repo.createRestaurantMonthlyInventoryItem(
  bizA.id,
  {
    monthKey: '2026-11',
    entryType: 'stock_purchase',
    category: 'Coffee & Beverages',
    itemName: 'Roasted Arabica Espresso Beans',
    quantityLabel: '5 kg',
    amountPaise: 420000,
    lowStockAlert: true,
  },
  ownerA,
);
const rentEntry = await repo.createRestaurantMonthlyInventoryItem(
  bizA.id,
  {
    monthKey: '2026-11',
    entryType: 'monthly_expense',
    category: 'Rent & Staff',
    itemName: 'Cafe Shop Monthly Rent',
    amountPaise: 3500000,
    lowStockAlert: false,
  },
  ownerA,
);
await repo.createRestaurantMonthlyInventoryItem(
  bizA.id,
  {
    monthKey: '2026-12',
    entryType: 'monthly_expense',
    category: 'Gas & Utilities',
    itemName: 'December Commercial Gas',
    amountPaise: 240000,
    lowStockAlert: false,
  },
  ownerA,
);

const novEntries = await repo.getRestaurantMonthlyInventory(
  bizA.id,
  '2026-11',
  ownerA,
);
const decEntries = await repo.getRestaurantMonthlyInventory(
  bizA.id,
  '2026-12',
  ownerA,
);
assert(
  novEntries.length === 3 && decEntries.length === 1,
  'Monthly inventory accurately filters entries by YYYY-MM month key (3 in Nov, 1 in Dec)',
);

const novStockPaise = novEntries
  .filter((e) => e.entryType === 'stock_purchase')
  .reduce((s, e) => s + e.amountPaise, 0);
const novExpensePaise = novEntries
  .filter((e) => e.entryType === 'monthly_expense')
  .reduce((s, e) => s + e.amountPaise, 0);
assert(
  novStockPaise === 615000 && novExpensePaise === 3500000,
  `Monthly totals accurate: Stock ₹${novStockPaise / 100}, Expenses ₹${novExpensePaise / 100}`,
);

// Toggle 1-tap Low Stock flag on Milk
const flaggedMilk = await repo.updateRestaurantMonthlyInventoryItem(
  bizA.id,
  milkEntry.id,
  {
    monthKey: milkEntry.monthKey,
    entryType: milkEntry.entryType,
    category: milkEntry.category,
    itemName: milkEntry.itemName,
    quantityLabel: milkEntry.quantityLabel,
    amountPaise: milkEntry.amountPaise,
    lowStockAlert: true,
    notes: milkEntry.notes,
  },
  ownerA,
);
assert(
  flaggedMilk.lowStockAlert === true,
  '1-tap Mark Low Stock flag updated and persisted on Full Cream Milk',
);

// Delete entry cleanly
await repo.deleteRestaurantMonthlyInventoryItem(bizA.id, rentEntry.id, ownerA);
const novAfterDelete = await repo.getRestaurantMonthlyInventory(
  bizA.id,
  '2026-11',
  ownerA,
);
assert(
  novAfterDelete.length === 2 &&
    novAfterDelete.filter((e) => e.lowStockAlert).length === 2,
  'Deleted expense entry cleanly; remaining 2 stock items both show lowStockAlert=true',
);

// ---------------------------------------------------------------------------
// 5. Multi-Tenant Isolation Across Restaurants
// ---------------------------------------------------------------------------
console.log('\n5. Multi-Tenant Security & Isolation');

await assertRejects(
  () => repo.getRestaurantStaffMembers(bizA.id, ownerB),
  'Unauthorized',
  'Owner B blocked from reading Owner A individual Staff Roster',
);

await assertRejects(
  () =>
    repo.createRestaurantStaffMember(
      bizA.id,
      { fullName: 'Rogue Staff', role: 'waiter', pinHash: raviPinHash },
      ownerB,
    ),
  'Unauthorized',
  'Owner B blocked from adding staff to Owner A restaurant',
);

await assertRejects(
  () => repo.getRestaurantMonthlyInventory(bizA.id, '2026-11', ownerB),
  'Unauthorized',
  'Owner B blocked from viewing Owner A Monthly Inventory & Expenses',
);

await assertRejects(
  () =>
    repo.deleteRestaurantMonthlyInventoryItem(
      bizA.id,
      coffeeEntry.id,
      ownerB,
    ),
  'Unauthorized',
  'Owner B blocked from deleting Owner A inventory entries',
);

console.log(
  `\n===================================================================`,
);
console.log(`Verification Summary: ${passed} passed, ${failed} failed`);
console.log(
  `===================================================================\n`,
);

if (failed > 0) {
  Deno.exit(1);
}
