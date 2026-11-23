import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import {
  CheckCircle2,
  Download,
  ExternalLink,
  Loader2,
  MessageSquare,
  Receipt,
  Send,
  Smartphone,
  Sparkles,
  X,
} from 'lucide-react';
import type {
  OpenTableBillSummary,
  RestaurantTableCallType,
  RestaurantTableMessage,
} from '../../types/restaurant';
import { businessRepository } from '../../services/storage';
import { formatPriceFromPaise } from '../../utils/restaurantValidation';
import {
  buildUpiPaymentUri,
  printOrDownloadTableBillReceipt,
} from '../../utils/hospitalityHelpers';

interface Props {
  businessSlug: string;
  businessName: string;
  tableKey: string;
  tableNumber: string;
  customerName: string | null;
  initialTab: 'chat' | 'bill';
  billSummary: OpenTableBillSummary | null;
  messages: RestaurantTableMessage[];
  onClose: () => void;
  onRefresh: () => Promise<void>;
  onQuickServiceCall: (callType: RestaurantTableCallType) => Promise<void>;
}

function UpiQrCanvas({ uri }: { uri: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current || !uri) return;
    void QRCode.toCanvas(canvasRef.current, uri, {
      width: 176,
      margin: 1,
      color: { dark: '#1E1B4B', light: '#FFFFFF' },
    });
  }, [uri]);

  return (
    <canvas
      ref={canvasRef}
      className="mx-auto h-[176px] w-[176px] rounded-2xl border border-[#1E1B4B]/15 bg-white p-2 shadow-xs"
    />
  );
}

export function CustomerChatAndBillDrawer({
  businessSlug,
  businessName,
  tableKey,
  tableNumber,
  customerName,
  initialTab,
  billSummary,
  messages,
  onClose,
  onRefresh,
  onQuickServiceCall,
}: Props) {
  const [activeTab, setActiveTab] = useState<'chat' | 'bill'>(initialTab);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [markingUpi, setMarkingUpi] = useState(false);
  const [requestingBill, setRequestingBill] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (activeTab === 'chat') {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length, activeTab]);

  async function handleSendMessage(e: React.FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;
    setSending(true);
    setError(null);
    try {
      await businessRepository.sendTableChatMessage({
        businessSlug,
        tableKey,
        senderRole: 'customer',
        senderName: customerName || 'Guest',
        messageText: text,
      });
      setDraft('');
      await onRefresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSending(false);
    }
  }

  async function handleQuickChip(
    callType: RestaurantTableCallType,
    label: string,
  ) {
    setError(null);
    try {
      await onQuickServiceCall(callType);
      setFeedback(`Notified staff: ${label} ✓`);
      window.setTimeout(() => setFeedback(null), 3000);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function handleMarkPaidViaUpi() {
    setMarkingUpi(true);
    setError(null);
    try {
      await businessRepository.markTableBillUpiPending({
        businessSlug,
        tableKey,
      });
      await onRefresh();
      setFeedback(
        'Notified cashier: UPI Paid — Staff Checking. Your receipt will unlock right after verification!',
      );
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setMarkingUpi(false);
    }
  }

  async function handleRequestFinalBill() {
    setRequestingBill(true);
    setError(null);
    try {
      await onQuickServiceCall('bill_request');
      await onRefresh();
      setFeedback('Bill requested — our staff is bringing your final bill!');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setRequestingBill(false);
    }
  }

  const upiUri =
    billSummary && billSummary.upiId && billSummary.grandTotalPaise > 0
      ? buildUpiPaymentUri({
          upiId: billSummary.upiId,
          payeeName: billSummary.upiPayeeName || businessName,
          amountPaise: billSummary.grandTotalPaise,
          note: `${businessName} ${tableNumber}`,
        })
      : null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Live Table Chat & Bill"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-[#1E1B4B]/60 p-0 sm:p-4 backdrop-blur-xs"
    >
      <div className="flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl sm:rounded-3xl bg-[#FFFFFF] shadow-2xl animate-fadeSlideUp">
        {/* Top Drawer Header */}
        <div className="flex items-center justify-between gap-2 bg-[#1E1B4B] px-5 py-4 text-white">
          <div className="min-w-0">
            <h3 className="text-[17px] font-extrabold truncate">
              {tableNumber} • Guest Desk
            </h3>
            <p className="text-[11.5px] font-semibold text-[#D2DB76]">
              Live 2-way chat, running bill &amp; instant UPI checkout
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close drawer"
            className="rounded-full bg-white/10 p-1.5 text-white hover:bg-white/20 cursor-pointer"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>

        {/* 2-Tab Switcher */}
        <div className="grid grid-cols-2 border-b border-[#1E1B4B]/10 bg-[#F8F9FA] p-1.5 gap-1.5">
          <button
            type="button"
            onClick={() => setActiveTab('chat')}
            className={`inline-flex h-10 items-center justify-center gap-1.5 rounded-xl text-[13px] font-extrabold transition-all cursor-pointer ${
              activeTab === 'chat'
                ? 'bg-[#1E1B4B] text-white shadow-xs'
                : 'text-[#6B7280] hover:bg-white'
            }`}
          >
            <MessageSquare className="h-4 w-4" aria-hidden />
            Live Chat ({messages.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('bill')}
            className={`inline-flex h-10 items-center justify-center gap-1.5 rounded-xl text-[13px] font-extrabold transition-all cursor-pointer ${
              activeTab === 'bill'
                ? 'bg-[#1E1B4B] text-white shadow-xs'
                : 'text-[#6B7280] hover:bg-white'
            }`}
          >
            <Receipt className="h-4 w-4" aria-hidden />
            View Bill &amp; Pay
          </button>
        </div>

        {/* Feedback / Error */}
        {feedback && (
          <div className="mx-4 mt-3 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-[12px] font-bold text-[#059669]">
            <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden />
            <span>{feedback}</span>
          </div>
        )}
        {error && (
          <div className="mx-4 mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[12px] font-bold text-red-700">
            {error}
          </div>
        )}

        {/* TAB 1: LIVE 2-WAY CHAT */}
        {activeTab === 'chat' && (
          <div className="flex flex-1 flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto p-4 space-y-2.5 bg-[#F8F9FA]">
              {messages.length === 0 ? (
                <div className="rounded-2xl border border-[#1E1B4B]/10 bg-white p-6 text-center space-y-1.5">
                  <Sparkles
                    className="mx-auto h-6 w-6 text-[#1E1B4B]/50"
                    aria-hidden
                  />
                  <p className="text-[13.5px] font-extrabold text-[#111827]">
                    Message {businessName} directly
                  </p>
                  <p className="text-[12px] text-[#6B7280]">
                    Ask for extra plates, spice adjustments, baby chair, or tap a 1-tap quick chip below.
                  </p>
                </div>
              ) : (
                messages.map((msg) => {
                  if (msg.senderRole === 'system') {
                    return (
                      <div key={msg.id} className="flex justify-center">
                        <span className="rounded-full bg-[#1E1B4B]/8 px-3 py-1 text-[11px] font-bold text-[#4B5563]">
                          {msg.messageText}
                        </span>
                      </div>
                    );
                  }
                  const isGuest = msg.senderRole === 'customer';
                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${isGuest ? 'items-end' : 'items-start'}`}
                    >
                      <span className="mb-0.5 px-1 text-[10px] font-bold text-[#6B7280]">
                        {isGuest
                          ? 'You'
                          : msg.senderName || `${businessName} Staff`}
                      </span>
                      <div
                        className={`max-w-[82%] rounded-2xl px-3.5 py-2 text-[13px] font-semibold leading-snug shadow-2xs ${
                          isGuest
                            ? 'bg-[#1E1B4B] text-white rounded-br-sm'
                            : 'border border-[#1E1B4B]/12 bg-white text-[#111827] rounded-bl-sm'
                        }`}
                      >
                        {msg.messageText}
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Quick Action Chips */}
            <div className="flex items-center gap-1.5 overflow-x-auto border-t border-[#1E1B4B]/10 bg-white px-4 py-2">
              <button
                type="button"
                onClick={() => void handleQuickChip('water', 'Water')}
                className="shrink-0 rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-[11.5px] font-extrabold text-sky-900 hover:bg-sky-100 cursor-pointer"
              >
                💧 Water
              </button>
              <button
                type="button"
                onClick={() =>
                  void handleQuickChip('bill_request', 'Bill Please')
                }
                className="shrink-0 rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-[11.5px] font-extrabold text-rose-900 hover:bg-rose-100 cursor-pointer"
              >
                🧾 Bill Please
              </button>
              <button
                type="button"
                onClick={() =>
                  void handleQuickChip('clean_table', 'Clean Table')
                }
                className="shrink-0 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[11.5px] font-extrabold text-amber-950 hover:bg-amber-100 cursor-pointer"
              >
                🧹 Clean Table
              </button>
            </div>

            {/* Input Form */}
            <form
              onSubmit={(e) => void handleSendMessage(e)}
              className="flex items-center gap-2 border-t border-[#1E1B4B]/10 bg-white p-3"
            >
              <input
                type="text"
                maxLength={500}
                placeholder="Type a message to staff…"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                className="h-11 flex-1 rounded-xl border border-[#1E1B4B]/20 bg-[#F8F9FA] px-3.5 text-[13.5px] font-medium text-[#111827] focus:border-[#1E1B4B] focus:bg-white focus:outline-none"
              />
              <button
                type="submit"
                disabled={sending || !draft.trim()}
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#1E1B4B] text-[#D2DB76] hover:bg-[#2E2A6E] disabled:opacity-45 cursor-pointer"
                aria-label="Send message"
              >
                {sending ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                ) : (
                  <Send className="h-4 w-4" aria-hidden />
                )}
              </button>
            </form>
          </div>
        )}

        {/* TAB 2: VIEW BILL, UPI QR & RECEIPT DOWNLOAD */}
        {activeTab === 'bill' && (
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {!billSummary || billSummary.orderCount === 0 ? (
              <div className="rounded-2xl border border-[#1E1B4B]/10 bg-[#F8F9FA] p-6 text-center space-y-2">
                <Receipt
                  className="mx-auto h-8 w-8 text-[#1E1B4B]/40"
                  aria-hidden
                />
                <p className="text-[15px] font-extrabold text-[#111827]">
                  No active bill items yet
                </p>
                <p className="text-[12.5px] text-[#6B7280]">
                  Place an order from the Digital Menu (or ask your waiter) and your running itemized bill will appear here live.
                </p>
              </div>
            ) : (
              <>
                {/* Checked-Out Approval Banner */}
                {billSummary.isCheckedOut && (
                  <div className="rounded-2xl border-2 border-emerald-400 bg-emerald-50 p-4 space-y-2.5">
                    <div className="flex items-center gap-2 text-[#065F46]">
                      <CheckCircle2 className="h-5 w-5 shrink-0" aria-hidden />
                      <p className="text-[15px] font-extrabold">
                        ✓ Checkout Approved — Thank You!
                      </p>
                    </div>
                    <p className="text-[12px] font-semibold text-emerald-800">
                      Your bill has been settled
                      {billSummary.paymentMethod
                        ? ` via ${billSummary.paymentMethod.toUpperCase()}`
                        : ''}
                      . Download your receipt below anytime.
                    </p>
                    <button
                      type="button"
                      onClick={() =>
                        printOrDownloadTableBillReceipt(billSummary, {
                          downloadOnly: true,
                        })
                      }
                      className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#059669] text-[13px] font-extrabold text-white hover:bg-emerald-700 cursor-pointer"
                    >
                      <Download className="h-4 w-4" aria-hidden />
                      Download Bill Receipt
                    </button>
                  </div>
                )}

                {/* Payment Verification Status Pill */}
                {!billSummary.isCheckedOut &&
                  billSummary.paymentStatus === 'upi_pending_verify' && (
                    <div className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-[12.5px] font-bold text-[#92400E]">
                      ⏳ UPI Paid — Staff Checking. Your bill will mark paid &amp; unlock receipt download in a moment!
                    </div>
                  )}

                {/* Itemized Breakdown */}
                <div className="rounded-2xl border border-[#1E1B4B]/12 bg-[#F8F9FA] p-4 space-y-2.5">
                  <div className="flex items-center justify-between text-[11px] font-extrabold uppercase tracking-wider text-[#6B7280]">
                    <span>
                      Itemized Bill ({billSummary.orderCount} Order
                      {billSummary.orderCount === 1 ? '' : 's'})
                    </span>
                    <span>Amount</span>
                  </div>
                  <div className="divide-y divide-[#1E1B4B]/8">
                    {billSummary.orders.flatMap((ord) =>
                      ord.items.map((item, idx) => (
                        <div
                          key={`${ord.id}-${idx}`}
                          className="flex items-center justify-between gap-2 py-2 text-[13px]"
                        >
                          <span className="font-semibold text-[#111827]">
                            <strong className="text-[#1E1B4B]">
                              {item.quantity}×
                            </strong>{' '}
                            {item.name}
                          </span>
                          <span className="font-bold text-[#111827] tabular-nums">
                            {formatPriceFromPaise(
                              item.pricePaise * item.quantity,
                              billSummary.currencyCode,
                            )}
                          </span>
                        </div>
                      )),
                    )}
                  </div>

                  {/* Subtotal + Tax + Grand Total */}
                  <div className="border-t border-[#1E1B4B]/15 pt-2.5 space-y-1 text-[13px]">
                    <div className="flex justify-between text-[#4B5563]">
                      <span>Subtotal</span>
                      <span className="font-bold tabular-nums">
                        {formatPriceFromPaise(
                          billSummary.subtotalPaise,
                          billSummary.currencyCode,
                        )}
                      </span>
                    </div>
                    {billSummary.gstPercent > 0 && (
                      <>
                        <div className="flex justify-between text-[#4B5563]">
                          <span>
                            CGST ({(billSummary.gstPercent / 2).toFixed(2)}%)
                          </span>
                          <span className="font-bold tabular-nums">
                            {formatPriceFromPaise(
                              billSummary.cgstPaise,
                              billSummary.currencyCode,
                            )}
                          </span>
                        </div>
                        <div className="flex justify-between text-[#4B5563]">
                          <span>
                            SGST ({(billSummary.gstPercent / 2).toFixed(2)}%)
                          </span>
                          <span className="font-bold tabular-nums">
                            {formatPriceFromPaise(
                              billSummary.sgstPaise,
                              billSummary.currencyCode,
                            )}
                          </span>
                        </div>
                      </>
                    )}
                    {billSummary.serviceChargePercent > 0 && (
                      <div className="flex justify-between text-[#4B5563]">
                        <span>
                          Service Charge ({billSummary.serviceChargePercent}%)
                        </span>
                        <span className="font-bold tabular-nums">
                          {formatPriceFromPaise(
                            billSummary.serviceChargePaise,
                            billSummary.currencyCode,
                          )}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between items-baseline border-t border-[#1E1B4B]/15 pt-2 text-[17px] font-black text-[#1E1B4B]">
                      <span>Grand Total</span>
                      <span className="tabular-nums">
                        {formatPriceFromPaise(
                          billSummary.grandTotalPaise,
                          billSummary.currencyCode,
                        )}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Dynamic UPI Pay QR & Actions (when unpaid) */}
                {!billSummary.isCheckedOut && (
                  <div className="space-y-3">
                    {upiUri && (
                      <div className="rounded-2xl border border-[#1E1B4B]/15 bg-white p-4 text-center space-y-3">
                        <p className="text-[12px] font-extrabold uppercase tracking-wider text-[#1E1B4B]">
                          Scan or Tap to Pay via UPI
                        </p>
                        <UpiQrCanvas uri={upiUri} />
                        <p className="font-mono text-[11.5px] font-bold text-[#6B7280]">
                          {billSummary.upiId}
                        </p>
                        <div className="grid gap-2 sm:grid-cols-2">
                          <a
                            href={upiUri}
                            className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-[#1E1B4B]/20 bg-[#F8F9FA] px-3 text-[12px] font-extrabold text-[#1E1B4B] hover:bg-white"
                          >
                            <Smartphone className="h-3.5 w-3.5" aria-hidden />
                            Open UPI App
                            <ExternalLink className="h-3 w-3" aria-hidden />
                          </a>
                          <button
                            type="button"
                            disabled={
                              markingUpi ||
                              billSummary.paymentStatus === 'upi_pending_verify'
                            }
                            onClick={() => void handleMarkPaidViaUpi()}
                            className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl bg-[#D2DB76] px-3 text-[12px] font-extrabold text-[#1E1B4B] hover:brightness-95 disabled:opacity-60 cursor-pointer"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                            {billSummary.paymentStatus === 'upi_pending_verify'
                              ? 'Notified Staff ✓'
                              : markingUpi
                                ? 'Notifying…'
                                : "I've Paid via UPI"}
                          </button>
                        </div>
                      </div>
                    )}

                    <button
                      type="button"
                      disabled={requestingBill}
                      onClick={() => void handleRequestFinalBill()}
                      className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#1E1B4B] px-5 text-[14px] font-extrabold text-white hover:bg-[#2E2A6E] active:scale-[0.98] disabled:opacity-60 cursor-pointer"
                    >
                      <Receipt className="h-4 w-4 text-[#D2DB76]" aria-hidden />
                      {requestingBill
                        ? 'Requesting Bill…'
                        : 'Request Final Bill / Checkout'}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
