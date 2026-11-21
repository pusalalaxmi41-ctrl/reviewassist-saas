import { useCallback, useEffect, useRef, useState } from 'react';
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
} from 'lucide-react';
import type { Business } from '../../types/business';
import type {
  DietaryTag,
  RestaurantCurrencyCode,
  RestaurantFloorAndAnalyticsPayload,
  RestaurantGameConfig,
  RestaurantLoyaltyRules,
  RestaurantMenuCategory,
  RestaurantMenuItem,
  RestaurantProfile,
  RestaurantReward,
  RestaurantSuggestion,
  RestaurantTable,
  RestaurantTriviaQuestion,
} from '../../types/restaurant';
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
  getRestaurantMenuUrl,
  getRestaurantTableQrUrl,
  hashStaffPin,
  parseMajorCurrencyToPaise,
  validateStaffPinFormat,
} from '../../utils/restaurantValidation';
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
import { categoryLabels } from '../../services/business/mockBusinesses';

export type RestaurantWorkspaceSection =
  | 'overview'
  | 'menu'
  | 'tables'
  | 'games_loyalty';

interface Props {
  business: Business;
  isBusinessLive: boolean;
  activeSection?: RestaurantWorkspaceSection;
  onSectionChange?: (section: RestaurantWorkspaceSection) => void;
  onProfileChanged?: (profile: RestaurantProfile) => void;
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
  const [savingProfile, setSavingProfile] = useState(false);
  const [showProfileEdit, setShowProfileEdit] = useState(false);

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

  // Tables & Standee QR state
  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [showAddTableForm, setShowAddTableForm] = useState(false);
  const [tableNumber, setTableNumber] = useState('');
  const [tableLabel, setTableLabel] = useState('');
  const [selectedQrTableId, setSelectedQrTableId] = useState<string>('general');
  const [showStandeeStudio, setShowStandeeStudio] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);

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
        ]);
        setProfile(prof);
        setIsEnabled(prof.isEnabled);
        setCurrencyCode(prof.currencyCode);
        setTagline(prof.tagline ?? '');
        setGamesEnabled(prof.gamesEnabled);
        setLoyaltyEnabled(prof.loyaltyEnabled);
        setMinHoursCooldown(prof.minHoursBetweenVisitStars ?? 4);

        setCategories(cats);
        setItems(menuItems);
        setTables(tbls);
        setGameConfigs(gConfigs);
        applyRulesToState(lRules);
        setRewards(rwds);
        setSuggestions(sugs);
        setFloorData(flr);

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
  }, [business.id, business.slug]);

  useEffect(() => {
    if (currentSection !== 'overview') return;
    const timer = window.setInterval(() => {
      void refreshFloorData();
    }, 10000);
    return () => window.clearInterval(timer);
  }, [currentSection, refreshFloorData]);

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

  async function handleSaveProfile(nextEnabledOverride?: boolean) {
    setSavingProfile(true);
    setErrorMessage(null);
    try {
      const targetEnabled =
        typeof nextEnabledOverride === 'boolean'
          ? nextEnabledOverride
          : isEnabled;
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
        },
      );
      setProfile(saved);
      setIsEnabled(saved.isEnabled);
      onProfileChanged?.(saved);
      notifyStatus(
        saved.isEnabled
          ? 'Restaurant Experience is ACTIVE.'
          : 'Restaurant Experience saved.',
      );
    } catch (err) {
      setErrorMessage((err as Error).message);
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleUpdateTableCall(
    callId: string,
    nextStatus: 'acknowledged' | 'resolved',
  ) {
    try {
      await businessRepository.updateRestaurantTableCallStatus({
        businessSlug: business.slug,
        callId,
        status: nextStatus,
        staffPinHash: null,
      });
      await refreshFloorData();
      notifyStatus(
        nextStatus === 'resolved'
          ? 'Table request resolved.'
          : 'Table request acknowledged.',
      );
    } catch (err) {
      setErrorMessage((err as Error).message);
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

  // Tables & Standee QR handlers
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
        },
      );
      const next = [...tables, created];
      setTables(next);
      setSelectedQrTableId(created.id);
      setTableNumber('');
      setTableLabel('');
      setShowAddTableForm(false);
      notifyStatus(`Added ${created.tableNumber}.`);
    } catch (err) {
      setErrorMessage((err as Error).message);
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

  if (loading) {
    return (
      <div className="bistro-card p-12 text-center">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-[#1E1B4B] border-r-transparent" />
        <p className="mt-3 text-[14px] font-medium text-[#6B7280]">
          Loading BistroOS workspace…
        </p>
      </div>
    );
  }

  const menuUrl = getRestaurantMenuUrl(business.slug);
  const filteredItems =
    selectedCategoryId === 'all' || !selectedCategoryId
      ? items
      : items.filter((i) => i.categoryId === selectedCategoryId);

  const activeCalls = floorData?.activeTableCalls ?? [];
  const pendingClaims = floorData?.pendingRewardClaims ?? [];
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
    <div className="space-y-6 animate-fadeSlideUp">
      {/* Global Toast Banners */}
      {statusMessage && (
        <div
          role="status"
          className="flex items-center gap-2.5 rounded-2xl border border-emerald-200 bg-emerald-50/90 px-4 py-3 text-[13px] font-semibold text-[#059669] shadow-2xs"
        >
          <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden />
          <span>{statusMessage}</span>
        </div>
      )}
      {errorMessage && (
        <div
          role="alert"
          className="flex items-center justify-between gap-2.5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] font-semibold text-red-800"
        >
          <span>{errorMessage}</span>
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            className="rounded-lg p-1 hover:bg-red-100 cursor-pointer"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
      )}

      {/* =====================================================================
          1. LIVE OVERVIEW (DEFAULT HOME — MATCHES MOCKUP 1)
         ===================================================================== */}
      {currentSection === 'overview' && (
        <div className="space-y-6">
          {/* Top Control Header */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-[28px] sm:text-[32px] font-extrabold tracking-tight text-[#111827]">
                  Live Overview
                </h1>
                <span className="rounded-full bg-[#D2DB76]/45 px-3 py-1 text-[12px] font-bold text-[#1E1B4B] uppercase tracking-wider">
                  {categoryLabels[business.category]} • {business.city}
                </span>
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-4 text-[13px] font-semibold text-[#6B7280]">
                <span>{business.name}</span>
                {isBusinessLive && (
                  <>
                    <a
                      href={menuUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[#1E1B4B] hover:underline"
                    >
                      Open Customer Menu <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                    </a>
                    <a
                      href={`/r/${business.slug}/staff`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[#1E1B4B] hover:underline"
                    >
                      Open Staff Floor <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                    </a>
                  </>
                )}
                <button
                  type="button"
                  onClick={() => setShowProfileEdit((v) => !v)}
                  className="text-[#6B7280] hover:text-[#111827] underline cursor-pointer"
                >
                  {showProfileEdit ? 'Hide Tagline & Currency' : 'Edit Tagline & Currency'}
                </button>
              </div>
            </div>

            {/* Tactile Restaurant Experience: ACTIVE Pill Switch */}
            <div className="bistro-card inline-flex items-center justify-between sm:justify-start gap-3.5 px-5 py-3">
              <span className="text-[14px] font-semibold text-[#111827]">
                Restaurant Experience:
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={isEnabled}
                aria-label="Toggle Restaurant Experience"
                disabled={savingProfile}
                onClick={() => {
                  const next = !isEnabled;
                  setIsEnabled(next);
                  void handleSaveProfile(next);
                }}
                className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors duration-200 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1E1B4B] ${
                  isEnabled ? 'bg-[#059669]' : 'bg-[#6B7280]/30'
                }`}
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-[#FFFFFF] shadow-sm transition-transform duration-200 ${
                    isEnabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
              <span
                className={`rounded-full px-3 py-1 text-[12px] font-bold uppercase tracking-wider ${
                  isEnabled
                    ? 'bg-emerald-50 text-[#059669] border border-emerald-200'
                    : 'bg-gray-100 text-[#6B7280]'
                }`}
              >
                {isEnabled ? 'ACTIVE' : 'PAUSED'}
              </span>
            </div>
          </div>

          {/* Optional Collapsible Tagline & Currency Bar */}
          {showProfileEdit && (
            <div className="bistro-card p-6 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label
                    htmlFor="overviewTagline"
                    className="block text-[13px] font-semibold text-[#111827]"
                  >
                    Customer Menu Tagline
                  </label>
                  <input
                    id="overviewTagline"
                    type="text"
                    maxLength={160}
                    placeholder="e.g. Freshly crafted dishes served hot to your table"
                    value={tagline}
                    onChange={(e) => setTagline(e.target.value)}
                    className="block h-11 w-full rounded-xl border border-[#1E1B4B]/20 bg-[#FFFFFF] px-3.5 text-[14px] text-[#111827] focus:border-[#1E1B4B] focus:outline-none"
                  />
                </div>
                <div className="space-y-1.5">
                  <label
                    htmlFor="overviewCurrency"
                    className="block text-[13px] font-semibold text-[#111827]"
                  >
                    Menu Currency
                  </label>
                  <select
                    id="overviewCurrency"
                    value={currencyCode}
                    onChange={(e) =>
                      setCurrencyCode(e.target.value as RestaurantCurrencyCode)
                    }
                    className="block h-11 w-full rounded-xl border border-[#1E1B4B]/20 bg-[#FFFFFF] px-3.5 text-[14px] text-[#111827] focus:border-[#1E1B4B] focus:outline-none"
                  >
                    {ALLOWED_CURRENCIES.map((code) => (
                      <option key={code} value={code}>
                        {CURRENCY_METADATA[code].label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="primary"
                  loading={savingProfile}
                  onClick={() => {
                    void handleSaveProfile();
                    setShowProfileEdit(false);
                  }}
                >
                  Save Profile Preferences
                </Button>
              </div>
            </div>
          )}

          {/* 3 Hero KPI Cards (Equal 3-Column Grid) */}
          <div className="grid gap-5 sm:grid-cols-3">
            {/* KPI 1: QR Scans */}
            <div className="bistro-card p-6 sm:p-7 flex flex-col justify-between space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-[15px] font-semibold text-[#6B7280]">
                  QR Scans
                </span>
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#F8F9FA] border border-[#1E1B4B]/10 text-[#1E1B4B]">
                  <QrCode className="h-5 w-5" aria-hidden />
                </span>
              </div>
              <div>
                <p className="text-[36px] leading-none font-extrabold tracking-tight text-[#111827] tabular-nums">
                  {analytics.qrScans.toLocaleString()}
                </p>
                <p className="mt-2.5 text-[13px] font-medium text-[#6B7280]">
                  Unverified table scans
                </p>
              </div>
            </div>

            {/* KPI 2: Game Players */}
            <div className="bistro-card p-6 sm:p-7 flex flex-col justify-between space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-[15px] font-semibold text-[#6B7280]">
                  Game Players
                </span>
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#F8F9FA] border border-[#1E1B4B]/10 text-[#1E1B4B]">
                  <Gamepad2 className="h-5 w-5" aria-hidden />
                </span>
              </div>
              <div>
                <div className="flex items-baseline gap-2.5">
                  <p className="text-[36px] leading-none font-extrabold tracking-tight text-[#111827] tabular-nums">
                    {analytics.gamesPlayed.toLocaleString()}
                  </p>
                  <span className="rounded-full bg-[#D2DB76]/40 px-2.5 py-0.5 text-[12px] font-bold text-[#1E1B4B] tabular-nums">
                    {analytics.gamePointsIssued.toLocaleString()} pts
                  </span>
                </div>
                <p className="mt-2.5 text-[13px] font-medium text-[#6B7280]">
                  Active diners &amp; points issued
                </p>
              </div>
            </div>

            {/* KPI 3: Verified Visits */}
            <div className="bistro-card p-6 sm:p-7 flex flex-col justify-between space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-[15px] font-semibold text-[#6B7280]">
                  Verified Visits
                </span>
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 border border-emerald-200 text-[#059669]">
                  <CheckCircle2 className="h-5 w-5" aria-hidden />
                </span>
              </div>
              <div>
                <div className="flex items-baseline gap-2.5">
                  <p className="text-[36px] leading-none font-extrabold tracking-tight text-[#111827] tabular-nums">
                    {analytics.verifiedPaidVisits.toLocaleString()}
                  </p>
                  <span className="rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-[12px] font-bold text-[#059669] tabular-nums">
                    {analytics.loyaltyStarsIssued.toLocaleString()} ★
                  </span>
                </div>
                <p className="mt-2.5 text-[13px] font-medium text-[#6B7280]">
                  Staff-confirmed paid visits
                </p>
              </div>
            </div>
          </div>

          {/* Live Table Alerts Card (Matching Mockup 1) */}
          <div className="bistro-card p-6 sm:p-8 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <h2 className="text-[19px] font-bold text-[#111827]">
                  Live Table Alerts
                </h2>
                <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-[#1E1B4B] px-2 text-[12px] font-bold text-[#FFFFFF] tabular-nums">
                  {activeCalls.length}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => void refreshFloorData()}
                  className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[#1E1B4B]/15 bg-[#FFFFFF] px-3 text-[13px] font-semibold text-[#111827] hover:bg-[#F8F9FA] active:scale-[0.98] transition-all cursor-pointer"
                >
                  <RefreshCw className="h-3.5 w-3.5" aria-hidden /> Refresh
                </button>
                <a
                  href={`/r/${business.slug}/staff`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-[#1E1B4B]/[0.06] px-3.5 text-[13px] font-semibold text-[#1E1B4B] hover:bg-[#1E1B4B]/10 transition-all"
                >
                  Waiter Floor Mode <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                </a>
              </div>
            </div>

            {activeCalls.length === 0 ? (
              <div className="rounded-2xl border border-[#1E1B4B]/10 bg-[#F8F9FA] p-8 text-center space-y-2">
                <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-emerald-50 text-[#059669] border border-emerald-200">
                  <CheckCircle2 className="h-5 w-5" aria-hidden />
                </div>
                <p className="text-[15px] font-bold text-[#111827]">
                  All tables caught up — no pending waiter calls
                </p>
                <p className="text-[13px] text-[#6B7280] max-w-md mx-auto">
                  When dining guests tap &ldquo;Call Waiter&rdquo; or &ldquo;Ready for Bill&rdquo; on their table QR hub, real-time alerts appear here.
                </p>
                {tables.length === 0 && (
                  <button
                    type="button"
                    onClick={() => setSection('tables')}
                    className="mt-2 inline-flex h-10 items-center gap-1.5 rounded-xl bg-[#1E1B4B] px-4 text-[13px] font-semibold text-[#FFFFFF] hover:bg-[#2E2A6E] active:scale-[0.98] transition-all cursor-pointer"
                  >
                    <Plus className="h-4 w-4" aria-hidden /> Add Your First Table QR
                  </button>
                )}
              </div>
            ) : (
              <div className="divide-y divide-[#1E1B4B]/10 rounded-2xl border border-[#1E1B4B]/10 bg-[#FFFFFF]">
                {activeCalls.map((call) => {
                  const isBill = call.callType === 'ready_for_bill';
                  return (
                    <div
                      key={call.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 sm:px-5"
                    >
                      <div className="flex flex-wrap items-center gap-3 sm:gap-4">
                        <span className="text-[16px] font-extrabold text-[#111827]">
                          {call.tableNumber || 'Table'}
                        </span>
                        <span className="inline-flex items-center gap-2 rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-[13px] font-semibold text-[#D97706]">
                          <span className="relative flex h-2 w-2">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#D97706] opacity-75" />
                            <span className="relative inline-flex h-2 w-2 rounded-full bg-[#D97706]" />
                          </span>
                          {isBill ? 'Ready for Bill' : 'Calling Waiter'}
                        </span>
                        <span className="text-[13px] font-medium text-[#6B7280] tabular-nums">
                          • {formatTimeAgo(call.createdAt)}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        {call.status === 'open' && (
                          <button
                            type="button"
                            onClick={() =>
                              void handleUpdateTableCall(call.id, 'acknowledged')
                            }
                            className="rounded-xl border border-[#1E1B4B]/20 bg-[#FFFFFF] px-3.5 py-2 text-[13px] font-semibold text-[#111827] hover:bg-[#F8F9FA] active:scale-[0.98] transition-all cursor-pointer"
                          >
                            Acknowledge
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() =>
                            void handleUpdateTableCall(call.id, 'resolved')
                          }
                          className="rounded-xl bg-[#1E1B4B] px-5 py-2 text-[13px] font-semibold text-[#FFFFFF] hover:bg-[#2E2A6E] active:scale-[0.98] transition-all cursor-pointer"
                        >
                          Resolve
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Pending Reward Claim Tickets (if any active) */}
            {pendingClaims.length > 0 && (
              <div className="space-y-3 border-t border-[#1E1B4B]/10 pt-5">
                <h3 className="text-[14px] font-bold uppercase tracking-wider text-[#6B7280] flex items-center gap-2">
                  <Ticket className="h-4 w-4 text-[#1E1B4B]" aria-hidden />
                  Pending Guest Reward Tickets ({pendingClaims.length})
                </h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  {pendingClaims.map((claim) => (
                    <div
                      key={claim.id}
                      className="flex items-center justify-between gap-3 rounded-2xl border border-[#D2DB76] bg-[#D2DB76]/20 p-4"
                    >
                      <div>
                        <p className="text-[14px] font-bold text-[#111827]">
                          {claim.rewardTitle || 'Reward'} •{' '}
                          <span className="font-mono text-[#1E1B4B]">
                            {claim.claimCode}
                          </span>
                        </p>
                        <p className="text-[12px] text-[#6B7280]">
                          Guest: {claim.customerName || 'Diner'} ({claim.starsSpent} ★)
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          void handleFulfillClaimCode(claim.claimCode)
                        }
                        className="rounded-xl bg-[#1E1B4B] px-3.5 py-2 text-[12px] font-semibold text-[#FFFFFF] hover:bg-[#2E2A6E] active:scale-[0.98] transition-all cursor-pointer"
                      >
                        Fulfill ✓
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
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

              <div className="space-y-1.5">
                <label
                  htmlFor="dishDescField"
                  className="block text-[13px] font-semibold text-[#111827]"
                >
                  Concise Description (Optional)
                </label>
                <input
                  id="dishDescField"
                  type="text"
                  maxLength={300}
                  placeholder="e.g. Slow-cooked with aromatic saffron, served with mirchi ka salan & raita"
                  value={itemDescription}
                  onChange={(e) => setItemDescription(e.target.value)}
                  className="block h-11 w-full rounded-xl border border-[#1E1B4B]/20 bg-[#FFFFFF] px-3.5 text-[14px] text-[#111827] focus:border-[#1E1B4B] focus:outline-none"
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-4 border-t border-[#1E1B4B]/10 pt-4">
                <div className="flex flex-wrap items-center gap-6">
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
                    Chef&apos;s Special / Featured
                  </label>
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
          3. TABLES & QRS
         ===================================================================== */}
      {currentSection === 'tables' && (
        <div className="space-y-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-[28px] sm:text-[32px] font-extrabold tracking-tight text-[#111827]">
                Tables &amp; QRs
              </h1>
              <p className="mt-1 text-[14px] text-[#6B7280]">
                Each table standee automatically identifies the guest&apos;s table number for waiter calls and loyalty stars.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2.5">
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setSelectedQrTableId('general');
                  setShowStandeeStudio(true);
                }}
              >
                <QrCode className="h-4 w-4" aria-hidden /> Counter Menu QR
              </Button>
              <Button
                type="button"
                variant="primary"
                onClick={() => setShowAddTableForm((v) => !v)}
              >
                <Plus className="h-4 w-4" aria-hidden /> Add Table
              </Button>
            </div>
          </div>

          {/* Add Table Card */}
          {showAddTableForm && (
            <form
              onSubmit={(e) => void handleAddTable(e)}
              className="bistro-card p-6 space-y-4 animate-fadeSlideUp"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-[17px] font-bold text-[#111827]">
                  Add Restaurant Table
                </h3>
                <button
                  type="button"
                  onClick={() => setShowAddTableForm(false)}
                  className="rounded-lg p-1.5 text-[#6B7280] hover:bg-[#F8F9FA] cursor-pointer"
                >
                  <X className="h-4 w-4" aria-hidden />
                </button>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label
                    htmlFor="newTableNumber"
                    className="block text-[13px] font-semibold text-[#111827]"
                  >
                    Table Name / Number
                  </label>
                  <input
                    id="newTableNumber"
                    type="text"
                    required
                    maxLength={40}
                    placeholder="e.g. Table 01, T4, Patio 2"
                    value={tableNumber}
                    onChange={(e) => setTableNumber(e.target.value)}
                    className="block h-11 w-full rounded-xl border border-[#1E1B4B]/20 bg-[#FFFFFF] px-3.5 text-[14px] text-[#111827] focus:border-[#1E1B4B] focus:outline-none"
                  />
                </div>
                <div className="space-y-1.5">
                  <label
                    htmlFor="newTableLabel"
                    className="block text-[13px] font-semibold text-[#111827]"
                  >
                    Location Label (Optional)
                  </label>
                  <input
                    id="newTableLabel"
                    type="text"
                    maxLength={80}
                    placeholder="e.g. Window Corner, Rooftop"
                    value={tableLabel}
                    onChange={(e) => setTableLabel(e.target.value)}
                    className="block h-11 w-full rounded-xl border border-[#1E1B4B]/20 bg-[#FFFFFF] px-3.5 text-[14px] text-[#111827] focus:border-[#1E1B4B] focus:outline-none"
                  />
                </div>
              </div>
              {tableNumber.trim() && (
                <p className="text-[12px] text-[#6B7280]">
                  Table URL:{' '}
                  <code className="rounded bg-[#F8F9FA] px-1.5 py-0.5 font-mono text-[#1E1B4B] font-semibold">
                    /r/{business.slug}/table/{deriveTableKey(tableNumber) || 'table-01'}
                  </code>
                </p>
              )}
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setShowAddTableForm(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" variant="primary">
                  Create Table &amp; QR
                </Button>
              </div>
            </form>
          )}

          {/* Responsive Table Cards Grid */}
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {tables.map((tbl) => {
              const tblUrl = getRestaurantTableQrUrl(
                business.slug,
                tbl.tableKey,
              );
              const isSelected =
                showStandeeStudio && selectedQrTableId === tbl.id;
              return (
                <div
                  key={tbl.id}
                  className={`bistro-card p-6 flex flex-col justify-between space-y-5 transition-all ${
                    isSelected ? 'ring-2 ring-[#1E1B4B]' : ''
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="inline-flex items-center rounded-full bg-[#D2DB76]/55 px-3 py-0.5 text-[12px] font-extrabold text-[#1E1B4B]">
                        {tbl.tableNumber}
                      </span>
                      <p className="mt-1.5 text-[14px] font-semibold text-[#111827]">
                        {tbl.tableLabel || 'Main Dining Room'}
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

                  <div className="flex flex-col items-center justify-center rounded-2xl bg-[#F8F9FA] py-5 px-3 border border-[#1E1B4B]/[0.06]">
                    <TableQrPreviewCanvas url={tblUrl} />
                    <p className="mt-2.5 font-mono text-[11px] text-[#6B7280] truncate max-w-full">
                      /r/{business.slug}/table/{tbl.tableKey}
                    </p>
                  </div>

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
                      <Download className="h-4 w-4" aria-hidden /> Download QR Standee
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
                </div>
              );
            })}

            {/* + Add Table Card at End of Grid */}
            <button
              type="button"
              onClick={() => setShowAddTableForm(true)}
              className="flex min-h-[280px] flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-[#1E1B4B]/20 bg-[#FFFFFF]/60 p-6 text-center transition-all hover:border-[#1E1B4B] hover:bg-[#FFFFFF] active:scale-[0.98] cursor-pointer"
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#1E1B4B] text-[#D2DB76] shadow-sm">
                <Plus className="h-6 w-6" aria-hidden />
              </span>
              <div>
                <p className="text-[16px] font-bold text-[#111827]">
                  + Add Table
                </p>
                <p className="mt-0.5 text-[13px] text-[#6B7280]">
                  Create a dedicated table QR standee
                </p>
              </div>
            </button>
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
    </div>
  );
}
