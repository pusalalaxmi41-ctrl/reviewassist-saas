import type { BusinessCategory } from '../types/business';
import type {
  BarberBookingType,
  BarberQueueConfig,
  BarberQueueConfigInput,
  BarberQueueDelayIncrement,
  BarberQueueService,
  BarberQueueTicket,
  BarberQueueTicketStatus,
} from '../types/barberQueue';
import { validateBusinessId } from './aiConfigValidation';

export const ALLOWED_BARBER_TICKET_STATUSES: ReadonlyArray<BarberQueueTicketStatus> = [
  'waiting',
  'in_chair',
  'completed',
  'no_show',
  'cancelled',
];

export const ALLOWED_QUEUE_DELAY_INCREMENTS: ReadonlyArray<BarberQueueDelayIncrement> = [
  5, 10, 15, 20, 30,
];

export const DEFAULT_BARBER_SERVICES: ReadonlyArray<BarberQueueService> = [
  {
    id: 'haircut',
    name: 'Classic Haircut',
    durationMinutes: 20,
    pricePaise: 20000,
  },
  {
    id: 'beard',
    name: 'Beard Trim & Styling',
    durationMinutes: 15,
    pricePaise: 15000,
  },
  {
    id: 'combo',
    name: 'Haircut + Beard Combo',
    durationMinutes: 35,
    pricePaise: 30000,
  },
];

function stripControlChars(raw: string): string {
  return Array.from(raw)
    .filter((ch) => {
      const code = ch.charCodeAt(0);
      return code === 9 || code === 10 || code === 13 || (code >= 32 && code !== 127);
    })
    .join('')
    .trim();
}

export function isBarberOrSalonCategory(
  category: BusinessCategory | string | undefined | null,
): boolean {
  return category === 'salon' || category === 'barber';
}

export function getTodayQueueDateKey(date: Date = new Date()): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getBarberQueueUrl(
  businessSlug: string,
  baseOrigin?: string,
): string {
  const cleanSlug = stripControlChars(businessSlug).toLowerCase();
  if (!cleanSlug || !/^[a-z0-9-]{3,80}$/.test(cleanSlug)) {
    throw new Error('A valid business slug is required to generate a Live Queue URL.');
  }
  const host = (
    baseOrigin ??
    (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173')
  ).replace(/\/+$/, '');
  return `${host}/r/${cleanSlug}/queue`;
}

export function getBarberStaffUrl(
  businessSlug: string,
  baseOrigin?: string,
): string {
  const cleanSlug = stripControlChars(businessSlug).toLowerCase();
  if (!cleanSlug || !/^[a-z0-9-]{3,80}$/.test(cleanSlug)) {
    throw new Error('A valid business slug is required to generate a Barber Staff URL.');
  }
  const host = (
    baseOrigin ??
    (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173')
  ).replace(/\/+$/, '');
  return `${host}/r/${cleanSlug}/barber-staff`;
}

export function normalizeBarberServices(
  rawServices?: ReadonlyArray<Partial<BarberQueueService>> | null,
): BarberQueueService[] {
  if (!Array.isArray(rawServices) || rawServices.length === 0) {
    return DEFAULT_BARBER_SERVICES.map((s) => ({ ...s }));
  }

  const out: BarberQueueService[] = [];
  rawServices.slice(0, 30).forEach((svc, idx) => {
    const name =
      typeof svc?.name === 'string'
        ? stripControlChars(svc.name).replace(/\s+/g, ' ').slice(0, 80)
        : '';
    if (!name) return;
    const rawId =
      typeof svc?.id === 'string' && stripControlChars(svc.id)
        ? stripControlChars(svc.id).toLowerCase().replace(/[^a-z0-9-_]/g, '-')
        : `svc-${idx + 1}`;
    const durationMinutes =
      typeof svc?.durationMinutes === 'number' &&
      Number.isInteger(svc.durationMinutes) &&
      svc.durationMinutes >= 5 &&
      svc.durationMinutes <= 240
        ? svc.durationMinutes
        : 20;
    const pricePaise =
      typeof svc?.pricePaise === 'number' &&
      Number.isInteger(svc.pricePaise) &&
      svc.pricePaise >= 0 &&
      svc.pricePaise <= 100_000_000
        ? svc.pricePaise
        : 20000;
    out.push({ id: rawId, name, durationMinutes, pricePaise });
  });

  return out.length > 0
    ? out
    : DEFAULT_BARBER_SERVICES.map((s) => ({ ...s }));
}

export function normalizeBarberQueueConfig(
  businessId: string,
  partial?: Partial<BarberQueueConfig & BarberQueueConfigInput> | null,
): BarberQueueConfig {
  const avgServiceMinutes =
    typeof partial?.avgServiceMinutes === 'number' &&
    Number.isInteger(partial.avgServiceMinutes) &&
    partial.avgServiceMinutes >= 5 &&
    partial.avgServiceMinutes <= 180
      ? partial.avgServiceMinutes
      : 20;

  const maxQueueSize =
    typeof partial?.maxQueueSize === 'number' &&
    Number.isInteger(partial.maxQueueSize) &&
    partial.maxQueueSize >= 1 &&
    partial.maxQueueSize <= 200
      ? partial.maxQueueSize
      : 25;

  return {
    businessId: businessId.trim(),
    isQueueOpen:
      typeof partial?.isQueueOpen === 'boolean' ? partial.isQueueOpen : true,
    avgServiceMinutes,
    maxQueueSize,
    awardStarOnCompletion:
      typeof partial?.awardStarOnCompletion === 'boolean'
        ? partial.awardStarOnCompletion
        : true,
    services: normalizeBarberServices(partial?.services),
    createdAt: partial?.createdAt ?? new Date().toISOString(),
    updatedAt: partial?.updatedAt ?? new Date().toISOString(),
  };
}

export function validateBarberQueueConfigInput(
  businessId: unknown,
  input: unknown,
):
  | {
      ok: true;
      value: {
        isQueueOpen: boolean;
        avgServiceMinutes: number;
        maxQueueSize: number;
        awardStarOnCompletion: boolean;
        services: BarberQueueService[];
      };
    }
  | { ok: false; error: string } {
  const idErr = validateBusinessId(businessId);
  if (idErr) {
    return { ok: false, error: idErr };
  }
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { ok: false, error: 'Barber queue config input must be an object.' };
  }
  const rec = input as Partial<BarberQueueConfigInput> &
    Record<string, unknown>;
  if (typeof rec.isQueueOpen !== 'boolean') {
    return { ok: false, error: 'isQueueOpen must be a boolean.' };
  }

  const avgServiceMinutes =
    rec.avgServiceMinutes === undefined ? 20 : rec.avgServiceMinutes;
  if (
    typeof avgServiceMinutes !== 'number' ||
    !Number.isInteger(avgServiceMinutes) ||
    avgServiceMinutes < 5 ||
    avgServiceMinutes > 180
  ) {
    return {
      ok: false,
      error: 'Average service duration must be an integer between 5 and 180 minutes.',
    };
  }

  const maxQueueSize = rec.maxQueueSize === undefined ? 25 : rec.maxQueueSize;
  if (
    typeof maxQueueSize !== 'number' ||
    !Number.isInteger(maxQueueSize) ||
    maxQueueSize < 1 ||
    maxQueueSize > 200
  ) {
    return {
      ok: false,
      error: 'Max queue size must be an integer between 1 and 200.',
    };
  }

  const awardStarOnCompletion =
    typeof rec.awardStarOnCompletion === 'boolean'
      ? rec.awardStarOnCompletion
      : true;

  const services = normalizeBarberServices(
    Array.isArray(rec.services)
      ? (rec.services as BarberQueueService[])
      : undefined,
  );

  return {
    ok: true,
    value: {
      isQueueOpen: rec.isQueueOpen,
      avgServiceMinutes,
      maxQueueSize,
      awardStarOnCompletion,
      services,
    },
  };
}

export function validateJoinBarberQueueInput(
  input: unknown,
):
  | {
      ok: true;
      value: {
        businessSlug: string;
        guestName: string;
        phone: string | null;
        serviceName: string;
        bookingType: BarberBookingType;
        scheduledTime: string | null;
        scheduledAtOverride: string | null;
        queueDateOverride: string | null;
      };
    }
  | { ok: false; error: string } {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { ok: false, error: 'Queue check-in details must be an object.' };
  }
  const rec = input as Record<string, unknown>;
  const slug =
    typeof rec.businessSlug === 'string'
      ? stripControlChars(rec.businessSlug).toLowerCase()
      : '';
  if (!/^[a-z0-9-]{3,80}$/.test(slug)) {
    return { ok: false, error: 'A valid shop slug is required.' };
  }

  if (typeof rec.guestName !== 'string') {
    return { ok: false, error: 'Please enter your name.' };
  }
  const guestName = stripControlChars(rec.guestName).replace(/\s+/g, ' ');
  if (guestName.length < 1 || guestName.length > 80) {
    return {
      ok: false,
      error: 'Name must be between 1 and 80 characters.',
    };
  }

  let phone: string | null = null;
  if (rec.phone !== undefined && rec.phone !== null && rec.phone !== '') {
    if (typeof rec.phone !== 'string') {
      return { ok: false, error: 'Phone number must be text.' };
    }
    const cleanPhone = stripControlChars(rec.phone).replace(/\s+/g, ' ');
    if (cleanPhone.length > 40) {
      return { ok: false, error: 'Phone number must be 40 characters or fewer.' };
    }
    phone = cleanPhone || null;
  }

  const rawService =
    typeof rec.serviceName === 'string'
      ? stripControlChars(rec.serviceName).replace(/\s+/g, ' ')
      : '';
  const serviceName = rawService.slice(0, 100) || 'Classic Haircut';

  const rawBookingType =
    typeof rec.bookingType === 'string'
      ? stripControlChars(rec.bookingType).toLowerCase()
      : 'walk_in';
  if (rawBookingType !== 'walk_in' && rawBookingType !== 'appointment') {
    return {
      ok: false,
      error: 'Booking type must be walk_in or appointment.',
    };
  }
  const bookingType: BarberBookingType = rawBookingType;

  let scheduledTime: string | null = null;
  if (bookingType === 'appointment') {
    const cleanTime =
      typeof rec.scheduledTime === 'string'
        ? stripControlChars(rec.scheduledTime)
        : '';
    if (!/^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(cleanTime)) {
      return {
        ok: false,
        error: 'Please select a valid appointment time slot (HH:MM).',
      };
    }
    scheduledTime = cleanTime;
  }

  const scheduledAtOverride =
    typeof rec.scheduledAtOverride === 'string' &&
    rec.scheduledAtOverride.trim().length > 0
      ? rec.scheduledAtOverride.trim()
      : null;

  const queueDateOverride =
    typeof rec.queueDateOverride === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(rec.queueDateOverride.trim())
      ? rec.queueDateOverride.trim()
      : null;

  return {
    ok: true,
    value: {
      businessSlug: slug,
      guestName,
      phone,
      serviceName,
      bookingType,
      scheduledTime,
      scheduledAtOverride,
      queueDateOverride,
    },
  };
}

export function validateBarberDelayMinutes(
  minutes: unknown,
):
  | { ok: true; value: BarberQueueDelayIncrement }
  | { ok: false; error: string } {
  if (
    typeof minutes !== 'number' ||
    !ALLOWED_QUEUE_DELAY_INCREMENTS.includes(
      minutes as BarberQueueDelayIncrement,
    )
  ) {
    return {
      ok: false,
      error: `Extension minutes must be one of: ${ALLOWED_QUEUE_DELAY_INCREMENTS.join(', ')}.`,
    };
  }
  return { ok: true, value: minutes as BarberQueueDelayIncrement };
}

export function validateBarberTicketStatus(
  status: unknown,
):
  | { ok: true; value: BarberQueueTicketStatus }
  | { ok: false; error: string } {
  if (
    typeof status !== 'string' ||
    !ALLOWED_BARBER_TICKET_STATUSES.includes(
      status.trim() as BarberQueueTicketStatus,
    )
  ) {
    return {
      ok: false,
      error: `Queue status must be one of: ${ALLOWED_BARBER_TICKET_STATUSES.join(', ')}.`,
    };
  }
  return { ok: true, value: status.trim() as BarberQueueTicketStatus };
}

/**
 * Generates the scannable personal Live Queue Token QR payload displayed on a
 * customer's phone right after they scan the shop QR and join the walk-in line.
 */
export function encodeBarberQueueTicketQr(
  businessSlug: string,
  ticketId: string,
  tokenNumber: number,
): string {
  const cleanSlug = stripControlChars(businessSlug).toLowerCase();
  const cleanId = stripControlChars(ticketId);
  return `vitaran-queue://${cleanSlug}/${cleanId}#${tokenNumber}`;
}

/**
 * Parses a customer's Personal Token QR code, raw ticket ID, or manual token
 * number (`#4` / `4`) entered or scanned by the barber at the chair.
 */
export function parseBarberQueueTicketQr(
  rawInput: string,
): { businessSlug?: string; ticketId?: string; tokenNumber?: number } | null {
  const cleaned = stripControlChars(rawInput);
  if (!cleaned) return null;

  // 1. Full personal Token QR format: vitaran-queue://<slug>/<ticketId>#<token>
  const qrMatch =
    /^vitaran-queue:\/\/([a-z0-9-]{3,80})\/([a-zA-Z0-9_-]{4,80})(?:#(\d{1,5}))?$/i.exec(
      cleaned,
    );
  if (qrMatch) {
    return {
      businessSlug: qrMatch[1].toLowerCase(),
      ticketId: qrMatch[2],
      tokenNumber: qrMatch[3] ? Number.parseInt(qrMatch[3], 10) : undefined,
    };
  }

  // 2. Simple manual token number or display code: "#4", "4", "Token 4", "W-04", "B-02"
  const numMatch = /^(?:token\s*|[wb]-)?#?(\d{1,5})$/i.exec(cleaned);
  if (numMatch) {
    return {
      tokenNumber: Number.parseInt(numMatch[1], 10),
    };
  }

  // 3. Raw ticket ID (UUID or mock bqt-...)
  if (/^[a-zA-Z0-9_-]{6,80}$/.test(cleaned)) {
    return { ticketId: cleaned };
  }

  return null;
}

/** Formats a 24-hour HH:MM slot (e.g. '16:30') into friendly 12-hour format ('4:30 PM'). */
export function formatTimeSlot12h(hhmm: string | null | undefined): string {
  if (!hhmm || !/^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(hhmm.trim())) {
    return '';
  }
  const [hStr, mStr] = hhmm.trim().split(':');
  const h24 = Number.parseInt(hStr, 10);
  const period = h24 >= 12 ? 'PM' : 'AM';
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${mStr} ${period}`;
}

/** Returns clean daily display badge code: 'W-01' for walk-ins or 'B-01' for appointments. */
export function formatTicketDisplayCode(ticket: {
  bookingType?: BarberBookingType;
  displayCode?: string;
  tokenNumber: number;
}): string {
  if (ticket.displayCode && ticket.displayCode.trim().length > 0) {
    return ticket.displayCode.trim().toUpperCase();
  }
  const prefix = ticket.bookingType === 'appointment' ? 'B' : 'W';
  return `${prefix}-${String(ticket.tokenNumber).padStart(2, '0')}`;
}

/** Generates 30-minute bookable appointment slots from 09:00 AM to 09:30 PM. */
export function generateBookableTimeSlots(): Array<{
  value: string;
  label: string;
}> {
  const slots: Array<{ value: string; label: string }> = [];
  for (let hour = 9; hour <= 21; hour++) {
    for (const min of [0, 30]) {
      const value = `${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
      slots.push({ value, label: formatTimeSlot12h(value) });
    }
  }
  return slots;
}

/**
 * Resolves a local today HH:MM time string into an ISO timestamp for fair queue sorting.
 */
export function resolveScheduledAtForDate(
  queueDate: string,
  scheduledTime: string,
): string {
  const [y, m, d] = queueDate.split('-').map((n) => Number.parseInt(n, 10));
  const [hh, mm] = scheduledTime.split(':').map((n) => Number.parseInt(n, 10));
  const dt = new Date(y, (m || 1) - 1, d || 1, hh || 0, mm || 0, 0, 0);
  return dt.toISOString();
}

/**
 * Fair Hybrid Slot-Weaving Merge Algorithm (identical to PostgreSQL RPC 1):
 * Merges offline walk-ins (FIFO) and reserved time-slot appointments (chronological)
 * so walk-ins fill open gaps before reserved slots and never get unfairly bumped.
 */
export function mergeHybridBarberQueue(
  inChairRemainingMinutes: number,
  rawWaitingTickets: ReadonlyArray<BarberQueueTicket>,
  nowMs: number = Date.now(),
): {
  mergedTickets: BarberQueueTicket[];
  estimatedWaitForNewGuestMinutes: number;
} {
  const walkIns = rawWaitingTickets
    .filter((t) => (t.bookingType ?? 'walk_in') === 'walk_in')
    .sort((a, b) => a.tokenNumber - b.tokenNumber);

  const appointments = rawWaitingTickets
    .filter((t) => t.bookingType === 'appointment')
    .sort((a, b) => {
      const ta = new Date(a.scheduledAt ?? a.createdAt).getTime();
      const tb = new Date(b.scheduledAt ?? b.createdAt).getTime();
      if (ta !== tb) return ta - tb;
      return a.tokenNumber - b.tokenNumber;
    });

  let wIdx = 0;
  let aIdx = 0;
  let cursor = Math.max(0, inChairRemainingMinutes);
  const mergedTickets: BarberQueueTicket[] = [];

  while (wIdx < walkIns.length || aIdx < appointments.length) {
    let apptOffset = Number.POSITIVE_INFINITY;
    if (aIdx < appointments.length) {
      const a = appointments[aIdx];
      const schedMs = new Date(a.scheduledAt ?? a.createdAt).getTime();
      apptOffset = Math.max(0, Math.round((schedMs - nowMs) / 60_000));
    }

    if (
      wIdx < walkIns.length &&
      (aIdx >= appointments.length ||
        cursor + walkIns[wIdx].durationMinutes <= apptOffset)
    ) {
      const w = walkIns[wIdx];
      mergedTickets.push({
        ...w,
        bookingType: 'walk_in',
        displayCode: formatTicketDisplayCode(w),
        position: mergedTickets.length + 1,
        estimatedWaitMinutes: Math.max(0, cursor + w.extraDelayMinutes),
      });
      cursor += w.durationMinutes;
      wIdx++;
    } else {
      const a = appointments[aIdx];
      const apptStart = Math.max(cursor, apptOffset);
      mergedTickets.push({
        ...a,
        bookingType: 'appointment',
        displayCode: formatTicketDisplayCode(a),
        position: mergedTickets.length + 1,
        estimatedWaitMinutes: Math.max(0, apptStart + a.extraDelayMinutes),
      });
      cursor = apptStart + a.durationMinutes;
      aIdx++;
    }
  }

  return {
    mergedTickets,
    estimatedWaitForNewGuestMinutes: Math.max(0, cursor),
  };
}
