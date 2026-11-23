import type {
  RestaurantCurrencyCode,
  RestaurantMenuCategory,
  RestaurantMenuItem,
} from './restaurant';

export type CafeInventoryCategory =
  | 'beans'
  | 'milk_dairy'
  | 'syrups_flavors'
  | 'cups_packaging'
  | 'bakery_food'
  | 'other';

export type CafeInventoryUnit =
  | 'kg'
  | 'g'
  | 'liters'
  | 'ml'
  | 'bottles'
  | 'pcs'
  | 'packs';

export type CafeInventoryActionType = 'restock' | 'usage' | 'wastage';

export type CafeRewardRedemptionType =
  | 'stamp_free_drink'
  | 'birthday_free_coffee';

export type CafeCounterOrderStatus =
  | 'queued'
  | 'preparing'
  | 'ready'
  | 'picked_up'
  | 'cancelled';

export interface CafeConfig {
  businessId: string;
  stampsRequired: number;
  rewardDrinkName: string;
  birthdayFreeCoffeeEnabled: boolean;
  birthdayDrinkName: string;
  counterQrSecret: string;
  upiId: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface CafeConfigInput {
  stampsRequired: number;
  rewardDrinkName: string;
  birthdayFreeCoffeeEnabled: boolean;
  birthdayDrinkName: string;
  upiId?: string | null;
}

export interface CafeStampPass {
  id: string;
  businessId: string;
  passCode: string;
  customerName: string;
  phone: string;
  birthMonth: number | null;
  birthDay: number | null;
  currentStamps: number;
  lifetimeStamps: number;
  freeDrinksAvailable: number;
  lastBirthdayRedeemedYear: number | null;
  lastStampedAt: string | null;
  isBirthdayToday: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CafeInventoryItem {
  id: string;
  businessId: string;
  itemName: string;
  category: CafeInventoryCategory;
  unit: CafeInventoryUnit;
  currentStock: number;
  lowStockThreshold: number;
  unitCostPaise: number;
  supplierNote: string | null;
  updatedAt: string;
}

export interface CafeInventoryItemInput {
  itemName: string;
  category: CafeInventoryCategory;
  unit: CafeInventoryUnit;
  currentStock: number;
  lowStockThreshold: number;
  unitCostPaise: number;
  supplierNote?: string | null;
}

export interface CafeInventoryLog {
  id: string;
  businessId: string;
  inventoryItemId: string;
  itemName?: string;
  unit?: CafeInventoryUnit;
  actionType: CafeInventoryActionType;
  quantityDelta: number;
  costPaise: number;
  note: string | null;
  loggedBy: string | null;
  createdAt: string;
}

export interface CafeCounterOrderItem {
  itemId: string;
  name: string;
  quantity: number;
  pricePaise: number;
}

export interface CafeCounterOrder {
  id: string;
  businessId: string;
  orderDate: string;
  tokenCode: string;
  customerName: string;
  phone: string | null;
  items: CafeCounterOrderItem[];
  subtotalPaise: number;
  status: CafeCounterOrderStatus;
  orderNote: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PublicCafeHubPayload {
  business: {
    id: string;
    name: string;
    slug: string;
    city: string;
    category: string;
  };
  config: Omit<CafeConfig, 'counterQrSecret'>;
  currencyCode: RestaurantCurrencyCode;
  tagline: string | null;
  pass: CafeStampPass | null;
  categories: RestaurantMenuCategory[];
  items: RestaurantMenuItem[];
  todayOrders: CafeCounterOrder[];
}

export interface ClaimCafeStampResponse {
  pass: CafeStampPass;
  justUnlockedFreeDrink: boolean;
  stampsRequired: number;
}

export interface CafeOwnerDashboardPayload {
  config: CafeConfig;
  passes: CafeStampPass[];
  inventoryItems: CafeInventoryItem[];
  inventoryLogs: CafeInventoryLog[];
  counterOrders: CafeCounterOrder[];
  stats: {
    lowStockCount: number;
    activeStampHolders: number;
    stampsIssuedToday: number;
    counterOrdersToday: number;
    birthdaysTodayCount: number;
  };
}
