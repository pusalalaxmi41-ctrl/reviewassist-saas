import type { Business } from './business';
import type { RestaurantReward } from './restaurant';

export type BarberQueueTicketStatus =
  | 'waiting'
  | 'in_chair'
  | 'completed'
  | 'no_show'
  | 'cancelled';

export type BarberBookingType = 'walk_in' | 'appointment';

export type BarberQueueDelayIncrement = 5 | 10 | 15 | 20 | 30;

export interface BarberQueueService {
  id: string;
  name: string;
  durationMinutes: number;
  pricePaise: number;
}

export interface BarberQueueConfig {
  businessId: string;
  isQueueOpen: boolean;
  avgServiceMinutes: number;
  maxQueueSize: number;
  awardStarOnCompletion: boolean;
  services: BarberQueueService[];
  createdAt?: string;
  updatedAt: string;
}

export interface BarberQueueConfigInput {
  isQueueOpen: boolean;
  avgServiceMinutes?: number;
  maxQueueSize?: number;
  awardStarOnCompletion?: boolean;
  services?: BarberQueueService[];
}

export interface BarberQueueTicket {
  id: string;
  businessId: string;
  customerId: string | null;
  queueDate: string;
  tokenNumber: number;
  bookingType?: BarberBookingType;
  /** Human-friendly daily code: W-01, W-02 for walk-ins; B-01, B-02 for booked slots. */
  displayCode?: string;
  /** HH:MM (24-hr) reserved time slot for appointments, null for immediate walk-ins. */
  scheduledTime?: string | null;
  /** ISO timestamp used for fair chronological merging of walk-ins and appointments. */
  scheduledAt?: string;
  /** Immutable price snapshot in paise recorded at booking/completion for daily & monthly revenue ledgers. */
  pricePaise?: number;
  guestName: string;
  phone?: string | null;
  serviceName: string;
  durationMinutes: number;
  status: BarberQueueTicketStatus;
  extraDelayMinutes: number;
  assignedBarberLabel: string | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  /** 1-based position in the active waiting line (for waiting tickets). */
  position?: number;
  /** Dynamic estimated wait in minutes accounting for in-chair remaining + queue ahead + extraDelayMinutes. */
  estimatedWaitMinutes?: number;
  /** Remaining minutes for the active in-chair ticket. */
  remainingMinutes?: number;
}

export interface PublicBarberQueueStatusPayload {
  business: Pick<
    Business,
    'id' | 'slug' | 'name' | 'category' | 'city' | 'googleReviewUrl'
  >;
  config: BarberQueueConfig;
  nowServing: BarberQueueTicket | null;
  waitingTickets: BarberQueueTicket[];
  waitingCount: number;
  estimatedWaitForNewGuestMinutes: number;
  completedTodayCount: number;
  /** Booked HH:MM slots today (used to dim taken slots on the customer appointment picker). */
  bookedSlotsToday?: string[];
  rewards: RestaurantReward[];
}

export interface JoinBarberQueueInput {
  businessSlug: string;
  guestName: string;
  phone?: string | null;
  serviceName?: string;
  bookingType?: BarberBookingType;
  /** Required when bookingType === 'appointment' (24-hr HH:MM format, e.g. '16:30'). */
  scheduledTime?: string | null;
  /** Optional explicit ISO timestamp (used in deterministic tests for slot offsets). */
  scheduledAtOverride?: string | null;
  /** Optional explicit YYYY-MM-DD queue date (used in deterministic daily-reset tests). */
  queueDateOverride?: string | null;
}

export interface BarberServiceBreakdownRow {
  serviceName: string;
  countToday: number;
  revenueTodayPaise: number;
  countMonth: number;
  revenueMonthPaise: number;
}

export interface BarberRevenueSummary {
  businessId: string;
  monthKey: string;
  todayDate: string;
  todayTotalCuts: number;
  todayRevenuePaise: number;
  todayWalkIns: number;
  todayAppointments: number;
  monthTotalCuts: number;
  monthRevenuePaise: number;
  monthWalkIns: number;
  monthAppointments: number;
  serviceBreakdown: BarberServiceBreakdownRow[];
}

export interface JoinBarberQueueResult {
  ticket: BarberQueueTicket;
  estimatedWaitMinutes: number;
  position: number;
  loyaltyStarsBalance: number;
}

export interface ExtendBarberQueueTimerResult {
  updatedCount: number;
  addedMinutes: BarberQueueDelayIncrement;
  staffLabel: string;
  updatedAt: string;
}

export interface AdvanceBarberQueueTicketResult {
  ticket: BarberQueueTicket;
  starAwarded: boolean;
  starsAwarded: number;
  newLoyaltyStarsBalance: number;
  alreadyAwarded: boolean;
}
