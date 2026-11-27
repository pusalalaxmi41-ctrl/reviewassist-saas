import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useSearchParams } from 'react-router-dom';
import QRCode from 'qrcode';
import {
  AlertTriangle,
  Ban,
  BarChart3,
  Building2,
  Cake,
  CheckCircle2,
  Clock,
  Coffee,
  Copy,
  ExternalLink,
  Gamepad2,
  Gift,
  History,
  LayoutDashboard,
  MessageSquare,
  Minus,
  Package,
  Plus,
  QrCode,
  Receipt,
  RefreshCw,
  Search,
  Settings,
  ShieldAlert,
  Sparkles,
  Trash2,
  TrendingUp,
  Users,
  UtensilsCrossed,
  X,
} from 'lucide-react';
import type {
  AnalyticsEvent,
  Business,
  BusinessMetrics,
  CustomerDraftRecord,
} from '../../types/business';
import type {
  CafeCounterOrderStatus,
  CafeInventoryActionType,
  CafeInventoryCategory,
  CafeInventoryItem,
  CafeInventoryUnit,
  CafeOwnerDashboardPayload,
  CafeRewardRedemptionType,
} from '../../types/cafe';
import type {
  RestaurantMenuCategory,
  RestaurantMenuItem,
} from '../../types/restaurant';
import { businessRepository } from '../../services/storage';
import { categoryLabels } from '../../services/business/mockBusinesses';
import {
  ALLOWED_CAFE_INVENTORY_CATEGORIES,
  ALLOWED_CAFE_INVENTORY_UNITS,
  buildCafeRotatingCounterQrUrl,
  CAFE_INVENTORY_CATEGORY_META,
  CAFE_STARTER_MENU_ITEMS,
  getCafeHubUrl,
  getCafeRotatingSecondsRemaining,
} from '../../utils/cafeValidation';
import {
  formatPriceFromPaise,
  parseMajorCurrencyToPaise,
} from '../../utils/restaurantValidation';
import {
  loadWorkspaceModules,
  saveWorkspaceModules,
  type WorkspaceModuleVisibility,
} from '../../utils/workspaceModules';
import { copyText } from '../../utils/clipboard';
import { Button } from '../common/Button';
import {
  RestaurantManagerView,
  type RestaurantWorkspaceSection,
} from '../dashboard/RestaurantManagerView';
import { CustomerDraftsView } from '../dashboard/CustomerDraftsView';
import { QRCodeManager } from '../dashboard/QRCodeManager';
import { AnalyticsView } from '../dashboard/AnalyticsView';
import { AIConfigurationSettings } from '../dashboard/AIConfigurationSettings';
import { BusinessKnowledgeSettings } from '../dashboard/BusinessKnowledgeSettings';
import { GoogleUrlSettings } from '../dashboard/GoogleUrlSettings';
import { BusinessCategorySettings } from '../dashboard/BusinessCategorySettings';

type CafeTab =
  | 'overview'
  | 'counter'
  | 'analytics'
  | 'menu'
  | 'tables'
  | 'reviews'
  | 'staff'
  | 'inventory'
  | 'games_loyalty'
  | 'settings';

type CafeReviewSubTab = 'drafts' | 'qr' | 'analytics' | 'settings';
type CafeStockSubTab = 'ingredients' | 'expenses';
type CafeLoyaltySubTab = 'table_games' | 'stamp_pass';

function parseCafeTabFromParam(param: string | null): CafeTab {
  switch (param) {
    case 'counter':
      return 'counter';
    case 'analytics':
      return 'analytics';
    case 'menu':
      return 'menu';
    case 'tables':
      return 'tables';
    case 'reviews':
    case 'ai_reviews':
    case 'drafts':
    case 'qr':
      return 'reviews';
    case 'staff':
      return 'staff';
    case 'inventory':
      return 'inventory';
    case 'games_loyalty':
    case 'menu_rules':
      return 'games_loyalty';
    case 'settings':
      return 'settings';
    case 'overview':
    default:
      return 'overview';
  }
}

interface Props {
  business: Business;
  cafeBusinesses?: Business[];
  hasOtherBusinesses?: boolean;
  onSelectBusiness?: (slug: string) => void;
  onBusinessUpdated?: (updated: Business) => void;
}

export function CafeManagerView({
  business,
  cafeBusinesses = [],
  onSelectBusiness,
  onBusinessUpdated,
}: Props) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<CafeTab>(() =>
    parseCafeTabFromParam(searchParams.get('tab')),
  );
  const [reviewSubTab, setReviewSubTab] = useState<CafeReviewSubTab>('drafts');
  const [stockSubTab, setStockSubTab] =
    useState<CafeStockSubTab>('ingredients');
  const [loyaltySubTab, setLoyaltySubTab] =
    useState<CafeLoyaltySubTab>('table_games');
  const [moduleVisibility, setModuleVisibility] =
    useState<WorkspaceModuleVisibility>(() =>
      loadWorkspaceModules(business.id),
    );
  const [restaurantMountSeed, setRestaurantMountSeed] = useState(0);

  const [loading, setLoading] = useState(true);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [dashboard, setDashboard] = useState<CafeOwnerDashboardPayload | null>(
    null,
  );
  const [categories, setCategories] = useState<RestaurantMenuCategory[]>([]);
  const [menuItems, setMenuItems] = useState<RestaurantMenuItem[]>([]);
  const [metrics, setMetrics] = useState<BusinessMetrics>({
    qrScans: 0,
    feedbackSubmissions: 0,
    aiGenerations: 0,
    googleRedirectClicks: 0,
  });
  const [events, setEvents] = useState<AnalyticsEvent[]>([]);
  const [drafts, setDrafts] = useState<CustomerDraftRecord[]>([]);

  // Live 30s rotating counter QR state
  const qrCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [rotatingQrUrl, setRotatingQrUrl] = useState<string>(() =>
    getCafeHubUrl(business.slug),
  );
  const [secondsLeft, setSecondsLeft] = useState<number>(() =>
    getCafeRotatingSecondsRemaining(),
  );
  const [copiedCounterUrl, setCopiedCounterUrl] = useState(false);

  // Pass search & redeem state
  const [passSearch, setPassSearch] = useState('');
  const [redeemingKey, setRedeemingKey] = useState<string | null>(null);

  // Inventory filter & modals
  const [invCatFilter, setInvCatFilter] = useState<
    'all' | CafeInventoryCategory
  >('all');
  const [showAddInvModal, setShowAddInvModal] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [newItemCat, setNewItemCat] = useState<CafeInventoryCategory>('beans');
  const [newItemUnit, setNewItemUnit] = useState<CafeInventoryUnit>('kg');
  const [newItemStock, setNewItemStock] = useState('5');
  const [newItemThreshold, setNewItemThreshold] = useState('2');
  const [newItemCost, setNewItemCost] = useState('0');
  const [newItemSupplier, setNewItemSupplier] = useState('');

  const [adjustTarget, setAdjustTarget] = useState<{
    item: CafeInventoryItem;
    action: CafeInventoryActionType;
  } | null>(null);
  const [adjustQty, setAdjustQty] = useState('1');
  const [adjustCost, setAdjustCost] = useState('0');
  const [adjustNote, setAdjustNote] = useState('');
  const [savingStock, setSavingStock] = useState(false);

  // Stamp Rules & Config form state
  const [stampsRequired, setStampsRequired] = useState(8);
  const [rewardDrinkName, setRewardDrinkName] = useState(
    'Any Regular Cappuccino / Cold Coffee',
  );
  const [birthdayEnabled, setBirthdayEnabled] = useState(true);
  const [birthdayDrinkName, setBirthdayDrinkName] = useState(
    'Free Birthday Signature Coffee',
  );
  const [upiId, setUpiId] = useState('');
  const [savingConfig, setSavingConfig] = useState(false);
  const [seedingCafeMenu, setSeedingCafeMenu] = useState(false);

  const currentStatus = business.status ?? 'active';
  const currentAccountState = business.accountState ?? 'active';
  const isBusinessLive =
    currentStatus === 'active' && currentAccountState === 'active';

  const statusPillConfig: Record<
    NonNullable<Business['status']>,
    { label: string; className: string; Icon: typeof CheckCircle2 }
  > = {
    pending: {
      label: 'Awaiting Approval',
      className: 'bg-amber-50 text-amber-800 border-amber-200',
      Icon: Clock,
    },
    active: {
      label: 'Active',
      className: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      Icon: CheckCircle2,
    },
    rejected: {
      label: 'Rejected',
      className: 'bg-red-50 text-red-800 border-red-200',
      Icon: Ban,
    },
    suspended: {
      label: 'Suspended',
      className: 'bg-slate-100 text-slate-700 border-slate-200',
      Icon: ShieldAlert,
    },
  };

  const currentPill = statusPillConfig[currentStatus];
  const StatusIcon = currentPill.Icon;

  function notify(msg: string) {
    setErrorMsg(null);
    setStatusMsg(msg);
    window.setTimeout(() => {
      setStatusMsg((prev) => (prev === msg ? null : prev));
    }, 4000);
  }

  function handleTabChange(nextTab: CafeTab) {
    setActiveTab(nextTab);
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('slug', business.slug);
    if (nextTab === 'overview') {
      nextParams.delete('tab');
    } else {
      nextParams.set('tab', nextTab);
    }
    setSearchParams(nextParams, { replace: true });
  }

  function handleUpdateModules(next: WorkspaceModuleVisibility) {
    setModuleVisibility(saveWorkspaceModules(business.id, next));
  }

  const refreshCafeData = useCallback(async () => {
    try {
      const [dash, cats, items, m, evts, drfts] = await Promise.all([
        businessRepository.getCafeOwnerDashboard(business.id),
        businessRepository.getRestaurantMenuCategories(business.id),
        businessRepository.getRestaurantMenuItems(business.id),
        businessRepository.getMetrics(business.id),
        businessRepository.getEvents(business.id),
        businessRepository.getDrafts(business.id),
      ]);
      setDashboard(dash);
      setCategories(cats);
      setMenuItems(items);
      setMetrics(m);
      setEvents(evts);
      setDrafts(drfts);
      setStampsRequired(dash.config.stampsRequired);
      setRewardDrinkName(dash.config.rewardDrinkName);
      setBirthdayEnabled(dash.config.birthdayFreeCoffeeEnabled);
      setBirthdayDrinkName(dash.config.birthdayDrinkName);
      setUpiId(dash.config.upiId ?? '');
    } catch (err) {
      setErrorMsg((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [business.id]);

  useEffect(() => {
    let active = true;
    const initTimer = window.setTimeout(() => {
      if (active) void refreshCafeData();
    }, 0);
    const poll = window.setInterval(() => {
      if (active) void refreshCafeData();
    }, 10000);
    return () => {
      active = false;
      window.clearTimeout(initTimer);
      window.clearInterval(poll);
    };
  }, [refreshCafeData]);

  // 30-Second Anti-Fraud Rotating Counter QR Ticker
  const counterSecret = dashboard?.config.counterQrSecret ?? '';
  useEffect(() => {
    if (!counterSecret) return;
    let cancelled = false;
    let lastBucket = -1;

    async function syncQr(nowMs: number) {
      const bucket = Math.floor(nowMs / 30000);
      setSecondsLeft(getCafeRotatingSecondsRemaining(nowMs));
      if (bucket === lastBucket) return;
      lastBucket = bucket;
      try {
        const res = await buildCafeRotatingCounterQrUrl(
          business.slug,
          counterSecret,
          nowMs,
        );
        if (cancelled) return;
        setRotatingQrUrl(res.url);
        if (qrCanvasRef.current) {
          await QRCode.toCanvas(qrCanvasRef.current, res.url, {
            width: 196,
            margin: 1,
            color: { dark: '#1E1B4B', light: '#FFFFFF' },
          });
        }
      } catch {
        // ignore transient canvas errors
      }
    }

    void syncQr(Date.now());
    const tick = window.setInterval(() => {
      void syncQr(Date.now());
    }, 1000);
    return () => {
      cancelled = true;
      window.clearInterval(tick);
    };
  }, [business.slug, counterSecret, activeTab]);

  // Re-draw canvas whenever switching back to Counter tab
  useEffect(() => {
    if (activeTab !== 'counter' || !qrCanvasRef.current || !rotatingQrUrl)
      return;
    void QRCode.toCanvas(qrCanvasRef.current, rotatingQrUrl, {
      width: 196,
      margin: 1,
      color: { dark: '#1E1B4B', light: '#FFFFFF' },
    });
  }, [activeTab, rotatingQrUrl]);

  async function handleRedeemReward(
    passId: string,
    rewardType: CafeRewardRedemptionType,
    customerName: string,
  ) {
    setRedeemingKey(`${passId}-${rewardType}`);
    setErrorMsg(null);
    try {
      await businessRepository.redeemCafePassReward({
        businessId: business.id,
        passId,
        rewardType,
      });
      await refreshCafeData();
      notify(
        rewardType === 'birthday_free_coffee'
          ? `Redeemed Birthday Free Coffee for ${customerName}! 🎂☕`
          : `Redeemed Free Stamp Drink for ${customerName}! ✓`,
      );
    } catch (err) {
      setErrorMsg((err as Error).message);
    } finally {
      setRedeemingKey(null);
    }
  }

  async function handleUpdateOrderStatus(
    orderId: string,
    status: CafeCounterOrderStatus,
  ) {
    try {
      await businessRepository.updateCafeCounterOrderStatus({
        businessId: business.id,
        orderId,
        status,
      });
      await refreshCafeData();
      notify(`Counter pickup token updated to ${status.replace('_', ' ')} ✓`);
    } catch (err) {
      setErrorMsg((err as Error).message);
    }
  }

  async function handleCreateInventoryItem(e: React.FormEvent) {
    e.preventDefault();
    const costRes = parseMajorCurrencyToPaise(newItemCost || '0');
    if (!costRes.ok) {
      setErrorMsg(costRes.error);
      return;
    }
    setSavingStock(true);
    try {
      await businessRepository.createCafeInventoryItem(business.id, {
        itemName: newItemName,
        category: newItemCat,
        unit: newItemUnit,
        currentStock: Number.parseFloat(newItemStock) || 0,
        lowStockThreshold: Number.parseFloat(newItemThreshold) || 0,
        unitCostPaise: costRes.pricePaise,
        supplierNote: newItemSupplier.trim() || null,
      });
      setNewItemName('');
      setNewItemStock('5');
      setNewItemThreshold('2');
      setNewItemCost('0');
      setNewItemSupplier('');
      setShowAddInvModal(false);
      await refreshCafeData();
      notify('Added cafe ingredient to inventory ✓');
    } catch (err) {
      setErrorMsg((err as Error).message);
    } finally {
      setSavingStock(false);
    }
  }

  async function handleSeedInventoryStarter() {
    setSavingStock(true);
    try {
      const added = await businessRepository.seedCafeInventoryStarterPack(
        business.id,
      );
      await refreshCafeData();
      notify(
        added.length > 0
          ? `Added ${added.length} essential cafe ingredients (Beans, Milk, Oat Milk, Syrups, Cups & Croissants) ✓`
          : 'All starter cafe ingredients are already in your inventory.',
      );
    } catch (err) {
      setErrorMsg((err as Error).message);
    } finally {
      setSavingStock(false);
    }
  }

  async function handleSubmitStockAdjustment(e: React.FormEvent) {
    e.preventDefault();
    if (!adjustTarget) return;
    const qty = Number.parseFloat(adjustQty);
    if (!Number.isFinite(qty) || qty <= 0) {
      setErrorMsg('Enter a quantity greater than 0.');
      return;
    }
    const costRes = parseMajorCurrencyToPaise(adjustCost || '0');
    if (!costRes.ok) {
      setErrorMsg(costRes.error);
      return;
    }
    setSavingStock(true);
    try {
      await businessRepository.adjustCafeInventoryStock({
        businessId: business.id,
        itemId: adjustTarget.item.id,
        actionType: adjustTarget.action,
        quantity: qty,
        costPaise:
          adjustTarget.action === 'restock' ? costRes.pricePaise : 0,
        note: adjustNote.trim() || null,
        loggedBy: 'Owner',
      });
      const actionVerb =
        adjustTarget.action === 'restock'
          ? 'Restocked'
          : adjustTarget.action === 'usage'
            ? 'Logged usage for'
            : 'Logged wastage for';
      notify(
        `${actionVerb} ${qty} ${adjustTarget.item.unit} of ${adjustTarget.item.itemName} ✓`,
      );
      setAdjustTarget(null);
      setAdjustQty('1');
      setAdjustCost('0');
      setAdjustNote('');
      await refreshCafeData();
    } catch (err) {
      setErrorMsg((err as Error).message);
    } finally {
      setSavingStock(false);
    }
  }

  async function handleDeleteInventoryItem(item: CafeInventoryItem) {
    try {
      await businessRepository.deleteCafeInventoryItem(business.id, item.id);
      await refreshCafeData();
      notify(`Removed ${item.itemName} from inventory.`);
    } catch (err) {
      setErrorMsg((err as Error).message);
    }
  }

  async function handleSaveStampConfig(e: React.FormEvent) {
    e.preventDefault();
    setSavingConfig(true);
    try {
      await businessRepository.updateCafeConfig(business.id, {
        stampsRequired,
        rewardDrinkName,
        birthdayFreeCoffeeEnabled: birthdayEnabled,
        birthdayDrinkName,
        upiId: upiId.trim() || null,
      });
      await refreshCafeData();
      notify('Saved Digital Stamp Card & Birthday Coffee rules ✓');
    } catch (err) {
      setErrorMsg((err as Error).message);
    } finally {
      setSavingConfig(false);
    }
  }

  async function handleSeedPopularCafeDrinks() {
    setSeedingCafeMenu(true);
    try {
      const catByName = new Map(
        categories.map((c) => [c.name.toLowerCase(), c]),
      );
      const existingNames = new Set(
        menuItems.map((i) => i.name.toLowerCase()),
      );
      let added = 0;
      for (const spec of CAFE_STARTER_MENU_ITEMS) {
        if (existingNames.has(spec.name.toLowerCase())) continue;
        let cat = catByName.get(spec.categoryName.toLowerCase());
        if (!cat) {
          cat = await businessRepository.createRestaurantMenuCategory(
            business.id,
            {
              name: spec.categoryName,
              description: 'Freshly brewed at the bar',
              isActive: true,
            },
          );
          catByName.set(spec.categoryName.toLowerCase(), cat);
        }
        await businessRepository.createRestaurantMenuItem(business.id, {
          categoryId: cat.id,
          name: spec.name,
          description: spec.description,
          pricePaise: spec.pricePaise,
          dietaryTag: 'veg',
          isAvailable: true,
          isFeatured: Boolean(spec.isFeatured),
        });
        added++;
      }
      await refreshCafeData();
      setRestaurantMountSeed((n) => n + 1);
      notify(
        added > 0
          ? `Added ${added} signature cafe drinks & bakery items ✓`
          : 'Starter cafe drinks are already on your menu.',
      );
    } catch (err) {
      setErrorMsg((err as Error).message);
    } finally {
      setSeedingCafeMenu(false);
    }
  }

  const passes = useMemo(() => dashboard?.passes ?? [], [dashboard]);
  const inventoryItems = useMemo(
    () => dashboard?.inventoryItems ?? [],
    [dashboard],
  );
  const inventoryLogs = useMemo(
    () => dashboard?.inventoryLogs ?? [],
    [dashboard],
  );
  const counterOrders = useMemo(
    () => dashboard?.counterOrders ?? [],
    [dashboard],
  );

  const lowStockItems = useMemo(
    () => inventoryItems.filter((i) => i.currentStock <= i.lowStockThreshold),
    [inventoryItems],
  );

  const filteredInventory = useMemo(
    () =>
      invCatFilter === 'all'
        ? inventoryItems
        : inventoryItems.filter((i) => i.category === invCatFilter),
    [inventoryItems, invCatFilter],
  );

  const filteredPasses = useMemo(() => {
    const q = passSearch.trim().toLowerCase();
    if (!q) return passes.slice(0, 12);
    return passes.filter(
      (p) =>
        p.customerName.toLowerCase().includes(q) ||
        p.phone.includes(q) ||
        p.passCode.toLowerCase().includes(q),
    );
  }, [passes, passSearch]);

  const activePickupOrders = useMemo(
    () =>
      counterOrders.filter(
        (o) =>
          o.status === 'queued' ||
          o.status === 'preparing' ||
          o.status === 'ready',
      ),
    [counterOrders],
  );

  if (loading && !dashboard) {
    return (
      <div className="py-20 text-center" role="status">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-[#1E1B4B] border-r-transparent" />
        <p className="mt-3 text-[14px] font-medium text-slate-500">
          Loading CafeOS Studio…
        </p>
      </div>
    );
  }

  const stats = dashboard?.stats ?? {
    lowStockCount: 0,
    activeStampHolders: 0,
    stampsIssuedToday: 0,
    counterOrdersToday: 0,
    birthdaysTodayCount: 0,
  };

  const selectableBusinesses =
    cafeBusinesses.length > 0 ? cafeBusinesses : [business];

  type CafeNavItem = {
    id: CafeTab;
    label: string;
    shortLabel: string;
    Icon: typeof LayoutDashboard;
    badge?: number;
    danger?: boolean;
    visible?: boolean;
  };

  const navGroups: Array<{ groupLabel: string; items: CafeNavItem[] }> = [
    {
      groupLabel: 'Operations',
      items: [
        {
          id: 'overview',
          label: 'Live Desk',
          shortLabel: 'Live',
          Icon: LayoutDashboard,
          visible: true,
        },
        {
          id: 'counter',
          label: 'Counter & Stamp Pass',
          shortLabel: 'Counter',
          Icon: Coffee,
          badge:
            activePickupOrders.length > 0
              ? activePickupOrders.length
              : undefined,
          visible: true,
        },
        {
          id: 'analytics',
          label: 'Analytics',
          shortLabel: 'Stats',
          Icon: TrendingUp,
          visible: true,
        },
        {
          id: 'menu',
          label: 'Digital Menu',
          shortLabel: 'Menu',
          Icon: UtensilsCrossed,
          visible: true,
        },
        {
          id: 'tables',
          label: 'Tables & QRs',
          shortLabel: 'Tables',
          Icon: QrCode,
          visible: true,
        },
      ],
    },
    {
      groupLabel: 'Growth & Team',
      items: [
        {
          id: 'reviews',
          label: 'AI Reviews',
          shortLabel: 'Reviews',
          Icon: Sparkles,
          badge: drafts.length > 0 ? drafts.length : undefined,
          visible: moduleVisibility.aiReviews,
        },
        {
          id: 'staff',
          label: 'Staff & Waiters',
          shortLabel: 'Staff',
          Icon: Users,
          visible: moduleVisibility.staff,
        },
        {
          id: 'inventory',
          label: 'Stock & Expenses',
          shortLabel: 'Stock',
          Icon: Package,
          badge: stats.lowStockCount > 0 ? stats.lowStockCount : undefined,
          danger: stats.lowStockCount > 0,
          visible: moduleVisibility.inventory,
        },
        {
          id: 'games_loyalty',
          label: 'Games & Loyalty',
          shortLabel: 'Loyalty',
          Icon: Gamepad2,
          visible: moduleVisibility.gamesLoyalty,
        },
      ],
    },
    {
      groupLabel: 'System',
      items: [
        {
          id: 'settings',
          label: 'Settings',
          shortLabel: 'Settings',
          Icon: Settings,
          visible: true,
        },
      ],
    },
  ];

  // Map active CafeOS tab -> RestaurantManagerView section (Strictly Tables ONLY — Zero Hotel Rooms!)
  const restaurantSection: RestaurantWorkspaceSection | null =
    activeTab === 'overview'
      ? 'overview'
      : activeTab === 'analytics'
        ? 'analytics'
        : activeTab === 'menu'
          ? 'menu'
          : activeTab === 'tables'
            ? 'tables'
            : activeTab === 'staff'
              ? 'staff'
              : activeTab === 'inventory' && stockSubTab === 'expenses'
                ? 'inventory'
                : activeTab === 'games_loyalty' &&
                    loyaltySubTab === 'table_games'
                  ? 'games_loyalty'
                  : activeTab === 'settings'
                    ? 'settings'
                    : null;

  return (
    <div className="flex min-h-[calc(100vh-52px)] w-full flex-col lg:flex-row">
      {/* FULL-BLEED DOCKED LEFT SIDEBAR RAIL — UNIFIED CAFE OS */}
      <aside
        aria-label="CafeOS Workspace Navigation"
        className="w-full lg:w-[224px] lg:shrink-0 border-b lg:border-b-0 lg:border-r border-slate-200 bg-white flex flex-col justify-between lg:sticky lg:top-[52px] lg:h-[calc(100vh-52px)] lg:overflow-y-auto"
      >
        <div className="p-3 space-y-4">
          {/* Active Cafe Property Selector */}
          <div className="space-y-1.5 border-b border-slate-100 pb-3">
            <div className="flex items-center justify-between gap-2 px-1">
              <span className="inline-flex items-center gap-1 text-[10.5px] font-bold uppercase tracking-wider text-amber-800">
                <Coffee className="h-3 w-3" aria-hidden /> CafeOS
              </span>
              <Link
                to="/setup"
                className="inline-flex items-center gap-0.5 text-[11.5px] font-semibold text-[#1E1B4B] hover:underline"
              >
                <Plus className="h-3 w-3" aria-hidden /> New
              </Link>
            </div>

            {onSelectBusiness ? (
              <div className="flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2.5">
                <Building2
                  className="h-3.5 w-3.5 shrink-0 text-[#1E1B4B]"
                  aria-hidden
                />
                <select
                  aria-label="Select cafe property"
                  value={business.slug}
                  onChange={(e) => onSelectBusiness(e.target.value)}
                  className="w-full min-w-0 truncate bg-transparent text-[13px] font-semibold text-[#111827] focus:outline-none cursor-pointer"
                >
                  {selectableBusinesses.map((b) => (
                    <option key={b.id} value={b.slug}>
                      {b.name} ({b.city})
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2">
                <p className="truncate text-[13px] font-bold text-[#111827]">
                  {business.name}
                </p>
                <p className="truncate text-[11px] text-slate-500">
                  ☕ Cafe · {business.city}
                </p>
              </div>
            )}
          </div>

          {/* Grouped Operations / Growth & Team / System Navigation */}
          <nav className="flex overflow-x-auto lg:overflow-x-visible lg:flex-col gap-3">
            {navGroups.map((group) => {
              const visibleItems = group.items.filter(
                (i) => i.visible !== false,
              );
              if (visibleItems.length === 0) return null;
              return (
                <div
                  key={group.groupLabel}
                  className="flex lg:flex-col gap-0.5 shrink-0 lg:shrink"
                >
                  <p className="hidden lg:block px-2.5 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    {group.groupLabel}
                  </p>
                  {visibleItems.map(
                    ({ id, label, shortLabel, Icon, badge, danger }) => {
                      const isActive = activeTab === id;
                      return (
                        <button
                          key={id}
                          type="button"
                          onClick={() => handleTabChange(id)}
                          aria-current={isActive ? 'page' : undefined}
                          className={`flex h-9 shrink-0 lg:shrink lg:w-full items-center justify-between gap-2 rounded-lg px-2.5 text-[13px] font-medium transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1E1B4B] ${
                            isActive
                              ? 'bg-[#1E1B4B] text-white font-semibold'
                              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                          }`}
                        >
                          <span className="flex min-w-0 items-center gap-2.5">
                            <Icon
                              className={`h-4 w-4 shrink-0 ${
                                isActive ? 'text-[#D2DB76]' : 'text-slate-500'
                              }`}
                              aria-hidden
                            />
                            <span className="hidden sm:inline truncate">
                              {label}
                            </span>
                            <span className="sm:hidden">{shortLabel}</span>
                          </span>
                          {badge !== undefined && (
                            <span
                              className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10.5px] font-bold tabular-nums ${
                                danger
                                  ? 'bg-rose-600 text-white'
                                  : isActive
                                    ? 'bg-[#D2DB76] text-[#1E1B4B]'
                                    : 'bg-slate-100 text-slate-700'
                              }`}
                            >
                              {badge}
                            </span>
                          )}
                        </button>
                      );
                    },
                  )}
                </div>
              );
            })}
          </nav>
        </div>

        {/* Clean Sidebar Property Footer */}
        <div className="hidden lg:block border-t border-slate-100 p-3 space-y-2.5">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#1E1B4B] text-[#D2DB76]">
              <Coffee className="h-4 w-4" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-semibold text-[#111827]">
                {business.name}
              </p>
              <p className="truncate text-[11px] text-slate-500">
                {categoryLabels[business.category]} • {business.city}
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between gap-2">
            <span
              className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10.5px] font-semibold ${currentPill.className}`}
            >
              <StatusIcon className="h-3 w-3 shrink-0" aria-hidden />
              {currentPill.label}
            </span>
            {isBusinessLive && (
              <div className="flex items-center gap-2">
                <Link
                  to={`/r/${business.slug}/menu`}
                  target="_blank"
                  className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-[#1E1B4B] hover:underline"
                >
                  Menu <ExternalLink className="h-3 w-3" aria-hidden />
                </Link>
                <Link
                  to={`/r/${business.slug}/cafe`}
                  target="_blank"
                  className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-amber-800 hover:underline"
                >
                  Pass <ExternalLink className="h-3 w-3" aria-hidden />
                </Link>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* MAIN CAFE WORKSPACE CANVAS */}
      <div className="flex-1 min-w-0 bg-[#F8F9FA] px-4 py-4 sm:px-6 sm:py-5 space-y-4">
        {!isBusinessLive && (
          <div
            role="status"
            className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3"
          >
            <div className="flex items-center gap-2">
              <StatusIcon className="h-4 w-4 text-amber-700" aria-hidden />
              <p className="text-[13px] font-semibold text-amber-950">
                {business.status === 'pending'
                  ? 'Preview Mode — Awaiting Platform Approval. You can set up Menu, Tables, Staff & Stamp Rules now.'
                  : 'Public links are currently paused.'}
              </p>
            </div>
          </div>
        )}

        {statusMsg && (
          <div
            role="status"
            className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-[13px] font-medium text-emerald-800"
          >
            <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden />
            <span>{statusMsg}</span>
          </div>
        )}
        {errorMsg && (
          <div
            role="alert"
            className="flex items-center justify-between gap-2 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-[13px] font-medium text-red-800"
          >
            <span>{errorMsg}</span>
            <button
              type="button"
              onClick={() => setErrorMsg(null)}
              className="rounded p-1 hover:bg-red-100 cursor-pointer"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>
        )}

        {/* DIGITAL MENU QUICK CAFE STARTER BAR */}
        {activeTab === 'menu' && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#1E1B4B] text-[#D2DB76]">
                <Coffee className="h-4 w-4" aria-hidden />
              </span>
              <div>
                <p className="text-[13px] font-bold text-[#111827]">
                  Unified Cafe Table &amp; Counter Menu
                </p>
                <p className="text-[11.5px] text-slate-500">
                  Every drink &amp; bakery item syncs live to both Table QR ordering and Counter Pickup (#C-01).
                </p>
              </div>
            </div>
            <Button
              type="button"
              variant="secondary"
              loading={seedingCafeMenu}
              onClick={() => void handleSeedPopularCafeDrinks()}
            >
              <Sparkles className="h-3.5 w-3.5" aria-hidden />
              Seed 5 Signature Cafe Drinks
            </Button>
          </div>
        )}

        {/* STOCK & EXPENSES SUB-SWITCHER (RAW CAFE INGREDIENTS + MONTHLY EXPENSES) */}
        {activeTab === 'inventory' && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-2">
            <div className="flex flex-wrap items-center gap-1.5" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={stockSubTab === 'ingredients'}
                onClick={() => setStockSubTab('ingredients')}
                className={`inline-flex h-9 items-center gap-2 rounded-lg px-3.5 text-[13px] font-semibold transition-colors cursor-pointer ${
                  stockSubTab === 'ingredients'
                    ? 'bg-[#1E1B4B] text-white'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Coffee
                  className={`h-3.5 w-3.5 ${
                    stockSubTab === 'ingredients'
                      ? 'text-[#D2DB76]'
                      : 'text-slate-500'
                  }`}
                  aria-hidden
                />
                <span>Cafe Raw Ingredients (Beans, Milk &amp; Cups)</span>
                {stats.lowStockCount > 0 && (
                  <span className="rounded bg-rose-600 px-1.5 py-0.5 text-[10.5px] font-bold text-white tabular-nums">
                    {stats.lowStockCount}
                  </span>
                )}
              </button>

              <button
                type="button"
                role="tab"
                aria-selected={stockSubTab === 'expenses'}
                onClick={() => setStockSubTab('expenses')}
                className={`inline-flex h-9 items-center gap-2 rounded-lg px-3.5 text-[13px] font-semibold transition-colors cursor-pointer ${
                  stockSubTab === 'expenses'
                    ? 'bg-[#1E1B4B] text-white'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Receipt
                  className={`h-3.5 w-3.5 ${
                    stockSubTab === 'expenses'
                      ? 'text-[#D2DB76]'
                      : 'text-slate-500'
                  }`}
                  aria-hidden
                />
                <span>Monthly Stock &amp; Expenses</span>
              </button>
            </div>
          </div>
        )}

        {/* GAMES & LOYALTY SUB-SWITCHER (TABLE GAMES & STARS + COFFEE STAMP & BIRTHDAY PASS) */}
        {activeTab === 'games_loyalty' && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-2">
            <div className="flex flex-wrap items-center gap-1.5" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={loyaltySubTab === 'table_games'}
                onClick={() => setLoyaltySubTab('table_games')}
                className={`inline-flex h-9 items-center gap-2 rounded-lg px-3.5 text-[13px] font-semibold transition-colors cursor-pointer ${
                  loyaltySubTab === 'table_games'
                    ? 'bg-[#1E1B4B] text-white'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Gamepad2
                  className={`h-3.5 w-3.5 ${
                    loyaltySubTab === 'table_games'
                      ? 'text-[#D2DB76]'
                      : 'text-slate-500'
                  }`}
                  aria-hidden
                />
                <span>Table Games &amp; Loyalty Stars</span>
              </button>

              <button
                type="button"
                role="tab"
                aria-selected={loyaltySubTab === 'stamp_pass'}
                onClick={() => setLoyaltySubTab('stamp_pass')}
                className={`inline-flex h-9 items-center gap-2 rounded-lg px-3.5 text-[13px] font-semibold transition-colors cursor-pointer ${
                  loyaltySubTab === 'stamp_pass'
                    ? 'bg-[#1E1B4B] text-white'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Cake
                  className={`h-3.5 w-3.5 ${
                    loyaltySubTab === 'stamp_pass'
                      ? 'text-[#D2DB76]'
                      : 'text-slate-500'
                  }`}
                  aria-hidden
                />
                <span>Coffee Stamp Card &amp; Birthday Rules</span>
              </button>
            </div>
          </div>
        )}

        {/* ===================================================================
            UNIFIED CAFE OPERATIONS ENGINE (TABLES ONLY — ZERO HOTEL ROOMS!)
            Covers: Live Desk, Analytics, Digital Menu, Tables & QRs,
                    Staff & Waiters, Monthly Stock & Expenses,
                    Table Games & Loyalty, and Settings
           =================================================================== */}
        {restaurantSection && (
          <RestaurantManagerView
            key={`cafe-ops-${business.id}-${restaurantMountSeed}`}
            business={business}
            isBusinessLive={isBusinessLive}
            activeSection={restaurantSection}
            onSectionChange={(sec) => {
              if (sec === 'inventory') setStockSubTab('expenses');
              if (sec === 'games_loyalty') setLoyaltySubTab('table_games');
              handleTabChange(sec);
            }}
            moduleVisibility={moduleVisibility}
            onModuleVisibilityChange={handleUpdateModules}
            disableHotelRooms
          />
        )}

        {/* ===================================================================
            CAFE SIGNATURE TAB: COUNTER & LIVE COFFEE STAMP PASS
           =================================================================== */}
        {activeTab === 'counter' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3.5">
              <div>
                <h1 className="text-[22px] font-bold tracking-tight text-[#111827]">
                  Counter &amp; Live Coffee Stamp Pass
                </h1>
                <p className="text-[13px] text-slate-500">
                  Live 30-second anti-fraud counter QR, birthday free coffee redemptions, and pickup token queue.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => void refreshCafeData()}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-[12.5px] font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  <RefreshCw className="h-3.5 w-3.5" aria-hidden /> Sync
                </button>
                {isBusinessLive && (
                  <a
                    href={getCafeHubUrl(business.slug)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#1E1B4B] px-3.5 text-[12.5px] font-semibold text-white hover:bg-[#2E2A6E]"
                  >
                    Customer Pass{' '}
                    <ExternalLink
                      className="h-3.5 w-3.5 text-[#D2DB76]"
                      aria-hidden
                    />
                  </a>
                )}
              </div>
            </div>

            {/* 4 Hero KPI Cards */}
            <div className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
              <button
                type="button"
                onClick={() => {
                  setStockSubTab('ingredients');
                  handleTabChange('inventory');
                }}
                className={`text-left rounded-xl border p-4 transition-colors cursor-pointer ${
                  stats.lowStockCount > 0
                    ? 'border-rose-300 bg-rose-50 hover:bg-rose-100/70'
                    : 'border-slate-200 bg-white hover:bg-slate-50'
                }`}
              >
                <p
                  className={`text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5 ${
                    stats.lowStockCount > 0 ? 'text-rose-700' : 'text-slate-500'
                  }`}
                >
                  <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
                  Low-Stock Alerts
                </p>
                <p
                  className={`mt-1 text-[28px] font-bold tabular-nums ${
                    stats.lowStockCount > 0 ? 'text-rose-700' : 'text-[#111827]'
                  }`}
                >
                  {stats.lowStockCount}
                </p>
                <p className="text-[11.5px] text-slate-500">
                  {stats.lowStockCount > 0
                    ? 'Tap to restock low ingredients →'
                    : 'All beans, milk & cups stocked'}
                </p>
              </button>

              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  <Coffee className="h-3.5 w-3.5 text-[#1E1B4B]" aria-hidden />
                  Active Stamp Holders
                </p>
                <p className="mt-1 text-[28px] font-bold text-[#111827] tabular-nums">
                  {stats.activeStampHolders}
                </p>
                <p className="text-[11.5px] text-slate-500">
                  {stats.birthdaysTodayCount > 0
                    ? `🎂 ${stats.birthdaysTodayCount} birthday coffee today!`
                    : 'Phone wallet stamp cards'}
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  <Gift className="h-3.5 w-3.5 text-emerald-600" aria-hidden />
                  Stamps Issued Today
                </p>
                <p className="mt-1 text-[28px] font-bold text-[#111827] tabular-nums">
                  {stats.stampsIssuedToday}
                </p>
                <p className="text-[11.5px] text-slate-500">
                  {stampsRequired} stamps → 1 free drink
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  <UtensilsCrossed
                    className="h-3.5 w-3.5 text-[#1E1B4B]"
                    aria-hidden
                  />
                  Counter Orders Today
                </p>
                <p className="mt-1 text-[28px] font-bold text-[#111827] tabular-nums">
                  {stats.counterOrdersToday}
                </p>
                <p className="text-[11.5px] text-slate-500">
                  {activePickupOrders.length} active pickup token
                  {activePickupOrders.length === 1 ? '' : 's'}
                </p>
              </div>
            </div>

            {/* 2-Column Main Counter Desk: Live Rotating Counter QR + Lookup/Queue */}
            <div className="grid gap-4 xl:grid-cols-12 items-start">
              {/* LEFT (4 cols): Live 30-Second Rotating Counter QR Card */}
              <div className="xl:col-span-4 rounded-xl border border-slate-200 bg-white p-5 space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <h2 className="text-[15px] font-bold text-[#111827]">
                      Live Counter Stamp QR
                    </h2>
                    <p className="text-[12px] text-slate-500">
                      Rotates every 30s to block screenshot abuse
                    </p>
                  </div>
                  <span className="rounded-md bg-[#1E1B4B] px-2 py-1 text-[11px] font-bold text-[#D2DB76] tabular-nums">
                    {secondsLeft}s
                  </span>
                </div>

                {/* Progress Bar */}
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full bg-[#1E1B4B] transition-all duration-1000"
                    style={{
                      width: `${Math.round((secondsLeft / 30) * 100)}%`,
                    }}
                  />
                </div>

                <div className="flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-[#F8F9FA] p-5">
                  <canvas
                    ref={qrCanvasRef}
                    className="h-[196px] w-[196px] rounded-lg bg-white p-2 border border-slate-200"
                  />
                  <p className="mt-3 text-center text-[12px] font-semibold text-[#1E1B4B]">
                    Customers scan while in line for +1 Coffee Stamp
                  </p>
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={async () => {
                      const ok = await copyText(rotatingQrUrl);
                      if (ok) {
                        setCopiedCounterUrl(true);
                        window.setTimeout(
                          () => setCopiedCounterUrl(false),
                          2000,
                        );
                      }
                    }}
                    className="flex-1 inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-[12px] font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                  >
                    <Copy className="h-3.5 w-3.5" aria-hidden />
                    {copiedCounterUrl
                      ? 'Copied Live URL ✓'
                      : 'Copy Live Stamp URL'}
                  </button>
                  <a
                    href={rotatingQrUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-9 items-center justify-center gap-1 rounded-lg bg-[#1E1B4B] px-3 text-[12px] font-semibold text-white hover:bg-[#2E2A6E]"
                  >
                    Test Scan{' '}
                    <ExternalLink
                      className="h-3.5 w-3.5 text-[#D2DB76]"
                      aria-hidden
                    />
                  </a>
                </div>
              </div>

              {/* RIGHT (8 cols): Reward & Birthday Lookup + Counter Pickup Queue */}
              <div className="xl:col-span-8 space-y-4">
                <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h2 className="text-[15px] font-bold text-[#111827] flex items-center gap-2">
                        <Gift className="h-4 w-4 text-[#1E1B4B]" aria-hidden />
                        Stamp Card &amp; Birthday Free Coffee Redemption
                      </h2>
                      <p className="text-[12px] text-slate-500">
                        Search customer Phone or Pass Code (e.g. BREW-001) for 1-tap redemption.
                      </p>
                    </div>
                    <div className="relative w-full sm:w-64">
                      <Search
                        className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400"
                        aria-hidden
                      />
                      <input
                        type="text"
                        value={passSearch}
                        onChange={(e) => setPassSearch(e.target.value)}
                        placeholder="Phone or BREW-001…"
                        className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 pl-8 pr-3 text-[13px] font-medium text-[#111827] focus:border-[#1E1B4B] focus:bg-white focus:outline-none"
                      />
                    </div>
                  </div>

                  {filteredPasses.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-[13px] text-slate-500">
                      No digital coffee stamp cards yet. Have your first guest scan the Live Counter QR on the left!
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100">
                      {filteredPasses.map((pass) => (
                        <div
                          key={pass.id}
                          className="flex flex-wrap items-center justify-between gap-3 py-3"
                        >
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-mono text-[11.5px] font-bold rounded bg-[#1E1B4B] px-2 py-0.5 text-[#D2DB76]">
                                {pass.passCode}
                              </span>
                              <span className="text-[14px] font-bold text-[#111827]">
                                {pass.customerName}
                              </span>
                              <span className="text-[12px] text-slate-500">
                                {pass.phone}
                              </span>
                              {pass.isBirthdayToday && (
                                <span className="inline-flex items-center gap-1 rounded-md bg-[#D2DB76] px-2 py-0.5 text-[11px] font-bold text-[#1E1B4B]">
                                  <Cake className="h-3 w-3" aria-hidden />
                                  🎂 Birthday Today!
                                </span>
                              )}
                            </div>
                            <p className="mt-1 text-[12px] text-slate-600">
                              Stamps:{' '}
                              <strong className="text-[#1E1B4B]">
                                {pass.currentStamps} / {stampsRequired}
                              </strong>{' '}
                              · Lifetime: {pass.lifetimeStamps} · Free Drinks Ready:{' '}
                              <strong className="text-emerald-700">
                                {pass.freeDrinksAvailable}
                              </strong>
                            </p>
                          </div>

                          <div className="flex flex-wrap items-center gap-2">
                            {pass.isBirthdayToday && (
                              <button
                                type="button"
                                disabled={
                                  redeemingKey ===
                                  `${pass.id}-birthday_free_coffee`
                                }
                                onClick={() =>
                                  void handleRedeemReward(
                                    pass.id,
                                    'birthday_free_coffee',
                                    pass.customerName,
                                  )
                                }
                                className="inline-flex h-8.5 items-center gap-1.5 rounded-lg bg-[#D2DB76] px-3 text-[12px] font-bold text-[#1E1B4B] hover:brightness-95 cursor-pointer"
                              >
                                <Cake className="h-3.5 w-3.5" aria-hidden />
                                Redeem Birthday Coffee ✓
                              </button>
                            )}
                            {pass.freeDrinksAvailable > 0 && (
                              <button
                                type="button"
                                disabled={
                                  redeemingKey ===
                                  `${pass.id}-stamp_free_drink`
                                }
                                onClick={() =>
                                  void handleRedeemReward(
                                    pass.id,
                                    'stamp_free_drink',
                                    pass.customerName,
                                  )
                                }
                                className="inline-flex h-8.5 items-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-[12px] font-semibold text-white hover:bg-emerald-700 cursor-pointer"
                              >
                                <Gift className="h-3.5 w-3.5" aria-hidden />
                                Redeem Free Drink ({pass.freeDrinksAvailable}) ✓
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Fast Counter Pickup Queue (#C-01, #C-02) */}
                <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <h2 className="text-[15px] font-bold text-[#111827]">
                      Counter Pickup Token Queue ({activePickupOrders.length})
                    </h2>
                    <span className="text-[11.5px] font-medium text-slate-500">
                      Auto-resets daily at #C-01
                    </span>
                  </div>

                  {activePickupOrders.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-[13px] text-slate-500">
                      No active counter pickup orders right now. Guest counter orders from{' '}
                      <code className="font-mono text-[#1E1B4B]">
                        /r/{business.slug}/cafe
                      </code>{' '}
                      appear here instantly.
                    </div>
                  ) : (
                    <div className="grid gap-3 sm:grid-cols-2">
                      {activePickupOrders.map((ord) => (
                        <div
                          key={ord.id}
                          className={`rounded-xl border p-3.5 space-y-2.5 ${
                            ord.status === 'ready'
                              ? 'border-emerald-300 bg-emerald-50/70'
                              : ord.status === 'preparing'
                                ? 'border-amber-300 bg-amber-50/60'
                                : 'border-slate-200 bg-white'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span className="rounded-md bg-[#1E1B4B] px-2 py-0.5 font-mono text-[13px] font-bold text-[#D2DB76]">
                                {ord.tokenCode}
                              </span>
                              <span className="text-[13.5px] font-bold text-[#111827]">
                                {ord.customerName}
                              </span>
                            </div>
                            <span className="text-[13px] font-bold text-[#1E1B4B] tabular-nums">
                              {formatPriceFromPaise(ord.subtotalPaise, 'INR')}
                            </span>
                          </div>

                          <p className="text-[12.5px] font-medium text-slate-700">
                            {ord.items
                              .map((i) => `${i.quantity}× ${i.name}`)
                              .join(', ')}
                          </p>
                          {ord.orderNote && (
                            <p className="text-[11.5px] italic text-amber-800">
                              Note: &ldquo;{ord.orderNote}&rdquo;
                            </p>
                          )}

                          <div className="flex items-center gap-2 pt-1">
                            {ord.status === 'queued' && (
                              <button
                                type="button"
                                onClick={() =>
                                  void handleUpdateOrderStatus(
                                    ord.id,
                                    'preparing',
                                  )
                                }
                                className="flex-1 h-8.5 rounded-lg bg-[#1E1B4B] text-[12px] font-semibold text-white hover:bg-[#2E2A6E] cursor-pointer"
                              >
                                Start Brewing →
                              </button>
                            )}
                            {ord.status === 'preparing' && (
                              <button
                                type="button"
                                onClick={() =>
                                  void handleUpdateOrderStatus(ord.id, 'ready')
                                }
                                className="flex-1 h-8.5 rounded-lg bg-[#D2DB76] text-[12px] font-bold text-[#1E1B4B] hover:brightness-95 cursor-pointer"
                              >
                                Ready for Pickup ✓
                              </button>
                            )}
                            {ord.status === 'ready' && (
                              <button
                                type="button"
                                onClick={() =>
                                  void handleUpdateOrderStatus(
                                    ord.id,
                                    'picked_up',
                                  )
                                }
                                className="flex-1 h-8.5 rounded-lg bg-emerald-600 text-[12px] font-semibold text-white hover:bg-emerald-700 cursor-pointer"
                              >
                                Handed Over / Done ✓
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ===================================================================
            CAFE RAW INGREDIENTS & LOW-STOCK RADAR (BEANS, MILK, CUPS)
           =================================================================== */}
        {activeTab === 'inventory' && stockSubTab === 'ingredients' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3.5">
              <div>
                <h1 className="text-[22px] font-bold tracking-tight text-[#111827]">
                  Cafe Raw Ingredients &amp; Low-Stock Radar
                </h1>
                <p className="text-[13px] text-slate-500">
                  Track coffee beans (kg), milk (liters), syrups, cups &amp; lids, and bakery batches with 1-tap shift usage &amp; restock logs.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={savingStock}
                  onClick={() => void handleSeedInventoryStarter()}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-[12.5px] font-semibold text-[#1E1B4B] hover:bg-slate-50 cursor-pointer"
                >
                  <Sparkles className="h-3.5 w-3.5" aria-hidden />
                  Starter Pack (6 Essentials)
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddInvModal(true)}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#1E1B4B] px-3.5 text-[12.5px] font-semibold text-white hover:bg-[#2E2A6E] cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5 text-[#D2DB76]" aria-hidden />
                  Add Ingredient
                </button>
              </div>
            </div>

            {lowStockItems.length > 0 && (
              <div className="rounded-xl border border-rose-300 bg-rose-50 px-4 py-3 space-y-1.5">
                <p className="text-[12.5px] font-bold text-rose-800 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
                  Low-Stock Radar ({lowStockItems.length} item
                  {lowStockItems.length === 1 ? '' : 's'} need restocking):
                </p>
                <div className="flex flex-wrap gap-2">
                  {lowStockItems.map((it) => (
                    <button
                      key={it.id}
                      type="button"
                      onClick={() => {
                        setAdjustTarget({ item: it, action: 'restock' });
                        setAdjustQty('5');
                        setAdjustCost('0');
                      }}
                      className="rounded-lg border border-rose-200 bg-white px-2.5 py-1 text-[12px] font-semibold text-rose-900 hover:bg-rose-100 cursor-pointer"
                    >
                      {it.itemName}:{' '}
                      <strong>
                        {it.currentStock} {it.unit} left
                      </strong>{' '}
                      — + Restock
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => setInvCatFilter('all')}
                className={`h-8.5 rounded-lg px-3 text-[12px] font-semibold cursor-pointer ${
                  invCatFilter === 'all'
                    ? 'bg-[#1E1B4B] text-white'
                    : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                All Stock ({inventoryItems.length})
              </button>
              {ALLOWED_CAFE_INVENTORY_CATEGORIES.map((cat) => {
                const meta = CAFE_INVENTORY_CATEGORY_META[cat];
                const cnt = inventoryItems.filter(
                  (i) => i.category === cat,
                ).length;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setInvCatFilter(cat)}
                    className={`h-8.5 rounded-lg px-3 text-[12px] font-semibold cursor-pointer ${
                      invCatFilter === cat
                        ? 'bg-[#1E1B4B] text-white'
                        : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {meta.emoji} {meta.label} ({cnt})
                  </button>
                );
              })}
            </div>

            {filteredInventory.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center space-y-3">
                <Package
                  className="mx-auto h-8 w-8 text-slate-400"
                  aria-hidden
                />
                <p className="text-[14px] font-semibold text-slate-700">
                  No ingredients in this category yet.
                </p>
                <div className="flex justify-center gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => void handleSeedInventoryStarter()}
                  >
                    Seed 6 Cafe Essentials
                  </Button>
                  <Button
                    type="button"
                    variant="primary"
                    onClick={() => setShowAddInvModal(true)}
                  >
                    + Add Ingredient
                  </Button>
                </div>
              </div>
            ) : (
              <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
                {filteredInventory.map((item) => {
                  const isLow = item.currentStock <= item.lowStockThreshold;
                  const meta = CAFE_INVENTORY_CATEGORY_META[item.category];
                  const fillPct =
                    item.lowStockThreshold > 0
                      ? Math.min(
                          100,
                          Math.round(
                            (item.currentStock /
                              (item.lowStockThreshold * 2.5)) *
                              100,
                          ),
                        )
                      : 100;

                  return (
                    <div
                      key={item.id}
                      className={`rounded-xl border bg-white p-4 space-y-3 ${
                        isLow
                          ? 'border-rose-300 bg-rose-50/30'
                          : 'border-slate-200'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <span
                            className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10.5px] font-semibold ${meta.badgeClass}`}
                          >
                            {meta.emoji} {meta.label}
                          </span>
                          <h3 className="mt-1.5 text-[15px] font-bold text-[#111827] truncate">
                            {item.itemName}
                          </h3>
                        </div>
                        <button
                          type="button"
                          onClick={() => void handleDeleteInventoryItem(item)}
                          aria-label={`Delete ${item.itemName}`}
                          className="rounded-lg p-1 text-slate-400 hover:bg-red-50 hover:text-red-600 cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden />
                        </button>
                      </div>

                      <div className="space-y-1.5">
                        <div className="flex items-baseline justify-between">
                          <span
                            className={`text-[22px] font-bold tabular-nums ${
                              isLow ? 'text-rose-700' : 'text-[#111827]'
                            }`}
                          >
                            {item.currentStock}{' '}
                            <span className="text-[13px] font-semibold text-slate-500">
                              {item.unit}
                            </span>
                          </span>
                          <span className="text-[11.5px] font-medium text-slate-500">
                            Alert ≤ {item.lowStockThreshold} {item.unit}
                          </span>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                          <div
                            className={`h-full rounded-full transition-all ${
                              isLow ? 'bg-rose-500' : 'bg-emerald-500'
                            }`}
                            style={{ width: `${Math.max(6, fillPct)}%` }}
                          />
                        </div>
                        <p className="text-[11.5px] text-slate-500 truncate">
                          Unit cost:{' '}
                          {formatPriceFromPaise(item.unitCostPaise, 'INR')} /{' '}
                          {item.unit}
                          {item.supplierNote ? ` · ${item.supplierNote}` : ''}
                        </p>
                      </div>

                      <div className="grid grid-cols-3 gap-1.5 pt-1">
                        <button
                          type="button"
                          onClick={() => {
                            setAdjustTarget({ item, action: 'usage' });
                            setAdjustQty('1');
                            setAdjustCost('0');
                          }}
                          className="inline-flex h-8 items-center justify-center gap-1 rounded-lg border border-slate-200 bg-slate-50 text-[11.5px] font-semibold text-slate-800 hover:bg-slate-100 cursor-pointer"
                        >
                          <Minus className="h-3 w-3" aria-hidden /> Use
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setAdjustTarget({ item, action: 'restock' });
                            setAdjustQty('5');
                            setAdjustCost(
                              String(
                                Math.round((item.unitCostPaise * 5) / 100),
                              ),
                            );
                          }}
                          className="inline-flex h-8 items-center justify-center gap-1 rounded-lg bg-[#1E1B4B] text-[11.5px] font-semibold text-white hover:bg-[#2E2A6E] cursor-pointer"
                        >
                          <Plus
                            className="h-3 w-3 text-[#D2DB76]"
                            aria-hidden
                          />{' '}
                          Restock
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setAdjustTarget({ item, action: 'wastage' });
                            setAdjustQty('0.5');
                            setAdjustCost('0');
                          }}
                          className="inline-flex h-8 items-center justify-center gap-1 rounded-lg border border-rose-200 bg-rose-50 text-[11.5px] font-semibold text-rose-700 hover:bg-rose-100 cursor-pointer"
                        >
                          Wastage
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
              <h2 className="text-[15px] font-bold text-[#111827] flex items-center gap-2">
                <History className="h-4 w-4 text-[#1E1B4B]" aria-hidden />
                Stock Movement Audit Log ({inventoryLogs.length})
              </h2>
              {inventoryLogs.length === 0 ? (
                <p className="text-[13px] text-slate-500">
                  Every restock, daily shift usage, and wastage log appears here automatically.
                </p>
              ) : (
                <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto">
                  {inventoryLogs.slice(0, 25).map((log) => (
                    <div
                      key={log.id}
                      className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-[12.5px]"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className={`rounded px-2 py-0.5 text-[10.5px] font-bold uppercase ${
                            log.actionType === 'restock'
                              ? 'bg-emerald-100 text-emerald-800'
                              : log.actionType === 'wastage'
                                ? 'bg-rose-100 text-rose-800'
                                : 'bg-amber-100 text-amber-900'
                          }`}
                        >
                          {log.actionType}
                        </span>
                        <span className="font-semibold text-[#111827] truncate">
                          {log.itemName}
                        </span>
                        <span className="font-mono font-bold text-[#1E1B4B]">
                          {log.quantityDelta > 0 ? '+' : ''}
                          {log.quantityDelta} {log.unit ?? ''}
                        </span>
                        {log.note && (
                          <span className="text-slate-500 truncate">
                            — {log.note}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-[11.5px] text-slate-500">
                        {log.costPaise > 0 && (
                          <span className="font-semibold text-slate-700">
                            {formatPriceFromPaise(log.costPaise, 'INR')}
                          </span>
                        )}
                        <span>
                          {new Date(log.createdAt).toLocaleString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ===================================================================
            COFFEE STAMP CARD & BIRTHDAY RULES (UNDER GAMES & LOYALTY)
           =================================================================== */}
        {activeTab === 'games_loyalty' && loyaltySubTab === 'stamp_pass' && (
          <div className="space-y-5 max-w-5xl">
            <div className="border-b border-slate-200 pb-3.5">
              <h1 className="text-[22px] font-bold tracking-tight text-[#111827]">
                Coffee Stamp Card &amp; Birthday Free Coffee Rules
              </h1>
              <p className="text-[13px] text-slate-500">
                Configure your counter coffee stamp card threshold, automatic birthday free coffee, and counter UPI ID.
              </p>
            </div>

            <form
              onSubmit={(e) => void handleSaveStampConfig(e)}
              className="rounded-xl border border-slate-200 bg-white p-5 space-y-4"
            >
              <h2 className="text-[15px] font-bold text-[#111827] flex items-center gap-2">
                <Cake className="h-4 w-4 text-[#1E1B4B]" aria-hidden />
                Digital Coffee Stamp Card &amp; Birthday Free Coffee
              </h2>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="space-y-1">
                  <label
                    htmlFor="cafeStampsReq"
                    className="block text-[12px] font-semibold text-[#111827]"
                  >
                    Stamps Needed for Free Drink
                  </label>
                  <input
                    id="cafeStampsReq"
                    type="number"
                    min={3}
                    max={20}
                    value={stampsRequired}
                    onChange={(e) =>
                      setStampsRequired(
                        Math.max(3, Math.min(20, Number(e.target.value) || 8)),
                      )
                    }
                    className="h-9.5 w-full rounded-lg border border-slate-200 bg-white px-3 text-[13.5px] font-bold tabular-nums"
                  />
                </div>

                <div className="space-y-1 sm:col-span-2">
                  <label
                    htmlFor="cafeRewardDrink"
                    className="block text-[12px] font-semibold text-[#111827]"
                  >
                    Free Stamp Reward Drink
                  </label>
                  <input
                    id="cafeRewardDrink"
                    type="text"
                    required
                    maxLength={120}
                    value={rewardDrinkName}
                    onChange={(e) => setRewardDrinkName(e.target.value)}
                    className="h-9.5 w-full rounded-lg border border-slate-200 bg-white px-3 text-[13px]"
                  />
                </div>

                <div className="space-y-1">
                  <label
                    htmlFor="cafeUpiId"
                    className="block text-[12px] font-semibold text-[#111827]"
                  >
                    Counter UPI ID (Optional)
                  </label>
                  <input
                    id="cafeUpiId"
                    type="text"
                    maxLength={120}
                    placeholder="e.g. brewbean@okicici"
                    value={upiId}
                    onChange={(e) => setUpiId(e.target.value)}
                    className="h-9.5 w-full rounded-lg border border-slate-200 bg-white px-3 text-[13px]"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-3">
                <label className="inline-flex items-center gap-2.5 text-[13px] font-semibold text-[#111827] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={birthdayEnabled}
                    onChange={(e) => setBirthdayEnabled(e.target.checked)}
                    className="h-4 w-4 accent-[#1E1B4B]"
                  />
                  <span>
                    🎂 Automatic Birthday Free Coffee (&ldquo;Today, your coffee&apos;s on us!&rdquo;)
                  </span>
                </label>
                <input
                  type="text"
                  aria-label="Birthday Free Drink Name"
                  value={birthdayDrinkName}
                  onChange={(e) => setBirthdayDrinkName(e.target.value)}
                  className="h-9 w-full sm:w-72 rounded-lg border border-slate-200 bg-white px-3 text-[12.5px]"
                />
              </div>

              <div className="flex justify-end">
                <Button type="submit" variant="primary" loading={savingConfig}>
                  Save Stamp &amp; Birthday Rules
                </Button>
              </div>
            </form>
          </div>
        )}

        {/* ===================================================================
            AI GOOGLE REVIEWS & COUNTER STAMP STANDEES
           =================================================================== */}
        {activeTab === 'reviews' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3.5">
              <div>
                <h1 className="text-[22px] font-bold tracking-tight text-[#111827]">
                  AI Google Reviews &amp; Counter Standees
                </h1>
                <p className="text-[13px] text-slate-500">
                  Download printable Counter Coffee Stamp &amp; Google Review standees and manage AI review drafts.
                </p>
              </div>
              {isBusinessLive && (
                <Link
                  to={`/r/${business.slug}`}
                  target="_blank"
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-[12.5px] font-semibold text-[#1E1B4B] hover:bg-slate-50"
                >
                  Open AI Review Page{' '}
                  <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                </Link>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-1 border-b border-slate-200">
              {(
                [
                  {
                    id: 'drafts',
                    label: `Review Drafts (${drafts.length})`,
                    Icon: MessageSquare,
                  },
                  {
                    id: 'qr',
                    label: 'Counter Stamp & Review QR',
                    Icon: QrCode,
                  },
                  {
                    id: 'analytics',
                    label: 'Review Funnel',
                    Icon: BarChart3,
                  },
                  {
                    id: 'settings',
                    label: 'AI & Google Links',
                    Icon: Settings,
                  },
                ] as const
              ).map(({ id, label, Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setReviewSubTab(id)}
                  className={`inline-flex h-10 items-center gap-2 border-b-2 px-3.5 text-[13px] font-semibold cursor-pointer ${
                    reviewSubTab === id
                      ? 'border-[#1E1B4B] text-[#1E1B4B]'
                      : 'border-transparent text-slate-500 hover:text-slate-900'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" aria-hidden />
                  <span>{label}</span>
                </button>
              ))}
            </div>

            {reviewSubTab === 'drafts' && (
              <CustomerDraftsView
                business={business}
                drafts={drafts}
                onDraftUpdated={(rec) =>
                  setDrafts((prev) =>
                    prev.map((d) => (d.id === rec.id ? rec : d)),
                  )
                }
              />
            )}
            {reviewSubTab === 'qr' && (
              <QRCodeManager business={business} defaultMode="cafe" />
            )}
            {reviewSubTab === 'analytics' && (
              <AnalyticsView
                metrics={metrics}
                events={events}
                businessName={business.name}
              />
            )}
            {reviewSubTab === 'settings' && (
              <div className="space-y-5">
                {onBusinessUpdated && (
                  <BusinessCategorySettings
                    business={business}
                    onUpdated={onBusinessUpdated}
                  />
                )}
                <AIConfigurationSettings business={business} />
                <BusinessKnowledgeSettings business={business} />
                {onBusinessUpdated && (
                  <GoogleUrlSettings
                    business={business}
                    onUpdated={onBusinessUpdated}
                  />
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* PORTALED MODAL: ADD CAFE INGREDIENT */}
      {showAddInvModal &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Add Cafe Ingredient"
            className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-[2px]"
          >
            <form
              onSubmit={(e) => void handleCreateInventoryItem(e)}
              className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h2 className="text-[16px] font-bold text-[#111827]">
                  Add Raw Ingredient / Packaging
                </h2>
                <button
                  type="button"
                  onClick={() => setShowAddInvModal(false)}
                  className="rounded-lg p-1 text-slate-500 hover:bg-slate-100 cursor-pointer"
                >
                  <X className="h-4 w-4" aria-hidden />
                </button>
              </div>

              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="block text-[12px] font-semibold text-[#111827]">
                    Ingredient Name *
                  </label>
                  <input
                    type="text"
                    required
                    autoFocus
                    placeholder="e.g. Arabica Espresso Beans, Oat Milk"
                    value={newItemName}
                    onChange={(e) => setNewItemName(e.target.value)}
                    className="h-9.5 w-full rounded-lg border border-slate-300 px-3 text-[13.5px]"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="block text-[12px] font-semibold text-[#111827]">
                      Category
                    </label>
                    <select
                      value={newItemCat}
                      onChange={(e) =>
                        setNewItemCat(e.target.value as CafeInventoryCategory)
                      }
                      className="h-9.5 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-[13px]"
                    >
                      {ALLOWED_CAFE_INVENTORY_CATEGORIES.map((c) => (
                        <option key={c} value={c}>
                          {CAFE_INVENTORY_CATEGORY_META[c].label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="block text-[12px] font-semibold text-[#111827]">
                      Unit
                    </label>
                    <select
                      value={newItemUnit}
                      onChange={(e) =>
                        setNewItemUnit(e.target.value as CafeInventoryUnit)
                      }
                      className="h-9.5 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-[13px]"
                    >
                      {ALLOWED_CAFE_INVENTORY_UNITS.map((u) => (
                        <option key={u} value={u}>
                          {u}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2.5">
                  <div className="space-y-1">
                    <label className="block text-[12px] font-semibold text-[#111827]">
                      Current Stock
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      min={0}
                      value={newItemStock}
                      onChange={(e) => setNewItemStock(e.target.value)}
                      className="h-9.5 w-full rounded-lg border border-slate-300 px-2.5 text-[13px] font-semibold"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-[12px] font-semibold text-[#111827]">
                      Low Alert ≤
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      min={0}
                      value={newItemThreshold}
                      onChange={(e) => setNewItemThreshold(e.target.value)}
                      className="h-9.5 w-full rounded-lg border border-slate-300 px-2.5 text-[13px] font-semibold"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-[12px] font-semibold text-[#111827]">
                      Cost / {newItemUnit} (₹)
                    </label>
                    <input
                      type="text"
                      value={newItemCost}
                      onChange={(e) => setNewItemCost(e.target.value)}
                      className="h-9.5 w-full rounded-lg border border-slate-300 px-2.5 text-[13px] font-semibold"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="block text-[12px] font-semibold text-[#111827]">
                    Supplier / Brand Note (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Local roaster, daily 6 AM delivery"
                    value={newItemSupplier}
                    onChange={(e) => setNewItemSupplier(e.target.value)}
                    className="h-9.5 w-full rounded-lg border border-slate-300 px-3 text-[13px]"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setShowAddInvModal(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" variant="primary" loading={savingStock}>
                  Add Ingredient ✓
                </Button>
              </div>
            </form>
          </div>,
          document.body,
        )}

      {/* PORTALED MODAL: ADJUST STOCK (RESTOCK / USAGE / WASTAGE) */}
      {adjustTarget &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Adjust Cafe Stock"
            className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-[2px]"
          >
            <form
              onSubmit={(e) => void handleSubmitStockAdjustment(e)}
              className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-5 shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h2 className="text-[16px] font-bold text-[#111827] capitalize">
                    {adjustTarget.action}: {adjustTarget.item.itemName}
                  </h2>
                  <p className="text-[12px] text-slate-500">
                    Current stock: {adjustTarget.item.currentStock}{' '}
                    {adjustTarget.item.unit}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setAdjustTarget(null)}
                  className="rounded-lg p-1 text-slate-500 hover:bg-slate-100 cursor-pointer"
                >
                  <X className="h-4 w-4" aria-hidden />
                </button>
              </div>

              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="block text-[12px] font-semibold text-[#111827]">
                    Quantity ({adjustTarget.item.unit}) *
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0.05"
                    required
                    autoFocus
                    value={adjustQty}
                    onChange={(e) => setAdjustQty(e.target.value)}
                    className="h-10 w-full rounded-lg border border-slate-300 px-3 text-[14px] font-bold"
                  />
                </div>
                {adjustTarget.action === 'restock' && (
                  <div className="space-y-1">
                    <label className="block text-[12px] font-semibold text-[#111827]">
                      Purchase Cost (₹)
                    </label>
                    <input
                      type="text"
                      value={adjustCost}
                      onChange={(e) => setAdjustCost(e.target.value)}
                      className="h-9.5 w-full rounded-lg border border-slate-300 px-3 text-[13.5px]"
                    />
                  </div>
                )}
                <div className="space-y-1">
                  <label className="block text-[12px] font-semibold text-[#111827]">
                    Note (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder={
                      adjustTarget.action === 'restock'
                        ? 'e.g. Morning delivery invoice #412'
                        : adjustTarget.action === 'usage'
                          ? 'e.g. Morning rush shift'
                          : 'e.g. Spilled milk pitcher'
                    }
                    value={adjustNote}
                    onChange={(e) => setAdjustNote(e.target.value)}
                    className="h-9.5 w-full rounded-lg border border-slate-300 px-3 text-[13px]"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setAdjustTarget(null)}
                >
                  Cancel
                </Button>
                <Button type="submit" variant="primary" loading={savingStock}>
                  Confirm {adjustTarget.action} ✓
                </Button>
              </div>
            </form>
          </div>,
          document.body,
        )}
    </div>
  );
}
