import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  Building2,
  Calendar,
  Check,
  CheckCircle2,
  ChefHat,
  ClipboardCheck,
  Copy,
  Download,
  ExternalLink,
  KeyRound,
  Lock,
  MessageCircle,
  Package,
  Plus,
  Printer,
  QrCode,
  RefreshCw,
  Settings,
  ShoppingBag,
  Sparkles,
  Trash2,
  UtensilsCrossed,
  Wallet,
  X,
} from 'lucide-react';
import type { Business } from '../types/business';
import type {
  CateringBulkUnit,
  CateringChefKitchenPortalPayload,
  CateringConfig,
  CateringConfigInput,
  CateringDietType,
  CateringDishCategory,
  CateringKitchenChecklist,
  CateringOrder,
  CateringOrderStatus,
  CateringOwnerDashboardPayload,
  CateringPaymentMethod,
  CateringPaymentStage,
  CateringRecipeIngredient,
  CateringServiceMode,
  CateringVesselDispatchLine,
} from '../types/catering';
import { businessRepository } from '../services/storage';
import {
  ALLOWED_CATERING_ORDER_STATUSES,
  buildCateringWhatsAppQuoteLink,
  CATERING_DISH_CATEGORY_LABELS,
  CATERING_OCCASION_PRESETS,
  computeCateringGroceryShoppingList,
  DEFAULT_PACKAGE_SLOT_RULES,
  formatCateringRupees,
  getCateringPortalUrl,
} from '../utils/cateringValidation';
import { QRPosterGenerator } from './dashboard/QRPosterGenerator';
import { CustomerDraftsView } from './dashboard/CustomerDraftsView';
import { GoogleUrlSettings } from './dashboard/GoogleUrlSettings';

type CateringNavTab =
  | 'events'
  | 'packages'
  | 'grocery'
  | 'rules'
  | 'qr_reviews';

interface Props {
  business: Business;
  allBusinesses: Business[];
  onSelectBusiness: (slug: string) => void;
  onBusinessUpdated: (updated: Business) => void;
}

function getTodayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDaysIso(baseIso: string, days: number): string {
  const d = new Date(`${baseIso}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function CateringManagerView({
  business,
  allBusinesses,
  onSelectBusiness,
  onBusinessUpdated,
}: Props) {
  const [activeTab, setActiveTab] = useState<CateringNavTab>('events');
  const [loading, setLoading] = useState(true);
  const [dashboard, setDashboard] =
    useState<CateringOwnerDashboardPayload | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<
    Awaited<ReturnType<typeof businessRepository.getDrafts>>
  >([]);

  // Expandable Order Command Drawer
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [dateFilter, setDateFilter] = useState<string>('');
  const [printOrderModal, setPrintOrderModal] = useState<{
    order: CateringOrder;
    mode: 'invoice' | 'kot';
  } | null>(null);

  // Payment & Extra Plates state per expanded order
  const [payStage, setPayStage] = useState<CateringPaymentStage>('stage_1');
  const [payAmountRupees, setPayAmountRupees] = useState<string>('');
  const [payMethod, setPayMethod] = useState<CateringPaymentMethod>('upi');
  const [payNote, setPayNote] = useState<string>('');
  const [extraPlatesInput, setExtraPlatesInput] = useState<number>(20);
  const [newVesselName, setNewVesselName] = useState<string>(
    'Insulated Biryani Handi (25L)',
  );
  const [newVesselSent, setNewVesselSent] = useState<number>(2);

  // 60-Second Phone / Walk-In Order Modal
  const [phoneModalOpen, setPhoneModalOpen] = useState(false);
  const [phoneCustomerName, setPhoneCustomerName] = useState('');
  const [phoneCustomerMobile, setPhoneCustomerMobile] = useState('');
  const [phoneOccasion, setPhoneOccasion] = useState<string>(
    CATERING_OCCASION_PRESETS[0],
  );
  const [phoneEventDate, setPhoneEventDate] = useState<string>(() =>
    addDaysIso(getTodayIso(), 3),
  );
  const [phoneDeliveryTime, setPhoneDeliveryTime] = useState('12:30 PM');
  const [phoneServiceMode, setPhoneServiceMode] =
    useState<CateringServiceMode>('full_service');
  const [phoneUsesHall, setPhoneUsesHall] = useState(false);
  const [phoneHallSlot, setPhoneHallSlot] = useState('');
  const [phonePackageId, setPhonePackageId] = useState('');
  const [phoneVegPlates, setPhoneVegPlates] = useState(100);
  const [phoneNonVegPlates, setPhoneNonVegPlates] = useState(50);
  const [phoneSelectedDishIds, setPhoneSelectedDishIds] = useState<string[]>(
    [],
  );
  const [phoneAddonIds, setPhoneAddonIds] = useState<string[]>([]);
  const [phoneNotes, setPhoneNotes] = useState('');
  const [phoneSubmitting, setPhoneSubmitting] = useState(false);

  // Packages & Recipes Tab Forms
  const [pkgName, setPkgName] = useState('');
  const [pkgTier, setPkgTier] = useState('Gold');
  const [pkgVegRupees, setPkgVegRupees] = useState('380');
  const [pkgNonVegRupees, setPkgNonVegRupees] = useState('520');
  const [pkgDesc, setPkgDesc] = useState('');

  const [dishName, setDishName] = useState('');
  const [dishCategory, setDishCategory] =
    useState<CateringDishCategory>('main_course');
  const [dishDiet, setDishDiet] = useState<CateringDietType>('veg');
  const [dishInPkg, setDishInPkg] = useState(true);
  const [dishInBulk, setDishInBulk] = useState(true);
  const [dishBulkUnit, setDishBulkUnit] = useState<CateringBulkUnit>('kg');
  const [dishBulkRupees, setDishBulkRupees] = useState('480');
  const [dishIngredients, setDishIngredients] = useState<
    CateringRecipeIngredient[]
  >([
    { ingredientName: 'Basmati Rice', unit: 'kg', qtyPer100: 15 },
    { ingredientName: 'Pure Ghee', unit: 'litres', qtyPer100: 2.5 },
  ]);

  // Grocery & Stock Calculator Tab
  const [groceryFrom, setGroceryFrom] = useState<string>(() => getTodayIso());
  const [groceryTo, setGroceryTo] = useState<string>(() =>
    addDaysIso(getTodayIso(), 14),
  );
  const [wastagePct, setWastagePct] = useState<number>(5);
  const [manualQtyOverrides, setManualQtyOverrides] = useState<
    Record<string, number>
  >({});
  const [purchasedItems, setPurchasedItems] = useState<Record<string, boolean>>(
    {},
  );

  // Banquet Hall & Rules Config Form
  const [cfgDraft, setCfgDraft] = useState<CateringConfigInput | null>(null);
  const [newBlackoutDate, setNewBlackoutDate] = useState('');
  const [savingConfig, setSavingConfig] = useState(false);

  // Restricted Head Chef PIN Portal State (Surface 3)
  const [chefPinModalOpen, setChefPinModalOpen] = useState(false);
  const [chefPinInput, setChefPinInput] = useState('');
  const [unlockedChefPin, setUnlockedChefPin] = useState<string | null>(null);
  const [chefPortal, setChefPortal] =
    useState<CateringChefKitchenPortalPayload | null>(null);
  const [chefDateFrom, setChefDateFrom] = useState<string>(() => getTodayIso());
  const [chefDateTo, setChefDateTo] = useState<string>(() =>
    addDaysIso(getTodayIso(), 14),
  );

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3200);
  }, []);

  const loadOwnerData = useCallback(async () => {
    try {
      const [dash, bizDrafts] = await Promise.all([
        businessRepository.getCateringOwnerDashboard(business.id),
        businessRepository.getDrafts(business.id),
      ]);
      setErrorMsg(null);
      setDashboard(dash);
      setDrafts(bizDrafts);
      setWastagePct(dash.config.defaultWastagePercent);
      const { businessId: _b, updatedAt: _u, ...editable } = dash.config;
      void _b;
      void _u;
      setCfgDraft({
        ...editable,
        chefStationPin: dash.config.chefStationPin ?? '4321',
      });
      setPhoneHallSlot((prev) =>
        prev || (dash.config.hallSlots.length > 0 ? dash.config.hallSlots[0] : ''),
      );
      if (dash.packages.length > 0) {
        setPhonePackageId((prev) => prev || dash.packages[0].id);
        setPhoneSelectedDishIds((prev) =>
          prev.length > 0
            ? prev
            : dash.dishes
                .filter((d) => d.availableInPackages)
                .slice(0, 4)
                .map((d) => d.id),
        );
      }
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'Failed to load CateringOS workspace.',
      );
    } finally {
      setLoading(false);
    }
  }, [business.id]);

  useEffect(() => {
    let active = true;
    async function initWorkspace() {
      const [dash, bizDrafts] = await Promise.all([
        businessRepository.getCateringOwnerDashboard(business.id),
        businessRepository.getDrafts(business.id),
      ]);
      if (!active) return;
      setDashboard(dash);
      setDrafts(bizDrafts);
      setWastagePct(dash.config.defaultWastagePercent);
      const { businessId: _b, updatedAt: _u, ...editable } = dash.config;
      void _b;
      void _u;
      setCfgDraft({
        ...editable,
        chefStationPin: dash.config.chefStationPin ?? '4321',
      });
      if (dash.config.hallSlots.length > 0) {
        setPhoneHallSlot((prev) => prev || dash.config.hallSlots[0]);
      }
      if (dash.packages.length > 0) {
        setPhonePackageId((prev) => prev || dash.packages[0].id);
        setPhoneSelectedDishIds((prev) =>
          prev.length > 0
            ? prev
            : dash.dishes
                .filter((d) => d.availableInPackages)
                .slice(0, 4)
                .map((d) => d.id),
        );
      }
      setLoading(false);
    }
    initWorkspace().catch((err) => {
      if (!active) return;
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'Failed to load CateringOS workspace.',
      );
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [business.id]);

  const refreshChefPortal = useCallback(
    async (pin: string, fromDate = chefDateFrom, toDate = chefDateTo) => {
      const data = await businessRepository.getCateringChefKitchenPortal({
        businessId: business.id,
        chefPin: pin,
        dateFrom: fromDate,
        dateTo: toDate,
      });
      setChefPortal(data);
    },
    [business.id, chefDateFrom, chefDateTo],
  );

  async function handleUnlockChefPortal(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    try {
      await refreshChefPortal(chefPinInput.trim());
      setUnlockedChefPin(chefPinInput.trim());
      setChefPinModalOpen(false);
      setChefPinInput('');
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Invalid Head Chef PIN.',
      );
    }
  }

  const config: CateringConfig | null = dashboard?.config ?? null;
  const accentHex = config?.primaryAccentHex || '#D4AF37';
  const obsidianHex = config?.secondarySurfaceHex || '#0F1115';

  const filteredOrders = useMemo(() => {
    if (!dashboard) return [];
    if (!dateFilter) return dashboard.orders;
    return dashboard.orders.filter((o) => o.eventDate === dateFilter);
  }, [dashboard, dateFilter]);

  const computedGroceryRows = useMemo(() => {
    if (!dashboard) return [];
    const rangeOrders = dashboard.orders.filter(
      (o) =>
        o.orderStatus !== 'cancelled' &&
        o.eventDate >= groceryFrom &&
        o.eventDate <= groceryTo,
    );
    return computeCateringGroceryShoppingList({
      orders: rangeOrders,
      dishesCatalog: dashboard.dishes,
      wastagePercent: wastagePct,
    });
  }, [dashboard, groceryFrom, groceryTo, wastagePct]);

  async function handleCreatePhoneOrder(e: React.FormEvent) {
    e.preventDefault();
    setPhoneSubmitting(true);
    setErrorMsg(null);
    try {
      const created = await businessRepository.submitCateringOrder(
        {
          businessSlug: business.slug,
          intakeChannel: 'phone_desk',
          customerName: phoneCustomerName,
          customerPhone: phoneCustomerMobile,
          occasionType: phoneOccasion,
          eventDate: phoneEventDate,
          deliveryTime: phoneDeliveryTime,
          serviceMode: phoneServiceMode,
          usesBanquetHall: phoneUsesHall,
          hallSlot: phoneUsesHall ? phoneHallSlot : null,
          packageId: phonePackageId || null,
          vegPlates: phoneVegPlates,
          nonVegPlates: phoneNonVegPlates,
          selectedDishIds: phoneSelectedDishIds,
          selectedHallAddonIds: phoneAddonIds,
          chefNotes: phoneNotes || null,
        },
        { actorOwnerId: business.ownerId },
      );
      setPhoneModalOpen(false);
      setPhoneCustomerName('');
      setPhoneCustomerMobile('');
      setPhoneNotes('');
      setExpandedOrderId(created.id);
      showToast(`Created order ${created.orderCode} cleanly!`);
      await loadOwnerData();
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Could not create phone booking.',
      );
    } finally {
      setPhoneSubmitting(false);
    }
  }

  async function handleRecordPayment(order: CateringOrder) {
    const rupees = Number(payAmountRupees);
    const amountPaise =
      rupees > 0
        ? Math.round(rupees * 100)
        : payStage === 'stage_1'
          ? order.stage1AdvancePaise
          : payStage === 'stage_2'
            ? order.stage2PreeventPaise
            : order.balanceDuePaise;

    if (amountPaise <= 0) {
      setErrorMsg('Enter a valid payment amount in ₹.');
      return;
    }
    try {
      await businessRepository.recordCateringStagePayment({
        businessId: business.id,
        orderId: order.id,
        stage: payStage,
        amountPaise,
        method: payMethod,
        note: payNote || null,
        options: { actorOwnerId: business.ownerId },
      });
      setPayAmountRupees('');
      setPayNote('');
      showToast(
        `Recorded ${formatCateringRupees(amountPaise)} (${payMethod.toUpperCase()}) for ${order.orderCode}`,
      );
      await loadOwnerData();
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Failed to record payment.',
      );
    }
  }

  async function handleAddExtraPlates(orderId: string, count: number) {
    try {
      const updated = await businessRepository.addCateringExtraPlates({
        businessId: business.id,
        orderId,
        extraPlates: count,
        options: { actorOwnerId: business.ownerId },
      });
      showToast(
        `Added +${count} extra plates to ${updated.orderCode}. Total updated!`,
      );
      await loadOwnerData();
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Failed to add extra plates.',
      );
    }
  }

  async function handleOwnerUpdateStatusOrVessels(
    order: CateringOrder,
    patch: {
      orderStatus?: CateringOrderStatus;
      vesselsDispatched?: CateringVesselDispatchLine[];
      kitchenChecklist?: CateringKitchenChecklist;
    },
  ) {
    try {
      await businessRepository.updateCateringKitchenAndVessels({
        businessId: business.id,
        orderId: order.id,
        orderStatus: patch.orderStatus,
        vesselsDispatched: patch.vesselsDispatched,
        kitchenChecklist: patch.kitchenChecklist,
        options: { actorOwnerId: business.ownerId },
      });
      showToast(`Updated ${order.orderCode}`);
      await loadOwnerData();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Update failed.');
    }
  }

  async function handleChefToggleChecklist(
    orderId: string,
    currentChecklist: CateringKitchenChecklist,
    key: keyof CateringKitchenChecklist,
  ) {
    if (!unlockedChefPin) return;
    const nextChecklist: CateringKitchenChecklist = {
      ...currentChecklist,
      [key]: !currentChecklist[key],
    };
    const nextStatus: CateringOrderStatus | undefined = nextChecklist.dispatched
      ? 'dispatched'
      : nextChecklist.cookingCompleted
        ? 'cooking'
        : nextChecklist.prepCompleted
          ? 'prep_started'
          : undefined;

    await businessRepository.updateCateringKitchenAndVessels({
      businessId: business.id,
      orderId,
      chefPin: unlockedChefPin,
      orderStatus: nextStatus,
      kitchenChecklist: nextChecklist,
    });
    await refreshChefPortal(unlockedChefPin);
    showToast('Kitchen checklist updated!');
  }

  async function handleChefUpdateVesselReturn(
    orderId: string,
    vessels: CateringVesselDispatchLine[],
  ) {
    if (!unlockedChefPin) return;
    await businessRepository.updateCateringKitchenAndVessels({
      businessId: business.id,
      orderId,
      chefPin: unlockedChefPin,
      vesselsDispatched: vessels,
    });
    await refreshChefPortal(unlockedChefPin);
    showToast('Vessel gate-pass updated!');
  }

  async function handleAddPackage(e: React.FormEvent) {
    e.preventDefault();
    try {
      await businessRepository.upsertCateringPackage(
        business.id,
        {
          packageName: pkgName,
          tierBadge: pkgTier,
          mealSession: 'all_day',
          vegPricePaise: Math.round((Number(pkgVegRupees) || 0) * 100),
          nonVegPricePaise: Math.round((Number(pkgNonVegRupees) || 0) * 100),
          slotRules: DEFAULT_PACKAGE_SLOT_RULES,
          description: pkgDesc || null,
          isActive: true,
        },
        { actorOwnerId: business.ownerId },
      );
      setPkgName('');
      setPkgDesc('');
      showToast('Saved catering package!');
      await loadOwnerData();
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Could not save package.',
      );
    }
  }

  async function handleAddDish(e: React.FormEvent) {
    e.preventDefault();
    try {
      await businessRepository.upsertCateringDishAndRecipe(
        business.id,
        {
          dishName,
          category: dishCategory,
          dietType: dishDiet,
          availableInPackages: dishInPkg,
          availableBulkAlacarte: dishInBulk,
          bulkUnit: dishBulkUnit,
          bulkUnitPricePaise: Math.round((Number(dishBulkRupees) || 0) * 100),
          ingredientsPer100Plates: dishIngredients,
          isActive: true,
        },
        { actorOwnerId: business.ownerId },
      );
      setDishName('');
      showToast('Saved dish & per-100-plate recipe!');
      await loadOwnerData();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Could not save dish.');
    }
  }

  async function handleSaveConfig(e: React.FormEvent) {
    e.preventDefault();
    if (!cfgDraft) return;
    setSavingConfig(true);
    setErrorMsg(null);
    try {
      await businessRepository.updateCateringConfig(business.id, cfgDraft, {
        actorOwnerId: business.ownerId,
      });
      showToast('Saved Banquet Hall, Booking Rules & White-Label Settings!');
      await loadOwnerData();
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Could not save settings.',
      );
    } finally {
      setSavingConfig(false);
    }
  }

  function exportGroceryCsv() {
    const lines = [
      'Ingredient,Unit,Base Qty,Wastage %,Final Required Qty,Purchased,Source Dishes',
      ...computedGroceryRows.map((r) => {
        const key = `${r.ingredientName}__${r.unit}`;
        const finalQty =
          manualQtyOverrides[key] !== undefined
            ? manualQtyOverrides[key]
            : r.totalQtyWithWastage;
        const bought = purchasedItems[key] ? 'YES' : 'NO';
        return `"${r.ingredientName}","${r.unit}",${r.baseQty},${r.wastagePercent},${finalQty},${bought},"${r.sourceDishes.join('; ')}"`;
      }),
    ];
    const blob = new Blob([lines.join('\n')], {
      type: 'text/csv;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `catering-grocery-${groceryFrom}-to-${groceryTo}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // =========================================================================
  // SURFACE 3: RESTRICTED HEAD CHEF PIN PORTAL (ZERO FINANCIAL / PHONE VISIBILITY)
  // =========================================================================
  if (unlockedChefPin && chefPortal) {
    return (
      <div
        className="min-h-screen pb-16"
        style={{ backgroundColor: '#FBF9F5' }}
      >
        <header
          className="px-4 sm:px-8 py-5 text-white border-b border-white/10"
          style={{ backgroundColor: obsidianHex }}
        >
          <div className="max-w-6xl mx-auto flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div
                className="w-11 h-11 rounded-2xl flex items-center justify-center font-bold"
                style={{ backgroundColor: accentHex, color: '#0F1115' }}
              >
                <ChefHat className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    Head Chef Kitchen Station · Zero Financial View
                  </span>
                </div>
                <h1 className="text-xl font-bold mt-0.5">
                  {chefPortal.businessName} — Kitchen Production & Dispatch
                </h1>
              </div>
            </div>

            <div className="flex items-center gap-2.5 flex-wrap">
              <input
                type="date"
                value={chefDateFrom}
                onChange={(e) => {
                  setChefDateFrom(e.target.value);
                  void refreshChefPortal(
                    unlockedChefPin,
                    e.target.value,
                    chefDateTo,
                  );
                }}
                className="rounded-xl bg-white/10 border border-white/15 px-3 py-1.5 text-xs font-mono text-white"
              />
              <span className="text-xs text-stone-400">to</span>
              <input
                type="date"
                value={chefDateTo}
                onChange={(e) => {
                  setChefDateTo(e.target.value);
                  void refreshChefPortal(
                    unlockedChefPin,
                    chefDateFrom,
                    e.target.value,
                  );
                }}
                className="rounded-xl bg-white/10 border border-white/15 px-3 py-1.5 text-xs font-mono text-white"
              />
              <button
                type="button"
                onClick={() => {
                  setUnlockedChefPin(null);
                  setChefPortal(null);
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-white/10 hover:bg-white/20 text-white"
              >
                <Lock className="w-3.5 h-3.5" />
                Exit Chef View
              </button>
            </div>
          </div>
        </header>

        {toast && (
          <div className="max-w-6xl mx-auto mt-4 px-4">
            <div className="rounded-xl bg-emerald-900 text-white px-4 py-2.5 text-xs font-semibold">
              {toast}
            </div>
          </div>
        )}

        <main className="max-w-6xl mx-auto px-4 sm:px-8 py-6 grid lg:grid-cols-3 gap-6">
          {/* Left 2 Cols: Event Production Timelines, Dish Counts, Checklists & Vessels */}
          <div className="lg:col-span-2 space-y-4">
            <h2 className="text-base font-bold text-stone-900 flex items-center gap-2">
              <ClipboardCheck className="w-5 h-5 text-amber-700" />
              Upcoming Event Kitchen Orders ({chefPortal.events.length})
            </h2>

            {chefPortal.events.length === 0 ? (
              <div className="bg-white rounded-2xl border border-stone-200 p-8 text-center text-sm text-stone-500">
                No kitchen production events scheduled in this date window.
              </div>
            ) : (
              chefPortal.events.map((ev) => (
                <div
                  key={ev.id}
                  className="bg-white rounded-3xl border border-stone-200 p-5 shadow-sm space-y-4"
                >
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-bold text-sm px-2.5 py-0.5 rounded-lg bg-stone-900 text-amber-300">
                          {ev.orderCode}
                        </span>
                        <span className="text-xs font-bold uppercase px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900">
                          {ev.orderStatus.replace('_', ' ')}
                        </span>
                        <span className="text-xs text-stone-600 font-medium">
                          {ev.occasionType}
                        </span>
                      </div>
                      <div className="text-sm font-bold text-stone-900 mt-1.5">
                        {ev.eventDate} · {ev.deliveryTime} ·{' '}
                        <span className="capitalize">
                          {ev.serviceMode.replace('_', ' ')}
                        </span>
                        {ev.usesBanquetHall && ev.hallSlot
                          ? ` · ${ev.hallSlot}`
                          : ''}
                      </div>
                    </div>

                    {/* Plate Counts Only — ZERO ₹ Rates */}
                    <div className="flex items-center gap-2 font-mono text-xs">
                      <span className="px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 font-bold">
                        Veg: {ev.vegPlates}
                      </span>
                      <span className="px-2.5 py-1 rounded-lg bg-rose-50 border border-rose-200 text-rose-900 font-bold">
                        Non-Veg: {ev.nonVegPlates}
                      </span>
                      {ev.extraPlatesAdded > 0 && (
                        <span className="px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-300 text-amber-900 font-bold">
                          +{ev.extraPlatesAdded} Extra
                        </span>
                      )}
                      <span className="px-2.5 py-1 rounded-lg bg-stone-900 text-white font-bold">
                        Total: {ev.totalPlates}
                      </span>
                    </div>
                  </div>

                  {/* Dishes & Bulk Trays */}
                  <div className="space-y-2">
                    <div className="text-xs font-bold uppercase tracking-wider text-stone-500">
                      Menu Production List{' '}
                      {ev.packageNameSnapshot
                        ? `(${ev.packageNameSnapshot})`
                        : ''}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {ev.selectedPackageDishes.map((d) => (
                        <span
                          key={d.dishId}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-semibold bg-stone-100 text-stone-900"
                        >
                          <span
                            className={`w-2 h-2 rounded-full ${
                              d.dietType === 'veg'
                                ? 'bg-emerald-600'
                                : 'bg-rose-600'
                            }`}
                          />
                          {d.dishName}
                        </span>
                      ))}
                      {ev.bulkAlacarteItems.map((b) => (
                        <span
                          key={b.dishId}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold bg-amber-50 border border-amber-200 text-amber-950 font-mono"
                        >
                          {b.dishName}: {b.quantity} {b.unit}
                        </span>
                      ))}
                    </div>
                  </div>

                  {ev.chefNotes && (
                    <div className="rounded-xl bg-amber-50 border border-amber-200 px-3.5 py-2 text-xs text-amber-950">
                      <strong>Kitchen Note:</strong> {ev.chefNotes}
                    </div>
                  )}

                  {/* 5-Step Kitchen Production Checklist */}
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-1">
                    {(
                      [
                        ['ingredientsProcured', '1. Procured'],
                        ['prepCompleted', '2. Prep Done'],
                        ['cookingCompleted', '3. Cooked'],
                        ['packedWithLabels', '4. Packed'],
                        ['dispatched', '5. Dispatched'],
                      ] as const
                    ).map(([k, label]) => {
                      const done = ev.kitchenChecklist[k];
                      return (
                        <button
                          key={k}
                          type="button"
                          onClick={() =>
                            void handleChefToggleChecklist(
                              ev.id,
                              ev.kitchenChecklist,
                              k,
                            )
                          }
                          className={`rounded-xl border px-2.5 py-2 text-xs font-bold flex items-center justify-center gap-1.5 transition ${
                            done
                              ? 'border-emerald-600 bg-emerald-600 text-white'
                              : 'border-stone-200 bg-stone-50 text-stone-700 hover:border-stone-400'
                          }`}
                        >
                          {done && <Check className="w-3.5 h-3.5" />}
                          {label}
                        </button>
                      );
                    })}
                  </div>

                  {/* Vessel Dispatch & Return Gate-Pass */}
                  {ev.vesselsDispatched.length > 0 && (
                    <div className="pt-2 border-t border-stone-100 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-stone-700">
                          Hot-Box & Vessel Gate-Pass
                        </span>
                        <span
                          className={`font-bold ${
                            ev.vesselsAllReturned
                              ? 'text-emerald-700'
                              : 'text-rose-600'
                          }`}
                        >
                          {ev.vesselsAllReturned
                            ? 'All Vessels Returned ✓'
                            : 'Pending Vessel Return'}
                        </span>
                      </div>
                      {ev.vesselsDispatched.map((v, vIdx) => (
                        <div
                          key={`${v.itemName}-${vIdx}`}
                          className="flex items-center justify-between text-xs bg-stone-50 rounded-xl px-3 py-2"
                        >
                          <span className="font-medium text-stone-800">
                            {v.itemName} (Sent: {v.qtySent})
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="font-mono">
                              Returned: {v.qtyReturned}/{v.qtySent}
                            </span>
                            {v.qtyReturned < v.qtySent && (
                              <button
                                type="button"
                                onClick={() => {
                                  const next = ev.vesselsDispatched.map(
                                    (item, idx) =>
                                      idx === vIdx
                                        ? { ...item, qtyReturned: item.qtySent }
                                        : item,
                                  );
                                  void handleChefUpdateVesselReturn(
                                    ev.id,
                                    next,
                                  );
                                }}
                                className="px-2 py-1 rounded-lg bg-emerald-700 text-white font-bold"
                              >
                                Mark Returned
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Right Col: Scaled Raw Grocery Sheet (Quantities Only, Zero ₹ Costs) */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-stone-900 flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-amber-700" />
                Scaled Raw Material Sheet
              </h2>
              <button
                type="button"
                onClick={() => window.print()}
                className="text-xs font-bold text-stone-700 hover:text-stone-900 inline-flex items-center gap-1"
              >
                <Printer className="w-3.5 h-3.5" /> Print
              </button>
            </div>

            <div className="bg-white rounded-3xl border border-stone-200 p-5 shadow-sm space-y-3">
              <div className="text-xs text-stone-500">
                Includes <strong>{chefPortal.defaultWastagePercent}%</strong>{' '}
                wastage buffer across {chefPortal.events.length} scheduled
                event(s).
              </div>
              {chefPortal.groceryList.length === 0 ? (
                <p className="text-xs text-stone-500 py-4 text-center">
                  No recipe ingredients required in this window.
                </p>
              ) : (
                <div className="divide-y divide-stone-100">
                  {chefPortal.groceryList.map((g) => (
                    <div
                      key={`${g.ingredientName}-${g.unit}`}
                      className="py-2.5 flex items-center justify-between gap-2"
                    >
                      <div>
                        <div className="text-sm font-semibold text-stone-900">
                          {g.ingredientName}
                        </div>
                        <div className="text-[11px] text-stone-500">
                          {g.sourceDishes.join(', ')}
                        </div>
                      </div>
                      <div className="font-mono font-bold text-sm text-stone-900 shrink-0">
                        {g.totalQtyWithWastage} {g.unit}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    );
  }

  // =========================================================================
  // SURFACE 2: OWNER BANQUET & REVENUE COMMAND CENTER
  // =========================================================================
  const publicBookingUrl = getCateringPortalUrl(business.slug);
  const embedUrl = getCateringPortalUrl(business.slug, undefined, true);
  const iframeSnippet = `<iframe src="${embedUrl}" width="100%" height="820" style="border:0;border-radius:20px;" title="${business.name} Catering & Banquet Booking"></iframe>`;

  return (
    <div
      className="flex min-h-[calc(100vh-52px)] w-full flex-col lg:flex-row"
      style={{ backgroundColor: '#FBF9F5' }}
    >
      {/* DEEP OBSIDIAN LEFT SIDEBAR */}
      <aside
        className="w-full lg:w-[248px] lg:shrink-0 text-white flex flex-col justify-between lg:sticky lg:top-[52px] lg:h-[calc(100vh-52px)] lg:overflow-y-auto"
        style={{ backgroundColor: obsidianHex }}
      >
        <div className="p-4 space-y-5">
          {/* Property Switcher */}
          <div className="space-y-1.5 border-b border-white/10 pb-4">
            <div className="flex items-center justify-between text-[11px] uppercase tracking-wider text-stone-400">
              <span>CateringOS Venue</span>
              <Link
                to="/setup?type=catering"
                className="font-bold hover:underline"
                style={{ color: accentHex }}
              >
                + New
              </Link>
            </div>
            <select
              value={business.slug}
              onChange={(e) => onSelectBusiness(e.target.value)}
              className="w-full rounded-xl bg-white/10 border border-white/15 px-3 py-2 text-xs font-semibold text-white focus:outline-none"
            >
              {allBusinesses.map((b) => (
                <option key={b.id} value={b.slug} className="text-stone-900">
                  {b.name} ({b.city})
                </option>
              ))}
            </select>
          </div>

          {/* 5 Executive Tabs */}
          <nav className="space-y-1">
            {(
              [
                {
                  id: 'events',
                  label: 'Events & Calendar',
                  icon: Calendar,
                },
                {
                  id: 'packages',
                  label: 'Packages & Recipes',
                  icon: UtensilsCrossed,
                },
                {
                  id: 'grocery',
                  label: 'Grocery & Stock',
                  icon: ShoppingBag,
                },
                {
                  id: 'rules',
                  label: 'Banquet Hall & Rules',
                  icon: Settings,
                },
                {
                  id: 'qr_reviews',
                  label: 'AI Reviews & Standee',
                  icon: QrCode,
                },
              ] as const
            ).map((item) => {
              const Icon = item.icon;
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-bold transition ${
                    active
                      ? 'shadow-sm'
                      : 'text-stone-300 hover:bg-white/5 hover:text-white'
                  }`}
                  style={
                    active
                      ? { backgroundColor: accentHex, color: '#0F1115' }
                      : undefined
                  }
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Restricted Head Chef PIN Station Launcher */}
          <div className="pt-3 border-t border-white/10 space-y-2">
            <button
              type="button"
              onClick={() => setChefPinModalOpen(true)}
              className="w-full flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-bold bg-white/10 hover:bg-white/15 border border-white/15 text-amber-300 transition"
            >
              <ChefHat className="w-4 h-4" />
              👨‍🍳 Switch to Head Chef PIN View
            </button>
            <a
              href={publicBookingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-stone-300 hover:text-white hover:bg-white/5"
            >
              Open Public Catering Link
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      </aside>

      {/* MAIN COMMAND WORKSPACE */}
      <main className="flex-1 min-w-0 p-4 sm:p-7 space-y-6">
        {/* Top Banner + Actions */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2">
              <span
                className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full"
                style={{ backgroundColor: accentHex, color: '#0F1115' }}
              >
                CateringOS & Banquet Command
              </span>
              {config?.banquetHallEnabled && (
                <span className="text-xs font-medium text-stone-600 flex items-center gap-1">
                  <Building2 className="w-3.5 h-3.5 text-amber-700" />
                  {config.hallName}
                </span>
              )}
            </div>
            <h1 className="text-2xl font-bold text-stone-900 mt-1">
              {business.name}
            </h1>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              type="button"
              onClick={() => void loadOwnerData()}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-stone-300 bg-white text-xs font-semibold text-stone-700 hover:bg-stone-50"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Refresh
            </button>
            <button
              type="button"
              onClick={() => setPhoneModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold shadow-sm transition hover:opacity-95"
              style={{ backgroundColor: accentHex, color: '#0F1115' }}
            >
              <Plus className="w-4 h-4" />
              New Phone / Walk-In Order
            </button>
          </div>
        </div>

        {toast && (
          <div className="rounded-2xl bg-stone-900 text-amber-300 px-4 py-3 text-xs font-bold flex items-center gap-2 shadow-sm">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{toast}</span>
          </div>
        )}

        {errorMsg && (
          <div className="rounded-2xl border border-rose-300 bg-rose-50 px-4 py-3 text-xs font-semibold text-rose-900 flex items-center justify-between gap-2">
            <span className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              {errorMsg}
            </span>
            <button type="button" onClick={() => setErrorMsg(null)}>
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* 4 EXECUTIVE KPI CARDS */}
        {dashboard && (
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
            <div className="bg-white rounded-2xl border border-stone-200 p-4 shadow-sm">
              <div className="text-xs font-semibold text-stone-500">
                Upcoming Events
              </div>
              <div className="text-2xl font-bold font-mono text-stone-900 mt-1">
                {dashboard.kpis.upcomingEventsCount}
              </div>
              <div className="text-[11px] text-stone-500 mt-0.5">
                Conflict-checked calendar
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-stone-200 p-4 shadow-sm">
              <div className="text-xs font-semibold text-stone-500">
                Confirmed Event Revenue
              </div>
              <div className="text-2xl font-bold font-mono text-emerald-700 mt-1">
                {formatCateringRupees(dashboard.kpis.confirmedRevenuePaise)}
              </div>
              <div className="text-[11px] text-stone-500 mt-0.5">
                Advance-locked bookings
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-stone-200 p-4 shadow-sm">
              <div className="text-xs font-semibold text-stone-500">
                Pending Stage 2/3 Balances
              </div>
              <div className="text-2xl font-bold font-mono text-amber-700 mt-1">
                {formatCateringRupees(dashboard.kpis.pendingStageBalancesPaise)}
              </div>
              <div className="text-[11px] text-stone-500 mt-0.5">
                Pre-event & final settlements
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-stone-200 p-4 shadow-sm">
              <div className="text-xs font-semibold text-stone-500">
                Unreturned Vessels Alert
              </div>
              <div
                className={`text-2xl font-bold font-mono mt-1 ${
                  dashboard.kpis.unreturnedVesselAlertsCount > 0
                    ? 'text-rose-600'
                    : 'text-stone-900'
                }`}
              >
                {dashboard.kpis.unreturnedVesselAlertsCount}
              </div>
              <div className="text-[11px] text-stone-500 mt-0.5">
                Hot-box & chafing gate-passes
              </div>
            </div>
          </div>
        )}

        {loading || !dashboard ? (
          <div className="bg-white rounded-3xl border border-stone-200 p-12 text-center text-sm text-stone-500">
            Loading CateringOS Command Center...
          </div>
        ) : (
          <>
            {/* ============================================================== */}
            {/* TAB 1: EVENTS & CALENDAR                                       */}
            {/* ============================================================== */}
            {activeTab === 'events' && (
              <div className="space-y-4">
                <div className="bg-white rounded-2xl border border-stone-200 p-4 flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span className="text-xs font-bold text-stone-700">
                      Filter Event Date:
                    </span>
                    <input
                      type="date"
                      value={dateFilter}
                      onChange={(e) => setDateFilter(e.target.value)}
                      className="rounded-xl border border-stone-300 px-3 py-1.5 text-xs font-mono"
                    />
                    {dateFilter && (
                      <button
                        type="button"
                        onClick={() => setDateFilter('')}
                        className="text-xs text-amber-800 font-semibold underline"
                      >
                        Show All Dates ({dashboard.orders.length})
                      </button>
                    )}
                  </div>
                  <div className="text-xs text-stone-500">
                    Click any booking to open 3-Stage Payments, +Extra Plates &
                    Vessel Gate-Pass
                  </div>
                </div>

                {filteredOrders.length === 0 ? (
                  <div className="bg-white rounded-3xl border border-stone-200 p-10 text-center space-y-3">
                    <Calendar className="w-8 h-8 text-stone-400 mx-auto" />
                    <p className="text-sm font-semibold text-stone-700">
                      No catering or banquet events found.
                    </p>
                    <button
                      type="button"
                      onClick={() => setPhoneModalOpen(true)}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold"
                      style={{ backgroundColor: accentHex, color: '#0F1115' }}
                    >
                      <Plus className="w-4 h-4" /> Create First Event Quote
                    </button>
                  </div>
                ) : (
                  filteredOrders.map((ord) => {
                    const isOpen = expandedOrderId === ord.id;
                    const totalGuests =
                      ord.vegPlates + ord.nonVegPlates + ord.extraPlatesAdded;
                    const waQuote = buildCateringWhatsAppQuoteLink({
                      phone: ord.customerPhone,
                      template:
                        config?.whatsappQuoteTemplate ??
                        'Hello {{customer_name}}',
                      customerName: ord.customerName,
                      orderCode: ord.orderCode,
                      eventDate: ord.eventDate,
                      totalPlates: totalGuests,
                      totalAmountPaise: ord.totalAmountPaise,
                      advanceAmountPaise: ord.stage1AdvancePaise,
                      portalUrl: publicBookingUrl,
                    });

                    return (
                      <div
                        key={ord.id}
                        className="bg-white rounded-3xl border border-stone-200 shadow-sm overflow-hidden"
                      >
                        <div
                          onClick={() =>
                            setExpandedOrderId(isOpen ? null : ord.id)
                          }
                          className="p-5 cursor-pointer hover:bg-stone-50/70 transition flex items-center justify-between gap-4 flex-wrap"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-mono font-bold text-xs px-2.5 py-0.5 rounded-lg bg-stone-900 text-amber-300">
                                {ord.orderCode}
                              </span>
                              <span className="text-xs font-bold uppercase px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900">
                                {ord.orderStatus.replace('_', ' ')}
                              </span>
                              <span className="text-[11px] uppercase font-semibold px-2 py-0.5 rounded bg-stone-100 text-stone-600">
                                {ord.intakeChannel.replace('_', ' ')}
                              </span>
                              {!ord.vesselsAllReturned && (
                                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-700">
                                  Vessels Out
                                </span>
                              )}
                            </div>
                            <div className="text-base font-bold text-stone-900">
                              {ord.customerName} ·{' '}
                              <span className="font-mono text-sm text-stone-600">
                                {ord.customerPhone}
                              </span>
                            </div>
                            <div className="text-xs text-stone-600">
                              <strong>{ord.eventDate}</strong> (
                              {ord.deliveryTime}) · {ord.occasionType}
                              {ord.usesBanquetHall && ord.hallSlot
                                ? ` · 🏛️ ${ord.hallSlot}`
                                : ''}
                            </div>
                          </div>

                          <div className="flex items-center gap-5 ml-auto text-right font-mono">
                            <div>
                              <div className="text-[11px] uppercase text-stone-400">
                                Guests
                              </div>
                              <div className="text-sm font-bold text-stone-900">
                                {totalGuests} ({ord.vegPlates}V /{' '}
                                {ord.nonVegPlates}NV
                                {ord.extraPlatesAdded > 0
                                  ? ` +${ord.extraPlatesAdded}`
                                  : ''}
                                )
                              </div>
                            </div>
                            <div>
                              <div className="text-[11px] uppercase text-stone-400">
                                Total (Inc GST)
                              </div>
                              <div className="text-sm font-bold text-stone-900">
                                {formatCateringRupees(ord.totalAmountPaise)}
                              </div>
                            </div>
                            <div>
                              <div className="text-[11px] uppercase text-stone-400">
                                Balance Due
                              </div>
                              <div
                                className={`text-sm font-bold ${
                                  ord.balanceDuePaise > 0
                                    ? 'text-amber-700'
                                    : 'text-emerald-700'
                                }`}
                              >
                                {formatCateringRupees(ord.balanceDuePaise)}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* EXPANDED ORDER COMMAND DRAWER */}
                        {isOpen && (
                          <div className="border-t border-stone-200 bg-stone-50/60 p-5 space-y-5">
                            {/* Quick Actions Strip */}
                            <div className="flex items-center justify-between gap-3 flex-wrap">
                              <div className="flex items-center gap-2 flex-wrap">
                                <a
                                  href={waQuote.whatsappUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700"
                                >
                                  <MessageCircle className="w-3.5 h-3.5" />
                                  Send WhatsApp Quote
                                </a>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setPrintOrderModal({
                                      order: ord,
                                      mode: 'invoice',
                                    })
                                  }
                                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold border border-stone-300 bg-white text-stone-800 hover:bg-stone-100"
                                >
                                  <Printer className="w-3.5 h-3.5" />
                                  GST Invoice
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setPrintOrderModal({
                                      order: ord,
                                      mode: 'kot',
                                    })
                                  }
                                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold border border-stone-300 bg-white text-stone-800 hover:bg-stone-100"
                                >
                                  <ChefHat className="w-3.5 h-3.5" />
                                  Kitchen KOT
                                </button>
                              </div>

                              <div className="flex items-center gap-2">
                                <span className="text-xs font-semibold text-stone-600">
                                  Order Status:
                                </span>
                                <select
                                  value={ord.orderStatus}
                                  onChange={(e) =>
                                    void handleOwnerUpdateStatusOrVessels(ord, {
                                      orderStatus: e.target
                                        .value as CateringOrderStatus,
                                    })
                                  }
                                  className="rounded-xl border border-stone-300 bg-white px-3 py-1.5 text-xs font-bold"
                                >
                                  {ALLOWED_CATERING_ORDER_STATUSES.map((st) => (
                                    <option key={st} value={st}>
                                      {st.replace('_', ' ').toUpperCase()}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            </div>

                            <div className="grid lg:grid-cols-3 gap-4">
                              {/* Col 1: 3-Stage Milestone Payment Collector */}
                              <div className="bg-white rounded-2xl border border-stone-200 p-4 space-y-3">
                                <h3 className="text-xs font-bold uppercase tracking-wider text-stone-700 flex items-center gap-1.5">
                                  <Wallet className="w-4 h-4 text-amber-700" />
                                  3-Stage Milestone Payments
                                </h3>
                                <div className="grid grid-cols-3 gap-1.5 text-[11px] font-mono">
                                  <div className="p-2 rounded-lg bg-stone-50 border border-stone-200">
                                    <div className="text-stone-500">
                                      S1 (30%)
                                    </div>
                                    <div className="font-bold">
                                      {formatCateringRupees(
                                        ord.stage1AdvancePaise,
                                      )}
                                    </div>
                                  </div>
                                  <div className="p-2 rounded-lg bg-stone-50 border border-stone-200">
                                    <div className="text-stone-500">
                                      S2 (50%)
                                    </div>
                                    <div className="font-bold">
                                      {formatCateringRupees(
                                        ord.stage2PreeventPaise,
                                      )}
                                    </div>
                                  </div>
                                  <div className="p-2 rounded-lg bg-stone-50 border border-stone-200">
                                    <div className="text-stone-500">
                                      S3 (Bal)
                                    </div>
                                    <div className="font-bold">
                                      {formatCateringRupees(
                                        ord.stage3BalancePaise,
                                      )}
                                    </div>
                                  </div>
                                </div>

                                <div className="grid grid-cols-2 gap-2">
                                  <select
                                    value={payStage}
                                    onChange={(e) =>
                                      setPayStage(
                                        e.target.value as CateringPaymentStage,
                                      )
                                    }
                                    className="rounded-lg border border-stone-300 px-2.5 py-1.5 text-xs"
                                  >
                                    <option value="stage_1">
                                      Stage 1 Advance
                                    </option>
                                    <option value="stage_2">
                                      Stage 2 Pre-Event
                                    </option>
                                    <option value="stage_3">
                                      Stage 3 Final
                                    </option>
                                    <option value="extra">
                                      Extra Plates Settlement
                                    </option>
                                  </select>
                                  <select
                                    value={payMethod}
                                    onChange={(e) =>
                                      setPayMethod(
                                        e.target.value as CateringPaymentMethod,
                                      )
                                    }
                                    className="rounded-lg border border-stone-300 px-2.5 py-1.5 text-xs"
                                  >
                                    <option value="upi">UPI</option>
                                    <option value="cash">Cash</option>
                                    <option value="bank_transfer">
                                      Bank / NEFT
                                    </option>
                                  </select>
                                </div>

                                <div className="flex gap-2">
                                  <input
                                    type="number"
                                    placeholder="Amount ₹ (blank = auto stage)"
                                    value={payAmountRupees}
                                    onChange={(e) =>
                                      setPayAmountRupees(e.target.value)
                                    }
                                    className="flex-1 rounded-lg border border-stone-300 px-2.5 py-1.5 text-xs font-mono"
                                  />
                                  <button
                                    type="button"
                                    onClick={() =>
                                      void handleRecordPayment(ord)
                                    }
                                    className="px-3 py-1.5 rounded-lg text-xs font-bold"
                                    style={{
                                      backgroundColor: accentHex,
                                      color: '#0F1115',
                                    }}
                                  >
                                    Collect
                                  </button>
                                </div>

                                {ord.paymentLedger.length > 0 && (
                                  <div className="pt-2 border-t border-stone-100 space-y-1 max-h-28 overflow-y-auto">
                                    {ord.paymentLedger.map((entry, idx) => (
                                      <div
                                        key={idx}
                                        className="flex justify-between text-[11px] font-mono text-stone-600"
                                      >
                                        <span>
                                          {entry.stage.toUpperCase()} ·{' '}
                                          {entry.method.toUpperCase()}
                                        </span>
                                        <span className="font-bold text-emerald-700">
                                          +
                                          {formatCateringRupees(
                                            entry.amountPaise,
                                          )}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>

                              {/* Col 2: On-Site +Extra Plates Adjuster */}
                              <div className="bg-white rounded-2xl border border-stone-200 p-4 space-y-3">
                                <h3 className="text-xs font-bold uppercase tracking-wider text-stone-700 flex items-center gap-1.5">
                                  <Sparkles className="w-4 h-4 text-amber-700" />
                                  On-Site + Extra Plates Adjuster
                                </h3>
                                <p className="text-xs text-stone-500">
                                  Guest overflow at buffet? Add extra plates to
                                  recalculate subtotal, GST & final balance.
                                </p>
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      void handleAddExtraPlates(ord.id, 10)
                                    }
                                    className="px-3 py-1.5 rounded-lg border border-stone-300 text-xs font-bold hover:bg-stone-50"
                                  >
                                    +10 Plates
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      void handleAddExtraPlates(ord.id, 25)
                                    }
                                    className="px-3 py-1.5 rounded-lg border border-stone-300 text-xs font-bold hover:bg-stone-50"
                                  >
                                    +25 Plates
                                  </button>
                                </div>
                                <div className="flex items-center gap-2">
                                  <input
                                    type="number"
                                    min={1}
                                    value={extraPlatesInput}
                                    onChange={(e) =>
                                      setExtraPlatesInput(
                                        Math.max(
                                          1,
                                          Number(e.target.value) || 1,
                                        ),
                                      )
                                    }
                                    className="w-24 rounded-lg border border-stone-300 px-2.5 py-1.5 text-xs font-mono"
                                  />
                                  <button
                                    type="button"
                                    onClick={() =>
                                      void handleAddExtraPlates(
                                        ord.id,
                                        extraPlatesInput,
                                      )
                                    }
                                    className="px-3 py-1.5 rounded-lg bg-stone-900 text-white text-xs font-bold"
                                  >
                                    Add Custom Plates
                                  </button>
                                </div>
                              </div>

                              {/* Col 3: Hot-Box & Vessel Return Gate-Pass */}
                              <div className="bg-white rounded-2xl border border-stone-200 p-4 space-y-3">
                                <h3 className="text-xs font-bold uppercase tracking-wider text-stone-700 flex items-center gap-1.5">
                                  <Package className="w-4 h-4 text-amber-700" />
                                  Vessel & Hot-Box Tracker
                                </h3>
                                <div className="flex gap-1.5">
                                  <input
                                    type="text"
                                    value={newVesselName}
                                    onChange={(e) =>
                                      setNewVesselName(e.target.value)
                                    }
                                    placeholder="Vessel / Chafing dish..."
                                    className="flex-1 rounded-lg border border-stone-300 px-2.5 py-1.5 text-xs"
                                  />
                                  <input
                                    type="number"
                                    min={1}
                                    value={newVesselSent}
                                    onChange={(e) =>
                                      setNewVesselSent(
                                        Math.max(
                                          1,
                                          Number(e.target.value) || 1,
                                        ),
                                      )
                                    }
                                    className="w-14 rounded-lg border border-stone-300 px-2 py-1.5 text-xs font-mono"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const next = [
                                        ...ord.vesselsDispatched,
                                        {
                                          itemName: newVesselName,
                                          qtySent: newVesselSent,
                                          qtyReturned: 0,
                                        },
                                      ];
                                      void handleOwnerUpdateStatusOrVessels(
                                        ord,
                                        { vesselsDispatched: next },
                                      );
                                    }}
                                    className="px-2.5 py-1.5 rounded-lg bg-stone-900 text-white text-xs font-bold"
                                  >
                                    Send
                                  </button>
                                </div>

                                <div className="space-y-1.5 max-h-32 overflow-y-auto">
                                  {ord.vesselsDispatched.map((v, vIdx) => (
                                    <div
                                      key={`${v.itemName}-${vIdx}`}
                                      className="flex items-center justify-between text-xs bg-stone-50 rounded-lg px-2.5 py-1.5"
                                    >
                                      <span className="truncate">
                                        {v.itemName} ({v.qtyReturned}/
                                        {v.qtySent})
                                      </span>
                                      {v.qtyReturned < v.qtySent ? (
                                        <button
                                          type="button"
                                          onClick={() => {
                                            const next =
                                              ord.vesselsDispatched.map(
                                                (item, i) =>
                                                  i === vIdx
                                                    ? {
                                                        ...item,
                                                        qtyReturned:
                                                          item.qtySent,
                                                      }
                                                    : item,
                                              );
                                            void handleOwnerUpdateStatusOrVessels(
                                              ord,
                                              { vesselsDispatched: next },
                                            );
                                          }}
                                          className="text-[11px] font-bold text-emerald-700 underline ml-2"
                                        >
                                          Mark Returned
                                        </button>
                                      ) : (
                                        <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {/* ============================================================== */}
            {/* TAB 2: PACKAGES & RECIPES                                      */}
            {/* ============================================================== */}
            {activeTab === 'packages' && (
              <div className="grid lg:grid-cols-2 gap-6">
                {/* Tiered Packages Builder */}
                <div className="bg-white rounded-3xl border border-stone-200 p-6 shadow-sm space-y-4">
                  <h2 className="text-base font-bold text-stone-900">
                    Tiered Buffet Packages ({dashboard.packages.length})
                  </h2>
                  <form onSubmit={handleAddPackage} className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <input
                        type="text"
                        required
                        placeholder="Package Name (e.g. Royal Gold)"
                        value={pkgName}
                        onChange={(e) => setPkgName(e.target.value)}
                        className="rounded-xl border border-stone-300 px-3 py-2 text-xs"
                      />
                      <select
                        value={pkgTier}
                        onChange={(e) => setPkgTier(e.target.value)}
                        className="rounded-xl border border-stone-300 px-3 py-2 text-xs"
                      >
                        <option value="Silver">Silver Tier</option>
                        <option value="Gold">Gold Tier</option>
                        <option value="Platinum">Platinum Tier</option>
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <input
                        type="number"
                        required
                        placeholder="Veg Plate ₹"
                        value={pkgVegRupees}
                        onChange={(e) => setPkgVegRupees(e.target.value)}
                        className="rounded-xl border border-stone-300 px-3 py-2 text-xs font-mono"
                      />
                      <input
                        type="number"
                        required
                        placeholder="Non-Veg Plate ₹"
                        value={pkgNonVegRupees}
                        onChange={(e) => setPkgNonVegRupees(e.target.value)}
                        className="rounded-xl border border-stone-300 px-3 py-2 text-xs font-mono"
                      />
                    </div>
                    <input
                      type="text"
                      placeholder="Short description..."
                      value={pkgDesc}
                      onChange={(e) => setPkgDesc(e.target.value)}
                      className="w-full rounded-xl border border-stone-300 px-3 py-2 text-xs"
                    />
                    <button
                      type="submit"
                      className="px-4 py-2 rounded-xl text-xs font-bold"
                      style={{ backgroundColor: accentHex, color: '#0F1115' }}
                    >
                      + Add Tiered Package
                    </button>
                  </form>

                  <div className="divide-y divide-stone-100 pt-2">
                    {dashboard.packages.map((p) => (
                      <div
                        key={p.id}
                        className="py-3 flex items-center justify-between gap-3"
                      >
                        <div>
                          <div className="text-sm font-bold text-stone-900">
                            {p.packageName}{' '}
                            <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 ml-1">
                              {p.tierBadge}
                            </span>
                          </div>
                          <div className="text-xs font-mono text-stone-600 mt-0.5">
                            Veg {formatCateringRupees(p.vegPricePaise)} ·
                            Non-Veg {formatCateringRupees(p.nonVegPricePaise)}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={async () => {
                            await businessRepository.deleteCateringPackage(
                              business.id,
                              p.id,
                              { actorOwnerId: business.ownerId },
                            );
                            await loadOwnerData();
                          }}
                          className="p-2 text-stone-400 hover:text-rose-600"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Dishes & Per-100-Plate Recipe Yields */}
                <div className="bg-white rounded-3xl border border-stone-200 p-6 shadow-sm space-y-4">
                  <h2 className="text-base font-bold text-stone-900">
                    Dishes, Bulk Trays & Per-100-Plate Recipes (
                    {dashboard.dishes.length})
                  </h2>
                  <form onSubmit={handleAddDish} className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <input
                        type="text"
                        required
                        placeholder="Dish Name (e.g. Dum Biryani)"
                        value={dishName}
                        onChange={(e) => setDishName(e.target.value)}
                        className="rounded-xl border border-stone-300 px-3 py-2 text-xs"
                      />
                      <select
                        value={dishCategory}
                        onChange={(e) =>
                          setDishCategory(
                            e.target.value as CateringDishCategory,
                          )
                        }
                        className="rounded-xl border border-stone-300 px-3 py-2 text-xs"
                      >
                        {Object.entries(CATERING_DISH_CATEGORY_LABELS).map(
                          ([k, label]) => (
                            <option key={k} value={k}>
                              {label}
                            </option>
                          ),
                        )}
                      </select>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <select
                        value={dishDiet}
                        onChange={(e) =>
                          setDishDiet(e.target.value as CateringDietType)
                        }
                        className="rounded-xl border border-stone-300 px-2.5 py-2 text-xs"
                      >
                        <option value="veg">● Veg</option>
                        <option value="non_veg">● Non-Veg</option>
                      </select>
                      <select
                        value={dishBulkUnit}
                        onChange={(e) =>
                          setDishBulkUnit(e.target.value as CateringBulkUnit)
                        }
                        className="rounded-xl border border-stone-300 px-2.5 py-2 text-xs"
                      >
                        <option value="kg">per kg</option>
                        <option value="tray">per tray</option>
                        <option value="litres">per litre</option>
                        <option value="pieces">per piece</option>
                      </select>
                      <input
                        type="number"
                        placeholder="Bulk ₹"
                        value={dishBulkRupees}
                        onChange={(e) => setDishBulkRupees(e.target.value)}
                        className="rounded-xl border border-stone-300 px-2.5 py-2 text-xs font-mono"
                      />
                    </div>

                    <div className="flex items-center gap-4 text-xs">
                      <label className="flex items-center gap-1.5">
                        <input
                          type="checkbox"
                          checked={dishInPkg}
                          onChange={(e) => setDishInPkg(e.target.checked)}
                        />
                        In Buffet Packages
                      </label>
                      <label className="flex items-center gap-1.5">
                        <input
                          type="checkbox"
                          checked={dishInBulk}
                          onChange={(e) => setDishInBulk(e.target.checked)}
                        />
                        Bulk À La Carte
                      </label>
                    </div>

                    {/* Per-100-Plate Ingredients */}
                    <div className="rounded-2xl bg-stone-50 border border-stone-200 p-3 space-y-2">
                      <div className="flex items-center justify-between text-xs font-bold text-stone-700">
                        <span>Raw Ingredients per 100 Plates</span>
                        <button
                          type="button"
                          onClick={() =>
                            setDishIngredients((prev) => [
                              ...prev,
                              { ingredientName: '', unit: 'kg', qtyPer100: 5 },
                            ])
                          }
                          className="text-amber-800 underline"
                        >
                          + Ingredient
                        </button>
                      </div>
                      {dishIngredients.map((ing, i) => (
                        <div key={i} className="grid grid-cols-3 gap-2">
                          <input
                            type="text"
                            placeholder="Ingredient"
                            value={ing.ingredientName}
                            onChange={(e) =>
                              setDishIngredients((prev) =>
                                prev.map((row, idx) =>
                                  idx === i
                                    ? { ...row, ingredientName: e.target.value }
                                    : row,
                                ),
                              )
                            }
                            className="rounded-lg border border-stone-300 bg-white px-2 py-1 text-xs"
                          />
                          <input
                            type="number"
                            step="0.1"
                            placeholder="Qty / 100"
                            value={ing.qtyPer100}
                            onChange={(e) =>
                              setDishIngredients((prev) =>
                                prev.map((row, idx) =>
                                  idx === i
                                    ? {
                                        ...row,
                                        qtyPer100: Number(e.target.value) || 0,
                                      }
                                    : row,
                                ),
                              )
                            }
                            className="rounded-lg border border-stone-300 bg-white px-2 py-1 text-xs font-mono"
                          />
                          <input
                            type="text"
                            placeholder="kg / litres"
                            value={ing.unit}
                            onChange={(e) =>
                              setDishIngredients((prev) =>
                                prev.map((row, idx) =>
                                  idx === i
                                    ? { ...row, unit: e.target.value }
                                    : row,
                                ),
                              )
                            }
                            className="rounded-lg border border-stone-300 bg-white px-2 py-1 text-xs"
                          />
                        </div>
                      ))}
                    </div>

                    <button
                      type="submit"
                      className="px-4 py-2 rounded-xl text-xs font-bold bg-stone-900 text-white"
                    >
                      + Save Dish & Recipe
                    </button>
                  </form>

                  <div className="divide-y divide-stone-100 max-h-80 overflow-y-auto pt-2">
                    {dashboard.dishes.map((d) => (
                      <div
                        key={d.id}
                        className="py-2.5 flex items-center justify-between gap-2"
                      >
                        <div>
                          <div className="text-xs font-bold text-stone-900 flex items-center gap-1.5">
                            <span
                              className={`w-2 h-2 rounded-full ${
                                d.dietType === 'veg'
                                  ? 'bg-emerald-600'
                                  : 'bg-rose-600'
                              }`}
                            />
                            {d.dishName}
                          </div>
                          <div className="text-[11px] text-stone-500 font-mono">
                            Bulk: {formatCateringRupees(d.bulkUnitPricePaise)}/
                            {d.bulkUnit} · {d.ingredientsPer100Plates.length}{' '}
                            recipe items
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={async () => {
                            await businessRepository.deleteCateringDishAndRecipe(
                              business.id,
                              d.id,
                              { actorOwnerId: business.ownerId },
                            );
                            await loadOwnerData();
                          }}
                          className="p-1.5 text-stone-400 hover:text-rose-600"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ============================================================== */}
            {/* TAB 3: GROCERY & STOCK CALCULATOR                              */}
            {/* ============================================================== */}
            {activeTab === 'grocery' && (
              <div className="bg-white rounded-3xl border border-stone-200 p-6 shadow-sm space-y-5">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div>
                    <h2 className="text-lg font-bold text-stone-900">
                      Auto Recipe-to-Grocery Procurement Calculator
                    </h2>
                    <p className="text-xs text-stone-500">
                      Aggregates raw ingredients across all active events in
                      your date window with wastage buffer & manual overrides
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={exportGroceryCsv}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-stone-300 text-xs font-bold text-stone-800 hover:bg-stone-50"
                    >
                      <Download className="w-3.5 h-3.5" /> Export CSV
                    </button>
                    <button
                      type="button"
                      onClick={() => window.print()}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold"
                      style={{ backgroundColor: accentHex, color: '#0F1115' }}
                    >
                      <Printer className="w-3.5 h-3.5" /> Print Shopping List
                    </button>
                  </div>
                </div>

                <div className="grid sm:grid-cols-3 gap-4 rounded-2xl bg-stone-50 border border-stone-200 p-4">
                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1">
                      Events From Date
                    </label>
                    <input
                      type="date"
                      value={groceryFrom}
                      onChange={(e) => setGroceryFrom(e.target.value)}
                      className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1">
                      Events To Date
                    </label>
                    <input
                      type="date"
                      value={groceryTo}
                      onChange={(e) => setGroceryTo(e.target.value)}
                      className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1">
                      Wastage Buffer: <span className="font-mono">{wastagePct}%</span>
                    </label>
                    <input
                      type="range"
                      min={0}
                      max={20}
                      step={1}
                      value={wastagePct}
                      onChange={(e) => setWastagePct(Number(e.target.value))}
                      className="w-full accent-amber-600 mt-2"
                    />
                  </div>
                </div>

                {computedGroceryRows.length === 0 ? (
                  <div className="py-10 text-center text-sm text-stone-500">
                    No active events with recipe dishes found between{' '}
                    {groceryFrom} and {groceryTo}.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-stone-200 text-stone-500 uppercase">
                          <th className="py-2.5 pr-3">Purchased</th>
                          <th className="py-2.5 px-3">Raw Ingredient</th>
                          <th className="py-2.5 px-3">Base Yield</th>
                          <th className="py-2.5 px-3">
                            +{wastagePct}% Wastage
                          </th>
                          <th className="py-2.5 px-3">Final Override Qty</th>
                          <th className="py-2.5 pl-3">Used In Dishes</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-100">
                        {computedGroceryRows.map((row) => {
                          const key = `${row.ingredientName}__${row.unit}`;
                          const checked = Boolean(purchasedItems[key]);
                          const displayQty =
                            manualQtyOverrides[key] !== undefined
                              ? manualQtyOverrides[key]
                              : row.totalQtyWithWastage;
                          return (
                            <tr
                              key={key}
                              className={checked ? 'bg-emerald-50/40' : ''}
                            >
                              <td className="py-3 pr-3">
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={(e) =>
                                    setPurchasedItems((prev) => ({
                                      ...prev,
                                      [key]: e.target.checked,
                                    }))
                                  }
                                  className="w-4 h-4 rounded accent-emerald-600"
                                />
                              </td>
                              <td className="py-3 px-3 font-bold text-stone-900">
                                {row.ingredientName}
                              </td>
                              <td className="py-3 px-3 font-mono text-stone-600">
                                {row.baseQty} {row.unit}
                              </td>
                              <td className="py-3 px-3 font-mono font-bold text-amber-800">
                                {row.totalQtyWithWastage} {row.unit}
                              </td>
                              <td className="py-3 px-3">
                                <div className="flex items-center gap-1.5">
                                  <input
                                    type="number"
                                    step="0.1"
                                    value={displayQty}
                                    onChange={(e) =>
                                      setManualQtyOverrides((prev) => ({
                                        ...prev,
                                        [key]: Number(e.target.value) || 0,
                                      }))
                                    }
                                    className="w-20 rounded-lg border border-stone-300 px-2 py-1 font-mono font-bold"
                                  />
                                  <span className="text-stone-500">
                                    {row.unit}
                                  </span>
                                </div>
                              </td>
                              <td className="py-3 pl-3 text-stone-500">
                                {row.sourceDishes.join(', ')}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* ============================================================== */}
            {/* TAB 4: BANQUET HALL, RULES, WHITE-LABEL & WEBSITE EMBED        */}
            {/* ============================================================== */}
            {activeTab === 'rules' && cfgDraft && (
              <form onSubmit={handleSaveConfig} className="space-y-6">
                <div className="bg-white rounded-3xl border border-stone-200 p-6 shadow-sm space-y-5">
                  <h2 className="text-base font-bold text-stone-900">
                    Booking Guardrails, Blackout Dates & Head Chef PIN
                  </h2>
                  <div className="grid sm:grid-cols-4 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-stone-700 mb-1">
                        Minimum Headcount
                      </label>
                      <input
                        type="number"
                        value={cfgDraft.minHeadcount}
                        onChange={(e) =>
                          setCfgDraft({
                            ...cfgDraft,
                            minHeadcount: Number(e.target.value) || 30,
                          })
                        }
                        className="w-full rounded-xl border border-stone-300 px-3 py-2 text-xs font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-stone-700 mb-1">
                        Max Capacity / Event
                      </label>
                      <input
                        type="number"
                        value={cfgDraft.maxCapacityPerEvent}
                        onChange={(e) =>
                          setCfgDraft({
                            ...cfgDraft,
                            maxCapacityPerEvent: Number(e.target.value) || 1000,
                          })
                        }
                        className="w-full rounded-xl border border-stone-300 px-3 py-2 text-xs font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-stone-700 mb-1">
                        Advance Notice Hours
                      </label>
                      <select
                        value={cfgDraft.minAdvanceHours}
                        onChange={(e) =>
                          setCfgDraft({
                            ...cfgDraft,
                            minAdvanceHours: Number(e.target.value),
                          })
                        }
                        className="w-full rounded-xl border border-stone-300 px-3 py-2 text-xs"
                      >
                        <option value={24}>24 Hours</option>
                        <option value={48}>48 Hours</option>
                        <option value={72}>72 Hours</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-stone-700 mb-1">
                        <KeyRound className="w-3.5 h-3.5 inline mr-1" />
                        Head Chef Station PIN
                      </label>
                      <input
                        type="text"
                        maxLength={6}
                        value={cfgDraft.chefStationPin ?? '4321'}
                        onChange={(e) =>
                          setCfgDraft({
                            ...cfgDraft,
                            chefStationPin: e.target.value.replace(
                              /[^0-9]/g,
                              '',
                            ),
                          })
                        }
                        className="w-full rounded-xl border border-stone-300 px-3 py-2 text-xs font-mono font-bold"
                      />
                    </div>
                  </div>

                  {/* Blackout Dates */}
                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-stone-700">
                      Kitchen Blackout / Sold-Out Dates
                    </label>
                    <div className="flex items-center gap-2 flex-wrap">
                      <input
                        type="date"
                        value={newBlackoutDate}
                        onChange={(e) => setNewBlackoutDate(e.target.value)}
                        className="rounded-xl border border-stone-300 px-3 py-1.5 text-xs font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (
                            newBlackoutDate &&
                            !cfgDraft.blackoutDates.includes(newBlackoutDate)
                          ) {
                            setCfgDraft({
                              ...cfgDraft,
                              blackoutDates: [
                                ...cfgDraft.blackoutDates,
                                newBlackoutDate,
                              ].sort(),
                            });
                            setNewBlackoutDate('');
                          }
                        }}
                        className="px-3 py-1.5 rounded-xl bg-stone-900 text-white text-xs font-bold"
                      >
                        + Block Date
                      </button>
                      {cfgDraft.blackoutDates.map((bd) => (
                        <span
                          key={bd}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono bg-rose-100 text-rose-800"
                        >
                          {bd}
                          <button
                            type="button"
                            onClick={() =>
                              setCfgDraft({
                                ...cfgDraft,
                                blackoutDates: cfgDraft.blackoutDates.filter(
                                  (d) => d !== bd,
                                ),
                              })
                            }
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Banquet Hall Toggle & Add-On Pricing */}
                <div className="bg-white rounded-3xl border border-stone-200 p-6 shadow-sm space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-base font-bold text-stone-900">
                        Function / Banquet Hall & Add-On Pricing
                      </h2>
                      <p className="text-xs text-stone-500">
                        Toggle off if you operate pure outdoor / drop-off
                        catering without a hall
                      </p>
                    </div>
                    <label className="flex items-center gap-2 text-xs font-bold cursor-pointer">
                      <input
                        type="checkbox"
                        checked={cfgDraft.banquetHallEnabled}
                        onChange={(e) =>
                          setCfgDraft({
                            ...cfgDraft,
                            banquetHallEnabled: e.target.checked,
                          })
                        }
                        className="w-4 h-4 accent-amber-600"
                      />
                      Enable Function Hall
                    </label>
                  </div>

                  {cfgDraft.banquetHallEnabled && (
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs font-bold text-stone-700 mb-1">
                          Banquet Hall Name
                        </label>
                        <input
                          type="text"
                          value={cfgDraft.hallName}
                          onChange={(e) =>
                            setCfgDraft({
                              ...cfgDraft,
                              hallName: e.target.value,
                            })
                          }
                          className="w-full max-w-md rounded-xl border border-stone-300 px-3 py-2 text-xs"
                        />
                      </div>

                      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {cfgDraft.hallAddonsCatalog.map((addon, idx) => (
                          <div
                            key={addon.id}
                            className="rounded-2xl border border-stone-200 p-3 space-y-2"
                          >
                            <label className="flex items-center gap-2 text-xs font-bold">
                              <input
                                type="checkbox"
                                checked={addon.enabled}
                                onChange={(e) => {
                                  const next = cfgDraft.hallAddonsCatalog.map(
                                    (a, i) =>
                                      i === idx
                                        ? { ...a, enabled: e.target.checked }
                                        : a,
                                  );
                                  setCfgDraft({
                                    ...cfgDraft,
                                    hallAddonsCatalog: next,
                                  });
                                }}
                              />
                              {addon.label}
                            </label>
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs text-stone-500">₹</span>
                              <input
                                type="number"
                                value={Math.round(addon.pricePaise / 100)}
                                onChange={(e) => {
                                  const next = cfgDraft.hallAddonsCatalog.map(
                                    (a, i) =>
                                      i === idx
                                        ? {
                                            ...a,
                                            pricePaise:
                                              (Number(e.target.value) || 0) *
                                              100,
                                          }
                                        : a,
                                  );
                                  setCfgDraft({
                                    ...cfgDraft,
                                    hallAddonsCatalog: next,
                                  });
                                }}
                                className="w-full rounded-lg border border-stone-300 px-2.5 py-1 text-xs font-mono"
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* White-Label Branding & Website Iframe Embed */}
                <div className="bg-white rounded-3xl border border-stone-200 p-6 shadow-sm space-y-4">
                  <h2 className="text-base font-bold text-stone-900">
                    White-Label Branding & Restaurant Website Embed
                  </h2>
                  <div className="grid sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-stone-700 mb-1">
                        Brand Logo URL (Optional)
                      </label>
                      <input
                        type="url"
                        placeholder="https://..."
                        value={cfgDraft.brandLogoUrl ?? ''}
                        onChange={(e) =>
                          setCfgDraft({
                            ...cfgDraft,
                            brandLogoUrl: e.target.value || null,
                          })
                        }
                        className="w-full rounded-xl border border-stone-300 px-3 py-2 text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-stone-700 mb-1">
                        Primary Accent Hex (Banquet Gold)
                      </label>
                      <input
                        type="text"
                        value={cfgDraft.primaryAccentHex}
                        onChange={(e) =>
                          setCfgDraft({
                            ...cfgDraft,
                            primaryAccentHex: e.target.value,
                          })
                        }
                        className="w-full rounded-xl border border-stone-300 px-3 py-2 text-xs font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-stone-700 mb-1">
                        Header / Sidebar Hex (Deep Obsidian)
                      </label>
                      <input
                        type="text"
                        value={cfgDraft.secondarySurfaceHex}
                        onChange={(e) =>
                          setCfgDraft({
                            ...cfgDraft,
                            secondarySurfaceHex: e.target.value,
                          })
                        }
                        className="w-full rounded-xl border border-stone-300 px-3 py-2 text-xs font-mono"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1">
                      WhatsApp Quote Template
                    </label>
                    <textarea
                      rows={2}
                      value={cfgDraft.whatsappQuoteTemplate}
                      onChange={(e) =>
                        setCfgDraft({
                          ...cfgDraft,
                          whatsappQuoteTemplate: e.target.value,
                        })
                      }
                      className="w-full rounded-xl border border-stone-300 px-3 py-2 text-xs"
                    />
                  </div>

                  {/* Copyable Website Embed Snippet */}
                  <div className="rounded-2xl bg-stone-900 text-stone-200 p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-amber-300">
                        Chromeless Website Embed Code (?embed=1)
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          void navigator.clipboard?.writeText(iframeSnippet);
                          showToast('Copied website iframe embed snippet!');
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/10 text-xs font-bold text-white hover:bg-white/20"
                      >
                        <Copy className="w-3.5 h-3.5" /> Copy Embed Code
                      </button>
                    </div>
                    <pre className="text-[11px] font-mono overflow-x-auto text-stone-300">
                      {iframeSnippet}
                    </pre>
                  </div>

                  <button
                    type="submit"
                    disabled={savingConfig}
                    className="px-5 py-2.5 rounded-xl text-xs font-bold shadow-sm"
                    style={{ backgroundColor: accentHex, color: '#0F1115' }}
                  >
                    {savingConfig
                      ? 'Saving Settings...'
                      : 'Save All CateringOS Settings'}
                  </button>
                </div>
              </form>
            )}

            {/* ============================================================== */}
            {/* TAB 5: AI REVIEWS & QR STANDEE                                 */}
            {/* ============================================================== */}
            {activeTab === 'qr_reviews' && (
              <div className="space-y-6">
                <QRPosterGenerator business={business} defaultMode="catering" />
                <GoogleUrlSettings
                  business={business}
                  onUpdated={onBusinessUpdated}
                />
                <CustomerDraftsView
                  business={business}
                  drafts={drafts}
                  onDraftUpdated={(updated) =>
                    setDrafts((prev) =>
                      prev.map((d) => (d.id === updated.id ? updated : d)),
                    )
                  }
                />
              </div>
            )}
          </>
        )}
      </main>

      {/* ==================================================================== */}
      {/* MODAL 1: 60-SECOND PHONE / WALK-IN INTAKE                            */}
      {/* ==================================================================== */}
      {phoneModalOpen && dashboard && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 space-y-4 shadow-2xl my-8">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-stone-900">
                60-Second Phone / Walk-In Event Intake
              </h2>
              <button
                type="button"
                onClick={() => setPhoneModalOpen(false)}
                className="p-1.5 rounded-lg hover:bg-stone-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreatePhoneOrder} className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="text"
                  required
                  placeholder="Customer Full Name *"
                  value={phoneCustomerName}
                  onChange={(e) => setPhoneCustomerName(e.target.value)}
                  className="rounded-xl border border-stone-300 px-3 py-2 text-xs"
                />
                <input
                  type="tel"
                  required
                  placeholder="10-Digit Mobile *"
                  value={phoneCustomerMobile}
                  onChange={(e) => setPhoneCustomerMobile(e.target.value)}
                  className="rounded-xl border border-stone-300 px-3 py-2 text-xs font-mono"
                />
              </div>

              <div className="grid grid-cols-3 gap-2.5">
                <input
                  type="date"
                  required
                  value={phoneEventDate}
                  onChange={(e) => setPhoneEventDate(e.target.value)}
                  className="rounded-xl border border-stone-300 px-2.5 py-2 text-xs font-mono"
                />
                <select
                  value={phoneDeliveryTime}
                  onChange={(e) => setPhoneDeliveryTime(e.target.value)}
                  className="rounded-xl border border-stone-300 px-2.5 py-2 text-xs"
                >
                  <option value="08:00 AM">08:00 AM</option>
                  <option value="12:30 PM">12:30 PM</option>
                  <option value="07:30 PM">07:30 PM</option>
                </select>
                <select
                  value={phoneServiceMode}
                  onChange={(e) =>
                    setPhoneServiceMode(e.target.value as CateringServiceMode)
                  }
                  className="rounded-xl border border-stone-300 px-2.5 py-2 text-xs"
                >
                  <option value="full_service">Full Service</option>
                  <option value="drop_off">Drop-Off Boxes</option>
                  <option value="self_pickup">Self-Pickup</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <select
                  value={phoneOccasion}
                  onChange={(e) => setPhoneOccasion(e.target.value)}
                  className="rounded-xl border border-stone-300 px-3 py-2 text-xs"
                >
                  {CATERING_OCCASION_PRESETS.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
                <select
                  value={phonePackageId}
                  onChange={(e) => setPhonePackageId(e.target.value)}
                  className="rounded-xl border border-stone-300 px-3 py-2 text-xs"
                >
                  {dashboard.packages.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.packageName} (V{' '}
                      {formatCateringRupees(p.vegPricePaise)} / NV{' '}
                      {formatCateringRupees(p.nonVegPricePaise)})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-emerald-800 mb-1">
                    Veg Plates
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={phoneVegPlates}
                    onChange={(e) =>
                      setPhoneVegPlates(Math.max(0, Number(e.target.value) || 0))
                    }
                    className="w-full rounded-xl border border-stone-300 px-3 py-2 text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-rose-800 mb-1">
                    Non-Veg Plates
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={phoneNonVegPlates}
                    onChange={(e) =>
                      setPhoneNonVegPlates(
                        Math.max(0, Number(e.target.value) || 0),
                      )
                    }
                    className="w-full rounded-xl border border-stone-300 px-3 py-2 text-xs font-mono"
                  />
                </div>
              </div>

              {dashboard.config.banquetHallEnabled && (
                <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 space-y-2">
                  <label className="flex items-center gap-2 text-xs font-bold">
                    <input
                      type="checkbox"
                      checked={phoneUsesHall}
                      onChange={(e) => setPhoneUsesHall(e.target.checked)}
                    />
                    Book {dashboard.config.hallName}
                  </label>
                  {phoneUsesHall && (
                    <select
                      value={phoneHallSlot}
                      onChange={(e) => setPhoneHallSlot(e.target.value)}
                      className="w-full rounded-lg border border-amber-300 bg-white px-2.5 py-1.5 text-xs"
                    >
                      {dashboard.config.hallSlots.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )}

              <div className="flex flex-wrap gap-1.5">
                {dashboard.config.hallAddonsCatalog
                  .filter((a) => a.enabled)
                  .map((addon) => {
                    const active = phoneAddonIds.includes(addon.id);
                    return (
                      <button
                        key={addon.id}
                        type="button"
                        onClick={() =>
                          setPhoneAddonIds((prev) =>
                            prev.includes(addon.id)
                              ? prev.filter((x) => x !== addon.id)
                              : [...prev, addon.id],
                          )
                        }
                        className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border ${
                          active
                            ? 'bg-stone-900 text-white border-stone-900'
                            : 'bg-stone-50 text-stone-700 border-stone-200'
                        }`}
                      >
                        {addon.label} (+
                        {formatCateringRupees(addon.pricePaise)})
                      </button>
                    );
                  })}
              </div>

              <input
                type="text"
                placeholder="Kitchen / spice notes..."
                value={phoneNotes}
                onChange={(e) => setPhoneNotes(e.target.value)}
                className="w-full rounded-xl border border-stone-300 px-3 py-2 text-xs"
              />

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setPhoneModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-stone-200 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={phoneSubmitting}
                  className="px-5 py-2 rounded-xl text-xs font-bold"
                  style={{ backgroundColor: accentHex, color: '#0F1115' }}
                >
                  {phoneSubmitting ? 'Creating...' : 'Create Event Booking'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL 2: RESTRICTED HEAD CHEF PIN UNLOCK                             */}
      {/* ==================================================================== */}
      {chefPinModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/65 flex items-center justify-center p-4">
          <form
            onSubmit={handleUnlockChefPortal}
            className="bg-white rounded-3xl max-w-sm w-full p-6 space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ChefHat className="w-5 h-5 text-amber-700" />
                <h2 className="text-base font-bold text-stone-900">
                  Head Chef PIN Station
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setChefPinModalOpen(false)}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-stone-600">
              Unlocks the Kitchen Production, Recipe Scaling & Vessel Dispatch
              display with <strong>zero pricing or customer phone visibility</strong>.
            </p>
            <input
              type="password"
              inputMode="numeric"
              maxLength={6}
              required
              autoFocus
              placeholder="Enter 4-Digit Chef PIN (e.g. 4321)"
              value={chefPinInput}
              onChange={(e) =>
                setChefPinInput(e.target.value.replace(/[^0-9]/g, ''))
              }
              className="w-full text-center tracking-widest text-lg font-mono font-bold rounded-xl border border-stone-300 px-4 py-3"
            />
            <button
              type="submit"
              className="w-full py-3 rounded-xl text-xs font-bold"
              style={{ backgroundColor: accentHex, color: '#0F1115' }}
            >
              Unlock Head Chef Kitchen Portal →
            </button>
          </form>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL 3: PRINTABLE GST INVOICE / KITCHEN KOT                         */}
      {/* ==================================================================== */}
      {printOrderModal && (
        <div className="fixed inset-0 z-50 bg-black/65 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-stone-200 pb-3">
              <div>
                <div className="text-xs font-bold uppercase text-amber-800">
                  {printOrderModal.mode === 'invoice'
                    ? 'Tax / Catering Event Invoice'
                    : 'Kitchen Production Order Ticket (KOT)'}
                </div>
                <h3 className="text-lg font-bold text-stone-900">
                  {business.name} — {printOrderModal.order.orderCode}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setPrintOrderModal(null)}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="text-xs space-y-2 text-stone-800">
              <div>
                <strong>Event Date:</strong> {printOrderModal.order.eventDate} (
                {printOrderModal.order.deliveryTime}) ·{' '}
                {printOrderModal.order.occasionType}
              </div>
              {printOrderModal.mode === 'invoice' && (
                <div>
                  <strong>Client:</strong> {printOrderModal.order.customerName}{' '}
                  ({printOrderModal.order.customerPhone})
                </div>
              )}
              <div>
                <strong>Guest Split:</strong> {printOrderModal.order.vegPlates}{' '}
                Veg + {printOrderModal.order.nonVegPlates} Non-Veg
                {printOrderModal.order.extraPlatesAdded > 0
                  ? ` + ${printOrderModal.order.extraPlatesAdded} Extra`
                  : ''}
              </div>
              <div className="pt-2 border-t border-stone-200">
                <strong>Menu Items:</strong>{' '}
                {printOrderModal.order.selectedPackageDishes
                  .map((d) => d.dishName)
                  .join(', ') || 'Bulk Trays'}
              </div>
              {printOrderModal.mode === 'invoice' && (
                <div className="pt-2 border-t border-stone-200 font-mono space-y-1">
                  <div className="flex justify-between">
                    <span>Subtotal:</span>
                    <span>
                      {formatCateringRupees(
                        printOrderModal.order.subtotalPaise,
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>GST (5%):</span>
                    <span>
                      {formatCateringRupees(printOrderModal.order.gstPaise)}
                    </span>
                  </div>
                  <div className="flex justify-between font-bold text-sm">
                    <span>Total Amount:</span>
                    <span>
                      {formatCateringRupees(
                        printOrderModal.order.totalAmountPaise,
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between text-emerald-700">
                    <span>Paid So Far:</span>
                    <span>
                      {formatCateringRupees(
                        printOrderModal.order.amountPaidPaise,
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between text-amber-800 font-bold">
                    <span>Balance Due:</span>
                    <span>
                      {formatCateringRupees(
                        printOrderModal.order.balanceDuePaise,
                      )}
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-stone-900 text-white"
              >
                <Printer className="w-3.5 h-3.5" /> Print Now
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default CateringManagerView;
