import type { Business } from './business';
import type { RestaurantReward } from './restaurant';

export type BarberQueueTicketStatus =
  | 'waiting'
  | 'in_chair'
  | 'completed'
  | 'no_show'
  | 'cancelled';

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
  rewards: RestaurantReward[];
}

export interface JoinBarberQueueInput {
  businessSlug: string;
  guestName: string;
  phone?: string | null;
  serviceName?: string;
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
