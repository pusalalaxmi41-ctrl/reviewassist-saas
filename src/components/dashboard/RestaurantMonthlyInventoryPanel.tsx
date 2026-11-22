import { useState } from 'react';
import {
  Package,
  AlertTriangle,
  Receipt,
  Plus,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Coffee,
  CheckCircle2,
  Calendar,
} from 'lucide-react';
import type { Business } from '../../types/business';
import type {
  MonthlyInventoryEntryType,
  RestaurantBusinessMode,
  RestaurantCurrencyCode,
  RestaurantMonthlyInventoryItem,
} from '../../types/restaurant';
import { businessRepository } from '../../services/storage';
import {
  CURRENCY_METADATA,
  DEFAULT_INVENTORY_CATEGORIES,
  formatMonthKeyLabel,
  formatPriceFromPaise,
  parseMajorCurrencyToPaise,
} from '../../utils/restaurantValidation';
import { Button } from '../common/Button';

interface Props {
  business: Business;
  currencyCode: RestaurantCurrencyCode;
  businessMode: RestaurantBusinessMode;
  selectedMonthKey: string;
  entries: RestaurantMonthlyInventoryItem[];
  onMonthKeyChange: (nextMonthKey: string) => void;
  onEntriesChanged: (next: RestaurantMonthlyInventoryItem[]) => void;
  onStatus: (msg: string) => void;
  onError: (err: string) => void;
}

function shiftMonthKey(monthKey: string, deltaMonths: number): string {
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(monthKey);
  const now = new Date();
  const baseYear = match ? Number.parseInt(match[1], 10) : now.getFullYear();
  const baseMonth = match
    ? Number.parseInt(match[2], 10) - 1
    : now.getMonth();
  const shifted = new Date(baseYear, baseMonth + deltaMonths, 1);
  return `${shifted.getFullYear()}-${String(shifted.getMonth() + 1).padStart(2, '0')}`;
}

export function RestaurantMonthlyInventoryPanel({
  business,
  currencyCode,
  businessMode,
  selectedMonthKey,
  entries,
  onMonthKeyChange,
  onEntriesChanged,
  onStatus,
  onError,
}: Props) {
  const [entryType, setEntryType] =
    useState<MonthlyInventoryEntryType>('stock_purchase');
  const [category, setCategory] = useState<string>('Dairy & Milk');
  const [itemName, setItemName] = useState('');
  const [quantityLabel, setQuantityLabel] = useState('');
  const [costMajor, setCostMajor] = useState('');
  const [notes, setNotes] = useState('');
  const [lowStockAlert, setLowStockAlert] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [filterMode, setFilterMode] = useState<
    'all' | 'stock_purchase' | 'monthly_expense' | 'low_stock'
  >('all');

  const stockCostPaise = entries
    .filter((e) => e.entryType === 'stock_purchase')
    .reduce((sum, e) => sum + e.amountPaise, 0);

  const expenseCostPaise = entries
    .filter((e) => e.entryType === 'monthly_expense')
    .reduce((sum, e) => sum + e.amountPaise, 0);

  const lowStockItems = entries.filter((e) => e.lowStockAlert);
  const totalSpendPaise = stockCostPaise + expenseCostPaise;

  const filteredEntries = entries.filter((entry) => {
    if (filterMode === 'stock_purchase') {
      return entry.entryType === 'stock_purchase';
    }
    if (filterMode === 'monthly_expense') {
      return entry.entryType === 'monthly_expense';
    }
    if (filterMode === 'low_stock') {
      return entry.lowStockAlert;
    }
    return true;
  });

  function handleSelectEntryType(nextType: MonthlyInventoryEntryType) {
    setEntryType(nextType);
    const matchingDefault = DEFAULT_INVENTORY_CATEGORIES.find(
      (c) => c.suggestedType === nextType,
    );
    if (matchingDefault) {
      setCategory(matchingDefault.label);
    }
  }

  function handleCafeQuickFill(preset: {
    category: string;
    itemName: string;
    quantityLabel: string;
  }) {
    setEntryType('stock_purchase');
    setCategory(preset.category);
    setItemName(preset.itemName);
    setQuantityLabel(preset.quantityLabel);
  }

  async function handleAddEntry(e: React.FormEvent) {
    e.preventDefault();
    const parsedCost = parseMajorCurrencyToPaise(costMajor || '0');
    if (!parsedCost.ok) {
      onError(parsedCost.error);
      return;
    }

    setSaving(true);
    try {
      const created =
        await businessRepository.createRestaurantMonthlyInventoryItem(
          business.id,
          {
            monthKey: selectedMonthKey,
            entryType,
            category,
            itemName: itemName.trim(),
            quantityLabel: quantityLabel.trim() || null,
            amountPaise: parsedCost.pricePaise,
            lowStockAlert,
            notes: notes.trim() || null,
          },
        );
      onEntriesChanged([created, ...entries]);
      setItemName('');
      setQuantityLabel('');
      setCostMajor('');
      setNotes('');
      setLowStockAlert(false);
      onStatus(
        `Logged "${created.itemName}" (${formatPriceFromPaise(created.amountPaise, currencyCode)}) in ${formatMonthKeyLabel(selectedMonthKey)}.`,
      );
    } catch (err) {
      onError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleLowStock(item: RestaurantMonthlyInventoryItem) {
    setBusyId(item.id);
    try {
      const updated =
        await businessRepository.updateRestaurantMonthlyInventoryItem(
          business.id,
          item.id,
          {
            monthKey: item.monthKey,
            entryType: item.entryType,
            category: item.category,
            itemName: item.itemName,
            quantityLabel: item.quantityLabel,
            amountPaise: item.amountPaise,
            lowStockAlert: !item.lowStockAlert,
            notes: item.notes,
          },
        );
      onEntriesChanged(
        entries.map((e) => (e.id === updated.id ? updated : e)),
      );
      onStatus(
        updated.lowStockAlert
          ? `Flagged "${updated.itemName}" as Low Stock ⚠️`
          : `Marked "${updated.itemName}" as Restocked ✓`,
      );
    } catch (err) {
      onError((err as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  async function handleDeleteEntry(item: RestaurantMonthlyInventoryItem) {
    setBusyId(item.id);
    try {
      await businessRepository.deleteRestaurantMonthlyInventoryItem(
        business.id,
        item.id,
      );
      onEntriesChanged(entries.filter((e) => e.id !== item.id));
      onStatus(`Deleted "${item.itemName}".`);
    } catch (err) {
      onError((err as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6 animate-fadeSlideUp">
      {/* Header + Month Selector */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-[28px] sm:text-[32px] font-extrabold tracking-tight text-[#111827]">
              Monthly Stock &amp; Expenses
            </h1>
            <span className="rounded-full bg-[#D2DB76]/45 px-3 py-1 text-[11px] font-extrabold uppercase tracking-wider text-[#1E1B4B]">
              {businessMode === 'cafe' ? 'Cafe Mode' : 'Restaurant Mode'}
            </span>
          </div>
          <p className="mt-1 text-[14px] text-[#6B7280]">
            Simple monthly stock purchases, vendor bills, and low-stock reorder flags — zero complex per-gram POS math.
          </p>
        </div>

        {/* Month Selector Pill */}
        <div className="bistro-card inline-flex items-center gap-1.5 px-2.5 py-2 self-start sm:self-auto">
          <button
            type="button"
            aria-label="Previous month"
            onClick={() =>
              onMonthKeyChange(shiftMonthKey(selectedMonthKey, -1))
            }
            className="flex h-9 w-9 items-center justify-center rounded-xl text-[#1E1B4B] hover:bg-[#F8F9FA] cursor-pointer"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden />
          </button>

          <div className="relative flex items-center gap-1.5 px-2">
            <Calendar className="h-4 w-4 text-[#1E1B4B]" aria-hidden />
            <span className="text-[14px] font-extrabold text-[#111827] whitespace-nowrap">
              {formatMonthKeyLabel(selectedMonthKey)}
            </span>
            <input
              type="month"
              aria-label="Select month"
              value={selectedMonthKey}
              onChange={(e) => {
                if (/^\d{4}-(0[1-9]|1[0-2])$/.test(e.target.value)) {
                  onMonthKeyChange(e.target.value);
                }
              }}
              className="absolute inset-0 opacity-0 cursor-pointer"
            />
          </div>

          <button
            type="button"
            aria-label="Next month"
            onClick={() =>
              onMonthKeyChange(shiftMonthKey(selectedMonthKey, 1))
            }
            className="flex h-9 w-9 items-center justify-center rounded-xl text-[#1E1B4B] hover:bg-[#F8F9FA] cursor-pointer"
          >
            <ChevronRight className="h-4 w-4" aria-hidden />
          </button>
        </div>
      </div>

      {/* Cafe Mode Quick Restock Strip */}
      {businessMode === 'cafe' && (
        <div className="rounded-2xl border border-[#D2DB76] bg-[#D2DB76]/25 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Coffee className="h-5 w-5 shrink-0 text-[#1E1B4B]" aria-hidden />
            <p className="text-[13px] font-bold text-[#1E1B4B]">
              Cafe Fast-Restock Templates — tap to pre-fill common cafe stock:
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {[
              {
                label: 'Milk (25 L)',
                category: 'Dairy & Milk',
                itemName: 'Full Cream Milk',
                quantityLabel: '25 Liters',
              },
              {
                label: 'Espresso Beans (5 kg)',
                category: 'Coffee & Beverages',
                itemName: 'Roasted Arabica Beans',
                quantityLabel: '5 kg',
              },
              {
                label: 'Syrups & Cocoa',
                category: 'Coffee & Beverages',
                itemName: 'Hazelnut & Vanilla Syrups',
                quantityLabel: '6 Bottles',
              },
              {
                label: 'Takeaway Cups',
                category: 'Packaging & Disposables',
                itemName: 'Paper Coffee Cups & Lids',
                quantityLabel: '500 pcs',
              },
            ].map((tpl) => (
              <button
                key={tpl.label}
                type="button"
                onClick={() => handleCafeQuickFill(tpl)}
                className="rounded-full border border-[#1E1B4B]/20 bg-[#FFFFFF] px-3 py-1 text-[12px] font-bold text-[#1E1B4B] hover:bg-[#1E1B4B] hover:text-[#FFFFFF] transition-colors cursor-pointer"
              >
                + {tpl.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 3 Clean Summary KPI Cards */}
      <div className="grid gap-5 sm:grid-cols-3">
        <div className="bistro-card p-6 flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[14px] font-semibold text-[#6B7280]">
              Monthly Stock Cost
            </span>
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#F8F9FA] border border-[#1E1B4B]/10 text-[#1E1B4B]">
              <Package className="h-5 w-5" aria-hidden />
            </span>
          </div>
          <div>
            <p className="text-[30px] leading-none font-extrabold text-[#111827] tabular-nums">
              {formatPriceFromPaise(stockCostPaise, currencyCode)}
            </p>
            <p className="mt-2 text-[12px] font-medium text-[#6B7280]">
              Ingredients, dairy, coffee &amp; supplies
            </p>
          </div>
        </div>

        <div className="bistro-card p-6 flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[14px] font-semibold text-[#6B7280]">
              Operating Expenses
            </span>
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#F8F9FA] border border-[#1E1B4B]/10 text-[#1E1B4B]">
              <Receipt className="h-5 w-5" aria-hidden />
            </span>
          </div>
          <div>
            <p className="text-[30px] leading-none font-extrabold text-[#111827] tabular-nums">
              {formatPriceFromPaise(expenseCostPaise, currencyCode)}
            </p>
            <p className="mt-2 text-[12px] font-medium text-[#6B7280]">
              Gas, utilities, rent &amp; vendor bills
            </p>
          </div>
        </div>

        <div
          className={`bistro-card p-6 flex flex-col justify-between space-y-3 ${
            lowStockItems.length > 0 ? 'border-amber-300 bg-amber-50/40' : ''
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[14px] font-semibold text-[#6B7280]">
              Low-Stock Items Flagged
            </span>
            <span
              className={`flex h-10 w-10 items-center justify-center rounded-xl border ${
                lowStockItems.length > 0
                  ? 'bg-amber-100 border-amber-300 text-[#D97706]'
                  : 'bg-emerald-50 border-emerald-200 text-[#059669]'
              }`}
            >
              {lowStockItems.length > 0 ? (
                <AlertTriangle className="h-5 w-5" aria-hidden />
              ) : (
                <CheckCircle2 className="h-5 w-5" aria-hidden />
              )}
            </span>
          </div>
          <div>
            <p className="text-[30px] leading-none font-extrabold text-[#111827] tabular-nums">
              {lowStockItems.length}
            </p>
            <p className="mt-2 text-[12px] font-medium text-[#6B7280]">
              Total {formatMonthKeyLabel(selectedMonthKey)} spend:{' '}
              <strong className="text-[#111827] tabular-nums">
                {formatPriceFromPaise(totalSpendPaise, currencyCode)}
              </strong>
            </p>
          </div>
        </div>
      </div>

      {/* Quick-Add Stock / Expense Form */}
      <form
        onSubmit={(e) => void handleAddEntry(e)}
        className="bistro-card p-6 sm:p-7 space-y-5"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-[18px] font-extrabold text-[#111827]">
              + Log Stock Intake or Monthly Expense
            </h2>
            <p className="text-[13px] text-[#6B7280]">
              Recording for {formatMonthKeyLabel(selectedMonthKey)}.
            </p>
          </div>

          {/* Entry Type Pill Toggle */}
          <div className="inline-flex rounded-xl border border-[#1E1B4B]/15 bg-[#F8F9FA] p-1">
            <button
              type="button"
              onClick={() => handleSelectEntryType('stock_purchase')}
              className={`rounded-lg px-3.5 py-2 text-[12px] font-extrabold transition-all cursor-pointer ${
                entryType === 'stock_purchase'
                  ? 'bg-[#1E1B4B] text-[#FFFFFF] shadow-2xs'
                  : 'text-[#6B7280] hover:text-[#111827]'
              }`}
            >
              Stock Purchase
            </button>
            <button
              type="button"
              onClick={() => handleSelectEntryType('monthly_expense')}
              className={`rounded-lg px-3.5 py-2 text-[12px] font-extrabold transition-all cursor-pointer ${
                entryType === 'monthly_expense'
                  ? 'bg-[#1E1B4B] text-[#FFFFFF] shadow-2xs'
                  : 'text-[#6B7280] hover:text-[#111827]'
              }`}
            >
              Monthly Expense
            </button>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1.5">
            <label
              htmlFor="invCategory"
              className="block text-[13px] font-semibold text-[#111827]"
            >
              Category
            </label>
            <select
              id="invCategory"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="block h-11 w-full rounded-xl border border-[#1E1B4B]/20 bg-[#FFFFFF] px-3.5 text-[14px] text-[#111827] focus:border-[#1E1B4B] focus:outline-none"
            >
              {DEFAULT_INVENTORY_CATEGORIES.map((c) => (
                <option key={c.label} value={c.label}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="invItemName"
              className="block text-[13px] font-semibold text-[#111827]"
            >
              Item / Expense Name
            </label>
            <input
              id="invItemName"
              type="text"
              required
              maxLength={120}
              placeholder={
                entryType === 'stock_purchase'
                  ? 'e.g. Full Cream Milk, Coffee Beans'
                  : 'e.g. Commercial Gas, Shop Rent'
              }
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
              className="block h-11 w-full rounded-xl border border-[#1E1B4B]/20 bg-[#FFFFFF] px-3.5 text-[14px] text-[#111827] focus:border-[#1E1B4B] focus:outline-none"
            />
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="invQuantity"
              className="block text-[13px] font-semibold text-[#111827]"
            >
              Quantity / Unit (Optional)
            </label>
            <input
              id="invQuantity"
              type="text"
              maxLength={60}
              placeholder="e.g. 25 L Milk, 5 kg, 2 Cylinders"
              value={quantityLabel}
              onChange={(e) => setQuantityLabel(e.target.value)}
              className="block h-11 w-full rounded-xl border border-[#1E1B4B]/20 bg-[#FFFFFF] px-3.5 text-[14px] text-[#111827] focus:border-[#1E1B4B] focus:outline-none"
            />
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="invCost"
              className="block text-[13px] font-semibold text-[#111827]"
            >
              Cost ({CURRENCY_METADATA[currencyCode].symbol})
            </label>
            <input
              id="invCost"
              type="text"
              inputMode="decimal"
              required
              placeholder="e.g. 1850"
              value={costMajor}
              onChange={(e) => setCostMajor(e.target.value)}
              className="block h-11 w-full rounded-xl border border-[#1E1B4B]/20 bg-[#FFFFFF] px-3.5 text-[14px] font-bold text-[#111827] tabular-nums focus:border-[#1E1B4B] focus:outline-none"
            />
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-t border-[#1E1B4B]/10 pt-4">
          <div className="flex flex-1 flex-wrap items-center gap-4">
            <input
              type="text"
              maxLength={300}
              aria-label="Vendor or note (optional)"
              placeholder="Optional vendor name or note (e.g. Paid via UPI to Fresh Dairy)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="h-10 min-w-[240px] flex-1 rounded-xl border border-[#1E1B4B]/15 bg-[#F8F9FA] px-3.5 text-[13px] text-[#111827] focus:border-[#1E1B4B] focus:bg-[#FFFFFF] focus:outline-none"
            />
            <label className="inline-flex items-center gap-2 text-[13px] font-bold text-[#D97706] cursor-pointer whitespace-nowrap">
              <input
                type="checkbox"
                checked={lowStockAlert}
                onChange={(e) => setLowStockAlert(e.target.checked)}
                className="h-4 w-4 accent-[#D97706]"
              />
              Mark Low Stock ⚠️
            </label>
          </div>
          <Button type="submit" variant="primary" loading={saving}>
            <Plus className="h-4 w-4" aria-hidden /> Save Entry
          </Button>
        </div>
      </form>

      {/* Filter Pills + Monthly Ledger */}
      <div className="bistro-card overflow-hidden">
        <div className="border-b border-[#1E1B4B]/10 px-6 py-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {(
              [
                { id: 'all', label: `All (${entries.length})` },
                {
                  id: 'stock_purchase',
                  label: `Stock (${entries.filter((e) => e.entryType === 'stock_purchase').length})`,
                },
                {
                  id: 'monthly_expense',
                  label: `Expenses (${entries.filter((e) => e.entryType === 'monthly_expense').length})`,
                },
                {
                  id: 'low_stock',
                  label: `Low Stock ⚠️ (${lowStockItems.length})`,
                },
              ] as const
            ).map((pill) => (
              <button
                key={pill.id}
                type="button"
                onClick={() => setFilterMode(pill.id)}
                className={`rounded-full px-3.5 py-1.5 text-[12px] font-bold transition-all cursor-pointer ${
                  filterMode === pill.id
                    ? 'bg-[#1E1B4B] text-[#FFFFFF]'
                    : 'bg-[#F8F9FA] text-[#6B7280] hover:text-[#111827]'
                }`}
              >
                {pill.label}
              </button>
            ))}
          </div>

          <span className="text-[12px] font-bold text-[#1E1B4B] tabular-nums">
            Showing {filteredEntries.length} item
            {filteredEntries.length === 1 ? '' : 's'}
          </span>
        </div>

        {filteredEntries.length === 0 ? (
          <div className="p-10 text-center space-y-2">
            <Package
              className="mx-auto h-10 w-10 text-[#6B7280]/60"
              aria-hidden
            />
            <p className="text-[15px] font-bold text-[#111827]">
              No entries logged for {formatMonthKeyLabel(selectedMonthKey)}
            </p>
            <p className="mx-auto max-w-md text-[13px] text-[#6B7280]">
              Add your monthly milk, coffee, grocery stock, gas, or rent above to keep monthly spend and reorder alerts in one clean place.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[#1E1B4B]/10">
            {filteredEntries.map((item) => {
              const isBusy = busyId === item.id;
              return (
                <div
                  key={item.id}
                  className={`flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 ${
                    item.lowStockAlert ? 'bg-amber-50/45' : 'bg-[#FFFFFF]'
                  }`}
                >
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[10.5px] font-extrabold uppercase tracking-wider ${
                          item.entryType === 'stock_purchase'
                            ? 'bg-indigo-50 text-indigo-800'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {item.entryType === 'stock_purchase'
                          ? 'Stock'
                          : 'Expense'}
                      </span>
                      <span className="text-[12px] font-semibold text-[#6B7280]">
                        {item.category}
                      </span>
                      {item.quantityLabel && (
                        <span className="rounded-md bg-[#F8F9FA] border border-[#1E1B4B]/10 px-2 py-0.5 text-[11px] font-bold text-[#111827]">
                          {item.quantityLabel}
                        </span>
                      )}
                      {item.lowStockAlert && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 border border-amber-300 px-2.5 py-0.5 text-[11px] font-extrabold text-[#D97706]">
                          <AlertTriangle className="h-3 w-3" aria-hidden />
                          Low Stock
                        </span>
                      )}
                    </div>
                    <p className="text-[15px] font-extrabold text-[#111827]">
                      {item.itemName}
                    </p>
                    {item.notes && (
                      <p className="text-[12px] text-[#6B7280]">{item.notes}</p>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                    <span className="text-[16px] font-extrabold text-[#111827] tabular-nums mr-1">
                      {formatPriceFromPaise(item.amountPaise, currencyCode)}
                    </span>

                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => void handleToggleLowStock(item)}
                      className={`inline-flex h-9 items-center gap-1.5 rounded-xl border px-3 text-[12px] font-bold transition-colors cursor-pointer ${
                        item.lowStockAlert
                          ? 'border-emerald-200 bg-emerald-50 text-[#059669] hover:bg-emerald-100'
                          : 'border-amber-300 bg-amber-50 text-[#D97706] hover:bg-amber-100'
                      }`}
                    >
                      {item.lowStockAlert
                        ? 'Mark Restocked ✓'
                        : 'Mark Low Stock ⚠️'}
                    </button>

                    <button
                      type="button"
                      disabled={isBusy}
                      aria-label={`Delete ${item.itemName}`}
                      onClick={() => void handleDeleteEntry(item)}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-red-200 bg-[#FFFFFF] text-red-600 hover:bg-red-50 cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
