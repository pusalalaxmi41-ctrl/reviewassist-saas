import type { Business } from './business';

export type LoyaltyVerificationMode =
  | 'cooldown_only'
  | 'counter_pin'
  | 'cashier_approval';

export type LoyaltyEventType =
  | 'visit_star'
  | 'google_review_bonus'
  | 'manual_bonus'
  | 'reward_redeemed';

export type LoyaltyEventStatus = 'pending_approval' | 'approved' | 'rejected';

export type LoyaltySourceChannel = 'qr_nfc' | 'ai_review' | 'counter_desk';

export interface LoyaltyProgramConfig {
  businessId: string;
  starsRequired: number;
  rewardTitle: string;
  rewardDescription?: string | null;
  verificationMode: LoyaltyVerificationMode;
  counterSecretPin?: string;
  scanCooldownHours: number;
  googleReviewBonusEnabled: boolean;
  googleReviewBonusStars: number;
  brandAccentHex: string;
  createdAt?: string;
  updatedAt: string;
}

export interface LoyaltyProgramConfigInput {
  starsRequired: number;
  rewardTitle: string;
  rewardDescription?: string | null;
  verificationMode: LoyaltyVerificationMode;
  counterSecretPin?: string;
  scanCooldownHours: number;
  googleReviewBonusEnabled: boolean;
  googleReviewBonusStars: number;
  brandAccentHex?: string;
}

export interface LoyaltyMemberCard {
  id: string;
  businessId: string;
  memberCode: string;
  customerName: string;
  phone: string;
  currentStars: number;
  lifetimeStars: number;
  rewardsUnlocked: number;
  rewardsRedeemed: number;
  googleReviewBonusClaimed: boolean;
  pendingRedemptionCode: string | null;
  lastStarEarnedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LoyaltyStarEvent {
  id: string;
  businessId: string;
  cardId: string;
  customerName?: string;
  memberCode?: string;
  phone?: string;
  eventType: LoyaltyEventType;
  starsDelta: number;
  status: LoyaltyEventStatus;
  sourceChannel: LoyaltySourceChannel;
  note?: string | null;
  createdAt: string;
}

export interface PublicLoyaltyHubPayload {
  business: Pick<
    Business,
    | 'id'
    | 'name'
    | 'slug'
    | 'city'
    | 'category'
    | 'googleReviewUrl'
    | 'loyaltyEnabled'
  >;
  config: Omit<LoyaltyProgramConfig, 'counterSecretPin'>;
  card: LoyaltyMemberCard | null;
  recentEvents: LoyaltyStarEvent[];
}

export interface ClaimLoyaltyStarResponse {
  pendingApproval: boolean;
  justUnlockedReward: boolean;
  starsRequired: number;
  card: LoyaltyMemberCard;
  eventId?: string;
}

export interface LoyaltyOwnerDashboardPayload {
  config: LoyaltyProgramConfig;
  kpis: {
    totalMembers: number;
    starsIssuedThisMonth: number;
    aiReviewsGenerated: number;
    rewardsUnlocked: number;
    rewardsRedeemed: number;
  };
  memberDirectory: LoyaltyMemberCard[];
  pendingApprovals: LoyaltyStarEvent[];
  recentActivityFeed: LoyaltyStarEvent[];
}
