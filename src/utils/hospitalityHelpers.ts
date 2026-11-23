import type {
  DishSpiceLevel,
  OpenTableBillSummary,
  RestaurantOrderSource,
  RestaurantPaymentMethod,
  RestaurantTableCallType,
  RestaurantTableOrder,
} from '../types/restaurant';
import { formatPriceFromPaise } from './restaurantValidation';

export const ALLOWED_ORDER_SOURCES: ReadonlyArray<RestaurantOrderSource> = [
  'qr_table',
  'qr_room',
  'pos_dine_in',
  'pos_takeaway',
  'pos_delivery',
  'swiggy',
  'zomato',
  'magicpin',
  'ondc',
  'phone',
  'website',
];

export const PLATFORM_ORDER_SOURCES: ReadonlyArray<RestaurantOrderSource> = [
  'swiggy',
  'zomato',
  'magicpin',
  'ondc',
  'phone',
  'website',
];

export const ORDER_SOURCE_METADATA: Record<
  RestaurantOrderSource,
  {
    label: string;
    shortLabel: string;
    badgeBg: string;
    badgeText: string;
    isPlatform: boolean;
  }
> = {
  qr_table: {
    label: 'QR Table Order',
    shortLabel: 'QR Table',
    badgeBg: 'bg-indigo-50 border-indigo-200',
    badgeText: 'text-indigo-900',
    isPlatform: false,
  },
  qr_room: {
    label: 'QR Room Service',
    shortLabel: 'Room QR',
    badgeBg: 'bg-violet-50 border-violet-200',
    badgeText: 'text-violet-900',
    isPlatform: false,
  },
  pos_dine_in: {
    label: 'POS Dine-In',
    shortLabel: 'POS Dine-In',
    badgeBg: 'bg-[#1E1B4B]/10 border-[#1E1B4B]/20',
    badgeText: 'text-[#1E1B4B]',
    isPlatform: false,
  },
  pos_takeaway: {
    label: 'POS Takeaway',
    shortLabel: 'Takeaway',
    badgeBg: 'bg-sky-50 border-sky-200',
    badgeText: 'text-sky-900',
    isPlatform: false,
  },
  pos_delivery: {
    label: 'POS Delivery',
    shortLabel: 'Delivery',
    badgeBg: 'bg-teal-50 border-teal-200',
    badgeText: 'text-teal-900',
    isPlatform: false,
  },
  swiggy: {
    label: 'Swiggy',
    shortLabel: 'Swiggy',
    badgeBg: 'bg-orange-100 border-orange-300',
    badgeText: 'text-orange-950',
    isPlatform: true,
  },
  zomato: {
    label: 'Zomato',
    shortLabel: 'Zomato',
    badgeBg: 'bg-rose-100 border-rose-300',
    badgeText: 'text-rose-950',
    isPlatform: true,
  },
  magicpin: {
    label: 'Magicpin',
    shortLabel: 'Magicpin',
    badgeBg: 'bg-fuchsia-100 border-fuchsia-300',
    badgeText: 'text-fuchsia-950',
    isPlatform: true,
  },
  ondc: {
    label: 'ONDC',
    shortLabel: 'ONDC',
    badgeBg: 'bg-cyan-100 border-cyan-300',
    badgeText: 'text-cyan-950',
    isPlatform: true,
  },
  phone: {
    label: 'Phone Order',
    shortLabel: 'Phone',
    badgeBg: 'bg-amber-100 border-amber-300',
    badgeText: 'text-amber-950',
    isPlatform: true,
  },
  website: {
    label: 'Own Website',
    shortLabel: 'Website',
    badgeBg: 'bg-emerald-100 border-emerald-300',
    badgeText: 'text-emerald-950',
    isPlatform: true,
  },
};

export const SPICE_LEVEL_METADATA: Record<
  DishSpiceLevel,
  { label: string; emoji: string; badgeClass: string }
> = {
  mild: {
    label: 'Mild',
    emoji: '🌿',
    badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  },
  medium: {
    label: 'Medium Spice',
    emoji: '🌶️',
    badgeClass: 'bg-amber-50 text-amber-900 border-amber-200',
  },
  spicy: {
    label: 'Spicy',
    emoji: '🌶️🌶️',
    badgeClass: 'bg-orange-100 text-orange-950 border-orange-300',
  },
  extra_spicy: {
    label: 'Extra Spicy',
    emoji: '🔥',
    badgeClass: 'bg-red-100 text-red-900 border-red-300',
  },
};

export const TABLE_CALL_TYPE_METADATA: Record<
  RestaurantTableCallType,
  {
    label: string;
    shortLabel: string;
    emoji: string;
    spokenPhrase: string;
    badgeClass: string;
  }
> = {
  assistance: {
    label: 'Call Waiter',
    shortLabel: 'Waiter',
    emoji: '🙋',
    spokenPhrase: 'requesting waiter assistance',
    badgeClass: 'bg-indigo-100 text-indigo-950 border-indigo-200',
  },
  water: {
    label: 'Water',
    shortLabel: 'Water',
    emoji: '💧',
    spokenPhrase: 'requesting drinking water',
    badgeClass: 'bg-sky-100 text-sky-950 border-sky-200',
  },
  bill_request: {
    label: 'Bill Please',
    shortLabel: 'Bill',
    emoji: '🧾',
    spokenPhrase: 'asking for the final bill',
    badgeClass: 'bg-red-100 text-red-900 border-red-300',
  },
  ready_for_bill: {
    label: 'Bill Please',
    shortLabel: 'Bill',
    emoji: '🧾',
    spokenPhrase: 'asking for the final bill',
    badgeClass: 'bg-red-100 text-red-900 border-red-300',
  },
  clean_table: {
    label: 'Clean Table',
    shortLabel: 'Clean',
    emoji: '🧹',
    spokenPhrase: 'requesting table cleaning',
    badgeClass: 'bg-amber-100 text-amber-950 border-amber-300',
  },
};

export function isBillRequestCallType(
  callType: RestaurantTableCallType | string | null | undefined,
): boolean {
  return callType === 'bill_request' || callType === 'ready_for_bill';
}

export function isPlatformOrOffPremiseSource(
  source: RestaurantOrderSource | undefined | null,
): boolean {
  if (!source) return false;
  return (
    source !== 'qr_table' && source !== 'qr_room' && source !== 'pos_dine_in'
  );
}

export function getKitchenDisplayUrl(
  businessSlug: string,
  baseOrigin?: string,
): string {
  const cleanSlug = businessSlug.trim().toLowerCase();
  const host = (
    baseOrigin ??
    (typeof window !== 'undefined'
      ? window.location.origin
      : 'http://localhost:5173')
  ).replace(/\/+$/, '');
  return `${host}/r/${cleanSlug}/kitchen`;
}

/**
 * Computes tax & service charge breakdown cleanly in paise (identical to SQL RPC).
 * GST auto-splits equally into CGST + SGST.
 */
export function calculateBillTotals(params: {
  subtotalPaise: number;
  gstPercent?: number | null;
  serviceChargePercent?: number | null;
}): {
  subtotalPaise: number;
  gstPercent: number;
  gstPaise: number;
  cgstPaise: number;
  sgstPaise: number;
  serviceChargePercent: number;
  serviceChargePaise: number;
  grandTotalPaise: number;
} {
  const subtotalPaise = Math.max(0, Math.round(params.subtotalPaise));
  const gstPercent =
    typeof params.gstPercent === 'number' &&
    Number.isFinite(params.gstPercent) &&
    params.gstPercent >= 0 &&
    params.gstPercent <= 28
      ? Math.round(params.gstPercent * 100) / 100
      : 0;
  const serviceChargePercent =
    typeof params.serviceChargePercent === 'number' &&
    Number.isFinite(params.serviceChargePercent) &&
    params.serviceChargePercent >= 0 &&
    params.serviceChargePercent <= 25
      ? Math.round(params.serviceChargePercent * 100) / 100
      : 0;

  const gstPaise = Math.round((subtotalPaise * gstPercent) / 100);
  const cgstPaise = Math.floor(gstPaise / 2);
  const sgstPaise = gstPaise - cgstPaise;
  const serviceChargePaise = Math.round(
    (subtotalPaise * serviceChargePercent) / 100,
  );
  const grandTotalPaise = subtotalPaise + gstPaise + serviceChargePaise;

  return {
    subtotalPaise,
    gstPercent,
    gstPaise,
    cgstPaise,
    sgstPaise,
    serviceChargePercent,
    serviceChargePaise,
    grandTotalPaise,
  };
}

/** Builds a standard NPCI UPI deep-link URI for dynamic QR rendering. */
export function buildUpiPaymentUri(params: {
  upiId: string;
  payeeName: string;
  amountPaise: number;
  note?: string;
}): string {
  const pa = params.upiId.trim();
  const pn = params.payeeName.trim() || 'Merchant';
  const am = (Math.max(0, params.amountPaise) / 100).toFixed(2);
  const tn = (params.note ?? 'Dining Bill').trim().slice(0, 60);
  return `upi://pay?pa=${encodeURIComponent(pa)}&pn=${encodeURIComponent(pn)}&am=${am}&cu=INR&tn=${encodeURIComponent(tn)}`;
}

/** Formats elapsed minutes nicely (`42m`, `1h 12m`, `<1m`). */
export function formatElapsedOccupancy(isoSince: string | null | undefined): string {
  if (!isoSince) return '';
  const diffMs = Math.max(0, Date.now() - new Date(isoSince).getTime());
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return '<1m';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  const rem = mins % 60;
  return `${hrs}h ${rem}m`;
}

/** Formats MM:SS live kitchen prep timer from an ISO timestamp. */
export function formatElapsedTimerMMSS(isoCreatedAt: string, nowMs: number): {
  label: string;
  minutes: number;
} {
  const diffSec = Math.max(
    0,
    Math.floor((nowMs - new Date(isoCreatedAt).getTime()) / 1000),
  );
  const mins = Math.floor(diffSec / 60);
  const secs = diffSec % 60;
  return {
    label: `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`,
    minutes: mins,
  };
}

/**
 * Soft, pleasant browser-native Web Audio API notification chime (zero external audio files).
 * - 'chat':  gentle crystalline 2-note ping for incoming guest/staff chat messages
 * - 'order': warm kitchen double chime for new orders or ready dishes
 * - 'alert': crisp attention chime for water / clean / bill / waiter requests
 */
export function playNotificationChime(
  kind: 'chat' | 'order' | 'alert' = 'chat',
  enabled = true,
): void {
  if (!enabled) return;
  try {
    if (typeof window === 'undefined') return;
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioCtx) return;

    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    const notes: Array<{ freq: number; start: number; dur: number; peak: number }> =
      kind === 'chat'
        ? [
            { freq: 880, start: 0, dur: 0.11, peak: 0.08 },
            { freq: 1174.66, start: 0.09, dur: 0.16, peak: 0.09 },
          ]
        : kind === 'order'
          ? [
              { freq: 659.25, start: 0, dur: 0.12, peak: 0.11 },
              { freq: 987.77, start: 0.11, dur: 0.22, peak: 0.12 },
            ]
          : [
              { freq: 783.99, start: 0, dur: 0.11, peak: 0.11 },
              { freq: 1046.5, start: 0.1, dur: 0.2, peak: 0.12 },
            ];

    for (const n of notes) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(n.freq, now + n.start);
      gain.gain.setValueAtTime(0.0001, now + n.start);
      gain.gain.exponentialRampToValueAtTime(n.peak, now + n.start + 0.018);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + n.start + n.dur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + n.start);
      osc.stop(now + n.start + n.dur + 0.02);
    }

    window.setTimeout(() => {
      void ctx.close().catch(() => {
        // ignore audio context cleanup error
      });
    }, 500);
  } catch {
    // ignore autoplay policy restrictions before user gesture
  }
}

/** Browser-native Web Speech API TTS announcement for incoming floor alerts & orders. */
export function speakHospitalityAlert(text: string, enabled: boolean): void {
  if (!enabled || !text.trim()) return;
  try {
    if (
      typeof window === 'undefined' ||
      typeof window.speechSynthesis === 'undefined' ||
      typeof SpeechSynthesisUtterance === 'undefined'
    ) {
      return;
    }
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-IN';
    utterance.rate = 1.02;
    utterance.pitch = 1.0;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  } catch {
    // ignore speech API restrictions
  }
}

function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Opens a crisp 80mm thermal print receipt window (or downloads HTML receipt). */
export function printOrDownloadTableBillReceipt(
  bill: OpenTableBillSummary,
  options?: {
    paymentMethod?: RestaurantPaymentMethod | null;
    downloadOnly?: boolean;
  },
): void {
  const allItems: Array<{ name: string; qty: number; totalPaise: number }> = [];
  for (const order of bill.orders) {
    for (const item of order.items) {
      allItems.push({
        name: item.name,
        qty: item.quantity,
        totalPaise: item.pricePaise * item.quantity,
      });
    }
  }

  const rowsHtml = allItems
    .map(
      (i) =>
        `<tr><td>${escapeHtml(i.name)}</td><td style="text-align:center;">${i.qty}</td><td style="text-align:right;">${escapeHtml(formatPriceFromPaise(i.totalPaise, bill.currencyCode))}</td></tr>`,
    )
    .join('');

  const payMethod = options?.paymentMethod ?? bill.paymentMethod;
  const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Bill Receipt - ${escapeHtml(bill.businessName)} (${escapeHtml(bill.tableNumber)})</title>
  <style>
    body { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; width: 320px; margin: 16px auto; color: #111827; font-size: 12px; }
    h1 { font-size: 16px; text-align: center; margin: 0 0 4px; }
    .meta { text-align: center; color: #4B5563; margin-bottom: 12px; font-size: 11px; }
    hr { border: none; border-top: 1px dashed #9CA3AF; margin: 10px 0; }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 4px 0; vertical-align: top; }
    th { border-bottom: 1px solid #D1D5DB; font-size: 11px; text-transform: uppercase; }
    .summary-row { display: flex; justify-content: space-between; margin: 3px 0; }
    .grand { font-size: 15px; font-weight: 800; border-top: 1px solid #111827; padding-top: 6px; margin-top: 6px; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 999px; background: #DCFCE7; color: #166534; font-weight: 700; font-size: 11px; }
    .foot { text-align: center; margin-top: 14px; font-size: 11px; color: #6B7280; }
  </style>
</head>
<body>
  <h1>${escapeHtml(bill.businessName)}</h1>
  <div class="meta">
    ${bill.gstin ? `GSTIN: ${escapeHtml(bill.gstin)}<br/>` : ''}
    ${bill.locationType === 'room' ? 'Room' : 'Table'}: <strong>${escapeHtml(bill.tableNumber)}</strong><br/>
    ${new Date(bill.paidAt ?? Date.now()).toLocaleString('en-IN')}<br/>
    ${bill.isCheckedOut ? '<span class="badge">PAID &amp; VERIFIED</span>' : '<span class="badge" style="background:#FEF3C7;color:#92400E;">OPEN BILL</span>'}
    ${payMethod ? ` · ${escapeHtml(payMethod.toUpperCase())}` : ''}
  </div>
  <hr />
  <table>
    <thead><tr><th style="text-align:left;">Item</th><th style="text-align:center;">Qty</th><th style="text-align:right;">Amt</th></tr></thead>
    <tbody>${rowsHtml}</tbody>
  </table>
  <hr />
  <div class="summary-row"><span>Subtotal</span><span>${escapeHtml(formatPriceFromPaise(bill.subtotalPaise, bill.currencyCode))}</span></div>
  ${
    bill.gstPercent > 0
      ? `<div class="summary-row"><span>CGST (${(bill.gstPercent / 2).toFixed(2)}%)</span><span>${escapeHtml(formatPriceFromPaise(bill.cgstPaise, bill.currencyCode))}</span></div>
         <div class="summary-row"><span>SGST (${(bill.gstPercent / 2).toFixed(2)}%)</span><span>${escapeHtml(formatPriceFromPaise(bill.sgstPaise, bill.currencyCode))}</span></div>`
      : ''
  }
  ${
    bill.serviceChargePercent > 0
      ? `<div class="summary-row"><span>Service Charge (${bill.serviceChargePercent}%)</span><span>${escapeHtml(formatPriceFromPaise(bill.serviceChargePaise, bill.currencyCode))}</span></div>`
      : ''
  }
  <div class="summary-row grand"><span>GRAND TOTAL</span><span>${escapeHtml(formatPriceFromPaise(bill.grandTotalPaise, bill.currencyCode))}</span></div>
  <div class="foot">Thank you for visiting ${escapeHtml(bill.businessName)}!<br/>Powered by Vitaran HospitalityOS</div>
</body>
</html>`;

  if (options?.downloadOnly) {
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bill-${bill.tableKey}-${Date.now()}.html`;
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    return;
  }

  const w = window.open('', '_blank', 'width=400,height=640');
  if (w) {
    w.document.write(html);
    w.document.close();
    w.focus();
    window.setTimeout(() => {
      w.print();
    }, 200);
  }
}

/** Opens a crisp 80mm Kitchen Order Ticket (KOT) print sheet. */
export function printKitchenKotTicket(
  order: RestaurantTableOrder,
  businessName: string,
): void {
  const sourceMeta =
    ORDER_SOURCE_METADATA[order.orderSource ?? 'qr_table'] ??
    ORDER_SOURCE_METADATA.qr_table;
  const headerLoc = order.platformOrderNumber
    ? `${sourceMeta.shortLabel.toUpperCase()} #${order.platformOrderNumber}`
    : order.tableNumber
      ? `${order.locationType === 'room' ? 'ROOM' : 'TABLE'} ${order.tableNumber}`
      : sourceMeta.label.toUpperCase();

  const itemsHtml = order.items
    .map(
      (i) =>
        `<div style="margin:6px 0;font-size:14px;"><strong>${i.quantity} × ${escapeHtml(i.name)}</strong>${i.notes ? `<div style="font-size:11px;color:#B45309;">Note: ${escapeHtml(i.notes)}</div>` : ''}</div>`,
    )
    .join('');

  const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>KOT - ${escapeHtml(headerLoc)}</title>
  <style>
    body { font-family: ui-monospace, monospace; width: 300px; margin: 12px auto; color: #111; }
    .hdr { text-align:center; border-bottom: 2px solid #111; padding-bottom: 8px; margin-bottom: 8px; }
    .loc { font-size: 20px; font-weight: 900; }
    .note { background: #FEF3C7; border: 1px solid #D97706; padding: 6px; margin: 8px 0; font-weight: 700; font-size: 12px; }
  </style>
</head>
<body>
  <div class="hdr">
    <div style="font-size:11px;">KITCHEN ORDER TICKET (KOT)</div>
    <div style="font-weight:700;">${escapeHtml(businessName)}</div>
    <div class="loc">${escapeHtml(headerLoc)}</div>
    <div style="font-size:11px;">${new Date(order.createdAt).toLocaleTimeString('en-IN')} ${order.guestName ? `· ${escapeHtml(order.guestName)}` : ''}</div>
  </div>
  ${order.kitchenNote ? `<div class="note">KITCHEN NOTE: ${escapeHtml(order.kitchenNote)}</div>` : ''}
  <div>${itemsHtml}</div>
</body>
</html>`;

  const w = window.open('', '_blank', 'width=360,height=520');
  if (w) {
    w.document.write(html);
    w.document.close();
    w.focus();
    window.setTimeout(() => {
      w.print();
    }, 150);
  }
}
