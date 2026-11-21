/**
 * Phase 1 — Automated Verification Suite for Restaurant Foundation, Tables, QR Standees & Digital Menu
 *
 * Verifies:
 * 1. Price parsing & formatting (paise integer arithmetic, zero floating-point drift, multi-currency)
 * 2. Table slug derivation & canonical URL builders (/r/:slug/menu & /r/:slug/table/:tableKey)
 * 3. Input validators (profile, tables, categories, dishes, dietary tags, bounds checks)
 * 4. Repository CRUD for Restaurant Profile, Tables, Categories & Dishes (including cascade delete)
 * 5. Public Digital Menu resolution rules (active business gate, enabled profile gate, active category/item filtering, table badge resolution)
 * 6. Multi-tenant isolation & cross-owner unauthorized access blocking
 * 7. Headless QR Standee scan verification for Table QR URLs via jsqr
 */

import jsQR from 'jsqr';
import {
  deriveTableKey,
  formatPriceFromPaise,
  getRestaurantMenuUrl,
  getRestaurantTableQrUrl,
  parseMajorCurrencyToPaise,
  validateRestaurantMenuCategoryInput,
  validateRestaurantMenuItemInput,
  validateRestaurantProfileInput,
  validateRestaurantTableInput,
} from '../src/utils/restaurantValidation.ts';
import { MockLocalStorageRepository } from '../src/services/storage/MockLocalStorageRepository.ts';
import { renderQrTemplateToRgbaBuffer } from '../src/services/qr/qrGenerator.ts';

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
    console.log(`  [PASS] ${label} (Blocked with: "${msg}")`);
  }
}

async function runTests() {
  console.log('===================================================================');
  console.log('Phase 1: Restaurant Foundation, Tables, QR & Digital Menu Suite');
  console.log('===================================================================\n');

  const repo = new MockLocalStorageRepository();
  const businesses = await repo.getBusinesses();
  const activeRestaurant = businesses[0]; // The Urban Kitchen (active, owner-urban-1)
  const pendingCafe = businesses[1]; // Blue Tokai Cafe (pending, owner-bluetokai-2)

  // ---------------------------------------------------------------------------
  // 1. Price Parsing & Formatting (Paise Integer Storage)
  // ---------------------------------------------------------------------------
  console.log('1. Price Parsing & Formatting (Smallest Currency Unit / Paise)');
  const p1 = parseMajorCurrencyToPaise('249');
  assert(
    p1.ok && p1.pricePaise === 24900,
    'Parses whole INR amount "249" into 24900 paise',
  );

  const p2 = parseMajorCurrencyToPaise('249.50');
  assert(
    p2.ok && p2.pricePaise === 24950,
    'Parses decimal amount "249.50" into 24950 paise without float error',
  );

  const p3 = parseMajorCurrencyToPaise('19.99');
  assert(
    p3.ok && p3.pricePaise === 1999,
    'Parses "19.99" into 1999 cents accurately',
  );

  const pInvalid = parseMajorCurrencyToPaise('-50');
  assert(!pInvalid.ok, 'Rejects negative price input "-50"');

  const pTooManyDecimals = parseMajorCurrencyToPaise('12.345');
  assert(!pTooManyDecimals.ok, 'Rejects price with more than 2 decimal places');

  assert(
    formatPriceFromPaise(24900, 'INR') === '₹249',
    'Formats 24900 paise in INR as "₹249"',
  );
  assert(
    formatPriceFromPaise(24950, 'INR') === '₹249.50',
    'Formats 24950 paise in INR as "₹249.50"',
  );
  assert(
    formatPriceFromPaise(1250, 'USD') === '$12.50',
    'Formats 1250 cents in USD as "$12.50"',
  );

  // ---------------------------------------------------------------------------
  // 2. Table Key Derivation & Non-Colliding QR URLs
  // ---------------------------------------------------------------------------
  console.log('\n2. Table Key Derivation & Non-Colliding QR Route Generation');
  assert(
    deriveTableKey('Table 04') === 'table-04' &&
      deriveTableKey('  Patio #2 (Window) ') === 'patio-2-window',
    'deriveTableKey produces clean URL-safe slugs',
  );

  const menuUrl = getRestaurantMenuUrl('the-urban-kitchen', 'https://vitaran-ai-reviews.vercel.app');
  assert(
    menuUrl === 'https://vitaran-ai-reviews.vercel.app/r/the-urban-kitchen/menu',
    'Generates canonical general menu URL (/r/:slug/menu)',
  );

  const tableUrl = getRestaurantTableQrUrl(
    'the-urban-kitchen',
    'Table 04',
    'https://vitaran-ai-reviews.vercel.app',
  );
  assert(
    tableUrl === 'https://vitaran-ai-reviews.vercel.app/r/the-urban-kitchen/table/table-04',
    'Generates canonical table-specific QR URL (/r/:slug/table/:tableKey)',
  );

  // ---------------------------------------------------------------------------
  // 3. Input Validation Rules
  // ---------------------------------------------------------------------------
  console.log('\n3. Validation Rules for Profile, Tables, Categories & Items');
  assert(
    !validateRestaurantProfileInput(activeRestaurant.id, {
      isEnabled: true,
      currencyCode: 'INVALID',
    }).ok,
    'Rejects unsupported currency code in restaurant profile',
  );

  assert(
    !validateRestaurantTableInput(activeRestaurant.id, {
      tableNumber: '   ',
    }).ok,
    'Rejects empty table number',
  );

  assert(
    !validateRestaurantMenuCategoryInput(activeRestaurant.id, {
      name: '',
    }).ok,
    'Rejects empty category name',
  );

  assert(
    !validateRestaurantMenuItemInput(activeRestaurant.id, {
      categoryId: 'cat-1',
      name: 'Paneer Tikka',
      pricePaise: -100,
    }).ok,
    'Rejects negative pricePaise in menu item validator',
  );

  assert(
    !validateRestaurantMenuItemInput(activeRestaurant.id, {
      categoryId: 'cat-1',
      name: 'Paneer Tikka',
      pricePaise: 25000,
      dietaryTag: 'unknown_diet' as never,
    }).ok,
    'Rejects invalid dietaryTag',
  );

  // ---------------------------------------------------------------------------
  // 4. Repository Operations: Profile, Tables, Categories & Menu Items
  // ---------------------------------------------------------------------------
  console.log('\n4. Repository CRUD Operations & Public Gate Checks');
  const initialProfile = await repo.getRestaurantProfile(activeRestaurant.id);
  assert(
    initialProfile.isEnabled === false && initialProfile.currencyCode === 'INR',
    'Default restaurant profile starts disabled (isEnabled = false) with INR currency',
  );

  const disabledPublicLookup = await repo.getPublicRestaurantMenu(
    activeRestaurant.slug,
  );
  assert(
    disabledPublicLookup === null,
    'getPublicRestaurantMenu returns null when restaurant profile is disabled',
  );

  // Enable Restaurant Suite for activeRestaurant
  const enabledProfile = await repo.updateRestaurantProfile(
    activeRestaurant.id,
    {
      isEnabled: true,
      currencyCode: 'INR',
      tagline: 'Authentic Hyderabadi Kitchen & Tandoor',
      gamesEnabled: true,
      loyaltyEnabled: true,
    },
  );
  assert(
    enabledProfile.isEnabled === true &&
      enabledProfile.tagline === 'Authentic Hyderabadi Kitchen & Tandoor',
    'Restaurant profile enabled and tagline saved',
  );

  // Create Tables + verify duplicate table_key rejection
  const table1 = await repo.createRestaurantTable(activeRestaurant.id, {
    tableNumber: 'Table 01',
    tableLabel: 'Main Hall',
  });
  const table4 = await repo.createRestaurantTable(activeRestaurant.id, {
    tableNumber: 'Table 04',
    tableLabel: 'Window Corner',
  });
  assert(
    table1.tableKey === 'table-01' && table4.tableKey === 'table-04',
    'Created Table 01 and Table 04 with URL-safe keys',
  );

  await assertThrows(
    () =>
      repo.createRestaurantTable(activeRestaurant.id, {
        tableNumber: 'TABLE 04',
      }),
    'Duplicate table key within the same business is rejected',
    'Duplicate table key',
  );

  // Create Categories
  const catStarters = await repo.createRestaurantMenuCategory(
    activeRestaurant.id,
    {
      name: 'Tandoor Starters',
      description: 'Charcoal-grilled kebabs and tikkas',
      displayOrder: 0,
      isActive: true,
    },
  );
  const catMains = await repo.createRestaurantMenuCategory(
    activeRestaurant.id,
    {
      name: 'Royal Biryanis',
      description: 'Slow-cooked saffron dum biryanis',
      displayOrder: 1,
      isActive: true,
    },
  );
  const catHidden = await repo.createRestaurantMenuCategory(
    activeRestaurant.id,
    {
      name: 'Seasonal Secret Menu',
      description: 'Hidden category',
      displayOrder: 2,
      isActive: false,
    },
  );

  // Create Menu Items
  const dishVeg = await repo.createRestaurantMenuItem(activeRestaurant.id, {
    categoryId: catStarters.id,
    name: 'Malai Paneer Tikka',
    description: 'Cottage cheese marinated in cardamom cream',
    pricePaise: 26900,
    dietaryTag: 'veg',
    isAvailable: true,
    isFeatured: true,
  });
  const dishNonVeg = await repo.createRestaurantMenuItem(activeRestaurant.id, {
    categoryId: catMains.id,
    name: 'Zafrani Mutton Dum Biryani',
    description: 'Tender mutton slow-cooked with basmati rice',
    pricePaise: 39900,
    dietaryTag: 'non_veg',
    isAvailable: true,
    isFeatured: true,
  });
  const dishSoldOut = await repo.createRestaurantMenuItem(activeRestaurant.id, {
    categoryId: catMains.id,
    name: 'Sold Out Special Pulao',
    description: 'Temporarily unavailable',
    pricePaise: 29900,
    dietaryTag: 'veg',
    isAvailable: false,
    isFeatured: false,
  });
  const dishInHiddenCat = await repo.createRestaurantMenuItem(
    activeRestaurant.id,
    {
      categoryId: catHidden.id,
      name: 'Hidden Mango Halwa',
      description: 'Inside inactive category',
      pricePaise: 15900,
      dietaryTag: 'veg',
      isAvailable: true,
      isFeatured: false,
    },
  );

  assert(
    Boolean(dishVeg.id && dishNonVeg.id && dishSoldOut.id && dishInHiddenCat.id),
    'Created menu items across active and hidden categories',
  );

  // ---------------------------------------------------------------------------
  // 5. Public Digital Menu Resolution (/r/:slug/menu & /r/:slug/table/:tableKey)
  // ---------------------------------------------------------------------------
  console.log('\n5. Public Digital Menu & Table Badge Resolution');
  const publicMenuWithTable = await repo.getPublicRestaurantMenu(
    activeRestaurant.slug,
    'table-04',
  );
  assert(
    publicMenuWithTable !== null &&
      publicMenuWithTable.business.slug === 'the-urban-kitchen' &&
      publicMenuWithTable.table?.tableNumber === 'Table 04' &&
      publicMenuWithTable.table?.tableLabel === 'Window Corner',
    'Public menu resolves Table 04 badge accurately for /r/the-urban-kitchen/table/table-04',
  );

  assert(
    publicMenuWithTable !== null &&
      publicMenuWithTable.categories.length === 2 &&
      !publicMenuWithTable.categories.some((c) => c.id === catHidden.id),
    'Public menu excludes inactive categories',
  );

  assert(
    publicMenuWithTable !== null &&
      publicMenuWithTable.items.length === 2 &&
      publicMenuWithTable.items.some((i) => i.id === dishVeg.id) &&
      publicMenuWithTable.items.some((i) => i.id === dishNonVeg.id) &&
      !publicMenuWithTable.items.some((i) => i.id === dishSoldOut.id) &&
      !publicMenuWithTable.items.some((i) => i.id === dishInHiddenCat.id),
    'Public menu includes available dishes and excludes sold-out or hidden-category dishes',
  );

  // Cascade delete test: deleting catStarters deletes its items
  await repo.deleteRestaurantMenuCategory(activeRestaurant.id, catStarters.id);
  const remainingItems = await repo.getRestaurantMenuItems(activeRestaurant.id);
  assert(
    !remainingItems.some((i) => i.id === dishVeg.id),
    'Deleting a menu category cascades and deletes its menu items',
  );

  // Pending business gate test
  await repo.updateRestaurantProfile(pendingCafe.id, {
    isEnabled: true,
    currencyCode: 'INR',
  });
  const pendingPublicMenu = await repo.getPublicRestaurantMenu(pendingCafe.slug);
  assert(
    pendingPublicMenu === null,
    'getPublicRestaurantMenu returns null for unapproved (pending) businesses even if restaurant profile is enabled',
  );

  // ---------------------------------------------------------------------------
  // 6. Multi-Tenant Isolation & Cross-Owner Access Protection
  // ---------------------------------------------------------------------------
  console.log('\n6. Multi-Tenant Isolation & Unauthorized Access Blocking');
  await assertThrows(
    () =>
      repo.updateRestaurantProfile(
        activeRestaurant.id,
        { isEnabled: false },
        { actorOwnerId: 'owner-bluetokai-2' },
      ),
    'Owner B blocked from modifying Owner A restaurant profile',
    'Unauthorized',
  );

  await assertThrows(
    () =>
      repo.createRestaurantTable(
        activeRestaurant.id,
        { tableNumber: 'Hacked Table' },
        { actorOwnerId: 'owner-bluetokai-2' },
      ),
    'Owner B blocked from creating tables in Owner A restaurant',
    'Unauthorized',
  );

  // ---------------------------------------------------------------------------
  // 7. Headless Table QR Standee Decode Verification (jsQR)
  // ---------------------------------------------------------------------------
  console.log('\n7. Headless Table QR Standee Scan Verification (jsQR)');
  const expectedTableQrUrl = getRestaurantTableQrUrl(
    activeRestaurant.slug,
    table4.tableKey,
    'https://vitaran-ai-reviews.vercel.app',
  );
  const renderedBuffer = renderQrTemplateToRgbaBuffer(
    activeRestaurant.slug,
    { template: 'table_standee', accentColor: '#244B40' },
    { targetUrl: expectedTableQrUrl },
  );
  const decoded = jsQR(
    renderedBuffer.data,
    renderedBuffer.width,
    renderedBuffer.height,
  );
  assert(
    decoded !== null && decoded.data === expectedTableQrUrl,
    `Table QR Standee decodes cleanly to "${expectedTableQrUrl}"`,
  );

  console.log('\n===================================================================');
  console.log(`Verification Summary: ${passed} passed, ${failed} failed`);
  console.log('===================================================================');

  if (failed > 0) {
    Deno.exit(1);
  }
}

await runTests();
