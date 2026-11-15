import type {
  AdminAuditLogEntry,
  AdminClientCounts,
  AdminClientRecord,
  AdminListBusinessesParams,
} from '../../types/admin';
import type { BusinessStatus } from '../../types/business';

export interface IAdminRepository {
  /** Verifies whether the currently signed-in user is in public.platform_admins. */
  isCurrentUserPlatformAdmin(): Promise<boolean>;

  /** Returns summary status counts and 30-day daily signup series. */
  getClientCounts(): Promise<AdminClientCounts>;

  /** Lists client businesses and owner account metadata with search & status filtering. */
  listBusinesses(
    params?: AdminListBusinessesParams,
  ): Promise<{ items: AdminClientRecord[]; total: number }>;

  /** Approves, rejects, suspends, or reactivates a business and writes an audit log entry. */
  setBusinessStatus(input: {
    businessId: string;
    status: BusinessStatus;
    reason?: string;
  }): Promise<AdminClientRecord>;

  /** Disables or re-enables an owner account (blocking/unblocking login and suspending/activating business). */
  setAccountState(input: {
    businessId: string;
    state: 'active' | 'disabled';
    reason?: string;
  }): Promise<AdminClientRecord>;

  /** Sends a password reset email to the business owner and records an audit log entry. */
  sendPasswordResetEmail(input: {
    businessId: string;
    email: string;
  }): Promise<void>;

  /** Soft-deletes an account with a configurable grace period (default 14 days), disabling login and taking the business offline. */
  requestAccountDeletion(input: {
    businessId: string;
    reason: string;
    graceDays?: number;
  }): Promise<AdminClientRecord>;

  /** Restores an account that is currently in the pending_deletion grace period. */
  restoreAccount(input: {
    businessId: string;
    reason?: string;
  }): Promise<AdminClientRecord>;

  /** Permanently deletes the business data and auth account immediately (requires exact business name confirmation + reason). */
  permanentlyDeleteAccount(input: {
    businessId: string;
    confirmationBusinessName: string;
    reason: string;
  }): Promise<void>;

  /** Returns the append-only platform admin audit log. */
  listAuditLog(params?: {
    limit?: number;
    offset?: number;
  }): Promise<AdminAuditLogEntry[]>;
}
