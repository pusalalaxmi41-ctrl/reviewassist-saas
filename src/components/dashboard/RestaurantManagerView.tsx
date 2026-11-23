import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import QRCode from 'qrcode';
import {
  UtensilsCrossed,
  QrCode,
  Plus,
  Trash2,
  Edit3,
  Check,
  Copy,
  Download,
  FileText,
  ExternalLink,
  Sparkles,
  Gamepad2,
  Award,
  CheckCircle2,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  KeyRound,
  Wifi,
  Inbox,
  Gift,
  Users,
  User,
  Minus,
  X,
  Ticket,
  ChefHat,
  Palette,
  Wand2,
  AlertTriangle,
  Star,
  Volume2,
  VolumeX,
  BedDouble,
  Printer,
  Monitor,
  ShoppingBag,
  Smartphone,
  MessageSquare,
  LayoutGrid,
  ClipboardList,
  Receipt,
  BellRing,
  Clock,
  Sliders,
  Maximize2,
  Minimize2,
  PanelRightOpen,
  CheckSquare,
} from 'lucide-react';
import type { Business } from '../../types/business';
import type {
  DietaryTag,
  DishSpiceLevel,
  FloorTableLayoutItem,
  MenuPresetKey,
  MenuThemeTemplate,
  RestaurantBusinessMode,
  RestaurantCurrencyCode,
  RestaurantFloorAndAnalyticsPayload,
  RestaurantGameConfig,
  RestaurantLocationType,
  RestaurantLoyaltyRules,
  RestaurantMenuCategory,
  RestaurantMenuItem,
  RestaurantMonthlyInventoryItem,
  RestaurantProfile,
  RestaurantReward,
  RestaurantStaffMember,
  RestaurantSuggestion,
  RestaurantTable,
  RestaurantTableCallType,
  RestaurantTableOrder,
  RestaurantTableOrderStatus,
  RestaurantTriviaQuestion,
} from '../../types/restaurant';
import { MENU_THEME_LIST } from '../../config/menuPresets';
import { businessRepository } from '../../services/storage';
import {
  ALLOWED_CURRENCIES,
  ALLOWED_DIETARY_TAGS,
  CURRENCY_METADATA,
  DEFAULT_DISH_TRIVIA_QUESTIONS,
  DEFAULT_GAME_CATALOG,
  DIETARY_TAG_METADATA,
  deriveTableKey,
  formatPriceFromPaise,
  getCurrentMonthKey,
  getRestaurantMenuUrl,
  getRestaurantTableQrUrl,
  hashStaffPin,
  parseMajorCurrencyToPaise,
  validateStaffPinFormat,
} from '../../utils/restaurantValidation';
import {
  getKitchenDisplayUrl,
  isBillRequestCallType,
  isPlatformOrOffPremiseSource,
  ORDER_SOURCE_METADATA,
  printKitchenKotTicket,
  speakHospitalityAlert,
  SPICE_LEVEL_METADATA,
  TABLE_CALL_TYPE_METADATA,
} from '../../utils/hospitalityHelpers';
import {
  generatePrintablePdfBlobFromCanvas,
  loadBusinessQRSettings,
  renderQrPosterToCanvas,
  type QRDesignSettings,
  type QRTemplateId,
  QR_TEMPLATE_DEFAULTS,
  QR_ACCENT_PRESETS,
} from '../../services/qr/qrGenerator';
import { copyText } from '../../utils/clipboard';
import { Button } from '../common/Button';
import { RestaurantStaffRosterPanel } from './RestaurantStaffRosterPanel';
import { RestaurantMonthlyInventoryPanel } from './RestaurantMonthlyInventoryPanel';
import { FloorMapGrid } from '../hospitality/FloorMapGrid';
import { TableFinalBillModal } from '../hospitality/TableFinalBillModal';
import { LiveTableMessagesPanel } from '../hospitality/LiveTableMessagesPanel';
import { CounterPosAndPlatformModal } from '../hospitality/CounterPosAndPlatformModal';
import {
  DEFAULT_WORKSPACE_MODULES,
  type WorkspaceModuleVisibility,
} from '../../utils/workspaceModules';

export type RestaurantWorkspaceSection =
  | 'overview'
  | 'analytics'
  | 'menu'
  | 'staff'
  | 'inventory'
  | 'tables'
  | 'games_loyalty'
  | 'settings';

interface Props {
  business: Business;
  isBusinessLive: boolean;
  activeSection?: RestaurantWorkspaceSection;
  onSectionChange?: (section: RestaurantWorkspaceSection) => void;
  onProfileChanged?: (profile: RestaurantProfile) => void;
  moduleVisibility?: WorkspaceModuleVisibility;
  onModuleVisibilityChange?: (next: WorkspaceModuleVisibility) => void;
}

function TableQrPreviewCanvas({ url }: { url: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    void QRCode.toCanvas(canvasRef.current, url, {
      width: 132,
      margin: 1,
      color: {
        dark: '#1E1B4B',
        light: '#FFFFFF',
      },
    });
  }, [url]);

  return (
    <canvas
      ref={canvasRef}
      className="h-[132px] w-[132px] rounded-xl border border-[#1E1B4B]/10 bg-[#FFFFFF] p-2 shadow-2xs"
    />
  );
}

function formatTimeAgo(isoDate: string): string {
  const diffMs = Math.max(0, Date.now() - new Date(isoDate).getTime());
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function RestaurantManagerView({
  business,
  isBusinessLive,
  activeSection,
  onSectionChange,
  onProfileChanged,
  moduleVisibility = DEFAULT_WORKSPACE_MODULES,
  onModuleVisibilityChange,
}: Props) {
  const [internalSection, setInternalSection] =
    useState<RestaurantWorkspaceSection>('overview');
  const currentSection = activeSection ?? internalSection;

  function setSection(next: RestaurantWorkspaceSection) {
    setInternalSection(next);
    onSectionChange?.(next);
  }

  const [loading, setLoading] = useState(true);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Profile state
  const [profile, setProfile] = useState<RestaurantProfile | null>(null);
  const [isEnabled, setIsEnabled] = useState(false);
  const [currencyCode, setCurrencyCode] =
    useState<RestaurantCurrencyCode>('INR');
  const [tagline, setTagline] = useState('');
  const [gamesEnabled, setGamesEnabled] = useState(true);
  const [loyaltyEnabled, setLoyaltyEnabled] = useState(true);
  const [tableOrderingEnabled, setTableOrderingEnabled] = useState(false);
  const [menuThemeTemplate, setMenuThemeTemplate] =
    useState<MenuThemeTemplate>('default');
  const [businessMode, setBusinessMode] =
    useState<RestaurantBusinessMode>('restaurant');
  const [applyingPresetKey, setApplyingPresetKey] =
    useState<MenuPresetKey | null>(null);
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);
  const [quickVerifyLookup, setQuickVerifyLookup] = useState('');
  const [quickVerifyingBill, setQuickVerifyingBill] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);

  // Hospitality OS profile extensions (Billing, GST, UPI, Voice, Hotel Rooms)
  const [upiId, setUpiId] = useState('');
  const [upiPayeeName, setUpiPayeeName] = useState('');
  const [gstin, setGstin] = useState('');
  const [gstPercent, setGstPercent] = useState<number>(0);
  const [serviceChargePercent, setServiceChargePercent] = useState<number>(0);
  const [voiceAlertsEnabled, setVoiceAlertsEnabled] = useState(true);
  const [acceptingOrders, setAcceptingOrders] = useState(true);
  const [hotelRoomsEnabled, setHotelRoomsEnabled] = useState(false);

  // Hospitality Command Center UI state
  const [overviewSubTab, setOverviewSubTab] = useState<
    'floor' | 'orders' | 'messages'
  >('floor');
  const [orderStatusFilter, setOrderStatusFilter] = useState<
    | 'all'
    | 'pending_approval'
    | 'preparing'
    | 'ready'
    | 'served'
    | 'unpaid'
    | 'platform'
  >('all');
  const [posModalMode, setPosModalMode] = useState<null | 'pos' | 'platform'>(
    null,
  );
  const [posInitialTableId, setPosInitialTableId] = useState<string | null>(
    null,
  );
  const [billModalTable, setBillModalTable] = useState<RestaurantTable | null>(
    null,
  );
  const [showChatDrawer, setShowChatDrawer] = useState(false);
  const [chatWindowSize, setChatWindowSize] = useState<
    'compact' | 'medium' | 'large'
  >('medium');
  const [chatWindowMinimized, setChatWindowMinimized] = useState(false);

  // Manager -> Waiter proactive task dispatch bar state
  const [dispatchTableKey, setDispatchTableKey] = useState<string>('');
  const [dispatchTaskType, setDispatchTaskType] =
    useState<RestaurantTableCallType>('clean_table');
  const [dispatchWaiterLabel, setDispatchWaiterLabel] = useState<string>('');
  const [dispatchingTask, setDispatchingTask] = useState(false);

  // Voice Alert dedup refs (skip initial load; speak only newly arrived calls & orders)
  const initializedAlertsRef = useRef(false);
  const seenCallIdsRef = useRef<Set<string>>(new Set());
  const seenOrderIdsRef = useRef<Set<string>>(new Set());
  const voiceAlertsEnabledRef = useRef(true);
  useEffect(() => {
    voiceAlertsEnabledRef.current = voiceAlertsEnabled;
  }, [voiceAlertsEnabled]);

  // Staff Roster & Monthly Inventory state
  const [staffMembers, setStaffMembers] = useState<RestaurantStaffMember[]>([]);
  const [selectedMonthKey, setSelectedMonthKey] = useState<string>(() =>
    getCurrentMonthKey(),
  );
  const [inventoryEntries, setInventoryEntries] = useState<
    RestaurantMonthlyInventoryItem[]
  >([]);

  // Live Overview Floor & Analytics state
  const [floorData, setFloorData] =
    useState<RestaurantFloorAndAnalyticsPayload | null>(null);

  // Categories & Items state
  const [categories, setCategories] = useState<RestaurantMenuCategory[]>([]);
  const [items, setItems] = useState<RestaurantMenuItem[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('all');

  // Category Drawer / Form state
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(
    null,
  );
  const [catName, setCatName] = useState('');
  const [catDescription, setCatDescription] = useState('');
  const [catIsActive, setCatIsActive] = useState(true);

  // Dish Modal / Form state
  const [showDishForm, setShowDishForm] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [itemCategoryId, setItemCategoryId] = useState('');
  const [itemName, setItemName] = useState('');
  const [itemDescription, setItemDescription] = useState('');
  const [itemPriceMajor, setItemPriceMajor] = useState('');
  const [itemDietaryTag, setItemDietaryTag] = useState<DietaryTag>('veg');
  const [itemIsAvailable, setItemIsAvailable] = useState(true);
  const [itemIsFeatured, setItemIsFeatured] = useState(false);
  const [itemImageUrl, setItemImageUrl] = useState('');
  const [itemShowOnTable, setItemShowOnTable] = useState(true);
  const [itemShowOnRoom, setItemShowOnRoom] = useState(true);
  const [itemSpiceLevel, setItemSpiceLevel] = useState<DishSpiceLevel | ''>('');
  const [itemIngredientsSummary, setItemIngredientsSummary] = useState('');
  const [itemPrepTimeMinutes, setItemPrepTimeMinutes] = useState('');

  // Tables & Rooms + Standee QR state
  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [showAddTableForm, setShowAddTableForm] = useState(false);
  const [tableNumber, setTableNumber] = useState('');
  const [tableLabel, setTableLabel] = useState('');
  const [tableLocationType, setTableLocationType] =
    useState<RestaurantLocationType>('table');
  const [tableSeatCapacity, setTableSeatCapacity] = useState<number>(4);
  const [selectedQrTableId, setSelectedQrTableId] = useState<string>('general');
  const [showStandeeStudio, setShowStandeeStudio] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedNfcTableId, setCopiedNfcTableId] = useState<string | null>(null);

  const qrCanvasRef = useRef<HTMLCanvasElement>(null);
  const [qrSettings, setQrSettings] = useState<QRDesignSettings>(() => {
    const base = loadBusinessQRSettings(business);
    return {
      ...base,
      template: 'table_standee',
      heading: 'Scan for Digital Menu & Rewards',
      instruction: 'Browse dishes, play table games & earn loyalty stars',
    };
  });

  // Games & Loyalty state
  const [gameConfigs, setGameConfigs] = useState<RestaurantGameConfig[]>([]);
  const [savingGameSlug, setSavingGameSlug] = useState<string | null>(null);
  const [starsPerVerifiedVisit, setStarsPerVerifiedVisit] = useState(1);
  const [pointsPerStarExchange, setPointsPerStarExchange] = useState(100);
  const [allowPointExchange, setAllowPointExchange] = useState(true);
  const [maxStarsViaExchangePerWeek, setMaxStarsViaExchangePerWeek] =
    useState(2);
  const [wifiNetworkName, setWifiNetworkName] = useState('');
  const [wifiPassword, setWifiPassword] = useState('');
  const [suggestionBoxEnabled, setSuggestionBoxEnabled] = useState(true);
  const [savingRules, setSavingRules] = useState(false);

  // Rewards Catalogue state
  const [rewards, setRewards] = useState<RestaurantReward[]>([]);
  const [showRewardForm, setShowRewardForm] = useState(false);
  const [editingRewardId, setEditingRewardId] = useState<string | null>(null);
  const [rewardTitle, setRewardTitle] = useState('');
  const [rewardDescription, setRewardDescription] = useState('');
  const [rewardStarsRequired, setRewardStarsRequired] = useState(3);
  const [rewardIsActive, setRewardIsActive] = useState(true);

  // Advanced Accordion state (Staff PIN, Wi-Fi, Custom Trivia, Suggestion Box)
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [newPin, setNewPin] = useState('');
  const [minHoursCooldown, setMinHoursCooldown] = useState<number>(4);
  const [savingSecurity, setSavingSecurity] = useState(false);
  const [suggestions, setSuggestions] = useState<RestaurantSuggestion[]>([]);

  // Custom trivia form state
  const [newQuestionPrompt, setNewQuestionPrompt] = useState('');
  const [newOptionA, setNewOptionA] = useState('');
  const [newOptionB, setNewOptionB] = useState('');
  const [newOptionC, setNewOptionC] = useState('');
  const [newOptionD, setNewOptionD] = useState('');
  const [newCorrectIndex, setNewCorrectIndex] = useState(0);

  function applyRulesToState(rules: RestaurantLoyaltyRules) {
    setStarsPerVerifiedVisit(rules.starsPerVerifiedVisit);
    setPointsPerStarExchange(rules.pointsPerStarExchange);
    setAllowPointExchange(rules.allowPointExchange);
    setMaxStarsViaExchangePerWeek(rules.maxStarsViaExchangePerWeek);
    setWifiNetworkName(rules.wifiNetworkName ?? '');
    setWifiPassword(rules.wifiPassword ?? '');
    setSuggestionBoxEnabled(rules.suggestionBoxEnabled);
  }

  const refreshFloorData = useCallback(async () => {
    try {
      const payload = await businessRepository.getRestaurantFloorAndAnalytics({
        businessSlug: business.slug,
        staffPinHash: null,
      });
      setFloorData(payload);
      if (payload.tables && payload.tables.length > 0) {
        setTables(payload.tables);
      }

      const liveOrders = payload.tableOrders ?? [];

      // Speak voice alerts for newly arriving calls or orders (after initial mount)
      if (!initializedAlertsRef.current) {
        for (const c of payload.activeTableCalls) {
          seenCallIdsRef.current.add(c.id);
        }
        for (const o of liveOrders) {
          seenOrderIdsRef.current.add(o.id);
        }
        initializedAlertsRef.current = true;
      } else {
        let spoken = false;
        for (const call of payload.activeTableCalls) {
          if (!seenCallIdsRef.current.has(call.id)) {
            seenCallIdsRef.current.add(call.id);
            if (!spoken) {
              const meta =
                TABLE_CALL_TYPE_METADATA[call.callType] ??
                TABLE_CALL_TYPE_METADATA.assistance;
              speakHospitalityAlert(
                `${call.tableNumber} is ${meta.spokenPhrase}`,
                voiceAlertsEnabledRef.current,
              );
              spoken = true;
            }
          }
        }
        for (const ord of liveOrders) {
          if (!seenOrderIdsRef.current.has(ord.id)) {
            seenOrderIdsRef.current.add(ord.id);
            if (!spoken) {
              const sourceMeta =
                ORDER_SOURCE_METADATA[ord.orderSource ?? 'qr_table'] ??
                ORDER_SOURCE_METADATA.qr_table;
              const loc = ord.platformOrderNumber
                ? `${sourceMeta.shortLabel} order ${ord.platformOrderNumber}`
                : ord.tableNumber || sourceMeta.shortLabel;
              speakHospitalityAlert(
                `New order received from ${loc}`,
                voiceAlertsEnabledRef.current,
              );
              spoken = true;
            }
          }
        }
      }
    } catch {
      // ignore background poll errors
    }
  }, [business.slug]);

  useEffect(() => {
    async function loadAll() {
      setLoading(true);
      setErrorMessage(null);
      try {
        const [
          prof,
          cats,
          menuItems,
          tbls,
          gConfigs,
          lRules,
          rwds,
          sugs,
          flr,
          staffList,
          invList,
        ] = await Promise.all([
          businessRepository.getRestaurantProfile(business.id),
          businessRepository.getRestaurantMenuCategories(business.id),
          businessRepository.getRestaurantMenuItems(business.id),
          businessRepository.getRestaurantTables(business.id),
          businessRepository.getRestaurantGameConfigs(business.id),
          businessRepository.getRestaurantLoyaltyRules(business.id),
          businessRepository.getRestaurantRewards(business.id),
          businessRepository.getRestaurantSuggestions(business.id),
          businessRepository.getRestaurantFloorAndAnalytics({
            businessSlug: business.slug,
            staffPinHash: null,
          }),
          businessRepository.getRestaurantStaffMembers(business.id),
          businessRepository.getRestaurantMonthlyInventory(
            business.id,
            getCurrentMonthKey(),
          ),
        ]);
        setProfile(prof);
        setIsEnabled(prof.isEnabled);
        setCurrencyCode(prof.currencyCode);
        setTagline(prof.tagline ?? '');
        setGamesEnabled(prof.gamesEnabled);
        setLoyaltyEnabled(prof.loyaltyEnabled);
        setTableOrderingEnabled(Boolean(prof.tableOrderingEnabled));
        setMenuThemeTemplate(prof.menuThemeTemplate ?? 'default');
        setBusinessMode(
          prof.businessMode ??
            (business.category === 'cafe' ? 'cafe' : 'restaurant'),
        );
        setMinHoursCooldown(prof.minHoursBetweenVisitStars ?? 4);
        setUpiId(prof.upiId ?? '');
        setUpiPayeeName(prof.upiPayeeName ?? '');
        setGstin(prof.gstin ?? '');
        setGstPercent(prof.gstPercent ?? 0);
        setServiceChargePercent(prof.serviceChargePercent ?? 0);
        setVoiceAlertsEnabled(prof.voiceAlertsEnabled ?? true);
        setAcceptingOrders(prof.acceptingOrders ?? true);
        setHotelRoomsEnabled(prof.hotelRoomsEnabled ?? false);

        setCategories(cats);
        setItems(menuItems);
        setTables(tbls);
        setGameConfigs(gConfigs);
        applyRulesToState(lRules);
        setRewards(rwds);
        setSuggestions(sugs);
        setFloorData(flr);
        setStaffMembers(staffList);
        setInventoryEntries(invList);

        // Seed voice-alert dedup sets with already-existing calls/orders
        seenCallIdsRef.current = new Set(flr.activeTableCalls.map((c) => c.id));
        seenOrderIdsRef.current = new Set(
          (flr.tableOrders ?? []).map((o) => o.id),
        );
        initializedAlertsRef.current = true;

        if (cats.length > 0) {
          setItemCategoryId(cats[0].id);
        }
        if (tbls.length > 0) {
          setSelectedQrTableId(tbls[0].id);
        } else {
          setSelectedQrTableId('general');
        }
      } catch (err) {
        setErrorMessage((err as Error).message);
      } finally {
        setLoading(false);
      }
    }
    void loadAll();
  }, [business.id, business.slug, business.category]);

  async function handleChangeInventoryMonth(nextMonthKey: string) {
    setSelectedMonthKey(nextMonthKey);
    try {
      const list = await businessRepository.getRestaurantMonthlyInventory(
        business.id,
        nextMonthKey,
      );
      setInventoryEntries(list);
    } catch (err) {
      setErrorMessage((err as Error).message);
    }
  }

  useEffect(() => {
    const unsubscribe = businessRepository.subscribeToHospitalityRealtime(
      business.id,
      () => {
        void refreshFloorData();
      },
    );
    const timer = window.setInterval(() => {
      void refreshFloorData();
    }, 8000);
    return () => {
      unsubscribe();
      window.clearInterval(timer);
    };
  }, [business.id, refreshFloorData]);

  const activeQrTable =
    selectedQrTableId === 'general'
      ? null
      : (tables.find((t) => t.id === selectedQrTableId) ?? null);

  const activeQrUrl = activeQrTable
    ? getRestaurantTableQrUrl(business.slug, activeQrTable.tableKey)
    : getRestaurantMenuUrl(business.slug);

  useEffect(() => {
    if (
      currentSection !== 'tables' ||
      !showStandeeStudio ||
      !qrCanvasRef.current
    )
      return;
    const tableHeading = activeQrTable
      ? `${activeQrTable.tableNumber}${activeQrTable.tableLabel ? ` · ${activeQrTable.tableLabel}` : ''} — Scan for Menu`
      : qrSettings.heading;

    void renderQrPosterToCanvas(
      qrCanvasRef.current,
      business,
      {
        ...qrSettings,
        heading: tableHeading,
      },
      {
        targetUrl: activeQrUrl,
        customSteps: [
          '1. Scan this table QR code with your phone camera',
          '2. Browse the live Digital Menu & tell your server',
          '3. Play table games & collect loyalty stars',
        ],
      },
    );
  }, [
    currentSection,
    showStandeeStudio,
    business,
    qrSettings,
    activeQrTable,
    activeQrUrl,
  ]);

  function notifyStatus(msg: string) {
    setErrorMessage(null);
    setStatusMessage(msg);
    window.setTimeout(() => {
      setStatusMessage((prev) => (prev === msg ? null : prev));
    }, 4000);
  }

  async function handleSaveProfile(
    overrides?: {
      isEnabled?: boolean;
      tableOrderingEnabled?: boolean;
      menuThemeTemplate?: MenuThemeTemplate;
      businessMode?: RestaurantBusinessMode;
      voiceAlertsEnabled?: boolean;
      acceptingOrders?: boolean;
      hotelRoomsEnabled?: boolean;
      statusMessage?: string;
    },
  ) {
    setSavingProfile(true);
    setErrorMessage(null);
    try {
      const targetEnabled =
        typeof overrides?.isEnabled === 'boolean'
          ? overrides.isEnabled
          : isEnabled;
      const targetOrdering =
        typeof overrides?.tableOrderingEnabled === 'boolean'
          ? overrides.tableOrderingEnabled
          : tableOrderingEnabled;
      const targetTheme = overrides?.menuThemeTemplate ?? menuThemeTemplate;
      const targetBusinessMode = overrides?.businessMode ?? businessMode;
      const targetVoice =
        typeof overrides?.voiceAlertsEnabled === 'boolean'
          ? overrides.voiceAlertsEnabled
          : voiceAlertsEnabled;
      const targetAccepting =
        typeof overrides?.acceptingOrders === 'boolean'
          ? overrides.acceptingOrders
          : acceptingOrders;
      const targetHotelRooms =
        typeof overrides?.hotelRoomsEnabled === 'boolean'
          ? overrides.hotelRoomsEnabled
          : hotelRoomsEnabled;

      const saved = await businessRepository.updateRestaurantProfile(
        business.id,
        {
          isEnabled: targetEnabled,
          currencyCode,
          tagline: tagline.trim() || null,
          gamesEnabled,
          loyaltyEnabled,
          staffPinHash: profile?.staffPinHash ?? null,
          minHoursBetweenVisitStars: minHoursCooldown,
          tableOrderingEnabled: targetOrdering,
          menuThemeTemplate: targetTheme,
          businessMode: targetBusinessMode,
          upiId: upiId.trim() || null,
          upiPayeeName: upiPayeeName.trim() || null,
          gstin: gstin.trim().toUpperCase() || null,
          gstPercent,
          serviceChargePercent,
          voiceAlertsEnabled: targetVoice,
          acceptingOrders: targetAccepting,
          hotelRoomsEnabled: targetHotelRooms,
        },
      );
      setProfile(saved);
      setIsEnabled(saved.isEnabled);
      setTableOrderingEnabled(Boolean(saved.tableOrderingEnabled));
      setMenuThemeTemplate(saved.menuThemeTemplate ?? 'default');
      setBusinessMode(saved.businessMode ?? 'restaurant');
      setUpiId(saved.upiId ?? '');
      setUpiPayeeName(saved.upiPayeeName ?? '');
      setGstin(saved.gstin ?? '');
      setGstPercent(saved.gstPercent ?? 0);
      setServiceChargePercent(saved.serviceChargePercent ?? 0);
      setVoiceAlertsEnabled(saved.voiceAlertsEnabled ?? true);
      setAcceptingOrders(saved.acceptingOrders ?? true);
      setHotelRoomsEnabled(saved.hotelRoomsEnabled ?? false);
      onProfileChanged?.(saved);
      notifyStatus(
        overrides?.statusMessage ??
          (saved.isEnabled
            ? 'Hospitality settings saved & active.'
            : 'Hospitality settings saved.'),
      );
    } catch (err) {
      setErrorMessage((err as Error).message);
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleApplyPresetMenu(presetKey: MenuPresetKey) {
    setApplyingPresetKey(presetKey);
    setErrorMessage(null);
    try {
      const result = await businessRepository.applyRestaurantMenuPreset(
        business.id,
        presetKey,
      );
      const [prof, cats, menuItems, rwds] = await Promise.all([
        businessRepository.getRestaurantProfile(business.id),
        businessRepository.getRestaurantMenuCategories(business.id),
        businessRepository.getRestaurantMenuItems(business.id),
        businessRepository.getRestaurantRewards(business.id),
      ]);
      setProfile(prof);
      setIsEnabled(prof.isEnabled);
      setMenuThemeTemplate(prof.menuThemeTemplate ?? result.themeTemplate);
      setTagline(prof.tagline ?? '');
      setCategories(cats);
      setItems(menuItems);
      setRewards(rwds);
      setSelectedCategoryId('all');
      if (cats.length > 0) setItemCategoryId(cats[0].id);
      onProfileChanged?.(prof);
      notifyStatus(
        `Applied "${result.themeTemplate.toUpperCase()}" style and added ${result.categoriesInserted} categories + ${result.itemsInserted} dishes${result.rewardsInserted > 0 ? ` + ${result.rewardsInserted} starter rewards` : ''}!`,
      );
    } catch (err) {
      setErrorMessage((err as Error).message);
    } finally {
      setApplyingPresetKey(null);
    }
  }

  async function handleUpdateOrderStatus(
    orderId: string,
    nextStatus: RestaurantTableOrderStatus,
  ) {
    setUpdatingOrderId(orderId);
    setErrorMessage(null);
    try {
      await businessRepository.updateTableOrderStatus({
        businessSlug: business.slug,
        orderId,
        status: nextStatus,
        staffLabel: 'Owner',
        staffPinHash: null,
      });
      await refreshFloorData();
      const labels: Record<RestaurantTableOrderStatus, string> = {
        pending_approval: 'Moved order back to Pending.',
        approved_for_kitchen: 'Approved order → Sent to Chef Kitchen KDS!',
        preparing: 'Order marked as Preparing in Kitchen.',
        ready: 'Order marked as Ready to Serve!',
        served: 'Order marked as Served ✓',
        cancelled: 'Order rejected and cancelled.',
      };
      notifyStatus(labels[nextStatus]);
    } catch (err) {
      setErrorMessage((err as Error).message);
    } finally {
      setUpdatingOrderId(null);
    }
  }

  async function handleUpdateTableCall(
    callId: string,
    nextStatus: 'open' | 'acknowledged' | 'resolved',
    assignedStaffLabel?: string | null,
  ) {
    try {
      await businessRepository.updateRestaurantTableCallStatus({
        businessSlug: business.slug,
        callId,
        status: nextStatus,
        staffPinHash: null,
        assignedStaffLabel: assignedStaffLabel ?? null,
      });
      await refreshFloorData();
      notifyStatus(
        nextStatus === 'resolved'
          ? 'Guest request marked done ✓'
          : assignedStaffLabel
            ? `Notified ${assignedStaffLabel} — live alert sent to their Waiter App ✓`
            : 'Guest request acknowledged.',
      );
    } catch (err) {
      setErrorMessage((err as Error).message);
    }
  }

  async function handleDispatchTaskToWaiter(e: React.FormEvent) {
    e.preventDefault();
    const activeTables = tables.filter((t) => t.isActive);
    const targetTable =
      activeTables.find((t) => t.tableKey === dispatchTableKey) ??
      activeTables[0];
    const assignable = staffMembers.filter(
      (s) => s.isActive && (s.role === 'waiter' || s.role === 'manager'),
    );
    const targetWaiter =
      dispatchWaiterLabel ||
      (assignable[0]
        ? `${assignable[0].fullName} (${assignable[0].staffCode})`
        : '');

    if (!targetTable) {
      setErrorMessage('Add a table first before dispatching waiter tasks.');
      return;
    }
    if (!targetWaiter) {
      setErrorMessage(
        'Add at least one Waiter or Manager in "Staff & Waiters" to assign tasks.',
      );
      return;
    }

    setDispatchingTask(true);
    try {
      const created = await businessRepository.createRestaurantTableCall({
        businessSlug: business.slug,
        tableKey: targetTable.tableKey,
        callType: dispatchTaskType,
      });
      await businessRepository.updateRestaurantTableCallStatus({
        businessSlug: business.slug,
        callId: created.id,
        status: 'open',
        assignedStaffLabel: targetWaiter,
        staffPinHash: null,
      });
      await refreshFloorData();
      const meta =
        TABLE_CALL_TYPE_METADATA[dispatchTaskType] ??
        TABLE_CALL_TYPE_METADATA.assistance;
      notifyStatus(
        `Sent live alert to ${targetWaiter}: Go to ${targetTable.tableNumber} (${meta.label}) ✓`,
      );
    } catch (err) {
      setErrorMessage((err as Error).message);
    } finally {
      setDispatchingTask(false);
    }
  }

  async function handleSendManagerReply(tableKey: string, messageText: string) {
    try {
      await businessRepository.sendTableChatMessage({
        businessSlug: business.slug,
        tableKey,
        senderRole: 'manager',
        senderName: 'Manager',
        messageText,
        staffPinHash: null,
      });
      await refreshFloorData();
      notifyStatus('Reply sent to guest.');
    } catch (err) {
      setErrorMessage((err as Error).message);
    }
  }

  async function handleQuickVerifyBillStar(
    e: React.FormEvent,
    tableKeyOverride?: string | null,
  ) {
    e.preventDefault();
    const lookup = quickVerifyLookup.trim();
    if (!lookup) return;
    setQuickVerifyingBill(true);
    setErrorMessage(null);
    try {
      const res = await businessRepository.staffAwardVisitStars({
        businessSlug: business.slug,
        customerLookup: lookup,
        tableKey: tableKeyOverride ?? null,
        staffLabel: 'Owner',
        idempotencyKey: `owner-bill-${business.slug}-${crypto.randomUUID()}`,
        staffPinHash: null,
      });
      setQuickVerifyLookup('');
      await refreshFloorData();
      notifyStatus(
        `Verified paid bill for ${res.customerName}! Awarded +${res.starsAwarded} ★ (New balance: ${res.newLoyaltyStarsBalance} ★).`,
      );
    } catch (err) {
      setErrorMessage((err as Error).message);
    } finally {
      setQuickVerifyingBill(false);
    }
  }

  async function handleFulfillClaimCode(codeToFulfill: string) {
    const clean = codeToFulfill.trim().toUpperCase();
    if (!clean) return;
    try {
      const fulfilled = await businessRepository.staffFulfillRewardClaim({
        businessSlug: business.slug,
        claimCode: clean,
        staffLabel: 'Owner',
        staffPinHash: null,
      });
      await refreshFloorData();
      notifyStatus(
        `Fulfilled "${fulfilled.rewardTitle || 'Reward'}" (${fulfilled.claimCode}) for ${fulfilled.customerName || 'Guest'}.`,
      );
    } catch (err) {
      setErrorMessage((err as Error).message);
    }
  }

  // Digital Menu handlers
  async function handleSeedStarterMenu() {
    setErrorMessage(null);
    try {
      const startersCat = await businessRepository.createRestaurantMenuCategory(
        business.id,
        {
          name: 'Starters',
          description: 'Freshly prepared appetizers served hot to your table',
          displayOrder: 0,
          isActive: true,
        },
      );
      const mainsCat = await businessRepository.createRestaurantMenuCategory(
        business.id,
        {
          name: 'Mains',
          description: 'Slow-cooked house specialties and traditional curries',
          displayOrder: 1,
          isActive: true,
        },
      );
      const drinksCat = await businessRepository.createRestaurantMenuCategory(
        business.id,
        {
          name: 'Drinks',
          description: 'Handcrafted coolers, coffees, and fresh juices',
          displayOrder: 2,
          isActive: true,
        },
      );

      const i1 = await businessRepository.createRestaurantMenuItem(
        business.id,
        {
          categoryId: startersCat.id,
          name: 'Crispy Paneer 65',
          description:
            'Spiced cottage cheese tossed with curry leaves and green chillies',
          pricePaise: 24900,
          dietaryTag: 'veg',
          isAvailable: true,
          isFeatured: true,
          displayOrder: 0,
        },
      );
      const i2 = await businessRepository.createRestaurantMenuItem(
        business.id,
        {
          categoryId: mainsCat.id,
          name: 'Hyderabadi Dum Biryani',
          description:
            'Aromatic long-grain basmati rice layered with saffron and house spices',
          pricePaise: 34900,
          dietaryTag: 'non_veg',
          isAvailable: true,
          isFeatured: true,
          displayOrder: 0,
        },
      );
      const i3 = await businessRepository.createRestaurantMenuItem(
        business.id,
        {
          categoryId: drinksCat.id,
          name: 'Fresh Mint Lime Cooler',
          description:
            'Garden mint, freshly squeezed lime, and chilled sparkling soda',
          pricePaise: 12900,
          dietaryTag: 'vegan',
          isAvailable: true,
          isFeatured: false,
          displayOrder: 0,
        },
      );

      const nextCats = [...categories, startersCat, mainsCat, drinksCat];
      const nextItems = [...items, i1, i2, i3];
      setCategories(nextCats);
      setItems(nextItems);
      setSelectedCategoryId('all');
      setItemCategoryId(startersCat.id);
      notifyStatus('Sample 3-course menu loaded.');
    } catch (err) {
      setErrorMessage((err as Error).message);
    }
  }

  async function handleSaveCategory(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage(null);
    try {
      if (editingCategoryId) {
        const updated = await businessRepository.updateRestaurantMenuCategory(
          business.id,
          editingCategoryId,
          {
            name: catName,
            description: catDescription || null,
            isActive: catIsActive,
          },
        );
        setCategories((prev) =>
          prev.map((c) => (c.id === updated.id ? updated : c)),
        );
        setEditingCategoryId(null);
        notifyStatus(`Updated category "${updated.name}".`);
      } else {
        const created = await businessRepository.createRestaurantMenuCategory(
          business.id,
          {
            name: catName,
            description: catDescription || null,
            displayOrder: categories.length,
            isActive: catIsActive,
          },
        );
        const next = [...categories, created];
        setCategories(next);
        if (!itemCategoryId) setItemCategoryId(created.id);
        notifyStatus(`Added category "${created.name}".`);
      }
      setCatName('');
      setCatDescription('');
      setCatIsActive(true);
      setShowCategoryModal(false);
    } catch (err) {
      setErrorMessage((err as Error).message);
    }
  }

  async function handleDeleteCategory(cat: RestaurantMenuCategory) {
    try {
      await businessRepository.deleteRestaurantMenuCategory(
        business.id,
        cat.id,
      );
      const nextCats = categories.filter((c) => c.id !== cat.id);
      setCategories(nextCats);
      setItems((prev) => prev.filter((i) => i.categoryId !== cat.id));
      if (selectedCategoryId === cat.id) {
        setSelectedCategoryId('all');
      }
      if (itemCategoryId === cat.id) {
        setItemCategoryId(nextCats[0]?.id ?? '');
      }
      notifyStatus(`Deleted category "${cat.name}".`);
    } catch (err) {
      setErrorMessage((err as Error).message);
    }
  }

  async function handleSaveItem(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage(null);
    const parsedPrice = parseMajorCurrencyToPaise(itemPriceMajor);
    if (!parsedPrice.ok) {
      setErrorMessage(parsedPrice.error);
      return;
    }

    let targetCatId =
      itemCategoryId ||
      (selectedCategoryId !== 'all' ? selectedCategoryId : '') ||
      categories[0]?.id;

    // Auto-create a default "Mains" category if the owner adds a dish before creating a category
    if (!targetCatId) {
      try {
        const defaultCat =
          await businessRepository.createRestaurantMenuCategory(business.id, {
            name: 'Signature Dishes',
            description: 'House specialties',
            displayOrder: 0,
            isActive: true,
          });
        setCategories([defaultCat]);
        targetCatId = defaultCat.id;
      } catch (err) {
        setErrorMessage((err as Error).message);
        return;
      }
    }

    const parsedPrepMins = itemPrepTimeMinutes.trim()
      ? Math.max(1, Math.min(180, Number.parseInt(itemPrepTimeMinutes, 10) || 15))
      : null;

    try {
      if (editingItemId) {
        const updated = await businessRepository.updateRestaurantMenuItem(
          business.id,
          editingItemId,
          {
            categoryId: targetCatId,
            name: itemName,
            description: itemDescription || null,
            pricePaise: parsedPrice.pricePaise,
            dietaryTag: itemDietaryTag,
            isAvailable: itemIsAvailable,
            isFeatured: itemIsFeatured,
            imageUrl: itemImageUrl.trim() || null,
            showOnTable: itemShowOnTable,
            showOnRoom: itemShowOnRoom,
            spiceLevel: itemSpiceLevel || null,
            ingredientsSummary: itemIngredientsSummary.trim() || null,
            prepTimeMinutes: parsedPrepMins,
          },
        );
        setItems((prev) =>
          prev.map((i) => (i.id === updated.id ? updated : i)),
        );
        setEditingItemId(null);
        notifyStatus(`Updated "${updated.name}".`);
      } else {
        const created = await businessRepository.createRestaurantMenuItem(
          business.id,
          {
            categoryId: targetCatId,
            name: itemName,
            description: itemDescription || null,
            pricePaise: parsedPrice.pricePaise,
            dietaryTag: itemDietaryTag,
            isAvailable: itemIsAvailable,
            isFeatured: itemIsFeatured,
            imageUrl: itemImageUrl.trim() || null,
            showOnTable: itemShowOnTable,
            showOnRoom: itemShowOnRoom,
            spiceLevel: itemSpiceLevel || null,
            ingredientsSummary: itemIngredientsSummary.trim() || null,
            prepTimeMinutes: parsedPrepMins,
          },
        );
        setItems((prev) => [...prev, created]);
        notifyStatus(`Added "${created.name}" to your menu.`);
      }
      setItemName('');
      setItemDescription('');
      setItemPriceMajor('');
      setItemDietaryTag('veg');
      setItemIsAvailable(true);
      setItemIsFeatured(false);
      setItemImageUrl('');
      setItemShowOnTable(true);
      setItemShowOnRoom(true);
      setItemSpiceLevel('');
      setItemIngredientsSummary('');
      setItemPrepTimeMinutes('');
      setShowDishForm(false);
    } catch (err) {
      setErrorMessage((err as Error).message);
    }
  }

  function handleStartEditItem(item: RestaurantMenuItem) {
    setEditingItemId(item.id);
    setItemCategoryId(item.categoryId);
    setItemName(item.name);
    setItemDescription(item.description ?? '');
    setItemPriceMajor((item.pricePaise / 100).toString());
    setItemDietaryTag(item.dietaryTag);
    setItemIsAvailable(item.isAvailable);
    setItemIsFeatured(item.isFeatured);
    setItemImageUrl(item.imageUrl ?? '');
    setItemShowOnTable(item.showOnTable ?? true);
    setItemShowOnRoom(item.showOnRoom ?? true);
    setItemSpiceLevel(item.spiceLevel ?? '');
    setItemIngredientsSummary(item.ingredientsSummary ?? '');
    setItemPrepTimeMinutes(
      item.prepTimeMinutes ? String(item.prepTimeMinutes) : '',
    );
    setShowDishForm(true);
  }

  async function handleToggleItemAvailability(item: RestaurantMenuItem) {
    try {
      const updated = await businessRepository.updateRestaurantMenuItem(
        business.id,
        item.id,
        {
          categoryId: item.categoryId,
          name: item.name,
          description: item.description,
          pricePaise: item.pricePaise,
          dietaryTag: item.dietaryTag,
          isAvailable: !item.isAvailable,
          isFeatured: item.isFeatured,
          imageUrl: item.imageUrl,
          displayOrder: item.displayOrder,
          showOnTable: item.showOnTable ?? true,
          showOnRoom: item.showOnRoom ?? true,
          spiceLevel: item.spiceLevel ?? null,
          ingredientsSummary: item.ingredientsSummary ?? null,
          prepTimeMinutes: item.prepTimeMinutes ?? null,
        },
      );
      setItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
      notifyStatus(
        `"${updated.name}" is now ${updated.isAvailable ? 'Available' : 'Sold Out'}.`,
      );
    } catch (err) {
      setErrorMessage((err as Error).message);
    }
  }

  async function handleDeleteItem(item: RestaurantMenuItem) {
    try {
      await businessRepository.deleteRestaurantMenuItem(business.id, item.id);
      setItems((prev) => prev.filter((i) => i.id !== item.id));
      notifyStatus(`Removed "${item.name}".`);
    } catch (err) {
      setErrorMessage((err as Error).message);
    }
  }

  // Tables, Rooms & NFC/Standee QR handlers
  function openAddLocationModal(locType: RestaurantLocationType) {
    setTableLocationType(locType);
    setTableSeatCapacity(locType === 'room' ? 2 : 4);
    setTableNumber('');
    setTableLabel('');
    setShowAddTableForm(true);
  }

  async function handleAddTable(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage(null);
    try {
      const created = await businessRepository.createRestaurantTable(
        business.id,
        {
          tableNumber,
          tableLabel: tableLabel.trim() || null,
          isActive: true,
          locationType: tableLocationType,
          seatCapacity: tableSeatCapacity,
        },
      );
      const next = [...tables, created];
      setTables(next);
      setSelectedQrTableId(created.id);
      setTableNumber('');
      setTableLabel('');
      setTableLocationType('table');
      setTableSeatCapacity(4);
      setShowAddTableForm(false);

      // Auto-enable Hotel Rooms mode if the owner just created their first room!
      if (created.locationType === 'room' && !hotelRoomsEnabled) {
        setHotelRoomsEnabled(true);
        void handleSaveProfile({
          hotelRoomsEnabled: true,
          statusMessage: `Added Hotel Room ${created.tableNumber} and enabled Rooms Mode ✓`,
        });
      } else {
        notifyStatus(
          `Added ${created.locationType === 'room' ? 'Hotel Room' : 'Table'} ${created.tableNumber} ✓`,
        );
      }
      void refreshFloorData();
    } catch (err) {
      setErrorMessage((err as Error).message);
    }
  }

  async function handleCopyTableNfcLink(tbl: RestaurantTable) {
    const url = getRestaurantTableQrUrl(business.slug, tbl.tableKey);
    const ok = await copyText(url);
    if (ok) {
      setCopiedNfcTableId(tbl.id);
      notifyStatus(
        `Copied NFC Tag Link for ${tbl.tableNumber} — paste into NFC Tools app to write your standee!`,
      );
      window.setTimeout(() => {
        setCopiedNfcTableId((prev) => (prev === tbl.id ? null : prev));
      }, 2500);
    }
  }

  async function handleDeleteTable(tbl: RestaurantTable) {
    try {
      await businessRepository.deleteRestaurantTable(business.id, tbl.id);
      const next = tables.filter((t) => t.id !== tbl.id);
      setTables(next);
      if (selectedQrTableId === tbl.id) {
        setSelectedQrTableId(next[0]?.id ?? 'general');
      }
      notifyStatus(`Removed ${tbl.tableNumber}.`);
    } catch (err) {
      setErrorMessage((err as Error).message);
    }
  }

  async function handleCopyActiveQrUrl() {
    const ok = await copyText(activeQrUrl);
    if (ok) {
      setCopiedUrl(true);
      window.setTimeout(() => setCopiedUrl(false), 2000);
    }
  }

  function handleDownloadTableQrPng() {
    if (!qrCanvasRef.current) return;
    const pngUrl = qrCanvasRef.current.toDataURL('image/png');
    const suffix = activeQrTable ? activeQrTable.tableKey : 'digital-menu';
    const link = document.createElement('a');
    link.download = `${business.slug}-${suffix}-qr.png`;
    link.href = pngUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    notifyStatus(`Downloaded PNG standee (${business.slug}-${suffix}-qr.png).`);
  }

  function handleDownloadTableQrPdf() {
    if (!qrCanvasRef.current) return;
    const pdfBlob = generatePrintablePdfBlobFromCanvas(qrCanvasRef.current);
    const blobUrl = URL.createObjectURL(pdfBlob);
    const suffix = activeQrTable ? activeQrTable.tableKey : 'digital-menu';
    const link = document.createElement('a');
    link.download = `${business.slug}-${suffix}-qr.pdf`;
    link.href = blobUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);
    notifyStatus(
      `Downloaded printable A5 PDF standee (${business.slug}-${suffix}-qr.pdf).`,
    );
  }

  // Games & Loyalty handlers
  function updateLocalGameConfig(
    gameSlug: string,
    patch: Partial<RestaurantGameConfig>,
  ) {
    setGameConfigs((prev) =>
      prev.map((c) => (c.gameSlug === gameSlug ? { ...c, ...patch } : c)),
    );
  }

  async function handleSaveGameConfig(cfg: RestaurantGameConfig) {
    setSavingGameSlug(cfg.gameSlug);
    try {
      const saved = await businessRepository.updateRestaurantGameConfig(
        business.id,
        {
          gameSlug: cfg.gameSlug,
          title: cfg.title,
          category: cfg.category,
          isEnabled: cfg.isEnabled,
          pointsPerWin: cfg.pointsPerWin,
          maxPointsPerDayPerCustomer: cfg.maxPointsPerDayPerCustomer,
          cooldownMinutes: cfg.cooldownMinutes,
          customQuestions: cfg.customQuestions,
        },
      );
      setGameConfigs((prev) =>
        prev.map((c) => (c.gameSlug === saved.gameSlug ? saved : c)),
      );
      notifyStatus(`Updated "${saved.title}".`);
    } catch (err) {
      setErrorMessage((err as Error).message);
    } finally {
      setSavingGameSlug(null);
    }
  }

  async function handleSaveLoyaltyRules(e?: React.FormEvent) {
    if (e) e.preventDefault();
    setSavingRules(true);
    try {
      const saved = await businessRepository.updateRestaurantLoyaltyRules(
        business.id,
        {
          starsPerVerifiedVisit,
          pointsPerStarExchange,
          allowPointExchange,
          maxStarsViaExchangePerWeek,
          wifiNetworkName: wifiNetworkName.trim() || null,
          wifiPassword: wifiPassword.trim() || null,
          suggestionBoxEnabled,
        },
      );
      applyRulesToState(saved);
      notifyStatus('Saved Star Conversion & Loyalty rules.');
    } catch (err) {
      setErrorMessage((err as Error).message);
    } finally {
      setSavingRules(false);
    }
  }

  async function handleSeedStarterRewards() {
    try {
      const r1 = await businessRepository.createRestaurantReward(business.id, {
        title: 'Complimentary Filter Coffee',
        description: 'Freshly brewed hot beverage on the house',
        starsRequired: 2,
        isActive: true,
        displayOrder: 0,
      });
      const r2 = await businessRepository.createRestaurantReward(business.id, {
        title: "Chef's Dessert of the Day",
        description: 'Warm house dessert served after your meal',
        starsRequired: 4,
        isActive: true,
        displayOrder: 1,
      });
      const r3 = await businessRepository.createRestaurantReward(business.id, {
        title: 'Complimentary Signature Starter',
        description: 'Any starter dish from our appetizers section',
        starsRequired: 6,
        isActive: true,
        displayOrder: 2,
      });
      setRewards((prev) => [...prev, r1, r2, r3]);
      notifyStatus('Loaded 3 starter rewards.');
    } catch (err) {
      setErrorMessage((err as Error).message);
    }
  }

  async function handleSaveReward(e: React.FormEvent) {
    e.preventDefault();
    try {
      if (editingRewardId) {
        const updated = await businessRepository.updateRestaurantReward(
          business.id,
          editingRewardId,
          {
            title: rewardTitle,
            description: rewardDescription.trim() || null,
            starsRequired: rewardStarsRequired,
            isActive: rewardIsActive,
          },
        );
        setRewards((prev) =>
          prev.map((r) => (r.id === updated.id ? updated : r)),
        );
        setEditingRewardId(null);
        notifyStatus(`Updated reward "${updated.title}".`);
      } else {
        const created = await businessRepository.createRestaurantReward(
          business.id,
          {
            title: rewardTitle,
            description: rewardDescription.trim() || null,
            starsRequired: rewardStarsRequired,
            isActive: rewardIsActive,
            displayOrder: rewards.length,
          },
        );
        setRewards((prev) => [...prev, created]);
        notifyStatus(`Added reward "${created.title}".`);
      }
      setRewardTitle('');
      setRewardDescription('');
      setRewardStarsRequired(3);
      setRewardIsActive(true);
      setShowRewardForm(false);
    } catch (err) {
      setErrorMessage((err as Error).message);
    }
  }

  function handleStartEditReward(rwd: RestaurantReward) {
    setEditingRewardId(rwd.id);
    setRewardTitle(rwd.title);
    setRewardDescription(rwd.description ?? '');
    setRewardStarsRequired(rwd.starsRequired);
    setRewardIsActive(rwd.isActive);
    setShowRewardForm(true);
  }

  async function handleToggleRewardActive(rwd: RestaurantReward) {
    try {
      const updated = await businessRepository.updateRestaurantReward(
        business.id,
        rwd.id,
        {
          title: rwd.title,
          description: rwd.description,
          starsRequired: rwd.starsRequired,
          isActive: !rwd.isActive,
          maxRedemptionsTotal: rwd.maxRedemptionsTotal,
          displayOrder: rwd.displayOrder,
        },
      );
      setRewards((prev) =>
        prev.map((r) => (r.id === updated.id ? updated : r)),
      );
      notifyStatus(
        `"${updated.title}" is now ${updated.isActive ? 'Active' : 'Paused'}.`,
      );
    } catch (err) {
      setErrorMessage((err as Error).message);
    }
  }

  async function handleDeleteReward(rwd: RestaurantReward) {
    try {
      await businessRepository.deleteRestaurantReward(business.id, rwd.id);
      setRewards((prev) => prev.filter((r) => r.id !== rwd.id));
      notifyStatus(`Deleted "${rwd.title}".`);
    } catch (err) {
      setErrorMessage((err as Error).message);
    }
  }

  async function handleSaveStaffPinAndCooldown(e: React.FormEvent) {
    e.preventDefault();
    if (!profile) return;
    setSavingSecurity(true);
    try {
      let nextHash: string | null | undefined = profile.staffPinHash ?? null;
      if (newPin.trim()) {
        const pinCheck = validateStaffPinFormat(newPin);
        if (!pinCheck.ok) {
          setErrorMessage(pinCheck.error);
          setSavingSecurity(false);
          return;
        }
        nextHash = await hashStaffPin(business.slug, pinCheck.pin);
      }
      const updated = await businessRepository.updateRestaurantProfile(
        business.id,
        {
          isEnabled: profile.isEnabled,
          currencyCode: profile.currencyCode,
          tagline: profile.tagline,
          gamesEnabled: profile.gamesEnabled,
          loyaltyEnabled: profile.loyaltyEnabled,
          staffPinHash: nextHash,
          minHoursBetweenVisitStars: minHoursCooldown,
        },
      );
      setProfile(updated);
      setNewPin('');
      onProfileChanged?.(updated);
      notifyStatus(
        newPin.trim()
          ? 'Saved new 4–6 digit Staff PIN and visit cooldown.'
          : 'Saved visit star cooldown rules.',
      );
    } catch (err) {
      setErrorMessage((err as Error).message);
    } finally {
      setSavingSecurity(false);
    }
  }

  async function handleAddCustomTriviaQuestion(e: React.FormEvent) {
    e.preventDefault();
    const triviaCfg = gameConfigs.find((c) => c.gameSlug === 'dish-trivia');
    if (!triviaCfg) return;

    const options = [newOptionA, newOptionB, newOptionC, newOptionD]
      .map((o) => o.trim())
      .filter(Boolean);

    if (options.length < 2) {
      setErrorMessage('Please provide at least 2 answer options.');
      return;
    }

    const safeCorrectIdx =
      newCorrectIndex >= 0 && newCorrectIndex < options.length
        ? newCorrectIndex
        : 0;

    const nextQuestions: RestaurantTriviaQuestion[] = [
      ...(triviaCfg.customQuestions ?? [...DEFAULT_DISH_TRIVIA_QUESTIONS]),
      {
        prompt: newQuestionPrompt.trim(),
        options,
        correctIndex: safeCorrectIdx,
      },
    ];

    try {
      const saved = await businessRepository.updateRestaurantGameConfig(
        business.id,
        {
          ...triviaCfg,
          customQuestions: nextQuestions,
        },
      );
      setGameConfigs((prev) =>
        prev.map((c) => (c.gameSlug === saved.gameSlug ? saved : c)),
      );
      setNewQuestionPrompt('');
      setNewOptionA('');
      setNewOptionB('');
      setNewOptionC('');
      setNewOptionD('');
      setNewCorrectIndex(0);
      notifyStatus('Added custom trivia question.');
    } catch (err) {
      setErrorMessage((err as Error).message);
    }
  }

  async function handleRemoveTriviaQuestion(idxToRemove: number) {
    const triviaCfg = gameConfigs.find((c) => c.gameSlug === 'dish-trivia');
    if (!triviaCfg) return;
    const currentList =
      triviaCfg.customQuestions ?? [...DEFAULT_DISH_TRIVIA_QUESTIONS];
    const nextQuestions = currentList.filter((_, idx) => idx !== idxToRemove);

    try {
      const saved = await businessRepository.updateRestaurantGameConfig(
        business.id,
        {
          ...triviaCfg,
          customQuestions: nextQuestions.length > 0 ? nextQuestions : null,
        },
      );
      setGameConfigs((prev) =>
        prev.map((c) => (c.gameSlug === saved.gameSlug ? saved : c)),
      );
      notifyStatus('Removed trivia question.');
    } catch (err) {
      setErrorMessage((err as Error).message);
    }
  }

  async function handleMarkSuggestionRead(sug: RestaurantSuggestion) {
    try {
      const updated = await businessRepository.markRestaurantSuggestionRead(
        business.id,
        sug.id,
        !sug.isRead,
      );
      setSuggestions((prev) =>
        prev.map((s) => (s.id === updated.id ? updated : s)),
      );
    } catch (err) {
      setErrorMessage((err as Error).message);
    }
  }

  const recentOrders = useMemo<RestaurantTableOrder[]>(() => {
    const merged = floorData?.recentOrders ?? floorData?.tableOrders ?? [];
    return merged;
  }, [floorData]);

  const tableMessages = useMemo(
    () => floorData?.tableMessages ?? [],
    [floorData],
  );

  const filteredLiveOrders = useMemo(() => {
    return recentOrders.filter((ord) => {
      if (orderStatusFilter === 'all') return ord.status !== 'cancelled';
      if (orderStatusFilter === 'pending_approval') {
        return ord.status === 'pending_approval';
      }
      if (orderStatusFilter === 'preparing') {
        return (
          ord.status === 'approved_for_kitchen' || ord.status === 'preparing'
        );
      }
      if (orderStatusFilter === 'ready') return ord.status === 'ready';
      if (orderStatusFilter === 'served') return ord.status === 'served';
      if (orderStatusFilter === 'unpaid') {
        return (
          ord.status !== 'cancelled' &&
          (ord.paymentStatus ?? 'unpaid') !== 'paid'
        );
      }
      if (orderStatusFilter === 'platform') {
        return isPlatformOrOffPremiseSource(ord.orderSource);
      }
      return true;
    });
  }, [recentOrders, orderStatusFilter]);

  if (loading) {
    return (
      <div className="bistro-card p-12 text-center">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-[#1E1B4B] border-r-transparent" />
        <p className="mt-3 text-[14px] font-medium text-[#6B7280]">
          Loading HospitalityOS workspace…
        </p>
      </div>
    );
  }

  const menuUrl = getRestaurantMenuUrl(business.slug);
  const kitchenUrl = getKitchenDisplayUrl(business.slug);
  const filteredItems =
    selectedCategoryId === 'all' || !selectedCategoryId
      ? items
      : items.filter((i) => i.categoryId === selectedCategoryId);

  const activeCalls = floorData?.activeTableCalls ?? [];
  const pendingClaims = floorData?.pendingRewardClaims ?? [];
  const activeOrders = floorData?.tableOrders ?? [];
  const unreadMessageCount = tableMessages.filter(
    (m) => m.senderRole === 'customer' && !m.isRead,
  ).length;
  const openMessagesAndAlertsCount = activeCalls.length + unreadMessageCount;
  const analytics = floorData?.analytics ?? {
    qrScans: 0,
    checkedInDiners: 0,
    gamesPlayed: 0,
    gamePointsIssued: 0,
    verifiedPaidVisits: 0,
    loyaltyStarsIssued: 0,
    rewardsClaimed: 0,
    rewardsFulfilled: 0,
  };

  const triviaConfig = gameConfigs.find((c) => c.gameSlug === 'dish-trivia');
  const activeTriviaQuestions =
    triviaConfig?.customQuestions && triviaConfig.customQuestions.length > 0
      ? triviaConfig.customQuestions
      : DEFAULT_DISH_TRIVIA_QUESTIONS;
  const unreadSuggestions = suggestions.filter((s) => !s.isRead).length;

  return (
    <div className="space-y-4">
      {/* Global Toast Banners */}
      {statusMessage && (
        <div
          role="status"
          className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-[13px] font-medium text-emerald-800"
        >
          <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden />
          <span>{statusMessage}</span>
        </div>
      )}
      {errorMessage && (
        <div
          role="alert"
          className="flex items-center justify-between gap-2 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-[13px] font-medium text-red-800"
        >
          <span>{errorMessage}</span>
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            className="rounded p-1 hover:bg-red-100 cursor-pointer"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
      )}

      {/* =====================================================================
          1. LIVE DESK — SINGLE CALM FLAT BAR (XTRUDEO-INSPIRED, ZERO CLUTTER)
         ===================================================================== */}
      {currentSection === 'overview' && (
        <div className="space-y-4">
          {/* Single Flat Command Header: Underline Tabs (Left) + Direct Floor Actions (Right) */}
          <div className="rounded-xl border border-slate-200 bg-white px-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              {/* Clean Underline Navigation Tabs */}
              <div
                className="flex items-center gap-1 -mb-px"
                role="tablist"
                aria-label="Live Desk Views"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={overviewSubTab === 'floor'}
                  onClick={() => setOverviewSubTab('floor')}
                  className={`inline-flex h-12 items-center gap-2 border-b-2 px-3 text-[13.5px] font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                    overviewSubTab === 'floor'
                      ? 'border-[#1E1B4B] text-[#1E1B4B]'
                      : 'border-transparent text-slate-500 hover:text-slate-900'
                  }`}
                >
                  <LayoutGrid className="h-4 w-4" aria-hidden />
                  <span>
                    {hotelRoomsEnabled ||
                    business.category === 'hotel' ||
                    business.category === 'pg'
                      ? 'Floor & Rooms'
                      : 'Floor'}
                  </span>
                  <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-bold text-slate-700 tabular-nums">
                    {tables.filter((t) => t.isActive).length}
                  </span>
                </button>

                <button
                  type="button"
                  role="tab"
                  aria-selected={overviewSubTab === 'orders'}
                  onClick={() => setOverviewSubTab('orders')}
                  className={`inline-flex h-12 items-center gap-2 border-b-2 px-3 text-[13.5px] font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                    overviewSubTab === 'orders'
                      ? 'border-[#1E1B4B] text-[#1E1B4B]'
                      : 'border-transparent text-slate-500 hover:text-slate-900'
                  }`}
                >
                  <ClipboardList className="h-4 w-4" aria-hidden />
                  <span>Orders</span>
                  {activeOrders.length > 0 && (
                    <span className="rounded-full bg-[#1E1B4B] px-1.5 py-0.5 text-[10.5px] font-bold text-[#D2DB76] tabular-nums">
                      {activeOrders.length}
                    </span>
                  )}
                  {recentOrders.some(
                    (o) => o.paymentStatus === 'upi_pending_verify',
                  ) && (
                    <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-900">
                      UPI
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  role="tab"
                  aria-selected={overviewSubTab === 'messages'}
                  onClick={() => setOverviewSubTab('messages')}
                  className={`inline-flex h-12 items-center gap-2 border-b-2 px-3 text-[13.5px] font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                    overviewSubTab === 'messages'
                      ? 'border-[#1E1B4B] text-[#1E1B4B]'
                      : 'border-transparent text-slate-500 hover:text-slate-900'
                  }`}
                >
                  <MessageSquare className="h-4 w-4" aria-hidden />
                  <span>Messages</span>
                  {openMessagesAndAlertsCount > 0 && (
                    <span className="rounded-full bg-rose-600 px-1.5 py-0.5 text-[10.5px] font-bold text-white tabular-nums">
                      {openMessagesAndAlertsCount}
                    </span>
                  )}
                </button>
              </div>

              {/* Clean Flat Action Controls (Kitchen KDS + Waiter App + Chat Window + Platform + POS) */}
              <div className="flex flex-wrap items-center gap-1.5 py-2">
                {isBusinessLive && (
                  <>
                    <a
                      href={kitchenUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex h-8.5 items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-900 px-2.5 text-[12px] font-semibold text-[#D2DB76] whitespace-nowrap hover:bg-[#1E1B4B] transition-colors"
                    >
                      <Monitor className="h-3.5 w-3.5" aria-hidden />
                      Kitchen KDS ↗
                    </a>
                    <a
                      href={`/r/${business.slug}/staff`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex h-8.5 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-[12px] font-semibold text-slate-700 whitespace-nowrap hover:bg-slate-50 transition-colors"
                    >
                      <Users className="h-3.5 w-3.5 text-[#1E1B4B]" aria-hidden />
                      Waiter App ↗
                    </a>
                  </>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setShowChatDrawer(true);
                    setChatWindowMinimized(false);
                  }}
                  title="Open resizable floating chat window"
                  className="inline-flex h-8.5 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-[12px] font-semibold text-slate-700 whitespace-nowrap hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  <PanelRightOpen className="h-3.5 w-3.5 text-[#1E1B4B]" aria-hidden />
                  Chat Window
                  {openMessagesAndAlertsCount > 0 && (
                    <span className="rounded bg-rose-100 px-1 text-[10.5px] font-bold text-rose-700 tabular-nums">
                      {openMessagesAndAlertsCount}
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setPosInitialTableId(null);
                    setPosModalMode('platform');
                  }}
                  className="inline-flex h-8.5 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-[12px] font-semibold text-slate-800 whitespace-nowrap hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  <ShoppingBag className="h-3.5 w-3.5 text-[#1E1B4B]" aria-hidden />
                  + Platform
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setPosInitialTableId(null);
                    setPosModalMode('pos');
                  }}
                  className="inline-flex h-8.5 items-center gap-1.5 rounded-lg bg-[#1E1B4B] px-3 text-[12px] font-semibold text-white whitespace-nowrap hover:bg-[#2E2A6E] transition-colors cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5 text-[#D2DB76]" aria-hidden />
                  Counter POS
                </button>
              </div>
            </div>
          </div>

          {/* Low-Stock Quick Alert Strip (Visible when low-stock items are flagged) */}
          {inventoryEntries.some((i) => i.lowStockAlert) && (
            <div className="rounded-2xl border border-amber-300 bg-amber-50/85 px-5 py-3 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <AlertTriangle
                  className="h-4 w-4 shrink-0 text-[#D97706]"
                  aria-hidden
                />
                <p className="text-[13px] font-bold text-[#111827]">
                  <span className="text-[#D97706]">
                    {inventoryEntries.filter((i) => i.lowStockAlert).length}{' '}
                    Low-Stock Alert
                    {inventoryEntries.filter((i) => i.lowStockAlert).length ===
                    1
                      ? ''
                      : 's'}
                    :
                  </span>{' '}
                  {inventoryEntries
                    .filter((i) => i.lowStockAlert)
                    .slice(0, 3)
                    .map((i) => i.itemName)
                    .join(', ')}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSection('inventory')}
                className="rounded-xl bg-[#1E1B4B] px-3.5 py-1.5 text-[12px] font-bold text-[#FFFFFF] hover:bg-[#2E2A6E] cursor-pointer"
              >
                Manage Stock →
              </button>
            </div>
          )}

          {/* LIVE URGENT GUEST REQUESTS STRIP (With Inline Waiter Assignment + Checkout + Done) */}
          {activeCalls.length > 0 && (
            <div className="rounded-2xl border-2 border-[#EF4444]/40 bg-[#FEF2F2] p-4 space-y-2.5 shadow-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-[13px] font-extrabold text-[#991B1B]">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#EF4444] opacity-75" />
                    <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#EF4444]" />
                  </span>
                  <BellRing className="h-4 w-4 text-[#DC2626]" aria-hidden />
                  <span>
                    LIVE GUEST REQUESTS ({activeCalls.length})
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowChatDrawer(true)}
                  className="text-[12px] font-extrabold text-[#991B1B] underline cursor-pointer"
                >
                  Open Live Chat Drawer →
                </button>
              </div>
              <div className="space-y-2">
                {activeCalls.slice(0, 6).map((call) => {
                  const meta =
                    TABLE_CALL_TYPE_METADATA[call.callType] ??
                    TABLE_CALL_TYPE_METADATA.assistance;
                  const isBill = isBillRequestCallType(call.callType);
                  const matchedTable =
                    tables.find((t) => t.id === call.tableId) ?? null;
                  const assignableStaff = staffMembers.filter(
                    (s) =>
                      s.isActive &&
                      (s.role === 'waiter' || s.role === 'manager'),
                  );

                  return (
                    <div
                      key={call.id}
                      className="flex flex-wrap items-center justify-between gap-2.5 rounded-xl border border-[#EF4444]/30 bg-white px-3.5 py-2.5 text-[12.5px] shadow-2xs"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded-full border px-2.5 py-0.5 text-[11px] font-extrabold ${meta.badgeClass}`}
                        >
                          {meta.emoji} {meta.label}
                        </span>
                        <span className="font-extrabold text-[#111827]">
                          {call.tableNumber}
                        </span>
                        <span className="text-[11.5px] font-semibold text-[#6B7280] tabular-nums">
                          ({formatTimeAgo(call.createdAt)})
                        </span>
                        {call.assignedStaffLabel && (
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10.5px] font-extrabold ${
                              call.status === 'acknowledged'
                                ? 'bg-emerald-100 text-emerald-900'
                                : 'bg-indigo-100 text-indigo-900'
                            }`}
                          >
                            {call.status === 'acknowledged'
                              ? `🏃 On Way: ${call.assignedStaffLabel}`
                              : `🔔 Notified: ${call.assignedStaffLabel}`}
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        {assignableStaff.length > 0 && (
                          <select
                            aria-label={`Assign waiter for ${call.tableNumber}`}
                            value={call.assignedStaffLabel ?? ''}
                            onChange={(e) => {
                              if (!e.target.value) return;
                              void handleUpdateTableCall(
                                call.id,
                                'open',
                                e.target.value,
                              );
                            }}
                            className="h-8 rounded-lg border border-[#1E1B4B]/20 bg-[#F8F9FA] px-2 text-[11.5px] font-bold text-[#1E1B4B] focus:border-[#1E1B4B] focus:outline-none cursor-pointer"
                          >
                            <option value="">Assign Waiter…</option>
                            {assignableStaff.map((st) => {
                              const lbl = `${st.fullName} (${st.staffCode})`;
                              return (
                                <option key={st.id} value={lbl}>
                                  {lbl}
                                </option>
                              );
                            })}
                          </select>
                        )}
                        {isBill && matchedTable && (
                          <button
                            type="button"
                            onClick={() => setBillModalTable(matchedTable)}
                            className="h-8 rounded-lg bg-[#1E1B4B] px-3 text-[11.5px] font-extrabold text-[#D2DB76] hover:bg-[#2E2A6E] cursor-pointer"
                          >
                            Open Final Bill &amp; Checkout →
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() =>
                            void handleUpdateTableCall(
                              call.id,
                              'resolved',
                              call.assignedStaffLabel,
                            )
                          }
                          className="h-8 rounded-lg bg-[#059669] px-3 text-[11.5px] font-extrabold text-white hover:bg-emerald-700 cursor-pointer"
                        >
                          ✓ Done
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* SUB-TAB 1: VISUAL FLOOR & HOTEL ROOMS MAP */}
          {overviewSubTab === 'floor' && (
            <div className="space-y-4">
              {tables.filter((t) => t.isActive).length === 0 ? (
                <div className="bistro-card p-10 text-center space-y-3">
                  <LayoutGrid
                    className="mx-auto h-8 w-8 text-[#1E1B4B]/40"
                    aria-hidden
                  />
                  <h2 className="text-[18px] font-extrabold text-[#111827]">
                    Add Your Dining Tables or Hotel Rooms
                  </h2>
                  <p className="text-[13px] text-[#6B7280] max-w-md mx-auto">
                    Create tables (T1, T2) or hotel rooms (Room 101, Room 102) to start taking live orders, tracking open bills, and printing QR/NFC standees.
                  </p>
                  <div className="flex flex-wrap justify-center gap-2 pt-1">
                    <Button
                      type="button"
                      variant="primary"
                      onClick={() => openAddLocationModal('table')}
                    >
                      <Plus className="h-4 w-4" aria-hidden /> Add First Table
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => openAddLocationModal('room')}
                    >
                      <BedDouble className="h-4 w-4" aria-hidden /> Add First Hotel Room
                    </Button>
                  </div>
                </div>
              ) : (
                <FloorMapGrid
                  tables={tables}
                  recentOrders={recentOrders}
                  activeCalls={activeCalls}
                  currencyCode={currencyCode}
                  gstPercent={gstPercent}
                  serviceChargePercent={serviceChargePercent}
                  hotelRoomsEnabled={
                    hotelRoomsEnabled ||
                    business.category === 'hotel' ||
                    business.category === 'pg'
                  }
                  floorWidthFt={
                    floorData?.floorWidthFt ?? profile?.floorWidthFt ?? 40
                  }
                  floorHeightFt={
                    floorData?.floorHeightFt ?? profile?.floorHeightFt ?? 28
                  }
                  onAddLocation={openAddLocationModal}
                  onSaveFloorLayout={async (layoutParams: {
                    floorWidthFt: number;
                    floorHeightFt: number;
                    tables: FloorTableLayoutItem[];
                  }) => {
                    const res =
                      await businessRepository.saveRestaurantFloorLayout({
                        businessId: business.id,
                        floorWidthFt: layoutParams.floorWidthFt,
                        floorHeightFt: layoutParams.floorHeightFt,
                        tables: layoutParams.tables,
                      });
                    const byId = new Map(
                      layoutParams.tables.map((t) => [t.id, t]),
                    );
                    setTables((prev) =>
                      prev.map((t) => {
                        const patch = byId.get(t.id);
                        return patch
                          ? {
                              ...t,
                              tableShape: patch.tableShape,
                              posX: patch.posX,
                              posY: patch.posY,
                              widthUnits: patch.widthUnits,
                              heightUnits: patch.heightUnits,
                              seatCapacity: patch.seatCapacity,
                            }
                          : t;
                      }),
                    );
                    setProfile((prev) =>
                      prev
                        ? {
                            ...prev,
                            floorWidthFt: res.floorWidthFt,
                            floorHeightFt: res.floorHeightFt,
                          }
                        : prev,
                    );
                    notifyStatus(
                      `Saved custom ${res.floorWidthFt}ft × ${res.floorHeightFt}ft floor plan (${res.updatedTablesCount} tables updated) ✓`,
                    );
                    void refreshFloorData();
                  }}
                  onSelectAvailableTable={(tbl) => {
                    setPosInitialTableId(tbl.id);
                    setPosModalMode('pos');
                  }}
                  onSelectOccupiedTable={(tbl) => {
                    setBillModalTable(tbl);
                  }}
                />
              )}

              {/* Proactive Manager -> Waiter Task Dispatcher (Send instant alert to Rahul/Madhan phone!) */}
              {tables.filter((t) => t.isActive).length > 0 &&
                staffMembers.some(
                  (s) =>
                    s.isActive &&
                    (s.role === 'waiter' || s.role === 'manager'),
                ) && (
                  <form
                    onSubmit={(e) => void handleDispatchTaskToWaiter(e)}
                    className="bistro-card px-4 py-3 flex flex-wrap items-center justify-between gap-2.5"
                  >
                    <div className="flex items-center gap-2">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#1E1B4B] text-[#D2DB76]">
                        <BellRing className="h-4 w-4" aria-hidden />
                      </span>
                      <div>
                        <p className="text-[12.5px] font-extrabold text-[#111827]">
                          Assign Task to Waiter (Instant Phone + Voice Alert)
                        </p>
                        <p className="text-[11px] font-medium text-[#6B7280]">
                          Notify a waiter immediately to clean a table, bring water, or assist a guest.
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <select
                        aria-label="Select table for waiter task"
                        value={
                          dispatchTableKey ||
                          tables.filter((t) => t.isActive)[0]?.tableKey ||
                          ''
                        }
                        onChange={(e) => setDispatchTableKey(e.target.value)}
                        className="h-9 rounded-xl border border-[#1E1B4B]/20 bg-[#F8F9FA] px-2.5 text-[12px] font-bold text-[#111827] focus:border-[#1E1B4B] focus:outline-none cursor-pointer"
                      >
                        {tables
                          .filter((t) => t.isActive)
                          .map((t) => (
                            <option key={t.id} value={t.tableKey}>
                              {t.tableNumber}
                              {t.tableLabel ? ` (${t.tableLabel})` : ''}
                            </option>
                          ))}
                      </select>

                      <select
                        aria-label="Select task type"
                        value={dispatchTaskType}
                        onChange={(e) =>
                          setDispatchTaskType(
                            e.target.value as RestaurantTableCallType,
                          )
                        }
                        className="h-9 rounded-xl border border-[#1E1B4B]/20 bg-[#F8F9FA] px-2.5 text-[12px] font-bold text-[#111827] focus:border-[#1E1B4B] focus:outline-none cursor-pointer"
                      >
                        <option value="clean_table">🧹 Clean Table</option>
                        <option value="water">💧 Bring Water</option>
                        <option value="assistance">🙋 Attend Guest</option>
                        <option value="bill_request">🧾 Take Bill</option>
                      </select>

                      <select
                        aria-label="Select waiter to notify"
                        value={
                          dispatchWaiterLabel ||
                          (() => {
                            const first = staffMembers.find(
                              (s) =>
                                s.isActive &&
                                (s.role === 'waiter' || s.role === 'manager'),
                            );
                            return first
                              ? `${first.fullName} (${first.staffCode})`
                              : '';
                          })()
                        }
                        onChange={(e) => setDispatchWaiterLabel(e.target.value)}
                        className="h-9 rounded-xl border border-[#1E1B4B]/20 bg-[#F8F9FA] px-2.5 text-[12px] font-bold text-[#1E1B4B] focus:border-[#1E1B4B] focus:outline-none cursor-pointer"
                      >
                        {staffMembers
                          .filter(
                            (s) =>
                              s.isActive &&
                              (s.role === 'waiter' || s.role === 'manager'),
                          )
                          .map((st) => {
                            const lbl = `${st.fullName} (${st.staffCode})`;
                            return (
                              <option key={st.id} value={lbl}>
                                {lbl}
                              </option>
                            );
                          })}
                      </select>

                      <button
                        type="submit"
                        disabled={dispatchingTask}
                        className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-[#1E1B4B] px-3.5 text-[12px] font-extrabold text-[#D2DB76] hover:bg-[#2E2A6E] active:scale-[0.98] transition disabled:opacity-50 cursor-pointer"
                      >
                        <BellRing className="h-3.5 w-3.5" aria-hidden />
                        {dispatchingTask ? 'Sending…' : 'Send to Waiter'}
                      </button>
                    </div>
                  </form>
                )}
            </div>
          )}

          {/* SUB-TAB 2: LIVE ORDERS & UNIFIED KITCHEN QUEUE */}
          {overviewSubTab === 'orders' && (
            <div className="bistro-card p-5 sm:p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-1.5">
                  {(
                    [
                      { id: 'all', label: 'All Orders' },
                      {
                        id: 'pending_approval',
                        label: `New Approval (${recentOrders.filter((o) => o.status === 'pending_approval').length})`,
                      },
                      {
                        id: 'preparing',
                        label: `In Kitchen (${recentOrders.filter((o) => o.status === 'approved_for_kitchen' || o.status === 'preparing').length})`,
                      },
                      {
                        id: 'ready',
                        label: `Ready (${recentOrders.filter((o) => o.status === 'ready').length})`,
                      },
                      { id: 'served', label: 'Served' },
                      {
                        id: 'unpaid',
                        label: `Unpaid (${recentOrders.filter((o) => o.status !== 'cancelled' && (o.paymentStatus ?? 'unpaid') !== 'paid').length})`,
                      },
                      {
                        id: 'platform',
                        label: `Swiggy / Platform (${recentOrders.filter((o) => isPlatformOrOffPremiseSource(o.orderSource)).length})`,
                      },
                    ] as const
                  ).map((pill) => (
                    <button
                      key={pill.id}
                      type="button"
                      onClick={() => setOrderStatusFilter(pill.id)}
                      className={`h-9 rounded-full px-3.5 text-[12px] font-extrabold transition-all cursor-pointer ${
                        orderStatusFilter === pill.id
                          ? 'bg-[#1E1B4B] text-[#FFFFFF] shadow-2xs'
                          : 'border border-[#1E1B4B]/15 bg-[#F8F9FA] text-[#374151] hover:bg-white'
                      }`}
                    >
                      {pill.label}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => void refreshFloorData()}
                  className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[#1E1B4B]/15 bg-[#FFFFFF] px-3 text-[12px] font-bold text-[#111827] hover:bg-[#F8F9FA] cursor-pointer"
                >
                  <RefreshCw className="h-3.5 w-3.5" aria-hidden /> Refresh
                </button>
              </div>

              {filteredLiveOrders.length === 0 ? (
                <div className="rounded-2xl border border-[#1E1B4B]/10 bg-[#F8F9FA] p-8 text-center space-y-2">
                  <ChefHat
                    className="mx-auto h-8 w-8 text-[#1E1B4B]/40"
                    aria-hidden
                  />
                  <p className="text-[15px] font-bold text-[#111827]">
                    No orders in this filter right now
                  </p>
                  <p className="text-[12.5px] text-[#6B7280]">
                    Incoming QR Table/Room orders, Counter POS tickets, and Swiggy/Zomato orders appear here live.
                  </p>
                </div>
              ) : (
                <div className="grid gap-3.5 md:grid-cols-2">
                  {filteredLiveOrders.map((ord) => {
                    const isBusy = updatingOrderId === ord.id;
                    const sourceMeta =
                      ORDER_SOURCE_METADATA[ord.orderSource ?? 'qr_table'] ??
                      ORDER_SOURCE_METADATA.qr_table;
                    const matchedTable = ord.tableId
                      ? (tables.find((t) => t.id === ord.tableId) ?? null)
                      : null;
                    const itemTotalPaise =
                      ord.items.reduce(
                        (s, item) => s + item.pricePaise * item.quantity,
                        0,
                      ) + (ord.packagingPaise ?? 0);
                    const firstNote =
                      ord.kitchenNote || ord.items.find((i) => i.notes)?.notes;

                    return (
                      <div
                        key={ord.id}
                        className="rounded-2xl border border-[#1E1B4B]/12 bg-[#FFFFFF] p-4 space-y-3 shadow-2xs"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="text-[15px] font-extrabold text-[#111827]">
                                {ord.platformOrderNumber
                                  ? `${sourceMeta.shortLabel} #${ord.platformOrderNumber}`
                                  : ord.tableNumber || sourceMeta.label}
                              </span>
                              <span
                                className={`rounded-full border px-2 py-0.5 text-[10.5px] font-extrabold ${sourceMeta.badgeBg} ${sourceMeta.badgeText}`}
                              >
                                {sourceMeta.shortLabel}
                              </span>
                              {(ord.customerRepeatVisitCount ?? 1) >= 2 && (
                                <span className="rounded-full bg-[#D2DB76] px-2 py-0.5 text-[10px] font-extrabold text-[#1E1B4B]">
                                  REPEAT VISIT ×{ord.customerRepeatVisitCount}
                                </span>
                              )}
                            </div>
                            <p className="text-[12px] font-semibold text-[#6B7280]">
                              {ord.guestName ? `${ord.guestName} · ` : ''}
                              {formatTimeAgo(ord.createdAt)}
                            </p>
                          </div>

                          <div className="flex flex-col items-end gap-1">
                            <span
                              className={`rounded-full px-2.5 py-0.5 text-[10.5px] font-extrabold uppercase tracking-wider ${
                                ord.status === 'pending_approval'
                                  ? 'bg-amber-50 text-[#D97706] border border-amber-300'
                                  : ord.status === 'approved_for_kitchen'
                                    ? 'bg-[#1E1B4B] text-[#D2DB76]'
                                    : ord.status === 'preparing'
                                      ? 'bg-sky-50 text-sky-800 border border-sky-200'
                                      : ord.status === 'ready'
                                        ? 'bg-[#D2DB76] text-[#1E1B4B]'
                                        : 'bg-emerald-50 text-[#059669] border border-emerald-200'
                              }`}
                            >
                              {ord.status === 'pending_approval'
                                ? 'Needs Approval'
                                : ord.status === 'approved_for_kitchen'
                                  ? 'In KOT Queue'
                                  : ord.status === 'preparing'
                                    ? 'Preparing'
                                    : ord.status === 'ready'
                                      ? 'Ready to Serve'
                                      : 'Served'}
                            </span>

                            <div className="flex items-center gap-1.5">
                              {ord.paymentStatus === 'paid' ? (
                                <span className="rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-extrabold text-[#059669]">
                                  ₹ Paid
                                </span>
                              ) : ord.paymentStatus === 'upi_pending_verify' ? (
                                <span className="rounded-full bg-amber-100 border border-amber-300 px-2 py-0.5 text-[10px] font-extrabold text-[#B45309]">
                                  VERIFY UPI
                                </span>
                              ) : (
                                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-bold text-[#6B7280]">
                                  Unpaid
                                </span>
                              )}
                              <span className="text-[14px] font-extrabold text-[#111827] tabular-nums">
                                {formatPriceFromPaise(
                                  itemTotalPaise,
                                  currencyCode,
                                )}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="rounded-xl bg-[#F8F9FA] px-3 py-2 text-[13px] font-semibold text-[#111827] space-y-1">
                          {ord.items.map((line, idx) => (
                            <div
                              key={`${ord.id}-${idx}`}
                              className="flex items-center justify-between gap-2"
                            >
                              <span>
                                <strong className="text-[#1E1B4B]">
                                  {line.quantity}×
                                </strong>{' '}
                                {line.name}
                              </span>
                              <span className="text-[12px] text-[#6B7280] tabular-nums">
                                {formatPriceFromPaise(
                                  line.pricePaise * line.quantity,
                                  currencyCode,
                                )}
                              </span>
                            </div>
                          ))}
                        </div>

                        {firstNote && (
                          <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-1.5 text-[12px] font-bold text-[#92400E]">
                            Kitchen Note: &ldquo;{firstNote}&rdquo;
                          </p>
                        )}

                        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            {ord.status === 'pending_approval' && (
                              <>
                                <button
                                  type="button"
                                  disabled={isBusy}
                                  onClick={() =>
                                    void handleUpdateOrderStatus(
                                      ord.id,
                                      'approved_for_kitchen',
                                    )
                                  }
                                  className="rounded-xl bg-[#1E1B4B] px-3 py-1.5 text-[12px] font-extrabold text-[#FFFFFF] hover:bg-[#2E2A6E] cursor-pointer"
                                >
                                  Approve → Chef
                                </button>
                                <button
                                  type="button"
                                  disabled={isBusy}
                                  onClick={() =>
                                    void handleUpdateOrderStatus(
                                      ord.id,
                                      'cancelled',
                                    )
                                  }
                                  className="rounded-xl border border-red-200 bg-red-50 px-2.5 py-1.5 text-[12px] font-bold text-red-700 hover:bg-red-100 cursor-pointer"
                                >
                                  Reject
                                </button>
                              </>
                            )}
                            {ord.status === 'approved_for_kitchen' && (
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() =>
                                  void handleUpdateOrderStatus(
                                    ord.id,
                                    'preparing',
                                  )
                                }
                                className="rounded-xl bg-[#1E1B4B] px-3 py-1.5 text-[12px] font-extrabold text-[#FFFFFF] hover:bg-[#2E2A6E] cursor-pointer"
                              >
                                Start Preparing
                              </button>
                            )}
                            {ord.status === 'preparing' && (
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() =>
                                  void handleUpdateOrderStatus(ord.id, 'ready')
                                }
                                className="rounded-xl bg-[#D2DB76] px-3 py-1.5 text-[12px] font-extrabold text-[#1E1B4B] hover:brightness-95 cursor-pointer"
                              >
                                Mark Ready ✓
                              </button>
                            )}
                            {(ord.status === 'ready' ||
                              ord.status === 'preparing') && (
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() =>
                                  void handleUpdateOrderStatus(ord.id, 'served')
                                }
                                className="rounded-xl bg-[#059669] px-3 py-1.5 text-[12px] font-extrabold text-[#FFFFFF] hover:bg-emerald-700 cursor-pointer"
                              >
                                Mark Served ✓
                              </button>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() =>
                                printKitchenKotTicket(ord, business.name)
                              }
                              className="inline-flex items-center gap-1 rounded-xl border border-[#1E1B4B]/15 bg-[#F8F9FA] px-2.5 py-1.5 text-[11.5px] font-bold text-[#1E1B4B] hover:bg-white cursor-pointer"
                            >
                              <Printer className="h-3.5 w-3.5" aria-hidden />
                              KOT
                            </button>
                            {matchedTable &&
                              (ord.paymentStatus ?? 'unpaid') !== 'paid' && (
                                <button
                                  type="button"
                                  onClick={() => setBillModalTable(matchedTable)}
                                  className="inline-flex items-center gap-1 rounded-xl bg-[#1E1B4B]/10 px-2.5 py-1.5 text-[11.5px] font-extrabold text-[#1E1B4B] hover:bg-[#1E1B4B] hover:text-white cursor-pointer"
                                >
                                  <Receipt className="h-3.5 w-3.5" aria-hidden />
                                  Bill
                                </button>
                              )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* SUB-TAB 3: LIVE REQUESTS & 2-WAY TABLE CHAT INBOX */}
          {overviewSubTab === 'messages' && (
            <LiveTableMessagesPanel
              businessSlug={business.slug}
              businessName={business.name}
              activeCalls={activeCalls}
              tableMessages={tableMessages}
              tables={tables}
              staffRoster={staffMembers}
              onResolveCall={async (callId, assignedLabel) => {
                await handleUpdateTableCall(callId, 'resolved', assignedLabel);
              }}
              onAssignCall={async (callId, assignedLabel) => {
                await handleUpdateTableCall(callId, 'open', assignedLabel);
              }}
              onOpenTableCheckout={(tbl) => setBillModalTable(tbl)}
              onSendManagerReply={handleSendManagerReply}
            />
          )}
        </div>
      )}

      {/* =====================================================================
          1B. DEDICATED ANALYTICS, CHECKLIST & BILL VERIFICATION SECTION
         ===================================================================== */}
      {currentSection === 'analytics' && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
            <div>
              <h1 className="text-[22px] font-bold tracking-tight text-[#111827]">
                Operations Analytics &amp; Checklist
              </h1>
              <p className="mt-0.5 text-[13px] text-slate-500">
                Track QR scans, live orders, open table bills, waiter activity, and setup readiness in one clean place.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void refreshFloorData()}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-[12.5px] font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              <RefreshCw className="h-3.5 w-3.5" aria-hidden /> Refresh Stats
            </button>
          </div>

          {/* 4 Flat KPI Cards */}
          <div className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-1">
              <p className="text-[11.5px] font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <QrCode className="h-3.5 w-3.5 text-[#1E1B4B]" aria-hidden />
                Total QR Scans
              </p>
              <p className="text-[28px] font-bold text-[#111827] tabular-nums">
                {analytics.qrScans.toLocaleString()}
              </p>
              <p className="text-[11.5px] text-slate-500">
                Table, room &amp; counter menu opens
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-1">
              <p className="text-[11.5px] font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <ClipboardList className="h-3.5 w-3.5 text-[#1E1B4B]" aria-hidden />
                Orders (Last 24h)
              </p>
              <p className="text-[28px] font-bold text-[#111827] tabular-nums">
                {recentOrders.filter((o) => o.status !== 'cancelled').length}
              </p>
              <p className="text-[11.5px] text-slate-500">
                {activeOrders.length} active in kitchen right now
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-1">
              <p className="text-[11.5px] font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <Receipt className="h-3.5 w-3.5 text-amber-600" aria-hidden />
                Open Unpaid Bills
              </p>
              <p className="text-[28px] font-bold text-[#111827] tabular-nums">
                {formatPriceFromPaise(
                  recentOrders
                    .filter(
                      (o) =>
                        o.status !== 'cancelled' &&
                        (o.paymentStatus ?? 'unpaid') !== 'paid',
                    )
                    .reduce(
                      (sum, o) =>
                        sum +
                        o.items.reduce(
                          (s, i) => s + i.pricePaise * i.quantity,
                          0,
                        ) +
                        (o.packagingPaise ?? 0),
                      0,
                    ),
                  currencyCode,
                )}
              </p>
              <p className="text-[11.5px] text-slate-500">
                Across currently occupied tables &amp; rooms
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-1">
              <p className="text-[11.5px] font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" aria-hidden />
                Verified Visits &amp; Stars
              </p>
              <p className="text-[28px] font-bold text-[#111827] tabular-nums">
                {analytics.verifiedPaidVisits.toLocaleString()}{' '}
                <span className="text-[14px] font-semibold text-emerald-700">
                  ({analytics.loyaltyStarsIssued} ★)
                </span>
              </p>
              <p className="text-[11.5px] text-slate-500">
                {analytics.gamesPlayed} games played · {analytics.gamePointsIssued} pts
              </p>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {/* Property Operations Checklist */}
            <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
              <h2 className="text-[15px] font-bold text-[#111827] flex items-center gap-2">
                <CheckSquare className="h-4 w-4 text-[#1E1B4B]" aria-hidden />
                Property Setup Checklist
              </h2>
              <div className="divide-y divide-slate-100">
                {[
                  {
                    done: items.length > 0,
                    label: `Digital Menu (${items.length} dishes across ${categories.length} categories)`,
                    actionLabel: 'Edit Menu',
                    onClick: () => setSection('menu'),
                  },
                  {
                    done: tables.filter((t) => t.isActive).length > 0,
                    label: `Tables & Rooms (${tables.filter((t) => (t.locationType ?? 'table') === 'table').length} tables, ${tables.filter((t) => t.locationType === 'room').length} rooms)`,
                    actionLabel: 'Manage Tables',
                    onClick: () => setSection('tables'),
                  },
                  {
                    done: staffMembers.some((s) => s.isActive),
                    label: `Staff & Waiter PINs (${staffMembers.filter((s) => s.isActive).length} active)`,
                    actionLabel: 'Manage Staff',
                    onClick: () => setSection('staff'),
                  },
                  {
                    done: Boolean(upiId.trim()),
                    label: upiId.trim()
                      ? `Dynamic UPI Pay-at-Table QR (${upiId})`
                      : 'Merchant UPI ID not set yet',
                    actionLabel: 'Settings',
                    onClick: () => setSection('settings'),
                  },
                  {
                    done: acceptingOrders && tableOrderingEnabled,
                    label:
                      acceptingOrders && tableOrderingEnabled
                        ? 'Customer QR Self-Ordering is ON'
                        : 'Customer QR Ordering is currently Paused',
                    actionLabel: 'Toggle in Settings',
                    onClick: () => setSection('settings'),
                  },
                ].map((row) => (
                  <div
                    key={row.label}
                    className="flex items-center justify-between gap-3 py-2.5 text-[13px]"
                  >
                    <span className="flex items-center gap-2.5 text-slate-700 font-medium">
                      <span
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                          row.done
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-slate-100 text-slate-400'
                        }`}
                      >
                        {row.done ? '✓' : '·'}
                      </span>
                      <span>{row.label}</span>
                    </span>
                    <button
                      type="button"
                      onClick={row.onClick}
                      className="shrink-0 text-[12px] font-semibold text-[#1E1B4B] hover:underline cursor-pointer"
                    >
                      {row.actionLabel} →
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Paid Bill Star Verification & Pending Reward Tickets */}
            <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
              <div>
                <h2 className="text-[15px] font-bold text-[#111827] flex items-center gap-2">
                  <Star
                    className="h-4 w-4 text-amber-500 fill-[#D2DB76]"
                    aria-hidden
                  />
                  Verify Paid Bill → Award Loyalty Star
                </h2>
                <p className="mt-0.5 text-[12px] text-slate-500">
                  Enter a guest&apos;s phone number or loyalty QR token to credit verified visit stars.
                </p>
              </div>
              <form
                onSubmit={(e) => void handleQuickVerifyBillStar(e)}
                className="flex flex-col sm:flex-row gap-2"
              >
                <input
                  type="text"
                  aria-label="Guest Phone, Email, or Loyalty QR Token"
                  placeholder="Guest Phone / Loyalty QR Token…"
                  value={quickVerifyLookup}
                  onChange={(e) => setQuickVerifyLookup(e.target.value)}
                  className="h-9.5 flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 text-[13px] font-medium text-[#111827] focus:border-[#1E1B4B] focus:bg-white focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={quickVerifyingBill || !quickVerifyLookup.trim()}
                  className="inline-flex h-9.5 shrink-0 items-center justify-center gap-1.5 rounded-lg bg-[#1E1B4B] px-3.5 text-[12.5px] font-semibold text-white hover:bg-[#2E2A6E] disabled:opacity-50 cursor-pointer"
                >
                  <Star
                    className="h-3.5 w-3.5 text-[#D2DB76] fill-[#D2DB76]"
                    aria-hidden
                  />
                  {quickVerifyingBill ? 'Awarding…' : 'Verify Bill (+1 ★)'}
                </button>
              </form>

              {pendingClaims.length > 0 && (
                <div className="space-y-2 border-t border-slate-100 pt-3">
                  <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                    <Ticket className="h-3.5 w-3.5 text-[#1E1B4B]" aria-hidden />
                    Pending Reward Tickets ({pendingClaims.length})
                  </h3>
                  <div className="space-y-2">
                    {pendingClaims.map((claim) => (
                      <div
                        key={claim.id}
                        className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-[13px] font-semibold text-[#111827]">
                            {claim.rewardTitle || 'Reward'} ·{' '}
                            <span className="font-mono text-[#1E1B4B]">
                              {claim.claimCode}
                            </span>
                          </p>
                          <p className="text-[11.5px] text-slate-500">
                            {claim.customerName || 'Guest'} ({claim.starsSpent} ★)
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            void handleFulfillClaimCode(claim.claimCode)
                          }
                          className="shrink-0 rounded-lg bg-[#1E1B4B] px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-[#2E2A6E] cursor-pointer"
                        >
                          Fulfill ✓
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Waiter Verification Activity Today */}
              {floorData?.staffVerificationCountsToday &&
                Object.keys(floorData.staffVerificationCountsToday).length >
                  0 && (
                  <div className="space-y-2 border-t border-slate-100 pt-3">
                    <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      Staff Verifications Today
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(
                        floorData.staffVerificationCountsToday,
                      ).map(([name, count]) => (
                        <span
                          key={name}
                          className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-[12px] font-semibold text-slate-700"
                        >
                          {name}: <strong className="text-[#1E1B4B]">{count}</strong>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          2. DIGITAL MENU
         ===================================================================== */}
      {currentSection === 'menu' && (
        <div className="space-y-6">
          {/* Top Header Bar */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-[28px] sm:text-[32px] font-extrabold tracking-tight text-[#111827]">
                Digital Menu
              </h1>
              <p className="mt-1 text-[14px] text-[#6B7280]">
                Manage your categories, dishes, dietary tags, and live availability. Waiters take orders directly at the table.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2.5">
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setEditingCategoryId(null);
                  setCatName('');
                  setCatDescription('');
                  setCatIsActive(true);
                  setShowCategoryModal((v) => !v);
                }}
              >
                <Plus className="h-4 w-4" aria-hidden /> Category
              </Button>
              <Button
                type="button"
                variant="primary"
                onClick={() => {
                  setEditingItemId(null);
                  setItemName('');
                  setItemDescription('');
                  setItemPriceMajor('');
                  setItemDietaryTag('veg');
                  setItemIsAvailable(true);
                  setItemIsFeatured(false);
                  setItemImageUrl('');
                  if (
                    selectedCategoryId !== 'all' &&
                    selectedCategoryId
                  ) {
                    setItemCategoryId(selectedCategoryId);
                  } else if (categories[0]) {
                    setItemCategoryId(categories[0].id);
                  }
                  setShowDishForm(true);
                }}
              >
                <Plus className="h-4 w-4" aria-hidden /> Add Dish
              </Button>
            </div>
          </div>

          {/* Customer Phone Ordering Master Switch inside Digital Menu */}
          <div className="bistro-card px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#1E1B4B] text-[#D2DB76]">
                <ChefHat className="h-4 w-4" aria-hidden />
              </span>
              <div>
                <p className="text-[14px] font-extrabold text-[#111827]">
                  Customer Phone Ordering (Send to Chef after Approval):{' '}
                  <span
                    className={
                      tableOrderingEnabled ? 'text-[#059669]' : 'text-[#6B7280]'
                    }
                  >
                    {tableOrderingEnabled ? 'ON' : 'OFF'}
                  </span>
                </p>
                <p className="text-[12px] text-[#6B7280]">
                  {tableOrderingEnabled
                    ? 'Dishes display + buttons so guests can submit orders for your approval.'
                    : 'View-only menu with zero + buttons. Toggle ON anytime to accept table orders.'}
                </p>
              </div>
            </div>

            <button
              type="button"
              role="switch"
              aria-checked={tableOrderingEnabled}
              aria-label="Toggle Customer Phone Ordering on Digital Menu"
              disabled={savingProfile}
              onClick={() => {
                const next = !tableOrderingEnabled;
                setTableOrderingEnabled(next);
                void handleSaveProfile({
                  tableOrderingEnabled: next,
                  statusMessage: next
                    ? 'Customer Phone Ordering turned ON.'
                    : 'Customer Phone Ordering turned OFF (View-Only Menu).',
                });
              }}
              className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors duration-200 cursor-pointer ${
                tableOrderingEnabled ? 'bg-[#059669]' : 'bg-[#6B7280]/30'
              }`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-[#FFFFFF] shadow-sm transition-transform duration-200 ${
                  tableOrderingEnabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* 1-Tap Preset Menu & 5 Cultural Theme Studio */}
          <div className="bistro-card p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-[18px] font-extrabold text-[#111827] flex items-center gap-2">
                  <Palette className="h-5 w-5 text-[#1E1B4B]" aria-hidden />
                  Cultural Menu Theme &amp; 1-Tap Preset Studio
                </h2>
                <p className="mt-0.5 text-[13px] text-[#6B7280]">
                  Pick a cultural template to transform your guest Digital Menu immediately — or load 10 authentic sample dishes in 1 tap.
                </p>
              </div>
              {isBusinessLive && (
                <a
                  href={menuUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[#1E1B4B]/20 bg-[#F8F9FA] px-3.5 text-[12px] font-bold text-[#1E1B4B] hover:bg-[#1E1B4B] hover:text-[#FFFFFF] transition-colors"
                >
                  Preview Live Menu <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                </a>
              )}
            </div>

            <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
              {MENU_THEME_LIST.map((tpl) => {
                const isSelected = menuThemeTemplate === tpl.id;
                const isApplying =
                  tpl.presetKey !== undefined &&
                  applyingPresetKey === tpl.presetKey;

                return (
                  <div
                    key={tpl.id}
                    className={`rounded-2xl border p-4 flex flex-col justify-between gap-3 transition-all ${
                      isSelected
                        ? 'border-2 border-[#1E1B4B] bg-[#FFFFFF] ring-2 ring-[#D2DB76] shadow-sm'
                        : 'border-[#1E1B4B]/12 bg-[#FFFFFF] hover:border-[#1E1B4B]/40'
                    }`}
                  >
                    <button
                      type="button"
                      disabled={savingProfile}
                      onClick={() => {
                        setMenuThemeTemplate(tpl.id);
                        void handleSaveProfile({
                          menuThemeTemplate: tpl.id,
                          statusMessage: `Switched Digital Menu theme to "${tpl.name}".`,
                        });
                      }}
                      className="text-left space-y-3 cursor-pointer"
                    >
                      {/* Mini Visual Swatch Preview (Authentic Font, Border & Swatches) */}
                      <div
                        className={`p-3.5 space-y-2 ${tpl.previewBorderStyle}`}
                        style={{
                          backgroundColor: tpl.previewBg,
                          color: tpl.previewText,
                        }}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <p
                              className={`text-[15px] font-bold truncate ${tpl.previewFontClass}`}
                            >
                              {tpl.id === 'prakriti'
                                ? `🌿 ${tpl.name}`
                                : tpl.name}
                            </p>
                            <p className="text-[10px] opacity-80 truncate">
                              {tpl.vibeBadge}
                            </p>
                          </div>
                          <span
                            className={`shrink-0 px-2.5 py-1 text-[10px] font-bold ${tpl.previewButtonStyle}`}
                          >
                            Menu
                          </span>
                        </div>
                        <div className="flex items-center justify-between border-t border-current/15 pt-1.5 text-[10px] opacity-85">
                          <span className="truncate font-semibold">
                            Signature Dish
                          </span>
                          <span className="font-extrabold tabular-nums">
                            ₹295
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          {tpl.swatches.map((hex) => (
                            <span
                              key={hex}
                              className="h-4 w-4 rounded-full border border-black/15"
                              style={{ backgroundColor: hex }}
                              title={hex}
                            />
                          ))}
                        </div>
                        {isSelected ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-[10.5px] font-extrabold text-[#059669]">
                            <Check className="h-3 w-3" aria-hidden /> Active Theme
                          </span>
                        ) : (
                          <span className="text-[11px] font-bold text-[#1E1B4B] underline">
                            Apply Theme
                          </span>
                        )}
                      </div>

                      <p className="text-[12px] text-[#6B7280] leading-snug">
                        {tpl.subtitle}
                      </p>
                    </button>

                    {tpl.presetKey && (
                      <button
                        type="button"
                        disabled={applyingPresetKey !== null}
                        onClick={() =>
                          void handleApplyPresetMenu(tpl.presetKey!)
                        }
                        className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-xl bg-[#1E1B4B]/[0.06] px-3 text-[12px] font-extrabold text-[#1E1B4B] hover:bg-[#1E1B4B] hover:text-[#FFFFFF] active:scale-[0.98] transition-all disabled:opacity-50 cursor-pointer"
                      >
                        <Wand2 className="h-3.5 w-3.5" aria-hidden />
                        {isApplying
                          ? 'Loading 10 Dishes…'
                          : 'Load Sample Dishes (1-Tap)'}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Category Filter Pills Bar */}
          {categories.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setSelectedCategoryId('all')}
                className={`inline-flex h-10 items-center gap-2 rounded-full px-4 text-[13px] font-semibold transition-all duration-150 active:scale-[0.98] cursor-pointer ${
                  selectedCategoryId === 'all'
                    ? 'bg-[#1E1B4B] text-[#FFFFFF] shadow-sm'
                    : 'border border-[#1E1B4B]/15 bg-[#FFFFFF] text-[#111827] hover:bg-[#F8F9FA]'
                }`}
              >
                <span>All</span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] tabular-nums ${
                    selectedCategoryId === 'all'
                      ? 'bg-[#FFFFFF]/20 text-[#FFFFFF]'
                      : 'bg-[#F8F9FA] text-[#6B7280]'
                  }`}
                >
                  {items.length}
                </span>
              </button>

              {categories.map((cat) => {
                const count = items.filter((i) => i.categoryId === cat.id).length;
                const active = selectedCategoryId === cat.id;
                return (
                  <div
                    key={cat.id}
                    className={`inline-flex h-10 items-center gap-1.5 rounded-full pl-4 pr-2.5 text-[13px] font-semibold transition-all duration-150 ${
                      active
                        ? 'bg-[#1E1B4B] text-[#FFFFFF] shadow-sm'
                        : 'border border-[#1E1B4B]/15 bg-[#FFFFFF] text-[#111827] hover:bg-[#F8F9FA]'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setSelectedCategoryId(cat.id)}
                      className="inline-flex items-center gap-2 cursor-pointer"
                    >
                      <span>{cat.name}</span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] tabular-nums ${
                          active
                            ? 'bg-[#FFFFFF]/20 text-[#FFFFFF]'
                            : 'bg-[#F8F9FA] text-[#6B7280]'
                        }`}
                      >
                        {count}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingCategoryId(cat.id);
                        setCatName(cat.name);
                        setCatDescription(cat.description ?? '');
                        setCatIsActive(cat.isActive);
                        setShowCategoryModal(true);
                      }}
                      aria-label={`Edit ${cat.name}`}
                      className={`rounded-full p-1 transition-colors cursor-pointer ${
                        active
                          ? 'text-[#FFFFFF]/80 hover:bg-[#FFFFFF]/20'
                          : 'text-[#6B7280] hover:bg-[#1E1B4B]/10'
                      }`}
                    >
                      <Edit3 className="h-3 w-3" aria-hidden />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Add / Edit Category Slide-Down Card */}
          {showCategoryModal && (
            <form
              onSubmit={(e) => void handleSaveCategory(e)}
              className="bistro-card p-6 space-y-4 animate-fadeSlideUp"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-[17px] font-bold text-[#111827]">
                  {editingCategoryId ? 'Edit Menu Category' : 'New Menu Category'}
                </h3>
                <button
                  type="button"
                  onClick={() => setShowCategoryModal(false)}
                  className="rounded-lg p-1.5 text-[#6B7280] hover:bg-[#F8F9FA] cursor-pointer"
                >
                  <X className="h-4 w-4" aria-hidden />
                </button>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label
                    htmlFor="catNameField"
                    className="block text-[13px] font-semibold text-[#111827]"
                  >
                    Category Name
                  </label>
                  <input
                    id="catNameField"
                    type="text"
                    required
                    maxLength={80}
                    placeholder="e.g. Starters, Mains, Artisan Drinks"
                    value={catName}
                    onChange={(e) => setCatName(e.target.value)}
                    className="block h-11 w-full rounded-xl border border-[#1E1B4B]/20 bg-[#FFFFFF] px-3.5 text-[14px] text-[#111827] focus:border-[#1E1B4B] focus:outline-none"
                  />
                </div>
                <div className="space-y-1.5">
                  <label
                    htmlFor="catDescField"
                    className="block text-[13px] font-semibold text-[#111827]"
                  >
                    Subtitle (Optional)
                  </label>
                  <input
                    id="catDescField"
                    type="text"
                    maxLength={240}
                    placeholder="e.g. Served hot with house mint chutney"
                    value={catDescription}
                    onChange={(e) => setCatDescription(e.target.value)}
                    className="block h-11 w-full rounded-xl border border-[#1E1B4B]/20 bg-[#FFFFFF] px-3.5 text-[14px] text-[#111827] focus:border-[#1E1B4B] focus:outline-none"
                  />
                </div>
              </div>
              <div className="flex items-center justify-between pt-1">
                {editingCategoryId ? (
                  <button
                    type="button"
                    onClick={() => {
                      const target = categories.find(
                        (c) => c.id === editingCategoryId,
                      );
                      if (target) {
                        void handleDeleteCategory(target);
                        setShowCategoryModal(false);
                      }
                    }}
                    className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-red-700 hover:underline cursor-pointer"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden /> Delete Category
                  </button>
                ) : (
                  <span />
                )}
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setShowCategoryModal(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" variant="primary">
                    {editingCategoryId ? 'Save Category' : 'Create Category'}
                  </Button>
                </div>
              </div>
            </form>
          )}

          {/* Add / Edit Dish Slide-Down Card */}
          {showDishForm && (
            <form
              onSubmit={(e) => void handleSaveItem(e)}
              className="bistro-card p-6 sm:p-7 space-y-5 animate-fadeSlideUp"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-[18px] font-bold text-[#111827]">
                  {editingItemId ? 'Edit Dish' : 'Add Dish to Digital Menu'}
                </h3>
                <button
                  type="button"
                  onClick={() => setShowDishForm(false)}
                  className="rounded-lg p-1.5 text-[#6B7280] hover:bg-[#F8F9FA] cursor-pointer"
                >
                  <X className="h-4 w-4" aria-hidden />
                </button>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label
                    htmlFor="dishNameField"
                    className="block text-[13px] font-semibold text-[#111827]"
                  >
                    Dish Name
                  </label>
                  <input
                    id="dishNameField"
                    type="text"
                    required
                    maxLength={100}
                    placeholder="e.g. Hyderabadi Dum Biryani"
                    value={itemName}
                    onChange={(e) => setItemName(e.target.value)}
                    className="block h-11 w-full rounded-xl border border-[#1E1B4B]/20 bg-[#FFFFFF] px-3.5 text-[14px] text-[#111827] focus:border-[#1E1B4B] focus:outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="dishCategoryField"
                    className="block text-[13px] font-semibold text-[#111827]"
                  >
                    Category
                  </label>
                  <select
                    id="dishCategoryField"
                    value={itemCategoryId}
                    onChange={(e) => setItemCategoryId(e.target.value)}
                    className="block h-11 w-full rounded-xl border border-[#1E1B4B]/20 bg-[#FFFFFF] px-3.5 text-[14px] text-[#111827] focus:border-[#1E1B4B] focus:outline-none"
                  >
                    {categories.length === 0 && (
                      <option value="">Auto-create Signature Dishes</option>
                    )}
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label
                    htmlFor="dishPriceField"
                    className="block text-[13px] font-semibold text-[#111827]"
                  >
                    Price ({CURRENCY_METADATA[currencyCode].symbol})
                  </label>
                  <input
                    id="dishPriceField"
                    type="text"
                    inputMode="decimal"
                    required
                    placeholder="e.g. 249"
                    value={itemPriceMajor}
                    onChange={(e) => setItemPriceMajor(e.target.value)}
                    className="block h-11 w-full rounded-xl border border-[#1E1B4B]/20 bg-[#FFFFFF] px-3.5 text-[14px] text-[#111827] tabular-nums focus:border-[#1E1B4B] focus:outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="dishDietaryField"
                    className="block text-[13px] font-semibold text-[#111827]"
                  >
                    Dietary Indicator
                  </label>
                  <select
                    id="dishDietaryField"
                    value={itemDietaryTag}
                    onChange={(e) =>
                      setItemDietaryTag(e.target.value as DietaryTag)
                    }
                    className="block h-11 w-full rounded-xl border border-[#1E1B4B]/20 bg-[#FFFFFF] px-3.5 text-[14px] text-[#111827] focus:border-[#1E1B4B] focus:outline-none"
                  >
                    {ALLOWED_DIETARY_TAGS.map((tag) => (
                      <option key={tag} value={tag}>
                        {DIETARY_TAG_METADATA[tag].label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label
                    htmlFor="dishDescField"
                    className="block text-[13px] font-semibold text-[#111827]"
                  >
                    Concise Description / Regional Name (Optional)
                  </label>
                  <input
                    id="dishDescField"
                    type="text"
                    maxLength={300}
                    placeholder="e.g. Slow-cooked with saffron, or Telugu subtitle (ఘీ పొడి దోశ)"
                    value={itemDescription}
                    onChange={(e) => setItemDescription(e.target.value)}
                    className="block h-11 w-full rounded-xl border border-[#1E1B4B]/20 bg-[#FFFFFF] px-3.5 text-[14px] text-[#111827] focus:border-[#1E1B4B] focus:outline-none"
                  />
                </div>
                <div className="space-y-1.5">
                  <label
                    htmlFor="dishImageField"
                    className="block text-[13px] font-semibold text-[#111827]"
                  >
                    Dish Photo URL (Optional)
                  </label>
                  <input
                    id="dishImageField"
                    type="url"
                    maxLength={2048}
                    placeholder="https://images.unsplash.com/..."
                    value={itemImageUrl}
                    onChange={(e) => setItemImageUrl(e.target.value)}
                    className="block h-11 w-full rounded-xl border border-[#1E1B4B]/20 bg-[#FFFFFF] px-3.5 text-[14px] text-[#111827] focus:border-[#1E1B4B] focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <label
                    htmlFor="dishSpiceField"
                    className="block text-[13px] font-semibold text-[#111827]"
                  >
                    Spice Level (Optional)
                  </label>
                  <select
                    id="dishSpiceField"
                    value={itemSpiceLevel}
                    onChange={(e) =>
                      setItemSpiceLevel(e.target.value as DishSpiceLevel | '')
                    }
                    className="block h-11 w-full rounded-xl border border-[#1E1B4B]/20 bg-[#FFFFFF] px-3.5 text-[14px] text-[#111827] focus:border-[#1E1B4B] focus:outline-none"
                  >
                    <option value="">None / Not Applicable</option>
                    <option value="mild">🌿 Mild</option>
                    <option value="medium">🌶️ Medium Spice</option>
                    <option value="spicy">🌶️🌶️ Spicy</option>
                    <option value="extra_spicy">🔥 Extra Spicy</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="dishPrepField"
                    className="block text-[13px] font-semibold text-[#111827]"
                  >
                    Prep Time (Mins)
                  </label>
                  <input
                    id="dishPrepField"
                    type="number"
                    min={1}
                    max={180}
                    placeholder="e.g. 15"
                    value={itemPrepTimeMinutes}
                    onChange={(e) => setItemPrepTimeMinutes(e.target.value)}
                    className="block h-11 w-full rounded-xl border border-[#1E1B4B]/20 bg-[#FFFFFF] px-3.5 text-[14px] text-[#111827] tabular-nums focus:border-[#1E1B4B] focus:outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="dishIngredientsField"
                    className="block text-[13px] font-semibold text-[#111827]"
                  >
                    Key Ingredients / Allergens
                  </label>
                  <input
                    id="dishIngredientsField"
                    type="text"
                    maxLength={240}
                    placeholder="e.g. Paneer, cashew gravy, butter, dairy"
                    value={itemIngredientsSummary}
                    onChange={(e) => setItemIngredientsSummary(e.target.value)}
                    className="block h-11 w-full rounded-xl border border-[#1E1B4B]/20 bg-[#FFFFFF] px-3.5 text-[14px] text-[#111827] focus:border-[#1E1B4B] focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-4 border-t border-[#1E1B4B]/10 pt-4">
                <div className="flex flex-wrap items-center gap-5">
                  <label className="inline-flex items-center gap-2 text-[13px] font-semibold text-[#111827] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={itemIsAvailable}
                      onChange={(e) => setItemIsAvailable(e.target.checked)}
                      className="h-4 w-4 accent-[#1E1B4B]"
                    />
                    Available Today
                  </label>
                  <label className="inline-flex items-center gap-2 text-[13px] font-semibold text-[#111827] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={itemIsFeatured}
                      onChange={(e) => setItemIsFeatured(e.target.checked)}
                      className="h-4 w-4 accent-[#1E1B4B]"
                    />
                    Chef&apos;s Special
                  </label>
                  <div className="inline-flex items-center gap-3 rounded-xl border border-[#1E1B4B]/12 bg-[#F8F9FA] px-3 py-1.5">
                    <span className="text-[11.5px] font-extrabold uppercase tracking-wider text-[#6B7280]">
                      Show on:
                    </span>
                    <label className="inline-flex items-center gap-1.5 text-[12.5px] font-bold text-[#111827] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={itemShowOnTable}
                        onChange={(e) => setItemShowOnTable(e.target.checked)}
                        className="h-4 w-4 accent-[#1E1B4B]"
                      />
                      Tables
                    </label>
                    <label className="inline-flex items-center gap-1.5 text-[12.5px] font-bold text-[#111827] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={itemShowOnRoom}
                        onChange={(e) => setItemShowOnRoom(e.target.checked)}
                        className="h-4 w-4 accent-[#1E1B4B]"
                      />
                      Hotel Rooms
                    </label>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setShowDishForm(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" variant="primary">
                    {editingItemId ? 'Update Dish' : 'Save Dish'}
                  </Button>
                </div>
              </div>
            </form>
          )}

          {/* Friendly Empty State or Clean Dish Rows */}
          {items.length === 0 ? (
            <div className="bistro-card p-10 sm:p-14 text-center space-y-4">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#1E1B4B] text-[#D2DB76] shadow-sm">
                <UtensilsCrossed className="h-6 w-6" aria-hidden />
              </div>
              <div className="space-y-1.5 max-w-md mx-auto">
                <h2 className="text-[20px] font-extrabold text-[#111827]">
                  Build Your Digital Table Menu
                </h2>
                <p className="text-[14px] text-[#6B7280] leading-relaxed">
                  Load a ready-to-customize 3-course sample menu in one click, or add your first signature dish manually.
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => void handleSeedStarterMenu()}
                >
                  <Sparkles className="h-4 w-4 text-[#1E1B4B]" aria-hidden /> Load Sample Menu
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  onClick={() => setShowDishForm(true)}
                >
                  <Plus className="h-4 w-4" aria-hidden /> Add Your First Dish
                </Button>
              </div>
            </div>
          ) : (
            <div className="bistro-card divide-y divide-[#1E1B4B]/10 overflow-hidden">
              {filteredItems.length === 0 ? (
                <div className="p-8 text-center text-[14px] text-[#6B7280]">
                  No dishes in this category yet. Click <strong>+ Add Dish</strong> to add one.
                </div>
              ) : (
                filteredItems.map((item) => {
                  const dMeta = DIETARY_TAG_METADATA[item.dietaryTag];
                  const catObj = categories.find(
                    (c) => c.id === item.categoryId,
                  );
                  return (
                    <div
                      key={item.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 sm:px-6 hover:bg-[#F8F9FA]/60 transition-colors"
                    >
                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2.5">
                          <span
                            className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border"
                            style={{
                              borderColor: dMeta.borderColor,
                              backgroundColor: dMeta.bgColor,
                            }}
                            title={dMeta.label}
                          >
                            <span
                              className="h-2 w-2 rounded-full"
                              style={{ backgroundColor: dMeta.dotColor }}
                            />
                          </span>
                          <span className="text-[16px] font-bold text-[#111827]">
                            {item.name}
                          </span>
                          {catObj && (
                            <span className="rounded-full bg-[#F8F9FA] border border-[#1E1B4B]/10 px-2.5 py-0.5 text-[11px] font-semibold text-[#6B7280]">
                              {catObj.name}
                            </span>
                          )}
                          {item.isFeatured && (
                            <span className="rounded-full bg-[#D2DB76]/55 px-2.5 py-0.5 text-[11px] font-bold text-[#1E1B4B]">
                              ★ Chef&apos;s Special
                            </span>
                          )}
                          {item.spiceLevel && (
                            <span
                              className={`rounded-full border px-2 py-0.5 text-[10.5px] font-bold ${SPICE_LEVEL_METADATA[item.spiceLevel].badgeClass}`}
                            >
                              {SPICE_LEVEL_METADATA[item.spiceLevel].emoji}{' '}
                              {SPICE_LEVEL_METADATA[item.spiceLevel].label}
                            </span>
                          )}
                          {item.prepTimeMinutes && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-[#F8F9FA] border border-[#1E1B4B]/10 px-2 py-0.5 text-[10.5px] font-semibold text-[#6B7280]">
                              <Clock className="h-3 w-3" aria-hidden />
                              {item.prepTimeMinutes}m
                            </span>
                          )}
                          {item.showOnTable === false && (
                            <span className="rounded-full bg-violet-50 border border-violet-200 px-2 py-0.5 text-[10.5px] font-bold text-violet-800">
                              Rooms Only
                            </span>
                          )}
                          {item.showOnRoom === false && (
                            <span className="rounded-full bg-sky-50 border border-sky-200 px-2 py-0.5 text-[10.5px] font-bold text-sky-800">
                              Tables Only
                            </span>
                          )}
                        </div>
                        {item.description && (
                          <p className="text-[13px] text-[#6B7280] line-clamp-2 pl-6">
                            {item.description}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-4 pl-6 sm:pl-0 shrink-0">
                        <span className="text-[16px] font-extrabold text-[#111827] tabular-nums">
                          {formatPriceFromPaise(item.pricePaise, currencyCode)}
                        </span>

                        {/* Crisp Available Green Toggle Switch */}
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            role="switch"
                            aria-checked={item.isAvailable}
                            aria-label={`Toggle availability for ${item.name}`}
                            onClick={() =>
                              void handleToggleItemAvailability(item)
                            }
                            className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-150 cursor-pointer ${
                              item.isAvailable
                                ? 'bg-[#059669]'
                                : 'bg-[#6B7280]/30'
                            }`}
                          >
                            <span
                              className={`inline-block h-4 w-4 transform rounded-full bg-[#FFFFFF] shadow-2xs transition-transform duration-150 ${
                                item.isAvailable
                                  ? 'translate-x-6'
                                  : 'translate-x-1'
                              }`}
                            />
                          </button>
                          <span
                            className={`text-[12px] font-semibold w-16 ${
                              item.isAvailable
                                ? 'text-[#059669]'
                                : 'text-[#6B7280]'
                            }`}
                          >
                            {item.isAvailable ? 'Available' : 'Sold Out'}
                          </span>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleStartEditItem(item)}
                            aria-label={`Edit ${item.name}`}
                            className="rounded-xl p-2 text-[#6B7280] hover:bg-[#1E1B4B]/[0.06] hover:text-[#111827] transition-colors cursor-pointer"
                          >
                            <Edit3 className="h-4 w-4" aria-hidden />
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDeleteItem(item)}
                            aria-label={`Delete ${item.name}`}
                            className="rounded-xl p-2 text-[#6B7280] hover:bg-red-50 hover:text-red-700 transition-colors cursor-pointer"
                          >
                            <Trash2 className="h-4 w-4" aria-hidden />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      )}

      {/* =====================================================================
          3. STAFF & WAITERS ROSTER (NEW)
         ===================================================================== */}
      {currentSection === 'staff' && (
        <RestaurantStaffRosterPanel
          business={business}
          isBusinessLive={isBusinessLive}
          staffMembers={staffMembers}
          staffVerificationCountsToday={
            floorData?.staffVerificationCountsToday ?? {}
          }
          onStaffChanged={setStaffMembers}
          onStatus={notifyStatus}
          onError={setErrorMessage}
        />
      )}

      {/* =====================================================================
          4. MONTHLY STOCK & EXPENSES (NEW)
         ===================================================================== */}
      {currentSection === 'inventory' && (
        <RestaurantMonthlyInventoryPanel
          business={business}
          currencyCode={currencyCode}
          businessMode={businessMode}
          selectedMonthKey={selectedMonthKey}
          entries={inventoryEntries}
          onMonthKeyChange={(nextMonth) =>
            void handleChangeInventoryMonth(nextMonth)
          }
          onEntriesChanged={setInventoryEntries}
          onStatus={notifyStatus}
          onError={setErrorMessage}
        />
      )}

      {/* =====================================================================
          5. TABLES, HOTEL ROOMS & NFC/QR STANDEES (CLEAN & FOCUSED)
         ===================================================================== */}
      {currentSection === 'tables' && (
        <div className="space-y-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 pb-4">
            <div>
              <h1 className="text-[22px] font-bold tracking-tight text-[#111827]">
                Tables, Rooms &amp; QR Standees
              </h1>
              <p className="mt-0.5 text-[13px] text-slate-500">
                Create dining tables or hotel rooms, download printable QR standees, and copy 1-tap NFC links. Configure GST &amp; UPI in Settings.
              </p>
            </div>
            <div className="flex flex-wrap shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setSelectedQrTableId('general');
                  setShowStandeeStudio(true);
                }}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-[12.5px] font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                <QrCode className="h-3.5 w-3.5 text-[#1E1B4B]" aria-hidden />
                Counter Menu QR
              </button>
              <button
                type="button"
                onClick={() => openAddLocationModal('room')}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-[12.5px] font-semibold text-[#1E1B4B] hover:bg-slate-50 cursor-pointer"
              >
                <BedDouble className="h-3.5 w-3.5" aria-hidden />
                + Add Hotel Room
              </button>
              <button
                type="button"
                onClick={() => openAddLocationModal('table')}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#1E1B4B] px-3.5 text-[12.5px] font-semibold text-white hover:bg-[#2E2A6E] cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5 text-[#D2DB76]" aria-hidden />
                Add Table
              </button>
            </div>
          </div>

          {/* Responsive Table & Room Cards Grid */}
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {tables.map((tbl) => {
              const tblUrl = getRestaurantTableQrUrl(
                business.slug,
                tbl.tableKey,
              );
              const isSelected =
                showStandeeStudio && selectedQrTableId === tbl.id;
              const isRoom = tbl.locationType === 'room';
              const nfcCopied = copiedNfcTableId === tbl.id;

              return (
                <div
                  key={tbl.id}
                  className={`bistro-card p-6 flex flex-col justify-between space-y-4 transition-all ${
                    isSelected ? 'ring-2 ring-[#1E1B4B]' : ''
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="inline-flex items-center gap-1 rounded-full bg-[#D2DB76]/55 px-3 py-0.5 text-[12px] font-extrabold text-[#1E1B4B]">
                          {isRoom ? (
                            <BedDouble className="h-3 w-3" aria-hidden />
                          ) : (
                            <UtensilsCrossed className="h-3 w-3" aria-hidden />
                          )}
                          {tbl.tableNumber}
                        </span>
                        <span className="rounded-full bg-[#F8F9FA] border border-[#1E1B4B]/10 px-2 py-0.5 text-[10.5px] font-bold text-[#6B7280]">
                          {tbl.seatCapacity ?? 4} {isRoom ? 'guests' : 'seats'}
                        </span>
                      </div>
                      <p className="mt-1.5 text-[14px] font-semibold text-[#111827]">
                        {tbl.tableLabel ||
                          (isRoom ? 'Guest Suite' : 'Main Dining Room')}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleDeleteTable(tbl)}
                      aria-label={`Delete ${tbl.tableNumber}`}
                      className="rounded-xl p-1.5 text-[#6B7280] hover:bg-red-50 hover:text-red-700 transition-colors cursor-pointer"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden />
                    </button>
                  </div>

                  <div className="flex flex-col items-center justify-center rounded-2xl bg-[#F8F9FA] py-4 px-3 border border-[#1E1B4B]/[0.06]">
                    <TableQrPreviewCanvas url={tblUrl} />
                    <p className="mt-2 font-mono text-[11px] text-[#6B7280] truncate max-w-full">
                      /r/{business.slug}/table/{tbl.tableKey}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="primary"
                        className="flex-1"
                        onClick={() => {
                          setSelectedQrTableId(tbl.id);
                          setShowStandeeStudio(true);
                        }}
                      >
                        <Download className="h-4 w-4" aria-hidden /> QR Standee
                      </Button>
                      <a
                        href={tblUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={`Open ${tbl.tableNumber} Hub`}
                        className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[#1E1B4B]/20 bg-[#FFFFFF] text-[#111827] hover:border-[#1E1B4B] hover:bg-[#F8F9FA]"
                      >
                        <ExternalLink className="h-4 w-4" aria-hidden />
                      </a>
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleCopyTableNfcLink(tbl)}
                      className={`inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-xl border text-[12px] font-extrabold transition-colors cursor-pointer ${
                        nfcCopied
                          ? 'border-emerald-300 bg-emerald-50 text-[#059669]'
                          : 'border-[#1E1B4B]/15 bg-[#F8F9FA] text-[#1E1B4B] hover:bg-white'
                      }`}
                    >
                      {nfcCopied ? (
                        <>
                          <Check className="h-3.5 w-3.5" aria-hidden /> Copied NFC Tag Link!
                        </>
                      ) : (
                        <>
                          <Smartphone className="h-3.5 w-3.5" aria-hidden /> Copy NFC Tag Link
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}

            {/* + Add Table or Hotel Room Card at End of Grid */}
            <div className="flex min-h-[260px] flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#1E1B4B] text-[#D2DB76]">
                <Plus className="h-5 w-5" aria-hidden />
              </span>
              <div>
                <p className="text-[15px] font-bold text-[#111827]">
                  Add Table or Room
                </p>
                <p className="mt-0.5 text-[12.5px] text-slate-500">
                  Generates a dedicated QR &amp; NFC standee link instantly
                </p>
              </div>
              <div className="flex flex-wrap justify-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => openAddLocationModal('table')}
                  className="inline-flex h-8.5 items-center gap-1 rounded-lg bg-[#1E1B4B] px-3 text-[12px] font-semibold text-white hover:bg-[#2E2A6E] cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5 text-[#D2DB76]" aria-hidden />
                  Table
                </button>
                <button
                  type="button"
                  onClick={() => openAddLocationModal('room')}
                  className="inline-flex h-8.5 items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-3 text-[12px] font-semibold text-[#1E1B4B] hover:bg-slate-100 cursor-pointer"
                >
                  <BedDouble className="h-3.5 w-3.5" aria-hidden />
                  Hotel Room
                </button>
              </div>
            </div>
          </div>

          {/* Printable Standee Studio Drawer/Card */}
          {showStandeeStudio && (
            <div className="bistro-card p-6 sm:p-8 space-y-6 animate-fadeSlideUp">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#1E1B4B]/10 pb-4">
                <div>
                  <h3 className="text-[18px] font-bold text-[#111827]">
                    {activeQrTable
                      ? `Printable Standee Studio — ${activeQrTable.tableNumber}`
                      : 'Printable Standee Studio — General Counter Menu'}
                  </h3>
                  <p className="font-mono text-[12px] text-[#1E1B4B] break-all">
                    {activeQrUrl}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => void handleCopyActiveQrUrl()}
                  >
                    {copiedUrl ? (
                      <Check className="h-4 w-4 text-[#059669]" aria-hidden />
                    ) : (
                      <Copy className="h-4 w-4" aria-hidden />
                    )}
                    {copiedUrl ? 'Copied' : 'Copy Link'}
                  </Button>
                  <button
                    type="button"
                    onClick={() => setShowStandeeStudio(false)}
                    className="rounded-xl p-2 text-[#6B7280] hover:bg-[#F8F9FA] cursor-pointer"
                  >
                    <X className="h-5 w-5" aria-hidden />
                  </button>
                </div>
              </div>

              <div className="grid gap-6 lg:grid-cols-12 items-center">
                <div className="lg:col-span-6 flex justify-center rounded-2xl border border-[#1E1B4B]/10 bg-[#F8F9FA] p-5">
                  <div className="w-full max-w-[320px] overflow-hidden rounded-xl bg-[#FFFFFF] shadow-md">
                    <canvas
                      ref={qrCanvasRef}
                      className="h-auto w-full block"
                    />
                  </div>
                </div>

                <div className="lg:col-span-6 space-y-5">
                  <div className="space-y-2">
                    <p className="text-[13px] font-semibold text-[#111827]">
                      Standee Layout Style
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {(
                        [
                          'table_standee',
                          'business_branded',
                          'minimal_google',
                        ] as QRTemplateId[]
                      ).map((tpl) => (
                        <button
                          key={tpl}
                          type="button"
                          onClick={() =>
                            setQrSettings((prev) => ({ ...prev, template: tpl }))
                          }
                          className={`rounded-xl border px-3.5 py-2 text-[13px] font-semibold cursor-pointer ${
                            qrSettings.template === tpl
                              ? 'border-[#1E1B4B] bg-[#1E1B4B] text-[#FFFFFF]'
                              : 'border-[#1E1B4B]/15 bg-[#F8F9FA] text-[#111827]'
                          }`}
                        >
                          {QR_TEMPLATE_DEFAULTS[tpl].name.split('—')[0].trim()}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="text-[13px] font-semibold text-[#111827]">
                      Accent Theme
                    </p>
                    <div className="flex items-center gap-2">
                      {QR_ACCENT_PRESETS.map((preset) => (
                        <button
                          key={preset.id}
                          type="button"
                          title={preset.label}
                          onClick={() =>
                            setQrSettings((prev) => ({
                              ...prev,
                              accentColor: preset.hex,
                            }))
                          }
                          className={`h-7 w-7 rounded-full border-2 cursor-pointer ${
                            qrSettings.accentColor.toLowerCase() ===
                            preset.hex.toLowerCase()
                              ? 'border-[#111827] scale-110'
                              : 'border-white'
                          }`}
                          style={{ backgroundColor: preset.hex }}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2 pt-2">
                    <Button
                      type="button"
                      variant="primary"
                      onClick={handleDownloadTableQrPng}
                    >
                      <Download className="h-4 w-4" aria-hidden /> Download PNG
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={handleDownloadTableQrPdf}
                    >
                      <FileText className="h-4 w-4" aria-hidden /> Printable A5 PDF
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* =====================================================================
          4. GAMES & LOYALTY (3 SIMPLE CARDS + COLLAPSIBLE ADVANCED ACCORDION)
         ===================================================================== */}
      {currentSection === 'games_loyalty' && (
        <div className="space-y-6">
          <div>
            <h1 className="text-[28px] sm:text-[32px] font-extrabold tracking-tight text-[#111827]">
              Games &amp; Loyalty
            </h1>
            <p className="mt-1 text-[14px] text-[#6B7280]">
              Entertain diners at the table with quick games, convert Game Points into Loyalty Stars, and reward repeat visits.
            </p>
          </div>

          {/* CARD 1: GAME REWARDS */}
          <div className="bistro-card p-6 sm:p-8 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-[19px] font-bold text-[#111827] flex items-center gap-2.5">
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#1E1B4B] text-[#D2DB76]">
                    <Gamepad2 className="h-4 w-4" aria-hidden />
                  </span>
                  1. Table Game Rewards
                </h2>
                <p className="mt-1 text-[13px] text-[#6B7280]">
                  Toggle which games appear on your table QR hub and set how many Game Points a diner wins per game.
                </p>
              </div>
            </div>

            <div className="divide-y divide-[#1E1B4B]/10 rounded-2xl border border-[#1E1B4B]/10 bg-[#FFFFFF]">
              {gameConfigs.map((cfg) => {
                const meta = DEFAULT_GAME_CATALOG.find(
                  (m) => m.gameSlug === cfg.gameSlug,
                );
                const isSaving = savingGameSlug === cfg.gameSlug;
                return (
                  <div
                    key={cfg.gameSlug}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5"
                  >
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[16px] font-bold text-[#111827]">
                          {cfg.title}
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-full bg-[#F8F9FA] border border-[#1E1B4B]/10 px-2.5 py-0.5 text-[11px] font-semibold text-[#1E1B4B]">
                          {cfg.category === 'same_table' ? (
                            <>
                              <Users className="h-3 w-3" aria-hidden /> Table Group
                            </>
                          ) : (
                            <>
                              <User className="h-3 w-3" aria-hidden /> Solo Diner
                            </>
                          )}
                        </span>
                      </div>
                      <p className="text-[13px] text-[#6B7280]">
                        {meta?.description}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-4 shrink-0">
                      {/* Points per win stepper */}
                      <div className="flex items-center gap-1.5 rounded-xl border border-[#1E1B4B]/15 bg-[#F8F9FA] p-1">
                        <button
                          type="button"
                          aria-label={`Decrease points for ${cfg.title}`}
                          disabled={isSaving}
                          onClick={() => {
                            const nextPts = Math.max(0, cfg.pointsPerWin - 5);
                            const next = { ...cfg, pointsPerWin: nextPts };
                            updateLocalGameConfig(cfg.gameSlug, {
                              pointsPerWin: nextPts,
                            });
                            void handleSaveGameConfig(next);
                          }}
                          className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#FFFFFF] text-[#111827] shadow-2xs hover:bg-[#1E1B4B] hover:text-[#FFFFFF] transition-colors cursor-pointer"
                        >
                          <Minus className="h-3.5 w-3.5" aria-hidden />
                        </button>
                        <span className="px-2.5 text-[13px] font-bold text-[#111827] tabular-nums">
                          {cfg.pointsPerWin} pts / win
                        </span>
                        <button
                          type="button"
                          aria-label={`Increase points for ${cfg.title}`}
                          disabled={isSaving}
                          onClick={() => {
                            const nextPts = Math.min(1000, cfg.pointsPerWin + 5);
                            const next = { ...cfg, pointsPerWin: nextPts };
                            updateLocalGameConfig(cfg.gameSlug, {
                              pointsPerWin: nextPts,
                            });
                            void handleSaveGameConfig(next);
                          }}
                          className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#FFFFFF] text-[#111827] shadow-2xs hover:bg-[#1E1B4B] hover:text-[#FFFFFF] transition-colors cursor-pointer"
                        >
                          <Plus className="h-3.5 w-3.5" aria-hidden />
                        </button>
                      </div>

                      {/* Game Enabled Switch */}
                      <button
                        type="button"
                        role="switch"
                        aria-checked={cfg.isEnabled}
                        aria-label={`Toggle ${cfg.title}`}
                        disabled={isSaving}
                        onClick={() => {
                          const next = { ...cfg, isEnabled: !cfg.isEnabled };
                          updateLocalGameConfig(cfg.gameSlug, {
                            isEnabled: next.isEnabled,
                          });
                          void handleSaveGameConfig(next);
                        }}
                        className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors duration-150 cursor-pointer ${
                          cfg.isEnabled ? 'bg-[#059669]' : 'bg-[#6B7280]/30'
                        }`}
                      >
                        <span
                          className={`inline-block h-5 w-5 transform rounded-full bg-[#FFFFFF] shadow-2xs transition-transform duration-150 ${
                            cfg.isEnabled ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* CARD 2: STAR CONVERSION RULE (PLAIN-ENGLISH SENTENCE BUILDER) */}
          <form
            onSubmit={(e) => void handleSaveLoyaltyRules(e)}
            className="bistro-card p-6 sm:p-8 space-y-5"
          >
            <div>
              <h2 className="text-[19px] font-bold text-[#111827] flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#1E1B4B] text-[#D2DB76]">
                  <Award className="h-4 w-4" aria-hidden />
                </span>
                2. Star Conversion Rule
              </h2>
              <p className="mt-1 text-[13px] text-[#6B7280]">
                Game Points and Loyalty Stars live in separate ledgers. Set how points and verified visits convert into Stars.
              </p>
            </div>

            <div className="space-y-3">
              {/* Sentence 1 */}
              <div className="flex flex-wrap items-center gap-2.5 rounded-2xl border border-[#1E1B4B]/10 bg-[#F8F9FA] p-4 text-[14px] sm:text-[15px] font-medium text-[#111827]">
                <span>Every</span>
                <input
                  type="number"
                  min={1}
                  max={100000}
                  aria-label="Game points per star"
                  value={pointsPerStarExchange}
                  onChange={(e) =>
                    setPointsPerStarExchange(
                      Math.max(1, Number.parseInt(e.target.value || '100', 10)),
                    )
                  }
                  className="h-10 w-24 rounded-xl border border-[#1E1B4B]/25 bg-[#FFFFFF] px-3 text-center font-extrabold text-[#1E1B4B] tabular-nums focus:border-[#1E1B4B] focus:outline-none"
                />
                <span>Game Points =</span>
                <span className="rounded-full bg-[#D2DB76]/60 px-3 py-1 text-[13px] font-extrabold text-[#1E1B4B]">
                  ★ 1 Loyalty Star
                </span>
                <span className="text-[#6B7280]">(Max</span>
                <input
                  type="number"
                  min={0}
                  max={100}
                  aria-label="Max stars per week via exchange"
                  value={maxStarsViaExchangePerWeek}
                  onChange={(e) =>
                    setMaxStarsViaExchangePerWeek(
                      Math.max(0, Number.parseInt(e.target.value || '0', 10)),
                    )
                  }
                  className="h-10 w-16 rounded-xl border border-[#1E1B4B]/25 bg-[#FFFFFF] px-2.5 text-center font-extrabold text-[#1E1B4B] tabular-nums focus:border-[#1E1B4B] focus:outline-none"
                />
                <span className="text-[#6B7280]">stars/week)</span>
              </div>

              {/* Sentence 2 */}
              <div className="flex flex-wrap items-center gap-2.5 rounded-2xl border border-[#1E1B4B]/10 bg-[#F8F9FA] p-4 text-[14px] sm:text-[15px] font-medium text-[#111827]">
                <span>Every Staff-Verified Dining Visit =</span>
                <input
                  type="number"
                  min={1}
                  max={50}
                  aria-label="Stars per verified visit"
                  value={starsPerVerifiedVisit}
                  onChange={(e) =>
                    setStarsPerVerifiedVisit(
                      Math.max(1, Number.parseInt(e.target.value || '1', 10)),
                    )
                  }
                  className="h-10 w-16 rounded-xl border border-[#1E1B4B]/25 bg-[#FFFFFF] px-2.5 text-center font-extrabold text-[#1E1B4B] tabular-nums focus:border-[#1E1B4B] focus:outline-none"
                />
                <span className="rounded-full bg-[#D2DB76]/60 px-3 py-1 text-[13px] font-extrabold text-[#1E1B4B]">
                  ★ Loyalty {starsPerVerifiedVisit === 1 ? 'Star' : 'Stars'}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <label className="inline-flex items-center gap-2.5 text-[13px] font-semibold text-[#111827] cursor-pointer">
                <input
                  type="checkbox"
                  checked={allowPointExchange}
                  onChange={(e) => setAllowPointExchange(e.target.checked)}
                  className="h-4 w-4 accent-[#1E1B4B]"
                />
                Allow guests to convert Game Points into Loyalty Stars
              </label>
              <Button type="submit" variant="primary" loading={savingRules}>
                Save Conversion Rules
              </Button>
            </div>
          </form>

          {/* CARD 3: REWARD CATALOGUE */}
          <div className="bistro-card p-6 sm:p-8 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-[19px] font-bold text-[#111827] flex items-center gap-2.5">
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#1E1B4B] text-[#D2DB76]">
                    <Gift className="h-4 w-4" aria-hidden />
                  </span>
                  3. Reward Catalogue
                </h2>
                <p className="mt-1 text-[13px] text-[#6B7280]">
                  Perks guests can unlock with their Loyalty Stars. Claiming generates a 6-character ticket verified by your staff.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {rewards.length === 0 && (
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => void handleSeedStarterRewards()}
                  >
                    <Sparkles className="h-4 w-4" aria-hidden /> Load Starter Perks
                  </Button>
                )}
                <Button
                  type="button"
                  variant="primary"
                  onClick={() => {
                    setEditingRewardId(null);
                    setRewardTitle('');
                    setRewardDescription('');
                    setRewardStarsRequired(3);
                    setRewardIsActive(true);
                    setShowRewardForm((v) => !v);
                  }}
                >
                  <Plus className="h-4 w-4" aria-hidden /> Add Reward
                </Button>
              </div>
            </div>

            {showRewardForm && (
              <form
                onSubmit={(e) => void handleSaveReward(e)}
                className="rounded-2xl border border-[#1E1B4B]/15 bg-[#F8F9FA] p-5 space-y-4 animate-fadeSlideUp"
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-[16px] font-bold text-[#111827]">
                    {editingRewardId ? 'Edit Reward' : 'New Loyalty Reward'}
                  </h3>
                  <button
                    type="button"
                    onClick={() => setShowRewardForm(false)}
                    className="rounded-lg p-1 text-[#6B7280] hover:bg-[#FFFFFF] cursor-pointer"
                  >
                    <X className="h-4 w-4" aria-hidden />
                  </button>
                </div>
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="sm:col-span-2 space-y-1.5">
                    <label
                      htmlFor="rwdTitleInput"
                      className="block text-[13px] font-semibold text-[#111827]"
                    >
                      Reward Title
                    </label>
                    <input
                      id="rwdTitleInput"
                      type="text"
                      required
                      maxLength={100}
                      placeholder="e.g. Complimentary Filter Coffee"
                      value={rewardTitle}
                      onChange={(e) => setRewardTitle(e.target.value)}
                      className="block h-11 w-full rounded-xl border border-[#1E1B4B]/20 bg-[#FFFFFF] px-3.5 text-[14px] text-[#111827]"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label
                      htmlFor="rwdStarsInput"
                      className="block text-[13px] font-semibold text-[#111827]"
                    >
                      Stars Required
                    </label>
                    <input
                      id="rwdStarsInput"
                      type="number"
                      required
                      min={1}
                      max={1000}
                      value={rewardStarsRequired}
                      onChange={(e) =>
                        setRewardStarsRequired(
                          Math.max(1, Number.parseInt(e.target.value || '1', 10)),
                        )
                      }
                      className="block h-11 w-full rounded-xl border border-[#1E1B4B]/20 bg-[#FFFFFF] px-3.5 text-[14px] text-[#111827] tabular-nums"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label
                    htmlFor="rwdDescInput"
                    className="block text-[13px] font-semibold text-[#111827]"
                  >
                    Description / Note (Optional)
                  </label>
                  <input
                    id="rwdDescInput"
                    type="text"
                    maxLength={260}
                    placeholder="e.g. Show your 6-digit claim ticket to your server"
                    value={rewardDescription}
                    onChange={(e) => setRewardDescription(e.target.value)}
                    className="block h-11 w-full rounded-xl border border-[#1E1B4B]/20 bg-[#FFFFFF] px-3.5 text-[14px] text-[#111827]"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setShowRewardForm(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" variant="primary">
                    {editingRewardId ? 'Update Reward' : 'Save Reward'}
                  </Button>
                </div>
              </form>
            )}

            {rewards.length === 0 ? (
              <div className="rounded-2xl border border-[#1E1B4B]/10 bg-[#F8F9FA] p-8 text-center space-y-2">
                <p className="text-[15px] font-bold text-[#111827]">
                  No rewards in your catalogue yet
                </p>
                <p className="text-[13px] text-[#6B7280]">
                  Click <strong>Load Starter Perks</strong> or <strong>+ Add Reward</strong> above to add dining rewards.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-[#1E1B4B]/10 rounded-2xl border border-[#1E1B4B]/10 bg-[#FFFFFF]">
                {rewards.map((rwd) => (
                  <div
                    key={rwd.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 sm:px-5"
                  >
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <span className="rounded-full bg-[#D2DB76]/60 px-3 py-0.5 text-[12px] font-extrabold text-[#1E1B4B] tabular-nums">
                          ★ {rwd.starsRequired}{' '}
                          {rwd.starsRequired === 1 ? 'Star' : 'Stars'}
                        </span>
                        <span className="text-[15px] font-bold text-[#111827]">
                          {rwd.title}
                        </span>
                        <span className="text-[12px] text-[#6B7280] tabular-nums">
                          • Claimed {rwd.redemptionsCount}×
                        </span>
                      </div>
                      {rwd.description && (
                        <p className="text-[13px] text-[#6B7280]">
                          {rwd.description}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <button
                        type="button"
                        role="switch"
                        aria-checked={rwd.isActive}
                        aria-label={`Toggle ${rwd.title}`}
                        onClick={() => void handleToggleRewardActive(rwd)}
                        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-150 cursor-pointer ${
                          rwd.isActive ? 'bg-[#059669]' : 'bg-[#6B7280]/30'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-[#FFFFFF] shadow-2xs transition-transform duration-150 ${
                            rwd.isActive ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleStartEditReward(rwd)}
                        aria-label={`Edit ${rwd.title}`}
                        className="rounded-xl p-2 text-[#6B7280] hover:bg-[#F8F9FA] hover:text-[#111827] cursor-pointer"
                      >
                        <Edit3 className="h-4 w-4" aria-hidden />
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDeleteReward(rwd)}
                        aria-label={`Delete ${rwd.title}`}
                        className="rounded-xl p-2 text-[#6B7280] hover:bg-red-50 hover:text-red-700 cursor-pointer"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* COLLAPSIBLE ACCORDION: ADVANCED RULES, STAFF PIN & SUGGESTION BOX */}
          <div className="bistro-card overflow-hidden">
            <button
              type="button"
              onClick={() => setAdvancedOpen((v) => !v)}
              aria-expanded={advancedOpen}
              className="flex w-full items-center justify-between gap-4 p-6 text-left hover:bg-[#F8F9FA]/70 transition-colors cursor-pointer"
            >
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2.5">
                  <span className="text-[17px] font-bold text-[#111827]">
                    Advanced Rules, Staff PIN &amp; Suggestion Box
                  </span>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                      profile?.staffPinHash
                        ? 'bg-emerald-50 text-[#059669] border border-emerald-200'
                        : 'bg-amber-50 text-[#D97706] border border-amber-200'
                    }`}
                  >
                    {profile?.staffPinHash ? 'Staff PIN Active ✓' : 'Set Staff PIN'}
                  </span>
                  {unreadSuggestions > 0 && (
                    <span className="rounded-full bg-[#1E1B4B] px-2.5 py-0.5 text-[11px] font-bold text-[#FFFFFF]">
                      {unreadSuggestions} New Suggestions
                    </span>
                  )}
                </div>
                <p className="text-[13px] text-[#6B7280]">
                  Configure 4–6 digit Waiter PIN, Guest Wi-Fi password, custom Chef&apos;s Trivia questions, and private guest suggestions.
                </p>
              </div>
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#F8F9FA] text-[#1E1B4B]">
                {advancedOpen ? (
                  <ChevronUp className="h-5 w-5" aria-hidden />
                ) : (
                  <ChevronDown className="h-5 w-5" aria-hidden />
                )}
              </span>
            </button>

            {advancedOpen && (
              <div className="divide-y divide-[#1E1B4B]/10 border-t border-[#1E1B4B]/10 p-6 sm:p-8 space-y-8 animate-fadeSlideUp">
                {/* 1. Waiter Staff PIN & Visit Cooldown */}
                <form
                  onSubmit={(e) => void handleSaveStaffPinAndCooldown(e)}
                  className="space-y-4"
                >
                  <h3 className="text-[16px] font-bold text-[#111827] flex items-center gap-2">
                    <KeyRound className="h-4 w-4 text-[#1E1B4B]" aria-hidden />
                    Waiter Staff Floor PIN &amp; Visit Cooldown
                  </h3>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <label
                        htmlFor="advStaffPin"
                        className="block text-[13px] font-semibold text-[#111827]"
                      >
                        {profile?.staffPinHash
                          ? 'Update 4–6 Digit Staff PIN (Leave blank to keep current)'
                          : 'Set 4–6 Digit Staff PIN (for /r/' +
                            business.slug +
                            '/staff)'}
                      </label>
                      <input
                        id="advStaffPin"
                        type="password"
                        inputMode="numeric"
                        maxLength={6}
                        placeholder="e.g. 2468"
                        value={newPin}
                        onChange={(e) => setNewPin(e.target.value)}
                        className="block h-11 w-full rounded-xl border border-[#1E1B4B]/20 bg-[#FFFFFF] px-3.5 text-[14px] text-[#111827]"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label
                        htmlFor="advVisitCooldown"
                        className="block text-[13px] font-semibold text-[#111827]"
                      >
                        Min Hours Between Visit Stars (Same Diner)
                      </label>
                      <input
                        id="advVisitCooldown"
                        type="number"
                        min={0}
                        max={168}
                        value={minHoursCooldown}
                        onChange={(e) =>
                          setMinHoursCooldown(
                            Math.max(
                              0,
                              Number.parseInt(e.target.value || '0', 10),
                            ),
                          )
                        }
                        className="block h-11 w-full rounded-xl border border-[#1E1B4B]/20 bg-[#FFFFFF] px-3.5 text-[14px] text-[#111827] tabular-nums"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <Button
                      type="submit"
                      variant="secondary"
                      loading={savingSecurity}
                    >
                      Save Staff PIN &amp; Cooldown
                    </Button>
                  </div>
                </form>

                {/* 2. Guest Wi-Fi & Suggestion Box Toggle */}
                <form
                  onSubmit={(e) => void handleSaveLoyaltyRules(e)}
                  className="pt-6 space-y-4"
                >
                  <h3 className="text-[16px] font-bold text-[#111827] flex items-center gap-2">
                    <Wifi className="h-4 w-4 text-[#1E1B4B]" aria-hidden />
                    Table Guest Wi-Fi &amp; Suggestion Box Settings
                  </h3>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <label
                        htmlFor="advWifiSsid"
                        className="block text-[13px] font-semibold text-[#111827]"
                      >
                        Wi-Fi Network Name (SSID)
                      </label>
                      <input
                        id="advWifiSsid"
                        type="text"
                        maxLength={80}
                        placeholder="e.g. UrbanKitchen_Guest"
                        value={wifiNetworkName}
                        onChange={(e) => setWifiNetworkName(e.target.value)}
                        className="block h-11 w-full rounded-xl border border-[#1E1B4B]/20 bg-[#FFFFFF] px-3.5 text-[14px] text-[#111827]"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label
                        htmlFor="advWifiPass"
                        className="block text-[13px] font-semibold text-[#111827]"
                      >
                        Wi-Fi Password
                      </label>
                      <input
                        id="advWifiPass"
                        type="text"
                        maxLength={120}
                        placeholder="e.g. dinewithus2026"
                        value={wifiPassword}
                        onChange={(e) => setWifiPassword(e.target.value)}
                        className="block h-11 w-full rounded-xl border border-[#1E1B4B]/20 bg-[#FFFFFF] px-3.5 text-[14px] text-[#111827]"
                      />
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <label className="inline-flex items-center gap-2 text-[13px] font-semibold text-[#111827] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={suggestionBoxEnabled}
                        onChange={(e) =>
                          setSuggestionBoxEnabled(e.target.checked)
                        }
                        className="h-4 w-4 accent-[#1E1B4B]"
                      />
                      Enable Private Suggestion Box on Customer Table Hub
                    </label>
                    <Button
                      type="submit"
                      variant="secondary"
                      loading={savingRules}
                    >
                      Save Wi-Fi &amp; Extras
                    </Button>
                  </div>
                </form>

                {/* 3. Custom Restaurant Trivia Builder */}
                {triviaConfig && (
                  <div className="pt-6 space-y-4">
                    <h3 className="text-[16px] font-bold text-[#111827] flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-[#1E1B4B]" aria-hidden />
                      Custom Chef&apos;s Table Trivia Questions (
                      {activeTriviaQuestions.length})
                    </h3>
                    <form
                      onSubmit={(e) => void handleAddCustomTriviaQuestion(e)}
                      className="rounded-2xl border border-[#1E1B4B]/10 bg-[#F8F9FA] p-4 space-y-3"
                    >
                      <input
                        type="text"
                        required
                        minLength={5}
                        maxLength={220}
                        placeholder="Question prompt (e.g. What is our secret spice in the Dum Biryani?)"
                        value={newQuestionPrompt}
                        onChange={(e) => setNewQuestionPrompt(e.target.value)}
                        className="block h-11 w-full rounded-xl border border-[#1E1B4B]/20 bg-[#FFFFFF] px-3.5 text-[14px] text-[#111827]"
                      />
                      <div className="grid gap-2.5 sm:grid-cols-2">
                        <input
                          type="text"
                          required
                          maxLength={80}
                          placeholder="Option 1"
                          value={newOptionA}
                          onChange={(e) => setNewOptionA(e.target.value)}
                          className="block h-10 w-full rounded-xl border border-[#1E1B4B]/20 bg-[#FFFFFF] px-3 text-[13px]"
                        />
                        <input
                          type="text"
                          required
                          maxLength={80}
                          placeholder="Option 2"
                          value={newOptionB}
                          onChange={(e) => setNewOptionB(e.target.value)}
                          className="block h-10 w-full rounded-xl border border-[#1E1B4B]/20 bg-[#FFFFFF] px-3 text-[13px]"
                        />
                        <input
                          type="text"
                          maxLength={80}
                          placeholder="Option 3 (Optional)"
                          value={newOptionC}
                          onChange={(e) => setNewOptionC(e.target.value)}
                          className="block h-10 w-full rounded-xl border border-[#1E1B4B]/20 bg-[#FFFFFF] px-3 text-[13px]"
                        />
                        <input
                          type="text"
                          maxLength={80}
                          placeholder="Option 4 (Optional)"
                          value={newOptionD}
                          onChange={(e) => setNewOptionD(e.target.value)}
                          className="block h-10 w-full rounded-xl border border-[#1E1B4B]/20 bg-[#FFFFFF] px-3 text-[13px]"
                        />
                      </div>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2 text-[13px] font-semibold">
                          <span>Correct Answer:</span>
                          <select
                            value={newCorrectIndex}
                            onChange={(e) =>
                              setNewCorrectIndex(
                                Number.parseInt(e.target.value, 10),
                              )
                            }
                            className="rounded-xl border border-[#1E1B4B]/20 bg-[#FFFFFF] px-3 py-1.5 text-[13px]"
                          >
                            <option value={0}>Option 1</option>
                            <option value={1}>Option 2</option>
                            <option value={2}>Option 3</option>
                            <option value={3}>Option 4</option>
                          </select>
                        </div>
                        <Button type="submit" variant="secondary">
                          <Plus className="h-4 w-4" aria-hidden /> Add Question
                        </Button>
                      </div>
                    </form>

                    <div className="space-y-2">
                      {activeTriviaQuestions.map((q, idx) => (
                        <div
                          key={`${q.prompt}-${idx}`}
                          className="flex items-start justify-between gap-3 rounded-xl border border-[#1E1B4B]/10 bg-[#FFFFFF] p-3.5"
                        >
                          <div className="space-y-1">
                            <p className="text-[13px] font-bold text-[#111827]">
                              Q{idx + 1}. {q.prompt}
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                              {q.options.map((opt, optIdx) => (
                                <span
                                  key={`${opt}-${optIdx}`}
                                  className={`rounded-lg px-2 py-0.5 text-[11px] font-semibold ${
                                    optIdx === q.correctIndex
                                      ? 'bg-emerald-50 text-[#059669] border border-emerald-200'
                                      : 'bg-[#F8F9FA] text-[#6B7280]'
                                  }`}
                                >
                                  {opt} {optIdx === q.correctIndex ? '✓' : ''}
                                </span>
                              ))}
                            </div>
                          </div>
                          {activeTriviaQuestions.length > 1 && (
                            <button
                              type="button"
                              onClick={() => void handleRemoveTriviaQuestion(idx)}
                              className="rounded-lg p-1.5 text-[#6B7280] hover:bg-red-50 hover:text-red-700 cursor-pointer"
                            >
                              <Trash2 className="h-4 w-4" aria-hidden />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 4. Private Suggestion Box Inbox */}
                <div className="pt-6 space-y-3">
                  <h3 className="text-[16px] font-bold text-[#111827] flex items-center gap-2">
                    <Inbox className="h-4 w-4 text-[#1E1B4B]" aria-hidden />
                    Private Table Suggestion Box ({suggestions.length})
                  </h3>
                  {suggestions.length === 0 ? (
                    <p className="text-[13px] text-[#6B7280]">
                      No private guest suggestions received yet.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {suggestions.map((sug) => (
                        <div
                          key={sug.id}
                          className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border p-4 ${
                            sug.isRead
                              ? 'border-[#1E1B4B]/10 bg-[#FFFFFF]'
                              : 'border-[#D2DB76] bg-[#D2DB76]/15'
                          }`}
                        >
                          <div className="space-y-1">
                            <p className="text-[12px] font-semibold text-[#6B7280]">
                              <strong className="text-[#111827]">
                                {sug.customerName || 'Table Guest'}
                              </strong>{' '}
                              • {new Date(sug.createdAt).toLocaleString()}
                            </p>
                            <p className="text-[14px] text-[#111827]">
                              {sug.message}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => void handleMarkSuggestionRead(sug)}
                            className="rounded-xl border border-[#1E1B4B]/15 bg-[#FFFFFF] px-3 py-1.5 text-[12px] font-semibold text-[#111827] hover:bg-[#F8F9FA] shrink-0 cursor-pointer"
                          >
                            {sug.isRead ? 'Mark Unread' : 'Mark Read ✓'}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      {/* =====================================================================
          7. UNIFIED APP SETTINGS & MODULE VISIBILITY SWITCHES
         ===================================================================== */}
      {currentSection === 'settings' && (
        <div className="space-y-5 max-w-5xl">
          <div className="border-b border-slate-200 pb-4">
            <h1 className="text-[22px] font-bold tracking-tight text-[#111827]">
              App Settings &amp; Features
            </h1>
            <p className="mt-0.5 text-[13px] text-slate-500">
              Turn ON only the features your team uses. Everything turned OFF stays cleanly hidden so your screens stay simple and clutter-free.
            </p>
          </div>

          {/* CARD 1: MASTER FEATURE SWITCHES (ON / OFF) */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
            <div>
              <h2 className="text-[15px] font-bold text-[#111827] flex items-center gap-2">
                <Sliders className="h-4 w-4 text-[#1E1B4B]" aria-hidden />
                Modules &amp; Live Operations Switches
              </h2>
              <p className="mt-0.5 text-[12px] text-slate-500">
                Toggle what appears in your sidebar and on guest devices. Changes take effect immediately.
              </p>
            </div>

            <div className="grid gap-2.5 sm:grid-cols-2">
              {/* Public Guest Experience Live */}
              <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3.5 py-3">
                <div>
                  <p className="text-[13px] font-semibold text-[#111827]">
                    Guest Hub Live
                  </p>
                  <p className="text-[11.5px] text-slate-500">
                    Show public QR menu &amp; table hub to guests
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={isEnabled}
                  disabled={savingProfile}
                  onClick={() => {
                    const next = !isEnabled;
                    setIsEnabled(next);
                    void handleSaveProfile({
                      isEnabled: next,
                      statusMessage: next
                        ? 'Guest Hub is now LIVE.'
                        : 'Guest Hub paused.',
                    });
                  }}
                  className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors cursor-pointer ${
                    isEnabled ? 'bg-emerald-600' : 'bg-slate-300'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      isEnabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {/* Customer QR Self-Ordering */}
              <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3.5 py-3">
                <div>
                  <p className="text-[13px] font-semibold text-[#111827]">
                    Customer QR Self-Ordering
                  </p>
                  <p className="text-[11.5px] text-slate-500">
                    Let guests place orders from their phone (vs view-only menu)
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={acceptingOrders && tableOrderingEnabled}
                  disabled={savingProfile}
                  onClick={() => {
                    const next = !(acceptingOrders && tableOrderingEnabled);
                    setAcceptingOrders(next);
                    setTableOrderingEnabled(next);
                    void handleSaveProfile({
                      acceptingOrders: next,
                      tableOrderingEnabled: next,
                      statusMessage: next
                        ? 'Customer QR Ordering turned ON.'
                        : 'Customer QR Ordering paused (view-only menu).',
                    });
                  }}
                  className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors cursor-pointer ${
                    acceptingOrders && tableOrderingEnabled
                      ? 'bg-emerald-600'
                      : 'bg-slate-300'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      acceptingOrders && tableOrderingEnabled
                        ? 'translate-x-6'
                        : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {/* Hotel Rooms Mode */}
              <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3.5 py-3">
                <div>
                  <p className="text-[13px] font-semibold text-[#111827]">
                    Hotel Rooms Mode
                  </p>
                  <p className="text-[11.5px] text-slate-500">
                    Enable room service QR cards &amp; room-only menu dishes
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={hotelRoomsEnabled}
                  disabled={savingProfile}
                  onClick={() => {
                    const next = !hotelRoomsEnabled;
                    setHotelRoomsEnabled(next);
                    void handleSaveProfile({
                      hotelRoomsEnabled: next,
                      statusMessage: next
                        ? 'Hotel Rooms Mode turned ON.'
                        : 'Hotel Rooms Mode turned OFF.',
                    });
                  }}
                  className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors cursor-pointer ${
                    hotelRoomsEnabled ? 'bg-emerald-600' : 'bg-slate-300'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      hotelRoomsEnabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {/* Spoken Voice Alerts */}
              <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3.5 py-3">
                <div>
                  <p className="text-[13px] font-semibold text-[#111827] flex items-center gap-1.5">
                    {voiceAlertsEnabled ? (
                      <Volume2 className="h-3.5 w-3.5 text-emerald-600" aria-hidden />
                    ) : (
                      <VolumeX className="h-3.5 w-3.5 text-slate-400" aria-hidden />
                    )}
                    Spoken Voice Alerts
                  </p>
                  <p className="text-[11.5px] text-slate-500">
                    Speak incoming table calls and new orders aloud
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={voiceAlertsEnabled}
                  disabled={savingProfile}
                  onClick={() => {
                    const next = !voiceAlertsEnabled;
                    setVoiceAlertsEnabled(next);
                    if (next) {
                      speakHospitalityAlert('Voice alerts enabled', true);
                    }
                    void handleSaveProfile({
                      voiceAlertsEnabled: next,
                      statusMessage: next
                        ? 'Spoken Voice Alerts turned ON.'
                        : 'Spoken Voice Alerts muted.',
                    });
                  }}
                  className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors cursor-pointer ${
                    voiceAlertsEnabled ? 'bg-emerald-600' : 'bg-slate-300'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      voiceAlertsEnabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {/* Sidebar Visibility Switches */}
              {(
                [
                  {
                    key: 'aiReviews',
                    title: 'AI Google Reviews',
                    desc: 'Show AI Reviews & Google Review QR tab in sidebar',
                  },
                  {
                    key: 'staff',
                    title: 'Staff & Waiters Roster',
                    desc: 'Show Staff & Waiter PIN management tab in sidebar',
                  },
                  {
                    key: 'inventory',
                    title: 'Stock & Monthly Expenses',
                    desc: 'Show Monthly Stock & Expenses tracker tab in sidebar',
                  },
                  {
                    key: 'gamesLoyalty',
                    title: 'Table Games & Loyalty Stars',
                    desc: 'Show Games, Loyalty Stars & Rewards tab in sidebar',
                  },
                ] as const
              ).map((mod) => {
                const enabled = moduleVisibility[mod.key];
                return (
                  <div
                    key={mod.key}
                    className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3.5 py-3"
                  >
                    <div>
                      <p className="text-[13px] font-semibold text-[#111827]">
                        {mod.title}
                      </p>
                      <p className="text-[11.5px] text-slate-500">{mod.desc}</p>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={enabled}
                      onClick={() => {
                        const next: WorkspaceModuleVisibility = {
                          ...moduleVisibility,
                          [mod.key]: !enabled,
                        };
                        onModuleVisibilityChange?.(next);
                        notifyStatus(
                          `${mod.title} ${!enabled ? 'shown' : 'hidden'} in sidebar ✓`,
                        );
                      }}
                      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors cursor-pointer ${
                        enabled ? 'bg-[#1E1B4B]' : 'bg-slate-300'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          enabled ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* CARD 2: BILLING, GST & DYNAMIC UPI QR */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
            <div>
              <h2 className="text-[15px] font-bold text-[#111827] flex items-center gap-2">
                <Receipt className="h-4 w-4 text-[#1E1B4B]" aria-hidden />
                Billing, GST &amp; Merchant UPI QR
              </h2>
              <p className="mt-0.5 text-[12px] text-slate-500">
                Defaults to Simple Total (0% Tax). Enter GST % to auto-split CGST + SGST on bills &amp; receipts, or add your UPI ID for customer pay-at-table QR codes.
              </p>
            </div>

            <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-5 items-end">
              <div className="space-y-1">
                <label
                  htmlFor="hospUpiId"
                  className="block text-[12px] font-semibold text-[#111827]"
                >
                  Merchant UPI ID (QR)
                </label>
                <input
                  id="hospUpiId"
                  type="text"
                  maxLength={100}
                  placeholder="e.g. bistro@okicici"
                  value={upiId}
                  onChange={(e) => setUpiId(e.target.value)}
                  className="h-9.5 w-full rounded-lg border border-slate-200 bg-white px-3 text-[13px] font-medium text-[#111827] focus:border-[#1E1B4B] focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label
                  htmlFor="hospUpiPayee"
                  className="block text-[12px] font-semibold text-[#111827]"
                >
                  UPI Payee Name
                </label>
                <input
                  id="hospUpiPayee"
                  type="text"
                  maxLength={100}
                  placeholder={business.name}
                  value={upiPayeeName}
                  onChange={(e) => setUpiPayeeName(e.target.value)}
                  className="h-9.5 w-full rounded-lg border border-slate-200 bg-white px-3 text-[13px] font-medium text-[#111827] focus:border-[#1E1B4B] focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label
                  htmlFor="hospGstin"
                  className="block text-[12px] font-semibold text-[#111827]"
                >
                  GSTIN (Optional)
                </label>
                <input
                  id="hospGstin"
                  type="text"
                  maxLength={24}
                  placeholder="22AAAAA0000A1Z5"
                  value={gstin}
                  onChange={(e) => setGstin(e.target.value.toUpperCase())}
                  className="h-9.5 w-full rounded-lg border border-slate-200 bg-white px-3 font-mono text-[13px] font-medium text-[#111827] focus:border-[#1E1B4B] focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label
                  htmlFor="hospGstPercent"
                  className="block text-[12px] font-semibold text-[#111827]"
                >
                  GST % (CGST+SGST)
                </label>
                <input
                  id="hospGstPercent"
                  type="number"
                  min={0}
                  max={28}
                  step="0.5"
                  value={gstPercent}
                  onChange={(e) =>
                    setGstPercent(
                      Math.max(
                        0,
                        Math.min(28, Number.parseFloat(e.target.value) || 0),
                      ),
                    )
                  }
                  className="h-9.5 w-full rounded-lg border border-slate-200 bg-white px-3 text-[13px] font-semibold tabular-nums text-[#111827] focus:border-[#1E1B4B] focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label
                  htmlFor="hospServicePercent"
                  className="block text-[12px] font-semibold text-[#111827]"
                >
                  Service Charge %
                </label>
                <input
                  id="hospServicePercent"
                  type="number"
                  min={0}
                  max={25}
                  step="0.5"
                  value={serviceChargePercent}
                  onChange={(e) =>
                    setServiceChargePercent(
                      Math.max(
                        0,
                        Math.min(25, Number.parseFloat(e.target.value) || 0),
                      ),
                    )
                  }
                  className="h-9.5 w-full rounded-lg border border-slate-200 bg-white px-3 text-[13px] font-semibold tabular-nums text-[#111827] focus:border-[#1E1B4B] focus:outline-none"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <p className="text-[12px] font-medium text-slate-500">
                {gstPercent > 0
                  ? `Tax Split: CGST ${(gstPercent / 2).toFixed(2)}% + SGST ${(gstPercent / 2).toFixed(2)}%${serviceChargePercent > 0 ? ` + Service ${serviceChargePercent}%` : ''}`
                  : 'Simple Total Mode (0% Tax)'}
              </p>
              <Button
                type="button"
                variant="primary"
                loading={savingProfile}
                onClick={() =>
                  void handleSaveProfile({
                    hotelRoomsEnabled,
                    statusMessage: 'Saved Billing, UPI QR & GST settings ✓',
                  })
                }
              >
                Save Billing Settings
              </Button>
            </div>
          </div>

          {/* CARD 3: MENU TAGLINE, CURRENCY & DIRECT APP LINKS */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
            <h2 className="text-[15px] font-bold text-[#111827]">
              Property Preferences &amp; Quick Links
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <label
                  htmlFor="settingsTagline"
                  className="block text-[12px] font-semibold text-[#111827]"
                >
                  Customer Menu Tagline
                </label>
                <input
                  id="settingsTagline"
                  type="text"
                  maxLength={160}
                  placeholder="e.g. Freshly crafted dishes served hot to your table"
                  value={tagline}
                  onChange={(e) => setTagline(e.target.value)}
                  className="block h-9.5 w-full rounded-lg border border-slate-200 bg-white px-3 text-[13px] text-[#111827] focus:border-[#1E1B4B] focus:outline-none"
                />
              </div>
              <div className="space-y-1">
                <label
                  htmlFor="settingsCurrency"
                  className="block text-[12px] font-semibold text-[#111827]"
                >
                  Menu Currency
                </label>
                <select
                  id="settingsCurrency"
                  value={currencyCode}
                  onChange={(e) =>
                    setCurrencyCode(e.target.value as RestaurantCurrencyCode)
                  }
                  className="block h-9.5 w-full rounded-lg border border-slate-200 bg-white px-3 text-[13px] text-[#111827] focus:border-[#1E1B4B] focus:outline-none"
                >
                  {ALLOWED_CURRENCIES.map((code) => (
                    <option key={code} value={code}>
                      {CURRENCY_METADATA[code].label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <div className="flex flex-wrap items-center gap-3 text-[12.5px] font-semibold">
                {isBusinessLive && (
                  <>
                    <a
                      href={menuUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[#1E1B4B] hover:underline"
                    >
                      Guest Menu <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                    </a>
                    <a
                      href={`/r/${business.slug}/staff`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[#1E1B4B] hover:underline"
                    >
                      Waiter App <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                    </a>
                    <a
                      href={kitchenUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[#1E1B4B] hover:underline"
                    >
                      Kitchen KDS <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                    </a>
                  </>
                )}
              </div>
              <Button
                type="button"
                variant="primary"
                loading={savingProfile}
                onClick={() =>
                  void handleSaveProfile({
                    statusMessage: 'Saved property tagline & currency ✓',
                  })
                }
              >
                Save Preferences
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          PORTALED ADD TABLE / HOTEL ROOM MODAL (WORKS FROM ANY PAGE!)
         ===================================================================== */}
      {showAddTableForm &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Add Dining Table or Hotel Room"
            className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-[2px]"
          >
            <form
              onSubmit={(e) => void handleAddTable(e)}
              className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-5 shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h2 className="text-[17px] font-bold text-[#111827]">
                  Add {tableLocationType === 'room' ? 'Hotel Room' : 'Dining Table'}
                </h2>
                <button
                  type="button"
                  onClick={() => setShowAddTableForm(false)}
                  aria-label="Close Add Table Modal"
                  className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 cursor-pointer"
                >
                  <X className="h-4 w-4" aria-hidden />
                </button>
              </div>

              {/* Quick 2-Button Type Switch */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setTableLocationType('table');
                    setTableSeatCapacity(4);
                  }}
                  className={`flex h-10 items-center justify-center gap-2 rounded-lg border text-[13px] font-semibold transition-colors cursor-pointer ${
                    tableLocationType === 'table'
                      ? 'border-[#1E1B4B] bg-[#1E1B4B] text-white'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <UtensilsCrossed className="h-4 w-4" aria-hidden />
                  Dining Table
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTableLocationType('room');
                    setTableSeatCapacity(2);
                  }}
                  className={`flex h-10 items-center justify-center gap-2 rounded-lg border text-[13px] font-semibold transition-colors cursor-pointer ${
                    tableLocationType === 'room'
                      ? 'border-[#1E1B4B] bg-[#1E1B4B] text-white'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <BedDouble className="h-4 w-4" aria-hidden />
                  Hotel Room
                </button>
              </div>

              <div className="grid gap-3.5 sm:grid-cols-2">
                <div className="space-y-1 sm:col-span-2">
                  <label
                    htmlFor="modalTableNumber"
                    className="block text-[12.5px] font-semibold text-[#111827]"
                  >
                    {tableLocationType === 'room'
                      ? 'Room Number *'
                      : 'Table Name / Number *'}
                  </label>
                  <input
                    id="modalTableNumber"
                    type="text"
                    required
                    autoFocus
                    maxLength={40}
                    placeholder={
                      tableLocationType === 'room'
                        ? 'e.g. Room 101, Suite 204'
                        : 'e.g. Table 05, T5, Patio 2'
                    }
                    value={tableNumber}
                    onChange={(e) => setTableNumber(e.target.value)}
                    className="block h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-[14px] text-[#111827] focus:border-[#1E1B4B] focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label
                    htmlFor="modalTableLabel"
                    className="block text-[12.5px] font-semibold text-[#111827]"
                  >
                    Floor / Zone (Optional)
                  </label>
                  <input
                    id="modalTableLabel"
                    type="text"
                    maxLength={80}
                    placeholder={
                      tableLocationType === 'room'
                        ? 'e.g. Deluxe Floor 1'
                        : 'e.g. Window, AC Hall'
                    }
                    value={tableLabel}
                    onChange={(e) => setTableLabel(e.target.value)}
                    className="block h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-[13.5px] text-[#111827] focus:border-[#1E1B4B] focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label
                    htmlFor="modalTableSeats"
                    className="block text-[12.5px] font-semibold text-[#111827]"
                  >
                    {tableLocationType === 'room'
                      ? 'Max Guests'
                      : 'Seat Capacity'}
                  </label>
                  <input
                    id="modalTableSeats"
                    type="number"
                    min={1}
                    max={30}
                    value={tableSeatCapacity}
                    onChange={(e) =>
                      setTableSeatCapacity(
                        Math.max(
                          1,
                          Math.min(30, Number.parseInt(e.target.value, 10) || 4),
                        ),
                      )
                    }
                    className="block h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-[13.5px] font-semibold tabular-nums text-[#111827] focus:border-[#1E1B4B] focus:outline-none"
                  />
                </div>
              </div>

              {tableNumber.trim() && (
                <p className="text-[12px] text-slate-500">
                  Dedicated QR / NFC Link:{' '}
                  <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[#1E1B4B] font-semibold">
                    /r/{business.slug}/table/
                    {deriveTableKey(tableNumber) || 'table-01'}
                  </code>
                </p>
              )}

              <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddTableForm(false)}
                  className="h-9.5 rounded-lg border border-slate-200 bg-white px-4 text-[13px] font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="h-9.5 rounded-lg bg-[#1E1B4B] px-4 text-[13px] font-semibold text-white hover:bg-[#2E2A6E] cursor-pointer"
                >
                  Create {tableLocationType === 'room' ? 'Room' : 'Table'} ✓
                </button>
              </div>
            </form>
          </div>,
          document.body,
        )}

      {/* =====================================================================
          DESKTOP-STYLE RESIZABLE / MINIMIZABLE FLOATING CHAT WINDOW
          (ZERO sticky pill when closed — NEVER covers screen content!)
         ===================================================================== */}
      {showChatDrawer &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            role="dialog"
            aria-label="Resizable Live Chat Window"
            style={
              chatWindowMinimized
                ? undefined
                : {
                    width:
                      chatWindowSize === 'compact'
                        ? '360px'
                        : chatWindowSize === 'medium'
                          ? '500px'
                          : 'min(820px, calc(100vw - 32px))',
                    height:
                      chatWindowSize === 'compact'
                        ? '440px'
                        : chatWindowSize === 'medium'
                          ? '600px'
                          : 'min(82vh, 780px)',
                  }
            }
            className={`fixed bottom-4 right-4 z-[100] flex flex-col overflow-hidden rounded-xl border border-slate-300 bg-[#F8F9FA] shadow-2xl transition-[width,height] duration-150 ${
              chatWindowMinimized
                ? 'w-[300px]'
                : 'max-w-[calc(100vw-24px)] max-h-[calc(100vh-76px)] resize'
            }`}
          >
            {/* Window Title Bar with S / M / L Size Controls + Minimize + Close */}
            <div className="flex items-center justify-between gap-2 bg-[#1E1B4B] px-3.5 py-2.5 text-white select-none">
              <div className="flex items-center gap-2 min-w-0">
                <MessageSquare
                  className="h-4 w-4 shrink-0 text-[#D2DB76]"
                  aria-hidden
                />
                <span className="truncate text-[13px] font-bold">
                  Live Requests &amp; Chat
                </span>
                {openMessagesAndAlertsCount > 0 && (
                  <span className="rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-bold text-white tabular-nums">
                    {openMessagesAndAlertsCount}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1 shrink-0">
                {!chatWindowMinimized && (
                  <div
                    className="hidden sm:inline-flex items-center rounded-md bg-white/10 p-0.5 text-[10.5px] font-bold"
                    role="group"
                    aria-label="Chat window size"
                  >
                    {(
                      [
                        { id: 'compact', label: 'S' },
                        { id: 'medium', label: 'M' },
                        { id: 'large', label: 'L' },
                      ] as const
                    ).map((sz) => (
                      <button
                        key={sz.id}
                        type="button"
                        title={`Resize chat window: ${sz.id}`}
                        onClick={() => setChatWindowSize(sz.id)}
                        className={`h-6 w-6 rounded text-center transition-colors cursor-pointer ${
                          chatWindowSize === sz.id
                            ? 'bg-[#D2DB76] text-[#1E1B4B]'
                            : 'text-white/80 hover:text-white'
                        }`}
                      >
                        {sz.label}
                      </button>
                    ))}
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => setChatWindowMinimized((m) => !m)}
                  aria-label={
                    chatWindowMinimized
                      ? 'Expand Live Chat Window'
                      : 'Minimize Live Chat Window'
                  }
                  title={chatWindowMinimized ? 'Expand' : 'Minimize'}
                  className="rounded-md bg-white/10 p-1.5 text-white hover:bg-white/20 cursor-pointer"
                >
                  {chatWindowMinimized ? (
                    <Maximize2 className="h-3.5 w-3.5" aria-hidden />
                  ) : (
                    <Minimize2 className="h-3.5 w-3.5" aria-hidden />
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowChatDrawer(false);
                    setChatWindowMinimized(false);
                  }}
                  aria-label="Close Live Chat Window"
                  title="Close"
                  className="rounded-md bg-white/10 p-1.5 text-white hover:bg-rose-500 cursor-pointer"
                >
                  <X className="h-3.5 w-3.5" aria-hidden />
                </button>
              </div>
            </div>

            {!chatWindowMinimized && (
              <div className="flex-1 overflow-y-auto p-3.5">
                <LiveTableMessagesPanel
                  businessSlug={business.slug}
                  businessName={business.name}
                  activeCalls={activeCalls}
                  tableMessages={tableMessages}
                  tables={tables}
                  staffRoster={staffMembers}
                  singleColumn={chatWindowSize !== 'large'}
                  onResolveCall={async (callId, assignedLabel) => {
                    await handleUpdateTableCall(
                      callId,
                      'resolved',
                      assignedLabel,
                    );
                  }}
                  onAssignCall={async (callId, assignedLabel) => {
                    await handleUpdateTableCall(callId, 'open', assignedLabel);
                  }}
                  onOpenTableCheckout={(tbl) => {
                    setBillModalTable(tbl);
                  }}
                  onSendManagerReply={handleSendManagerReply}
                />
              </div>
            )}
          </div>,
          document.body,
        )}

      {/* Open Table / Room Bill & Split-Bill Checkout Modal */}
      {billModalTable && (
        <TableFinalBillModal
          businessId={business.id}
          businessSlug={business.slug}
          table={billModalTable}
          onClose={() => setBillModalTable(null)}
          onCheckedOut={() => {
            notifyStatus(
              `Checkout complete for ${billModalTable.tableNumber} — table cleared & receipt sent!`,
            );
            void refreshFloorData();
          }}
          onAddOrderToTable={(tbl) => {
            setBillModalTable(null);
            setPosInitialTableId(tbl.id);
            setPosModalMode('pos');
          }}
        />
      )}

      {/* 3-Column Counter POS & Swiggy/Zomato Platform Order Modal */}
      {posModalMode && (
        <CounterPosAndPlatformModal
          mode={posModalMode}
          businessId={business.id}
          tables={tables}
          categories={categories}
          items={items}
          currencyCode={currencyCode}
          gstPercent={gstPercent}
          serviceChargePercent={serviceChargePercent}
          initialTableId={posInitialTableId}
          onClose={() => {
            setPosModalMode(null);
            setPosInitialTableId(null);
          }}
          onOrderCreated={(summary) => {
            notifyStatus(summary);
            void refreshFloorData();
          }}
        />
      )}
    </div>
  );
}
