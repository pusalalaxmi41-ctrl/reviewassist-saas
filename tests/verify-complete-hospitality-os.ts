/**
 * Verification Suite #15 — Complete Hospitality OS Upgrade (Migration 019):
 *   Visual Floor & Hotel Room Map, Table vs Room Dish Visibility,
 *   1-Tap Service Alerts + Waiter Assignment, 2-Way Live Table/Room Chat,
 *   Multi-Order Open Table Bills + GST CGST/SGST Split + UPI Pending Verify + Checkout Reset,
 *   3-Column Counter POS & Swiggy/Zomato Platform Isolation, Repeat Visit Detection,
 *   Strict Multi-Tenant Isolation & SQL Guardrail Checks.
 *
 * Run with: deno run --allow-read --allow-env tests/verify-complete-hospitality-os.ts
 */

import { MockLocalStorageRepository } from '../src/services/storage/MockLocalStorageRepository.ts';
import { hashStaffPin } from '../src/utils/restaurantValidation.ts';
import {
  buildUpiPaymentUri,
  calculateBillTotals,
  formatElapsedTimerMMSS,
  getKitchenDisplayUrl,
  isBillRequestCallType,
  isPlatformOrOffPremiseSource,
} from '../src/utils/hospitalityHelpers.ts';

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
  '\n=== Suite #15 Verification: Complete Hospitality OS Upgrade (Migration 019) ===\n',
);

// ---------------------------------------------------------------------------
// 1. Billing, GST CGST/SGST Split, UPI Deep-Link & Kitchen Helpers
// ---------------------------------------------------------------------------
console.log('1. Billing Engine, UPI URI & Kitchen Display Helpers');

const simpleTotals = calculateBillTotals({
  subtotalPaise: 50000,
  gstPercent: 0,
  serviceChargePercent: 0,
});
assert(
  simpleTotals.gstPaise === 0 &&
    simpleTotals.serviceChargePaise === 0 &&
    simpleTotals.grandTotalPaise === 50000,
  'Defaults to Simple Total (0% Tax / 0% Service Charge)',
);

const gstTotals = calculateBillTotals({
  subtotalPaise: 100000, // Rs 1000.00
  gstPercent: 5, // Rs 50.00 -> CGST 25.00 + SGST 25.00
  serviceChargePercent: 10, // Rs 100.00
});
assert(
  gstTotals.gstPaise === 5000 &&
    gstTotals.cgstPaise === 2500 &&
    gstTotals.sgstPaise === 2500 &&
    gstTotals.serviceChargePaise === 10000 &&
    gstTotals.grandTotalPaise === 115000,
  'Accurately splits 5% GST into equal CGST + SGST and adds 10% Service Charge',
  gstTotals,
);

const upiUri = buildUpiPaymentUri({
  upiId: 'hotelgrand@okicici',
  payeeName: 'Hotel Grand Palace',
  amountPaise: 115000,
  note: 'Table 01 Bill',
});
assert(
  upiUri.startsWith('upi://pay?pa=hotelgrand%40okicici') &&
    upiUri.includes('am=1150.00') &&
    upiUri.includes('cu=INR'),
  'Generates compliant NPCI upi://pay deep-link URI with formatted rupee amount',
  upiUri,
);

const kdsTimer = formatElapsedTimerMMSS(
  new Date(Date.now() - 12 * 60000 - 5000).toISOString(),
  Date.now(),
);
assert(
  kdsTimer.minutes === 12 && kdsTimer.label.startsWith('12:'),
  'Formats MM:SS live kitchen prep elapsed timer cleanly',
  kdsTimer,
);

assert(
  isBillRequestCallType('bill_request') &&
    isBillRequestCallType('ready_for_bill') &&
    !isBillRequestCallType('water'),
  'Recognizes both new bill_request and legacy ready_for_bill alert types',
);

assert(
  isPlatformOrOffPremiseSource('swiggy') &&
    isPlatformOrOffPremiseSource('zomato') &&
    isPlatformOrOffPremiseSource('pos_takeaway') &&
    !isPlatformOrOffPremiseSource('qr_table') &&
    !isPlatformOrOffPremiseSource('qr_room') &&
    !isPlatformOrOffPremiseSource('pos_dine_in'),
  'Distinguishes off-premise/platform sources from on-premise dining table/room orders',
);

assert(
  getKitchenDisplayUrl('spice-garden', 'https://vitaran-ai-reviews.vercel.app') ===
    'https://vitaran-ai-reviews.vercel.app/r/spice-garden/kitchen',
  'Generates clean /r/:slug/kitchen URL for Dark-Mode KDS tablets',
);

// ---------------------------------------------------------------------------
// 2. Unified Restaurant (Tables) + Hotel (Rooms) & Menu Visibility Filtering
// ---------------------------------------------------------------------------
console.log('\n2. Unified Tables + Hotel Rooms & Dish Visibility Filtering');

const repo = new MockLocalStorageRepository();
const businesses = await repo.getBusinesses();
const restaurant = businesses.find((b) => b.category === 'restaurant');
assert(Boolean(restaurant), 'Loaded seeded restaurant venue');
if (!restaurant) throw new Error('Missing seeded restaurant');

const ownerA = { actorOwnerId: restaurant.ownerId! };
const ownerB = { actorOwnerId: 'unauthorized-tenant-999' };

const updatedProfile = await repo.updateRestaurantProfile(
  restaurant.id,
  {
    isEnabled: true,
    tableOrderingEnabled: true,
    acceptingOrders: true,
    hotelRoomsEnabled: true,
    voiceAlertsEnabled: true,
    upiId: 'grandhotel@okicici',
    upiPayeeName: restaurant.name,
    gstin: '36AAAAA0000A1Z5',
    gstPercent: 5,
    serviceChargePercent: 10,
  },
  ownerA,
);

assert(
  updatedProfile.upiId === 'grandhotel@okicici' &&
    updatedProfile.gstPercent === 5 &&
    updatedProfile.serviceChargePercent === 10 &&
    updatedProfile.hotelRoomsEnabled === true,
  'Persists Hospitality OS profile billing, UPI QR, GST %, and Hotel Rooms settings',
);

const tableT1 = await repo.createRestaurantTable(
  restaurant.id,
  {
    tableNumber: 'T-99',
    tableLabel: 'Garden Patio',
    locationType: 'table',
    seatCapacity: 6,
    isActive: true,
  },
  ownerA,
);

const roomR101 = await repo.createRestaurantTable(
  restaurant.id,
  {
    tableNumber: 'Room 101',
    tableLabel: 'Deluxe Floor 1',
    locationType: 'room',
    seatCapacity: 2,
    isActive: true,
  },
  ownerA,
);

assert(
  tableT1.locationType === 'table' &&
    tableT1.seatCapacity === 6 &&
    roomR101.locationType === 'room' &&
    roomR101.seatCapacity === 2,
  'Creates both Dining Tables (table) and Hotel Rooms (room) with seat capacities',
);

const cat = await repo.createRestaurantMenuCategory(
  restaurant.id,
  { name: 'Hospitality Specials', displayOrder: 0, isActive: true },
  ownerA,
);

const dishTableOnly = await repo.createRestaurantMenuItem(
  restaurant.id,
  {
    categoryId: cat.id,
    name: 'Live Sizzler Platter',
    description: 'Served sizzling on cast iron',
    pricePaise: 40000,
    dietaryTag: 'veg',
    showOnTable: true,
    showOnRoom: false,
    spiceLevel: 'spicy',
    ingredientsSummary: 'Paneer, bell peppers, house barbecue glaze',
    prepTimeMinutes: 18,
  },
  ownerA,
);

const dishRoomOnly = await repo.createRestaurantMenuItem(
  restaurant.id,
  {
    categoryId: cat.id,
    name: 'In-Room Continental Breakfast',
    description: 'Freshly brewed coffee & croissant tray',
    pricePaise: 35000,
    dietaryTag: 'egg',
    showOnTable: false,
    showOnRoom: true,
    spiceLevel: 'mild',
    ingredientsSummary: 'Eggs, butter croissant, orange juice',
    prepTimeMinutes: 12,
  },
  ownerA,
);

const dishShared = await repo.createRestaurantMenuItem(
  restaurant.id,
  {
    categoryId: cat.id,
    name: 'Royal Hyderabadi Biryani',
    pricePaise: 30000,
    dietaryTag: 'non_veg',
    showOnTable: true,
    showOnRoom: true,
    spiceLevel: 'medium',
    prepTimeMinutes: 20,
  },
  ownerA,
);

const tableMenuPayload = await repo.getPublicRestaurantMenu(
  restaurant.slug,
  tableT1.tableKey,
);
const roomMenuPayload = await repo.getPublicRestaurantMenu(
  restaurant.slug,
  roomR101.tableKey,
);

assert(
  Boolean(tableMenuPayload?.items.some((i) => i.id === dishTableOnly.id)) &&
    Boolean(tableMenuPayload?.items.some((i) => i.id === dishShared.id)) &&
    !tableMenuPayload?.items.some((i) => i.id === dishRoomOnly.id),
  'Dining Table menu shows Table-Only & Shared dishes and hides Room-Only dishes',
);

assert(
  Boolean(roomMenuPayload?.items.some((i) => i.id === dishRoomOnly.id)) &&
    Boolean(roomMenuPayload?.items.some((i) => i.id === dishShared.id)) &&
    !roomMenuPayload?.items.some((i) => i.id === dishTableOnly.id),
  'Hotel Room menu shows Room-Only & Shared dishes and hides Table-Only dishes',
);

const fetchedRoomDish = roomMenuPayload?.items.find(
  (i) => i.id === dishRoomOnly.id,
);
assert(
  fetchedRoomDish?.spiceLevel === 'mild' &&
    fetchedRoomDish?.prepTimeMinutes === 12 &&
    fetchedRoomDish?.ingredientsSummary === 'Eggs, butter croissant, orange juice',
  'Preserves spiceLevel, prepTimeMinutes, and ingredientsSummary for Dish Details pop-up',
);

// ---------------------------------------------------------------------------
// 3. 1-Tap Service Alerts (Water / Clean) & Waiter Assignment + System Chat Log
// ---------------------------------------------------------------------------
console.log('\n3. 1-Tap Guest Requests (Water / Clean) & Waiter Assignment');

const waterCall = await repo.createRestaurantTableCall({
  businessSlug: restaurant.slug,
  tableKey: tableT1.tableKey,
  callType: 'water',
});
const cleanCall = await repo.createRestaurantTableCall({
  businessSlug: restaurant.slug,
  tableKey: roomR101.tableKey,
  callType: 'clean_table',
});

assert(
  waterCall.callType === 'water' &&
    waterCall.status === 'open' &&
    cleanCall.callType === 'clean_table',
  'Dispatches 1-tap water and clean_table guest requests cleanly',
);

const assignedWaterCall = await repo.updateRestaurantTableCallStatus(
  {
    businessSlug: restaurant.slug,
    callId: waterCall.id,
    status: 'acknowledged',
    assignedStaffLabel: 'Rahul (WTR-01)',
  },
  ownerA,
);

assert(
  assignedWaterCall.status === 'acknowledged' &&
    assignedWaterCall.assignedStaffLabel === 'Rahul (WTR-01)',
  'Assigns waiter Rahul (WTR-01) to live guest request',
);

const resolvedWaterCall = await repo.updateRestaurantTableCallStatus(
  {
    businessSlug: restaurant.slug,
    callId: waterCall.id,
    status: 'resolved',
    assignedStaffLabel: 'Rahul (WTR-01)',
  },
  ownerA,
);
assert(
  resolvedWaterCall.status === 'resolved',
  'Marks guest request resolved ✓',
);

// ---------------------------------------------------------------------------
// 4. 2-Way Live Table/Room Chat + Security
// ---------------------------------------------------------------------------
console.log('\n4. 2-Way Live Table/Room Chat');

const threadAfterGuest = await repo.sendTableChatMessage({
  businessSlug: restaurant.slug,
  tableKey: tableT1.tableKey,
  senderRole: 'customer',
  senderName: 'Aarav',
  messageText: 'Could we get 2 extra plates and warm water please?',
});

const threadAfterManager = await repo.sendTableChatMessage({
  businessSlug: restaurant.slug,
  tableKey: tableT1.tableKey,
  senderRole: 'manager',
  senderName: 'Manager',
  messageText: 'Sending Rahul right over with warm water and plates!',
  options: ownerA,
});

const thread = await repo.getTableChatMessages({
  businessSlug: restaurant.slug,
  tableKey: tableT1.tableKey,
});

assert(
  threadAfterGuest.length >= 2 &&
    threadAfterManager.length >= 3 &&
    thread.some(
      (m) =>
        m.senderRole === 'customer' &&
        m.messageText.includes('2 extra plates'),
    ) &&
    thread.some(
      (m) =>
        m.senderRole === 'manager' &&
        m.messageText.includes('Sending Rahul'),
    ) &&
    thread.some((m) => m.senderRole === 'system'),
  'Stores customer messages, manager replies, and system request logs in chronological table thread',
);

await assertRejects(
  () =>
    repo.sendTableChatMessage({
      businessSlug: restaurant.slug,
      tableKey: tableT1.tableKey,
      senderRole: 'manager',
      senderName: 'Spoofer',
      messageText: 'Fake manager reply',
      options: ownerB,
    }),
  'unauthorized',
  'Blocks unauthorized tenant from spoofing manager chat replies',
);

// ---------------------------------------------------------------------------
// 5. Multi-Order Open Table Bill + Kitchen Status Progression + UPI + Checkout
// ---------------------------------------------------------------------------
console.log(
  '\n5. Multi-Order Open Table Bill, KDS Ready Flow, UPI Pending Verify & Final Checkout',
);

const order1 = await repo.submitCustomerTableOrder({
  businessSlug: restaurant.slug,
  tableKey: tableT1.tableKey,
  guestName: 'Aarav',
  kitchenNote: 'Less spicy, extra raita',
  items: [{ itemId: dishShared.id, quantity: 2 }], // 2 x 300 = Rs 600 (60000 paise)
});

const order2 = await repo.submitCustomerTableOrder({
  businessSlug: restaurant.slug,
  tableKey: tableT1.tableKey,
  guestName: 'Aarav',
  kitchenNote: 'Serve sizzling hot',
  items: [{ itemId: dishTableOnly.id, quantity: 1 }], // 1 x 400 = Rs 400 (40000 paise)
});

assert(
  Boolean(order1.billSessionId) &&
    order1.billSessionId === order2.billSessionId &&
    order1.kitchenNote === 'Less spicy, extra raita',
  'Accumulates multiple orders on the same table onto ONE shared billSessionId with kitchen notes',
);

const tablesAfterOrder = await repo.getRestaurantTables(restaurant.id, ownerA);
const occupiedT1 = tablesAfterOrder.find((t) => t.id === tableT1.id);
assert(
  Boolean(occupiedT1?.occupiedSince),
  'Automatically stamps occupiedSince on table when first order opens',
);

// Progress Order 1 through Kitchen KDS: approved_for_kitchen -> preparing -> ready -> served
await repo.updateTableOrderStatus(
  {
    businessSlug: restaurant.slug,
    orderId: order1.id,
    status: 'approved_for_kitchen',
    staffLabel: 'Owner',
  },
  ownerA,
);
await repo.updateTableOrderStatus(
  {
    businessSlug: restaurant.slug,
    orderId: order1.id,
    status: 'preparing',
    staffLabel: 'Chef',
  },
  ownerA,
);
const readyOrder1 = await repo.updateTableOrderStatus(
  {
    businessSlug: restaurant.slug,
    orderId: order1.id,
    status: 'ready',
    staffLabel: 'Chef',
  },
  ownerA,
);
assert(
  readyOrder1.status === 'ready',
  'Kitchen KDS marks order as Ready before serving',
);

await repo.updateTableOrderStatus(
  {
    businessSlug: restaurant.slug,
    orderId: order1.id,
    status: 'served',
    staffLabel: 'Waiter',
  },
  ownerA,
);

const floorAfterServed = await repo.getRestaurantFloorAndAnalytics(
  { businessSlug: restaurant.slug },
  ownerA,
);
assert(
  !(floorAfterServed.tableOrders ?? []).some((o) => o.id === order1.id) &&
    Boolean(floorAfterServed.recentOrders?.some((o) => o.id === order1.id)),
  'Zero-regression contract: served unpaid order leaves active kitchen tableOrders while staying in recentOrders for open table billing',
);

const openBill = await repo.getOpenTableBillSummary({
  businessSlug: restaurant.slug,
  tableKey: tableT1.tableKey,
});

assert(
  openBill !== null &&
    openBill.orderCount === 2 &&
    openBill.subtotalPaise === 100000 &&
    openBill.gstPaise === 5000 &&
    openBill.cgstPaise === 2500 &&
    openBill.sgstPaise === 2500 &&
    openBill.serviceChargePaise === 10000 &&
    openBill.grandTotalPaise === 115000 &&
    openBill.upiId === 'grandhotel@okicici' &&
    openBill.isCheckedOut === false,
  'Open Table Bill combines Order 1 + Order 2 (Rs 1000) + 5% GST (CGST+SGST) + 10% Service = Rs 1150 with dynamic UPI ID',
  openBill,
);

// Guest taps "I've Paid via UPI"
await repo.markTableBillUpiPending({
  businessSlug: restaurant.slug,
  tableKey: tableT1.tableKey,
});

const billAfterUpi = await repo.getOpenTableBillSummary({
  businessSlug: restaurant.slug,
  tableKey: tableT1.tableKey,
});
assert(
  billAfterUpi?.paymentStatus === 'upi_pending_verify',
  'Marks open table bill as upi_pending_verify so cashier sees VERIFY UPI alert',
);

// Guest also requests final bill
await repo.createRestaurantTableCall({
  businessSlug: restaurant.slug,
  tableKey: tableT1.tableKey,
  callType: 'bill_request',
});

// Owner completes final checkout
const checkoutRes = await repo.completeTableBillCheckout({
  businessId: restaurant.id,
  tableId: tableT1.id,
  paymentMethod: 'upi',
  staffLabel: 'Owner',
  options: ownerA,
});

assert(
  checkoutRes.settledOrdersCount === 2 &&
    checkoutRes.billSummary?.grandTotalPaise === 115000 &&
    checkoutRes.billSummary?.paymentMethod === 'upi',
  'Final Table Checkout settles all 2 open orders for Rs 1150 via UPI',
  checkoutRes,
);

const tablesAfterCheckout = await repo.getRestaurantTables(
  restaurant.id,
  ownerA,
);
const clearedT1 = tablesAfterCheckout.find((t) => t.id === tableT1.id);
assert(
  clearedT1?.occupiedSince === null,
  'Final Checkout resets table occupiedSince to null (Available Mint state)',
);

const billAfterCheckout = await repo.getOpenTableBillSummary({
  businessSlug: restaurant.slug,
  tableKey: tableT1.tableKey,
});
assert(
  billAfterCheckout !== null &&
    billAfterCheckout.isCheckedOut === true &&
    billAfterCheckout.paymentMethod === 'upi' &&
    Boolean(billAfterCheckout.paidAt),
  'Guest bill view transitions cleanly to isCheckedOut === true for 1-tap Receipt Download',
);

const threadAfterCheckout = await repo.getTableChatMessages({
  businessSlug: restaurant.slug,
  tableKey: tableT1.tableKey,
});
assert(
  threadAfterCheckout.some((m) =>
    m.messageText.toLowerCase().includes('checkout approved'),
  ),
  'Posts checkout confirmation receipt notice into table chat thread',
);

// ---------------------------------------------------------------------------
// 6. 3-Column Counter POS + Swiggy/Zomato Platform Intake & Repeat Visit Badge
// ---------------------------------------------------------------------------
console.log(
  '\n6. Counter POS Takeaway, Swiggy/Zomato Platform Isolation & Repeat Visit Detection',
);

const posTakeaway = await repo.createPosOrPlatformOrder(
  {
    businessId: restaurant.id,
    orderSource: 'pos_takeaway',
    guestName: 'Meera',
    customerPhone: '+91 98765 11111',
    kitchenNote: 'Pack chutney separately',
    items: [{ itemId: dishShared.id, quantity: 1 }],
  },
  ownerA,
);

const zomatoOrder = await repo.createPosOrPlatformOrder(
  {
    businessId: restaurant.id,
    orderSource: 'zomato',
    platformOrderNumber: 'ZMT-4512',
    guestName: 'Meera',
    customerPhone: '+91 98765 11111',
    packagingPaise: 3000,
    kitchenNote: 'No cutlery',
    items: [{ itemId: dishShared.id, quantity: 2 }],
  },
  ownerA,
);

assert(
  posTakeaway.status === 'approved_for_kitchen' &&
    posTakeaway.tableId === null &&
    posTakeaway.billSessionId === null,
  'Counter POS Takeaway order routes straight to Kitchen KOT with tableId === null',
);

assert(
  zomatoOrder.status === 'approved_for_kitchen' &&
    zomatoOrder.orderSource === 'zomato' &&
    zomatoOrder.platformOrderNumber === 'ZMT-4512' &&
    zomatoOrder.packagingPaise === 3000 &&
    zomatoOrder.tableId === null &&
    zomatoOrder.billSessionId === null,
  'Zomato platform order routes straight to Kitchen KOT without polluting dining table bills',
);

assert(
  (zomatoOrder.customerRepeatVisitCount ?? 0) >= 2,
  `Detects returning customer phone (+91 98765 11111) and sets REPEAT VISIT badge (×${zomatoOrder.customerRepeatVisitCount})`,
);

// ---------------------------------------------------------------------------
// 7. Strict Multi-Tenant Isolation & SQL Guardrail Verification
// ---------------------------------------------------------------------------
console.log('\n7. Multi-Tenant Isolation & SQL Migration 019 Guardrail');

await assertRejects(
  () =>
    repo.createPosOrPlatformOrder(
      {
        businessId: restaurant.id,
        orderSource: 'swiggy',
        platformOrderNumber: 'SWG-999',
        items: [{ itemId: dishShared.id, quantity: 1 }],
      },
      ownerB,
    ),
  'unauthorized',
  'Blocks unauthorized tenant from creating POS or Platform orders',
);

await assertRejects(
  () =>
    repo.completeTableBillCheckout({
      businessId: restaurant.id,
      tableId: tableT1.id,
      paymentMethod: 'cash',
      options: ownerB,
    }),
  'unauthorized',
  'Blocks unauthorized tenant from settling another venue table checkout',
);

// SQL Guardrail check on 019_complete_hospitality_os_upgrade.sql
const sqlText = await Deno.readTextFile(
  'supabase/migrations/019_complete_hospitality_os_upgrade.sql',
);
assert(
  /enable row level security/i.test(sqlText) &&
    /force row level security/i.test(sqlText) &&
    /revoke all on table public\.restaurant_table_messages from public, anon/i.test(
      sqlText,
    ),
  'Migration 019 enforces ENABLE + FORCE RLS and REVOKE ALL FROM public, anon on restaurant_table_messages',
);
assert(
  !/substring\s*\(/i.test(sqlText),
  'Migration 019 obeys SQL Guardrail: zero substring(... from ...) syntax (pg_catalog.substr only)',
);

// ---------------------------------------------------------------------------
// 8. Migration 020 — Custom Floor Plan Studio + Waiter PIN Direct-to-Chef + Assigned Task Alerts
// ---------------------------------------------------------------------------
console.log(
  '\n8. Interactive Floor Plan Designer (Migration 020) & Waiter Mobile Order/Notification Flow',
);

const layoutSaveRes = await repo.saveRestaurantFloorLayout({
  businessId: restaurant.id,
  floorWidthFt: 52,
  floorHeightFt: 34,
  tables: [
    {
      id: tableT1.id,
      tableShape: 'round',
      posX: 42,
      posY: 30,
      widthUnits: 18,
      heightUnits: 18,
      seatCapacity: 6,
    },
    {
      id: roomR101.id,
      tableShape: 'rectangle',
      posX: 70,
      posY: 18,
      widthUnits: 24,
      heightUnits: 16,
      seatCapacity: 2,
    },
  ],
  options: ownerA,
});

assert(
  layoutSaveRes.floorWidthFt === 52 &&
    layoutSaveRes.floorHeightFt === 34 &&
    layoutSaveRes.updatedTablesCount === 2,
  'Saves custom room dimensions (52ft × 34ft) and updated table count atomically',
  layoutSaveRes,
);

const floorAfterLayout = await repo.getRestaurantFloorAndAnalytics({
  businessSlug: restaurant.slug,
  options: ownerA,
});
const movedT1 = floorAfterLayout.tables?.find((t) => t.id === tableT1.id);
assert(
  floorAfterLayout.floorWidthFt === 52 &&
    floorAfterLayout.floorHeightFt === 34 &&
    movedT1?.tableShape === 'round' &&
    movedT1?.posX === 42 &&
    movedT1?.posY === 30 &&
    movedT1?.widthUnits === 18 &&
    movedT1?.heightUnits === 18 &&
    movedT1?.seatCapacity === 6,
  'Persists custom floor plan coordinates, shape (round), size & seat capacity cleanly in floor payload',
  movedT1,
);

await assertRejects(
  () =>
    repo.saveRestaurantFloorLayout({
      businessId: restaurant.id,
      floorWidthFt: 99,
      floorHeightFt: 99,
      tables: [],
      options: ownerB,
    }),
  'unauthorized',
  'Blocks unauthorized tenant from modifying another venue custom floor plan',
);

// Create active Waiter Rahul (WTR-01) with personal PIN
const rahulPinHash = await hashStaffPin(restaurant.slug, '4567');
const waiterRahul = await repo.createRestaurantStaffMember(
  restaurant.id,
  {
    fullName: 'Rahul',
    role: 'waiter',
    staffCode: 'WTR-01',
    pinHash: rahulPinHash,
  },
  ownerA,
);

// Waiter takes a Table 01 order from Waiter Phone and sends DIRECTLY to Chef (KDS)
const waiterDirectOrder = await repo.createPosOrPlatformOrder({
  businessId: restaurant.id,
  orderSource: 'pos_dine_in',
  tableId: tableT1.id,
  guestName: 'Walk-in Table 1 Guest',
  kitchenNote: 'Serve hot with mint chutney',
  items: [{ itemId: dishShared.id, quantity: 2 }],
  staffLabel: `${waiterRahul.fullName} (${waiterRahul.staffCode})`,
  staffPinHash: rahulPinHash,
});

assert(
  waiterDirectOrder.status === 'approved_for_kitchen' &&
    waiterDirectOrder.tableId === tableT1.id &&
    waiterDirectOrder.approvedBy === 'Rahul (WTR-01)',
  'Waiter PIN direct-to-chef order routes straight to Kitchen KDS with canonical approvedBy audit ("Rahul (WTR-01)")',
  waiterDirectOrder,
);

// Manager proactively dispatches a Clean Table task to Rahul (WTR-01)
const dispatchedCall = await repo.createRestaurantTableCall({
  businessSlug: restaurant.slug,
  tableKey: tableT1.tableKey,
  callType: 'clean_table',
});
await repo.updateRestaurantTableCallStatus({
  businessSlug: restaurant.slug,
  callId: dispatchedCall.id,
  status: 'open',
  assignedStaffLabel: 'Rahul (WTR-01)',
  options: ownerA,
});

// Waiter phone polls / receives floor payload authenticated ONLY via Rahul's PIN
const waiterFloorPayload = await repo.getRestaurantFloorAndAnalytics({
  businessSlug: restaurant.slug,
  staffPinHash: rahulPinHash,
});
const rahulAssignedTask = waiterFloorPayload.activeTableCalls.find(
  (c) => c.id === dispatchedCall.id,
);
const waiterOrderOnDashboard = (waiterFloorPayload.tableOrders ?? []).find(
  (o) => o.id === waiterDirectOrder.id,
);

assert(
  rahulAssignedTask?.assignedStaffLabel === 'Rahul (WTR-01)' &&
    rahulAssignedTask?.callType === 'clean_table' &&
    Boolean(waiterOrderOnDashboard),
  'Waiter phone receives assigned Clean Table task & live direct-to-chef order synced with Main Dashboard',
  { rahulAssignedTask, waiterOrderOnDashboard },
);

// SQL Guardrail check on 020_floor_plan_designer_and_waiter_flow.sql
const sql020Text = await Deno.readTextFile(
  'supabase/migrations/020_floor_plan_designer_and_waiter_flow.sql',
);
assert(
  !/substring\s*\(/i.test(sql020Text) &&
    /save_restaurant_floor_layout/i.test(sql020Text) &&
    /is_business_owner/i.test(sql020Text) &&
    /set search_path = pg_catalog, public, pg_temp/i.test(sql020Text),
  'Migration 020 obeys SQL Guardrails: zero substring(, owner check via is_business_owner, hardened search_path',
);

// ---------------------------------------------------------------------------
// 9. Migration 021 Regression: NULL table_id Orders (Swiggy + General Menu QR)
//    Advancing Smoothly on Main Dashboard & Chef Kitchen KDS
// ---------------------------------------------------------------------------
console.log(
  '\n9. NULL table_id Order Progression (Swiggy / General QR) & Migration 021 SQL Guardrails',
);

const generalQrOrder = await repo.submitCustomerTableOrder({
  businessSlug: restaurant.slug,
  tableKey: null,
  guestName: 'General QR Guest',
  kitchenNote: 'Good spice',
  items: [{ itemId: dishShared.id, quantity: 1 }],
});

const approvedGeneralQr = await repo.updateTableOrderStatus(
  {
    businessSlug: restaurant.slug,
    orderId: generalQrOrder.id,
    status: 'approved_for_kitchen',
    staffLabel: 'Owner',
  },
  ownerA,
);
const preparingGeneralQr = await repo.updateTableOrderStatus({
  businessSlug: restaurant.slug,
  orderId: generalQrOrder.id,
  status: 'preparing',
  staffLabel: 'Chef',
  staffPinHash: rahulPinHash,
});
const readyGeneralQr = await repo.updateTableOrderStatus({
  businessSlug: restaurant.slug,
  orderId: generalQrOrder.id,
  status: 'ready',
  staffLabel: 'Chef',
  staffPinHash: rahulPinHash,
});

assert(
  generalQrOrder.tableId === null &&
    approvedGeneralQr.status === 'approved_for_kitchen' &&
    preparingGeneralQr.status === 'preparing' &&
    readyGeneralQr.status === 'ready',
  'General QR order (tableId === null) progresses cleanly through Approve -> Chef Preparing -> Ready',
);

const preparingZomato = await repo.updateTableOrderStatus({
  businessSlug: restaurant.slug,
  orderId: zomatoOrder.id,
  status: 'preparing',
  staffLabel: 'Chef',
  staffPinHash: rahulPinHash,
});
const readyZomato = await repo.updateTableOrderStatus({
  businessSlug: restaurant.slug,
  orderId: zomatoOrder.id,
  status: 'ready',
  staffLabel: 'Chef',
  staffPinHash: rahulPinHash,
});

assert(
  zomatoOrder.tableId === null &&
    preparingZomato.status === 'preparing' &&
    readyZomato.status === 'ready',
  'Swiggy/Zomato off-premise order (tableId === null) advances cleanly on Chef KDS (Preparing -> Ready)',
);

const sql021Text = await Deno.readTextFile(
  'supabase/migrations/021_fix_order_status_null_table_and_kds.sql',
);
assert(
  !/substring\s*\(/i.test(sql021Text) &&
    !/v_table\s+record/i.test(sql021Text) &&
    /v_table_number\s+text/i.test(sql021Text) &&
    /set search_path = pg_catalog, public, pg_temp/i.test(sql021Text),
  'Migration 021 eliminates unassigned v_table record bug (uses nullable scalars) & obeys SQL guardrails',
);

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------
console.log(
  `\n=== Hospitality OS Suite #15 Result: ${passed} passed, ${failed} failed ===\n`,
);
if (failed > 0) {
  Deno.exit(1);
}
