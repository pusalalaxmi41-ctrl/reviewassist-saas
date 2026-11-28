import type { BusinessCategory } from '../types/business';
import type {
  CateringConfig,
  CateringConfigInput,
  CateringDishAndRecipe,
  CateringDishAndRecipeInput,
  CateringDishCategory,
  CateringGroceryRequirement,
  CateringHallAddonItem,
  CateringKitchenChecklist,
  CateringOrder,
  CateringOrderStatus,
  CateringPackage,
  CateringPackageInput,
  CateringPackageSlotRule,
  CateringServiceMode,
  CateringServiceRates,
  CateringVesselDispatchLine,
} from '../types/catering';
import { validateBusinessId } from './aiConfigValidation';

// eslint-disable-next-line no-control-regex
const CONTROL_CHARS_RE = /[\u0000-\u001F\u007F]/g;

function stripControlChars(value: string): string {
  return value.replace(CONTROL_CHARS_RE, '').trim();
}

export const CATERING_OCCASION_PRESETS: readonly string[] = [
  'Wedding / Reception Banquet',
  'Engagement / Sangeet',
  'Birthday / Anniversary Party',
  'Corporate / Hospital Event',
  'Housewarming / Pooja Feast',
  'College / Community Gathering',
];

export const CATERING_DISH_CATEGORY_LABELS: Record<
  CateringDishCategory,
  string
> = {
  starter: 'Starters & Appetizers',
  main_course: 'Main Course Curries',
  rice_bread: 'Biryani / Rice & Breads',
  dessert: 'Desserts & Sweets',
  beverage: 'Welcome Drinks & Beverages',
  live_counter: 'Live Chaat / Dosa Counters',
};

export const DEFAULT_CATERING_HALL_SLOTS: string[] = [
  'Morning (07:00 AM - 12:00 PM)',
  'Afternoon (12:30 PM - 05:00 PM)',
  'Evening (06:00 PM - 11:30 PM)',
];

export const DEFAULT_CATERING_SERVICE_ZONES: string[] = [
  'City Limits',
  'Up to 15 km',
  'Outstation / Venue',
];

export const DEFAULT_CATERING_HALL_ADDONS: CateringHallAddonItem[] = [
  {
    id: 'hall_rent',
    label: 'Banquet Hall Rental',
    pricePaise: 2500000,
    enabled: true,
  },
  {
    id: 'ac_power',
    label: 'Central AC & Generator Backup',
    pricePaise: 800000,
    enabled: true,
  },
  {
    id: 'decor_sound',
    label: 'Stage Decor & Sound / DJ',
    pricePaise: 1500000,
    enabled: true,
  },
  {
    id: 'live_counter',
    label: 'Live Chaat / Dosa Counter',
    pricePaise: 600000,
    enabled: true,
  },
  {
    id: 'cleaning_extra',
    label: 'Housekeeping & Extra Hours',
    pricePaise: 350000,
    enabled: true,
  },
];

export const DEFAULT_CATERING_SERVICE_RATES: CateringServiceRates = {
  waiterPerStaffPaise: 120000,
  chefOnsitePaise: 350000,
  transportPaise: 200000,
  setupTeardownPaise: 250000,
  equipmentRentalPaise: 150000,
};

export const DEFAULT_PACKAGE_SLOT_RULES: CateringPackageSlotRule[] = [
  { category: 'starter', label: 'Starters', maxSelect: 2 },
  { category: 'main_course', label: 'Main Course Curries', maxSelect: 2 },
  { category: 'rice_bread', label: 'Biryani / Rice & Breads', maxSelect: 2 },
  { category: 'dessert', label: 'Desserts & Beverages', maxSelect: 1 },
];

export const DEFAULT_KITCHEN_CHECKLIST: CateringKitchenChecklist = {
  ingredientsProcured: false,
  prepCompleted: false,
  cookingCompleted: false,
  packedWithLabels: false,
  dispatched: false,
};

export function isCateringCategory(
  category?: BusinessCategory | string | null,
): boolean {
  return category === 'catering';
}

export function normalizeCateringPhone(
  rawPhone: string | null | undefined,
): string {
  let digits = stripControlChars(rawPhone ?? '').replace(/[^0-9]/g, '');
  if (digits.length === 12 && digits.startsWith('91')) {
    digits = digits.slice(2);
  } else if (digits.length === 11 && digits.startsWith('0')) {
    digits = digits.slice(1);
  }
  return digits.slice(0, 20);
}

export function getCateringPortalUrl(
  businessSlug: string,
  baseOrigin?: string,
  embed = false,
): string {
  const cleanSlug = stripControlChars(businessSlug).toLowerCase();
  if (!cleanSlug || !/^[a-z0-9-]{3,80}$/.test(cleanSlug)) {
    throw new Error(
      'A valid business slug is required to generate a Catering Portal URL.',
    );
  }
  const host = (
    baseOrigin ??
    (typeof window !== 'undefined'
      ? window.location.origin
      : 'http://localhost:5173')
  ).replace(/\/+$/, '');
  return `${host}/r/${cleanSlug}/catering${embed ? '?embed=1' : ''}`;
}

export function createDefaultCateringConfig(businessId: string): CateringConfig {
  return {
    businessId,
    minHeadcount: 30,
    maxCapacityPerEvent: 1000,
    minAdvanceHours: 24,
    cutoffHoursBeforeEvent: 24,
    serviceZones: [...DEFAULT_CATERING_SERVICE_ZONES],
    blackoutDates: [],
    banquetHallEnabled: true,
    hallName: 'Grand Banquet Hall',
    hallSlots: [...DEFAULT_CATERING_HALL_SLOTS],
    hallAddonsCatalog: DEFAULT_CATERING_HALL_ADDONS.map((a) => ({ ...a })),
    serviceRatesJson: { ...DEFAULT_CATERING_SERVICE_RATES },
    chefStationPin: '4321',
    defaultWastagePercent: 5,
    brandLogoUrl: null,
    primaryAccentHex: '#D4AF37',
    secondarySurfaceHex: '#0F1115',
    whatsappQuoteTemplate:
      'Hello {{customer_name}}, here is your catering & event quote ({{order_code}}) for {{event_date}} ({{total_plates}} guests). Total: ₹{{total_amount}}. Confirm advance to lock your date!',
    updatedAt: new Date().toISOString(),
  };
}

export function formatCateringRupees(paise: number): string {
  const rupees = Math.round(paise) / 100;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: rupees % 1 === 0 ? 0 : 2,
  }).format(rupees);
}

/**
 * Deterministic Catering & Banquet Pricing + 3-Stage Milestone Split Engine
 * Stage 1 = 30% Booking Advance
 * Stage 2 = 50% Pre-Event Release
 * Stage 3 = Remainder (20%) Final Balance (guaranteed Stage1 + Stage2 + Stage3 === totalAmountPaise)
 */
export function calculateCateringPricingBreakdown(params: {
  vegPlates: number;
  vegRatePaise: number;
  nonVegPlates: number;
  nonVegRatePaise: number;
  extraPlatesAdded?: number;
  bulkItemsTotalPaise: number;
  hallAddonsTotalPaise: number;
  serviceMode: CateringServiceMode;
  serviceRates: CateringServiceRates;
  waitersRequested?: number;
  onsiteChefRequested?: boolean;
  gstRatePercent?: number;
}): {
  totalPlates: number;
  platesFoodPaise: number;
  extraPlatesFoodPaise: number;
  serviceStaffChargesPaise: number;
  subtotalPaise: number;
  gstPaise: number;
  totalAmountPaise: number;
  perPlateAveragePaise: number;
  stage1AdvancePaise: number;
  stage2PreeventPaise: number;
  stage3BalancePaise: number;
} {
  const vegPlates = Math.max(0, Math.floor(params.vegPlates || 0));
  const nonVegPlates = Math.max(0, Math.floor(params.nonVegPlates || 0));
  const extraPlates = Math.max(0, Math.floor(params.extraPlatesAdded || 0));
  const basePlates = vegPlates + nonVegPlates;
  const totalPlates = basePlates + extraPlates;

  const vegFood = vegPlates * Math.max(0, Math.round(params.vegRatePaise || 0));
  const nonVegFood =
    nonVegPlates * Math.max(0, Math.round(params.nonVegRatePaise || 0));
  const platesFoodPaise = vegFood + nonVegFood;

  // Extra plates inherit blended plate rate (or vegRatePaise if all veg, or nonVegRatePaise if all non-veg)
  const effectiveExtraRate =
    basePlates > 0
      ? Math.round(platesFoodPaise / basePlates)
      : Math.max(params.vegRatePaise || 0, params.nonVegRatePaise || 0);
  const extraPlatesFoodPaise = extraPlates * effectiveExtraRate;

  let serviceStaffChargesPaise = 0;
  const rates = params.serviceRates;
  if (params.serviceMode === 'drop_off') {
    serviceStaffChargesPaise += Math.max(0, rates.transportPaise || 0);
  } else if (params.serviceMode === 'full_service') {
    const waiters =
      params.waitersRequested !== undefined
        ? Math.max(0, Math.floor(params.waitersRequested))
        : Math.max(2, Math.ceil(Math.max(1, totalPlates) / 35));
    serviceStaffChargesPaise +=
      Math.max(0, rates.transportPaise || 0) +
      Math.max(0, rates.setupTeardownPaise || 0) +
      Math.max(0, rates.equipmentRentalPaise || 0) +
      waiters * Math.max(0, rates.waiterPerStaffPaise || 0) +
      (params.onsiteChefRequested
        ? Math.max(0, rates.chefOnsitePaise || 0)
        : 0);
  }

  const subtotalPaise =
    platesFoodPaise +
    extraPlatesFoodPaise +
    Math.max(0, Math.round(params.bulkItemsTotalPaise || 0)) +
    Math.max(0, Math.round(params.hallAddonsTotalPaise || 0)) +
    serviceStaffChargesPaise;

  const gstPercent =
    params.gstRatePercent !== undefined
      ? Math.max(0, Math.min(28, params.gstRatePercent))
      : 5;
  const gstPaise = Math.round((subtotalPaise * gstPercent) / 100);
  const totalAmountPaise = subtotalPaise + gstPaise;

  const stage1AdvancePaise = Math.round(totalAmountPaise * 0.3);
  const stage2PreeventPaise = Math.round(totalAmountPaise * 0.5);
  const stage3BalancePaise = Math.max(
    0,
    totalAmountPaise - stage1AdvancePaise - stage2PreeventPaise,
  );

  const perPlateAveragePaise =
    totalPlates > 0 ? Math.round(totalAmountPaise / totalPlates) : 0;

  return {
    totalPlates,
    platesFoodPaise,
    extraPlatesFoodPaise,
    serviceStaffChargesPaise,
    subtotalPaise,
    gstPaise,
    totalAmountPaise,
    perPlateAveragePaise,
    stage1AdvancePaise,
    stage2PreeventPaise,
    stage3BalancePaise,
  };
}

/**
 * Scales per-100-plate recipes across one or multiple active CateringOrders:
 * Veg dishes scale by (vegPlates + vegShareOfExtra)
 * Non-Veg dishes scale by (nonVegPlates + nonVegShareOfExtra)
 * Shared dishes (starters/rice/desserts when mixed) scale by exact plate applicability:
 *   - `dietType === 'non_veg'`: scales by nonVegPlates (+ proportional extra plates if nonVegPlates > 0, else totalPlates)
 *   - `dietType === 'veg'`: if order has ONLY veg dishes in that category or no non-veg equivalent, scales by totalPlates (`vegPlates + nonVegPlates + extraPlatesAdded`) so all 250 guests eat rice/bread/dessert, while pure veg main/starter on a mixed buffet scales cleanly!
 * Wait — let's match the exact canonical formula from the spec:
 * `(veg_plates + non_veg_plates + extra_plates_added) / 100.0 * qtyPer100 * (1 + wastage_percent / 100)`!
 */
export function computeCateringGroceryShoppingList(params: {
  orders: ReadonlyArray<
    Pick<
      CateringOrder,
      | 'vegPlates'
      | 'nonVegPlates'
      | 'extraPlatesAdded'
      | 'selectedPackageDishes'
      | 'bulkAlacarteItems'
      | 'orderStatus'
    >
  >;
  dishesCatalog: ReadonlyArray<CateringDishAndRecipe>;
  wastagePercent: number;
}): CateringGroceryRequirement[] {
  const safeWastage = Math.max(0, Math.min(30, Number(params.wastagePercent) || 0));
  const dishMap = new Map<string, CateringDishAndRecipe>(
    params.dishesCatalog.map((d) => [d.id, d]),
  );

  const buckets = new Map<
    string,
    {
      ingredientName: string;
      unit: string;
      baseQty: number;
      sourceDishes: Set<string>;
    }
  >();

  for (const ord of params.orders) {
    if (ord.orderStatus === 'cancelled') continue;
    const totalPlates =
      Math.max(0, ord.vegPlates || 0) +
      Math.max(0, ord.nonVegPlates || 0) +
      Math.max(0, ord.extraPlatesAdded || 0);

    if (totalPlates > 0) {
      for (const sel of ord.selectedPackageDishes) {
        const dish = dishMap.get(sel.dishId);
        if (!dish || !dish.ingredientsPer100Plates?.length) continue;
        const scaleFactor = totalPlates / 100.0;
        for (const ing of dish.ingredientsPer100Plates) {
          const cleanName = stripControlChars(ing.ingredientName);
          const cleanUnit = stripControlChars(ing.unit || 'kg').toLowerCase();
          if (!cleanName || !(ing.qtyPer100 > 0)) continue;
          const key = `${cleanName.toLowerCase()}__${cleanUnit}`;
          const existing = buckets.get(key) ?? {
            ingredientName: cleanName,
            unit: cleanUnit,
            baseQty: 0,
            sourceDishes: new Set<string>(),
          };
          existing.baseQty += scaleFactor * Number(ing.qtyPer100);
          existing.sourceDishes.add(dish.dishName);
          buckets.set(key, existing);
        }
      }
    }

    // Also scale bulk à la carte trays (1 kg/tray/litre treats qty * 10 plate-equivalents if recipe exists)
    for (const bulk of ord.bulkAlacarteItems) {
      const dish = dishMap.get(bulk.dishId);
      if (!dish || !dish.ingredientsPer100Plates?.length || !(bulk.quantity > 0)) {
        continue;
      }
      const bulkScaleFactor = (bulk.quantity * 10) / 100.0;
      for (const ing of dish.ingredientsPer100Plates) {
        const cleanName = stripControlChars(ing.ingredientName);
        const cleanUnit = stripControlChars(ing.unit || 'kg').toLowerCase();
        if (!cleanName || !(ing.qtyPer100 > 0)) continue;
        const key = `${cleanName.toLowerCase()}__${cleanUnit}`;
        const existing = buckets.get(key) ?? {
          ingredientName: cleanName,
          unit: cleanUnit,
          baseQty: 0,
          sourceDishes: new Set<string>(),
        };
        existing.baseQty += bulkScaleFactor * Number(ing.qtyPer100);
        existing.sourceDishes.add(`${dish.dishName} (Bulk)`);
        buckets.set(key, existing);
      }
    }
  }

  return Array.from(buckets.values())
    .map((b) => {
      const baseQty = Math.round(b.baseQty * 100) / 100;
      const totalQtyWithWastage =
        Math.round(b.baseQty * (1 + safeWastage / 100) * 100) / 100;
      return {
        ingredientName: b.ingredientName,
        unit: b.unit,
        baseQty,
        wastagePercent: safeWastage,
        totalQtyWithWastage,
        sourceDishes: Array.from(b.sourceDishes),
      };
    })
    .sort((a, b) => a.ingredientName.localeCompare(b.ingredientName));
}

export function buildCateringWhatsAppQuoteLink(params: {
  phone: string;
  template: string;
  customerName: string;
  orderCode: string;
  eventDate: string;
  totalPlates: number;
  totalAmountPaise: number;
  advanceAmountPaise: number;
  portalUrl?: string;
}): { message: string; whatsappUrl: string } {
  const totalFormatted = (Math.round(params.totalAmountPaise) / 100).toLocaleString(
    'en-IN',
  );
  const advanceFormatted = (
    Math.round(params.advanceAmountPaise) / 100
  ).toLocaleString('en-IN');

  let msg =
    stripControlChars(params.template) ||
    'Hello {{customer_name}}, here is your catering & event quote ({{order_code}}) for {{event_date}} ({{total_plates}} guests). Total: ₹{{total_amount}}. Confirm advance to lock your date!';

  msg = msg
    .replace(/\{\{customer_name\}\}/g, params.customerName)
    .replace(/\{\{order_code\}\}/g, params.orderCode)
    .replace(/\{\{event_date\}\}/g, params.eventDate)
    .replace(/\{\{total_plates\}\}/g, String(params.totalPlates))
    .replace(/\{\{total_amount\}\}/g, totalFormatted)
    .replace(/\{\{advance_amount\}\}/g, advanceFormatted);

  if (params.portalUrl) {
    msg = `${msg}\nQuote Portal: ${params.portalUrl}`;
  }

  const digits = normalizeCateringPhone(params.phone);
  const waPhone = digits.length === 10 ? `91${digits}` : digits;
  return {
    message: msg,
    whatsappUrl: `https://wa.me/${waPhone}?text=${encodeURIComponent(msg)}`,
  };
}

export function checkVesselsAllReturned(
  vessels: ReadonlyArray<CateringVesselDispatchLine>,
): boolean {
  if (!vessels.length) return true;
  return vessels.every(
    (v) => Math.max(0, v.qtyReturned || 0) >= Math.max(0, v.qtySent || 0),
  );
}

export function validateCateringConfigInput(
  businessId: string,
  input: CateringConfigInput,
): CateringConfig {
  const idErr = validateBusinessId(businessId);
  if (idErr) throw new Error(idErr);

  const minHeadcount = Math.max(1, Math.round(Number(input.minHeadcount) || 30));
  const maxCapacityPerEvent = Math.max(
    minHeadcount,
    Math.round(Number(input.maxCapacityPerEvent) || 1000),
  );
  const minAdvanceHours = Math.max(
    1,
    Math.round(Number(input.minAdvanceHours) || 24),
  );
  const cutoffHoursBeforeEvent = Math.max(
    0,
    Math.round(Number(input.cutoffHoursBeforeEvent) || 24),
  );
  const defaultWastagePercent = Math.max(
    0,
    Math.min(30, Math.round((Number(input.defaultWastagePercent) || 0) * 100) / 100),
  );

  const pinDigits = stripControlChars(input.chefStationPin ?? '4321').replace(
    /[^0-9]/g,
    '',
  );
  if (pinDigits.length < 4 || pinDigits.length > 6) {
    throw new Error('Chef Station PIN must be 4 to 6 digits (e.g. 4321).');
  }

  const primaryHex = /^#[0-9A-Fa-f]{6}$/.test(
    stripControlChars(input.primaryAccentHex),
  )
    ? stripControlChars(input.primaryAccentHex).toUpperCase()
    : '#D4AF37';
  const secondaryHex = /^#[0-9A-Fa-f]{6}$/.test(
    stripControlChars(input.secondarySurfaceHex),
  )
    ? stripControlChars(input.secondarySurfaceHex).toUpperCase()
    : '#0F1115';

  const cleanZones = (input.serviceZones ?? [])
    .map((z) => stripControlChars(String(z)).slice(0, 60))
    .filter(Boolean);
  const cleanBlackouts = Array.from(
    new Set(
      (input.blackoutDates ?? [])
        .map((d) => stripControlChars(String(d)))
        .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)),
    ),
  ).sort();
  const cleanSlots = (input.hallSlots ?? [])
    .map((s) => stripControlChars(String(s)).slice(0, 80))
    .filter(Boolean);

  return {
    businessId: businessId.trim(),
    minHeadcount,
    maxCapacityPerEvent,
    minAdvanceHours,
    cutoffHoursBeforeEvent,
    serviceZones:
      cleanZones.length > 0 ? cleanZones : [...DEFAULT_CATERING_SERVICE_ZONES],
    blackoutDates: cleanBlackouts,
    banquetHallEnabled: Boolean(input.banquetHallEnabled),
    hallName:
      stripControlChars(input.hallName || 'Grand Banquet Hall').slice(0, 80) ||
      'Grand Banquet Hall',
    hallSlots:
      cleanSlots.length > 0 ? cleanSlots : [...DEFAULT_CATERING_HALL_SLOTS],
    hallAddonsCatalog: (input.hallAddonsCatalog ?? DEFAULT_CATERING_HALL_ADDONS).map(
      (a, idx) => ({
        id: stripControlChars(a.id || `addon_${idx + 1}`).slice(0, 40),
        label: stripControlChars(a.label || 'Add-On').slice(0, 80),
        pricePaise: Math.max(0, Math.round(Number(a.pricePaise) || 0)),
        enabled: Boolean(a.enabled),
      }),
    ),
    serviceRatesJson: {
      waiterPerStaffPaise: Math.max(
        0,
        Math.round(Number(input.serviceRatesJson?.waiterPerStaffPaise) || 0),
      ),
      chefOnsitePaise: Math.max(
        0,
        Math.round(Number(input.serviceRatesJson?.chefOnsitePaise) || 0),
      ),
      transportPaise: Math.max(
        0,
        Math.round(Number(input.serviceRatesJson?.transportPaise) || 0),
      ),
      setupTeardownPaise: Math.max(
        0,
        Math.round(Number(input.serviceRatesJson?.setupTeardownPaise) || 0),
      ),
      equipmentRentalPaise: Math.max(
        0,
        Math.round(Number(input.serviceRatesJson?.equipmentRentalPaise) || 0),
      ),
    },
    chefStationPin: pinDigits,
    defaultWastagePercent,
    brandLogoUrl: input.brandLogoUrl
      ? stripControlChars(input.brandLogoUrl).slice(0, 650000)
      : null,
    primaryAccentHex: primaryHex,
    secondarySurfaceHex: secondaryHex,
    whatsappQuoteTemplate:
      stripControlChars(input.whatsappQuoteTemplate).slice(0, 500) ||
      'Hello {{customer_name}}, here is your catering & event quote ({{order_code}}) for {{event_date}} ({{total_plates}} guests). Total: ₹{{total_amount}}. Confirm advance to lock your date!',
    updatedAt: new Date().toISOString(),
  };
}

export function validateCateringPackageInput(
  businessId: string,
  input: CateringPackageInput,
): Omit<CateringPackage, 'id' | 'createdAt'> & { id?: string } {
  const idErr = validateBusinessId(businessId);
  if (idErr) throw new Error(idErr);
  const packageName = stripControlChars(input.packageName ?? '').slice(0, 90);
  if (packageName.length < 2) {
    throw new Error('Package name must be at least 2 characters.');
  }
  return {
    id: input.id ? stripControlChars(input.id) : undefined,
    businessId: businessId.trim(),
    packageName,
    tierBadge: stripControlChars(input.tierBadge || 'Silver').slice(0, 32) || 'Silver',
    mealSession: input.mealSession || 'all_day',
    vegPricePaise: Math.max(0, Math.round(Number(input.vegPricePaise) || 0)),
    nonVegPricePaise: Math.max(0, Math.round(Number(input.nonVegPricePaise) || 0)),
    slotRules:
      input.slotRules && input.slotRules.length > 0
        ? input.slotRules.map((r) => ({
            category: r.category,
            label: stripControlChars(r.label || r.category).slice(0, 60),
            maxSelect: Math.max(1, Math.min(12, Math.round(Number(r.maxSelect) || 2))),
          }))
        : DEFAULT_PACKAGE_SLOT_RULES.map((r) => ({ ...r })),
    description: input.description
      ? stripControlChars(input.description).slice(0, 240)
      : null,
    isActive: input.isActive !== false,
  };
}

export function validateCateringDishInput(
  businessId: string,
  input: CateringDishAndRecipeInput,
): Omit<CateringDishAndRecipe, 'id' | 'createdAt'> & { id?: string } {
  const idErr = validateBusinessId(businessId);
  if (idErr) throw new Error(idErr);
  const dishName = stripControlChars(input.dishName ?? '').slice(0, 100);
  if (dishName.length < 2) {
    throw new Error('Dish name must be at least 2 characters.');
  }
  return {
    id: input.id ? stripControlChars(input.id) : undefined,
    businessId: businessId.trim(),
    dishName,
    category: input.category || 'main_course',
    dietType: input.dietType === 'non_veg' ? 'non_veg' : 'veg',
    availableInPackages: Boolean(input.availableInPackages),
    availableBulkAlacarte: Boolean(input.availableBulkAlacarte),
    bulkUnit: input.bulkUnit || 'kg',
    bulkUnitPricePaise: Math.max(
      0,
      Math.round(Number(input.bulkUnitPricePaise) || 0),
    ),
    ingredientsPer100Plates: (input.ingredientsPer100Plates ?? [])
      .map((i) => ({
        ingredientName: stripControlChars(i.ingredientName ?? '').slice(0, 80),
        unit: stripControlChars(i.unit || 'kg').slice(0, 20) || 'kg',
        qtyPer100: Math.max(0, Math.round((Number(i.qtyPer100) || 0) * 100) / 100),
      }))
      .filter((i) => i.ingredientName.length >= 1 && i.qtyPer100 > 0),
    isActive: input.isActive !== false,
  };
}

export const ALLOWED_CATERING_ORDER_STATUSES: readonly CateringOrderStatus[] = [
  'quote_pending',
  'advance_confirmed',
  'prep_started',
  'cooking',
  'dispatched',
  'completed',
  'cancelled',
];
