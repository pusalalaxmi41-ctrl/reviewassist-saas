import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Banknote,
  Calculator,
  CheckCircle2,
  CreditCard,
  Loader2,
  Printer,
  Receipt,
  Smartphone,
  Sparkles,
  X,
} from 'lucide-react';
import type {
  OpenTableBillSummary,
  RestaurantPaymentMethod,
  RestaurantTable,
} from '../../types/restaurant';
import { businessRepository } from '../../services/storage';
import { formatPriceFromPaise } from '../../utils/restaurantValidation';
import {
  formatElapsedOccupancy,
  printOrDownloadTableBillReceipt,
} from '../../utils/hospitalityHelpers';

interface Props {
  businessId: string;
  businessSlug: string;
  table: RestaurantTable;
  onClose: () => void;
  onCheckedOut: () => void;
  onAddOrderToTable: (table: RestaurantTable) => void;
}

export function TableFinalBillModal({
  businessId,
  businessSlug,
  table,
  onClose,
  onCheckedOut,
  onAddOrderToTable,
}: Props) {
  const [bill, setBill] = useState<OpenTableBillSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [paymentMethod, setPaymentMethod] =
    useState<RestaurantPaymentMethod>('cash');
  const [splitWays, setSplitWays] = useState<number>(1);
  const [showSplitCalc, setShowSplitCalc] = useState(false);
  const [settling, setSettling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadBill = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const summary = await businessRepository.getOpenTableBillSummary({
        businessSlug,
        tableKey: table.tableKey,
      });
      setBill(summary);
      if (summary?.paymentStatus === 'upi_pending_verify') {
        setPaymentMethod('upi');
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [businessSlug, table.tableKey]);

  useEffect(() => {
    let active = true;
    const t = window.setTimeout(() => {
      if (active) void loadBill();
    }, 0);
    return () => {
      active = false;
      window.clearTimeout(t);
    };
  }, [loadBill]);

  async function handleCheckout() {
    if (!bill) return;
    setSettling(true);
    setError(null);
    try {
      await businessRepository.completeTableBillCheckout({
        businessId,
        tableId: table.id,
        paymentMethod,
        staffLabel: 'Owner',
      });
      onCheckedOut();
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSettling(false);
    }
  }

  const maxRepeat = (bill?.orders ?? []).reduce(
    (max, o) => Math.max(max, o.customerRepeatVisitCount ?? 1),
    1,
  );
  const guestLabel =
    bill?.orders.find((o) => o.guestName)?.guestName ?? 'Walk-In Guest';
  const perGuestPaise =
    bill && splitWays > 1 ? Math.ceil(bill.grandTotalPaise / splitWays) : 0;

  const modalContent = (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Final Bill and Checkout for ${table.tableNumber}`}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-xs"
    >
      <div className="relative max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-3xl border border-[#1E1B4B]/20 bg-white shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-start justify-between gap-3 bg-[#1E1B4B] px-6 py-4 text-white">
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-[19px] font-black tracking-tight">
                {table.tableNumber} — Final Bill &amp; Checkout
              </h2>
              {bill && !bill.isCheckedOut && bill.orderCount > 0 && (
                <span className="rounded-full bg-[#D2DB76] px-2.5 py-0.5 text-[10px] font-black uppercase text-[#1E1B4B]">
                  OPEN BILL
                </span>
              )}
              {bill?.billRequested && (
                <span className="rounded-full bg-red-500 px-2.5 py-0.5 text-[10px] font-black uppercase text-white animate-pulse">
                  GUEST ASKED FOR BILL
                </span>
              )}
              {bill?.paymentStatus === 'upi_pending_verify' && (
                <span className="rounded-full bg-sky-400 px-2.5 py-0.5 text-[10px] font-black uppercase text-slate-950">
                  UPI — VERIFY PAYMENT
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2 text-[12px] text-indigo-200/90 font-semibold">
              <span>
                {bill?.occupiedSince
                  ? `Seated ${formatElapsedOccupancy(bill.occupiedSince)}`
                  : 'Table session'}
              </span>
              <span>•</span>
              <span>Guest: {guestLabel}</span>
              {maxRepeat > 1 && (
                <span className="inline-flex items-center gap-0.5 rounded-full bg-blue-500/30 border border-blue-300/40 px-2 py-0.5 text-[10.5px] font-black text-blue-100">
                  <Sparkles className="h-3 w-3" aria-hidden />
                  REPEAT VISIT x{maxRepeat}
                </span>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close final bill modal"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/10 text-white hover:bg-white/20 cursor-pointer"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {error && (
            <div
              role="alert"
              className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] font-bold text-red-900"
            >
              {error}
            </div>
          )}

          {loading ? (
            <div className="py-12 text-center">
              <Loader2 className="mx-auto h-7 w-7 animate-spin text-[#1E1B4B]" />
              <p className="mt-2 text-[13px] font-semibold text-slate-500">
                Calculating open table bill…
              </p>
            </div>
          ) : !bill || bill.orderCount === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-[#F8F9FA] p-8 text-center space-y-3">
              <Receipt className="mx-auto h-8 w-8 text-slate-400" aria-hidden />
              <p className="text-[14px] font-bold text-slate-700">
                No unpaid orders on {table.tableNumber}.
              </p>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onAddOrderToTable(table);
                }}
                className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-[#1E1B4B] px-4 text-[13px] font-extrabold text-[#D2DB76] hover:bg-[#2E2A6E] cursor-pointer"
              >
                + Add Order via Counter POS
              </button>
            </div>
          ) : (
            <>
              {/* Itemized Orders List */}
              <div className="space-y-3">
                {bill.orders.map((order, idx) => (
                  <div
                    key={order.id}
                    className="rounded-2xl border border-slate-200 bg-[#F8F9FA] p-3.5 space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2 text-[11.5px] font-extrabold text-slate-600">
                      <span>
                        Order #{idx + 1} •{' '}
                        {new Date(order.createdAt).toLocaleTimeString('en-IN', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                      <span className="rounded-full bg-white border border-slate-200 px-2 py-0.5 text-[10px] uppercase text-[#1E1B4B]">
                        {order.status.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <div className="divide-y divide-slate-200/70">
                      {order.items.map((item, iIdx) => (
                        <div
                          key={`${order.id}-${item.itemId}-${iIdx}`}
                          className="flex items-center justify-between gap-3 py-1.5 text-[13px]"
                        >
                          <div className="min-w-0">
                            <span className="font-bold text-slate-900">
                              {item.quantity}× {item.name}
                            </span>
                            {item.notes && (
                              <span className="ml-2 text-[11px] font-semibold text-amber-800">
                                ({item.notes})
                              </span>
                            )}
                          </div>
                          <span className="font-extrabold text-slate-900 tabular-nums shrink-0">
                            {formatPriceFromPaise(
                              item.pricePaise * item.quantity,
                              bill.currencyCode,
                            )}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Financial Breakdown (Subtotal + CGST/SGST + Service Charge + Grand Total) */}
              <div className="rounded-2xl border border-[#1E1B4B]/15 bg-white p-4 space-y-2 text-[13px]">
                <div className="flex justify-between font-semibold text-slate-600">
                  <span>Subtotal</span>
                  <span className="tabular-nums font-bold text-slate-900">
                    {formatPriceFromPaise(
                      bill.subtotalPaise,
                      bill.currencyCode,
                    )}
                  </span>
                </div>
                {bill.gstPercent > 0 && (
                  <>
                    <div className="flex justify-between font-semibold text-slate-600">
                      <span>CGST ({(bill.gstPercent / 2).toFixed(2)}%)</span>
                      <span className="tabular-nums">
                        {formatPriceFromPaise(
                          bill.cgstPaise,
                          bill.currencyCode,
                        )}
                      </span>
                    </div>
                    <div className="flex justify-between font-semibold text-slate-600">
                      <span>SGST ({(bill.gstPercent / 2).toFixed(2)}%)</span>
                      <span className="tabular-nums">
                        {formatPriceFromPaise(
                          bill.sgstPaise,
                          bill.currencyCode,
                        )}
                      </span>
                    </div>
                  </>
                )}
                {bill.serviceChargePercent > 0 && (
                  <div className="flex justify-between font-semibold text-slate-600">
                    <span>Service Charge ({bill.serviceChargePercent}%)</span>
                    <span className="tabular-nums">
                      {formatPriceFromPaise(
                        bill.serviceChargePaise,
                        bill.currencyCode,
                      )}
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between rounded-xl bg-[#D2DB76] px-4 py-3 text-[#1E1B4B] mt-2">
                  <span className="text-[13px] font-black uppercase tracking-wider">
                    {bill.isCheckedOut ? 'PAID TOTAL' : 'GRAND TOTAL DUE'}
                  </span>
                  <span className="text-[22px] font-black tabular-nums">
                    {formatPriceFromPaise(
                      bill.grandTotalPaise,
                      bill.currencyCode,
                    )}
                  </span>
                </div>
              </div>

              {/* Expandable Split Bill Calculator */}
              <div className="rounded-2xl border border-slate-200 bg-[#F8F9FA] p-3.5 space-y-2.5">
                <button
                  type="button"
                  onClick={() => setShowSplitCalc((v) => !v)}
                  className="flex w-full items-center justify-between text-[12.5px] font-extrabold text-[#1E1B4B] cursor-pointer"
                >
                  <span className="inline-flex items-center gap-1.5">
                    <Calculator className="h-4 w-4" aria-hidden />
                    Split Bill Calculator
                  </span>
                  <span className="text-[11px] font-bold text-slate-500">
                    {showSplitCalc ? 'Hide ▲' : 'Split evenly ▼'}
                  </span>
                </button>
                {showSplitCalc && (
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                    <div className="flex items-center gap-1.5">
                      {[2, 3, 4, 5, 6].map((n) => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => setSplitWays(n)}
                          className={`h-8 w-9 rounded-lg text-[12px] font-black cursor-pointer ${
                            splitWays === n
                              ? 'bg-[#1E1B4B] text-[#D2DB76]'
                              : 'border border-slate-300 bg-white text-slate-800'
                          }`}
                        >
                          {n}×
                        </button>
                      ))}
                    </div>
                    {splitWays > 1 && (
                      <p className="text-[13px] font-black text-[#1E1B4B] tabular-nums">
                        {formatPriceFromPaise(perGuestPaise, bill.currencyCode)}{' '}
                        / guest ({splitWays} ways)
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Payment Mode Selector */}
              {!bill.isCheckedOut && (
                <div className="space-y-2">
                  <p className="text-[11.5px] font-extrabold uppercase tracking-wider text-slate-500">
                    Payment Mode Received
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    {(
                      [
                        { id: 'cash', label: 'Cash', Icon: Banknote },
                        { id: 'upi', label: 'UPI', Icon: Smartphone },
                        { id: 'card', label: 'Card', Icon: CreditCard },
                      ] as const
                    ).map(({ id, label, Icon }) => {
                      const active = paymentMethod === id;
                      return (
                        <button
                          key={id}
                          type="button"
                          onClick={() => setPaymentMethod(id)}
                          className={`flex h-11 items-center justify-center gap-1.5 rounded-xl border-2 text-[13px] font-extrabold transition-all cursor-pointer ${
                            active
                              ? 'border-[#1E1B4B] bg-[#1E1B4B] text-[#D2DB76]'
                              : 'border-slate-200 bg-white text-slate-700 hover:border-[#1E1B4B]'
                          }`}
                        >
                          <Icon className="h-4 w-4" aria-hidden />
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Footer Action Buttons */}
              <div className="flex flex-wrap items-center justify-between gap-2.5 pt-1">
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      printOrDownloadTableBillReceipt(bill, { paymentMethod })
                    }
                    className="inline-flex h-11 items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-4 text-[13px] font-extrabold text-slate-800 hover:bg-slate-50 cursor-pointer"
                  >
                    <Printer className="h-4 w-4" aria-hidden />
                    Print Thermal Bill
                  </button>
                  {!bill.isCheckedOut && (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onAddOrderToTable(table);
                      }}
                      className="inline-flex h-11 items-center gap-1.5 rounded-xl border border-[#1E1B4B]/20 bg-[#F8F9FA] px-3.5 text-[12.5px] font-extrabold text-[#1E1B4B] hover:bg-[#1E1B4B]/10 cursor-pointer"
                    >
                      + Add Items
                    </button>
                  )}
                </div>

                {!bill.isCheckedOut && (
                  <button
                    type="button"
                    disabled={settling}
                    onClick={() => void handleCheckout()}
                    className="inline-flex h-11 flex-1 sm:flex-none items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 text-[13.5px] font-black text-white shadow-sm hover:bg-emerald-700 disabled:opacity-60 cursor-pointer"
                  >
                    <CheckCircle2 className="h-4.5 w-4.5" aria-hidden />
                    {settling
                      ? 'Settling Bill…'
                      : 'Checkout / Done & Send Bill ✓'}
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined'
    ? createPortal(modalContent, document.body)
    : modalContent;
}
