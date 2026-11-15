import { supabase } from '../../lib/supabase';
import type {
  AdminAuditAction,
  AdminAuditLogEntry,
  AdminClientCounts,
  AdminClientRecord,
  AdminListBusinessesParams,
  DailySignupPoint,
} from '../../types/admin';
import type {
  AccountLifecycleState,
  BusinessCategory,
  BusinessStatus,
} from '../../types/business';
import type { IAdminRepository } from './AdminRepository';

interface RpcClientRow {
  business_id: string;
  slug: string;
  business_name: string;
  category: BusinessCategory;
  city: string;
  google_review_url: string;
  google_review_url_is_placeholder: boolean;
  status: BusinessStatus;
  status_changed_at: string;
  status_changed_by: string | null;
  status_reason: string | null;
  account_state: AccountLifecycleState;
  deletion_requested_at: string | null;
  deletion_scheduled_for: string | null;
  deleted_reason: string | null;
  created_at: string;
  updated_at?: string;
  owner_id: string;
  owner_email: string;
  owner_created_at?: string;
  last_sign_in_at: string | null;
  total_count?: number;
}

interface RpcAuditLogRow {
  id: string;
  admin_id: string | null;
  admin_email: string | null;
  action: AdminAuditAction;
  business_id: string | null;
  business_name: string | null;
  owner_id?: string | null;
  owner_email: string | null;
  reason: string | null;
  created_at: string;
}

function mapRpcClientRow(row: RpcClientRow): AdminClientRecord {
  return {
    id: row.business_id,
    slug: row.slug,
    name: row.business_name,
    category: row.category,
    city: row.city,
    googleReviewUrl: row.google_review_url,
    googleReviewUrlIsPlaceholder: row.google_review_url_is_placeholder,
    status: row.status,
    statusChangedAt: row.status_changed_at,
    statusChangedBy: row.status_changed_by,
    statusReason: row.status_reason,
    accountState: row.account_state,
    deletionRequestedAt: row.deletion_requested_at,
    deletionScheduledFor: row.deletion_scheduled_for,
    deletedReason: row.deleted_reason,
    createdAt: row.created_at,
    updatedAt: row.updated_at ?? row.status_changed_at ?? row.created_at,
    ownerId: row.owner_id,
    ownerEmail: row.owner_email,
    ownerCreatedAt: row.owner_created_at ?? row.created_at,
    ownerLastSignInAt: row.last_sign_in_at,
  };
}

/**
 * Supabase RPC & Edge Function implementation of IAdminRepository.
 *
 * Security notes:
 * - Never uses or references the Supabase service_role key in frontend code.
 * - All database reads/mutations go through SECURITY DEFINER RPC functions that
 *   verify public.is_platform_admin() on the database server.
 * - Permanent account deletion invokes the 'admin-delete-account' Edge Function
 *   using the caller's standard user JWT; only that server-side Edge Function
 *   holds SUPABASE_SERVICE_ROLE_KEY.
 */
export class SupabaseAdminRepository implements IAdminRepository {
  async isCurrentUserPlatformAdmin(): Promise<boolean> {
    if (!supabase) return false;

    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session?.user) {
      return false;
    }

    const { data, error } = await supabase.rpc('is_platform_admin');
    if (error) {
      return false;
    }
    return Boolean(data);
  }

  async getClientCounts(): Promise<AdminClientCounts> {
    if (!supabase) {
      throw new Error('Supabase client is not initialized.');
    }

    const { data, error } = await supabase.rpc('admin_get_client_counts');
    if (error) {
      throw new Error(`Failed to load client counts: ${error.message}`);
    }

    const payload = data as {
      total: number;
      pending: number;
      active: number;
      suspended: number;
      rejected: number;
      disabled_accounts: number;
      pending_deletion_accounts: number;
      signups_per_day: DailySignupPoint[];
    };

    return {
      total: Number(payload?.total ?? 0),
      pending: Number(payload?.pending ?? 0),
      active: Number(payload?.active ?? 0),
      suspended: Number(payload?.suspended ?? 0),
      rejected: Number(payload?.rejected ?? 0),
      disabledAccounts: Number(payload?.disabled_accounts ?? 0),
      pendingDeletionAccounts: Number(payload?.pending_deletion_accounts ?? 0),
      signupsPerDay: Array.isArray(payload?.signups_per_day)
        ? payload.signups_per_day.map((pt) => ({
            date: String(pt.date),
            count: Number(pt.count ?? 0),
          }))
        : [],
    };
  }

  async listBusinesses(
    params?: AdminListBusinessesParams,
  ): Promise<{ items: AdminClientRecord[]; total: number }> {
    if (!supabase) {
      throw new Error('Supabase client is not initialized.');
    }

    const searchParam = params?.search?.trim() || null;
    const statusParam =
      params?.status && params.status !== 'all' ? params.status : null;
    const limit = params?.limit ?? 100;
    const offset = params?.offset ?? 0;

    const { data, error } = await supabase.rpc('admin_list_businesses', {
      p_search: searchParam,
      p_status: statusParam,
      p_limit: limit,
      p_offset: offset,
    });

    if (error) {
      throw new Error(`Failed to list businesses: ${error.message}`);
    }

    const rows = (data ?? []) as RpcClientRow[];
    let items = rows.map(mapRpcClientRow);

    if (params?.accountState && params.accountState !== 'all') {
      items = items.filter((item) => item.accountState === params.accountState);
    }

    const total = rows.length > 0 ? Number(rows[0].total_count ?? items.length) : 0;
    return { items, total };
  }

  private async fetchSingleClientRecord(businessId: string): Promise<AdminClientRecord> {
    const { items } = await this.listBusinesses({ limit: 200, offset: 0 });
    const found = items.find((item) => item.id === businessId);
    if (!found) {
      throw new Error('Updated business record could not be reloaded.');
    }
    return found;
  }

  async setBusinessStatus(input: {
    businessId: string;
    status: BusinessStatus;
    reason?: string;
  }): Promise<AdminClientRecord> {
    if (!supabase) {
      throw new Error('Supabase client is not initialized.');
    }

    const { error } = await supabase.rpc('admin_set_business_status', {
      p_business_id: input.businessId,
      p_new_status: input.status,
      p_reason: input.reason?.trim() || null,
    });

    if (error) {
      throw new Error(error.message);
    }

    return this.fetchSingleClientRecord(input.businessId);
  }

  async setAccountState(input: {
    businessId: string;
    state: 'active' | 'disabled';
    reason?: string;
  }): Promise<AdminClientRecord> {
    if (!supabase) {
      throw new Error('Supabase client is not initialized.');
    }

    const { error } = await supabase.rpc('admin_set_account_state', {
      p_business_id: input.businessId,
      p_new_state: input.state,
      p_reason: input.reason?.trim() || null,
    });

    if (error) {
      throw new Error(error.message);
    }

    return this.fetchSingleClientRecord(input.businessId);
  }

  async sendPasswordResetEmail(input: {
    businessId: string;
    email: string;
  }): Promise<void> {
    if (!supabase) {
      throw new Error('Supabase client is not initialized.');
    }

    const redirectTo =
      typeof window !== 'undefined'
        ? `${window.location.origin}/login`
        : undefined;

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      input.email,
      redirectTo ? { redirectTo } : undefined,
    );

    if (resetError) {
      throw new Error(`Password reset email failed: ${resetError.message}`);
    }

    const { error: auditError } = await supabase.rpc(
      'admin_record_password_reset_audit',
      {
        p_business_id: input.businessId,
      },
    );

    if (auditError) {
      throw new Error(`Audit log failed: ${auditError.message}`);
    }
  }

  async requestAccountDeletion(input: {
    businessId: string;
    reason: string;
    graceDays?: number;
  }): Promise<AdminClientRecord> {
    if (!supabase) {
      throw new Error('Supabase client is not initialized.');
    }

    const { error } = await supabase.rpc('admin_request_account_deletion', {
      p_business_id: input.businessId,
      p_reason: input.reason.trim(),
      p_grace_days: input.graceDays ?? 14,
    });

    if (error) {
      throw new Error(error.message);
    }

    return this.fetchSingleClientRecord(input.businessId);
  }

  async restoreAccount(input: {
    businessId: string;
    reason?: string;
  }): Promise<AdminClientRecord> {
    if (!supabase) {
      throw new Error('Supabase client is not initialized.');
    }

    const { error } = await supabase.rpc('admin_restore_account', {
      p_business_id: input.businessId,
      p_reason: input.reason?.trim() || null,
    });

    if (error) {
      throw new Error(error.message);
    }

    return this.fetchSingleClientRecord(input.businessId);
  }

  async permanentlyDeleteAccount(input: {
    businessId: string;
    confirmationBusinessName: string;
    reason: string;
  }): Promise<void> {
    if (!supabase) {
      throw new Error('Supabase client is not initialized.');
    }

    const { data, error } = await supabase.functions.invoke(
      'admin-delete-account',
      {
        body: {
          businessId: input.businessId,
          confirmationBusinessName: input.confirmationBusinessName.trim(),
          reason: input.reason.trim(),
        },
      },
    );

    if (error) {
      throw new Error(error.message || 'Permanent account deletion failed.');
    }

    if (data && typeof data === 'object' && 'error' in data && data.error) {
      throw new Error(String(data.error));
    }
  }

  async listAuditLog(params?: {
    limit?: number;
    offset?: number;
  }): Promise<AdminAuditLogEntry[]> {
    if (!supabase) {
      throw new Error('Supabase client is not initialized.');
    }

    const { data, error } = await supabase.rpc('admin_list_audit_log', {
      p_limit: params?.limit ?? 100,
      p_offset: params?.offset ?? 0,
    });

    if (error) {
      throw new Error(`Failed to load audit log: ${error.message}`);
    }

    const rows = (data ?? []) as RpcAuditLogRow[];
    return rows.map((row) => ({
      id: row.id,
      adminId: row.admin_id,
      adminEmail: row.admin_email,
      action: row.action,
      businessId: row.business_id,
      businessName: row.business_name,
      ownerId: row.owner_id ?? null,
      ownerEmail: row.owner_email,
      reason: row.reason,
      createdAt: row.created_at,
    }));
  }
}
