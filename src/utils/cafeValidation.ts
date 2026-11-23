import type { BusinessCategory } from '../types/business';
import type {
  CafeConfig,
  CafeConfigInput,
  CafeInventoryActionType,
  CafeInventoryCategory,
  CafeInventoryItemInput,
  CafeInventoryUnit,
} from '../types/cafe';
import { validateBusinessId } from './aiConfigValidation';

export const ALLOWED_CAFE_INVENTORY_CATEGORIES: readonly CafeInventoryCategory[] =
  ['beans', 'milk_dairy', 'syrups_flavors', 'cups_packaging', 'bakery_food', 'other'];

export const ALLOWED_CAFE_INVENTORY_UNITS: readonly CafeInventoryUnit[] = [
  'kg',
  'g',
  'liters',
  'ml',
  'bottles',
  'pcs',
  'packs',
];

export const CAFE_INVENTORY_CATEGORY_META: Record<
  CafeInventoryCategory,
  { label: string; emoji: string; badgeClass: string }
> = {
  beans: {
    label: 'Coffee Beans',
    emoji: '☕',
    badgeClass: 'bg-amber-100 text-amber-950 border-amber-200',
  },
  milk_dairy: {
    label: 'Milk & Dairy',
    emoji: '🥛',
    badgeClass: 'bg-sky-100 text-sky-900 border-sky-200',
  },
  syrups_flavors: {
    label: 'Syrups & Flavors',
    emoji: '🍯',
    badgeClass: 'bg-orange-100 text-orange-950 border-orange-200',
  },
  cups_packaging: {
    label: 'Cups & Lids',
    emoji: '🥤',
    badgeClass: 'bg-indigo-100 text-indigo-950 border-indigo-200',
  },
  bakery_food: {
    label: 'Bakery & Food',
    emoji: '🥐',
    badgeClass: 'bg-rose-100 text-rose-900 border-rose-200',
  },
  other: {
    label: 'Other Stock',
    emoji: '📦',
    badgeClass: 'bg-slate-100 text-slate-800 border-slate-200',
  },
};

export const CAFE_INVENTORY_STARTER_PACK: ReadonlyArray<CafeInventoryItemInput> =
  [
    {
      itemName: 'Arabica Espresso Beans',
      category: 'beans',
      unit: 'kg',
      currentStock: 6,
      lowStockThreshold: 2,
      unitCostPaise: 95000,
      supplierNote: 'Medium-dark roast house blend',
    },
    {
      itemName: 'Full Cream Milk',
      category: 'milk_dairy',
      unit: 'liters',
      currentStock: 18,
      lowStockThreshold: 6,
      unitCostPaise: 6800,
      supplierNote: 'Daily 6 AM dairy delivery',
    },
    {
      itemName: 'Barista Oat Milk',
      category: 'milk_dairy',
      unit: 'liters',
      currentStock: 2,
      lowStockThreshold: 3,
      unitCostPaise: 24000,
      supplierNote: 'Plant-based barista pack',
    },
    {
      itemName: 'Madagascar Vanilla Syrup',
      category: 'syrups_flavors',
      unit: 'bottles',
      currentStock: 4,
      lowStockThreshold: 2,
      unitCostPaise: 65000,
      supplierNote: '750ml Monin / Torani bottle',
    },
    {
      itemName: '12oz Paper Cups & Lids',
      category: 'cups_packaging',
      unit: 'pcs',
      currentStock: 220,
      lowStockThreshold: 80,
      unitCostPaise: 600,
      supplierNote: 'Double-wall kraft cup + sip lid',
    },
    {
      itemName: 'Butter Croissants',
      category: 'bakery_food',
      unit: 'pcs',
      currentStock: 16,
      lowStockThreshold: 6,
      unitCostPaise: 7500,
      supplierNote: 'Fresh morning bakery batch',
    },
  ];

export const CAFE_STARTER_MENU_ITEMS: ReadonlyArray<{
  categoryName: string;
  name: string;
  description: string;
  pricePaise: number;
  isFeatured?: boolean;
}> = [
  {
    categoryName: 'Espresso & Hot Brews',
    name: 'Classic Cappuccino',
    description: 'Double-shot Arabica espresso with silky velvety microfoam',
    pricePaise: 18000,
    isFeatured: true,
  },
  {
    categoryName: 'Espresso & Hot Brews',
    name: 'Hazelnut Cafe Latte',
    description: 'Smooth espresso folded with steamed milk & roasted hazelnut',
    pricePaise: 21000,
  },
  {
    categoryName: 'Iced & Cold Coffee',
    name: 'Signature Cold Coffee',
    description: 'Thick chilled espresso blend topped with espresso dust',
    pricePaise: 19500,
    isFeatured: true,
  },
  {
    categoryName: 'Iced & Cold Coffee',
    name: 'Iced Vietnamese Shakerato',
    description: 'Dark roast espresso shaken over ice with condensed milk',
    pricePaise: 22500,
  },
  {
    categoryName: 'Bakery & Bites',
    name: 'Almond Butter Croissant',
    description: 'Flaky French-style laminated pastry baked fresh daily',
    pricePaise: 16500,
  },
];

export const MONTH_OPTIONS = [
  { value: 1, label: 'January' },
  { value: 2, label: 'February' },
  { value: 3, label: 'March' },
  { value: 4, label: 'April' },
  { value: 5, label: 'May' },
  { value: 6, label: 'June' },
  { value: 7, label: 'July' },
  { value: 8, label: 'August' },
  { value: 9, label: 'September' },
  { value: 10, label: 'October' },
  { value: 11, label: 'November' },
  { value: 12, label: 'December' },
] as const;

function stripControlChars(raw: string): string {
  return Array.from(raw)
    .filter((ch) => {
      const code = ch.charCodeAt(0);
      return code >= 32 && code !== 127;
    })
    .join('')
    .trim();
}

export function isCafeCategory(
  category?: BusinessCategory | string | null,
): boolean {
  return category === 'cafe';
}

export function normalizeCafePhone(rawPhone: string): string {
  let digits = stripControlChars(rawPhone).replace(/[^0-9]/g, '');
  if (digits.length === 12 && digits.startsWith('91')) {
    digits = digits.slice(2);
  } else if (digits.length === 11 && digits.startsWith('0')) {
    digits = digits.slice(1);
  }
  return digits.slice(0, 20);
}

export function getCafeHubUrl(
  businessSlug: string,
  baseOrigin?: string,
): string {
  const cleanSlug = stripControlChars(businessSlug).toLowerCase();
  if (!cleanSlug || !/^[a-z0-9-]{3,80}$/.test(cleanSlug)) {
    throw new Error('A valid business slug is required for the Cafe Hub URL.');
  }
  const host = (
    baseOrigin ??
    (typeof window !== 'undefined'
      ? window.location.origin
      : 'http://localhost:5173')
  ).replace(/\/+$/, '');
  return `${host}/r/${cleanSlug}/cafe`;
}

/** 30-second UTC epoch bucket matching PostgreSQL floor(extract(epoch from clock_timestamp()) / 30). */
export function getCafeRotatingTimeBucket(nowMs: number = Date.now()): number {
  return Math.floor(nowMs / 30000);
}

export function getCafeRotatingSecondsRemaining(
  nowMs: number = Date.now(),
): number {
  const elapsedSec = Math.floor((nowMs % 30000) / 1000);
  return Math.max(1, 30 - elapsedSec);
}

/**
 * Computes the first 16 lowercase hex chars of SHA-256(`${secret}:${timeBucket}`),
 * matching PostgreSQL `pg_catalog.substr(encode(extensions.digest(secret || ':' || bucket, 'sha256'), 'hex'), 1, 16)`.
 */
export async function computeCafeCounterTokenSig(
  secret: string,
  timeBucket: number,
): Promise<string> {
  const payload = `${secret}:${timeBucket}`;
  const bytes = new TextEncoder().encode(payload);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  const hex = Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return hex.slice(0, 16);
}

export async function buildCafeRotatingCounterQrUrl(
  businessSlug: string,
  secret: string,
  nowMs: number = Date.now(),
  baseOrigin?: string,
): Promise<{ url: string; timeBucket: number; tokenSig: string }> {
  const timeBucket = getCafeRotatingTimeBucket(nowMs);
  const tokenSig = await computeCafeCounterTokenSig(secret, timeBucket);
  const baseUrl = getCafeHubUrl(businessSlug, baseOrigin);
  return {
    url: `${baseUrl}?tb=${timeBucket}&sig=${tokenSig}`,
    timeBucket,
    tokenSig,
  };
}

export function isBirthdayTodayForPass(params: {
  birthMonth: number | null | undefined;
  birthDay: number | null | undefined;
  lastBirthdayRedeemedYear: number | null | undefined;
  birthdayEnabled?: boolean;
  now?: Date;
}): boolean {
  if (params.birthdayEnabled === false) return false;
  if (!params.birthMonth || !params.birthDay) return false;
  const now = params.now ?? new Date();
  const month = now.getMonth() + 1;
  const day = now.getDate();
  const year = now.getFullYear();
  return (
    params.birthMonth === month &&
    params.birthDay === day &&
    (params.lastBirthdayRedeemedYear ?? 0) < year
  );
}

export function createDefaultCafeConfig(businessId: string): CafeConfig {
  const randomHex = Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return {
    businessId: businessId.trim(),
    stampsRequired: 8,
    rewardDrinkName: 'Any Regular Cappuccino / Cold Coffee',
    birthdayFreeCoffeeEnabled: true,
    birthdayDrinkName: 'Free Birthday Signature Coffee',
    counterQrSecret: randomHex,
    upiId: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export function validateCafeConfigInput(
  businessId: unknown,
  input: unknown,
): { ok: true; value: CafeConfigInput } | { ok: false; error: string } {
  const idErr = validateBusinessId(businessId);
  if (idErr) return { ok: false, error: idErr };
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { ok: false, error: 'Cafe configuration must be an object.' };
  }
  const rec = input as Record<string, unknown>;
  const stampsRequired =
    typeof rec.stampsRequired === 'number' &&
    Number.isInteger(rec.stampsRequired)
      ? rec.stampsRequired
      : 8;
  if (stampsRequired < 3 || stampsRequired > 20) {
    return { ok: false, error: 'Stamps required must be between 3 and 20.' };
  }
  const rewardDrinkName = stripControlChars(
    String(rec.rewardDrinkName ?? ''),
  ).slice(0, 120);
  if (rewardDrinkName.length < 2) {
    return { ok: false, error: 'Reward drink name is required.' };
  }
  const birthdayDrinkName =
    stripControlChars(String(rec.birthdayDrinkName ?? '')).slice(0, 120) ||
    'Free Birthday Signature Coffee';
  const upiRaw = stripControlChars(String(rec.upiId ?? '')).slice(0, 120);

  return {
    ok: true,
    value: {
      stampsRequired,
      rewardDrinkName,
      birthdayFreeCoffeeEnabled: Boolean(rec.birthdayFreeCoffeeEnabled ?? true),
      birthdayDrinkName,
      upiId: upiRaw || null,
    },
  };
}

export function validateCafeInventoryItemInput(
  businessId: unknown,
  input: unknown,
): { ok: true; value: CafeInventoryItemInput } | { ok: false; error: string } {
  const idErr = validateBusinessId(businessId);
  if (idErr) return { ok: false, error: idErr };
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { ok: false, error: 'Inventory item must be an object.' };
  }
  const rec = input as Record<string, unknown>;
  const itemName = stripControlChars(String(rec.itemName ?? '')).slice(0, 100);
  if (itemName.length < 2) {
    return {
      ok: false,
      error: 'Ingredient name must be at least 2 characters.',
    };
  }
  const category = ALLOWED_CAFE_INVENTORY_CATEGORIES.includes(
    rec.category as CafeInventoryCategory,
  )
    ? (rec.category as CafeInventoryCategory)
    : 'other';
  const unit = ALLOWED_CAFE_INVENTORY_UNITS.includes(
    rec.unit as CafeInventoryUnit,
  )
    ? (rec.unit as CafeInventoryUnit)
    : 'pcs';
  const currentStock = Number(rec.currentStock ?? 0);
  const lowStockThreshold = Number(rec.lowStockThreshold ?? 0);
  const unitCostPaise = Math.round(Number(rec.unitCostPaise ?? 0));

  if (!Number.isFinite(currentStock) || currentStock < 0) {
    return { ok: false, error: 'Current stock cannot be negative.' };
  }
  if (!Number.isFinite(lowStockThreshold) || lowStockThreshold < 0) {
    return { ok: false, error: 'Low-stock threshold cannot be negative.' };
  }
  if (!Number.isFinite(unitCostPaise) || unitCostPaise < 0) {
    return { ok: false, error: 'Unit cost cannot be negative.' };
  }
  const supplierNote = stripControlChars(String(rec.supplierNote ?? '')).slice(
    0,
    180,
  );

  return {
    ok: true,
    value: {
      itemName,
      category,
      unit,
      currentStock: Math.round(currentStock * 100) / 100,
      lowStockThreshold: Math.round(lowStockThreshold * 100) / 100,
      unitCostPaise,
      supplierNote: supplierNote || null,
    },
  };
}

export function validateCafeInventoryAction(
  action: unknown,
  quantity: unknown,
): { ok: true; action: CafeInventoryActionType; quantity: number } | { ok: false; error: string } {
  if (action !== 'restock' && action !== 'usage' && action !== 'wastage') {
    return { ok: false, error: 'Invalid stock action type.' };
  }
  const qty = Number(quantity);
  if (!Number.isFinite(qty) || qty <= 0) {
    return { ok: false, error: 'Quantity must be greater than zero.' };
  }
  return {
    ok: true,
    action,
    quantity: Math.round(qty * 100) / 100,
  };
}

export function getCafeMorningGreetingBanner(now: Date = new Date()): {
  title: string;
  subtitle: string;
} {
  const hr = now.getHours();
  if (hr < 12) {
    return {
      title: 'Morning Brew Pass Ready',
      subtitle:
        'Morning rush? Show your pass at the counter for a 1-tap stamp & priority pickup.',
    };
  }
  if (hr < 17) {
    return {
      title: 'Afternoon Pick-Me-Up',
      subtitle:
        'Scan the live counter QR to collect your stamp and unlock your next free coffee.',
    };
  }
  return {
    title: 'Evening Coffee & Bites',
    subtitle:
      'Skip the wait — order right at the counter or scan to stamp your digital coffee card.',
  };
}
