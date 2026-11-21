import { useEffect, useRef, useState } from 'react';
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
  XCircle,
} from 'lucide-react';
import type { Business } from '../../types/business';
import type {
  DietaryTag,
  RestaurantCurrencyCode,
  RestaurantMenuCategory,
  RestaurantMenuItem,
  RestaurantProfile,
  RestaurantTable,
} from '../../types/restaurant';
import { businessRepository } from '../../services/storage';
import {
  ALLOWED_CURRENCIES,
  ALLOWED_DIETARY_TAGS,
  CURRENCY_METADATA,
  DIETARY_TAG_METADATA,
  deriveTableKey,
  formatPriceFromPaise,
  getRestaurantMenuUrl,
  getRestaurantTableQrUrl,
  parseMajorCurrencyToPaise,
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
import { RestaurantGamesConfigPanel } from './RestaurantGamesConfigPanel';
import { RestaurantLoyaltyAndExtrasPanel } from './RestaurantLoyaltyAndExtrasPanel';
import { RestaurantFloorAndStaffPanel } from './RestaurantFloorAndStaffPanel';

interface Props {
  business: Business;
  isBusinessLive: boolean;
  onProfileChanged?: (profile: RestaurantProfile) => void;
}

type SubSection =
  | 'setup'
  | 'menu'
  | 'tables'
  | 'games'
  | 'loyalty'
  | 'floor_staff';

export function RestaurantManagerView({
  business,
  isBusinessLive,
  onProfileChanged,
}: Props) {
  const [subSection, setSubSection] = useState<SubSection>('setup');
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

  // Categories & Items state
  const [categories, setCategories] = useState<RestaurantMenuCategory[]>([]);
  const [items, setItems] = useState<RestaurantMenuItem[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');

  // Category Form state
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(
    null,
  );
  const [catName, setCatName] = useState('');
  const [catDescription, setCatDescription] = useState('');
  const [catIsActive, setCatIsActive] = useState(true);

  // Item Form state
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
  const [tableNumber, setTableNumber] = useState('');
  const [tableLabel, setTableLabel] = useState('');
  const [selectedQrTableId, setSelectedQrTableId] = useState<string>('general');
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

  useEffect(() => {
    async function loadAll() {
      setLoading(true);
      setErrorMessage(null);
      try {
        const [prof, cats, menuItems, tbls] = await Promise.all([
          businessRepository.getRestaurantProfile(business.id),
          businessRepository.getRestaurantMenuCategories(business.id),
          businessRepository.getRestaurantMenuItems(business.id),
          businessRepository.getRestaurantTables(business.id),
        ]);
        setProfile(prof);
        setIsEnabled(prof.isEnabled);
        setCurrencyCode(prof.currencyCode);
        setTagline(prof.tagline ?? '');
        setGamesEnabled(prof.gamesEnabled);
        setLoyaltyEnabled(prof.loyaltyEnabled);

        setCategories(cats);
        setItems(menuItems);
        setTables(tbls);

        if (cats.length > 0) {
          setSelectedCategoryId((prev) =>
            cats.some((c) => c.id === prev) ? prev : cats[0].id,
          );
          setItemCategoryId((prev) =>
            cats.some((c) => c.id === prev) ? prev : cats[0].id,
          );
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
  }, [business.id]);

  const activeQrTable =
    selectedQrTableId === 'general'
      ? null
      : (tables.find((t) => t.id === selectedQrTableId) ?? null);

  const activeQrUrl = activeQrTable
    ? getRestaurantTableQrUrl(business.slug, activeQrTable.tableKey)
    : getRestaurantMenuUrl(business.slug);

  useEffect(() => {
    if (subSection !== 'tables' || !qrCanvasRef.current) return;
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
  }, [subSection, business, qrSettings, activeQrTable, activeQrUrl]);

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
        },
      );
      setProfile(saved);
      setIsEnabled(saved.isEnabled);
      onProfileChanged?.(saved);
      notifyStatus(
        saved.isEnabled
          ? 'Restaurant Suite enabled and settings saved.'
          : 'Restaurant Suite settings saved.',
      );
    } catch (err) {
      setErrorMessage((err as Error).message);
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleSeedStarterMenu() {
    setErrorMessage(null);
    try {
      const startersCat = await businessRepository.createRestaurantMenuCategory(
        business.id,
        {
          name: 'Signature Starters',
          description: 'Freshly prepared appetizers served hot to your table',
          displayOrder: 0,
          isActive: true,
        },
      );
      const mainsCat = await businessRepository.createRestaurantMenuCategory(
        business.id,
        {
          name: 'Main Course & Biryani',
          description: 'Slow-cooked house specialties and traditional curries',
          displayOrder: 1,
          isActive: true,
        },
      );
      const drinksCat = await businessRepository.createRestaurantMenuCategory(
        business.id,
        {
          name: 'Artisan Beverages',
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
          description: 'Spiced cottage cheese tossed with curry leaves and green chillies',
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
          description: 'Aromatic long-grain basmati rice layered with saffron and house spices',
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
          description: 'Garden mint, freshly squeezed lime, and chilled sparkling soda',
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
      setSelectedCategoryId(startersCat.id);
      setItemCategoryId(startersCat.id);
      notifyStatus('Starter categories and sample dishes added to your Digital Menu.');
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
        if (!selectedCategoryId) setSelectedCategoryId(created.id);
        if (!itemCategoryId) setItemCategoryId(created.id);
        notifyStatus(`Added category "${created.name}".`);
      }
      setCatName('');
      setCatDescription('');
      setCatIsActive(true);
    } catch (err) {
      setErrorMessage((err as Error).message);
    }
  }

  function handleStartEditCategory(cat: RestaurantMenuCategory) {
    setEditingCategoryId(cat.id);
    setCatName(cat.name);
    setCatDescription(cat.description ?? '');
    setCatIsActive(cat.isActive);
  }

  async function handleToggleCategoryActive(cat: RestaurantMenuCategory) {
    try {
      const updated = await businessRepository.updateRestaurantMenuCategory(
        business.id,
        cat.id,
        {
          name: cat.name,
          description: cat.description,
          displayOrder: cat.displayOrder,
          isActive: !cat.isActive,
        },
      );
      setCategories((prev) =>
        prev.map((c) => (c.id === updated.id ? updated : c)),
      );
      notifyStatus(
        `Category "${updated.name}" is now ${updated.isActive ? 'visible' : 'hidden'} on the menu.`,
      );
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
        setSelectedCategoryId(nextCats[0]?.id ?? '');
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
    const targetCatId = itemCategoryId || selectedCategoryId || categories[0]?.id;
    if (!targetCatId) {
      setErrorMessage('Please create a menu category first.');
      return;
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
        notifyStatus(`Updated dish "${updated.name}".`);
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
        setSelectedCategoryId(targetCatId);
        notifyStatus(`Added dish "${created.name}".`);
      }
      setItemName('');
      setItemDescription('');
      setItemPriceMajor('');
      setItemDietaryTag('veg');
      setItemIsAvailable(true);
      setItemIsFeatured(false);
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
        `"${updated.name}" marked as ${updated.isAvailable ? 'Available' : 'Sold Out / Unavailable'}.`,
      );
    } catch (err) {
      setErrorMessage((err as Error).message);
    }
  }

  async function handleDeleteItem(item: RestaurantMenuItem) {
    try {
      await businessRepository.deleteRestaurantMenuItem(business.id, item.id);
      setItems((prev) => prev.filter((i) => i.id !== item.id));
      notifyStatus(`Removed "${item.name}" from the menu.`);
    } catch (err) {
      setErrorMessage((err as Error).message);
    }
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
        },
      );
      const next = [...tables, created];
      setTables(next);
      setSelectedQrTableId(created.id);
      setTableNumber('');
      setTableLabel('');
      notifyStatus(
        `Added ${created.tableNumber} (/r/${business.slug}/table/${created.tableKey}).`,
      );
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

  async function handleDownloadTableQrPng() {
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

  async function handleDownloadTableQrPdf() {
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

  if (loading) {
    return (
      <div className="rounded-2xl border border-[#DDE4DC] bg-[#FFFFFF] p-10 text-center">
        <div className="inline-block h-7 w-7 animate-spin rounded-full border-4 border-[#244B40] border-r-transparent" />
        <p className="mt-2.5 text-[14px] text-[#626B65]">
          Loading Restaurant Suite…
        </p>
      </div>
    );
  }

  const menuUrl = getRestaurantMenuUrl(business.slug);
  const filteredItems = selectedCategoryId
    ? items.filter((i) => i.categoryId === selectedCategoryId)
    : items;

  return (
    <div className="space-y-6">
      {/* Top Status Banner & Section Switcher */}
      <div className="rounded-2xl border border-[#DDE4DC] bg-[#FFFFFF] p-5 sm:p-6 shadow-2xs space-y-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-[20px] font-bold tracking-tight text-[#252B29] flex items-center gap-2">
                <UtensilsCrossed className="h-5 w-5 text-[#244B40]" aria-hidden />
                Restaurant Digital Menu, Tables &amp; Standees
              </h2>
              <span
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[12px] font-semibold ${
                  profile?.isEnabled
                    ? 'border-[#A8BFA5] bg-[#EEF3EC] text-[#244B40]'
                    : 'border-[#DDE4DC] bg-[#F7F7F2] text-[#626B65]'
                }`}
              >
                {profile?.isEnabled ? (
                  <>
                    <CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> Suite Enabled
                  </>
                ) : (
                  <>
                    <XCircle className="h-3.5 w-3.5" aria-hidden /> Suite Disabled
                  </>
                )}
              </span>
            </div>
            <p className="text-[13px] text-[#626B65]">
              Waiter-assisted digital QR menu with table recognition, games, and loyalty stars. Guests browse dishes and place orders directly with your staff.
            </p>
          </div>

          {profile?.isEnabled && isBusinessLive && (
            <a
              href={menuUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-xl border border-[#244B40] bg-[#EEF3EC]/60 px-3.5 py-2 text-[13px] font-semibold text-[#244B40] hover:bg-[#EEF3EC]"
            >
              Open Live Digital Menu <ExternalLink className="h-3.5 w-3.5" aria-hidden />
            </a>
          )}
        </div>

        {/* Sub-navigation pills */}
        <div className="flex flex-wrap gap-2 border-t border-[#DDE4DC] pt-4">
          {(
            [
              { id: 'setup', label: '1. Restaurant Profile & Toggle' },
              {
                id: 'menu',
                label: `2. Digital Menu (${categories.length} Categories · ${items.length} Dishes)`,
              },
              {
                id: 'tables',
                label: `3. Tables & QR Standees (${tables.length} Tables)`,
              },
              {
                id: 'games',
                label: '4. Games & Point Rules',
              },
              {
                id: 'loyalty',
                label: '5. Loyalty Stars, Rewards & Table Extras',
              },
              {
                id: 'floor_staff',
                label: '6. Live Floor, Staff PIN & Analytics',
              },
            ] as const
          ).map((tab) => {
            const active = subSection === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSubSection(tab.id)}
                className={`rounded-xl px-4 py-2 text-[13px] font-semibold transition-colors cursor-pointer ${
                  active
                    ? 'bg-[#244B40] text-[#FFFFFF]'
                    : 'border border-[#DDE4DC] bg-[#F7F7F2] text-[#252B29] hover:bg-[#EEF3EC]/60'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {statusMessage && (
          <div
            role="status"
            className="rounded-xl border border-[#A8BFA5] bg-[#EEF3EC] px-4 py-2.5 text-[13px] font-medium text-[#244B40]"
          >
            {statusMessage}
          </div>
        )}
        {errorMessage && (
          <div
            role="alert"
            className="rounded-xl border border-red-300 bg-red-50 px-4 py-2.5 text-[13px] font-medium text-red-900"
          >
            {errorMessage}
          </div>
        )}
      </div>

      {/* SUB-SECTION 1: SETUP TOGGLE & PROFILE */}
      {subSection === 'setup' && (
        <div className="rounded-2xl border border-[#DDE4DC] bg-[#FFFFFF] p-6 shadow-2xs space-y-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-[#DDE4DC] pb-5">
            <div className="space-y-1">
              <h3 className="text-[17px] font-semibold text-[#252B29]">
                Enable Restaurant Digital Menu &amp; Table Suite
              </h3>
              <p className="text-[13px] text-[#626B65]">
                Turn this on to activate <code className="rounded bg-[#F7F7F2] px-1.5 py-0.5 font-mono text-[12px]">/r/{business.slug}/menu</code> and table-specific QR links while keeping your existing Google Review page (<code className="rounded bg-[#F7F7F2] px-1.5 py-0.5 font-mono text-[12px]">/r/{business.slug}</code>) 100% intact.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={isEnabled}
              onClick={() => {
                const next = !isEnabled;
                setIsEnabled(next);
                void handleSaveProfile(next);
              }}
              className={`inline-flex min-h-11 shrink-0 items-center gap-2.5 rounded-xl px-4 py-2.5 text-[14px] font-semibold transition-colors cursor-pointer ${
                isEnabled
                  ? 'bg-[#244B40] text-[#FFFFFF] hover:bg-[#1C3B32]'
                  : 'border border-[#87928A] bg-[#F7F7F2] text-[#252B29] hover:border-[#244B40]'
              }`}
            >
              <span>{isEnabled ? 'Restaurant Suite: ON' : 'Restaurant Suite: OFF'}</span>
            </button>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label
                htmlFor="restaurantTagline"
                className="block text-[13px] font-semibold text-[#252B29]"
              >
                Menu Welcome Tagline (Optional)
              </label>
              <input
                id="restaurantTagline"
                type="text"
                maxLength={160}
                placeholder="e.g. Freshly crafted dishes served hot to your table"
                value={tagline}
                onChange={(e) => setTagline(e.target.value)}
                className="block min-h-11 w-full rounded-xl border border-[#87928A] bg-[#FFFFFF] px-3.5 py-2 text-[14px] text-[#252B29] focus:border-[#244B40] focus:outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="restaurantCurrency"
                className="block text-[13px] font-semibold text-[#252B29]"
              >
                Menu Display Currency
              </label>
              <select
                id="restaurantCurrency"
                value={currencyCode}
                onChange={(e) =>
                  setCurrencyCode(e.target.value as RestaurantCurrencyCode)
                }
                className="block min-h-11 w-full rounded-xl border border-[#87928A] bg-[#FFFFFF] px-3.5 py-2 text-[14px] text-[#252B29] focus:border-[#244B40] focus:outline-none"
              >
                {ALLOWED_CURRENCIES.map((code) => (
                  <option key={code} value={code}>
                    {CURRENCY_METADATA[code].label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 pt-1">
            <label className="flex items-start gap-3 rounded-xl border border-[#DDE4DC] bg-[#F7F7F2]/60 p-4 cursor-pointer">
              <input
                type="checkbox"
                checked={gamesEnabled}
                onChange={(e) => setGamesEnabled(e.target.checked)}
                className="mt-1 h-4 w-4 accent-[#244B40]"
              />
              <div className="space-y-0.5">
                <span className="flex items-center gap-1.5 text-[14px] font-semibold text-[#252B29]">
                  <Gamepad2 className="h-4 w-4 text-[#244B40]" aria-hidden /> Show Table Games Card on Menu
                </span>
                <p className="text-[12px] text-[#626B65]">
                  Displays the interactive Table Games section on the guest digital menu.
                </p>
              </div>
            </label>

            <label className="flex items-start gap-3 rounded-xl border border-[#DDE4DC] bg-[#F7F7F2]/60 p-4 cursor-pointer">
              <input
                type="checkbox"
                checked={loyaltyEnabled}
                onChange={(e) => setLoyaltyEnabled(e.target.checked)}
                className="mt-1 h-4 w-4 accent-[#244B40]"
              />
              <div className="space-y-0.5">
                <span className="flex items-center gap-1.5 text-[14px] font-semibold text-[#252B29]">
                  <Award className="h-4 w-4 text-[#244B40]" aria-hidden /> Show Loyalty Stars &amp; Perks Card on Menu
                </span>
                <p className="text-[12px] text-[#626B65]">
                  Displays your venue&apos;s Loyalty Stars card on the guest digital menu.
                </p>
              </div>
            </label>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#DDE4DC] pt-4">
            <p className="text-[12px] text-[#626B65]">
              Ordering policy: Waiter-assisted only (no self-service payment cart).
            </p>
            <Button
              type="button"
              variant="primary"
              disabled={savingProfile}
              onClick={() => void handleSaveProfile()}
            >
              {savingProfile ? 'Saving…' : 'Save Restaurant Settings'}
            </Button>
          </div>
        </div>
      )}

      {/* SUB-SECTION 2: DIGITAL MENU MANAGER */}
      {subSection === 'menu' && (
        <div className="space-y-6">
          {categories.length === 0 && (
            <div className="rounded-2xl border border-[#E4BD63] bg-[#FAF3DF] p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="space-y-1">
                <h3 className="text-[16px] font-semibold text-[#252B29] flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-[#244B40]" aria-hidden /> Quick Start Your Digital Menu
                </h3>
                <p className="text-[13px] text-[#252B29]">
                  Your menu is currently empty. Add your own categories below or load a sample 3-course starter menu in one click.
                </p>
              </div>
              <Button
                type="button"
                variant="secondary"
                onClick={() => void handleSeedStarterMenu()}
              >
                Load Sample Menu
              </Button>
            </div>
          )}

          <div className="grid gap-6 lg:grid-cols-12">
            {/* LEFT: Categories Manager */}
            <div className="lg:col-span-5 space-y-5">
              <form
                onSubmit={(e) => void handleSaveCategory(e)}
                className="rounded-2xl border border-[#DDE4DC] bg-[#FFFFFF] p-5 shadow-2xs space-y-4"
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-[16px] font-semibold text-[#252B29]">
                    {editingCategoryId ? 'Edit Category' : 'Add Menu Category'}
                  </h3>
                  {editingCategoryId && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingCategoryId(null);
                        setCatName('');
                        setCatDescription('');
                        setCatIsActive(true);
                      }}
                      className="text-[12px] font-medium text-[#626B65] hover:text-[#252B29] cursor-pointer"
                    >
                      Cancel edit
                    </button>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="catNameInput"
                    className="block text-[13px] font-medium text-[#252B29]"
                  >
                    Category Name
                  </label>
                  <input
                    id="catNameInput"
                    type="text"
                    required
                    maxLength={80}
                    placeholder="e.g. Signature Starters, Wood-Fired Pizza"
                    value={catName}
                    onChange={(e) => setCatName(e.target.value)}
                    className="block min-h-10 w-full rounded-xl border border-[#87928A] bg-[#FFFFFF] px-3 py-2 text-[14px] text-[#252B29] focus:border-[#244B40] focus:outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="catDescInput"
                    className="block text-[13px] font-medium text-[#252B29]"
                  >
                    Short Note (Optional)
                  </label>
                  <input
                    id="catDescInput"
                    type="text"
                    maxLength={240}
                    placeholder="e.g. Served with house mint chutney"
                    value={catDescription}
                    onChange={(e) => setCatDescription(e.target.value)}
                    className="block min-h-10 w-full rounded-xl border border-[#87928A] bg-[#FFFFFF] px-3 py-2 text-[13px] text-[#252B29] focus:border-[#244B40] focus:outline-none"
                  />
                </div>

                <Button type="submit" variant="primary" className="w-full">
                  <Plus className="h-4 w-4" aria-hidden />
                  {editingCategoryId ? 'Update Category' : 'Add Category'}
                </Button>
              </form>

              {/* Category List */}
              <div className="rounded-2xl border border-[#DDE4DC] bg-[#FFFFFF] p-5 shadow-2xs space-y-3">
                <h4 className="text-[14px] font-semibold uppercase tracking-wider text-[#626B65]">
                  Menu Categories ({categories.length})
                </h4>
                {categories.length === 0 ? (
                  <p className="text-[13px] text-[#626B65] py-4 text-center">
                    No categories yet. Add your first category above.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {categories.map((cat) => {
                      const count = items.filter(
                        (i) => i.categoryId === cat.id,
                      ).length;
                      const isSelected = selectedCategoryId === cat.id;
                      return (
                        <div
                          key={cat.id}
                          className={`rounded-xl border p-3 transition-colors ${
                            isSelected
                              ? 'border-[#244B40] bg-[#EEF3EC]/60'
                              : 'border-[#DDE4DC] bg-[#FFFFFF]'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedCategoryId(cat.id);
                                setItemCategoryId(cat.id);
                              }}
                              className="text-left flex-1 cursor-pointer"
                            >
                              <div className="flex items-center gap-2">
                                <span className="text-[14px] font-semibold text-[#252B29]">
                                  {cat.name}
                                </span>
                                <span className="rounded-full bg-[#EEF3EC] px-2 py-0.5 text-[11px] font-semibold text-[#244B40]">
                                  {count} {count === 1 ? 'dish' : 'dishes'}
                                </span>
                                {!cat.isActive && (
                                  <span className="rounded-full bg-[#E8EBE7] px-2 py-0.5 text-[11px] font-medium text-[#626B65]">
                                    Hidden
                                  </span>
                                )}
                              </div>
                              {cat.description && (
                                <p className="mt-0.5 text-[12px] text-[#626B65]">
                                  {cat.description}
                                </p>
                              )}
                            </button>

                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() =>
                                  void handleToggleCategoryActive(cat)
                                }
                                className="rounded-lg border border-[#DDE4DC] bg-[#FFFFFF] px-2 py-1 text-[11px] font-medium text-[#252B29] hover:border-[#244B40] cursor-pointer"
                              >
                                {cat.isActive ? 'Hide' : 'Show'}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleStartEditCategory(cat)}
                                aria-label={`Edit ${cat.name}`}
                                className="rounded-lg p-1.5 text-[#626B65] hover:bg-[#F7F7F2] hover:text-[#252B29] cursor-pointer"
                              >
                                <Edit3 className="h-3.5 w-3.5" aria-hidden />
                              </button>
                              <button
                                type="button"
                                onClick={() => void handleDeleteCategory(cat)}
                                aria-label={`Delete ${cat.name}`}
                                className="rounded-lg p-1.5 text-red-700 hover:bg-red-50 cursor-pointer"
                              >
                                <Trash2 className="h-3.5 w-3.5" aria-hidden />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* RIGHT: Menu Items Manager */}
            <div className="lg:col-span-7 space-y-5">
              <form
                onSubmit={(e) => void handleSaveItem(e)}
                className="rounded-2xl border border-[#DDE4DC] bg-[#FFFFFF] p-5 shadow-2xs space-y-4"
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-[16px] font-semibold text-[#252B29]">
                    {editingItemId ? 'Edit Dish / Menu Item' : 'Add Dish / Menu Item'}
                  </h3>
                  {editingItemId && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingItemId(null);
                        setItemName('');
                        setItemDescription('');
                        setItemPriceMajor('');
                      }}
                      className="text-[12px] font-medium text-[#626B65] hover:text-[#252B29] cursor-pointer"
                    >
                      Cancel edit
                    </button>
                  )}
                </div>

                <div className="grid gap-3.5 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <label
                      htmlFor="itemCategorySelect"
                      className="block text-[13px] font-medium text-[#252B29]"
                    >
                      Category
                    </label>
                    <select
                      id="itemCategorySelect"
                      required
                      value={itemCategoryId || selectedCategoryId}
                      onChange={(e) => setItemCategoryId(e.target.value)}
                      className="block min-h-10 w-full rounded-xl border border-[#87928A] bg-[#FFFFFF] px-3 py-2 text-[14px] text-[#252B29] focus:border-[#244B40] focus:outline-none"
                    >
                      {categories.length === 0 && (
                        <option value="">Create a category first</option>
                      )}
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label
                      htmlFor="itemNameInput"
                      className="block text-[13px] font-medium text-[#252B29]"
                    >
                      Dish Name
                    </label>
                    <input
                      id="itemNameInput"
                      type="text"
                      required
                      maxLength={100}
                      placeholder="e.g. Hyderabadi Dum Biryani"
                      value={itemName}
                      onChange={(e) => setItemName(e.target.value)}
                      className="block min-h-10 w-full rounded-xl border border-[#87928A] bg-[#FFFFFF] px-3 py-2 text-[14px] text-[#252B29] focus:border-[#244B40] focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid gap-3.5 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <label
                      htmlFor="itemPriceInput"
                      className="block text-[13px] font-medium text-[#252B29]"
                    >
                      Price ({CURRENCY_METADATA[currencyCode].symbol})
                    </label>
                    <input
                      id="itemPriceInput"
                      type="text"
                      inputMode="decimal"
                      required
                      placeholder="e.g. 249 or 249.50"
                      value={itemPriceMajor}
                      onChange={(e) => setItemPriceMajor(e.target.value)}
                      className="block min-h-10 w-full rounded-xl border border-[#87928A] bg-[#FFFFFF] px-3 py-2 text-[14px] text-[#252B29] focus:border-[#244B40] focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label
                      htmlFor="itemDietarySelect"
                      className="block text-[13px] font-medium text-[#252B29]"
                    >
                      Dietary Badge
                    </label>
                    <select
                      id="itemDietarySelect"
                      value={itemDietaryTag}
                      onChange={(e) =>
                        setItemDietaryTag(e.target.value as DietaryTag)
                      }
                      className="block min-h-10 w-full rounded-xl border border-[#87928A] bg-[#FFFFFF] px-3 py-2 text-[14px] text-[#252B29] focus:border-[#244B40] focus:outline-none"
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
                    htmlFor="itemDescInput"
                    className="block text-[13px] font-medium text-[#252B29]"
                  >
                    Description (Optional)
                  </label>
                  <input
                    id="itemDescInput"
                    type="text"
                    maxLength={300}
                    placeholder="e.g. Slow-cooked with aromatic saffron, served with mirchi ka salan & raita"
                    value={itemDescription}
                    onChange={(e) => setItemDescription(e.target.value)}
                    className="block min-h-10 w-full rounded-xl border border-[#87928A] bg-[#FFFFFF] px-3 py-2 text-[13px] text-[#252B29] focus:border-[#244B40] focus:outline-none"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-5 pt-1">
                  <label className="inline-flex items-center gap-2 text-[13px] font-medium text-[#252B29] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={itemIsAvailable}
                      onChange={(e) => setItemIsAvailable(e.target.checked)}
                      className="h-4 w-4 accent-[#244B40]"
                    />
                    Available Today
                  </label>
                  <label className="inline-flex items-center gap-2 text-[13px] font-medium text-[#252B29] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={itemIsFeatured}
                      onChange={(e) => setItemIsFeatured(e.target.checked)}
                      className="h-4 w-4 accent-[#244B40]"
                    />
                    Chef&apos;s Special / Featured Badge
                  </label>
                </div>

                <Button
                  type="submit"
                  variant="primary"
                  disabled={categories.length === 0}
                >
                  <Plus className="h-4 w-4" aria-hidden />
                  {editingItemId ? 'Update Dish' : 'Add Dish to Menu'}
                </Button>
              </form>

              {/* Dishes List */}
              <div className="rounded-2xl border border-[#DDE4DC] bg-[#FFFFFF] p-5 shadow-2xs space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h4 className="text-[14px] font-semibold uppercase tracking-wider text-[#626B65]">
                    Dishes ({filteredItems.length})
                  </h4>
                  {categories.length > 1 && (
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        onClick={() => setSelectedCategoryId('')}
                        className={`rounded-lg px-2.5 py-1 text-[12px] font-medium cursor-pointer ${
                          selectedCategoryId === ''
                            ? 'bg-[#244B40] text-[#FFFFFF]'
                            : 'bg-[#F7F7F2] text-[#252B29]'
                        }`}
                      >
                        All ({items.length})
                      </button>
                      {categories.map((cat) => (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => setSelectedCategoryId(cat.id)}
                          className={`rounded-lg px-2.5 py-1 text-[12px] font-medium cursor-pointer ${
                            selectedCategoryId === cat.id
                              ? 'bg-[#244B40] text-[#FFFFFF]'
                              : 'bg-[#F7F7F2] text-[#252B29]'
                          }`}
                        >
                          {cat.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {filteredItems.length === 0 ? (
                  <p className="py-6 text-center text-[13px] text-[#626B65]">
                    No dishes in this category yet. Use the form above to add one.
                  </p>
                ) : (
                  <div className="space-y-2.5">
                    {filteredItems.map((item) => {
                      const dMeta = DIETARY_TAG_METADATA[item.dietaryTag];
                      const catObj = categories.find(
                        (c) => c.id === item.categoryId,
                      );
                      return (
                        <div
                          key={item.id}
                          className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-[#DDE4DC] bg-[#FFFFFF] p-3.5"
                        >
                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              {item.dietaryTag !== 'none' && (
                                <span
                                  className="inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-semibold"
                                  style={{
                                    borderColor: dMeta.borderColor,
                                    backgroundColor: dMeta.bgColor,
                                    color: dMeta.textColor,
                                  }}
                                >
                                  <span
                                    className="h-2 w-2 rounded-full"
                                    style={{ backgroundColor: dMeta.dotColor }}
                                  />
                                  {dMeta.shortLabel}
                                </span>
                              )}
                              <span className="text-[15px] font-semibold text-[#252B29]">
                                {item.name}
                              </span>
                              <span className="text-[14px] font-bold text-[#244B40]">
                                {formatPriceFromPaise(
                                  item.pricePaise,
                                  currencyCode,
                                )}
                              </span>
                              {item.isFeatured && (
                                <span className="rounded-full border border-[#E4BD63] bg-[#FAF3DF] px-2 py-0.5 text-[11px] font-semibold text-[#252B29]">
                                  ★ Featured
                                </span>
                              )}
                              {!item.isAvailable && (
                                <span className="rounded-full bg-red-50 border border-red-200 px-2 py-0.5 text-[11px] font-semibold text-red-800">
                                  Sold Out
                                </span>
                              )}
                            </div>
                            {item.description && (
                              <p className="text-[12px] text-[#626B65]">
                                {item.description}
                              </p>
                            )}
                            {catObj && (
                              <p className="text-[11px] font-medium text-[#626B65]">
                                Category: {catObj.name}
                              </p>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() =>
                                void handleToggleItemAvailability(item)
                              }
                              className={`rounded-lg border px-2.5 py-1 text-[12px] font-medium cursor-pointer ${
                                item.isAvailable
                                  ? 'border-[#A8BFA5] bg-[#EEF3EC] text-[#244B40]'
                                  : 'border-[#DDE4DC] bg-[#F7F7F2] text-[#626B65]'
                              }`}
                            >
                              {item.isAvailable ? 'In Stock' : 'Mark Available'}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleStartEditItem(item)}
                              aria-label={`Edit ${item.name}`}
                              className="rounded-lg p-1.5 text-[#626B65] hover:bg-[#F7F7F2] hover:text-[#252B29] cursor-pointer"
                            >
                              <Edit3 className="h-4 w-4" aria-hidden />
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleDeleteItem(item)}
                              aria-label={`Delete ${item.name}`}
                              className="rounded-lg p-1.5 text-red-700 hover:bg-red-50 cursor-pointer"
                            >
                              <Trash2 className="h-4 w-4" aria-hidden />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUB-SECTION 3: TABLES & QR STANDEES */}
      {subSection === 'tables' && (
        <div className="grid gap-6 lg:grid-cols-12">
          {/* LEFT: Add Table & Table List */}
          <div className="lg:col-span-6 space-y-5">
            <form
              onSubmit={(e) => void handleAddTable(e)}
              className="rounded-2xl border border-[#DDE4DC] bg-[#FFFFFF] p-5 shadow-2xs space-y-4"
            >
              <div>
                <h3 className="text-[16px] font-semibold text-[#252B29]">
                  Add Restaurant Table
                </h3>
                <p className="text-[12px] text-[#626B65] mt-0.5">
                  Each table gets a dedicated QR URL (<code className="font-mono">/r/{business.slug}/table/[table-key]</code>) so guests see their table badge automatically.
                </p>
              </div>

              <div className="grid gap-3.5 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label
                    htmlFor="tableNumberInput"
                    className="block text-[13px] font-medium text-[#252B29]"
                  >
                    Table Number / Name
                  </label>
                  <input
                    id="tableNumberInput"
                    type="text"
                    required
                    maxLength={40}
                    placeholder="e.g. Table 01, T4, Patio 2"
                    value={tableNumber}
                    onChange={(e) => setTableNumber(e.target.value)}
                    className="block min-h-10 w-full rounded-xl border border-[#87928A] bg-[#FFFFFF] px-3 py-2 text-[14px] text-[#252B29] focus:border-[#244B40] focus:outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="tableLabelInput"
                    className="block text-[13px] font-medium text-[#252B29]"
                  >
                    Zone / Seating Label (Optional)
                  </label>
                  <input
                    id="tableLabelInput"
                    type="text"
                    maxLength={80}
                    placeholder="e.g. Window Corner, Rooftop"
                    value={tableLabel}
                    onChange={(e) => setTableLabel(e.target.value)}
                    className="block min-h-10 w-full rounded-xl border border-[#87928A] bg-[#FFFFFF] px-3 py-2 text-[14px] text-[#252B29] focus:border-[#244B40] focus:outline-none"
                  />
                </div>
              </div>

              {tableNumber.trim() && (
                <p className="text-[12px] text-[#626B65]">
                  Generated Table QR Link:{' '}
                  <code className="rounded bg-[#F7F7F2] px-1.5 py-0.5 font-mono text-[#244B40]">
                    /r/{business.slug}/table/{deriveTableKey(tableNumber) || 'table-1'}
                  </code>
                </p>
              )}

              <Button type="submit" variant="primary">
                <Plus className="h-4 w-4" aria-hidden /> Add Table &amp; Generate QR
              </Button>
            </form>

            {/* Tables List */}
            <div className="rounded-2xl border border-[#DDE4DC] bg-[#FFFFFF] p-5 shadow-2xs space-y-3">
              <h4 className="text-[14px] font-semibold uppercase tracking-wider text-[#626B65]">
                Select QR Standee Target ({tables.length} Tables)
              </h4>

              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => setSelectedQrTableId('general')}
                  className={`w-full rounded-xl border p-3.5 text-left transition-colors cursor-pointer ${
                    selectedQrTableId === 'general'
                      ? 'border-[#244B40] bg-[#EEF3EC]/70 ring-1 ring-[#244B40]'
                      : 'border-[#DDE4DC] bg-[#FFFFFF] hover:bg-[#F7F7F2]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[14px] font-semibold text-[#252B29]">
                      General Digital Menu QR (Counter / Takeaway)
                    </span>
                    <span className="rounded-full bg-[#244B40] px-2.5 py-0.5 text-[11px] font-semibold text-[#FFFFFF]">
                      /r/{business.slug}/menu
                    </span>
                  </div>
                </button>

                {tables.map((tbl) => {
                  const isSelected = selectedQrTableId === tbl.id;
                  return (
                    <div
                      key={tbl.id}
                      className={`flex items-center justify-between gap-2 rounded-xl border p-3.5 transition-colors ${
                        isSelected
                          ? 'border-[#244B40] bg-[#EEF3EC]/70 ring-1 ring-[#244B40]'
                          : 'border-[#DDE4DC] bg-[#FFFFFF]'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => setSelectedQrTableId(tbl.id)}
                        className="flex-1 text-left cursor-pointer"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[15px] font-semibold text-[#252B29]">
                            {tbl.tableNumber}
                          </span>
                          {tbl.tableLabel && (
                            <span className="text-[12px] text-[#626B65]">
                              · {tbl.tableLabel}
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 font-mono text-[12px] text-[#244B40]">
                          /r/{business.slug}/table/{tbl.tableKey}
                        </p>
                      </button>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={() => setSelectedQrTableId(tbl.id)}
                        >
                          <QrCode className="h-3.5 w-3.5" aria-hidden /> Preview QR
                        </Button>
                        <button
                          type="button"
                          onClick={() => void handleDeleteTable(tbl)}
                          aria-label={`Delete ${tbl.tableNumber}`}
                          className="rounded-lg p-2 text-red-700 hover:bg-red-50 cursor-pointer"
                        >
                          <Trash2 className="h-4 w-4" aria-hidden />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* RIGHT: Live Table QR Standee Preview & Export */}
          <div className="lg:col-span-6 space-y-5">
            <div className="rounded-2xl border border-[#DDE4DC] bg-[#FFFFFF] p-5 shadow-2xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-[#DDE4DC] pb-3">
                <div>
                  <h3 className="text-[16px] font-semibold text-[#252B29]">
                    {activeQrTable
                      ? `Table Standee Preview — ${activeQrTable.tableNumber}`
                      : 'General Digital Menu Standee Preview'}
                  </h3>
                  <p className="font-mono text-[12px] text-[#244B40] break-all">
                    {activeQrUrl}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => void handleCopyActiveQrUrl()}
                  >
                    {copiedUrl ? (
                      <Check className="h-3.5 w-3.5 text-[#244B40]" aria-hidden />
                    ) : (
                      <Copy className="h-3.5 w-3.5" aria-hidden />
                    )}
                    {copiedUrl ? 'Copied' : 'Copy URL'}
                  </Button>
                  {isBusinessLive && profile?.isEnabled && (
                    <a
                      href={activeQrUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex min-h-10 items-center gap-1 rounded-xl border border-[#87928A] bg-[#FFFFFF] px-3 py-1.5 text-[13px] font-medium text-[#252B29] hover:border-[#244B40]"
                    >
                      <ExternalLink className="h-3.5 w-3.5" aria-hidden /> Test
                    </a>
                  )}
                </div>
              </div>

              {/* Template & Accent selector */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap gap-1.5">
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
                      className={`rounded-lg border px-2.5 py-1 text-[12px] font-medium cursor-pointer ${
                        qrSettings.template === tpl
                          ? 'border-[#244B40] bg-[#244B40] text-[#FFFFFF]'
                          : 'border-[#DDE4DC] bg-[#F7F7F2] text-[#252B29]'
                      }`}
                    >
                      {QR_TEMPLATE_DEFAULTS[tpl].name.split('—')[0].trim()}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-1.5">
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
                      className={`h-6 w-6 rounded-full border-2 cursor-pointer ${
                        qrSettings.accentColor.toLowerCase() ===
                        preset.hex.toLowerCase()
                          ? 'border-[#252B29] scale-110'
                          : 'border-white'
                      }`}
                      style={{ backgroundColor: preset.hex }}
                    />
                  ))}
                </div>
              </div>

              <div className="flex justify-center rounded-xl border border-[#DDE4DC] bg-[#F7F7F2] p-4">
                <div className="w-full max-w-[340px] overflow-hidden rounded-xl bg-[#FFFFFF] shadow-md">
                  <canvas
                    ref={qrCanvasRef}
                    aria-label="Table QR Standee Preview"
                    className="block h-auto w-full"
                  />
                </div>
              </div>

              <div className="grid gap-2.5 sm:grid-cols-2 pt-2">
                <Button
                  type="button"
                  variant="primary"
                  onClick={() => void handleDownloadTableQrPng()}
                >
                  <Download className="h-4 w-4" aria-hidden /> Download High-Res PNG
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => void handleDownloadTableQrPdf()}
                >
                  <FileText className="h-4 w-4" aria-hidden /> Download Printable A5 PDF
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUB-SECTION 4: GAMES & POINT RULES */}
      {subSection === 'games' && (
        <RestaurantGamesConfigPanel
          business={business}
          onStatus={notifyStatus}
          onError={(err) => setErrorMessage(err)}
        />
      )}

      {/* SUB-SECTION 5: LOYALTY STARS, REWARDS & TABLE EXTRAS */}
      {subSection === 'loyalty' && (
        <RestaurantLoyaltyAndExtrasPanel
          business={business}
          onStatus={notifyStatus}
          onError={(err) => setErrorMessage(err)}
        />
      )}

      {/* SUB-SECTION 6: LIVE FLOOR, STAFF PIN & ENGAGEMENT ANALYTICS */}
      {subSection === 'floor_staff' && (
        <RestaurantFloorAndStaffPanel
          business={business}
          profile={profile}
          tables={tables}
          mode="owner"
          onProfileUpdated={(updatedProf) => {
            setProfile(updatedProf);
            onProfileChanged?.(updatedProf);
          }}
          onStatus={notifyStatus}
          onError={(err) => setErrorMessage(err)}
        />
      )}
    </div>
  );
}
