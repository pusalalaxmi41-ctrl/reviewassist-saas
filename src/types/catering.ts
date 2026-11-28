import type { Business } from './business';

export type CateringMealSession =
  | 'breakfast'
  | 'lunch'
  | 'high_tea'
  | 'dinner'
  | 'all_day';

export type CateringDishCategory =
  | 'starter'
  | 'main_course'
  | 'rice_bread'
  | 'dessert'
  | 'beverage'
  | 'live_counter';

export type CateringDietType = 'veg' | 'non_veg';

export type CateringBulkUnit = 'kg' | 'litres' | 'tray' | 'pieces';

export type CateringIntakeChannel =
  | 'online_link'
  | 'website_embed'
  | 'phone_desk'
  | 'walk_in';

export type CateringServiceMode =
  | 'self_pickup'
  | 'drop_off'
  | 'full_service';

export type CateringOrderStatus =
  | 'quote_pending'
  | 'advance_confirmed'
  | 'prep_started'
  | 'cooking'
  | 'dispatched'
  | 'completed'
  | 'cancelled';

export type CateringPaymentStage = 'stage_1' | 'stage_2' | 'stage_3' | 'extra';

export type CateringPaymentMethod = 'upi' | 'cash' | 'bank_transfer';

export interface CateringHallAddonItem {
  id: string;
  label: string;
  pricePaise: number;
  enabled: boolean;
}

export interface CateringServiceRates {
  waiterPerStaffPaise: number;
  chefOnsitePaise: number;
  transportPaise: number;
  setupTeardownPaise: number;
  equipmentRentalPaise: number;
}

export interface CateringConfig {
  businessId: string;
  minHeadcount: number;
  maxCapacityPerEvent: number;
  minAdvanceHours: number;
  cutoffHoursBeforeEvent: number;
  serviceZones: string[];
  blackoutDates: string[];
  banquetHallEnabled: boolean;
  hallName: string;
  hallSlots: string[];
  hallAddonsCatalog: CateringHallAddonItem[];
  serviceRatesJson: CateringServiceRates;
  chefStationPin?: string;
  defaultWastagePercent: number;
  brandLogoUrl: string | null;
  primaryAccentHex: string;
  secondarySurfaceHex: string;
  whatsappQuoteTemplate: string;
  updatedAt: string;
}

export type CateringConfigInput = Omit<
  CateringConfig,
  'businessId' | 'updatedAt'
>;

export interface CateringPackageSlotRule {
  category: CateringDishCategory;
  label: string;
  maxSelect: number;
}

export interface CateringPackage {
  id: string;
  businessId: string;
  packageName: string;
  tierBadge: string;
  mealSession: CateringMealSession;
  vegPricePaise: number;
  nonVegPricePaise: number;
  slotRules: CateringPackageSlotRule[];
  description: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface CateringPackageInput {
  id?: string;
  packageName: string;
  tierBadge: string;
  mealSession: CateringMealSession;
  vegPricePaise: number;
  nonVegPricePaise: number;
  slotRules: CateringPackageSlotRule[];
  description?: string | null;
  isActive?: boolean;
}

export interface CateringRecipeIngredient {
  ingredientName: string;
  unit: string;
  qtyPer100: number;
}

export interface CateringDishAndRecipe {
  id: string;
  businessId: string;
  dishName: string;
  category: CateringDishCategory;
  dietType: CateringDietType;
  availableInPackages: boolean;
  availableBulkAlacarte: boolean;
  bulkUnit: CateringBulkUnit;
  bulkUnitPricePaise: number;
  ingredientsPer100Plates: CateringRecipeIngredient[];
  isActive: boolean;
  createdAt: string;
}

export interface CateringDishAndRecipeInput {
  id?: string;
  dishName: string;
  category: CateringDishCategory;
  dietType: CateringDietType;
  availableInPackages: boolean;
  availableBulkAlacarte: boolean;
  bulkUnit: CateringBulkUnit;
  bulkUnitPricePaise: number;
  ingredientsPer100Plates: CateringRecipeIngredient[];
  isActive?: boolean;
}

export interface CateringSelectedPackageDish {
  dishId: string;
  dishName: string;
  dietType: CateringDietType;
  category: CateringDishCategory;
}

export interface CateringBulkAlacarteLine {
  dishId: string;
  dishName: string;
  dietType: CateringDietType;
  unit: CateringBulkUnit;
  quantity: number;
  unitPricePaise: number;
}

export interface CateringSelectedHallAddon {
  id: string;
  label: string;
  pricePaise: number;
}

export interface CateringPaymentLedgerEntry {
  stage: CateringPaymentStage;
  amountPaise: number;
  method: CateringPaymentMethod;
  paidAt: string;
  note?: string | null;
}

export interface CateringKitchenChecklist {
  ingredientsProcured: boolean;
  prepCompleted: boolean;
  cookingCompleted: boolean;
  packedWithLabels: boolean;
  dispatched: boolean;
}

export interface CateringVesselDispatchLine {
  itemName: string;
  qtySent: number;
  qtyReturned: number;
}

export interface CateringOrder {
  id: string;
  businessId: string;
  orderCode: string;
  intakeChannel: CateringIntakeChannel;
  customerName: string;
  customerPhone: string;
  occasionType: string;
  eventDate: string;
  deliveryTime: string;
  serviceMode: CateringServiceMode;
  serviceZone: string | null;
  venueAddress: string | null;
  usesBanquetHall: boolean;
  hallSlot: string | null;
  packageId: string | null;
  packageNameSnapshot: string | null;
  vegPlates: number;
  vegRatePaise: number;
  nonVegPlates: number;
  nonVegRatePaise: number;
  extraPlatesAdded: number;
  selectedPackageDishes: CateringSelectedPackageDish[];
  bulkAlacarteItems: CateringBulkAlacarteLine[];
  selectedHallAddons: CateringSelectedHallAddon[];
  serviceStaffChargesPaise: number;
  subtotalPaise: number;
  gstPaise: number;
  totalAmountPaise: number;
  stage1AdvancePaise: number;
  stage2PreeventPaise: number;
  stage3BalancePaise: number;
  amountPaidPaise: number;
  balanceDuePaise: number;
  paymentLedger: CateringPaymentLedgerEntry[];
  orderStatus: CateringOrderStatus;
  kitchenChecklist: CateringKitchenChecklist;
  vesselsDispatched: CateringVesselDispatchLine[];
  vesselsAllReturned: boolean;
  chefNotes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SubmitCateringOrderInput {
  businessSlug: string;
  intakeChannel?: CateringIntakeChannel;
  customerName: string;
  customerPhone: string;
  occasionType?: string;
  eventDate: string;
  deliveryTime: string;
  serviceMode: CateringServiceMode;
  serviceZone?: string | null;
  venueAddress?: string | null;
  usesBanquetHall?: boolean;
  hallSlot?: string | null;
  packageId?: string | null;
  vegPlates: number;
  nonVegPlates: number;
  selectedDishIds?: string[];
  bulkItems?: Array<{ dishId: string; quantity: number }>;
  selectedHallAddonIds?: string[];
  waitersRequested?: number;
  onsiteChefRequested?: boolean;
  gstRatePercent?: number;
  chefNotes?: string | null;
}

export interface CateringBookedHallSlot {
  eventDate: string;
  hallSlot: string;
  orderCode: string;
}

export interface PublicCateringPortalPayload {
  business: Pick<
    Business,
    'id' | 'name' | 'slug' | 'city' | 'category' | 'googleReviewUrl'
  >;
  config: Omit<CateringConfig, 'chefStationPin'>;
  packages: CateringPackage[];
  dishes: CateringDishAndRecipe[];
  bookedHallSlots: CateringBookedHallSlot[];
}

export interface CateringGroceryRequirement {
  ingredientName: string;
  unit: string;
  baseQty: number;
  wastagePercent: number;
  totalQtyWithWastage: number;
  sourceDishes: string[];
}

/**
 * Restricted Head Chef View Event — strictly ZERO customer phone numbers,
 * ZERO ₹ rates/totals, and ZERO payment or margin fields.
 */
export interface CateringChefSanitizedOrder {
  id: string;
  orderCode: string;
  occasionType: string;
  eventDate: string;
  deliveryTime: string;
  serviceMode: CateringServiceMode;
  usesBanquetHall: boolean;
  hallSlot: string | null;
  packageNameSnapshot: string | null;
  vegPlates: number;
  nonVegPlates: number;
  extraPlatesAdded: number;
  totalPlates: number;
  selectedPackageDishes: CateringSelectedPackageDish[];
  bulkAlacarteItems: Array<{
    dishId: string;
    dishName: string;
    dietType: CateringDietType;
    unit: CateringBulkUnit;
    quantity: number;
  }>;
  orderStatus: CateringOrderStatus;
  kitchenChecklist: CateringKitchenChecklist;
  vesselsDispatched: CateringVesselDispatchLine[];
  vesselsAllReturned: boolean;
  chefNotes: string | null;
}

export interface CateringChefKitchenPortalPayload {
  businessName: string;
  hallName: string;
  defaultWastagePercent: number;
  dateFrom: string;
  dateTo: string;
  events: CateringChefSanitizedOrder[];
  groceryList: CateringGroceryRequirement[];
}

export interface CateringOwnerDashboardPayload {
  config: CateringConfig;
  kpis: {
    upcomingEventsCount: number;
    confirmedRevenuePaise: number;
    pendingStageBalancesPaise: number;
    unreturnedVesselAlertsCount: number;
  };
  orders: CateringOrder[];
  packages: CateringPackage[];
  dishes: CateringDishAndRecipe[];
  groceryList: CateringGroceryRequirement[];
}
