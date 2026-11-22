import type { BusinessCategory } from '../types/business';
import type {
  BarberQueueConfig,
  BarberQueueConfigInput,
  BarberQueueDelayIncrement,
  BarberQueueService,
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

  return {
    ok: true,
    value: {
      businessSlug: slug,
      guestName,
      phone,
      serviceName,
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
