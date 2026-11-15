import type {
  AccountLifecycleState,
  BusinessCategory,
  BusinessStatus,
} from './business';

export interface DailySignupPoint {
  date: string;
  count: number;
}

export interface AdminClientCounts {
  total: number;
  pending: number;
  active: number;
  suspended: number;
  rejected: number;
  disabledAccounts: number;
  pendingDeletionAccounts: number;
  signupsPerDay: DailySignupPoint[];
}

export interface AdminClientRecord {
  id: string;
  ownerId: string;
  ownerEmail: string;
  ownerCreatedAt: string;
  ownerLastSignInAt: string | null;
  slug: string;
  name: string;
  category: BusinessCategory;
  city: string;
  googleReviewUrl: string;
  googleReviewUrlIsPlaceholder: boolean;
  status: BusinessStatus;
  statusChangedAt: string;
  statusChangedBy: string | null;
  statusReason: string | null;
  accountState: AccountLifecycleState;
  deletionRequestedAt: string | null;
  deletionScheduledFor: string | null;
  deletedReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export type AdminAuditAction =
  | 'approve_business'
  | 'reject_business'
  | 'suspend_business'
  | 'reactivate_business'
  | 'disable_account'
  | 'enable_account'
  | 'request_password_reset'
  | 'request_account_deletion'
  | 'restore_account'
  | 'permanent_delete_account'
  | 'scheduled_purge_account';

export interface AdminAuditLogEntry {
  id: string;
  adminId: string | null;
  adminEmail: string | null;
  action: AdminAuditAction;
  businessId: string | null;
  businessName: string | null;
  ownerId: string | null;
  ownerEmail: string | null;
  reason: string | null;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface AdminListBusinessesParams {
  search?: string;
  status?: 'all' | BusinessStatus;
  accountState?: 'all' | AccountLifecycleState;
  limit?: number;
  offset?: number;
}
