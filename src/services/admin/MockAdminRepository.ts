import type {
  AdminAuditAction,
  AdminAuditLogEntry,
  AdminClientCounts,
  AdminClientRecord,
  AdminListBusinessesParams,
  DailySignupPoint,
} from '../../types/admin';
import type { BusinessStatus } from '../../types/business';
import { PLACEHOLDER_GOOGLE_REVIEW_URL } from '../storage/MockLocalStorageRepository';
import { writeLocalStatusOverlay } from '../storage/SupabaseBusinessRepository';
import type { IAdminRepository } from './AdminRepository';

const STORAGE_KEYS = {
  CLIENTS: 'reviewassist_admin_mock_clients_v1',
  AUDIT: 'reviewassist_admin_mock_audit_v1',
};

function daysAgoIso(days: number, hoursOffset = 2): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  d.setUTCHours(Math.max(0, d.getUTCHours() - hoursOffset));
  return d.toISOString();
}

function daysFromNowIso(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString();
}

const INITIAL_CLIENTS: AdminClientRecord[] = [
  {
    id: 'e4ceb1c5-8cf7-45ba-9155-be3a0f8ee56c',
    ownerId: 'usr-akshaya-owner-01',
    ownerEmail: 'pusalalaxmi41@gmail.com',
    ownerCreatedAt: daysAgoIso(1),
    ownerLastSignInAt: daysAgoIso(0, 1),
    slug: 'akshaya-pg',
    name: 'akshaya pg',
    category: 'pg',
    city: 'Hyderabad',
    googleReviewUrl: PLACEHOLDER_GOOGLE_REVIEW_URL,
    googleReviewUrlIsPlaceholder: true,
    status: 'active',
    statusChangedAt: daysAgoIso(1),
    statusChangedBy: null,
    statusReason: null,
    accountState: 'active',
    deletionRequestedAt: null,
    deletionScheduledFor: null,
    deletedReason: null,
    createdAt: daysAgoIso(1),
    updatedAt: daysAgoIso(1),
  },
  {
    id: 'biz-pending-deccan-spice',
    ownerId: 'usr-deccan-02',
    ownerEmail: 'rohit.reddy@deccanspice.in',
    ownerCreatedAt: daysAgoIso(0, 4),
    ownerLastSignInAt: daysAgoIso(0, 3),
    slug: 'deccan-spice-kitchen',
    name: 'Deccan Spice Kitchen',
    category: 'restaurant',
    city: 'Hyderabad',
    googleReviewUrl: 'https://g.page/r/deccan-spice-kitchen/review',
    googleReviewUrlIsPlaceholder: false,
    status: 'pending',
    statusChangedAt: daysAgoIso(0, 4),
    statusChangedBy: null,
    statusReason: null,
    accountState: 'active',
    deletionRequestedAt: null,
    deletionScheduledFor: null,
    deletedReason: null,
    createdAt: daysAgoIso(0, 4),
    updatedAt: daysAgoIso(0, 4),
  },
  {
    id: 'biz-pending-roastery',
    ownerId: 'usr-roastery-03',
    ownerEmail: 'ananya@thirdwavebrews.co',
    ownerCreatedAt: daysAgoIso(2),
    ownerLastSignInAt: daysAgoIso(1),
    slug: 'third-wave-koramangala',
    name: 'Third Wave Coffee House',
    category: 'cafe',
    city: 'Bengaluru',
    googleReviewUrl: 'https://g.page/r/third-wave-koramangala/review',
    googleReviewUrlIsPlaceholder: false,
    status: 'pending',
    statusChangedAt: daysAgoIso(2),
    statusChangedBy: null,
    statusReason: null,
    accountState: 'active',
    deletionRequestedAt: null,
    deletionScheduledFor: null,
    deletedReason: null,
    createdAt: daysAgoIso(2),
    updatedAt: daysAgoIso(2),
  },
  {
    id: 'biz-urban-kitchen-1',
    ownerId: 'usr-urban-04',
    ownerEmail: 'karthik@theurbankitchen.in',
    ownerCreatedAt: daysAgoIso(18),
    ownerLastSignInAt: daysAgoIso(0, 5),
    slug: 'the-urban-kitchen',
    name: 'The Urban Kitchen',
    category: 'restaurant',
    city: 'Hyderabad',
    googleReviewUrl: 'https://g.page/r/urban-kitchen-hyd/review',
    googleReviewUrlIsPlaceholder: false,
    status: 'active',
    statusChangedAt: daysAgoIso(17),
    statusChangedBy: 'admin-root-01',
    statusReason: 'Verified Google Business Profile & GST details',
    accountState: 'active',
    deletionRequestedAt: null,
    deletionScheduledFor: null,
    deletedReason: null,
    createdAt: daysAgoIso(18),
    updatedAt: daysAgoIso(17),
  },
  {
    id: 'biz-active-lotus-grand',
    ownerId: 'usr-lotus-05',
    ownerEmail: 'gm@hotel-lotusgrand.com',
    ownerCreatedAt: daysAgoIso(12),
    ownerLastSignInAt: daysAgoIso(2),
    slug: 'hotel-lotus-grand',
    name: 'Hotel Lotus Grand',
    category: 'hotel',
    city: 'Pune',
    googleReviewUrl: 'https://g.page/r/hotel-lotus-grand/review',
    googleReviewUrlIsPlaceholder: false,
    status: 'active',
    statusChangedAt: daysAgoIso(11),
    statusChangedBy: 'admin-root-01',
    statusReason: 'Approved after reception desk verification',
    accountState: 'active',
    deletionRequestedAt: null,
    deletionScheduledFor: null,
    deletedReason: null,
    createdAt: daysAgoIso(12),
    updatedAt: daysAgoIso(11),
  },
  {
    id: 'biz-active-nest-pg',
    ownerId: 'usr-nest-06',
    ownerEmail: 'suresh.kumar@hitech-nest.in',
    ownerCreatedAt: daysAgoIso(9),
    ownerLastSignInAt: daysAgoIso(1),
    slug: 'hitech-nest-coliving',
    name: 'Hitech Nest Co-Living PG',
    category: 'pg',
    city: 'Hyderabad',
    googleReviewUrl: 'https://g.page/r/hitech-nest-pg/review',
    googleReviewUrlIsPlaceholder: false,
    status: 'active',
    statusChangedAt: daysAgoIso(8),
    statusChangedBy: 'admin-root-01',
    statusReason: null,
    accountState: 'active',
    deletionRequestedAt: null,
    deletionScheduledFor: null,
    deletedReason: null,
    createdAt: daysAgoIso(9),
    updatedAt: daysAgoIso(8),
  },
  {
    id: 'biz-suspended-skyline',
    ownerId: 'usr-skyline-07',
    ownerEmail: 'ops@skylinebistro.in',
    ownerCreatedAt: daysAgoIso(15),
    ownerLastSignInAt: daysAgoIso(6),
    slug: 'skyline-bistro',
    name: 'Skyline Rooftop Bistro',
    category: 'restaurant',
    city: 'Mumbai',
    googleReviewUrl: PLACEHOLDER_GOOGLE_REVIEW_URL,
    googleReviewUrlIsPlaceholder: true,
    status: 'suspended',
    statusChangedAt: daysAgoIso(3),
    statusChangedBy: 'admin-root-01',
    statusReason: 'Account disabled pending invoice settlement',
    accountState: 'disabled',
    deletionRequestedAt: null,
    deletionScheduledFor: null,
    deletedReason: null,
    createdAt: daysAgoIso(15),
    updatedAt: daysAgoIso(3),
  },
  {
    id: 'biz-pending-deletion-sunrise',
    ownerId: 'usr-sunrise-08',
    ownerEmail: 'vikram@sunrisestays.in',
    ownerCreatedAt: daysAgoIso(24),
    ownerLastSignInAt: daysAgoIso(10),
    slug: 'sunrise-student-pg',
    name: 'Sunrise Student Stay PG',
    category: 'pg',
    city: 'Chennai',
    googleReviewUrl: PLACEHOLDER_GOOGLE_REVIEW_URL,
    googleReviewUrlIsPlaceholder: true,
    status: 'suspended',
    statusChangedAt: daysAgoIso(4),
    statusChangedBy: 'admin-root-01',
    statusReason: 'Owner requested account closure after property sale',
    accountState: 'pending_deletion',
    deletionRequestedAt: daysAgoIso(4),
    deletionScheduledFor: daysFromNowIso(10),
    deletedReason: 'Owner requested account closure after property sale',
    createdAt: daysAgoIso(24),
    updatedAt: daysAgoIso(4),
  },
  {
    id: 'biz-rejected-fake',
    ownerId: 'usr-rejected-09',
    ownerEmail: 'test-spam-99@mailinator.com',
    ownerCreatedAt: daysAgoIso(7),
    ownerLastSignInAt: daysAgoIso(7),
    slug: 'free-crypto-links',
    name: 'Test Unverified Listing',
    category: 'cafe',
    city: 'Delhi',
    googleReviewUrl: 'https://example.com/unverified',
    googleReviewUrlIsPlaceholder: false,
    status: 'rejected',
    statusChangedAt: daysAgoIso(6),
    statusChangedBy: 'admin-root-01',
    statusReason: 'Not a real hospitality business (restaurant, cafe, hotel, or PG)',
    accountState: 'disabled',
    deletionRequestedAt: null,
    deletionScheduledFor: null,
    deletedReason: null,
    createdAt: daysAgoIso(7),
    updatedAt: daysAgoIso(6),
  },
  {
    id: 'biz-glow-boutique-5',
    ownerId: 'owner-glow-boutique-5',
    ownerEmail: 'glow@boutiquestudio.in',
    ownerCreatedAt: daysAgoIso(3),
    ownerLastSignInAt: daysAgoIso(0),
    slug: 'glow-boutique-rewards',
    name: 'Glow Boutique & Studio',
    category: 'loyalty',
    city: 'Hyderabad',
    googleReviewUrl: 'https://g.page/r/glow-boutique-demo/review',
    googleReviewUrlIsPlaceholder: false,
    status: 'pending',
    statusChangedAt: daysAgoIso(3),
    statusChangedBy: null,
    statusReason: null,
    accountState: 'active',
    deletionRequestedAt: null,
    deletionScheduledFor: null,
    deletedReason: null,
    createdAt: daysAgoIso(3),
    updatedAt: daysAgoIso(3),
  },
];

const INITIAL_AUDIT_LOG: AdminAuditLogEntry[] = [
  {
    id: 'aud-1',
    adminId: 'admin-root-01',
    adminEmail: 'pusalalaxmi41@gmail.com',
    action: 'request_account_deletion',
    businessId: 'biz-pending-deletion-sunrise',
    businessName: 'Sunrise Student Stay PG',
    ownerId: 'usr-sunrise-08',
    ownerEmail: 'vikram@sunrisestays.in',
    reason: 'Owner requested account closure after property sale',
    metadata: { graceDays: 14 },
    createdAt: daysAgoIso(4),
  },
  {
    id: 'aud-2',
    adminId: 'admin-root-01',
    adminEmail: 'pusalalaxmi41@gmail.com',
    action: 'disable_account',
    businessId: 'biz-suspended-skyline',
    businessName: 'Skyline Rooftop Bistro',
    ownerId: 'usr-skyline-07',
    ownerEmail: 'ops@skylinebistro.in',
    reason: 'Account disabled pending invoice settlement',
    metadata: { previousAccountState: 'active', newAccountState: 'disabled' },
    createdAt: daysAgoIso(3),
  },
  {
    id: 'aud-3',
    adminId: 'admin-root-01',
    adminEmail: 'pusalalaxmi41@gmail.com',
    action: 'reject_business',
    businessId: 'biz-rejected-fake',
    businessName: 'Test Unverified Listing',
    ownerId: 'usr-rejected-09',
    ownerEmail: 'test-spam-99@mailinator.com',
    reason: 'Not a real hospitality business (restaurant, cafe, hotel, or PG)',
    metadata: { previousStatus: 'pending', newStatus: 'rejected' },
    createdAt: daysAgoIso(6),
  },
  {
    id: 'aud-4',
    adminId: 'admin-root-01',
    adminEmail: 'pusalalaxmi41@gmail.com',
    action: 'approve_business',
    businessId: 'biz-active-nest-pg',
    businessName: 'Hitech Nest Co-Living PG',
    ownerId: 'usr-nest-06',
    ownerEmail: 'suresh.kumar@hitech-nest.in',
    reason: 'Verified property details',
    metadata: { previousStatus: 'pending', newStatus: 'active' },
    createdAt: daysAgoIso(8),
  },
  {
    id: 'aud-5',
    adminId: 'admin-root-01',
    adminEmail: 'pusalalaxmi41@gmail.com',
    action: 'approve_business',
    businessId: 'biz-urban-kitchen-1',
    businessName: 'The Urban Kitchen',
    ownerId: 'usr-urban-04',
    ownerEmail: 'karthik@theurbankitchen.in',
    reason: 'Verified Google Business Profile & GST details',
    metadata: { previousStatus: 'pending', newStatus: 'active' },
    createdAt: daysAgoIso(17),
  },
];

export class MockAdminRepository implements IAdminRepository {
  private memoryStore = new Map<string, string>();

  private read<T>(key: string, fallback: T): T {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const raw = window.localStorage.getItem(key);
        if (raw) return JSON.parse(raw) as T;
      }
    } catch {
      // fallback to memory
    }
    const mem = this.memoryStore.get(key);
    if (mem) {
      try {
        return JSON.parse(mem) as T;
      } catch {
        return fallback;
      }
    }
    return fallback;
  }

  private write<T>(key: string, value: T): void {
    const str = JSON.stringify(value);
    this.memoryStore.set(key, str);
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(key, str);
      }
    } catch {
      // ignore
    }
  }

  private getClientsInternal(): AdminClientRecord[] {
    const existing = this.read<AdminClientRecord[]>(STORAGE_KEYS.CLIENTS, []);
    if (existing.length === 0) {
      this.write(STORAGE_KEYS.CLIENTS, INITIAL_CLIENTS);
      return INITIAL_CLIENTS;
    }
    return existing;
  }

  private saveClientsInternal(clients: AdminClientRecord[]): void {
    this.write(STORAGE_KEYS.CLIENTS, clients);
  }

  private appendAudit(
    action: AdminAuditAction,
    target: Pick<
      AdminClientRecord,
      'id' | 'name' | 'ownerId' | 'ownerEmail'
    >,
    reason: string | null,
    metadata?: Record<string, unknown>,
  ): void {
    const logs = this.read<AdminAuditLogEntry[]>(
      STORAGE_KEYS.AUDIT,
      INITIAL_AUDIT_LOG,
    );
    const entry: AdminAuditLogEntry = {
      id: `aud-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      adminId: 'admin-root-01',
      adminEmail: 'pusalalaxmi41@gmail.com',
      action,
      businessId: target.id,
      businessName: target.name,
      ownerId: target.ownerId,
      ownerEmail: target.ownerEmail,
      reason,
      metadata,
      createdAt: new Date().toISOString(),
    };
    this.write(STORAGE_KEYS.AUDIT, [entry, ...logs]);
  }

  private syncOverlay(record: AdminClientRecord): void {
    writeLocalStatusOverlay(record.id, {
      status: record.status,
      statusChangedAt: record.statusChangedAt,
      statusReason: record.statusReason,
      accountState: record.accountState,
      deletionRequestedAt: record.deletionRequestedAt,
      deletionScheduledFor: record.deletionScheduledFor,
      deletedReason: record.deletedReason,
    });
  }

  async isCurrentUserPlatformAdmin(): Promise<boolean> {
    return true;
  }

  async getClientCounts(): Promise<AdminClientCounts> {
    const clients = this.getClientsInternal();

    const signupsPerDay: DailySignupPoint[] = [];
    const now = new Date();

    for (let i = 29; i >= 0; i--) {
      const d = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - i),
      );
      const dayStr = d.toISOString().slice(0, 10);
      const realMatches = clients.filter(
        (c) => c.createdAt.slice(0, 10) === dayStr,
      ).length;
      // Deterministic baseline activity so the 30-day chart is informative in preview
      const baseline = ((i * 7 + 3) % 4 === 0 ? 1 : 0) + (i < 5 ? 1 : 0);
      signupsPerDay.push({
        date: dayStr,
        count: Math.max(realMatches, baseline),
      });
    }

    return {
      total: clients.length,
      pending: clients.filter((c) => c.status === 'pending').length,
      active: clients.filter((c) => c.status === 'active').length,
      suspended: clients.filter((c) => c.status === 'suspended').length,
      rejected: clients.filter((c) => c.status === 'rejected').length,
      disabledAccounts: clients.filter((c) => c.accountState === 'disabled').length,
      pendingDeletionAccounts: clients.filter(
        (c) => c.accountState === 'pending_deletion',
      ).length,
      signupsPerDay,
    };
  }

  async listBusinesses(
    params: AdminListBusinessesParams = {},
  ): Promise<{ items: AdminClientRecord[]; total: number }> {
    const clients = this.getClientsInternal();
    const q = params.search?.trim().toLowerCase() ?? '';
    const statusFilter = params.status ?? 'all';

    const filtered = clients
      .filter((c) => {
        if (statusFilter !== 'all' && c.status !== statusFilter) return false;
        if (!q) return true;
        return (
          c.name.toLowerCase().includes(q) ||
          c.slug.toLowerCase().includes(q) ||
          c.city.toLowerCase().includes(q) ||
          c.ownerEmail.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        if (a.status === 'pending' && b.status !== 'pending') return -1;
        if (a.status !== 'pending' && b.status === 'pending') return 1;
        return b.createdAt.localeCompare(a.createdAt);
      });

    const offset = params.offset ?? 0;
    const limit = params.limit ?? 50;
    return {
      items: filtered.slice(offset, offset + limit),
      total: filtered.length,
    };
  }

  async setBusinessStatus(input: {
    businessId: string;
    status: BusinessStatus;
    reason?: string;
  }): Promise<AdminClientRecord> {
    const reason = input.reason?.trim() || null;
    if (
      (input.status === 'rejected' || input.status === 'suspended') &&
      (!reason || reason.length < 3)
    ) {
      throw new Error(
        'Please provide a reason (at least 3 characters) when rejecting or suspending a business.',
      );
    }

    const clients = this.getClientsInternal();
    const idx = clients.findIndex((c) => c.id === input.businessId);
    if (idx === -1) throw new Error('Business not found.');

    const prev = clients[idx];
    const now = new Date().toISOString();
    const updated: AdminClientRecord = {
      ...prev,
      status: input.status,
      statusChangedAt: now,
      statusChangedBy: 'admin-root-01',
      statusReason: reason,
      accountState: input.status === 'active' ? 'active' : prev.accountState,
      updatedAt: now,
    };

    clients[idx] = updated;
    this.saveClientsInternal(clients);
    this.syncOverlay(updated);

    const action: AdminAuditAction =
      input.status === 'active' &&
      (prev.status === 'suspended' || prev.status === 'rejected')
        ? 'reactivate_business'
        : input.status === 'active'
          ? 'approve_business'
          : input.status === 'rejected'
            ? 'reject_business'
            : 'suspend_business';

    this.appendAudit(action, updated, reason, {
      previousStatus: prev.status,
      newStatus: input.status,
    });

    return updated;
  }

  async setAccountState(input: {
    businessId: string;
    state: 'active' | 'disabled';
    reason?: string;
  }): Promise<AdminClientRecord> {
    const reason = input.reason?.trim() || null;
    if (input.state === 'disabled' && (!reason || reason.length < 3)) {
      throw new Error('Please provide a reason (at least 3 characters) to disable an account.');
    }

    const clients = this.getClientsInternal();
    const idx = clients.findIndex((c) => c.id === input.businessId);
    if (idx === -1) throw new Error('Account not found.');

    const prev = clients[idx];
    const now = new Date().toISOString();

    const updated: AdminClientRecord =
      input.state === 'disabled'
        ? {
            ...prev,
            accountState: 'disabled',
            status: 'suspended',
            statusChangedAt: now,
            statusChangedBy: 'admin-root-01',
            statusReason: reason,
            updatedAt: now,
          }
        : {
            ...prev,
            accountState: 'active',
            status: 'active',
            statusChangedAt: now,
            statusChangedBy: 'admin-root-01',
            statusReason: reason ?? 'Account re-enabled by platform admin',
            deletionRequestedAt: null,
            deletionScheduledFor: null,
            deletedReason: null,
            updatedAt: now,
          };

    clients[idx] = updated;
    this.saveClientsInternal(clients);
    this.syncOverlay(updated);

    this.appendAudit(
      input.state === 'disabled' ? 'disable_account' : 'enable_account',
      updated,
      reason,
      { previousAccountState: prev.accountState, newAccountState: input.state },
    );

    return updated;
  }

  async sendPasswordResetEmail(input: {
    businessId: string;
    email: string;
  }): Promise<void> {
    const clients = this.getClientsInternal();
    const target = clients.find((c) => c.id === input.businessId);
    if (!target) throw new Error('Account not found.');

    this.appendAudit(
      'request_password_reset',
      target,
      `Password reset link sent to ${input.email}`,
    );
  }

  async requestAccountDeletion(input: {
    businessId: string;
    reason: string;
    graceDays?: number;
  }): Promise<AdminClientRecord> {
    const reason = input.reason.trim();
    if (reason.length < 3) {
      throw new Error('Please enter a deletion reason of at least 3 characters.');
    }
    const graceDays = input.graceDays ?? 14;

    const clients = this.getClientsInternal();
    const idx = clients.findIndex((c) => c.id === input.businessId);
    if (idx === -1) throw new Error('Account not found.');

    const prev = clients[idx];
    const now = new Date().toISOString();
    const scheduledFor = daysFromNowIso(graceDays);

    const updated: AdminClientRecord = {
      ...prev,
      accountState: 'pending_deletion',
      status: 'suspended',
      statusChangedAt: now,
      statusChangedBy: 'admin-root-01',
      statusReason: reason,
      deletionRequestedAt: now,
      deletionScheduledFor: scheduledFor,
      deletedReason: reason,
      updatedAt: now,
    };

    clients[idx] = updated;
    this.saveClientsInternal(clients);
    this.syncOverlay(updated);

    this.appendAudit('request_account_deletion', updated, reason, {
      graceDays,
      deletionScheduledFor: scheduledFor,
    });

    return updated;
  }

  async restoreAccount(input: {
    businessId: string;
    reason?: string;
  }): Promise<AdminClientRecord> {
    const clients = this.getClientsInternal();
    const idx = clients.findIndex((c) => c.id === input.businessId);
    if (idx === -1) throw new Error('Account not found.');

    const prev = clients[idx];
    const now = new Date().toISOString();
    const reason = input.reason?.trim() || 'Restored during grace period';

    const updated: AdminClientRecord = {
      ...prev,
      accountState: 'active',
      status: 'active',
      statusChangedAt: now,
      statusChangedBy: 'admin-root-01',
      statusReason: reason,
      deletionRequestedAt: null,
      deletionScheduledFor: null,
      deletedReason: null,
      updatedAt: now,
    };

    clients[idx] = updated;
    this.saveClientsInternal(clients);
    this.syncOverlay(updated);

    this.appendAudit('restore_account', updated, reason, {
      previousAccountState: prev.accountState,
    });

    return updated;
  }

  async permanentlyDeleteAccount(input: {
    businessId: string;
    confirmationBusinessName: string;
    reason: string;
  }): Promise<void> {
    const reason = input.reason.trim();
    if (reason.length < 3) {
      throw new Error('Please enter a deletion reason of at least 3 characters.');
    }

    const clients = this.getClientsInternal();
    const target = clients.find((c) => c.id === input.businessId);
    if (!target) throw new Error('Account not found.');

    if (input.confirmationBusinessName.trim() !== target.name) {
      throw new Error(
        `Confirmation business name must exactly match "${target.name}".`,
      );
    }

    const remaining = clients.filter((c) => c.id !== input.businessId);
    this.saveClientsInternal(remaining);

    // Audit log row persists after deletion with plain-text businessName and ownerEmail
    this.appendAudit('permanent_delete_account', target, reason, {
      slug: target.slug,
      category: target.category,
      city: target.city,
    });
  }

  async listAuditLog(params?: {
    limit?: number;
    offset?: number;
  }): Promise<AdminAuditLogEntry[]> {
    const logs = this.read<AdminAuditLogEntry[]>(
      STORAGE_KEYS.AUDIT,
      INITIAL_AUDIT_LOG,
    );
    const offset = params?.offset ?? 0;
    const limit = params?.limit ?? 100;
    return logs.slice(offset, offset + limit);
  }

  resetMockData(): void {
    this.write(STORAGE_KEYS.CLIENTS, INITIAL_CLIENTS);
    this.write(STORAGE_KEYS.AUDIT, INITIAL_AUDIT_LOG);
    for (const item of INITIAL_CLIENTS) {
      this.syncOverlay(item);
    }
  }
}

export const mockAdminRepository = new MockAdminRepository();
