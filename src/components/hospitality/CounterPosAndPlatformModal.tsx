import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ChefHat,
  Minus,
  Plus,
  Search,
  ShoppingBag,
  Trash2,
  Utensils,
  X,
} from 'lucide-react';
import type {
  RestaurantCurrencyCode,
  RestaurantMenuCategory,
  RestaurantMenuItem,
  RestaurantOrderSource,
  RestaurantTable,
} from '../../types/restaurant';
import { businessRepository } from '../../services/storage';
import { formatPriceFromPaise } from '../../utils/restaurantValidation';
import {
  calculateBillTotals,
  ORDER_SOURCE_METADATA,
  PLATFORM_ORDER_SOURCES,
} from '../../utils/hospitalityHelpers';

interface CartLine {
  item: RestaurantMenuItem;
  quantity: number;
  notes: string;
}

interface Props {
  mode: 'pos' | 'platform';
  businessId: string;
  tables: RestaurantTable[];
  categories: RestaurantMenuCategory[];
  items: RestaurantMenuItem[];
  currencyCode: RestaurantCurrencyCode;
  gstPercent: number;
  serviceChargePercent: number;
  initialTableId?: string | null;
  disableHotelRooms?: boolean;
  onClose: () => void;
  onOrderCreated: (summary: string) => void;
}

export function CounterPosAndPlatformModal({
  mode,
  businessId,
  tables,
  categories,
  items,
  currencyCode,
  gstPercent,
  serviceChargePercent,
  initialTableId = null,
  disableHotelRooms = false,
  onClose,
  onOrderCreated,
}: Props) {
  const activeTables = useMemo(
    () => tables.filter((t) => t.isActive),
    [tables],
  );
  const availableItems = useMemo(
    () => items.filter((i) => i.isAvailable),
    [items],
  );

  // Order Channel & Customer Metadata
  const [posChannel, setPosChannel] = useState<
    'pos_dine_in' | 'pos_takeaway' | 'pos_delivery'
  >('pos_dine_in');
  const [platformChannel, setPlatformChannel] =
    useState<RestaurantOrderSource>('swiggy');
  const [selectedTableId, setSelectedTableId] = useState<string>(
    initialTableId ?? activeTables[0]?.id ?? '',
  );
  const [platformOrderNumber, setPlatformOrderNumber] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [kitchenNote, setKitchenNote] = useState('');
  const [packagingRupees, setPackagingRupees] = useState('0');

  // Menu Search & Category Filter
  const [selectedCatId, setSelectedCatId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Cart Lines
  const [cart, setCart] = useState<CartLine[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filteredDishes = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return availableItems.filter((item) => {
      if (selectedCatId !== 'all' && item.categoryId !== selectedCatId) {
        return false;
      }
      if (q && !item.name.toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });
  }, [availableItems, selectedCatId, searchQuery]);

  function addItem(item: RestaurantMenuItem) {
    setCart((prev) => {
      const idx = prev.findIndex((c) => c.item.id === item.id);
      if (idx !== -1) {
        const next = [...prev];
        next[idx] = { ...next[idx], quantity: next[idx].quantity + 1 };
        return next;
      }
      return [...prev, { item, quantity: 1, notes: '' }];
    });
  }

  function updateQty(itemId: string, delta: number) {
    setCart((prev) =>
      prev
        .map((c) =>
          c.item.id === itemId ? { ...c, quantity: c.quantity + delta } : c,
        )
        .filter((c) => c.quantity > 0),
    );
  }

  function updateItemNote(itemId: string, notes: string) {
    setCart((prev) =>
      prev.map((c) => (c.item.id === itemId ? { ...c, notes } : c)),
    );
  }

  const subtotalPaise = cart.reduce(
    (sum, c) => sum + c.item.pricePaise * c.quantity,
    0,
  );
  const packagingPaise =
    mode === 'platform' || posChannel !== 'pos_dine_in'
      ? Math.max(0, Math.round((Number.parseFloat(packagingRupees) || 0) * 100))
      : 0;
  const totals = calculateBillTotals({
    subtotalPaise: subtotalPaise + packagingPaise,
    gstPercent,
    serviceChargePercent:
      mode === 'pos' && posChannel === 'pos_dine_in' ? serviceChargePercent : 0,
  });

  async function handleSubmitOrder(e: React.FormEvent) {
    e.preventDefault();
    if (cart.length === 0) {
      setError('Please add at least 1 dish from the menu.');
      return;
    }
    const orderSource: RestaurantOrderSource =
      mode === 'platform' ? platformChannel : posChannel;

    if (orderSource === 'pos_dine_in' && !selectedTableId) {
      setError(
        disableHotelRooms
          ? 'Please select a table for Dine-In.'
          : 'Please select a dining table or hotel room for Dine-In.',
      );
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const created = await businessRepository.createPosOrPlatformOrder({
        businessId,
        orderSource,
        tableId: orderSource === 'pos_dine_in' ? selectedTableId : null,
        platformOrderNumber:
          mode === 'platform' ? platformOrderNumber.trim() || null : null,
        customerName: customerName.trim() || null,
        customerPhone: customerPhone.trim() || null,
        kitchenNote: kitchenNote.trim() || null,
        packagingPaise,
        items: cart.map((c) => ({
          itemId: c.item.id,
          quantity: c.quantity,
          notes: c.notes.trim() || null,
        })),
        staffLabel: 'Counter POS',
      });
      const srcMeta = ORDER_SOURCE_METADATA[orderSource];
      const label = created.platformOrderNumber
        ? `${srcMeta.shortLabel} #${created.platformOrderNumber}`
        : created.tableNumber
          ? `${created.tableNumber} (${srcMeta.shortLabel})`
          : srcMeta.label;
      onOrderCreated(`Sent ${label} straight to Kitchen KOT!`);
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  const modalContent = (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={
        mode === 'platform'
          ? 'Add Aggregator Platform Order'
          : 'Counter POS Billing Screen'
      }
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/70 p-2 sm:p-4 backdrop-blur-xs"
    >
      <div className="flex h-[92vh] w-full max-w-7xl flex-col overflow-hidden rounded-3xl border border-[#1E1B4B]/20 bg-[#F8F9FA] shadow-2xl">
        {/* Top Modal Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-[#1E1B4B] px-5 py-3.5 text-white">
          <div className="flex flex-wrap items-center gap-2">
            {mode === 'pos' ? (
              <div className="flex items-center gap-1.5 rounded-xl bg-white/10 p-1">
                {(
                  [
                    { id: 'pos_dine_in', label: 'Dine-In' },
                    { id: 'pos_takeaway', label: 'Takeaway' },
                    { id: 'pos_delivery', label: 'Delivery' },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setPosChannel(tab.id)}
                    className={`rounded-lg px-3.5 py-1.5 text-[12.5px] font-extrabold transition-all cursor-pointer ${
                      posChannel === tab.id
                        ? 'bg-[#D2DB76] text-[#1E1B4B]'
                        : 'text-indigo-100 hover:bg-white/10'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] font-black uppercase tracking-wider text-[#D2DB76] mr-1">
                  Platform Intake:
                </span>
                {PLATFORM_ORDER_SOURCES.map((src) => {
                  const meta = ORDER_SOURCE_METADATA[src];
                  const active = platformChannel === src;
                  return (
                    <button
                      key={src}
                      type="button"
                      onClick={() => setPlatformChannel(src)}
                      className={`rounded-lg px-2.5 py-1 text-[11.5px] font-extrabold transition-all cursor-pointer ${
                        active
                          ? 'bg-[#D2DB76] text-[#1E1B4B]'
                          : 'bg-white/10 text-indigo-100 hover:bg-white/20'
                      }`}
                    >
                      {meta.shortLabel}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <div className="relative w-48 sm:w-64">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-indigo-200"
                aria-hidden
              />
              <input
                type="search"
                placeholder="Search dish…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-9 w-full rounded-xl bg-white/10 pl-9 pr-3 text-[12.5px] font-semibold text-white placeholder:text-indigo-200/75 focus:bg-white/20 focus:outline-none"
              />
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close order modal"
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 text-white hover:bg-white/20 cursor-pointer"
            >
              <X className="h-5 w-5" aria-hidden />
            </button>
          </div>
        </div>

        {/* 3-Column Body */}
        <div className="grid flex-1 min-h-0 lg:grid-cols-12">
          {/* COLUMN 1 (Left): Order Ticket & Payable Summary */}
          <form
            onSubmit={(e) => void handleSubmitOrder(e)}
            className="flex flex-col justify-between border-r border-slate-200 bg-white p-4 lg:col-span-4 min-h-0 overflow-y-auto space-y-3"
          >
            <div className="space-y-3">
              {error && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[12px] font-bold text-red-900">
                  {error}
                </div>
              )}

              {mode === 'platform' && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] font-bold text-amber-900">
                  Routes straight to Kitchen KOT — kept completely separate from dining table bills.
                </div>
              )}

              {/* Table/Room Selector (POS Dine-In) OR Platform Order # */}
              {mode === 'pos' && posChannel === 'pos_dine_in' ? (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <label className="block text-[10.5px] font-extrabold uppercase tracking-wider text-slate-500">
                      {disableHotelRooms
                        ? 'Select Table'
                        : 'Select Table / Hotel Room'}
                    </label>
                    {selectedTableId && (
                      <span className="rounded-full bg-[#D2DB76]/55 px-2 py-0.5 text-[10px] font-black text-[#1E1B4B]">
                        {activeTables.find((t) => t.id === selectedTableId)
                          ?.tableNumber ?? 'Selected'}
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-1.5 max-h-24 overflow-y-auto pr-0.5">
                    {activeTables.map((t) => {
                      const isSel = selectedTableId === t.id;
                      const isBusyTbl = Boolean(t.occupiedSince);
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => setSelectedTableId(t.id)}
                          className={`rounded-xl border px-2 py-1.5 text-center text-[11.5px] font-extrabold transition-all cursor-pointer truncate ${
                            isSel
                              ? 'border-[#1E1B4B] bg-[#1E1B4B] text-[#D2DB76] shadow-2xs'
                              : isBusyTbl
                                ? 'border-amber-300 bg-[#FFFBEB] text-amber-900 hover:border-amber-500'
                                : 'border-emerald-300 bg-[#ECFDF5] text-emerald-900 hover:border-emerald-500'
                          }`}
                        >
                          {t.locationType === 'room' ? '🏨 ' : ''}
                          {t.tableNumber}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : mode === 'platform' ? (
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    placeholder={`${ORDER_SOURCE_METADATA[platformChannel].shortLabel} Order # (e.g. 4512)`}
                    value={platformOrderNumber}
                    onChange={(e) => setPlatformOrderNumber(e.target.value)}
                    className="h-10 rounded-xl border border-slate-300 bg-[#F8F9FA] px-3 text-[12.5px] font-bold text-slate-900"
                  />
                  <input
                    type="number"
                    min={0}
                    step="1"
                    placeholder="Packaging ₹"
                    value={packagingRupees}
                    onChange={(e) => setPackagingRupees(e.target.value)}
                    className="h-10 rounded-xl border border-slate-300 bg-[#F8F9FA] px-3 text-[12.5px] font-bold text-slate-900"
                  />
                </div>
              ) : null}

              {/* Guest Name + Phone (Repeat Visit & Loyalty Detection) */}
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder="Guest Name (Optional)"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="h-9 rounded-xl border border-slate-200 bg-[#F8F9FA] px-3 text-[12.5px] font-semibold text-slate-900"
                />
                <input
                  type="tel"
                  placeholder="Phone (Repeat Check)"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  className="h-9 rounded-xl border border-slate-200 bg-[#F8F9FA] px-3 text-[12.5px] font-semibold text-slate-900"
                />
              </div>

              <input
                type="text"
                maxLength={300}
                placeholder="Kitchen Note (e.g. No onion, extra spicy)…"
                value={kitchenNote}
                onChange={(e) => setKitchenNote(e.target.value)}
                className="h-9 w-full rounded-xl border border-amber-200 bg-amber-50/50 px-3 text-[12px] font-semibold text-amber-950 placeholder:text-amber-700/70"
              />

              {/* Cart Items */}
              <div className="max-h-56 overflow-y-auto divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-[#F8F9FA] px-3">
                {cart.length === 0 ? (
                  <div className="py-8 text-center text-[12.5px] font-semibold text-slate-400">
                    <ShoppingBag
                      className="mx-auto h-6 w-6 mb-1.5 opacity-60"
                      aria-hidden
                    />
                    Tap dishes on the right to build this KOT
                  </div>
                ) : (
                  cart.map((line) => (
                    <div key={line.item.id} className="py-2.5 space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[12.5px] font-extrabold text-slate-900 truncate">
                          {line.item.name}
                        </span>
                        <span className="text-[12.5px] font-black text-[#1E1B4B] tabular-nums shrink-0">
                          {formatPriceFromPaise(
                            line.item.pricePaise * line.quantity,
                            currencyCode,
                          )}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <div className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-0.5">
                          <button
                            type="button"
                            onClick={() => updateQty(line.item.id, -1)}
                            className="inline-flex h-6 w-6 items-center justify-center rounded hover:bg-slate-100 cursor-pointer"
                          >
                            <Minus className="h-3 w-3" aria-hidden />
                          </button>
                          <span className="w-5 text-center text-[12px] font-black tabular-nums">
                            {line.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => updateQty(line.item.id, 1)}
                            className="inline-flex h-6 w-6 items-center justify-center rounded hover:bg-slate-100 cursor-pointer"
                          >
                            <Plus className="h-3 w-3" aria-hidden />
                          </button>
                        </div>
                        <input
                          type="text"
                          placeholder="Item note…"
                          value={line.notes}
                          onChange={(e) =>
                            updateItemNote(line.item.id, e.target.value)
                          }
                          className="h-7 flex-1 rounded-lg border border-slate-200 bg-white px-2 text-[11px] font-medium"
                        />
                        <button
                          type="button"
                          onClick={() => updateQty(line.item.id, -999)}
                          className="text-slate-400 hover:text-red-600 cursor-pointer"
                          aria-label={`Remove ${line.item.name}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* High-Contrast PAYABLE ₹ Summary Box & Submit */}
            <div className="space-y-2.5 border-t border-slate-200 pt-3">
              <div className="space-y-1 text-[12px] font-semibold text-slate-600">
                <div className="flex justify-between">
                  <span>Items Subtotal</span>
                  <span className="tabular-nums">
                    {formatPriceFromPaise(subtotalPaise, currencyCode)}
                  </span>
                </div>
                {packagingPaise > 0 && (
                  <div className="flex justify-between">
                    <span>Packaging</span>
                    <span className="tabular-nums">
                      {formatPriceFromPaise(packagingPaise, currencyCode)}
                    </span>
                  </div>
                )}
                {totals.gstPercent > 0 && (
                  <div className="flex justify-between">
                    <span>GST ({totals.gstPercent}%)</span>
                    <span className="tabular-nums">
                      {formatPriceFromPaise(totals.gstPaise, currencyCode)}
                    </span>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between rounded-2xl bg-[#D2DB76] px-4 py-3 text-[#1E1B4B]">
                <span className="text-[12px] font-black uppercase tracking-wider">
                  PAYABLE
                </span>
                <span className="text-[20px] font-black tabular-nums">
                  {formatPriceFromPaise(totals.grandTotalPaise, currencyCode)}
                </span>
              </div>

              <button
                type="submit"
                disabled={submitting || cart.length === 0}
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#1E1B4B] px-4 text-[13.5px] font-black text-[#D2DB76] shadow-sm hover:bg-[#2E2A6E] disabled:opacity-50 cursor-pointer"
              >
                <ChefHat className="h-4.5 w-4.5" aria-hidden />
                {submitting
                  ? 'Sending to Kitchen…'
                  : 'Send Straight to Kitchen (KOT)'}
              </button>
            </div>
          </form>

          {/* COLUMN 2 (Middle): Category Strip */}
          <div className="flex lg:flex-col gap-1.5 overflow-x-auto lg:overflow-y-auto border-b lg:border-b-0 lg:border-r border-slate-200 bg-white/70 p-3 lg:col-span-2">
            <button
              type="button"
              onClick={() => setSelectedCatId('all')}
              className={`shrink-0 rounded-xl px-3 py-2 text-left text-[12px] font-extrabold transition-all cursor-pointer ${
                selectedCatId === 'all'
                  ? 'bg-[#1E1B4B] text-[#D2DB76]'
                  : 'text-slate-700 hover:bg-slate-100'
              }`}
            >
              All Dishes ({availableItems.length})
            </button>
            {categories
              .filter((c) => c.isActive)
              .map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedCatId(cat.id)}
                  className={`shrink-0 rounded-xl px-3 py-2 text-left text-[12px] font-extrabold transition-all cursor-pointer ${
                    selectedCatId === cat.id
                      ? 'bg-[#1E1B4B] text-[#D2DB76]'
                      : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {cat.name}
                </button>
              ))}
          </div>

          {/* COLUMN 3 (Right): Uniform Square Dish Cards Grid */}
          <div className="overflow-y-auto p-4 lg:col-span-6">
            {filteredDishes.length === 0 ? (
              <p className="py-12 text-center text-[13px] font-semibold text-slate-500">
                No matching dishes found.
              </p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
                {filteredDishes.map((dish) => {
                  const inCart = cart.find((c) => c.item.id === dish.id);
                  const isVeg =
                    dish.dietaryTag === 'veg' || dish.dietaryTag === 'vegan';
                  const isNonVeg = dish.dietaryTag === 'non_veg';

                  return (
                    <button
                      key={dish.id}
                      type="button"
                      onClick={() => addItem(dish)}
                      className={`group flex flex-col justify-between overflow-hidden rounded-2xl border-2 bg-white text-left transition-all active:scale-[0.97] cursor-pointer ${
                        inCart
                          ? 'border-[#1E1B4B] shadow-sm'
                          : 'border-slate-200 hover:border-[#1E1B4B]/50'
                      }`}
                    >
                      {/* Crisp Compact Dish Photo OR Sleek Fork-and-Spoon Fallback */}
                      <div className="relative h-24 w-full bg-[#F8F9FA] flex items-center justify-center overflow-hidden">
                        {dish.imageUrl ? (
                          <img
                            src={dish.imageUrl}
                            alt={dish.name}
                            className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-200"
                          />
                        ) : (
                          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#1E1B4B]/8 text-[#1E1B4B]/60">
                            <Utensils className="h-6 w-6" aria-hidden />
                          </div>
                        )}
                        {inCart && (
                          <span className="absolute right-2 top-2 rounded-full bg-[#1E1B4B] px-2 py-0.5 text-[11px] font-black text-[#D2DB76] shadow-xs">
                            {inCart.quantity}×
                          </span>
                        )}
                        {(isVeg || isNonVeg) && (
                          <span
                            className={`absolute left-2 top-2 flex h-4 w-4 items-center justify-center rounded-xs border bg-white ${
                              isVeg ? 'border-emerald-600' : 'border-red-600'
                            }`}
                          >
                            <span
                              className={`h-2 w-2 rounded-full ${
                                isVeg ? 'bg-emerald-600' : 'bg-red-600'
                              }`}
                            />
                          </span>
                        )}
                      </div>

                      <div className="p-2.5 space-y-1.5">
                        <p className="line-clamp-2 text-[12.5px] font-extrabold text-slate-900 leading-snug">
                          {dish.name}
                        </p>
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-[13px] font-black text-[#1E1B4B] tabular-nums">
                            {formatPriceFromPaise(
                              dish.pricePaise,
                              currencyCode,
                            )}
                          </span>
                          <span className="rounded-lg bg-[#1E1B4B]/8 px-2 py-0.5 text-[10.5px] font-black text-[#1E1B4B] group-hover:bg-[#1E1B4B] group-hover:text-[#D2DB76] transition-colors">
                            + Add
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined'
    ? createPortal(modalContent, document.body)
    : modalContent;
}
