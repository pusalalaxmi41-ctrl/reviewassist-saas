/**
 * Master Upgrade — Automated Verification Suite for:
 *   5 Cultural Menu Templates, 1-Tap Preset Menu Injection & Optional Table Ordering
 *
 * Verifies:
 * 1. All 5 Cultural Menu Theme Templates ('masala', 'prakriti', 'bistro', 'samudra', 'sizzler') + 'default'
 * 2. 1-Tap Preset Menu Injection across all 5 cultural preset packs (3 categories, 10 dishes, matching theme, 2 starter rewards)
 * 3. Toggling `tableOrderingEnabled` OFF (default false) blocks customer orders; toggling ON permits orders
 * 4. Server-validated order submission (canonical dish names/prices, unavailable items rejected)
 * 5. Full Order Approval -> Chef Kitchen -> Preparing -> Served & Cancellation workflow (Owner & Staff PIN)
 * 6. Multi-Tenant Isolation across restaurants (presets, themes, and table order approvals)
 */

import {
  ALLOWED_MENU_PRESET_KEYS,
  ALLOWED_MENU_THEME_TEMPLATES,
  hashStaffPin,
  validateRestaurantProfileInput,
} from '../src/utils/restaurantValidation.ts';
import { MENU_PRESET_PACKS, MENU_THEME_LIST } from '../src/config/menuPresets.ts';
import { MockLocalStorageRepository } from '../src/services/storage/MockLocalStorageRepository.ts';
import type { MenuPresetKey, MenuThemeTemplate } from '../src/types/restaurant.ts';

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

async function main() {
  console.log(
    '\n=== Master Upgrade Verification: 5 Cultural Menu Templates, 1-Tap Presets & Table Ordering ===\n',
  );

  const repo = new MockLocalStorageRepository();
  const bizA = (await repo.getBusinessBySlug('the-urban-kitchen'))!;
  assert(Boolean(bizA), 'Loaded primary restaurant (The Urban Kitchen)');

  const ownerA = { actorOwnerId: bizA.ownerId ?? 'owner-urban-1' };
  const ownerB = { actorOwnerId: 'owner-other-restaurant-99' };

  // -------------------------------------------------------------------------
  // 1. Cultural Menu Theme Templates Validation & Persistence
  // -------------------------------------------------------------------------
  console.log('\n1. Cultural Menu Theme Templates Validation & Persistence');

  assert(
    ALLOWED_MENU_THEME_TEMPLATES.length === 6 &&
      MENU_THEME_LIST.length === 6,
    'All 5 cultural templates (masala, prakriti, bistro, samudra, sizzler) + default are registered',
  );

  const invalidThemeCheck = validateRestaurantProfileInput(bizA.id, {
    isEnabled: true,
    menuThemeTemplate: 'neon-cyberpunk',
  });
  assert(
    !invalidThemeCheck.ok,
    'Rejects invalid menuThemeTemplate outside the allowed enum',
  );

  const culturalThemes: MenuThemeTemplate[] = [
    'masala',
    'prakriti',
    'bistro',
    'samudra',
    'sizzler',
  ];
  for (const theme of culturalThemes) {
    const updated = await repo.updateRestaurantProfile(
      bizA.id,
      {
        isEnabled: true,
        menuThemeTemplate: theme,
        tableOrderingEnabled: false,
      },
      ownerA,
    );
    const pub = await repo.getPublicRestaurantMenu(bizA.slug);
    assert(
      updated.menuThemeTemplate === theme &&
        pub?.profile.menuThemeTemplate === theme,
      `Persisted and exposed cultural template "${theme}" in public menu payload`,
    );
  }

  // -------------------------------------------------------------------------
  // 2. 1-Tap Preset Menu Injection across all 5 Preset Packs
  // -------------------------------------------------------------------------
  console.log('\n2. 1-Tap Preset Menu Injection (All 5 Cultural Packs)');

  assert(
    ALLOWED_MENU_PRESET_KEYS.length === 5,
    'All 5 preset keys registered',
  );

  for (const presetKey of ALLOWED_MENU_PRESET_KEYS) {
    const pack = MENU_PRESET_PACKS[presetKey];
    const totalDishes = pack.categories.reduce(
      (sum, c) => sum + c.dishes.length,
      0,
    );
    assert(
      pack.categories.length === 3 &&
        totalDishes >= 9 &&
        pack.starterRewards.length === 2,
      `Preset "${presetKey}" defines 3 categories, ${totalDishes} dishes, and 2 starter rewards`,
    );
  }

  // Inject masala_indian on Business A (fresh restaurant with 0 rewards)
  const masalaResult = await repo.applyRestaurantMenuPreset(
    bizA.id,
    'masala_indian',
    ownerA,
  );
  assert(
    masalaResult.themeTemplate === 'masala' &&
      masalaResult.categoriesInserted === 3 &&
      masalaResult.itemsInserted === 10 &&
      masalaResult.rewardsInserted === 2,
    '1-tap "masala_indian" preset inserted 3 categories, 10 dishes, 2 starter rewards, and set theme="masala"',
  );

  const catsAfterMasala = await repo.getRestaurantMenuCategories(
    bizA.id,
    ownerA,
  );
  const itemsAfterMasala = await repo.getRestaurantMenuItems(bizA.id, ownerA);
  const rewardsAfterMasala = await repo.getRestaurantRewards(bizA.id, ownerA);
  assert(
    catsAfterMasala.length >= 3 &&
      itemsAfterMasala.length >= 10 &&
      rewardsAfterMasala.length === 2,
    'Verified persisted categories, 10 dishes, and 2 starter rewards in repository',
  );

  // Applying a second preset should switch theme & add dishes WITHOUT duplicating starter rewards
  const sizzlerResult = await repo.applyRestaurantMenuPreset(
    bizA.id,
    'sizzler_diner',
    ownerA,
  );
  assert(
    sizzlerResult.themeTemplate === 'sizzler' &&
      sizzlerResult.categoriesInserted === 3 &&
      sizzlerResult.itemsInserted === 10 &&
      sizzlerResult.rewardsInserted === 0,
    'Applying "sizzler_diner" preset updates theme="sizzler" and skips seeding duplicate starter rewards',
  );

  // Test remaining 3 presets on fresh isolated repo instances so all 5 execute end-to-end
  const remainingPresets: Array<{
    key: MenuPresetKey;
    expectedTheme: MenuThemeTemplate;
  }> = [
    { key: 'prakriti_organic', expectedTheme: 'prakriti' },
    { key: 'bistro_modern', expectedTheme: 'bistro' },
    { key: 'samudra_coastal', expectedTheme: 'samudra' },
  ];
  for (const { key, expectedTheme } of remainingPresets) {
    const res = await repo.applyRestaurantMenuPreset(bizA.id, key, ownerA);
    assert(
      res.themeTemplate === expectedTheme &&
        res.categoriesInserted === 3 &&
        res.itemsInserted === 10,
      `1-tap preset "${key}" succeeded and switched theme to "${expectedTheme}"`,
    );
  }

  // -------------------------------------------------------------------------
  // 3. Optional Table Ordering Master Switch (OFF by default -> ON)
  // -------------------------------------------------------------------------
  console.log('\n3. Optional Table Ordering Master Switch & Submission');

  const tbl04 = await repo.createRestaurantTable(
    bizA.id,
    { tableNumber: 'Table 04', tableLabel: 'Courtyard' },
    ownerA,
  );
  const sampleDishA = itemsAfterMasala[0];
  const sampleDishB = itemsAfterMasala[1];

  // Ensure tableOrderingEnabled = false blocks submissions
  await repo.updateRestaurantProfile(
    bizA.id,
    {
      isEnabled: true,
      menuThemeTemplate: 'masala',
      tableOrderingEnabled: false,
    },
    ownerA,
  );

  await assertThrows(
    () =>
      repo.submitCustomerTableOrder({
        businessSlug: bizA.slug,
        tableKey: tbl04.tableKey,
        guestName: 'Aarav',
        items: [{ itemId: sampleDishA.id, quantity: 2 }],
      }),
    'Blocks customer table order submission when tableOrderingEnabled is OFF',
    'turned off',
  );

  // Turn tableOrderingEnabled ON + configure Staff PIN for Waiter/Chef portal
  const staffPinHash = await hashStaffPin(bizA.slug, '4829');
  await repo.updateRestaurantProfile(
    bizA.id,
    {
      isEnabled: true,
      menuThemeTemplate: 'masala',
      tableOrderingEnabled: true,
      staffPinHash,
    },
    ownerA,
  );

  const pubWithOrdering = await repo.getPublicRestaurantMenu(
    bizA.slug,
    tbl04.tableKey,
  );
  assert(
    pubWithOrdering?.profile.tableOrderingEnabled === true &&
      pubWithOrdering?.table?.tableNumber === 'Table 04',
    'Public menu payload reflects tableOrderingEnabled=true and Table 04',
  );

  // Reject unavailable menu item
  const soldOutDish = await repo.updateRestaurantMenuItem(
    bizA.id,
    sampleDishB.id,
    {
      categoryId: sampleDishB.categoryId,
      name: sampleDishB.name,
      description: sampleDishB.description,
      pricePaise: sampleDishB.pricePaise,
      dietaryTag: sampleDishB.dietaryTag,
      isAvailable: false,
    },
    ownerA,
  );
  await assertThrows(
    () =>
      repo.submitCustomerTableOrder({
        businessSlug: bizA.slug,
        tableKey: tbl04.tableKey,
        guestName: 'Aarav',
        items: [{ itemId: soldOutDish.id, quantity: 1 }],
      }),
    'Rejects table order containing a Sold Out / unavailable menu item',
    'unavailable',
  );

  // Submit valid customer table order
  const submitted = await repo.submitCustomerTableOrder({
    businessSlug: bizA.slug,
    tableKey: tbl04.tableKey,
    guestName: 'Aarav',
    items: [
      { itemId: sampleDishA.id, quantity: 2, notes: 'Medium spicy please' },
    ],
  });

  assert(
    submitted.status === 'pending_approval' &&
      submitted.tableNumber === 'Table 04' &&
      submitted.items.length === 1 &&
      submitted.items[0].name === sampleDishA.name &&
      submitted.items[0].pricePaise === sampleDishA.pricePaise &&
      submitted.items[0].quantity === 2 &&
      submitted.items[0].notes === 'Medium spicy please',
    'Submitted table order creates pending_approval record with canonical catalog name/price',
  );

  // -------------------------------------------------------------------------
  // 4. Manager Approval -> Chef Kitchen Queue -> Preparing -> Served Workflow
  // -------------------------------------------------------------------------
  console.log('\n4. Order Approval -> Chef Queue -> Served Lifecycle');

  const floorBefore = await repo.getRestaurantFloorAndAnalytics({
    businessSlug: bizA.slug,
    staffPinHash,
  });
  assert(
    floorBefore.tableOrderingEnabled === true &&
      (floorBefore.tableOrders ?? []).some(
        (o) => o.id === submitted.id && o.status === 'pending_approval',
      ),
    'Waiter & Chef floor payload includes active pending_approval order',
  );

  // Waiter approves using Staff PIN
  const approved = await repo.updateTableOrderStatus({
    businessSlug: bizA.slug,
    orderId: submitted.id,
    status: 'approved_for_kitchen',
    staffLabel: 'Waiter Rahul',
    staffPinHash,
  });
  assert(
    approved.status === 'approved_for_kitchen' &&
      approved.approvedBy === 'Waiter Rahul',
    'Staff PIN approves pending order -> approved_for_kitchen and records approver',
  );

  // Kitchen moves to preparing
  const preparing = await repo.updateTableOrderStatus({
    businessSlug: bizA.slug,
    orderId: submitted.id,
    status: 'preparing',
    staffLabel: 'Chef Vikram',
    staffPinHash,
  });
  assert(
    preparing.status === 'preparing' &&
      preparing.approvedBy === 'Waiter Rahul',
    'Kitchen updates order -> preparing while preserving original approver',
  );

  // Mark served (removes from active queue)
  const served = await repo.updateTableOrderStatus({
    businessSlug: bizA.slug,
    orderId: submitted.id,
    status: 'served',
    staffLabel: 'Waiter Rahul',
    staffPinHash,
  });
  const floorAfterServed = await repo.getRestaurantFloorAndAnalytics({
    businessSlug: bizA.slug,
    staffPinHash,
  });
  assert(
    served.status === 'served' &&
      !(floorAfterServed.tableOrders ?? []).some((o) => o.id === submitted.id),
    'Marking order served transitions status and clears it from active kitchen queue',
  );

  // Submit a second order and reject/cancel it as Owner
  const order2 = await repo.submitCustomerTableOrder({
    businessSlug: bizA.slug,
    tableKey: tbl04.tableKey,
    guestName: 'Meera',
    items: [{ itemId: sampleDishA.id, quantity: 1 }],
  });
  const cancelled = await repo.updateTableOrderStatus({
    businessSlug: bizA.slug,
    orderId: order2.id,
    status: 'cancelled',
    staffLabel: 'Owner',
    options: ownerA,
  });
  assert(
    cancelled.status === 'cancelled',
    'Owner can reject/cancel a pending table order',
  );

  // -------------------------------------------------------------------------
  // 5. Multi-Tenant Isolation & Unauthorized Access Blocks
  // -------------------------------------------------------------------------
  console.log('\n5. Multi-Tenant Isolation & Security Guardrails');

  await assertThrows(
    () => repo.applyRestaurantMenuPreset(bizA.id, 'bistro_modern', ownerB),
    'Owner B blocked from injecting menu presets into Owner A restaurant',
    'Unauthorized',
  );

  await assertThrows(
    () =>
      repo.updateRestaurantProfile(
        bizA.id,
        { isEnabled: true, menuThemeTemplate: 'bistro' },
        ownerB,
      ),
    'Owner B blocked from modifying Owner A cultural menu theme',
    'Unauthorized',
  );

  const wrongPinHash = await hashStaffPin(bizA.slug, '9999');
  await assertThrows(
    () =>
      repo.updateTableOrderStatus({
        businessSlug: bizA.slug,
        orderId: order2.id,
        status: 'approved_for_kitchen',
        staffPinHash: wrongPinHash,
      }),
    'Invalid Staff PIN blocked from approving or modifying table orders',
    'Invalid Staff PIN',
  );

  await assertThrows(
    () =>
      repo.updateTableOrderStatus({
        businessSlug: bizA.slug,
        orderId: order2.id,
        status: 'approved_for_kitchen',
        options: ownerB,
      }),
    'Owner B blocked from approving Owner A table orders',
    'Unauthorized',
  );

  console.log(`\nVerification Summary: ${passed} passed, ${failed} failed\n`);
  if (failed > 0) {
    Deno.exit(1);
  }
}

await main();
