import {
  RESTAURANT_LIMITS,
  type DietaryTag,
  type MenuPresetKey,
  type MenuThemeTemplate,
  type RestaurantCurrencyCode,
  type RestaurantCustomerCheckInInput,
  type RestaurantGameCategory,
  type RestaurantGameClientChallenge,
  type RestaurantGameConfig,
  type RestaurantGameConfigInput,
  type RestaurantGameSlug,
  type RestaurantGameSubmissionInput,
  type RestaurantLoyaltyRules,
  type RestaurantLoyaltyRulesInput,
  type RestaurantMenuCategoryInput,
  type RestaurantMenuItemInput,
  type RestaurantProfile,
  type RestaurantProfileInput,
  type RestaurantRewardInput,
  type RestaurantSuggestionInput,
  type RestaurantTableInput,
  type RestaurantTableOrderStatus,
  type RestaurantTriviaQuestion,
} from '../types/restaurant';
import { validateBusinessId } from './aiConfigValidation';

export const ALLOWED_CURRENCIES: ReadonlyArray<RestaurantCurrencyCode> = [
  'INR',
  'USD',
  'EUR',
  'GBP',
  'AED',
  'SGD',
];

export const CURRENCY_METADATA: Record<
  RestaurantCurrencyCode,
  { symbol: string; label: string; locale: string }
> = {
  INR: { symbol: '₹', label: 'INR (₹)', locale: 'en-IN' },
  USD: { symbol: '$', label: 'USD ($)', locale: 'en-US' },
  EUR: { symbol: '€', label: 'EUR (€)', locale: 'de-DE' },
  GBP: { symbol: '£', label: 'GBP (£)', locale: 'en-GB' },
  AED: { symbol: 'AED ', label: 'AED', locale: 'en-AE' },
  SGD: { symbol: 'S$', label: 'SGD (S$)', locale: 'en-SG' },
};

export const ALLOWED_DIETARY_TAGS: ReadonlyArray<DietaryTag> = [
  'veg',
  'non_veg',
  'egg',
  'vegan',
  'none',
];

export const ALLOWED_MENU_THEME_TEMPLATES: ReadonlyArray<MenuThemeTemplate> = [
  'default',
  'masala',
  'prakriti',
  'bistro',
  'samudra',
  'sizzler',
];

export const ALLOWED_MENU_PRESET_KEYS: ReadonlyArray<MenuPresetKey> = [
  'masala_indian',
  'prakriti_organic',
  'bistro_modern',
  'samudra_coastal',
  'sizzler_diner',
];

export const ALLOWED_TABLE_ORDER_STATUSES: ReadonlyArray<RestaurantTableOrderStatus> = [
  'pending_approval',
  'approved_for_kitchen',
  'preparing',
  'served',
  'cancelled',
];

export const DIETARY_TAG_METADATA: Record<
  DietaryTag,
  { label: string; shortLabel: string; dotColor: string; borderColor: string; bgColor: string; textColor: string }
> = {
  veg: {
    label: 'Pure Veg',
    shortLabel: 'Veg',
    dotColor: '#16A34A',
    borderColor: '#16A34A',
    bgColor: '#F0FDF4',
    textColor: '#166534',
  },
  non_veg: {
    label: 'Non-Veg',
    shortLabel: 'Non-Veg',
    dotColor: '#DC2626',
    borderColor: '#DC2626',
    bgColor: '#FEF2F2',
    textColor: '#991B1B',
  },
  egg: {
    label: 'Contains Egg',
    shortLabel: 'Egg',
    dotColor: '#D97706',
    borderColor: '#D97706',
    bgColor: '#FFFBEB',
    textColor: '#92400E',
  },
  vegan: {
    label: 'Vegan',
    shortLabel: 'Vegan',
    dotColor: '#15803D',
    borderColor: '#15803D',
    bgColor: '#ECFDF5',
    textColor: '#065F46',
  },
  none: {
    label: 'Standard',
    shortLabel: 'Standard',
    dotColor: '#64748B',
    borderColor: '#94A3B8',
    bgColor: '#F8FAFC',
    textColor: '#475569',
  },
};

function stripControlChars(raw: string): string {
  return Array.from(raw)
    .filter((ch) => {
      const code = ch.charCodeAt(0);
      return code === 9 || code === 10 || code === 13 || (code >= 32 && code !== 127);
    })
    .join('')
    .trim();
}

/**
 * Derives a URL-safe table key from a table number or custom key input.
 * Example: "Table 04" -> "table-04", "T1" -> "t1".
 */
export function deriveTableKey(raw: string): string {
  return stripControlChars(raw)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, RESTAURANT_LIMITS.TABLE_KEY_MAX_LENGTH);
}

/**
 * Formats integer smallest currency units (paise/cents) into human-readable display string.
 * Avoids floating-point errors and trims trailing .00 for whole-unit prices when clean.
 */
export function formatPriceFromPaise(
  pricePaise: number,
  currencyCode: RestaurantCurrencyCode = 'INR',
): string {
  if (!Number.isFinite(pricePaise) || pricePaise < 0) {
    return `${CURRENCY_METADATA[currencyCode]?.symbol ?? '₹'}0`;
  }
  const roundedPaise = Math.round(pricePaise);
  const meta = CURRENCY_METADATA[currencyCode] ?? CURRENCY_METADATA.INR;
  const majorUnits = Math.floor(roundedPaise / 100);
  const minorUnits = roundedPaise % 100;

  const formattedMajor = majorUnits.toLocaleString(meta.locale);
  if (minorUnits === 0) {
    return `${meta.symbol}${formattedMajor}`;
  }
  const paddedMinor = String(minorUnits).padStart(2, '0');
  return `${meta.symbol}${formattedMajor}.${paddedMinor}`;
}

/**
 * Parses a user-entered major currency price string or number (e.g. "249" or "249.50")
 * into integer paise/cents without floating-point drift.
 */
export function parseMajorCurrencyToPaise(
  rawInput: string | number,
): { ok: true; pricePaise: number } | { ok: false; error: string } {
  const str = typeof rawInput === 'number' ? String(rawInput) : stripControlChars(String(rawInput ?? ''));
  if (!str) {
    return { ok: false, error: 'Price is required.' };
  }
  if (!/^\d+(?:\.\d{1,2})?$/.test(str)) {
    return {
      ok: false,
      error: 'Price must be a valid non-negative amount with at most 2 decimal places (e.g. 250 or 250.50).',
    };
  }
  const [wholePart, fracPart = ''] = str.split('.');
  const whole = Number.parseInt(wholePart, 10);
  const minor = Number.parseInt(fracPart.padEnd(2, '0'), 10);
  const totalPaise = whole * 100 + minor;

  if (!Number.isSafeInteger(totalPaise) || totalPaise < 0) {
    return { ok: false, error: 'Price must be 0 or greater.' };
  }
  if (totalPaise > RESTAURANT_LIMITS.ITEM_MAX_PRICE_PAISE) {
    return {
      ok: false,
      error: 'Price exceeds maximum allowed value.',
    };
  }
  return { ok: true, pricePaise: totalPaise };
}

/**
 * Generates the canonical customer Digital Menu URL for a business slug.
 * Example: https://yourdomain.com/r/the-urban-kitchen/menu
 */
export function getRestaurantMenuUrl(
  businessSlug: string,
  baseOrigin?: string,
): string {
  const cleanSlug = stripControlChars(businessSlug).toLowerCase();
  if (!cleanSlug || !/^[a-z0-9-]{3,80}$/.test(cleanSlug)) {
    throw new Error('A valid business slug is required to generate a digital menu URL.');
  }
  const host = (
    baseOrigin ??
    (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173')
  ).replace(/\/+$/, '');
  return `${host}/r/${cleanSlug}/menu`;
}

/**
 * Generates the canonical table-specific QR URL for a restaurant table.
 * Example: https://yourdomain.com/r/the-urban-kitchen/table/table-04
 */
export function getRestaurantTableQrUrl(
  businessSlug: string,
  tableKey: string,
  baseOrigin?: string,
): string {
  const cleanSlug = stripControlChars(businessSlug).toLowerCase();
  if (!cleanSlug || !/^[a-z0-9-]{3,80}$/.test(cleanSlug)) {
    throw new Error('A valid business slug is required to generate a table QR URL.');
  }
  const cleanTableKey = deriveTableKey(tableKey);
  if (!cleanTableKey || !/^[a-z0-9][a-z0-9-]{0,39}$/.test(cleanTableKey)) {
    throw new Error('A valid URL-safe table key is required to generate a table QR URL.');
  }
  const host = (
    baseOrigin ??
    (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173')
  ).replace(/\/+$/, '');
  return `${host}/r/${cleanSlug}/table/${cleanTableKey}`;
}

export function validateRestaurantProfileInput(
  businessId: unknown,
  input: unknown,
):
  | {
      ok: true;
      value: {
        isEnabled: boolean;
        currencyCode: RestaurantCurrencyCode;
        tagline: string | null;
        gamesEnabled: boolean;
        loyaltyEnabled: boolean;
        staffPinHash?: string | null;
        minHoursBetweenVisitStars?: number;
        tableOrderingEnabled?: boolean;
        menuThemeTemplate?: MenuThemeTemplate;
        customLogoUrl?: string | null;
        customAccentColor?: string | null;
      };
    }
  | { ok: false; error: string } {
  const idErr = validateBusinessId(businessId);
  if (idErr) {
    return { ok: false, error: idErr };
  }
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { ok: false, error: 'Restaurant profile input must be an object.' };
  }
  const rec = input as Record<string, unknown>;
  if (typeof rec.isEnabled !== 'boolean') {
    return { ok: false, error: 'isEnabled must be a boolean.' };
  }

  const rawCurrency = rec.currencyCode === undefined ? 'INR' : rec.currencyCode;
  if (
    typeof rawCurrency !== 'string' ||
    !ALLOWED_CURRENCIES.includes(rawCurrency as RestaurantCurrencyCode)
  ) {
    return {
      ok: false,
      error: `Currency code must be one of: ${ALLOWED_CURRENCIES.join(', ')}.`,
    };
  }

  let tagline: string | null = null;
  if (rec.tagline !== undefined && rec.tagline !== null) {
    if (typeof rec.tagline !== 'string') {
      return { ok: false, error: 'Restaurant tagline must be text.' };
    }
    const cleaned = stripControlChars(rec.tagline).replace(/\s+/g, ' ');
    if (cleaned.length > RESTAURANT_LIMITS.TAGLINE_MAX_LENGTH) {
      return {
        ok: false,
        error: `Restaurant tagline must be ${RESTAURANT_LIMITS.TAGLINE_MAX_LENGTH} characters or fewer.`,
      };
    }
    tagline = cleaned || null;
  }

  const gamesEnabled =
    typeof rec.gamesEnabled === 'boolean' ? rec.gamesEnabled : true;
  const loyaltyEnabled =
    typeof rec.loyaltyEnabled === 'boolean' ? rec.loyaltyEnabled : true;

  let staffPinHash: string | null | undefined = undefined;
  if (rec.staffPinHash !== undefined) {
    if (rec.staffPinHash === null || rec.staffPinHash === '') {
      staffPinHash = null;
    } else if (
      typeof rec.staffPinHash === 'string' &&
      /^[0-9a-f]{64}$/i.test(rec.staffPinHash.trim())
    ) {
      staffPinHash = rec.staffPinHash.trim().toLowerCase();
    } else {
      return {
        ok: false,
        error: 'staffPinHash must be a valid 64-character SHA-256 hex digest or null.',
      };
    }
  }

  let minHoursBetweenVisitStars: number | undefined = undefined;
  if (rec.minHoursBetweenVisitStars !== undefined) {
    if (
      typeof rec.minHoursBetweenVisitStars !== 'number' ||
      !Number.isInteger(rec.minHoursBetweenVisitStars) ||
      rec.minHoursBetweenVisitStars < 0 ||
      rec.minHoursBetweenVisitStars > 168
    ) {
      return {
        ok: false,
        error:
          'Minimum hours between visit stars must be an integer between 0 and 168.',
      };
    }
    minHoursBetweenVisitStars = rec.minHoursBetweenVisitStars;
  }

  let tableOrderingEnabled: boolean | undefined = undefined;
  if (rec.tableOrderingEnabled !== undefined) {
    if (typeof rec.tableOrderingEnabled !== 'boolean') {
      return { ok: false, error: 'tableOrderingEnabled must be a boolean.' };
    }
    tableOrderingEnabled = rec.tableOrderingEnabled;
  }

  let menuThemeTemplate: MenuThemeTemplate | undefined = undefined;
  if (rec.menuThemeTemplate !== undefined) {
    if (
      typeof rec.menuThemeTemplate !== 'string' ||
      !ALLOWED_MENU_THEME_TEMPLATES.includes(
        rec.menuThemeTemplate as MenuThemeTemplate,
      )
    ) {
      return {
        ok: false,
        error: `Menu theme template must be one of: ${ALLOWED_MENU_THEME_TEMPLATES.join(', ')}.`,
      };
    }
    menuThemeTemplate = rec.menuThemeTemplate as MenuThemeTemplate;
  }

  let customLogoUrl: string | null | undefined = undefined;
  if (rec.customLogoUrl !== undefined) {
    if (rec.customLogoUrl === null || rec.customLogoUrl === '') {
      customLogoUrl = null;
    } else if (typeof rec.customLogoUrl === 'string') {
      const cleanLogo = stripControlChars(rec.customLogoUrl);
      if (cleanLogo && (!/^https?:\/\/.+/i.test(cleanLogo) || cleanLogo.length > 2048)) {
        return {
          ok: false,
          error: 'Custom logo URL must be a valid http:// or https:// URL.',
        };
      }
      customLogoUrl = cleanLogo || null;
    } else {
      return { ok: false, error: 'Custom logo URL must be text.' };
    }
  }

  let customAccentColor: string | null | undefined = undefined;
  if (rec.customAccentColor !== undefined) {
    if (rec.customAccentColor === null || rec.customAccentColor === '') {
      customAccentColor = null;
    } else if (
      typeof rec.customAccentColor === 'string' &&
      /^#[0-9a-f]{6}$/i.test(rec.customAccentColor.trim())
    ) {
      customAccentColor = rec.customAccentColor.trim().toUpperCase();
    } else {
      return {
        ok: false,
        error: 'Custom accent color must be a valid 6-digit hex color (e.g. #7A1624).',
      };
    }
  }

  return {
    ok: true,
    value: {
      isEnabled: rec.isEnabled,
      currencyCode: rawCurrency as RestaurantCurrencyCode,
      tagline,
      gamesEnabled,
      loyaltyEnabled,
      ...(staffPinHash !== undefined ? { staffPinHash } : {}),
      ...(minHoursBetweenVisitStars !== undefined
        ? { minHoursBetweenVisitStars }
        : {}),
      ...(tableOrderingEnabled !== undefined ? { tableOrderingEnabled } : {}),
      ...(menuThemeTemplate !== undefined ? { menuThemeTemplate } : {}),
      ...(customLogoUrl !== undefined ? { customLogoUrl } : {}),
      ...(customAccentColor !== undefined ? { customAccentColor } : {}),
    },
  };
}

export function normalizeRestaurantProfile(
  businessId: string,
  partial?: Partial<RestaurantProfile & RestaurantProfileInput> | null,
  storageSource: 'supabase' | 'local' = 'local',
): RestaurantProfile {
  const cleanId = businessId.trim();
  const currencyCode =
    partial?.currencyCode &&
    ALLOWED_CURRENCIES.includes(partial.currencyCode)
      ? partial.currencyCode
      : 'INR';
  const rawTagline =
    typeof partial?.tagline === 'string'
      ? stripControlChars(partial.tagline).slice(0, RESTAURANT_LIMITS.TAGLINE_MAX_LENGTH)
      : null;

  const staffPinHash =
    typeof partial?.staffPinHash === 'string' &&
    /^[0-9a-f]{64}$/i.test(partial.staffPinHash.trim())
      ? partial.staffPinHash.trim().toLowerCase()
      : null;

  const minHoursBetweenVisitStars =
    typeof partial?.minHoursBetweenVisitStars === 'number' &&
    Number.isInteger(partial.minHoursBetweenVisitStars) &&
    partial.minHoursBetweenVisitStars >= 0 &&
    partial.minHoursBetweenVisitStars <= 168
      ? partial.minHoursBetweenVisitStars
      : 4;

  const menuThemeTemplate: MenuThemeTemplate =
    partial?.menuThemeTemplate &&
    ALLOWED_MENU_THEME_TEMPLATES.includes(partial.menuThemeTemplate)
      ? partial.menuThemeTemplate
      : 'default';

  const customLogoUrl =
    typeof partial?.customLogoUrl === 'string' &&
    /^https?:\/\/.+/i.test(partial.customLogoUrl.trim())
      ? partial.customLogoUrl.trim()
      : null;

  const customAccentColor =
    typeof partial?.customAccentColor === 'string' &&
    /^#[0-9a-f]{6}$/i.test(partial.customAccentColor.trim())
      ? partial.customAccentColor.trim().toUpperCase()
      : null;

  return {
    businessId: cleanId,
    isEnabled: Boolean(partial?.isEnabled),
    currencyCode,
    tagline: rawTagline || null,
    gamesEnabled:
      typeof partial?.gamesEnabled === 'boolean' ? partial.gamesEnabled : true,
    loyaltyEnabled:
      typeof partial?.loyaltyEnabled === 'boolean'
        ? partial.loyaltyEnabled
        : true,
    staffPinHash,
    minHoursBetweenVisitStars,
    tableOrderingEnabled: Boolean(partial?.tableOrderingEnabled),
    menuThemeTemplate,
    customLogoUrl,
    customAccentColor,
    updatedAt:
      (partial as Partial<RestaurantProfile> | undefined)?.updatedAt ||
      new Date().toISOString(),
    storageSource,
  };
}

export function validateRestaurantTableInput(
  businessId: unknown,
  input: unknown,
):
  | {
      ok: true;
      value: {
        tableNumber: string;
        tableLabel: string | null;
        tableKey: string;
        isActive: boolean;
      };
    }
  | { ok: false; error: string } {
  const idErr = validateBusinessId(businessId);
  if (idErr) {
    return { ok: false, error: idErr };
  }
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { ok: false, error: 'Table configuration must be an object.' };
  }
  const rec = input as Partial<RestaurantTableInput> & Record<string, unknown>;
  if (typeof rec.tableNumber !== 'string') {
    return { ok: false, error: 'Table number is required (e.g. "T1" or "Table 04").' };
  }
  const tableNumber = stripControlChars(rec.tableNumber).replace(/\s+/g, ' ');
  if (!tableNumber) {
    return { ok: false, error: 'Table number cannot be empty.' };
  }
  if (tableNumber.length > RESTAURANT_LIMITS.TABLE_NUMBER_MAX_LENGTH) {
    return {
      ok: false,
      error: `Table number must be ${RESTAURANT_LIMITS.TABLE_NUMBER_MAX_LENGTH} characters or fewer.`,
    };
  }

  let tableLabel: string | null = null;
  if (rec.tableLabel !== undefined && rec.tableLabel !== null) {
    if (typeof rec.tableLabel !== 'string') {
      return { ok: false, error: 'Table label must be text.' };
    }
    const cleanLabel = stripControlChars(rec.tableLabel).replace(/\s+/g, ' ');
    if (cleanLabel.length > RESTAURANT_LIMITS.TABLE_LABEL_MAX_LENGTH) {
      return {
        ok: false,
        error: `Table label must be ${RESTAURANT_LIMITS.TABLE_LABEL_MAX_LENGTH} characters or fewer.`,
      };
    }
    tableLabel = cleanLabel || null;
  }

  const rawKeySource =
    typeof rec.tableKey === 'string' && stripControlChars(rec.tableKey)
      ? rec.tableKey
      : tableNumber;
  const tableKey = deriveTableKey(rawKeySource);
  if (!tableKey || !/^[a-z0-9][a-z0-9-]{0,39}$/.test(tableKey)) {
    return {
      ok: false,
      error: 'Table number must contain at least one letter or digit to generate a valid QR URL key.',
    };
  }

  const isActive = typeof rec.isActive === 'boolean' ? rec.isActive : true;

  return {
    ok: true,
    value: {
      tableNumber,
      tableLabel,
      tableKey,
      isActive,
    },
  };
}

export function validateRestaurantMenuCategoryInput(
  businessId: unknown,
  input: unknown,
):
  | {
      ok: true;
      value: {
        name: string;
        description: string | null;
        displayOrder: number;
        isActive: boolean;
      };
    }
  | { ok: false; error: string } {
  const idErr = validateBusinessId(businessId);
  if (idErr) {
    return { ok: false, error: idErr };
  }
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { ok: false, error: 'Menu category input must be an object.' };
  }
  const rec = input as Partial<RestaurantMenuCategoryInput> & Record<string, unknown>;
  if (typeof rec.name !== 'string') {
    return { ok: false, error: 'Category name is required.' };
  }
  const name = stripControlChars(rec.name).replace(/\s+/g, ' ');
  if (!name) {
    return { ok: false, error: 'Category name cannot be empty.' };
  }
  if (name.length > RESTAURANT_LIMITS.CATEGORY_NAME_MAX_LENGTH) {
    return {
      ok: false,
      error: `Category name must be ${RESTAURANT_LIMITS.CATEGORY_NAME_MAX_LENGTH} characters or fewer.`,
    };
  }

  let description: string | null = null;
  if (rec.description !== undefined && rec.description !== null) {
    if (typeof rec.description !== 'string') {
      return { ok: false, error: 'Category description must be text.' };
    }
    const cleanDesc = stripControlChars(rec.description);
    if (cleanDesc.length > RESTAURANT_LIMITS.CATEGORY_DESCRIPTION_MAX_LENGTH) {
      return {
        ok: false,
        error: `Category description must be ${RESTAURANT_LIMITS.CATEGORY_DESCRIPTION_MAX_LENGTH} characters or fewer.`,
      };
    }
    description = cleanDesc || null;
  }

  const displayOrder =
    typeof rec.displayOrder === 'number' && Number.isFinite(rec.displayOrder)
      ? Math.max(0, Math.floor(rec.displayOrder))
      : 0;
  const isActive = typeof rec.isActive === 'boolean' ? rec.isActive : true;

  return {
    ok: true,
    value: {
      name,
      description,
      displayOrder,
      isActive,
    },
  };
}

export function validateRestaurantMenuItemInput(
  businessId: unknown,
  input: unknown,
):
  | {
      ok: true;
      value: {
        categoryId: string;
        name: string;
        description: string | null;
        pricePaise: number;
        dietaryTag: DietaryTag;
        isAvailable: boolean;
        isFeatured: boolean;
        imageUrl: string | null;
        displayOrder: number;
      };
    }
  | { ok: false; error: string } {
  const idErr = validateBusinessId(businessId);
  if (idErr) {
    return { ok: false, error: idErr };
  }
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { ok: false, error: 'Menu item input must be an object.' };
  }
  const rec = input as Partial<RestaurantMenuItemInput> & Record<string, unknown>;

  if (typeof rec.categoryId !== 'string' || !stripControlChars(rec.categoryId)) {
    return { ok: false, error: 'Menu category ID is required.' };
  }
  const categoryId = stripControlChars(rec.categoryId);

  if (typeof rec.name !== 'string') {
    return { ok: false, error: 'Dish name is required.' };
  }
  const name = stripControlChars(rec.name).replace(/\s+/g, ' ');
  if (!name) {
    return { ok: false, error: 'Dish name cannot be empty.' };
  }
  if (name.length > RESTAURANT_LIMITS.ITEM_NAME_MAX_LENGTH) {
    return {
      ok: false,
      error: `Dish name must be ${RESTAURANT_LIMITS.ITEM_NAME_MAX_LENGTH} characters or fewer.`,
    };
  }

  let description: string | null = null;
  if (rec.description !== undefined && rec.description !== null) {
    if (typeof rec.description !== 'string') {
      return { ok: false, error: 'Dish description must be text.' };
    }
    const cleanDesc = stripControlChars(rec.description);
    if (cleanDesc.length > RESTAURANT_LIMITS.ITEM_DESCRIPTION_MAX_LENGTH) {
      return {
        ok: false,
        error: `Dish description must be ${RESTAURANT_LIMITS.ITEM_DESCRIPTION_MAX_LENGTH} characters or fewer.`,
      };
    }
    description = cleanDesc || null;
  }

  if (
    typeof rec.pricePaise !== 'number' ||
    !Number.isInteger(rec.pricePaise) ||
    rec.pricePaise < 0 ||
    rec.pricePaise > RESTAURANT_LIMITS.ITEM_MAX_PRICE_PAISE
  ) {
    return {
      ok: false,
      error: 'Price (in paise/cents) must be a non-negative integer.',
    };
  }

  const rawDietary = rec.dietaryTag === undefined ? 'none' : rec.dietaryTag;
  if (
    typeof rawDietary !== 'string' ||
    !ALLOWED_DIETARY_TAGS.includes(rawDietary as DietaryTag)
  ) {
    return {
      ok: false,
      error: `Dietary tag must be one of: ${ALLOWED_DIETARY_TAGS.join(', ')}.`,
    };
  }

  let imageUrl: string | null = null;
  if (rec.imageUrl !== undefined && rec.imageUrl !== null && rec.imageUrl !== '') {
    if (typeof rec.imageUrl !== 'string') {
      return { ok: false, error: 'Image URL must be a string.' };
    }
    const cleanImg = stripControlChars(rec.imageUrl);
    if (cleanImg) {
      if (!/^https?:\/\/.+/i.test(cleanImg) || cleanImg.length > 2048) {
        return {
          ok: false,
          error: 'Image URL must be a valid http:// or https:// URL.',
        };
      }
      imageUrl = cleanImg;
    }
  }

  const isAvailable =
    typeof rec.isAvailable === 'boolean' ? rec.isAvailable : true;
  const isFeatured =
    typeof rec.isFeatured === 'boolean' ? rec.isFeatured : false;
  const displayOrder =
    typeof rec.displayOrder === 'number' && Number.isFinite(rec.displayOrder)
      ? Math.max(0, Math.floor(rec.displayOrder))
      : 0;

  return {
    ok: true,
    value: {
      categoryId,
      name,
      description,
      pricePaise: rec.pricePaise,
      dietaryTag: rawDietary as DietaryTag,
      isAvailable,
      isFeatured,
      imageUrl,
      displayOrder,
    },
  };
}

// ===========================================================================
// Phase 2: Restaurant Games, Customer Check-In & Anti-Cheat Validation
// ===========================================================================

export const ALLOWED_GAME_SLUGS: ReadonlyArray<RestaurantGameSlug> = [
  'dish-trivia',
  'memory-match',
  'table-word-chain',
  'speed-tap',
];

export const ALLOWED_GAME_CATEGORIES: ReadonlyArray<RestaurantGameCategory> = [
  'solo',
  'same_table',
  'restaurant_wide',
];

export const DEFAULT_DISH_TRIVIA_QUESTIONS: ReadonlyArray<RestaurantTriviaQuestion> =
  [
    {
      prompt:
        'Which aromatic spice gives traditional Dum Biryani its golden hue and royal aroma?',
      options: ['Saffron (Kesar)', 'Paprika', 'Mustard Seed', 'Fenugreek'],
      correctIndex: 0,
    },
    {
      prompt:
        'At what temperature is a traditional clay Tandoor oven typically fired?',
      options: ['100°C', '400°C+ (High heat)', '50°C', 'Room temperature'],
      correctIndex: 1,
    },
    {
      prompt:
        'Which herb is freshly muddled into a classic Mint Lime Cooler?',
      options: ['Rosemary', 'Thyme', 'Fresh Pudina (Mint)', 'Oregano'],
      correctIndex: 2,
    },
  ];

export const DEFAULT_TABLE_CHALLENGE_ROUNDS: ReadonlyArray<{
  round: number;
  prompt: string;
  options: string[];
  correctIndex: number;
}> = [
  {
    round: 1,
    prompt: 'Player 1: Pick the dish slow-cooked in a sealed pot',
    options: ['Dum Biryani', 'Garden Salad', 'Ice Cream'],
    correctIndex: 0,
  },
  {
    round: 2,
    prompt:
      'Pass to Player 2: Pick the classic accompaniment that cools down spicy curry',
    options: ['Hot Chili Oil', 'Chilled Cucumber Raita', 'Black Coffee'],
    correctIndex: 1,
  },
  {
    round: 3,
    prompt:
      'Pass to Player 3: Pick the crispy South Indian fermented rice & lentil crepe',
    options: ['Naan', 'Masala Dosa', 'Roti'],
    correctIndex: 1,
  },
];

export const DEFAULT_GAME_CATALOG: ReadonlyArray<{
  gameSlug: RestaurantGameSlug;
  title: string;
  description: string;
  category: RestaurantGameCategory;
  defaultPointsPerWin: number;
  defaultMaxPointsPerDay: number;
  defaultCooldownMinutes: number;
}> = [
  {
    gameSlug: 'dish-trivia',
    title: "Chef's Table Trivia",
    description:
      '3 quick food & house-specialty trivia questions while your meal is prepared.',
    category: 'solo',
    defaultPointsPerWin: 10,
    defaultMaxPointsPerDay: 50,
    defaultCooldownMinutes: 5,
  },
  {
    gameSlug: 'memory-match',
    title: 'Flavor Memory Match',
    description:
      'Match all 4 pairs of kitchen icons in 14 moves or fewer to win.',
    category: 'solo',
    defaultPointsPerWin: 10,
    defaultMaxPointsPerDay: 50,
    defaultCooldownMinutes: 5,
  },
  {
    gameSlug: 'table-word-chain',
    title: 'Pass-the-Phone Table Challenge',
    description:
      '3-round group challenge for friends & family sitting at the same table.',
    category: 'same_table',
    defaultPointsPerWin: 15,
    defaultMaxPointsPerDay: 60,
    defaultCooldownMinutes: 5,
  },
];

export function getDefaultRestaurantGameConfigs(
  businessId: string,
): RestaurantGameConfig[] {
  const cleanId = businessId.trim();
  const now = new Date().toISOString();
  return DEFAULT_GAME_CATALOG.map((g, idx) => ({
    id: `game-cfg-${cleanId}-${g.gameSlug}-${idx}`,
    businessId: cleanId,
    gameSlug: g.gameSlug,
    title: g.title,
    category: g.category,
    isEnabled: true,
    pointsPerWin: g.defaultPointsPerWin,
    maxPointsPerDayPerCustomer: g.defaultMaxPointsPerDay,
    cooldownMinutes: g.defaultCooldownMinutes,
    customQuestions:
      g.gameSlug === 'dish-trivia'
        ? DEFAULT_DISH_TRIVIA_QUESTIONS.map((q) => ({
            prompt: q.prompt,
            options: [...q.options],
            correctIndex: q.correctIndex,
          }))
        : null,
    createdAt: now,
    updatedAt: now,
  }));
}

export function validateTriviaQuestionsList(
  questions: unknown,
):
  | { ok: true; value: RestaurantTriviaQuestion[] | null }
  | { ok: false; error: string } {
  if (questions === undefined || questions === null) {
    return { ok: true, value: null };
  }
  if (!Array.isArray(questions)) {
    return { ok: false, error: 'Custom trivia questions must be an array.' };
  }
  if (questions.length > 20) {
    return {
      ok: false,
      error: 'You can configure up to 20 custom trivia questions.',
    };
  }

  const sanitized: RestaurantTriviaQuestion[] = [];
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    if (!q || typeof q !== 'object' || Array.isArray(q)) {
      return {
        ok: false,
        error: `Trivia question #${i + 1} is malformed.`,
      };
    }
    const rec = q as Record<string, unknown>;
    if (typeof rec.prompt !== 'string') {
      return {
        ok: false,
        error: `Question #${i + 1} prompt is required.`,
      };
    }
    const prompt = stripControlChars(rec.prompt).replace(/\s+/g, ' ');
    if (prompt.length < 5 || prompt.length > 220) {
      return {
        ok: false,
        error: `Question #${i + 1} prompt must be between 5 and 220 characters.`,
      };
    }
    if (!Array.isArray(rec.options) || rec.options.length < 2 || rec.options.length > 4) {
      return {
        ok: false,
        error: `Question #${i + 1} must have between 2 and 4 answer options.`,
      };
    }
    const options: string[] = [];
    for (const opt of rec.options) {
      if (typeof opt !== 'string' || !stripControlChars(opt)) {
        return {
          ok: false,
          error: `Question #${i + 1} has an empty answer option.`,
        };
      }
      const cleanOpt = stripControlChars(opt).replace(/\s+/g, ' ');
      if (cleanOpt.length > 80) {
        return {
          ok: false,
          error: `Answer options in question #${i + 1} must be 80 characters or fewer.`,
        };
      }
      options.push(cleanOpt);
    }
    if (
      typeof rec.correctIndex !== 'number' ||
      !Number.isInteger(rec.correctIndex) ||
      rec.correctIndex < 0 ||
      rec.correctIndex >= options.length
    ) {
      return {
        ok: false,
        error: `Question #${i + 1} has an invalid correct answer index.`,
      };
    }
    sanitized.push({
      prompt,
      options,
      correctIndex: rec.correctIndex,
    });
  }

  return { ok: true, value: sanitized.length > 0 ? sanitized : null };
}

export function validateRestaurantGameConfigInput(
  businessId: unknown,
  input: unknown,
):
  | {
      ok: true;
      value: {
        gameSlug: RestaurantGameSlug;
        title: string;
        category: RestaurantGameCategory;
        isEnabled: boolean;
        pointsPerWin: number;
        maxPointsPerDayPerCustomer: number;
        cooldownMinutes: number;
        customQuestions: RestaurantTriviaQuestion[] | null;
      };
    }
  | { ok: false; error: string } {
  const idErr = validateBusinessId(businessId);
  if (idErr) {
    return { ok: false, error: idErr };
  }
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { ok: false, error: 'Game configuration must be an object.' };
  }
  const rec = input as Partial<RestaurantGameConfigInput> &
    Record<string, unknown>;

  if (
    typeof rec.gameSlug !== 'string' ||
    !ALLOWED_GAME_SLUGS.includes(rec.gameSlug as RestaurantGameSlug)
  ) {
    return {
      ok: false,
      error: `Game slug must be one of: ${ALLOWED_GAME_SLUGS.join(', ')}.`,
    };
  }
  const gameSlug = rec.gameSlug as RestaurantGameSlug;
  const catalogMeta = DEFAULT_GAME_CATALOG.find((c) => c.gameSlug === gameSlug);

  const rawTitle =
    typeof rec.title === 'string' && stripControlChars(rec.title)
      ? stripControlChars(rec.title).replace(/\s+/g, ' ')
      : (catalogMeta?.title ?? 'Table Game');
  if (rawTitle.length < 1 || rawTitle.length > 100) {
    return {
      ok: false,
      error: 'Game title must be between 1 and 100 characters.',
    };
  }

  const rawCategory =
    typeof rec.category === 'string'
      ? rec.category
      : (catalogMeta?.category ?? 'solo');
  if (!ALLOWED_GAME_CATEGORIES.includes(rawCategory as RestaurantGameCategory)) {
    return {
      ok: false,
      error: `Game category must be one of: ${ALLOWED_GAME_CATEGORIES.join(', ')}.`,
    };
  }

  if (typeof rec.isEnabled !== 'boolean') {
    return { ok: false, error: 'isEnabled must be a boolean.' };
  }

  if (
    typeof rec.pointsPerWin !== 'number' ||
    !Number.isInteger(rec.pointsPerWin) ||
    rec.pointsPerWin < 0 ||
    rec.pointsPerWin > 1000
  ) {
    return {
      ok: false,
      error: 'Points per win must be an integer between 0 and 1000.',
    };
  }

  if (
    typeof rec.maxPointsPerDayPerCustomer !== 'number' ||
    !Number.isInteger(rec.maxPointsPerDayPerCustomer) ||
    rec.maxPointsPerDayPerCustomer < 0 ||
    rec.maxPointsPerDayPerCustomer > 10000
  ) {
    return {
      ok: false,
      error: 'Max daily points per customer must be an integer between 0 and 10000.',
    };
  }

  if (
    typeof rec.cooldownMinutes !== 'number' ||
    !Number.isInteger(rec.cooldownMinutes) ||
    rec.cooldownMinutes < 0 ||
    rec.cooldownMinutes > 1440
  ) {
    return {
      ok: false,
      error: 'Cooldown minutes must be an integer between 0 and 1440.',
    };
  }

  const questionsCheck = validateTriviaQuestionsList(rec.customQuestions);
  if (!questionsCheck.ok) {
    return questionsCheck;
  }

  return {
    ok: true,
    value: {
      gameSlug,
      title: rawTitle,
      category: rawCategory as RestaurantGameCategory,
      isEnabled: rec.isEnabled,
      pointsPerWin: rec.pointsPerWin,
      maxPointsPerDayPerCustomer: rec.maxPointsPerDayPerCustomer,
      cooldownMinutes: rec.cooldownMinutes,
      customQuestions: questionsCheck.value,
    },
  };
}

export function validateRestaurantCustomerCheckInInput(
  input: unknown,
):
  | {
      ok: true;
      value: {
        displayName: string;
        phoneOrEmail: string | null;
        guestTokenHash: string | null;
        businessSlug: string | null;
      };
    }
  | { ok: false; error: string } {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { ok: false, error: 'Customer check-in details must be an object.' };
  }
  const rec = input as Partial<RestaurantCustomerCheckInInput> &
    Record<string, unknown>;

  if (typeof rec.displayName !== 'string') {
    return { ok: false, error: 'Please enter your name.' };
  }
  const displayName = stripControlChars(rec.displayName).replace(/\s+/g, ' ');
  if (displayName.length < 1 || displayName.length > 80) {
    return {
      ok: false,
      error: 'Name must be between 1 and 80 characters.',
    };
  }

  let phoneOrEmail: string | null = null;
  if (rec.phoneOrEmail !== undefined && rec.phoneOrEmail !== null) {
    if (typeof rec.phoneOrEmail !== 'string') {
      return { ok: false, error: 'Phone or email must be text.' };
    }
    const cleanContact = stripControlChars(rec.phoneOrEmail).toLowerCase();
    if (cleanContact) {
      if (cleanContact.length < 3 || cleanContact.length > 160) {
        return {
          ok: false,
          error: 'Phone or email must be between 3 and 160 characters.',
        };
      }
      phoneOrEmail = cleanContact;
    }
  }

  let guestTokenHash: string | null = null;
  if (rec.guestTokenHash !== undefined && rec.guestTokenHash !== null) {
    if (typeof rec.guestTokenHash !== 'string') {
      return { ok: false, error: 'Guest token must be a string.' };
    }
    const cleanToken = stripControlChars(rec.guestTokenHash);
    if (cleanToken) {
      if (cleanToken.length < 8 || cleanToken.length > 128) {
        return {
          ok: false,
          error: 'Guest token must be between 8 and 128 characters.',
        };
      }
      guestTokenHash = cleanToken;
    }
  }

  const businessSlug =
    typeof rec.businessSlug === 'string' && stripControlChars(rec.businessSlug)
      ? stripControlChars(rec.businessSlug).toLowerCase()
      : null;

  return {
    ok: true,
    value: {
      displayName,
      phoneOrEmail,
      guestTokenHash,
      businessSlug,
    },
  };
}

/**
 * Builds the server-side seed (containing answer keys) and the sanitized
 * client challenge (with answer keys stripped out so the client cannot inspect them).
 */
export function buildServerSeedAndClientChallenge(
  config: RestaurantGameConfig,
): {
  serverSeed: Record<string, unknown>;
  clientChallenge: RestaurantGameClientChallenge;
} {
  if (config.gameSlug === 'dish-trivia') {
    const questionsSource =
      config.customQuestions && config.customQuestions.length > 0
        ? config.customQuestions
        : DEFAULT_DISH_TRIVIA_QUESTIONS;

    const clientQuestions = questionsSource.map((q, idx) => ({
      index: idx,
      prompt: q.prompt,
      options: [...q.options],
    }));
    const expectedAnswers = questionsSource.map((q) => q.correctIndex);

    return {
      serverSeed: {
        gameSlug: config.gameSlug,
        expectedAnswers,
        totalQuestions: questionsSource.length,
      },
      clientChallenge: {
        gameSlug: config.gameSlug,
        questions: clientQuestions,
      },
    };
  }

  if (config.gameSlug === 'memory-match') {
    return {
      serverSeed: {
        gameSlug: config.gameSlug,
        pairsRequired: 4,
        maxMovesAllowed: 14,
      },
      clientChallenge: {
        gameSlug: config.gameSlug,
        pairsRequired: 4,
        maxMovesAllowed: 14,
        cards: ['🍛', '🍛', '🥗', '🥗', '🍹', '🍹', '🥘', '🥘'],
      },
    };
  }

  // table-word-chain
  return {
    serverSeed: {
      gameSlug: config.gameSlug,
      roundsRequired: DEFAULT_TABLE_CHALLENGE_ROUNDS.length,
      expectedPrompts: DEFAULT_TABLE_CHALLENGE_ROUNDS.map((r) => ({ ...r })),
    },
    clientChallenge: {
      gameSlug: config.gameSlug,
      rounds: DEFAULT_TABLE_CHALLENGE_ROUNDS.map((r) => ({
        round: r.round,
        prompt: r.prompt,
        options: [...r.options],
      })),
    },
  };
}

/**
 * Evaluates a customer's game submission strictly against the server seed.
 * Never trusts any client-submitted point or score fields.
 */
export function verifyGameSubmissionAgainstServerSeed(
  gameSlug: RestaurantGameSlug,
  serverSeed: Record<string, unknown>,
  submission: RestaurantGameSubmissionInput,
): { passed: boolean; score: number } {
  if (gameSlug === 'dish-trivia') {
    const expected = Array.isArray(serverSeed.expectedAnswers)
      ? (serverSeed.expectedAnswers as number[])
      : [];
    const answers = Array.isArray(submission?.answers)
      ? submission.answers
      : [];
    if (expected.length === 0) {
      return { passed: false, score: 0 };
    }
    let correct = 0;
    for (let i = 0; i < expected.length; i++) {
      if (typeof answers[i] === 'number' && answers[i] === expected[i]) {
        correct++;
      }
    }
    const minRequired = Math.ceil(expected.length * 0.66);
    return {
      passed: correct >= minRequired,
      score: correct,
    };
  }

  if (gameSlug === 'memory-match') {
    const pairsRequired =
      typeof serverSeed.pairsRequired === 'number'
        ? serverSeed.pairsRequired
        : 4;
    const maxMovesAllowed =
      typeof serverSeed.maxMovesAllowed === 'number'
        ? serverSeed.maxMovesAllowed
        : 14;
    const matchedPairs =
      typeof submission?.matchedPairs === 'number' &&
      Number.isInteger(submission.matchedPairs)
        ? submission.matchedPairs
        : 0;
    const movesTaken =
      typeof submission?.movesTaken === 'number' &&
      Number.isInteger(submission.movesTaken)
        ? submission.movesTaken
        : 999;

    const passed =
      matchedPairs >= pairsRequired &&
      movesTaken >= pairsRequired &&
      movesTaken <= maxMovesAllowed;

    return {
      passed,
      score: matchedPairs,
    };
  }

  // table-word-chain
  const expectedPrompts = Array.isArray(serverSeed.expectedPrompts)
    ? (serverSeed.expectedPrompts as Array<{ correctIndex: number }>)
    : [];
  const answers = Array.isArray(submission?.answers) ? submission.answers : [];
  if (expectedPrompts.length === 0) {
    return { passed: false, score: 0 };
  }
  let correct = 0;
  for (let i = 0; i < expectedPrompts.length; i++) {
    if (
      typeof answers[i] === 'number' &&
      answers[i] === expectedPrompts[i].correctIndex
    ) {
      correct++;
    }
  }
  const minRequired = Math.ceil(expectedPrompts.length * 0.66);
  return {
    passed: correct >= minRequired,
    score: correct,
  };
}

// ===========================================================================
// Phase 3: Loyalty Economy Rules, Rewards, Personal QR Pass & Suggestion Box
// ===========================================================================

export function normalizeRestaurantLoyaltyRules(
  businessId: string,
  partial?: Partial<RestaurantLoyaltyRules & RestaurantLoyaltyRulesInput> | null,
): RestaurantLoyaltyRules {
  const cleanId = businessId.trim();
  const starsPerVerifiedVisit =
    typeof partial?.starsPerVerifiedVisit === 'number' &&
    Number.isInteger(partial.starsPerVerifiedVisit) &&
    partial.starsPerVerifiedVisit >= 1 &&
    partial.starsPerVerifiedVisit <= 50
      ? partial.starsPerVerifiedVisit
      : 1;

  const pointsPerStarExchange =
    typeof partial?.pointsPerStarExchange === 'number' &&
    Number.isInteger(partial.pointsPerStarExchange) &&
    partial.pointsPerStarExchange >= 1 &&
    partial.pointsPerStarExchange <= 100000
      ? partial.pointsPerStarExchange
      : 100;

  const allowPointExchange =
    typeof partial?.allowPointExchange === 'boolean'
      ? partial.allowPointExchange
      : true;

  const maxStarsViaExchangePerWeek =
    typeof partial?.maxStarsViaExchangePerWeek === 'number' &&
    Number.isInteger(partial.maxStarsViaExchangePerWeek) &&
    partial.maxStarsViaExchangePerWeek >= 0 &&
    partial.maxStarsViaExchangePerWeek <= 100
      ? partial.maxStarsViaExchangePerWeek
      : 2;

  const wifiNetworkName =
    typeof partial?.wifiNetworkName === 'string' &&
    stripControlChars(partial.wifiNetworkName)
      ? stripControlChars(partial.wifiNetworkName).slice(0, 80)
      : null;

  const wifiPassword =
    typeof partial?.wifiPassword === 'string' &&
    stripControlChars(partial.wifiPassword)
      ? stripControlChars(partial.wifiPassword).slice(0, 120)
      : null;

  const suggestionBoxEnabled =
    typeof partial?.suggestionBoxEnabled === 'boolean'
      ? partial.suggestionBoxEnabled
      : true;

  return {
    businessId: cleanId,
    starsPerVerifiedVisit,
    pointsPerStarExchange,
    allowPointExchange,
    maxStarsViaExchangePerWeek,
    wifiNetworkName,
    wifiPassword,
    suggestionBoxEnabled,
    updatedAt:
      (partial as Partial<RestaurantLoyaltyRules> | undefined)?.updatedAt ||
      new Date().toISOString(),
  };
}

export function validateRestaurantLoyaltyRulesInput(
  businessId: unknown,
  input: unknown,
):
  | {
      ok: true;
      value: {
        starsPerVerifiedVisit: number;
        pointsPerStarExchange: number;
        allowPointExchange: boolean;
        maxStarsViaExchangePerWeek: number;
        wifiNetworkName: string | null;
        wifiPassword: string | null;
        suggestionBoxEnabled: boolean;
      };
    }
  | { ok: false; error: string } {
  const idErr = validateBusinessId(businessId);
  if (idErr) {
    return { ok: false, error: idErr };
  }
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { ok: false, error: 'Loyalty rules input must be an object.' };
  }
  const rec = input as Partial<RestaurantLoyaltyRulesInput> &
    Record<string, unknown>;

  if (
    typeof rec.starsPerVerifiedVisit !== 'number' ||
    !Number.isInteger(rec.starsPerVerifiedVisit) ||
    rec.starsPerVerifiedVisit < 1 ||
    rec.starsPerVerifiedVisit > 50
  ) {
    return {
      ok: false,
      error: 'Stars per verified visit must be an integer between 1 and 50.',
    };
  }

  if (
    typeof rec.pointsPerStarExchange !== 'number' ||
    !Number.isInteger(rec.pointsPerStarExchange) ||
    rec.pointsPerStarExchange < 1 ||
    rec.pointsPerStarExchange > 100000
  ) {
    return {
      ok: false,
      error: 'Points per star exchange must be an integer between 1 and 100000.',
    };
  }

  if (typeof rec.allowPointExchange !== 'boolean') {
    return { ok: false, error: 'allowPointExchange must be a boolean.' };
  }

  if (
    typeof rec.maxStarsViaExchangePerWeek !== 'number' ||
    !Number.isInteger(rec.maxStarsViaExchangePerWeek) ||
    rec.maxStarsViaExchangePerWeek < 0 ||
    rec.maxStarsViaExchangePerWeek > 100
  ) {
    return {
      ok: false,
      error: 'Max stars via exchange per week must be an integer between 0 and 100.',
    };
  }

  let wifiNetworkName: string | null = null;
  if (rec.wifiNetworkName !== undefined && rec.wifiNetworkName !== null) {
    if (typeof rec.wifiNetworkName !== 'string') {
      return { ok: false, error: 'Wi-Fi network name must be text.' };
    }
    const cleanSsid = stripControlChars(rec.wifiNetworkName);
    if (cleanSsid.length > 80) {
      return {
        ok: false,
        error: 'Wi-Fi network name must be 80 characters or fewer.',
      };
    }
    wifiNetworkName = cleanSsid || null;
  }

  let wifiPassword: string | null = null;
  if (rec.wifiPassword !== undefined && rec.wifiPassword !== null) {
    if (typeof rec.wifiPassword !== 'string') {
      return { ok: false, error: 'Wi-Fi password must be text.' };
    }
    const cleanPass = stripControlChars(rec.wifiPassword);
    if (cleanPass.length > 120) {
      return {
        ok: false,
        error: 'Wi-Fi password must be 120 characters or fewer.',
      };
    }
    wifiPassword = cleanPass || null;
  }

  const suggestionBoxEnabled =
    typeof rec.suggestionBoxEnabled === 'boolean'
      ? rec.suggestionBoxEnabled
      : true;

  return {
    ok: true,
    value: {
      starsPerVerifiedVisit: rec.starsPerVerifiedVisit,
      pointsPerStarExchange: rec.pointsPerStarExchange,
      allowPointExchange: rec.allowPointExchange,
      maxStarsViaExchangePerWeek: rec.maxStarsViaExchangePerWeek,
      wifiNetworkName,
      wifiPassword,
      suggestionBoxEnabled,
    },
  };
}

export function validateRestaurantRewardInput(
  businessId: unknown,
  input: unknown,
):
  | {
      ok: true;
      value: {
        title: string;
        description: string | null;
        starsRequired: number;
        isActive: boolean;
        maxRedemptionsTotal: number | null;
        displayOrder: number;
      };
    }
  | { ok: false; error: string } {
  const idErr = validateBusinessId(businessId);
  if (idErr) {
    return { ok: false, error: idErr };
  }
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { ok: false, error: 'Reward configuration must be an object.' };
  }
  const rec = input as Partial<RestaurantRewardInput> & Record<string, unknown>;

  if (typeof rec.title !== 'string') {
    return { ok: false, error: 'Reward title is required.' };
  }
  const title = stripControlChars(rec.title).replace(/\s+/g, ' ');
  if (title.length < 1 || title.length > 100) {
    return {
      ok: false,
      error: 'Reward title must be between 1 and 100 characters.',
    };
  }

  let description: string | null = null;
  if (rec.description !== undefined && rec.description !== null) {
    if (typeof rec.description !== 'string') {
      return { ok: false, error: 'Reward description must be text.' };
    }
    const cleanDesc = stripControlChars(rec.description);
    if (cleanDesc.length > 260) {
      return {
        ok: false,
        error: 'Reward description must be 260 characters or fewer.',
      };
    }
    description = cleanDesc || null;
  }

  if (
    typeof rec.starsRequired !== 'number' ||
    !Number.isInteger(rec.starsRequired) ||
    rec.starsRequired < 1 ||
    rec.starsRequired > 1000
  ) {
    return {
      ok: false,
      error: 'Stars required must be an integer between 1 and 1000.',
    };
  }

  const isActive = typeof rec.isActive === 'boolean' ? rec.isActive : true;

  let maxRedemptionsTotal: number | null = null;
  if (
    rec.maxRedemptionsTotal !== undefined &&
    rec.maxRedemptionsTotal !== null
  ) {
    if (
      typeof rec.maxRedemptionsTotal !== 'number' ||
      !Number.isInteger(rec.maxRedemptionsTotal) ||
      rec.maxRedemptionsTotal < 1
    ) {
      return {
        ok: false,
        error: 'Maximum redemptions limit must be at least 1.',
      };
    }
    maxRedemptionsTotal = rec.maxRedemptionsTotal;
  }

  const displayOrder =
    typeof rec.displayOrder === 'number' && Number.isFinite(rec.displayOrder)
      ? Math.max(0, Math.floor(rec.displayOrder))
      : 0;

  return {
    ok: true,
    value: {
      title,
      description,
      starsRequired: rec.starsRequired,
      isActive,
      maxRedemptionsTotal,
      displayOrder,
    },
  };
}

export function validateRestaurantSuggestionInput(
  input: unknown,
):
  | {
      ok: true;
      value: {
        businessSlug: string;
        tableKey: string | null;
        customerName: string | null;
        message: string;
      };
    }
  | { ok: false; error: string } {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { ok: false, error: 'Suggestion input must be an object.' };
  }
  const rec = input as Partial<RestaurantSuggestionInput> &
    Record<string, unknown>;

  if (
    typeof rec.businessSlug !== 'string' ||
    !/^[a-z0-9-]{3,80}$/.test(stripControlChars(rec.businessSlug).toLowerCase())
  ) {
    return { ok: false, error: 'A valid business slug is required.' };
  }
  const businessSlug = stripControlChars(rec.businessSlug).toLowerCase();

  const tableKey =
    typeof rec.tableKey === 'string' && stripControlChars(rec.tableKey)
      ? deriveTableKey(rec.tableKey)
      : null;

  let customerName: string | null = null;
  if (rec.customerName !== undefined && rec.customerName !== null) {
    if (typeof rec.customerName !== 'string') {
      return { ok: false, error: 'Customer name must be text.' };
    }
    const cleanName = stripControlChars(rec.customerName).replace(/\s+/g, ' ');
    if (cleanName.length > 80) {
      return {
        ok: false,
        error: 'Customer name must be 80 characters or fewer.',
      };
    }
    customerName = cleanName || null;
  }

  if (typeof rec.message !== 'string') {
    return { ok: false, error: 'Please enter a suggestion message.' };
  }
  const message = stripControlChars(rec.message);
  if (message.length < 2 || message.length > 1000) {
    return {
      ok: false,
      error: 'Suggestion message must be between 2 and 1000 characters.',
    };
  }

  return {
    ok: true,
    value: {
      businessSlug,
      tableKey,
      customerName,
      message,
    },
  };
}

/**
 * Generates an uppercase 6-character alphanumeric reward claim code (e.g. "K7M4P9").
 */
export function generateRewardClaimCode(): string {
  const alphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let code = '';
  for (let i = 0; i < 6; i++) {
    const idx = Math.floor(Math.random() * alphabet.length);
    code += alphabet[idx];
  }
  return code;
}

/**
 * Builds the scannable personal loyalty QR pass token for a diner at a business.
 */
export function buildCustomerLoyaltyQrToken(
  businessSlug: string,
  customerId: string,
): string {
  return `vitaran-loyalty://${businessSlug.trim().toLowerCase()}/${customerId.trim()}`;
}

// ===========================================================================
// Phase 4: Staff PIN Hashing, Loyalty Lookup Parsing & Table Call Helpers
// ===========================================================================

export function validateStaffPinFormat(
  rawPin: unknown,
): { ok: true; pin: string } | { ok: false; error: string } {
  if (typeof rawPin !== 'string') {
    return { ok: false, error: 'Staff PIN must be a 4 to 6 digit number.' };
  }
  const clean = rawPin.trim();
  if (!/^\d{4,6}$/.test(clean)) {
    return {
      ok: false,
      error: 'Staff PIN must be between 4 and 6 numeric digits (e.g. 2468).',
    };
  }
  return { ok: true, pin: clean };
}

/**
 * Hashes a 4-6 digit Staff PIN with SHA-256 (salted by the business slug)
 * so Staff PINs are never stored or transmitted in plaintext.
 */
export async function hashStaffPin(
  businessSlug: string,
  pin: string,
): Promise<string> {
  const validation = validateStaffPinFormat(pin);
  if (!validation.ok) {
    throw new Error(validation.error);
  }
  const cleanSlug = stripControlChars(businessSlug).toLowerCase();
  const payload = `vitaran-staff-pin:${cleanSlug}:${validation.pin}`;
  const bytes = new TextEncoder().encode(payload);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  const arr = Array.from(new Uint8Array(digest));
  return arr.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Parses a customer lookup string (either a full `vitaran-loyalty://<slug>/<customerId>` QR token,
 * a customer ID, or a phone/email string).
 */
export function parseCustomerLoyaltyLookup(rawLookup: string): {
  mode: 'qr_token' | 'id_or_contact';
  value: string;
  tokenBusinessSlug?: string;
} {
  const cleaned = stripControlChars(rawLookup);
  const prefix = 'vitaran-loyalty://';
  if (cleaned.toLowerCase().startsWith(prefix)) {
    const rest = cleaned.slice(prefix.length);
    const slashIdx = rest.indexOf('/');
    if (slashIdx !== -1) {
      const tokenBusinessSlug = rest.slice(0, slashIdx).trim().toLowerCase();
      const customerId = rest.slice(slashIdx + 1).trim();
      if (customerId) {
        return {
          mode: 'qr_token',
          value: customerId,
          tokenBusinessSlug,
        };
      }
    }
  }
  return {
    mode: 'id_or_contact',
    value: cleaned,
  };
}

// ===========================================================================
// Master Upgrade: Menu Presets & Optional Table Ordering Validation
// ===========================================================================

export function validateMenuPresetKey(
  rawKey: unknown,
): { ok: true; value: MenuPresetKey } | { ok: false; error: string } {
  if (
    typeof rawKey !== 'string' ||
    !ALLOWED_MENU_PRESET_KEYS.includes(rawKey.trim() as MenuPresetKey)
  ) {
    return {
      ok: false,
      error: `Preset key must be one of: ${ALLOWED_MENU_PRESET_KEYS.join(', ')}.`,
    };
  }
  return { ok: true, value: rawKey.trim() as MenuPresetKey };
}

export function validateTableOrderStatus(
  rawStatus: unknown,
):
  | { ok: true; value: RestaurantTableOrderStatus }
  | { ok: false; error: string } {
  if (
    typeof rawStatus !== 'string' ||
    !ALLOWED_TABLE_ORDER_STATUSES.includes(
      rawStatus.trim() as RestaurantTableOrderStatus,
    )
  ) {
    return {
      ok: false,
      error: `Order status must be one of: ${ALLOWED_TABLE_ORDER_STATUSES.join(', ')}.`,
    };
  }
  return { ok: true, value: rawStatus.trim() as RestaurantTableOrderStatus };
}

export function validateTableOrderItemsInput(
  rawItems: unknown,
):
  | {
      ok: true;
      value: Array<{ itemId: string; quantity: number; notes: string | null }>;
    }
  | { ok: false; error: string } {
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    return { ok: false, error: 'Please select at least one dish to order.' };
  }
  if (rawItems.length > 40) {
    return { ok: false, error: 'Maximum of 40 distinct items per table order.' };
  }
  const normalized: Array<{
    itemId: string;
    quantity: number;
    notes: string | null;
  }> = [];

  for (const entry of rawItems) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      return { ok: false, error: 'Each order item must be an object.' };
    }
    const rec = entry as Record<string, unknown>;
    const itemId =
      typeof rec.itemId === 'string' ? stripControlChars(rec.itemId) : '';
    if (!itemId) {
      return { ok: false, error: 'Each order item must specify a valid itemId.' };
    }
    if (
      typeof rec.quantity !== 'number' ||
      !Number.isInteger(rec.quantity) ||
      rec.quantity < 1 ||
      rec.quantity > 25
    ) {
      return {
        ok: false,
        error: 'Each item quantity must be an integer between 1 and 25.',
      };
    }
    let notes: string | null = null;
    if (rec.notes !== undefined && rec.notes !== null) {
      if (typeof rec.notes !== 'string') {
        return { ok: false, error: 'Item notes must be text.' };
      }
      notes = stripControlChars(rec.notes).slice(0, 160) || null;
    }
    normalized.push({ itemId, quantity: rec.quantity, notes });
  }

  return { ok: true, value: normalized };
}
