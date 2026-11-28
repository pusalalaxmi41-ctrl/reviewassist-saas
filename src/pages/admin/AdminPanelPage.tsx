import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Activity,
  AlertCircle,
  Building2,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Coffee,
  Dumbbell,
  ExternalLink,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Menu,
  Plus,
  RefreshCw,
  RotateCcw,
  Scissors,
  Search,
  Settings,
  Shield,
  ShieldAlert,
  ShieldOff,
  Star,
  Stethoscope,
  Trash2,
  Users,
  UtensilsCrossed,
  X,
  XCircle,
} from 'lucide-react';
import { useAuth } from '../../context/useAuth';
import { isSupabaseConfigured } from '../../lib/supabase';
import {
  getAdminRepository,
  mockAdminRepository,
} from '../../services/admin';
import {
  businessRepository,
  PLACEHOLDER_GOOGLE_REVIEW_URL,
} from '../../services/storage';
import type {
  AdminAuditLogEntry,
  AdminClientCounts,
  AdminClientRecord,
} from '../../types/admin';
import type {
  AccountLifecycleState,
  BusinessCategory,
  BusinessStatus,
} from '../../types/business';
import {
  AccountStateBadge,
  BusinessStatusBadge,
  PermanentDeleteModal,
  ReasonActionModal,
  SignupsTrendChart,
  TableLoadingSkeleton,
} from './AdminComponents';

import { categoryLabels as CATEGORY_LABELS } from '../../config/reviewExperience';
import {
  getIndustryBadgeMeta,
  getIndustryWorkspaceType,
} from '../../utils/gymValidation';

function formatShortDate(iso: string | null | undefined): string {
  if (!iso) return 'Never';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return 'Never';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function getDaysRemaining(scheduledIso: string | null): number | null {
  if (!scheduledIso) return null;
  const target = new Date(scheduledIso).getTime();
  if (Number.isNaN(target)) return null;
  const diffMs = target - Date.now();
  return Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
}

type AdminNavSection =
  | 'dashboard'
  | 'restaurants'
  | 'cafes'
  | 'barbers'
  | 'gyms'
  | 'clinics'
  | 'catering'
  | 'loyalty'
  | 'clients'
  | 'accounts'
  | 'activity'
  | 'settings';

type ClientFilterTab = 'all' | BusinessStatus;
type AccountFilterTab = 'all' | AccountLifecycleState;

interface ToastMessage {
  id: string;
  tone: 'success' | 'error';
  text: string;
}

interface PendingReasonAction {
  type:
    | 'reject_business'
    | 'suspend_business'
    | 'disable_account'
    | 'soft_delete_account';
  record: AdminClientRecord;
}

export default function AdminPanelPage() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();

  const [repoMode, setRepoMode] = useState<'mock' | 'supabase'>(() => {
    const envSource = import.meta.env.VITE_ADMIN_DATA_SOURCE;
    if (envSource === 'mock') return 'mock';
    if (envSource === 'supabase') return 'supabase';
    return isSupabaseConfigured ? 'supabase' : 'mock';
  });
  const repo = useMemo(() => getAdminRepository(repoMode), [repoMode]);

  const [activeNav, setActiveNav] = useState<AdminNavSection>('dashboard');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Access Guard state
  const [checkingAdmin, setCheckingAdmin] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [simulateNonAdmin404, setSimulateNonAdmin404] = useState(false);

  // Data state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [counts, setCounts] = useState<AdminClientCounts | null>(null);
  const [clients, setClients] = useState<AdminClientRecord[]>([]);
  const [auditLogs, setAuditLogs] = useState<AdminAuditLogEntry[]>([]);

  // Clients filters
  const [clientSearch, setClientSearch] = useState('');
  const [clientStatusTab, setClientStatusTab] =
    useState<ClientFilterTab>('all');
  const [clientIndustryFilter, setClientIndustryFilter] = useState<
    'all' | 'restaurant' | 'cafe' | 'barber' | 'gym' | 'clinic' | 'catering' | 'loyalty'
  >('all');

  // Create-business modal state
  const [createBizModalOpen, setCreateBizModalOpen] = useState(false);
  const [newBizName, setNewBizName] = useState('');
  const [newBizCategory, setNewBizCategory] =
    useState<BusinessCategory>('clinic');
  const [newBizLoyaltyEnabled, setNewBizLoyaltyEnabled] = useState(false);
  const [newBizCity, setNewBizCity] = useState('');
  const [newBizSlug, setNewBizSlug] = useState('');
  const [newBizEmail, setNewBizEmail] = useState('');
  const [creatingBiz, setCreatingBiz] = useState(false);

  // Accounts filters
  const [accountSearch, setAccountSearch] = useState('');
  const [accountStateTab, setAccountStateTab] =
    useState<AccountFilterTab>('all');

  // Side drawer selection
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [drawerContext, setDrawerContext] = useState<'clients' | 'accounts'>(
    'clients',
  );

  // Modals & action busy state
  const [actionBusy, setActionBusy] = useState(false);
  const [reasonModalAction, setReasonModalAction] =
    useState<PendingReasonAction | null>(null);
  const [permanentDeleteTarget, setPermanentDeleteTarget] =
    useState<AdminClientRecord | null>(null);
  const [confirmReactivateTarget, setConfirmReactivateTarget] =
    useState<AdminClientRecord | null>(null);

  // Toast notifications
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const pushToast = useCallback((tone: 'success' | 'error', text: string) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setToasts((prev) => [...prev, { id, tone, text }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  }, []);

  const loadAllAdminData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [countsData, listData, auditData] = await Promise.all([
        repo.getClientCounts(),
        repo.listBusinesses({ limit: 200, offset: 0 }),
        repo.listAuditLog({ limit: 100, offset: 0 }),
      ]);
      setCounts(countsData);
      setClients(listData.items);
      setAuditLogs(auditData);
    } catch (err) {
      setError(
        (err as Error).message || 'Failed to load platform admin data.',
      );
    } finally {
      setLoading(false);
    }
  }, [repo]);

  useEffect(() => {
    let cancelled = false;
    async function verifyAndLoad() {
      setCheckingAdmin(true);
      try {
        const allowed = await repo.isCurrentUserPlatformAdmin();
        if (cancelled) return;
        setIsAdmin(allowed);
        if (allowed) {
          await loadAllAdminData();
        }
      } catch {
        if (!cancelled) setIsAdmin(false);
      } finally {
        if (!cancelled) setCheckingAdmin(false);
      }
    }
    void verifyAndLoad();
    return () => {
      cancelled = true;
    };
  }, [repo, loadAllAdminData, user?.id]);

  const selectedRecord = useMemo(
    () => clients.find((c) => c.id === selectedClientId) ?? null,
    [clients, selectedClientId],
  );

  // Separate industry slices so Admin approves Restaurants, Cafes, Barbers, and Gyms cleanly
  const restaurantClients = useMemo(
    () =>
      clients.filter(
        (c) => getIndustryWorkspaceType(c.category) === 'restaurant',
      ),
    [clients],
  );
  const cafeClients = useMemo(
    () =>
      clients.filter((c) => getIndustryWorkspaceType(c.category) === 'cafe'),
    [clients],
  );
  const barberClients = useMemo(
    () =>
      clients.filter((c) => getIndustryWorkspaceType(c.category) === 'barber'),
    [clients],
  );
  const gymClients = useMemo(
    () => clients.filter((c) => getIndustryWorkspaceType(c.category) === 'gym'),
    [clients],
  );
  const loyaltyClients = useMemo(
    () =>
      clients.filter((c) => getIndustryWorkspaceType(c.category) === 'loyalty'),
    [clients],
  );
  const clinicClients = useMemo(
    () =>
      clients.filter((c) => getIndustryWorkspaceType(c.category) === 'clinic'),
    [clients],
  );
  const cateringClients = useMemo(
    () =>
      clients.filter((c) => getIndustryWorkspaceType(c.category) === 'catering'),
    [clients],
  );

  const pendingRestaurantsCount = useMemo(
    () => restaurantClients.filter((c) => c.status === 'pending').length,
    [restaurantClients],
  );
  const pendingCafesCount = useMemo(
    () => cafeClients.filter((c) => c.status === 'pending').length,
    [cafeClients],
  );
  const pendingBarbersCount = useMemo(
    () => barberClients.filter((c) => c.status === 'pending').length,
    [barberClients],
  );
  const pendingGymsCount = useMemo(
    () => gymClients.filter((c) => c.status === 'pending').length,
    [gymClients],
  );
  const pendingLoyaltyCount = useMemo(
    () => loyaltyClients.filter((c) => c.status === 'pending').length,
    [loyaltyClients],
  );
  const pendingClinicsCount = useMemo(
    () => clinicClients.filter((c) => c.status === 'pending').length,
    [clinicClients],
  );
  const pendingCateringCount = useMemo(
    () => cateringClients.filter((c) => c.status === 'pending').length,
    [cateringClients],
  );

  // Scoped list for the active directory tab ('restaurants' | 'cafes' | 'barbers' | 'gyms' | 'clinics' | 'loyalty' | 'clients')
  const scopedClientsForDirectory = useMemo(() => {
    if (activeNav === 'restaurants') return restaurantClients;
    if (activeNav === 'cafes') return cafeClients;
    if (activeNav === 'barbers') return barberClients;
    if (activeNav === 'gyms') return gymClients;
    if (activeNav === 'clinics') return clinicClients;
    if (activeNav === 'catering') return cateringClients;
    if (activeNav === 'loyalty') return loyaltyClients;
    if (clientIndustryFilter === 'restaurant') return restaurantClients;
    if (clientIndustryFilter === 'cafe') return cafeClients;
    if (clientIndustryFilter === 'barber') return barberClients;
    if (clientIndustryFilter === 'gym') return gymClients;
    if (clientIndustryFilter === 'clinic') return clinicClients;
    if (clientIndustryFilter === 'catering') return cateringClients;
    if (clientIndustryFilter === 'loyalty') return loyaltyClients;
    return clients;
  }, [
    activeNav,
    clientIndustryFilter,
    clients,
    restaurantClients,
    cafeClients,
    barberClients,
    gymClients,
    clinicClients,
    cateringClients,
    loyaltyClients,
  ]);

  // Filtered Clients for the active directory view
  const filteredClients = useMemo(() => {
    const q = clientSearch.trim().toLowerCase();
    return scopedClientsForDirectory.filter((item) => {
      if (clientStatusTab !== 'all' && item.status !== clientStatusTab) {
        return false;
      }
      if (!q) return true;
      return (
        item.name.toLowerCase().includes(q) ||
        item.ownerEmail.toLowerCase().includes(q) ||
        item.city.toLowerCase().includes(q) ||
        item.slug.toLowerCase().includes(q)
      );
    });
  }, [scopedClientsForDirectory, clientSearch, clientStatusTab]);

  // Filtered Accounts for the Accounts page
  const filteredAccounts = useMemo(() => {
    const q = accountSearch.trim().toLowerCase();
    return clients.filter((item) => {
      if (accountStateTab !== 'all' && item.accountState !== accountStateTab) {
        return false;
      }
      if (!q) return true;
      return (
        item.ownerEmail.toLowerCase().includes(q) ||
        item.name.toLowerCase().includes(q) ||
        item.city.toLowerCase().includes(q)
      );
    });
  }, [clients, accountSearch, accountStateTab]);

  // Newest pending businesses for Dashboard "Needs your attention"
  const pendingAttentionList = useMemo(
    () =>
      clients
        .filter((c) => c.status === 'pending')
        .sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        ),
    [clients],
  );

  async function handleApproveBusiness(record: AdminClientRecord) {
    setActionBusy(true);
    try {
      await repo.setBusinessStatus({
        businessId: record.id,
        status: 'active',
        reason: 'Approved by platform admin',
      });
      pushToast(
        'success',
        `Approved "${record.name}". Their QR & review page is now live.`,
      );
      await loadAllAdminData();
    } catch (err) {
      pushToast('error', (err as Error).message || 'Approval failed.');
    } finally {
      setActionBusy(false);
    }
  }

  async function handleReactivateBusiness(record: AdminClientRecord) {
    setActionBusy(true);
    try {
      await repo.setBusinessStatus({
        businessId: record.id,
        status: 'active',
        reason: 'Reactivated by platform admin',
      });
      setConfirmReactivateTarget(null);
      pushToast('success', `Reactivated "${record.name}".`);
      await loadAllAdminData();
    } catch (err) {
      pushToast('error', (err as Error).message || 'Reactivation failed.');
    } finally {
      setActionBusy(false);
    }
  }

  async function handleEnableAccount(record: AdminClientRecord) {
    setActionBusy(true);
    try {
      await repo.setAccountState({
        businessId: record.id,
        state: 'active',
        reason: 'Account re-enabled by platform admin',
      });
      pushToast(
        'success',
        `Re-enabled login and activated "${record.name}".`,
      );
      await loadAllAdminData();
    } catch (err) {
      pushToast('error', (err as Error).message || 'Failed to enable account.');
    } finally {
      setActionBusy(false);
    }
  }

  async function handleRestoreAccount(record: AdminClientRecord) {
    setActionBusy(true);
    try {
      await repo.restoreAccount({
        businessId: record.id,
        reason: 'Restored during deletion grace period by platform admin',
      });
      pushToast(
        'success',
        `Restored "${record.name}" (${record.ownerEmail}) to active status.`,
      );
      await loadAllAdminData();
    } catch (err) {
      pushToast('error', (err as Error).message || 'Failed to restore account.');
    } finally {
      setActionBusy(false);
    }
  }

  async function handleSendPasswordReset(record: AdminClientRecord) {
    setActionBusy(true);
    try {
      await repo.sendPasswordResetEmail({
        businessId: record.id,
        email: record.ownerEmail,
      });
      pushToast(
        'success',
        `Password reset email dispatched to ${record.ownerEmail}.`,
      );
      await loadAllAdminData();
    } catch (err) {
      pushToast(
        'error',
        (err as Error).message || 'Failed to send password reset email.',
      );
    } finally {
      setActionBusy(false);
    }
  }

  async function handleReasonModalConfirm(reason: string, graceDays?: number) {
    if (!reasonModalAction) return;
    const { type, record } = reasonModalAction;
    setActionBusy(true);
    try {
      if (type === 'reject_business') {
        await repo.setBusinessStatus({
          businessId: record.id,
          status: 'rejected',
          reason,
        });
        pushToast('success', `Rejected "${record.name}".`);
      } else if (type === 'suspend_business') {
        await repo.setBusinessStatus({
          businessId: record.id,
          status: 'suspended',
          reason,
        });
        pushToast(
          'success',
          `Suspended "${record.name}". Public review page taken offline.`,
        );
      } else if (type === 'disable_account') {
        await repo.setAccountState({
          businessId: record.id,
          state: 'disabled',
          reason,
        });
        pushToast(
          'success',
          `Disabled account ${record.ownerEmail} and suspended "${record.name}".`,
        );
      } else if (type === 'soft_delete_account') {
        await repo.requestAccountDeletion({
          businessId: record.id,
          reason,
          graceDays: graceDays ?? 14,
        });
        pushToast(
          'success',
          `Scheduled "${record.name}" for deletion in ${graceDays ?? 14} days.`,
        );
      }
      setReasonModalAction(null);
      await loadAllAdminData();
    } catch (err) {
      pushToast('error', (err as Error).message || 'Action failed.');
    } finally {
      setActionBusy(false);
    }
  }

  async function handlePermanentDeleteConfirm(
    typedBusinessName: string,
    reason: string,
  ) {
    if (!permanentDeleteTarget) return;
    const target = permanentDeleteTarget;
    setActionBusy(true);
    try {
      await repo.permanentlyDeleteAccount({
        businessId: target.id,
        confirmationBusinessName: typedBusinessName,
        reason,
      });
      setPermanentDeleteTarget(null);
      if (selectedClientId === target.id) {
        setSelectedClientId(null);
      }
      pushToast(
        'success',
        `Permanently deleted "${target.name}" and auth user ${target.ownerEmail}. Audit log entry preserved.`,
      );
      await loadAllAdminData();
    } catch (err) {
      pushToast(
        'error',
        (err as Error).message || 'Permanent deletion failed.',
      );
    } finally {
      setActionBusy(false);
    }
  }

  async function handleToggleClientLoyalty(record: AdminClientRecord) {
    const currentEnabled = Boolean(
      record.loyaltyEnabled ?? record.category === 'loyalty',
    );
    const nextEnabled = !currentEnabled;
    setActionBusy(true);
    try {
      const updated = await repo.setBusinessLoyaltyEnabled({
        businessId: record.id,
        enabled: nextEnabled,
      });
      setClients((prev) =>
        prev.map((c) => (c.id === record.id ? updated : c)),
      );
      pushToast(
        'success',
        nextEnabled
          ? `Loyalty System turned ON for "${record.name}" (+1 Star & Digital Wallet enabled).`
          : `Loyalty System turned OFF for "${record.name}" (Pure AI Google Review mode).`,
      );
    } catch (err) {
      pushToast(
        'error',
        (err as Error).message || 'Failed to update Loyalty System toggle.',
      );
    } finally {
      setActionBusy(false);
    }
  }

  async function handleCreateAdminBusiness(e: FormEvent) {
    e.preventDefault();
    const cleanName = newBizName.trim();
    const cleanCity = newBizCity.trim();
    const cleanSlug = (
      newBizSlug.trim() ||
      cleanName
        .toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .replace(/[\s_-]+/g, '-')
        .replace(/^-+|-+$/g, '')
    ).slice(0, 80);
    if (cleanName.length < 2 || cleanCity.length < 2 || cleanSlug.length < 3) {
      pushToast(
        'error',
        'Please enter a valid business name, city, and URL slug.',
      );
      return;
    }

    setCreatingBiz(true);
    try {
      const created = await businessRepository.createBusiness({
        name: cleanName,
        category: newBizCategory,
        city: cleanCity,
        slug: cleanSlug,
        googleReviewUrl: PLACEHOLDER_GOOGLE_REVIEW_URL,
        googleReviewUrlIsPlaceholder: true,
        loyaltyEnabled: newBizLoyaltyEnabled,
      });
      const nowIso = new Date().toISOString();
      mockAdminRepository.registerMockClient({
        id: created.id,
        ownerId: created.ownerId ?? user?.id ?? 'admin-created-owner',
        ownerEmail: newBizEmail.trim() || user?.email || 'owner@reviewassist.app',
        ownerCreatedAt: nowIso,
        ownerLastSignInAt: nowIso,
        slug: created.slug,
        name: created.name,
        category: created.category,
        city: created.city,
        googleReviewUrl: created.googleReviewUrl,
        googleReviewUrlIsPlaceholder: true,
        loyaltyEnabled: newBizLoyaltyEnabled,
        status: 'active',
        statusChangedAt: nowIso,
        statusChangedBy: user?.id ?? 'admin-root-01',
        statusReason: 'Created & activated by Platform Admin',
        accountState: 'active',
        deletionRequestedAt: null,
        deletionScheduledFor: null,
        deletedReason: null,
        createdAt: nowIso,
        updatedAt: nowIso,
      });
      setCreateBizModalOpen(false);
      setNewBizName('');
      setNewBizCity('');
      setNewBizSlug('');
      setNewBizEmail('');
      setNewBizLoyaltyEnabled(newBizCategory === 'loyalty');
      await loadAllAdminData();
      pushToast(
        'success',
        `Created & activated "${created.name}" (${getIndustryBadgeMeta(created.category).moduleName} · Loyalty ${newBizLoyaltyEnabled ? 'ON' : 'OFF'}).`,
      );
    } catch (err) {
      pushToast(
        'error',
        (err as Error).message || 'Failed to create business.',
      );
    } finally {
      setCreatingBiz(false);
    }
  }

  async function handleSignOut() {
    await signOut();
    navigate('/login');
  }

  // 1. Checking Admin Guard Skeleton
  if (checkingAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f8fafc] text-slate-600">
        <div className="flex items-center gap-2.5 text-xs font-medium">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-indigo-600 border-r-transparent" />
          Verifying platform admin privileges...
        </div>
      </div>
    );
  }

  // 2. Non-Admin 404 / Restricted View (everyone not in platform_admins gets 404)
  if (!isAdmin || simulateNonAdmin404) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#f8fafc] px-4 text-center">
        <div className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-8 shadow-2xs space-y-4">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
            <ShieldAlert className="h-5 w-5" />
          </div>
          <div className="space-y-1">
            <p className="text-xs font-mono uppercase tracking-wider text-slate-400">
              404 · Not Found
            </p>
            <h1 className="text-lg font-semibold text-slate-900">
              Page not found
            </h1>
            <p className="text-xs text-slate-500 leading-relaxed">
              The page you are looking for doesn&apos;t exist or you don&apos;t have permission to view it.
            </p>
            {user?.email && !simulateNonAdmin404 && (
              <p className="pt-1 text-[11px] font-medium text-slate-500">
                Currently signed in as{' '}
                <span className="font-mono font-semibold text-slate-800">
                  {user.email}
                </span>
              </p>
            )}
          </div>
          <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:justify-center">
            <Link
              to="/dashboard"
              className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              Return to Business Dashboard
            </Link>
            {!simulateNonAdmin404 && (
              <button
                type="button"
                onClick={() => void handleSignOut()}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-medium text-white hover:bg-slate-800 cursor-pointer"
              >
                <LogOut className="h-3.5 w-3.5" aria-hidden />
                Switch Account
              </button>
            )}
            {simulateNonAdmin404 && (
              <button
                type="button"
                onClick={() => setSimulateNonAdmin404(false)}
                className="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-3.5 py-2 text-xs font-medium text-white hover:bg-indigo-700"
              >
                Exit 404 Preview
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  const adminEmail = user?.email || 'owner@reviewassist.app';

  const navItems: {
    id: AdminNavSection;
    label: string;
    icon: typeof LayoutDashboard;
    badge?: number;
  }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    {
      id: 'restaurants',
      label: 'Restaurants & Hotels',
      icon: UtensilsCrossed,
      badge: pendingRestaurantsCount || undefined,
    },
    {
      id: 'cafes',
      label: 'Cafes & Coffee',
      icon: Coffee,
      badge: pendingCafesCount || undefined,
    },
    {
      id: 'barbers',
      label: 'Barbers & Salons',
      icon: Scissors,
      badge: pendingBarbersCount || undefined,
    },
    {
      id: 'gyms',
      label: 'Gyms & Fitness',
      icon: Dumbbell,
      badge: pendingGymsCount || undefined,
    },
    {
      id: 'clinics',
      label: 'ClinicOS / Medical & Dental',
      icon: Stethoscope,
      badge: pendingClinicsCount || undefined,
    },
    {
      id: 'catering',
      label: 'CateringOS & Banquet Halls',
      icon: Building2,
      badge: pendingCateringCount || undefined,
    },
    {
      id: 'loyalty',
      label: 'Loyalty & AI Reviews',
      icon: Star,
      badge: pendingLoyaltyCount || undefined,
    },
    {
      id: 'clients',
      label: 'All Businesses',
      icon: Building2,
      badge: counts?.pending || undefined,
    },
    {
      id: 'accounts',
      label: 'Accounts',
      icon: Users,
      badge: counts?.pendingDeletionAccounts || undefined,
    },
    { id: 'activity', label: 'Activity log', icon: Activity },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 font-sans flex">
      {/* Toast Notifications */}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-start justify-between gap-3 rounded-lg border px-4 py-3 text-xs shadow-md transition-all ${
              t.tone === 'success'
                ? 'border-emerald-200 bg-white text-slate-800'
                : 'border-rose-200 bg-white text-rose-800'
            }`}
          >
            <div className="flex items-start gap-2">
              {t.tone === 'success' ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" />
              ) : (
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
              )}
              <span className="leading-relaxed font-medium">{t.text}</span>
            </div>
            <button
              type="button"
              onClick={() =>
                setToasts((prev) => prev.filter((item) => item.id !== t.id))
              }
              className="text-slate-400 hover:text-slate-600"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>

      {/* Mobile Sidebar Backdrop */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-30 bg-slate-900/30 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Left Sidebar (Stripe/Linear clean light style) */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex flex-col border-r border-slate-200 bg-white transition-all duration-150 lg:static ${
          sidebarCollapsed ? 'w-16' : 'w-60'
        } ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Brand Header */}
        <div className="flex h-14 items-center justify-between border-b border-slate-200 px-4">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-2xs">
              <Shield className="h-4 w-4" />
            </div>
            {!sidebarCollapsed && (
              <div className="truncate">
                <span className="text-sm font-semibold tracking-tight text-slate-900">
                  Vitaran AI Reviews
                </span>
                <span className="ml-1.5 rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-medium text-indigo-700 border border-indigo-200/60">
                  Admin
                </span>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => setSidebarCollapsed((c) => !c)}
            className="hidden rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 lg:inline-flex"
            aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {sidebarCollapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </button>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 space-y-1 p-2.5" aria-label="Admin Navigation">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = activeNav === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setActiveNav(item.id);
                  setMobileMenuOpen(false);
                }}
                className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-xs font-medium transition-colors cursor-pointer ${
                  active
                    ? 'bg-indigo-50/90 text-indigo-700 font-semibold'
                    : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900'
                }`}
                title={sidebarCollapsed ? item.label : undefined}
              >
                <span className="flex items-center gap-2.5">
                  <Icon
                    className={`h-4 w-4 shrink-0 ${
                      active ? 'text-indigo-600' : 'text-slate-400'
                    }`}
                  />
                  {!sidebarCollapsed && <span>{item.label}</span>}
                </span>
                {!sidebarCollapsed && item.badge !== undefined && (
                  <span
                    className={`rounded-full px-1.5 py-0.2 text-[10px] font-semibold ${
                      item.id === 'clients'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-rose-100 text-rose-700'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Bottom Return to App Link */}
        <div className="border-t border-slate-200 p-3">
          <Link
            to="/dashboard"
            className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-800"
          >
            <ExternalLink className="h-3.5 w-3.5 shrink-0" />
            {!sidebarCollapsed && <span>Business Owner View</span>}
          </Link>
        </div>
      </aside>

      {/* Main Content Column */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Top Bar */}
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-slate-200 bg-white/95 px-4 sm:px-6 backdrop-blur-xs">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="rounded-lg border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-50 lg:hidden"
              aria-label="Open navigation menu"
            >
              <Menu className="h-4 w-4" />
            </button>
            <h1 className="text-sm font-semibold text-slate-900">
              {activeNav === 'activity'
                ? 'Activity Log'
                : activeNav === 'restaurants'
                  ? '🍽️ Restaurant & Hotel Approvals (BistroOS)'
                  : activeNav === 'cafes'
                    ? '☕ Cafe & Coffee Shop Approvals (CafeOS)'
                    : activeNav === 'barbers'
                      ? '✂️ Barber & Salon Approvals (BarberOS)'
                      : activeNav === 'gyms'
                        ? '🏋️ Gym & Fitness Approvals (GymOS)'
                        : activeNav === 'clinics'
                          ? '🏥 ClinicOS / Medical & Dental Approvals'
                          : activeNav === 'catering'
                          ? '🏛️ CateringOS & Banquet Hall Approvals'
                          : activeNav === 'loyalty'
                            ? '⭐ Loyalty & AI Reviews Approvals (LoyaltyOS)'
                            : activeNav === 'clients'
                            ? 'All Businesses'
                            : activeNav.charAt(0).toUpperCase() +
                              activeNav.slice(1)}
            </h1>
            <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[11px] font-medium text-slate-600">
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  repoMode === 'mock' ? 'bg-indigo-500' : 'bg-emerald-500'
                }`}
              />
              {repoMode === 'mock'
                ? 'Mock Repository (Safe Review Mode)'
                : 'Supabase RPC Repository'}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setCreateBizModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5 text-emerald-400" />
              <span>+ Create Business</span>
            </button>
            <button
              type="button"
              onClick={() => void loadAllAdminData()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
              title="Refresh data"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`}
              />
              <span className="hidden sm:inline">Refresh</span>
            </button>

            <div className="h-4 w-px bg-slate-200" />

            <span className="text-xs font-medium text-slate-600 truncate max-w-[180px]">
              {adminEmail}
            </span>

            <button
              type="button"
              onClick={() => void handleSignOut()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              <LogOut className="h-3.5 w-3.5 text-slate-500" />
              <span className="hidden sm:inline">Sign out</span>
            </button>
          </div>
        </header>

        {/* Page Body */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto space-y-6">
          {error && (
            <div className="flex items-center justify-between rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-800">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
                <span>{error}</span>
              </div>
              <button
                type="button"
                onClick={() => void loadAllAdminData()}
                className="rounded-md bg-white px-2.5 py-1 font-medium text-rose-700 border border-rose-200 hover:bg-rose-100"
              >
                Retry
              </button>
            </div>
          )}

          {/* ==================== 1. DASHBOARD VIEW ==================== */}
          {activeNav === 'dashboard' && (
            <div className="space-y-6">
              {/* 4 Stat Cards */}
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-2xs">
                  <p className="text-xs font-medium text-slate-500">
                    Total clients
                  </p>
                  <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
                    {loading ? '—' : (counts?.total ?? 0)}
                  </p>
                  <p className="mt-1 text-[11px] text-slate-400">
                    Registered across all categories
                  </p>
                </div>

                <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium text-slate-500">
                      Pending approval
                    </p>
                    <span className="h-2 w-2 rounded-full bg-amber-500" />
                  </div>
                  <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
                    {loading ? '—' : (counts?.pending ?? 0)}
                  </p>
                  <p className="mt-1 text-[11px] text-amber-700">
                    Awaiting review (QR offline)
                  </p>
                </div>

                <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium text-slate-500">Active</p>
                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  </div>
                  <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
                    {loading ? '—' : (counts?.active ?? 0)}
                  </p>
                  <p className="mt-1 text-[11px] text-emerald-700">
                    Serving live customer reviews
                  </p>
                </div>

                <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium text-slate-500">
                      Suspended
                    </p>
                    <span className="h-2 w-2 rounded-full bg-slate-400" />
                  </div>
                  <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
                    {loading ? '—' : (counts?.suspended ?? 0)}
                  </p>
                  <p className="mt-1 text-[11px] text-slate-500">
                    Includes disabled / pending deletion
                  </p>
                </div>
              </div>

              <div className="grid gap-6 lg:grid-cols-12">
                {/* Needs Your Attention List */}
                <div className="lg:col-span-7 rounded-lg border border-slate-200 bg-white shadow-2xs flex flex-col">
                  <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
                    <div>
                      <h2 className="text-sm font-semibold text-slate-900">
                        Needs your attention
                      </h2>
                      <p className="text-xs text-slate-500">
                        Newest pending business signups awaiting approval
                      </p>
                    </div>
                    <span className="rounded-full bg-amber-50 border border-amber-200 px-2.5 py-0.5 text-xs font-medium text-amber-800">
                      {pendingAttentionList.length} pending
                    </span>
                  </div>

                  {loading ? (
                    <TableLoadingSkeleton rows={3} />
                  ) : pendingAttentionList.length === 0 ? (
                    <div className="flex flex-1 flex-col items-center justify-center p-10 text-center">
                      <CheckCircle2 className="h-8 w-8 text-emerald-500 mb-2" />
                      <p className="text-xs font-semibold text-slate-800">
                        All caught up
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        There are no pending business signups awaiting approval.
                      </p>
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100">
                      {pendingAttentionList.map((biz) => (
                        <div
                          key={biz.id}
                          className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between hover:bg-slate-50/70 transition-colors"
                        >
                          <div
                            className="space-y-0.5 cursor-pointer"
                            onClick={() => {
                              setDrawerContext('clients');
                              setSelectedClientId(biz.id);
                            }}
                          >
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-xs font-semibold text-slate-900 hover:text-indigo-600">
                                {biz.name}
                              </span>
                              {(() => {
                                const badge = getIndustryBadgeMeta(biz.category);
                                return (
                                  <span
                                    className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold ${badge.badgeClass}`}
                                  >
                                    <span>{badge.emoji}</span>
                                    <span>
                                      {badge.label} · {badge.moduleName}
                                    </span>
                                  </span>
                                );
                              })()}
                              <span className="text-[11px] text-slate-400">
                                · {biz.city}
                              </span>
                            </div>
                            <p className="text-xs text-slate-500">
                              {biz.ownerEmail} · Signed up{' '}
                              {formatShortDate(biz.createdAt)}
                            </p>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              type="button"
                              disabled={actionBusy}
                              onClick={() => void handleApproveBusiness(biz)}
                              className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white shadow-2xs hover:bg-indigo-700 disabled:opacity-50 cursor-pointer"
                            >
                              <Check className="h-3.5 w-3.5" />
                              Approve
                            </button>
                            <button
                              type="button"
                              disabled={actionBusy}
                              onClick={() =>
                                setReasonModalAction({
                                  type: 'reject_business',
                                  record: biz,
                                })
                              }
                              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-50 disabled:opacity-50 cursor-pointer"
                            >
                              <X className="h-3.5 w-3.5" />
                              Reject
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 30-Day Signups Over Time Chart */}
                <div className="lg:col-span-5 rounded-lg border border-slate-200 bg-white p-5 shadow-2xs flex flex-col justify-between">
                  <div>
                    <h2 className="text-sm font-semibold text-slate-900">
                      Signups over time
                    </h2>
                    <p className="text-xs text-slate-500 mb-4">
                      New client registrations over the past 30 days
                    </p>
                    <SignupsTrendChart data={counts?.signupsPerDay ?? []} />
                  </div>

                  <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-500">
                    <span>Rejected signups: {counts?.rejected ?? 0}</span>
                    <span>
                      Pending deletion: {counts?.pendingDeletionAccounts ?? 0}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ==================== 2. SEPARATE INDUSTRY & ALL BUSINESSES APPROVAL VIEWS ==================== */}
          {(activeNav === 'clients' ||
            activeNav === 'restaurants' ||
            activeNav === 'cafes' ||
            activeNav === 'barbers' ||
            activeNav === 'gyms' ||
            activeNav === 'clinics' ||
            activeNav === 'catering' ||
            activeNav === 'loyalty') && (
            <div className="rounded-lg border border-slate-200 bg-white shadow-2xs">
              {/* Industry Filter Bar when viewing All Businesses */}
              {activeNav === 'clients' ? (
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50/80 px-5 py-3">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mr-1">
                      Industry:
                    </span>
                    {(
                      [
                        { id: 'all', label: 'All Industries', count: clients.length },
                        {
                          id: 'restaurant',
                          label: '🍽️ Restaurant / Hotel',
                          count: restaurantClients.length,
                        },
                        {
                          id: 'cafe',
                          label: '☕ Cafe & Coffee',
                          count: cafeClients.length,
                        },
                        {
                          id: 'barber',
                          label: '✂️ Barber / Salon',
                          count: barberClients.length,
                        },
                        {
                          id: 'gym',
                          label: '🏋️ Gym & Fitness',
                          count: gymClients.length,
                        },
                        {
                          id: 'clinic',
                          label: '🏥 ClinicOS / Medical & Dental',
                          count: clinicClients.length,
                        },
                        {
                          id: 'catering',
                          label: '🏛️ CateringOS & Banquet Halls',
                          count: cateringClients.length,
                        },
                        {
                          id: 'loyalty',
                          label: '⭐ Loyalty & AI Reviews',
                          count: loyaltyClients.length,
                        },
                      ] as const
                    ).map((ind) => (
                      <button
                        key={ind.id}
                        type="button"
                        onClick={() => setClientIndustryFilter(ind.id)}
                        className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11.5px] font-bold transition-colors cursor-pointer ${
                          clientIndustryFilter === ind.id
                            ? 'border-indigo-600 bg-indigo-600 text-white'
                            : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        <span>{ind.label}</span>
                        <span
                          className={`rounded-full px-1.5 text-[10px] ${
                            clientIndustryFilter === ind.id
                              ? 'bg-white/20 text-white'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {ind.count}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50/80 px-5 py-3">
                  <div>
                    <p className="text-xs font-bold text-slate-900">
                      {activeNav === 'restaurants'
                        ? '🍽️ Restaurant & Hotel Approval Queue — Unlocks BistroOS (Menu, Floors, Rooms, Waiters, KDS)'
                        : activeNav === 'cafes'
                          ? '☕ Cafe & Coffee Shop Approval Queue — Unlocks CafeOS (Wallet Stamp Card, Birthday Free Coffee, Counter Inventory & Quick Order)'
                          : activeNav === 'barbers'
                            ? '✂️ Barber & Salon Approval Queue — Unlocks BarberOS (Live Queue Timer, Broadcast Delays, Token QRs)'
                            : activeNav === 'clinics'
                              ? '🏥 ClinicOS / Medical & Dental Approval Queue — Unlocks Multi-Doctor Live Token Queue, Vitals, Digital Rx Vault, 3-Day Recalls & Doctor Commissions'
                              : activeNav === 'catering'
                                ? '🏛️ CateringOS & Banquet Hall Approval Queue — Unlocks Event Quotes, Website Embed, 3-Stage Payments, Recipe-to-Grocery & Head Chef PIN Portal'
                              : activeNav === 'loyalty'
                                ? '⭐ Loyalty & AI Reviews Approval Queue — Unlocks LoyaltyOS (Anti-Fraud Counter QR/NFC Star Wallet & 4-Digit Reward Lock)'
                                : '🏋️ Gym & Fitness Approval Queue — Unlocks GymOS (Member Signup QR, 3-Day Renewal Radar, Daily Check-In)'}
                    </p>
                  </div>
                  <span className="rounded-full bg-white border border-slate-200 px-2.5 py-0.5 text-[11px] font-semibold text-slate-600">
                    {scopedClientsForDirectory.length} total registered
                  </span>
                </div>
              )}

              {/* Filter Tabs & Search Header */}
              <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-wrap items-center gap-1">
                  {(
                    [
                      {
                        id: 'all',
                        label: 'All',
                        count: scopedClientsForDirectory.length,
                      },
                      {
                        id: 'pending',
                        label: 'Pending',
                        count: scopedClientsForDirectory.filter(
                          (c) => c.status === 'pending',
                        ).length,
                      },
                      {
                        id: 'active',
                        label: 'Active',
                        count: scopedClientsForDirectory.filter(
                          (c) => c.status === 'active',
                        ).length,
                      },
                      {
                        id: 'suspended',
                        label: 'Suspended',
                        count: scopedClientsForDirectory.filter(
                          (c) => c.status === 'suspended',
                        ).length,
                      },
                      {
                        id: 'rejected',
                        label: 'Rejected',
                        count: scopedClientsForDirectory.filter(
                          (c) => c.status === 'rejected',
                        ).length,
                      },
                    ] as {
                      id: ClientFilterTab;
                      label: string;
                      count?: number;
                    }[]
                  ).map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setClientStatusTab(tab.id)}
                      className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                        clientStatusTab === tab.id
                          ? 'bg-indigo-50 text-indigo-700 font-semibold'
                          : 'text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      <span>{tab.label}</span>
                      {tab.count !== undefined && (
                        <span className="rounded-full bg-white/80 px-1.5 py-0.2 text-[10px] text-slate-500 border border-slate-200/70">
                          {tab.count}
                        </span>
                      )}
                    </button>
                  ))}
                </div>

                <div className="relative w-full sm:w-64">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                  <input
                    type="search"
                    value={clientSearch}
                    onChange={(e) => setClientSearch(e.target.value)}
                    placeholder="Search business, city, email..."
                    className="w-full rounded-lg border border-slate-200 bg-slate-50/60 py-1.5 pl-8 pr-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:bg-white focus:outline-none"
                  />
                </div>
              </div>

              {/* Clients Table */}
              {loading ? (
                <TableLoadingSkeleton rows={6} />
              ) : filteredClients.length === 0 ? (
                <div className="p-12 text-center">
                  <Building2 className="mx-auto h-8 w-8 text-slate-300" />
                  <p className="mt-2 text-xs font-semibold text-slate-800">
                    No matching businesses in this section
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Try clearing your search filter or switching status tabs.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50/60 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                        <th className="px-5 py-3">Business &amp; Customer Route</th>
                        <th className="px-4 py-3">Industry Module</th>
                        <th className="px-4 py-3">Loyalty System</th>
                        <th className="px-4 py-3">City</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3">Owner email</th>
                        <th className="px-5 py-3 text-right">Quick Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {filteredClients.map((biz) => {
                        const badge = getIndustryBadgeMeta(biz.category);
                        const isLoyaltyOn = Boolean(
                          biz.loyaltyEnabled ?? biz.category === 'loyalty',
                        );
                        const routeSuffix =
                          biz.category === 'retail' || biz.category === 'services'
                            ? ''
                            : badge.workspace === 'gym'
                              ? '/gym'
                              : badge.workspace === 'barber'
                                ? '/queue'
                                : badge.workspace === 'cafe'
                                  ? '/cafe'
                                  : badge.workspace === 'loyalty'
                                    ? isLoyaltyOn
                                      ? '/loyalty'
                                      : ''
                                    : badge.workspace === 'clinic'
                                      ? '/clinic'
                                      : badge.workspace === 'catering'
                                        ? '/catering'
                                        : '/menu';
                        return (
                          <tr
                            key={biz.id}
                            onClick={() => {
                              setDrawerContext('clients');
                              setSelectedClientId(biz.id);
                            }}
                            tabIndex={0}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                setDrawerContext('clients');
                                setSelectedClientId(biz.id);
                              }
                            }}
                            className="hover:bg-slate-50/90 transition-colors cursor-pointer focus:outline-none focus:bg-indigo-50/40"
                          >
                            <td className="px-5 py-3.5 font-medium text-slate-900">
                              <div>{biz.name}</div>
                              <div className="text-[11px] font-mono text-slate-400">
                                /r/{biz.slug}
                                {routeSuffix}
                              </div>
                            </td>
                            <td className="px-4 py-3.5">
                              <span
                                className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-bold whitespace-nowrap ${badge.badgeClass}`}
                              >
                                <span>{badge.emoji}</span>
                                <span>
                                  {CATEGORY_LABELS[biz.category]} ·{' '}
                                  {biz.category === 'retail' ||
                                  biz.category === 'services'
                                    ? 'AI Reviews'
                                    : badge.moduleName}
                                </span>
                              </span>
                            </td>
                            <td
                              className="px-4 py-3.5 whitespace-nowrap"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <button
                                type="button"
                                role="switch"
                                aria-checked={isLoyaltyOn}
                                disabled={actionBusy}
                                onClick={() => void handleToggleClientLoyalty(biz)}
                                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold transition-colors cursor-pointer disabled:opacity-50 ${
                                  isLoyaltyOn
                                    ? 'border-lime-400 bg-lime-100 text-slate-900 hover:bg-lime-200/80'
                                    : 'border-slate-200 bg-slate-100 text-slate-500 hover:bg-slate-200/70'
                                }`}
                              >
                                <Star
                                  className={`h-3 w-3 ${
                                    isLoyaltyOn
                                      ? 'fill-amber-500 text-amber-600'
                                      : 'text-slate-400'
                                  }`}
                                  aria-hidden
                                />
                                <span>
                                  Loyalty System: {isLoyaltyOn ? 'ON' : 'OFF'}
                                </span>
                              </button>
                            </td>
                            <td className="px-4 py-3.5 text-slate-600">
                              {biz.city}
                            </td>
                            <td className="px-4 py-3.5">
                              <BusinessStatusBadge status={biz.status} />
                            </td>
                            <td className="px-4 py-3.5 text-slate-600 font-mono text-[11px]">
                              {biz.ownerEmail}
                            </td>
                            <td
                              className="px-5 py-3.5 text-right whitespace-nowrap"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {biz.status === 'pending' ? (
                                <button
                                  type="button"
                                  disabled={actionBusy}
                                  onClick={() => void handleApproveBusiness(biz)}
                                  className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-[11px] font-bold text-white shadow-2xs hover:bg-indigo-700 disabled:opacity-50 cursor-pointer"
                                >
                                  <Check className="h-3 w-3" />
                                  Approve {badge.moduleName}
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setDrawerContext('clients');
                                    setSelectedClientId(biz.id);
                                  }}
                                  className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                                >
                                  Manage →
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ==================== 3. ACCOUNTS VIEW (ADD-ON) ==================== */}
          {activeNav === 'accounts' && (
            <div className="space-y-4">
              <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-2xs flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">
                    Account Management &amp; Lifecycle
                  </h2>
                  <p className="text-xs text-slate-500">
                    Manage owner logins, password resets, 14-day soft deletion
                    grace periods, and permanent account erasure.
                  </p>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="rounded-full bg-rose-50 border border-rose-200 px-2.5 py-0.5 font-medium text-rose-700">
                    {counts?.pendingDeletionAccounts ?? 0} pending deletion
                  </span>
                  <span className="rounded-full bg-slate-100 border border-slate-200 px-2.5 py-0.5 font-medium text-slate-700">
                    {counts?.disabledAccounts ?? 0} disabled
                  </span>
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 bg-white shadow-2xs">
                {/* Filter Tabs & Search */}
                <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex flex-wrap items-center gap-1">
                    {(
                      [
                        { id: 'all', label: 'All accounts' },
                        { id: 'active', label: 'Active' },
                        { id: 'disabled', label: 'Disabled' },
                        { id: 'pending_deletion', label: 'Pending deletion' },
                      ] as { id: AccountFilterTab; label: string }[]
                    ).map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setAccountStateTab(tab.id)}
                        className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                          accountStateTab === tab.id
                            ? 'bg-indigo-50 text-indigo-700 font-semibold'
                            : 'text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  <div className="relative w-full sm:w-64">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                    <input
                      type="search"
                      value={accountSearch}
                      onChange={(e) => setAccountSearch(e.target.value)}
                      placeholder="Search email or business..."
                      className="w-full rounded-lg border border-slate-200 bg-slate-50/60 py-1.5 pl-8 pr-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:bg-white focus:outline-none"
                    />
                  </div>
                </div>

                {/* Accounts Table */}
                {loading ? (
                  <TableLoadingSkeleton rows={6} />
                ) : filteredAccounts.length === 0 ? (
                  <div className="p-12 text-center">
                    <Users className="mx-auto h-8 w-8 text-slate-300" />
                    <p className="mt-2 text-xs font-semibold text-slate-800">
                      No matching user accounts
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      Try switching account state tabs or clearing your search.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50/60 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                          <th className="px-5 py-3">Email</th>
                          <th className="px-4 py-3">Business name</th>
                          <th className="px-4 py-3">Business status</th>
                          <th className="px-4 py-3">Sign-up date</th>
                          <th className="px-4 py-3">Last sign-in</th>
                          <th className="px-5 py-3">Account state</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-xs">
                        {filteredAccounts.map((acc) => (
                          <tr
                            key={acc.id}
                            onClick={() => {
                              setDrawerContext('accounts');
                              setSelectedClientId(acc.id);
                            }}
                            tabIndex={0}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                setDrawerContext('accounts');
                                setSelectedClientId(acc.id);
                              }
                            }}
                            className="hover:bg-slate-50/90 transition-colors cursor-pointer focus:outline-none focus:bg-indigo-50/40"
                          >
                            <td className="px-5 py-3.5 font-mono text-[11px] font-medium text-slate-900">
                              {acc.ownerEmail}
                            </td>
                            <td className="px-4 py-3.5 font-medium text-slate-800">
                              {acc.name}
                              <span className="ml-1.5 text-[11px] text-slate-400 font-normal">
                                ({acc.city})
                              </span>
                            </td>
                            <td className="px-4 py-3.5">
                              <BusinessStatusBadge status={acc.status} />
                            </td>
                            <td className="px-4 py-3.5 text-slate-500 whitespace-nowrap">
                              {formatShortDate(acc.createdAt)}
                            </td>
                            <td className="px-4 py-3.5 text-slate-500 whitespace-nowrap">
                              {formatShortDate(acc.ownerLastSignInAt)}
                            </td>
                            <td className="px-5 py-3.5">
                              <AccountStateBadge
                                state={acc.accountState}
                                deletionScheduledFor={acc.deletionScheduledFor}
                                onQuickRestore={
                                  acc.accountState === 'pending_deletion'
                                    ? () => void handleRestoreAccount(acc)
                                    : undefined
                                }
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ==================== 4. ACTIVITY LOG VIEW ==================== */}
          {activeNav === 'activity' && (
            <div className="rounded-lg border border-slate-200 bg-white shadow-2xs">
              <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">
                    Platform Admin Audit Log
                  </h2>
                  <p className="text-xs text-slate-500">
                    Append-only record of status changes, account actions, and
                    permanent deletions (plain-text business &amp; email
                    preserved after deletion)
                  </p>
                </div>
                <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                  {auditLogs.length} entries
                </span>
              </div>

              {loading ? (
                <TableLoadingSkeleton rows={5} />
              ) : auditLogs.length === 0 ? (
                <div className="p-12 text-center">
                  <Activity className="mx-auto h-8 w-8 text-slate-300" />
                  <p className="mt-2 text-xs font-semibold text-slate-800">
                    No audit log entries yet
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50/60 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                        <th className="px-5 py-3">Timestamp</th>
                        <th className="px-4 py-3">Action</th>
                        <th className="px-4 py-3">Business &amp; Owner</th>
                        <th className="px-4 py-3">Reason</th>
                        <th className="px-5 py-3">Admin</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {auditLogs.map((entry) => (
                        <tr key={entry.id} className="hover:bg-slate-50/60">
                          <td className="px-5 py-3.5 text-slate-500 whitespace-nowrap font-mono text-[11px]">
                            {formatDateTime(entry.createdAt)}
                          </td>
                          <td className="px-4 py-3.5">
                            <span className="inline-flex rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 font-mono text-[11px] font-medium text-slate-800">
                              {entry.action}
                            </span>
                          </td>
                          <td className="px-4 py-3.5">
                            <div className="font-medium text-slate-900">
                              {entry.businessName || 'Deleted Business'}
                            </div>
                            <div className="font-mono text-[11px] text-slate-400">
                              {entry.ownerEmail || '—'}
                            </div>
                          </td>
                          <td className="px-4 py-3.5 text-slate-600 max-w-md">
                            {entry.reason || '—'}
                          </td>
                          <td className="px-5 py-3.5 font-mono text-[11px] text-slate-500">
                            {entry.adminEmail}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ==================== 5. SETTINGS VIEW ==================== */}
          {activeNav === 'settings' && (
            <div className="max-w-2xl space-y-6">
              <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-2xs space-y-4">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">
                    Admin Data Repository Mode
                  </h2>
                  <p className="mt-1 text-xs text-slate-500 leading-relaxed">
                    Per your review rules, migration{' '}
                    <code className="font-mono text-slate-700">
                      003_platform_admin_and_account_lifecycle.sql
                    </code>{' '}
                    and Edge Function{' '}
                    <code className="font-mono text-slate-700">
                      admin-delete-account
                    </code>{' '}
                    have been generated as files for your review and have{' '}
                    <strong>not</strong> been applied or deployed yet.
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => setRepoMode('mock')}
                    className={`rounded-lg border p-4 text-left transition-all cursor-pointer ${
                      repoMode === 'mock'
                        ? 'border-indigo-600 bg-indigo-50/40 ring-1 ring-indigo-600'
                        : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-900">
                        Mock Admin Repository
                      </span>
                      <span className="rounded-full bg-indigo-100 px-2 py-0.2 text-[10px] font-semibold text-indigo-700">
                        Default
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] text-slate-500 leading-relaxed">
                      Works immediately in browser memory + localStorage and
                      syncs status changes with the local dashboard.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setRepoMode('supabase')}
                    className={`rounded-lg border p-4 text-left transition-all cursor-pointer ${
                      repoMode === 'supabase'
                        ? 'border-indigo-600 bg-indigo-50/40 ring-1 ring-indigo-600'
                        : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-900">
                        Supabase RPC Repository
                      </span>
                      <span className="rounded-full bg-slate-100 px-2 py-0.2 text-[10px] font-medium text-slate-600">
                        Requires 003 SQL
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] text-slate-500 leading-relaxed">
                      Calls <code className="font-mono">is_platform_admin</code>
                      , <code className="font-mono">admin_list_businesses</code>
                      , and Edge Function{' '}
                      <code className="font-mono">admin-delete-account</code>.
                    </p>
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      mockAdminRepository.resetMockData();
                      void loadAllAdminData();
                      pushToast(
                        'success',
                        'Reset mock admin dataset to default 9 sample businesses.',
                      );
                    }}
                    className="rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Reset Demo Data
                  </button>

                  <button
                    type="button"
                    onClick={() => setSimulateNonAdmin404(true)}
                    className="rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Test Non-Admin 404 Screen
                  </button>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* ==================== SLIDE-OVER DETAIL DRAWER ==================== */}
      {selectedRecord && (
        <div
          className="fixed inset-0 z-40 flex justify-end bg-slate-900/30 backdrop-blur-[1px]"
          onClick={() => setSelectedClientId(null)}
        >
          <div
            className="relative flex h-full w-full max-w-lg flex-col border-l border-slate-200 bg-white shadow-xl overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drawer Header */}
            <div className="flex items-start justify-between border-b border-slate-200 px-6 py-5">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <BusinessStatusBadge status={selectedRecord.status} />
                  <AccountStateBadge
                    state={selectedRecord.accountState}
                    deletionScheduledFor={selectedRecord.deletionScheduledFor}
                  />
                </div>
                <h2 className="text-base font-semibold text-slate-900 pt-1">
                  {selectedRecord.name}
                </h2>
                <p className="text-xs font-mono text-slate-500">
                  {selectedRecord.ownerEmail}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedClientId(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                aria-label="Close drawer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Drawer Mode Switcher (Client Review vs Account Lifecycle) */}
            <div className="flex border-b border-slate-200 bg-slate-50/60 px-6 text-xs font-medium">
              <button
                type="button"
                onClick={() => setDrawerContext('clients')}
                className={`border-b-2 py-2.5 mr-6 cursor-pointer ${
                  drawerContext === 'clients'
                    ? 'border-indigo-600 text-indigo-600 font-semibold'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                Business Approval &amp; Status
              </button>
              <button
                type="button"
                onClick={() => setDrawerContext('accounts')}
                className={`border-b-2 py-2.5 cursor-pointer ${
                  drawerContext === 'accounts'
                    ? 'border-indigo-600 text-indigo-600 font-semibold'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                Account &amp; Deletion Controls
              </button>
            </div>

            {/* Drawer Content */}
            <div className="flex-1 space-y-6 p-6 text-xs">
              {/* Pending Deletion Countdown Alert */}
              {selectedRecord.accountState === 'pending_deletion' && (
                <div className="rounded-lg border border-rose-200 bg-rose-50/70 p-4 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1.5 font-semibold text-rose-800">
                      <Clock className="h-4 w-4 text-rose-600" />
                      Scheduled for Permanent Deletion
                    </span>
                    <span className="rounded bg-rose-100 px-2 py-0.5 text-[11px] font-semibold text-rose-900">
                      {getDaysRemaining(selectedRecord.deletionScheduledFor) ??
                        0}{' '}
                      days remaining
                    </span>
                  </div>
                  <p className="text-rose-700 leading-relaxed">
                    Login is disabled and the public review page is offline.
                    Scheduled purge date:{' '}
                    <strong>
                      {formatDateTime(selectedRecord.deletionScheduledFor)}
                    </strong>
                    .
                  </p>
                  {selectedRecord.deletedReason && (
                    <p className="rounded bg-white/80 px-2.5 py-1.5 text-slate-700 border border-rose-200/60">
                      <strong>Reason:</strong> {selectedRecord.deletedReason}
                    </p>
                  )}
                  <button
                    type="button"
                    disabled={actionBusy}
                    onClick={() => void handleRestoreAccount(selectedRecord)}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-xs font-medium text-white shadow-2xs hover:bg-indigo-700"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Restore Account &amp; Reactivate Business
                  </button>
                </div>
              )}

              {/* Metadata Grid */}
              <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-4 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-[11px] text-slate-400">Category</p>
                    <p className="font-medium text-slate-800">
                      {CATEGORY_LABELS[selectedRecord.category]}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] text-slate-400">City</p>
                    <p className="font-medium text-slate-800">
                      {selectedRecord.city}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] text-slate-400">Public Slug</p>
                    <p className="font-mono text-slate-800">
                      /r/{selectedRecord.slug}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] text-slate-400">Live Status</p>
                    <p className="font-medium text-slate-800">
                      {selectedRecord.status === 'active' &&
                      selectedRecord.accountState === 'active' ? (
                        <span className="text-emerald-700">
                          Live (Publicly accessible)
                        </span>
                      ) : (
                        <span className="text-amber-700">
                          Offline (Blocked by RLS)
                        </span>
                      )}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] text-slate-400">Signed up</p>
                    <p className="text-slate-700">
                      {formatDateTime(selectedRecord.createdAt)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] text-slate-400">Last sign-in</p>
                    <p className="text-slate-700">
                      {formatDateTime(selectedRecord.ownerLastSignInAt)}
                    </p>
                  </div>
                </div>

                <div className="border-t border-slate-200/80 pt-3">
                  <p className="text-[11px] text-slate-400">
                    Google Review Redirect URL
                  </p>
                  <p className="mt-0.5 font-mono text-[11px] break-all text-slate-700">
                    {selectedRecord.googleReviewUrl}
                  </p>
                </div>

                {selectedRecord.statusReason && (
                  <div className="border-t border-slate-200/80 pt-3">
                    <p className="text-[11px] text-slate-400">
                      Latest Status Reason ({formatShortDate(selectedRecord.statusChangedAt)})
                    </p>
                    <p className="mt-0.5 text-slate-800 font-medium">
                      {selectedRecord.statusReason}
                    </p>
                  </div>
                )}
              </div>

              {/* Context 1: Business Approval & Status Actions */}
              {drawerContext === 'clients' && (
                <div className="space-y-4">
                  {/* Modular Loyalty System ON / OFF Switch */}
                  <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-3.5">
                    <div className="space-y-0.5">
                      <p className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                        <Star className="h-3.5 w-3.5 fill-amber-500 text-amber-600" aria-hidden />
                        Loyalty &amp; Star Rewards System
                      </p>
                      <p className="text-[11px] text-slate-500">
                        Toggle customer Digital Star Wallet &amp; +1 Review Star card ON or OFF alongside Core AI Reviews.
                      </p>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={Boolean(
                        selectedRecord.loyaltyEnabled ??
                          selectedRecord.category === 'loyalty',
                      )}
                      disabled={actionBusy}
                      onClick={() => void handleToggleClientLoyalty(selectedRecord)}
                      className={`shrink-0 inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold transition-colors cursor-pointer disabled:opacity-50 ${
                        (selectedRecord.loyaltyEnabled ??
                        selectedRecord.category === 'loyalty')
                          ? 'border-lime-400 bg-lime-100 text-slate-900'
                          : 'border-slate-200 bg-slate-100 text-slate-600'
                      }`}
                    >
                      Loyalty System:{' '}
                      {(selectedRecord.loyaltyEnabled ??
                      selectedRecord.category === 'loyalty')
                        ? 'ON'
                        : 'OFF'}
                    </button>
                  </div>

                  <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Business Status Actions
                  </h3>

                  <div className="grid gap-2.5 sm:grid-cols-2">
                    {selectedRecord.status !== 'active' && (
                      <button
                        type="button"
                        disabled={actionBusy}
                        onClick={() => {
                          if (
                            selectedRecord.status === 'suspended' ||
                            selectedRecord.status === 'rejected'
                          ) {
                            setConfirmReactivateTarget(selectedRecord);
                          } else {
                            void handleApproveBusiness(selectedRecord);
                          }
                        }}
                        className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2.5 text-xs font-medium text-white shadow-2xs hover:bg-indigo-700 disabled:opacity-50 cursor-pointer"
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        {selectedRecord.status === 'pending'
                          ? 'Approve Business'
                          : 'Reactivate Business'}
                      </button>
                    )}

                    {selectedRecord.status !== 'rejected' && (
                      <button
                        type="button"
                        disabled={actionBusy}
                        onClick={() =>
                          setReasonModalAction({
                            type: 'reject_business',
                            record: selectedRecord,
                          })
                        }
                        className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-rose-200 bg-white px-4 py-2.5 text-xs font-medium text-rose-600 hover:bg-rose-50 disabled:opacity-50 cursor-pointer"
                      >
                        <XCircle className="h-4 w-4" />
                        Reject Business
                      </button>
                    )}

                    {selectedRecord.status !== 'suspended' && (
                      <button
                        type="button"
                        disabled={actionBusy}
                        onClick={() =>
                          setReasonModalAction({
                            type: 'suspend_business',
                            record: selectedRecord,
                          })
                        }
                        className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 cursor-pointer"
                      >
                        <ShieldOff className="h-4 w-4 text-slate-500" />
                        Suspend Business
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Context 2: Account Management & Deletion Controls */}
              {drawerContext === 'accounts' && (
                <div className="space-y-4">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Account Controls
                  </h3>

                  <div className="space-y-2.5">
                    {/* 1. Disable / Re-enable Account */}
                    <div className="flex items-center justify-between rounded-lg border border-slate-200 p-3.5">
                      <div className="pr-3">
                        <p className="font-semibold text-slate-900">
                          {selectedRecord.accountState === 'disabled'
                            ? 'Re-enable owner account'
                            : 'Disable owner account'}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          {selectedRecord.accountState === 'disabled'
                            ? 'Unblocks owner login and restores business status to active.'
                            : 'Blocks login and sets business status to suspended.'}
                        </p>
                      </div>
                      {selectedRecord.accountState === 'disabled' ? (
                        <button
                          type="button"
                          disabled={actionBusy}
                          onClick={() =>
                            void handleEnableAccount(selectedRecord)
                          }
                          className="shrink-0 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 cursor-pointer"
                        >
                          Re-enable
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={actionBusy}
                          onClick={() =>
                            setReasonModalAction({
                              type: 'disable_account',
                              record: selectedRecord,
                            })
                          }
                          className="shrink-0 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
                        >
                          Disable
                        </button>
                      )}
                    </div>

                    {/* 2. Send Password Reset Email */}
                    <div className="flex items-center justify-between rounded-lg border border-slate-200 p-3.5">
                      <div className="pr-3">
                        <p className="font-semibold text-slate-900">
                          Send password reset email
                        </p>
                        <p className="text-[11px] text-slate-500">
                          Dispatches a recovery link to{' '}
                          <span className="font-mono">
                            {selectedRecord.ownerEmail}
                          </span>
                        </p>
                      </div>
                      <button
                        type="button"
                        disabled={actionBusy}
                        onClick={() =>
                          void handleSendPasswordReset(selectedRecord)
                        }
                        className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
                      >
                        <KeyRound className="h-3.5 w-3.5 text-slate-500" />
                        Send Reset
                      </button>
                    </div>

                    {/* 3. Soft Delete (14-day Grace Period) or Restore */}
                    <div className="flex items-center justify-between rounded-lg border border-amber-200/90 bg-amber-50/30 p-3.5">
                      <div className="pr-3">
                        <p className="font-semibold text-slate-900">
                          {selectedRecord.accountState === 'pending_deletion'
                            ? 'Restore from pending deletion'
                            : 'Delete account (soft · 14-day grace period)'}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          {selectedRecord.accountState === 'pending_deletion'
                            ? 'Cancels scheduled purge and restores business to active.'
                            : 'Marks pending_deletion, disables login, and takes business offline.'}
                        </p>
                      </div>
                      {selectedRecord.accountState === 'pending_deletion' ? (
                        <button
                          type="button"
                          disabled={actionBusy}
                          onClick={() =>
                            void handleRestoreAccount(selectedRecord)
                          }
                          className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 cursor-pointer"
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                          Restore
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={actionBusy}
                          onClick={() =>
                            setReasonModalAction({
                              type: 'soft_delete_account',
                              record: selectedRecord,
                            })
                          }
                          className="shrink-0 rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-medium text-amber-800 hover:bg-amber-50 cursor-pointer"
                        >
                          Schedule Delete
                        </button>
                      )}
                    </div>

                    {/* 4. Delete Permanently Now */}
                    <div className="flex items-center justify-between rounded-lg border border-rose-200 bg-rose-50/40 p-3.5">
                      <div className="pr-3">
                        <p className="font-semibold text-rose-900">
                          Delete permanently now
                        </p>
                        <p className="text-[11px] text-rose-700">
                          Deletes business data first, then removes auth user.
                          Requires typing business name + reason.
                        </p>
                      </div>
                      <button
                        type="button"
                        disabled={actionBusy}
                        onClick={() => setPermanentDeleteTarget(selectedRecord)}
                        className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-rose-700 cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Delete Now
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ==================== CONFIRMATION MODALS ==================== */}
      {reasonModalAction && (
        <ReasonActionModal
          title={
            reasonModalAction.type === 'reject_business'
              ? `Reject "${reasonModalAction.record.name}"`
              : reasonModalAction.type === 'suspend_business'
                ? `Suspend "${reasonModalAction.record.name}"`
                : reasonModalAction.type === 'disable_account'
                  ? `Disable Account (${reasonModalAction.record.ownerEmail})`
                  : `Schedule Account Deletion (${reasonModalAction.record.name})`
          }
          description={
            reasonModalAction.type === 'reject_business'
              ? 'Rejecting this signup keeps their QR code and customer review page offline. Please provide a reason for the audit log.'
              : reasonModalAction.type === 'suspend_business'
                ? 'Suspending immediately takes the public review page offline so no customer reviews can be generated.'
                : reasonModalAction.type === 'disable_account'
                  ? 'Disabling blocks the owner from signing in and suspends their business listing.'
                  : 'Marks the account pending_deletion, disables login, and takes the business offline during the grace period.'
          }
          confirmLabel={
            reasonModalAction.type === 'reject_business'
              ? 'Reject Business'
              : reasonModalAction.type === 'suspend_business'
                ? 'Suspend Business'
                : reasonModalAction.type === 'disable_account'
                  ? 'Disable Account'
                  : 'Schedule Deletion'
          }
          tone={
            reasonModalAction.type === 'reject_business' ||
            reasonModalAction.type === 'soft_delete_account'
              ? 'danger'
              : 'warning'
          }
          showGraceDaysInput={
            reasonModalAction.type === 'soft_delete_account'
          }
          loading={actionBusy}
          onConfirm={(reason, graceDays) =>
            void handleReasonModalConfirm(reason, graceDays)
          }
          onClose={() => setReasonModalAction(null)}
        />
      )}

      {permanentDeleteTarget && (
        <PermanentDeleteModal
          businessName={permanentDeleteTarget.name}
          ownerEmail={permanentDeleteTarget.ownerEmail}
          loading={actionBusy}
          onConfirm={(typedName, reason) =>
            void handlePermanentDeleteConfirm(typedName, reason)
          }
          onClose={() => setPermanentDeleteTarget(null)}
        />
      )}

      {confirmReactivateTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-[1px]"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-6 shadow-xl space-y-4">
            <h3 className="text-base font-semibold text-slate-900">
              Reactivate "{confirmReactivateTarget.name}"?
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              This will set the business status back to{' '}
              <code className="font-mono font-semibold text-emerald-700">
                active
              </code>{' '}
              and make their public customer review page (
              <code className="font-mono">
                /r/{confirmReactivateTarget.slug}
              </code>
              ) live again.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmReactivateTarget(null)}
                className="rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={actionBusy}
                onClick={() =>
                  void handleReactivateBusiness(confirmReactivateTarget)
                }
                className="rounded-lg bg-indigo-600 px-3.5 py-2 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {actionBusy ? 'Reactivating...' : 'Confirm Reactivate'}
              </button>
            </div>
          </div>
        </div>
      )}

      {createBizModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-[1px]"
          onClick={() => setCreateBizModalOpen(false)}
        >
          <form
            onSubmit={(e) => void handleCreateAdminBusiness(e)}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Create &amp; Provision Tenant Workspace
                </h3>
                <p className="text-xs text-slate-500">
                  Choose an industry vertical (including ClinicOS) to provision immediately.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCreateBizModalOpen(false)}
                className="rounded-md p-1 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-700">
                Industry OS / Category
              </label>
              <select
                value={newBizCategory}
                onChange={(e) => {
                  const cat = e.target.value as BusinessCategory;
                  setNewBizCategory(cat);
                  setNewBizLoyaltyEnabled(cat === 'loyalty');
                }}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-900 focus:border-indigo-500 focus:outline-none"
              >
                <option value="retail">
                  🛍️ Retail / Boutique — Pure AI Google Reviews
                </option>
                <option value="services">
                  🛠️ Local Services — Pure AI Google Reviews
                </option>
                <option value="loyalty">
                  ⭐ LoyaltyOS / AI Reviews + Star Rewards
                </option>
                <option value="clinic">
                  🏥 ClinicOS / Medical &amp; Dental (OPD Queue, Vitals &amp; Digital Rx)
                </option>
                <option value="catering">
                  🏛️ CateringOS &amp; Banquet Halls (Event Quotes, Hall Slots &amp; Chef PIN)
                </option>
                <option value="restaurant">
                  🍽️ BistroOS / Restaurant &amp; Dining
                </option>
                <option value="hotel">🏨 BistroOS / Hotel &amp; Rooms</option>
                <option value="cafe">☕ CafeOS / Cafe &amp; Coffee Shop</option>
                <option value="barber">✂️ BarberOS / Barber &amp; Salon</option>
                <option value="gym">🏋️ GymOS / Gym &amp; Fitness Studio</option>
              </select>
            </div>

            {/* Modular Loyalty System Toggle Pill in Create Business Modal */}
            <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5">
              <div>
                <p className="text-xs font-bold text-slate-900">
                  Loyalty &amp; Star Rewards Add-On
                </p>
                <p className="text-[11px] text-slate-500">
                  {newBizLoyaltyEnabled
                    ? 'Enabled: AI Google Reviews + Digital Star Wallet'
                    : 'Disabled: Pure AI Google Review System only'}
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={newBizLoyaltyEnabled}
                onClick={() => setNewBizLoyaltyEnabled((v) => !v)}
                className={`shrink-0 inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold transition-colors cursor-pointer ${
                  newBizLoyaltyEnabled
                    ? 'border-lime-400 bg-lime-100 text-slate-900'
                    : 'border-slate-200 bg-white text-slate-600'
                }`}
              >
                <Star
                  className={`h-3 w-3 ${
                    newBizLoyaltyEnabled
                      ? 'fill-amber-500 text-amber-600'
                      : 'text-slate-400'
                  }`}
                  aria-hidden
                />
                <span>Loyalty System: {newBizLoyaltyEnabled ? 'ON' : 'OFF'}</span>
              </button>
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-700">
                Business / Clinic Name
              </label>
              <input
                type="text"
                required
                value={newBizName}
                onChange={(e) => setNewBizName(e.target.value)}
                placeholder="e.g. Apex Dental & Skin Clinic"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs focus:border-indigo-500 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-700">
                  City
                </label>
                <input
                  type="text"
                  required
                  value={newBizCity}
                  onChange={(e) => setNewBizCity(e.target.value)}
                  placeholder="Hyderabad"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs focus:border-indigo-500 focus:outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-700">
                  Custom Slug (Optional)
                </label>
                <input
                  type="text"
                  value={newBizSlug}
                  onChange={(e) => setNewBizSlug(e.target.value)}
                  placeholder="apex-dental-clinic"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs font-mono focus:border-indigo-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-700">
                Owner Email (Optional)
              </label>
              <input
                type="email"
                value={newBizEmail}
                onChange={(e) => setNewBizEmail(e.target.value)}
                placeholder="doctor@apexclinic.in"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs font-mono focus:border-indigo-500 focus:outline-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setCreateBizModalOpen(false)}
                className="rounded-lg border border-slate-200 px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={creatingBiz}
                className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800 disabled:opacity-50 cursor-pointer"
              >
                {creatingBiz ? 'Provisioning…' : 'Create & Activate →'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
