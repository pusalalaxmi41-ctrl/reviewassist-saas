import type { BusinessCategory } from './business';

export type IndustryWorkspaceType = 'restaurant' | 'barber' | 'gym';

export type GymMemberStatus =
  | 'pending_approval'
  | 'active'
  | 'expired'
  | 'suspended'
  | 'rejected';

export type GymEffectiveMemberStatus = GymMemberStatus | 'expiring_soon';

export type GymOwnerMemberAction = 'approve' | 'renew' | 'reject' | 'suspend';

export interface GymPlan {
  id: string;
  name: string;
  durationDays: number;
  pricePaise: number;
  badge?: string;
}

export interface GymConfig {
  businessId: string;
  isRegistrationOpen: boolean;
  renewalAlertDays: number;
  plans: GymPlan[];
  createdAt?: string;
  updatedAt?: string;
}

export interface GymConfigInput {
  isRegistrationOpen: boolean;
  renewalAlertDays?: number;
  plans?: GymPlan[];
}

export interface GymMember {
  id: string;
  businessId: string;
  memberCode: string;
  fullName: string;
  phone: string;
  planId: string;
  planName: string;
  durationDays: number;
  feePaise: number;
  status: GymMemberStatus;
  effectiveStatus: GymEffectiveMemberStatus;
  daysRemaining: number;
  startDate: string | null;
  endDate: string | null;
  totalCheckIns: number;
  lastCheckInDate: string | null;
  checkedInToday: boolean;
  approvedByLabel?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PublicGymPortalPayload {
  business: {
    id: string;
    slug: string;
    name: string;
    category: BusinessCategory;
    city: string;
    googleReviewUrl: string;
  };
  config: GymConfig;
  activeMembersCount: number;
  checkedInTodayCount: number;
}

export interface SubmitGymRegistrationInput {
  businessSlug: string;
  fullName: string;
  phone: string;
  planId: string;
}

export interface GymDailyCheckInResult {
  memberId: string;
  memberCode: string;
  fullName: string;
  alreadyCheckedInToday: boolean;
  totalCheckIns: number;
  daysRemaining: number;
  checkedInDate: string;
}

export interface GymOwnerDashboardPayload {
  config: GymConfig;
  members: GymMember[];
  checkedInTodayCount: number;
}
